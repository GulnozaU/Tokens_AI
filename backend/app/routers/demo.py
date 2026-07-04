"""Demo mode — simulates a full developer workflow for hackathon presentations."""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.evaluator import evaluate_skill
from app.agents.skill_extractor import extract_skill_from_workflow
from app.database import get_db
from app.models import SavingsMetric, Skill, SkillEvaluation, WorkflowEvent
from app.services.embeddings import _hash_embed
from app.services.skill_store import create_skill, search_skills

router = APIRouter(prefix="/demo", tags=["demo"])
logger = logging.getLogger("tokenos.demo")

# Deterministic token simulation for Kaggle demo (not real provider usage)
SIMULATED_BASELINE_TOKENS = 12_000
SIMULATED_OPTIMIZED_TOKENS = 3_000
WORKFLOW_STEPS_AVOIDED = 8
AI_CALLS_REDUCED_PCT = 70

# Fixed Kaggle demo scenario — "JWT Authentication Bug Fix"
KAGGLE_DEMO_SCENARIO = {
    "name": "JWT Authentication Bug Fix",
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
    "skill_name": "JWT Auth Fix",
    "reuse_query": "JWT token expired issue",
}

# Fixed skill payload — no external AI calls during Kaggle demo
KAGGLE_SKILL_DATA = {
    "name": "JWT Auth Fix",
    "trigger_patterns": [
        "jwt",
        "token expired",
        "auth error",
        "login issue",
        "jwt token expired issue",
    ],
    "steps": [
        "inspect middleware/auth.ts for token validation logic",
        "check JWT expiry and refresh token handling",
        "update JWT validation in src/utils/jwt.ts",
        "verify JWT_SECRET in .env.example",
        "run `npm test -- --grep auth`",
        "run `npm run lint`",
    ],
    "success_rate": 0.94,
    "avg_tokens_saved": 9000,
    "confidence_score": 92,
    "promoted": True,
}

