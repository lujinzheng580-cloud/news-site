// AI 分类服务单元测试 (Python 微服务降级层)
import { describe, it, expect } from 'vitest';
import { callAIService } from '../../src/services/ai/classifier.service';

describe('AI Service Fallback', () => {
  it('AI 服务不可用时降级到本地分类', async () => {
    const result = await callAIService('/classify', {
      title: 'OpenAI 发布 GPT-5',
      content: '新模型在推理能力上有显著提升',
    });
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('tags');
    expect(result).toHaveProperty('confidence');
    expect(result.category).toBe('ai');
  });

  it('AI 服务不可用时降级到本地情感分析', async () => {
    const result = await callAIService('/sentiment', {
      text: '市场出现大幅增长，投资者信心恢复',
    });
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('label');
    expect(result).toHaveProperty('confidence');
    expect(result.label).toBe('positive');
  });

  it('AI 服务不可用时降级到本地摘要', async () => {
    const longText = 'A'.repeat(500);
    const result = await callAIService('/summarize', {
      text: longText,
      maxLength: 100,
    });
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('model');
    expect(result.model).toBe('fallback');
    expect(result.summary.length).toBeLessThanOrEqual(101);
  });
});