// Redis 缓存服务
// 简单内存缓存实现（开发环境/无 Redis 时备用）
// 生产环境应替换为 ioredis 实现

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data as T;
  }

  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    this.store.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? (this.hits / (this.hits + this.misses) * 100).toFixed(1) + '%'
        : '0%',
    };
  }
}

// 导出单例
export const cache = new MemoryCache();

// 缓存 Key 生成工具
export const cacheKeys = {
  newsList: (params: string) => `news:list:${params}`,
  newsDetail: (id: string) => `news:detail:${id}`,
  search: (query: string) => `search:${query}`,
  categories: 'categories',
  trending: 'trending',
  source: (name: string) => `source:${name}`,
};

/**
 * 缓存装饰器：获取数据时优先从缓存读取，未命中则回源
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  await cache.set(key, data, ttlSeconds);
  return data;
}