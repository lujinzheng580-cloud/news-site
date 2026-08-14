# 文章分类路由
from fastapi import APIRouter, HTTPException
from app.models.schemas import ClassifyRequest, ClassifyResponse
from app.services.classifier import classify_article

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
async def classify(request: ClassifyRequest):
    """
    文章自动分类
    - 基于关键词规则匹配
    - 生产环境可替换为 LLM / BERT 分类
    """
    try:
        category, tags, confidence = classify_article(
            title=request.title,
            content=request.content or "",
        )
        return ClassifyResponse(
            category=category,
            tags=tags,
            confidence=confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))