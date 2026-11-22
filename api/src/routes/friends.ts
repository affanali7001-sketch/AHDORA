import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { joinChallenge } from '../lib/challengeJoin.js';
import { currentDayFor, userTimezone } from '../lib/challengeProgress.js';
import { createNotification } from '../lib/notifications.js';
import {
  challengeInviteAccepted,
  challengeInviteDeclined,
  challengeInviteReceived,
  friendRequestAccepted,
  friendRequestReceived,
} from '../lib/notificationCopy.js';
import { emitToUser } from '../lib/realtime.js';
import { dateKeyInTimezone } from '../lib/timezone.js';
import { Challenge } from '../models/Challenge.js';
import { ChallengeInvitation } from '../models/ChallengeInvitation.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { FriendRequest } from '../models/FriendRequest.js';
import { Friendship, orderedPair } from '../models/Friendship.js';
import { User } from '../models/User.js';
import { UserPoints } from '../models/UserPoints.js';
import { isDuplicateKeyError } from '../lib/points.js';

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

type PublicUserDoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

/**
 * The ONLY shape in which another user is ever exposed: id + name +
 * a display initial. Never an email, never profile details, never
 * tasks, Salah records, study stats, or points history.
 */
function publicUser(doc: PublicUserDoc) {
  const initial = doc.name.trim().charAt(0).toUpperCase() || '?';
  return { id: String(doc._id), name: doc.name, initial };
}

/**
 * Total points for a set of users, in ONE UserPoints query ($in over
 * the returned ids). Users with no UserPoints row have 0 points.
 * Only the single aggregate total is ever exposed — never a points
 * history, and never through publicUser() itself, so the friends
 * list, requests and invites keep the id + name + initial shape.
 */
async function pointsTotals(userIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (userIds.length === 0) return totals;
  const rows = await UserPoints.find({ userId: { $in: userIds } })
    .select('userId total')
    .lean();
  for (const row of rows) totals.set(String(row.userId), row.total ?? 0);
  return totals;
}

/** publicUser plus the TOTAL points — discover/search only. */
function publicUserWithPoints(doc: PublicUserDoc, points: number) {
  return { ...publicUser(doc), points };
}

async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const [a, b] = orderedPair(userId, otherId);
  const row = await Friendship.findOne({ userA: a, userB: b }).select('_id').lean();
  return Boolean(row);
}

async function loadPublicUser(userId: string): Promise<{ id: string; name: string; initial: string } | null> {
  const doc = await User.findById(userId).select('_id name').lean();
  return doc ? publicUser(doc as PublicUserDoc) : null;
}

