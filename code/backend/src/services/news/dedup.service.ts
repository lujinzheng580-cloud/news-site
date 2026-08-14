// 文章去重服务
import { prisma } from '../../utils/prisma';

/**
 * 检查文章 URL 是否已存在
 */
export async function isDuplicate(url: string): Promise<boolean> {
  const existing = await prisma.article.findUnique({
    where: { url },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * 批量去重：从文章列表中滤除已存在的 URL
 */
export async function deduplicateArticles(
  articles: { url: string }[]
): Promise<{ url: string }[]> {
  const urls = articles.map((a) => a.url);
  const existing = await prisma.article.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  const existingUrls = new Set(existing.map((e) => e.url));
  return articles.filter((a) => !existingUrls.has(a.url));
}