// 百度热搜数据源 — 移植自 NewsNow
// 抓取 https://top.baidu.com/board?tab=realtime

import { myFetch, type NewsItem } from './utils';

interface BaiduCard {
  content: Array<{
    isTop?: boolean;
    word: string;
    rawUrl: string;
    desc?: string;
  }>;
}

interface BaiduResponse {
  data: { cards: BaiduCard[] };
}

/**
 * 抓取百度热搜实时榜
 */
export async function fetchBaidu(): Promise<NewsItem[]> {
  const html: string = await myFetch(
    'https://top.baidu.com/board?tab=realtime'
  );

  // 从 HTML 注释中提取 <!--s-data: {...}-->
  const match = html.match(/<!--s-data:(.*?)-->/s);
  if (!match || !match[1]) {
    return [];
  }

  let data: BaiduResponse;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const cards = data.data?.cards ?? [];
  const items: NewsItem[] = [];

  for (const card of cards) {
    for (const c of card.content ?? []) {
      if (c.isTop) continue;
      if (!c.word || !c.rawUrl) continue;
      items.push({
        id: c.rawUrl,
        title: c.word,
        url: c.rawUrl,
        description: c.desc || '',
        extra: c.desc ? { hover: c.desc } : undefined,
      });
    }
  }

  return items;
}
