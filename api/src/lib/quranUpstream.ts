/**
 * Quran upstream client — AlQuran Cloud (api.alquran.cloud/v1).
 *
 * IMPORTANT (verified live 2026-11-19): the Aladhan Quran endpoints
 * on api.aladhan.com/v1 (/surah, /quran, /edition) all return 404
 * RESOURCE_NOT_FOUND, so they cannot be used. AlQuran Cloud serves
 * the same Tanzil Uthmani Arabic text and the same edition catalogue
 * (it is the Quran-text API of the same Aladhan/Islamic Network
 * ecosystem). Every endpoint used here was verified live before
 * this code was written:
 *   GET /v1/surah            -> 200, 114 surahs with metadata
 *   GET /v1/surah/112        -> 200, Uthmani Arabic ayahs
 *   GET /v1/surah/112/en.transliteration -> 200
 *   GET /v1/surah/112/en.sahih           -> 200
 *   GET /v1/search/mercy/all/en.sahih    -> 200, 143 matches
 *
 * Audio is NOT served from here. Recitation audio streams from
 * EveryAyah (everyayah.com/data/<reciter>/<surah><ayah>.mp3), whose
 * files were verified live (HTTP 200, audio/mpeg) for all four
 * reciters we offer; the reciter is credited in the UI. The
 * AlQuran Cloud audio CDN (cdn.islamic.network) is the fallback:
 * re-checked live 2026-11-21 it serves real audio/mpeg for these
 * reciters, EXCEPT ar.abdulbasitmurattal at 128 kbps (403) — so
 * that reciter's fallback uses 64 kbps. The fallback URL uses the
 * GLOBAL ayah number (1..6236), not surah+ayah:
 *   https://cdn.islamic.network/quran/audio/<bitrate>/ar.<edition>/<global ayah>.mp3
 * EveryAyah itself still returns 200 from this environment
 * (2026-11-21, incl. browser UA + Referer + Range requests), so
 * the overnight "Play audio" failure was not a wrong URL — it was
 * a load failure in that browser with no fallback and no media
 * error handler, so the player had nowhere else to go. The client
 * now retries the fallback URL automatically before giving up.
 *
 * Upstream text is cached in memory with a short TTL only to avoid
 * hammering a free API. Cached text is still the verified upstream
 * text — nothing is edited, generated, or persisted as user data.
 * Any upstream failure is surfaced as a 502; text is never
 * fabricated.
 */

export type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type UpstreamAyah = {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  page: number;
  sajda: boolean;
};

export type UpstreamSurah = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: UpstreamAyah[];
};

export type SearchMatch = {
  number: number;
  text: string;
  surah: {
    number: number;
    name: string;
    englishName: string;
    englishNameTranslation: string;
    revelationType: string;
  };
};

const BASE = 'https://api.alquran.cloud/v1';

const ARABIC_EDITION = 'quran-uthmani';
export const TRANSLITERATION_EDITION = 'en.transliteration';
export const TRANSLATION_EDITION = 'en.sahih';
export const TRANSLATION_NAME = 'Saheeh International';
export const ARABIC_SOURCE = 'Tanzil Uthmani text via AlQuran Cloud';

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet<T>(key: string, value: T): void {
  // Bound the cache so a long-running server cannot grow it without limit.
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), value });
}

async function fetchUpstream(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
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
  if (!payload || payload.code !== 200 || payload.data === undefined) {
    throw new Error('UPSTREAM_BAD_RESPONSE');
  }
  return payload.data;
}

function isSurahMetaList(data: unknown): data is SurahMeta[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SurahMeta).number === 'number' &&
        typeof (item as SurahMeta).name === 'string' &&
        typeof (item as SurahMeta).englishName === 'string' &&
        typeof (item as SurahMeta).numberOfAyahs === 'number',
    )
  );
}

function isUpstreamSurah(data: unknown): data is UpstreamSurah {
  if (typeof data !== 'object' || data === null) return false;
  const surah = data as UpstreamSurah;
  return (
    typeof surah.number === 'number' &&
    typeof surah.name === 'string' &&
    Array.isArray(surah.ayahs) &&
    surah.ayahs.every(
      (ayah) =>
        typeof ayah.numberInSurah === 'number' && typeof ayah.text === 'string',
    )
  );
}

