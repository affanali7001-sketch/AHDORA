import { createHash, randomBytes } from 'node:crypto';

/**
 * Email verification / password-reset tokens (pure helpers, tested).
 *
 * Tokens are cryptographically random (32 bytes), stored only as a
 * SHA-256 hash in MongoDB, single-use, and expiring — verification
 * links live 24 hours, password-reset links 1 hour. The raw token is
 * only ever sent by email and never stored or logged.
 */
export function generateEmailToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function emailTokenExpiry(purpose: 'email_verification' | 'password_reset', now = new Date()): Date {
  const ttlMs = purpose === 'email_verification' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return new Date(now.getTime() + ttlMs);
}
