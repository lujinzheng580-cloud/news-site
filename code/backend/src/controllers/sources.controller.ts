// 数据源控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler.middleware';
import { runFetchTask } from '../services/news/fetcher.service';
import { logger } from '../utils/logger';

export class SourcesController {
  // GET /api/sources — 获取数据源列表及状态
  async getSources(_req: Request, res: Response, next: NextFunction) {
    try {
      const sources = await prisma.source.findMany({
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: sources });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/sources/:id/fetch — 手动触发采集
  async triggerFetch(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const source = await prisma.source.findUnique({ where: { id } });

      if (!source) {
        throw new AppError(404, '数据源不存在');
      }

      // 异步触发采集，不阻塞响应
      runFetchTask(source.name as any).catch((err) => {
        logger.error({ source: source.name, err }, '手动触发采集失败');
      });

      res.json({
        success: true,
        message: `数据源 "${source.name}" 采集任务已触发`,
      });
    } catch (err) {
      next(err);
    }
  }
}