import datetime as dt
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import (
    Approval, Channel, EmailDraft, Event, EventVendor, Expense, FinancialRequest, Message, Reservation,
    Task, Vendor,
)
from ..services import event_out, is_board_member, message_out, task_out, user_brief, users_by_id

router = APIRouter(prefix="/api/clubs/{club_id}/events", tags=["events"])

EventStatus = Literal["Planning", "Awaiting Approval", "Confirmed", "Completed", "Cancelled"]


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    date: dt.date
    start_time: str = "18:00"
    end_time: str = "20:00"
    location: str = ""
    description: str = ""
    lead_id: Optional[int] = None
    budget: float = Field(default=0, ge=0)
    expected_attendance: int = Field(default=0, ge=0)
    status: EventStatus = "Planning"


class EventUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    date: Optional[dt.date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    lead_id: Optional[int] = None
    budget: Optional[float] = Field(default=None, ge=0)
    expected_attendance: Optional[int] = Field(default=None, ge=0)
    status: Optional[EventStatus] = None


class EventVendorLink(BaseModel):
    vendor_id: int
    status: Literal["Considering", "Quote Requested", "Booked"] = "Considering"
    quoted_amount: Optional[float] = None


def get_event_or_404(session: Session, club_id: int, event_id: int) -> Event:
    event = session.get(Event, event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("", summary="List events (soonest first)")
def list_events(status: Optional[EventStatus] = None, upcoming_only: bool = False,
                ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    q = select(Event).where(Event.club_id == ctx.club.id)
    if status:
        q = q.where(Event.status == status)
    if upcoming_only:
        q = q.where(Event.date >= dt.date.today())
    users = users_by_id(session, ctx.club.id)
    return [event_out(session, e, users) for e in session.exec(q.order_by(Event.date)).all()]


@router.post("", status_code=201)
def create_event(body: EventCreate, ctx: ClubContext = Depends(get_club_context),
                 session: Session = Depends(get_session)):
    if not is_board_member(session, ctx.club.id, body.lead_id):
        raise HTTPException(status_code=400, detail="lead_id is not on this club's board")
    event = Event(club_id=ctx.club.id, **body.model_dump())
    session.add(event)
    session.flush()
    session.add(Channel(club_id=ctx.club.id, event_id=event.id,
                        name=event.name.lower().replace(" ", "-")[:40],
                        description=f"Planning chat for {event.name}"))
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} created event \"{event.name}\"", "event",
                 event.id)
    session.commit()
    session.refresh(event)
    return event_out(session, event, users_by_id(session, ctx.club.id))


@router.get("/{event_id}")
def get_event(event_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    event = get_event_or_404(session, ctx.club.id, event_id)
    return event_out(session, event, users_by_id(session, ctx.club.id))


@router.patch("/{event_id}")
def update_event(event_id: int, body: EventUpdate, ctx: ClubContext = Depends(get_club_context),
                 session: Session = Depends(get_session)):
    event = get_event_or_404(session, ctx.club.id, event_id)
    changes = body.model_dump(exclude_unset=True)
    if "lead_id" in changes and not is_board_member(session, ctx.club.id, changes["lead_id"]):
        raise HTTPException(status_code=400, detail="lead_id is not on this club's board")
    for k, v in changes.items():
        setattr(event, k, v)
    session.add(event)
    if changes:
        activity.log(session, ctx.club.id, ctx.user.id,
                     f"{ctx.user.name} updated {', '.join(changes)} of \"{event.name}\"", "event", event.id)
    session.commit()
    session.refresh(event)
    return event_out(session, event, users_by_id(session, ctx.club.id))


@router.get("/{event_id}/workspace",
            summary="EVERYTHING about one event in one call (tasks, approvals, money, vendors, chat, emails)")
def workspace(event_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    event = get_event_or_404(session, ctx.club.id, event_id)
    users = users_by_id(session, ctx.club.id)
    events = {event.id: event}

    tasks = session.exec(select(Task).where(Task.event_id == event.id).order_by(Task.due_date, Task.id)).all()
    reservation = session.exec(select(Reservation).where(Reservation.event_id == event.id)).first()
    approval = session.exec(select(Approval).where(Approval.event_id == event.id)).first()
    fin = session.exec(select(FinancialRequest).where(FinancialRequest.event_id == event.id)).all()
    expenses = session.exec(select(Expense).where(Expense.event_id == event.id).order_by(Expense.spent_on)).all()
    vendor_links = session.exec(
        select(EventVendor, Vendor).join(Vendor, Vendor.id == EventVendor.vendor_id)
        .where(EventVendor.event_id == event.id)
    ).all()
    channel = session.exec(select(Channel).where(Channel.event_id == event.id)).first()
    messages = []
    if channel:
        messages = session.exec(select(Message).where(Message.channel_id == channel.id)
                                .order_by(Message.created_at.desc(), Message.id.desc()).limit(10)).all()[::-1]
    drafts = session.exec(select(EmailDraft).where(EmailDraft.event_id == event.id)
                          .order_by(EmailDraft.created_at.desc())).all()

    base = event_out(session, event, users)
    return {
        "event": base,
        "tasks": [task_out(t, users, events) for t in tasks],
        "reservation_25live": reservation.model_dump() if reservation else None,
        "sb_engaged": approval.model_dump() if approval else None,
        "financial_requests": [r.model_dump() for r in fin],
        "budget": {
            "planned": event.budget,
            "spent": base["spent"],
            "remaining": round(event.budget - base["spent"], 2),
            "expenses": [{**x.model_dump(), "created_by": user_brief(users.get(x.created_by_id))} for x in expenses],
        },
        "vendors": [{**v.model_dump(), "link_status": link.status, "quoted_amount": link.quoted_amount}
                    for link, v in vendor_links],
        "channel": channel.model_dump() if channel else None,
        "recent_messages": [message_out(m, users) for m in messages],
        "email_drafts": [d.model_dump() for d in drafts],
        "readiness": base["readiness"],
    }


@router.post("/{event_id}/vendors", status_code=201, summary="Attach a vendor to an event (or update its status)")
def link_vendor(event_id: int, body: EventVendorLink, ctx: ClubContext = Depends(get_club_context),
                session: Session = Depends(get_session)):
    event = get_event_or_404(session, ctx.club.id, event_id)
    vendor = session.get(Vendor, body.vendor_id)
    if not vendor or vendor.club_id != ctx.club.id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    link = session.exec(select(EventVendor).where(EventVendor.event_id == event.id,
                                                  EventVendor.vendor_id == vendor.id)).first()
    link = link or EventVendor(event_id=event.id, vendor_id=vendor.id)
    link.status = body.status
    link.quoted_amount = body.quoted_amount
    session.add(link)
    activity.log(session, ctx.club.id, ctx.user.id,
                 f"{ctx.user.name} marked {vendor.name} as {body.status} for \"{event.name}\"", "event", event.id)
    session.commit()
    return {**vendor.model_dump(), "link_status": link.status, "quoted_amount": link.quoted_amount}
