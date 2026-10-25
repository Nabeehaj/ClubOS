"""End-to-end tests of the demo flow on a temporary database."""
import os
import tempfile
from types import SimpleNamespace

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db").replace("\\", "/")
os.environ["GEMINI_API_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from google.genai import types  # noqa: E402

from app import ai  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEMO_USERS  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def login(client, key):
    _, email, password, *_ = DEMO_USERS[key]
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data


def test_every_demo_account_can_log_in(client):
    for key in DEMO_USERS:
        _, data = login(client, key)
        assert data["clubs"], f"{key} is on no club"
    r = client.post("/api/auth/login", json={"email": "sarah@sbu.clubos", "password": "nope"})
    assert r.status_code == 401


def test_requires_login_and_membership(client):
    assert client.get("/api/clubs/1/dashboard").status_code == 401
    h, _ = login(client, "sofia")  # Sofia is only in the Design club
    assert client.get("/api/clubs/1/dashboard", headers=h).status_code == 403


def test_full_demo_flow(client):
    h, data = login(client, "sarah")
    club_id = data["default_club_id"]
    base = f"/api/clubs/{club_id}"

    # 1. dashboard
    dash = client.get(f"{base}/dashboard", headers=h).json()
    assert dash["club"]["name"] == "SBU Tech Society"
    assert dash["stats"]["board_members"] == 7
    nn = next(e for e in dash["upcoming_events"] if e["name"] == "Fall Tech Networking Night")
    assert nn["task_progress"] == {"completed": 5, "total": 8}
    assert nn["readiness"]["score"] == 75

    # 2. event workspace
    ws = client.get(f"{base}/events/{nn['id']}/workspace", headers=h).json()
    assert ws["reservation_25live"]["status"] == "Approved"
    assert ws["sb_engaged"]["status"] == "Pending"
    assert any(v["name"] == "Campus Bites Catering" for v in ws["vendors"])
    assert ws["channel"]["name"] == "event-planning"

    # 3. assign a task
    members = client.get(f"{base}/members", headers=h).json()
    james = next(m for m in members if m["name"] == "James Wilson")
    open_task = next(t for t in ws["tasks"] if t["status"] != "Completed")
    r = client.patch(f"{base}/tasks/{open_task['id']}", headers=h, json={"assignee_id": james["id"]})
    assert r.json()["assignee"]["name"] == "James Wilson"

    # 4. chat message -> task
    channel_id = ws["channel"]["id"]
    msg = client.post(f"{base}/channels/{channel_id}/messages", headers=h,
                      json={"body": "Someone needs to print name tags"}).json()
    task = client.post(f"{base}/messages/{msg['id']}/to-task", headers=h,
                       json={"assignee_id": james["id"], "priority": "High"}).json()
    assert task["source_message_id"] == msg["id"] and task["event_id"] == nn["id"]
    new_msgs = client.get(f"{base}/channels/{channel_id}/messages?after_id={msg['id']}", headers=h).json()
    assert new_msgs and new_msgs[-1]["is_bot"]

    # 5. approvals: simulate SB Engaged approval -> readiness goes up
    sbe_id = ws["sb_engaged"]["id"]
    r = client.post(f"{base}/sb-engaged/{sbe_id}/simulate-next", headers=h).json()
    assert r["status"] == "Approved"
    center = client.get(f"{base}/approvals", headers=h).json()
    assert next(c for c in center if c["event"]["id"] == nn["id"])["readiness"]["score"] > 75

    # 6. finance: add an expense, budget updates
    before = client.get(f"{base}/finance/summary", headers=h).json()
    cat = next(c for c in before["categories"] if c["name"] == "Food & Catering")
    r = client.post(f"{base}/finance/expenses", headers=h,
                    json={"category_id": cat["id"], "description": "Catering deposit", "amount": 100,
                          "event_id": nn["id"]}).json()
    assert r["budget"]["spent"] == pytest.approx(before["spent"] + 100)
    assert r["budget"]["remaining"] == pytest.approx(before["remaining"] - 100)

    # 7. email from event data
    email = client.post(f"{base}/emails/generate", headers=h,
                        json={"template": "event_invitation", "event_id": nn["id"]}).json()
    assert "Fall Tech Networking Night" in email["subject"] and "SAC Ballroom A" in email["body"]
    assert email["mailto"].startswith("mailto:")

    # 8. back to the dashboard: changes show up
    dash2 = client.get(f"{base}/dashboard", headers=h).json()
    feed = " | ".join(a["text"] for a in dash2["recent_activity"])
    assert "Catering deposit" in feed and "from ClubChat" in feed
    assert dash2["stats"]["budget_spent"] == pytest.approx(dash["stats"]["budget_spent"] + 100)


def test_finance_is_president_or_treasurer_only(client):
    h, _ = login(client, "daniel")  # Marketing Chair
    r = client.post("/api/clubs/1/finance/expenses", headers=h,
                    json={"category_id": 1, "description": "x", "amount": 5})
    assert r.status_code == 403
    h, _ = login(client, "emily")  # Treasurer
    r = client.post("/api/clubs/1/finance/expenses", headers=h,
                    json={"category_id": 1, "description": "Tape", "amount": 5})
    assert r.status_code == 201


def test_other_templates_and_club_switching(client):
    h, data = login(client, "aisha")
    assert {c["name"] for c in data["clubs"]} == {"SBU Tech Society", "SBU Design & Media Collective"}
    r = client.post("/api/clubs/1/emails/generate", headers=h,
                    json={"template": "catering_quote", "event_id": 1, "vendor_id": 1})
    assert r.status_code == 200 and "orders@campusbites.example" in r.json()["to"]
    r = client.post("/api/clubs/1/emails/generate", headers=h, json={"template": "meeting_reminder"})
    assert "sarah@sbu.clubos" in r.json()["to"]


def test_ai_unavailable_without_key(client):
    h, _ = login(client, "sarah")
    assert client.get("/api/clubs/1/agent/status", headers=h).json()["available"] is False
    r = client.post("/api/clubs/1/agent/chat", headers=h, json={"message": "hi"})
    assert r.status_code == 503


def _stub_reply(*, calls=None, text=None):
    parts = [types.Part(function_call=c) for c in calls or []] or [types.Part(text=text)]
    return SimpleNamespace(function_calls=calls, text=text,
                           candidates=[SimpleNamespace(content=types.Content(role="model", parts=parts))])


def _script(monkeypatch, *replies):
    it = iter(replies)
    monkeypatch.setattr(ai, "generate", lambda contents, cfg: next(it))


def _call(name, **args):
    return types.FunctionCall(name=name, args=args)


def test_agent_plans_event_and_confirm_all(client, monkeypatch):
    _script(monkeypatch,
            _stub_reply(calls=[_call("get_event", event_id=2), _call("member_workload")]),
            _stub_reply(calls=[_call("propose_create_tasks", tasks=[
                {"title": "Book a photographer", "assignee_id": 6, "event_id": 2, "due_date": "2026-11-08"},
                {"title": "Print name tags", "assignee_id": 4, "event_id": 2, "priority": "Low"},
                {"title": "Bad one", "assignee_id": 999}])]),
            _stub_reply(text="I proposed 2 tasks for the AI Workshop."))
    h, _ = login(client, "sarah")
    out = client.post("/api/clubs/1/agent/chat", headers=h, json={"message": "Plan the AI Workshop"}).json()
    assert out["tools_used"] == ["get_event", "member_workload", "propose_create_tasks"]
    assert len(out["proposals"]) == 2 and "Daniel Lee" in out["proposals"][0]["summary"]
    assert all(p["can_confirm"] and p["requires_role"] is None for p in out["proposals"])

    before = len(client.get("/api/clubs/1/tasks?event_id=2", headers=h).json())
    ids = [p["id"] for p in out["proposals"]]
    done = client.post("/api/clubs/1/agent/actions/confirm", headers=h, json={"action_ids": ids}).json()
    assert done["applied"] == 2 and done["failed"] == 0
    assert len(client.get("/api/clubs/1/tasks?event_id=2", headers=h).json()) == before + 2
    again = client.post("/api/clubs/1/agent/actions/confirm", headers=h, json={"action_ids": ids}).json()
    assert again["failed"] == 2  # already applied


def test_agent_bulk_update_delete_and_chat(client, monkeypatch):
    h, _ = login(client, "sarah")
    tasks = client.get("/api/clubs/1/tasks?assignee_id=6&status=To%20Do", headers=h).json()
    assert tasks
    victim = client.post("/api/clubs/1/tasks", headers=h, json={"title": "Temp task"}).json()
    _script(monkeypatch,
            _stub_reply(calls=[_call("propose_update_tasks", updates=[{"task_id": t["id"], "status": "Completed"}
                                                                       for t in tasks]),
                               _call("propose_delete_tasks", task_ids=[victim["id"]]),
                               _call("propose_post_message", channel_name="general", body="Daniel wrapped up!")]),
            _stub_reply(text="Done proposing."))
    out = client.post("/api/clubs/1/agent/chat", headers=h, json={"message": "Mark Daniel's to-dos done"}).json()
    kinds = sorted(p["kind"] for p in out["proposals"])
    assert kinds == sorted(["update_task"] * len(tasks) + ["delete_task", "post_message"])
    done = client.post("/api/clubs/1/agent/actions/confirm", headers=h,
                       json={"action_ids": [p["id"] for p in out["proposals"]]}).json()
    assert done["failed"] == 0
    assert not client.get("/api/clubs/1/tasks?assignee_id=6&status=To%20Do", headers=h).json()
    assert client.get(f"/api/clubs/1/tasks/{victim['id']}", headers=h).status_code == 404
    general = client.get("/api/clubs/1/channels", headers=h).json()[0]
    assert general["last_message"]["body"] == "Daniel wrapped up!" and general["last_message"]["is_bot"]


def test_agent_money_needs_finance_role(client, monkeypatch):
    proposal_calls = [_call("propose_add_expense", category_id=2, description="Pizza deposit", amount=80, event_id=1),
                      _call("propose_advance_approval", system="sb_engaged", record_id=2)]
    _script(monkeypatch, _stub_reply(calls=proposal_calls), _stub_reply(text="Proposed."))
    h, _ = login(client, "daniel")  # Marketing Chair
    out = client.post("/api/clubs/1/agent/chat", headers=h, json={"message": "log pizza, push SBE"}).json()
    expense = next(p for p in out["proposals"] if p["kind"] == "add_expense")
    step = next(p for p in out["proposals"] if p["kind"] == "advance_approval")
    assert expense["can_confirm"] is False and expense["requires_role"]
    assert step["can_confirm"] is True
    assert client.post(f"/api/clubs/1/agent/actions/{expense['id']}/confirm", headers=h).status_code == 403
    assert client.post(f"/api/clubs/1/agent/actions/{step['id']}/confirm", headers=h).json()["record"]["status"]         == "Pending"

    h, _ = login(client, "emily")  # Treasurer can confirm the same card
    done = client.post(f"/api/clubs/1/agent/actions/{expense['id']}/confirm", headers=h).json()
    assert done["expense"]["amount"] == 80 and done["budget"]["spent"] > 0


def test_demo_reset(client):
    h, _ = login(client, "sarah")
    assert client.post("/api/demo/reset", headers=h).json()["reset"] is True
    h, _ = login(client, "sarah")
    nn = client.get("/api/clubs/1/events/1", headers=h).json()
    assert nn["readiness"]["score"] == 75


def test_gemini_fallback_chain(monkeypatch):
    from google.genai import errors
    from app import config

    calls = []

    class FakeModels:
        def generate_content(self, model, contents, config):
            calls.append((model, config.thinking_config is not None))
            if model != "lite":
                raise errors.APIError(429, {"error": {"message": "You exceeded your current quota",
                                                      "status": "RESOURCE_EXHAUSTED"}})
            if config.thinking_config is not None:
                raise errors.APIError(400, {"error": {"message": "invalid argument", "status": "INVALID_ARGUMENT"}})
            return SimpleNamespace(text="ok")

    monkeypatch.setattr(ai, "get_client", lambda: SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(config, "GEMINI_MODELS", ["main", "backup", "lite"])
    shared = types.GenerateContentConfig()
    for _ in range(2):  # the assistant reuses one config across steps
        assert ai.generate("hi", shared).text == "ok"
    assert shared.thinking_config is None
    # quota errors skip straight to the next model (no retries), lite retries without a thinking budget
    assert calls == [("main", True), ("backup", True), ("lite", True), ("lite", False)] * 2
