// AI 服务客户端 — 对接 Python FastAPI 微服务
// 参考规划书 §3.2 AI 功能接口

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { autoClassify } from '../../utils/helpers';
import type { ClassifyResponse, SentimentResponse, SummarizeResponse, NewsCategory } from '../../types';

/**
 * 调用 AI 微服务
 * 如果 AI 服务不可用，降级使用本地规则
 */
export async function callAIService(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<any> {
  const url = `${config.aiServiceUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // 15 秒超时
    });

    if (!response.ok) {
      throw new Error(`AI 服务返回 ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err: any) {
    logger.warn({ endpoint, err: err.message }, 'AI 服务调用失败，降级到本地规则');
    return fallbackHandler(endpoint, payload);
  }
}

/**
 * 本地降级处理
 */
function fallbackHandler(endpoint: string, payload: Record<string, unknown>): any {
  switch (endpoint) {
    case '/classify': {
      const title = (payload.title as string) || '';
      const content = (payload.content as string) || '';
      return {
        category: autoClassify(title, content) as NewsCategory,
        tags: [],
        confidence: 0.5,
      } satisfies ClassifyResponse;
    }

    case '/sentiment': {
      // 简单的情感分析降级
      const text = (payload.text as string) || '';
      const positiveWords = ['增长', '突破', '创新', '成功', '盈利', '上涨', '利好', '突破'];
      const negativeWords = ['下跌', '亏损', '危机', '裁员', '失败', '风险', '衰退', '暴跌'];

      let score = 0;
      for (const word of positiveWords) {
        if (text.includes(word)) score += 0.1;
      }
      for (const word of negativeWords) {
        if (text.includes(word)) score -= 0.1;
      }
      score = Math.max(-1, Math.min(1, score));

      const label = score > 0.05 ? 'positive' : score < -0.05 ? 'negative' : 'neutral';

      return {
        score,
        label,
        confidence: 0.6,
      } satisfies SentimentResponse;
    }

    case '/summarize': {
      const text = (payload.text as string) || '';
      const maxLength = (payload.maxLength as number) || 200;
      return {
        summary: text.length > maxLength ? text.slice(0, maxLength) + '…' : text,
        model: 'fallback',
      } satisfies SummarizeResponse;
    }

    default:
      throw new Error(`未知的 AI 端点: ${endpoint}`);
  }
}