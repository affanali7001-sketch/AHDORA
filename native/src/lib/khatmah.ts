/**
 * Khatmah (Quran completion) plans — plan maths + persistence.
 *
 * A khatmah is reading all 604 mushaf pages. A plan is a number of
 * days and a starting page; the daily portion is recomputed every
 * day from what is REALLY left, so the plan always finishes on time
 * even after a missed day:
 *
 *   pagesPerDay = ceil(remainingPages / remainingDays)
 *
 * where remainingDays counts today and every day left until the
 * plan's end date. Portions are contiguous from the start page:
 * the next unread page is always `startPage + pagesActuallyRead`,
 * and pagesActuallyRead is the sum of the portions the user really
 * marked done — nothing is ever counted before it is marked.
 *
 * One plan per user is stored in AsyncStorage under
 * `khatmah:plan:<uid>` (same `<uid>` convention as tasbih.ts:
 * the logged-in user's id, else 'anon'). The Continue button's
 * target page is stored separately under `khatmah:target:<uid>`
 * so the coordinator can wire it to the Quran Book screen.
 *
 * No Quran text is stored or invented here — only page numbers.
 * The Quran Book itself stores no "current page" in AsyncStorage
 * (its page lives only in screen state; the server history is
 * ayah-based, not page-based), so there is no stored page to
 * pre-fill from — a new plan starts at page 1 unless the user
 * types a different starting page.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** The mushaf has 604 pages (AlQuran Cloud /v1/page/{n}, 1–604). */
export const TOTAL_PAGES = 604;

/** A plan may run from 1 day up to a full year. */
export const MIN_PLAN_DAYS = 1;
export const MAX_PLAN_DAYS = 365;

/** One day's portion the user marked as read (real data only). */
export type KhatmahDayDone = {
  /** Local date key `YYYY-MM-DD` the portion was marked done. */
  date: string;
  fromPage: number;
  toPage: number;
};

export type KhatmahPlan = {
  /** Length of the plan in days, as the user chose it. */
  totalDays: number;
  /** First page of the plan (1–604). */
  startPage: number;
  /** Local date key `YYYY-MM-DD` the plan started. */
  startDate: string;
  /** ISO timestamp the plan was created. */
  createdAt: string;
  /** Portions actually marked done, in the order they were marked. */
  done: KhatmahDayDone[];
};

/** Everything the screen needs to render today's portion. */
export type KhatmahToday = {
  /** 1-based day of the plan (capped at totalDays once overdue). */
  dayNumber: number;
  /** Days left including today (0 once the end date has passed). */
  daysLeft: number;
  /** First page of today's portion. */
  fromPage: number;
  /** Last page of today's portion. */
  toPage: number;
  /** Pages in today's portion. */
  pagesToday: number;
  /** Pages actually marked done so far (real data only). */
  pagesRead: number;
  /** Pages still unread in the plan. */
  pagesRemaining: number;
  /** Pages the plan covers in total (604 - startPage + 1). */
  planTotalPages: number;
  /** True once every page of the plan has been marked done. */
  complete: boolean;
  /** True when today's portion is already marked done. */
  doneToday: boolean;
  /** True when the end date passed with pages still unread. */
  overdue: boolean;
};

/** Local date key `YYYY-MM-DD` (device local time). */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date | null {
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) return null;
  const [y, m, d] = parts as [number, number, number];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Whole days between two local midnights (negative when `b` is earlier). */
function wholeDaysBetween(a: Date, b: Date): number {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
    - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  return Math.round(ms / 86400000);
}

/** 0-based day of the plan for `now` (0 on the start date, never negative). */
export function planDayIndex(plan: KhatmahPlan, now: Date = new Date()): number {
  const start = parseDateKey(plan.startDate);
  if (!start) return 0;
  return Math.max(0, wholeDaysBetween(start, now));
}

/** Pages the plan covers in total: from the start page to page 604. */
export function planTotalPages(plan: KhatmahPlan): number {
  return Math.max(1, TOTAL_PAGES - plan.startPage + 1);
}

/** Pages actually marked done — the sum of stored portions only. */
export function pagesRead(plan: KhatmahPlan): number {
  let total = 0;
  for (const d of plan.done) total += Math.max(0, d.toPage - d.fromPage + 1);
  return Math.min(total, planTotalPages(plan));
}

/** First unread page of the plan (605 when everything is read). */
export function nextPage(plan: KhatmahPlan): number {
  return Math.min(TOTAL_PAGES + 1, plan.startPage + pagesRead(plan));
}

/**
 * Today's portion. Rounded UP so the plan finishes by its end date:
 * a missed day shrinks the days left, so the next day's portion
 * grows to compensate. Past the end date the whole remainder is
 * due today, so the plan can still be finished.
 */
export function todaysPortion(plan: KhatmahPlan, now: Date = new Date()): KhatmahToday {
  const today = localDateKey(now);
  const read = pagesRead(plan);
  const total = planTotalPages(plan);
  const remaining = Math.max(0, total - read);
  const complete = remaining === 0;
  const index = planDayIndex(plan, now);
  const overdue = !complete && index >= plan.totalDays;
  const daysLeft = complete ? 0 : Math.max(0, plan.totalDays - index);
  const divisor = Math.max(1, daysLeft);
  const perDay = complete ? 0 : Math.ceil(remaining / divisor);
  const from = complete ? TOTAL_PAGES : nextPage(plan);
  const to = complete ? TOTAL_PAGES : Math.min(TOTAL_PAGES, from + perDay - 1);
  return {
    dayNumber: Math.min(index + 1, plan.totalDays),
    daysLeft,
    fromPage: from,
    toPage: to,
    pagesToday: complete ? 0 : to - from + 1,
    pagesRead: read,
    pagesRemaining: remaining,
    planTotalPages: total,
    complete,
    doneToday: plan.done.some((d) => d.date === today),
    overdue,
  };
}

