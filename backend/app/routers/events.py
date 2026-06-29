"""Workflow event API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agents.skill_extractor import extract_skill_from_workflow
from app.database import get_db
from app.models import WorkflowEvent
from app.schemas import WorkflowEventCreate, WorkflowEventResponse
from app.services.skill_store import create_skill

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=WorkflowEventResponse)
def create_event(payload: WorkflowEventCreate, db: Session = Depends(get_db)):
    import json

    event = WorkflowEvent(
        task=payload.task,
        files_changed=json.dumps(payload.files_changed),
        commands=json.dumps(payload.commands),
        ai_steps=json.dumps(payload.ai_steps),
        result=payload.result,
        success=payload.success,
        tokens_used=payload.tokens_used,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event.to_dict()


@router.get("", response_model=list[WorkflowEventResponse])
def list_events(limit: int = 50, db: Session = Depends(get_db)):
    events = (
        db.query(WorkflowEvent)
        .order_by(WorkflowEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [e.to_dict() for e in events]


@router.post("/{event_id}/extract-skill")
def extract_skill(event_id: int, db: Session = Depends(get_db)):
    event = db.query(WorkflowEvent).filter(WorkflowEvent.id == event_id).first()
    if not event:
        return {"error": "Event not found"}
    skill_data = extract_skill_from_workflow(event.to_dict())
    skill = create_skill(db, skill_data)
    return {"skill": skill.to_dict(), "extracted_from": event_id}
