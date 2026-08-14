# AI 微服务配置
import os
from dotenv import load_dotenv

load_dotenv()

# 服务配置
HOST = os.getenv("AI_HOST", "0.0.0.0")
PORT = int(os.getenv("AI_PORT", "8000"))
DEBUG = os.getenv("AI_DEBUG", "false").lower() == "true"

# OpenAI API（可选，用于真实 AI 推理）
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

# 环境
ENV = os.getenv("NODE_ENV", "development")