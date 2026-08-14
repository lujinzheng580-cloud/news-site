// AI 服务路由
import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { aiLimiter } from '../middleware/rateLimit.middleware';

export const aiRouter = Router();
const controller = new AIController();

// 所有 AI 接口应用独立限流
aiRouter.use(aiLimiter);

// POST /api/ai/summarize — AI 生成文章摘要
aiRouter.post('/summarize', controller.summarize);

// POST /api/ai/classify — 文章分类
aiRouter.post('/classify', controller.classify);

// POST /api/ai/sentiment — 情感分析
aiRouter.post('/sentiment', controller.sentiment);

// GET /api/ai/trending — AI 分析热点趋势
aiRouter.get('/trending', controller.trending);