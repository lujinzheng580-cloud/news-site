// 华尔街见闻数据源 — 移植自 NewsNow
// 抓取 https://api.wallstreetcn.com/v2/discovery/foundation/rank

import { myFetch, type NewsItem } from './utils';

interface WallstreetcnItem {
  id: number;
  title: string;
  uri: string;
  display_time: number;
  summary?: string;
  image?: string;
}

interface WallstreetcnResponse {
  code: number;
  data: { items: WallstreetcnItem[] };
}

const BASE_URL = 'https://wallstreetcn.com';

/**
 * 抓取华尔街见闻新闻
 */
export async function fetchWallstreetcn(): Promise<NewsItem[]> {
  const url = 'https://api.wallstreetcn.com/v2/discovery/foundation/rank?limit=20';
  const text: string = await myFetch(url);

  let resp: WallstreetcnResponse;
  try {
    resp = JSON.parse(text);
  } catch {
    return [];
  }

  if (resp.code !== 20000) {
    return [];
  }

  const items = resp.data?.items ?? [];
  const news: NewsItem[] = items.map((item) => ({
    id: String(item.id),
    title: item.title,
    url: `${BASE_URL}${item.uri}`,
    pubDate: item.display_time * 1000,
    description: item.summary,
    image: item.image,
  }));

  // 按时间倒序
  return news.sort((a, b) => (b.pubDate! > a.pubDate! ? 1 : -1));
}
