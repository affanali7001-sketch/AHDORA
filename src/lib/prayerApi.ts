import { apiFetch } from './http.js';
export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type PrayerTimesResponse = {
  date: string;
  city: string;
  country: string;
  timezone: string;
  method: string;
  source: string;
  /** True when Aladhan failed and the response carries manual times instead (P2/P6 fallback). */
  aladhanFailed?: boolean;
  /** Human-readable note to show when aladhanFailed is true. */
  notice?: string;
  hijri: { date: string | null; month: string | null; year: string | null } | null;
  timings: Record<PrayerName | 'Sunrise', string>;
  perPrayer: Record<
    PrayerName,
    { time: string; deadline: string; reminder: boolean; source: 'manual' | 'calculated' | 'unavailable' }
  >;
  nextPrayer: { name: PrayerName; time: string } | null;
};

export type PrayerSetting = {
  timeOverride: string;
  endTime: string;
  reminder: boolean;
};

export type PrayerSettings = Record<PrayerName, PrayerSetting>;

export const emptyPrayerSettings = (): PrayerSettings => ({
  Fajr: { timeOverride: '', endTime: '', reminder: true },
  Dhuhr: { timeOverride: '', endTime: '', reminder: true },
  Asr: { timeOverride: '', endTime: '', reminder: true },
  Maghrib: { timeOverride: '', endTime: '', reminder: true },
  Isha: { timeOverride: '', endTime: '', reminder: true },
});

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return value === '' || HHMM.test(value);
}

/** The user's own saved per-prayer times (manual overrides + deadlines). */
export async function fetchPrayerSettings(): Promise<PrayerSettings> {
  const response = await apiFetch('/api/profile', {
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Prayer settings could not be loaded.',
    );
  }
  const settings = emptyPrayerSettings();
  const saved = (data.profile?.prayerSettings ?? {}) as Partial<
    Record<PrayerName, Partial<PrayerSetting>>
  >;
  (Object.keys(settings) as PrayerName[]).forEach((prayer) => {
    const entry = saved[prayer];
    if (!entry) return;
    settings[prayer] = {
      timeOverride: typeof entry.timeOverride === 'string' ? entry.timeOverride : '',
      endTime: typeof entry.endTime === 'string' ? entry.endTime : '',
      reminder: entry.reminder ?? true,
    };
  });
  return settings;
}

/**
 * Persist the user's own per-prayer times. Empty timeOverride/endTime
 * means "use the calculated time". Saved per user via POST /api/profile.
 */
export async function savePrayerSettings(settings: PrayerSettings): Promise<void> {
  for (const prayer of Object.keys(settings) as PrayerName[]) {
    const entry = settings[prayer];
    if (!isValidTime(entry.timeOverride) || !isValidTime(entry.endTime)) {
      throw new Error(`${prayer} ka time HH:mm format me hona chahiye.`);
    }
  }
  const response = await apiFetch('/api/profile', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prayerSettings: settings }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Prayer times save nahi ho paye. Dobara try karo.',
    );
  }
}

export async function fetchPrayerTimes(date?: string): Promise<PrayerTimesResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await apiFetch(`/api/prayer/times${query}`, {
    credentials: 'include',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Prayer times could not be loaded. Check your connection / city.',
    );
  }
  return data as PrayerTimesResponse;
}