type FriendRequestDoc = {
  _id: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

async function serializeRequest(doc: FriendRequestDoc, me: string) {
  const otherId = String(doc.fromUserId) === me ? String(doc.toUserId) : String(doc.fromUserId);
  const other = await loadPublicUser(otherId);
  return {
    id: String(doc._id),
    fromUserId: String(doc.fromUserId),
    toUserId: String(doc.toUserId),
    status: doc.status,
    direction: String(doc.fromUserId) === me ? 'outgoing' : 'incoming',
    other,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

type InvitationDoc = {
  _id: mongoose.Types.ObjectId;
  challengeId: mongoose.Types.ObjectId;
  fromUserId: mongoose.Types.ObjectId;
  toUserId: mongoose.Types.ObjectId;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

async function serializeInvitation(doc: InvitationDoc, me: string) {
  const otherId = String(doc.fromUserId) === me ? String(doc.toUserId) : String(doc.fromUserId);
  const [other, challenge] = await Promise.all([
    loadPublicUser(otherId),
    Challenge.findById(doc.challengeId).select('_id title category durationDays').lean(),
  ]);
  return {
    id: String(doc._id),
    challengeId: String(doc.challengeId),
    challenge: challenge
      ? {
          id: String(challenge._id),
          title: challenge.title,
          category: challenge.category,
          durationDays: challenge.durationDays,
        }
      : null,
    fromUserId: String(doc.fromUserId),
    toUserId: String(doc.toUserId),
    status: doc.status,
    direction: String(doc.fromUserId) === me ? 'outgoing' : 'incoming',
    other,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Search users (public fields only)                                   */
/* ------------------------------------------------------------------ */

friendsRouter.get('/search', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length < 2) {
      res.status(400).json({ error: 'Search needs at least 2 characters' });
      return;
    }
    if (query.length > 80) {
      res.status(400).json({ error: 'Search is too long' });
      return;
    }
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      _id: { $ne: req.authUser!.id },
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: `^${escaped}$`, $options: 'i' } },
      ],
    })
      .select('_id name')
      .limit(10)
      .lean();
    // Emails are searchable but never returned. Points are the total
    // only — no history, no breakdown.
    const totals = await pointsTotals(users.map((u) => String(u._id)));
    res.json({
      users: users.map((u) =>
        publicUserWithPoints(u as PublicUserDoc, totals.get(String(u._id)) ?? 0),
      ),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Discover people (public fields only)                                */
/*                                                                     */
/* Search only finds people whose name (or exact email) you already   */
/* know, so nobody was ever visible in the app. Discover lists a      */
/* small set of other users up front — same privacy shape as search:   */
/* id + name + initial only, never an email or profile details.       */
/* Auth is required (friendsRouter.use(requireAuth) above) and the     */
/* shared /api/friends rate limit in app.ts (120 / 15 min) covers     */
/* this route exactly like /search.                                    */
/* ------------------------------------------------------------------ */

const DISCOVER_LIMIT = 10;

friendsRouter.get('/discover', async (req, res, next) => {
  try {
    const me = req.authUser!.id;
    const rawLimit =
      typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : Number.NaN;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), DISCOVER_LIMIT)
      : DISCOVER_LIMIT;
    const users = await User.find({ _id: { $ne: me } })
      .select('_id name')
      .limit(limit)
      .lean();
    // Only _id + name are ever selected, so no email or private data
    // can leak through this response. Points are the total only.
    const totals = await pointsTotals(users.map((u) => String(u._id)));
    res.json({
      users: users.map((u) =>
        publicUserWithPoints(u as PublicUserDoc, totals.get(String(u._id)) ?? 0),
      ),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Friends list                                                        */
/* ------------------------------------------------------------------ */

friendsRouter.get('/', async (req, res, next) => {
  try {
    const me = req.authUser!.id;
    const rows = await Friendship.find({
      $or: [{ userA: me }, { userB: me }],
    })
      .sort({ since: -1 })
      .lean();
    const friends = [];
    for (const row of rows) {
      const otherId = String(row.userA) === me ? String(row.userB) : String(row.userA);
      const other = await loadPublicUser(otherId);
      if (!other) continue;
      friends.push({ ...other, since: row.since });
    }
    res.json({ friends });
  } catch (error) {
    next(error);
  }
});

friendsRouter.delete('/:friendId', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.friendId)) {
      res.status(400).json({ error: 'Invalid friend id' });
      return;
    }
    const me = req.authUser!.id;
    const otherId = req.params.friendId;
    if (otherId === me) {
      res.status(400).json({ error: 'You cannot remove yourself' });
      return;
    }
    const [a, b] = orderedPair(me, otherId);
    const removed = await Friendship.findOneAndDelete({ userA: a, userB: b }).lean();
    if (!removed) {
      res.status(404).json({ error: 'Friendship not found' });
      return;
    }
    // Any pending requests between the pair are cancelled too.
    await FriendRequest.updateMany(
      {
        status: 'pending',
        $or: [
          { fromUserId: me, toUserId: otherId },
          { fromUserId: otherId, toUserId: me },
        ],
      },
      { status: 'cancelled', respondedAt: new Date() },
    );
    res.json({ message: 'Friend removed' });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Friend requests                                                     */
/* ------------------------------------------------------------------ */

friendsRouter.get('/requests', async (req, res, next) => {
  try {
    const me = req.authUser!.id;
    const rows = (await FriendRequest.find({
      status: 'pending',
      $or: [{ fromUserId: me }, { toUserId: me }],
    })
      .sort({ createdAt: -1 })
      .lean()) as unknown as FriendRequestDoc[];
    const incoming = [];
    const outgoing = [];
    for (const row of rows) {
      const serialized = await serializeRequest(row, me);
      if (serialized.direction === 'incoming') incoming.push(serialized);
      else outgoing.push(serialized);
    }
    res.json({ incoming, outgoing });
  } catch (error) {
    next(error);
  }
});

const requestSchema = z.object({
  toUserId: z.string().refine(isObjectId, 'Invalid user id'),
}).strict();

friendsRouter.post('/requests', async (req, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid friend request' });
      return;
    }
    const me = req.authUser!.id;
    const toUserId = parsed.data.toUserId;
    if (toUserId === me) {
      res.status(400).json({ error: 'You cannot send a friend request to yourself' });
      return;
    }
    const target = await User.findById(toUserId).select('_id name').lean();
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (await areFriends(me, toUserId)) {
      res.status(409).json({ error: 'You are already friends' });
      return;
    }
    const existing = await FriendRequest.findOne({
      status: 'pending',
      $or: [
        { fromUserId: me, toUserId },
        { fromUserId: toUserId, toUserId: me },
      ],
    }).lean();
    if (existing) {
      res.status(409).json({
        error: 'A friend request already exists between you. Check your incoming requests.',
      });
      return;
    }
    let request: FriendRequestDoc;
    try {
      const created = await FriendRequest.create({
        fromUserId: me,
        toUserId,
        status: 'pending',
      });
      request = created.toObject() as FriendRequestDoc;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({ error: 'A friend request already exists between you' });
        return;
      }
      throw error;
    }
    const mePublic = await loadPublicUser(me);
    await createNotification(toUserId, {
      type: 'friend',
      ...friendRequestReceived(mePublic?.name ?? 'Koi'),
      refType: 'FriendRequest',
      refId: String(request._id),
    });
    emitToUser(toUserId, 'friend_request_received', {
      requestId: String(request._id),
      fromUserId: me,
      fromName: mePublic?.name ?? '',
    });
    res.status(201).json({ request: await serializeRequest(request, me) });
  } catch (error) {
    next(error);
  }
});

friendsRouter.post('/requests/:id/accept', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid request id' });
      return;
    }
    const me = req.authUser!.id;
    // Only the recipient may accept, and only while it is pending.
    const request = (await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, toUserId: me, status: 'pending' },
      { status: 'accepted', respondedAt: new Date() },
      { new: true },
    ).lean()) as unknown as FriendRequestDoc | null;
    if (!request) {
      res.status(403).json({ error: 'This friend request cannot be accepted by you' });
      return;
    }
    const [a, b] = orderedPair(me, String(request.fromUserId));
    try {
      await Friendship.create({ userA: a, userB: b, since: new Date() });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      // Already friends (e.g. a duplicate accept raced through).
    }
    const mePublic = await loadPublicUser(me);
    const senderId = String(request.fromUserId);
    await createNotification(senderId, {
      type: 'friend',
      ...friendRequestAccepted(mePublic?.name ?? 'Kisi ne'),
      refType: 'FriendRequest',
      refId: String(request._id),
    });
    emitToUser(senderId, 'friend_request_accepted', {
      requestId: String(request._id),
      byUserId: me,
      byName: mePublic?.name ?? '',
    });
    res.json({ request: await serializeRequest(request, me) });
  } catch (error) {
    next(error);
  }
});

