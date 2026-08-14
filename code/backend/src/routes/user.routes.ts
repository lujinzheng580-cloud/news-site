// 用户路由
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';

export const userRouter = Router();
const controller = new UserController();

// GET /api/user/preferences — 获取用户偏好
userRouter.get('/preferences', controller.getPreferences);

// PUT /api/user/preferences — 更新用户偏好
userRouter.put('/preferences', controller.updatePreferences);

// GET /api/user/bookmarks — 获取收藏列表
userRouter.get('/bookmarks', controller.getBookmarks);

// POST /api/user/subscriptions — 添加订阅关键词
userRouter.post('/subscriptions', controller.addSubscription);

// DELETE /api/user/subscriptions/:id — 取消订阅
userRouter.delete('/subscriptions/:id', controller.removeSubscription);

// GET /api/user/subscriptions — 获取订阅列表
userRouter.get('/subscriptions', controller.getSubscriptions);