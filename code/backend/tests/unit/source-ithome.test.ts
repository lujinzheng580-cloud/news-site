// itheme 数据源单元测试（TDD：先写测试）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';

// vi.mock 是 hoisted 的，常量需要用 vi.hoisted 提升到顶层
const { MOCK_HTML } = vi.hoisted(() => ({
  MOCK_HTML: `
<html><body>
<div id="list">
  <div class="fl">
    <ul>
      <li>
        <a class="t" href="https://www.ithome.com/0/988/999.htm">OpenAI 发布 GPT-6 模型</a>
        <i>2小时前</i>
      </li>
      <li>
        <a class="t" href="https://www.ithome.com/0/988/998.htm">英伟达股价再创新高</a>
        <i>3小时前</i>
      </li>
      <li>
        <a class="t" href="https://www.ithome.com/0/988/997.htm">京东神券补贴优惠不容错过</a>
        <i>4小时前</i>
      </li>
      <li>
        <a class="t" href="https://lapin.ithome.com/xxx">广告推广</a>
        <i>5小时前</i>
      </li>
    </ul>
  </div>
</div>
</body></html>
`,
}));

vi.mock('../../src/services/news/sources/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    myFetch: vi.fn().mockResolvedValue(MOCK_HTML),
  };
});

import { fetchIthome } from '../../src/services/news/sources/ithome';

describe('fetchIthome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应返回新闻数组', async () => {
    const result = await fetchIthome();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('每条数据应有 id/title/url', async () => {
    const result = await fetchIthome();
    for (const item of result) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  it('应过滤广告（lapin 链接和优惠/补贴关键词）', async () => {
    const result = await fetchIthome();
    const hasAd = result.some(
      (item) =>
        item.url.includes('lapin') ||
        ['神券', '优惠', '补贴', '京东'].some((k) =>
          item.title.includes(k)
        )
    );
    expect(hasAd).toBe(false);
  });

  it('应解析相对日期为时间戳', async () => {
    const result = await fetchIthome();
    const first = result[0];
    expect(typeof first.pubDate).toBe('number');
    expect(first.pubDate!).toBeGreaterThan(Date.now() - 3 * 3600 * 1000);
  });

  it('应按发布时间倒序排列', async () => {
    const result = await fetchIthome();
    for (let i = 1; i < result.length; i++) {
      expect(result[i].pubDate!).toBeLessThanOrEqual(result[i - 1].pubDate!);
    }
  });
});

// 验证 cheerio 选择器正确性
describe('ithome HTML 解析逻辑', () => {
  it('选择器应正确提取列表项', () => {
    const $ = cheerio.load(MOCK_HTML);
    const items = $('#list > div.fl > ul > li');
    expect(items.length).toBe(4);
  });
});
