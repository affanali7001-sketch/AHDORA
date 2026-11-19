import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';

import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { requireAuth } from './middleware/auth.js';
import { salahRouter } from './routes/salah.js';
import { prayerRouter } from './routes/prayer.js';
import { studyRouter } from './routes/study.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());

// Allowed frontend addresses for local development
const allowedOrigins = new Set([
  config.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://10.47.228.16:5173',
]);

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
  allowedHeaders: ['Content-Type'],
  maxAge: 600,
}));

app.use(express.json({
  limit: '20kb',
  strict: true,
}));

app.use(cookieParser());

// Protect state-changing requests against unexpected origins
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');

    if (!origin || !allowedOrigins.has(origin)) {
      res.status(403).json({
        error: 'Request origin not allowed',
      });
      return;
    }
  }

  next();
});

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
  console.error(
    'API error:',
    error instanceof Error ? error.message : 'Unknown error',
  );

  res.status(500).json({
    error: 'Internal server error',
  });
});