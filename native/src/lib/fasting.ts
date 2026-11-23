/**
 * Fasting log — Ramadan + voluntary Sunnah fasts.
 *
 * HOW THE DATES ARE COMPUTED (nothing is invented or hardcoded):
 * Every fast date comes from the REAL Hijri calendar the app already
 * uses — the live AHDORA API (Aladhan, Umm al-Qura calendar), the
 * same source as the Islamic Calendar screen:
 * - fetchHijriToday() gives today (Gregorian + Hijri).
 * - fetchHijriMonth(year, month) gives every day of a Gregorian
 *   month with its real Hijri date. We fetch the current month + the
 *   next two (≈ 90 days) and classify each day from its Hijri date:
 *   Ramadan = Hijri month 9; Arafah = 9 Dhul-Hijjah; Ashura =
 *   10 Muharram; Ayyam al-Bidh = Hijri days 13/14/15; Mondays and
 *   Thursdays = the Gregorian weekday of that real date.
 * - fetchHijriEvents() (same Aladhan source) is merged in as a
 *   safety net for the big days that fall beyond the 3-month
 *   window — Ramadan day 1, Arafah, Ashura — so the day-before
 *   reminder still knows about them. If a merged event date is
 *   already in the month data it is not duplicated.
 *
 * HONEST EXCLUSIONS (fasting is not permitted on these days, so
 * they are never listed as fast days):
 * - 1 Shawwal (Eid-ul-Fitr) and 10–13 Dhul-Hijjah (Eid-ul-Adha +
 *   the days of Tashreeq). A Monday/Thursday that falls on one of
 *   them is skipped, not listed.
 * - The Six of Shawwal are therefore 2–7 Shawwal (the six fastable
 *   days after Eid), NOT 1–6 Shawwal — 1 Shawwal is Eid.
 *
 * When two kinds fall on one day the more specific one wins:
 * Ramadan > Arafah > Ashura > Shawwal > Ayyam al-Bidh > Mon/Thu
 * (e.g. a Thursday that is also 13th of the month shows as
 * Ayyam al-Bidh).
 *
 * LOG: one AsyncStorage record per user, `fasting:log:<uid>`, a map
 * from Gregorian date (YYYY-MM-DD) to { status, note, kind }.
 * The summary is computed from stored entries only — 0 when
 * nothing has been logged. Same per-user key pattern as tasbih.ts
 * (user id when available, else 'anon').
 *
 * REMINDERS: same expo-notifications pattern as
 * prayerNotifications.ts — one Android channel ('ahdora-fasting'),
 * stored notification ids so they can be cancelled when the toggle
 * goes off, DATE triggers at 19:00 local time on the EVENING BEFORE
 * each upcoming fast (and before Ramadan day 1). Best-effort like
 * the prayer alerts: the app must be opened at least once for the
 * schedule to be (re)built, and exact-time delivery is not claimed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  fetchHijriEvents,
  fetchHijriMonth,
  fetchHijriToday,
  type HijriDay,
} from './apiWorship';
import type { AppLanguage } from './strings';

export type FastKind =
  | 'ramadan'
  | 'monday'
  | 'thursday'
  | 'ayyam'
  | 'arafah'
  | 'ashura'
  | 'shawwal';

export type UpcomingFast = {
  /** Gregorian date, local `YYYY-MM-DD`. */
  gregorianDate: string;
  hijriDay: number;
  hijriMonth: number;
  /** Hijri month name exactly as the API returned it. */
  hijriMonthName: string;
  hijriYear: number;
  kind: FastKind;
  /** 0 = Sunday … 6 = Saturday (Gregorian weekday of the date). */
  weekday: number;
  /** Days from today: 0 = today, negative = past, positive = future. */
  daysUntil: number;
};

export type FastStatus = 'kept' | 'missed';

export type FastEntry = {
  status: FastStatus;
  note: string;
  kind: FastKind;
  /** ISO timestamp of the last change (for history ordering/debug). */
  updatedAt: string;
};

/** The whole log: Gregorian date → entry. */
export type FastingLog = Record<string, FastEntry>;

