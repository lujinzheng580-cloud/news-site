# 摘要生成路由
from fastapi import APIRouter, HTTPException
from app.models.schemas import SummarizeRequest, SummarizeResponse
from app.services.summarizer import extractive_summarize

router = APIRouter()


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """
    生成文章摘要
    - 使用抽取式摘要算法
    - 生产环境可替换为 LLM 生成式摘要
    """
    try:
        summary = extractive_summarize(
            text=request.text,
            max_length=request.max_length,
            num_sentences=3,
        )
        return SummarizeResponse(
            summary=summary,
            model="extractive-v1",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))