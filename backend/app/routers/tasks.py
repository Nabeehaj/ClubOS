from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Event, Task, User, utcnow
from ..services import is_board_member, task_out, users_by_id

router = APIRouter(prefix="/api/clubs/{club_id}/tasks", tags=["tasks"])

Status = Literal["To Do", "In Progress", "Completed"]
Priority = Literal["Low", "Medium", "High"]


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None
    status: Status = "To Do"
    priority: Priority = "Medium"
    due_date: Optional[date] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_id: Optional[int] = None
    assignee_id: Optional[int] = None
    status: Optional[Status] = None
    priority: Optional[Priority] = None
    due_date: Optional[date] = None


# ---- shared with ClubChat (message -> task) and the AI agent ----

def _check_refs(session: Session, club_id: int, event_id: Optional[int], assignee_id: Optional[int]) -> None:
    if event_id is not None:
        event = session.get(Event, event_id)
        if not event or event.club_id != club_id:
            raise HTTPException(status_code=400, detail="event_id is not an event of this club")
    if not is_board_member(session, club_id, assignee_id):
        raise HTTPException(status_code=400, detail="assignee_id is not on this club's board")


def create_task(session: Session, club_id: int, actor: Optional[User], data: TaskCreate,
                source_message_id: Optional[int] = None, via: str = "") -> Task:
    _check_refs(session, club_id, data.event_id, data.assignee_id)
    task = Task(club_id=club_id, created_by_id=actor.id if actor else None,
                source_message_id=source_message_id, **data.model_dump())
    if task.status == "Completed":
        task.completed_at = utcnow()
    session.add(task)
    session.flush()
    assignee = session.get(User, task.assignee_id) if task.assignee_id else None
    who = actor.name if actor else "ClubOS"
    text = f"{who} created task \"{task.title}\"" + (f" for {assignee.name}" if assignee else "") + via
    activity.log(session, club_id, actor.id if actor else None, text, "task", task.event_id)
    session.commit()
    session.refresh(task)
    return task


def update_task(session: Session, club_id: int, actor: Optional[User], task: Task, data: TaskUpdate,
                via: str = "") -> Task:
    changes = data.model_dump(exclude_unset=True)
    _check_refs(session, club_id, changes.get("event_id"), changes.get("assignee_id"))
    old_status, old_assignee = task.status, task.assignee_id
    for key, value in changes.items():
        setattr(task, key, value)
    if task.status == "Completed" and old_status != "Completed":
        task.completed_at = utcnow()
    elif task.status != "Completed":
        task.completed_at = None

    who = actor.name if actor else "ClubOS"
    if task.assignee_id != old_assignee and task.assignee_id:
        assignee = session.get(User, task.assignee_id)
        activity.log(session, club_id, actor and actor.id, f"{who} assigned \"{task.title}\" to {assignee.name}{via}",
                     "task", task.event_id)
    if task.status != old_status:
        verb = "completed" if task.status == "Completed" else f"moved to {task.status}:"
        activity.log(session, club_id, actor and actor.id, f"{who} {verb} \"{task.title}\"{via}", "task", task.event_id)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def get_task_or_404(session: Session, club_id: int, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if not task or task.club_id != club_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def task_json(session: Session, club_id: int, task: Task) -> dict:
    events = {task.event_id: session.get(Event, task.event_id)} if task.event_id else {}
    return task_out(task, users_by_id(session, club_id), events)


# ---- routes ----

@router.get("", summary="List tasks (filter by event, assignee, status, or just mine)")
def list_tasks(event_id: Optional[int] = None, assignee_id: Optional[int] = None,
               status: Optional[Status] = None, mine: bool = False,
               ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    q = select(Task).where(Task.club_id == ctx.club.id)
    if event_id is not None:
        q = q.where(Task.event_id == event_id)
    if mine:
        assignee_id = ctx.user.id
    if assignee_id is not None:
        q = q.where(Task.assignee_id == assignee_id)
    if status:
        q = q.where(Task.status == status)
    tasks = session.exec(q.order_by(Task.due_date, Task.id)).all()
    users = users_by_id(session, ctx.club.id)
    events = {e.id: e for e in session.exec(select(Event).where(Event.club_id == ctx.club.id)).all()}
    return [task_out(t, users, events) for t in tasks]


@router.post("", status_code=201, summary="Create a task")
def create(body: TaskCreate, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return task_json(session, ctx.club.id, create_task(session, ctx.club.id, ctx.user, body))


@router.get("/{task_id}")
def get(task_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return task_json(session, ctx.club.id, get_task_or_404(session, ctx.club.id, task_id))


@router.patch("/{task_id}", summary="Update a task (assign, change status, priority, deadline...)")
def update(task_id: int, body: TaskUpdate, ctx: ClubContext = Depends(get_club_context),
           session: Session = Depends(get_session)):
    task = get_task_or_404(session, ctx.club.id, task_id)
    return task_json(session, ctx.club.id, update_task(session, ctx.club.id, ctx.user, task, body))


@router.delete("/{task_id}", status_code=204)
def delete(task_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    task = get_task_or_404(session, ctx.club.id, task_id)
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} deleted task \"{task.title}\"", "task",
                 task.event_id)
    session.delete(task)
    session.commit()
