// 分类路由
import { Router } from 'express';
import { CategoriesController } from '../controllers/categories.controller';

export const categoriesRouter = Router();
const controller = new CategoriesController();

// GET /api/categories — 获取分类列表（含各分类文章数）
categoriesRouter.get('/', controller.getCategories);