import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Profile } from '../models/Profile.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

/**
 * Phase 15 (item 7 audit) — mosque /search and /nearby are PUBLIC,
 * /near-me stays AUTHED.
 *
 * Regression: `mosquesRouter.use(requireAuth)` plus requireAuth on the
 * /api/mosques mount in app.ts made every mosque search 401 with the
 * raw string "Authentication required" for guests and for users whose
 * session lives in another browser (phone vs laptop) — and the client
 * rendered that string verbatim. /search and /nearby take their inputs
 * as query params and use only public OpenStreetMap data, so they are
 * public like /api/hijri/today and /api/duas. /near-me reads the
 * profile city, so it stays authed.
 *
 * These tests run the real Express app on an ephemeral port with
 * stubbed Mongoose models and stubbed Nominatim/Overpass upstreams
 * (no DB, no network — the suite's "no test ever opens a database
 * connection" rule still holds). The global fetch stub passes
 * localhost calls through to the real fetch.
 */

const realFetch = globalThis.fetch.bind(globalThis);
const SESSION_TOKEN = 'a'.repeat(43);
const USER_ID = '507f1f77bcf86cd799439011';

let server: Server;
let base: string;

function installFetchStub(): void {
  vi.stubGlobal('fetch', async (input: unknown, init?: unknown) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1')) {
      return realFetch(input as never, init as never);
    }
    if (url.includes('nominatim.openstreetmap.org/search')) {
      return new Response(
        JSON.stringify([
          { lat: '18.5204', lon: '73.8567', display_name: 'Pune, Maharashtra, India' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.includes('overpass-api.de/api/interpreter')) {
      return new Response(
        JSON.stringify({
          elements: [
            {
              type: 'node',
              id: 1,
              lat: 18.521,
              lon: 73.857,
              tags: { name: 'Test Masjid', 'addr:city': 'Pune' },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    throw new Error(`unexpected upstream fetch in test: ${url}`);
  });
}

beforeAll(async () => {
  installFetchStub();
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.restoreAllMocks();
  installFetchStub();
  vi.spyOn(Profile, 'findOne').mockReturnValue({
    lean: () => Promise.resolve(null),
  } as never);
});

function stubAuthedSession(): void {
  vi.spyOn(Session, 'findOne').mockReturnValue({
    lean: () => Promise.resolve({ _id: '507f1f77bcf86cd799439012', userId: USER_ID }),
  } as never);
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
}

describe('GET /api/mosques/search (public)', () => {
  it('returns 200 without any session cookie', async () => {
    const response = await fetch(`${base}/api/mosques/search?city=Pune`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { count: number; mosques: { name: string }[] };
    expect(data.count).toBe(1);
    expect(data.mosques[0]?.name).toBe('Test Masjid');
  });

  it('returns 200 for a stale session cookie instead of 401', async () => {
    const response = await fetch(`${base}/api/mosques/search?city=Pune`, {
      headers: { Cookie: 'ahdora_session=expired-token' },
    });
    expect(response.status).toBe(200);
  });

  it('never contains the raw auth string in a public response', async () => {
    const response = await fetch(`${base}/api/mosques/search?city=Pune`);
    const text = await response.text();
    expect(text).not.toContain('Authentication required');
  });
});

describe('GET /api/mosques/nearby (public)', () => {
  it('returns 200 without any session cookie', async () => {
    const response = await fetch(`${base}/api/mosques/nearby?lat=18.52&lng=73.85`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { count: number };
    expect(data.count).toBe(1);
  });
});

describe('GET /api/mosques/near-me (authed)', () => {
  it('returns 401 without a session cookie', async () => {
    const response = await fetch(`${base}/api/mosques/near-me`);
    expect(response.status).toBe(401);
  });

  it('returns 200 with a valid session and a profile city', async () => {
    stubAuthedSession();
    vi.spyOn(Profile, 'findOne').mockReturnValue({
      lean: () => Promise.resolve({ city: 'Pune', country: 'India' }),
    } as never);
    const response = await fetch(`${base}/api/mosques/near-me`, {
      headers: { Cookie: `ahdora_session=${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { count: number; mosques: { name: string }[] };
    expect(data.count).toBe(1);
    expect(data.mosques[0]?.name).toBe('Test Masjid');
  });
});
