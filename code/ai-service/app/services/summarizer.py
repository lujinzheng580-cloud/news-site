# 文本摘要服务
import re
from typing import List


def extract_sentences(text: str, max_length: int = 200) -> str:
    """
    基于提取的简单摘要生成
    提取前 N 个句子，确保不超过 max_length
    """
    if not text:
        return ""

    if len(text) <= max_length:
        return text

    # 按句子分割
    sentences = re.split(r'(?<=[。！？.!?])\s*', text)
    summary = ""
    for sentence in sentences:
        if len(summary) + len(sentence) <= max_length:
            summary += sentence
        else:
            break

    return summary if summary else text[:max_length] + "…"


def extractive_summarize(text: str, max_length: int = 200, num_sentences: int = 3) -> str:
    """
    基于 TF 的抽取式摘要
    选择最重要的 num_sentences 个句子
    """
    if not text:
        return ""

    if len(text) <= max_length:
        return text

    # 分割句子
    sentences = re.split(r'(?<=[。！？.!?])\s*', text)
    if len(sentences) <= num_sentences:
        return "".join(sentences)

    # 计算词频
    words = re.findall(r'\w+', text.lower())
    word_freq = {}
    for word in words:
        word_freq[word] = word_freq.get(word, 0) + 1

    # 计算句子权重
    sentence_scores = []
    for i, sentence in enumerate(sentences):
        sentence_words = re.findall(r'\w+', sentence.lower())
        if len(sentence_words) < 3:
            continue
        score = sum(word_freq.get(w, 0) for w in sentence_words) / len(sentence_words)
        # 靠前的句子加权
        score *= (1.0 + 0.1 * (len(sentences) - i) / len(sentences))
        sentence_scores.append((i, sentence, score))

    # 选择权重最高的句子
    sentence_scores.sort(key=lambda x: -x[2])
    top_sentences = sentence_scores[:num_sentences]
    top_sentences.sort(key=lambda x: x[0])  # 按原文顺序排列

    summary = "".join(s[1] for s in top_sentences)
    if len(summary) > max_length:
        summary = summary[:max_length] + "…"

    return summary