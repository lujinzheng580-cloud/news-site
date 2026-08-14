// CSP 配置测试 — 验证不同环境下 Helmet 输出的 HTTP 头
// 决定 target="_blank" 外部跳转能否生效的关键因素：
//   1. Cross-Origin-Opener-Policy: unsafe-none 允许跨域打开新窗口
//   2. Content-Security-Policy 中 script-src 含 'unsafe-inline' 允许内联脚本
//   3. Content-Security-Policy 中 connect-src 允许外部 API 调用

import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import helmet from 'helmet';

// ─── 复现 app.ts 中的开发环境 helmet 配置 ───
function buildHelmetOptions(isDev: boolean) {
  return {
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' as const },
    contentSecurityPolicy: isDev
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'data:'],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'", 'https:', 'data:'],
            connectSrc: ["'self'", 'https:', 'http:'],
            frameAncestors: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        }
      : undefined,
  };
}

// 启动临时 Express 服务并返回响应头
async function fetchHeaders(
  helmetOptions: Record<string, unknown>
): Promise<Record<string, string>> {
  const app = express();
  app.use(helmet(helmetOptions as any));
  app.get('/', (_req, res) => res.send('ok'));

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
        }
        res.resume();
        server.close();
        resolve(headers);
      });
      req.on('error', reject);
    });
  });
}

// ─── 解析 CSP 头为 directive map ───
function parseCsp(csp: string): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length === 0 || !tokens[0]) continue;
    const name = tokens[0].toLowerCase();
    result[name] = tokens.slice(1);
  }
  return result;
}

describe('CSP 配置 — 开发环境', () => {
  let headers: Record<string, string>;
  beforeAll(async () => {
    headers = await fetchHeaders(buildHelmetOptions(true));
  });

  it('应返回 Cross-Origin-Opener-Policy: unsafe-none', () => {
    expect(headers['cross-origin-opener-policy']).toBe('unsafe-none');
  });

  it('应返回 Content-Security-Policy 头', () => {
    expect(headers['content-security-policy']).toBeTruthy();
  });

  it('CSP script-src 应包含 unsafe-inline（允许内联脚本）', () => {
    const csp = parseCsp(headers['content-security-policy']);
    expect(csp['script-src']).toBeDefined();
    expect(csp['script-src']).toContain("'unsafe-inline'");
  });

  it('CSP script-src 应包含 unsafe-eval（允许 eval）', () => {
    const csp = parseCsp(headers['content-security-policy']);
    expect(csp['script-src']).toContain("'unsafe-eval'");
  });

  it('CSP connect-src 应允许 http/https 外部请求', () => {
    const csp = parseCsp(headers['content-security-policy']);
    expect(csp['connect-src']).toBeDefined();
    expect(csp['connect-src']).toContain('https:');
    expect(csp['connect-src']).toContain('http:');
  });

  it('CSP img-src 应允许 https 外部图片', () => {
    const csp = parseCsp(headers['content-security-policy']);
    expect(csp['img-src']).toContain('https:');
  });

  it('COOP + CSP 组合应允许 target=_blank 外部跳转', () => {
    // 判定逻辑：COOP 为 unsafe-none 且 script-src 含 unsafe-inline
    const coop = headers['cross-origin-opener-policy'];
    const csp = parseCsp(headers['content-security-policy']);
    const allowsInline = csp['script-src']?.includes("'unsafe-inline'");
    expect(coop).toBe('unsafe-none');
    expect(allowsInline).toBe(true);
  });
});

describe('CSP 配置 — 生产环境（Helmet 默认严格模式）', () => {
  let headers: Record<string, string>;
  beforeAll(async () => {
    // 生产环境：contentSecurityPolicy 为 undefined，使用 Helmet 默认值
    headers = await fetchHeaders(buildHelmetOptions(false));
  });

  it('Cross-Origin-Opener-Policy 仍为 unsafe-none（配置项不随环境变）', () => {
    expect(headers['cross-origin-opener-policy']).toBe('unsafe-none');
  });

  it('CSP script-src 不应包含 unsafe-inline（默认严格）', () => {
    const csp = parseCsp(headers['content-security-policy'] || '');
    // Helmet 默认 script-src 只有 'self'
    expect(csp['script-src']).toBeDefined();
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
  });

  it('CSP connect-src 默认未设置（仅 default-src self）', () => {
    const csp = parseCsp(headers['content-security-policy'] || '');
    // Helmet 默认不设置 connect-src，走 default-src 'self'
    expect(csp['connect-src']).toBeUndefined();
  });
});

describe('默认 Helmet 配置（未自定义）— 模拟修复前的状态', () => {
  let headers: Record<string, string>;
  beforeAll(async () => {
    // 不传任何 options，使用 helmet 默认配置
    headers = await fetchHeaders({});
  });

  it('Cross-Origin-Opener-Policy 默认为 same-origin（阻止外部跳转）', () => {
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('CSP script-src 默认只有 self（阻止内联脚本）', () => {
    const csp = parseCsp(headers['content-security-policy'] || '');
    expect(csp['script-src']).toEqual(["'self'"]);
  });

  it('默认配置应判定为不允许 target=_blank 外部跳转', () => {
    const coop = headers['cross-origin-opener-policy'];
    const csp = parseCsp(headers['content-security-policy'] || '');
    const allowsInline = csp['script-src']?.includes("'unsafe-inline'");
    // 修复前：COOP=same-origin 且无 unsafe-inline，跳转被阻止
    expect(coop).toBe('same-origin');
    expect(allowsInline).toBeFalsy();
  });
});
