"""Skill Extraction Agent — analyzes successful workflows and produces reusable skills.

Architecture:
  1. Receives workflow events (task, files, commands, AI steps, result)
  2. Security agent redacts any secrets
  3. Heuristic + pattern analysis extracts skill name, triggers, and steps
  4. Estimates token savings based on workflow complexity
"""

import json
import re
from typing import Any

from app.agents.security_agent import sanitize_workflow


# Domain keyword → skill category mapping for demo-quality extraction
_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "auth": ["auth", "jwt", "login", "token", "session", "oauth", "password"],
    "database": ["migration", "database", "sql", "postgres", "sqlite", "schema", "query"],
    "api": ["api", "endpoint", "rest", "graphql", "route", "handler", "request"],
    "test": ["test", "spec", "jest", "pytest", "unittest", "coverage"],
    "deploy": ["deploy", "docker", "ci", "cd", "kubernetes", "build"],
    "debug": ["bug", "fix", "error", "debug", "crash", "exception", "issue"],
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
    # Personalize if task is short enough
    task_clean = re.sub(r"[^\w\s]", "", task).strip()
    if len(task_clean) < 40:
        return f"{base} — {task_clean.title()}" if task_clean else base
    return base


def _extract_trigger_patterns(task: str, ai_steps: list[str], files: list[str]) -> list[str]:
    """Derive trigger patterns from task text and workflow context."""
    patterns: list[str] = []
    text = f"{task} {' '.join(ai_steps)} {' '.join(files)}".lower()

    for domain, keywords in _DOMAIN_KEYWORDS.items():
        for kw in keywords:
            if kw in text and kw not in patterns:
                patterns.append(kw)

    # Add task phrases (2-3 word chunks)
    words = re.findall(r"\w+", task.lower())
    for i in range(len(words) - 1):
        phrase = f"{words[i]} {words[i+1]}"
        if len(phrase) > 5 and phrase not in patterns:
            patterns.append(phrase)

    return patterns[:8] or [task.lower()[:50]]


def _extract_steps(
    ai_steps: list[str], commands: list[str], files: list[str]
) -> list[str]:
    """Combine AI steps, commands, and file changes into ordered skill steps."""
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
    """Estimate tokens saved by reusing this skill vs re-discovering workflow."""
    base = 40
    base += len(steps) * 12
    base += len(commands) * 8
    return min(base, 200)


def extract_skill_from_workflow(event: dict[str, Any]) -> dict[str, Any]:
    """
    Main extraction entry point.
    Input: workflow event dict
    Output: skill dict ready for persistence
    """
    clean = sanitize_workflow(event)
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
        "source_event": {
            "task": task,
            "success": success,
        },
    }
