# RAG 文档处理流程设计文档

## 概述

实现完整的 RAG（检索增强生成）文档处理管道，支持文档上传、解析、分块、向量化存储。

---

## 系统架构

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   上传文档   │ -> │   文档解析   │ -> │   文档分块   │ -> │   向量化    │
│  (multer)   │    │  (pdf-parse) │    │   (langchain)│   │  (zhipu-embed)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       v                   v                   v                   v
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    MinIO    │    │    SQLite   │    │    SQLite   │    │  ChromaDB   │
│  (原始文件)  │    │  (文档元数据) │    │  (分块记录)   │    │  (向量索引)  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 数据库设计

### 1. 文档表 (documents)

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY | 文档ID |
| doc_id | VARCHAR(64) | UNIQUE NOT NULL | 文档唯一标识 |
| title | VARCHAR(255) | NOT NULL | 文档标题 |
| category | VARCHAR(100) | | 分类 |
| file_name | VARCHAR(255) | NOT NULL | 原始文件名 |
| file_type | VARCHAR(50) | NOT NULL | 文件类型 (pdf/txt/md) |
| file_size | INTEGER | | 文件大小(字节) |
| minio_path | VARCHAR(500) | | MinIO 存储路径 |
| chunk_count | INTEGER | DEFAULT 0 | 分块数量 |
| status | VARCHAR(20) | DEFAULT 'pending' | 处理状态 |
| error_message | TEXT | | 错误信息 |
| uploaded_by | VARCHAR(100) | | 上传者 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id VARCHAR(64) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER,
  minio_path VARCHAR(500),
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  uploaded_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_category ON documents(category);
```

### 2. 文档分块表 (document_chunks)

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INTEGER | PRIMARY KEY | 分块ID |
| chunk_id | VARCHAR(64) | UNIQUE NOT NULL | 分块唯一标识 |
| doc_id | VARCHAR(64) | NOT NULL | 关联文档ID |
| chunk_index | INTEGER | NOT NULL | 分块序号 |
| content | TEXT | NOT NULL | 分块内容 |
| metadata | TEXT | | 元数据(JSON) |
| chroma_id | VARCHAR(100) | | ChromaDB 向量ID |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| FOREIGN KEY | | | doc_id → documents.doc_id |

```sql
CREATE TABLE document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id VARCHAR(64) UNIQUE NOT NULL,
  doc_id VARCHAR(64) NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  chroma_id VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_doc_id ON document_chunks(doc_id);
CREATE INDEX idx_chunks_chroma_id ON document_chunks(chroma_id);
```

---

## 处理流程

### 阶段 1: 文档上传

```
POST /api/documents/upload
Content-Type: multipart/form-data

请求参数:
- file: 文档文件 (PDF/TXT/MD)
- title: 文档标题
- category: 分类 (可选)
- uploadedBy: 上传者 (可选)

响应:
{
  "success": true,
  "data": {
    "docId": "doc_xxx",
    "status": "pending",
    "message": "文档上传成功，正在处理..."
  }
}
```

### 阶段 2: 文档解析

```
支持的格式:
├── PDF      -> pdf-parse 提取文本
├── TXT      -> 直接读取
├── Markdown -> 直接读取
└── DOCX     -> mammoth 提取文本 (后续)

解析内容:
- 提取纯文本
- 提取标题/章节结构
- 提取表格 (可选)
```

### 阶段 3: 文档分块

```
分块策略:
├── 固定大小分块 (chunkSize=500, overlap=50)
├── 按段落分块
├── 按标题分块
└── 混合策略 (推荐)

分块参数:
- chunkSize: 500-1000 字符
- overlap: 50-100 字符 (重叠)
- minChunkSize: 100 字符 (最小分块)

每个分块包含:
- content: 分块内容
- metadata: {
    doc_id,
    chunk_index,
    title,
    category,
    chunk_size
  }
```

### 阶段 4: 向量化

```
使用智谱 AI Embedding API:
- 模型: embedding-3
- 维度: 1024
- 批量处理: 每次最多 100 个分块

存储到 ChromaDB:
- Collection: knowledge_base
- 每个分块作为一个 document
- metadata 包含 doc_id, chunk_id, category 等
```

### 阶段 5: 状态管理

```
文档状态流转:
pending -> processing -> completed
                |
                v
              failed

可以查询处理进度:
GET /api/documents/:docId/status
```

---

## API 接口设计

### 1. 文档管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/documents/upload` | POST | 上传文档 |
| `/documents` | GET | 获取文档列表 |
| `/documents/:docId` | GET | 获取文档详情 |
| `/documents/:docId` | DELETE | 删除文档 |
| `/documents/:docId/status` | GET | 获取处理状态 |
| `/documents/:docId/chunks` | GET | 获取文档分块 |

### 2. 向量检索

| 接口 | 方法 | 说明 |
|------|------|------|
| `/documents/search` | POST | 向量搜索文档 |
| `/documents/:docId/similar` | GET | 查找相似文档 |

---

## MinIO 配置

```javascript
// Bucket 设计
├── knowledge-docs/        # 原始文档
│   ├── {doc_id}/
│   │   └── original.{ext}
│   └── thumbnails/        # 缩略图 (可选)
└── knowledge-chunks/      # 分块文件 (可选)
    └── {doc_id}/
        └── chunk_{index}.json
```

---

## 依赖包

```json
{
  "文档解析": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"  // DOCX 支持
  },
  "文本处理": {
    "langchain/text-splitter": "@langchain/textsplitters"
  },
  "MinIO 客户端": {
    "minio": "^7.1.3"
  },
  "ChromaDB": {
    "chromadb": "^1.8.1"
  }
}
```

---

## 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 文件过大 | 拒绝上传，返回错误 |
| 不支持的格式 | 返回支持的格式列表 |
| 解析失败 | 状态设为 failed，记录错误信息 |
| 向量化失败 | 重试 3 次，仍失败则记录错误 |
| MinIO 上传失败 | 回滚数据库记录 |

---

## 配置项

```typescript
// config/rag.ts
export const ragConfig = {
  // 文档上传限制
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['pdf', 'txt', 'md', 'docx'],

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
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: 'knowledge-docs',
  },

  // ChromaDB
  chroma: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000'),
    collectionName: 'knowledge_base',
  },
};
```
