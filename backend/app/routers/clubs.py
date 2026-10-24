from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import ClubContext, get_club_context, get_current_user
from ..db import get_session
from ..models import Activity, Event, Task, User
from ..services import board, club_out, task_out, user_brief, users_by_id
from .auth import my_clubs

router = APIRouter(prefix="/api/clubs", tags=["clubs & members"])


@router.get("", summary="Clubs I'm on (for the club switcher)")
def list_my_clubs(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return my_clubs(session, user)


@router.get("/{club_id}", summary="Club profile + my position in it")
def get_club(ctx: ClubContext = Depends(get_club_context)):
    return {**club_out(ctx.club), "my_position": ctx.membership.position,
            "can_manage_finance": ctx.can_manage_finance}


def member_rows(session: Session, club_id: int) -> list[dict]:
    tasks = session.exec(select(Task).where(Task.club_id == club_id)).all()
    total = Counter(t.assignee_id for t in tasks)
    done = Counter(t.assignee_id for t in tasks if t.status == "Completed")
    return [
        {
            **user_brief(u),
            "position": m.position,
            "responsibilities": m.responsibilities,
            "major": u.major,
            "class_year": u.class_year,
            "task_count": total.get(u.id, 0),
            "tasks_completed": done.get(u.id, 0),
            "open_tasks": total.get(u.id, 0) - done.get(u.id, 0),
        }
        for u, m in board(session, club_id)
    ]


@router.get("/{club_id}/members", summary="Executive board with task counts")
def list_members(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return member_rows(session, ctx.club.id)


@router.get("/{club_id}/members/{user_id}", summary="One board member + their tasks")
def get_member(user_id: int, ctx: ClubContext = Depends(get_club_context),
               session: Session = Depends(get_session)):
    member = next((m for m in member_rows(session, ctx.club.id) if m["id"] == user_id), None)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this club")
    users = users_by_id(session, ctx.club.id)
    events = {e.id: e for e in session.exec(select(Event).where(Event.club_id == ctx.club.id)).all()}
    tasks = session.exec(select(Task).where(Task.club_id == ctx.club.id, Task.assignee_id == user_id)
                         .order_by(Task.due_date)).all()
    return {**member, "tasks": [task_out(t, users, events) for t in tasks]}


@router.get("/{club_id}/activity", summary="Recent activity feed", tags=["dashboard"])
def activity(limit: int = 20, ctx: ClubContext = Depends(get_club_context),
             session: Session = Depends(get_session)):
    users = users_by_id(session, ctx.club.id)
    rows = session.exec(select(Activity).where(Activity.club_id == ctx.club.id)
                        .order_by(Activity.created_at.desc(), Activity.id.desc()).limit(limit)).all()
    return [{**a.model_dump(), "actor": user_brief(users.get(a.actor_id))} for a in rows]
