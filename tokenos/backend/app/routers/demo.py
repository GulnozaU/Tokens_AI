"""Demo mode — simulates a full developer workflow for hackathon presentations."""

import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.evaluator import evaluate_skill
from app.agents.skill_extractor import extract_skill_from_workflow
from app.database import get_db
from app.models import SavingsMetric, WorkflowEvent
from app.services.skill_store import create_skill, search_skills

router = APIRouter(prefix="/demo", tags=["demo"])

# Pre-built demo scenarios
DEMO_SCENARIOS = [
    {
        "task": "Fix authentication bug — JWT token validation failing on login",
        "files_changed": ["src/middleware/auth.ts", "src/utils/jwt.ts", ".env.example"],
        "commands": ["npm test -- --grep auth", "npm run lint"],
        "ai_steps": [
            "inspected middleware/auth.ts for token validation logic",
            "found expired JWT not being refreshed correctly",
            "updated JWT validation to check expiry and refresh token",
            "verified environment variables for JWT_SECRET",
            "ran auth test suite — all tests passed",
        ],
        "result": "Authentication fixed. Login works with valid tokens.",
        "success": True,
        "tokens_used": 4200,
        "reuse_query": "my login token expires immediately",
    },
    {
        "task": "Fix database migration failure on users table",
        "files_changed": ["migrations/003_add_users.sql", "src/models/user.py"],
        "commands": ["alembic upgrade head", "pytest tests/test_migrations.py"],
        "ai_steps": [
            "inspected failed migration 003_add_users.sql",
            "found duplicate column constraint violation",
            "added IF NOT EXISTS guard to migration",
            "re-ran alembic upgrade head successfully",
        ],
        "result": "Migration applied. Database schema up to date.",
        "success": True,
        "tokens_used": 3100,
        "reuse_query": "database migration failed with constraint error",
    },
    {
        "task": "Debug API 500 error on /api/users endpoint",
        "files_changed": ["src/routes/users.py", "src/handlers/user_handler.py"],
        "commands": ["curl -X GET localhost:8000/api/users", "pytest tests/test_api.py"],
        "ai_steps": [
            "reproduced 500 error with curl request",
            "traced stack trace to missing null check in user_handler",
            "added null guard for optional email field",
            "verified endpoint returns 200 with valid JSON",
        ],
        "result": "API endpoint fixed. Returns proper user list.",
        "success": True,
        "tokens_used": 2800,
        "reuse_query": "API endpoint returning 500 internal server error",
    },
]


def _seed_demo_skills(db: Session) -> None:
    """Seed dashboard with demo skills if database is empty."""
    from app.models import Skill

    if db.query(Skill).count() > 0:
        return

    seed_skills = [
        {
            "name": "JWT Authentication Debugger",
            "trigger_patterns": ["auth error", "jwt", "login issue", "token expired"],
            "steps": ["inspect middleware", "check token expiry", "verify environment variables"],
            "success_rate": 0.94,
            "avg_tokens_saved": 65,
            "confidence_score": 92,
            "promoted": True,
        },
        {
            "name": "Database Migration Fixer",
            "trigger_patterns": ["migration failed", "alembic", "constraint error", "schema"],
            "steps": ["inspect migration file", "fix constraint issue", "run alembic upgrade"],
            "success_rate": 0.87,
            "avg_tokens_saved": 58,
            "confidence_score": 85,
            "promoted": True,
        },
        {
            "name": "API Debugger",
            "trigger_patterns": ["500 error", "api endpoint", "rest error", "handler crash"],
            "steps": ["reproduce error", "trace stack trace", "add null guards", "verify response"],
            "success_rate": 0.91,
            "avg_tokens_saved": 72,
            "confidence_score": 88,
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


@router.post("/simulate")
def simulate_workflow(scenario_index: int = 0, db: Session = Depends(get_db)):
    """
    Simulate a complete developer workflow:
    1. Record workflow events
    2. Extract skill via Skill Extraction Agent
    3. Evaluate and promote skill
    4. Demonstrate future reuse via similarity search
    """
    _seed_demo_skills(db)

    scenario = DEMO_SCENARIOS[scenario_index % len(DEMO_SCENARIOS)]

    # Step 1: Record workflow event
    event = WorkflowEvent(
        task=scenario["task"],
        files_changed=json.dumps(scenario["files_changed"]),
        commands=json.dumps(scenario["commands"]),
        ai_steps=json.dumps(scenario["ai_steps"]),
        result=scenario["result"],
        success=scenario["success"],
        tokens_used=scenario["tokens_used"],
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Step 2: Extract skill
    skill_data = extract_skill_from_workflow(event.to_dict())
    skill = create_skill(db, skill_data)

    # Step 3: Evaluate skill
    eval_result = evaluate_skill(
        db,
        skill_id=skill.id,
        success=True,
        execution_time_ms=2300,
        tokens_used=150,
        tokens_saved=skill_data["avg_tokens_saved"],
        notes="Demo simulation — skill extracted and evaluated",
    )

    # Step 4: Future reuse demonstration
    reuse_matches = search_skills(db, scenario["reuse_query"], limit=3)

    return {
        "phase": "complete",
        "workflow_event": event.to_dict(),
        "extracted_skill": skill.to_dict(),
        "evaluation": eval_result,
        "future_reuse": {
            "query": scenario["reuse_query"],
            "matched_skills": reuse_matches,
            "message": f"Next time you ask '{scenario['reuse_query']}', TokenOS will reuse this workflow and save ~{skill_data['avg_tokens_saved']} tokens.",
        },
    }


@router.get("/scenarios")
def list_scenarios():
    return [
        {"index": i, "task": s["task"], "reuse_query": s["reuse_query"]}
        for i, s in enumerate(DEMO_SCENARIOS)
    ]
