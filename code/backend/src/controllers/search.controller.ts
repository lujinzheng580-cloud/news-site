// 搜索控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

export class SearchController {
  // GET /api/search — 全文搜索
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, page = 1, limit = 20, from, to, category } = req.query as any;

      const where: any = {
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      };

      if (category) where.category = category;
      if (from || to) {
        where.publishedAt = {};
        if (from) where.publishedAt.gte = new Date(from as string);
        if (to) where.publishedAt.lte = new Date(to as string);
      }

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, title: true, url: true, source: true, category: true,
            summary: true, imageUrl: true, publishedAt: true, tags: true,
          },
        }),
        prisma.article.count({ where }),
      ]);

      res.json({
        success: true,
        data: articles,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}