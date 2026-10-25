"""AI assistant using Gemini function calling.

It can read club data and draft emails freely. Every change (tasks, chat posts, email drafts, expenses,
financial requests, approval steps) is saved as an AgentAction proposal and only applied when a user
confirms it. Confirming runs the same route code as the app, so the same permission checks apply.
"""
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlmodel import Session, select

from .. import ai
from ..auth import ClubContext, get_club_context
from ..config import FINANCE_POSITIONS
from ..db import get_session
from ..models import (
    AgentAction, Approval, BudgetCategory, Channel, Event, FinancialRequest, Message, Reservation, Task, User,
    Vendor,
)
from ..services import board, budget_summary, event_out, message_out, task_out, users_by_id, workload
from . import approvals, chat as chat_routes, emails, finance, tasks as task_routes
from .emails import DraftIn, GenerateIn, build_email, mailto
from .finance import ExpenseIn, FinRequestIn
from .tasks import TaskCreate, TaskUpdate, create_task, get_task_or_404, task_json, update_task

router = APIRouter(prefix="/api/clubs/{club_id}/agent", tags=["ai agent"])

MAX_STEPS = 8
VIA = " (with ClubOS AI)"
FINANCE_ROLE = " or ".join(sorted(FINANCE_POSITIONS))


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class AgentIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = []


class ConfirmMany(BaseModel):
    action_ids: list[int] = Field(min_length=1, max_length=50)


# tool definitions shown to Gemini

TASK_FIELDS = {
    "title": {"type": "string"}, "description": {"type": "string"},
    "event_id": {"type": "integer"}, "assignee_id": {"type": "integer"},
    "priority": {"type": "string", "enum": ["Low", "Medium", "High"]},
    "status": {"type": "string", "enum": ["To Do", "In Progress", "Completed"]},
    "due_date": {"type": "string", "description": "YYYY-MM-DD"},
}

