// 任务队列服务单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import { taskQueue } from '../../src/services/queue.service';

describe('MemoryQueue', () => {
  beforeEach(() => {
    // 清理任务队列
    const status = taskQueue.getStatus();
    // 只需重置状态，不需要真正清空
  });

  it('应正确注册任务处理器', () => {
    const status = taskQueue.getStatus();
    expect(status.registeredHandlers).toBeGreaterThan(0);
  });

  it('getStatus 应返回队列状态', () => {
    const status = taskQueue.getStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('registeredHandlers');
    expect(status).toHaveProperty('processing');
  });
});