import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Challenge, challengeCategories } from '../models/Challenge.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { ChallengeProgress } from '../models/ChallengeProgress.js';
import {
  checkInDay,
  currentDayFor,
  dayNumberFor,
  refreshChallengeProgress,
  userTimezone,
} from '../lib/challengeProgress.js';
import {
  CHALLENGE_TEMPLATES,
  LEAVE_RULE,
  findTemplate,
} from '../lib/challengeTemplates.js';
import { isDuplicateKeyError } from '../lib/points.js';
import { dateKeyInTimezone } from '../lib/timezone.js';

export const challengesRouter = Router();

challengesRouter.use(requireAuth);

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type ChallengeDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  durationDays: number;
  kind: string;
  templateId: string | null;
  rules: string[];
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

type ParticipantDoc = {
  _id: mongoose.Types.ObjectId;
  challengeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: string;
  joinedAt: Date;
  completedAt: Date | null;
  leftAt: Date | null;
  completedDays: number;
  streak: number;
  pointsEarned: number;
};

function serializeChallenge(doc: ChallengeDoc) {
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description,
    category: doc.category,
    durationDays: doc.durationDays,
    kind: doc.kind,
    templateId: doc.templateId,
    rules: doc.rules,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function serializeParticipant(
  doc: ParticipantDoc,
  challenge: ChallengeDoc,
  todayKey: string,
  timezone: string,
  todayCompleted: boolean,
) {
  return {
    id: String(doc._id),
    challengeId: String(doc.challengeId),
    challenge: serializeChallenge(challenge),
    status: doc.status,
    joinedAt: doc.joinedAt,
    completedAt: doc.completedAt,
    leftAt: doc.leftAt,
    completedDays: doc.completedDays,
    totalDays: challenge.durationDays,
    currentDay:
      doc.status === 'active'
        ? currentDayFor(doc as never, challenge as never, todayKey, timezone)
        : challenge.durationDays,
    streak: doc.streak,
    pointsEarned: doc.pointsEarned,
    todayCompleted,
    leaveRule: LEAVE_RULE,
  };
}

async function todayCompletedFor(participantId: string, todayKey: string): Promise<boolean> {
  const row = await ChallengeProgress.findOne({
    participantId,
    date: todayKey,
    completed: true,
  }).select('_id').lean();
  return Boolean(row);
}

async function loadMyParticipation(
  userId: string,
  challengeId: string,
): Promise<ParticipantDoc | null> {
  return (await ChallengeParticipant.findOne({
    userId,
    challengeId,
    status: 'active',
  }).lean()) as unknown as ParticipantDoc | null;
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

challengesRouter.get('/templates', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const active = await ChallengeParticipant.find({ userId, status: 'active' })
      .select('challengeId')
      .lean();
    const activeIds = new Set(active.map((p) => String(p.challengeId)));
    const templateChallenges = await Challenge.find({
      kind: 'template',
      templateId: { $in: CHALLENGE_TEMPLATES.map((t) => t.id) },
    }).select('_id templateId').lean();
    const joinedTemplateIds = new Set(
      templateChallenges
        .filter((c) => activeIds.has(String(c._id)))
        .map((c) => c.templateId),
    );
    res.json({
      templates: CHALLENGE_TEMPLATES.map((t) => ({
        ...t,
        joined: joinedTemplateIds.has(t.id),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* My challenges                                                       */
/* ------------------------------------------------------------------ */

challengesRouter.get('/mine', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const timezone = await userTimezone(userId);
    const today = dateKeyInTimezone(timezone);
    await refreshChallengeProgress(userId, today);

    const participants = (await ChallengeParticipant.find({ userId })
      .sort({ updatedAt: -1 })
      .lean()) as unknown as ParticipantDoc[];
    const challengeIds = participants.map((p) => p.challengeId);
    const challenges = (await Challenge.find({ _id: { $in: challengeIds } }).lean()) as unknown as ChallengeDoc[];
    const byId = new Map(challenges.map((c) => [String(c._id), c]));

    const serialized = [];
    for (const participant of participants) {
      const challenge = byId.get(String(participant.challengeId));
      if (!challenge) continue;
      serialized.push(
        serializeParticipant(
          participant,
          challenge,
          today,
          timezone,
          participant.status === 'active'
            ? await todayCompletedFor(String(participant._id), today)
            : false,
        ),
      );
    }
    res.json({
      active: serialized.filter((p) => p.status === 'active'),
      history: serialized.filter((p) => p.status !== 'active'),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Create a user-defined challenge (creator auto-joins)                */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(challengeCategories),
  durationDays: z.number().int().min(1).max(365),
  rules: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  consent: z.literal(true, { error: 'Joining requires explicit consent' }),
}).strict();

challengesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid challenge details or missing consent' });
      return;
    }
    const data = parsed.data;
    const challenge = await Challenge.create({
      title: data.title,
      description: data.description ?? '',
      category: data.category,
      durationDays: data.durationDays,
      kind: 'custom',
      templateId: null,
      rules: data.rules,
      createdBy: req.authUser!.id,
    });
    const participant = await ChallengeParticipant.create({
      challengeId: challenge._id,
      userId: req.authUser!.id,
      status: 'active',
      joinedAt: new Date(),
    });
    const timezone = await userTimezone(req.authUser!.id);
    const today = dateKeyInTimezone(timezone);
    res.status(201).json({
      challenge: serializeChallenge(challenge.toObject() as ChallengeDoc),
      participation: serializeParticipant(
        participant.toObject() as ParticipantDoc,
        challenge.toObject() as ChallengeDoc,
        today,
        timezone,
        false,
      ),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

challengesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid challenge id' });
      return;
    }
    const challenge = (await Challenge.findById(req.params.id).lean()) as unknown as ChallengeDoc | null;
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    const userId = req.authUser!.id;
    const timezone = await userTimezone(userId);
    const today = dateKeyInTimezone(timezone);
    await refreshChallengeProgress(userId, today);

    const participation = (await ChallengeParticipant.findOne({
      userId,
      challengeId: challenge._id,
      status: 'active',
    }).lean()) as unknown as ParticipantDoc | null;
    const history = (await ChallengeParticipant.find({
      userId,
      challengeId: challenge._id,
      status: { $ne: 'active' },
    }).sort({ updatedAt: -1 }).lean()) as unknown as ParticipantDoc[];

    let progress: { date: string; dayNumber: number; completed: boolean; source: string }[] = [];
    let todayCompleted = false;
    let currentDay = 1;
    if (participation) {
      const rows = await ChallengeProgress.find({ participantId: participation._id })
        .sort({ date: -1 })
        .limit(60)
        .lean();
      progress = rows.map((r) => ({
        date: r.date,
        dayNumber: r.dayNumber,
        completed: r.completed,
        source: r.source,
      }));
      todayCompleted = rows.some((r) => r.date === today && r.completed);
      currentDay = currentDayFor(participation as never, challenge as never, today, timezone);
    }

    res.json({
      challenge: serializeChallenge(challenge),
      participation: participation
        ? serializeParticipant(participation, challenge, today, timezone, todayCompleted)
        : null,
      history: history.map((p) =>
        serializeParticipant(p, challenge, today, timezone, false),
      ),
      progress,
      currentDay,
      todayCompleted,
      leaveRule: LEAVE_RULE,
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Join                                                                */
/* ------------------------------------------------------------------ */

const joinSchema = z.object({
  consent: z.literal(true, { error: 'Joining requires explicit consent' }),
}).strict();

async function joinChallenge(
  userId: string,
  challenge: ChallengeDoc,
): Promise<{ participant: ParticipantDoc; fresh: boolean }> {
  const existing = await loadMyParticipation(userId, String(challenge._id));
  if (existing) {
    return { participant: existing, fresh: false };
  }
  try {
    const participant = await ChallengeParticipant.create({
      challengeId: challenge._id,
      userId,
      status: 'active',
      joinedAt: new Date(),
    });
    return { participant: participant.toObject() as ParticipantDoc, fresh: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const again = await loadMyParticipation(userId, String(challenge._id));
      if (again) return { participant: again, fresh: false };
    }
    throw error;
  }
}

challengesRouter.post('/:id/join', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid challenge id' });
      return;
    }
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Joining requires explicit consent' });
      return;
    }
    const challenge = (await Challenge.findById(req.params.id).lean()) as unknown as ChallengeDoc | null;
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    const { participant, fresh } = await joinChallenge(req.authUser!.id, challenge);
    if (!fresh) {
      res.status(409).json({ error: 'You are already taking part in this challenge' });
      return;
    }
    const timezone = await userTimezone(req.authUser!.id);
    const today = dateKeyInTimezone(timezone);
    await refreshChallengeProgress(req.authUser!.id, today);
    const refreshed = (await ChallengeParticipant.findById(participant._id).lean()) as unknown as ParticipantDoc;
    res.status(201).json({
      participation: serializeParticipant(
        refreshed,
        challenge,
        today,
        timezone,
        await todayCompletedFor(String(participant._id), today),
      ),
    });
  } catch (error) {
    next(error);
  }
});

challengesRouter.post('/templates/:templateId/join', async (req, res, next) => {
  try {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Joining requires explicit consent' });
      return;
    }
    const template = findTemplate(req.params.templateId);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }
    // Materialise the template as a Challenge document (one per template).
    let challenge = (await Challenge.findOne({ templateId: template.id }).lean()) as unknown as ChallengeDoc | null;
    if (!challenge) {
      try {
        const created = await Challenge.create({
          title: template.title,
          description: template.description,
          category: template.category,
          durationDays: template.durationDays,
          kind: 'template',
          templateId: template.id,
          rules: template.rules,
          createdBy: null,
        });
        challenge = created.toObject() as ChallengeDoc;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          challenge = (await Challenge.findOne({ templateId: template.id }).lean()) as unknown as ChallengeDoc | null;
        } else {
          throw error;
        }
      }
    }
    if (!challenge) {
      res.status(500).json({ error: 'Challenge could not be created' });
      return;
    }
    const { participant, fresh } = await joinChallenge(req.authUser!.id, challenge);
    if (!fresh) {
      res.status(409).json({ error: 'You are already taking part in this challenge' });
      return;
    }
    const timezone = await userTimezone(req.authUser!.id);
    const today = dateKeyInTimezone(timezone);
    await refreshChallengeProgress(req.authUser!.id, today);
    const refreshed = (await ChallengeParticipant.findById(participant._id).lean()) as unknown as ParticipantDoc;
    res.status(201).json({
      challenge: serializeChallenge(challenge),
      participation: serializeParticipant(
        refreshed,
        challenge,
        today,
        timezone,
        await todayCompletedFor(String(participant._id), today),
      ),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Leave                                                               */
/* ------------------------------------------------------------------ */

challengesRouter.post('/:id/leave', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid challenge id' });
      return;
    }
    const participant = (await ChallengeParticipant.findOneAndUpdate(
      { userId: req.authUser!.id, challengeId: req.params.id, status: 'active' },
      { status: 'left', leftAt: new Date() },
      { new: true },
    ).lean()) as unknown as ParticipantDoc | null;
    if (!participant) {
      res.status(404).json({ error: 'No active participation found for this challenge' });
      return;
    }
    const challenge = (await Challenge.findById(req.params.id).lean()) as unknown as ChallengeDoc;
    const timezone = await userTimezone(req.authUser!.id);
    const today = dateKeyInTimezone(timezone);
    res.json({
      message:
        'You left the challenge. Your history and the points you already earned are kept.',
      participation: serializeParticipant(participant, challenge, today, timezone, false),
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Self-reported check-in (sleep / Quran / discipline only)            */
/* ------------------------------------------------------------------ */

const checkInSchema = z.object({
  date: dateSchema.optional(),
}).strict();

challengesRouter.post('/:id/check-in', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid challenge id' });
      return;
    }
    const parsed = checkInSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid check-in date' });
      return;
    }
    const participant = (await ChallengeParticipant.findOne({
      userId: req.authUser!.id,
      challengeId: req.params.id,
      status: 'active',
    }).lean()) as unknown as ParticipantDoc | null;
    if (!participant) {
      res.status(404).json({ error: 'No active participation found for this challenge' });
      return;
    }
    const timezone = await userTimezone(req.authUser!.id);
    const date = parsed.data.date ?? dateKeyInTimezone(timezone);
    try {
      const result = await checkInDay(req.authUser!.id, String(participant._id), date);
      const challenge = (await Challenge.findById(req.params.id).lean()) as unknown as ChallengeDoc;
      const refreshed = (await ChallengeParticipant.findById(participant._id).lean()) as unknown as ParticipantDoc;
      res.json({
        newlyCompleted: result.newlyCompleted,
        challengeCompleted: result.challengeCompleted,
        message: result.newlyCompleted
          ? 'Checked in. This is recorded as a self-reported day.'
          : 'This day was already checked in.',
        participation: serializeParticipant(
          refreshed,
          challenge,
          dateKeyInTimezone(timezone),
          timezone,
          await todayCompletedFor(String(participant._id), dateKeyInTimezone(timezone)),
        ),
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Check-in failed' });
    }
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

challengesRouter.get('/:id/today', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid challenge id' });
      return;
    }
    const challenge = (await Challenge.findById(req.params.id).lean()) as unknown as ChallengeDoc | null;
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }
    const userId = req.authUser!.id;
    const timezone = await userTimezone(userId);
    const today = dateKeyInTimezone(timezone);
    await refreshChallengeProgress(userId, today);
    const participation = (await ChallengeParticipant.findOne({
      userId,
      challengeId: challenge._id,
      status: 'active',
    }).lean()) as unknown as ParticipantDoc | null;
    if (!participation) {
      res.json({
        challenge: serializeChallenge(challenge),
        participation: null,
        todayCompleted: false,
        currentDay: 1,
        dayNumber: 1,
      });
      return;
    }
    const todayCompleted = await todayCompletedFor(String(participation._id), today);
    res.json({
      challenge: serializeChallenge(challenge),
      participation: serializeParticipant(participation, challenge, today, timezone, todayCompleted),
      todayCompleted,
      currentDay: currentDayFor(participation as never, challenge as never, today, timezone),
      dayNumber: dayNumberFor(participation.joinedAt, today, timezone),
    });
  } catch (error) {
    next(error);
  }
});
