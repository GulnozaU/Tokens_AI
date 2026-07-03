"""AI optimization API — compress prompts and route to reusable skills."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.optimizer import optimize_task
from app.database import get_db
from app.schemas import OptimizeRequest, OptimizeResponse
from app.services.llm import active_providers, is_ai_enabled

router = APIRouter(prefix="/optimize", tags=["optimize"])


@router.post("", response_model=OptimizeResponse)
def optimize(payload: OptimizeRequest, db: Session = Depends(get_db)):
    """
    AI-powered task optimization.
    Searches skill memory and returns a token-efficient prompt.
    """
    result = optimize_task(db, payload.task, limit=payload.limit)
    return {
        **result,
        "task": payload.task,
        "ai_enabled": is_ai_enabled(),
        "ai_powered": result.get("ai_powered", is_ai_enabled()),
    }


@router.get("/status")
def optimization_status():
    providers = active_providers()
    return {
        "ai_enabled": is_ai_enabled(),
        "providers": providers,
        "message": (
            f"AI optimization active via {', '.join(providers)}"
            if providers
            else "Set GOOGLE_API_KEY or GROQ_API_KEY in .env.local for real AI optimization"
        ),
    }
