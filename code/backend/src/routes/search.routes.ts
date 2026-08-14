// 搜索路由
import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

export const searchRouter = Router();
const controller = new SearchController();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.enum(['business', 'ai', 'technology', 'science', 'general']).optional(),
});

// GET /api/search — 全文搜索
searchRouter.get('/', validate(searchQuerySchema, 'query'), controller.search);