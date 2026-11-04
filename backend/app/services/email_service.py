"""Email delivery through SMTP."""

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

from app.core.config import settings


class EmailDeliveryError(RuntimeError):
    """Raised when an email cannot be sent."""


def _sender_address() -> str:
    configured_name, configured_address = parseaddr(settings.email_from)
    smtp_name, smtp_address = parseaddr(settings.smtp_username)

    candidate = configured_address or smtp_address
    local_part, separator, domain = candidate.rpartition("@")
    valid_sender = (
        bool(separator)
        and bool(local_part)
        and "." in domain
        and not any(character.isspace() for character in candidate)
        and domain.lower() not in {"example.com", "example.org", "test.com"}
    )
    if not valid_sender and smtp_address:
        candidate = smtp_address
        configured_name = configured_name or settings.app_name
        local_part, separator, domain = candidate.rpartition("@")
        valid_sender = (
            bool(separator)
            and bool(local_part)
            and "." in domain
            and not any(character.isspace() for character in candidate)
        )

    if not settings.smtp_host or not valid_sender:
        raise EmailDeliveryError(
            "Email delivery is not configured. Set SMTP_HOST, SMTP_USERNAME, "
            "SMTP_PASSWORD, and set EMAIL_FROM to the same address as SMTP_USERNAME."
        )

    display_name = configured_name or settings.app_name
    return formataddr((display_name, candidate))


def send_email(*, recipient: str, subject: str, text: str) -> None:
    if settings.smtp_use_tls and settings.smtp_use_ssl:
        raise EmailDeliveryError(
            "Configure either SMTP_USE_TLS or SMTP_USE_SSL, not both."
        )
    if bool(settings.smtp_username) != bool(settings.smtp_password):
        raise EmailDeliveryError(
            "Set both SMTP_USERNAME and SMTP_PASSWORD to enable SMTP authentication."
        )

    sender = _sender_address()
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)

    smtp_class = smtplib.SMTP_SSL if settings.smtp_use_ssl else smtplib.SMTP
    connection_options = {"local_hostname": "localhost"}
    if settings.smtp_use_ssl:
        connection_options["context"] = ssl.create_default_context()

    try:
        with smtp_class(
            settings.smtp_host,
            settings.smtp_port,
            timeout=30,
            **connection_options,
        ) as server:
            server.ehlo()
            if settings.smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            refused_recipients = server.send_message(message)
            if refused_recipients:
                raise EmailDeliveryError(
                    "The SMTP server refused the email recipient."
                )
    except EmailDeliveryError:
        raise
    except smtplib.SMTPAuthenticationError as exc:
        raise EmailDeliveryError(
            "SMTP login failed. For Gmail, use an App Password, not your normal "
            "account password, and make sure 2-Step Verification is enabled."
        ) from exc
    except smtplib.SMTPSenderRefused as exc:
        raise EmailDeliveryError(
            "The SMTP server rejected EMAIL_FROM. For Gmail, EMAIL_FROM must be "
            "the same Gmail address as SMTP_USERNAME."
        ) from exc
    except smtplib.SMTPRecipientsRefused as exc:
        raise EmailDeliveryError(
            "The SMTP server refused the email recipient."
        ) from exc
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        detail = str(exc).strip() or exc.__class__.__name__
        raise EmailDeliveryError(
            f"Could not send email through the SMTP server: {detail}"
        ) from exc
