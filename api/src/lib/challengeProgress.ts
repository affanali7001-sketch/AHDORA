import mongoose from 'mongoose';
import { Challenge, type ChallengeCategory } from '../models/Challenge.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { ChallengeProgress, type progressSources } from '../models/ChallengeProgress.js';
import { PomodoroSession } from '../models/PomodoroSession.js';
import { Profile } from '../models/Profile.js';
import { SalahDay } from '../models/SalahDay.js';
import { StudyTask } from '../models/StudyTask.js';
import {
  awardBadge,
  awardPoints,
  challengeCompletionPoints,
  isDuplicateKeyError,
  type BadgeId,
} from './points.js';
import {
  addDays,
  dateKeyInTimezone,
  daysBetween,
} from './timezone.js';

const AUTO_CATEGORIES: ChallengeCategory[] = ['prayers', 'study', 'focus'];
const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

type ParticipantDoc = {
  _id: mongoose.Types.ObjectId;
  challengeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: string;
  joinedAt: Date;
  completedDays: number;
  streak: number;
  pointsEarned: number;
};

type ChallengeDoc = {
  _id: mongoose.Types.ObjectId;
  title: string;
  category: ChallengeCategory;
  durationDays: number;
  kind: string;
};

export async function userTimezone(userId: string): Promise<string> {
  const profile = await Profile.findOne({ userId }).select('timezone').lean();
  return profile?.timezone?.trim() || 'Asia/Kolkata';
}

/** 1-based day inside the challenge for a YYYY-MM-DD key. */
export function dayNumberFor(joinedAt: Date, dateKey: string, timezone: string): number {
  const joinedKey = dateKeyInTimezone(timezone, new Date(joinedAt));
  return daysBetween(joinedKey, dateKey) + 1;
}

/** Current day number for an active participation, capped at the duration. */
export function currentDayFor(
  participant: ParticipantDoc,
  challenge: ChallengeDoc,
  todayKey: string,
  timezone: string,
): number {
  const day = dayNumberFor(participant.joinedAt, todayKey, timezone);
  return Math.min(Math.max(day, 1), challenge.durationDays);
}

/**
 * A generous UTC window around one timezone day, so a query for "activity
 * on this date in the user's timezone" never misses a record because of
 * the UTC offset. Callers filter precisely in JS afterwards.
 */
function utcWindowForDateKey(dateKey: string): { from: Date; to: Date } {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  return { from, to };
}

type RequirementResult = {
  met: boolean;
  source: (typeof progressSources)[number];
  evidenceRefs: string[];
};

/**
 * Does the user's real activity satisfy one challenge day?
 * Prayers: all five recorded as prayed or Qaza. Study: a task completed
 * or a focus session finished. Focus: a focus session finished. Quran,
 * sleep and discipline have no measured source yet, so they are never
 * auto-completed here — they use an honest self-reported check-in.
 */
async function evaluateRequirement(
  userId: string,
  category: ChallengeCategory,
  dateKey: string,
  timezone: string,
): Promise<RequirementResult> {
  if (category === 'prayers') {
    const record = await SalahDay.findOne({ userId, date: dateKey }).lean();
    const done = PRAYER_NAMES.every((name) => {
      const status = record?.prayers?.[name]?.status;
      return status === 'prayed' || status === 'qaza';
    });
    return {
      met: done,
      source: 'salah',
      evidenceRefs: done ? [`SalahDay:${dateKey}`] : [],
    };
  }

  if (category === 'study' || category === 'focus') {
    const { from, to } = utcWindowForDateKey(dateKey);
    const sessions = await PomodoroSession.find({
      userId,
      status: 'completed',
      mode: 'focus',
      completedAt: { $gte: from, $lt: to },
    }).select('_id completedAt').lean();
    const focusDone = sessions.filter(
      (s) =>
        s.completedAt !== null &&
        s.completedAt !== undefined &&
        dateKeyInTimezone(timezone, new Date(s.completedAt)) === dateKey,
    );
    if (category === 'focus') {
      return {
        met: focusDone.length > 0,
        source: 'focus-session',
        evidenceRefs: focusDone.slice(0, 5).map((s) => `PomodoroSession:${String(s._id)}`),
      };
    }
    const tasks = await StudyTask.find({
      userId,
      status: 'Completed',
      completedAt: { $gte: from, $lt: to },
    }).select('_id completedAt').lean();
    const tasksDone = tasks.filter(
      (t) =>
        t.completedAt !== null &&
        t.completedAt !== undefined &&
        dateKeyInTimezone(timezone, new Date(t.completedAt)) === dateKey,
    );
    const met = tasksDone.length > 0 || focusDone.length > 0;
    return {
      met,
      source: tasksDone.length > 0 ? 'study-task' : 'focus-session',
      evidenceRefs: [
        ...tasksDone.slice(0, 5).map((t) => `StudyTask:${String(t._id)}`),
        ...focusDone.slice(0, 5).map((s) => `PomodoroSession:${String(s._id)}`),
      ],
    };
  }

  return { met: false, source: 'self-reported', evidenceRefs: [] };
}

