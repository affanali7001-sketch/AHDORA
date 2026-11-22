import { Router } from 'express';
import argon2 from 'argon2';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { EmailToken } from '../models/EmailToken.js';
import {
  clearSessionCookie,
  createSession,
  extractSessionToken,
  hashSessionToken,
  pruneExpiredSessions,
  revokeAllSessions,
  rotateSession,
} from '../lib/session.js';
import { config, isEmailConfigured } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { emailTokenExpiry, generateEmailToken, hashEmailToken } from '../lib/emailTokens.js';
import { passwordResetEmail, sendEmail, verificationEmail } from '../lib/email.js';
import { deleteAccount } from '../lib/deleteAccount.js';
import { exportAccount } from '../lib/exportAccount.js';
import { createNotification } from '../lib/notifications.js';
import { welcome } from '../lib/notificationCopy.js';

export const authRouter = Router();

/** Strictest limiter: 5 attempts per 15 minutes for login/signup/forgot/reset. */
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
});

const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();
const forgotSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
}).strict();
const resetSchema = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(12).max(128),
}).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).strict();
const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
}).strict();

function publicUser(user: { _id: unknown; name: string; email: string; emailVerifiedAt?: Date | null; role: string }) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null && user.emailVerifiedAt !== undefined,
    role: user.role,
  };
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

function emailNotConfigured(res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  res.status(503).json({
    error: 'Email sending is not configured yet. Ask the administrator to set up SMTP, then try again.',
  });
}

/* ------------------------------------------------------------------ */
/* CSRF token (public — issued before login)                           */
/* ------------------------------------------------------------------ */

authRouter.get(
  '/csrf',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }),
  issueCsrfToken,
);

/* ------------------------------------------------------------------ */
/* Signup / login / logout                                             */
/* ------------------------------------------------------------------ */

authRouter.post('/signup', strictAuthLimiter, async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid signup details', details: parsed.error.flatten().fieldErrors }); return; }
    const { name, email, password } = parsed.data;
    const existing = await User.exists({ email });
    if (existing) { res.status(409).json({ error: 'Unable to create account with these details' }); return; }
    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash });
    const sessionToken = await createSession(String(user._id), req, res);
    await createNotification(String(user._id), {
      type: 'system',
      ...welcome(name),
      refType: 'User',
      refId: String(user._id),
    });
    // Email verification (item 2): actually send the verification
    // email. Previously the notice below promised a link that was
    // never created or sent — signup silently left every email
    // unverified. Sending is best-effort: a mail failure must never
    // fail account creation, but the notice must then say so
    // honestly. The token is deleted when sending fails, so the
    // resend endpoint (POST /verify-email) issues a fresh one.
    let verificationEmailSent = false;
    if (isEmailConfigured) {
      try {
        const raw = generateEmailToken();
        await EmailToken.create({
          userId: user._id,
          purpose: 'email_verification',
          tokenHash: hashEmailToken(raw),
          expiresAt: emailTokenExpiry('email_verification'),
        });
        const link = `${config.FRONTEND_ORIGIN}/?verifyToken=${raw}`;
        const result = await sendEmail({ to: user.email, ...verificationEmail(user.name, link) });
        verificationEmailSent = result.sent;
        if (!result.sent) {
          await EmailToken.deleteOne({
            userId: user._id,
            purpose: 'email_verification',
            tokenHash: hashEmailToken(raw),
          });
        }
      } catch (error) {
        console.error('Signup verification email failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    res.status(201).json({
      user: publicUser(user),
      // The native app cannot read the Set-Cookie header (Hermes
      // hides it), so it needs the token in the body — see
      // extractSessionToken in lib/session.ts. The web app ignores it.
      sessionToken,
      verificationEmailSent,
      notice: verificationEmailSent
        ? 'Verify your email from the link we just sent you.'
        : isEmailConfigured
          ? 'Your account is created, but the verification email could not be sent. You can resend it from Profile & settings.'
          : 'Email verification is not set up yet — email sending is not configured on this server. Your account is created but your email is unverified.',
    });
  } catch (error) { next(error); }
});