friendsRouter.post('/requests/:id/reject', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid request id' });
      return;
    }
    const me = req.authUser!.id;
    const request = (await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, toUserId: me, status: 'pending' },
      { status: 'rejected', respondedAt: new Date() },
      { new: true },
    ).lean()) as unknown as FriendRequestDoc | null;
    if (!request) {
      res.status(403).json({ error: 'This friend request cannot be rejected by you' });
      return;
    }
    res.json({ request: await serializeRequest(request, me) });
  } catch (error) {
    next(error);
  }
});

friendsRouter.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid request id' });
      return;
    }
    const me = req.authUser!.id;
    const request = (await FriendRequest.findOneAndUpdate(
      { _id: req.params.id, fromUserId: me, status: 'pending' },
      { status: 'cancelled', respondedAt: new Date() },
      { new: true },
    ).lean()) as unknown as FriendRequestDoc | null;
    if (!request) {
      res.status(403).json({ error: 'This friend request cannot be cancelled by you' });
      return;
    }
    res.json({ request: await serializeRequest(request, me) });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Challenge invites                                                   */
/* ------------------------------------------------------------------ */

friendsRouter.get('/invites', async (req, res, next) => {
  try {
    const me = req.authUser!.id;
    const rows = (await ChallengeInvitation.find({
      status: 'pending',
      $or: [{ fromUserId: me }, { toUserId: me }],
    })
      .sort({ createdAt: -1 })
      .lean()) as unknown as InvitationDoc[];
    const incoming = [];
    const outgoing = [];
    for (const row of rows) {
      const serialized = await serializeInvitation(row, me);
      if (serialized.direction === 'incoming') incoming.push(serialized);
      else outgoing.push(serialized);
    }
    res.json({ incoming, outgoing });
  } catch (error) {
    next(error);
  }
});

