# GlobalInsight AI 微服务入口
# 基于 FastAPI 的 AI 辅助服务
# 提供: 文章摘要 / 分类 / 情感分析

from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import HOST, PORT, DEBUG, ENV
from app.routers import summarize, classify, sentiment
from app.models.schemas import HealthResponse

app = FastAPI(
    title="GlobalInsight AI Service",
    description="商业与AI资讯平台的AI辅助微服务，提供文章摘要、分类、情感分析等功能",
    version="1.0.0",
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if ENV == "development" else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(summarize.router, tags=["Summarize"])
app.include_router(classify.router, tags=["Classify"])
app.include_router(sentiment.router, tags=["Sentiment"])


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    """健康检查"""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/", tags=["Root"])
async def root():
    """服务根路径"""
    return {
        "service": "GlobalInsight AI Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "summarize": "/summarize (POST)",
            "classify": "/classify (POST)",
            "sentiment": "/sentiment (POST)",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="info",
    )