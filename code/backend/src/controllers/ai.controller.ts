// AI 控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler.middleware';
import { callAIService } from '../services/ai/classifier.service';
import { logger } from '../utils/logger';

export class AIController {
  // POST /api/ai/summarize — AI 生成文章摘要
  async summarize(req: Request, res: Response, next: NextFunction) {
    try {
      const { text, maxLength } = req.body;
      if (!text) throw new AppError(400, '缺少待摘要文本');

      const result = await callAIService('/summarize', { text, maxLength: maxLength || 200 });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/ai/classify — 文章分类
  async classify(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, content } = req.body;
      if (!title) throw new AppError(400, '缺少文章标题');

      const result = await callAIService('/classify', { title, content: content || '' });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/ai/sentiment — 情感分析
  async sentiment(req: Request, res: Response, next: NextFunction) {
    try {
      const { text } = req.body;
      if (!text) throw new AppError(400, '缺少待分析文本');

      const result = await callAIService('/sentiment', { text });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/ai/trending — AI 分析热点趋势
  async trending(_req: Request, res: Response, next: NextFunction) {
    try {
      // 统计最近 24 小时内各分类文章数及阅读量趋势
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [categoryStats, topViewed] = await Promise.all([
        prisma.article.groupBy({
          by: ['category'],
          where: { publishedAt: { gte: oneDayAgo } },
          _count: { id: true },
          _sum: { viewCount: true },
          orderBy: { _count: { id: 'desc' } },
        }),
        prisma.article.findMany({
          where: { publishedAt: { gte: oneDayAgo } },
          orderBy: { viewCount: 'desc' },
          take: 10,
          select: {
            id: true, title: true, category: true, viewCount: true,
            publishedAt: true, tags: true,
          },
        }),
      ]);

      const trending = {
        categories: categoryStats.map((c) => ({
          category: c.category,
          count: c._count.id,
          totalViews: c._sum.viewCount || 0,
        })),
        topArticles: topViewed,
        generatedAt: new Date().toISOString(),
      };

      res.json({ success: true, data: trending });
    } catch (err) {
      next(err);
    }
  }
}