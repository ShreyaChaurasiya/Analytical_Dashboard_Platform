"""Shared FastAPI dependencies."""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import RegistrationStatus, User


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = _get_authenticated_user(credentials, db)
    if user.must_reset_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Change your temporary password before accessing the platform.",
        )
    return user


def get_user_for_password_change(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    return _get_authenticated_user(credentials, db)


def _get_authenticated_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication is required or the access token is invalid.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise unauthorized

    try:
        user_id = int(subject)
    except ValueError:
        raise unauthorized from None

    user = db.get(User, user_id)
    if user is None or user.status != RegistrationStatus.APPROVED.value:
        raise unauthorized

    return user


__all__ = ["get_current_user", "get_user_for_password_change", "get_db"]
