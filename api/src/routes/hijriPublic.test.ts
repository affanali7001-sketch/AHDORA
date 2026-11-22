import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Profile } from '../models/Profile.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

/**
 * Phase 15 (item 7) — Hijri today/month are PUBLIC, settings stay AUTHED.
 *
 * Regression: `hijriRouter.use(requireAuth)` plus requireAuth on the
 * /api/hijri mount in app.ts made every Hijri request 401 with the
 * raw string "Authentication required" for guests and for users
 * whose session lives in another browser (phone vs laptop) — and
 * HijriCalendar rendered that string verbatim inside the card.
 *
 * These tests run the real Express app on an ephemeral port with
 * stubbed Mongoose models and a stubbed Aladhan upstream (no DB, no
 * network — the suite's "no test ever opens a database connection"
 * rule still holds). The global fetch stub passes localhost calls
 * through to the real fetch and answers only api.aladhan.com.
 */

const realFetch = globalThis.fetch.bind(globalThis);

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Fake key-day holidays, so /api/hijri/events has real markers to find. */
const FAKE_HOLIDAYS: Record<string, string[]> = {
  '2027-02-08': ['1st Day of Ramadan'],
  '2027-03-10': ['Eid al-Fitr'],
  '2027-05-15': ['Arafa'],
  '2027-05-27': ['Eid al-Adha'],
  // 2028 stub dates for the ?year= test (fake data, like the 2027 ones above).
  '2028-01-28': ['1st Day of Ramadan'],
  '2028-02-27': ['Eid al-Fitr'],
};

/** Fake Aladhan month payload for whatever month/year the route asks for. */
function aladhanMonthPayload(month: number, year: number) {
  const count = daysInMonth(year, month);
  const days = Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    });
    return {
      gregorian: { date: `${dd}-${mm}-${year}`, weekday: { en: weekday } },
      hijri: {
        date: `${dd}-06-1448`,
        day: String(day),
        month: { number: 6, en: 'Jumādá al-ākhirah', ar: 'جُمادى الآخرة', days: 29 },
        year: '1448',
        holidays: FAKE_HOLIDAYS[`${year}-${mm}-${dd}`] ?? [],
      },
    };
  });
  return { code: 200, data: days };
}

function installFetchStub(): void {
  vi.stubGlobal('fetch', async (input: unknown, init?: unknown) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1')) {
      return realFetch(input as never, init as never);
    }
    const match = /api\.aladhan\.com\/v1\/gToHCalendar\/(\d+)\/(\d+)/.exec(url);
    if (match) {
      // Fail March 2027 once when armed: /events must retry the
      // month instead of silently dropping Eid-ul-Fitr from it.
      if (failMarchOnce && match[1] === '3' && match[2] === '2027') {
        failMarchOnce = false;
        return new Response('upstream error', { status: 500 });
      }
      const payload = aladhanMonthPayload(Number(match[1]), Number(match[2]));
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected upstream fetch in test: ${url}`);
  });
}

/** Armed by the retry test: the next gToHCalendar/3/2027 call 500s once. */
let failMarchOnce = false;

/** Today's date key in Asia/Kolkata (the default timezone for guests). */
function kolkataToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const SESSION_TOKEN = 'a'.repeat(43);
const USER_ID = '507f1f77bcf86cd799439011';

let server: Server;
let base: string;

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
  // Default: no profile (guest defaults: Asia/Kolkata, offset 0).
  vi.spyOn(Profile, 'findOne').mockReturnValue({
    lean: () => Promise.resolve(null),
  } as never);
});

function stubAuthedSession(profile: Record<string, unknown> | null = null): void {
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
  if (profile !== null) {
    vi.spyOn(Profile, 'findOne').mockReturnValue({
      lean: () => Promise.resolve(profile),
    } as never);
  }
}

/** Fetch a fresh CSRF token + cookie so a PUT reaches auth instead of dying on 403. */
async function csrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch(`${base}/api/auth/csrf`);
  const data = (await response.json()) as { csrfToken: string };
  const cookie = response.headers.getSetCookie().join('; ');
  return { 'X-CSRF-Token': data.csrfToken, Cookie: cookie };
}

describe('GET /api/hijri/today (public)', () => {
  it('returns 200 without any session cookie', async () => {
    const response = await fetch(`${base}/api/hijri/today`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hijri: { day: string }; adjustmentDays: number };
    expect(data.hijri.day).toBeTruthy();
    expect(data.adjustmentDays).toBe(0);
  });

  it('returns 200 for a stale/expired session cookie instead of 401', async () => {
    const response = await fetch(`${base}/api/hijri/today`, {
      headers: { Cookie: 'ahdora_session=expired-token' },
    });
    expect(response.status).toBe(200);
  });

  it('applies a signed-in user’s own offset', async () => {
    stubAuthedSession({ timezone: 'Asia/Kolkata', hijriDayOffset: 1 });
    const response = await fetch(`${base}/api/hijri/today`, {
      headers: { Cookie: `ahdora_session=${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { adjustmentDays: number; hijri: { day: string } };
    expect(data.adjustmentDays).toBe(1);
    // The Hijri day shown is tomorrow's conversion, not today's
    // (the fake upstream sets hijri.day = gregorian day-of-month).
    const [year = 0, month = 0, day = 0] = kolkataToday().split('-').map(Number);
    const shifted = new Date(Date.UTC(year, month - 1, day + 1));
    expect(Number(data.hijri.day)).toBe(shifted.getUTCDate());
  });
});

