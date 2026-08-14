// SSE 实时推送服务 — 服务端推送新文章通知
// 参考规划书 §3.3 WebSocket 事件 & §5 实时更新机制

import { Response, Express } from 'express';
import { logger } from '../../utils/logger';
import { SSEEvent } from '../../types';

interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter = 0;

  /**
   * 注册 SSE 客户端连接
   */
  addClient(res: Response): string {
    const id = `sse_${++this.clientIdCounter}`;
    this.clients.set(id, { id, res, connectedAt: new Date() });
    logger.debug({ clientId: id, total: this.clients.size }, 'SSE 客户端接入');
    return id;
  }

  /**
   * 移除 SSE 客户端
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.debug({ clientId, total: this.clients.size }, 'SSE 客户端断开');
  }

  /**
   * 向所有连接的客户端广播事件
   */
  broadcast(event: SSEEvent): void {
    const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    const deadClients: string[] = [];

    this.clients.forEach((client, id) => {
      try {
        client.res.write(message);
      } catch {
        deadClients.push(id);
      }
    });

    // 清理已断开的连接
    deadClients.forEach((id) => {
      this.clients.delete(id);
      logger.debug({ clientId: id }, '清理已断开的 SSE 客户端');
    });
  }

  /**
   * 获取当前连接数
   */
  getConnectionCount(): number {
    return this.clients.size;
  }
}

// 单例
export const broadcast = new SSEManager();

/**
 * 挂载 SSE 路由
 */
export function setupSSERoutes(app: Express): void {
  // 健康检查端点，包含 SSE 连接数
  app.get('/api/sse/status', (_req, res) => {
    res.json({
      success: true,
      data: {
        connections: broadcast.getConnectionCount(),
        uptime: process.uptime(),
      },
    });
  });

  logger.info('SSE 推送服务已就绪');
}