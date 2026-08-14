// 任务队列服务 (BullMQ)
// 参考规划书 §5 数据采集流水线
// 生产环境使用 BullMQ + Redis，开发环境用内存队列

import { logger } from '../utils/logger';

// 任务类型
type TaskHandler = (payload: any) => Promise<void>;

interface Task {
  id: string;
  name: string;
  payload: any;
  scheduledAt: Date;
}

class MemoryQueue {
  private handlers: Map<string, TaskHandler> = new Map();
  private pendingTasks: Task[] = [];
  private processing = false;

  /**
   * 注册任务处理器
   */
  register(name: string, handler: TaskHandler): void {
    this.handlers.set(name, handler);
    logger.debug({ taskName: name }, '任务处理器已注册');
  }

  /**
   * 添加任务到队列
   */
  async add(name: string, payload: any): Promise<void> {
    const task: Task = {
      id: `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      payload,
      scheduledAt: new Date(),
    };

    this.pendingTasks.push(task);
    logger.debug({ taskName: name, taskId: task.id }, '任务已加入队列');

    // 如果不在处理中，立即启动处理
    if (!this.processing) {
      this.processNext();
    }
  }

  /**
   * 处理下一个任务
   */
  private async processNext(): Promise<void> {
    if (this.pendingTasks.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const task = this.pendingTasks.shift()!;
    const handler = this.handlers.get(task.name);

    if (!handler) {
      logger.warn({ taskName: task.name }, '未找到任务处理器');
      this.processNext();
      return;
    }

    try {
      await handler(task.payload);
      logger.debug({ taskName: task.name, taskId: task.id }, '任务执行成功');
    } catch (err) {
      logger.error({ taskName: task.name, taskId: task.id, err }, '任务执行失败');
    }

    // 处理下一个
    setImmediate(() => this.processNext());
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      pending: this.pendingTasks.length,
      registeredHandlers: this.handlers.size,
      processing: this.processing,
    };
  }
}

export const taskQueue = new MemoryQueue();

// ─── 注册默认任务处理器 ───

// 新闻采集任务
taskQueue.register('fetch:news', async (payload) => {
  const { runFetchTask } = await import('../services/news/fetcher.service');
  await runFetchTask(payload.source);
});

// AI 摘要生成任务
taskQueue.register('ai:summarize', async (payload) => {
  const { callAIService } = await import('../services/ai/classifier.service');
  await callAIService('/summarize', {
    text: payload.text,
    maxLength: payload.maxLength || 200,
  });
});