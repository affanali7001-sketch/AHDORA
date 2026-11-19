# AHDORA

A React + TypeScript frontend and Node.js + Express + MongoDB API for AHDORA:
**Deen · Ilm · Discipline**.

## What's included

- Welcome screen with authenticated signup, login, session hydration, and logout.
- Responsive app shell with desktop sidebar and mobile navigation.
- Dashboard, Deen & Salah, Study Planner, Challenges, Quranic Guidance, Focus & Sleep, Analytics, and Profile screens.
- Persisted profile onboarding and authenticated Salah calendar/check-ins.
- Interactive study, challenge, timer, and focus surfaces with their current limitations clearly labelled.
- AHDORA logo asset and responsive dark emerald visual system.

## Important preview boundaries

The API persists accounts, profiles, sessions, and Salah records in MongoDB. Study tasks,
analytics, community challenges, notifications, and native Android focus controls are not
implemented yet and must not be treated as persisted functionality. Live prayer times require
a verified provider and location/time-zone integration. Do not use the staging deployment for
production accounts until email verification, password recovery, monitoring, and security tests
are complete.

Focus settings are visual preferences only until the native Android layer is implemented and tested.

## Requirements

- Node.js 22.12+ (recommended) or 20.19+
- npm 10+

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Production build

```bash
npm run typecheck
npm run build
npm run preview
```

## Remaining phases

1. Study/task persistence, habit tracking, and analytics derived from saved activity.
2. Live prayer-time calculation using a verified provider and time-zone handling.
3. Community challenges with consent, privacy, invites, and ownership checks.
4. Email verification, password recovery, session cleanup/rotation, and automated security tests.
5. Verified Quran content workflow with attribution/licensing review.
6. Capacitor/Kotlin native integrations for notifications and supported focus controls.

## Repository hygiene

Never commit `.env` files, database credentials, signing keys, access tokens, real user data, or production exports. Keep development and production databases separate. Add automated tests and a security review before connecting real users.

## Backend foundation

A Node.js + Express + TypeScript + MongoDB API starter is in `api/`.
Read `api/README.md` before running it. The API is staging-only: email verification and password reset are not yet enabled.
