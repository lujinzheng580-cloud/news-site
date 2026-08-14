// baidu 数据源单元测试（TDD：先写测试）
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MOCK_HTML, mockMyFetch } = vi.hoisted(() => {
  const MOCK_HTML = `
<!DOCTYPE html><html><head><title>百度热搜</title></head><body>
<!--s-data: {"data":{"cards":[{"content":[{"isTop":true,"word":"置顶热搜","rawUrl":"https://www.baidu.com/s?wd=top"},{"word":"OpenAI 发布 GPT-6","rawUrl":"https://www.baidu.com/s?wd=gpt6","desc":"AI 领域重大突破"},{"word":"英伟达股价新高","rawUrl":"https://www.baidu.com/s?wd=nvda","desc":"市值突破 4 万亿"}]}]}}-->
<script>render()</script>
</body></html>
`;
  return { MOCK_HTML, mockMyFetch: vi.fn().mockResolvedValue(MOCK_HTML) };
});

vi.mock('../../src/services/news/sources/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    myFetch: mockMyFetch,
  };
});

import { fetchBaidu } from '../../src/services/news/sources/baidu';

describe('fetchBaidu', () => {
  beforeEach(() => {
    mockMyFetch.mockClear();
    mockMyFetch.mockReturnValue(Promise.resolve(MOCK_HTML));
  });

  it('应返回新闻数组', async () => {
    const result = await fetchBaidu();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('应过滤 isTop 置顶项', async () => {
    const result = await fetchBaidu();
    const hasTop = result.some((item) => item.title === '置顶热搜');
    expect(hasTop).toBe(false);
  });

  it('每条数据应有 id/title/url', async () => {
    const result = await fetchBaidu();
    for (const item of result) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  it('应提取 desc 到 extra.hover', async () => {
    const result = await fetchBaidu();
    const withDesc = result.find((item) => item.title === 'OpenAI 发布 GPT-6');
    expect(withDesc).toBeDefined();
    expect(withDesc!.extra?.hover).toBe('AI 领域重大突破');
  });

  it('解析失败时应返回空数组', async () => {
    mockMyFetch.mockReturnValue(Promise.resolve('<html>no data here</html>'));
    const result = await fetchBaidu();
    expect(result).toEqual([]);
  });
});
