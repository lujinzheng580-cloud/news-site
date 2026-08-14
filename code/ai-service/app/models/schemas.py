# Pydantic 数据模型
from pydantic import BaseModel, Field
from typing import Optional, List


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="待摘要的文章文本")
    max_length: int = Field(default=200, ge=50, le=2000, description="摘要最大长度")


class SummarizeResponse(BaseModel):
    summary: str
    model: str = "fallback"


class ClassifyRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="文章标题")
    content: Optional[str] = Field(default="", max_length=5000, description="文章内容")


class ClassifyResponse(BaseModel):
    category: str  # business / ai / technology / science / general
    tags: List[str] = []
    confidence: float = Field(default=0.5, ge=0, le=1)


class SentimentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="待分析文本")


class SentimentResponse(BaseModel):
    score: float = Field(..., ge=-1, le=1, description="情感分数 -1~1")
    label: str  # positive / negative / neutral
    confidence: float = Field(default=0.5, ge=0, le=1)


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    timestamp: str