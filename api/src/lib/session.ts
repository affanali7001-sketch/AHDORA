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
 *
 * Lazy cleanup: a token whose session row is gone (expired or
 * revoked) has its hash deleted if it still lingers, and orphaned
 * sessions (user deleted) are removed when found.
 */
export async function resolveSessionUser(
  token: string,
): Promise<{ id: string; name: string; email: string; emailVerified: boolean; role: string } | null> {
  if (typeof token !== 'string' || token.length < 30 || token.length > 100) {
    return null;
  }
  const tokenHash = hashSessionToken(token);
  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) {
    await Session.deleteOne({ tokenHash });
    return null;
  }
  const user = await User.findById(session.userId).select('_id name email emailVerifiedAt role').lean();
  if (!user) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
  };
}

/**
 * Where the session token comes from. The web app sends it as the
 * `ahdora_session` HttpOnly cookie. The native (React Native) app
 * CANNOT read that cookie back: Hermes's fetch hides Set-Cookie
 * (forbidden response header), so the client never learns the
 * session value and every authenticated call 401s with
 * "Authentication required" — the exact bug the user reported on
 * 2026-11-22 (Challenge/Study/Focus/Analytics/Profile/Prayer all
 * 401 after a fresh login, while curl + the browser worked fine).
 * So the native app sends the same token as an
 * `Authorization: Bearer <token>` header instead (the server
 * returns the token in the login/signup response body, and the app
 * stores it in SecureStore). Accepting both transports here keeps
 * the web app on cookies (unchanged) and unblocks the native app.
 * The token is the same random 32-byte value either way; the
 * server only ever stores its SHA-256 hash.
 */
export function extractSessionToken(req: Request): string | undefined {
  const fromCookie = req.cookies?.[config.SESSION_COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;
  const auth = req.get('authorization');
  if (typeof auth === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    const token = match?.[1]?.trim();
    if (token) return token;
  }
  return undefined;
}

/** Remove a user's expired sessions (lazy cleanup — there is no background scheduler). */
export async function pruneExpiredSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId, expiresAt: { $lte: new Date() } });
}

/** Invalidate every session of a user (used on login rotation and password changes). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId });
}

export async function createSession(
  userId: string,
  req: Request,
  res: Response,
): Promise<string> {
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
  // Returned so login/signup can also hand the token to clients
  // that cannot read the Set-Cookie header (the native app — see
  // extractSessionToken above). The web app ignores this value.
  return token;
}

/**
 * Session rotation: invalidate ALL of the user's previous sessions,
 * then issue a fresh one. Called on login and after password
 * changes, so a stolen older session stops working immediately.
 */
export async function rotateSession(
  userId: string,
  req: Request,
  res: Response,
): Promise<string> {
  await revokeAllSessions(userId);
  return createSession(userId, req, res);
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
