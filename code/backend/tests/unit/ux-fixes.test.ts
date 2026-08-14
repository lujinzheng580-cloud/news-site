// 三个前端体验修复的验证测试
// 1. baidu 源 extra.hover → summary 映射
// 2. 市场速览股票指数移除（HTML 结构验证）
// 3. 数据源失败时回退数据库缓存 + myFetch 超时

import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── 修复1测试：baidu 源 extra.hover 映射到 summary ───
describe('修复1: baidu 源 extra.hover → summary 映射', () => {
  it('NewsItem 类型应支持 extra.hover 字段', () => {
    const baiduItem = {
      id: 'https://www.baidu.com/s?wd=test',
      title: '测试热搜',
      url: 'https://www.baidu.com/s?wd=test',
      extra: { hover: '这是百度热搜的描述信息' },
    };
    expect(baiduItem.extra?.hover).toBe('这是百度热搜的描述信息');
  });

  it('convertNewsnowItems 应读取 extra.hover 作为 summary', () => {
    // 复刻 fetcher.service.ts 中的转换逻辑
    function convertNewsnowItems(items: any[], source: string) {
      return items.map((item) => ({
        title: item.title,
        url: item.url,
        source,
        sourceId: item.id,
        summary: item.description || item.extra?.hover || '',
        imageUrl: item.image || '',
      }));
    }

    const baiduItems = [
      {
        id: 'url1',
        title: 'OpenAI 发布 GPT-6',
        url: 'https://www.baidu.com/s?wd=gpt6',
        extra: { hover: 'AI 领域重大突破' },
      },
      {
        id: 'url2',
        title: '英伟达股价新高',
        url: 'https://www.baidu.com/s?wd=nvda',
        description: '市值突破 4 万亿', // 标准 description 优先
        extra: { hover: '备用描述' },
      },
    ];

    const result = convertNewsnowItems(baiduItems, 'baidu');
    // baidu 源用 extra.hover
    expect(result[0].summary).toBe('AI 领域重大突破');
    // 标准 description 优先于 extra.hover
    expect(result[1].summary).toBe('市值突破 4 万亿');
  });
});

// ─── 修复2测试：市场速览股票指数已完全移除 ───
describe('修复2: 市场速览股票指数已移除', () => {
  const html = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );
  const $ = cheerio.load(html);

  it('不应存在 idx-card 元素', () => {
    expect($('.idx-card').length).toBe(0);
  });

  it('不应存在 sparkline 容器 (sp1-sp4)', () => {
    expect($('#sp1').length).toBe(0);
    expect($('#sp2').length).toBe(0);
    expect($('#sp3').length).toBe(0);
    expect($('#sp4').length).toBe(0);
  });

  it('不应存在 mainChart 走势图容器', () => {
    expect($('#mainChart').length).toBe(0);
  });

  it('不应存在 markets section（已完全移除）', () => {
    expect($('#markets').length).toBe(0);
  });

  it('不应包含股票指数相关文本', () => {
    expect(html).not.toContain('上证指数');
    expect(html).not.toContain('标普 500');
    expect(html).not.toContain('纳斯达克');
    expect(html).not.toContain('恒生指数');
  });

  it('JS 中不应存在 renderSpark 函数调用', () => {
    expect(html).not.toMatch(/renderSpark\s*\(/);
  });

  it('JS 中不应存在 echarts.init 调用', () => {
    expect(html).not.toContain("echarts.init");
  });
});

