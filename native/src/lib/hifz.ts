/**
 * Hifz (Quran memorisation) tracker — schedule + persistence.
 *
 * One memorised unit is a surah, or a portion of a surah (an ayah
 * range inside it). Everything is stored in AsyncStorage under one
 * key per user, following the tasbih convention (`<feature>:<uid>` —
 * see src/lib/tasbih.ts, user id when available, else 'anon'):
 *
 *   `hifz:items:<uid>`  →  JSON array of HifzItem
 *
 * Nothing is pre-filled: an empty store means nothing memorised,
 * and every summary number on the screen is computed from this
 * stored array only.
 *
 * Spaced-repetition schedule (days): 1 → 3 → 7 → 14 → 30, capped
 * at 30. When a unit is first marked memorised its next revision
 * is due in 1 day. After a revision the user says how it went:
 * - "Needed help" → back to daily (1 day).
 * - "Fine"        → next interval in the ladder.
 * - "Fluent"      → skip one interval forward (e.g. 3 → 14).
 *
 * Dates are local `YYYY-MM-DD` keys (device local time, same as
 * tasbih.ts's todayDateKey), so "due today" means due on the
 * device's calendar day, and `YYYY-MM-DD` strings compare
 * lexicographically — `nextDue <= today` is "due".
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayDateKey } from './tasbih';

export { todayDateKey };

/** The revision ladder, in days. Capped at the last step (30). */
export const HIFZ_INTERVALS = [1, 3, 7, 14, 30] as const;

export type HifzResult = 'help' | 'fine' | 'fluent';

export type HifzItem = {
  /** `${surahNumber}:${ayahStart}-${ayahEnd}` — unique per portion. */
  id: string;
  surahNumber: number;
  /** First ayah of the memorised portion (1-based, in-surah). */
  ayahStart: number;
  /** Last ayah of the memorised portion (inclusive, in-surah). */
  ayahEnd: number;
  /** Local date key (YYYY-MM-DD) it was first marked memorised. */
  memorisedAt: string;
  /** Current interval in days (always one of HIFZ_INTERVALS). */
  intervalDays: number;
  /** Local date key (YYYY-MM-DD) the next revision is due. */
  nextDue: string;
  /** How many times this unit has been revised (recorded only). */
  reviewCount: number;
  /** Local date key of the last revision, or null if never revised. */
  lastReviewedAt: string | null;
  /** How the last revision went, or null if never revised. */
  lastResult: HifzResult | null;
};

export function hifzStorageKey(uid: string): string {
  return `hifz:items:${uid}`;
}

export function hifzItemId(surahNumber: number, ayahStart: number, ayahEnd: number): string {
  return `${surahNumber}:${ayahStart}-${ayahEnd}`;
}

/** Local date key `days` after `dateKey` (YYYY-MM-DD, device local time). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return todayDateKey(date);
}

/**
 * Next interval after a revision. `help` resets to daily, `fine`
 * steps one rung up the ladder, `fluent` skips one rung. The
 * ladder caps at 30 days.
 */
export function nextIntervalDays(currentDays: number, result: HifzResult): number {
  if (result === 'help') return HIFZ_INTERVALS[0];
  const ladder = [...HIFZ_INTERVALS];
  let idx = ladder.indexOf(currentDays as (typeof HIFZ_INTERVALS)[number]);
  if (idx < 0) {
    // Tolerate a stored interval outside the ladder: find the first
    // rung above it, or stay at the cap.
    idx = ladder.findIndex((n) => n > currentDays);
    if (idx < 0) return HIFZ_INTERVALS[HIFZ_INTERVALS.length - 1];
    return result === 'fluent'
      ? ladder[Math.min(idx + 1, ladder.length - 1)]
      : ladder[idx];
  }
  const step = result === 'fluent' ? 2 : 1;
  return ladder[Math.min(idx + step, ladder.length - 1)];
}

/**
 * Pure: mark a surah (or a portion of it) memorised. Returns the
 * new list, or the same list unchanged when that exact portion is
 * already recorded (re-marking never resets its schedule). The
 * first revision is due in 1 day. Ayah bounds are clamped to
 * 1..ayahCount; an invalid range returns the list unchanged.
 */
