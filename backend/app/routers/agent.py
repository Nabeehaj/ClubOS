"""ClubOS AI agent (Gemini function calling).

It may READ anything in the club and DRAFT emails freely. Any CHANGE (create / assign / update a task) is
only *proposed*: it is saved as an AgentAction and shown to the user as a confirm card. Nothing changes until
someone clicks confirm. The agent has no tools for money or approvals on purpose.
"""
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlmodel import Session, select

from .. import ai
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import AgentAction, Channel, Event, Message, Task, User
from ..services import board, event_out, message_out, task_out, users_by_id, workload
from .emails import GenerateIn, build_email, mailto
from .tasks import TaskCreate, TaskUpdate, create_task, get_task_or_404, task_json, update_task

router = APIRouter(prefix="/api/clubs/{club_id}/agent", tags=["ai agent"])

MAX_STEPS = 6


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class AgentIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = []


# ---------- tool definitions shown to Gemini ----------

TOOLS = [
    {"name": "list_tasks", "description": "List tasks. Filters are optional.",
     "parameters": {"type": "object", "properties": {
         "event_id": {"type": "integer"}, "assignee_id": {"type": "integer"},
         "status": {"type": "string", "enum": ["To Do", "In Progress", "Completed"]}}}},
    {"name": "get_event", "description": "Full details of one event: tasks, readiness, approvals, budget.",
     "parameters": {"type": "object", "properties": {"event_id": {"type": "integer"}}, "required": ["event_id"]}},
    {"name": "member_workload", "description": "Open task count per board member, least busy first. "
                                               "Use it to suggest who should take a new task.",
     "parameters": {"type": "object", "properties": {}}},
    {"name": "read_channel", "description": "Recent ClubChat messages of a channel, e.g. to summarize it into tasks.",
     "parameters": {"type": "object", "properties": {
         "channel_name": {"type": "string", "description": "Without #, e.g. event-planning"},
         "limit": {"type": "integer"}}, "required": ["channel_name"]}},
    {"name": "draft_email", "description": "Draft an email from a template filled with real event data.",
     "parameters": {"type": "object", "properties": {
         "template": {"type": "string", "enum": ["event_invitation", "catering_quote", "meeting_reminder"]},
         "event_id": {"type": "integer"}, "vendor_id": {"type": "integer"},
         "extra_note": {"type": "string"}}, "required": ["template"]}},
    {"name": "propose_create_task",
     "description": "Propose a NEW task. The user must confirm it before it is created.",
     "parameters": {"type": "object", "properties": {
         "title": {"type": "string"}, "description": {"type": "string"},
         "event_id": {"type": "integer"}, "assignee_id": {"type": "integer"},
         "priority": {"type": "string", "enum": ["Low", "Medium", "High"]},
         "due_date": {"type": "string", "description": "YYYY-MM-DD"}}, "required": ["title"]}},
    {"name": "propose_update_task",
     "description": "Propose changing an existing task (reassign, status, priority, due date, title). "
                    "The user must confirm it. Only include fields that change.",
     "parameters": {"type": "object", "properties": {
         "task_id": {"type": "integer"}, "title": {"type": "string"}, "assignee_id": {"type": "integer"},
         "status": {"type": "string", "enum": ["To Do", "In Progress", "Completed"]},
         "priority": {"type": "string", "enum": ["Low", "Medium", "High"]},
         "due_date": {"type": "string", "description": "YYYY-MM-DD"}}, "required": ["task_id"]}},
]


def system_prompt(session: Session, ctx: ClubContext) -> str:
    members = "\n".join(f"  - id {u.id}: {u.name}, {m.position}" for u, m in board(session, ctx.club.id))
    events = "\n".join(
        f"  - id {e.id}: {e.name} on {e.date.isoformat()} at {e.location} (status {e.status})"
        for e in session.exec(select(Event).where(Event.club_id == ctx.club.id).order_by(Event.date)).all())
    channels = ", ".join("#" + c.name for c in session.exec(select(Channel).where(Channel.club_id == ctx.club.id)).all())
    return f"""You are ClubOS Assistant, the AI helper inside ClubOS for {ctx.club.name} at Stony Brook University.
Today is {date.today().isoformat()}. You are talking to {ctx.user.name} ({ctx.membership.position}).

Board members:
{members}
Events:
{events}
Chat channels: {channels}

Rules:
- Use the tools to look things up; never guess IDs, always use the ids above or from tool results.
- To create or change tasks, call propose_create_task / propose_update_task. Those are proposals: tell the user
  to confirm them on the cards. Never claim a change is already done.
- When asked who should do something, check member_workload and pick someone with fewer open tasks whose
  position fits.
- You cannot touch money, expenses, or 25Live / SB Engaged / NXT approvals. If asked, say a President or
  Treasurer has to do that in the app.
- Keep answers short and friendly (a few sentences or a short list). Plain text, no markdown headers."""