/** Consecutive completed days ending today (or yesterday, if today is not done yet). */
export async function computeParticipantStreak(
  participantId: string,
  timezone: string,
): Promise<number> {
  const rows = await ChallengeProgress.find({ participantId, completed: true })
    .select('date')
    .lean();
  const done = new Set(rows.map((r) => r.date));
  if (done.size === 0) return 0;
  const today = dateKeyInTimezone(timezone);
  let cursor = done.has(today) ? today : addDays(today, -1);
  if (!done.has(cursor)) return 0;
  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

async function refreshParticipantCounters(
  participant: ParticipantDoc,
  timezone: string,
): Promise<{ completedDays: number; streak: number }> {
  const completedDays = await ChallengeProgress.countDocuments({
    participantId: participant._id,
    completed: true,
  });
  const streak = await computeParticipantStreak(String(participant._id), timezone);
  await ChallengeParticipant.findByIdAndUpdate(participant._id, {
    completedDays,
    streak,
  });
  return { completedDays, streak };
}

/**
 * Mark one day completed and handle everything that follows: points for
 * the day, counters, and — when the last day is done — challenge
 * completion with its bonus points and badge. Idempotent: calling it
 * twice for the same day awards nothing the second time.
 */
export async function completeDay(
  participant: ParticipantDoc,
  challenge: ChallengeDoc,
  dateKey: string,
  timezone: string,
  source: (typeof progressSources)[number],
  evidenceRefs: string[],
): Promise<{ newlyCompleted: boolean; challengeCompleted: boolean }> {
  const dayNumber = dayNumberFor(participant.joinedAt, dateKey, timezone);
  if (dayNumber < 1 || dayNumber > challenge.durationDays) {
    return { newlyCompleted: false, challengeCompleted: false };
  }

  let progressId: mongoose.Types.ObjectId;
  try {
    const progress = await ChallengeProgress.create({
      participantId: participant._id,
      challengeId: challenge._id,
      userId: participant.userId,
      date: dateKey,
      dayNumber,
      completed: true,
      source,
      evidenceRefs,
    });
    progressId = progress._id;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { newlyCompleted: false, challengeCompleted: false };
    }
    throw error;
  }

  const dayPoints = await awardPoints(
    String(participant.userId),
    10,
    'challenge_day_completed',
    'ChallengeProgress',
    String(progressId),
  );

  const { completedDays } = await refreshParticipantCounters(participant, timezone);
  await ChallengeParticipant.findByIdAndUpdate(participant._id, {
    $inc: { pointsEarned: dayPoints },
  });

  if (completedDays < challenge.durationDays) {
    return { newlyCompleted: true, challengeCompleted: false };
  }

  // The challenge is complete. Bonus points + duration badge, both
  // idempotent through their own unique indexes.
  const bonus = challengeCompletionPoints(challenge.durationDays);
  const bonusPoints = await awardPoints(
    String(participant.userId),
    bonus,
    'challenge_completed',
    'ChallengeParticipant',
    String(participant._id),
  );
  const badge: BadgeId | null =
    challenge.durationDays >= 365
      ? 'challenge-365'
      : challenge.durationDays >= 30
        ? 'challenge-30'
        : null;
  if (badge) await awardBadge(String(participant.userId), badge);
  await ChallengeParticipant.findOneAndUpdate(
    { _id: participant._id, status: 'active' },
    {
      status: 'completed',
      completedAt: new Date(),
      $inc: { pointsEarned: bonusPoints },
    },
  );
  return { newlyCompleted: true, challengeCompleted: true };
}

/**
 * Re-evaluate one date for every active auto-completed challenge the user
 * has. Called after real events (a prayer marked, a task completed, a
 * focus session finished) and when challenge details are read, so a day
 * flips to completed as soon as the underlying activity exists.
 */
export async function refreshChallengeProgress(
  userId: string,
  dateKey?: string,
): Promise<void> {
  try {
    const timezone = await userTimezone(userId);
    const target = dateKey ?? dateKeyInTimezone(timezone);
    const participants = (await ChallengeParticipant.find({
      userId,
      status: 'active',
    }).lean()) as unknown as ParticipantDoc[];
    for (const participant of participants) {
      const challenge = (await Challenge.findById(participant.challengeId).lean()) as unknown as ChallengeDoc | null;
      if (!challenge || !AUTO_CATEGORIES.includes(challenge.category)) continue;
      const result = await evaluateRequirement(userId, challenge.category, target, timezone);
      if (result.met) {
        await completeDay(participant, challenge, target, timezone, result.source, result.evidenceRefs);
      }
    }
  } catch {
    // Progress refresh must never break the request that triggered it.
  }
}

/**
 * Honest self-reported check-in for sleep, Quran and discipline days.
 * Rejects auto-completed categories, future dates, and dates outside the
 * challenge. Returns whether the day was newly completed.
 */
export async function checkInDay(
  userId: string,
  participantId: string,
  dateKey: string,
): Promise<{ newlyCompleted: boolean; challengeCompleted: boolean; todayKey: string }> {
  const participant = (await ChallengeParticipant.findOne({
    _id: participantId,
    userId,
    status: 'active',
  }).lean()) as unknown as ParticipantDoc | null;
  if (!participant) throw new Error('Active participation not found');
  const challenge = (await Challenge.findById(participant.challengeId).lean()) as unknown as ChallengeDoc | null;
  if (!challenge) throw new Error('Challenge not found');
  if (AUTO_CATEGORIES.includes(challenge.category)) {
    throw new Error('This challenge completes automatically from your activity');
  }
  const timezone = await userTimezone(userId);
  const today = dateKeyInTimezone(timezone);
  if (dateKey > today) throw new Error('Future dates cannot be checked in');
  const result = await completeDay(participant, challenge, dateKey, timezone, 'self-reported', []);
  return { ...result, todayKey: today };
}
