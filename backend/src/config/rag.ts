/**
 * RAG 文档处理配置
 */

export const ragConfig = {
  // 文档上传限制
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['pdf', 'txt', 'md'],

  // 分块参数
  chunkSize: 500,
  chunkOverlap: 50,
  minChunkSize: 100,

  // 向量化
  embeddingBatchSize: 100,
  embeddingModel: 'embedding-3',

  // MinIO
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: 'knowledge-docs',
    useSSL: false,
  },

  // ChromaDB
  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000'),
    collectionName: 'knowledge_base',
  },
} as const;

// 文档处理状态
export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type DocumentStatusType = typeof DocumentStatus[keyof typeof DocumentStatus];
