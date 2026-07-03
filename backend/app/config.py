"""TokenOS backend configuration."""

from pathlib import Path

from pydantic_settings import BaseSettings

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    database_url: str = "sqlite:///./tokenos.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    embedding_dim: int = 384
    skill_promotion_threshold: int = 80
    default_monthly_cost_before: float = 50.0
    default_monthly_cost_after: float = 18.0
    cors_origins: str = "*"

    # LLM providers — set GOOGLE_API_KEY and/or GROQ_API_KEY
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    embedding_model: str = "gemini-embedding-001"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    class Config:
        env_file = (
            _BACKEND_ROOT / ".env",
            _REPO_ROOT / ".env",
            _BACKEND_ROOT / ".env.local",
            _REPO_ROOT / ".env.local",
        )
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
