import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { friendsRouter } from './friends.js';
import { User } from '../models/User.js';
import { UserPoints } from '../models/UserPoints.js';

/**
 * GET /api/friends/discover tests (Phase 15, item 4).
 *
 * No database is opened here — the suite convention (see
 * vitest.config.ts) is pure tests only, so the User model is faked
 * with a spy and auth is controlled through the mocked middleware:
 *
 * - `passthrough` mode runs the REAL requireAuth, so the 401 test
 *   proves the route really sits behind authentication (the router
 *   does friendsRouter.use(requireAuth) before every route).
 * - `inject` mode pretends a signed-in user, so the handler runs
 *   against the faked User.find and the query + response shape can
 *   be asserted exactly.
 *
 * The fake docs deliberately carry an `email` field: the endpoint
 * must never return one, and the captured projection must prove the
 * query never even selects it.
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

type FakeDoc = { _id: string; name: string; email: string };

const OTHER_DOCS: FakeDoc[] = Array.from({ length: 12 }, (_, i) => ({
  _id: new mongoose.Types.ObjectId().toHexString(),
  name: `Dost ${i + 1}`,
  email: `dost${i + 1}@example.com`,
}));
const ALL_DOCS: FakeDoc[] = [
  ...OTHER_DOCS,
  { _id: ME_ID, name: 'Main Khud', email: 'me@example.com' },
];

type Captured = { filter?: unknown; projection?: unknown; limit?: number };

/** A few users have points; the rest have no UserPoints row (→ 0). */
const POINTS: Record<string, number> = {
  [OTHER_DOCS[0]!._id]: 150,
  [OTHER_DOCS[2]!._id]: 42,
};

type PointsCaptured = { filter?: unknown };

function installFakePoints(pointsById: Record<string, number>, captured: PointsCaptured) {
  return vi.spyOn(UserPoints, 'find').mockImplementation(((filter: {
    userId?: { $in?: string[] };
  }) => {
    captured.filter = filter;
    const ids = filter?.userId?.$in ?? [];
    const rows = ids
      .filter((id) => typeof pointsById[id] === 'number')
      .map((id) => ({ userId: id, total: pointsById[id] }));
    return {
      select: () => ({ lean: async () => rows }),
    };
  }) as never);
}

function installFakeFind(docs: FakeDoc[], captured: Captured) {
  return vi.spyOn(User, 'find').mockImplementation(((filter: { _id?: { $ne?: string } }) => {
    captured.filter = filter;
    const excluded = filter?._id?.$ne;
    const visible =
      typeof excluded === 'string' ? docs.filter((d) => d._id !== excluded) : docs;
    return {
      select: (projection: string) => {
        captured.projection = projection;
        return {
          limit: (n: number) => {
            captured.limit = n;
            return { lean: async () => visible.slice(0, n) };
          },
        };
      },
    };
  }) as never);
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/friends', friendsRouter);
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

type DiscoverBody = { users: Array<Record<string, unknown>> };

describe('GET /api/friends/discover', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    authState.mode = 'inject';
  });

  it('requires authentication: no session cookie → 401', async () => {
    authState.mode = 'passthrough';
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover`);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe('Authentication required');
    } finally {
      await close();
    }
  });

  it('returns other users, never self, and never an email', async () => {
    const captured: Captured = {};
    const pointsCaptured: PointsCaptured = {};
    installFakeFind(ALL_DOCS, captured);
    installFakePoints(POINTS, pointsCaptured);
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DiscoverBody;
      expect(body.users).toHaveLength(10);
      expect(body.users.map((u) => u.id)).not.toContain(ME_ID);
      // No email anywhere in the response, not even as a field name.
      expect(JSON.stringify(body)).not.toContain('email');
      expect(JSON.stringify(body)).not.toContain('@example.com');
      for (const user of body.users) {
        expect(Object.keys(user).sort()).toEqual(['id', 'initial', 'name', 'points']);
      }
      // The query itself excludes self and never selects email.
      expect(captured.filter).toEqual({ _id: { $ne: ME_ID } });
      expect(captured.projection).toBe('_id name');
      expect(captured.limit).toBe(10);
    } finally {
      await close();
    }
  });

  it('includes each user total points (0 when they have none), in one query', async () => {
    const captured: Captured = {};
    const pointsCaptured: PointsCaptured = {};
    installFakeFind(ALL_DOCS, captured);
    installFakePoints(POINTS, pointsCaptured);
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DiscoverBody;
      const byId = new Map(body.users.map((u) => [u.id as string, u.points as number]));
      expect(byId.get(OTHER_DOCS[0]!._id)).toBe(150);
      expect(byId.get(OTHER_DOCS[2]!._id)).toBe(42);
      expect(byId.get(OTHER_DOCS[1]!._id)).toBe(0);
      // One UserPoints query with $in over the returned ids — no N+1.
      expect(pointsCaptured.filter).toEqual({
        userId: { $in: body.users.map((u) => u.id) },
      });
    } finally {
      await close();
    }
  });

  it('respects ?limit=3', async () => {
    const captured: Captured = {};
    installFakeFind(ALL_DOCS, captured);
    installFakePoints(POINTS, {});
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover?limit=3`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DiscoverBody;
      expect(body.users).toHaveLength(3);
      expect(captured.limit).toBe(3);
    } finally {
      await close();
    }
  });

  it('clamps ?limit=99 down to 10', async () => {
    const captured: Captured = {};
    installFakeFind(ALL_DOCS, captured);
    installFakePoints(POINTS, {});
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover?limit=99`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DiscoverBody;
      expect(body.users).toHaveLength(10);
      expect(captured.limit).toBe(10);
    } finally {
      await close();
    }
  });

  it('falls back to 10 for an invalid ?limit', async () => {
    const captured: Captured = {};
    installFakeFind(ALL_DOCS, captured);
    installFakePoints(POINTS, {});
    const { base, close } = await startServer();
    try {
      const res = await fetch(`${base}/api/friends/discover?limit=abc`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as DiscoverBody;
      expect(body.users).toHaveLength(10);
      expect(captured.limit).toBe(10);
    } finally {
      await close();
    }
  });
});
