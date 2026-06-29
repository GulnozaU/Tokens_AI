"""Dashboard and savings API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import DashboardResponse
from app.services.skill_store import get_all_skills, get_savings_summary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    savings = get_savings_summary(db)
    skills = get_all_skills(db)

    return {
        "cost_before": savings["cost_before"],
        "cost_after": savings["cost_after"],
        "token_reduction_pct": savings["token_reduction_pct"],
        "total_skills": savings["total_skills"],
        "promoted_skills": savings["promoted_skills"],
        "total_tokens_saved": savings["total_tokens_saved"],
        "skills": [s.to_dict() for s in skills],
    }


@router.get("/savings")
def get_savings(db: Session = Depends(get_db)):
    return get_savings_summary(db)
