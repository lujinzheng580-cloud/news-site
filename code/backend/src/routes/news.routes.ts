// 新闻路由
import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';
import { fetchNewsnowSourceDirectly } from '../services/news/fetcher.service';
import { NEWSNOW_SOURCES, type NewsnowSourceId } from '../types';

export const newsRouter = Router();
const controller = new NewsController();

// 查询参数校验
const newsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  category: z.enum(['business', 'ai', 'technology', 'science', 'general']).optional(),
  source: z.enum([
    'newsapi', 'hackernews', 'reddit', 'devto', 'gdelt',
    'ithome', 'baidu', 'wallstreetcn',
  ]).optional(),
  sort: z.enum(['latest', 'popular', 'relevance']).default('latest').optional(),
  tag: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET /api/news — 获取新闻列表
newsRouter.get('/', validate(newsQuerySchema, 'query'), controller.getNews);

// GET /api/news/sources/:id — 直接拉取单个 NewsNow 源（不入库）
newsRouter.get('/sources/:id', async (req, res) => {
  const id = req.params.id as NewsnowSourceId;
  if (!NEWSNOW_SOURCES.includes(id)) {
    return res.status(400).json({
      error: 'Invalid source',
      message: `源 ${id} 不支持，可选: ${NEWSNOW_SOURCES.join(', ')}`,
    });
  }
  try {
    const items = await fetchNewsnowSourceDirectly(id);
    return res.json({
      source: id,
      count: items.length,
      items,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Fetch failed',
      message: err.message,
      source: id,
    });
  }
});

// GET /api/news/tavily — Tavily 网页搜索
newsRouter.get('/tavily', controller.tavilySearch);

// POST /api/news/refresh — 手动触发采集
newsRouter.post('/refresh', controller.refreshNews);

// GET /api/news/:id/content — 抓取原文并提取正文（放在 /:id 之前）
newsRouter.get('/:id/content', controller.getArticleContent);

// GET /api/news/search — 搜索新闻
const searchSchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
newsRouter.get('/search', validate(searchSchema, 'query'), controller.searchNews);

// GET /api/news/stream — SSE 实时推送
newsRouter.get('/stream', controller.streamNews);

// GET /api/news/:id — 获取单条新闻详情
newsRouter.get('/:id', controller.getNewsById);

// POST /api/news/:id/bookmark — 收藏新闻
newsRouter.post('/:id/bookmark', controller.bookmarkNews);

// DELETE /api/news/:id/bookmark — 取消收藏
newsRouter.delete('/:id/bookmark', controller.unbookmarkNews);