export function markMemorised(
  items: HifzItem[],
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
  ayahCount: number,
  today: string = todayDateKey(),
): HifzItem[] {
  const start = Math.max(1, Math.floor(ayahStart));
  const end = Math.min(Math.max(1, Math.floor(ayahCount)), Math.floor(ayahEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return items;
  const id = hifzItemId(surahNumber, start, end);
  if (items.some((it) => it.id === id)) return items;
  const first: HifzItem = {
    id,
    surahNumber,
    ayahStart: start,
    ayahEnd: end,
    memorisedAt: today,
    intervalDays: HIFZ_INTERVALS[0],
    nextDue: addDays(today, HIFZ_INTERVALS[0]),
    reviewCount: 0,
    lastReviewedAt: null,
    lastResult: null,
  };
  return [...items, first];
}

/**
 * Pure: record a revision of one unit. Advances its interval per
 * the result, moves nextDue forward from today, and bumps the
 * recorded revision count. Unknown id → list unchanged.
 */
export function recordReview(
  items: HifzItem[],
  id: string,
  result: HifzResult,
  today: string = todayDateKey(),
): HifzItem[] {
  return items.map((it) => {
    if (it.id !== id) return it;
    const intervalDays = nextIntervalDays(it.intervalDays, result);
    return {
      ...it,
      intervalDays,
      nextDue: addDays(today, intervalDays),
      reviewCount: it.reviewCount + 1,
      lastReviewedAt: today,
      lastResult: result,
    };
  });
}

/** Pure: drop one memorised unit (unmark). Unknown id → unchanged. */
export function removeItem(items: HifzItem[], id: string): HifzItem[] {
  return items.filter((it) => it.id !== id);
}

/** Units whose next revision is due today or overdue. */
export function dueToday(items: HifzItem[], today: string = todayDateKey()): HifzItem[] {
  return items
    .filter((it) => it.nextDue <= today)
    .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : a.surahNumber - b.surahNumber));
}

/** All recorded units for one surah (whole surah and/or portions). */
export function itemsForSurah(items: HifzItem[], surahNumber: number): HifzItem[] {
  return items
    .filter((it) => it.surahNumber === surahNumber)
    .sort((a, b) => a.ayahStart - b.ayahStart);
}

/** Whole-surah coverage: true when a recorded unit spans 1..ayahCount. */
export function isWholeSurahMemorised(
  items: HifzItem[],
  surahNumber: number,
  ayahCount: number,
): boolean {
  return items.some(
    (it) => it.surahNumber === surahNumber && it.ayahStart === 1 && it.ayahEnd === ayahCount,
  );
}

export type HifzSummary = {
  /** Distinct surahs with at least one recorded unit. */
  surahsMemorised: number;
  /** Recorded units (whole surahs + portions). */
  unitsMemorised: number;
  /** Units due for revision today (including overdue). */
  dueTodayCount: number;
  /** Total revisions actually recorded across all units. */
  totalReviews: number;
};

/** Real summary — computed from the stored array only, never invented. */
export function summarise(items: HifzItem[], today: string = todayDateKey()): HifzSummary {
  return {
    surahsMemorised: new Set(items.map((it) => it.surahNumber)).size,
    unitsMemorised: items.length,
    dueTodayCount: dueToday(items, today).length,
    totalReviews: items.reduce((sum, it) => sum + it.reviewCount, 0),
  };
}

/* ------------------------------------------------------------------ */
/* AsyncStorage persistence                                           */
/* ------------------------------------------------------------------ */

/**
 * All hifz writes go through one promise chain (same pattern as
 * tasbih.ts), so rapid taps can never store revisions out of order.
 */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

function isValidItem(v: unknown): v is HifzItem {
  if (typeof v !== 'object' || v === null) return false;
  const it = v as Record<string, unknown>;
  return (
    typeof it.id === 'string' &&
    typeof it.surahNumber === 'number' &&
    Number.isInteger(it.surahNumber) &&
    it.surahNumber >= 1 &&
    it.surahNumber <= 114 &&
    typeof it.ayahStart === 'number' &&
    Number.isInteger(it.ayahStart) &&
    it.ayahStart >= 1 &&
    typeof it.ayahEnd === 'number' &&
    Number.isInteger(it.ayahEnd) &&
    it.ayahEnd >= it.ayahStart &&
    typeof it.memorisedAt === 'string' &&
    typeof it.intervalDays === 'number' &&
    (HIFZ_INTERVALS as readonly number[]).includes(it.intervalDays) &&
    typeof it.nextDue === 'string' &&
    typeof it.reviewCount === 'number' &&
    Number.isInteger(it.reviewCount) &&
    it.reviewCount >= 0 &&
    (it.lastReviewedAt === null || typeof it.lastReviewedAt === 'string') &&
    (it.lastResult === null ||
      it.lastResult === 'help' ||
      it.lastResult === 'fine' ||
      it.lastResult === 'fluent')
  );
}

function parseItems(raw: string | null): HifzItem[] {
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

/** Load the user's recorded units ([] when nothing stored yet). */
export async function loadHifz(uid: string): Promise<HifzItem[]> {
  try {
    return parseItems(await AsyncStorage.getItem(hifzStorageKey(uid)));
  } catch {
    return [];
  }
}

/** Save the whole recorded list for this user. */
export function saveHifz(uid: string, items: HifzItem[]): Promise<void> {
  return enqueueWrite(() =>
    AsyncStorage.setItem(hifzStorageKey(uid), JSON.stringify(items)),
  );
}
