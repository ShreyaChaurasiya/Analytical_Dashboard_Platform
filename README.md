# Analytical Dashboard Platform

This repository contains the React frontend and FastAPI backend for the Analytical Dashboard Platform.

## Account flow

- Registration emails the username and temporary password to the supplied email address.
- Users sign in with their username or email and password, then verify a one-time email code to receive a bearer access token.
- Temporary-password sign-ins must change the password before accessing the platform.
- Forgot password sends a one-time code to the registered email; the code expires after 10 minutes and allows at most five attempts.
- Protected API routes require that token.
- Users can change their password through `POST /api/auth/change-password`; this verifies the current password and clears the temporary-password requirement.
- Password recovery uses `POST /api/auth/password/forgot` followed by `POST /api/auth/password/reset`.

## Email setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` to the values from your email provider. Leave the username and password empty if your SMTP server does not require authentication.
3. Use `SMTP_USE_TLS=true` for a STARTTLS connection (typically port 587), or set `SMTP_USE_TLS=false` and `SMTP_USE_SSL=true` for implicit TLS (typically port 465). Do not enable both.
4. Set `EMAIL_FROM` to a sender address permitted by your SMTP provider.
5. Set `JWT_SECRET_KEY` to a long, random value. Never commit `backend/.env` or share its secrets.
6. Restart the backend after changing environment values.

The sign-in code expires after 10 minutes, permits at most five verification attempts, and can be resent after a 60-second cooldown.
Registration, sign-in verification, and password recovery all require working SMTP settings. If they are missing or invalid, the backend returns an explicit email-delivery error and does not complete registration.

## Project layout

- `frontend/` — React application.
- `backend/` — FastAPI application with API, models, schemas, and service modules.

The registration and login screens use the backend authentication API.
