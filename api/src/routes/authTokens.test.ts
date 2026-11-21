import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { EmailToken } from '../models/EmailToken.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

/**
 * Phase 15 (item 8b) — email verify / password-reset token expiry.
 *
 * The 1-hour reset / 24-hour verify expiry STAYS (security rule —
 * emailTokenExpiry is pinned in lib/emailTokens.test.ts). What these
 * tests pin is the behaviour around it: an expired (or already used,
 * or unknown) token is rejected with a clear "invalid or has
 * expired" message, never silently accepted and never a 500; a
 * still-valid token verifies / resets. No DB is used — the
 * EmailToken lookup is stubbed to return null (expired/unknown) or
 * a live record, exactly as the route's `expiresAt: { $gt: now }`
 * filter decides in production.
 */

const USER_ID = '507f1f77bcf86cd799439011';
const TOKEN = 'b'.repeat(43);

let server: Server;
let base: string;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.restoreAllMocks();
});

/** Fetch a fresh CSRF token + cookie so a POST reaches the handler instead of dying on 403. */
async function csrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch(`${base}/api/auth/csrf`);
  const data = (await response.json()) as { csrfToken: string };
  const cookie = response.headers.getSetCookie().join('; ');
  return { 'X-CSRF-Token': data.csrfToken, Cookie: cookie };
}

describe('GET /api/auth/verify-email (token expiry)', () => {
  it('rejects an expired/unknown token with 400 and a clear message', async () => {
    vi.spyOn(EmailToken, 'findOneAndUpdate').mockResolvedValue(null);
    const response = await fetch(`${base}/api/auth/verify-email?token=${TOKEN}`);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/invalid or has expired/i);
  });

  it('verifies a still-valid token', async () => {
    vi.spyOn(EmailToken, 'findOneAndUpdate').mockResolvedValue({ userId: USER_ID } as never);
    vi.spyOn(User, 'updateOne').mockResolvedValue({} as never);
    const response = await fetch(`${base}/api/auth/verify-email?token=${TOKEN}`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { verified: boolean };
    expect(data.verified).toBe(true);
  });
});

describe('POST /api/auth/reset-password (token expiry)', () => {
  it('rejects an expired/unknown token with 400 and a clear message', async () => {
    vi.spyOn(EmailToken, 'findOneAndUpdate').mockResolvedValue(null);
    const headers = await csrfHeaders();
    const response = await fetch(`${base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, password: 'new-password-123' }),
    });
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/invalid or has expired/i);
  });

  it('resets the password with a still-valid token', async () => {
    vi.spyOn(EmailToken, 'findOneAndUpdate').mockResolvedValue({ userId: USER_ID } as never);
    vi.spyOn(User, 'updateOne').mockResolvedValue({} as never);
    vi.spyOn(Session, 'deleteMany').mockResolvedValue({} as never);
    const headers = await csrfHeaders();
    const response = await fetch(`${base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: TOKEN, password: 'new-password-123' }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { reset: boolean };
    expect(data.reset).toBe(true);
  });
});
