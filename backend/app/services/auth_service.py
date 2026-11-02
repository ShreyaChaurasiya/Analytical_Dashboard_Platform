"""Authentication-related business operations."""

import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.login_challenge import LoginChallenge
from app.models.password_reset_challenge import PasswordResetChallenge
from app.models.user import RegistrationStatus, User
from app.schemas.user import (
    RegistrationCreate,
    RegistrationResponse,
)
from app.core.security import (
    generate_temporary_password,
    hash_password,
    verify_password,
)
from app.services.email_service import EmailDeliveryError, send_email


def _username_base(email: str) -> str:
    local_part = email.split("@", 1)[0].lower()
    cleaned = re.sub(r"[^a-z0-9]+", ".", local_part).strip(".")
    return (cleaned or "user")[:70]



def _generate_username(db: Session, email: str) -> str:
    base = _username_base(email)
    if db.scalar(select(User).where(User.username == base)) is None:
        return base

    for _ in range(20):
        candidate = f"{base[:62]}.{secrets.randbelow(10_000):04d}"
        if db.scalar(select(User).where(User.username == candidate)) is None:
            return candidate
    raise ValueError("Could not generate a unique username. Please try again.")


def register_user(db: Session, payload: RegistrationCreate) -> RegistrationResponse:
    email = str(payload.email).lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise ValueError("An account with this email is already registered.")

    username = _generate_username(db, email)
    temporary_password = generate_temporary_password()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    user = User(
        account_type=payload.account_type,
        full_name=payload.full_name,
        email=email,
        phone=payload.phone,
        date_of_birth=payload.date_of_birth,
        organization=payload.organization,
        job_title=payload.job_title,
        address=payload.address,
        identity_type=payload.identity_type,
        identity_number=payload.identity_number,
        status=RegistrationStatus.APPROVED.value,
        username=username,
        password_hash=hash_password(temporary_password),
        must_reset_password=True,
        temporary_password_expires_at=expires_at,
    )
    db.add(user)
    try:
        db.flush()
        send_email(
            recipient=user.email,
            subject="Your Analytical Dashboard Platform account",
            text=(
                f"Hello {user.full_name},\n\n"
                "Your account has been created.\n\n"
                f"Username: {username}\n"
                f"Temporary password: {temporary_password}\n\n"
                "Sign in and change this temporary password immediately. "
                "It expires in 24 hours."
            ),
        )
        db.commit()
        db.refresh(user)
    except EmailDeliveryError:
        db.rollback()
        raise

    return RegistrationResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        password_reset_required=user.must_reset_password,
        temporary_password_expires_at=user.temporary_password_expires_at,
        status=user.status,
        message="Registration successful. Check your email for your username and temporary password.",
        created_at=user.created_at,
    )


def _otp_digest(code: str) -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    return hmac.new(secret.encode("utf-8"), code.encode("utf-8"), hashlib.sha256).hexdigest()


def _mask_email(email: str) -> str:
    local, domain = email.split("@", 1)
    visible = local[:1]
    return f"{visible}{'*' * max(1, len(local) - 1)}@{domain}"


def start_login_challenge(db: Session, user: User) -> tuple[str, str]:
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)
    challenge = LoginChallenge(
        id=secrets.token_urlsafe(32),
        user_id=user.id,
        code_hash=_otp_digest(code),
        expires_at=now + timedelta(minutes=10),
        last_sent_at=now,
    )
    db.add(challenge)
    db.commit()

    try:
        send_email(
            recipient=user.email,
            subject="Your sign-in verification code",
            text=(
                f"Your sign-in code is {code}.\n\n"
                "It expires in 10 minutes. If you did not request this code, "
                "you can ignore this message."
            ),
        )
    except EmailDeliveryError:
        db.delete(challenge)
        db.commit()
        raise

    return challenge.id, _mask_email(user.email)


def verify_login_code(db: Session, challenge_id: str, code: str) -> User:
    challenge = db.scalar(
        select(LoginChallenge)
        .where(LoginChallenge.id == challenge_id)
        .with_for_update()
    )
    if challenge is None or challenge.consumed_at is not None:
        raise ValueError("This sign-in code is invalid or has expired.")

    now = datetime.now(timezone.utc)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now or challenge.attempts >= 5:
        challenge.consumed_at = now
        db.commit()
        raise ValueError("This sign-in code is invalid or has expired.")

    if not hmac.compare_digest(challenge.code_hash, _otp_digest(code)):
        challenge.attempts += 1
        if challenge.attempts >= 5:
            challenge.consumed_at = now
        db.commit()
        raise ValueError("The sign-in code is incorrect.")

    user = db.get(User, challenge.user_id)
    if user is None or user.status != RegistrationStatus.APPROVED.value:
        challenge.consumed_at = now
        db.commit()
        raise ValueError("This sign-in code is invalid or has expired.")

    challenge.consumed_at = now
    db.commit()
    return user


