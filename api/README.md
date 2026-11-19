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

Sessions use opaque random tokens. Only SHA-256 token hashes are stored in MongoDB; the browser cookie is HttpOnly, SameSite=Lax, and Secure in production. API mutations require the configured exact Origin. CORS is allowlisted. Helmet, JSON body size limits, Zod strict schemas, and auth rate limiting are enabled.

The profile onboarding is a five-step frontend flow. New optional schedule fields are
backward-compatible with existing profile documents; no existing users or records are
deleted or migrated destructively.

## Not production-ready yet

- Email verification and password reset are not enabled. Do not use this staging API for real accounts.
- Before cross-site production deployment, use a same-site custom domain or implement and test a robust CSRF strategy with the selected cookie settings. Do not loosen CORS or set `allowedOrigins: *`.
- Add automated auth/authorization tests, session cleanup/rotation, account recovery, audit events, backups, monitoring, and production deployment review.
- Do not expose MongoDB credentials in frontend `VITE_*` variables.
