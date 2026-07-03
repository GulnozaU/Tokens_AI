"""Pydantic schemas for API request/response."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WorkflowEventCreate(BaseModel):
    task: str
    files_changed: list[str] = Field(default_factory=list)
    commands: list[str] = Field(default_factory=list)
    ai_steps: list[str] = Field(default_factory=list)
    result: str = ""
    success: bool = False
    tokens_used: int = 0


class WorkflowEventResponse(WorkflowEventCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class SkillCreate(BaseModel):
    name: str
    trigger_patterns: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    success_rate: float = 0.0
    avg_tokens_saved: int = 0


class SkillResponse(BaseModel):
    id: int
    name: str
    trigger_patterns: list[str]
    steps: list[str]
    success_rate: float
    avg_tokens_saved: int
    confidence_score: int
    promoted: bool
    usage_count: int
    total_tokens_saved: int
    similarity: Optional[float] = None

    class Config:
        from_attributes = True


class SkillSearchRequest(BaseModel):
    query: str
    limit: int = 5
    min_similarity: float = 0.3


class SkillEvaluateRequest(BaseModel):
    skill_id: int
    success: bool = True
    execution_time_ms: int = 0
    tokens_used: int = 0
    tokens_saved: int = 0
    notes: str = ""


class OptimizeRequest(BaseModel):
    task: str
    limit: int = 3


class OptimizeResponse(BaseModel):
    task: str
    strategy: str
    optimized_prompt: str
    reasoning: str
    estimated_full_tokens: int
    estimated_optimized_tokens: int
    tokens_saved: int
    ai_enabled: bool
    ai_powered: bool = False
    selected_skill: Optional[dict] = None
    matched_skills: list[dict] = Field(default_factory=list)


class DashboardResponse(BaseModel):
    cost_before: float
    cost_after: float
    token_reduction_pct: float
    total_skills: int
    promoted_skills: int
    total_tokens_saved: int
    skills: list[SkillResponse]