# Pre-built demo scenarios (legacy multi-scenario support)
DEMO_SCENARIOS = [
    {
        "task": KAGGLE_DEMO_SCENARIO["task"],
        "files_changed": KAGGLE_DEMO_SCENARIO["files_changed"],
        "commands": KAGGLE_DEMO_SCENARIO["commands"],
        "ai_steps": KAGGLE_DEMO_SCENARIO["ai_steps"],
        "result": KAGGLE_DEMO_SCENARIO["result"],
        "success": KAGGLE_DEMO_SCENARIO["success"],
        "tokens_used": KAGGLE_DEMO_SCENARIO["tokens_used"],
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


def _log_demo_event(event: str, details: dict | None = None) -> None:
    """Internal demo logging — not surfaced in UI."""
    payload = {"event": event, "timestamp": datetime.now(timezone.utc).isoformat()}
    if details:
        payload.update(details)
    logger.info("demo_event %s", json.dumps(payload))


def _clear_demo_tables(db: Session) -> None:
    """Clear all demo-related tables for a clean recording."""
    db.query(SkillEvaluation).delete()
    db.query(Skill).delete()
    db.query(WorkflowEvent).delete()
    db.query(SavingsMetric).delete()
    db.commit()


def _compute_token_savings() -> dict:
    saved = SIMULATED_BASELINE_TOKENS - SIMULATED_OPTIMIZED_TOKENS
    reduction_pct = round((saved / SIMULATED_BASELINE_TOKENS) * 100)
    return {
        "simulated": True,
        "label": "Simulated for demo",
        "baseline_tokens": SIMULATED_BASELINE_TOKENS,
        "optimized_tokens": SIMULATED_OPTIMIZED_TOKENS,
        "tokens_saved": saved,
        "reduction_percent": reduction_pct,
        "workflow_steps_avoided": WORKFLOW_STEPS_AVOIDED,
        "ai_calls_reduced_percent": AI_CALLS_REDUCED_PCT,
    }


def _seed_demo_skills(db: Session) -> None:
    """Seed dashboard with demo skills if database is empty."""
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


def _create_kaggle_skill(db: Session, data: dict) -> Skill:
    """Create skill using hash embeddings only — no external API calls."""
    search_text = (
        f"{data['name']} {' '.join(data.get('trigger_patterns', []))} "
        f"{' '.join(data.get('steps', []))}"
    )
    skill = Skill(
        name=data["name"],
        trigger_patterns=json.dumps(data.get("trigger_patterns", [])),
        steps=json.dumps(data.get("steps", [])),
        success_rate=data.get("success_rate", 0.0),
        avg_tokens_saved=data.get("avg_tokens_saved", 0),
        confidence_score=data.get("confidence_score", 0),
        promoted=data.get("promoted", False),
        embedding=json.dumps(_hash_embed(search_text)),
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def _demo_reuse_search(db: Session, skill_id: int, query: str) -> list[dict]:
    """Deterministic similarity match for Kaggle demo — no API calls."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        return []
    item = skill.to_dict()
    query_lower = query.lower()
    triggers = json.loads(skill.trigger_patterns or "[]")
    matches = sum(1 for t in triggers if t.lower() in query_lower or query_lower in t.lower())
    item["similarity"] = round(0.85 + min(matches * 0.03, 0.14), 3)
    return [item]


def _run_jwt_workflow(db: Session) -> dict:
    """Execute the JWT demo workflow: record → extract → evaluate → reuse."""
    scenario = KAGGLE_DEMO_SCENARIO

    _log_demo_event("session_start", {"scenario": scenario["name"]})

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

    _log_demo_event("workflow_recorded", {
        "event_id": event.id,
        "files_modified": scenario["files_changed"],
        "actions": scenario["ai_steps"],
        "prompts_used": len(scenario["ai_steps"]),
    })

    skill_data = dict(KAGGLE_SKILL_DATA)
    skill = _create_kaggle_skill(db, skill_data)
    _log_demo_event("skill_created", {
        "skill_id": skill.id,
        "skill_name": skill.name,
        "confidence_score": skill.confidence_score,
        "steps": skill_data.get("steps", []),
    })

    eval_result = evaluate_skill(
        db,
        skill_id=skill.id,
        success=True,
        execution_time_ms=2300,
        tokens_used=150,
        tokens_saved=skill_data["avg_tokens_saved"],
        notes="Kaggle demo — skill extracted and evaluated",
    )

    reuse_matches = _demo_reuse_search(db, skill.id, scenario["reuse_query"])
    skill_reused = len(reuse_matches) > 0 and reuse_matches[0].get("similarity", 0) >= 0.3
    top_match = reuse_matches[0] if reuse_matches else None

    _log_demo_event("skill_reuse", {
        "query": scenario["reuse_query"],
        "skill_reused": skill_reused,
        "matched_skill": top_match.get("name") if top_match else None,
        "similarity": top_match.get("similarity") if top_match else None,
    })

    _log_demo_event("session_end", {"skill_id": skill.id})

    return {
        "workflow_event": event.to_dict(),
        "extracted_skill": skill.to_dict(),
        "evaluation": eval_result,
        "future_reuse": {
            "query": scenario["reuse_query"],
            "matched_skills": reuse_matches,
            "skill_reused": skill_reused,
            "message": (
                f"Detected similarity to '{skill.name}' — "
                f"reusing workflow instead of full regeneration."
            ),
        },
    }


@router.post("/reset")
def reset_demo_state(db: Session = Depends(get_db)):
    """Clear skills, sessions, and metrics for a clean demo recording."""
    _log_demo_event("demo_reset_start")
    _clear_demo_tables(db)
    _log_demo_event("demo_reset_complete")
    return {"status": "reset", "message": "Demo state cleared — skills, sessions, and metrics reset"}


@router.post("/run-kaggle")
def run_kaggle_demo(db: Session = Depends(get_db)):
    """
    Deterministic Kaggle demo — one-shot full pipeline:
    1. Reset state
    2. Simulate JWT auth bug fix session
    3. Extract skill
    4. Demonstrate skill reuse via similarity search
    5. Return simulated token comparison
    """
    _log_demo_event("kaggle_demo_start")

    _clear_demo_tables(db)

    workflow_result = _run_jwt_workflow(db)
    token_comparison = _compute_token_savings()

    results = {
        "phase": "complete",
        "scenario": KAGGLE_DEMO_SCENARIO["name"],
        "simulated": True,
        "token_comparison": token_comparison,
        "skill_created": KAGGLE_DEMO_SCENARIO["skill_name"],
        "skill_reused": workflow_result["future_reuse"]["skill_reused"],
        **workflow_result,
    }

    _log_demo_event("kaggle_demo_complete", {
        "tokens_saved": token_comparison["tokens_saved"],
        "reduction_percent": token_comparison["reduction_percent"],
    })

    return results


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

    skill_data = extract_skill_from_workflow(event.to_dict())
    skill = create_skill(db, skill_data)

    eval_result = evaluate_skill(
        db,
        skill_id=skill.id,
        success=True,
        execution_time_ms=2300,
        tokens_used=150,
        tokens_saved=skill_data["avg_tokens_saved"],
        notes="Demo simulation — skill extracted and evaluated",
    )

    reuse_matches = search_skills(db, scenario["reuse_query"], limit=3)

    return {
        "phase": "complete",
        "workflow_event": event.to_dict(),
        "extracted_skill": skill.to_dict(),
        "evaluation": eval_result,
        "future_reuse": {
            "query": scenario["reuse_query"],
            "matched_skills": reuse_matches,
            "message": (
                f"Next time you ask '{scenario['reuse_query']}', TokenOS will reuse "
                f"this workflow and save ~{skill_data['avg_tokens_saved']} tokens."
            ),
        },
    }


@router.get("/scenarios")
def list_scenarios():
    return [
        {"index": i, "task": s["task"], "reuse_query": s["reuse_query"]}
        for i, s in enumerate(DEMO_SCENARIOS)
    ]
