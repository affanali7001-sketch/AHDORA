import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { hashSessionToken } from '../lib/session.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

declare global {
  namespace Express {
    interface Request { authUser?: { id: string; name: string; email: string; role: string } }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof token !== 'string' || token.length < 30 || token.length > 100) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const session = await Session.findOne({ tokenHash: hashSessionToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await User.findById(session.userId).select('_id name email role').lean();
    if (!user) {
      await Session.deleteOne({ _id: session._id });
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.authUser = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}
