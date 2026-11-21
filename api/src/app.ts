import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { allowedOrigins, isProduction } from './config.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { requireAuth } from './middleware/auth.js';
import { requireCsrf } from './middleware/csrf.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { salahRouter } from './routes/salah.js';
import { prayerRouter } from './routes/prayer.js';
import { studyRouter } from './routes/study.js';
import { challengesRouter } from './routes/challenges.js';
import { rewardsRouter } from './routes/rewards.js';
import { friendsRouter } from './routes/friends.js';
import { notificationsRouter } from './routes/notifications.js';
import { feedbackRouter } from './routes/feedback.js';
import { quranRouter } from './routes/quran.js';
import { duasRouter } from './routes/duas.js';
import { hijriRouter } from './routes/hijri.js';
import { mosquesRouter } from './routes/mosques.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Helmet with a strict policy. The API serves JSON only (no HTML, no
// inline scripts), so `default-src 'none'` + `frame-ancestors 'none'`
// cannot break the app; Socket.IO is not routed through this
// middleware, and the Vite frontend is a separate origin.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS allowlist from env (CORS_ORIGINS + FRONTEND_ORIGIN). No
// wildcard origin with credentials — ever.
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  maxAge: 600,
}));

app.use(express.json({
  limit: '20kb',
  strict: true,
}));

app.use(cookieParser());

// Strip MongoDB operator keys from every request before handlers run.
app.use(sanitizeInput);

// Double-submit-cookie CSRF protection for state-changing requests.
// Replaces the old origin-check middleware, which blocked legitimate
// non-browser clients and was not a real CSRF defence.
app.use(requireCsrf);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ahdora-api',
  });
});

app.use(
  '/api/salah',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  salahRouter,
);

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  authRouter,
);

app.use(
  '/api/profile',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  profileRouter,
);

app.use(
  '/api/study',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  studyRouter,
);

app.use(
  '/api/prayer',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  prayerRouter,
);

app.use(
  '/api/challenges',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  challengesRouter,
);

app.use(
  '/api/rewards',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  rewardsRouter,
);

app.use(
  '/api/friends',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  friendsRouter,
);

app.use(
  '/api/notifications',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  notificationsRouter,
);

// Feedback / complaints (per-user; status changes are admin-only).
app.use(
  '/api/feedback',
  requireAuth,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  feedbackRouter,
);

// Quran reading (surah list/text/search) is PUBLIC by design — no
// account needed to read. Bookmarks, history and target stay behind
// requireAuth inside the router. (Previously this mount had
// requireAuth, which contradicted the documented intent.)
app.use(
  '/api/quran',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  quranRouter,
);

// Duas are public verified text — no account needed to read them.
app.use(
  '/api/duas',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  duasRouter,
);

// Hijri today/month are PUBLIC calendar info — no account needed
// to read them (Phase 15: the router-level requireAuth used to 401
// guests and users logged in on another device with the raw
// "Authentication required" string inside the calendar card).
// Settings stay behind requireAuth inside the router.
app.use(
  '/api/hijri',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  hijriRouter,
);

app.use(
  '/api/mosques',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  mosquesRouter,
);

// Production only: the API also serves the built web app, so the whole
// product runs on one origin from a single dyno (Heroku) — no CORS
// problems and cookies just work. Development is untouched: the Vite
// dev server keeps serving the frontend there.
// The global helmet CSP above is `default-src 'none'` (API serves JSON
// only), which would block the SPA's scripts, React inline styles and
// Google Fonts — so static responses carry their own SPA policy.
// `../../dist` resolves the same from `api/src/app.ts` (tsx) and from
// the built `api/dist/app.js` (node): the repo-root web build output.
if (isProduction) {
  const webDist = fileURLToPath(new URL('../../dist', import.meta.url));
  const spaCsp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  app.use(express.static(webDist, {
    index: false,
    setHeaders(res) {
      res.setHeader('Content-Security-Policy', spaCsp);
    },
  }));
  // SPA fallback: any GET that is not an API or Socket.IO path serves
  // the app shell. Unknown /api/* routes still get the JSON 404 below.
  // `/*splat` alone does not match the bare `/` path in Express 5, so
  // both are listed explicitly.
  app.get(['/', '/*splat'], (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      next();
      return;
    }
    res.setHeader('Content-Security-Policy', spaCsp);
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

app.use((
  error: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  // Safe errors: only the message is logged; the client never sees a
  // stack trace or internal details.
  console.error(
    'API error:',
    error instanceof Error ? error.message : 'Unknown error',
  );

  res.status(500).json({
    error: 'Internal server error',
  });
});
