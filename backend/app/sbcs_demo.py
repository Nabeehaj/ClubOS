"""Isolated SBCS demonstration data using the existing ClubOS schema.

Public names and contact references come from the supplied requirements.
Credentials, application accounts, financial records, vendors, tasks,
messages, capacities, and approval statuses are demonstration data.
"""

from datetime import date, datetime, timezone

from sqlmodel import Session, SQLModel

from .auth import hash_password
from .models import (
    Activity,
    Approval,
    BudgetCategory,
    Channel,
    Club,
    Event,
    EventVendor,
    Expense,
    FinancialRequest,
    Membership,
    Message,
    Reservation,
    Task,
    User,
    Vendor,
)

CLUB_NAME = "Stony Brook Computing Society"
CLUB_SLUG = "stony-brook-computing-society"
CLUB_BUDGET = 8500
EVENT_BUDGET = 4500
EVENT_START = date(2026, 10, 23)
EVENT_END = date(2026, 10, 25)
EVENT_TIMEZONE = "America/New_York"

DEMO_ACCOUNTS = {
    "eduardo": {
        "name": "Eduardo Lozano",
        "position": "President",
        "email": "eduardo@sbcs-demo.example",
        "password": "Eduardo!Demo2026",
        "public_contact": "eduardo.lozanonaranjo@stonybrook.edu",
        "responsibilities": [
            "Lead SBCS board coordination",
            "Coordinate simulated SB Engaged registration",
            "Oversee the fictional annual allocation",
        ],
    },
    "santiago": {
        "name": "Santiago Vira",
        "position": "Vice President",
        "email": "santiago@sbcs-demo.example",
        "password": "Santiago!Demo2026",
        "public_contact": "santiago.vira@stonybrook.edu",
        "responsibilities": [
            "Coordinate sponsor and partner planning",
            "Coordinate simulated room requests",
            "Support hackathon logistics",
        ],
    },
    "lara": {
        "name": "Lara Gouda",
        "position": "Secretary",
        "email": "lara@sbcs-demo.example",
        "password": "Lara!Demo2026",
        "public_contact": "lara.gouda@stonybrook.edu",
        "responsibilities": [
            "Maintain minutes and planning records",
            "Prepare attendee communications",
            "Coordinate the closing checklist",
        ],
    },
    "pravin": {
        "name": "Pravin Jegan",
        "position": "Treasurer",
        "email": "pravin@sbcs-demo.example",
        "password": "Pravin!Demo2026",
        "public_contact": "pravin.jegan@stonybrook.edu",
        "responsibilities": [
            "Maintain fictional budgets and purchases",
            "Review sample supplier quotes",
            "Coordinate simulated NXT requests",
        ],
    },
}

SPONSORS_AND_PARTNERS = [
    "Stevens Capital Management",
    "Medal.tv",
    "Photon",
    "Renaissance Technologies",
    "BAE Systems",
    "SRC",
    "CEWIT",
    "SBU Student Affairs",
    "Undergraduate Student Government",
    "Major League Hacking (event partner)",
]

CATEGORY_ALLOCATIONS = {
    "Food & Catering": 2500,
    "Merchandise": 1000,
    "Decorations": 250,
    "Equipment": 750,
    "Prizes": 2000,
    "Other SBCS Programs": 2000,
}

PURCHASES = [
    ("Food & Catering", "Meals", 1400, "catering"),
    ("Food & Catering", "Snacks", 350, "catering"),
    ("Merchandise", "T-shirts", 650, "merchandise"),
    ("Decorations", "Decorations", 150, None),
    ("Equipment", "Equipment", 450, "equipment"),
    ("Prizes", "Prizes", 1500, None),
]

DEMO_NOTICE = (
    "DEMO ONLY: budgets, purchases, vendors, tasks, messages, capacities, "
    "and workflow statuses are fictional demonstration records. "
    "They are not actual transactions, bookings, or university approvals."
)


def timestamp(day: int, hour: int = 16) -> datetime:
    return datetime(2026, 10, day, hour, tzinfo=timezone.utc)


