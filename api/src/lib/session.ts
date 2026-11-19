import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { Session } from '../models/Session.js';
import { config, isProduction } from '../config.js';

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

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