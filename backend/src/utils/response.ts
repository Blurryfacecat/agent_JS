import { Response } from 'express';

interface ResponseData<T = any> {
  code: number;
  message: string;
  data?: T;
  sessionId?: string;
}

/**
 * 统一成功响应
 */
export const successResponse = <T = any>(
  res: Response,
  data?: T,
  message: string = 'success',
  statusCode: number = 200
): void => {
  const responseData: ResponseData<T> = {
    code: statusCode,
    message,
    data,
  };
  res.status(statusCode).json(responseData);
};

/**
 * 统一错误响应
 */
export const errorResponse = (
  res: Response,
  message: string = 'error',
  statusCode: number = 500,
  code?: number
): void => {
  const responseData: ResponseData = {
    code: code || statusCode,
    message,
  };
  res.status(statusCode).json(responseData);
};

/**
 * 带会话ID的成功响应
 */
export const sessionResponse = <T = any>(
  res: Response,
  data: T,
  sessionId: string,
  message: string = 'success'
): void => {
  const responseData: ResponseData<T> = {
    code: 200,
    message,
    data,
    sessionId,
  };
  res.status(200).json(responseData);
};
