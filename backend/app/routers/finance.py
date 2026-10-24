"""Club budget, expenses, and SIMULATED NXT financial requests.
Reading is open to the whole board; any change needs President or Treasurer."""
import random
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import BudgetCategory, Event, Expense, FinancialRequest, Vendor
from ..services import budget_summary, user_brief, users_by_id

router = APIRouter(prefix="/api/clubs/{club_id}/finance", tags=["finance"])

FinStatus = Literal["Draft", "Submitted Externally", "Pending", "Approved", "Denied"]
NEXT_FIN = {"Draft": "Submitted Externally", "Submitted Externally": "Pending", "Pending": "Approved"}


class ExpenseIn(BaseModel):
    category_id: int
    description: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    spent_on: date = Field(default_factory=date.today)
    event_id: Optional[int] = None
    vendor_id: Optional[int] = None


class CategoryUpdate(BaseModel):
    planned: float = Field(ge=0)


class FinRequestIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    event_id: Optional[int] = None
    vendor_id: Optional[int] = None
    notes: str = ""


class FinRequestUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    status: Optional[FinStatus] = None
    notes: Optional[str] = None


def _owned(session: Session, model, club_id: int, row_id: Optional[int], label: str):
    if row_id is None:
        return None
    row = session.get(model, row_id)
    if not row or row.club_id != club_id:
        raise HTTPException(status_code=400, detail=f"{label} not found in this club")
    return row


def expense_out(x: Expense, users) -> dict:
    return {**x.model_dump(), "created_by": user_brief(users.get(x.created_by_id))}


@router.get("/summary", summary="Budget overview: totals, per-category planned/spent, recent expenses, requests")
def summary(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    users = users_by_id(session, ctx.club.id)
    recent = session.exec(select(Expense).where(Expense.club_id == ctx.club.id)
                          .order_by(Expense.spent_on.desc(), Expense.id.desc()).limit(10)).all()
    requests = session.exec(select(FinancialRequest).where(FinancialRequest.club_id == ctx.club.id)
                            .order_by(FinancialRequest.id)).all()
    return {
        **budget_summary(session, ctx.club),
        "recent_expenses": [expense_out(x, users) for x in recent],
        "financial_requests": [r.model_dump() for r in requests],
        "can_manage_finance": ctx.can_manage_finance,
    }


@router.get("/expenses")
def list_expenses(event_id: Optional[int] = None, ctx: ClubContext = Depends(get_club_context),
                  session: Session = Depends(get_session)):
    q = select(Expense).where(Expense.club_id == ctx.club.id)
    if event_id is not None:
        q = q.where(Expense.event_id == event_id)
    users = users_by_id(session, ctx.club.id)
    return [expense_out(x, users) for x in session.exec(q.order_by(Expense.spent_on.desc())).all()]


@router.post("/expenses", status_code=201,
             summary="Add an expense (President/Treasurer). Returns the expense AND the updated budget.")
def add_expense(body: ExpenseIn, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    ctx.require_finance()
    cat = _owned(session, BudgetCategory, ctx.club.id, body.category_id, "Budget category")
    event = _owned(session, Event, ctx.club.id, body.event_id, "Event")
    _owned(session, Vendor, ctx.club.id, body.vendor_id, "Vendor")
    x = Expense(club_id=ctx.club.id, created_by_id=ctx.user.id, **body.model_dump())
    session.add(x)
    activity.log(session, ctx.club.id, ctx.user.id,
                 f"{ctx.user.name} added a ${x.amount:,.2f} expense: {x.description} ({cat.name})"
                 + (f" for \"{event.name}\"" if event else ""), "finance", x.event_id)
    session.commit()
    session.refresh(x)
    return {"expense": expense_out(x, users_by_id(session, ctx.club.id)),
            "budget": budget_summary(session, ctx.club)}


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, ctx: ClubContext = Depends(get_club_context),
                   session: Session = Depends(get_session)):
    ctx.require_finance()
    x = _owned(session, Expense, ctx.club.id, expense_id, "Expense")
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} removed expense: {x.description}", "finance",
                 x.event_id)
    session.delete(x)
    session.commit()


@router.get("/categories")
def list_categories(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return budget_summary(session, ctx.club)["categories"]


@router.patch("/categories/{category_id}", summary="Change a category's planned amount (President/Treasurer)")
def update_category(category_id: int, body: CategoryUpdate, ctx: ClubContext = Depends(get_club_context),
                    session: Session = Depends(get_session)):
    ctx.require_finance()
    cat = _owned(session, BudgetCategory, ctx.club.id, category_id, "Budget category")
    cat.planned = body.planned
    session.add(cat)
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} set {cat.name} budget to ${body.planned:,.0f}",
                 "finance")
    session.commit()
    return budget_summary(session, ctx.club)


# ---------- NXT (simulated) ----------

@router.get("/requests", summary="NXT financial requests (simulated)")
def list_requests(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return session.exec(select(FinancialRequest).where(FinancialRequest.club_id == ctx.club.id)
                        .order_by(FinancialRequest.id)).all()


@router.post("/requests", status_code=201, summary="Create a financial request draft (President/Treasurer)")
def create_request(body: FinRequestIn, ctx: ClubContext = Depends(get_club_context),
                   session: Session = Depends(get_session)):
    ctx.require_finance()
    _owned(session, Event, ctx.club.id, body.event_id, "Event")
    _owned(session, Vendor, ctx.club.id, body.vendor_id, "Vendor")
    r = FinancialRequest(club_id=ctx.club.id, **body.model_dump())
    session.add(r)
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} drafted NXT request \"{r.title}\"", "finance",
                 r.event_id)
    session.commit()
    session.refresh(r)
    return r


def _set_fin_status(session: Session, ctx: ClubContext, r: FinancialRequest, status: str) -> None:
    r.status = status
    if status != "Draft" and not r.submitted_on:
        r.submitted_on = date.today()
    if status != "Draft" and not r.reference_number:
        r.reference_number = f"SIM-NXT-{random.randint(100000, 999999)}"
    activity.log(session, ctx.club.id, ctx.user.id, f"NXT (simulated): \"{r.title}\" is now {status}", "finance",
                 r.event_id)


@router.patch("/requests/{request_id}")
def update_request(request_id: int, body: FinRequestUpdate, ctx: ClubContext = Depends(get_club_context),
                   session: Session = Depends(get_session)):
    ctx.require_finance()
    r = _owned(session, FinancialRequest, ctx.club.id, request_id, "Financial request")
    changes = body.model_dump(exclude_unset=True)
    status = changes.pop("status", None)
    for k, v in changes.items():
        setattr(r, k, v)
    if status and status != r.status:
        _set_fin_status(session, ctx, r, status)
    session.add(r)
    session.commit()
    session.refresh(r)
    return r


@router.post("/requests/{request_id}/simulate-next", summary="Demo button: advance to the next status")
def advance_request(request_id: int, ctx: ClubContext = Depends(get_club_context),
                    session: Session = Depends(get_session)):
    ctx.require_finance()
    r = _owned(session, FinancialRequest, ctx.club.id, request_id, "Financial request")
    nxt = NEXT_FIN.get(r.status)
    if not nxt:
        raise HTTPException(status_code=400, detail=f"Already {r.status}")
    _set_fin_status(session, ctx, r, nxt)
    session.add(r)
    session.commit()
    session.refresh(r)
    return r
