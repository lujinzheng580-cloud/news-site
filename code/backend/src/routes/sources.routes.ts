// 数据源路由
import { Router } from 'express';
import { SourcesController } from '../controllers/sources.controller';

export const sourcesRouter = Router();
const controller = new SourcesController();

// GET /api/sources — 获取数据源列表及状态
sourcesRouter.get('/', controller.getSources);

// POST /api/sources/:id/fetch — 手动触发指定数据源采集
sourcesRouter.post('/:id/fetch', controller.triggerFetch);