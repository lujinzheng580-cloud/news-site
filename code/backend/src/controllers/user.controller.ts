// 用户控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler.middleware';

export class UserController {
  // GET /api/user/preferences — 获取用户偏好
  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'anonymous';
      const user = await prisma.user.findUnique({ where: { id: userId } });

      res.json({
        success: true,
        data: user?.preferences || {},
      });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/user/preferences — 更新用户偏好
  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'anonymous';
      const { preferences } = req.body;

      const user = await prisma.user.upsert({
        where: { id: userId },
        update: { preferences },
        create: { id: userId, preferences },
      });

      res.json({ success: true, data: user.preferences });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/user/bookmarks — 获取收藏列表
  async getBookmarks(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'anonymous';

      const bookmarks = await prisma.bookmark.findMany({
        where: { userId },
        include: {
          article: {
            select: {
              id: true, title: true, url: true, source: true, category: true,
              summary: true, imageUrl: true, publishedAt: true, tags: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: bookmarks.map((b) => ({
          id: b.id,
          article: b.article,
          createdAt: b.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/user/subscriptions — 添加订阅关键词
  async addSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'anonymous';
      const { keyword, category } = req.body;

      if (!keyword) throw new AppError(400, '缺少订阅关键词');

      const sub = await prisma.subscription.create({
        data: { userId, keyword, category },
      });

      res.status(201).json({ success: true, data: sub });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/user/subscriptions/:id — 取消订阅
  async removeSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.userId || 'anonymous';

      const sub = await prisma.subscription.findFirst({
        where: { id, userId },
      });

      if (!sub) throw new AppError(404, '订阅不存在');

      await prisma.subscription.delete({ where: { id } });

      res.json({ success: true, message: '已取消订阅' });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/user/subscriptions — 获取订阅列表
  async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId || 'anonymous';

      const subscriptions = await prisma.subscription.findMany({
        where: { userId, active: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: subscriptions });
    } catch (err) {
      next(err);
    }
  }
}