const inviteSchema = z.object({
  challengeId: z.string().refine(isObjectId, 'Invalid challenge id'),
  toUserId: z.string().refine(isObjectId, 'Invalid user id'),
}).strict();

friendsRouter.post('/invites', async (req, res, next) => {
  try {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid invitation' });
      return;
    }
    const me = req.authUser!.id;
    const { challengeId, toUserId } = parsed.data;
    if (toUserId === me) {
      res.status(400).json({ error: 'You cannot invite yourself' });
      return;
    }
    const target = await User.findById(toUserId).select('_id name').lean();
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const challenge = await Challenge.findById(challengeId)
      .select('_id title category durationDays')
      .lean();
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    if (!(await areFriends(me, toUserId))) {
      res.status(403).json({ error: 'You can only invite friends to a challenge' });
      return;
    }
    const myParticipation = await ChallengeParticipant.findOne({
      userId: me,
      challengeId,
      status: 'active',
    }).select('_id').lean();
    if (!myParticipation) {
      res.status(403).json({ error: 'You can only invite others to a challenge you take part in' });
      return;
    }
    const alreadyTakingPart = await ChallengeParticipant.findOne({
      userId: toUserId,
      challengeId,
      status: 'active',
    }).select('_id').lean();
    if (alreadyTakingPart) {
      res.status(409).json({ error: 'They are already taking part in this challenge' });
      return;
    }
    const existing = await ChallengeInvitation.findOne({
      challengeId,
      toUserId,
      status: 'pending',
    }).lean();
    if (existing) {
      res.status(409).json({ error: 'An invitation for this challenge is already pending' });
      return;
    }
    let invitation: InvitationDoc;
    try {
      const created = await ChallengeInvitation.create({
        challengeId,
        fromUserId: me,
        toUserId,
        status: 'pending',
      });
      invitation = created.toObject() as InvitationDoc;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({ error: 'An invitation for this challenge is already pending' });
        return;
      }
      throw error;
    }
    const mePublic = await loadPublicUser(me);
    await createNotification(toUserId, {
      type: 'challenge',
      ...challengeInviteReceived(mePublic?.name ?? 'Kisi ne', challenge.title),
      refType: 'ChallengeInvitation',
      refId: String(invitation._id),
    });
    emitToUser(toUserId, 'challenge_invite_received', {
      inviteId: String(invitation._id),
      challengeId: String(challenge._id),
      challengeTitle: challenge.title,
      fromUserId: me,
      fromName: mePublic?.name ?? '',
    });
    res.status(201).json({ invite: await serializeInvitation(invitation, me) });
  } catch (error) {
    next(error);
  }
});

const inviteResponseSchema = z.object({
  consent: z.literal(true, { error: 'Joining requires explicit consent' }),
}).strict();

friendsRouter.post('/invites/:id/accept', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid invite id' });
      return;
    }
    const parsed = inviteResponseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Joining requires explicit consent' });
      return;
    }
    const me = req.authUser!.id;
    const invite = (await ChallengeInvitation.findOne({
      _id: req.params.id,
      toUserId: me,
      status: 'pending',
    }).lean()) as unknown as InvitationDoc | null;
    if (!invite) {
      res.status(403).json({ error: 'This invitation cannot be accepted by you' });
      return;
    }
    const challenge = await Challenge.findById(invite.challengeId).lean();
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    // Join under the exact Phase 3 rules (consent + no duplicates).
    const { fresh } = await joinChallenge(me, challenge as never);
    if (!fresh) {
      res.status(409).json({ error: 'You are already taking part in this challenge' });
      return;
    }
    const accepted = (await ChallengeInvitation.findOneAndUpdate(
      { _id: invite._id, status: 'pending' },
      { status: 'accepted', respondedAt: new Date() },
      { new: true },
    ).lean()) as unknown as InvitationDoc | null;
    const mePublic = await loadPublicUser(me);
    const inviterId = String(invite.fromUserId);
    await createNotification(inviterId, {
      type: 'challenge',
      ...challengeInviteAccepted(mePublic?.name ?? 'Kisi ne', challenge.title),
      refType: 'ChallengeInvitation',
      refId: String(invite._id),
    });
    emitToUser(inviterId, 'challenge_invite_response', {
      inviteId: String(invite._id),
      challengeId: String(challenge._id),
      challengeTitle: challenge.title,
      byUserId: me,
      byName: mePublic?.name ?? '',
      status: 'accepted',
    });
    res.json({ invite: accepted ? await serializeInvitation(accepted, me) : null });
  } catch (error) {
    next(error);
  }
});

