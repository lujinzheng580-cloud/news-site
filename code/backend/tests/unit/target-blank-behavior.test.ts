// target="_blank" 跳转行为判定逻辑测试
// 浏览器是否允许 target="_blank" 跳转到外部 URL，由响应头决定：
//   1. Cross-Origin-Opener-Policy (COOP): same-origin 会阻止跨域 opener 访问
//   2. Content-Security-Policy (CSP) 中 connect-src: 限制 fetch 能调用的域
//   3. CSP 中 script-src: 是否允许内联脚本（前端 JS 绑定的点击事件）

import { describe, it, expect } from 'vitest';

// ─── 被测函数：根据响应头判定跳转行为 ───
// 返回 { canOpen, reason } 表示能否在新标签打开外部链接
interface JumpResult {
  canOpen: boolean;
  reason: string;
}

function canJumpToExternal(
  headers: Record<string, string>,
  targetUrl: string
): JumpResult {
  const coop = headers['cross-origin-opener-policy'] || '';
  const cspHeader = headers['content-security-policy'] || '';
  const csp = parseCsp(cspHeader);

  // 非外部 http(s) 链接（相对路径、mailto、javascript: 等）不受 COOP/CSP 限制
  const isExternal = /^https?:\/\//.test(targetUrl);
  if (!isExternal) {
    return { canOpen: true, reason: '同源链接，不受 COOP 限制' };
  }

  // 条件 1：COOP=same-origin 会阻止跨域 opener 访问
  if (coop === 'same-origin') {
    return {
      canOpen: false,
      reason: 'COOP=same-origin 阻止跨域 opener 访问，新窗口会被隔离',
    };
  }

  // 条件 2：CSP script-src 必须含 'unsafe-inline' 才能执行内联 JS 事件
  const scriptSrc = csp['script-src'];
  if (scriptSrc && !scriptSrc.includes("'unsafe-inline'")) {
    return {
      canOpen: false,
      reason: "CSP script-src 不含 'unsafe-inline'，内联脚本被禁止",
    };
  }

  // 条件 3：connect-src 若设置，必须允许目标域（简化：检查 http/https 通配）
  const connectSrc = csp['connect-src'];
  if (connectSrc) {
    const allowsHttp = connectSrc.includes('http:') || connectSrc.includes('*');
    const allowsHttps = connectSrc.includes('https:') || connectSrc.includes('*');
    if (targetUrl.startsWith('https://') && !allowsHttps) {
      return {
        canOpen: false,
        reason: `CSP connect-src ${connectSrc.join(' ')} 不允许 https 目标`,
      };
    }
    if (targetUrl.startsWith('http://') && !allowsHttp) {
      return {
        canOpen: false,
        reason: `CSP connect-src ${connectSrc.join(' ')} 不允许 http 目标`,
      };
    }
  }

  return {
    canOpen: true,
    reason: 'COOP 允许跨域 + CSP 允许内联脚本 + connect-src 允许外部',
  };
}

function parseCsp(csp: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/);
    if (!tokens[0]) continue;
    result[tokens[0].toLowerCase()] = tokens.slice(1);
  }
  return result;
}

// ─── 测试用例 ───

describe('canJumpToExternal — 默认 Helmet 配置（修复前）', () => {
  const headers = {
    'cross-origin-opener-policy': 'same-origin',
    'content-security-policy':
      "default-src 'self'; script-src 'self'; connect-src 'self'",
  };

  it('外部 https 链接应判定为不可跳转', () => {
    const r = canJumpToExternal(headers, 'https://www.ithome.com/0/988/944.htm');
    expect(r.canOpen).toBe(false);
    expect(r.reason).toMatch(/COOP=same-origin/);
  });

  it('外部 http 链接应判定为不可跳转', () => {
    const r = canJumpToExternal(headers, 'http://example.com');
    expect(r.canOpen).toBe(false);
  });

  it('同源相对路径应可跳转', () => {
    const r = canJumpToExternal(headers, '/api/news');
    expect(r.canOpen).toBe(true);
  });
});

