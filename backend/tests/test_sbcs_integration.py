"""Proposed SBCS API and multi-day regression tests.

These tests have not been executed as part of the code-generation task.
"""

from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

import app.event_schedule as schedule_module
from app.auth import hash_password
from app.db import get_session
from app.event_schedule import event_schedule
from app.models import Club, Event, Membership, User
from app.routers import auth, clubs, dashboard, events, finance
from app.sbcs_demo import (
    CLUB_NAME,
    DEMO_ACCOUNTS,
    SPONSORS_AND_PARTNERS,
    seed_sbcs,
)


@pytest.fixture
def preview(monkeypatch):
    monkeypatch.setattr(
        schedule_module,
        "utc_now",
        lambda: datetime(2026, 10, 24, 16, tzinfo=timezone.utc),
    )

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        ids = seed_sbcs(session)
        session.commit()

    application = FastAPI()

    def test_session():
        with Session(engine) as session:
            yield session

    application.dependency_overrides[get_session] = test_session
    for router in (
        auth.router,
        clubs.router,
        dashboard.router,
        events.router,
        finance.router,
    ):
        application.include_router(router)

    try:
        with TestClient(application) as client:
            yield client, engine, ids
    finally:
        application.dependency_overrides.clear()
        engine.dispose()


def login(client, key):
    account = DEMO_ACCOUNTS[key]
    response = client.post(
        "/api/auth/login",
        json={
            "email": account["email"],
            "password": account["password"],
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data


@pytest.mark.parametrize("key", list(DEMO_ACCOUNTS))
def test_account_identity_and_membership(preview, key):
    client, _, ids = preview
    headers, data = login(client, key)
    account = DEMO_ACCOUNTS[key]

    assert data["user"]["name"] == account["name"]
    assert data["default_club_id"] == ids["club_id"]
    assert len(data["clubs"]) == 1
    assert data["clubs"][0]["name"] == CLUB_NAME
    assert data["clubs"][0]["position"] == account["position"]

    response = client.get(
        f"/api/clubs/{ids['club_id']}/dashboard",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["me"]["name"] == account["name"]
    assert body["me"]["position"] == account["position"]
    assert body["stats"]["board_members"] == 4
    assert body["club"]["name"] == CLUB_NAME


def test_real_contact_address_is_not_a_login(preview):
    client, _, _ = preview
    account = DEMO_ACCOUNTS["eduardo"]
    response = client.post(
        "/api/auth/login",
        json={
            "email": account["public_contact"],
            "password": account["password"],
        },
    )
    assert response.status_code == 401


def test_requires_authentication(preview):
    client, _, ids = preview
    assert client.get(
        f"/api/clubs/{ids['club_id']}/dashboard"
    ).status_code == 401


def test_board_contains_only_the_four_demo_profiles(preview):
    client, _, ids = preview
    headers, _ = login(client, "eduardo")
    response = client.get(
        f"/api/clubs/{ids['club_id']}/members",
        headers=headers,
    )
    assert response.status_code == 200
    members = response.json()
    assert len(members) == 4
    assert {member["name"] for member in members} == {
        account["name"] for account in DEMO_ACCOUNTS.values()
    }


@pytest.mark.parametrize(
    ("key", "allowed"),
    [
        ("eduardo", True),
        ("pravin", True),
        ("santiago", False),
        ("lara", False),
    ],
)
def test_finance_permissions_through_existing_endpoint(preview, key, allowed):
    client, _, ids = preview
    headers, _ = login(client, key)
    base = f"/api/clubs/{ids['club_id']}"
    summary = client.get(f"{base}/finance/summary", headers=headers).json()
    assert summary["can_manage_finance"] is allowed

    response = client.post(
        f"{base}/finance/expenses",
        headers=headers,
        json={
            "category_id": summary["categories"][0]["id"],
            "description": "DEMO ONLY — permission test",
            "amount": 7,
            "event_id": ids["event_id"],
        },
    )
    assert response.status_code == (201 if allowed else 403)


def test_budgets_and_workspace(preview):
    client, _, ids = preview
    headers, _ = login(client, "eduardo")
    base = f"/api/clubs/{ids['club_id']}"

    summary = client.get(f"{base}/finance/summary", headers=headers).json()
    assert summary["annual_budget"] == 8500
    assert summary["allocated"] == 8500
    assert summary["spent"] == 4500
    assert summary["remaining"] == 4000

    response = client.get(
        f"{base}/events/{ids['event_id']}/workspace",
        headers=headers,
    )
    assert response.status_code == 200
    workspace = response.json()
    event = workspace["event"]

    assert event["name"] == "SBUHacks 2026"
    assert event["date"] == "2026-10-23"
    assert event["end_date"] == "2026-10-25"
    assert event["start_time"] == "17:00"
    assert event["end_time"] == "15:30"
    assert event["timezone"] == "America/New_York"
    assert event["is_ongoing"] is True
    assert event["is_past"] is False
    assert event["days_until"] == -1
    assert "Student Activities Center Auditorium" in event["description"]

    for sponsor in SPONSORS_AND_PARTNERS:
        assert sponsor in event["description"]

    assert workspace["budget"]["planned"] == 4500
    assert workspace["budget"]["spent"] == 4500
    assert workspace["budget"]["remaining"] == 0
    assert len(workspace["budget"]["expenses"]) == 6
    assert all(
        "DEMO ONLY" in expense["description"]
        for expense in workspace["budget"]["expenses"]
    )

    assert len(workspace["vendors"]) == 3
    assert all(vendor["is_sample"] for vendor in workspace["vendors"])
    assert all(
        vendor["email"].endswith(".example")
        for vendor in workspace["vendors"]
    )
    assert workspace["reservation_25live"]["simulated"] is True
    assert workspace["reservation_25live"]["capacity"] >= 1
    assert workspace["sb_engaged"]["simulated"] is True
    assert all(
        request["simulated"]
        for request in workspace["financial_requests"]
    )
    assert all(
        message["body"].startswith("[FICTIONAL DEMO]")
        for message in workspace["recent_messages"]
    )


@pytest.mark.parametrize(
    ("instant", "ongoing", "past"),
    [
        ("2026-10-23T20:59:00+00:00", False, False),
        ("2026-10-23T21:00:00+00:00", True, False),
        ("2026-10-24T16:00:00+00:00", True, False),
        ("2026-10-25T19:29:59+00:00", True, False),
        ("2026-10-25T19:30:00+00:00", False, True),
        ("2026-10-26T12:00:00+00:00", False, True),
    ],
)
def test_multi_day_boundaries_across_api(
    preview, monkeypatch, instant, ongoing, past
):
    client, _, ids = preview
    monkeypatch.setattr(
        schedule_module,
        "utc_now",
        lambda: datetime.fromisoformat(instant),
    )
    headers, _ = login(client, "eduardo")
    base = f"/api/clubs/{ids['club_id']}"

    event = client.get(
        f"{base}/events/{ids['event_id']}",
        headers=headers,
    ).json()
    assert event["is_ongoing"] is ongoing
    assert event["is_past"] is past

    dashboard_data = client.get(
        f"{base}/dashboard", headers=headers
    ).json()
    dashboard_ids = {
        row["id"] for row in dashboard_data["upcoming_events"]
    }
    assert (ids["event_id"] in dashboard_ids) is (not past)

    upcoming = client.get(
        f"{base}/events",
        params={"upcoming_only": True},
        headers=headers,
    ).json()
    assert (ids["event_id"] in {row["id"] for row in upcoming}) is (not past)


def test_single_day_event_keeps_existing_date_semantics():
    moment = datetime.now(timezone.utc)
    today = moment.astimezone().date()
    event = Event(
        club_id=1,
        name="Unrelated single-day event",
        date=today,
        start_time="09:00",
        end_time="10:00",
    )
    result = event_schedule(event, now=moment)
    assert result["is_multi_day"] is False
    assert result["end_date"] == today
    assert result["is_past"] is False
    assert result["days_until"] == 0


@pytest.mark.parametrize(
    "metadata",
    [
        "End date: invalid\nTimezone: America/New_York",
        "End date: 2026-10-22\nTimezone: America/New_York",
        "End date: 2026-10-25\nTimezone: Invalid/Zone",
        "End date: 2026-10-25",
    ],
)
def test_invalid_metadata_does_not_break_ordinary_event(metadata):
    event = Event(
        club_id=1,
        name="Invalid metadata example",
        date=date(2026, 10, 23),
        description=metadata,
    )
    result = event_schedule(
        event,
        now=datetime(2026, 10, 24, 16, tzinfo=timezone.utc),
    )
    assert result["is_multi_day"] is False


def test_reseeding_refuses_existing_data(preview):
    _, engine, _ = preview
    with Session(engine) as session:
        before = len(session.exec(select(User)).all())
        with pytest.raises(ValueError, match="empty demo database"):
            seed_sbcs(session)
        assert len(session.exec(select(User)).all()) == before


def test_unrelated_club_membership_stays_protected(preview):
    client, engine, _ = preview
    with Session(engine) as session:
        other_club = Club(
            name="Unrelated demo club",
            slug="unrelated-demo-club",
            annual_budget=1234,
        )
        other_user = User(
            name="Unrelated Demo User",
            email="unrelated@example.test",
            password_hash=hash_password("Unrelated!Demo2026"),
        )
        session.add_all([other_club, other_user])
        session.flush()
        session.add(
            Membership(
                club_id=other_club.id,
                user_id=other_user.id,
                position="President",
            )
        )
        session.commit()
        other_id = other_club.id

    headers, _ = login(client, "eduardo")
    assert client.get(
        f"/api/clubs/{other_id}/dashboard",
        headers=headers,
    ).status_code == 403

    with Session(engine) as session:
        assert session.get(Club, other_id).annual_budget == 1234
