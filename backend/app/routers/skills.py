"""Skill API routes — search, retrieve, create, evaluate."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.evaluator import evaluate_skill
from app.agents.skill_extractor import extract_skill_from_workflow
from app.database import get_db
from app.schemas import (
    SkillCreate,
    SkillEvaluateRequest,
    SkillResponse,
    SkillSearchRequest,
)
from app.services.skill_store import create_skill, get_skill, search_skills

router = APIRouter(prefix="/skills", tags=["skills"])


@router.post("", response_model=SkillResponse)
def create_skill_endpoint(payload: SkillCreate, db: Session = Depends(get_db)):
    skill = create_skill(db, payload.model_dump())
    return skill.to_dict()


@router.post("/search")
def search_skills_endpoint(payload: SkillSearchRequest, db: Session = Depends(get_db)):
    results = search_skills(
        db, payload.query, payload.limit, payload.min_similarity
    )
    return {"query": payload.query, "results": results}


@router.get("/{skill_id}")
def retrieve_skill(skill_id: int, db: Session = Depends(get_db)):
    skill = get_skill(db, skill_id)
    if not skill:
        return {"error": "Skill not found"}
    return {"skill": skill.to_dict()}


@router.post("/evaluate")
def evaluate_skill_endpoint(payload: SkillEvaluateRequest, db: Session = Depends(get_db)):
    return evaluate_skill(
        db,
        skill_id=payload.skill_id,
        success=payload.success,
        execution_time_ms=payload.execution_time_ms,
        tokens_used=payload.tokens_used,
        tokens_saved=payload.tokens_saved,
        notes=payload.notes,
    )


@router.post("/extract-from-workflow")
def extract_from_workflow(workflow: dict, db: Session = Depends(get_db)):
    skill_data = extract_skill_from_workflow(workflow)
    skill = create_skill(db, skill_data)
    return {"skill": skill.to_dict()}
