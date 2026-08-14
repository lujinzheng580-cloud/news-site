// 通用工具函数

/**
 * 截断字符串到指定长度，保留完整单词
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '…' : truncated + '…';
}

/**
 * 格式化日期为 ISO 短格式
 */
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString();
}

/**
 * 判断文章是否属于 AI 类别
 */
export function isAICategory(title: string, content?: string): boolean {
  const aiKeywords = [
    'ai', 'artificial intelligence', 'machine learning', 'deep learning',
    'gpt', 'llm', 'neural network', 'openai', 'anthropic', 'llama',
    'chatgpt', 'gemini', 'claude', 'copilot', 'transformer',
    '大模型', '人工智能', '机器学习', '深度学习',
  ];
  const text = `${title} ${content || ''}`.toLowerCase();
  return aiKeywords.some((kw) => text.includes(kw));
}

/**
 * 判断文章是否属于商业类别
 */
export function isBusinessCategory(title: string, content?: string): boolean {
  const businessKeywords = [
    'market', 'stock', 'economy', 'trade', 'merger', 'acquisition',
    'ipo', 'revenue', 'profit', 'earnings', 'ceo', 'startup',
    'venture capital', 'funding', 'investor', 'federal reserve',
    '央行', '股市', '经济', '贸易', '并购', '上市',
    '财报', '营收', '利润', '业绩', '市值', '股价', '融资', '投资', '收购',
  ];
  const text = `${title} ${content || ''}`.toLowerCase();
  return businessKeywords.some((kw) => text.includes(kw));
}

/**
 * 自动分类文章
 */
export function autoClassify(title: string, content?: string): string {
  if (isAICategory(title, content)) return 'ai';
  if (isBusinessCategory(title, content)) return 'business';
  return 'technology';
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}