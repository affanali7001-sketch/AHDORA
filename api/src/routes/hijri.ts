import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { Profile } from '../models/Profile.js';
import { addDays, dateKeyInTimezone } from '../lib/timezone.js';

/**
 * Hijri calendar — real Aladhan conversion data (Umm al-Qura).
 *
 * Verified live 2026-11-19:
 *   GET /v1/gToHCalendar/11/2026 -> 200 (whole-month conversion)
 *   GET /v1/gToH/11-11-2026      -> 200 (single-day conversion)
 *   Feb 2027 data contains real holiday markers, e.g. 08-02-2027
 *   "1st Day of Ramadan" and 28-02-2027 "Lailat-ul-Qadr".
 * The dedicated holiday endpoints (/islamicHolidaysByYear etc.)
 * return 404, so Ramadan/Eid markers come only from the per-day
 * `hijri.holidays` arrays in the calendar data — nothing is
 * computed or invented here.
 *
 * DATE-FORMAT TRAP (P1, 2026-11-21): Aladhan returns every date as
 * "DD-MM-YYYY" (gregorian.date "01-11-2026", hijri.date
 * "21-05-1448"), while this codebase keys days as ISO "YYYY-MM-DD".
 * Comparing the two formats directly NEVER matches, so /today always
 * 502'd and the month lookup never shifted — the whole calendar
 * rendered blank ("·2026", "No calendar data for this month") and
 * the ± adjustment silently did nothing. Every Aladhan day is
 * therefore normalised to ISO at the fetch boundary
 * (normaliseAladhanDay) and all lookups below use ISO keys only.
 *
 * Adjustment: the user's hijriDayOffset (-2..+2, stored on the
 * profile) shifts the displayed Hijri date by that many days, for
 * local moon-sighting differences. The source and convention are
 * returned with every response so the UI can show them.
 */

export const hijriRouter = Router();

// Phase 15 (item 7): NO router-level requireAuth. /today and /month
// are PUBLIC calendar info — like /api/duas and /api/quran reading —
// so a guest, or a user whose session lives in another browser,
// still sees the Hijri calendar instead of "Authentication
// required". Those two routes use optionalAuth (a valid session
// cookie still applies the user's own timezone and moon-sighting
// offset). GET/PUT /settings stay behind requireAuth per-route:
// the offset is per-user data. The /api/hijri mount in app.ts is
// likewise public; do not re-add requireAuth to either place.

const SOURCE = 'Aladhan (Umm al-Qura calendar)';
const CONVENTION =
  'Umm al-Qura calendar via Aladhan. Moon-sighting can differ by location — use the day adjustment if your local sighting differs.';

type AladhanDay = {
  gregorian: { date: string; weekday?: { en?: string } };
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string; days: number };
    year: string;
    holidays: string[];
  };
};

type CalendarCacheEntry = { at: number; days: AladhanDay[] };
const calendarCache = new Map<string, CalendarCacheEntry>();

function isAladhanDay(data: unknown): data is AladhanDay {
  if (typeof data !== 'object' || data === null) return false;
  const day = data as AladhanDay;
  return (
    typeof day.gregorian?.date === 'string' &&
    typeof day.hijri?.date === 'string' &&
    typeof day.hijri?.day === 'string' &&
    typeof day.hijri?.month?.number === 'number' &&
    typeof day.hijri?.month?.en === 'string' &&
    typeof day.hijri?.year === 'string' &&
    Array.isArray(day.hijri?.holidays)
  );
}

/** "01-11-2026" (Aladhan DD-MM-YYYY) -> "2026-11-01" (ISO). Returns '' when the input is not a valid DD-MM-YYYY date. */
export function ddmmyyyyToIso(value: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return '';
  const [, day, month, year] = match as unknown as [string, string, string, string];
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return '';
  // Reject impossible dates (e.g. 31-02-2026) via a round-trip check.
  const probe = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
  if (
    probe.getUTCFullYear() !== yearNum ||
    probe.getUTCMonth() !== monthNum - 1 ||
    probe.getUTCDate() !== dayNum
  ) {
    return '';
  }
  return `${year}-${month}-${day}`;
}

