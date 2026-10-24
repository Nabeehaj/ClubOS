"""Password hashing, login tokens (JWT), and the 'who is calling / can they touch this club' checks."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from .config import FINANCE_POSITIONS, JWT_EXPIRE_HOURS, JWT_SECRET
from .db import get_session
from .models import Club, Membership, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expires}, JWT_SECRET, algorithm="HS256")


def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not logged in or session expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = int(jwt.decode(token, JWT_SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = session.get(User, user_id)
    if not user:
        raise unauthorized
    return user


class ClubContext:
    """Resolved for every /api/clubs/{club_id}/... route: the club, the caller, and their board seat."""

    def __init__(self, club: Club, user: User, membership: Membership):
        self.club = club
        self.user = user
        self.membership = membership

    @property
    def can_manage_finance(self) -> bool:
        return self.membership.position in FINANCE_POSITIONS

    def require_finance(self) -> None:
        if not self.can_manage_finance:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only {' or '.join(sorted(FINANCE_POSITIONS))} can change club finances",
            )


def get_club_context(
    club_id: int = Path(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ClubContext:
    club = session.get(Club, club_id)
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    membership = session.exec(
        select(Membership).where(Membership.club_id == club_id, Membership.user_id == user.id)
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You are not on this club's board")
    return ClubContext(club, user, membership)