def resend_login_code(db: Session, challenge_id: str) -> None:
    challenge = db.get(LoginChallenge, challenge_id)
    now = datetime.now(timezone.utc)
    if challenge is None or challenge.consumed_at is not None:
        raise ValueError("This sign-in request is invalid or has expired.")
    if challenge.resend_count >= 3:
        raise ValueError("The resend limit was reached. Please sign in again.")

    last_sent_at = challenge.last_sent_at
    if last_sent_at.tzinfo is None:
        last_sent_at = last_sent_at.replace(tzinfo=timezone.utc)
    if now - last_sent_at < timedelta(seconds=60):
        raise ValueError("Wait 60 seconds before requesting another code.")

    user = db.get(User, challenge.user_id)
    if user is None or user.status != RegistrationStatus.APPROVED.value:
        raise ValueError("This sign-in request is invalid or has expired.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge.code_hash = _otp_digest(code)
    challenge.expires_at = now + timedelta(minutes=10)
    challenge.last_sent_at = now
    challenge.resend_count += 1
    challenge.attempts = 0

    send_email(
        recipient=user.email,
        subject="Your new sign-in verification code",
        text=(
            f"Your new sign-in code is {code}.\n\n"
            "It expires in 10 minutes. Your previous code is no longer valid."
        ),
    )
    db.commit()


def authenticate_user(
    db: Session,
    username_or_email: str,
    password: str,
) -> User:
    identifier = username_or_email.strip().lower()

    user = db.scalar(
        select(User).where(
            or_(
                User.username == identifier,
                User.email == identifier,
            )
        )
    )

    if user is None or not user.password_hash:
        raise ValueError("Invalid username or password.")

    if not verify_password(password, user.password_hash):
        raise ValueError("Invalid username or password.")

    temporary_password_expires_at = user.temporary_password_expires_at
    if temporary_password_expires_at and temporary_password_expires_at.tzinfo is None:
        temporary_password_expires_at = temporary_password_expires_at.replace(
            tzinfo=timezone.utc
        )

    if (
        user.must_reset_password
        and temporary_password_expires_at
        and temporary_password_expires_at < datetime.now(timezone.utc)
    ):
        raise ValueError(
            "Your temporary password has expired. Please request a new one."
        )

    if user.status != RegistrationStatus.APPROVED.value:
        raise ValueError("Your account is not active.")

    return user


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    if not user.password_hash or not verify_password(current_password, user.password_hash):
        raise ValueError("The current password is incorrect.")

    if verify_password(new_password, user.password_hash):
        raise ValueError("The new password must be different from the current password.")

    user.password_hash = hash_password(new_password)
    user.must_reset_password = False
    user.temporary_password_expires_at = None
    db.commit()


def start_password_reset(db: Session, email: str) -> str:
    challenge_id = secrets.token_urlsafe(32)
    normalized_email = email.strip().lower()
    user = db.scalar(
        select(User).where(
            User.email == normalized_email,
            User.status == RegistrationStatus.APPROVED.value,
        )
    )
    if user is None:
        return challenge_id

    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(timezone.utc)
    challenge = PasswordResetChallenge(
        id=challenge_id,
        user_id=user.id,
        code_hash=_otp_digest(code),
        expires_at=now + timedelta(minutes=10),
    )
    db.add(challenge)
    db.commit()

    try:
        send_email(
            recipient=user.email,
            subject="Your password reset code",
            text=(
                f"Your password reset code is {code}.\n\n"
                "It expires in 10 minutes. If you did not request this code, "
                "you can ignore this message."
            ),
        )
    except EmailDeliveryError:
        db.delete(challenge)
        db.commit()
        raise

    return challenge_id


def complete_password_reset(
    db: Session,
    challenge_id: str,
    code: str,
    new_password: str,
) -> None:
    challenge = db.scalar(
        select(PasswordResetChallenge)
        .where(PasswordResetChallenge.id == challenge_id)
        .with_for_update()
    )
    if challenge is None or challenge.consumed_at is not None:
        raise ValueError("This password reset code is invalid or has expired.")

    now = datetime.now(timezone.utc)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now or challenge.attempts >= 5:
        challenge.consumed_at = now
        db.commit()
        raise ValueError("This password reset code is invalid or has expired.")

    if not hmac.compare_digest(challenge.code_hash, _otp_digest(code)):
        challenge.attempts += 1
        if challenge.attempts >= 5:
            challenge.consumed_at = now
        db.commit()
        raise ValueError("The password reset code is incorrect.")

    user = db.get(User, challenge.user_id)
    if user is None or user.status != RegistrationStatus.APPROVED.value:
        challenge.consumed_at = now
        db.commit()
        raise ValueError("This password reset code is invalid or has expired.")

    challenge.consumed_at = now
    user.password_hash = hash_password(new_password)
    user.must_reset_password = False
    user.temporary_password_expires_at = None

    for login_challenge in db.scalars(
        select(LoginChallenge).where(
            LoginChallenge.user_id == user.id,
            LoginChallenge.consumed_at.is_(None),
        )
    ):
        login_challenge.consumed_at = now

    db.commit()
