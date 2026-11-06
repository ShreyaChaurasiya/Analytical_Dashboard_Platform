"""Record safe audit events in the caller's current database transaction."""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


ALLOWED_OUTCOMES = {"success", "failure", "denied"}
MAX_DETAILS_BYTES = 4_096
SENSITIVE_DETAIL_KEY_PARTS = (
    "password",
    "secret",
    "token",
    "otp",
    "code",
    "identity",
    "email",
    "phone",
    "address",
    "authorization",
)


def _label(value: str, field: str, max_length: int) -> str:
    normalized = value.strip().lower()
    if not normalized or len(normalized) > max_length or not re.fullmatch(r"[a-z][a-z0-9_.-]*", normalized):
        raise ValueError(f"{field} must be a short lowercase event name.")
    return normalized


def _safe_details(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _safe_details(item)
            for key, item in value.items()
            if isinstance(key, str)
            and not any(part in key.casefold() for part in SENSITIVE_DETAIL_KEY_PARTS)
        }
    if isinstance(value, (list, tuple)):
        return [_safe_details(item) for item in value]
    return value


def record_audit_event(
    db: Session,
    *,
    action: str,
    resource_type: str,
    actor_user_id: int | None = None,
    resource_id: str | int | None = None,
    outcome: str = "success",
    details: dict[str, Any] | None = None,
) -> AuditLog:
    """Add an event to the current transaction without committing it.

    Sensitive detail keys (such as passwords, tokens, email addresses, and
    identity values) are omitted. Details must be JSON-serializable and are
    capped to keep audit rows small. The caller owns commit and rollback so an
    event can be committed atomically with the operation it describes.
    """
    normalized_outcome = outcome.strip().lower()
    if normalized_outcome not in ALLOWED_OUTCOMES:
        raise ValueError(f"Outcome must be one of: {', '.join(sorted(ALLOWED_OUTCOMES))}.")

    if details is not None and not isinstance(details, dict):
        raise ValueError("Audit details must be a JSON object.")
    normalized_details = _safe_details(details or {})
    try:
        serialized_details = json.dumps(
            normalized_details,
            allow_nan=False,
            separators=(",", ":"),
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("Audit details must contain JSON-safe values.") from exc
    if len(serialized_details.encode("utf-8")) > MAX_DETAILS_BYTES:
        raise ValueError("Audit details must not exceed 4 KB.")

    event = AuditLog(
        actor_user_id=actor_user_id,
        action=_label(action, "Action", 100),
        resource_type=_label(resource_type, "Resource type", 80),
        resource_id=str(resource_id) if resource_id is not None else None,
        outcome=normalized_outcome,
        details=normalized_details,
    )
    if event.resource_id is not None and len(event.resource_id) > 128:
        raise ValueError("Resource ID must not exceed 128 characters.")

    db.add(event)
    return event