TOOLS = [
    {"name": "list_tasks", "description": "List tasks. Filters are optional.",
     "parameters": {"type": "object", "properties": {
         "event_id": {"type": "integer"}, "assignee_id": {"type": "integer"},
         "status": {"type": "string", "enum": ["To Do", "In Progress", "Completed"]}}}},
    {"name": "get_event", "description": "Full details of one event: tasks, readiness, approvals, budget.",
     "parameters": {"type": "object", "properties": {"event_id": {"type": "integer"}}, "required": ["event_id"]}},
    {"name": "member_workload", "description": "Open task count per board member, least busy first. "
                                               "Use it to choose who should take new tasks.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "read_channel", "description": "Recent ClubChat messages of a channel, e.g. to turn them into tasks.",
     "parameters": {"type": "object", "properties": {
         "channel_name": {"type": "string", "description": "Without #, e.g. event-planning"},
         "limit": {"type": "integer"}}, "required": ["channel_name"]}},
    {"name": "get_finance", "description": "Budget categories (with ids), spending, and NXT financial requests.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "get_approvals", "description": "25Live reservations and SB Engaged approvals per event, with ids.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "list_vendors", "description": "Sample vendors with ids, categories and estimated costs.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "draft_email", "description": "Draft an email from a template filled with real event data. "
                                           "Shown to the user; use propose_save_email_draft to save it.",
     "parameters": {"type": "object", "properties": {
         "template": {"type": "string", "enum": ["event_invitation", "catering_quote", "meeting_reminder"]},
         "event_id": {"type": "integer"}, "vendor_id": {"type": "integer"},
         "extra_note": {"type": "string"}}, "required": ["template"]}},
    {"name": "propose_create_tasks",
     "description": "Propose one or more NEW tasks (e.g. a full plan for an event, or action items from chat). "
                    "Each becomes a card the user confirms.",
     "parameters": {"type": "object", "properties": {"tasks": {
         "type": "array", "items": {"type": "object", "properties": TASK_FIELDS, "required": ["title"]}}},
         "required": ["tasks"]}},
    {"name": "propose_update_tasks",
     "description": "Propose changes to existing tasks: reassign, status (e.g. mark done), priority, due date, "
                    "title. Only include fields that change.",
     "parameters": {"type": "object", "properties": {"updates": {
         "type": "array", "items": {"type": "object", "properties": {"task_id": {"type": "integer"}, **TASK_FIELDS},
                                    "required": ["task_id"]}}},
         "required": ["updates"]}},
    {"name": "propose_delete_tasks", "description": "Propose deleting tasks.",
     "parameters": {"type": "object", "properties": {"task_ids": {"type": "array", "items": {"type": "integer"}}},
                    "required": ["task_ids"]}},
    {"name": "propose_post_message", "description": "Propose posting a ClubOS message in a chat channel.",
     "parameters": {"type": "object", "properties": {
         "channel_name": {"type": "string", "description": "Without #"}, "body": {"type": "string"}},
         "required": ["channel_name", "body"]}},
    {"name": "propose_save_email_draft", "description": "Propose saving an email draft.",
     "parameters": {"type": "object", "properties": {
         "to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"},
         "event_id": {"type": "integer"}, "template": {"type": "string"}},
         "required": ["subject", "body"]}},
    {"name": "propose_add_expense",
     "description": f"Propose recording an expense. Only a {FINANCE_ROLE} can confirm it.",
     "parameters": {"type": "object", "properties": {
         "category_id": {"type": "integer"}, "description": {"type": "string"}, "amount": {"type": "number"},
         "spent_on": {"type": "string", "description": "YYYY-MM-DD, default today"},
         "event_id": {"type": "integer"}, "vendor_id": {"type": "integer"}},
         "required": ["category_id", "description", "amount"]}},
    {"name": "propose_financial_request",
     "description": f"Propose a new NXT financial request draft (simulated). Only a {FINANCE_ROLE} can confirm it.",
     "parameters": {"type": "object", "properties": {
         "title": {"type": "string"}, "amount": {"type": "number"}, "event_id": {"type": "integer"},
         "vendor_id": {"type": "integer"}, "notes": {"type": "string"}},
         "required": ["title", "amount"]}},
    {"name": "propose_advance_approval",
     "description": "Propose moving a simulated 25Live reservation, SB Engaged approval, or NXT request to its "
                    f"next status. NXT steps can only be confirmed by a {FINANCE_ROLE}.",
     "parameters": {"type": "object", "properties": {
         "system": {"type": "string", "enum": ["25live", "sb_engaged", "nxt"]},
         "record_id": {"type": "integer"}}, "required": ["system", "record_id"]}},
]


def system_prompt(session: Session, ctx: ClubContext) -> str:
    members = "\n".join(f"  - id {u.id}: {u.name}, {m.position}" for u, m in board(session, ctx.club.id))
    events = "\n".join(
        f"  - id {e.id}: {e.name} on {e.date.isoformat()} at {e.location} (status {e.status})"
        for e in session.exec(select(Event).where(Event.club_id == ctx.club.id).order_by(Event.date)).all())
    channels = ", ".join("#" + c.name for c in session.exec(select(Channel).where(Channel.club_id == ctx.club.id)).all())
    finance_note = ("They can confirm money changes." if ctx.can_manage_finance
                    else f"They cannot confirm money changes; a {FINANCE_ROLE} has to.")
    return f"""You are ClubOS Assistant, the AI helper inside ClubOS for {ctx.club.name} at Stony Brook University.
Your job is to get the club's work done: plan events, organize tasks, and take busywork off the board.
Today is {date.today().isoformat()}. You are talking to {ctx.user.name} ({ctx.membership.position}). {finance_note}

Board members:
{members}
Events:
{events}
Chat channels: {channels}

How to work:
- Look things up with tools before acting. Never guess ids; use the ids above or from tool results.
- Every change is a proposal the user confirms on a card. Say what you proposed; never claim it is done.
- Batch your work: put all new tasks in ONE propose_create_tasks call and all edits in ONE
  propose_update_tasks call.
- Planning an event: call get_event first so you don't duplicate existing tasks, then propose the missing
  concrete tasks (usually 4-8) covering venue, approvals, food, promotion, supplies and day-of setup. Spread
  them across members using member_workload and their positions, and set due dates before the event.
- Turning chat into tasks: read_channel and list_tasks, then propose one task per real action item that
  isn't already a task, assigned to whoever volunteered or the best-fit member.
- Never propose a task that duplicates an existing one; update the existing task instead if needed.
- Assigning: prefer people with fewer open tasks whose position fits.
- Money and approvals: use get_finance / get_approvals for ids. Expenses, NXT requests and NXT steps need a
  {FINANCE_ROLE} to confirm; mention that if the user can't.
- Be brief and friendly: one or two sentences, then a short "- " list if needed. Plain text only: no
  markdown (no **, #, or backticks) and no task ids. The cards appear below your message, so refer to
  them as "the cards below"."""


