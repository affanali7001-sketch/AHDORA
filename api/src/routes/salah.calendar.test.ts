import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app.js';
import { Notification } from '../models/Notification.js';
import { Profile } from '../models/Profile.js';
import { SalahDay } from '../models/SalahDay.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

/**
 * GET /api/salah/calendar/:month — the Analytics screen's slowest
 * dependency (measured live 2026-11-22: ~1.7s, vs a ~0.4s no-DB
 * baseline — every sequential Heroku→Atlas round trip costs ~0.3s).
 *
 * Regression tests for the round-trip optimisation in salah.ts:
 * the auto-missed recompute for past days now runs in parallel
 * (days are independent), and the second SalahDay.find only runs
 * when a recompute actually flipped something — the common case
 * (nothing left to flip) reuses the records already in hand.
 *
 * Runs the real Express app on an ephemeral port with stubbed
 * Mongoose models (no DB, no network — the suite's "no test ever
 * opens a database connection" rule still holds).
 */

const SESSION_TOKEN =
  '507f1f77bcf86cd799439011507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439011';

let server: Server;
let base: string;

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

function dayRecord(date: string, status: string) {
  const prayers: Record<string, Record<string, unknown>> = {};
  for (const p of PRAYERS) {
    prayers[p] = {
      status,
      updatedAt: null,
      wasMissed: status === 'missed',
      missedAt: null,
      autoMissed: false,
    };
  }
  return { date, prayers };
}

/** YYYY-MM-DD for today plus `delta` days (local time). */
function dayKey(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

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
          createdAt: new Date('2026-11-01T00:00:00.000Z'),
        }),
    }),
  } as never);
  vi.spyOn(Profile, 'findOne').mockReturnValue({
    lean: () => Promise.resolve({ userId: USER_ID, timezone: 'Asia/Kolkata' }),
  } as never);
  // Notifications are best-effort: pretend one already exists so the
  // auto-missed path never tries to create one (no DB in tests).
  vi.spyOn(Notification, 'exists').mockResolvedValue({ _id: '507f1f77bcf86cd799439013' } as never);
});

function authedHeaders(): Record<string, string> {
  return { Cookie: `ahdora_session=${SESSION_TOKEN}` };
}

describe('GET /api/salah/calendar/:month (authed)', () => {
  it('reuses the first find when nothing flips — SalahDay.find runs once', async () => {
    const d1 = dayKey(-2);
    const d2 = dayKey(-1);
    const month = d1.slice(0, 7);
    const records = [dayRecord(d1, 'prayed'), dayRecord(d2, 'prayed')];
    const findSpy = vi.spyOn(SalahDay, 'find').mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(records) }),
    } as never);
    vi.spyOn(SalahDay, 'findOne').mockImplementation(((filter: { date?: string }) => ({
      lean: () =>
        Promise.resolve(records.find((r) => r.date === filter.date) ?? null),
    })) as never);

    const response = await fetch(`${base}/api/salah/calendar/${month}`, {
      headers: authedHeaders(),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      days: { date: string }[];
      totals: { prayed: number; missed: number };
    };
    expect(data.days.map((d) => d.date)).toEqual([d1, d2]);
    expect(data.totals.prayed).toBe(10);
    expect(data.totals.missed).toBe(0);
    // The optimisation under test: no second read happened.
    expect(findSpy).toHaveBeenCalledTimes(1);
  });

  it('re-reads when a past day flips to missed — SalahDay.find runs twice', async () => {
    const d1 = dayKey(-2);
    const month = d1.slice(0, 7);
    const before = [dayRecord(d1, 'pending')];
    const after = [dayRecord(d1, 'missed')];
    const findSpy = vi.spyOn(SalahDay, 'find');
    findSpy.mockReturnValueOnce({
      select: () => ({ lean: () => Promise.resolve(before) }),
    } as never);
    findSpy.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(after) }),
    } as never);
    vi.spyOn(SalahDay, 'findOne').mockReturnValue({
      lean: () => Promise.resolve(before[0]!),
    } as never);
    vi.spyOn(SalahDay, 'findOneAndUpdate').mockReturnValue({
      lean: () => Promise.resolve(after[0]!),
    } as never);

    const response = await fetch(`${base}/api/salah/calendar/${month}`, {
      headers: authedHeaders(),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      days: { date: string; prayers: Record<string, { status: string }> }[];
      totals: { prayed: number; missed: number };
    };
    expect(data.days).toHaveLength(1);
    const onlyDay = data.days[0]!;
    expect(onlyDay.date).toBe(d1);
    expect(Object.values(onlyDay.prayers).every((p) => p.status === 'missed')).toBe(true);
    expect(data.totals.missed).toBe(5);
    expect(data.totals.prayed).toBe(0);
    expect(findSpy).toHaveBeenCalledTimes(2);
  });
});
