import { PointTransaction, type PointReason } from '../models/PointTransaction.js';
import { UserBadge } from '../models/UserBadge.js';
import { UserPoints } from '../models/UserPoints.js';

/**
 * Points, rewards and badges — SERVER-SIDE ONLY.
 *
 * There is deliberately NO endpoint that lets a client add points. Points
 * are only awarded here, inside server code, when a real event happens.
 * Every award is idempotent: PointTransaction has a unique index on
 * (userId, refType, refId, reason), so a retry, refresh, or double
 * request can never award the same points twice.
 */

export const POINT_VALUES: Record<PointReason, number> = {
  focus_session_completed: 10,
  task_completed: 5,
  challenge_day_completed: 10,
  challenge_completed: 0, // completion bonus depends on duration; see below.
};

/** Completion bonus for finishing a whole challenge. */
export function challengeCompletionPoints(durationDays: number): number {
  if (durationDays >= 365) return 365;
  if (durationDays >= 30) return 100;
  return 50;
}

export type BadgeId = 'first-focus' | 'study-streak-7' | 'challenge-30' | 'challenge-365';

export const BADGE_DEFINITIONS: Record<
  BadgeId,
  { title: string; description: string }
> = {
  'first-focus': {
    title: 'First Focus',
    description: 'Finished your first focus session.',
  },
  'study-streak-7': {
    title: '7-Day Study Streak',
    description: 'Studied on 7 days in a row.',
  },
  'challenge-30': {
    title: '30-Day Challenger',
    description: 'Completed a 30-day challenge.',
  },
  'challenge-365': {
    title: '365-Day Challenger',
    description: 'Completed a 365-day challenge.',
  },
};

/**
 * Award points for a real event. Returns the amount actually awarded
 * (0 when this exact event was already rewarded).
 */
export async function awardPoints(
  userId: string,
  amount: number,
  reason: PointReason,
  refType: string,
  refId: string,
): Promise<number> {
  if (amount <= 0) return 0;
  try {
    await PointTransaction.create({
      userId,
      amount,
      reason,
      refType,
      refId,
    });
  } catch (error) {
    // Duplicate key on the unique index: this event was already rewarded.
    if (
      error instanceof Error &&
      (error as { code?: number }).code === 11000
    ) {
      return 0;
    }
    throw error;
  }
  await UserPoints.findOneAndUpdate(
    { userId },
    { $inc: { total: amount } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return amount;
}

/** Award a badge. Returns true when it was newly awarded. */
export async function awardBadge(userId: string, badgeId: BadgeId): Promise<boolean> {
  try {
    await UserBadge.create({ userId, badgeId });
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      (error as { code?: number }).code === 11000
    ) {
      return false;
    }
    throw error;
  }
}

export async function getUserPointsTotal(userId: string): Promise<number> {
  const record = await UserPoints.findOne({ userId }).select('total').lean();
  return record?.total ?? 0;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error && (error as { code?: number }).code === 11000
  );
}
