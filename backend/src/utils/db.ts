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
