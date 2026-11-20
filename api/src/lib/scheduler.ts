/**
 * In-process notification scheduler — one tick per minute.
 *
 * Delivery is in-app + Socket.IO only (there is NO web push). The
 * scheduler creates a notification in MongoDB when a real time-based
 * event falls due, and createNotification pushes it live unless the
 * user is in quiet hours (stored, not pushed) or has the category
 * switched off (never created). Every event is created at most once
 * via createScheduledNotification, whose refIds name the exact event
 * and day — a tick that runs twice, or a server restart mid-day, can
 * never double-notify.
 *
 * Real data only, never invented:
 * - Prayer times come from Aladhan (same upstream and method/school
 *   mapping as GET /api/prayer/times), fetched at most once per user
 *   per day and cached in memory; a failed fetch skips that user
 *   this tick instead of guessing a time. Manual timeOverride and
 *   endTime from the user's profile win over calculated times, and
 *   the per-prayer reminder toggle is respected.
 * - Tasks, sleep times, challenge progress and onboarding state all
 *   come from the user's own MongoDB records.
 *
 * Efficiency: one tick per minute; each section queries only records
 * that could be due (indexed lookups, grouped per user). The tick
 * never throws and never blocks startup or requests.
 *
 * Policy choices (not data): deadline warning is 15 minutes before
 * the prayer's deadline; task "due soon" is 30 minutes before its
 * start time; challenge check-in reminder is 19:00 local, streak
 * at-risk is 21:00 local for streaks of 3+ days; the onboarding
 * nudge starts at 10:00 local, only 24h after signup.
 */

import { Challenge } from '../models/Challenge.js';
import { ChallengeParticipant } from '../models/ChallengeParticipant.js';
import { ChallengeProgress } from '../models/ChallengeProgress.js';
import { Profile } from '../models/Profile.js';
import { SalahDay } from '../models/SalahDay.js';
import { StudyTask } from '../models/StudyTask.js';
import { createScheduledNotification } from './notifications.js';
import {
  challengeCheckinReminder,
  challengeStreakAtRisk,
  onboardingIncomplete,
  plannerStart,
  prayerDeadlineWarning,
  prayerQazaReminder,
  prayerStart,
  sleepBedtime,
  sleepWakeup,
  taskDueSoon,
  taskOverdue,
  type PrayerName,
} from './notificationCopy.js';
import {
  addDays,
  dateKeyInTimezone,
  nowMinutesInTimezone,
  toMinutes,
} from './timezone.js';

export const PRAYERS: readonly PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const METHOD_MAP: Record<string, number> = {
  'University of Islamic Sciences, Karachi': 1,
  'Muslim World League': 3,
  'Egyptian General Authority': 5,
  'Umm al-Qura University, Makkah': 4,
  ISNA: 2,
};

/** A tick fires events whose minute falls in [t, t + EVENT_WINDOW). */
export const EVENT_WINDOW_MINUTES = 2;
/** Deadline warning goes out this many minutes before the deadline. */
export const DEADLINE_WARNING_MINUTES = 15;
/** Task "due soon" fires this many minutes before its start time. */
export const TASK_DUE_SOON_MINUTES = 30;
/** Challenge check-in reminder time (minutes since midnight, local). */
export const CHALLENGE_CHECKIN_MINUTES = 19 * 60;
/** Streak-at-risk reminder time (minutes since midnight, local). */
export const CHALLENGE_STREAK_RISK_MINUTES = 21 * 60;
/** Streak length that counts as "at risk" of breaking. */
export const CHALLENGE_STREAK_RISK_DAYS = 3;
/** Onboarding nudge starts at this local time, 24h after signup. */
export const ONBOARDING_NUDGE_MINUTES = 10 * 60;
/** Re-try a failed Aladhan fetch after this many milliseconds. */
const TIMINGS_RETRY_MS = 15 * 60 * 1000;

type PrayerSettings = Record<
  string,
  { timeOverride?: string; endTime?: string; reminder?: boolean } | undefined
>;

