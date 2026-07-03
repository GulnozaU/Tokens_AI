"""Skill Extraction Agent — analyzes successful workflows and produces reusable skills.

Uses Gemini when GOOGLE_API_KEY is set; falls back to heuristics otherwise.
"""

import json
import re
from typing import Any

from app.agents.security_agent import sanitize_workflow
from app.services.llm import estimate_tokens, generate_json, is_ai_enabled

# Heuristic fallback mappings
_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "auth": ["auth", "jwt", "login", "token", "session", "oauth", "password"],
    "database": ["migration", "database", "sql", "postgres", "sqlite", "schema", "query"],
    "api": ["api", "endpoint", "rest", "graphql", "route", "handler", "request"],
    "test": ["test", "spec", "jest", "pytest", "unittest", "coverage"],
    "deploy": ["deploy", "docker", "ci", "cd", "kubernetes", "build"],
    "debug": ["bug", "fix", "error", "debug", "crash", "exception", "issue"],
}

_EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "Concise skill name"},
        "trigger_patterns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Phrases/errors that should trigger this skill",
        },
        "steps": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Ordered reusable workflow steps",
        },
        "estimated_tokens_saved": {
            "type": "integer",
            "description": "Tokens saved vs re-discovering this workflow from scratch",
        },
    },
    "required": ["name", "trigger_patterns", "steps", "estimated_tokens_saved"],
}


def _detect_domain(text: str) -> str:
    text_lower = text.lower()
    scores = {
        domain: sum(1 for kw in keywords if kw in text_lower)
        for domain, keywords in _DOMAIN_KEYWORDS.items()
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "general"


def _generate_skill_name(task: str, domain: str) -> str:
    names = {
        "auth": "JWT Authentication Debugger",
        "database": "Database Migration Fixer",
        "api": "API Debugger",
        "test": "Test Suite Runner",
        "deploy": "Deployment Pipeline Fixer",
        "debug": "Bug Fix Workflow",
        "general": "Developer Workflow",
    }
    base = names.get(domain, "Developer Workflow")
    task_clean = re.sub(r"[^\w\s]", "", task).strip()
    if len(task_clean) < 40:
        return f"{base} — {task_clean.title()}" if task_clean else base
    return base


def _extract_trigger_patterns(task: str, ai_steps: list[str], files: list[str]) -> list[str]:
    patterns: list[str] = []
    text = f"{task} {' '.join(ai_steps)} {' '.join(files)}".lower()

    for _domain, keywords in _DOMAIN_KEYWORDS.items():
        for kw in keywords:
            if kw in text and kw not in patterns:
                patterns.append(kw)

    words = re.findall(r"\w+", task.lower())
    for i in range(len(words) - 1):
        phrase = f"{words[i]} {words[i+1]}"
        if len(phrase) > 5 and phrase not in patterns:
            patterns.append(phrase)

    return patterns[:8] or [task.lower()[:50]]


def _extract_steps(
    ai_steps: list[str], commands: list[str], files: list[str]
) -> list[str]:
    steps: list[str] = []

    for step in ai_steps:
        if step and step not in steps:
            steps.append(step)

    for cmd in commands:
        label = f"run `{cmd}`" if not cmd.startswith("run ") else cmd
        if label not in steps:
            steps.append(label)

    for f in files:
        label = f"inspect/modify `{f}`"
        if label not in steps:
            steps.append(label)

    if not steps:
        steps = ["analyze the issue", "apply targeted fix", "verify with tests"]

    return steps[:10]


def _estimate_tokens_saved(steps: list[str], commands: list[str]) -> int:
    base = 40
    base += len(steps) * 12
    base += len(commands) * 8
    return min(base, 200)


def _heuristic_extract(clean: dict[str, Any]) -> dict[str, Any]:
    task = clean.get("task", "")
    ai_steps = clean.get("ai_steps", [])
    commands = clean.get("commands", [])
    files = clean.get("files_changed", [])
    success = clean.get("success", False)

    domain = _detect_domain(f"{task} {' '.join(ai_steps)}")
    name = _generate_skill_name(task, domain)
    triggers = _extract_trigger_patterns(task, ai_steps, files)
    steps = _extract_steps(ai_steps, commands, files)
    tokens_saved = _estimate_tokens_saved(steps, commands)

    return {
        "name": name,
        "trigger_patterns": triggers,
        "steps": steps,
        "success_rate": 0.94 if success else 0.5,
        "avg_tokens_saved": tokens_saved,
        "source_event": {"task": task, "success": success},
        "ai_powered": False,
    }


def _ai_extract(clean: dict[str, Any]) -> dict[str, Any] | None:
    task = clean.get("task", "")
    ai_steps = clean.get("ai_steps", [])
    commands = clean.get("commands", [])
    files = clean.get("files_changed", [])
    success = clean.get("success", False)
    tokens_used = clean.get("tokens_used", 0)
    result = clean.get("result", "")

    prompt = f"""Extract a reusable developer skill from this completed workflow.

Task: {task}
Success: {success}
Result: {result}
Tokens used in original workflow: {tokens_used}
AI steps taken:
{json.dumps(ai_steps, indent=2)}
Commands run:
{json.dumps(commands, indent=2)}
Files changed:
{json.dumps(files, indent=2)}

Produce a skill that future agents can reuse when similar issues appear.
- name: specific and actionable (e.g. "Fix JWT expiry on login")
- trigger_patterns: 4-8 short phrases developers might type or errors they see
- steps: 3-8 ordered, imperative steps (what to do, not what was thought)
- estimated_tokens_saved: realistic savings vs re-running full discovery (typically 500-4000)"""

    extracted = generate_json(prompt, _EXTRACT_SCHEMA)
    if not extracted:
        return None

    provider = extracted.pop("_provider", "ai")
    tokens_saved = int(extracted.get("estimated_tokens_saved", 0))
    if tokens_used and tokens_saved > tokens_used:
        tokens_saved = int(tokens_used * 0.75)

    return {
        "name": extracted["name"],
        "trigger_patterns": extracted["trigger_patterns"][:8],
        "steps": extracted["steps"][:10],
        "success_rate": 0.94 if success else 0.5,
        "avg_tokens_saved": tokens_saved,
        "source_event": {"task": task, "success": success},
        "ai_powered": True,
        "ai_provider": provider,
    }


def extract_skill_from_workflow(event: dict[str, Any]) -> dict[str, Any]:
    """Main extraction entry point."""
    clean = sanitize_workflow(event)

    if is_ai_enabled():
        ai_result = _ai_extract(clean)
        if ai_result:
            return ai_result

    return _heuristic_extract(clean)
