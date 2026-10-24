"""ClubOS API entry point."""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from . import ai
from .auth import get_current_user
from .config import FRONTEND_ORIGINS
from .db import engine, init_db
from .models import User
from .routers import (
    agent, approvals, auth, chat, clubs, dashboard, emails, events, finance, tasks, vendors,
)
from .seed import reset_and_seed, seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        if session.exec(select(User)).first() is None:
            seed(session)
    yield


app = FastAPI(
    title="ClubOS API",
    version="0.1.0",
    description="Club management API for SBU student organizations. 25Live, SB Engaged and NXT data is simulated.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth, clubs, dashboard, events, tasks, chat, approvals, finance, vendors, emails, agent):
    app.include_router(r.router)


@app.get("/api/health", tags=["system"])
def health():
    return {"ok": True, "ai_available": ai.is_configured()}


@app.post("/api/demo/reset", tags=["system"], summary="Reset demo data")
def demo_reset(_: User = Depends(get_current_user)):
    return {"reset": True, **reset_and_seed()}
