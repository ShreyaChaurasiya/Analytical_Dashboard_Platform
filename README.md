# Analytical Dashboard Platform

This repository contains the React frontend and FastAPI backend for the Analytical Dashboard Platform.

## Account flow

- Registration emails the username and temporary password to the supplied email address.
- Users sign in with their username or email and password, then verify a one-time email code to receive a bearer access token.
- Protected API routes require that token.
- Users can change their password through `POST /api/auth/change-password`; this verifies the current password and clears the temporary-password requirement.

## Email setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, and `SMTP_PASSWORD` to the values from your email provider. Leave the username and password empty if your SMTP server does not require authentication.
3. Use `SMTP_USE_TLS=true` for a STARTTLS connection (typically port 587), or set `SMTP_USE_TLS=false` and `SMTP_USE_SSL=true` for implicit TLS (typically port 465). Do not enable both.
4. Set `EMAIL_FROM` to a sender address permitted by your SMTP provider.
5. Set `JWT_SECRET_KEY` to a long, random value. Never commit `backend/.env` or share its secrets.
6. Restart the backend after changing environment values.

The sign-in code expires after 10 minutes, permits at most five verification attempts, and can be resent after a 60-second cooldown.

## Project layout

- `frontend/` — React application.
- `backend/` — FastAPI application with API, models, schemas, and service modules.

The registration and login screens use the backend authentication API.
