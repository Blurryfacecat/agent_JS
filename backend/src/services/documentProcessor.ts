/**
 * 文档处理服务
 * 整合文档上传、解析、分块、向量化的完整流程
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ragConfig, DocumentStatus, DocumentStatusType } from '@/config/rag';
import { getSQLiteDB } from '@/utils/db';
import logger from '@/utils/logger';
import { initializeBucket, uploadFileToMinio, deleteDocumentFiles } from './minio';
import { parseDocument, extractFileType, isSupportedFileType } from './documentParser';
import { chunkDocument, Chunk } from './documentChunker';
import { chromaService } from './chroma';

/**
 * 文档上传处理
 */
export const processUploadedDocument = async (
  file: Express.Multer.File,
  title: string,
  category?: string,
  uploadedBy?: string,
): Promise<{ docId: string; status: DocumentStatusType }> => {
  const docId = `doc_${uuidv4()}`;
  const fileType = extractFileType(file.originalname);

  // 验证文件类型
  if (!isSupportedFileType(fileType)) {
    throw new Error(`不支持的文件类型: ${fileType}`);
  }

  // 验证文件大小
  if (file.size > ragConfig.maxFileSize) {
    throw new Error(`文件过大，最大支持 ${ragConfig.maxFileSize / 1024 / 1024}MB`);
  }

  logger.info('开始处理上传文档', {
    docId,
    fileName: file.originalname,
    fileType,
    fileSize: file.size,
  });

  try {
    // 1. 初始化 MinIO bucket（仅首次）
    await initializeBucket();

    // 2. 上传到 MinIO
    const minioPath = await uploadFileToMinio(docId, file.originalname, file.path, fileType);

    // 3. 保存到数据库
    await saveDocumentToDB({
      docId,
      title,
      category,
      fileName: file.originalname,
      fileType,
      fileSize: file.size,
      minioPath,
      uploadedBy,
      status: DocumentStatus.PROCESSING,
    });

    // 4. 异步处理文档（不阻塞响应）
    processDocumentAsync(docId, file.path, title, category).catch((error) => {
      logger.error('异步处理文档失败', { docId, error });
    });

    // 5. 删除临时文件
    try {
      fs.unlinkSync(file.path);
    } catch (e) {
      logger.warn('删除临时文件失败', { error: e });
    }

    return { docId, status: DocumentStatus.PROCESSING };
  } catch (error) {
    // 清理资源
    try {
      fs.unlinkSync(file.path);
      await deleteDocumentFiles(docId);
    } catch (e) {
      logger.error('清理资源失败', { error: e });
    }

    // 更新状态为失败
    await updateDocumentInDB(docId, {
      status: DocumentStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};

/**
 * 异步处理文档（解析、分块、向量化）
 */
const processDocumentAsync = async (
  docId: string,
  filePath: string,
  title: string,
  category?: string,
): Promise<void> => {
  try {
    logger.info('异步处理文档开始', { docId });

    // 1. 解析文档
    logger.info('步骤1: 开始解析文档', { docId, filePath });
    const parseResult = await parseDocument(filePath, extractFileType(filePath));
    logger.info('文档解析成功', { contentLength: parseResult.content.length });

    // 2. 分块
    logger.info('步骤2: 开始分块', { docId });
    const chunks = await chunkDocument(docId, parseResult.content, title, category);
    logger.info('分块完成', { chunkCount: chunks.length });

    // 3. 保存分块到数据库
    logger.info('步骤3: 保存分块到数据库', { docId, chunkCount: chunks.length });
    await saveChunksToDB(docId, chunks);
    logger.info('分块保存完成');

    // 4. 向量化并存储到 ChromaDB
    logger.info('步骤4: 开始向量化', { docId });
    await vectorizeAndStoreChunks(docId, chunks, title, category);
    logger.info('向量化完成');

    // 5. 更新文档状态为完成
    await updateDocumentInDB(docId, {
      status: DocumentStatus.COMPLETED,
      chunkCount: chunks.length,
    });

    logger.info('文档处理完成', { docId, chunkCount: chunks.length });
  } catch (error) {
    logger.error('文档处理失败', { docId, error: error instanceof Error ? error.stack : String(error) });

    await updateDocumentInDB(docId, {
      status: DocumentStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};

/**
 * 向量化并存储分块到 ChromaDB
 */
const vectorizeAndStoreChunks = async (
  docId: string,
  chunks: Chunk[],
  title?: string,
  category?: string,
): Promise<void> => {
  try {
    logger.info('开始向量化分块', { docId, chunkCount: chunks.length });

    // 初始化 ChromaDB 集合
    await chromaService.init(ragConfig.chroma.collectionName);

    // 构建预分块文档数据
    const preChunkedItems = chunks.map((chunk) => ({
      id: chunk.chunkId,
      text: chunk.content,
      metadata: {
        doc_id: docId,
        chunk_index: chunk.chunkIndex,
        title,
        category,
        chunk_size: chunk.metadata.chunkSize,
        start_position: chunk.metadata.startPosition,
        end_position: chunk.metadata.endPosition,
      },
    }));

    // 使用新方法添加预分块文档
    await chromaService.addPreChunkedDocuments(preChunkedItems);

    // 更新分块的 chroma_id
    const db = getSQLiteDB();
    const updateStmt = db.prepare(`
      UPDATE document_chunks SET chroma_id = ? WHERE chunk_id = ?
    `);

    for (const chunk of chunks) {
      updateStmt.run(chunk.chunkId, chunk.chunkId);
    }

    logger.info('分块向量化完成', { docId, count: chunks.length });
  } catch (error) {
    logger.error('分块向量化失败', { docId, error });
    throw error;
  }
};

/**
 * 保存文档到数据库
 */
const saveDocumentToDB = async (doc: {
  docId: string;
  title: string;
  category?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  minioPath?: string;
  uploadedBy?: string;
  status: DocumentStatusType;
  errorMessage?: string;
}): Promise<void> => {
  const db = getSQLiteDB();

  const stmt = db.prepare(`
    INSERT INTO documents (
      doc_id, title, category, file_name, file_type, file_size,
      minio_path, uploaded_by, status, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    doc.docId,
    doc.title,
    doc.category || null,
    doc.fileName,
    doc.fileType,
    doc.fileSize,
    doc.minioPath || null,
    doc.uploadedBy || null,
    doc.status,
    doc.errorMessage || null,
  );

  logger.info('文档保存到数据库', { docId: doc.docId });
};

/**
 * 更新文档在数据库中的信息
 */
const updateDocumentInDB = async (
  docId: string,
  updates: Partial<{
    minioPath: string;
    chunkCount: number;
    status: DocumentStatusType;
    errorMessage: string;
  }>,
): Promise<void> => {
  const db = getSQLiteDB();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.minioPath !== undefined) {
    fields.push('minio_path = ?');
    values.push(updates.minioPath);
  }
  if (updates.chunkCount !== undefined) {
    fields.push('chunk_count = ?');
    values.push(updates.chunkCount);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.errorMessage);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(docId);

  const stmt = db.prepare(`
    UPDATE documents SET ${fields.join(', ')} WHERE doc_id = ?
  `);

  stmt.run(...values);

  logger.info('文档信息已更新', { docId, updates });
};

/**
 * 保存分块到数据库
 */
const saveChunksToDB = async (docId: string, chunks: Chunk[]): Promise<void> => {
  const db = getSQLiteDB();

  const stmt = db.prepare(`
    INSERT INTO document_chunks (chunk_id, doc_id, chunk_index, content, metadata)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const chunk of chunks) {
    stmt.run(
      chunk.chunkId,
      docId,
      chunk.chunkIndex,
      chunk.content,
      JSON.stringify(chunk.metadata),
    );
  }

  logger.info('分块保存到数据库', { docId, count: chunks.length });
};

/**
 * 获取文档列表
 */
export const getDocumentList = (params: {
  page?: number;
  limit?: number;
  status?: DocumentStatusType;
  category?: string;
}): {
  list: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} => {
  const db = getSQLiteDB();
  const { page = 1, limit = 20, status, category } = params;
  const offset = (page - 1) * limit;

  // 构建查询条件
  const conditions: string[] = [];
  const queryParams: any[] = [];

  if (status) {
    conditions.push('status = ?');
    queryParams.push(status);
  }
  if (category) {
    conditions.push('category = ?');
    queryParams.push(category);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询总数
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM documents ${whereClause}`);
  const countResult = countStmt.get(...queryParams) as { total: number };

  // 查询列表
  const listStmt = db.prepare(`
    SELECT
      id, doc_id, title, category, file_name, file_type, file_size,
      chunk_count, status, uploaded_by, created_at, updated_at
    FROM documents
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const list = listStmt.all(...queryParams, limit, offset);

  return {
    list,
    total: countResult.total,
    page,
    limit,
    totalPages: Math.ceil(countResult.total / limit),
  };
};

/**
 * 获取文档详情
 */
export const getDocumentDetail = (docId: string): any | null => {
  const db = getSQLiteDB();

  const stmt = db.prepare(`
    SELECT * FROM documents WHERE doc_id = ?
  `);

  return stmt.get(docId) || null;
};

/**
 * 获取文档的分块列表
 */
export const getDocumentChunks = (docId: string): any[] => {
  const db = getSQLiteDB();

  const stmt = db.prepare(`
    SELECT chunk_id, chunk_index, content, metadata, created_at
    FROM document_chunks
    WHERE doc_id = ?
    ORDER BY chunk_index ASC
  `);

  return stmt.all(docId);
};

/**
 * 删除文档
 */
export const deleteDocument = async (docId: string): Promise<void> => {
  const db = getSQLiteDB();

  try {
    // 1. 从 ChromaDB 删除向量
    await chromaService.deleteDocuments([docId]);

    // 2. 从数据库删除分块（级联删除）
    db.prepare('DELETE FROM document_chunks WHERE doc_id = ?').run(docId);

    // 3. 从数据库删除文档
    db.prepare('DELETE FROM documents WHERE doc_id = ?').run(docId);

    // 4. 从 MinIO 删除文件
    await deleteDocumentFiles(docId);

    logger.info('文档删除成功', { docId });
  } catch (error) {
    logger.error('文档删除失败', { docId, error });
    throw error;
  }
};

/**
 * 搜索文档（向量搜索）
 */
export const searchDocuments = async (
  query: string,
  topK: number = 5,
  category?: string,
): Promise<any[]> => {
  await chromaService.init(ragConfig.chroma.collectionName);

  const filter = category ? { category } : undefined;
  const results = await chromaService.search(query, topK, filter);

  // 获取文档详情
  const db = getSQLiteDB();
  const docIds = [...new Set(results.map((r) => r.metadata?.doc_id).filter(Boolean))];

  const docsMap = new Map();
  if (docIds.length > 0) {
    const placeholders = docIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT doc_id, title, category FROM documents WHERE doc_id IN (${placeholders})`);
    const docs = stmt.all(...docIds) as Array<{ doc_id: string; title: string; category: string }>;
    for (const doc of docs) {
      docsMap.set(doc.doc_id, doc);
    }
  }

  // 组合结果
  return results.map((result) => ({
    chunkId: result.id,
    content: result.text,
    score: result.score,
    document: docsMap.get(result.metadata?.doc_id),
    chunkIndex: result.metadata?.chunk_index,
  }));
};