def validate_dataset() -> None:
    if sum(CATEGORY_ALLOCATIONS.values()) != CLUB_BUDGET:
        raise ValueError("Annual allocations must total $8,500.")
    if sum(row[2] for row in PURCHASES) != EVENT_BUDGET:
        raise ValueError("Event purchases must total $4,500.")
    if EVENT_END <= EVENT_START:
        raise ValueError("SBUHacks must retain its multi-day date range.")
    emails = [account["email"] for account in DEMO_ACCOUNTS.values()]
    if len(set(emails)) != 4:
        raise ValueError("Demo login addresses must be unique.")
    if any(not email.endswith("@sbcs-demo.example") for email in emails):
        raise ValueError("Use separate fictional demo login addresses.")


def require_empty_database(session: Session) -> None:
    if session.new or session.dirty or session.deleted:
        raise ValueError("Use a clean session for the empty demo database.")

    connection = session.connection()
    for table in SQLModel.metadata.tables.values():
        if connection.execute(table.select().limit(1)).first() is not None:
            raise ValueError(
                "SBCS seeding requires an empty demo database. "
                "Choose a separate SQLite file; do not reset existing data."
            )


def seed_sbcs(session: Session) -> dict:
    """Insert demo rows without committing, deleting, or resetting data."""
    validate_dataset()
    require_empty_database(session)

    users = {}
    for key, account in DEMO_ACCOUNTS.items():
        user = User(
            name=account["name"],
            email=account["email"],
            password_hash=hash_password(account["password"]),
            avatar_url=None,
            major=None,
            class_year=None,
        )
        session.add(user)
        users[key] = user

    club = Club(
        name=CLUB_NAME,
        slug=CLUB_SLUG,
        category="Academic / Professional",
        description=(
            "Stony Brook Computing Society (SBCS). "
            "Stony Brook University; College of Engineering and Applied "
            "Sciences (CEAS). A student-run computing organization that "
            "brings together students interested in computer science, "
            "programming, technology, hackathons, and professional development. "
            "Website: https://sbcs.io/. "
            "Logo: text placeholder; no official logo asset is supplied. "
            "The four members are the demo E-board, not a claim about total "
            "SBCS membership. The $8,500 allocation is fictional. "
            + DEMO_NOTICE
        ),
        member_count=4,
        annual_budget=CLUB_BUDGET,
        email="sbcomputingsociety@cs.stonybrook.edu",
        logo_url=None,
        accent_color="#6C5CE7",
    )
    session.add(club)
    session.flush()

    for key, account in DEMO_ACCOUNTS.items():
        session.add(
            Membership(
                user_id=users[key].id,
                club_id=club.id,
                position=account["position"],
                responsibilities=[
                    *account["responsibilities"],
                    (
                        f"Public contact reference: {account['public_contact']}. "
                        "Sign in with the separate fictional demo address."
                    ),
                    "This ClubOS account is a demonstration profile.",
                ],
            )
        )

    event = Event(
        club_id=club.id,
        name="SBUHacks 2026",
        date=EVENT_START,
        start_time="17:00",
        end_time="15:30",
        location="Melville Library Central Reading Room",
        description=(
            "Organized by Stony Brook Computing Society (SBCS). "
            "MULTI-DAY: October 23, 2026 at 5:00 PM through October 25, "
            "2026 at 3:30 PM, America/New_York. "
            "Hacking: Melville Library Central Reading Room. "
            "Closing ceremony: Student Activities Center Auditorium. "
            "The end_time field refers to October 25, not October 23. "
            "Sponsors and partners from the supplied project dataset: "
            + "; ".join(SPONSORS_AND_PARTNERS)
            + ". "
            + DEMO_NOTICE
            + "\nEnd date: 2026-10-25\nTimezone: America/New_York"
        ),
        lead_id=users["eduardo"].id,
        budget=EVENT_BUDGET,
        expected_attendance=0,
        status="Planning",
        created_at=timestamp(1),
    )
    session.add(event)
    session.flush()

    categories = {
        name: BudgetCategory(club_id=club.id, name=name, planned=amount)
        for name, amount in CATEGORY_ALLOCATIONS.items()
    }
    session.add_all(categories.values())

    vendor_rows = [
        (
            "catering",
            "Demo Hackathon Catering",
            "Food",
            "orders@catering-demo.example",
            ["Meals", "Snacks", "Dietary option planning"],
            1750,
        ),
        (
            "merchandise",
            "Demo Campus Merchandise",
            "Merchandise",
            "quotes@merch-demo.example",
            ["T-shirts", "Artwork proofs"],
            650,
        ),
        (
            "equipment",
            "Demo Event Equipment",
            "Equipment",
            "rentals@equipment-demo.example",
            ["Presentation equipment", "Adapters", "Audio equipment"],
            450,
        ),
    ]
    vendors = {}
    for key, name, category, email, services, cost in vendor_rows:
        vendor = Vendor(
            club_id=club.id,
            name=name,
            category=category,
            contact_name="Fictional demo contact",
            email=email,
            services=services,
            estimated_cost=cost,
            notes=(
                "Fictional demonstration supplier; not SBU-verified. "
                "No actual order, rental, or contract exists."
            ),
            is_sample=True,
        )
        session.add(vendor)
        vendors[key] = vendor
    session.flush()

    for vendor in vendors.values():
        session.add(
            EventVendor(
                event_id=event.id,
                vendor_id=vendor.id,
                status="Considering",
                quoted_amount=vendor.estimated_cost,
            )
        )

    for category, label, amount, vendor_key in PURCHASES:
        session.add(
            Expense(
                club_id=club.id,
                category_id=categories[category].id,
                event_id=event.id,
                vendor_id=vendors[vendor_key].id if vendor_key else None,
                description=f"DEMO ONLY — SBUHacks 2026: {label}",
                amount=amount,
                spent_on=date(2026, 10, 22),
                created_by_id=users["pravin"].id,
                created_at=timestamp(22),
            )
        )

    session.add(
        FinancialRequest(
            club_id=club.id,
            event_id=event.id,
            title="DEMO ONLY — SBUHacks 2026 purchase plan",
            amount=EVENT_BUDGET,
            status="Draft",
            notes=(
                "Simulated NXT request for the same $4,500 represented by "
                "the six fictional purchases. This is not an additional "
                "$4,500 expense. " + DEMO_NOTICE
            ),
            simulated=True,
        )
    )

    session.add(
        Reservation(
            club_id=club.id,
            event_id=event.id,
            space="Melville Library Central Reading Room",
            requested_date=EVENT_START,
            start_time="17:00",
            end_time="23:59",
            capacity=300,
            status="Pending",
            submit_deadline=date(2026, 10, 9),
            notes=(
                "SIMULATED ONLY. Capacity 300 is fictional demo input, "
                "not a verified capacity. This row represents only the "
                "October 23 opening segment. The full event continues "
                "through October 25 at 3:30 PM, America/New_York. "
                "Closing ceremony: Student Activities Center Auditorium. "
                "No real room booking or university approval is asserted."
            ),
            simulated=True,
        )
    )

    session.add(
        Approval(
            club_id=club.id,
            event_id=event.id,
            status="Pending",
            submitted_on=date(2026, 10, 15),
            deadline=date(2026, 10, 16),
            reference_number="SIM-SBCS-SBE-2026",
            required_documents=[
                {"name": "DEMO — Event registration form", "done": True},
                {"name": "DEMO — Multi-day schedule", "done": True},
                {"name": "DEMO — Food planning checklist", "done": False},
                {"name": "DEMO — Location confirmations", "done": False},
            ],
            pending_actions=[
                "Complete the simulated food checklist",
                "Attach simulated location confirmations",
                "Advance the demo reviewer workflow",
            ],
            simulated=True,
        )
    )

    task_rows = [
        (
            "Submit simulated 25Live planning request",
            "santiago", "Completed", "High", 9,
            "Include the multi-day schedule and closing location.",
        ),
        (
            "Prepare fictional purchase plan",
            "pravin", "Completed", "High", 12,
            "Keep the $4,500 event plan separate from the $8,500 annual budget.",
        ),
        (
            "Prepare simulated SB Engaged registration",
            "eduardo", "Completed", "High", 15,
            "A submitted demo checklist does not imply actual approval.",
        ),
        (
            "Draft attendee schedule and location guide",
            "lara", "Completed", "Medium", 20,
            "Show both event dates and America/New_York times.",
        ),
        (
            "Review sponsor and partner checklist",
            "santiago", "In Progress", "Medium", 22,
            "Use the supplied list; do not imply actual outreach.",
        ),
        (
            "Review sample catering and dietary checklist",
            "pravin", "In Progress", "High", 23,
            "Demo supplier only; do not place orders or send messages.",
        ),
        (
            "Coordinate Saturday demo check-in",
            "eduardo", "To Do", "High", 24,
            "Fictional operational task for the second day.",
        ),
        (
            "Run through closing ceremony checklist",
            "lara", "To Do", "High", 25,
            "SAC Auditorium; final ceremony ends at 3:30 PM.",
        ),
    ]
    for title, owner, status, priority, day, description in task_rows:
        session.add(
            Task(
                club_id=club.id,
                event_id=event.id,
                title=f"DEMO — {title}",
                description=f"{description} {DEMO_NOTICE}",
                assignee_id=users[owner].id,
                created_by_id=users["eduardo"].id,
                status=status,
                priority=priority,
                due_date=date(2026, 10, day),
                created_at=timestamp(1),
                completed_at=timestamp(day) if status == "Completed" else None,
            )
        )

    channels = {}
    for key, name in [
        ("general", "general"),
        ("board", "executive-board"),
        ("planning", "event-planning"),
        ("finance", "finance"),
    ]:
        channel = Channel(
            club_id=club.id,
            event_id=event.id if key == "planning" else None,
            name=name,
            description="SBCS fictional demo conversation",
        )
        session.add(channel)
        channels[key] = channel
    session.flush()

    message_rows = [
        (
            "general", "eduardo",
            "Welcome to the SBCS demo workspace. These conversations are fictional.",
        ),
        (
            "board", "lara",
            "Please review the planning tasks assigned to our four demo board profiles.",
        ),
        (
            "planning", "santiago",
            "Hacking is listed in Melville Library; closing is in the SAC Auditorium.",
        ),
        (
            "planning", "lara",
            "Show October 23 at 5:00 PM through October 25 at 3:30 PM, America/New_York.",
        ),
        (
            "finance", "pravin",
            "The fictional $8,500 annual allocation has $4,500 of sample purchases, leaving $4,000.",
        ),
        (
            "finance", "eduardo",
            "The simulated NXT request refers to those same purchases, not an additional expense.",
        ),
    ]
    for index, (channel, author, body) in enumerate(message_rows):
        session.add(
            Message(
                channel_id=channels[channel].id,
                author_id=users[author].id,
                body=f"[FICTIONAL DEMO] {body}",
                created_at=timestamp(22, 12 + index),
            )
        )

    for actor, text, kind, hour in [
        (
            "eduardo",
            "DEMO — Eduardo Lozano opened the SBCS planning workspace.",
            "event", 12,
        ),
        (
            "pravin",
            "DEMO — Pravin Jegan reviewed $4,500 of fictional purchases.",
            "finance", 13,
        ),
        (
            None,
            "SIMULATED ONLY — Room and event approval requests are pending; NXT is a draft.",
            "approval", 14,
        ),
    ]:
        session.add(
            Activity(
                club_id=club.id,
                actor_id=users[actor].id if actor else None,
                event_id=event.id,
                text=text,
                kind=kind,
                created_at=timestamp(22, hour),
            )
        )

    session.flush()
    return {
        "club_id": club.id,
        "event_id": event.id,
        "users": len(users),
        "clubs": 1,
        "annual_budget": CLUB_BUDGET,
        "event_budget": EVENT_BUDGET,
        "demo_expenses": sum(row[2] for row in PURCHASES),
    }
