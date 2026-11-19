import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * CSRF token helpers (pure, unit-tested).
 *
 * Double-submit-cookie design: the server issues a random token and
 * stores it in a readable (non-HttpOnly) cookie; the frontend reads
 * that cookie value and sends it back as the X-CSRF-Token header on
 * every state-changing request. The server accepts the request only
 * when the header and the cookie match exactly. The token is NOT tied
 * to the session, so it can be issued before login (GET /api/auth/csrf)
 * — but it is useless to an attacker on another origin, because the
 * SameSite=Lax cookie is never sent cross-site and the attacker cannot
 * read the cookie value to forge the header.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Constant-time equality for two token strings. */
export function csrfTokensEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