export type ProfileLike = {
  /** Present on real DB profiles; optional so pure tests can pass partial profiles. */
  userId?: unknown;
  city?: string;
  country?: string;
  timezone?: string;
  prayerCalculationMethod?: string;
  asrMethod?: string;
  prayerSettings?: PrayerSettings;
  studyStartTime?: string;
  sleepTime?: string;
  sleepStartTime?: string;
  sleepEndTime?: string;
  sleepReminder?: boolean;
  onboardingCompleted?: boolean;
  createdAt?: Date;
};

export type EffectivePrayer = {
  time: string;
  deadline: string;
  reminder: boolean;
};

/** "05:12" from Aladhan values like "05:12" or "05:12 (IST)". */
function stripToHHmm(value: unknown): string {
  if (typeof value !== 'string') return '';
  const first = value.trim().split(' ')[0] ?? '';
  return first.slice(0, 5);
}

/**
 * The effective time/deadline/reminder for each prayer: the user's own
 * timeOverride/endTime win; otherwise the Aladhan calculated time, with
 * the deadline being the next prayer's time (or 23:59 for Isha).
 */
export function effectivePrayerTimes(
  profile: ProfileLike,
  calculated: Record<PrayerName, string>,
): Record<PrayerName, EffectivePrayer> {
  // Pass 1: effective times (manual override wins over calculated).
  const times = {} as Record<PrayerName, string>;
  for (const prayer of PRAYERS) {
    const setting = profile.prayerSettings?.[prayer];
    const override = setting?.timeOverride?.trim();
    times[prayer] =
      override && toMinutes(override) !== null ? override : calculated[prayer];
  }
  // Pass 2: deadlines — the next prayer's effective time (or 23:59
  // for Isha), unless the user set an explicit endTime.
  const out = {} as Record<PrayerName, EffectivePrayer>;
  for (let i = 0; i < PRAYERS.length; i++) {
    const prayer = PRAYERS[i] as PrayerName;
    const setting = profile.prayerSettings?.[prayer];
    const endOverride = setting?.endTime?.trim();
    const nextName = PRAYERS[i + 1];
    const deadline =
      endOverride && toMinutes(endOverride) !== null
        ? endOverride
        : nextName
          ? times[nextName]
          : '23:59';
    out[prayer] = { time: times[prayer], deadline, reminder: setting?.reminder ?? true };
  }
  return out;
}

export type PrayerEvent = { kind: 'start' | 'deadline-warning'; prayer: PrayerName };

/** Which prayer events fall due at `nowMinutes` (2-minute window). */
export function prayerEventsDue(
  effective: Record<PrayerName, EffectivePrayer>,
  nowMinutes: number | null,
): PrayerEvent[] {
  if (nowMinutes === null) return [];
  const events: PrayerEvent[] = [];
  for (const prayer of PRAYERS) {
    const entry = effective[prayer];
    if (!entry?.reminder) continue;
    const startMin = toMinutes(entry.time);
    if (startMin !== null && nowMinutes >= startMin && nowMinutes < startMin + EVENT_WINDOW_MINUTES) {
      events.push({ kind: 'start', prayer });
    }
    const deadlineMin = toMinutes(entry.deadline);
    const warnMin = deadlineMin === null ? null : deadlineMin - DEADLINE_WARNING_MINUTES;
    if (
      warnMin !== null &&
      nowMinutes >= warnMin &&
      nowMinutes < warnMin + EVENT_WINDOW_MINUTES
    ) {
      events.push({ kind: 'deadline-warning', prayer });
    }
  }
  return events;
}

export type TaskLike = {
  _id: unknown;
  title: string;
  dueDate: string | null;
  startTime: string | null;
  status: string;
};

export type TaskEvent = { kind: 'due-soon' | 'overdue'; task: TaskLike };