/** Pages per day a fresh plan would need (preview shown before starting). */
export function previewPagesPerDay(totalDays: number, startPage: number): number {
  const pages = Math.max(1, TOTAL_PAGES - startPage + 1);
  return Math.max(1, Math.ceil(pages / Math.max(1, totalDays)));
}

export type PlanInputError = 'days' | 'page';

/** Validate the user's choices; null when they are usable. */
export function validatePlanInput(totalDays: number, startPage: number): PlanInputError | null {
  if (!Number.isInteger(totalDays) || totalDays < MIN_PLAN_DAYS || totalDays > MAX_PLAN_DAYS) {
    return 'days';
  }
  if (!Number.isInteger(startPage) || startPage < 1 || startPage > TOTAL_PAGES) {
    return 'page';
  }
  return null;
}

/** Build a new plan starting today. Throws on invalid input. */
export function createPlan(
  totalDays: number,
  startPage: number,
  now: Date = new Date(),
): KhatmahPlan {
  const error = validatePlanInput(totalDays, startPage);
  if (error === 'days') {
    throw new Error(`totalDays must be ${MIN_PLAN_DAYS}–${MAX_PLAN_DAYS}`);
  }
  if (error === 'page') {
    throw new Error(`startPage must be 1–${TOTAL_PAGES}`);
  }
  return {
    totalDays,
    startPage,
    startDate: localDateKey(now),
    createdAt: now.toISOString(),
    done: [],
  };
}

/**
 * A copy of the plan with today's portion marked done. Returns null
 * when there is nothing to mark (already done today, or complete),
 * so a double-tap can never record the same pages twice.
 */
export function markTodayDone(plan: KhatmahPlan, now: Date = new Date()): KhatmahPlan | null {
  const today = todaysPortion(plan, now);
  if (today.complete || today.doneToday) return null;
  return {
    ...plan,
    done: [
      ...plan.done,
      { date: localDateKey(now), fromPage: today.fromPage, toPage: today.toPage },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Persistence (AsyncStorage, per user — same convention as tasbih.ts) */
/* ------------------------------------------------------------------ */

export function khatmahPlanKey(uid: string): string {
  return `khatmah:plan:${uid}`;
}

export function khatmahTargetKey(uid: string): string {
  return `khatmah:target:${uid}`;
}

/** All khatmah writes go through one promise chain (same pattern as tasbih.ts). */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(work: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(work).catch(() => undefined);
  writeQueue = run;
  return run;
}

function isValidPage(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= TOTAL_PAGES;
}

function parsePlan(raw: string | null): KhatmahPlan | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Partial<KhatmahPlan>;
    if (
      !Number.isInteger(p.totalDays)
      || p.totalDays == null
      || p.totalDays < MIN_PLAN_DAYS
      || p.totalDays > MAX_PLAN_DAYS
      || !isValidPage(p.startPage)
      || typeof p.startDate !== 'string'
      || parseDateKey(p.startDate) == null
      || typeof p.createdAt !== 'string'
      || !Array.isArray(p.done)
    ) {
      return null;
    }
    const done: KhatmahDayDone[] = [];
    for (const entry of p.done as unknown[]) {
      if (
        typeof entry === 'object'
        && entry !== null
        && typeof (entry as Partial<KhatmahDayDone>).date === 'string'
        && isValidPage((entry as Partial<KhatmahDayDone>).fromPage)
        && isValidPage((entry as Partial<KhatmahDayDone>).toPage)
      ) {
        const e = entry as KhatmahDayDone;
        if (e.toPage >= e.fromPage) done.push({ date: e.date, fromPage: e.fromPage, toPage: e.toPage });
      }
    }
    return {
      totalDays: p.totalDays,
      startPage: p.startPage as number,
      startDate: p.startDate,
      createdAt: p.createdAt,
      done,
    };
  } catch {
    return null;
  }
}

/** The user's saved plan, or null when no plan exists (or it is corrupt). */
export async function loadPlan(uid: string): Promise<KhatmahPlan | null> {
  try {
    return parsePlan(await AsyncStorage.getItem(khatmahPlanKey(uid)));
  } catch {
    return null;
  }
}

/** Save (create or update) the user's plan. */
export function savePlan(uid: string, plan: KhatmahPlan): Promise<void> {
  return enqueueWrite(() =>
    AsyncStorage.setItem(khatmahPlanKey(uid), JSON.stringify(plan)),
  );
}

/** Delete the user's plan (cancel / start over). */
export function clearPlan(uid: string): Promise<void> {
  return enqueueWrite(() => AsyncStorage.removeItem(khatmahPlanKey(uid)));
}

/**
 * The page the Continue button last saved — the first page of
 * today's portion. The coordinator wires this to the Quran Book
 * screen; until then it is also shown on the Khatmah screen itself.
 * Null when Continue has never been pressed for the current plan.
 */
export async function loadTargetPage(uid: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(khatmahTargetKey(uid));
    if (raw == null) return null;
    const n = Number(raw);
    return isValidPage(n) ? n : null;
  } catch {
    return null;
  }
}

/** Store the page Continue should open (first page of today's portion). */
export function saveTargetPage(uid: string, page: number): Promise<void> {
  if (!isValidPage(page)) return Promise.resolve();
  return enqueueWrite(() =>
    AsyncStorage.setItem(khatmahTargetKey(uid), String(page)),
  );
}

/** Clear the stored Continue target (e.g. after today's portion is done). */
export function clearTargetPage(uid: string): Promise<void> {
  return enqueueWrite(() => AsyncStorage.removeItem(khatmahTargetKey(uid)));
}
