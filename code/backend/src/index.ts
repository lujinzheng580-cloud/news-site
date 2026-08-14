// GlobalInsight 后端服务入口
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { app } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './utils/prisma';
import { setupSSERoutes } from './services/realtime/sse.service';
import { setupWebSocketServer } from './services/realtime/websocket.service';
import { startScheduler } from './services/news/scheduler.service';

async function main() {
  // 连接数据库
  await connectDatabase();

  // 创建 HTTP 服务器
  const server = createServer(app);

  // 挂载 SSE 端点
  setupSSERoutes(app);

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server, path: '/ws' });
  setupWebSocketServer(wss);

  // 启动采集调度器
  startScheduler();

  // 启动服务器
  server.listen(config.port, () => {
    logger.info(`GlobalInsight 后端服务启动成功`);
    logger.info(`  → HTTP:      http://localhost:${config.port}`);
    logger.info(`  → Health:    http://localhost:${config.port}/health`);
    logger.info(`  → SSE:       http://localhost:${config.port}/api/news/stream`);
    logger.info(`  → WebSocket: ws://localhost:${config.port}/ws`);
    logger.info(`  → 环境:       ${config.nodeEnv}`);
    logger.info(`  → 采集间隔:   ${config.fetchIntervalMinutes} 分钟`);
  });

  // 优雅关闭
  const shutdown = async (signal: string) => {
    logger.info(`收到 ${signal} 信号，正在关闭服务...`);
    wss.close();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, '服务启动失败');
  process.exit(1);
});