// 文章正文提取服务 — 从原文 URL 抓取并提取正文
// 用于"点击标题直接看内容"功能

import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger';

// 提取结果的接口
export interface ExtractedContent {
  title: string;
  content: string;
  author?: string;
  publishDate?: string;
  images: string[];
}

// 通用正文提取规则
// 按优先级尝试常见的正文容器选择器
const CONTENT_SELECTORS = [
  'article',
  '[class*="article-content"]',
  '[class*="article_content"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  '[class*="main-content"]',
  '[class*="content-main"]',
  '#article',
  '#content',
  '.content',
  '.article-body',
  '.article',
];

// 要移除的噪声元素
const NOISE_SELECTORS = [
  'script', 'style', 'nav', 'header', 'footer', 'aside',
  '.ad', '.advertisement', '.share', '.comment', '.related',
  '.sidebar', '.breadcrumb', '.pagination', '.social',
];

/**
 * 从 HTML 中提取正文
 */
export function extractContent(html: string, baseUrl?: string): ExtractedContent {
  const $ = cheerio.load(html);

  // 移除噪声元素
  $(NOISE_SELECTORS.join(', ')).remove();

  // 提取标题
  const title =
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';

  // 提取作者
  const author =
    $('meta[name="author"]').attr('content') ||
    $('meta[property="article:author"]').attr('content') ||
    $('[class*="author"]').first().text().trim() ||
    undefined;

  // 提取发布时间
  const publishDate =
    $('meta[property="article:published_time"]').attr('content') ||
    $('time').attr('datetime') ||
    $('[class*="date"]').first().text().trim() ||
    undefined;

  // 提取正文 — 按优先级尝试
  let $content: ReturnType<typeof $> | null = null;
  for (const selector of CONTENT_SELECTORS) {
    const $el = $(selector).first();
    if ($el.length > 0 && $el.text().trim().length > 100) {
      $content = $el;
      break;
    }
  }

  // 兜底：取所有 p 标签
  if (!$content) {
    const $ps = $('p');
    if ($ps.length > 0) {
      $content = $ps;
    }
  }

  // 提取正文文本
  let contentText = '';
  if ($content) {
    // 取段落文本
    const paragraphs: string[] = [];
    $content.find('p').each((_: number, p: any) => {
      const text = $(p).text().trim();
      if (text.length > 20) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length > 0) {
      contentText = paragraphs.join('\n\n');
    } else {
      // 没有段落就取整体文本
      contentText = $content.text().trim().replace(/\n{3,}/g, '\n\n');
    }
  }

  // 提取图片
  const images: string[] = [];
  if ($content) {
    $content.find('img').each((_: number, img: any) => {
      const src = $(img).attr('src') || $(img).attr('data-src');
      if (src) {
        // 补全相对 URL
        let fullUrl = src;
        if (baseUrl && src.startsWith('/')) {
          fullUrl = new URL(src, baseUrl).href;
        }
        images.push(fullUrl);
      }
    });
  }

  return {
    title,
    content: contentText || '（无法提取正文内容，请查看原文）',
    author,
    publishDate,
    images: images.slice(0, 5),
  };
}

/**
 * 抓取指定 URL 并提取正文
 * @param url 原文 URL
 * @param timeoutMs 超时毫秒
 */
export async function fetchAndExtract(
  url: string,
  timeoutMs: number = 8000
): Promise<ExtractedContent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    return extractContent(html, url);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.warn({ url, timeoutMs }, '正文提取超时');
      throw new Error('抓取超时');
    }
    logger.warn({ url, err: err.message }, '正文提取失败');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
