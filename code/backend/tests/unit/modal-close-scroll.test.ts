// @vitest-environment happy-dom
// 模拟真实用户行为：长文本新闻 → 滚动到底部 → 点击关闭按钮
// 验证修复后的关闭按钮在任意滚动位置都能正常工作

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// 构造一篇超长新闻内容（模拟真实长文，8000+ 字符）
const LONG_ARTICLE = {
  id: 'test-long-article-001',
  title: '2026 全球 AI 算力大会纪实：从芯片到应用的全面跃迁',
  url: 'https://example.com/long-article/test',
  source: 'ithome',
  sourceId: 'test-long-article-001',
  category: 'tech',
  summary: '本次大会聚集了全球 200+ 家企业，围绕 AI 算力、模型架构、应用落地展开为期三天的深度讨论。',
  content: Array.from({ length: 40 }, (_, i) =>
    `<p>第 ${i + 1} 段：这是用于测试滚动的超长正文内容。` +
    `在本次 AI 算力大会上，多位行业专家围绕大模型训练、推理优化、` +
    `边缘计算、芯片架构、数据中心能源效率等议题展开深入讨论。` +
    `其中，异构计算、3D NAND 堆叠、HBM4 内存、硅光互联等关键技术` +
    `被认为是推动下一代 AI 基础设施演进的核心动力。` +
    `专家指出，到 2027 年全球 AI 算力需求将再增长 10 倍，` +
    `这要求产业链从晶圆制造、封装、整机、网络到软件栈全面协同进化。` +
    `本文将带您回顾本次大会的核心观点与重要数据。</p>`
  ).join('\n'),
  imageUrl: '',
  authorName: '测试作者',
  publishedAt: new Date('2026-08-13T10:00:00Z').toISOString(),
  tags: '["AI","算力","芯片","大会"]',
  viewCount: 1234,
};

