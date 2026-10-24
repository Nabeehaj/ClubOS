from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlmodel import Session, select

from ..auth import create_token, get_current_user, verify_password
from ..config import FINANCE_POSITIONS
from ..db import get_session
from ..models import Club, Membership, User
from ..services import club_out, user_brief

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


def my_clubs(session: Session, user: User) -> list[dict]:
    rows = session.exec(
        select(Club, Membership).join(Membership, Membership.club_id == Club.id)
        .where(Membership.user_id == user.id).order_by(Membership.id)
    ).all()
    return [
        {**club_out(c), "position": m.position, "can_manage_finance": m.position in FINANCE_POSITIONS}
        for c, m in rows
    ]


def login_response(session: Session, user: User) -> dict:
    clubs = my_clubs(session, user)
    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": user_brief(user),
        "clubs": clubs,
        "default_club_id": clubs[0]["id"] if clubs else None,
    }


def authenticate(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email.strip().lower())).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return user


@router.post("/login", summary="Log in")
def login(body: LoginIn, session: Session = Depends(get_session)):
    return login_response(session, authenticate(session, body.email, body.password))


@router.post("/token", summary="Log in (form-encoded, used by /docs)")
def token(form: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    return login_response(session, authenticate(session, form.username, form.password))


@router.get("/me", summary="Current user and clubs")
def me(user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    clubs = my_clubs(session, user)
    return {"user": user_brief(user), "clubs": clubs, "default_club_id": clubs[0]["id"] if clubs else None}