# proposals

def _fmt_day(value) -> str:
    d = date.fromisoformat(str(value))
    return f"{d:%b} {d.day}"


def _task_bits(session: Session, payload: dict) -> str:
    bits = []
    if payload.get("assignee_id"):
        user = session.get(User, int(payload["assignee_id"]))
        bits.append(f"→ {user.name}")
    if payload.get("due_date"):
        bits.append(f"due {_fmt_day(payload['due_date'])}")
    if payload.get("priority"):
        bits.append(f"{payload['priority']} priority")
    if payload.get("status") and payload["status"] != "To Do":
        bits.append(f"status {payload['status']}")
    return (" " + ", ".join(bits)) if bits else ""


def _owned(session: Session, model, club_id: int, row_id, label: str):
    row = session.get(model, int(row_id))
    if not row or row.club_id != club_id:
        raise ValueError(f"{label} {row_id} not found in this club")
    return row


def _approval_record(session: Session, club_id: int, system: str, record_id):
    model, label, nxt = {
        "25live": (Reservation, "25Live reservation", approvals.NEXT_RESERVATION),
        "sb_engaged": (Approval, "SB Engaged approval", approvals.NEXT_APPROVAL),
        "nxt": (FinancialRequest, "NXT request", finance.NEXT_FIN),
    }[system]
    row = _owned(session, model, club_id, record_id, label)
    if row.status not in nxt:
        raise ValueError(f"{label} is already {row.status}")
    return row, label, nxt[row.status]


def validate(session: Session, ctx: ClubContext, kind: str, payload: dict) -> str:
    """Check a proposal against the club's data and return its card summary. Raises ValueError/ValidationError."""
    club_id = ctx.club.id
    users = users_by_id(session, club_id)
    if payload.get("assignee_id") and int(payload["assignee_id"]) not in users:
        raise ValueError("assignee_id is not on the board")
    if payload.get("event_id"):
        _owned(session, Event, club_id, payload["event_id"], "Event")
    if payload.get("vendor_id"):
        _owned(session, Vendor, club_id, payload["vendor_id"], "Vendor")

    if kind == "create_task":
        TaskCreate(**payload)
        return f"Create task \"{payload['title']}\"{_task_bits(session, payload)}"
    if kind == "update_task":
        task = _owned(session, Task, club_id, payload["task_id"], "Task")
        changes = {k: v for k, v in payload.items() if k != "task_id"}
        if not changes:
            raise ValueError("no fields to change")
        TaskUpdate(**changes)
        new_title = f" → \"{changes['title']}\"" if changes.get("title") else ""
        return f"Update \"{task.title}\"{new_title}{_task_bits(session, changes)}"
    if kind == "delete_task":
        task = _owned(session, Task, club_id, payload["task_id"], "Task")
        return f"Delete task \"{task.title}\""
    if kind == "post_message":
        name = str(payload["channel_name"]).lstrip("#")
        if not session.exec(select(Channel).where(Channel.club_id == club_id, Channel.name == name)).first():
            raise ValueError(f"No channel #{name}")
        preview = payload["body"] if len(payload["body"]) <= 60 else payload["body"][:57] + "..."
        return f"Post in #{name}: \"{preview}\""
    if kind == "save_email_draft":
        DraftIn(**payload)
        return f"Save email draft \"{payload['subject']}\""
    if kind == "add_expense":
        body = ExpenseIn(**payload)
        cat = _owned(session, BudgetCategory, club_id, body.category_id, "Budget category")
        return f"Add ${body.amount:,.2f} expense: {body.description} ({cat.name})"
    if kind == "financial_request":
        body = FinRequestIn(**payload)
        return f"Create NXT request \"{body.title}\" for ${body.amount:,.2f}"
    if kind == "advance_approval":
        row, label, nxt = _approval_record(session, club_id, payload["system"], payload["record_id"])
        return f"Move {label} from {row.status} to {nxt}"
    raise ValueError(f"Unknown action {kind}")


