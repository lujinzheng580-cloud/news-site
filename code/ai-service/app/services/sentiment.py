# 情感分析服务
from typing import Tuple

# 正面词汇
POSITIVE_WORDS = [
    "增长", "突破", "创新", "成功", "盈利", "上涨", "利好", "突破",
    "上升", "繁荣", "进步", "领先", "升级", "增益", "提升",
    "growth", "breakthrough", "innovation", "success", "profit",
    "surge", "gain", "rally", "record", "boom", "recovery",
    "upgrade", "breakthrough", "milestone", "achievement",
]

# 负面词汇
NEGATIVE_WORDS = [
    "下跌", "亏损", "危机", "裁员", "失败", "风险", "衰退", "暴跌",
    "下滑", "破产", "违约", "制裁", "冲突", "暴跌", "崩盘",
    "decline", "loss", "crisis", "layoff", "failure", "risk",
    "recession", "plunge", "crash", "bankruptcy", "default",
    "sanction", "conflict", "downturn", "slump", "drop",
]


def analyze_sentiment(text: str) -> Tuple[float, str, float]:
    """
    基于词典的情感分析
    返回: (score, label, confidence)
    """
    if not text:
        return 0.0, "neutral", 0.5

    text_lower = text.lower()

    # 计算正面和负面词汇出现次数
    pos_count = sum(1 for word in POSITIVE_WORDS if word in text_lower)
    neg_count = sum(1 for word in NEGATIVE_WORDS if word in text_lower)

    total = pos_count + neg_count
    if total == 0:
        return 0.0, "neutral", 0.5

    # 计算情感分数 (-1 ~ 1)
    score = (pos_count - neg_count) / (pos_count + neg_count)
    score = max(-1.0, min(1.0, score))

    # 确定情感标签
    if score > 0.15:
        label = "positive"
    elif score < -0.15:
        label = "negative"
    else:
        label = "neutral"

    # 置信度：基于词汇数量
    confidence = min(0.5 + total * 0.1, 0.95)

    return score, label, confidence