describe('GET /api/hijri/month (public)', () => {
  it('returns 200 without any session cookie', async () => {
    const response = await fetch(`${base}/api/hijri/month?year=2026&month=11`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as { days: unknown[]; month: number; year: number };
    expect(data.year).toBe(2026);
    expect(data.month).toBe(11);
    expect(data.days).toHaveLength(30);
  });

  it('never leaks the raw 401 string to a guest', async () => {
    const response = await fetch(`${base}/api/hijri/month?year=2026&month=11`);
    const text = await response.text();
    expect(text).not.toContain('Authentication required');
  });
});

describe('GET /api/hijri/events (public)', () => {
  it('returns 200 without any session cookie and finds Ramadan, Eid Fitr and Bakrid', async () => {
    const response = await fetch(`${base}/api/hijri/events`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      today: string;
      adjustmentDays: number;
      events: { key: string; gregorianDate: string; daysUntil: number; label: string }[];
    };
    expect(data.adjustmentDays).toBe(0);
    const keys = data.events.map((event) => event.key);
    expect(keys).toEqual(['ramadan', 'eid-fitr', 'arafah', 'eid-adha']);
    const ramadan = data.events.find((event) => event.key === 'ramadan');
    expect(ramadan?.gregorianDate).toBe('2027-02-08');
    expect(ramadan?.label).toBe('1st Day of Ramadan');
    const expectedDays = Math.round(
      (Date.parse('2027-02-08') - Date.parse(data.today)) / 86400000,
    );
    expect(ramadan?.daysUntil).toBe(expectedDays);
    expect(ramadan?.daysUntil).toBeGreaterThan(0);
    const adha = data.events.find((event) => event.key === 'eid-adha');
    expect(adha?.gregorianDate).toBe('2027-05-27');
  });

  it('retries a month fetch that fails once instead of dropping its events', async () => {
    failMarchOnce = true;
    const response = await fetch(`${base}/api/hijri/events`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      events: { key: string; gregorianDate: string }[];
    };
    // March 2027 500'd on the first try; the retry must have
    // fetched it, or Eid-ul-Fitr would be missing.
    const fitr = data.events.find((event) => event.key === 'eid-fitr');
    expect(fitr?.gregorianDate).toBe('2027-03-10');
  });

  it('lists a whole year with ?year= (2028 must be browsable, not just the next occurrence)', async () => {
    const response = await fetch(`${base}/api/hijri/events?year=2028`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      year: number;
      events: { key: string; gregorianDate: string; daysUntil: number }[];
    };
    expect(data.year).toBe(2028);
    expect(data.events.map((event) => event.key)).toEqual(['ramadan', 'eid-fitr']);
    const ramadan = data.events.find((event) => event.key === 'ramadan');
    expect(ramadan?.gregorianDate).toBe('2028-01-28');
    expect(ramadan?.daysUntil).toBeGreaterThan(400);
  });

  it('rejects an out-of-range or non-numeric year with 400', async () => {
    for (const bad of ['1800', '2201', 'abc']) {
      const response = await fetch(`${base}/api/hijri/events?year=${bad}`);
      expect(response.status).toBe(400);
    }
  });

  it('never leaks the raw 401 string to a guest', async () => {
    const response = await fetch(`${base}/api/hijri/events`);
    const text = await response.text();
    expect(text).not.toContain('Authentication required');
  });
});

describe('GET/PUT /api/hijri/settings (authed)', () => {
  it('GET without auth → 401', async () => {
    const response = await fetch(`${base}/api/hijri/settings`);
    expect(response.status).toBe(401);
  });

  it('PUT without auth → 401 (CSRF passes, auth does not)', async () => {
    const headers = await csrfHeaders();
    const response = await fetch(`${base}/api/hijri/settings`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hijriDayOffset: 1 }),
    });
    expect(response.status).toBe(401);
  });

  it('GET with a valid session → 200 with the user’s offset', async () => {
    stubAuthedSession({ timezone: 'Asia/Kolkata', hijriDayOffset: -1 });
    const response = await fetch(`${base}/api/hijri/settings`, {
      headers: { Cookie: `ahdora_session=${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { hijriDayOffset: number };
    expect(data.hijriDayOffset).toBe(-1);
  });
});
