// GlobalInsight 全局类型定义

// ─── 新闻分类 ───
export type NewsCategory = 'business' | 'ai' | 'technology' | 'science' | 'general';
export const NEWS_CATEGORIES: NewsCategory[] = ['business', 'ai', 'technology', 'science', 'general'];

// ─── 数据源名称 ───
export type NewsSource =
  | 'newsapi'
  | 'hackernews'
  | 'reddit'
  | 'devto'
  | 'gdelt'
  // NewsNow 移植源
  | 'ithome'
  | 'baidu'
  | 'wallstreetcn';
export const NEWS_SOURCES: NewsSource[] = [
  'newsapi',
  'hackernews',
  'reddit',
  'devto',
  'gdelt',
  'ithome',
  'baidu',
  'wallstreetcn',
];

// ─── NewsNow 移植源注册表 ───
export const NEWSNOW_SOURCES = ['ithome', 'baidu', 'wallstreetcn'] as const;
export type NewsnowSourceId = (typeof NEWSNOW_SOURCES)[number];

// ─── 排序方式 ───
export type SortOption = 'latest' | 'popular' | 'relevance';
export const SORT_OPTIONS: SortOption[] = ['latest', 'popular', 'relevance'];

// ─── API 通用响应 ───
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ─── 新闻列表查询参数 ───
export interface NewsQueryParams {
  page?: number;
  limit?: number;
  category?: NewsCategory;
  source?: NewsSource;
  sort?: SortOption;
  tag?: string;
  startDate?: string;
  endDate?: string;
}

// ─── 搜索参数 ───
export interface SearchParams {
  q: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  language?: string;
}

// ─── SSE 事件类型 ───
export interface SSEEvent {
  type: 'news:new' | 'news:update' | 'trending:update' | 'health';
  data: unknown;
  timestamp: string;
}

// ─── WebSocket 消息 ───
export interface WSMessage {
  event: string;
  payload: Record<string, unknown>;
}

// ─── AI 服务请求/响应 ───
export interface SummarizeRequest {
  text: string;
  maxLength?: number;
}

export interface SummarizeResponse {
  summary: string;
  model: string;
}

export interface ClassifyRequest {
  title: string;
  content?: string;
}

export interface ClassifyResponse {
  category: NewsCategory;
  tags: string[];
  confidence: number;
}

export interface SentimentRequest {
  text: string;
}

export interface SentimentResponse {
  score: number; // -1 ~ 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

// ─── 采集任务 ───
export interface FetchTaskResult {
  source: NewsSource;
  status: 'success' | 'error';
  articleCount: number;
  errorMsg?: string;
  duration: number;
}

// ─── 外部数据源原始文章 ───
export interface RawArticle {
  title: string;
  url: string;
  source: string;
  sourceId?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  authorName?: string;
  publishedAt: Date;
  category?: string;
  tags?: string[];
}