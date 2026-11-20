import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { markTodayMissed, recomputeDay } from '../lib/salahAutoMissed.js';
import { dateKeyInTimezone, toMinutes } from '../lib/timezone.js';
import { Profile } from '../models/Profile.js';
import { User } from '../models/User.js';

export const prayerRouter = Router();

prayerRouter.use(requireAuth);

const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof prayers)[number];

const methodMap: Record<string, number> = {
  'University of Islamic Sciences, Karachi': 1,
  'Muslim World League': 3,
  'Egyptian General Authority': 5,
  'Umm al-Qura University, Makkah': 4,
  ISNA: 2,
};

/** "05:12" from Aladhan values like "05:12" or "05:12 (IST)". */
function stripToHHmm(value: unknown): string {
  if (typeof value !== 'string') return '';
  const first = value.trim().split(' ')[0] ?? '';
  return first.slice(0, 5);
}

/** Current HH:mm in the given IANA timezone; falls back to server local time. */
function nowInTimezone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour === '24' ? '00' : hour}:${minute}`;
  } catch {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
}

export type PrayerSettingInput = {
  timeOverride?: string;
  endTime?: string;
  reminder?: boolean;
};

export type ResolvedPrayer = {
  time: string;
  deadline: string;
  reminder: boolean;
  source: 'manual' | 'calculated' | 'unavailable';
};

export type ResolvedPrayerTimes = {
  perPrayer: Record<PrayerName, ResolvedPrayer>;
  displayTimes: Record<PrayerName, string>;
  /** How many prayers have a valid manual timeOverride. */
  manualCount: number;
};

/**
 * Pure resolver (unit-tested): the user's own timeOverride/endTime win
 * over Aladhan's calculated times. When `calculated` is null (Aladhan
 * unreachable, or the saved city unresolvable) a prayer with a manual
 * override still resolves to that override; a prayer with neither a
 * manual time nor a calculated time is 'unavailable' with an empty
 * time — never a fabricated time. Deadlines are the explicit endTime,
 * else the next prayer's effective time, else 23:59 for Isha — but
 * only when this prayer itself has a known time; an unavailable
 * prayer gets an empty deadline so it is never auto-marked missed on
 * a guess.
 */
export function resolvePerPrayerTimes(
  settings: Record<string, PrayerSettingInput | undefined>,
  calculated: Record<PrayerName | 'Sunrise', string> | null,
): ResolvedPrayerTimes {
  // Pass 1: effective times (manual override wins over calculated).
  const times = {} as Record<PrayerName, string>;
  let manualCount = 0;
  for (const prayer of prayers) {
    const override = settings[prayer]?.timeOverride?.trim();
    const isManual = Boolean(override && toMinutes(override) !== null);
    if (isManual) manualCount++;
    times[prayer] = isManual ? (override as string) : (calculated?.[prayer] ?? '');
  }
  // Pass 2: deadlines — the next prayer's effective time (or 23:59
  // for Isha), unless the user set an explicit endTime.
  const perPrayer = {} as Record<PrayerName, ResolvedPrayer>;
  for (let i = 0; i < prayers.length; i++) {
    const prayer = prayers[i] as PrayerName;
    const setting = settings[prayer];
    const override = setting?.timeOverride?.trim();
    const isManual = Boolean(override && toMinutes(override) !== null);
    const endOverride = setting?.endTime?.trim();
    const nextName = prayers[i + 1];
    const nextTime = nextName ? times[nextName] : '';
    const deadline =
      endOverride && toMinutes(endOverride) !== null
        ? endOverride
        : nextTime
          ? nextTime
          : prayer === 'Isha' && times[prayer]
            ? '23:59'
            : '';
    perPrayer[prayer] = {
      time: times[prayer],
      deadline,
      reminder: setting?.reminder ?? true,
      source: isManual ? 'manual' : calculated ? 'calculated' : 'unavailable',
    };
  }
  return { perPrayer, displayTimes: times, manualCount };
}

/**
 * Best-effort auto-miss for today from whatever deadlines are known
 * (full calculated deadlines, or just the user's own endTimes/manual
 * times). Never throws — auto-marking must never break the response.
 */
async function autoMissTodayBestEffort(
  userId: string,
  dateKey: string,
  timezone: string,
  resolved: ResolvedPrayerTimes | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any,
  accountCreatedAt: Date | null,
): Promise<void> {
  try {
    if (resolved) {
      const deadlines = Object.fromEntries(
        prayers.map((prayer) => [prayer, resolved.perPrayer[prayer].deadline]),
      ) as Record<PrayerName, string>;
      await markTodayMissed(userId, dateKey, timezone, deadlines, accountCreatedAt);
    } else {
      await recomputeDay(userId, dateKey, { timezone, profile, accountCreatedAt });
    }
  } catch {
    // Auto-marking must never break the prayer-times response.
  }
}

type AladhanData = {
  date?: { hijri?: { date?: string; month?: { en?: string }; year?: string } };
  meta?: { timezone?: string };
};

/**
 * P7: in-memory cache for Aladhan timings. Timings for a city /
 * method / school do not change within the day, and every dashboard
 * load was fetching them live (0.6–3.1 s each, no cache). The parsed
 * upstream response is cached per upstream URL for 60 minutes
 * (public data, shared across users in the same city). Manual
 * overrides are applied AFTER the cache lookup, so settings changes
 * are never stale. Failures are never cached, so a retry can succeed.
 */
const ALADHAN_CACHE_TTL_MS = 60 * 60 * 1000;
const aladhanTimesCache = new Map<
  string,
  { at: number; calculated: Record<PrayerName | 'Sunrise', string>; aladhanData: AladhanData | null }
>();

/** Test helper — not part of the public API. */
export function clearAladhanTimesCache(): void {
  aladhanTimesCache.clear();
}

prayerRouter.get('/times', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dateParam = typeof req.query.date === 'string' ? req.query.date : '';
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
      return;
    }

    const profile = await Profile.findOne({ userId: req.authUser.id }).lean();
    const city = profile?.city?.trim();
    if (!city) {
      res.status(400).json({ error: 'Add your city in onboarding to see prayer times.' });
      return;
    }

    const country = profile?.country?.trim() || 'India';
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    // "Today" is the user's own timezone, not the server's local date.
    const today = dateKeyInTimezone(timezone);
    const requestedDate = dateParam || today;
    const methodName = profile?.prayerCalculationMethod?.trim() || 'University of Islamic Sciences, Karachi';
    const method = methodMap[methodName] ?? 1;
    const school = profile?.asrMethod === 'hanafi' ? 1 : 0;

    const settings = (profile?.prayerSettings ?? {}) as Record<
      string,
      { timeOverride?: string; endTime?: string; reminder?: boolean } | undefined
    >;

    const url =
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}` +
      `&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;

    // Any upstream failure leaves `calculated` null instead of ending
    // the request: the manual fallback below still serves the user's
    // own times (P2/P6 — e.g. a saved city Aladhan cannot resolve,
    // like "MAHARSTRA", must not hide a manual Fajr 05:15).
    let calculated: Record<PrayerName | 'Sunrise', string> | null = null;
    let aladhanData: AladhanData | null = null;
    const cachedTimes = aladhanTimesCache.get(url);
    if (cachedTimes && Date.now() - cachedTimes.at < ALADHAN_CACHE_TTL_MS) {
      calculated = cachedTimes.calculated;
      aladhanData = cachedTimes.aladhanData;
    } else {
      try {
        const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (upstream.ok) {
          const payload = (await upstream.json().catch(() => null)) as {
            data?: {
              timings?: Record<string, unknown>;
              date?: { hijri?: { date?: string; month?: { en?: string }; year?: string } };
              meta?: { timezone?: string };
            };
          } | null;
          const timings = payload?.data?.timings;
          if (timings) {
            const parsed: Record<PrayerName | 'Sunrise', string> = {
              Fajr: stripToHHmm(timings.Fajr),
              Sunrise: stripToHHmm(timings.Sunrise),
              Dhuhr: stripToHHmm(timings.Dhuhr),
              Asr: stripToHHmm(timings.Asr),
              Maghrib: stripToHHmm(timings.Maghrib),
              Isha: stripToHHmm(timings.Isha),
            };
            // Any missing calculated time means the upstream response is
            // unusable — never fabricate a time.
            if (prayers.every((p) => parsed[p])) {
              calculated = parsed;
              aladhanData = payload?.data ?? null;
              if (aladhanTimesCache.size > 500) aladhanTimesCache.clear();
              aladhanTimesCache.set(url, { at: Date.now(), calculated: parsed, aladhanData });
            }
          }
        }
      } catch {
        calculated = null;
      }
    }

    const account = await User.findById(req.authUser.id).select('createdAt').lean();
    const accountCreatedAt = account?.createdAt ?? null;

    // Next prayer is only meaningful for today; for a past/future date return null.
    const nextPrayerFor = (
      displayTimes: Record<PrayerName, string>,
    ): { name: PrayerName; time: string } | null => {
      if (requestedDate !== today) return null;
      const nowMinutes = toMinutes(nowInTimezone(timezone));
      if (nowMinutes === null) return null;
      for (const prayer of prayers) {
        const timeMinutes = toMinutes(displayTimes[prayer]);
        if (timeMinutes !== null && timeMinutes > nowMinutes) {
          return { name: prayer, time: displayTimes[prayer] };
        }
      }
      return null;
    };

    if (!calculated) {
      const resolved = resolvePerPrayerTimes(settings, null);
      // Auto-missed still runs on the manual/profile deadlines, even
      // though Aladhan failed (P14): a bad city must not freeze the
      // tracker at "Pending" past every deadline.
      if (requestedDate === today) {
        await autoMissTodayBestEffort(
          req.authUser.id,
          requestedDate,
          timezone,
          resolved.manualCount > 0 ? resolved : null,
          profile,
          accountCreatedAt,
        );
      }
      if (resolved.manualCount > 0) {
        // Graceful fallback (P2/P6): serve the user's own manual
        // times, labelled as manual, instead of only an error.
        res.json({
          date: requestedDate,
          city,
          country,
          timezone,
          method: methodName,
          source: 'manual',
          aladhanFailed: true,
          notice:
            'Aladhan aapke saved city ke liye prayer times nahi de paya. Neeche aapke manual time dikhaye ja rahe hain — city Profile me update kar dein to calculated time wapas aa jayenge.',
          hijri: null,
          timings: {
            Fajr: resolved.displayTimes.Fajr,
            Sunrise: '',
            Dhuhr: resolved.displayTimes.Dhuhr,
            Asr: resolved.displayTimes.Asr,
            Maghrib: resolved.displayTimes.Maghrib,
            Isha: resolved.displayTimes.Isha,
          },
          perPrayer: resolved.perPrayer,
          nextPrayer: nextPrayerFor(resolved.displayTimes),
        });
        return;
      }
      res.status(502).json({
        error:
          'Prayer times could not be loaded from Aladhan for your saved city. ' +
          'Please check and update your city in Profile, or set your prayer times manually from the tracker below.',
      });
      return;
    }

    const resolved = resolvePerPrayerTimes(settings, calculated);
    const displayTimes = resolved.displayTimes;
    const perPrayer = resolved.perPrayer;

    // Auto-missed: now that today's deadlines are known, any prayer whose
    // deadline + 5-minute grace has passed and is still pending is marked
    // missed and persisted. Best-effort — it never fails this response.
    // Prayers due at or before account creation are never marked missed.
    if (requestedDate === today) {
      await autoMissTodayBestEffort(
        req.authUser.id,
        requestedDate,
        timezone,
        resolved,
        profile,
        accountCreatedAt,
      );
    }

    const hijri = aladhanData?.date?.hijri;
    res.json({
      date: requestedDate,
      city,
      country,
      timezone: aladhanData?.meta?.timezone || timezone,
      method: methodName,
      source: 'aladhan',
      hijri: hijri
        ? { date: hijri.date ?? null, month: hijri.month?.en ?? null, year: hijri.year ?? null }
        : null,
      timings: {
        Fajr: displayTimes.Fajr,
        Sunrise: calculated.Sunrise,
        Dhuhr: displayTimes.Dhuhr,
        Asr: displayTimes.Asr,
        Maghrib: displayTimes.Maghrib,
        Isha: displayTimes.Isha,
      },
      perPrayer,
      nextPrayer: nextPrayerFor(displayTimes),
    });
  } catch (error) {
    next(error);
  }
});
