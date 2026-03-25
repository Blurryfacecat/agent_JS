/**
 * MinIO 对象存储服务
 */

import * as Minio from 'minio';
import { ragConfig } from '@/config/rag';
import logger from '@/utils/logger';
import fs from 'fs';
import path from 'path';

// MinIO 客户端单例
let minioClient: Minio.Client | null = null;

/**
 * 获取 MinIO 客户端
 */
export const getMinioClient = (): Minio.Client => {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: ragConfig.minio.endPoint.split(':')[0], // 只取主机名
      port: parseInt(ragConfig.minio.endPoint.split(':')[1] || '9000'),
      useSSL: ragConfig.minio.useSSL,
      accessKey: ragConfig.minio.accessKey,
      secretKey: ragConfig.minio.secretKey,
    });

    logger.info('MinIO 客户端已初始化', {
      endPoint: ragConfig.minio.endPoint,
      bucket: ragConfig.minio.bucket,
    });
  }

  return minioClient;
};

/**
 * 初始化 Bucket
 */
export const initializeBucket = async (): Promise<void> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;

  try {
    // 检查 bucket 是否存在
    const exists = await client.bucketExists(bucketName);

    if (!exists) {
      // 创建 bucket
      await client.makeBucket(bucketName);
      logger.info(`MinIO Bucket 创建成功: ${bucketName}`);
    } else {
      logger.debug(`MinIO Bucket 已存在: ${bucketName}`);
    }
  } catch (error) {
    logger.error('MinIO Bucket 初始化失败', { error });
    throw error;
  }
};

/**
 * 上传文件到 MinIO
 */
export const uploadFileToMinio = async (
  docId: string,
  fileName: string,
  filePath: string,
  fileType: string,
): Promise<string> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;

  // 生成 MinIO 存储路径: knowledge-docs/{doc_id}/original.{ext}
  const ext = path.extname(fileName);
  const objectName = `knowledge-docs/${docId}/original${ext}`;

  try {
    // 设置 Content-Type
    const metaData = {
      'Content-Type': getContentType(fileType),
      'X-Amz-Meta-Document-Id': docId,
      'X-Amz-Meta-Original-Name': fileName,
    };

    // 上传文件
    await client.fPutObject(bucketName, objectName, filePath, metaData);

    logger.info('文件上传到 MinIO 成功', {
      docId,
      fileName,
      objectName,
    });

    return objectName;
  } catch (error) {
    logger.error('文件上传到 MinIO 失败', { docId, fileName, error });
    throw error;
  }
};

/**
 * 从 MinIO 下载文件
 */
export const downloadFileFromMinio = async (
  objectName: string,
  localPath: string,
): Promise<void> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;

  try {
    // 确保本地目录存在
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await client.fGetObject(bucketName, objectName, localPath);

    logger.info('文件从 MinIO 下载成功', { objectName, localPath });
  } catch (error) {
    logger.error('文件从 MinIO 下载失败', { objectName, error });
    throw error;
  }
};

/**
 * 删除 MinIO 中的文件
 */
export const deleteFileFromMinio = async (objectName: string): Promise<void> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;

  try {
    await client.removeObject(bucketName, objectName);

    logger.info('文件从 MinIO 删除成功', { objectName });
  } catch (error) {
    logger.error('文件从 MinIO 删除失败', { objectName, error });
    throw error;
  }
};

/**
 * 删除文档的所有相关文件
 */
export const deleteDocumentFiles = async (docId: string): Promise<void> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;
  const prefix = `knowledge-docs/${docId}/`;

  try {
    // 列出所有以 prefix 开头的对象
    const objectsList = [];

    for await (const obj of client.listObjects(bucketName, prefix, true)) {
      objectsList.push(obj);
    }

    // 删除所有对象
    if (objectsList.length > 0) {
      const objectsToDelete = objectsList.map((obj: any) => obj.name);
      await client.removeObjects(bucketName, objectsToDelete);

      logger.info('删除文档文件成功', { docId, count: objectsToDelete.length });
    }
  } catch (error) {
    logger.error('删除文档文件失败', { docId, error });
    throw error;
  }
};

/**
 * 获取文件访问 URL (临时)
 */
export const getPresignedUrl = async (
  objectName: string,
  expirySeconds = 3600,
): Promise<string> => {
  const client = getMinioClient();
  const bucketName = ragConfig.minio.bucket;

  try {
    const url = await client.presignedGetObject(bucketName, objectName, expirySeconds);
    return url;
  } catch (error) {
    logger.error('获取预签名 URL 失败', { objectName, error });
    throw error;
  }
};

/**
 * 根据文件类型获取 Content-Type
 */
const getContentType = (fileType: string): string => {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return contentTypes[fileType] || 'application/octet-stream';
};
