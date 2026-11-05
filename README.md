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
4. Set `EMAIL_FROM` to a sender address permitted by your SMTP provider. For Gmail, this must be the same Gmail address as `SMTP_USERNAME` (Gmail rejects `noreply@example.com`). Use a Google App Password, not your normal Gmail password.
5. Set `JWT_SECRET_KEY` to a long, random value. Never commit `backend/.env` or share its secrets.
6. Restart the backend after changing environment values.

The sign-in code expires after 10 minutes, permits at most five verification attempts, and can be resent after a 60-second cooldown.
Registration, sign-in verification, and password recovery all require working SMTP settings. If they are missing or invalid, the backend returns an explicit email-delivery error and does not complete registration.

## Project layout

- `frontend/` — React application.
- `backend/` — FastAPI application with API, models, schemas, and service modules.

The registration and login screens use the backend authentication API.

## Dataset dashboard

- The dashboard lists datasets owned by the signed-in user. Dataset uploads require the user's access token.
- On backend startup, SQLAlchemy creates the `datasets` and `dataset_versions` tables. Existing `datasets` tables gain an `owner_id` foreign key; existing rows without an owner remain private and are not shown to users.
- The upload flow supports 20 data formats: CSV, TSV, delimited TXT, XLSX, XLS, ODS, JSON, JSONL, XML, Parquet, Feather, ORC, Avro, SAS7BDAT, SAS XPORT, SPSS SAV, Stata DTA, DBF, GeoJSON, and SQLite. `.db`, `.sqlite3`, and `.ndjson` are also accepted aliases.
- Users can select multiple files or a folder; each supported file is saved as its own dataset. Uploading stores the files without analyzing them. For a multi-file selection, **Generate dashboard for all files** analyzes each file in sequence and presents one folder dashboard with separate per-file visualizations and quality review; unrelated tables are not merged. The preparation flow infers column types, profiles values, and flags missing values, duplicates, and numeric outliers without modifying source files. Report creation remains a separate action.
- Each dataset upload supports files up to 2 GiB (2 GB). Files are copied to storage in bounded chunks, and dashboard page loads avoid reading large files into memory for previews. Analysis remains synchronous and has a 1,000,000-row and 500-column limit; the upload-size limit does not guarantee that every 2 GiB file can be analyzed within available server memory.
- The application server and any reverse proxy/load balancer must be configured to accept request bodies up to at least 2 GiB and allow long upload timeouts. Uploaded files are stored under `backend/.data/datasets/`; use persistent storage with sufficient capacity.
- Dataset metadata and version statistics are stored in PostgreSQL; original files, generated reports, and dashboard downloads are stored under `backend/.data/`, which is excluded from Git. Keep this directory on persistent storage and include it in backups.
- Install the backend dependencies with `python -m pip install -r backend/requirements.txt`. The upload and format-preview endpoints use `python-multipart` and format-specific parser packages.
- The generated dashboard presents dataset metrics and plain-language insights with data-driven category bar, column, pie, or donut charts; numeric histograms and summary profiles; missing-value charts; and (when multiple numeric fields are available) a correlation heatmap. Users can switch category chart styles, choose columns, select visible sections, rename the dashboard, and save their layout. The dashboard can be printed or saved as PDF through the browser's print dialog.
- Analysis and dashboard creation are separate from report creation. From Reports, users generate a PDF or Excel (`.xlsx`) report, preview it before downloading, and choose whether to save a copy locally. PDF reports preview in the browser; Excel reports show a structured content preview. Report metadata is stored in PostgreSQL and generated files are kept under `backend/.data/reports/`.
- The Dashboard links to a searchable Data catalogue (`/datasets`), per-dataset preview and analysis details (`/datasets/{id}`), and a standalone Quality checks page (`/quality`). These pages use the existing authenticated dataset, analysis, and quality APIs.
- Dataset, report, and dashboard-download APIs are authenticated and scoped to the signed-in user. Downloading a report saves a copy to the user's device while the server copy remains available on Reports. Downloading a dashboard summary CSV also stores a server copy under `backend/.data/dashboard-exports/`; saved dashboard summaries can be re-downloaded or removed from the Dashboard Downloads menu. Deleting a dataset removes its stored versions, generated reports, and saved dashboard summaries.
- Analysis and quality checks currently run synchronously. For very large files, analysis may exceed available server memory or request timeouts; background processing and streaming analysis are needed before promising dashboard generation for every file up to the 2 GiB upload limit.
- Account settings are organized into Account, Security, Privacy & data, Display & accessibility, and Home preferences sections. Users can update their name, phone, organization, and job title through authenticated `PATCH /api/settings/profile`. Sign-in email changes require the current password and verification of a code sent to the new address; the previous address receives a security notice. Password changes use the existing authenticated password endpoint, and the Security section lets users sign out of the current browser.
- Main preferences (light/dark theme, text size, high contrast, reduced motion, post-sign-in landing page, and Home featured public-data example) and separate dashboard defaults (dataset, view, time range, and report format) are saved per user in PostgreSQL through the authenticated `/api/settings` endpoint. Existing accounts receive defaults automatically.
- Original uploaded dataset files are not currently exposed as downloads. Report and dashboard files are stored on the server and copied to the user's device when downloaded; deleting a server copy does not delete the device copy.
- The Privacy & data section lists account-owned datasets and requires a separate confirmation before deleting one; deletion removes its versions, analyses, quality findings, generated report files, and saved dashboard summaries. Users can also permanently delete their account after re-entering their password and account name. Account deletion removes associated database records and server-side files; previously downloaded files remain on the user's device.
