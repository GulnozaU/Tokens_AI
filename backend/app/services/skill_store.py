"""Skill store — CRUD and vector similarity search."""

import json

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Skill, SavingsMetric
from app.services.embeddings import cosine_similarity, embed_text


def _skill_search_text(skill: Skill) -> str:
    triggers = json.loads(skill.trigger_patterns or "[]")
    steps = json.loads(skill.steps or "[]")
    return f"{skill.name} {' '.join(triggers)} {' '.join(steps)}"


def create_skill(db: Session, data: dict) -> Skill:
    search_text = f"{data['name']} {' '.join(data.get('trigger_patterns', []))} {' '.join(data.get('steps', []))}"
    embedding = embed_text(search_text)

    skill = Skill(
        name=data["name"],
        trigger_patterns=json.dumps(data.get("trigger_patterns", [])),
        steps=json.dumps(data.get("steps", [])),
        success_rate=data.get("success_rate", 0.0),
        avg_tokens_saved=data.get("avg_tokens_saved", 0),
        confidence_score=data.get("confidence_score", 0),
        promoted=data.get("promoted", False),
        embedding=json.dumps(embedding),
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def search_skills(
    db: Session,
    query: str,
    limit: int = 5,
    min_similarity: float = 0.3,
    promoted_only: bool = False,
) -> list[dict]:
    query_vec = embed_text(query)
    q = db.query(Skill)
    if promoted_only:
        q = q.filter(Skill.promoted == True)  # noqa: E712

    results = []
    for skill in q.all():
        stored = json.loads(skill.embedding or "[]")
        if not stored:
            stored = embed_text(_skill_search_text(skill))
        sim = cosine_similarity(query_vec, stored)
        if sim >= min_similarity:
            item = skill.to_dict()
            item["similarity"] = round(sim, 3)
            results.append(item)

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def get_skill(db: Session, skill_id: int) -> Skill | None:
    return db.query(Skill).filter(Skill.id == skill_id).first()


def get_all_skills(db: Session, promoted_only: bool = False) -> list[Skill]:
    q = db.query(Skill)
    if promoted_only:
        q = q.filter(Skill.promoted == True)  # noqa: E712
    return q.order_by(Skill.success_rate.desc()).all()


def get_savings_summary(db: Session) -> dict:
    skills = db.query(Skill).all()
    total_saved = sum(s.total_tokens_saved for s in skills)
    promoted = sum(1 for s in skills if s.promoted)

    metric = db.query(SavingsMetric).order_by(SavingsMetric.month.desc()).first()
    if metric:
        return {
            **metric.to_dict(),
            "total_skills": len(skills),
            "promoted_skills": promoted,
            "total_tokens_saved": total_saved or (metric.tokens_before - metric.tokens_after),
        }

    # Fallback defaults for demo
    cost_before = settings.default_monthly_cost_before
    cost_after = settings.default_monthly_cost_after
    reduction = round((1 - cost_after / cost_before) * 100, 1) if cost_before else 0

    return {
        "month": "2026-06",
        "tokens_before": 500000,
        "tokens_after": 180000,
        "cost_before": cost_before,
        "cost_after": cost_after,
        "token_reduction_pct": reduction,
        "skills_reused": sum(s.usage_count for s in skills),
        "total_skills": len(skills),
        "promoted_skills": promoted,
        "total_tokens_saved": total_saved or 320000,
    }
