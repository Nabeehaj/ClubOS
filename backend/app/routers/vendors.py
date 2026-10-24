from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import activity
from ..auth import ClubContext, get_club_context
from ..db import get_session
from ..models import Event, EventVendor, Vendor

router = APIRouter(prefix="/api/clubs/{club_id}/vendors", tags=["vendors"])


class VendorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    services: list[str] = []
    estimated_cost: float = Field(default=0, ge=0)
    notes: str = ""


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    services: Optional[list[str]] = None
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


def get_vendor_or_404(session: Session, club_id: int, vendor_id: int) -> Vendor:
    v = session.get(Vendor, vendor_id)
    if not v or v.club_id != club_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


def vendor_out(session: Session, v: Vendor) -> dict:
    links = session.exec(select(EventVendor, Event).join(Event, Event.id == EventVendor.event_id)
                         .where(EventVendor.vendor_id == v.id)).all()
    return {**v.model_dump(),
            "events": [{"id": e.id, "name": e.name, "status": link.status, "quoted_amount": link.quoted_amount}
                       for link, e in links]}


@router.get("", summary="List vendors")
def list_vendors(category: Optional[str] = None, ctx: ClubContext = Depends(get_club_context),
                 session: Session = Depends(get_session)):
    q = select(Vendor).where(Vendor.club_id == ctx.club.id)
    if category:
        q = q.where(Vendor.category == category)
    return [vendor_out(session, v) for v in session.exec(q.order_by(Vendor.name)).all()]


@router.post("", status_code=201)
def create_vendor(body: VendorIn, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    v = Vendor(club_id=ctx.club.id, is_sample=False, **body.model_dump())
    session.add(v)
    activity.log(session, ctx.club.id, ctx.user.id, f"{ctx.user.name} added vendor {v.name}", "event")
    session.commit()
    session.refresh(v)
    return vendor_out(session, v)


@router.get("/{vendor_id}")
def get_vendor(vendor_id: int, ctx: ClubContext = Depends(get_club_context), session: Session = Depends(get_session)):
    return vendor_out(session, get_vendor_or_404(session, ctx.club.id, vendor_id))


@router.patch("/{vendor_id}")
def update_vendor(vendor_id: int, body: VendorUpdate, ctx: ClubContext = Depends(get_club_context),
                  session: Session = Depends(get_session)):
    v = get_vendor_or_404(session, ctx.club.id, vendor_id)
    for k, val in body.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    session.add(v)
    session.commit()
    session.refresh(v)
    return vendor_out(session, v)
