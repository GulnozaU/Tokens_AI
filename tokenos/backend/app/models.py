"""SQLAlchemy models for TokenOS skill memory."""

import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkflowEvent(Base):
    __tablename__ = "workflow_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task: Mapped[str] = mapped_column(String(512))
    files_changed: Mapped[str] = mapped_column(Text, default="[]")
    commands: Mapped[str] = mapped_column(Text, default="[]")
    ai_steps: Mapped[str] = mapped_column(Text, default="[]")
    result: Mapped[str] = mapped_column(Text, default="")
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task": self.task,
            "files_changed": json.loads(self.files_changed or "[]"),
            "commands": json.loads(self.commands or "[]"),
            "ai_steps": json.loads(self.ai_steps or "[]"),
            "result": self.result,
            "success": self.success,
            "tokens_used": self.tokens_used,
            "timestamp": self.timestamp.isoformat(),
        }


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), index=True)
    trigger_patterns: Mapped[str] = mapped_column(Text, default="[]")
    steps: Mapped[str] = mapped_column(Text, default="[]")
    success_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_tokens_saved: Mapped[int] = mapped_column(Integer, default=0)
    confidence_score: Mapped[int] = mapped_column(Integer, default=0)
    promoted: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding: Mapped[str] = mapped_column(Text, default="[]")
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens_saved: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "trigger_patterns": json.loads(self.trigger_patterns or "[]"),
            "steps": json.loads(self.steps or "[]"),
            "success_rate": self.success_rate,
            "avg_tokens_saved": self.avg_tokens_saved,
            "confidence_score": self.confidence_score,
            "promoted": self.promoted,
            "usage_count": self.usage_count,
            "total_tokens_saved": self.total_tokens_saved,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class SkillEvaluation(Base):
    __tablename__ = "skill_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    skill_id: Mapped[int] = mapped_column(Integer, index=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    tokens_saved: Mapped[int] = mapped_column(Integer, default=0)
    money_saved: Mapped[float] = mapped_column(Float, default=0.0)
    confidence_score: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "skill_id": self.skill_id,
            "success": self.success,
            "execution_time_ms": self.execution_time_ms,
            "tokens_used": self.tokens_used,
            "tokens_saved": self.tokens_saved,
            "money_saved": self.money_saved,
            "confidence_score": self.confidence_score,
            "notes": self.notes,
            "timestamp": self.timestamp.isoformat(),
        }


class SavingsMetric(Base):
    __tablename__ = "savings_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    month: Mapped[str] = mapped_column(String(7), index=True)
    tokens_before: Mapped[int] = mapped_column(Integer, default=0)
    tokens_after: Mapped[int] = mapped_column(Integer, default=0)
    cost_before: Mapped[float] = mapped_column(Float, default=0.0)
    cost_after: Mapped[float] = mapped_column(Float, default=0.0)
    skills_reused: Mapped[int] = mapped_column(Integer, default=0)

    def to_dict(self) -> dict:
        reduction = 0.0
        if self.tokens_before > 0:
            reduction = round((1 - self.tokens_after / self.tokens_before) * 100, 1)
        return {
            "month": self.month,
            "tokens_before": self.tokens_before,
            "tokens_after": self.tokens_after,
            "cost_before": self.cost_before,
            "cost_after": self.cost_after,
            "token_reduction_pct": reduction,
            "skills_reused": self.skills_reused,
        }