describe('canJumpToExternal — 开发环境配置（修复后）', () => {
  const headers = {
    'cross-origin-opener-policy': 'unsafe-none',
    'content-security-policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: http:",
  };

  it('ithome 外部链接应可跳转', () => {
    const r = canJumpToExternal(headers, 'https://www.ithome.com/0/988/944.htm');
    expect(r.canOpen).toBe(true);
  });

  it('百度热搜外部链接应可跳转', () => {
    const r = canJumpToExternal(headers, 'https://www.baidu.com/s?wd=test');
    expect(r.canOpen).toBe(true);
  });

  it('华尔街见闻外部链接应可跳转', () => {
    const r = canJumpToExternal(headers, 'https://wallstreetcn.com/article/123');
    expect(r.canOpen).toBe(true);
  });

  it('http 协议外部链接应可跳转', () => {
    const r = canJumpToExternal(headers, 'http://example.com');
    expect(r.canOpen).toBe(true);
  });

  it('同源相对路径应可跳转', () => {
    const r = canJumpToExternal(headers, '/api/news/sources/ithome');
    expect(r.canOpen).toBe(true);
    expect(r.reason).toMatch(/同源/);
  });
});

describe('canJumpToExternal — 生产环境配置', () => {
  // 生产环境：COOP=unsafe-none，但 CSP 严格（无 unsafe-inline）
  const headers = {
    'cross-origin-opener-policy': 'unsafe-none',
    'content-security-policy':
      "default-src 'self'; script-src 'self'",
  };

  it('COOP 允许但 CSP 禁止内联脚本，应判定为不可跳转', () => {
    const r = canJumpToExternal(headers, 'https://example.com');
    expect(r.canOpen).toBe(false);
    expect(r.reason).toMatch(/unsafe-inline/);
  });
});

describe('canJumpToExternal — 边界场景', () => {
  it('无任何安全头时应允许跳转', () => {
    const r = canJumpToExternal({}, 'https://example.com');
    expect(r.canOpen).toBe(true);
  });

  it('COOP=same-origin-allow-popups 应允许跳转', () => {
    const headers = {
      'cross-origin-opener-policy': 'same-origin-allow-popups',
      'content-security-policy':
        "script-src 'self' 'unsafe-inline'; connect-src 'self' https:",
    };
    const r = canJumpToExternal(headers, 'https://example.com');
    expect(r.canOpen).toBe(true);
  });

  it('CSP connect-src 限制为 self 时，外部 https 应不可跳转', () => {
    const headers = {
      'cross-origin-opener-policy': 'unsafe-none',
      'content-security-policy':
        "script-src 'self' 'unsafe-inline'; connect-src 'self'",
    };
    const r = canJumpToExternal(headers, 'https://example.com');
    expect(r.canOpen).toBe(false);
    expect(r.reason).toMatch(/connect-src/);
  });

  it('CSP connect-src 为 * 时应允许所有外部跳转', () => {
    const headers = {
      'cross-origin-opener-policy': 'unsafe-none',
      'content-security-policy':
        "script-src 'self' 'unsafe-inline'; connect-src *",
    };
    const r = canJumpToExternal(headers, 'https://example.com');
    expect(r.canOpen).toBe(true);
  });

  it('mailto 链接应判定为同源（非 http(s)）', () => {
    const headers = {
      'cross-origin-opener-policy': 'same-origin',
      'content-security-policy': "script-src 'self'",
    };
    const r = canJumpToExternal(headers, 'mailto:test@example.com');
    expect(r.canOpen).toBe(true);
    expect(r.reason).toMatch(/同源/);
  });

  it('javascript:void(0) 应判定为同源', () => {
    const headers = {
      'cross-origin-opener-policy': 'same-origin',
    };
    const r = canJumpToExternal(headers, 'javascript:void(0)');
    expect(r.canOpen).toBe(true);
  });
});

describe('canJumpToExternal — 与 app.ts 实际配置一致性', () => {
  // 复刻 app.ts 中开发环境的 helmet 配置生成的头
  const devHeaders = {
    'cross-origin-opener-policy': 'unsafe-none',
    'content-security-policy':
      "default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline' https: data:;img-src 'self' data: https:;font-src 'self' https: data:;connect-src 'self' https: http:;frame-ancestors 'self';form-action 'self';upgrade-insecure-requests",
  };

  it('开发环境应允许 ithome 链接跳转', () => {
    const r = canJumpToExternal(
      devHeaders,
      'https://www.ithome.com/0/988/944.htm'
    );
    expect(r.canOpen).toBe(true);
  });

  it('开发环境应允许 baidu 链接跳转', () => {
    const r = canJumpToExternal(
      devHeaders,
      'https://www.baidu.com/s?wd=gpt6'
    );
    expect(r.canOpen).toBe(true);
  });

  it('开发环境应允许 wallstreetcn 链接跳转', () => {
    const r = canJumpToExternal(
      devHeaders,
      'https://wallstreetcn.com/article/123456'
    );
    expect(r.canOpen).toBe(true);
  });
});