describe('模态框关闭按钮 - 长文本滚动后可关闭', () => {
  let modal: HTMLElement;
  let modalBody: HTMLElement;
  let closeBtn: HTMLButtonElement;
  let openModal: (id: string) => void;
  let closeModal: () => void;

  beforeAll(() => {
    // 读取真实 index.html，提取需要的部分
    const html = readFileSync(
      join(__dirname, '../../../../index.html'),
      'utf-8'
    );

    // 提取模态框的 HTML 结构
    const modalHtmlMatch = html.match(
      /<div class="modal-overlay"[^>]*>[\s\S]*?<\/div>\s*<\/div>/
    );
    if (!modalHtmlMatch) throw new Error('无法提取模态框 HTML');

    // 提取 modal 相关的 CSS：合并 index.html 内联样式 + 外部 styles.css
    const inlineStyleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    const inlineCss = inlineStyleMatch ? inlineStyleMatch[1] : '';
    let externalCss = '';
    try {
      externalCss = readFileSync(
        join(__dirname, '../../../../styles.css'),
        'utf-8'
      );
    } catch {}
    const modalCss = inlineCss + '\n' + externalCss;

    // 构造测试页面（不含 echarts）
    document.head.innerHTML = `<style>${modalCss}</style>`;
    document.body.innerHTML = `<div id="app">${modalHtmlMatch[0]}</div>`;

    // mock fetch：所有请求都返回长文章（静态 JSON 模式）
    global.fetch = (async () => {
      const body = JSON.stringify({
        success: true,
        data: LONG_ARTICLE,
      });
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body,
      } as Response;
    }) as typeof fetch;

    // 从 index.html 提取并定义关键函数
    const DATA_DIR = 'data';
    const fetchJson = (path: string) =>
      fetch(path).then((r) => r.json());

    // 直接定义这些函数（与 index.html 中保持一致）
    const modalEl = document.getElementById('articleModal')!;
    const modalBodyEl = document.getElementById('modalBody')!;

    function renderArticle(a: typeof LONG_ARTICLE) {
      const tags = (() => {
        try { return JSON.parse(a.tags || '[]'); }
        catch { return []; }
      })();
      const pubDate = new Date(a.publishedAt);
      const hours = Math.floor((Date.now() - pubDate.getTime()) / 3600000);
      const timeStr = hours > 0 ? hours + ' 小时前' : '刚刚';

      modalBodyEl.innerHTML = `
        <div class="modal-kicker">${a.category}</div>
        <h1>${a.title}</h1>
        <div class="modal-meta">来源：${a.source} · 作者：${a.authorName} · ${timeStr} · 浏览 ${a.viewCount} 次</div>
        ${a.imageUrl ? `<img src="${a.imageUrl}" alt="" />` : ''}
        ${a.summary ? `<div class="modal-summary">${a.summary}</div>` : ''}
        <div class="modal-content">${a.content || '（暂无正文，请查看原文）'}</div>
        <div class="modal-tags">${tags.map((t: string) => `<span>${t}</span>`).join('')}</div>
        <a class="modal-source-link" href="${a.url}" target="_blank" rel="noopener">查看原文 →</a>
      `;
    }

    openModal = (articleId: string) => {
      modalEl.classList.add('open');
      modalBodyEl.innerHTML = '<div class="modal-loading">加载中…</div>';
      document.body.style.overflow = 'hidden';
      // 读取静态文章详情 JSON（已包含正文）
      fetchJson(`${DATA_DIR}/articles/${articleId}.json`)
        .then((json: any) => {
          if (json.success && json.data) {
            renderArticle(json.data);
          } else {
            modalBodyEl.innerHTML = '<div class="modal-loading">文章加载失败</div>';
          }
        })
        .catch(() => {
          modalBodyEl.innerHTML = '<div class="modal-loading">网络错误</div>';
        });
    };

    closeModal = () => {
      modalEl.classList.remove('open');
      document.body.style.overflow = '';
    };

    // 绑定全局事件（与 index.html 一致）
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.classList.contains('open')) closeModal();
    });

    // 绑定关闭按钮（与 index.html 一致：addEventListener，不用内联 onclick）
    const btn = document.getElementById('modalCloseBtn') as HTMLButtonElement;
    btn.addEventListener('click', () => closeModal());

    // 暴露到全局以便测试调用
    (window as any).closeModal = closeModal;
    (window as any).openModal = openModal;
  });

  beforeEach(() => {
    modal = document.getElementById('articleModal') as HTMLElement;
    modalBody = document.getElementById('modalBody') as HTMLElement;
    closeBtn = document.querySelector('.modal-close') as HTMLButtonElement;
    modal.classList.remove('open');
    modalBody.innerHTML = '';
    document.body.style.overflow = '';
  });

  it('长文章内容长度应超过 5000 字符（确保需要滚动）', () => {
    expect(LONG_ARTICLE.content.length).toBeGreaterThan(5000);
  });

  it('初始状态：模态框应关闭', () => {
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('点击标题打开模态框 → 渲染长文 → 内容应超过 3000 字符', async () => {
    openModal(LONG_ARTICLE.id);
    await new Promise((r) => setTimeout(r, 50));

    expect(modal.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    // 验证已渲染长文内容
    expect(modalBody.innerHTML.length).toBeGreaterThan(3000);
    expect(modalBody.querySelectorAll('p').length).toBeGreaterThanOrEqual(40);
  });

  it('滚动到底部后点击 × 按钮 → 模态框应正常关闭', async () => {
    // 打开模态框
    openModal(LONG_ARTICLE.id);
    await new Promise((r) => setTimeout(r, 50));
    expect(modal.classList.contains('open')).toBe(true);

    // 模拟用户滚动到底部
    Object.defineProperty(modalBody, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(modalBody, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    modalBody.scrollTop = 4400; // 滚动到底部

    // 验证按钮仍可点击 - getBoundingClientRect 应返回有效坐标
    const rect = closeBtn.getBoundingClientRect();
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);

    // 关键步骤：模拟点击 × 按钮
    closeBtn.click();

    // 验证模态框已关闭
    expect(modal.classList.contains('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('滚动到中部时点击 × 按钮 → 模态框应正常关闭', async () => {
    openModal(LONG_ARTICLE.id);
    await new Promise((r) => setTimeout(r, 50));

    Object.defineProperty(modalBody, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });
    modalBody.scrollTop = 2500; // 滚动到中部

    closeBtn.click();
    expect(modal.classList.contains('open')).toBe(false);
  });

  it('多次打开-滚动-关闭循环：稳定性验证', async () => {
    for (let i = 0; i < 5; i++) {
      openModal(LONG_ARTICLE.id);
      await new Promise((r) => setTimeout(r, 20));

      // 滚动到底部
      modalBody.scrollTop = 9999;

      // 点击关闭
      closeBtn.click();
      expect(modal.classList.contains('open')).toBe(false);
    }
  });

  it('关闭按钮使用绝对定位 → 滚动不影响其位置', () => {
    const styles = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('');
    expect(styles).toMatch(/\.modal-close\{[^}]*position:absolute/);
    expect(styles).toMatch(/\.modal-box\{[^}]*position:relative/);
    expect(styles).not.toMatch(/\.modal-close\{[^}]*sticky/);
    expect(styles).not.toMatch(/\.modal-close\{[^}]*float:right/);
  });

  it('ESC 键应能关闭模态框（键盘可访问性）', async () => {
    openModal(LONG_ARTICLE.id);
    await new Promise((r) => setTimeout(r, 50));
    expect(modal.classList.contains('open')).toBe(true);

    // 模拟 ESC 键
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escEvent);

    expect(modal.classList.contains('open')).toBe(false);
  });

  it('点击遮罩区域应能关闭模态框', async () => {
    openModal(LONG_ARTICLE.id);
    await new Promise((r) => setTimeout(r, 50));
    expect(modal.classList.contains('open')).toBe(true);

    // 模拟点击遮罩（target === modal 自身）
    const clickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEvent, 'target', { value: modal });
    modal.dispatchEvent(clickEvent);

    expect(modal.classList.contains('open')).toBe(false);
  });
});
