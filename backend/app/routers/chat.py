"""ClubChat. The frontend polls GET .../messages?after_id=<last id it has> every few seconds."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, func, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Channel, Message, User
from ..services import message_out, users_by_id
from .tasks import Priority, TaskCreate, create_task, task_json

router = APIRouter(prefix="/api/clubs/{club_id}", tags=["clubchat"])


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageToTask(BaseModel):
    """Everything is optional: by default the message text becomes the title and its author the assignee."""
    title: Optional[str] = Field(default=None, max_length=200)
    assignee_id: Optional[int] = None
    event_id: Optional[int] = None
    due_date: Optional[date] = None
    priority: Priority = "Medium"


def get_channel_or_404(session: Session, club_id: int, channel_id: int) -> Channel:
    channel = session.get(Channel, channel_id)
    if not channel or channel.club_id != club_id:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


def post_message(session: Session, channel: Channel, author: Optional[User], body: str) -> Message:
    msg = Message(channel_id=channel.id, author_id=author.id if author else None, body=body)
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return msg


@router.get("/channels", summary="Channels with message counts and the latest message")
def list_channels(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    users = users_by_id(session, ctx.club.id)
    out = []
    for ch in session.exec(select(Channel).where(Channel.club_id == ctx.club.id).order_by(Channel.id)).all():
        count = session.exec(select(func.count()).select_from(Message).where(Message.channel_id == ch.id)).one()
        last = session.exec(select(Message).where(Message.channel_id == ch.id)
                            .order_by(Message.created_at.desc(), Message.id.desc())).first()
        out.append({**ch.model_dump(), "message_count": count,
                    "last_message": message_out(last, users) if last else None})
    return out


@router.get("/channels/{channel_id}/messages",
            summary="Messages, oldest first. Pass after_id to fetch only new ones (polling).")
def list_messages(channel_id: int, after_id: Optional[int] = None, limit: int = 100,
                  ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    channel = get_channel_or_404(session, ctx.club.id, channel_id)
    q = select(Message).where(Message.channel_id == channel.id)
    if after_id is not None:
        q = q.where(Message.id > after_id)
    rows = session.exec(q.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)).all()[::-1]
    users = users_by_id(session, ctx.club.id)
    return [message_out(m, users) for m in rows]


@router.post("/channels/{channel_id}/messages", status_code=201)
def send_message(channel_id: int, body: MessageIn, ctx: ClubContext = Depends(get_club_context),
                 session: Session = Depends(get_session)):
    channel = get_channel_or_404(session, ctx.club.id, channel_id)
    msg = post_message(session, channel, ctx.user, body.body.strip())
    return message_out(msg, users_by_id(session, ctx.club.id))


@router.post("/messages/{message_id}/to-task", status_code=201,
             summary="Turn a chat message into a task (ClubOS posts a confirmation in the channel)")
def message_to_task(message_id: int, body: MessageToTask, ctx: ClubContext = Depends(get_club_context),
                    session: Session = Depends(get_session)):
    msg = session.get(Message, message_id)
    channel = session.get(Channel, msg.channel_id) if msg else None
    if not msg or not channel or channel.club_id != ctx.club.id:
        raise HTTPException(status_code=404, detail="Message not found")

    title = (body.title or msg.body).strip()
    if len(title) > 120:
        title = title[:117].rstrip() + "..."
    data = TaskCreate(
        title=title,
        description=f"From #{channel.name}: \"{msg.body}\"",
        event_id=body.event_id if body.event_id is not None else channel.event_id,
        assignee_id=body.assignee_id if body.assignee_id is not None else msg.author_id,
        due_date=body.due_date,
        priority=body.priority,
    )
    task = create_task(session, ctx.club.id, ctx.user, data, source_message_id=msg.id, via=" from ClubChat")
    assignee = session.get(User, task.assignee_id) if task.assignee_id else None
    post_message(session, channel, None,
                 f"📌 {ctx.user.name} turned a message into a task: \"{task.title}\""
                 + (f" → assigned to {assignee.name}" if assignee else ""))
    return task_json(session, ctx.club.id, task)
