/**
 * 文档管理路由
 * 处理文档上传、查询、删除等操作
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import {
  processUploadedDocument,
  getDocumentList,
  getDocumentDetail,
  getDocumentChunks,
  deleteDocument,
  searchDocuments,
} from '@/services/documentProcessor';

const router = Router();

// 配置 multer 文件上传
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
});

/**
 * 上传文档
 * POST /api/documents/upload
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return errorResponse(res, '请选择要上传的文件', 400, 400);
    }

    const { title, category, uploadedBy } = req.body;

    if (!title) {
      return errorResponse(res, '缺少文档标题', 400, 400);
    }

    logger.info('收到文档上传请求', {
      fileName: req.file.originalname,
      title,
      category,
    });

    const result = await processUploadedDocument(
      req.file,
      title,
      category,
      uploadedBy,
    );

    successResponse(res, {
      docId: result.docId,
      status: result.status,
      message: '文档上传成功，正在处理中...',
    });
  } catch (error: any) {
    logger.error('文档上传失败', { error });
    errorResponse(res, error.message || '文档上传失败', 500, 500);
  }
});

/**
 * 获取文档列表
 * GET /api/documents
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      category,
    } = req.query;

    const result = getDocumentList({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as any,
      category: category as string,
    });

    successResponse(res, result);
  } catch (error: any) {
    logger.error('获取文档列表失败', { error });
    errorResponse(res, '获取文档列表失败', 500, 500);
  }
});

/**
 * 获取文档详情
 * GET /api/documents/:docId
 */
router.get('/:docId', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    logger.info('查询文档详情', { docId });

    const doc = getDocumentDetail(docId);

    if (!doc) {
      return errorResponse(res, '文档不存在', 404, 404);
    }

    successResponse(res, doc);
  } catch (error: any) {
    logger.error('获取文档详情失败', { error });
    errorResponse(res, '获取文档详情失败', 500, 500);
  }
});

/**
 * 获取文档分块列表
 * GET /api/documents/:docId/chunks
 */
router.get('/:docId/chunks', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    logger.info('查询文档分块', { docId });

    const chunks = getDocumentChunks(docId);

    successResponse(res, {
      docId,
      chunks,
      count: chunks.length,
    });
  } catch (error: any) {
    logger.error('获取文档分块失败', { error });
    errorResponse(res, '获取文档分块失败', 500, 500);
  }
});

/**
 * 获取文档处理状态
 * GET /api/documents/:docId/status
 */
router.get('/:docId/status', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    logger.info('查询文档状态', { docId });

    const doc = getDocumentDetail(docId);

    if (!doc) {
      return errorResponse(res, '文档不存在', 404, 404);
    }

    successResponse(res, {
      docId: doc.doc_id,
      status: doc.status,
      chunkCount: doc.chunk_count,
      errorMessage: doc.error_message,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    });
  } catch (error: any) {
    logger.error('获取文档状态失败', { error });
    errorResponse(res, '获取文档状态失败', 500, 500);
  }
});

/**
 * 删除文档
 * DELETE /api/documents/:docId
 */
router.delete('/:docId', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;

    logger.info('删除文档', { docId });

    await deleteDocument(docId);

    successResponse(res, {
      message: '文档删除成功',
    });
  } catch (error: any) {
    logger.error('删除文档失败', { error });
    errorResponse(res, error.message || '删除文档失败', 500, 500);
  }
});

/**
 * 搜索文档（向量搜索）
 * POST /api/documents/search
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, category } = req.body;

    if (!query) {
      return errorResponse(res, '缺少搜索关键词', 400, 400);
    }

    logger.info('搜索文档', { query, topK, category });

    const results = await searchDocuments(query, topK, category);

    successResponse(res, {
      query,
      results,
      count: results.length,
    });
  } catch (error: any) {
    logger.error('搜索文档失败', { error });
    errorResponse(res, error.message || '搜索文档失败', 500, 500);
  }
});

export default router;
