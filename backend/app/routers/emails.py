"""Email templates filled from event data. Emails are not sent; responses include a mailto link."""
from datetime import date, datetime, timedelta
from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity, ai
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Club, EmailDraft, Event, Task, User, Vendor
from ..services import board
from .events import get_event_or_404
from .vendors import get_vendor_or_404

router = APIRouter(prefix="/api/clubs/{club_id}/emails", tags=["emails"])

TemplateKey = Literal["event_invitation", "catering_quote", "meeting_reminder"]

TEMPLATES = [
    {"key": "event_invitation", "name": "Event invitation to members", "needs": ["event_id"]},
    {"key": "catering_quote", "name": "Catering quote request to a vendor", "needs": ["event_id", "vendor_id"]},
    {"key": "meeting_reminder", "name": "Board meeting reminder",
     "needs": [], "optional": ["meeting_date", "meeting_time", "meeting_location"]},
]


class GenerateIn(BaseModel):
    template: TemplateKey
    event_id: Optional[int] = None
    vendor_id: Optional[int] = None
    meeting_date: Optional[date] = None
    meeting_time: Optional[str] = None  # defaults to the club's meeting time
    meeting_location: Optional[str] = None
    extra_note: str = Field(default="", max_length=1000)


class PolishIn(BaseModel):
    subject: str
    body: str
    tone: Literal["friendly", "professional", "hype", "concise"] = "friendly"


class DraftIn(BaseModel):
    template: str = "custom"
    event_id: Optional[int] = None
    to: str = ""
    subject: str
    body: str


def mailto(to: str, subject: str, body: str) -> str:
    return f"mailto:{quote(to, safe='@,')}?subject={quote(subject)}&body={quote(body)}"


def next_meeting_day(day_name: Optional[str]) -> date:
    """Next date (today included) that falls on the club's meeting weekday, or today if it has none."""
    today = date.today()
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    if not day_name or day_name.lower() not in days:
        return today
    return today + timedelta(days=(days.index(day_name.lower()) - today.weekday()) % 7)


def fmt_date(d: date) -> str:
    return d.strftime("%A, %B ") + str(d.day)


def fmt_time(t: str) -> str:
    try:
        return datetime.strptime(t, "%H:%M").strftime("%I:%M %p").lstrip("0")
    except ValueError:
        return t


