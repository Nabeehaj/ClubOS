"""Computed event schedules without changing the database schema.

Optional description metadata:

End date: 2026-10-25
Timezone: America/New_York

For multi-day events, Event.end_time belongs to the end date.
Events without valid multi-day metadata retain legacy date-based behavior.
"""

import re
from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import Event

END_DATE_PATTERN = re.compile(
    r"^End date:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$",
    re.MULTILINE,
)
TIMEZONE_PATTERN = re.compile(
    r"^Timezone:[ \t]*([A-Za-z0-9_+\-/]+)[ \t]*$",
    re.MULTILINE,
)


def utc_now() -> datetime:
    """Separate clock function so tests can freeze time."""
    return datetime.now(timezone.utc)


def event_schedule(event: Event, now: datetime | None = None) -> dict:
    moment = now if now is not None else utc_now()
    if moment.tzinfo is None or moment.utcoffset() is None:
        raise ValueError("The schedule clock must be timezone-aware.")

    # Match the existing host-local calendar-date behavior for ordinary events.
    today = moment.astimezone().date()
    legacy = {
        "end_date": event.date,
        "timezone": None,
        "is_multi_day": False,
        "is_ongoing": False,
        "is_past": event.date < today,
        "days_until": (event.date - today).days,
    }

    description = event.description or ""
    end_matches = END_DATE_PATTERN.findall(description)
    zone_matches = TIMEZONE_PATTERN.findall(description)

    # Do not guess when metadata is missing or ambiguous.
    if len(end_matches) != 1 or len(zone_matches) != 1:
        return legacy

    try:
        end_date = datetime.strptime(end_matches[0], "%Y-%m-%d").date()
        zone = ZoneInfo(zone_matches[0])
        start_time = time.fromisoformat(event.start_time)
        end_time = time.fromisoformat(event.end_time)

        if start_time.tzinfo is not None or end_time.tzinfo is not None:
            return legacy
        if end_date <= event.date:
            return legacy

        starts_at = datetime.combine(event.date, start_time, tzinfo=zone)
        ends_at = datetime.combine(end_date, end_time, tzinfo=zone)
    except (ValueError, TypeError, ZoneInfoNotFoundError):
        return legacy

    local_now = moment.astimezone(zone)
    return {
        "end_date": end_date,
        "timezone": zone.key,
        "is_multi_day": True,
        "is_ongoing": starts_at <= local_now < ends_at,
        "is_past": local_now >= ends_at,
        "days_until": (event.date - local_now.date()).days,
    }


def event_has_not_ended(event: Event, now: datetime | None = None) -> bool:
    return not event_schedule(event, now)["is_past"]
