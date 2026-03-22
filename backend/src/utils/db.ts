import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import config from '@/config';
import logger from '@/utils/logger';

// MySQL 连接池
let pool: mysql.Pool | null = null;

export const getMySQLPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      connectionLimit: config.database.connectionLimit,
      waitForConnections: true,
      queueLimit: 0,
    });

    pool.getConnection()
      .then(() => {
        logger.info('MySQL 数据库连接成功');
      })
      .catch((err) => {
        logger.error('MySQL 数据库连接失败:', err);
      });
  }

  return pool;
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
  if (pool) {
    await pool.end();
    logger.info('MySQL 连接已关闭');
  }

  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis 连接已关闭');
  }
};