def build_email(session: Session, club: Club, sender: User, position: str, body: GenerateIn) -> dict:
    sign = f"\n\nBest,\n{sender.name}\n{position}, {club.name}"
    note = f"\n\n{body.extra_note.strip()}" if body.extra_note.strip() else ""

    if body.template == "meeting_reminder":
        when = body.meeting_date or next_meeting_day(club.meeting_day)
        time_ = body.meeting_time or club.meeting_time or "7:00 PM"
        place = body.meeting_location or club.meeting_location or "SAC Room 302"
        open_tasks = session.exec(select(Task).where(Task.club_id == club.id, Task.status != "Completed")
                                  .order_by(Task.due_date).limit(5)).all()
        upcoming = session.exec(select(Event).where(Event.club_id == club.id, Event.date >= date.today())
                                .order_by(Event.date).limit(3)).all()
        agenda = "\n".join(f"  • {e.name} ({fmt_date(e.date)}) – status check" for e in upcoming)
        tasks = "\n".join(f"  • {t.title}" + (f" (due {t.due_date:%b} {t.due_date.day})" if t.due_date else "")
                          for t in open_tasks)
        return {
            "to": ", ".join(u.email for u, _ in board(session, club.id)),
            "subject": f"Reminder: {club.name} board meeting – {fmt_date(when)}",
            "body": (f"Hi team,\n\nQuick reminder that our board meeting is on {fmt_date(when)} at "
                     f"{time_} in {place}.\n\nAgenda:\n{agenda or '  • Open discussion'}"
                     f"\n\nOpen tasks to update us on:\n{tasks or '  • None – nice work!'}{note}{sign}"),
        }

    if body.event_id is None:
        raise HTTPException(status_code=400, detail="This template needs event_id")
    event = get_event_or_404(session, club.id, body.event_id)
    lead = session.get(User, event.lead_id) if event.lead_id else None
    when = f"{fmt_date(event.date)}, {fmt_time(event.start_time)} – {fmt_time(event.end_time)}"

    if body.template == "event_invitation":
        return {
            "to": club.email or "",
            "subject": f"You're invited: {event.name} – {fmt_date(event.date)}",
            "body": (f"Hi {club.name} members!\n\nYou're invited to {event.name}.\n\n"
                     f"When: {when}\nWhere: {event.location}\n\n{event.description}\n\n"
                     f"Spots are limited (about {event.expected_attendance} people), so RSVP soon!"
                     + (f" Questions? Reach out to {lead.name} ({lead.email})." if lead else "") + note + sign),
        }

    if body.vendor_id is None:
        raise HTTPException(status_code=400, detail="catering_quote needs vendor_id")
    vendor = get_vendor_or_404(session, club.id, body.vendor_id)
    return {
        "to": vendor.email,
        "subject": f"Catering quote request – {event.name} ({fmt_date(event.date)})",
        "body": (f"Hello{' ' + vendor.contact_name if vendor.contact_name else ''},\n\n"
                 f"I'm reaching out on behalf of {club.name} at Stony Brook University. We're hosting "
                 f"{event.name} and would love a quote from {vendor.name}.\n\n"
                 f"  • Date & time: {when}\n  • Location: {event.location}\n"
                 f"  • Expected guests: {event.expected_attendance}\n"
                 f"  • Our estimated food budget: about ${vendor.estimated_cost:,.0f}\n\n"
                 f"Could you share menu options, pricing, and your availability? We'd appreciate a reply "
                 f"within the week so we can submit our funding request.{note}{sign}"),
    }


@router.get("/templates")
def list_templates(ctx: ClubContext = Depends(get_club_context)):
    return TEMPLATES


@router.post("/generate", summary="Generate an email from a template")
def generate(body: GenerateIn, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    email = build_email(session, ctx.club, ctx.user, ctx.membership.position, body)
    return {**email, "template": body.template, "event_id": body.event_id,
            "mailto": mailto(email["to"], email["subject"], email["body"])}


@router.post("/polish", summary="Rewrite an email with AI")
def polish(body: PolishIn, ctx: ClubContext = Depends(get_club_context)):
    result = ai.polish_email(body.subject, body.body, body.tone, ctx.club.name)
    return {**result, "mailto": None}


@router.post("/mailto", summary="Build a mailto link")
def build_mailto(body: DraftIn, ctx: ClubContext = Depends(get_club_context)):
    return {"mailto": mailto(body.to, body.subject, body.body)}


@router.get("/drafts")
def list_drafts(event_id: Optional[int] = None, ctx: ClubContext = Depends(get_club_context),
                session: Session = Depends(get_session)):
    q = select(EmailDraft).where(EmailDraft.club_id == ctx.club.id)
    if event_id is not None:
        q = q.where(EmailDraft.event_id == event_id)
    return [{**d.model_dump(), "mailto": mailto(d.to, d.subject, d.body)}
            for d in session.exec(q.order_by(EmailDraft.created_at.desc())).all()]


@router.post("/drafts", status_code=201, summary="Save a draft")
def save_draft(body: DraftIn, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    if body.event_id is not None:
        get_event_or_404(session, ctx.club.id, body.event_id)
    d = EmailDraft(club_id=ctx.club.id, created_by_id=ctx.user.id, **body.model_dump())
    session.add(d)
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} saved email draft \"{d.subject}\"", "email",
                 d.event_id)
    session.commit()
    session.refresh(d)
    return {**d.model_dump(), "mailto": mailto(d.to, d.subject, d.body)}


@router.delete("/drafts/{draft_id}", status_code=204)
def delete_draft(draft_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    d = session.get(EmailDraft, draft_id)
    if not d or d.club_id != ctx.club.id:
        raise HTTPException(status_code=404, detail="Draft not found")
    session.delete(d)
    session.commit()