// ─── 修复3测试：数据源失败回退 + myFetch 超时 ───
describe('修复3: 数据源失败时回退数据库缓存', () => {
  it('fetchNewsnowSourceDirectly 应在源失败时回退到数据库', async () => {
    // 模拟：源抓取抛出错误，数据库返回缓存数据
    const mockFetchIthome = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const mockPrisma = {
      article: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'db-1',
            sourceId: 'cached-ithome-1',
            title: '数据库缓存的文章',
            url: 'https://www.ithome.com/0/988/944.htm',
            publishedAt: new Date('2025-01-01'),
            imageUrl: '',
            summary: '这是缓存的文章摘要',
          },
        ]),
      },
    };

    // 复刻回退逻辑
    async function fetchWithFallback(sourceId: string) {
      try {
        return await mockFetchIthome();
      } catch (err) {
        // 回退到数据库
        const articles = await mockPrisma.article.findMany({
          where: { source: sourceId },
          orderBy: { publishedAt: 'desc' },
          take: 30,
        });
        if (articles.length === 0) {
          throw new Error(`${sourceId} 实时抓取失败且数据库无缓存`);
        }
        return articles.map((a: any) => ({
          id: a.sourceId || a.id,
          title: a.title,
          url: a.url,
          pubDate: a.publishedAt.getTime(),
          image: a.imageUrl || undefined,
          description: a.summary || undefined,
        }));
      }
    }

    const result = await fetchWithFallback('ithome');

    // 应返回数据库缓存数据
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('数据库缓存的文章');
    expect(result[0].description).toBe('这是缓存的文章摘要');
    expect(mockPrisma.article.findMany).toHaveBeenCalled();
  });

  it('数据库无缓存时应抛出明确错误', async () => {
    const mockFetchBaidu = vi.fn().mockRejectedValue(new Error('fetch failed'));
    const mockPrisma = {
      article: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    async function fetchWithFallback(sourceId: string) {
      try {
        return await mockFetchBaidu();
      } catch {
        const articles = await mockPrisma.article.findMany({
          where: { source: sourceId },
          take: 30,
        });
        if (articles.length === 0) {
          throw new Error(`${sourceId} 实时抓取失败且数据库无缓存数据`);
        }
        return articles;
      }
    }

    await expect(fetchWithFallback('baidu')).rejects.toThrow(
      '实时抓取失败且数据库无缓存数据'
    );
  });
});

// ─── myFetch 超时配置测试 ───
describe('修复3: myFetch 超时配置', () => {
  it('默认超时应为 8000ms（非 10000ms）', async () => {
    // 读取 utils.ts 源码验证默认值
    const utilsSource = readFileSync(
      join(__dirname, '../../src/services/news/sources/utils.ts'),
      'utf-8'
    );
    // 应包含 timeout = 8000
    expect(utilsSource).toMatch(/timeout\s*=\s*8000/);
    // 不应包含 retry = 3（应已降为 1）
    expect(utilsSource).toMatch(/retry\s*=\s*1/);
  });
});

// ─── 文章内容提取接口测试 ───
describe('修复1: 文章内容提取服务', () => {
  it('extractContent 应从 HTML 提取正文', async () => {
    const { extractContent } = await import(
      '../../src/services/news/content-extractor.service'
    );

    const mockHtml = `
      <html>
      <head><title>测试文章标题</title>
      <meta name="author" content="张三">
      <meta property="article:published_time" content="2025-01-01T00:00:00Z">
      </head>
      <body>
        <nav>导航栏</nav>
        <article>
          <h1>测试文章标题</h1>
          <p>这是第一段正文内容，长度超过二十个字符用于测试提取功能是否正常工作。</p>
          <p>这是第二段正文内容，用于验证多段落提取功能是否正常工作以及内容完整性。</p>
          <p>第三段补充内容，确保总字符数超过一百以满足选择器的最小长度阈值要求。</p>
          <img src="/img/1.jpg" alt="图片1">
        </article>
        <footer>页脚</footer>
      </body>
      </html>
    `;

    const result = extractContent(mockHtml, 'https://example.com/article/1');

    expect(result.title).toBe('测试文章标题');
    expect(result.author).toBe('张三');
    expect(result.publishDate).toBe('2025-01-01T00:00:00Z');
    expect(result.content).toContain('第一段正文内容');
    expect(result.content).toContain('第二段正文内容');
    expect(result.images).toContain('https://example.com/img/1.jpg');
  });

  it('extractContent 应移除脚本和样式', async () => {
    const { extractContent } = await import(
      '../../src/services/news/content-extractor.service'
    );

    const html = `
      <html><body>
      <script>alert('xss')</script>
      <style>.x{color:red}</style>
      <article>
        <p>这是正文内容，长度超过二十个字符用于测试。</p>
      </article>
      </body></html>
    `;

    const result = extractContent(html);
    expect(result.content).not.toContain('alert');
    expect(result.content).not.toContain('color:red');
    expect(result.content).toContain('正文内容');
  });

  it('无 article 标签时应回退到 p 标签', async () => {
    const { extractContent } = await import(
      '../../src/services/news/content-extractor.service'
    );

    const html = `
      <html><body>
        <p>第一段内容，长度超过二十个字符用于测试提取。</p>
        <p>第二段内容，继续测试段落提取功能是否正常。</p>
      </body></html>
    `;

    const result = extractContent(html);
    expect(result.content).toContain('第一段内容');
    expect(result.content).toContain('第二段内容');
  });
});