NEEDS_FINANCE = {"add_expense", "financial_request"}


def needs_finance(action: AgentAction) -> bool:
    return action.kind in NEEDS_FINANCE or (action.kind == "advance_approval" and action.payload.get("system") == "nxt")


def action_out(action: AgentAction, ctx: ClubContext) -> dict:
    finance_only = needs_finance(action)
    return {**action.model_dump(), "requires_role": FINANCE_ROLE if finance_only else None,
            "can_confirm": ctx.can_manage_finance or not finance_only}


def propose(session: Session, ctx: ClubContext, kind: str, payload: dict, out: dict) -> dict:
    payload = {k: v for k, v in payload.items() if v not in (None, "")}
    try:
        summary = validate(session, ctx, kind, payload)
    except (ValidationError, ValueError, KeyError, TypeError) as e:
        return {"error": str(e)}
    action = AgentAction(club_id=ctx.club.id, requested_by_id=ctx.user.id, kind=kind, payload=payload,
                         summary=summary)
    session.add(action)
    session.commit()
    session.refresh(action)
    out["proposals"].append(action_out(action, ctx))
    return {"proposed": True, "action_id": action.id, "summary": summary}


def apply(session: Session, ctx: ClubContext, action: AgentAction) -> dict:
    """Run a confirmed proposal through the same code the app's own buttons use."""
    p = dict(action.payload)
    club_id = ctx.club.id
    if action.kind == "create_task":
        task = create_task(session, club_id, ctx.user, TaskCreate(**p), via=VIA)
        return {"task": task_json(session, club_id, task)}
    if action.kind == "update_task":
        task = get_task_or_404(session, club_id, int(p.pop("task_id")))
        task = update_task(session, club_id, ctx.user, task, TaskUpdate(**p), via=VIA)
        return {"task": task_json(session, club_id, task)}
    if action.kind == "delete_task":
        task_routes.delete(task_id=int(p["task_id"]), ctx=ctx, session=session)
        return {"deleted_task_id": int(p["task_id"])}
    if action.kind == "post_message":
        name = str(p["channel_name"]).lstrip("#")
        channel = session.exec(select(Channel).where(Channel.club_id == club_id, Channel.name == name)).first()
        if not channel:
            raise HTTPException(status_code=404, detail=f"No channel #{name}")
        msg = chat_routes.post_message(session, channel, None, p["body"])
        return {"message": message_out(msg, users_by_id(session, club_id))}
    if action.kind == "save_email_draft":
        return {"draft": emails.save_draft(body=DraftIn(**p), ctx=ctx, session=session)}
    if action.kind == "add_expense":
        return finance.add_expense(body=ExpenseIn(**p), ctx=ctx, session=session)
    if action.kind == "financial_request":
        return {"financial_request": finance.create_request(body=FinRequestIn(**p), ctx=ctx, session=session)
                .model_dump()}
    if action.kind == "advance_approval":
        rid = int(p["record_id"])
        advance = {"25live": lambda: approvals.advance_reservation(reservation_id=rid, ctx=ctx, session=session),
                   "sb_engaged": lambda: approvals.advance_approval(approval_id=rid, ctx=ctx, session=session),
                   "nxt": lambda: finance.advance_request(request_id=rid, ctx=ctx, session=session)}[p["system"]]
        return {"record": advance().model_dump()}
    raise HTTPException(status_code=400, detail=f"Unknown action {action.kind}")


# tool implementations

