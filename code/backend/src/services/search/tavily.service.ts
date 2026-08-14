// Tavily 搜索服务 — 调用 Tavily API 进行网页搜索
// 文档: https://docs.tavily.com/docs/rest-api/api-reference

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { autoClassify } from '../../utils/helpers';

// ─── Tavily 请求参数 ───
export interface TavilySearchOptions {
  query: string;
  searchDepth?: 'basic' | 'advanced'; // basic=快速, advanced=深度
  maxResults?: number; // 1~20
  includeAnswer?: boolean; // 是否返回 AI 摘要
  includeRawContent?: boolean; // 是否返回原始 HTML
  topic?: 'general' | 'news'; // 搜索类型
  days?: number; // 仅 topic=news 时有效，返回 N 天内的结果
}

// ─── Tavily 单条结果 ───
export interface TavilyResult {
  title: string;
  url: string;
  content: string; // 摘要文本
  rawContent?: string;
  score: number; // 相关度 0~1
}

// ─── Tavily 完整响应 ───
export interface TavilyResponse {
  answer: string | null;
  query: string;
  responseTime: number;
  results: TavilyResult[];
}

/**
 * 调用 Tavily Search API
 */
export async function tavilySearch(
  options: TavilySearchOptions
): Promise<TavilyResponse> {
  const {
    query,
    searchDepth = 'basic',
    maxResults = 10,
    includeAnswer = true,
    includeRawContent = false,
    topic = 'general',
    days,
  } = options;

  if (!config.tavilyApiKey) {
    throw new Error('TAVILY_API_KEY 未配置');
  }

  const body: Record<string, unknown> = {
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: includeAnswer,
    include_raw_content: includeRawContent,
    topic,
  };

  // news 模式下可按天数过滤
  if (topic === 'news' && days) {
    body.days = days;
  }

  const startTime = Date.now();

  try {
    const resp = await fetch(config.tavilyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.tavilyApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.error(
        { status: resp.status, body: errText },
        'Tavily API 请求失败'
      );
      throw new Error(`Tavily API 错误 (${resp.status}): ${errText}`);
    }

    const data = (await resp.json()) as TavilyResponse;
    const elapsed = Date.now() - startTime;

    logger.info(
      { query, results: data.results?.length || 0, elapsed: `${elapsed}ms` },
      'Tavily 搜索完成'
    );

    return data;
  } catch (err: any) {
    logger.error({ query, err: err.message }, 'Tavily 搜索异常');
    throw err;
  }
}

/**
 * 搜索并将结果转换为标准文章格式（不入库，仅返回）
 */
export async function tavilySearchArticles(
  query: string,
  opts?: Partial<TavilySearchOptions>
) {
  const topic = opts?.topic || 'news';
  const tavilyResp = await tavilySearch({
    query,
    topic,
    searchDepth: opts?.searchDepth || 'basic',
    maxResults: opts?.maxResults || 10,
    includeAnswer: true,
    ...opts,
  });

  // 将 Tavily 结果映射为统一的文章格式
  const articles = (tavilyResp.results || []).map((r) => ({
    title: r.title,
    url: r.url,
    source: 'tavily',
    summary: r.content,
    content: r.rawContent,
    imageUrl: '',
    publishedAt: new Date(),
    category: autoClassify(r.title, r.content),
    tags: ['tavily', topic] as string[],
    score: r.score,
  }));

  return {
    answer: tavilyResp.answer,
    query: tavilyResp.query,
    responseTime: tavilyResp.responseTime,
    articles,
  };
}
