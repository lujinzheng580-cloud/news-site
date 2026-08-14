// 缓存服务单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import { cache, cacheKeys, withCache } from '../../src/services/cache.service';

describe('MemoryCache', () => {
  beforeEach(async () => {
    await cache.clear();
    cache.resetStats();
  });

  it('应正确存储和读取缓存', async () => {
    await cache.set('test-key', { foo: 'bar' }, 60);
    const result = await cache.get<{ foo: string }>('test-key');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('不存在的 key 应返回 null', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('应正确删除缓存', async () => {
    await cache.set('delete-me', 'value', 60);
    await cache.del('delete-me');
    const result = await cache.get('delete-me');
    expect(result).toBeNull();
  });

  it('过期缓存应返回 null', async () => {
    await cache.set('expire-fast', 'data', 0); // 0 秒过期
    // 手动触发过期（模拟）
    await new Promise((r) => setTimeout(r, 10));
    const result = await cache.get('expire-fast');
    expect(result).toBeNull();
  });

  it('getStats 应返回缓存统计信息', async () => {
    await cache.set('a', 1, 60);
    await cache.get('a'); // hit
    await cache.get('b'); // miss
    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

describe('cacheKeys', () => {
  it('应生成格式化的缓存键', () => {
    expect(cacheKeys.newsList('page=1')).toBe('news:list:page=1');
    expect(cacheKeys.newsDetail('123')).toBe('news:detail:123');
    expect(cacheKeys.search('AI')).toBe('search:AI');
    expect(cacheKeys.categories).toBe('categories');
  });
});

describe('withCache', () => {
  it('缓存命中时应返回缓存数据，不调用 fetcher', async () => {
    await cache.set('cached-key', 'cached-value', 60);
    const fetcher = async () => 'fresh-value';
    const result = await withCache('cached-key', fetcher, 60);
    expect(result).toBe('cached-value');
  });

  it('缓存未命中时应调用 fetcher 并缓存结果', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return 'fresh-value';
    };
    const result = await withCache('fresh-key', fetcher, 60);
    expect(result).toBe('fresh-value');
    expect(callCount).toBe(1);
  });
});