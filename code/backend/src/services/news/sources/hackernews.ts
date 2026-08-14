// HackerNews 数据源 — 移植自 NewsNow
// 抓取 https://news.ycombinator.com/

import * as cheerio from 'cheerio';
import { myFetch, parseRelativeDate, type NewsItem } from './utils';

const BASE_URL = 'https://news.ycombinator.com';

/**
 * 抓取 HackerNews 首页
 */
export async function fetchHackernews(): Promise<NewsItem[]> {
  const html: string = await myFetch(BASE_URL);
  const $ = cheerio.load(html);

  const news: NewsItem[] = [];
  const $items = $('.athing');

  $items.each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    if (!id) return;

    const $a = $el.find('.titleline a').first();
    let url = $a.attr('href');
    const title = $a.text();

    if (!url || !title) return;

    // 内部链接补全
    if (url.startsWith('item?')) {
      url = `${BASE_URL}/${url}`;
    }

    // score 在下一行
    const score = $(`#score_${id}`).text();

    // 时间在下一行
    const ageText = $(`#score_${id}`).parent().find('.age a').text();

    const parsedDate = ageText
      ? parseRelativeDate(ageText, 'America/Los_Angeles')
      : new Date();
    const pubDate = parsedDate instanceof Date ? parsedDate.getTime() : Date.now();

    news.push({
      id,
      title,
      url,
      pubDate,
      extra: { info: score },
    });
  });

  return news;
}
