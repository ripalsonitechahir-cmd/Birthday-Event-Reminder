# Upcoming — Birthdays & Events

A web app for saving birthdays and other important dates and seeing **what is coming up next**.

- **Frontend:** React (Vite) + Bootstrap (react-bootstrap)
- **Backend:** Node.js + Express
- **Database:** SQLite via Prisma ORM

Requirements live in `Upcoming_Birthdays_and_Events_Detailed_Requirements.docx` and
`Upcoming_Birthdays_and_Events_Implementation_Approach.md`.

## Run it

```bash
# 1. install dependencies
npm run install:all

# 2. create the SQLite database and seed system categories
npm run setup

# 3. start the API (http://localhost:4717) and the UI (http://localhost:5717) in two terminals
npm run dev:server
npm run dev:client
```

Open http://localhost:5717, register, and add your first birthday.

Configuration is in `server/.env` (copy from `server/.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_ORIGIN`.
Set a strong `JWT_SECRET` and `NODE_ENV=production` for any real deployment.

## Run with Docker

```bash
cp .env.example .env   # then set JWT_SECRET to a long random value
docker compose up -d --build
```

Open http://localhost:8717 (change with `WEB_PORT`). nginx serves the UI and proxies `/api` to the API container;
SQLite data lives in the `app-data` volume and survives restarts. Stop with `docker compose down`
(add `-v` to also delete the data). In this mode `NODE_ENV=production`, so password-reset tokens are not shown on screen.

## Tests

```bash
npm test
```

Covers the recurrence/date engine (leap days, month/year ends, time zones) and the API
(validation, ownership isolation, ordering, reminders, deleting people).

## What's included (MVP)

- Accounts: register, sign in/out, password recovery, profile (time zone, date format, first day of week), change password
- People: create, edit, delete (choose to keep or delete linked events)
- Events: create, edit, duplicate, delete, complete; all-day or timed; location and notes
- Birthdays: quick-add flow, optional birth year (shows age)
- Recurrence: one-time, weekly, monthly, yearly; "repeat until"; "stop repeating from a date"
- Dashboard: **Next up** card, Today / 7 / 30 days / All windows, relative labels ("in 2 days")
- Search and filters: text, date range, category, person, recurring, status; grouped by date
- Reminders: same day, 1/2 days, 1 week, or custom days before; global on/off; in-app notification bell

## Product rules chosen

| Topic | Rule |
| --- | --- |
| Leap-day (29 Feb) events | Fall on **28 Feb** in non-leap years |
| Monthly on 29th–31st | Falls on the last day of shorter months |
| Recurring edits | Edits apply to the **whole series**; use "Stop repeating" to end it from a date |
| Deleting a person | Linked events are **kept** unless you choose to delete them |
| Reminders | In-app only (a background job runs every 15 minutes); one notification per reminder per occurrence |
| Password recovery | No email channel yet: outside production the reset token is returned by the API and shown as a link |
| Dates | Stored as `YYYY-MM-DD` and evaluated in the user's time zone, so they never shift |

## Layout

```
server/  Express API, Prisma schema (prisma/), domain logic (src/domain), reminder job (src/jobs), tests
client/  React app (src/pages, src/components)
```

Not yet built (Phase 2 / bonus): calendar view, import/export, email notifications, Kubernetes, CI/CD.
