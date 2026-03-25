import Database from 'better-sqlite3';
import Redis from 'ioredis';
import path from 'path';
import fs from 'fs';
import config from '@/config';
import logger from '@/utils/logger';

// SQLite 数据库连接
let db: Database.Database | null = null;
let isInitialized = false;

// 初始化数据库表
const initializeTables = (database: Database.Database): void => {
  if (isInitialized) return;

  // 会话表
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id VARCHAR(64) UNIQUE NOT NULL,
      user_id VARCHAR(64),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);

  // 消息表
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id VARCHAR(64) NOT NULL,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `);

  // 知识库表
  database.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      content TEXT NOT NULL,
      source VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
  `);

  // 用户反馈表
  database.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
  `);

  // 文档表 (RAG)
  database.exec(`
    CREATE TABLE IF NOT EXISTS documents (
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
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_documents_doc_id ON documents(doc_id);
  `);

  // 文档分块表 (RAG)
  database.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
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
    CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(doc_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_chroma_id ON document_chunks(chroma_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_chunk_id ON document_chunks(chunk_id);
  `);

  isInitialized = true;
  logger.info('数据库表初始化完成');
};

export const getSQLiteDB = (): Database.Database => {
  if (!db) {
    // 确保数据目录存在
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);

    // 启用 WAL 模式（更好的并发性能）
    db.pragma('journal_mode = WAL');

    // 设置超时时间
    db.pragma('busy_timeout = 5000');

    // 初始化表结构
    initializeTables(db);

    logger.info(`SQLite 数据库连接成功: ${dbPath}`);
  }

  return db;
};

// Redis 连接
let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis 连接成功');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis 连接错误:', err);
    });
  }

  return redisClient;
};

// 关闭所有连接
export const closeConnections = async (): Promise<void> => {
  if (db) {
    db.close();
    logger.info('SQLite 连接已关闭');
  }

  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis 连接已关闭');
  }
};

// ============ 消息存储相关函数 ============

export interface SaveMessageParams {
  sessionId: string;
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * 保存消息到数据库
 */
export const saveMessage = (params: SaveMessageParams): void => {
  const database = getSQLiteDB();

  // 确保会话存在
  const sessionStmt = database.prepare(`
    INSERT OR IGNORE INTO sessions (session_id, user_id)
    VALUES (?, ?)
  `);
  sessionStmt.run(params.sessionId, params.userId || null);

  // 更新会话时间
  const updateStmt = database.prepare(`
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `);
  updateStmt.run(params.sessionId);

  // 保存消息
  const msgStmt = database.prepare(`
    INSERT INTO messages (session_id, role, content)
    VALUES (?, ?, ?)
  `);
  msgStmt.run(params.sessionId, params.role, params.content);
};

/**
 * 获取会话历史消息（按消息顺序返回）
 */
export const getSessionMessages = (sessionId: string, limit = 50): any[] => {
  const database = getSQLiteDB();
  const stmt = database.prepare(`
    SELECT id, role, content, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY id ASC
    LIMIT ?
  `);
  return stmt.all(sessionId, limit);
};

// ============ 反馈存储相关函数 ============

export interface SaveFeedbackParams {
  messageId: number;
  rating: number;
  comment?: string | null;
}

export interface FeedbackListParams {
  page: number;
  limit: number;
  minRating?: number;
  maxRating?: number;
}

/**
 * 保存用户反馈
 */
export const saveFeedback = (params: SaveFeedbackParams): number => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    INSERT INTO feedback (message_id, rating, comment)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(params.messageId, params.rating, params.comment ?? null);
  return result.lastInsertRowid as number;
};

/**
 * 根据消息ID获取反馈
 */
export const getFeedbackByMessageId = (messageId: number): any | null => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    SELECT id, message_id, rating, comment, created_at
    FROM feedback
    WHERE message_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return stmt.get(messageId) || null;
};

/**
 * 获取反馈列表（支持分页和评分筛选）
 */
export const getFeedbackList = (params: FeedbackListParams): any => {
  const database = getSQLiteDB();
  const { page, limit, minRating, maxRating } = params;
  const offset = (page - 1) * limit;

  // 构建查询条件
  let whereClause = '';
  const queryParams: number[] = [];

  if (minRating !== undefined && maxRating !== undefined) {
    whereClause = 'WHERE rating BETWEEN ? AND ?';
    queryParams.push(minRating, maxRating);
  } else if (minRating !== undefined) {
    whereClause = 'WHERE rating >= ?';
    queryParams.push(minRating);
  } else if (maxRating !== undefined) {
    whereClause = 'WHERE rating <= ?';
    queryParams.push(maxRating);
  }

  // 查询总数
  const countStmt = database.prepare(`
    SELECT COUNT(*) as total
    FROM feedback
    ${whereClause}
  `);
  const countResult = countStmt.get(...queryParams) as { total: number };

  // 查询反馈列表
  const listStmt = database.prepare(`
    SELECT f.id, f.message_id, f.rating, f.comment, f.created_at,
           m.session_id, m.role, m.content as message_content
    FROM feedback f
    LEFT JOIN messages m ON f.message_id = m.id
    ${whereClause}
    ORDER BY f.created_at DESC
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
