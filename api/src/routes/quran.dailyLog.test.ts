import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import { quranRouter } from './quran.js';
import { Profile } from '../models/Profile.js';
import { QuranDayLog } from '../models/QuranDayLog.js';
import { QuranReading } from '../models/QuranReading.js';
import { addDays, dateKeyInTimezone } from '../lib/timezone.js';

/**
 * Quran daily log tests: POST /api/quran/read, POST
 * /api/quran/listened, GET /api/quran/daily-log.
 *
 * Same suite convention as friends.discover.test.ts: no database is
 * opened (see vitest.config.ts), so the models are faked with spies
 * and auth is controlled through the mocked middleware. The timezone
 * is Asia/Kolkata (the profile default), and the expected day keys
 * are computed with the real timezone helpers.
 */

const authState = vi.hoisted(() => ({
  mode: 'inject' as 'inject' | 'passthrough',
  userId: '000000000000000000000001',
}));

vi.mock('../middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...actual,
    requireAuth: (req: Request, res: Response, next: NextFunction) => {
      if (authState.mode === 'passthrough') {
        void actual.requireAuth(req, res, next);
        return;
      }
      req.authUser = {
        id: authState.userId,
        name: 'Main Khud',
        email: 'me@example.com',
        emailVerified: true,
        role: 'user',
      };
      next();
    },
  };
});

const ME_ID = authState.userId;
const TIMEZONE = 'Asia/Kolkata';
const TODAY = dateKeyInTimezone(TIMEZONE);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/quran', quranRouter);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  if (typeof address !== 'object' || !address) {
    throw new Error('Test server did not start');
  }
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

type UpsertCaptured = { filter?: unknown; update?: unknown; options?: unknown };

function installFakeProfile(timezone: string | null = TIMEZONE) {
  vi.spyOn(Profile, 'findOne').mockImplementation(
    (() => ({
      lean: async () => (timezone === null ? null : { timezone }),
    })) as never,
  );
}

function installFakeDayLogUpsert(captured: UpsertCaptured) {
  vi.spyOn(QuranDayLog, 'findOneAndUpdate').mockImplementation(
    ((filter: unknown, update: unknown, options: unknown) => {
      captured.filter = filter;
      captured.update = update;
      captured.options = options;
      return Promise.resolve({
        userId: ME_ID,
        dayKey: TODAY,
        ayahsRead: 0,
        listened: false,
        listenedMinutes: 0,
      });
    }) as never,
  );
}

function installFakeDayLogFind(rows: Array<Record<string, unknown>>, captured?: { filter?: unknown }) {
  vi.spyOn(QuranDayLog, 'find').mockImplementation(
    ((filter: unknown) => {
      if (captured) captured.filter = filter;
      return { lean: async () => rows };
    }) as never,
  );
}

type FakeReadingDoc = {
  userId: string;
  surahNumber: number;
  lastAyahNumber: number;
  ayahsReadToday: number;
  dayKey: string;
  saveCalls: number;
  save: () => Promise<void>;
};

function fakeReadingDoc(overrides: Partial<FakeReadingDoc> = {}): FakeReadingDoc {
  const doc: FakeReadingDoc = {
    userId: ME_ID,
    surahNumber: 1,
    lastAyahNumber: 5,
    ayahsReadToday: 5,
    dayKey: TODAY,
    saveCalls: 0,
    save: async () => {
      doc.saveCalls += 1;
    },
    ...overrides,
  };
  return doc;
}

