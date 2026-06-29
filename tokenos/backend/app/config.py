"""TokenOS backend configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./tokenos.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    embedding_dim: int = 384
    skill_promotion_threshold: int = 80
    default_monthly_cost_before: float = 50.0
    default_monthly_cost_after: float = 18.0
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
