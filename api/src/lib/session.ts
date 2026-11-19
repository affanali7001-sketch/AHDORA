import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { config, isProduction } from '../config.js';

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Resolve a session token to its user. Shared by the REST auth
 * middleware and the Socket.IO handshake, so sockets are authenticated
 * with exactly the same session-cookie mechanism as the API.
 * Returns null for a missing, expired, or orphaned session.
 */
export async function resolveSessionUser(
  token: string,
): Promise<{ id: string; name: string; email: string; role: string } | null> {
  if (typeof token !== 'string' || token.length < 30 || token.length > 100) {
    return null;
  }
  const session = await Session.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).select('_id name email role').lean();
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function createSession(userId: string, req: Request, res: Response) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent: req.get('user-agent')?.slice(0, 300),
  });
  res.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}