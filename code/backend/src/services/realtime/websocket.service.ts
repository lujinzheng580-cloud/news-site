// WebSocket 实时双向通信服务
// 参考规划书 §3.3 WebSocket 事件

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../../utils/logger';
import { SSEEvent } from '../../types';

interface WSClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  connectedAt: Date;
}

class WSManager {
  private clients: Map<string, WSClient> = new Map();
  private clientIdCounter = 0;

  /**
   * 处理新的 WebSocket 连接
   */
  handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const id = `ws_${++this.clientIdCounter}`;
    const client: WSClient = {
      ws,
      id,
      subscriptions: new Set(),
      connectedAt: new Date(),
    };

    this.clients.set(id, client);
    logger.debug({ clientId: id, total: this.clients.size }, 'WebSocket 客户端接入');

    // 发送欢迎消息
    ws.send(JSON.stringify({
      event: 'connected',
      payload: { clientId: id, timestamp: new Date().toISOString() },
    }));

    // 处理客户端消息
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(client, msg);
      } catch (err) {
        ws.send(JSON.stringify({
          event: 'error',
          payload: { message: '无效的消息格式' },
        }));
      }
    });

    // 处理断开连接
    ws.on('close', () => {
      this.clients.delete(id);
      logger.debug({ clientId: id, total: this.clients.size }, 'WebSocket 客户端断开');
    });

    // 处理错误
    ws.on('error', (err) => {
      logger.error({ clientId: id, err }, 'WebSocket 客户端错误');
      this.clients.delete(id);
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(client: WSClient, msg: { event?: string; payload?: Record<string, unknown> }): void {
    const { event, payload } = msg;

    switch (event) {
      case 'subscribe':
        if (payload?.keyword) {
          client.subscriptions.add(String(payload.keyword));
          client.ws.send(JSON.stringify({
            event: 'subscribed',
            payload: { keyword: payload.keyword },
          }));
        }
        break;

      case 'unsubscribe':
        if (payload?.keyword) {
          client.subscriptions.delete(String(payload.keyword));
          client.ws.send(JSON.stringify({
            event: 'unsubscribed',
            payload: { keyword: payload.keyword },
          }));
        }
        break;

      case 'ping':
        client.ws.send(JSON.stringify({ event: 'pong', payload: { timestamp: new Date().toISOString() } }));
        break;

      default:
        client.ws.send(JSON.stringify({
          event: 'error',
          payload: { message: `未知事件: ${event}` },
        }));
    }
  }

  /**
   * 广播 SSE 事件到所有 WebSocket 客户端
   */
  broadcastSSEEvent(event: SSEEvent): void {
    const message = JSON.stringify({
      event: event.type,
      payload: event.data,
      timestamp: event.timestamp,
    });

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch {
          // 忽略发送失败
        }
      }
    });
  }

  /**
   * 获取连接数
   */
  getConnectionCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WSManager();

/**
 * 设置 WebSocket 服务器
 */
export function setupWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    wsManager.handleConnection(ws, req);
  });

  logger.info('WebSocket 服务已就绪');
}