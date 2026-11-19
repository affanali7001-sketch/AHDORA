import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { createSession, clearSessionCookie, hashSessionToken } from '../lib/session.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

// Email verification will be enabled when a verified email delivery provider is configured.
authRouter.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid signup details', details: parsed.error.flatten().fieldErrors }); return; }
    const { name, email, password } = parsed.data;
    const existing = await User.exists({ email });
    if (existing) { res.status(409).json({ error: 'Unable to create account with these details' }); return; }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const user = await User.create({ name, email, passwordHash });
    await createSession(String(user._id), req, res);
    res.status(201).json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role }, notice: 'Email verification is not enabled yet. Do not use this staging API for real accounts.' });
  } catch (error) { next(error); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid email or password' }); return; }
    const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash name email role');
    const valid = user ? await argon2.verify(user.passwordHash, parsed.data.password).catch(() => false) : false;
    if (!user || !valid) { res.status(401).json({ error: 'Invalid email or password' }); return; }
    await createSession(String(user._id), req, res);
    res.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.authUser }));

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof token === 'string') await Session.deleteOne({ tokenHash: hashSessionToken(token) });
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) { next(error); }
});