friendsRouter.post('/invites/:id/decline', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid invite id' });
      return;
    }
    const me = req.authUser!.id;
    const invite = (await ChallengeInvitation.findOneAndUpdate(
      { _id: req.params.id, toUserId: me, status: 'pending' },
      { status: 'declined', respondedAt: new Date() },
      { new: true },
    ).lean()) as unknown as InvitationDoc | null;
    if (!invite) {
      res.status(403).json({ error: 'This invitation cannot be declined by you' });
      return;
    }
    const challenge = await Challenge.findById(invite.challengeId)
      .select('_id title')
      .lean();
    const mePublic = await loadPublicUser(me);
    const inviterId = String(invite.fromUserId);
    await createNotification(inviterId, {
      type: 'challenge',
      ...challengeInviteDeclined(mePublic?.name ?? 'Kisi ne', challenge?.title ?? 'challenge'),
      refType: 'ChallengeInvitation',
      refId: String(invite._id),
    });
    emitToUser(inviterId, 'challenge_invite_response', {
      inviteId: String(invite._id),
      challengeId: String(invite.challengeId),
      challengeTitle: challenge?.title ?? '',
      byUserId: me,
      byName: mePublic?.name ?? '',
      status: 'declined',
    });
    res.json({ invite: await serializeInvitation(invite, me) });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Shared challenge progress (friends only, shared fields only)        */
/*                                                                     */
/* A friend can see, for challenges you BOTH take part in, ONLY:       */
/* challenge name, current day / total, completed days, progress and   */
/* points earned. No tasks, Salah records, study stats, profile data   */
/* or points history are ever exposed here — there is no endpoint     */
/* that returns them for another user.                                 */
/* ------------------------------------------------------------------ */

friendsRouter.get('/:friendId/shared-challenges', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.friendId)) {
      res.status(400).json({ error: 'Invalid friend id' });
      return;
    }
    const me = req.authUser!.id;
    const friendId = req.params.friendId;
    if (friendId === me) {
      res.status(400).json({ error: 'You cannot view shared challenges with yourself' });
      return;
    }
    if (!(await areFriends(me, friendId))) {
      res.status(403).json({ error: 'Shared progress is only visible between friends' });
      return;
    }
    const friend = await loadPublicUser(friendId);
    if (!friend) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const timezone = await userTimezone(me);
    const today = dateKeyInTimezone(timezone);
    const myParticipations = await ChallengeParticipant.find({
      userId: me,
      status: { $in: ['active', 'completed'] },
    }).lean();
    const shared = [];
    for (const mine of myParticipations) {
      const theirs = await ChallengeParticipant.findOne({
        userId: friendId,
        challengeId: mine.challengeId,
        status: { $in: ['active', 'completed'] },
      }).lean();
      if (!theirs) continue;
      const challenge = await Challenge.findById(mine.challengeId)
        .select('_id title category durationDays')
        .lean();
      if (!challenge) continue;
      const progressOf = (p: typeof mine) => ({
        currentDay: currentDayFor(p as never, challenge as never, today, timezone),
        totalDays: challenge.durationDays,
        completedDays: p.completedDays,
        pointsEarned: p.pointsEarned,
        status: p.status,
      });
      shared.push({
        challengeId: String(challenge._id),
        challengeTitle: challenge.title,
        category: challenge.category,
        mine: progressOf(mine),
        friend: progressOf(theirs),
      });
    }
    res.json({ friend, shared });
  } catch (error) {
    next(error);
  }
});
