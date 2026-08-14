// 速率限制中间件
import rateLimit from 'express-rate-limit';

// 通用 API 限流: 每分钟 100 次
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
  },
});

// 搜索接口限流: 每分钟 30 次
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: '搜索请求过于频繁，请稍后再试',
  },
});

// AI 接口限流: 每分钟 20 次
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI 服务请求过于频繁，请稍后再试',
  },
});