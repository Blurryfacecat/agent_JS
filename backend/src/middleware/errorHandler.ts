import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { errorResponse } from '@/utils/response';

export interface AppError extends Error {
  statusCode?: number;
  code?: number;
}

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('服务器错误:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  errorResponse(res, message, statusCode, err.code);
};

/**
 * 404处理中间件
 */
export const notFoundHandler = (
  req: Request,
  res: Response
): void => {
  errorResponse(res, `接口不存在: ${req.url}`, 404, 404);
};
