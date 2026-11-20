import { Profile } from '../models/Profile.js';
import { SalahDay } from '../models/SalahDay.js';
import { createScheduledNotification } from './notifications.js';
import { prayerMissed } from './notificationCopy.js';
import {
  dateKeyInTimezone,
  nowMinutesInTimezone,
  toMinutes,
} from './timezone.js';

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof PRAYER_NAMES)[number];

/** Grace after a prayer's deadline before it counts as missed. */
export const MISSED_GRACE_MINUTES = 5;

type PrayerEntry = {
  status: 'pending' | 'prayed' | 'qaza' | 'missed';
  updatedAt: Date | null;
  wasMissed: boolean;
  missedAt: Date | null;
  autoMissed: boolean;
};

type SalahDayDoc = {
  _id: unknown;
  userId: unknown;
  date: string;
  prayers: Record<PrayerName, PrayerEntry>;
};

/**
 * Auto-missed logic.
 *
 * A prayer whose deadline + 5-minute grace has passed and whose status is
 * still 'pending' is marked 'missed' and PERSISTED — never assumed prayed.
 * History is preserved: the entry keeps wasMissed + missedAt, so if the
 * user later corrects it to Qaza (or prayed), the record still shows it
 * was missed first.
 *
 * Deadlines come from two sources, in order of completeness:
 *  - the full per-prayer deadlines (from the prayer-times calculation),
 *    used for TODAY when the prayer-times endpoint has just computed them;
 *  - the user's own per-prayer endTime overrides from their profile,
 *    used when Salah records are read without a fresh calculation.
 * For any PAST date every deadline has necessarily passed, so all still
 * pending prayers are missed. Records are only auto-marked when they
 * already exist — opening a calendar never backfills whole months of
 * missed prayers for days the user never opened. Today is the exception:
 * when a deadline passes, today's record is created so the miss is real.
 */
export async function userTimezoneAndProfile(userId: string): Promise<{
  timezone: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
}> {
  const profile = await Profile.findOne({ userId }).lean();
  return { timezone: profile?.timezone?.trim() || 'Asia/Kolkata', profile };
}

/** Deadlines the user set themselves in onboarding (per-prayer endTime). */
export function profileDeadlines(
  profile: {
    prayerSettings?: Record<string, { endTime?: string } | undefined>;
  } | null,
): Partial<Record<PrayerName, string>> {
  const out: Partial<Record<PrayerName, string>> = {};
  for (const prayer of PRAYER_NAMES) {
    const endTime = profile?.prayerSettings?.[prayer]?.endTime?.trim();
    if (endTime && toMinutes(endTime) !== null) out[prayer] = endTime;
  }
  return out;
}

/**
 * Pure deadline check (unit-tested): which prayers are past
 * deadline + grace? For a past date every prayer is past. For today,
 * a prayer is past when now (minutes since midnight, in the user's
 * timezone) is beyond deadline + MISSED_GRACE_MINUTES. Prayers
 * without a known deadline are never marked.
 */
export function prayersPastDeadline(
  deadlines: Partial<Record<PrayerName, string>>,
  nowMinutes: number | null,
  isPastDate: boolean,
): PrayerName[] {
  if (isPastDate) return [...PRAYER_NAMES];
  if (nowMinutes === null) return [];
  const past: PrayerName[] = [];
  for (const prayer of PRAYER_NAMES) {
    const deadline = deadlines[prayer];
    const deadlineMinutes = deadline ? toMinutes(deadline) : null;
    if (deadlineMinutes !== null && nowMinutes > deadlineMinutes + MISSED_GRACE_MINUTES) {
      past.push(prayer);
    }
  }
  return past;
}

function markMissed(
  prayers: Record<PrayerName, PrayerEntry>,
  prayer: PrayerName,
  auto: boolean,
  now: Date,
): boolean {
  const entry = prayers[prayer];
  if (!entry || entry.status !== 'pending') return false;
  prayers[prayer] = {
    status: 'missed',
    updatedAt: now,
    wasMissed: true,
    missedAt: entry.missedAt ?? now,
    autoMissed: auto,
  };
  return true;
}

/**
 * Recompute missed prayers for one day. `deadlines` is a map of prayer ->
 * "HH:mm" deadline for that day; when omitted, only the past-date rule
 * applies (plus profile endTimes for today, if `profile` is passed).
 * Returns the updated record, or null when nothing was marked.
 */
