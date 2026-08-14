// 认证中间件
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.middleware';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

/**
 * 简易 API Key 认证中间件
 * 生产环境应替换为 NextAuth.js / JWT 验证
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization as string | undefined;

  if (!apiKey && !authHeader) {
    throw new AppError(401, '未提供认证凭证');
  }

  // 简化的 Bearer token 验证
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (!token) {
      throw new AppError(401, '无效的认证凭证');
    }
    // TODO: 生产环境接入 JWT 验证
    req.userId = 'anonymous';
    req.userRole = 'user';
    next();
    return;
  }

  next();
}

/**
 * 可选认证：有 token 就解析，没有也不拒绝
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization as string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token) {
      // TODO: 生产环境接入 JWT 验证
      req.userId = 'anonymous';
      req.userRole = 'user';
    }
  }
  next();
}