// wallstreetcn 数据源单元测试（TDD：先写测试）
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MOCK_JSON, mockMyFetch } = vi.hoisted(() => {
  // 华尔街见闻 API 返回 JSON
  const MOCK_JSON = JSON.stringify({
    code: 20000,
    data: {
      items: [
        {
          id: 1,
          title: '美联储9月降息25基点',
          uri: '/article/123456',
          display_time: 1700000000,
          summary: '美联储宣布降息决定',
          image: 'https://example.com/1.jpg',
        },
        {
          id: 2,
          title: '英伟达Q3财报超预期',
          uri: '/article/123457',
          display_time: 1700000100,
          summary: '英伟达营收创新高',
          image: 'https://example.com/2.jpg',
        },
      ],
    },
  });
  return { MOCK_JSON, mockMyFetch: vi.fn().mockResolvedValue(MOCK_JSON) };
});

vi.mock('../../src/services/news/sources/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return { ...actual, myFetch: mockMyFetch };
});

import { fetchWallstreetcn } from '../../src/services/news/sources/wallstreetcn';

describe('fetchWallstreetcn', () => {
  beforeEach(() => {
    mockMyFetch.mockClear();
    mockMyFetch.mockReturnValue(Promise.resolve(MOCK_JSON));
  });

  it('应返回新闻数组', async () => {
    const result = await fetchWallstreetcn();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('每条数据应有 id/title/url', async () => {
    const result = await fetchWallstreetcn();
    for (const item of result) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  it('应将 uri 转为完整 URL', async () => {
    const result = await fetchWallstreetcn();
    // 倒序后第1条是 id=2（display_time 更大）
    expect(result[0].url).toBe('https://wallstreetcn.com/article/123457');
  });

  it('应将 display_time 秒戳转为毫秒 pubDate', async () => {
    const result = await fetchWallstreetcn();
    expect(result[0].pubDate).toBe(1700000100000);
  });

  it('应提取 summary 和 image', async () => {
    const result = await fetchWallstreetcn();
    expect(result[0].description).toBe('英伟达营收创新高');
    expect(result[0].image).toBe('https://example.com/2.jpg');
  });

  it('应按时间倒序排列', async () => {
    const result = await fetchWallstreetcn();
    expect(result[0].pubDate).toBeGreaterThanOrEqual(result[1].pubDate!);
  });

  it('code 非 20000 应返回空数组', async () => {
    mockMyFetch.mockReturnValue(Promise.resolve(JSON.stringify({ code: 404 })));
    const result = await fetchWallstreetcn();
    expect(result).toEqual([]);
  });
});
