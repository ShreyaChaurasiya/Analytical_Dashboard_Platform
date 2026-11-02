from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.user import (
    LoginOtpResendRequest,
    LoginOtpResendResponse,
    LoginOtpVerifyRequest,
    LoginOtpVerifyResponse,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    RegistrationCreate,
    RegistrationResponse,
)
from app.services.auth_service import (
    authenticate_user,
    change_password,
    register_user,
    resend_login_code,
    start_login_challenge,
    verify_login_code,
)
from app.services.email_service import EmailDeliveryError

router = APIRouter()


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegistrationCreate, db: Session = Depends(get_db)) -> RegistrationResponse:
    try:
        return register_user(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with these details already exists.",
        ) from exc


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    try:
        user = authenticate_user(
            db,
            username_or_email=payload.username,
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    try:
        challenge_id, masked_email = start_login_challenge(db, user)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    return LoginResponse(
        challenge_id=challenge_id,
        email=masked_email,
        message="A sign-in verification code was sent to your email.",
    )


@router.post("/login/verify-otp", response_model=LoginOtpVerifyResponse)
def verify_login_otp(
    payload: LoginOtpVerifyRequest,
    db: Session = Depends(get_db),
) -> LoginOtpVerifyResponse:
    try:
        user = verify_login_code(db, payload.challenge_id, payload.code)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    token = create_access_token(subject=str(user.id))
    return LoginOtpVerifyResponse(
        access_token=token,
        username=user.username or user.email,
        password_reset_required=user.must_reset_password,
        message=(
            "Login successful. Reset your temporary password."
            if user.must_reset_password
            else "Login successful."
        ),
    )


@router.post("/login/resend-otp", response_model=LoginOtpResendResponse)
def resend_login_otp(
    payload: LoginOtpResendRequest,
    db: Session = Depends(get_db),
) -> LoginOtpResendResponse:
    try:
        resend_login_code(db, payload.challenge_id)
    except EmailDeliveryError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc

    return LoginOtpResendResponse(message="A new sign-in code was sent to your email.")


@router.post("/change-password", response_model=PasswordChangeResponse)
def change_user_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PasswordChangeResponse:
    try:
        change_password(
            db,
            user=user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return PasswordChangeResponse(message="Password changed successfully.")
