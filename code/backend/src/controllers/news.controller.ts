// 新闻控制器
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler.middleware';
import { broadcast } from '../services/realtime/sse.service';
import { logger } from '../utils/logger';
import { tavilySearchArticles } from '../services/search/tavily.service';
import { fetchAndExtract } from '../services/news/content-extractor.service';

export class NewsController {
  // GET /api/news — 获取新闻列表
  async getNews(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, source, sort = 'latest', tag, startDate, endDate } = req.query as any;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const where: any = {};
      if (category) where.category = category;
      if (source) where.source = source;
      if (tag) where.tags = { contains: tag as string };
      if (startDate || endDate) {
        where.publishedAt = {};
        if (startDate) where.publishedAt.gte = new Date(startDate as string);
        if (endDate) where.publishedAt.lte = new Date(endDate as string);
      }

      const orderBy: any = sort === 'popular'
        ? { viewCount: 'desc' as const }
        : { publishedAt: 'desc' as const };

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, title: true, url: true, source: true, category: true,
            summary: true, imageUrl: true, authorName: true, publishedAt: true,
            sentiment: true, tags: true, viewCount: true,
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

  // GET /api/news/:id — 获取单条新闻详情
  async getNewsById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const article = await prisma.article.findUnique({ where: { id } });

      if (!article) {
        throw new AppError(404, '文章不存在');
      }

      // 增加阅读计数
      await prisma.article.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      });

      res.json({ success: true, data: article });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/news/:id/content — 抓取原文并提取正文
  async getArticleContent(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const article = await prisma.article.findUnique({ where: { id } });

      if (!article) {
        throw new AppError(404, '文章不存在');
      }

      // 如果数据库已有正文，直接返回
      if (article.content && article.content.length > 50) {
        return res.json({
          success: true,
          data: {
            title: article.title,
            content: article.content,
            url: article.url,
            cached: true,
          },
        });
      }

      // 否则服务端抓取原文并提取正文
      try {
        const extracted = await fetchAndExtract(article.url, 8000);
        res.json({
          success: true,
          data: {
            title: extracted.title || article.title,
            content: extracted.content,
            author: extracted.author,
            publishDate: extracted.publishDate,
            images: extracted.images,
            url: article.url,
            cached: false,
          },
        });
      } catch (fetchErr: any) {
        // 抓取失败时返回 summary 作为兜底
        res.json({
          success: true,
          data: {
            title: article.title,
            content: article.summary || '（无法提取正文内容，请查看原文）',
            url: article.url,
            cached: false,
            error: fetchErr.message,
          },
        });
      }
    } catch (err) {
      next(err);
    }
  }

  // GET /api/news/search — 搜索新闻
  async searchNews(req: Request, res: Response, next: NextFunction) {
    try {
      const { q } = req.query as any;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const where = {
        OR: [
          { title: { contains: q as string } },
          { summary: { contains: q as string } },
          { tags: { contains: q as string } },
        ],
      };

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
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

  // GET /api/news/tavily — Tavily 网页搜索
  async tavilySearch(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, topic = 'news', maxResults = 10, searchDepth = 'basic', days, save = false } = req.query as any;

      if (!q) {
        throw new AppError(400, '搜索关键词 q 不能为空');
      }

      // 调用 Tavily 搜索
      const result = await tavilySearchArticles(q, {
        topic,
        maxResults: Math.min(parseInt(maxResults) || 10, 20),
        searchDepth,
        ...(days ? { days: parseInt(days) } : {}),
      });

      // 可选：将搜索结果保存到数据库
      if (save === 'true' || save === '1') {
        let savedCount = 0;
        for (const a of result.articles) {
          try {
            await prisma.article.upsert({
              where: { url: a.url },
              update: { title: a.title, summary: a.summary },
              create: {
                title: a.title,
                url: a.url,
                source: 'tavily',
                category: a.category || 'general',
                summary: a.summary || '',
                content: a.content,
                publishedAt: a.publishedAt,
                tags: a.tags ? JSON.stringify(a.tags) : '[]',
              },
            });
            savedCount++;
          } catch {
            // 重复 URL 跳过
          }
        }
        logger.info({ query: q, savedCount }, 'Tavily 搜索结果已入库');
      }

      res.json({
        success: true,
        data: result.articles,
        answer: result.answer,
        meta: {
          query: result.query,
          responseTime: result.responseTime,
          count: result.articles.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/news/stream — SSE 实时推送
  async streamNews(_req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始连接确认
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // 注册客户端
    const clientId = broadcast.addClient(res);

    // 心跳保持连接
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // 客户端断开时清理
    _req.on('close', () => {
      clearInterval(heartbeat);
      broadcast.removeClient(clientId);
      logger.debug(`SSE 客户端断开: ${clientId}`);
    });
  }

  // POST /api/news/:id/bookmark — 收藏新闻
  async bookmarkNews(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.userId || 'anonymous';

      const article = await prisma.article.findUnique({ where: { id } });
      if (!article) throw new AppError(404, '文章不存在');

      const bookmark = await prisma.bookmark.upsert({
        where: { userId_articleId: { userId, articleId: id } },
        update: {},
        create: { userId, articleId: id },
      });

      res.status(201).json({ success: true, data: bookmark });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/news/:id/bookmark — 取消收藏
  async unbookmarkNews(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.userId || 'anonymous';

      await prisma.bookmark.deleteMany({
        where: { userId, articleId: id },
      });

      res.json({ success: true, message: '已取消收藏' });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/news/refresh — 手动触发采集
  async refreshNews(_req: Request, res: Response, next: NextFunction) {
    try {
      // 异步触发，不阻塞响应
      res.json({ success: true, message: '采集任务已触发' });

      // 在后台执行采集
      const { fetchAllSources } = await import('../services/news/fetcher.service');
      fetchAllSources()
        .then((results) => {
          const successCount = results.filter((r) => r.status === 'success').length;
          logger.info({ successCount, total: results.length }, '手动采集完成');
        })
        .catch((err) => {
          logger.error({ err }, '手动采集失败');
        });
    } catch (err) {
      next(err);
    }
  }
}