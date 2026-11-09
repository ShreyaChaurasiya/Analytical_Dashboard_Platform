"""Authenticated account and dashboard settings."""

import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.security import verify_password
from app.db.session import get_db
from app.models.dataset import Dataset
from app.models.dashboard_export import DashboardExport
from app.models.email_change_challenge import EmailChangeChallenge
from app.models.report import Report
from app.models.user import User
from app.schemas.settings import (
    AccountDeletionRequest,
    AccountDeletionResponse,
    EmailChangeResponse,
    EmailChangeStartRequest,
    EmailChangeStartResponse,
    EmailChangeVerifyRequest,
    UserProfileUpdate,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.services.dataset_service import get_owned_dataset
from app.services.email_service import EmailDeliveryError, send_email
from app.services.storage_service import (
    delete_dashboard_export_file,
    delete_dataset_file,
    delete_report_file,
)

router = APIRouter(tags=["settings"])
logger = logging.getLogger(__name__)


def _email_change_digest(code: str) -> str:
    secret = os.getenv("JWT_SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY is not configured")
    return hmac.new(secret.encode("utf-8"), code.encode("utf-8"), hashlib.sha256).hexdigest()


def _mask_email(email: str) -> str:
    local, domain = email.split("@", 1)
    return f"{local[:1]}{'*' * max(1, len(local) - 1)}@{domain}"


DEFAULT_PREFERENCES = {
    "theme": "light",
    "text_size": "default",
    "contrast_mode": "standard",
    "reduce_motion": False,
    "default_landing_page": "dashboard",
    "home_featured_sample": "rainfall",
    "dashboard_default_dataset_id": None,
    "dashboard_analysis_view": "overview",
    "dashboard_time_range": "all",
    "dashboard_report_format": "pdf",
}


def _settings_response(user: User) -> UserSettingsResponse:
    return UserSettingsResponse(
        full_name=user.full_name,
        email=user.email,
        username=user.username,
        phone=user.phone,
        account_type=user.account_type,
        organization=user.organization,
        job_title=user.job_title,
        account_status=user.status,
        account_created_at=user.created_at,
        **{
            **DEFAULT_PREFERENCES,
            **(user.preferences or {}),
        },
    )


@router.get("", response_model=UserSettingsResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
) -> UserSettingsResponse:
    return _settings_response(current_user)


@router.patch("/profile", response_model=UserSettingsResponse)
def update_profile(
    update: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserSettingsResponse:
    changes = update.model_dump()
    current_user.full_name = changes["full_name"]
    current_user.phone = changes["phone"]
    current_user.organization = changes["organization"]
    current_user.job_title = changes["job_title"]
    try:
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not save profile for user %s.", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Your account details could not be saved.",
        ) from error
    return _settings_response(current_user)


@router.post("/email-change", response_model=EmailChangeStartResponse)
def start_email_change(
    update: EmailChangeStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailChangeStartResponse:
    if not current_user.password_hash or not verify_password(
        update.current_password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current password is incorrect.",
        )

    new_email = str(update.new_email).strip().lower()
    if new_email == current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter an email address different from your current one.",
        )
    existing_user = db.scalar(select(User.id).where(User.email == new_email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email address is already associated with an account.",
        )

    now = datetime.now(timezone.utc)
    for pending in db.scalars(
        select(EmailChangeChallenge).where(
            EmailChangeChallenge.user_id == current_user.id,
            EmailChangeChallenge.consumed_at.is_(None),
        )
    ):
        pending.consumed_at = now

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = EmailChangeChallenge(
        id=secrets.token_urlsafe(32),
        user_id=current_user.id,
        new_email=new_email,
        code_hash=_email_change_digest(code),
        expires_at=now + timedelta(minutes=10),
    )
    db.add(challenge)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not start email change for user %s.", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email change verification could not be started.",
        ) from error

    try:
        send_email(
            recipient=new_email,
            subject="Verify your new Analytical Dashboard Platform email",
            text=(
                f"Your email change verification code is {code}.\n\n"
                "It expires in 10 minutes. If you did not request this change, "
                "you can ignore this message."
            ),
        )
    except EmailDeliveryError as error:
        challenge.consumed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    return EmailChangeStartResponse(
        challenge_id=challenge.id,
        masked_email=_mask_email(new_email),
        message="A verification code was sent to your new email address.",
    )


@router.post("/email-change/verify", response_model=EmailChangeResponse)
def verify_email_change(
    update: EmailChangeVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EmailChangeResponse:
    challenge = db.scalar(
        select(EmailChangeChallenge)
        .where(
            EmailChangeChallenge.id == update.challenge_id,
            EmailChangeChallenge.user_id == current_user.id,
        )
        .with_for_update()
    )
    if challenge is None or challenge.consumed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email verification code is invalid or has expired.",
        )

    now = datetime.now(timezone.utc)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now or challenge.attempts >= 5:
        challenge.consumed_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email verification code is invalid or has expired.",
        )
    if not hmac.compare_digest(challenge.code_hash, _email_change_digest(update.code)):
        challenge.attempts += 1
        if challenge.attempts >= 5:
            challenge.consumed_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The email verification code is incorrect.",
        )

    old_email = current_user.email
    current_user.email = challenge.new_email
    challenge.consumed_at = now
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email address is already associated with an account.",
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not update email for user %s.", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Your email address could not be updated.",
        ) from error

    notification_sent = True
    try:
        send_email(
            recipient=old_email,
            subject="Your Analytical Dashboard Platform email was changed",
            text=(
                f"The sign-in email for your account was changed to {current_user.email}.\n\n"
                "If you did not make this change, contact your organization administrator."
            ),
        )
    except EmailDeliveryError:
        notification_sent = False
        logger.exception("Email changed for user %s, but the security notice was not delivered.", current_user.id)

    return EmailChangeResponse(
        email=current_user.email,
        message=(
            "Email updated. A security notice was sent to your previous address."
            if notification_sent
            else "Email updated, but we could not send a security notice to your previous address."
        ),
        notification_sent=notification_sent,
    )


