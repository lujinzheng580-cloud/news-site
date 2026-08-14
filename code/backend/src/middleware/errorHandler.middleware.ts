// 错误处理中间件
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { config } from '../config';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Zod 验证错误
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: '请求参数验证失败',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // 自定义业务错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // 未知错误
  logger.error({ err, stack: err.stack }, '未处理的服务器错误');
  res.status(500).json({
    success: false,
    error: config.isDev ? err.message : '服务器内部错误',
  });
}

// 404 处理
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: '请求的资源不存在',
  });
}