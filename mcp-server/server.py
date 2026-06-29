#!/usr/bin/env python3
"""
TokenOS MCP Server — exposes skill memory tools to AI coding agents.

Tools:
  - search_skills: Find relevant skills by semantic similarity
  - retrieve_skill: Get full skill details by ID
  - create_skill: Create a new skill from workflow data
  - evaluate_skill: Score and promote a skill
  - get_savings: Return token/cost savings dashboard data

The VS Code extension and other MCP clients connect via stdio transport.
"""

import json
import os
import sys

import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = os.getenv("TOKENOS_API_URL", "http://localhost:8000/api")

mcp = FastMCP("tokenos")


def _api(method: str, path: str, **kwargs) -> dict:
    url = f"{API_BASE}{path}"
    with httpx.Client(timeout=30.0) as client:
        resp = client.request(method, url, **kwargs)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
def search_skills(query: str, limit: int = 5) -> str:
    """
    Search for reusable skills matching a developer task or error message.
    Uses embedding similarity to find the best workflow to reuse.

    Args:
        query: Natural language description of the current task
        limit: Maximum number of skills to return
    """
    result = _api("POST", "/skills/search", json={"query": query, "limit": limit})
    matches = result.get("results", [])
    if not matches:
        return json.dumps({"message": "No matching skills found. Full LLM workflow required.", "results": []})

    best = matches[0]
    return json.dumps({
        "message": f"Found {len(matches)} skill(s). Best match: '{best['name']}' ({best.get('similarity', 0):.0%} similarity)",
        "reuse_recommendation": best["name"],
        "steps": best.get("steps", []),
        "estimated_tokens_saved": best.get("avg_tokens_saved", 0),
        "results": matches,
    }, indent=2)


@mcp.tool()
def retrieve_skill(skill_id: int) -> str:
    """
    Retrieve full details of a skill by its ID.

    Args:
        skill_id: The numeric ID of the skill to retrieve
    """
    result = _api("GET", f"/skills/{skill_id}")
    return json.dumps(result, indent=2)


@mcp.tool()
def create_skill(
    name: str,
    trigger_patterns: list[str],
    steps: list[str],
    success_rate: float = 0.0,
    avg_tokens_saved: int = 0,
) -> str:
    """
    Create a new reusable skill in the TokenOS memory system.
    Secrets are automatically redacted by the Security Agent.

    Args:
        name: Human-readable skill name
        trigger_patterns: Phrases that should trigger this skill
        steps: Ordered list of workflow steps
        success_rate: Historical success rate (0.0-1.0)
        avg_tokens_saved: Average tokens saved when reusing this skill
    """
    payload = {
        "name": name,
        "trigger_patterns": trigger_patterns,
        "steps": steps,
        "success_rate": success_rate,
        "avg_tokens_saved": avg_tokens_saved,
    }
    result = _api("POST", "/skills", json=payload)
    return json.dumps({"message": f"Skill '{name}' created", "skill": result}, indent=2)


@mcp.tool()
def evaluate_skill(
    skill_id: int,
    success: bool = True,
    execution_time_ms: int = 0,
    tokens_used: int = 0,
    tokens_saved: int = 0,
    notes: str = "",
) -> str:
    """
    Evaluate a skill execution and update its confidence score.
    Skills scoring >= 80 are promoted to the reusable library.

    Args:
        skill_id: ID of the skill to evaluate
        success: Whether the skill execution succeeded
        execution_time_ms: How long the execution took
        tokens_used: Tokens consumed during execution
        tokens_saved: Tokens saved vs full LLM workflow
        notes: Optional evaluation notes
    """
    payload = {
        "skill_id": skill_id,
        "success": success,
        "execution_time_ms": execution_time_ms,
        "tokens_used": tokens_used,
        "tokens_saved": tokens_saved,
        "notes": notes,
    }
    result = _api("POST", "/skills/evaluate", json=payload)
    promoted = result.get("promoted", False)
    score = result.get("confidence_score", 0)
    msg = f"Skill evaluated. Confidence: {score}/100."
    if promoted:
        msg += " PROMOTED to reusable library!"
    return json.dumps({"message": msg, **result}, indent=2)


@mcp.tool()
def get_savings() -> str:
    """
    Get token and cost savings summary from the TokenOS dashboard.
    Shows before/after costs, token reduction percentage, and skill stats.
    """
    savings = _api("GET", "/dashboard/savings")
    dashboard = _api("GET", "/dashboard")
    return json.dumps({
        "cost_before_monthly": f"${savings.get('cost_before', 0):.2f}",
        "cost_after_monthly": f"${savings.get('cost_after', 0):.2f}",
        "token_reduction": f"{savings.get('token_reduction_pct', 0):.1f}%",
        "total_tokens_saved": savings.get("total_tokens_saved", 0),
        "skills_learned": dashboard.get("total_skills", 0),
        "promoted_skills": dashboard.get("promoted_skills", 0),
        "top_skills": [
            {"name": s["name"], "success_rate": f"{s['success_rate']*100:.0f}%"}
            for s in dashboard.get("skills", [])[:5]
        ],
    }, indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
