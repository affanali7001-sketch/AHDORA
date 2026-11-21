import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { resolveSessionUser } from '../lib/session.js';

declare global {
  namespace Express {
    interface Request { authUser?: { id: string; name: string; email: string; emailVerified: boolean; role: string } }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof token !== 'string') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await resolveSessionUser(token);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional auth for PUBLIC endpoints (Hijri today/month): when the
 * request carries a valid session cookie, req.authUser is populated
 * so the handler can apply the user's own timezone and settings;
 * when it does not — guest, logged out on this device, expired
 * session — the request still proceeds unauthenticated instead of
 * 401ing. Never rejects: a stale cookie must not turn public
 * calendar info into an "Authentication required" error.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof token === 'string') {
      const user = await resolveSessionUser(token);
      if (user) req.authUser = user;
    }
    next();
  } catch (error) {
    next(error);
  }
}
