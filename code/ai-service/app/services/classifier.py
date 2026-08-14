# 文章分类服务
import re
from typing import List, Tuple

# AI / 机器学习相关关键词
AI_KEYWORDS = [
    "ai", "artificial intelligence", "machine learning", "deep learning",
    "neural network", "gpt", "llm", "large language model", "openai",
    "anthropic", "llama", "chatgpt", "gemini", "claude", "copilot",
    "transformer", "diffusion", "reinforcement learning", "nlp",
    "computer vision", "generative ai", "agi", "rag", "embedding",
    "大模型", "人工智能", "机器学习", "深度学习", "神经网络",
]

# 商业相关关键词
BUSINESS_KEYWORDS = [
    "market", "stock", "economy", "trade", "merger", "acquisition",
    "ipo", "revenue", "profit", "earnings", "ceo", "startup",
    "venture capital", "funding", "investor", "federal reserve",
    "inflation", "gdp", "interest rate", "tariff", "sanction",
    "央行", "股市", "经济", "贸易", "并购", "上市", "融资",
    "投资", "基金", "债券", "汇率", "通胀", "GDP",
]

# 科学相关关键词
SCIENCE_KEYWORDS = [
    "research", "study", "scientific", "biology", "physics", "chemistry",
    "medicine", "vaccine", "genome", "climate", "space", "nasa",
    "量子", "基因", "疫苗", "气候", "太空", "物理", "化学", "生物",
]


def classify_article(title: str, content: str = "") -> Tuple[str, List[str], float]:
    """
    基于关键词规则对文章进行分类
    返回: (category, tags, confidence)
    """
    text = f"{title} {content}".lower()
    tags = []

    # 检查 AI 类别
    ai_matches = sum(1 for kw in AI_KEYWORDS if kw in text)
    # 检查商业类别
    biz_matches = sum(1 for kw in BUSINESS_KEYWORDS if kw in text)
    # 检查科学类别
    sci_matches = sum(1 for kw in SCIENCE_KEYWORDS if kw in text)

    # 提取标签
    for kw in AI_KEYWORDS:
        if kw in text and len(kw) > 3:
            tags.append(kw)
    for kw in BUSINESS_KEYWORDS:
        if kw in text and len(kw) > 3:
            tags.append(kw)

    # 去重并限制标签数量
    tags = list(dict.fromkeys(tags))[:5]

    # 确定分类
    if ai_matches >= biz_matches and ai_matches >= sci_matches and ai_matches > 0:
        return "ai", tags, min(0.5 + ai_matches * 0.1, 0.95)
    elif biz_matches >= ai_matches and biz_matches >= sci_matches and biz_matches > 0:
        return "business", tags, min(0.5 + biz_matches * 0.1, 0.95)
    elif sci_matches > 0:
        return "science", tags, min(0.5 + sci_matches * 0.1, 0.9)
    else:
        return "technology", ["technology"], 0.5


def extract_tags(text: str, max_tags: int = 5) -> List[str]:
    """从文本中提取关键词标签"""
    # 简单的词频提取
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    stop_words = {
        "this", "that", "with", "from", "have", "been", "were",
        "they", "their", "will", "would", "could", "should",
        "about", "which", "after", "other", "there", "more",
        "what", "when", "where", "than", "into", "over",
    }
    word_freq = {}
    for word in words:
        if word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1

    sorted_words = sorted(word_freq.items(), key=lambda x: -x[1])
    return [word for word, _ in sorted_words[:max_tags]]