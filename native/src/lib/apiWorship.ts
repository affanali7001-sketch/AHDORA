/**
 * Worship data client for the native app.
 *
 * Sources (all verified live 2026-11-21):
 * - Quran Arabic text: AlQuran Cloud (https://api.alquran.cloud/v1),
 *   Tanzil Uthmani text, no key. GET /v1/page/{n} returns the real
 *   mushaf page (page 1 = Al-Fatiha, verified).
 * - Urdu translation text: AlQuran Cloud edition `ur.junagarhi`
 *   (Muhammad Junagarhi), via /v1/page/{n}/ur.junagarhi.
 * - Tilawat audio: EveryAyah, reciter Mishary Rashid Alafasy
 *   (Alafasy_128kbps). Pattern:
 *   https://everyayah.com/data/Alafasy_128kbps/<surah 3-digit><ayah 3-digit>.mp3
 *   Verified live: 001001, 001007, 002001 all HTTP 200 audio/mpeg.
 *   Fallback for the same reciter: AlQuran Cloud CDN
 *   https://cdn.islamic.network/quran/audio/128/ar.alafasy/<global ayah>.mp3
 * - Urdu tarjuma AUDIO: Shamshad Ali Khan (edition `ur.khan`) on the
 *   Islamic Network CDN, 64 kbps:
 *   https://cdn.islamic.network/quran/audio/64/ur.khan/<global ayah>.mp3
 *   Verified live: global ayahs 1, 2, 7, 8 and 6236 all HTTP 200
 *   audio/mpeg; AlQuran Cloud's own /v1/ayah/{n}/ur.khan response
 *   returns the same URL in its `audio` field. (128 kbps returns
 *   403 for this edition — 64 kbps is the working bitrate.)
 * - Duas, Hijri and mosques: the live AHDORA API
 *   (https://ahdora-f85f76ceea58.herokuapp.com) via api.ts's
 *   apiFetch, which carries the session cookie + CSRF handling.
 *   Duas: /api/duas (22 verified duas, public). Hijri:
 *   /api/hijri/today + /api/hijri/month (Aladhan Umm al-Qura,
 *   public). Mosques: /api/mosques/search + /nearby + /near-me
 *   (OpenStreetMap, public except /near-me).
 * - Quran reading history/target: /api/quran/history, /read,
 *   /target (authed, per-user). The server tracks AYAHS opened
 *   today, not pages — pages read today are tracked in-memory
 *   on the Quran Book screen and labelled as such.
 *
 * Nothing here invents Quranic text, translation or audio.
 */

import { apiFetch } from './api';

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';

/** Default tilawat reciter — Mishary Rashid Alafasy, EveryAyah. */
export const TILAWAT_RECITER = {
  id: 'Alafasy_128kbps',
  name: 'Mishary Rashid Alafasy',
  bitrate: '128 kbps',
  source: 'EveryAyah',
} as const;

/** Urdu tarjuma audio voice — Shamshad Ali Khan, Islamic Network CDN. */
export const URDU_AUDIO = {
  edition: 'ur.khan',
  name: 'Shamshad Ali Khan',
  bitrate: '64 kbps',
  source: 'Islamic Network CDN (cdn.islamic.network)',
} as const;

/** Urdu translation text edition — Muhammad Junagarhi. */
export const URDU_TEXT_EDITION = 'ur.junagarhi';
export const URDU_TEXT_NAME = 'Muhammad Junagarhi';

export const ARABIC_SOURCE = 'Tanzil Uthmani text via AlQuran Cloud';

/** EveryAyah audio URL for one ayah (surah + ayah-in-surah). */
export function everyAyahUrl(surahNumber: number, ayahNumber: number): string {
  const surah = String(surahNumber).padStart(3, '0');
  const ayah = String(ayahNumber).padStart(3, '0');
  return `https://everyayah.com/data/${TILAWAT_RECITER.id}/${surah}${ayah}.mp3`;
}

