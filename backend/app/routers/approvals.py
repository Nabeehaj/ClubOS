"""SIMULATED university workflows: 25Live (rooms), SB Engaged (event approval), plus the combined
'approvals center' view. Nothing here talks to the real systems. Reference numbers start with SIM-."""
import random
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Approval, Event, FinancialRequest, Reservation
from ..services import readiness
from .events import get_event_or_404

router = APIRouter(prefix="/api/clubs/{club_id}", tags=["approvals (simulated)"])

ResStatus = Literal["Draft", "Pending", "Approved", "Denied"]
ApprovalStatus = Literal["Not Started", "Draft", "Pending", "Changes Requested", "Approved"]

# What one click of "Simulate next step" does in the demo.
NEXT_RESERVATION = {"Draft": "Pending", "Pending": "Approved", "Denied": "Pending"}
NEXT_APPROVAL = {"Not Started": "Draft", "Draft": "Pending", "Changes Requested": "Pending", "Pending": "Approved"}


def sim_ref(prefix: str) -> str:
    return f"SIM-{prefix}-{random.randint(100000, 999999)}"


class ReservationIn(BaseModel):
    event_id: int
    space: str
    requested_date: date
    start_time: str
    end_time: str
    capacity: int = Field(ge=1)
    submit_deadline: Optional[date] = None
    notes: str = ""


class ReservationUpdate(BaseModel):
    space: Optional[str] = None
    requested_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    capacity: Optional[int] = Field(default=None, ge=1)
    status: Optional[ResStatus] = None
    submit_deadline: Optional[date] = None
    notes: Optional[str] = None


class ApprovalUpdate(BaseModel):
    status: Optional[ApprovalStatus] = None
    deadline: Optional[date] = None
    pending_actions: Optional[list[str]] = None


def _get_owned(session: Session, model, club_id: int, row_id: int):
    row = session.get(model, row_id)
    if not row or row.club_id != club_id:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return row


def _set_reservation_status(session: Session, ctx: ClubContext, res: Reservation, status: str) -> None:
    res.status = status
    if status == "Approved" and not res.confirmation_number:
        res.confirmation_number = sim_ref("25L")
    event = session.get(Event, res.event_id)
    activity.log(session, ctx.club.id, ctx.user.id,
                 f"25Live (simulated): {res.space} for \"{event.name}\" is now {status}", "approval", event.id)


def _set_approval_status(session: Session, ctx: ClubContext, appr: Approval, status: str) -> None:
    appr.status = status
    if status in ("Pending", "Approved") and not appr.submitted_on:
        appr.submitted_on = date.today()
    if status in ("Pending", "Approved") and not appr.reference_number:
        appr.reference_number = sim_ref("SBE")
    if status == "Approved":
        appr.pending_actions = []
        appr.required_documents = [{**d, "done": True} for d in appr.required_documents]
    event = session.get(Event, appr.event_id)
    activity.log(session, ctx.club.id, ctx.user.id,
                 f"SB Engaged (simulated): \"{event.name}\" is now {status}", "approval", event.id)


# ---------- overview ----------