/**
 * Normalise one raw Aladhan day to this codebase's ISO date keys.
 * The Hijri date itself stays in the upstream DD-MM-YYYY display
 * form (its day/month/year fields are what the UI renders); only
 * gregorian.date — the lookup key — is converted.
 */
export function normaliseAladhanDay(day: AladhanDay): AladhanDay | null {
  const iso = ddmmyyyyToIso(day.gregorian.date);
  if (!iso) return null;
  return { ...day, gregorian: { ...day.gregorian, date: iso } };
}

async function fetchGregorianMonthCalendar(month: number, year: number): Promise<AladhanDay[]> {
  const key = `${year}-${month}`;
  const cached = calendarCache.get(key);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.days;
  let response: Response;
  try {
    response = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('UPSTREAM_UNREACHABLE');
  }
  if (!response.ok) throw new Error('UPSTREAM_FAILED');
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    data?: unknown;
  } | null;
  if (!payload || payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error('UPSTREAM_BAD_RESPONSE');
  }
  // Normalise at the boundary: Aladhan dates are DD-MM-YYYY, all
  // lookups below use ISO YYYY-MM-DD keys (see the header note).
  const days = payload.data
    .filter(isAladhanDay)
    .map(normaliseAladhanDay)
    .filter((day): day is AladhanDay => day !== null);
  if (days.length === 0) throw new Error('UPSTREAM_BAD_RESPONSE');
  if (calendarCache.size > 60) calendarCache.clear();
  calendarCache.set(key, { at: Date.now(), days });
  return days;
}

/** Fetch one Gregorian month with a single retry — Aladhan is
 * occasionally slow and a dropped month silently hides the events
 * inside it (verified live 2026-11-22: one /events call missed
 * Eid-ul-Fitr + Mawlid, the next missed Ashura). The month cache
 * means a retry only re-fetches months that actually failed. */
async function fetchMonthWithRetry(month: number, year: number): Promise<AladhanDay[]> {
  try {
    return await fetchGregorianMonthCalendar(month, year);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return fetchGregorianMonthCalendar(month, year);
  }
}

async function fetchSingleDay(dateKey: string): Promise<AladhanDay | null> {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  try {
    const days = await fetchGregorianMonthCalendar(month, year);
    return days.find((item) => item.gregorian.date === dateKey) ?? null;
  } catch {
    return null;
  }
}

/** Apply the user's day offset: the Hijri date shown for a Gregorian day is the conversion of (day + offset). Both dates are ISO keys. */
export function shiftedLookup(days: AladhanDay[], gregorianDate: string, offset: number): AladhanDay | null {
  const target = addDays(gregorianDate, offset);
  return days.find((item) => item.gregorian.date === target) ?? null;
}

function publicDay(day: AladhanDay, gregorianDate: string, isToday: boolean) {
  return {
    gregorian: { date: gregorianDate, weekday: day.gregorian.weekday?.en ?? '' },
    hijri: {
      date: day.hijri.date,
      day: day.hijri.day,
      month: {
        number: day.hijri.month.number,
        en: day.hijri.month.en,
        ar: day.hijri.month.ar,
        days: day.hijri.month.days,
      },
      year: day.hijri.year,
      holidays: day.hijri.holidays,
    },
    isToday,
  };
}

async function getProfile(req: { authUser?: { id: string } }) {
  if (!req.authUser) return null;
  return Profile.findOne({ userId: req.authUser.id }).lean();
}