@router.delete("/account", response_model=AccountDeletionResponse)
def delete_account(
    request: AccountDeletionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AccountDeletionResponse:
    if not current_user.password_hash or not verify_password(
        request.current_password, current_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The current password is incorrect.",
        )
    if request.confirmation_name.strip() != current_user.full_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The account name does not match. No data was deleted.",
        )

    account_email = current_user.email
    account_name = current_user.full_name
    datasets = db.scalars(
        select(Dataset)
        .options(selectinload(Dataset.versions))
        .where(Dataset.owner_id == current_user.id)
    ).all()
    dataset_ids = [dataset.id for dataset in datasets]
    dataset_paths = {
        dataset.file_path for dataset in datasets if dataset.file_path
    } | {
        version.file_path
        for dataset in datasets
        for version in dataset.versions
    }
    report_paths = (
        db.scalars(
            select(Report.file_path).where(Report.dataset_id.in_(dataset_ids))
        ).all()
        if dataset_ids
        else []
    )
    dashboard_export_paths = db.scalars(
        select(DashboardExport.file_path).where(DashboardExport.user_id == current_user.id)
    ).all()
    db.delete(current_user)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not delete account for user %s.", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Your account could not be deleted. No deletion was completed.",
        ) from error

    storage_cleanup_complete = True
    for file_path in dataset_paths:
        try:
            delete_dataset_file(file_path)
        except (OSError, ValueError):
            storage_cleanup_complete = False
            logger.exception("Could not remove a dataset file while deleting account %s.", account_email)
    for file_path in report_paths:
        try:
            delete_report_file(file_path)
        except (OSError, ValueError):
            storage_cleanup_complete = False
            logger.exception("Could not remove a report file while deleting account %s.", account_email)
    for file_path in dashboard_export_paths:
        try:
            delete_dashboard_export_file(file_path)
        except (OSError, ValueError):
            storage_cleanup_complete = False
            logger.exception("Could not remove a dashboard export while deleting account %s.", account_email)

    notification_sent = True
    try:
        send_email(
            recipient=account_email,
            subject="Your Analytical Dashboard Platform account was deleted",
            text=(
                f"Hello {account_name},\n\n"
                "Your account and account-associated database records have been deleted. "
                "Any previously downloaded files remain on the device where they were saved."
            ),
        )
    except EmailDeliveryError:
        notification_sent = False
        logger.exception("Account %s was deleted, but the confirmation email was not delivered.", account_email)

    return AccountDeletionResponse(
        message=(
            "Account deleted."
            if notification_sent and storage_cleanup_complete
            else "Account deleted, but one or more cleanup or email-notification steps did not complete."
        ),
        notification_sent=notification_sent,
        storage_cleanup_complete=storage_cleanup_complete,
    )


@router.patch("", response_model=UserSettingsResponse)
def update_settings(
    update: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserSettingsResponse:
    changes = update.model_dump(exclude_unset=True)
    if "dashboard_default_dataset_id" in changes:
        dataset_id = changes["dashboard_default_dataset_id"]
        if dataset_id is not None:
            get_owned_dataset(db, dataset_id, current_user.id)

    preferences = {**(current_user.preferences or {}), **changes}
    current_user.preferences = preferences
    try:
        db.commit()
        db.refresh(current_user)
    except SQLAlchemyError as error:
        db.rollback()
        logger.exception("Could not save settings for user %s.", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Your settings could not be saved.",
        ) from error
    return _settings_response(current_user)