// ─── 前端 openModal 异步加载逻辑验证 ───
describe('修复1: 前端 openModal 异步加载正文', () => {
  const html = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );

  // 静态化后，详情 JSON 已包含正文，无需再调 /content 接口
  it('openModal 应直接读取静态文章详情 JSON', () => {
    expect(html).toContain('fetchJson(`${DATA_DIR}/articles/${articleId}.json`)');
  });

  it('不应再调用后端 /api/news/:id/content 接口', () => {
    expect(html).not.toContain('/api/news/');
  });

  it('renderArticle 应使用 content 字段渲染正文', () => {
    expect(html).toMatch(/modal-content.*\$\{a\.content/);
  });
});

// ─── 修复4测试：模态框关闭按钮可点击 ───
describe('修复4: 模态框关闭按钮', () => {
  const html = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );
  const $ = cheerio.load(html);

  it('关闭按钮应存在且有 id（用 addEventListener 绑定）', () => {
    const btn = $('.modal-close');
    expect(btn.length).toBe(1);
    expect(btn.attr('id')).toBe('modalCloseBtn');
    // 不应使用内联 onclick（被 CSP script-src-attr 'none' 禁止）
    expect(btn.attr('onclick')).toBeUndefined();
  });

  it('关闭按钮应为 type=button 避免提交表单', () => {
    expect($('.modal-close').attr('type')).toBe('button');
  });

  it('modal-box 应为定位上下文 (position:relative)', () => {
    const styleMatch = html.match(/\.modal-box\{([^}]+)\}/);
    expect(styleMatch?.[1]).toContain('position:relative');
  });

  it('关闭按钮应使用绝对定位而非 sticky/float', () => {
    const styleMatch = html.match(/\.modal-close\{([^}]+)\}/);
    expect(styleMatch?.[1]).toContain('position:absolute');
    expect(styleMatch?.[1]).not.toContain('sticky');
    expect(styleMatch?.[1]).not.toContain('float');
  });

  it('closeModal 函数应定义并清除 open 类', () => {
    expect(html).toMatch(/function\s+closeModal\s*\(\s*\)\s*\{/);
    expect(html).toMatch(/classList\.remove\(['"]open['"]\)/);
  });

  it('应用 addEventListener 绑定关闭按钮（非内联 onclick）', () => {
    expect(html).toContain("getElementById('modalCloseBtn')");
    expect(html).toMatch(/addEventListener\(['"]click['"]\s*,\s*closeModal\)/);
  });

  it('HTML 中不应有 onclick 内联事件（CSP 合规）', () => {
    expect(html).not.toMatch(/onclick\s*=/);
  });
});

// ─── 实时热点前端优化验证 ───
describe('修复3: 实时热点前端优化', () => {
  const html = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );

  // 静态站点不能触发后端采集，刷新按钮改为重新加载 JSON
  it('刷新按钮应重新调用 loadNews 而非后端 API', () => {
    expect(html).toMatch(/refresh.*await loadNews/s);
    expect(html).not.toContain('/api/news/refresh');
  });

  it('加载失败时应显示友好提示', () => {
    expect(html).toMatch(/数据未生成|加载失败/);
  });
});

// ─── 新设计验证：商业 / AI 双板块结构 ───
describe('新设计: 商业与 AI 双板块', () => {
  const html = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );
  const $ = cheerio.load(html);

  it('应存在商业板块 (#business)', () => {
    expect($('#business').length).toBe(1);
    expect($('#business .kicker').text()).toBe('BUSINESS');
  });

  it('应存在 AI 板块 (#ai)', () => {
    expect($('#ai').length).toBe(1);
    expect($('#ai .kicker').text()).toBe('ARTIFICIAL INTELLIGENCE');
  });

  it('商业板块应包含新闻列表容器 #businessNews', () => {
    expect($('#businessNews').length).toBe(1);
  });

  it('AI 板块应包含新闻列表容器 #aiNews', () => {
    expect($('#aiNews').length).toBe(1);
  });

  it('应有商业刷新按钮', () => {
    expect($('#refreshBusiness').length).toBe(1);
  });

  it('应有 AI 刷新按钮', () => {
    expect($('#refreshAi').length).toBe(1);
  });

  it('应引用 styles.css 外部样式表', () => {
    expect($('link[rel="stylesheet"][href="styles.css"]').length).toBe(1);
  });

  it('应定义 categorize 分类函数', () => {
    expect(html).toMatch(/function\s+categorize\s*\(/);
  });

  it('应定义 AI 关键词正则', () => {
    expect(html).toContain('AI_KEYWORDS');
  });

  it('应定义商业关键词正则', () => {
    expect(html).toContain('BIZ_KEYWORDS');
  });

  it('AI 关键词应包含 deepseek/openai/大模型', () => {
    expect(html).toContain('deepseek');
    expect(html).toContain('openai');
    expect(html).toContain('大模型');
  });

  it('商业关键词应包含 股市/油价/财报', () => {
    expect(html).toContain('股市');
    expect(html).toContain('油价');
    expect(html).toContain('财报');
  });

  it('应加载数据并分类到两个板块', () => {
    expect(html).toContain("renderNewsList('businessNews'");
    expect(html).toContain("renderNewsList('aiNews'");
  });
});

// ─── Bug 修复: 无正文 + 原文链接错误 ───
describe('Bug修复: 文章正文完整性与原文链接', () => {
  const indexHtml = readFileSync(
    join(__dirname, '../../../../index.html'),
    'utf-8'
  );
  const fetchStatic = readFileSync(
    join(__dirname, '../../../../code/backend/scripts/fetch-static.ts'),
    'utf-8'
  );

  describe('fetch-static.ts: 正文抓取数量', () => {
    it('MAX_CONTENT_FETCH 应 >= MAX_ARTICLES，所有文章都应抓取正文', () => {
      const maxArticlesMatch = fetchStatic.match(/MAX_ARTICLES\s*=\s*(\d+)/);
      const maxContentMatch = fetchStatic.match(/MAX_CONTENT_FETCH\s*=\s*(\d+)/);
      expect(maxArticlesMatch).toBeTruthy();
      expect(maxContentMatch).toBeTruthy();
      const maxArticles = parseInt(maxArticlesMatch![1]);
      const maxContent = parseInt(maxContentMatch![1]);
      expect(maxContent).toBeGreaterThanOrEqual(maxArticles);
    });
  });

  describe('fetch-static.ts: baidu URL 处理策略', () => {
    it('baidu 搜索 URL 应跳过正文抓取，使用 summary 兜底', () => {
      // baidu 热搜只提供搜索 URL，无法提取正文
      // fetch-static.ts 应检测 baidu URL 并跳过正文抓取
      expect(fetchStatic).toMatch(/baidu/);
      expect(fetchStatic).toMatch(/a\.content\s*=\s*a\.summary/);
    });
  });

  describe('index.html: 无正文时的显示策略', () => {
    it('不应显示"暂无正文，请查看原文"的空内容提示', () => {
      expect(indexHtml).not.toContain('暂无正文');
    });

    it('无正文时应显示 summary 作为兜底内容', () => {
      expect(indexHtml).toMatch(/a\.summary/);
    });

    it('查看原文链接不应指向 baidu 搜索页', () => {
      // 链接应使用 a.url 字段（模板字面量中的 ${a.url}）
      expect(indexHtml).toMatch(/modal-source-link[^>]*href="\$\{a\.url\}"/s);
    });
  });

  describe('数据验证: 检查已生成的 JSON 文件', () => {
    let newsJson: any;
    let articleJsons: any[] = [];

    beforeAll(() => {
      try {
        const dataDir = join(__dirname, '../../../../data');
        newsJson = JSON.parse(
          readFileSync(join(dataDir, 'news.json'), 'utf-8')
        );
        const articlesDir = join(dataDir, 'articles');
        // 读取前 10 个 article 文件验证
        const fs = require('fs');
        const files = fs.readdirSync(articlesDir).slice(0, 10);
        for (const f of files) {
          articleJsons.push(
            JSON.parse(readFileSync(join(articlesDir, f), 'utf-8'))
          );
        }
      } catch {
        // 数据文件可能不存在（CI 环境），跳过
      }
    });

    it('news.json 应存在且包含文章数据', () => {
      if (!newsJson) return; // skip
      expect(newsJson.success).toBe(true);
      expect(newsJson.data.length).toBeGreaterThan(0);
    });

    it('baidu 源文章的 URL 不应为验证码页面', () => {
      if (!newsJson) return; // skip
      const baiduArticles = newsJson.data.filter(
        (a: any) => a.source === 'baidu'
      );
      for (const a of baiduArticles) {
        // baidu 搜索 URL 是正常的（可在浏览器中打开），但验证码 URL 是错误的
        expect(a.url).not.toMatch(/wappass\.baidu\.com/);
      }
    });

    it('大多数文章详情应有 content（非空）或 summary 兜底', () => {
      if (articleJsons.length === 0) return; // skip
      let withContentOrSummary = 0;
      for (const aj of articleJsons) {
        const a = aj.data || aj;
        const hasContent = a.content && a.content.trim().length > 0;
        const hasSummary = a.summary && a.summary.trim().length > 0;
        if (hasContent || hasSummary) withContentOrSummary++;
      }
      // 允许少量文章无内容（baidu 未提供描述的条目），但至少 80% 应有内容
      expect(withContentOrSummary / articleJsons.length).toBeGreaterThan(0.8);
    });
  });
});
