// Express 应用入口
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { newsRouter } from './routes/news.routes';
import { categoriesRouter } from './routes/categories.routes';
import { sourcesRouter } from './routes/sources.routes';
import { searchRouter } from './routes/search.routes';
import { aiRouter } from './routes/ai.routes';
import { userRouter } from './routes/user.routes';

const app = express();

// ─── 全局中间件 ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // 允许 target="_blank" 跳转到外部站点
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  // 开发环境放宽 CSP，允许内联脚本和外部资源
  contentSecurityPolicy: config.isDev ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      connectSrc: ["'self'", 'https:', 'http:'],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  } : undefined,
}));
app.use(compression());
app.use(cors({
  origin: config.isDev ? '*' : config.nextauthUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg: string) => logger.info(msg.trim()) },
  }));
}

// 全局限流
app.use('/api', apiLimiter);

// ─── 静态文件服务（前端页面） ───
const frontendPath = path.resolve(__dirname, '../../../news-site');
app.use(express.static(frontendPath));

// ─── 健康检查 ───
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// ─── API 路由 ───
app.use('/api/news', newsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/user', userRouter);

// ─── SSE 端点 ───
// SSE 在 index.ts 中独立挂载，避免与中间件冲突

// ─── 错误处理 ───
app.use(notFoundHandler);
app.use(errorHandler);

export { app };