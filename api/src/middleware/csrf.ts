import type { NextFunction, Request, Response } from 'express';
import { config, isProduction } from '../config.js';
import { csrfTokensEqual, generateCsrfToken } from '../lib/csrfTokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit-cookie CSRF protection.
 *
 * GET /api/auth/csrf issues a random token: it is set as a readable
 * (non-HttpOnly) SameSite=Lax cookie AND returned in the JSON body, so
 * the frontend can read it before login. On every state-changing
 * request (POST/PUT/PATCH/DELETE) the frontend sends the token back as
 * the X-CSRF-Token header; the request is accepted only when the header
 * equals the cookie value (constant-time comparison). A missing or
 * mismatched token is a 403 with an X-CSRF-Error header, which the
 * frontend uses to refresh the token once and retry. This replaces the
 * previous origin-check middleware, which blocked legitimate
 * non-browser clients and was not a real CSRF defence.
 *
 * The token response is marked `Cache-Control: no-store` and is
 * fetched with `cache: 'no-store'` on the client. That matters: the
 * cookie is shared across tabs, so any tab can rotate it by fetching
 * a new token. If the browser served a cached token body, the header
 * would hold a stale token while the cookie holds the newer one, and
 * even the client's one retry would fetch the same stale token from
 * cache and fail again — an intermittent "Invalid CSRF token" on
 * login that a page refresh appeared to fix.
 */
export function issueCsrfToken(_req: Request, res: Response): void {
  const token = generateCsrfToken();
  // Never cache the token response: a cached body can hold a token
  // the cookie no longer matches (another tab rotated it), which
  // makes even a retry fail with the same stale token.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.cookie(config.CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ csrfToken: token });
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const header = req.get('x-csrf-token');
  const cookie = req.cookies?.[config.CSRF_COOKIE_NAME];
  if (
    typeof header !== 'string' ||
    typeof cookie !== 'string' ||
    header.length === 0 ||
    !csrfTokensEqual(header, cookie)
  ) {
    res.setHeader('X-CSRF-Error', 'invalid-token');
    res.status(403).json({ error: 'Invalid CSRF token. Refresh and try again.' });
    return;
  }
  next();
}
