// GlobalInsight 后端配置
// 优先级: 环境变量 > .env 文件 > 默认值

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // 服务
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',

  // 数据库
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/globalinsight',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Elasticsearch
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',

  // 外部数据源
  newsapiKey: process.env.NEWSAPI_KEY || '',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  // Tavily 搜索
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  tavilyApiUrl: process.env.TAVILY_API_URL || 'https://api.tavily.com/search',

  // 认证
  nextauthSecret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-me',
  nextauthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',

  // 采集调度
  fetchIntervalMinutes: parseInt(process.env.FETCH_INTERVAL_MINUTES || '15', 10),

  // 缓存
  cacheTTLSeconds: 300, // 5 分钟
  newsCacheTTLSeconds: 120, // 2 分钟
} as const;

export type Config = typeof config;