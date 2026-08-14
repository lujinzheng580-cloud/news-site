// GlobalInsight 数据库种子数据
// 运行: npx tsx src/seed.ts

import { prisma } from './utils/prisma';
import { logger } from './utils/logger';

async function seed() {
  logger.info('开始填充种子数据...');

  // 创建数据源
  const sources = [
    { name: 'newsapi', baseUrl: 'https://newsapi.org/v2', status: 'active' },
    { name: 'hackernews', baseUrl: 'https://hacker-news.firebaseio.com/v0', status: 'active' },
    { name: 'reddit', baseUrl: 'https://www.reddit.com/r', status: 'paused' },
    { name: 'devto', baseUrl: 'https://dev.to/api', status: 'paused' },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: { name: source.name },
      update: { baseUrl: source.baseUrl, status: source.status },
      create: source,
    });
  }
  logger.info(`已创建 ${sources.length} 个数据源`);

  // 创建示例文章
  const sampleArticles = [
    {
      title: '美联储释放降息信号，全球资本重新配置',
      url: 'https://example.com/fed-signal-2026',
      source: 'newsapi',
      category: 'business',
      summary: '根据国际金融协会(IIF)最新数据，过去四周新兴市场股票和债券累计流入 312 亿美元。',
      imageUrl: 'https://picsum.photos/seed/fed/800/400',
      publishedAt: new Date(),
      tags: ['美联储', '降息', '新兴市场', '资本流动'],
      viewCount: 1280,
    },
    {
      title: 'OpenAI 估值突破 3000 亿，英伟达领投新一轮融资',
      url: 'https://example.com/openai-300b-2026',
      source: 'newsapi',
      category: 'ai',
      summary: 'OpenAI 在最新一轮融资中估值突破 3000 亿美元，英伟达作为战略投资者领投。',
      imageUrl: 'https://picsum.photos/seed/openai/800/400',
      publishedAt: new Date(),
      tags: ['OpenAI', '融资', '英伟达', 'AI'],
      viewCount: 2560,
    },
    {
      title: '拼多多 Q2 财报超预期，Temu 海外业务贡献过半',
      url: 'https://example.com/pdd-q2-2026',
      source: 'newsapi',
      category: 'business',
      summary: '拼多多发布 2026 年第二季度财报，净利润同比增长 89%，海外业务 Temu 贡献过半营收。',
      imageUrl: 'https://picsum.photos/seed/pdd/800/400',
      publishedAt: new Date(),
      tags: ['拼多多', '财报', 'Temu', '电商'],
      viewCount: 890,
    },
    {
      title: 'GPT-6 技术报告解读：多模态原生推理能力跃升',
      url: 'https://example.com/gpt6-report-2026',
      source: 'newsapi',
      category: 'ai',
      summary: 'OpenAI 首次披露 GPT-6 新架构细节，采用混合专家(MoE)与扩散模型融合设计。',
      imageUrl: 'https://picsum.photos/seed/gpt6/800/400',
      publishedAt: new Date(),
      tags: ['GPT-6', 'OpenAI', '大模型', 'MoE'],
      viewCount: 3200,
    },
    {
      title: '台积电亚利桑那 3nm 工厂投产，首批发货苹果 A18 芯片',
      url: 'https://example.com/tsmc-arizona-3nm',
      source: 'newsapi',
      category: 'technology',
      summary: '台积电位于亚利桑那州的 3nm 工厂正式投产，首批产品将用于苹果 A18 芯片。',
      imageUrl: 'https://picsum.photos/seed/tsmc/800/400',
      publishedAt: new Date(),
      tags: ['台积电', '3nm', '芯片', '苹果'],
      viewCount: 1750,
    },
  ];

  for (const article of sampleArticles) {
    await prisma.article.upsert({
      where: { url: article.url },
      update: { viewCount: article.viewCount },
      create: { ...article, tags: JSON.stringify(article.tags) },
    });
  }
  logger.info(`已创建 ${sampleArticles.length} 条示例文章`);

  // 创建示例用户
  const user = await prisma.user.upsert({
    where: { email: 'demo@globalinsight.com' },
    update: {},
    create: {
      email: 'demo@globalinsight.com',
      name: 'Demo User',
      role: 'admin',
      preferences: {
        categories: ['business', 'ai'],
        digest: 'daily',
        theme: 'light',
      },
    },
  });
  logger.info(`已创建示例用户: ${user.email}`);

  logger.info('种子数据填充完成!');
}

seed()
  .catch((e) => {
    logger.error(e, '种子数据填充失败');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });