# AHDORA — Deployment Guide

> Status: **staging only**. This guide explains how to run AHDORA
> properly. It does NOT claim a live deployment exists — see
> "Not yet production-ready" at the bottom.

## 1. What runs where

| Piece | Command | Port |
| --- | --- | --- |
| API (Express + MongoDB + Socket.IO) | `cd api && npm ci && npm run build && npm start` | 4000 |
| Web (React + Vite, production build) | `npm ci && npm run build && npm run preview` (or serve `dist/` behind a web server) | 5173 |

Development: API `npm run dev` (tsx watch), web `npm run dev` (Vite,
proxies `/api` and `/socket.io` to the API).

Node.js 22.12+ required (`engines` in both package.json files).

## 2. Environment variables

Copy `api/.env.example` to `api/.env` and fill in real values. The
frontend needs **no** environment variables (the dev proxy is
hardcoded; production serving is covered below).

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `development` / `test` / `production`. Production enables `Secure` cookies. |
| `PORT` | no (4000) | API listen port. |
| `MONGODB_URI` | yes | MongoDB Atlas connection string. Least-privilege database user; restrict Atlas network access to the server IP. |
| `FRONTEND_ORIGIN` | yes | Public origin of the deployed frontend, e.g. `https://app.example.com`. Used for CORS, CSRF/Socket.IO origin checks, and email links. |
| `CORS_ORIGINS` | no | Extra allowed origins, comma-separated (e.g. a staging domain). `FRONTEND_ORIGIN` is always allowed; `localhost:5173` is allowed automatically in dev only. |
| `SESSION_COOKIE_NAME` | no | Default `ahdora_session`. |
| `SESSION_TTL_DAYS` | no (7) | Session lifetime, 1–30 days. |
| `CSRF_COOKIE_NAME` | no | Default `ahdora_csrf`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | **All six or none.** When missing, email verification and password reset answer **503 "email sending is not configured"** — the app never pretends an email was sent. Use an app password / API key, never a mailbox password in plain text. |

## 3. MongoDB Atlas setup

1. Create a cluster (M0 free tier is fine for staging).
2. Create a database user with read/write on the app database only.
3. Network Access: allow only the server's IP (or 0.0.0.0/0 only for a
   short staging test — never for production).
4. Put the connection string in `MONGODB_URI`. The API exits at
   startup if it cannot connect — Atlas access is required, there is
   no local fallback.

Indexes are declared in the Mongoose models (unique emails, unique
point transactions, challenge participation, etc.) and are created
automatically on first connect.

## 4. Reverse proxy + HTTPS

- Terminate TLS at the proxy (nginx/Caddy/Cloudflare). The API sets
  `trust proxy: 1`, so `Secure` cookies and rate limiting work behind
  one proxy hop.
- Proxy `/api` and `/socket.io` (with WebSocket upgrade) to the API;
  serve the web `dist/` output for everything else.
- `NODE_ENV=production` is required for `Secure` cookies. Without
  HTTPS, browsers will reject the session cookie.
- Example (nginx sketch — adapt paths/ports):
  `location /api/ { proxy_pass http://127.0.0.1:4000; }` and
  `location /socket.io/ { proxy_pass http://127.0.0.1:4000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }`

## 5. Security notes (implemented in Phase 6)

- Helmet with a strict CSP (`default-src 'none'`, `frame-ancestors
  'none'`) — the API serves JSON only.
- CORS allowlist from env; credentials are never sent to a wildcard.
- Sessions: HttpOnly + SameSite=Lax always, `Secure` in production;
  **rotated on login** (all previous sessions invalidated) and on
  password change/reset; expired sessions are pruned lazily on login
  and when an expired token is presented (there is no background
  scheduler in this codebase — nothing pretends a cron exists).
- CSRF: double-submit cookie (`X-CSRF-Token` header must equal the
  `ahdora_csrf` cookie). The frontend fetches a token from
  `GET /api/auth/csrf` before login and refreshes it once on a 403.
- Rate limits: auth group 20/15 min; login/signup/forgot-password/
  reset-password are stricter at 5/15 min; other groups 30–120/15 min
  (see `api/src/app.ts`).
- Input sanitisation: keys starting with `$` or containing `.` are
  stripped from body/query/params before handlers run (defence in
  depth — every route also validates with zod). React escapes output;
  no `dangerouslySetInnerHTML` with user data exists.
- Auth audit: every private route requires auth. Public by design:
  `GET /api/health`, Quran reading (`/api/quran/surahs*`,
  `/api/quran/search` — text only, no user data), `GET
  /api/auth/csrf`, and the email-verification / forgot / reset
  endpoints (token-gated). Everything else is behind `requireAuth`.
- Safe errors: production responses never include stack traces.
- Secrets: none are committed (verified by grep in Phase 6); see
  `api/.env.example` for placeholders only.

## 6. Socket.IO

Same API server, same session-cookie auth, origin-checked
handshake, one room per user (`user:<id>`). The server pushes only;
clients refetch authoritative data over REST. If the socket never
connects, the app still works fully over REST.

## 7. Email (SMTP)

Set all six `SMTP_*` variables to enable verification and password
reset. Tokens are random, stored hashed, single-use, expiring
(verification 24 h, reset 1 h). Without SMTP the endpoints return
503 and the UI says email is not set up yet. Verify delivery with a
real mailbox before telling users verification works.

## 8. Backups

- MongoDB Atlas: enable automated backups / point-in-time recovery
  on the cluster for anything beyond staging.
- The repo is the source of truth for code; user data lives only in
  MongoDB — back that up, not the VM.

## 9. Not yet production-ready

Honest list of what remains before this can be called production:

1. **Real MongoDB manual testing** — Phases 1–6 were typechecked,
   built and unit-tested here, but never run against a live MongoDB
   in this environment. Run the manual test steps (see each phase in
   the READMEs) against Atlas before launch.
2. **Real SMTP credentials + a delivered test email** — Ethereal was
   unreachable from this environment, so live delivery was not
   verified here. Send a real verification and reset email first.
3. **Monitoring/logging** — no error tracker, uptime monitor, or
   log aggregation is wired in yet.
4. **CI must go green on the pushed branch** — `.github/workflows/
   ci.yml` runs typecheck, build and tests on push/PR; confirm a
   green run on GitHub.
5. **Deployment target** — no host is chosen yet (VPS, Render,
   Fly.io, etc.). Pick one, then fill in `FRONTEND_ORIGIN` and
   `CORS_ORIGINS` for real.
6. **Scheduled reminders exist, web push does not** — the API now
   runs an in-process scheduler (one tick per minute, `lib/scheduler.ts`)
   that creates Hinglish in-app + Socket.IO notifications for real
   time-based events (prayer start/deadline, tasks, sleep, challenges,
   onboarding). There is still NO web push (no VAPID/service worker):
   notifications only arrive while the server runs and the user has
   the app open or re-opens it. On Android, local notifications are
   scheduled on-device (Capacitor) — see the APK work.
7. **Android app does not exist** — see `docs/ANDROID_EVALUATION.md`.
8. **Scholarly review of Quran content** — the text source is
   verified (Tanzil Uthmani via AlQuran Cloud) but nothing is
   labelled "reviewed"; keep it that way until a real review happens.
