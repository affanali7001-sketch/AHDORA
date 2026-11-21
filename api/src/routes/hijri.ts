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
