"""Evaluation Agent — scores skills and tracks reuse metrics.

Every skill is evaluated on:
  - success/failure
  - execution time
  - tokens used vs saved
  - estimated money saved

Skills with confidence >= 80 are promoted to the reusable skill library.
"""

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Skill, SkillEvaluation

# Approximate cost per 1K tokens (GPT-4 class model)
COST_PER_1K_TOKENS = 0.03


def compute_confidence(
    success: bool,
    execution_time_ms: int,
    tokens_used: int,
    historical_success_rate: float,
) -> int:
    """
    Score 0-100 based on execution outcome and efficiency.
    Faster successful runs with fewer tokens score higher.
    """
    score = 50.0

    if success:
        score += 30.0
    else:
        score -= 20.0

    # Reward fast execution (< 5s = full bonus, > 30s = no bonus)
    if execution_time_ms < 5000:
        score += 10.0
    elif execution_time_ms < 15000:
        score += 5.0

    # Reward low token usage
    if tokens_used < 500:
        score += 10.0
    elif tokens_used < 2000:
        score += 5.0

    # Blend with historical success rate
    score = score * 0.7 + historical_success_rate * 100 * 0.3

    return max(0, min(100, int(score)))


def evaluate_skill(
    db: Session,
    skill_id: int,
    success: bool,
    execution_time_ms: int = 0,
    tokens_used: int = 0,
    tokens_saved: int = 0,
    notes: str = "",
) -> dict:
    """Run evaluation, update skill metrics, and promote if threshold met."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        return {"error": "Skill not found"}

    money_saved = (tokens_saved / 1000.0) * COST_PER_1K_TOKENS
    confidence = compute_confidence(
        success, execution_time_ms, tokens_used, skill.success_rate
    )

    evaluation = SkillEvaluation(
        skill_id=skill_id,
        success=success,
        execution_time_ms=execution_time_ms,
        tokens_used=tokens_used,
        tokens_saved=tokens_saved,
        money_saved=money_saved,
        confidence_score=confidence,
        notes=notes,
    )
    db.add(evaluation)

    # Update rolling skill metrics
    skill.usage_count += 1
    skill.total_tokens_saved += tokens_saved

    # Rolling success rate (exponential moving average)
    alpha = 0.3
    new_rate = 1.0 if success else 0.0
    skill.success_rate = alpha * new_rate + (1 - alpha) * skill.success_rate
    skill.confidence_score = confidence
    skill.avg_tokens_saved = skill.total_tokens_saved // max(skill.usage_count, 1)

    # Promote skills above threshold
    promoted = False
    if confidence >= settings.skill_promotion_threshold and skill.success_rate >= 0.8:
        skill.promoted = True
        promoted = True

    db.commit()
    db.refresh(skill)
    db.refresh(evaluation)

    return {
        "evaluation": evaluation.to_dict(),
        "skill": skill.to_dict(),
        "promoted": promoted,
        "confidence_score": confidence,
    }
