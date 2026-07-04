"""Vercel serverless entry — exposes the TokenOS FastAPI app."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from mangum import Mangum

from app.database import Base, SessionLocal, engine
from app.main import app
from app.routers.demo import _seed_demo_skills

# Init DB + seed demo skills on cold start (serverless has no persistent disk)
Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    _seed_demo_skills(db)
finally:
    db.close()

handler = Mangum(app, lifespan="off")
