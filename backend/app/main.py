"""TokenOS Backend API — skill memory, evaluation, and savings tracking."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import dashboard, events, optimize, skills


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="TokenOS API",
    description="Skill memory system that reduces AI coding costs",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(optimize.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
def health():
    from app.services.llm import active_providers, is_ai_enabled

    return {
        "status": "ok",
        "service": "tokenos-api",
        "ai_optimization": is_ai_enabled(),
        "ai_providers": active_providers(),
    }
