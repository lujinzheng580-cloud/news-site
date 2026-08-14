# 情感分析路由
from fastapi import APIRouter, HTTPException
from app.models.schemas import SentimentRequest, SentimentResponse
from app.services.sentiment import analyze_sentiment

router = APIRouter()


@router.post("/sentiment", response_model=SentimentResponse)
async def sentiment(request: SentimentRequest):
    """
    文本情感分析
    - 基于情感词典规则
    - 生产环境可替换为 LLM / 微调模型
    """
    try:
        score, label, confidence = analyze_sentiment(request.text)
        return SentimentResponse(
            score=score,
            label=label,
            confidence=confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))