import sqlitePackage from 'better-sqlite3';
const Database = sqlitePackage.default || sqlitePackage;
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

  // 用户反馈表 (is_helpful: 1=好/有用, 0=不好/没用)
  database.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      is_helpful INTEGER NOT NULL CHECK(is_helpful = 0 OR is_helpful = 1),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON feedback(message_id);
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

  // 猜你想问表
  database.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      icon VARCHAR(50),
      category VARCHAR(50),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      click_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_suggestions_category ON suggestions(category);
    CREATE INDEX IF NOT EXISTS idx_suggestions_active ON suggestions(is_active);
    CREATE INDEX IF NOT EXISTS idx_suggestions_sort ON suggestions(sort_order);
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
  isHelpful: boolean; // true=好/有用, false=不好/没用
}

/**
 * 保存用户反馈（好/不好）
 */
export const saveFeedback = (params: SaveFeedbackParams): number => {
  const database = getSQLiteDB();

  // 先检查是否已有反馈，有则更新
  const existingStmt = database.prepare(`
    SELECT id FROM feedback WHERE message_id = ?
  `);
  const existing = existingStmt.get(params.messageId);

  if (existing) {
    // 更新现有反馈
    const updateStmt = database.prepare(`
      UPDATE feedback
      SET is_helpful = ?, created_at = CURRENT_TIMESTAMP
      WHERE message_id = ?
    `);
    updateStmt.run(params.isHelpful ? 1 : 0, params.messageId);
    return (existing as { id: number }).id;
  } else {
    // 插入新反馈
    const insertStmt = database.prepare(`
      INSERT INTO feedback (message_id, is_helpful)
      VALUES (?, ?)
    `);
    const result = insertStmt.run(params.messageId, params.isHelpful ? 1 : 0);
    return result.lastInsertRowid as number;
  }
};

/**
 * 根据消息ID获取反馈
 */
export const getFeedbackByMessageId = (messageId: number): any | null => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    SELECT id, message_id, is_helpful, created_at
    FROM feedback
    WHERE message_id = ?
    LIMIT 1
  `);

  return stmt.get(messageId) || null;
};

/**
 * 获取反馈统计
 */
export const getFeedbackStats = (): any => {
  const database = getSQLiteDB();

  const stats = database.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) as helpful_count,
      SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END) as not_helpful_count
    FROM feedback
  `).get() as {
    total: number;
    helpful_count: number;
    not_helpful_count: number;
  };

  return stats;
};

// ============ 猜你想问相关函数 ============

export interface SaveSuggestionParams {
  title: string;
  content: string;
  icon?: string;
  category?: string;
  sortOrder?: number;
}

export interface UpdateSuggestionParams {
  id: number;
  title?: string;
  content?: string;
  icon?: string;
  category?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface GetSuggestionsParams {
  category?: string;
  limit?: number;
  random?: boolean;
}

/**
 * 创建猜你想问
 */
export const createSuggestion = (params: SaveSuggestionParams): number => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    INSERT INTO suggestions (title, content, icon, category, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    params.title,
    params.content,
    params.icon || null,
    params.category || null,
    params.sortOrder || 0
  );

  return result.lastInsertRowid as number;
};

/**
 * 更新猜你想问
 */
export const updateSuggestion = (params: UpdateSuggestionParams): boolean => {
  const database = getSQLiteDB();

  const updates: string[] = [];
  const values: (string | number | boolean)[] = [];

  if (params.title !== undefined) {
    updates.push('title = ?');
    values.push(params.title);
  }
  if (params.content !== undefined) {
    updates.push('content = ?');
    values.push(params.content);
  }
  if (params.icon !== undefined) {
    updates.push('icon = ?');
    values.push(params.icon);
  }
  if (params.category !== undefined) {
    updates.push('category = ?');
    values.push(params.category);
  }
  if (params.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    values.push(params.sortOrder);
  }
  if (params.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }

  if (updates.length === 0) return false;

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(params.id);

  const stmt = database.prepare(`
    UPDATE suggestions
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  const result = stmt.run(...values);
  return result.changes > 0;
};

/**
 * 删除猜你想问
 */
export const deleteSuggestion = (id: number): boolean => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    DELETE FROM suggestions
    WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
};

/**
 * 获取猜你想问列表
 */
export const getSuggestions = (params: GetSuggestionsParams = {}): any[] => {
  const database = getSQLiteDB();

  const { category, limit = 10, random = false } = params;

  let query = `
    SELECT id, title, content, icon, category, sort_order
    FROM suggestions
    WHERE is_active = 1
  `;
  const queryParams: (string | number)[] = [];

  if (category) {
    query += ' AND category = ?';
    queryParams.push(category);
  }

  if (random) {
    query += ' ORDER BY RANDOM()';
  } else {
    query += ' ORDER BY sort_order ASC, click_count DESC';
  }

  query += ' LIMIT ?';
  queryParams.push(limit);

  const stmt = database.prepare(query);
  return stmt.all(...queryParams);
};

/**
 * 增加点击次数
 */
export const incrementSuggestionClick = (id: number): boolean => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    UPDATE suggestions
    SET click_count = click_count + 1
    WHERE id = ?
  `);

  const result = stmt.run(id);
  return result.changes > 0;
};

/**
 * 获取猜你想问详情
 */
export const getSuggestionById = (id: number): any | null => {
  const database = getSQLiteDB();

  const stmt = database.prepare(`
    SELECT id, title, content, icon, category, sort_order, is_active, click_count, created_at, updated_at
    FROM suggestions
    WHERE id = ?
  `);

  return stmt.get(id) || null;
};

/**
 * 获取所有猜你想问（包括未激活的，用于管理）
 */
export const getAllSuggestions = (params: { page?: number; limit?: number; category?: string } = {}): any => {
  const database = getSQLiteDB();

  const { page = 1, limit = 20, category } = params;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const queryParams: (string | number)[] = [];

  if (category) {
    whereClause = 'WHERE category = ?';
    queryParams.push(category);
  }

  // 查询总数
  const countStmt = database.prepare(`
    SELECT COUNT(*) as total
    FROM suggestions
    ${whereClause}
  `);
  const countResult = countStmt.get(...queryParams) as { total: number };

  // 查询列表
  const listStmt = database.prepare(`
    SELECT id, title, content, icon, category, sort_order, is_active, click_count, created_at, updated_at
    FROM suggestions
    ${whereClause}
    ORDER BY sort_order ASC, created_at DESC
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
