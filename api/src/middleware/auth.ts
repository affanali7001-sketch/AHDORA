import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { resolveSessionUser } from '../lib/session.js';

declare global {
  namespace Express {
    interface Request { authUser?: { id: string; name: string; email: string; role: string } }
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