authRouter.post('/login', strictAuthLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid email or password' }); return; }
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash name email emailVerifiedAt role');
    const valid = user ? await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false) : false;
    if (!user || !valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }
    // Session rotation: every previous session is invalidated on login.
    const sessionToken = await rotateSession(String(user._id), req, res);
    // The native app cannot read the Set-Cookie header (Hermes
    // hides it), so it needs the token in the body — see
    // extractSessionToken in lib/session.ts. The web app ignores it.
    res.json({ user: publicUser(user), sessionToken });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.authUser }));

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // Accept the token from either transport (cookie or Bearer),
    // so the native app can revoke the session it holds.
    const token = extractSessionToken(req);
    if (typeof token === 'string') await Session.deleteOne({ tokenHash: hashSessionToken(token) });
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) { next(error); }
});

/* ------------------------------------------------------------------ */
/* Email verification                                                  */
/* ------------------------------------------------------------------ */

/** Request a verification email for the signed-in user. */
authRouter.post('/verify-email', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser!.id).select('_id name email emailVerifiedAt');
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }
    if (user.emailVerifiedAt) { res.json({ alreadyVerified: true }); return; }
    if (!isEmailConfigured) { emailNotConfigured(res); return; }
    await EmailToken.deleteMany({ userId: user._id, purpose: 'email_verification', usedAt: null });
    const raw = generateEmailToken();
    await EmailToken.create({
      userId: user._id,
      purpose: 'email_verification',
      tokenHash: hashEmailToken(raw),
      expiresAt: emailTokenExpiry('email_verification'),
    });
    const link = `${config.FRONTEND_ORIGIN}/?verifyToken=${raw}`;
    const result = await sendEmail({ to: user.email, ...verificationEmail(user.name, link) });
    if (!result.sent) { res.status(502).json({ error: 'Verification email could not be sent. Please try again later.' }); return; }
    res.json({ sent: true });
  } catch (error) { next(error); }
});

/** Confirm a verification link (public — the token IS the credential). */
authRouter.get('/verify-email', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) { res.status(400).json({ error: 'Verification link is missing its token.' }); return; }
    // Atomic claim: findOneAndUpdate with usedAt: null in the filter
    // marks the token used in the same operation that finds it, so
    // two concurrent requests with the same link cannot both verify.
    const now = new Date();
    const record = await EmailToken.findOneAndUpdate(
      {
        purpose: 'email_verification',
        tokenHash: hashEmailToken(token),
        usedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { usedAt: now } },
      { new: true },
    );
    if (!record) { res.status(400).json({ error: 'This verification link is invalid or has expired.' }); return; }
    await User.updateOne({ _id: record.userId }, { $set: { emailVerifiedAt: now } });
    res.json({ verified: true });
  } catch (error) { next(error); }
});

/* ------------------------------------------------------------------ */
/* Password reset + change                                             */
/* ------------------------------------------------------------------ */

/** Request a reset email. Always answers the same way for unknown emails. */
authRouter.post('/forgot-password', strictAuthLimiter, async (req, res, next) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Enter a valid email address' }); return; }
    if (!isEmailConfigured) { emailNotConfigured(res); return; }
    const user = await User.findOne({ email: parsed.data.email }).select('_id name email');
    if (user) {
      await EmailToken.deleteMany({ userId: user._id, purpose: 'password_reset', usedAt: null });
      const raw = generateEmailToken();
      await EmailToken.create({
        userId: user._id,
        purpose: 'password_reset',
        tokenHash: hashEmailToken(raw),
        expiresAt: emailTokenExpiry('password_reset'),
      });
      const link = `${config.FRONTEND_ORIGIN}/?resetToken=${raw}`;
      // The send result must be checked: previously a failed SMTP
      // send still answered { sent: true }, telling the user a reset
      // email was on its way when it was not. The token stays valid
      // for 1 hour, so a retry reuses it (a new request replaces it).
      const result = await sendEmail({ to: user.email, ...passwordResetEmail(user.name, link) });
      if (!result.sent) {
        res.status(502).json({ error: 'Reset email could not be sent. Please try again later.' });
        return;
      }
    }
    // Same response whether or not the email exists — no account enumeration.
    res.json({ sent: true, message: 'If an account exists for this email, a reset link has been sent.' });
  } catch (error) { next(error); }
});