describe('Quran daily log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    authState.mode = 'inject';
  });

  it('POST /read increments the day log when ayahs are added', async () => {
    installFakeProfile();
    vi.spyOn(QuranReading, 'findOne').mockResolvedValue(null as never);
    vi.spyOn(QuranReading, 'create').mockResolvedValue({} as never);
    const captured: UpsertCaptured = {};
    installFakeDayLogUpsert(captured);
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/quran/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surahNumber: 1, ayahNumber: 1 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { recorded?: boolean; ayahsAddedToday?: number };
      expect(body).toEqual({ recorded: true, ayahsAddedToday: 1 });
      // The day log is upserted for today with +1 ayah.
      expect(captured.filter).toEqual({ userId: ME_ID, dayKey: TODAY });
      expect(captured.update).toEqual({ $inc: { ayahsRead: 1 } });
      expect(captured.options).toMatchObject({ upsert: true });
    } finally {
      await close();
    }
  });

  it('POST /read does not touch the day log when nothing new is added', async () => {
    installFakeProfile();
    const doc = fakeReadingDoc({ lastAyahNumber: 5, ayahsReadToday: 5, dayKey: TODAY });
    vi.spyOn(QuranReading, 'findOne').mockResolvedValue(doc as never);
    const upsert = vi.spyOn(QuranDayLog, 'findOneAndUpdate');
    const { base, close } = await startServer();
    try {
      // Re-reading an earlier ayah on the same day adds 0.
      const res = await fetch(`${base}/api/quran/read`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surahNumber: 1, ayahNumber: 3 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { recorded?: boolean; ayahsAddedToday?: number };
      expect(body).toEqual({ recorded: true, ayahsAddedToday: 0 });
      expect(upsert).not.toHaveBeenCalled();
      expect(doc.saveCalls).toBe(1);
    } finally {
      await close();
    }
  });

  it('POST /listened marks today listened and adds the minutes', async () => {
    installFakeProfile();
    const captured: UpsertCaptured = {};
    installFakeDayLogUpsert(captured);
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/quran/listened`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minutes: 12 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok?: boolean; listened?: boolean; dayKey?: string };
      expect(body).toEqual({ ok: true, listened: true, dayKey: TODAY });
      expect(captured.filter).toEqual({ userId: ME_ID, dayKey: TODAY });
      expect(captured.update).toEqual({
        $set: { listened: true },
        $inc: { listenedMinutes: 12 },
      });
      expect(captured.options).toMatchObject({ upsert: true });
    } finally {
      await close();
    }
  });

  it('POST /listened defaults to 0 minutes and rejects bad input', async () => {
    installFakeProfile();
    const captured: UpsertCaptured = {};
    installFakeDayLogUpsert(captured);
    const { base, close } = await startServer();
    try {
      const okRes = await fetch(`${base}/api/quran/listened`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(okRes.status).toBe(200);
      expect(captured.update).toEqual({
        $set: { listened: true },
        $inc: { listenedMinutes: 0 },
      });
      const badRes = await fetch(`${base}/api/quran/listened`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minutes: -5 }),
      });
      expect(badRes.status).toBe(400);
    } finally {
      await close();
    }
  });

  it('GET /daily-log returns N days newest first, gaps filled as not read / not listened', async () => {
    installFakeProfile();
    const dayMinus2 = addDays(TODAY, -2);
    const dayMinus4 = addDays(TODAY, -4);
    const captured: { filter?: unknown } = {};
    installFakeDayLogFind(
      [
        { dayKey: TODAY, ayahsRead: 7, listened: true, listenedMinutes: 15 },
        { dayKey: dayMinus2, ayahsRead: 3, listened: false, listenedMinutes: 0 },
        { dayKey: dayMinus4, ayahsRead: 0, listened: true, listenedMinutes: 5 },
      ],
      captured,
    );
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/quran/daily-log?days=5`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        days: Array<{ dayKey: string; ayahsRead: number; listened: boolean; listenedMinutes: number }>;
      };
      expect(body.days).toHaveLength(5);
      expect(body.days.map((d) => d.dayKey)).toEqual([
        TODAY,
        addDays(TODAY, -1),
        dayMinus2,
        addDays(TODAY, -3),
        dayMinus4,
      ]);
      expect(body.days[0]).toEqual({
        dayKey: TODAY,
        ayahsRead: 7,
        listened: true,
        listenedMinutes: 15,
      });
      // Day -1 has no row: filled as not read / not listened.
      expect(body.days[1]).toEqual({
        dayKey: addDays(TODAY, -1),
        ayahsRead: 0,
        listened: false,
        listenedMinutes: 0,
      });
      expect(body.days[2]).toEqual({
        dayKey: dayMinus2,
        ayahsRead: 3,
        listened: false,
        listenedMinutes: 0,
      });
      expect(body.days[4]).toEqual({
        dayKey: dayMinus4,
        ayahsRead: 0,
        listened: true,
        listenedMinutes: 5,
      });
      // One query for exactly the requested day keys.
      expect(captured.filter).toEqual({
        userId: ME_ID,
        dayKey: {
          $in: [TODAY, addDays(TODAY, -1), dayMinus2, addDays(TODAY, -3), dayMinus4],
        },
      });
    } finally {
      await close();
    }
  });

  it('GET /daily-log defaults to 30 days and clamps to 1..90', async () => {
    installFakeProfile();
    installFakeDayLogFind([]);
    const { base, close } = await startServer();
    try {
      const def = await fetch(`${base}/api/quran/daily-log`);
      const defBody = (await def.json()) as { days: unknown[] };
      expect(defBody.days).toHaveLength(30);
      const clamped = await fetch(`${base}/api/quran/daily-log?days=500`);
      const clampedBody = (await clamped.json()) as { days: unknown[] };
      expect(clampedBody.days).toHaveLength(90);
      const one = await fetch(`${base}/api/quran/daily-log?days=0`);
      const oneBody = (await one.json()) as { days: unknown[] };
      expect(oneBody.days).toHaveLength(1);
    } finally {
      await close();
    }
  });

  it('requires authentication for the new endpoints', async () => {
    authState.mode = 'passthrough';
    const { base, close } = await startServer();
    try {
      const listened = await fetch(`${base}/api/quran/listened`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minutes: 1 }),
      });
      expect(listened.status).toBe(401);
      const log = await fetch(`${base}/api/quran/daily-log`);
      expect(log.status).toBe(401);
    } finally {
      await close();
    }
  });
});
