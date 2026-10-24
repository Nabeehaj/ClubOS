from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Activity, Approval, Event, FinancialRequest, Reservation, Task
from ..services import budget_summary, club_out, event_out, task_out, user_brief, users_by_id

router = APIRouter(prefix="/api/clubs/{club_id}", tags=["dashboard"])


@router.get("/dashboard", summary="Dashboard data")
def dashboard(ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    club = ctx.club
    users = users_by_id(session, club.id)
    events = session.exec(select(Event).where(Event.club_id == club.id).order_by(Event.date)).all()
    events_by_id = {e.id: e for e in events}
    upcoming = [e for e in events if e.date >= date.today() and e.status not in ("Completed", "Cancelled")]
    tasks = session.exec(select(Task).where(Task.club_id == club.id).order_by(Task.due_date, Task.id)).all()
    open_tasks = [t for t in tasks if t.status != "Completed"]
    priority_rank = {"High": 0, "Medium": 1, "Low": 2}
    open_tasks.sort(key=lambda t: (t.due_date or date.max, priority_rank.get(t.priority, 3)))

    # Simulated university workflows that still need action
    needs_action = []
    for r in session.exec(select(Reservation).where(Reservation.club_id == club.id,
                                                    Reservation.status.in_(["Draft", "Pending", "Denied"]))).all():
        needs_action.append({"type": "25live", "id": r.id, "event_id": r.event_id,
                             "event_name": events_by_id[r.event_id].name, "status": r.status,
                             "label": f"25Live: {r.space}", "deadline": r.submit_deadline})
    for a in session.exec(select(Approval).where(Approval.club_id == club.id, Approval.status != "Approved")).all():
        needs_action.append({"type": "sb_engaged", "id": a.id, "event_id": a.event_id,
                             "event_name": events_by_id[a.event_id].name, "status": a.status,
                             "label": "SB Engaged approval", "deadline": a.deadline})
    for f in session.exec(select(FinancialRequest).where(FinancialRequest.club_id == club.id,
                                                         FinancialRequest.status.not_in(["Approved", "Denied"]))).all():
        needs_action.append({"type": "nxt", "id": f.id, "event_id": f.event_id,
                             "event_name": events_by_id[f.event_id].name if f.event_id else None,
                             "status": f.status, "label": f"NXT: {f.title}", "deadline": None})
    needs_action.sort(key=lambda x: (x["deadline"] or date.max))

    budget = budget_summary(session, club)
    activity_rows = session.exec(select(Activity).where(Activity.club_id == club.id)
                                 .order_by(Activity.created_at.desc(), Activity.id.desc()).limit(10)).all()

    return {
        "club": club_out(club),
        "me": {**user_brief(ctx.user), "position": ctx.membership.position,
               "can_manage_finance": ctx.can_manage_finance},
        "stats": {
            "members": club.member_count,
            "board_members": len(users),
            "upcoming_events": len(upcoming),
            "open_tasks": len(open_tasks),
            "completed_tasks": len(tasks) - len(open_tasks),
            "overdue_tasks": sum(1 for t in open_tasks if t.due_date and t.due_date < date.today()),
            "pending_approvals": len(needs_action),
            "budget_total": budget["annual_budget"],
            "budget_spent": budget["spent"],
            "budget_remaining": budget["remaining"],
            "budget_percent_used": budget["percent_used"],
        },
        "upcoming_events": [event_out(session, e, users) for e in upcoming[:4]],
        "my_tasks": [task_out(t, users, events_by_id) for t in open_tasks if t.assignee_id == ctx.user.id][:5],
        "pending_tasks": [task_out(t, users, events_by_id) for t in open_tasks][:8],
        "approvals_needing_action": needs_action[:8],
        "budget_by_category": budget["categories"],
        "recent_activity": [{**a.model_dump(), "actor": user_brief(users.get(a.actor_id))} for a in activity_rows],
    }