def run_tool(session: Session, ctx: ClubContext, name: str, args: dict, out: dict) -> dict:
    club_id = ctx.club.id
    users = users_by_id(session, club_id)
    events = {e.id: e for e in session.exec(select(Event).where(Event.club_id == club_id)).all()}

    if name == "list_tasks":
        q = select(Task).where(Task.club_id == club_id)
        if args.get("event_id"):
            q = q.where(Task.event_id == int(args["event_id"]))
        if args.get("assignee_id"):
            q = q.where(Task.assignee_id == int(args["assignee_id"]))
        if args.get("status"):
            q = q.where(Task.status == args["status"])
        return {"tasks": [
            {"id": t["id"], "title": t["title"], "status": t["status"], "priority": t["priority"],
             "due_date": str(t["due_date"]) if t["due_date"] else None,
             "assignee": t["assignee"]["name"] if t["assignee"] else None, "event": t["event_name"]}
            for t in (task_out(t, users, events) for t in session.exec(q.order_by(Task.due_date)).all())]}

    if name == "get_event":
        event = events.get(int(args["event_id"]))
        if not event:
            return {"error": "No such event"}
        info = event_out(session, event, users)
        return {"event": {k: str(v) if isinstance(v, date) else v for k, v in info.items() if k != "created_at"},
                "tasks": run_tool(session, ctx, "list_tasks", {"event_id": event.id}, out)["tasks"]}

    if name == "member_workload":
        return {"members": workload(session, club_id)}

    if name == "read_channel":
        cname = str(args["channel_name"]).lstrip("#")
        channel = session.exec(select(Channel).where(Channel.club_id == club_id, Channel.name == cname)).first()
        if not channel:
            return {"error": f"No channel #{cname}"}
        limit = min(int(args.get("limit") or 20), 50)
        msgs = session.exec(select(Message).where(Message.channel_id == channel.id)
                            .order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)).all()[::-1]
        return {"messages": [{"id": m["id"], "author": m["author"]["name"], "text": m["body"]}
                             for m in (message_out(m, users) for m in msgs)]}

    if name == "get_finance":
        summary = budget_summary(session, ctx.club)
        requests = session.exec(select(FinancialRequest).where(FinancialRequest.club_id == club_id)).all()
        return {"budget": {k: summary[k] for k in ("annual_budget", "spent", "remaining", "unallocated")},
                "categories": summary["categories"],
                "financial_requests": [{"id": r.id, "title": r.title, "amount": r.amount, "status": r.status,
                                        "event_id": r.event_id} for r in requests]}

    if name == "get_approvals":
        res = session.exec(select(Reservation).where(Reservation.club_id == club_id)).all()
        appr = session.exec(select(Approval).where(Approval.club_id == club_id)).all()
        return {"reservations_25live": [{"id": r.id, "event_id": r.event_id, "space": r.space, "status": r.status}
                                        for r in res],
                "sb_engaged": [{"id": a.id, "event_id": a.event_id, "status": a.status,
                                "pending_actions": a.pending_actions} for a in appr]}

    if name == "list_vendors":
        vendors = session.exec(select(Vendor).where(Vendor.club_id == club_id)).all()
        return {"vendors": [{"id": v.id, "name": v.name, "category": v.category,
                             "estimated_cost": v.estimated_cost} for v in vendors]}

    if name == "draft_email":
        try:
            email = build_email(session, ctx.club, ctx.user, ctx.membership.position, GenerateIn(**args))
        except (ValidationError, HTTPException) as e:
            return {"error": str(getattr(e, "detail", e))}
        email = {**email, "template": args["template"], "event_id": args.get("event_id"),
                 "mailto": mailto(email["to"], email["subject"], email["body"])}
        out["emails"].append(email)
        return {"drafted": True, "to": email["to"], "subject": email["subject"], "body": email["body"]}

    batch = {"propose_create_tasks": ("create_task", lambda: args.get("tasks") or []),
             "propose_update_tasks": ("update_task", lambda: args.get("updates") or []),
             "propose_delete_tasks": ("delete_task", lambda: [{"task_id": i} for i in args.get("task_ids") or []])}
    if name in batch:
        kind, items = batch[name]
        results = [propose(session, ctx, kind, dict(item), out) for item in items()]
        return {"results": results or [{"error": "nothing to propose"}]}

    single = {"propose_post_message": "post_message", "propose_save_email_draft": "save_email_draft",
              "propose_add_expense": "add_expense", "propose_financial_request": "financial_request",
              "propose_advance_approval": "advance_approval"}
    if name in single:
        return propose(session, ctx, single[name], args, out)

    return {"error": f"Unknown tool {name}"}


