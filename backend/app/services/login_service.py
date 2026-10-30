"""User authentication service."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User, UserStatus
from app.schemas.user import LoginRequest, TokenResponse


def login_user(db: Session, payload: LoginRequest) -> TokenResponse:
    """Authenticate an active user and return a short-lived access token."""
    username = payload.username.strip()
    user = db.scalar(select(User).where(User.username == username))

    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != UserStatus.ACTIVE.value or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not active.",
        )

    token = create_access_token(
        subject=str(user.id),
        username=user.username,
        role=user.role,
    )

    return TokenResponse(
        access_token=token,
        must_change_password=user.must_change_password,
    )