/** GET /api/hijri/today — today's Hijri + Gregorian date, with adjustment. PUBLIC (optionalAuth): a guest sees the default calendar; a signed-in user sees it with their own timezone and offset. */
hijriRouter.get('/today', optionalAuth, async (req, res, next) => {
  try {
    const profile = await getProfile(req);
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const offset = profile?.hijriDayOffset ?? 0;
    const today = dateKeyInTimezone(timezone);
    const shifted = addDays(today, offset);
    const day = await fetchSingleDay(shifted);
    if (!day) {
      res.status(502).json({ error: 'Hijri date could not be loaded from Aladhan. Please try again later.' });
      return;
    }
    res.json({
      source: SOURCE,
      convention: CONVENTION,
      gregorian: { date: today },
      hijri: {
        date: day.hijri.date,
        day: day.hijri.day,
        month: { number: day.hijri.month.number, en: day.hijri.month.en, ar: day.hijri.month.ar },
        year: day.hijri.year,
        holidays: day.hijri.holidays,
      },
      adjustmentDays: offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/hijri/month?year=2026&month=11 — Gregorian month grid
 * with the Hijri date (adjusted) and holidays for every day.
 * Defaults to the current month in the user's timezone.
 * PUBLIC (optionalAuth) — same reason as /today.
 */
hijriRouter.get('/month', optionalAuth, async (req, res, next) => {
  try {
    const profile = await getProfile(req);
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const offset = profile?.hijriDayOffset ?? 0;
    const today = dateKeyInTimezone(timezone);
    const [todayYear = 2026, todayMonth = 1] = today.split('-').map(Number);
    const year = Number(req.query.year) || todayYear;
    const month = Number(req.query.month) || todayMonth;
    if (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
      res.status(400).json({ error: 'Year and month must be valid (month 1–12).' });
      return;
    }

    const days = await fetchGregorianMonthCalendar(month, year);
    // The offset can push a lookup into the neighbouring month.
    let lookupDays = days;
    if (offset !== 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      try {
        const extra = await Promise.all([
          fetchGregorianMonthCalendar(prevMonth, prevYear),
          fetchGregorianMonthCalendar(nextMonth, nextYear),
        ]);
        lookupDays = [...extra[0], ...days, ...extra[1]];
      } catch {
        // Neighbouring months are only needed at the edges; fall
        // back to the requested month alone rather than failing.
        lookupDays = days;
      }
    }

    const publicDays = days.map((day) => {
      const shifted = shiftedLookup(lookupDays, day.gregorian.date, offset) ?? day;
      return publicDay(shifted, day.gregorian.date, day.gregorian.date === today);
    });

    const hijriMonths = [...new Set(publicDays.map((item) => `${item.hijri.month.en} ${item.hijri.year}`))];

    res.json({
      source: SOURCE,
      convention: CONVENTION,
      year,
      month,
      adjustmentDays: offset,
      hijriMonths,
      days: publicDays,
    });
  } catch {
    res.status(502).json({ error: 'Hijri calendar could not be loaded from Aladhan. Please try again later.' });
    return;
  }
});

export type HijriEventKey =
  | 'ramadan'
  | 'eid-fitr'
  | 'eid-adha'
  | 'qadr'
  | 'arafah'
  | 'new-year'
  | 'ashura'
  | 'mawlid'
  | 'miraj'
  | 'barat';

export type HijriEvent = {
  key: HijriEventKey;
  /** Raw Aladhan holiday name, e.g. "1st Day of Ramadan". */
  label: string;
  hijriDay: string;
  hijriMonth: string;
  hijriYear: string;
  /** ISO YYYY-MM-DD Gregorian date of the event. */
  gregorianDate: string;
  /** Whole days from `today` until the event (0 = today). */
  daysUntil: number;
};

/**
 * Map one Aladhan holiday name to a key event, or null when it is
 * not one of the big days the app tracks. Order matters: the
 * specific names (Fitr, Adha, Qadr, Arafah...) are checked before
 * the broad "ramadan" match, so "Lailat-ul-Qadr" never becomes
 * Ramadan and "Eid al-Fitr" never becomes Ramadan either.
 * Matching is by substring so upstream wording changes ("1st Day
 * of Ramadan", "Beginning of Ramadan", "Ramadan") still map.
 */
export function matchHijriEventKey(holiday: string): HijriEventKey | null {
  const h = holiday.toLowerCase();
  if (h.includes('fitr')) return 'eid-fitr';
  if (h.includes('adha')) return 'eid-adha';
  if (h.includes('qadr')) return 'qadr';
  // Aladhan spells it 'Arafa' (15-05-2027), not 'Arafah' — match
  // the shorter form so both spellings map.
  if (h.includes('arafa')) return 'arafah';
  if (h.includes('islamic new year')) return 'new-year';
  if (h.includes('ashura')) return 'ashura';
  if (h.includes("prophet's birthday") || h.includes('mawlid')) return 'mawlid';
  if (h.includes("mi'raj") || h.includes('miraj') || h.includes('isra')) return 'miraj';
  if (h.includes("bara'at") || h.includes('baraat')) return 'barat';
  if (h.includes('ramadan')) return 'ramadan';
  return null;
}

/**
 * From a flat list of normalised Aladhan days (any span, sorted or
 * not), return the NEXT occurrence of each key event on or after
 * `earliest` (ISO, defaults to `today`), one entry per key, sorted
 * by date. `earliest` lets the ?year= mode list a whole past or
 * future year instead of only what is still ahead. The user's day
 * offset is applied the same way /month does it: the event is
 * dated on the Gregorian day whose SHIFTED Hijri day carries the
 * holiday. Days before `earliest` are skipped, and a key is
 * recorded only at its first occurrence (Eid spans are not
 * repeated). Pure function — no fetch, no DB — so it is
 * unit-testable.
 */
export function collectHijriEvents(
  days: AladhanDay[],
  today: string,
  offset: number,
  earliest: string = today,
): HijriEvent[] {
  const sorted = [...days].sort((a, b) => a.gregorian.date.localeCompare(b.gregorian.date));
  const found = new Map<HijriEventKey, HijriEvent>();
  for (const day of sorted) {
    if (day.gregorian.date < earliest) continue;
    const shifted = shiftedLookup(sorted, day.gregorian.date, offset) ?? day;
    const daysUntil = Math.round(
      (Date.parse(day.gregorian.date) - Date.parse(today)) / 86400000,
    );
    const record = (key: HijriEventKey, label: string) => {
      if (found.has(key)) return;
      found.set(key, {
        key,
        label,
        hijriDay: shifted.hijri.day,
        hijriMonth: shifted.hijri.month.en,
        hijriYear: shifted.hijri.year,
        gregorianDate: day.gregorian.date,
        daysUntil,
      });
    };
    for (const holiday of shifted.hijri.holidays) {
      const key = matchHijriEventKey(holiday);
      if (key) record(key, holiday);
    }
    // Fixed-date backup: Aladhan's holiday names vary ('Arafa' not
    // 'Arafah') and 1 Muharram carries no marker at all, so derive
    // these three from the Hijri date itself — the date still comes
    // from Aladhan's real conversion, nothing is invented.
    const monthNum = shifted.hijri.month.number;
    const dayNum = Number(shifted.hijri.day);
    if (monthNum === 12 && dayNum === 9) record('arafah', 'Day of Arafah');
    if (monthNum === 1 && dayNum === 1) record('new-year', 'Islamic New Year');
    if (monthNum === 1 && dayNum === 10) record('ashura', 'Day of Ashura');
  }
  return [...found.values()].sort((a, b) => a.gregorianDate.localeCompare(b.gregorianDate));
}

/**
 * GET /api/hijri/events — the next occurrence of each big Islamic
 * day (Ramadan, Eid-ul-Fitr, Eid-ul-Adha/Bakrid, Shab-e-Qadr,
 * Arafah, Islamic New Year, Ashura, Mawlid, Shab-e-Miraj,
 * Shab-e-Barat) with its Hijri + Gregorian date and days-until
 * countdown. PUBLIC (optionalAuth) — same reason as /today and
 * /month: calendar info, not per-user data (the signed-in user's
 * timezone and moon-sighting offset still apply).
 *
 * ?year=YYYY — instead of "next occurrence", list that whole
 * Gregorian year (2028, 2029, 2030 … 2050), so any year can be
 * browsed. daysUntil is still counted from today, so past events
 * in the year come back negative. Invalid year → 400.
 *
 * Why this endpoint exists: the Hijri screen only scanned the
 * current month + 2 ahead, so Ramadan/Eid/Bakrid — months away —
 * never appeared at all. This scans 14 Gregorian months forward
 * (a full Hijri year is ~354 days, so every key event's next
 * occurrence is inside the window) using the same 1-hour cached
 * month fetches as /month, and returns only real Aladhan markers —
 * nothing is computed or invented.
 */
hijriRouter.get('/events', optionalAuth, async (req, res) => {
  try {
    const profile = await getProfile(req);
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const offset = profile?.hijriDayOffset ?? 0;
    const today = dateKeyInTimezone(timezone);
    const [todayYear = 2026, todayMonth = 1] = today.split('-').map(Number);
    const yearParam = typeof req.query.year === 'string' ? req.query.year.trim() : '';
    let year: number | null = null;
    if (yearParam) {
      year = Number(yearParam);
      if (!Number.isInteger(year) || year < 1900 || year > 2200) {
        res.status(400).json({ error: 'Year must be between 1900 and 2200.' });
        return;
      }
    }
    // Default mode: 14 months from today. Year mode: that year's
    // 12 months, listed from 1 January (past events included).
    const months: { year: number; month: number }[] = [];
    if (year !== null) {
      for (let m = 1; m <= 12; m++) months.push({ year, month: m });
    } else {
      for (let i = 0; i < 14; i++) {
        const total = todayYear * 12 + (todayMonth - 1) + i;
        months.push({ year: Math.floor(total / 12), month: (total % 12) + 1 });
      }
    }
    // allSettled: one failed month must not hide the events in the
    // months that did load. Each month gets one retry first
    // (fetchMonthWithRetry). If every month fails, there is nothing
    // to answer from and the route 502s like /month does.
    const settled = await Promise.allSettled(
      months.map((m) => fetchMonthWithRetry(m.month, m.year)),
    );
    const allDays = settled.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : [],
    );
    if (allDays.length === 0) {
      res.status(502).json({ error: 'Hijri events could not be loaded from Aladhan. Please try again later.' });
      return;
    }
    const events = collectHijriEvents(
      allDays,
      today,
      offset,
      year !== null ? `${year}-01-01` : today,
    );
    res.json({
      source: SOURCE,
      convention: CONVENTION,
      today,
      adjustmentDays: offset,
      ...(year !== null ? { year } : {}),
      events,
    });
  } catch {
    res.status(502).json({ error: 'Hijri events could not be loaded from Aladhan. Please try again later.' });
  }
});

/** GET /api/hijri/settings — the user's Hijri day adjustment. AUTHED (per-user data). */
hijriRouter.get('/settings', requireAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const profile = await getProfile(req);
    res.json({ hijriDayOffset: profile?.hijriDayOffset ?? 0, source: SOURCE, convention: CONVENTION });
  } catch (error) {
    next(error);
  }
});

const settingsSchema = z.object({
  hijriDayOffset: z.number().int().min(-2).max(2),
});

/** PUT /api/hijri/settings — set the Hijri day adjustment (-2..+2). AUTHED (per-user data). */
hijriRouter.put('/settings', requireAuth, async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Hijri day adjustment must be between -2 and +2 days.' });
      return;
    }
    const profile = await Profile.findOneAndUpdate(
      { userId: req.authUser.id },
      { $set: { hijriDayOffset: parsed.data.hijriDayOffset } },
      { new: true, upsert: true },
    );
    res.json({ hijriDayOffset: profile?.hijriDayOffset ?? parsed.data.hijriDayOffset });
  } catch (error) {
    next(error);
  }
});
