"""Optimization Agent — uses Gemini to compress prompts and route to reusable skills.

When a developer describes a task, this agent:
  1. Searches the skill library for matches
  2. Uses LLM reasoning to decide reuse vs full workflow
  3. Produces a token-efficient optimized prompt when a skill applies
  4. Estimates real token savings vs sending full context to an LLM
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.llm import estimate_tokens, generate_json, is_ai_enabled
from app.services.skill_store import search_skills

_OPTIMIZE_SCHEMA = {
    "type": "object",
    "properties": {
        "strategy": {
            "type": "string",
            "enum": ["reuse_skill", "partial_reuse", "full_llm"],
            "description": "Whether to reuse a skill, blend it, or require full LLM discovery",
        },
        "optimized_prompt": {
            "type": "string",
            "description": "Minimal prompt to give the coding agent — reuse skill steps when possible",
        },
        "reasoning": {
            "type": "string",
            "description": "Brief explanation of the optimization decision",
        },
        "estimated_full_tokens": {
            "type": "integer",
            "description": "Estimated tokens for a full LLM workflow without TokenOS",
        },
        "estimated_optimized_tokens": {
            "type": "integer",
            "description": "Estimated tokens with the optimized prompt / skill reuse",
        },
        "selected_skill_id": {
            "type": "integer",
            "description": "ID of the best matching skill, or 0 if none",
        },
    },
    "required": [
        "strategy",
        "optimized_prompt",
        "reasoning",
        "estimated_full_tokens",
        "estimated_optimized_tokens",
        "selected_skill_id",
    ],
}


def _heuristic_optimize(task: str, matches: list[dict]) -> dict[str, Any]:
    """Fallback when Gemini is unavailable."""
    if not matches:
        full = estimate_tokens(task) + 3500
        return {
            "strategy": "full_llm",
            "optimized_prompt": task,
            "reasoning": "No matching skills in library — full LLM discovery required.",
            "estimated_full_tokens": full,
            "estimated_optimized_tokens": full,
            "tokens_saved": 0,
            "selected_skill": None,
            "matched_skills": [],
            "ai_powered": False,
        }

    best = matches[0]
    steps = best.get("steps", [])
    step_text = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps))
    optimized = (
        f"Task: {task}\n\n"
        f"Reuse verified workflow '{best['name']}' (match {best.get('similarity', 0):.0%}):\n"
        f"{step_text}\n\n"
        f"Apply these steps directly. Do not re-discover the workflow."
    )
    full = estimate_tokens(task) + 3500
    optimized_tokens = estimate_tokens(optimized) + 400
    saved = max(0, full - optimized_tokens)

    return {
        "strategy": "reuse_skill",
        "optimized_prompt": optimized,
        "reasoning": f"Heuristic match to '{best['name']}' — reuse saved steps instead of rediscovery.",
        "estimated_full_tokens": full,
        "estimated_optimized_tokens": optimized_tokens,
        "tokens_saved": saved,
        "selected_skill": best,
        "matched_skills": matches,
        "ai_powered": False,
    }


def optimize_task(db: Session, task: str, limit: int = 3) -> dict[str, Any]:
    """
    Main optimization entry point.
    Returns an optimized prompt and token savings estimate.
    """
    matches = search_skills(db, task, limit=limit, min_similarity=0.25)

    if not is_ai_enabled():
        return _heuristic_optimize(task, matches)

    skills_context = []
    for m in matches:
        skills_context.append(
            {
                "id": m["id"],
                "name": m["name"],
                "similarity": m.get("similarity", 0),
                "steps": m.get("steps", []),
                "triggers": m.get("trigger_patterns", []),
                "avg_tokens_saved": m.get("avg_tokens_saved", 0),
                "success_rate": m.get("success_rate", 0),
            }
        )

    prompt = f"""You are TokenOS, an AI cost optimizer for coding agents.

A developer has this task:
\"\"\"{task}\"\"\"

Available reusable skills from memory (may be empty):
{skills_context if skills_context else "[]"}

Decide the cheapest effective strategy:
- reuse_skill: a skill closely matches — output a SHORT prompt that tells the agent to follow the skill steps
- partial_reuse: blend skill steps with new discovery for this specific task
- full_llm: no useful skill — developer needs full LLM workflow

For token estimates:
- full_llm baseline ≈ task description + ~3500 tokens of exploration/context
- reuse_skill ≈ optimized prompt + ~400 tokens execution overhead
- Be realistic; savings come from skipping rediscovery

optimized_prompt must be ready to paste into a coding agent (Cursor, Copilot, etc.).
selected_skill_id is 0 when strategy is full_llm."""

    result = generate_json(prompt, _OPTIMIZE_SCHEMA)
    if not result:
        return _heuristic_optimize(task, matches)

    provider = result.pop("_provider", "ai")
    full = int(result.get("estimated_full_tokens", 0))
    optimized = int(result.get("estimated_optimized_tokens", 0))
    saved = max(0, full - optimized)

    selected = None
    skill_id = int(result.get("selected_skill_id", 0))
    if skill_id:
        selected = next((m for m in matches if m["id"] == skill_id), None)
    if not selected and matches and result.get("strategy") != "full_llm":
        selected = matches[0]

    return {
        "strategy": result["strategy"],
        "optimized_prompt": result["optimized_prompt"],
        "reasoning": result["reasoning"],
        "estimated_full_tokens": full,
        "estimated_optimized_tokens": optimized,
        "tokens_saved": saved,
        "selected_skill": selected,
        "matched_skills": matches,
        "ai_powered": True,
        "ai_provider": provider,
    }
