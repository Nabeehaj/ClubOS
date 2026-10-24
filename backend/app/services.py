"""Shared queries and JSON shapes. Routers and the AI agent both go through these, so the
frontend always gets the same shape for a task, an event, etc. no matter which endpoint it hit."""
from collections import Counter
from datetime import date
from typing import Optional

from sqlmodel import Session, func, select

from .models import (
    Approval, BudgetCategory, Club, Event, Expense, FinancialRequest, Membership, Message,
    Reservation, Task, User,
)

# ---------- lookups ----------

def board(session: Session, club_id: int) -> list[tuple[User, Membership]]:
    rows = session.exec(
        select(User, Membership).join(Membership, Membership.user_id == User.id)
        .where(Membership.club_id == club_id).order_by(Membership.id)
    ).all()
    return list(rows)


def users_by_id(session: Session, club_id: int) -> dict[int, User]:
    return {u.id: u for u, _ in board(session, club_id)}


def is_board_member(session: Session, club_id: int, user_id: Optional[int]) -> bool:
    if user_id is None:
        return True
    return session.exec(
        select(Membership).where(Membership.club_id == club_id, Membership.user_id == user_id)
    ).first() is not None


# ---------- JSON shapes ----------

def user_brief(user: Optional[User]) -> Optional[dict]:
    if not user:
        return None
    return {"id": user.id, "name": user.name, "email": user.email, "avatar_url": user.avatar_url}


def club_out(club: Club) -> dict:
    return club.model_dump()


def task_out(task: Task, users: dict[int, User], events: Optional[dict[int, Event]] = None) -> dict:
    event = (events or {}).get(task.event_id) if task.event_id else None
    return {
        **task.model_dump(),
        "assignee": user_brief(users.get(task.assignee_id)),
        "event_name": event.name if event else None,
        "is_overdue": bool(task.due_date and task.status != "Completed" and task.due_date < date.today()),
    }


def event_out(session: Session, event: Event, users: dict[int, User], with_readiness: bool = True) -> dict:
    tasks = session.exec(select(Task).where(Task.event_id == event.id)).all()
    done = sum(1 for t in tasks if t.status == "Completed")
    out = {
        **event.model_dump(),
        "lead": user_brief(users.get(event.lead_id)),
        "days_until": (event.date - date.today()).days,
        "task_progress": {"completed": done, "total": len(tasks)},
        "spent": event_spent(session, event.id),
    }
    if with_readiness:
        out["readiness"] = readiness(session, event)
    return out


def message_out(msg: Message, users: dict[int, User]) -> dict:
    author = users.get(msg.author_id) if msg.author_id else None
    return {
        **msg.model_dump(),
        "author": user_brief(author) if author else {"id": None, "name": "ClubOS", "email": None, "avatar_url": None},
        "is_bot": msg.author_id is None,
    }


# ---------- readiness ----------

# How much each status counts toward the readiness score.
STATUS_CREDIT = {
    "Approved": 1.0, "Confirmed": 1.0,
    "Pending": 0.75, "Submitted Externally": 0.75,
    "Changes Requested": 0.4, "Draft": 0.25, "In Progress": 0.25,
    "Not Started": 0.0, "Denied": 0.0, None: 0.0,
}
READINESS_WEIGHTS = {"tasks": 40, "reservation": 20, "approval": 20, "finance": 20}


def readiness(session: Session, event: Event) -> dict:
    """Event readiness 0-100: task completion plus the simulated 25Live / SB Engaged / NXT statuses."""
    tasks = session.exec(select(Task).where(Task.event_id == event.id)).all()
    done = sum(1 for t in tasks if t.status == "Completed")
    task_ratio = done / len(tasks) if tasks else 0.0

    reservation = session.exec(select(Reservation).where(Reservation.event_id == event.id)).first()
    approval = session.exec(select(Approval).where(Approval.event_id == event.id)).first()
    fin_requests = session.exec(select(FinancialRequest).where(FinancialRequest.event_id == event.id)).all()
    if fin_requests:
        fin_status = min((r.status for r in fin_requests), key=lambda s: STATUS_CREDIT.get(s, 0))
    else:
        fin_status = None

    parts = [
        {"key": "tasks", "label": "Tasks", "status": f"{done}/{len(tasks)} completed",
         "ratio": task_ratio},
        {"key": "reservation", "label": "25Live reservation",
         "status": reservation.status if reservation else "Not Started",
         "ratio": STATUS_CREDIT.get(reservation.status if reservation else None, 0)},
        {"key": "approval", "label": "SB Engaged approval",
         "status": approval.status if approval else "Not Started",
         "ratio": STATUS_CREDIT.get(approval.status if approval else None, 0)},
        {"key": "finance", "label": "NXT financial request",
         "status": fin_status or "Not Started",
         "ratio": STATUS_CREDIT.get(fin_status, 0)},
    ]
    score = 0.0
    for p in parts:
        p["weight"] = READINESS_WEIGHTS[p["key"]]
        p["points"] = round(p["ratio"] * p["weight"], 1)
        p["ratio"] = round(p["ratio"], 3)
        score += p["points"]
    return {"score": round(score), "parts": parts}


# ---------- money ----------

def event_spent(session: Session, event_id: int) -> float:
    total = session.exec(select(func.sum(Expense.amount)).where(Expense.event_id == event_id)).one()
    return round(total or 0, 2)


def budget_summary(session: Session, club: Club) -> dict:
    categories = session.exec(select(BudgetCategory).where(BudgetCategory.club_id == club.id)
                              .order_by(BudgetCategory.id)).all()
    spent_by_cat = dict(session.exec(
        select(Expense.category_id, func.sum(Expense.amount))
        .where(Expense.club_id == club.id).group_by(Expense.category_id)
    ).all())
    cats = []
    for c in categories:
        spent = round(spent_by_cat.get(c.id) or 0, 2)
        cats.append({
            "id": c.id, "name": c.name, "planned": c.planned, "spent": spent,
            "remaining": round(c.planned - spent, 2),
            "percent_used": round(100 * spent / c.planned) if c.planned else 0,
        })
    planned = sum(c.planned for c in categories)
    spent = round(sum(c["spent"] for c in cats), 2)
    return {
        "annual_budget": club.annual_budget,
        "allocated": planned,
        "unallocated": round(club.annual_budget - planned, 2),
        "spent": spent,
        "remaining": round(club.annual_budget - spent, 2),
        "percent_used": round(100 * spent / club.annual_budget) if club.annual_budget else 0,
        "categories": cats,
    }


def workload(session: Session, club_id: int) -> list[dict]:
    """Open (not completed) tasks per board member, least busy first. Used by the agent to suggest assignees."""
    open_counts = Counter(
        t.assignee_id for t in session.exec(
            select(Task).where(Task.club_id == club_id, Task.status != "Completed")
        ).all()
    )
    rows = [
        {"user_id": u.id, "name": u.name, "position": m.position, "open_tasks": open_counts.get(u.id, 0)}
        for u, m in board(session, club_id)
    ]
    return sorted(rows, key=lambda r: r["open_tasks"])