# ---------- tool implementations ----------

def _summary_for(session: Session, kind: str, payload: dict, task: Optional[Task] = None) -> str:
    assignee = session.get(User, payload["assignee_id"]) if payload.get("assignee_id") else None
    bits = []
    if assignee:
        bits.append(f"→ {assignee.name}")
    if payload.get("due_date"):
        d = date.fromisoformat(str(payload["due_date"]))
        bits.append(f"due {d:%b} {d.day}")
    if payload.get("priority"):
        bits.append(f"{payload['priority']} priority")
    if payload.get("status"):
        bits.append(f"status {payload['status']}")
    extra = (" " + ", ".join(bits)) if bits else ""
    if kind == "create_task":
        return f"Create task \"{payload['title']}\"{extra}"
    title = payload.get("title") or task.title
    return f"Update \"{title}\"{extra}"


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

    if name == "draft_email":
        try:
            email = build_email(session, ctx.club, ctx.user, ctx.membership.position, GenerateIn(**args))
        except (ValidationError, HTTPException) as e:
            return {"error": str(getattr(e, "detail", e))}
        email = {**email, "template": args["template"], "event_id": args.get("event_id"),
                 "mailto": mailto(email["to"], email["subject"], email["body"])}
        out["emails"].append(email)
        return {"drafted": True, "subject": email["subject"], "note": "The draft is shown to the user."}

    if name in ("propose_create_task", "propose_update_task"):
        kind = "create_task" if name == "propose_create_task" else "update_task"
        payload = {k: v for k, v in args.items() if v not in (None, "")}
        task = None
        try:
            if kind == "create_task":
                TaskCreate(**payload)
            else:
                task = get_task_or_404(session, club_id, int(payload["task_id"]))
                TaskUpdate(**{k: v for k, v in payload.items() if k != "task_id"})
            if payload.get("assignee_id") and int(payload["assignee_id"]) not in users:
                return {"error": "assignee_id is not on the board"}
            if payload.get("event_id") and int(payload["event_id"]) not in events:
                return {"error": "event_id does not exist"}
        except (ValidationError, HTTPException, ValueError) as e:
            return {"error": str(getattr(e, "detail", e))}
        action = AgentAction(club_id=club_id, requested_by_id=ctx.user.id, kind=kind, payload=payload,
                             summary=_summary_for(session, kind, payload, task))
        session.add(action)
        session.commit()
        session.refresh(action)
        out["proposals"].append(action.model_dump())
        return {"proposed": True, "action_id": action.id, "summary": action.summary,
                "note": "Waiting for the user to confirm."}

    return {"error": f"Unknown tool {name}"}


# ---------- routes ----------

@router.get("/status", summary="Is the AI configured? (frontend can hide/disable AI buttons)")
def status(ctx: ClubContext = Depends(get_club_context)):
    from ..config import GEMINI_MODEL
    return {"available": ai.is_configured(), "model": GEMINI_MODEL}


@router.post("/chat", summary="Talk to the agent. Returns its reply + proposed changes (confirm cards) + email drafts")
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
        out["reply"] = ("Here's what I prepared. Please review the cards below." if out["proposals"] or out["emails"]
                        else "Sorry, I couldn't finish that. Try asking in a simpler way.")
    return out


def _get_action(session: Session, club_id: int, action_id: int) -> AgentAction:
    action = session.get(AgentAction, action_id)
    if not action or action.club_id != club_id:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if action.status != "Proposed":
        raise HTTPException(status_code=409, detail=f"Already {action.status}")
    return action


@router.post("/actions/{action_id}/confirm", summary="User clicked ✅ on a proposal: apply it")
def confirm(action_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    action = _get_action(session, ctx.club.id, action_id)
    payload = dict(action.payload)
    if action.kind == "create_task":
        task = create_task(session, ctx.club.id, ctx.user, TaskCreate(**payload), via=" (with ClubOS AI)")
    else:
        task = get_task_or_404(session, ctx.club.id, int(payload.pop("task_id")))
        task = update_task(session, ctx.club.id, ctx.user, task, TaskUpdate(**payload), via=" (with ClubOS AI)")
    action.status, action.result_id = "Applied", task.id
    session.add(action)
    session.commit()
    session.refresh(action)
    return {"action": action.model_dump(), "task": task_json(session, ctx.club.id, task)}


@router.post("/actions/{action_id}/reject", summary="User clicked ❌ on a proposal")
def reject(action_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    action = _get_action(session, ctx.club.id, action_id)
    action.status = "Rejected"
    session.add(action)
    session.commit()
    session.refresh(action)
    return {"action": action.model_dump()}