export async function recomputeDay(
  userId: string,
  dateKey: string,
  options: {
    timezone: string;
    deadlines?: Partial<Record<PrayerName, string>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    profile?: any;
  },
): Promise<SalahDayDoc | null> {
  const { timezone } = options;
  const today = dateKeyInTimezone(timezone);
  if (dateKey > today) return null;

  const now = new Date();
  const nowMinutes = nowMinutesInTimezone(timezone, now);
  const isPast = dateKey < today;

  // Which prayers are past deadline + grace?
  const effective: Partial<Record<PrayerName, string>> = {
    ...profileDeadlines(options.profile ?? null),
    ...(options.deadlines ?? {}),
  };
  const pastDeadline = prayersPastDeadline(effective, nowMinutes, isPast);
  if (pastDeadline.length === 0) return null;

  // Prayers newly flipped to missed in this call — each gets exactly
  // one Hinglish "missed" notification (deduped by refId, and only
  // when that prayer's own reminder toggle is on). Notifying here is
  // exact: the flip happens once, so the notification fires once.
  const newlyMissed: PrayerName[] = [];

  const existing = (await SalahDay.findOne({ userId, date: dateKey }).lean()) as unknown as SalahDayDoc | null;
  if (!existing) {
    // Only today gets a record created by auto-marking; past dates are
    // never backfilled for days the user never opened.
    if (!isPast) {
      const prayers = {} as Record<PrayerName, PrayerEntry>;
      for (const prayer of PRAYER_NAMES) {
        prayers[prayer] = pastDeadline.includes(prayer)
          ? { status: 'missed', updatedAt: now, wasMissed: true, missedAt: now, autoMissed: true }
          : { status: 'pending', updatedAt: null, wasMissed: false, missedAt: null, autoMissed: false };
      }
      const created = await SalahDay.create({ userId, date: dateKey, prayers });
      newlyMissed.push(...pastDeadline);
      await notifyNewlyMissed(userId, dateKey, newlyMissed, options.profile ?? null);
      return created.toObject() as unknown as SalahDayDoc;
    }
    return null;
  }

  const prayers = existing.prayers;
  let changed = false;
  for (const prayer of pastDeadline) {
    if (markMissed(prayers, prayer, true, now)) {
      changed = true;
      newlyMissed.push(prayer);
    }
  }
  if (!changed) return null;

  const update: Record<string, unknown> = {};
  for (const prayer of PRAYER_NAMES) {
    update[`prayers.${prayer}`] = prayers[prayer];
  }
  const updated = await SalahDay.findOneAndUpdate(
    { userId, date: dateKey },
    { $set: update },
    { new: true, runValidators: true },
  ).lean();
  await notifyNewlyMissed(userId, dateKey, newlyMissed, options.profile ?? null);
  return updated as unknown as SalahDayDoc | null;
}

/**
 * Notify for prayers that just flipped to missed. Best-effort and
 * silent on failure — auto-marking must never break the caller.
 * Respects the per-prayer reminder toggle from the user's profile.
 */
async function notifyNewlyMissed(
  userId: string,
  dateKey: string,
  newlyMissed: PrayerName[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any,
): Promise<void> {
  if (newlyMissed.length === 0) return;
  try {
    const resolved = profile ?? (await Profile.findOne({ userId }).lean());
    const settings = (resolved?.prayerSettings ?? {}) as Record<
      string,
      { reminder?: boolean } | undefined
    >;
    for (const prayer of newlyMissed) {
      if (settings[prayer]?.reminder === false) continue;
      await createScheduledNotification(userId, {
        type: 'prayer',
        ...prayerMissed(prayer),
        refType: 'SalahDay',
        refId: `prayer:${prayer}:missed:${dateKey}`,
      });
    }
  } catch {
    // Notifications must never break auto-marking.
  }
}

/** Auto-mark today from fully computed deadlines (called by /api/prayer/times). */
export async function markTodayMissed(
  userId: string,
  dateKey: string,
  timezone: string,
  deadlines: Partial<Record<PrayerName, string>>,
): Promise<void> {
  try {
    await recomputeDay(userId, dateKey, { timezone, deadlines });
  } catch {
    // Auto-marking must never break the prayer-times response.
  }
}