/** All 114 surahs with metadata (cached 1 hour). */
export async function fetchSurahList(): Promise<SurahMeta[]> {
  const cached = cacheGet<SurahMeta[]>('surah-list', 60 * 60 * 1000);
  if (cached) return cached;
  const data = await fetchUpstream('/surah');
  if (!isSurahMetaList(data)) throw new Error('UPSTREAM_BAD_RESPONSE');
  cacheSet('surah-list', data);
  return data;
}

/** One surah in one edition (cached 10 minutes). */
export async function fetchSurah(number: number, edition: string): Promise<UpstreamSurah> {
  const key = `surah:${number}:${edition}`;
  const cached = cacheGet<UpstreamSurah>(key, 10 * 60 * 1000);
  if (cached) return cached;
  const data = await fetchUpstream(`/surah/${number}/${edition}`);
  if (!isUpstreamSurah(data)) throw new Error('UPSTREAM_BAD_RESPONSE');
  cacheSet(key, data);
  return data;
}

/**
 * Ayah-text search via the upstream search endpoint (translation
 * edition). Returns matches in the translation text with their
 * surah. Throws on upstream failure — the caller turns that into
 * an honest 502, never into invented results.
 */
export async function searchAyahText(keyword: string): Promise<SearchMatch[]> {
  const data = await fetchUpstream(
    `/search/${encodeURIComponent(keyword)}/all/${TRANSLATION_EDITION}`,
  );
  const parsed = data as { count?: number; matches?: unknown[] } | null;
  if (!parsed || !Array.isArray(parsed.matches)) throw new Error('UPSTREAM_BAD_RESPONSE');
  const matches: SearchMatch[] = [];
  for (const item of parsed.matches.slice(0, 50)) {
    const match = item as SearchMatch;
    if (
      typeof match.number === 'number' &&
      typeof match.text === 'string' &&
      match.surah &&
      typeof match.surah.number === 'number' &&
      typeof match.surah.englishName === 'string'
    ) {
      matches.push(match);
    }
  }
  return matches;
}

/**
 * Verified EveryAyah reciters. Each folder was checked live
 * (HTTP 200, audio/mpeg) on 2026-11-19 before being listed here,
 * and re-checked 2026-11-21. The audio URL pattern is:
 *   https://everyayah.com/data/<folder>/<surah 3-digit><ayah 3-digit>.mp3
 * The reciter's name is always shown next to the player.
 *
 * `audioEdition` / `fallbackBitrate` drive the fallback audio URL
 * on cdn.islamic.network (same reciter, global ayah number).
 * Verified live 2026-11-21: 128 kbps works for Alafasy, Husary
 * and Maher Al-Muaiqly, but ar.abdulbasitmurattal returns 403 at
 * 128 kbps, so Abdul Basit's fallback is 64 kbps.
 */
export const RECITERS = [
  { id: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy', bitrate: '128 kbps', audioEdition: 'ar.alafasy', fallbackBitrate: 128 },
  { id: 'Abdul_Basit_Murattal_192kbps', name: 'Abdul Basit (Murattal)', bitrate: '192 kbps', audioEdition: 'ar.abdulbasitmurattal', fallbackBitrate: 64 },
  { id: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary', bitrate: '128 kbps', audioEdition: 'ar.husary', fallbackBitrate: 128 },
  { id: 'Maher_AlMuaiqly_64kbps', name: 'Maher Al-Muaiqly', bitrate: '64 kbps', audioEdition: 'ar.mahermuaiqly', fallbackBitrate: 128 },
] as const;

export function audioUrl(reciterId: string, surahNumber: number, ayahNumber: number): string {
  const surah = String(surahNumber).padStart(3, '0');
  const ayah = String(ayahNumber).padStart(3, '0');
  return `https://everyayah.com/data/${reciterId}/${surah}${ayah}.mp3`;
}

/**
 * Fallback audio URL for the same reciter on the AlQuran Cloud
 * CDN. Takes the GLOBAL ayah number (1..6236, `ayah.number` in
 * the API response), not the number within the surah. Unknown
 * reciter ids fall back to Alafasy rather than producing a
 * broken URL.
 */
export function audioFallbackUrl(reciterId: string, globalAyahNumber: number): string {
  const reciter = RECITERS.find((item) => item.id === reciterId) ?? RECITERS[0];
  if (!reciter) return audioUrl('Alafasy_128kbps', 1, 1);
  return `https://cdn.islamic.network/quran/audio/${reciter.fallbackBitrate}/${reciter.audioEdition}/${globalAyahNumber}.mp3`;
}
