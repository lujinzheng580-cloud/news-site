// GlobalInsight 后端单元测试
import { describe, it, expect } from 'vitest';
import { truncateText, autoClassify, isAICategory, isBusinessCategory, formatDate, safeJsonParse } from '../../src/utils/helpers';

describe('数据格式化', () => {
  it('应正确截断过长标题', () => {
    const longText = '这是一个非常长的标题，用于测试截断功能是否正常工作，需要超过两百个字符才能测试截断效果。';
    const result = truncateText(longText, 20);
    expect(result.length).toBeLessThanOrEqual(23); // 20 + '…'
    expect(result).toContain('…');
  });

  it('短文本不应截断', () => {
    const shortText = '短标题';
    expect(truncateText(shortText, 200)).toBe(shortText);
  });

  it('空字符串不应截断', () => {
    expect(truncateText('', 50)).toBe('');
  });

  it('边界值：文本长度刚好等于 maxLength', () => {
    const text = '刚好二十个字符文本！';
    expect(truncateText(text, text.length)).toBe(text);
  });

  it('边界值：maxLength 为 0 应返回空', () => {
    const text = '一些文本';
    expect(truncateText(text, 0)).toBe('');
  });

  it('应正确提取文章摘要', () => {
    const text = '这是一段用于测试的文本内容。';
    expect(truncateText(text, 200)).toBe(text);
  });
});

describe('文章分类', () => {
  it('应正确识别 AI 相关文章', () => {
    expect(isAICategory('OpenAI 发布 GPT-5 模型')).toBe(true);
    expect(isAICategory('机器学习最新进展')).toBe(true);
    expect(isAICategory('今天天气很好')).toBe(false);
  });

  it('应使用 content 辅助识别 AI 分类', () => {
    expect(isAICategory('热门话题', 'deep learning 的最新突破')).toBe(true);
  });

  it('应正确识别商业相关文章', () => {
    expect(isBusinessCategory('美联储加息影响股市')).toBe(true);
    expect(isBusinessCategory('苹果公司财报发布')).toBe(true);
    expect(isBusinessCategory('如何制作蛋糕')).toBe(false);
  });

  it('应使用 content 辅助识别商业分类', () => {
    expect(isBusinessCategory('每日新闻', '营收增长超预期')).toBe(true);
  });

  it('autoClassify 应优先识别 AI 类别', () => {
    // 即使标题包含商业词，但明确是 AI 内容
    expect(autoClassify('AI 改变股市交易', '机器学习算法')).toBe('ai');
  });

  it('autoClassify 应返回正确分类', () => {
    expect(autoClassify('OpenAI 发布新模型', '详细内容')).toBe('ai');
    expect(autoClassify('股市大涨', '市场分析内容')).toBe('business');
    expect(autoClassify('普通科技新闻', '技术内容')).toBe('technology');
  });

  it('autoClassify 对于空输入应返回默认分类', () => {
    expect(autoClassify('', '')).toBe('technology');
  });
});

describe('实用工具函数', () => {
  it('formatDate 应返回有效日期格式', () => {
    const date = new Date('2026-08-09');
    expect(formatDate(date)).toContain('2026');
    expect(formatDate(date)).toContain('08-09');
  });

  it('formatDate 应处理字符串日期', () => {
    expect(formatDate('2026-08-09')).toContain('2026');
  });

  it('safeJsonParse 应正确解析合法 JSON', () => {
    const result = safeJsonParse('{"a":1}', {});
    expect(result).toEqual({ a: 1 });
  });

  it('safeJsonParse 应在解析失败时返回 fallback', () => {
    const fallback = { b: 2 };
    const result = safeJsonParse('invalid json', fallback);
    expect(result).toEqual(fallback);
  });
});