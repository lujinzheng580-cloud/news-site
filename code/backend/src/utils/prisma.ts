// Prisma 客户端单例
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from './logger';

// 全局单例，防止开发环境热重载创建多个实例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: config.isDev
    ? [{ level: 'query', emit: 'event' }, { level: 'info', emit: 'stdout' }, { level: 'warn', emit: 'stdout' }]
    : [{ level: 'warn', emit: 'stdout' }, { level: 'error', emit: 'stdout' }],
});

if (config.isDev) {
  globalForPrisma.prisma = prisma;
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'Prisma Query');
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL 数据库连接成功');
  } catch (error) {
    logger.error(error, 'PostgreSQL 数据库连接失败');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL 数据库连接已关闭');
}