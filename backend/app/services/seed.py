"""Seed default skills for empty databases (hosted API + local dev)."""

from sqlalchemy.orm import Session

from app.models import SavingsMetric, Skill
from app.services.skill_store import create_skill


def seed_default_skills(db: Session) -> None:
    if db.query(Skill).count() > 0:
        return

    seed_skills = [
        {
            "name": "JWT Authentication Debugger",
            "trigger_patterns": ["auth error", "jwt", "login issue", "token expired"],
            "steps": ["inspect middleware", "check token expiry", "verify environment variables"],
            "success_rate": 0.94,
            "avg_tokens_saved": 3400,
            "confidence_score": 92,
            "promoted": True,
        },
        {
            "name": "Database Migration Fixer",
            "trigger_patterns": ["migration failed", "alembic", "constraint error", "schema"],
            "steps": ["inspect migration file", "fix constraint issue", "run alembic upgrade"],
            "success_rate": 0.87,
            "avg_tokens_saved": 2800,
            "confidence_score": 85,
            "promoted": True,
        },
    ]
    for data in seed_skills:
        create_skill(db, data)

    if not db.query(SavingsMetric).first():
        db.add(
            SavingsMetric(
                month="2026-06",
                tokens_before=500000,
                tokens_after=180000,
                cost_before=50.0,
                cost_after=18.0,
                skills_reused=47,
            )
        )
        db.commit()
