# AHDORA

A React + TypeScript frontend and Node.js + Express + MongoDB API for AHDORA:
**Deen · Ilm · Discipline**.

## What's included

- Welcome screen with authenticated signup, login, session hydration, and logout.
- Responsive app shell with desktop sidebar and mobile navigation.
- Dashboard, Deen & Salah, Study Planner, Challenges, Quranic Guidance, Focus & Sleep, Analytics, and Profile screens.
- Persisted 8-step profile onboarding (personal, education, college, study, location & prayer calculation, individual prayer timings, sleep, review & save) and authenticated Salah calendar/check-ins.
- Live prayer times from Aladhan (no API key), wired into the Dashboard and Deen & Salah screens with next-prayer countdown and real Salah completion from saved records.
- Interactive study, challenge, timer, and focus surfaces with their current limitations clearly labelled.
- AHDORA logo asset and responsive dark emerald visual system.

## Important preview boundaries

The API persists accounts, profiles, sessions, and Salah records in MongoDB. Study tasks,
analytics, community challenges, notifications, and native Android focus controls are not
implemented yet and must not be treated as persisted functionality. Live prayer times come
from Aladhan via `GET /api/prayer/times` using the city, country, calculation method and Asr
school saved in onboarding; if the city is missing or Aladhan is unreachable, no times are
invented — the UI shows an honest error state. Do not use the staging deployment for
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

## Phase 1 — done (2026-11-19, branch `phase-1-onboarding-prayer-times`)

- 8-step onboarding (was 5 steps), all new fields optional with safe defaults so existing profiles keep loading.
- Live prayer times: `GET /api/prayer/times` (Aladhan, method/school mapping, manual per-prayer overrides, deadlines, Hijri date, next prayer). Dashboard shows real times, a 30-second countdown to the next prayer, and real completion from today's saved Salah record. Deen & Salah reuses the same fetched times — no second fetch.

## Remaining phases

1. Study/task persistence, habit tracking, and analytics derived from saved activity.
2. Community challenges with consent, privacy, invites, and ownership checks.
3. Email verification, password recovery, session cleanup/rotation, and automated security tests.
4. Verified Quran content workflow with attribution/licensing review.
5. Capacitor/Kotlin native integrations for notifications and supported focus controls.

## Repository hygiene

Never commit `.env` files, database credentials, signing keys, access tokens, real user data, or production exports. Keep development and production databases separate. Add automated tests and a security review before connecting real users.

## Backend foundation

A Node.js + Express + TypeScript + MongoDB API starter is in `api/`.
Read `api/README.md` before running it. The API is staging-only: email verification and password reset are not yet enabled.
