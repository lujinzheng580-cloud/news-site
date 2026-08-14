// hackernews 数据源单元测试（TDD：先写测试）
// 替换为 NewsNow 版本，使用 cheerio 解析 HTML
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';

const { MOCK_HTML, mockMyFetch } = vi.hoisted(() => {
  const MOCK_HTML = `
<html><body>
<table>
  <tr class="athing" id="123">
    <td><span class="rank">1.</span></td>
    <td><span class="votearrow"></span></td>
    <td class="title">
      <span class="titleline">
        <a href="https://example.com/openai-gpt6">OpenAI launches GPT-6</a>
        <span class="sitebit comhead"> (<a href="example.com">example.com</a>)</span>
      </span>
    </td>
  </tr>
  <tr>
    <td colspan="2"></td>
    <td class="subtext">
      <span class="subline">
        <span id="score_123" class="score">512 points</span>
        by <a href="user?id=sam">sam</a>
        <span class="age"><a href="item?id=123">3 hours ago</a></span>
      </span>
    </td>
  </tr>
  <tr class="athing" id="124">
    <td><span class="rank">2.</span></td>
    <td><span class="votearrow"></span></td>
    <td class="title">
      <span class="titleline">
        <a href="item?id=124">Show HN: A new programming language</a>
      </span>
    </td>
  </tr>
  <tr>
    <td colspan="2"></td>
    <td class="subtext">
      <span class="subline">
        <span id="score_124" class="score">200 points</span>
        by <a href="user?id=alice">alice</a>
        <span class="age"><a href="item?id=124">5 hours ago</a></span>
      </span>
    </td>
  </tr>
</table>
</body></html>
`;
  return { MOCK_HTML, mockMyFetch: vi.fn().mockResolvedValue(MOCK_HTML) };
});

vi.mock('../../src/services/news/sources/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return { ...actual, myFetch: mockMyFetch };
});

import { fetchHackernews } from '../../src/services/news/sources/hackernews';

describe('fetchHackernews', () => {
  beforeEach(() => {
    mockMyFetch.mockClear();
    mockMyFetch.mockReturnValue(Promise.resolve(MOCK_HTML));
  });

  it('应返回新闻数组', async () => {
    const result = await fetchHackernews();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
  });

  it('每条数据应有 id/title/url', async () => {
    const result = await fetchHackernews();
    for (const item of result) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  it('item 链接应转为完整 URL', async () => {
    const result = await fetchHackernews();
    const internal = result.find((i) => i.id === '124');
    expect(internal?.url).toBe('https://news.ycombinator.com/item?id=124');
  });

  it('外部链接应保留原 URL', async () => {
    const result = await fetchHackernews();
    const external = result.find((i) => i.id === '123');
    expect(external?.url).toBe('https://example.com/openai-gpt6');
  });

  it('应提取 score 到 extra.info', async () => {
    const result = await fetchHackernews();
    expect(result[0].extra?.info).toBe('512 points');
  });

  it('应解析相对时间到 pubDate', async () => {
    const result = await fetchHackernews();
    expect(typeof result[0].pubDate).toBe('number');
    const now = Date.now();
    const diff = now - result[0].pubDate!;
    // 3 hours ago，允许误差
    expect(diff).toBeGreaterThan(2 * 3600 * 1000);
    expect(diff).toBeLessThan(4 * 3600 * 1000);
  });
});

// 验证 cheerio 选择器
describe('hackernews HTML 解析逻辑', () => {
  it('应正确选择 athing 元素', () => {
    const $ = cheerio.load(MOCK_HTML);
    expect($('.athing').length).toBe(2);
  });
});
