// 采集调度器 — 定时执行数据采集
// 参考规划书 §5 实时更新机制

import cron from 'node-cron';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { fetchAllSources } from './fetcher.service';

let isRunning = false;

/**
 * 执行一次采集任务
 */
async function executeFetch(): Promise<void> {
  if (isRunning) {
    logger.info('上一轮采集尚未完成，跳过本轮');
    return;
  }

  isRunning = true;
  logger.info('开始定时采集任务');

  try {
    const results = await fetchAllSources();
    const successCount = results.filter((r) => r.status === 'success').length;
    const totalArticles = results.reduce((sum, r) => sum + r.articleCount, 0);
    logger.info(
      { successCount, total: results.length, totalArticles },
      '定时采集任务完成'
    );
  } catch (err) {
    logger.error(err, '定时采集任务异常');
  } finally {
    isRunning = false;
  }
}

/**
 * 启动调度器
 */
export function startScheduler(): void {
  const intervalMinutes = config.fetchIntervalMinutes;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  logger.info({ interval: `${intervalMinutes} 分钟`, cron: cronExpression }, '启动采集调度器');

  // 启动定时任务
  cron.schedule(cronExpression, () => {
    executeFetch();
  });

  // 立即执行首次采集
  executeFetch();
}