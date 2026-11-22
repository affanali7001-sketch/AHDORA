import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { extractSessionToken } from '../lib/session.js';

/**
 * Bearer-token auth for the native app (2026-11-22).
 *
 * Root cause (user report): after a fresh login in the native app,
 * EVERY authenticated screen (Challenge, Study, Focus, Analytics,
 * Profile, Prayer) returned 401 "Authentication required", while
 * curl and the browser worked fine. The native client keeps a manual
 * cookie jar because React Native fetch does not reliably persist
 * cookies — but Hermes's fetch HIDES Set-Cookie entirely (it is a
 * forbidden response header), so the `ahdora_session` cookie set by
 * login was never captured and no session was ever sent back. The
 * app also had no session restore, so every restart asked for login
 * again.
 *
 * Fix: the server now ALSO accepts the same session token as an
 * `Authorization: Bearer <token>` header (extractSessionToken), and
 * login/signup return the token in the response body so the native
 * app can store it (SecureStore) and send it reliably. The web app
 * keeps using the HttpOnly cookie — that path is unchanged and is
 * covered by the cookie test below.
 *
 * Runs the real Express app on an ephemeral port with stubbed
 * Mongoose models (no DB, no network).
 */

vi.mock('argon2', () => ({
  default: {
    verify: async () => true,
    hash: async () => 'hashed',
    argon2id: 2,
  },
}));

const SESSION_TOKEN =
  '507f1f77bcf86cd799439011507f1f77bcf86cd799439011507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439011';

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
  // A valid session for the fixed token, resolving to the test user.
  vi.spyOn(Session, 'findOne').mockReturnValue({
    lean: () => Promise.resolve({ _id: USER_ID, userId: USER_ID }),
  } as never);
  // resolveSessionUser deletes a stale token hash when the session
  // is gone — without this stub Mongoose buffers the call forever
  // (no DB in tests) and the test times out.
  vi.spyOn(Session, 'deleteOne').mockResolvedValue({} as never);
  vi.spyOn(User, 'findById').mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve({
          _id: USER_ID,
          name: 'Test User',
          email: 'test@example.com',
          emailVerifiedAt: new Date(),
          role: 'user',
        }),
    }),
  } as never);
});

/** Fetch a fresh CSRF token + cookie so a POST reaches the handler instead of dying on 403. */
async function csrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch(`${base}/api/auth/csrf`);
  const data = (await response.json()) as { csrfToken: string };
  const cookie = response.headers.getSetCookie().join('; ');
  return { 'X-CSRF-Token': data.csrfToken, Cookie: cookie };
}

function fakeReq(overrides: Record<string, unknown>) {
  return {
    cookies: {},
    get: (name: string) => {
      if (name.toLowerCase() === 'authorization') {
        return (overrides.authorization as string | undefined) ?? undefined;
      }
      return undefined;
    },
    ...overrides,
  } as unknown as Parameters<typeof extractSessionToken>[0];
}

describe('extractSessionToken', () => {
  it('prefers the session cookie when present', () => {
    expect(
      extractSessionToken(fakeReq({ cookies: { ahdora_session: 'cookie-token' } })),
    ).toBe('cookie-token');
  });

  it('accepts an Authorization Bearer token', () => {
    expect(
      extractSessionToken(
        fakeReq({ authorization: `Bearer ${SESSION_TOKEN}` }),
      ),
    ).toBe(SESSION_TOKEN);
  });

  it('accepts a lowercase "bearer" scheme', () => {
    expect(
      extractSessionToken(fakeReq({ authorization: `bearer ${SESSION_TOKEN}` })),
    ).toBe(SESSION_TOKEN);
  });

  it('returns undefined when neither transport carries a token', () => {
    expect(extractSessionToken(fakeReq({}))).toBeUndefined();
  });

  it('ignores a malformed Authorization header', () => {
    expect(extractSessionToken(fakeReq({ authorization: 'Basic abc123' }))).toBeUndefined();
    expect(extractSessionToken(fakeReq({ authorization: 'Bearer' }))).toBeUndefined();
  });
});

describe('GET /api/auth/me', () => {
  it('accepts a Bearer token (the native app path)', async () => {
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { user?: { name?: string } };
    expect(data.user?.name).toBe('Test User');
  });

  it('still accepts the session cookie (the web app path)', async () => {
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: `ahdora_session=${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
  });

  it('401s with no token at all', async () => {
    const response = await fetch(`${base}/api/auth/me`);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error?: string };
    expect(data.error).toBe('Authentication required');
  });

  it('401s when the Bearer token has no live session', async () => {
    vi.spyOn(Session, 'findOne').mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/login', () => {
  it('returns the session token in the body for the native app', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: () =>
        Promise.resolve({
          _id: USER_ID,
          name: 'Test User',
          email: 'test@example.com',
          emailVerifiedAt: new Date(),
          role: 'user',
          passwordHash: 'hashed',
        }),
    } as never);
    vi.spyOn(Session, 'deleteMany').mockResolvedValue({} as never);
    vi.spyOn(Session, 'create').mockResolvedValue({} as never);

    const headers = await csrfHeaders();
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'TestPass123456' }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      user?: { name?: string };
      sessionToken?: string;
    };
    expect(data.user?.name).toBe('Test User');
    // A real 43-char base64url token (32 random bytes), not a placeholder.
    expect(typeof data.sessionToken).toBe('string');
    expect(data.sessionToken!.length).toBe(43);
  });
});
