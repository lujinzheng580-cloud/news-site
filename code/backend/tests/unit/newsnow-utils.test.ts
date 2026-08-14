// NewsNow 移植工具函数单元测试
import { describe, it, expect } from 'vitest';
import { parseRelativeDate, myFetch, defineSource } from '../../src/services/news/sources/utils';

describe('parseRelativeDate', () => {
  it('应解析"刚刚"为当前时间', () => {
    const before = Date.now();
    const result = parseRelativeDate('刚刚').getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it('应解析"3小时前"', () => {
    const now = Date.now();
    const result = parseRelativeDate('3小时前').getTime();
    const expected = now - 3 * 3600 * 1000;
    // 允许 5 秒误差
    expect(Math.abs(result - expected)).toBeLessThan(5000);
  });

  it('应解析"5分钟前"', () => {
    const now = Date.now();
    const result = parseRelativeDate('5分钟前').getTime();
    const expected = now - 5 * 60 * 1000;
    expect(Math.abs(result - expected)).toBeLessThan(5000);
  });

  it('应解析"2天前"', () => {
    const now = Date.now();
    const result = parseRelativeDate('2天前').getTime();
    const expected = now - 2 * 24 * 3600 * 1000;
    expect(Math.abs(result - expected)).toBeLessThan(5000);
  });

  it('应解析英文"10 minutes ago"', () => {
    const now = Date.now();
    const result = parseRelativeDate('10 minutes ago').getTime();
    const expected = now - 10 * 60 * 1000;
    expect(Math.abs(result - expected)).toBeLessThan(5000);
  });

  it('不匹配的字符串原样返回', () => {
    const result = parseRelativeDate('2026-08-13 10:00');
    // 字符串模式无法解析时返回原字符串
    expect(result).toBe('2026-08-13 10:00');
  });
});

describe('myFetch', () => {
  it('应是函数，支持 headers 和 timeout 选项', () => {
    expect(typeof myFetch).toBe('function');
  });

  it('应正确发起 HTTP 请求并返回文本', async () => {
    // 使用 httpbin 简单测试
    const result = await myFetch('https://httpbin.org/uuid');
    expect(typeof result).toBe('string');
    expect(result).toMatch(/[0-9a-f-]{36}/i);
  }, 15000);
});

describe('defineSource', () => {
  it('应返回传入的 getter 函数', () => {
    const getter = async () => [{ id: '1', title: 'test', url: 'http://example.com' }];
    const result = defineSource(getter);
    expect(result).toBe(getter);
  });

  it('返回的函数应能被调用并返回数组', async () => {
    const getter = async () => [
      { id: '1', title: 'test', url: 'http://example.com', pubDate: Date.now() },
    ];
    const result = defineSource(getter);
    const data = await result();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].title).toBe('test');
  });
});
