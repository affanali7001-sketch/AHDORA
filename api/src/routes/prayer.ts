import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Profile } from '../models/Profile.js';

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

function todayKey(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** "05:12" from Aladhan values like "05:12" or "05:12 (IST)". */
function stripToHHmm(value: unknown): string {
  if (typeof value !== 'string') return '';
  const first = value.trim().split(' ')[0] ?? '';
  return first.slice(0, 5);
}

function toMinutes(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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

prayerRouter.get('/times', async (req, res, next) => {
  try {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dateParam = typeof req.query.date === 'string' ? req.query.date : todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
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
    const methodName = profile?.prayerCalculationMethod?.trim() || 'University of Islamic Sciences, Karachi';
    const method = methodMap[methodName] ?? 1;
    const school = profile?.asrMethod === 'hanafi' ? 1 : 0;

    const url =
      `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}` +
      `&country=${encodeURIComponent(country)}&method=${method}&school=${school}`;

    let upstream: Response;
    try {
      upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      res.status(502).json({ error: 'Prayer times could not be loaded from Aladhan. Please try again later.' });
      return;
    }

    if (!upstream.ok) {
      res.status(502).json({ error: 'Prayer times could not be loaded from Aladhan. Please try again later.' });
      return;
    }

    const payload = (await upstream.json().catch(() => null)) as {
      data?: {
        timings?: Record<string, unknown>;
        date?: { hijri?: { date?: string; month?: { en?: string }; year?: string } };
        meta?: { timezone?: string };
      };
    } | null;

    const timings = payload?.data?.timings;
    if (!timings) {
      res.status(502).json({ error: 'Prayer times could not be loaded from Aladhan. Please try again later.' });
      return;
    }

    const calculated: Record<PrayerName | 'Sunrise', string> = {
      Fajr: stripToHHmm(timings.Fajr),
      Sunrise: stripToHHmm(timings.Sunrise),
      Dhuhr: stripToHHmm(timings.Dhuhr),
      Asr: stripToHHmm(timings.Asr),
      Maghrib: stripToHHmm(timings.Maghrib),
      Isha: stripToHHmm(timings.Isha),
    };

    // Any missing calculated time means the upstream response is unusable —
    // never fabricate a time.
    if (prayers.some((p) => !calculated[p])) {
      res.status(502).json({ error: 'Prayer times could not be loaded from Aladhan. Please try again later.' });
      return;
    }

    const settings = (profile?.prayerSettings ?? {}) as Record<
      string,
      { timeOverride?: string; endTime?: string; reminder?: boolean } | undefined
    >;

    const perPrayer = {} as Record<
      PrayerName,
      { time: string; deadline: string; reminder: boolean; source: 'manual' | 'calculated' }
    >;
    const displayTimes: Record<PrayerName, string> = {} as Record<PrayerName, string>;

    for (let i = 0; i < prayers.length; i++) {
      const prayer = prayers[i];
      if (!prayer) continue;
      const setting = settings[prayer];
      const override = setting?.timeOverride?.trim();
      const isManual = Boolean(override && toMinutes(override) !== null);
      const time = isManual ? (override as string) : calculated[prayer];
      displayTimes[prayer] = time;
      const nextName = prayers[i + 1];
      const deadline =
        setting?.endTime?.trim() && toMinutes(setting.endTime.trim()) !== null
          ? setting.endTime.trim()
          : nextName
            ? displayTimes[nextName] ?? calculated[nextName]
            : '23:59';
      perPrayer[prayer] = {
        time,
        deadline,
        reminder: setting?.reminder ?? true,
        source: isManual ? 'manual' : 'calculated',
      };
    }

    // Next prayer is only meaningful for today; for a past/future date return null.
    let nextPrayer: { name: PrayerName; time: string } | null = null;
    if (dateParam === todayKey()) {
      const nowMinutes = toMinutes(nowInTimezone(timezone));
      if (nowMinutes !== null) {
        for (const prayer of prayers) {
          const timeMinutes = toMinutes(displayTimes[prayer]);
          if (timeMinutes !== null && timeMinutes > nowMinutes) {
            nextPrayer = { name: prayer, time: displayTimes[prayer] };
            break;
          }
        }
      }
    }

    const hijri = payload?.data?.date?.hijri;
    res.json({
      date: dateParam,
      city,
      country,
      timezone: payload?.data?.meta?.timezone || timezone,
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
      nextPrayer,
    });
  } catch (error) {
    next(error);
  }
});
