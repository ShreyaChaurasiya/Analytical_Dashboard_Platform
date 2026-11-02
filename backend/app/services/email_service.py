"""Email delivery through SMTP."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import parseaddr

from app.core.config import settings


class EmailDeliveryError(RuntimeError):
    """Raised when an email cannot be sent."""


def send_email(*, recipient: str, subject: str, text: str) -> None:
    sender_address = parseaddr(settings.email_from)[1]
    local_part, separator, domain = sender_address.rpartition("@")
    valid_sender = (
        bool(separator)
        and bool(local_part)
        and "." in domain
        and not any(character.isspace() for character in sender_address)
    )
    if not settings.smtp_host or not valid_sender:
        raise EmailDeliveryError(
            "Email delivery is not configured. Set SMTP_HOST and set EMAIL_FROM "
            "to a valid sender address."
        )
    if settings.smtp_use_tls and settings.smtp_use_ssl:
        raise EmailDeliveryError(
            "Configure either SMTP_USE_TLS or SMTP_USE_SSL, not both."
        )
    if bool(settings.smtp_username) != bool(settings.smtp_password):
        raise EmailDeliveryError(
            "Set both SMTP_USERNAME and SMTP_PASSWORD to enable SMTP authentication."
        )

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)

    smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
    connection_options = (
        {"context": ssl.create_default_context()} if settings.smtp_use_ssl else {}
    )

    try:
        with smtp_class(
            settings.smtp_host,
            settings.smtp_port,
            timeout=10,
            **connection_options,
        ) as server:
            if settings.smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            refused_recipients = server.send_message(message)
            if refused_recipients:
                raise EmailDeliveryError(
                    "The SMTP server refused the email recipient."
                )
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        raise EmailDeliveryError(
            "Could not send email through the SMTP server."
        ) from exc
