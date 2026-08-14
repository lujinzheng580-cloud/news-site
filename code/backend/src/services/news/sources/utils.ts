// NewsNow 数据源工具函数
// 移植自 https://github.com/ourongxing/newsnow

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import durationPlugin from 'dayjs/plugin/duration';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import weekday from 'dayjs/plugin/weekday';
import { logger } from '../../../utils/logger';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(durationPlugin);
dayjs.extend(isSameOrBefore);
dayjs.extend(weekday);

// ─── 统一 NewsItem 类型 ───
export interface NewsItem {
  id: string;
  title: string;
  url: string;
  pubDate?: number;
  image?: string;
  description?: string;
  extra?: Record<string, unknown>;
}

// ─── HTTP 请求工具 ───
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export interface MyFetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retry?: number;
}

/**
 * HTTP 请求工具，返回文本
 * 移植自 NewsNow server/utils/fetch.ts，用 Node 内置 fetch 替代 ofetch
 */
export async function myFetch(
  url: string,
  options: MyFetchOptions = {}
): Promise<string> {
  const {
    headers = {},
    timeout = 8000,
    retry = 1,
  } = options;

  let lastErr: unknown;
  for (let attempt = 0; attempt < retry; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': DEFAULT_UA, ...headers },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }
      return await resp.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retry - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`myFetch failed: ${url}`);
}

// ─── 日期解析工具 ───
// 移植自 NewsNow server/utils/date.ts

const patterns = [
  { unit: 'years', regExp: /(\d+)(?:年|y(?:ea)?rs?)/ },
  { unit: 'months', regExp: /(\d+)(?:[个個]?月|months?)/ },
  { unit: 'weeks', regExp: /(\d+)(?:周|[个個]?星期|weeks?)/ },
  { unit: 'days', regExp: /(\d+)(?:天|日|d(?:ay)?s?)/ },
  { unit: 'hours', regExp: /(\d+)(?:[个個]?(?:小?时|[時点點])|h(?:(?:ou)?r)?s?)/ },
  { unit: 'minutes', regExp: /(\d+)(?:分[鐘钟]?|m(?:in(?:ute)?)?s?)/ },
  { unit: 'seconds', regExp: /(\d+)(?:秒[鐘钟]?|s(?:ec(?:ond)?)?s?)/ },
];
const patternSize = patterns.length;

function toDate(date: string): string {
  return date
    .toLowerCase()
    .replace(/(^an?\s)|(\san?\s)/g, '1')
    .replace(/几|幾/g, '3')
    .replace(/[\s,]/g, '');
}

function toDurations(matches: string[]): Record<string, string> {
  const durations: Record<string, string> = {};
  let p = 0;
  for (const m of matches) {
    for (; p <= patternSize; p++) {
      const match = patterns[p].regExp.exec(m);
      if (match) {
        durations[patterns[p].unit] = match[1];
        break;
      }
    }
  }
  return durations;
}

/**
 * 解析相对日期字符串为 Date
 * 支持 "刚刚"、"3小时前"、"5分钟前"、"2天前"、"10 minutes ago" 等
 * 不匹配的字符串原样返回
 */
export function parseRelativeDate(
  date: string,
  timezone: string = 'UTC'
): Date | string {
  if (date === '刚刚') return new Date();

  const theDate = toDate(date);
  const matches = theDate.match(/\D*\d+(?![:\-/]|(a|p)m)\D+/g);
  const offset = dayjs.duration({
    hours:
      (dayjs().tz(timezone).utcOffset() - dayjs().utcOffset()) / 60,
  });

  if (matches) {
    const lastMatch = matches.pop();

    if (lastMatch) {
      // "X 前" / "X ago"
      const beforeMatches = /(.*)(?:前|ago)$/.exec(lastMatch);
      if (beforeMatches) {
        matches.push(beforeMatches[1]);
        return dayjs()
          .subtract(dayjs.duration(toDurations(matches)))
          .toDate();
      }

      // "X 后" / "X from now"
      const afterMatches = /(?:^in(.*)|(.*)[后後])$/.exec(lastMatch);
      if (afterMatches) {
        matches.push(afterMatches[1] ?? afterMatches[2]);
        return dayjs()
          .add(dayjs.duration(toDurations(matches)))
          .toDate();
      }
      matches.push(lastMatch);
    }

    const firstMatch = matches.shift();
    if (firstMatch) {
      // 特殊词：今天/昨天/前天/周X
      const wordMap: Array<{ regExp: RegExp; offset: number }> = [
        { regExp: /^(?:今[天日]|to?day?)(.*)/, offset: 0 },
        { regExp: /^(?:昨[天日]|y(?:ester)?day?)(.*)/, offset: -1 },
        { regExp: /^(?:前天|(?:the)?d(?:ay)?b(?:eforeyesterda)?y)(.*)/, offset: -2 },
      ];
      for (const w of wordMap) {
        const m = w.regExp.exec(firstMatch);
        if (m) {
          matches.unshift(m[1]);
          return dayjs()
            .add(w.offset, 'day')
            .set('hour', 0)
            .set('minute', 0)
            .set('second', 0)
            .set('millisecond', 0)
            .add(dayjs.duration(toDurations(matches)))
            .add(offset)
            .toDate();
        }
      }
    }
  }

  // 无匹配，返回原字符串
  return date;
}

// ─── defineSource 适配器 ───
// NewsNow 通过 Nitro unimport 自动注入 defineSource 全局宏
// 这里改为普通函数，直接返回传入的 getter
export type SourceGetter = () => Promise<NewsItem[]>;

export function defineSource(getter: SourceGetter): SourceGetter {
  return getter;
}

// ─── 辅助：根据标题自动分类 ───
export function classifyByTitle(title: string): 'business' | 'ai' | 'technology' | 'general' {
  const aiKeywords = ['AI', '人工智能', 'GPT', '大模型', 'OpenAI', 'Claude', 'Anthropic', 'LLM', '深度学习', '机器学习'];
  const bizKeywords = ['股市', '基金', '财经', '经济', '美联储', '降息', '加息', '财报', '股价', '港股', 'A股', '美股', '上市', '收购', '融资'];
  const techKeywords = ['苹果', 'iPhone', '华为', '小米', '芯片', '半导体', '处理器', '5G', '6G', '量子'];

  for (const k of aiKeywords) {
    if (title.includes(k)) return 'ai';
  }
  for (const k of bizKeywords) {
    if (title.includes(k)) return 'business';
  }
  for (const k of techKeywords) {
    if (title.includes(k)) return 'technology';
  }
  return 'general';
}
