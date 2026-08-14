// 数据采集服务 — 对接外部数据源
// 参考规划书 §3.1 外部数据源 API

import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { autoClassify } from '../../utils/helpers';
import { broadcast } from '../realtime/sse.service';
import { RawArticle, NewsSource, FetchTaskResult } from '../../types';
import { fetchIthome } from './sources/ithome';
import { fetchBaidu } from './sources/baidu';
import { fetchWallstreetcn } from './sources/wallstreetcn';
import { classifyByTitle, type NewsItem } from './sources/utils';

// ─── NewsNow 源通用转换器 ───
function convertNewsnowItems(
  items: NewsItem[],
  source: NewsSource
): RawArticle[] {
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    source,
    sourceId: item.id,
    // 兼容 baidu 源的 extra.hover 和标准 description
    summary: item.description || (item.extra?.hover as string) || '',
    imageUrl: item.image || '',
    publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    category: classifyByTitle(item.title) as RawArticle['category'],
    tags: [source],
  }));
}

// ─── NewsAPI 数据源 ───
async function fetchFromNewsAPI(): Promise<RawArticle[]> {
  if (!config.newsapiKey) {
    logger.warn('NEWSAPI_KEY 未配置，跳过 NewsAPI 采集');
    return [];
  }

  const topics = ['business', 'technology', 'ai', 'artificial intelligence'];
  const allArticles: RawArticle[] = [];

  for (const topic of topics) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&language=zh,en&sortBy=publishedAt&pageSize=20&apiKey=${config.newsapiKey}`;
      const response = await fetch(url);
      const data = await response.json() as any;

      if (data.status !== 'ok') {
        logger.warn({ topic, code: data.code }, 'NewsAPI 返回错误');
        continue;
      }

      const articles: RawArticle[] = (data.articles || []).map((a: any) => ({
        title: a.title || '(无标题)',
        url: a.url,
        source: 'newsapi',
        sourceId: a.url,
        summary: a.description || '',
        content: a.content || '',
        imageUrl: a.urlToImage || '',
        authorName: a.author || '',
        publishedAt: new Date(a.publishedAt || Date.now()),
        category: autoClassify(a.title || '', a.description || ''),
        tags: [topic],
      }));

      allArticles.push(...articles);
      logger.info({ topic, count: articles.length }, 'NewsAPI 采集完成');
    } catch (err) {
      logger.error({ topic, err }, 'NewsAPI 采集失败');
    }
  }

  return allArticles;
}

// ─── HackerNews 数据源 ───
async function fetchFromHackerNews(): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // 获取最新 30 条
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/newstories.json');
    const ids = (await idsResp.json()) as number[];
    const topIds = ids.slice(0, 30);

    // 并行获取详情
    const details = await Promise.allSettled(
      topIds.map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(
          (r) => r.json() as Promise<any>
        )
      )
    );

    for (const result of details) {
      if (result.status === 'fulfilled' && result.value && result.value.title) {
        const item = result.value;
        articles.push({
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          source: 'hackernews',
          sourceId: String(item.id),
          summary: item.text || '',
          imageUrl: '',
          authorName: item.by || '',
          publishedAt: new Date((item.time || Date.now()) * 1000),
          category: item.title ? autoClassify(item.title) : 'technology',
          tags: ['hackernews', 'tech'],
        });
      }
    }

    logger.info({ count: articles.length }, 'HackerNews 采集完成');
  } catch (err) {
    logger.error({ err }, 'HackerNews 采集失败');
  }

  return articles;
}

// ─── 主采集入口 ───
export async function runFetchTask(source: NewsSource): Promise<FetchTaskResult> {
  const startTime = Date.now();
  logger.info({ source }, `开始采集数据源: ${source}`);

  try {
    let articles: RawArticle[] = [];

    switch (source) {
      case 'newsapi':
        articles = await fetchFromNewsAPI();
        break;
      case 'hackernews':
        articles = await fetchFromHackerNews();
        break;
      // NewsNow 移植源
      case 'ithome':
        articles = convertNewsnowItems(await fetchIthome(), 'ithome');
        break;
      case 'baidu':
        articles = convertNewsnowItems(await fetchBaidu(), 'baidu');
        break;
      case 'wallstreetcn':
        articles = convertNewsnowItems(await fetchWallstreetcn(), 'wallstreetcn');
        break;
      // reddit 和 devto 可按需扩展
      default:
        logger.warn({ source }, '未知数据源');
        return {
          source,
          status: 'error',
          articleCount: 0,
          errorMsg: '未知数据源',
          duration: Date.now() - startTime,
        };
    }

    // 去重并入库
    let savedCount = 0;
    for (const article of articles) {
      try {
        await prisma.article.upsert({
          where: { url: article.url },
          update: {
            title: article.title,
            summary: article.summary,
            publishedAt: article.publishedAt,
            tags: article.tags ? JSON.stringify(article.tags) : '[]',
          },
          create: {
            title: article.title,
            url: article.url,
            source: article.source,
            sourceId: article.sourceId,
            category: article.category || 'general',
            summary: article.summary,
            content: article.content,
            imageUrl: article.imageUrl,
            authorName: article.authorName,
            publishedAt: article.publishedAt,
            tags: article.tags ? JSON.stringify(article.tags) : '[]',
          },
        });
        savedCount++;
      } catch (err: any) {
        // 唯一约束冲突（重复 URL）直接跳过
        if (err.code !== 'P2002') {
          logger.warn({ url: article.url, err }, '文章入库失败');
        }
      }
    }

    // 更新数据源状态
    await prisma.source.upsert({
      where: { name: source },
      update: { status: 'active', lastFetch: new Date(), errorMsg: null },
      create: { name: source, status: 'active', lastFetch: new Date() },
    });

    // 记录采集日志
    await prisma.fetchLog.create({
      data: {
        source,
        status: 'success',
        articleCount: savedCount,
        duration: Date.now() - startTime,
      },
    });

    // 通过 SSE 广播新文章通知
    if (savedCount > 0) {
      broadcast.broadcast({
        type: 'news:new',
        data: { source, count: savedCount, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
      });
    }

    const duration = Date.now() - startTime;
    logger.info({ source, savedCount, duration: `${duration}ms` }, '数据采集完成');

    return { source, status: 'success', articleCount: savedCount, duration };
  } catch (err: any) {
    const duration = Date.now() - startTime;

    await prisma.source.upsert({
      where: { name: source },
      update: { status: 'error', errorMsg: err.message },
      create: { name: source, status: 'error', errorMsg: err.message },
    });

    await prisma.fetchLog.create({
      data: {
        source,
        status: 'error',
        errorMsg: err.message,
        duration,
      },
    });

    logger.error({ source, err, duration: `${duration}ms` }, '数据采集失败');
    return { source, status: 'error', articleCount: 0, errorMsg: err.message, duration };
  }
}

// ─── 全量采集所有数据源 ───
export async function fetchAllSources(): Promise<FetchTaskResult[]> {
  const sources: NewsSource[] = [
    'newsapi',
    'hackernews',
    'ithome',
    'baidu',
    'wallstreetcn',
  ];
  const results = await Promise.allSettled(
    sources.map((source) => runFetchTask(source))
  );

  return results.map((r) =>
    r.status === 'fulfilled' ? r.value : {
      source: 'unknown' as NewsSource,
      status: 'error' as const,
      articleCount: 0,
      errorMsg: r.reason?.message || '未知错误',
      duration: 0,
    }
  );
}

// ─── 直接拉取单个 NewsNow 源（不入库，用于 API 即时返回）───
// 源不可达时回退到数据库中已存储的文章
export async function fetchNewsnowSourceDirectly(
  sourceId: 'ithome' | 'baidu' | 'wallstreetcn'
): Promise<NewsItem[]> {
  // 先尝试实时抓取
  try {
    switch (sourceId) {
      case 'ithome':
        return await fetchIthome();
      case 'baidu':
        return await fetchBaidu();
      case 'wallstreetcn':
        return await fetchWallstreetcn();
    }
  } catch (err) {
    logger.warn(
      { sourceId, err: (err as Error).message },
      '实时抓取失败，回退到数据库缓存'
    );
  }

  // 回退：从数据库读取该源最近的文章
  const articles = await prisma.article.findMany({
    where: { source: sourceId },
    orderBy: { publishedAt: 'desc' },
    take: 30,
  });

  if (articles.length === 0) {
    throw new Error(
      `数据源 ${sourceId} 实时抓取失败且数据库无缓存数据`
    );
  }

  // 转换为 NewsItem 格式
  return articles.map((a) => ({
    id: a.sourceId || a.id,
    title: a.title,
    url: a.url,
    pubDate: a.publishedAt.getTime(),
    image: a.imageUrl || undefined,
    description: a.summary || undefined,
  }));
}