# routes

@router.get("/status", summary="Whether AI is configured")
def status(ctx: ClubContext = Depends(get_club_context)):
    from ..config import GEMINI_MODEL
    return {"available": ai.is_configured(), "model": GEMINI_MODEL}


@router.post("/chat", summary="Send a message to the assistant")
def chat(body: AgentIn, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    from google.genai import types

    config = types.GenerateContentConfig(
        system_instruction=system_prompt(session, ctx),
        tools=[types.Tool(function_declarations=[
            types.FunctionDeclaration(name=t["name"], description=t["description"],
                                      parameters_json_schema=t["parameters"]) for t in TOOLS])],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        temperature=0.3,
    )
    contents = [types.Content(role="user" if turn.role == "user" else "model", parts=[types.Part(text=turn.text)])
                for turn in body.history[-12:]]
    contents.append(types.Content(role="user", parts=[types.Part(text=body.message)]))

    out = {"reply": "", "proposals": [], "emails": [], "tools_used": []}
    for _ in range(MAX_STEPS):
        resp = ai.generate(contents, config)
        calls = resp.function_calls or []
        if not calls:
            out["reply"] = (resp.text or "").strip()
            break
        contents.append(resp.candidates[0].content)
        parts = []
        for call in calls:
            out["tools_used"].append(call.name)
            result = run_tool(session, ctx, call.name, dict(call.args or {}), out)
            parts.append(types.Part.from_function_response(name=call.name, response=result))
        contents.append(types.Content(role="user", parts=parts))
    if not out["reply"]:
        out["reply"] = ("Here's what I prepared. Review the cards below." if out["proposals"] or out["emails"]
                        else "Sorry, I couldn't finish that. Try asking in a simpler way.")
    return out


def _get_action(session: Session, club_id: int, action_id: int) -> AgentAction:
    action = session.get(AgentAction, action_id)
    if not action or action.club_id != club_id:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if action.status != "Proposed":
        raise HTTPException(status_code=409, detail=f"Already {action.status}")
    return action


def _confirm(session: Session, ctx: ClubContext, action: AgentAction) -> dict:
    if needs_finance(action):
        ctx.require_finance()
    try:
        result = apply(session, ctx, action)
    except (ValidationError, ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=f"Can't apply this change: {e}") from e
    task = result.get("task")
    action.status, action.result_id = "Applied", task["id"] if task else None
    session.add(action)
    session.commit()
    session.refresh(action)
    return {"action": action_out(action, ctx), **result}


@router.post("/actions/{action_id}/confirm", summary="Apply a proposed change")
def confirm(action_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return _confirm(session, ctx, _get_action(session, ctx.club.id, action_id))


@router.post("/actions/confirm", summary="Apply several proposed changes (Confirm all)")
def confirm_many(body: ConfirmMany, ctx: ClubContext = Depends(get_club_context),
                 session: Session = Depends(get_session)):
    results = []
    for action_id in body.action_ids:
        try:
            results.append({"id": action_id, "ok": True,
                            **_confirm(session, ctx, _get_action(session, ctx.club.id, action_id))})
        except HTTPException as e:
            session.rollback()
            results.append({"id": action_id, "ok": False, "error": e.detail})
    return {"results": results, "applied": sum(r["ok"] for r in results), "failed": sum(not r["ok"] for r in results)}


@router.post("/actions/{action_id}/reject", summary="Reject a proposed change")
def reject(action_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    action = _get_action(session, ctx.club.id, action_id)
    action.status = "Rejected"
    session.add(action)
    session.commit()
    session.refresh(action)
    return {"action": action_out(action, ctx)}
