from typing import Optional

from sqlmodel import Session

from .models import Activity


def log(session: Session, club_id: int, actor_id: Optional[int], text: str, kind: str = "general",
        event_id: Optional[int] = None) -> None:
    """Add an activity entry (caller commits)."""
    session.add(Activity(club_id=club_id, actor_id=actor_id, text=text, kind=kind, event_id=event_id))
