"""Database tables. 25Live, SB Engaged and NXT records are simulated and not connected to those systems."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Allowed status values
EVENT_STATUSES = ["Planning", "Awaiting Approval", "Confirmed", "Completed", "Cancelled"]
TASK_STATUSES = ["To Do", "In Progress", "Completed"]
TASK_PRIORITIES = ["Low", "Medium", "High"]
RESERVATION_STATUSES = ["Draft", "Pending", "Approved", "Denied"]
APPROVAL_STATUSES = ["Not Started", "Draft", "Pending", "Changes Requested", "Approved"]
FINANCE_STATUSES = ["Draft", "Submitted Externally", "Pending", "Approved", "Denied"]


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    avatar_url: Optional[str] = None
    major: Optional[str] = None
    class_year: Optional[int] = None


class Club(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    description: str = ""
    category: str = ""
    member_count: int = 0
    annual_budget: float = 0
    email: Optional[str] = None
    logo_url: Optional[str] = None
    accent_color: Optional[str] = None
    public_facts: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Membership(SQLModel, table=True):
    """A user's seat on a club's executive board."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    position: str
    responsibilities: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Event(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    name: str
    date: date
    start_time: str = "18:00"
    end_time: str = "20:00"
    location: str = ""
    description: str = ""
    lead_id: Optional[int] = Field(default=None, foreign_key="user.id")
    budget: float = 0
    expected_attendance: int = 0
    status: str = "Planning"
    created_at: datetime = Field(default_factory=utcnow)


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    event_id: Optional[int] = Field(default=None, foreign_key="event.id", index=True)
    title: str
    description: str = ""
    assignee_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    status: str = "To Do"
    priority: str = "Medium"
    due_date: Optional[date] = None
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    source_message_id: Optional[int] = Field(default=None, foreign_key="message.id")
    created_at: datetime = Field(default_factory=utcnow)
    completed_at: Optional[datetime] = None


class Channel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    name: str
    description: str = ""
    event_id: Optional[int] = Field(default=None, foreign_key="event.id")


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    channel_id: int = Field(foreign_key="channel.id", index=True)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id")  # None for bot messages
    body: str
    created_at: datetime = Field(default_factory=utcnow)


class Reservation(SQLModel, table=True):
    """Simulated 25Live room reservation."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    space: str
    requested_date: date
    start_time: str
    end_time: str
    capacity: int
    status: str = "Draft"
    confirmation_number: Optional[str] = None
    submit_deadline: Optional[date] = None
    notes: str = ""
    simulated: bool = True


class Approval(SQLModel, table=True):
    """Simulated SB Engaged event approval."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    status: str = "Not Started"
    submitted_on: Optional[date] = None
    deadline: Optional[date] = None
    reference_number: Optional[str] = None
    # [{"name": "Event registration form", "done": true}, ...]
    required_documents: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    pending_actions: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    simulated: bool = True


class BudgetCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    name: str
    planned: float


class Vendor(SQLModel, table=True):
    """Sample vendor, not a verified SBU-approved business."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    name: str
    category: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    services: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    estimated_cost: float = 0
    notes: str = ""
    is_sample: bool = True


class EventVendor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    vendor_id: int = Field(foreign_key="vendor.id", index=True)
    status: str = "Considering"  # Considering / Quote Requested / Booked
    quoted_amount: Optional[float] = None


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    category_id: int = Field(foreign_key="budgetcategory.id")
    event_id: Optional[int] = Field(default=None, foreign_key="event.id", index=True)
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    description: str
    amount: float
    spent_on: date
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow)


class FinancialRequest(SQLModel, table=True):
    """Simulated NXT financial request."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    event_id: Optional[int] = Field(default=None, foreign_key="event.id", index=True)
    vendor_id: Optional[int] = Field(default=None, foreign_key="vendor.id")
    title: str
    amount: float
    status: str = "Draft"
    submitted_on: Optional[date] = None
    reference_number: Optional[str] = None
    notes: str = ""
    simulated: bool = True


class EmailDraft(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    event_id: Optional[int] = Field(default=None, foreign_key="event.id")
    template: str
    to: str
    subject: str
    body: str
    created_by_id: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=utcnow)


class Activity(SQLModel, table=True):
    """Dashboard activity feed entry."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    actor_id: Optional[int] = Field(default=None, foreign_key="user.id")
    text: str
    kind: str = "general"  # task / event / finance / approval / chat / email / ai
    event_id: Optional[int] = Field(default=None, foreign_key="event.id")
    created_at: datetime = Field(default_factory=utcnow)


class AgentAction(SQLModel, table=True):
    """Task change proposed by the AI assistant, applied only after a user confirms it."""
    id: Optional[int] = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="club.id", index=True)
    requested_by_id: int = Field(foreign_key="user.id")
    kind: str  # create_task / update_task
    summary: str
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "Proposed"  # Proposed / Applied / Rejected
    result_id: Optional[int] = None
    created_at: datetime = Field(default_factory=utcnow)