/** Tasks due soon (30 min before start time) or overdue (past due date). */
export function taskEventsDue(
  tasks: TaskLike[],
  nowMinutes: number | null,
  todayKey: string,
): TaskEvent[] {
  if (nowMinutes === null) return [];
  const events: TaskEvent[] = [];
  for (const task of tasks) {
    if (task.status === 'Completed' || !task.dueDate) continue;
    if (task.dueDate === todayKey && task.startTime) {
      const startMin = toMinutes(task.startTime);
      const warnMin = startMin === null ? null : startMin - TASK_DUE_SOON_MINUTES;
      if (
        warnMin !== null &&
        nowMinutes >= warnMin &&
        nowMinutes < warnMin + EVENT_WINDOW_MINUTES
      ) {
        events.push({ kind: 'due-soon', task });
      }
    } else if (task.dueDate < todayKey) {
      events.push({ kind: 'overdue', task });
    }
  }
  return events;
}

export type SleepEvent = { kind: 'bedtime' | 'wakeup' };

/** Bedtime / wake-up events from the user's own sleep schedule. */
export function sleepEventsDue(profile: ProfileLike, nowMinutes: number | null): SleepEvent[] {
  if (nowMinutes === null || profile.sleepReminder === false) return [];
  const events: SleepEvent[] = [];
  const bedtime = profile.sleepStartTime?.trim() || profile.sleepTime?.trim() || '';
  const bedMin = toMinutes(bedtime);
  if (bedMin !== null && nowMinutes >= bedMin && nowMinutes < bedMin + EVENT_WINDOW_MINUTES) {
    events.push({ kind: 'bedtime' });
  }
  const wakeMin = toMinutes(profile.sleepEndTime?.trim() ?? '');
  if (wakeMin !== null && nowMinutes >= wakeMin && nowMinutes < wakeMin + EVENT_WINDOW_MINUTES) {
    events.push({ kind: 'wakeup' });
  }
  return events;
}

export type ChallengeParticipantLike = {
  _id: unknown;
  userId: unknown;
  challengeId: unknown;
  title: string;
  streak: number;
};

export type ChallengeEvent =
  | { kind: 'checkin-reminder'; participant: ChallengeParticipantLike }
  | { kind: 'streak-at-risk'; participant: ChallengeParticipantLike };

/**
 * Challenge reminders for active participations whose day is not yet
 * complete: a check-in reminder from 19:00, and a streak-at-risk
 * warning from 21:00 when the streak is 3+ days.
 */
export function challengeEventsDue(
  participants: ChallengeParticipantLike[],
  todayDone: ReadonlySet<string>,
  nowMinutes: number | null,
): ChallengeEvent[] {
  if (nowMinutes === null) return [];
  const events: ChallengeEvent[] = [];
  for (const participant of participants) {
    if (todayDone.has(String(participant._id))) continue;
    if (nowMinutes >= CHALLENGE_STREAK_RISK_MINUTES && participant.streak >= CHALLENGE_STREAK_RISK_DAYS) {
      events.push({ kind: 'streak-at-risk', participant });
    } else if (nowMinutes >= CHALLENGE_CHECKIN_MINUTES) {
      events.push({ kind: 'checkin-reminder', participant });
    }
  }
  return events;
}

/** Onboarding nudge: incomplete 24h after signup, from 10:00 local. */
export function onboardingDue(profile: ProfileLike, now: Date, nowMinutes: number | null): boolean {
  if (profile.onboardingCompleted || nowMinutes === null) return false;
  if (nowMinutes < ONBOARDING_NUDGE_MINUTES) return false;
  const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() >= 24 * 60 * 60 * 1000;
}

/* ------------------------------------------------------------------ */
/* Aladhan fetching (cached per user per day)                          */
/* ------------------------------------------------------------------ */

type CachedTimings = {
  dateKey: string;
  timings: Record<PrayerName, string> | null;
  failedAt: number | null;
};

const timingsCache = new Map<string, CachedTimings>();

export function resetSchedulerCache(): void {
  timingsCache.clear();
}

export type FetchTimings = (
  profile: ProfileLike,
) => Promise<Record<PrayerName, string> | null>;