@router.get("/approvals", summary="Approvals center: every event with its 25Live, SB Engaged, NXT status + readiness")
def approvals_center(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    out = []
    for event in session.exec(select(Event).where(Event.club_id == ctx.club.id).order_by(Event.date)).all():
        res = session.exec(select(Reservation).where(Reservation.event_id == event.id)).first()
        appr = session.exec(select(Approval).where(Approval.event_id == event.id)).first()
        fin = session.exec(select(FinancialRequest).where(FinancialRequest.event_id == event.id)).all()
        out.append({
            "event": {"id": event.id, "name": event.name, "date": event.date, "status": event.status},
            "reservation_25live": res.model_dump() if res else None,
            "sb_engaged": appr.model_dump() if appr else None,
            "financial_requests": [r.model_dump() for r in fin],
            "readiness": readiness(session, event),
            "simulated": True,
        })
    return out


# ---------- 25Live ----------

@router.get("/reservations", summary="25Live reservations (simulated)")
def list_reservations(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return session.exec(select(Reservation).where(Reservation.club_id == ctx.club.id)
                        .order_by(Reservation.requested_date)).all()


@router.post("/reservations", status_code=201, summary="Create a 25Live reservation draft (simulated)")
def create_reservation(body: ReservationIn, ctx: ClubContext = Depends(get_club_context),
                       session: Session = Depends(get_session)):
    event = get_event_or_404(session, ctx.club.id, body.event_id)
    res = Reservation(club_id=ctx.club.id, **body.model_dump())
    session.add(res)
    activity.log(session, ctx.club.id, ctx.user.id,
                 f"{ctx.user.name} drafted a 25Live request for {res.space} (\"{event.name}\")", "approval", event.id)
    session.commit()
    session.refresh(res)
    return res


@router.patch("/reservations/{reservation_id}")
def update_reservation(reservation_id: int, body: ReservationUpdate, ctx: ClubContext = Depends(get_club_context),
                       session: Session = Depends(get_session)):
    res = _get_owned(session, Reservation, ctx.club.id, reservation_id)
    changes = body.model_dump(exclude_unset=True)
    status = changes.pop("status", None)
    for k, v in changes.items():
        setattr(res, k, v)
    if status and status != res.status:
        _set_reservation_status(session, ctx, res, status)
    session.add(res)
    session.commit()
    session.refresh(res)
    return res


@router.post("/reservations/{reservation_id}/simulate-next", summary="Demo button: advance to the next status")
def advance_reservation(reservation_id: int, ctx: ClubContext = Depends(get_club_context),
                        session: Session = Depends(get_session)):
    res = _get_owned(session, Reservation, ctx.club.id, reservation_id)
    nxt = NEXT_RESERVATION.get(res.status)
    if not nxt:
        raise HTTPException(status_code=400, detail=f"Already {res.status}")
    _set_reservation_status(session, ctx, res, nxt)
    session.add(res)
    session.commit()
    session.refresh(res)
    return res


# ---------- SB Engaged ----------

@router.get("/sb-engaged", summary="SB Engaged approval requests (simulated)")
def list_approvals(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return session.exec(select(Approval).where(Approval.club_id == ctx.club.id).order_by(Approval.deadline)).all()


@router.patch("/sb-engaged/{approval_id}")
def update_approval(approval_id: int, body: ApprovalUpdate, ctx: ClubContext = Depends(get_club_context),
                    session: Session = Depends(get_session)):
    appr = _get_owned(session, Approval, ctx.club.id, approval_id)
    changes = body.model_dump(exclude_unset=True)
    status = changes.pop("status", None)
    for k, v in changes.items():
        setattr(appr, k, v)
    if status and status != appr.status:
        _set_approval_status(session, ctx, appr, status)
    session.add(appr)
    session.commit()
    session.refresh(appr)
    return appr


@router.post("/sb-engaged/{approval_id}/documents/{index}/toggle", summary="Tick / untick a required document")
def toggle_document(approval_id: int, index: int, ctx: ClubContext = Depends(get_club_context),
                    session: Session = Depends(get_session)):
    appr = _get_owned(session, Approval, ctx.club.id, approval_id)
    if not 0 <= index < len(appr.required_documents):
        raise HTTPException(status_code=404, detail="No document at that index")
    docs = [dict(d) for d in appr.required_documents]  # new list so SQLAlchemy notices the JSON change
    docs[index]["done"] = not docs[index]["done"]
    appr.required_documents = docs
    session.add(appr)
    session.commit()
    session.refresh(appr)
    return appr


@router.post("/sb-engaged/{approval_id}/simulate-next", summary="Demo button: advance to the next status")
def advance_approval(approval_id: int, ctx: ClubContext = Depends(get_club_context),
                     session: Session = Depends(get_session)):
    appr = _get_owned(session, Approval, ctx.club.id, approval_id)
    nxt = NEXT_APPROVAL.get(appr.status)
    if not nxt:
        raise HTTPException(status_code=400, detail=f"Already {appr.status}")
    _set_approval_status(session, ctx, appr, nxt)
    session.add(appr)
    session.commit()
    session.refresh(appr)
    return appr