/** Reset the password with a valid single-use token. */
authRouter.post('/reset-password', strictAuthLimiter, async (req, res, next) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid reset details', details: parsed.error.flatten().fieldErrors }); return; }
    // Atomic claim (same race as verification): the token is marked
    // used in the same operation that finds it, so it is single-use
    // even under concurrent requests.
    const now = new Date();
    const record = await EmailToken.findOneAndUpdate(
      {
        purpose: 'password_reset',
        tokenHash: hashEmailToken(parsed.data.token),
        usedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { usedAt: now } },
      { new: true },
    );
    if (!record) { res.status(400).json({ error: 'This reset link is invalid or has expired.' }); return; }
    await User.updateOne({ _id: record.userId }, { $set: { passwordHash: await hashPassword(parsed.data.password) } });
    // A reset invalidates every session, everywhere.
    await revokeAllSessions(String(record.userId));
    res.json({ reset: true });
  } catch (error) { next(error); }
});

/** Change password while signed in (old password required). */
authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid password details', details: parsed.error.flatten().fieldErrors }); return; }
    const user = await User.findById(req.authUser!.id).select('+passwordHash');
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }
    const valid = await argon2.verify(user.passwordHash, parsed.data.currentPassword).catch(() => false);
    if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }
    user.passwordHash = await hashPassword(parsed.data.newPassword);
    await user.save();
    // Rotate: all other sessions are invalidated, this one is re-issued.
    await rotateSession(String(user._id), req, res);
    res.json({ changed: true });
  } catch (error) { next(error); }
});

/* ------------------------------------------------------------------ */
/* Sessions (list + revoke)                                            */
/* ------------------------------------------------------------------ */

authRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    await pruneExpiredSessions(req.authUser!.id);
    const current = req.cookies?.[config.SESSION_COOKIE_NAME];
    const currentHash = typeof current === 'string' ? hashSessionToken(current) : '';
    const sessions = await Session.find({ userId: req.authUser!.id }).sort({ createdAt: -1 }).lean();
    res.json({
      sessions: sessions.map((s) => ({
        id: String(s._id),
        current: s.tokenHash === currentHash,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    });
  } catch (error) { next(error); }
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await Session.findOneAndDelete({ _id: req.params.id, userId: req.authUser!.id });
    if (!deleted) { res.status(404).json({ error: 'Session not found' }); return; }
    const current = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof current === 'string' && deleted.tokenHash === hashSessionToken(current)) {
      clearSessionCookie(res);
    }
    res.status(204).end();
  } catch (error) { next(error); }
});

/* ------------------------------------------------------------------ */
/* Data export + account deletion                                       */
/* ------------------------------------------------------------------ */

/** Download the user's own data as JSON (no secrets included). */
authRouter.get('/export', requireAuth, async (req, res, next) => {
  try {
    const data = await exportAccount(req.authUser!.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ahdora-export.json"');
    res.json(data);
  } catch (error) { next(error); }
});

/** Delete the account and ALL of its data (password confirmation required). */
authRouter.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Enter your password to confirm deletion' }); return; }
    const user = await User.findById(req.authUser!.id).select('+passwordHash');
    if (!user) { res.status(404).json({ error: 'Account not found' }); return; }
    const valid = await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false);
    if (!valid) { res.status(401).json({ error: 'Password is incorrect' }); return; }
    await deleteAccount(String(user._id));
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) { next(error); }
});