/** Same upstream and method/school mapping as GET /api/prayer/times. */
export async function fetchAladhanTimings(
  profile: ProfileLike,
): Promise<Record<PrayerName, string> | null> {
  const city = profile.city?.trim();
  if (!city) return null;
  const country = profile.country?.trim() || 'India';
  const methodName =
    profile.prayerCalculationMethod?.trim() || 'University of Islamic Sciences, Karachi';
  const method = METHOD_MAP[methodName] ?? 1;
  const school = profile.asrMethod === 'hanafi' ? 1 : 0;
  const url =
    `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;
  let upstream: Response;
  try {
    upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
  if (!upstream.ok) return null;
  const payload = (await upstream.json().catch(() => null)) as {
    data?: { timings?: Record<string, unknown> };
  } | null;
  const timings = payload?.data?.timings;
  if (!timings) return null;
  const out = {
    Fajr: stripToHHmm(timings.Fajr),
    Dhuhr: stripToHHmm(timings.Dhuhr),
    Asr: stripToHHmm(timings.Asr),
    Maghrib: stripToHHmm(timings.Maghrib),
    Isha: stripToHHmm(timings.Isha),
  };
  if (PRAYERS.some((p) => !out[p])) return null;
  return out;
}

async function timingsForUser(
  profile: ProfileLike,
  dateKey: string,
  fetchTimings: FetchTimings,
): Promise<Record<PrayerName, string> | null> {
  const userId = String(profile.userId);
  const cached = timingsCache.get(userId);
  if (cached && cached.dateKey === dateKey) {
    if (cached.timings) return cached.timings;
    // A failed fetch retries after the backoff, not every tick.
    if (cached.failedAt !== null && Date.now() - cached.failedAt < TIMINGS_RETRY_MS) {
      return null;
    }
  }
  const timings = await fetchTimings(profile);
  timingsCache.set(userId, {
    dateKey,
    timings,
    failedAt: timings ? null : Date.now(),
  });
  return timings;
}

/* ------------------------------------------------------------------ */
/* One tick                                                            */
/* ------------------------------------------------------------------ */

export type SchedulerDeps = {
  fetchTimings?: FetchTimings;
};

async function tickPrayer(
  profiles: ProfileLike[],
  now: Date,
  fetchTimings: FetchTimings,
): Promise<void> {
  for (const profile of profiles) {
    try {
      const city = profile.city?.trim();
      if (!city) continue;
      const timezone = profile.timezone?.trim() || 'Asia/Kolkata';
      const todayKey = dateKeyInTimezone(timezone, now);
      const nowMinutes = nowMinutesInTimezone(timezone, now);
      if (nowMinutes === null) continue;
      const userId = String(profile.userId);

      const calculated = await timingsForUser(profile, todayKey, fetchTimings);
      if (!calculated) continue;
      const effective = effectivePrayerTimes(profile, calculated);
      for (const event of prayerEventsDue(effective, nowMinutes)) {
        const copy =
          event.kind === 'start'
            ? prayerStart(event.prayer)
            : prayerDeadlineWarning(event.prayer);
        await createScheduledNotification(userId, {
          type: 'prayer',
          ...copy,
          refType: 'Prayer',
          refId: `prayer:${event.prayer}:${event.kind}:${todayKey}`,
        });
      }

      // Qaza reminder, once a day from Fajr time: yesterday's prayers
      // that are still marked missed (not yet prayed or made Qaza).
      const fajrMin = toMinutes(effective.Fajr.time);
      if (fajrMin !== null && nowMinutes >= fajrMin) {
        const yesterdayKey = addDays(todayKey, -1);
        const yesterday = (await SalahDay.findOne({
          userId,
          date: yesterdayKey,
        }).lean()) as unknown as {
          prayers?: Record<string, { status?: string }>;
        } | null;
        const missed = PRAYERS.filter(
          (p) => yesterday?.prayers?.[p]?.status === 'missed',
        );
        if (missed.length > 0) {
          await createScheduledNotification(userId, {
            type: 'prayer',
            ...prayerQazaReminder(missed),
            refType: 'SalahDay',
            refId: `prayer:qaza:${yesterdayKey}`,
          });
        }
      }
    } catch {
      // One user's prayer section must never break the tick.
    }
  }
}

async function tickTasksAndSleep(
  profiles: ProfileLike[],
  now: Date,
): Promise<void> {
  const byUser = new Map<string, ProfileLike>();
  for (const profile of profiles) byUser.set(String(profile.userId), profile);

  const tasks = (await StudyTask.find({
    status: { $ne: 'Completed' },
    dueDate: { $ne: null },
  })
    .select('_id userId title dueDate startTime status')
    .lean()) as unknown as (TaskLike & { userId: unknown })[];

  const tasksByUser = new Map<string, TaskLike[]>();
  for (const task of tasks) {
    const list = tasksByUser.get(String(task.userId)) ?? [];
    list.push(task);
    tasksByUser.set(String(task.userId), list);
  }

  for (const [userId, userTasks] of tasksByUser) {
    try {
      const profile = byUser.get(userId);
      const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
      const todayKey = dateKeyInTimezone(timezone, now);
      const nowMinutes = nowMinutesInTimezone(timezone, now);
      if (nowMinutes === null) continue;

      for (const event of taskEventsDue(userTasks, nowMinutes, todayKey)) {
        const copy =
          event.kind === 'due-soon'
            ? taskDueSoon(event.task.title, event.task.startTime ?? '')
            : taskOverdue(event.task.title, event.task.dueDate ?? '');
        await createScheduledNotification(userId, {
          type: 'study',
          ...copy,
          refType: 'StudyTask',
          refId: `study:task:${event.kind}:${String(event.task._id)}:${todayKey}`,
        });
      }

      // Daily planner start: study time + pending tasks today.
      const startMin = toMinutes(profile?.studyStartTime?.trim() ?? '');
      const pendingToday = userTasks.some(
        (t) => t.dueDate === todayKey && t.status !== 'Completed',
      );
      if (
        startMin !== null &&
        pendingToday &&
        nowMinutes >= startMin &&
        nowMinutes < startMin + EVENT_WINDOW_MINUTES
      ) {
        await createScheduledNotification(userId, {
          type: 'study',
          ...plannerStart(),
          refType: 'Planner',
          refId: `study:planner:${todayKey}`,
        });
      }
    } catch {
      // One user's tasks must never break the tick.
    }
  }

  for (const profile of profiles) {
    try {
      const timezone = profile.timezone?.trim() || 'Asia/Kolkata';
      const todayKey = dateKeyInTimezone(timezone, now);
      const nowMinutes = nowMinutesInTimezone(timezone, now);
      const userId = String(profile.userId);
      for (const event of sleepEventsDue(profile, nowMinutes)) {
        await createScheduledNotification(userId, {
          type: 'sleep',
          ...(event.kind === 'bedtime' ? sleepBedtime() : sleepWakeup()),
          refType: 'Sleep',
          refId: `sleep:${event.kind}:${todayKey}`,
        });
      }
      if (onboardingDue(profile, now, nowMinutes)) {
        await createScheduledNotification(userId, {
          type: 'system',
          ...onboardingIncomplete(),
          refType: 'Profile',
          refId: `system:onboarding:${todayKey}`,
        });
      }
    } catch {
      // One user's sleep/onboarding section must never break the tick.
    }
  }
}

async function tickChallenges(now: Date): Promise<void> {
  const participants = (await ChallengeParticipant.find({ status: 'active' })
    .select('_id userId challengeId streak')
    .lean()) as unknown as {
    _id: unknown;
    userId: unknown;
    challengeId: unknown;
    streak: number;
  }[];
  if (participants.length === 0) return;

  const challengeIds = [...new Set(participants.map((p) => String(p.challengeId)))];
  const challenges = (await Challenge.find({ _id: { $in: challengeIds } })
    .select('_id title')
    .lean()) as unknown as { _id: unknown; title: string }[];
  const titles = new Map(challenges.map((c) => [String(c._id), c.title]));

  const profiles = (await Profile.find({
    userId: { $in: participants.map((p) => String(p.userId)) },
  })
    .select('userId timezone')
    .lean()) as unknown as { userId: unknown; timezone?: string }[];
  const timezones = new Map(profiles.map((p) => [String(p.userId), p.timezone?.trim() || 'Asia/Kolkata']));

  const todayKeys = [...new Set([...timezones.values()].map((tz) => dateKeyInTimezone(tz, now)))];
  const doneRows = (await ChallengeProgress.find({
    date: { $in: todayKeys },
    completed: true,
  })
    .select('participantId date')
    .lean()) as unknown as { participantId: unknown; date: string }[];
  const doneByParticipantDate = new Set(
    doneRows.map((r) => `${String(r.participantId)}:${r.date}`),
  );

  const byUser = new Map<string, typeof participants>();
  for (const p of participants) {
    const list = byUser.get(String(p.userId)) ?? [];
    list.push(p);
    byUser.set(String(p.userId), list);
  }

  for (const [userId, userParticipants] of byUser) {
    try {
      const timezone = timezones.get(userId) ?? 'Asia/Kolkata';
      const todayKey = dateKeyInTimezone(timezone, now);
      const nowMinutes = nowMinutesInTimezone(timezone, now);
      if (nowMinutes === null) continue;
      const enriched: ChallengeParticipantLike[] = userParticipants.map((p) => ({
        _id: p._id,
        userId: p.userId,
        challengeId: p.challengeId,
        title: titles.get(String(p.challengeId)) ?? 'Challenge',
        streak: p.streak ?? 0,
      }));
      const todayDone = new Set(
        enriched
          .filter((p) => doneByParticipantDate.has(`${String(p._id)}:${todayKey}`))
          .map((p) => String(p._id)),
      );
      for (const event of challengeEventsDue(enriched, todayDone, nowMinutes)) {
        const copy =
          event.kind === 'checkin-reminder'
            ? challengeCheckinReminder(event.participant.title)
            : challengeStreakAtRisk(event.participant.title, event.participant.streak);
        // Short refId segments: the full "checkin-reminder" / "streak-at-risk"
        // spellings exceed the Notification refId maxlength (60).
        const refKind = event.kind === 'checkin-reminder' ? 'checkin' : 'risk';
        await createScheduledNotification(userId, {
          type: 'challenge',
          ...copy,
          refType: 'ChallengeParticipant',
          refId: `challenge:${refKind}:${String(event.participant._id)}:${todayKey}`,
        });
      }
    } catch {
      // One user's challenges must never break the tick.
    }
  }
}

/**
 * Run one scheduler tick. Never throws. `now` and `deps.fetchTimings`
 * exist so tests can drive the tick deterministically without the
 * network or the wall clock.
 */
export async function runNotificationTick(
  now = new Date(),
  deps: SchedulerDeps = {},
): Promise<void> {
  const fetchTimings = deps.fetchTimings ?? fetchAladhanTimings;
  try {
    const profiles = (await Profile.find({})
      .select(
        'userId city country timezone prayerCalculationMethod asrMethod prayerSettings ' +
          'studyStartTime sleepTime sleepStartTime sleepEndTime sleepReminder ' +
          'onboardingCompleted createdAt',
      )
      .lean()) as unknown as ProfileLike[];
    await tickPrayer(profiles, now, fetchTimings);
    await tickTasksAndSleep(profiles, now);
    await tickChallenges(now);
  } catch {
    // A failed tick must never break the server.
  }
}

let timer: NodeJS.Timeout | null = null;
let tickRunning = false;

/**
 * Start the one-minute scheduler. Safe to call once at server startup;
 * a second call is a no-op. The timer is unref'd so it never holds the
 * process open on its own.
 */
export function startNotificationScheduler(): NodeJS.Timeout | null {
  if (timer) return timer;
  const run = async () => {
    if (tickRunning) return;
    tickRunning = true;
    try {
      await runNotificationTick();
    } finally {
      tickRunning = false;
    }
  };
  void run();
  timer = setInterval(() => void run(), 60 * 1000);
  timer.unref();
  return timer;
}
