import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  // Comma-separated allowlist of frontend origins allowed to call the
  // API with credentials (CORS + CSRF + Socket.IO). FRONTEND_ORIGIN is
  // always included. In development the local Vite origins are included
  // by default; in production set this explicitly to the deployed app.
  CORS_ORIGINS: z.string().default(''),
  SESSION_COOKIE_NAME: z.string().default('ahdora_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CSRF_COOKIE_NAME: z.string().default('ahdora_csrf'),
  // SMTP is OPTIONAL. When any of these is missing, email verification
  // and password reset are honestly unavailable (503) instead of
  // pretending an email was sent.
  SMTP_HOST: z.string().trim().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().trim().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === 'production';

/**
 * The single allowlist used by CORS, the CSRF middleware and the
 * Socket.IO handshake. FRONTEND_ORIGIN is always allowed; extra
 * origins come from CORS_ORIGINS. Development defaults cover the
 * local Vite dev server; a previously hardcoded LAN IP was removed —
 * use CORS_ORIGINS for same-Wi-Fi mobile testing instead.
 */
export const allowedOrigins: ReadonlySet<string> = new Set(
  [
    config.FRONTEND_ORIGIN,
    ...config.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    ...(isProduction
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ],
);

/** True when SMTP is fully configured and email can actually be sent. */
export const isEmailConfigured =
  Boolean(config.SMTP_HOST) &&
  Boolean(config.SMTP_PORT) &&
  Boolean(config.SMTP_USER) &&
  Boolean(config.SMTP_PASS) &&
  Boolean(config.SMTP_FROM);
