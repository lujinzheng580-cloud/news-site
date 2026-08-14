// 静态采集脚本 — 在 GitHub Actions 中运行，生成 JSON 数据文件
// 不依赖 Prisma/数据库，直接调用数据源 fetch 函数 + 正文提取
//
// 用法：
//   npx tsx scripts/fetch-static.ts
//
// 输出：
//   news-site/data/news.json         — 所有新闻列表
//   news-site/data/articles/<id>.json — 每篇文章详情（含正文）

import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { fetchIthome } from '../src/services/news/sources/ithome';
import { fetchBaidu } from '../src/services/news/sources/baidu';
import { fetchWallstreetcn } from '../src/services/news/sources/wallstreetcn';
import { classifyByTitle, type NewsItem } from '../src/services/news/sources/utils';
import { fetchAndExtract } from '../src/services/news/content-extractor.service';

// ─── 配置 ───
const OUTPUT_DIR = join(__dirname, '../../../data');
const ARTICLES_DIR = join(OUTPUT_DIR, 'articles');
const MAX_ARTICLES = 60; // 总文章数上限
const MAX_CONTENT_FETCH = 20; // 抓取正文的最大数量（避免超时）
const CONTENT_TIMEOUT = 8000;

// ─── 生成稳定 ID（基于 URL 的短哈希） ───
function generateId(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 12);
}

// ─── 转换为前端用的文章格式 ───
interface Article {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceId: string;
  category: string;
  summary: string;
  content: string;
  imageUrl: string;
  authorName: string;
  publishedAt: string;
  tags: string;
  viewCount: number;
}

interface SourceItem extends NewsItem {
  source: string;
}

async function fetchAllSources(): Promise<SourceItem[]> {
  const sources: Array<{ name: string; fetcher: () => Promise<NewsItem[]> }> = [
    { name: 'baidu', fetcher: fetchBaidu },
    { name: 'ithome', fetcher: fetchIthome },
    { name: 'wallstreetcn', fetcher: fetchWallstreetcn },
  ];

  const all: SourceItem[] = [];
  for (const { name, fetcher } of sources) {
    try {
      console.log(`[fetch] ${name} 开始采集...`);
      const items = await fetcher();
      console.log(`[fetch] ${name} 成功: ${items.length} 条`);
      all.push(...items.map((i) => ({ ...i, source: name })));
    } catch (err: any) {
      console.error(`[fetch] ${name} 失败:`, err.message);
    }
  }
  return all;
}

// ─── 主流程 ───
async function main() {
  console.log('=== 静态采集任务开始 ===');
  console.log('时间:', new Date().toISOString());

  // 1. 采集所有源
  const items = await fetchAllSources();
  console.log(`\n[total] 共采集 ${items.length} 条原始数据`);

  if (items.length === 0) {
    throw new Error('未采集到任何数据');
  }

  // 2. 去重（按 URL）
  const seen = new Set<string>();
  const unique: SourceItem[] = [];
  for (const item of items) {
    if (!seen.has(item.url)) {
      seen.add(item.url);
      unique.push(item);
    }
  }
  console.log(`[dedup] 去重后剩 ${unique.length} 条`);

  // 3. 按发布时间排序（新的在前）
  unique.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));

  // 4. 限制数量
  const limited = unique.slice(0, MAX_ARTICLES);
  console.log(`[limit] 截取前 ${limited.length} 条`);

  // 5. 转换为 Article 格式
  const articles: Article[] = limited.map((item) => {
    const id = generateId(item.url);
    const category = classifyByTitle(item.title);
    return {
      id,
      title: item.title,
      url: item.url,
      source: item.source || '',
      sourceId: item.id,
      category,
      summary: item.description || (item.extra?.hover as string) || '',
      content: '', // 稍后填充
      imageUrl: item.image || '',
      authorName: '',
      publishedAt: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
      tags: JSON.stringify([item.source].filter(Boolean)),
      viewCount: 0,
    };
  });

  // 6. 为前 N 篇抓取正文
  console.log(`\n[content] 开始为前 ${Math.min(MAX_CONTENT_FETCH, articles.length)} 篇抓取正文...`);
  let contentCount = 0;
  for (let i = 0; i < Math.min(MAX_CONTENT_FETCH, articles.length); i++) {
    const a = articles[i];
    try {
      const extracted = await fetchAndExtract(a.url, CONTENT_TIMEOUT);
      a.content = extracted.content;
      if (extracted.author) a.authorName = extracted.author;
      contentCount++;
      console.log(`[content] ${i + 1}/${MAX_CONTENT_FETCH} ✓ ${a.title.slice(0, 30)}...`);
    } catch (err: any) {
      console.warn(`[content] ${i + 1}/${MAX_CONTENT_FETCH} ✗ ${a.title.slice(0, 30)}... — ${err.message}`);
      // 正文抓取失败，用 summary 作为兜底
      a.content = a.summary || '（正文抓取失败，请查看原文）';
    }
  }
  console.log(`[content] 正文抓取完成: ${contentCount}/${Math.min(MAX_CONTENT_FETCH, articles.length)} 成功`);

  // 7. 写入文件
  console.log(`\n[write] 写入 JSON 文件...`);
  await mkdir(ARTICLES_DIR, { recursive: true });

  // 7.1 写入文章列表
  const newsList = articles.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    source: a.source,
    category: a.category,
    summary: a.summary,
    imageUrl: a.imageUrl,
    publishedAt: a.publishedAt,
    tags: a.tags,
  }));
  await writeFile(
    join(OUTPUT_DIR, 'news.json'),
    JSON.stringify({ success: true, data: newsList, generatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`[write] news.json (${newsList.length} 条)`);

  // 7.2 写入每篇文章详情
  let articleCount = 0;
  for (const a of articles) {
    const filepath = join(ARTICLES_DIR, `${a.id}.json`);
    await writeFile(filepath, JSON.stringify({ success: true, data: a }, null, 2));
    articleCount++;
  }
  console.log(`[write] articles/*.json (${articleCount} 个文件)`);

  // 8. 总结
  console.log(`\n=== 采集任务完成 ===`);
  console.log(`总文章数: ${articles.length}`);
  console.log(`正文已抓取: ${contentCount}`);
  console.log(`输出目录: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('\n=== 采集任务失败 ===');
  console.error(err);
  process.exit(1);
});