export type FastingSummary = {
  /** Entries ever logged (kept + missed). */
  totalLogged: number;
  kept: number;
  missed: number;
  /** Kept fasts in the current Gregorian month (YYYY-MM of today). */
  keptThisMonth: number;
};

/** Gregorian months fetched ahead (current + next two ≈ 90 days). */
const MONTHS_AHEAD = 3;
/** Past fast days kept loggable (last 7 days + today). */
const PAST_DAYS = 7;
/** Evening-before reminder time (local). */
const REMINDER_HOUR = 19;
/** Cap so the OS schedule stays small. */
const MAX_REMINDERS = 30;

const CHANNEL_ID = 'ahdora-fasting';
const IDS_KEY = '@ahdora/notif/fastingIds';
const ENABLED_KEY = '@ahdora/notif/fastingEnabled';
/** Mihrab primary green from the app theme (C.teal700) — on-brand, no new colour. */
const TEAL = '#1F5E49';

/* ------------------------------------------------------------------ */
/* Date helpers (local calendar, no timezone tricks)                  */
/* ------------------------------------------------------------------ */

/** Local date key `YYYY-MM-DD` (device local time). */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM-DD` → local Date at noon (noon avoids DST edge shifts). */
export function parseGregorianDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole days from `fromIso` to `toIso` (negative when `to` is past). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseGregorianDate(fromIso);
  const to = parseGregorianDate(toIso);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

/** Gregorian year/month shifted by `delta` months. */
export function shiftGregorianMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** ISO date `days` after `iso` (days may be negative). */
function addDaysIso(iso: string, days: number): string {
  const date = parseGregorianDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

/* ------------------------------------------------------------------ */
/* Classification — pure, so it can be checked against real dates    */
/* ------------------------------------------------------------------ */

/**
 * Which fast (if any) a day is, from its real Hijri date + Gregorian
 * weekday. Returns null for ordinary days AND for the days fasting
 * is not permitted (Eid-ul-Fitr, Eid-ul-Adha + Tashreeq).
 */
export function classifyFastDay(
  hijriMonth: number,
  hijriDay: number,
  weekday: number,
): FastKind | null {
  // 1 Shawwal is Eid-ul-Fitr — no fast.
  if (hijriMonth === 10 && hijriDay === 1) return null;
  // 10–13 Dhul-Hijjah is Eid-ul-Adha + the days of Tashreeq — no fast.
  if (hijriMonth === 12 && hijriDay >= 10 && hijriDay <= 13) return null;
  if (hijriMonth === 9) return 'ramadan';
  if (hijriMonth === 12 && hijriDay === 9) return 'arafah';
  if (hijriMonth === 1 && hijriDay === 10) return 'ashura';
  // Six of Shawwal: the six fastable days after Eid (2–7 Shawwal).
  if (hijriMonth === 10 && hijriDay >= 2 && hijriDay <= 7) return 'shawwal';
  if (hijriDay === 13 || hijriDay === 14 || hijriDay === 15) return 'ayyam';
  if (weekday === 1) return 'monday';
  if (weekday === 4) return 'thursday';
  return null;
}

/** Hijri month number from an API month name (diacritics ignored). */
export function hijriMonthNumberFromName(name: string): number | null {
  const norm = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const map: Record<string, number> = {
    muharram: 1,
    safar: 2,
    'rabi al-awwal': 3,
    'rabi al-thani': 4,
    'jumada al-ula': 5,
    'jumada al-akhirah': 6,
    rajab: 7,
    shaban: 8,
    ramadan: 9,
    shawwal: 10,
    'dhu al-qadah': 11,
    'dhu al-hijjah': 12,
  };
  return map[norm] ?? null;
}

/**
 * Build the fast list from real Hijri month days: every classified
 * fast day from `PAST_DAYS` days ago up to the end of the data,
 * sorted by Gregorian date. Past days are included (negative
 * daysUntil) so a fast from the last few days can still be logged.
 */
export function buildUpcomingFasts(days: HijriDay[], todayIso: string): UpcomingFast[] {
  const cutoff = addDaysIso(todayIso, -PAST_DAYS);
  const out: UpcomingFast[] = [];
  const sorted = [...days].sort((a, b) =>
    a.gregorian.date < b.gregorian.date ? -1 : a.gregorian.date > b.gregorian.date ? 1 : 0,
  );
  for (const d of sorted) {
    const iso = d.gregorian.date;
    if (iso < cutoff) continue;
    const hijriDay = Number(d.hijri.day);
    const hijriMonth = d.hijri.month.number;
    const hijriYear = Number(d.hijri.year);
    if (!Number.isFinite(hijriDay) || !Number.isFinite(hijriMonth) || !Number.isFinite(hijriYear)) {
      continue;
    }
    const date = parseGregorianDate(iso);
    if (!date) continue;
    const kind = classifyFastDay(hijriMonth, hijriDay, date.getDay());
    if (!kind) continue;
    out.push({
      gregorianDate: iso,
      hijriDay,
      hijriMonth,
      hijriMonthName: d.hijri.month.en,
      hijriYear,
      kind,
      weekday: date.getDay(),
      daysUntil: daysBetween(todayIso, iso),
    });
  }
  return out;
}

/**
 * The fast list: last 7 days (loggable) + the next ~90 days, from
 * the live Hijri calendar, with the big days from /api/hijri/events
 * merged in when they fall beyond the fetched months. Throws when
 * today's Hijri date or every month fetch fails — the screen shows
 * the error honestly instead of inventing dates.
 */
export async function fetchUpcomingFasts(): Promise<UpcomingFast[]> {
  const today = await fetchHijriToday();
  const todayIso = /^\d{4}-\d{2}-\d{2}$/.test(today.gregorian.date)
    ? today.gregorian.date
    : localDateKey();
  const now = parseGregorianDate(todayIso) ?? new Date();

  const allDays: HijriDay[] = [];
  let monthsOk = 0;
  for (let i = 0; i < MONTHS_AHEAD; i += 1) {
    const { year, month } = shiftGregorianMonth(now.getFullYear(), now.getMonth() + 1, i);
    try {
      const data = await fetchHijriMonth(year, month);
      allDays.push(...data.days);
      monthsOk += 1;
    } catch {
      // One month failing must not hide the others; if every month
      // fails the list below stays empty and we throw honestly.
    }
  }
  if (monthsOk === 0) {
    throw new Error('Hijri calendar load nahi ho paya. Internet check karke dobara try karo.');
  }

  const fasts = buildUpcomingFasts(allDays, todayIso);
  const seen = new Set(fasts.map((f) => f.gregorianDate));

  // Big days beyond the 3-month window (same Aladhan source).
  try {
    const events = await fetchHijriEvents();
    const wanted: Record<string, FastKind> = {
      ramadan: 'ramadan',
      arafah: 'arafah',
      ashura: 'ashura',
    };
    for (const event of events.events) {
      const kind = wanted[event.key];
      if (!kind) continue;
      if (event.gregorianDate < todayIso || seen.has(event.gregorianDate)) continue;
      const hijriMonth = hijriMonthNumberFromName(event.hijriMonth);
      const hijriDay = Number(event.hijriDay);
      const hijriYear = Number(event.hijriYear);
      const date = parseGregorianDate(event.gregorianDate);
      if (!hijriMonth || !Number.isFinite(hijriDay) || !Number.isFinite(hijriYear) || !date) {
        continue;
      }
      fasts.push({
        gregorianDate: event.gregorianDate,
        hijriDay,
        hijriMonth,
        hijriMonthName: event.hijriMonth,
        hijriYear,
        kind,
        weekday: date.getDay(),
        daysUntil: daysBetween(todayIso, event.gregorianDate),
      });
      seen.add(event.gregorianDate);
    }
  } catch {
    // Events failing only hides the beyond-window big days; the
    // month data above is the real list and still stands.
  }

  fasts.sort((a, b) =>
    a.gregorianDate < b.gregorianDate ? -1 : a.gregorianDate > b.gregorianDate ? 1 : 0,
  );
  return fasts;
}

/* ------------------------------------------------------------------ */
/* Log — AsyncStorage, per user (same key pattern as tasbih.ts)       */
/* ------------------------------------------------------------------ */

function logKey(uid: string): string {
  return `fasting:log:${uid}`;
}

/** All log writes go through one promise chain (same as tasbih.ts). */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

const VALID_KINDS: FastKind[] = [
  'ramadan',
  'monday',
  'thursday',
  'ayyam',
  'arafah',
  'ashura',
  'shawwal',
];

function parseLog(raw: string | null): FastingLog {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: FastingLog = {};
    for (const [date, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<FastEntry>;
      if (entry.status !== 'kept' && entry.status !== 'missed') continue;
      if (!entry.kind || !VALID_KINDS.includes(entry.kind)) continue;
      out[date] = {
        status: entry.status,
        note: typeof entry.note === 'string' ? entry.note.slice(0, 200) : '',
        kind: entry.kind,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** The user's whole fasting log (empty when nothing was ever logged). */
export async function loadFastingLog(uid: string): Promise<FastingLog> {
  try {
    return parseLog(await AsyncStorage.getItem(logKey(uid)));
  } catch {
    return {};
  }
}

/** Mark one fast date kept/missed (keeps any note already saved). */
export function saveFastEntry(
  uid: string,
  date: string,
  status: FastStatus,
  kind: FastKind,
  note = '',
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.resolve();
  return enqueueWrite(async () => {
    const key = logKey(uid);
    const log = parseLog(await AsyncStorage.getItem(key));
    const prev = log[date];
    log[date] = {
      status,
      note: note || prev?.note || '',
      kind,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(log));
  });
}

/**
 * Save/change the note on an already-logged date. Returns false
 * (and stores nothing) when the date has no entry yet — a note
 * without a kept/missed mark is not a log entry.
 */
export function saveFastNote(uid: string, date: string, note: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.resolve(false);
  let saved = false;
  return enqueueWrite(async () => {
    const key = logKey(uid);
    const log = parseLog(await AsyncStorage.getItem(key));
    const prev = log[date];
    if (!prev) return;
    log[date] = { ...prev, note: note.slice(0, 200), updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(log));
    saved = true;
  }).then(() => saved);
}

/** Remove one date from the log entirely. */
export function clearFastEntry(uid: string, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Promise.resolve();
  return enqueueWrite(async () => {
    const key = logKey(uid);
    const log = parseLog(await AsyncStorage.getItem(key));
    delete log[date];
    await AsyncStorage.setItem(key, JSON.stringify(log));
  });
}

/**
 * Summary computed from stored entries only — 0s when nothing has
 * been logged. `todayIso` decides "this month" (YYYY-MM).
 */
export function summarizeFastingLog(log: FastingLog, todayIso: string): FastingSummary {
  const monthPrefix = todayIso.slice(0, 7);
  let kept = 0;
  let missed = 0;
  let keptThisMonth = 0;
  for (const [date, entry] of Object.entries(log)) {
    if (entry.status === 'kept') {
      kept += 1;
      if (date.startsWith(monthPrefix)) keptThisMonth += 1;
    } else {
      missed += 1;
    }
  }
  return { totalLogged: kept + missed, kept, missed, keptThisMonth };
}

/* ------------------------------------------------------------------ */
/* Reminders — expo-notifications, same pattern as prayerNotifications */
/* ------------------------------------------------------------------ */

export type FastingReminderStatus = 'ok' | 'disabled' | 'no-permission' | 'no-dates';

export type FastingReminderResult = {
  scheduled: number;
  status: FastingReminderStatus;
};

const KIND_LABEL: Record<AppLanguage, Record<FastKind, string>> = {
  en: {
    ramadan: 'Ramadan fast',
    monday: 'Monday fast',
    thursday: 'Thursday fast',
    ayyam: 'Ayyam al-Bidh fast',
    arafah: 'Fast of Arafah',
    ashura: 'Fast of Ashura',
    shawwal: 'Six of Shawwal fast',
  },
  hi: {
    ramadan: 'Ramzan ka roza',
    monday: 'Peer ka roza',
    thursday: 'Jumerat ka roza',
    ayyam: 'Ayyam al-Bidh ka roza',
    arafah: 'Arafah ka roza',
    ashura: 'Ashura ka roza',
    shawwal: 'Shawwal ke 6 roze',
  },
};

let handlerSet = false;

/** Foreground handler — same as prayerNotifications.ts, registers once. */
function ensureHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Create the Android channel (no-op on other platforms / on failure). */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Roza reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: TEAL,
    });
  } catch {
    // Scheduling falls back to the system default channel.
  }
}

async function readStoredIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

async function storeIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {
    // Best effort only; the next cancel simply cannot find a stale id.
  }
}

/** Current system permission status. Never throws. */
export async function getFastingReminderPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  ensureHandler();
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' || status === 'denied' ? status : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Ask the OS for notification permission. Creates the Android channel
 * first (SDK 58 docs: the Android 13 prompt does not appear until a
 * channel exists). Returns true only when permission is granted.
 * Never throws.
 */
export async function requestFastingReminderPermission(): Promise<boolean> {
  ensureHandler();
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Whether the user switched fasting reminders on (local flag). */
export async function isFastingRemindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Persist the user's fasting-reminder choice (local flag). */
export async function setFastingRemindersEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // In-memory only for this session if storage fails.
  }
}

/** Cancel every AHDORA fasting reminder scheduled earlier. Never throws. */
export async function cancelFastingReminders(): Promise<void> {
  ensureHandler();
  const ids = await readStoredIds();
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
  await storeIds([]);
}

/**
 * Schedule the evening-before reminder for each upcoming fast in
 * `fasts` (future dates only — a fast today has no evening before
 * it left). One DATE trigger per fast, 19:00 local the day before.
 * Cancels previously scheduled fasting reminders first, so a
 * re-schedule can never double-fire. Returns how many were
 * scheduled. Never throws.
 */
export async function scheduleFastingReminders(
  fasts: UpcomingFast[],
  lang: AppLanguage,
): Promise<FastingReminderResult> {
  ensureHandler();
  try {
    if ((await getFastingReminderPermissionStatus()) !== 'granted') {
      return { scheduled: 0, status: 'no-permission' };
    }
    await cancelFastingReminders();
    const ids: string[] = [];
    const now = new Date();
    const labels = KIND_LABEL[lang];
    for (const fast of fasts) {
      if (fast.daysUntil < 1) continue;
      if (ids.length >= MAX_REMINDERS) break;
      const fastDate = parseGregorianDate(fast.gregorianDate);
      if (!fastDate) continue;
      const remindAt = new Date(fastDate);
      remindAt.setDate(remindAt.getDate() - 1);
      remindAt.setHours(REMINDER_HOUR, 0, 0, 0);
      if (remindAt.getTime() <= now.getTime()) continue;
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: lang === 'hi' ? 'Kal roza hai' : 'Fast tomorrow',
            body:
              lang === 'hi'
                ? `Kal ${labels[fast.kind]} hai — ${fast.hijriDay} ${fast.hijriMonthName} ${fast.hijriYear}. Sehri ka waqt dekh lena.`
                : `Tomorrow is ${labels[fast.kind]} — ${fast.hijriDay} ${fast.hijriMonthName} ${fast.hijriYear}. Check the sehri time.`,
            data: { type: 'fasting', date: fast.gregorianDate, kind: fast.kind },
            sound: 'default',
            color: TEAL,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: remindAt,
            channelId: CHANNEL_ID,
          },
        });
        ids.push(id);
      } catch {
        // One fast failing must not block the others.
      }
    }
    await storeIds(ids);
    return { scheduled: ids.length, status: 'ok' };
  } catch {
    return { scheduled: 0, status: 'no-dates' };
  }
}

/**
 * One-call refresh: if reminders are enabled and permission is
 * granted, fetch the real upcoming fasts and (re)schedule their
 * evening-before reminders. Never throws.
 */
export async function refreshFastingReminders(
  lang: AppLanguage,
): Promise<FastingReminderResult> {
  try {
    if (!(await isFastingRemindersEnabled())) {
      return { scheduled: 0, status: 'disabled' };
    }
    if ((await getFastingReminderPermissionStatus()) !== 'granted') {
      return { scheduled: 0, status: 'no-permission' };
    }
    let fasts: UpcomingFast[];
    try {
      fasts = await fetchUpcomingFasts();
    } catch {
      return { scheduled: 0, status: 'no-dates' };
    }
    return scheduleFastingReminders(fasts, lang);
  } catch {
    return { scheduled: 0, status: 'no-dates' };
  }
}
