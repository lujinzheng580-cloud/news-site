// 分类控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export class CategoriesController {
  // GET /api/categories — 获取分类列表（含各分类文章数）
  async getCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await prisma.article.groupBy({
        by: ['category'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });

      const data = categories.map((c) => ({
        id: c.category,
        name: CATEGORY_LABELS[c.category] || c.category,
        count: c._count.id,
      }));

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  business: '全球商业',
  ai: 'AI 前沿',
  technology: '科技',
  science: '科学',
  general: '综合',
};