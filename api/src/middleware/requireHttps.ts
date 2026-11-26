import type { NextFunction, Request, Response } from 'express';

/**
 * HTTP → HTTPS redirect (production only — wired in app.ts behind
 * `isProduction`, so development over plain HTTP is untouched).
 *
 * Heroku terminates TLS at its router and forwards
 * `X-Forwarded-Proto`; the app already sets `trust proxy` to 1, so
 * `req.secure` reflects the original protocol and this cannot loop.
 *
 * Why it exists: without it, http://ahdora.me/ serves the full page
 * (200) instead of redirecting, so Google treats the http:// variant
 * as a separate page — it showed up as "Crawled - currently not
 * indexed" and Google even picked http://ahdora.me/ as the canonical
 * over the declared https:// one (Search Console, 26 Nov 2026). A
 * 301 to the same URL on https:// consolidates the two variants.
 *
 * Localhost is exempt (local prod-mode smoke tests still work).
 */
export function requireHttps(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const host = req.hostname;
  const isLocalhost =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (!req.secure && !isLocalhost) {
    res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    return;
  }
  next();
}
