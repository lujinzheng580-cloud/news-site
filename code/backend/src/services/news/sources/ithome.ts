// IT之家数据源 — 移植自 NewsNow
// 抓取 https://www.ithome.com/list/

import * as cheerio from 'cheerio';
import { myFetch, parseRelativeDate, type NewsItem } from './utils';

/**
 * 抓取 IT之家最新文章列表
 */
export async function fetchIthome(): Promise<NewsItem[]> {
  const html: string = await myFetch('https://www.ithome.com/list/');
  const $ = cheerio.load(html);
  const $items = $('#list > div.fl > ul > li');

  const news: NewsItem[] = [];
  $items.each((_, el) => {
    const $el = $(el);
    const $a = $el.find('a.t');
    const url = $a.attr('href');
    const title = $a.text().trim();
    const dateStr = $el.find('i').text().trim();

    if (!url || !title || !dateStr) return;

    // 过滤广告
    const isAd =
      url.includes('lapin') ||
      ['神券', '优惠', '补贴', '京东'].some((k) => title.includes(k));
    if (isAd) return;

    const parsedDate = parseRelativeDate(dateStr, 'Asia/Shanghai');
    const pubDate = parsedDate instanceof Date ? parsedDate.getTime() : Date.now();

    news.push({
      id: url,
      title,
      url,
      pubDate,
    });
  });

  // 按时间倒序
  return news.sort((a, b) => (b.pubDate! > a.pubDate! ? 1 : -1));
}