/** AlQuran Cloud CDN fallback for the same reciter (GLOBAL ayah number 1..6236). */
export function tilawatFallbackUrl(globalAyahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahNumber}.mp3`;
}

/** Urdu tarjuma audio URL for one ayah (GLOBAL ayah number 1..6236). */
export function urduAudioUrl(globalAyahNumber: number): string {
  return `https://cdn.islamic.network/quran/audio/64/${URDU_AUDIO.edition}/${globalAyahNumber}.mp3`;
}

/* ------------------------------------------------------------------ */
/* AlQuran Cloud — mushaf pages, surah list                           */
/* ------------------------------------------------------------------ */

export type MushafSurahRef = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type MushafAyah = {
  /** Global ayah number (1..6236) — used for audio URLs. */
  number: number;
  numberInSurah: number;
  text: string;
  surah: MushafSurahRef;
  juz: number;
  page: number;
  sajda: boolean;
};

export type MushafPage = {
  number: number;
  ayahs: MushafAyah[];
};

export type UrduAyah = {
  number: number;
  numberInSurah: number;
  text: string;
};

async function fetchAlQuran<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${ALQURAN_BASE}${path}`, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Quran text load nahi ho paya. Internet check karke dobara try karo.');
  }
  if (!response.ok) {
    throw new Error('Quran text load nahi ho paya. Thodi der baad dobara try karo.');
  }
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    data?: unknown;
  } | null;
  if (!payload || payload.code !== 200 || payload.data === undefined) {
    throw new Error('Quran text load nahi ho paya. Thodi der baad dobara try karo.');
  }
  return payload.data as T;
}

/** One mushaf page (1–604) in Uthmani Arabic. */
export async function fetchMushafPage(page: number): Promise<MushafPage> {
  const data = await fetchAlQuran<{ number: number; ayahs: MushafAyah[] }>(
    `/page/${page}`,
  );
  return { number: data.number, ayahs: data.ayahs };
}

/** Same mushaf page in Urdu translation text (Junagarhi). */
export async function fetchUrduPage(page: number): Promise<UrduAyah[]> {
  const data = await fetchAlQuran<{ ayahs: UrduAyah[] }>(
    `/page/${page}/${URDU_TEXT_EDITION}`,
  );
  return data.ayahs;
}

/** All 114 surahs with metadata (for the index / jump). */
export async function fetchSurahList(): Promise<MushafSurahRef[]> {
  return fetchAlQuran<MushafSurahRef[]>('/surah');
}

/** First mushaf page of a surah (from its first ayah's page number). */
export async function fetchSurahFirstPage(surahNumber: number): Promise<number> {
  const data = await fetchAlQuran<{ ayahs: { page: number }[] }>(
    `/surah/${surahNumber}/quran-uthmani`,
  );
  const first = data.ayahs[0];
  if (!first || typeof first.page !== 'number') {
    throw new Error('Surah ka pehla page nahi mila.');
  }
  return first.page;
}

/* ------------------------------------------------------------------ */
/* Live AHDORA API — duas, hijri, mosques, reading history            */
/* ------------------------------------------------------------------ */

async function requestLive<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = (await response.json().catch(() => ({}))) as { error?: unknown } & T;
  if (!response.ok) {
    const message =
      typeof data.error === 'string' && data.error.length > 0
        ? data.error
        : 'Request failed. Please try again.';
    throw new Error(message);
  }
  return data as T;
}

export type DuaTopic = string;

export type Dua =
  | {
      id: string;
      title: string;
      topics: DuaTopic[];
      when: string;
      source: string;
      note?: string;
      kind: 'dua';
      arabic: string;
      transliteration: string;
      meaning: string;
    }
  | {
      id: string;
      title: string;
      topics: DuaTopic[];
      when: string;
      source: string;
      note?: string;
      kind: 'quran-amal';
      quranSurah: number;
      quranSurahName: string;
      quranAyahStart: number;
      quranAyahEnd: number;
      practice: string;
    };

export type DuasResponse = {
  source: string;
  count: number;
  topics: { id: DuaTopic; label: string; hinglish: string }[];
  duas: Dua[];
};

export async function fetchDuas(topic?: string): Promise<DuasResponse> {
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  return requestLive<DuasResponse>(`/api/duas${query}`);
}

export type HijriDay = {
  gregorian: { date: string; weekday?: string };
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string; days?: number };
    year: string;
    holidays: string[];
  };
  isToday: boolean;
};

export type HijriToday = {
  source: string;
  convention: string;
  gregorian: { date: string };
  hijri: {
    date: string;
    day: string;
    month: { number: number; en: string; ar: string };
    year: string;
    holidays: string[];
  };
  adjustmentDays: number;
};

export async function fetchHijriToday(): Promise<HijriToday> {
  return requestLive<HijriToday>('/api/hijri/today');
}

export type HijriMonth = {
  source: string;
  convention: string;
  year: number;
  month: number;
  adjustmentDays: number;
  hijriMonths: string[];
  days: HijriDay[];
};

export async function fetchHijriMonth(year: number, month: number): Promise<HijriMonth> {
  return requestLive<HijriMonth>(`/api/hijri/month?year=${year}&month=${month}`);
}

export type Mosque = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  phone: string | null;
  website: string | null;
  directionsUrl: string;
  source: string;
};

export type MosqueSearchResponse = {
  source: string;
  city?: string;
  place?: string;
  centre?: { lat: number; lng: number };
  radiusKm: number;
  count: number;
  mosques: Mosque[];
  note?: string;
};

/**
 * Search mosques around a city (Nominatim geocode + Overpass).
 * The public Overpass instance can take ~35 s; the server aborts
 * with an honest 504 in that case.
 */
export async function searchMosques(
  city: string,
  country: string,
  radiusKm: number,
): Promise<MosqueSearchResponse> {
  const query =
    `?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}` +
    `&radiusKm=${radiusKm}`;
  return requestLive<MosqueSearchResponse>(`/api/mosques/search${query}`);
}

/** Mosques near the user's profile city (needs login + saved city). */
export async function fetchNearMeMosques(): Promise<MosqueSearchResponse> {
  return requestLive<MosqueSearchResponse>('/api/mosques/near-me');
}

export type QuranHistory = {
  dailyTarget: number;
  ayahsOpenedToday: number;
  date: string;
  history: { surahNumber: number; lastAyahNumber: number; lastReadAt: string }[];
};

/** The user's reading history + today's ayah count (needs login). */
export async function fetchQuranHistory(): Promise<QuranHistory> {
  return requestLive<QuranHistory>('/api/quran/history');
}

/**
 * Record that the user read up to an ayah in a surah. The server
 * counts forward progress only — re-reading adds nothing.
 */
export async function recordRead(
  surahNumber: number,
  ayahNumber: number,
): Promise<{ recorded: boolean; ayahsAddedToday: number }> {
  return requestLive<{ recorded: boolean; ayahsAddedToday: number }>('/api/quran/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surahNumber, ayahNumber }),
  });
}

/** Set the daily reading target (ayahs/day, 0–500). */
export async function setDailyTarget(dailyTarget: number): Promise<{ dailyTarget: number }> {
  return requestLive<{ dailyTarget: number }>('/api/quran/target', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyTarget }),
  });
}

export type QuranDayLogEntry = {
  dayKey: string;
  ayahsRead: number;
  listened: boolean;
  listenedMinutes: number;
};

/** Per-day read/listened log (last N days, missing days filled as not read / not listened). */
export async function fetchQuranDailyLog(days = 7): Promise<{ days: QuranDayLogEntry[] }> {
  return requestLive<{ days: QuranDayLogEntry[] }>(`/api/quran/daily-log?days=${days}`);
}

/** Record that the user listened to Quran today (marks the day as listened). */
export async function recordListened(
  minutes = 0,
): Promise<{ ok: boolean; listened: boolean; dayKey: string }> {
  return requestLive<{ ok: boolean; listened: boolean; dayKey: string }>('/api/quran/listened', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes }),
  });
}
