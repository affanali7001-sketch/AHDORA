# AHDORA API (staging foundation)

Node.js + Express + TypeScript + MongoDB/Mongoose API starter.

## Local setup

1. Install Node.js 22.12+.
2. `cd api`
3. `npm install`
4. Copy `.env.example` to `.env` and fill `MONGODB_URI` with a MongoDB Atlas M0 connection string. Never commit `.env`.
5. Keep `FRONTEND_ORIGIN=http://localhost:5173` for local development.
6. `npm run dev`
7. Check `http://localhost:4000/api/health`.

## Implemented routes

- `GET /api/health`
- `POST /api/auth/signup` (12+ character password, Argon2id, generic duplicate-account response)
- `POST /api/auth/login` (generic credential failure)
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/profile` (authenticated)
- `POST /api/profile` (authenticated upsert)
- `GET /api/salah/day/:date` (authenticated)
- `PUT /api/salah/day/:date` (authenticated)
- `GET /api/salah/calendar/:month` (authenticated)
- `GET /api/prayer/times?date=YYYY-MM-DD` (authenticated, rate limit 60/15 min) — live times from Aladhan for the user's saved city/country/method/Asr school. Returns timings, per-prayer time/deadline/reminder/source (`calculated` or `manual` when a time override is set), Hijri date, and the next prayer. `date` defaults to today.
- `GET /api/study/subjects`, `POST /api/study/subjects`, `PUT /api/study/subjects/:id`, `DELETE /api/study/subjects/:id` (authenticated, rate limit 120/15 min) — per-user subjects. Deleting a subject unlinks its tasks (`subjectId` → null) instead of deleting them.
- `GET /api/study/tasks` (optional `?status=&subjectId=&dueDate=`), `POST /api/study/tasks`, `GET /api/study/tasks/:id`, `PUT /api/study/tasks/:id`, `PATCH /api/study/tasks/:id/status`, `DELETE /api/study/tasks/:id` (authenticated, rate limit 120/15 min) — per-user tasks. Completing a task stamps `completedAt`.
- `GET /api/study/today` (authenticated) — today's tasks (due today or earlier and not completed, unscheduled tasks included, completed-today tasks included) ordered by due date then start time, plus the college/study schedule from the user's profile.
- `GET /api/study/stats` (authenticated) — today focus minutes, tasks completed today, week focus minutes, current streak, and a per-subject breakdown (tasks done/total, focus minutes this week).
- `POST /api/study/pomodoro/start` (authenticated, `mode` focus/break, `plannedMinutes` 1–180, optional `taskId`/`subjectId`; 409 if a timer is already active), `GET /api/study/pomodoro/active`, `POST /api/study/pomodoro/:id/pause|resume|complete|abandon`, `GET /api/study/pomodoro/history?page=&limit=` (newest first, completed + abandoned only) — the server stores `startedAt` + `pausedTotalMs` and derives `remainingMs`, so the timer is the source of truth across refresh/logout/device change. Abandoned sessions stay in history with 0 minutes earned.

Sessions use opaque random tokens. Only SHA-256 token hashes are stored in MongoDB; the browser cookie is HttpOnly, SameSite=Lax, and Secure in production. API mutations require the configured exact Origin. CORS is allowlisted. Helmet, JSON body size limits, Zod strict schemas, and auth rate limiting are enabled.

The profile onboarding is an eight-step frontend flow (personal, education, college,
study, location & prayer calculation, individual prayer timings, sleep, review & save).
New optional fields are backward-compatible with existing profile documents; no existing
users or records are deleted or migrated destructively.

### Prayer times — method & school mapping

Aladhan `method` is mapped from the saved calculation method name: University of Islamic
Sciences, Karachi → 1, ISNA → 2, Muslim World League → 3, Umm al-Qura University, Makkah → 4,
Egyptian General Authority → 5 (default 1). `school` is 1 for Hanafi Asr, 0 for Standard/Shafi.
A per-prayer `timeOverride` in the profile replaces the calculated time and is marked
`source: "manual"`; otherwise the source is `calculated`. A per-prayer `endTime` is the
deadline, otherwise the next prayer's time (Isha: 23:59).

Error cases (no times are ever invented):
- No city saved → `400 { error: "Add your city in onboarding to see prayer times." }`
- Bad `date` → `400 { error: "Date must be YYYY-MM-DD" }`
- Aladhan unreachable, timeout (8s), or incomplete response → `502 { error: "Prayer times could not be loaded from Aladhan. Please try again later." }`
- Times are not cached in the database.

### Streak rule

A day counts when a focus session finishes OR a task is completed. The streak is
the run of consecutive active days ending today — or yesterday, if today has no
activity yet.

### Pomodoro resume

The server stores `startedAt` and `pausedTotalMs`. Remaining time is
`planned − (now − startedAt − pausedTotalMs − current pause)`. Pause stamps
`pausedAt`; resume adds that stretch to `pausedTotalMs`. The client re-fetches
the active session after a refresh, logout, or device change and the timer
simply continues. Focus minutes earned are the whole minutes actually run when
a focus session completes (0 for breaks and abandoned sessions).

Error cases (no data is ever invented):
- A second timer while one is active/paused → `409 { error: "A focus timer is already running. Pause or finish it first." }`
- A subject/task/session id that is not the user's (or malformed) → `404` / `400`
- Invalid task/subject/timer fields → `400 { error: "Invalid ..." }`

## Not production-ready yet

- Email verification and password reset are not enabled. Do not use this staging API for real accounts.
- Before cross-site production deployment, use a same-site custom domain or implement and test a robust CSRF strategy with the selected cookie settings. Do not loosen CORS or set `allowedOrigins: *`.
- Add automated auth/authorization tests, session cleanup/rotation, account recovery, audit events, backups, monitoring, and production deployment review.
- Do not expose MongoDB credentials in frontend `VITE_*` variables.
