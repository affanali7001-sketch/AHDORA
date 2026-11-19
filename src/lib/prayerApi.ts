export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type PrayerTimesResponse = {
  date: string;
  city: string;
  country: string;
  timezone: string;
  method: string;
  source: string;
  hijri: { date: string | null; month: string | null; year: string | null } | null;
  timings: Record<PrayerName | 'Sunrise', string>;
  perPrayer: Record<
    PrayerName,
    { time: string; deadline: string; reminder: boolean; source: 'manual' | 'calculated' }
  >;
  nextPrayer: { name: PrayerName; time: string } | null;
};

export async function fetchPrayerTimes(date?: string): Promise<PrayerTimesResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`/api/prayer/times${query}`, {
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
