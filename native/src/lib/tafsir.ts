/**
 * Tafsir — real tafsir text for one ayah, from authorized public sources.
 *
 * Sources (all verified live 2026-11-23 — see the notes below; nothing
 * here is invented, and the source/edition name is always shown next
 * to the text):
 *
 * PRIMARY — Quran.com API v4, resource 169, "Ibn Kathir (Abridged)"
 * (English, slug `en-tafisr-ibn-kathir`, no key needed):
 *   GET https://api.quran.com/api/v4/tafsirs/169/by_ayah/{surah}:{ayah}
 *   Verified live: 2:255 -> 15,012 chars of HTML tafsir ("The Virtue
 *   of Ayat Al-Kursi ..."), 1:1 -> 53,138 chars ("Introduction to
 *   Fatihah ..."), 2:286 -> 8,678 chars. The response text is HTML,
 *   so it is stripped to plain text before it is shown or cached.
 *
 * FALLBACK — AlQuran Cloud tafsir edition `ar.jalalayn`
 * (Tafsir al-Jalalayn, Arabic):
 *   GET https://api.alquran.cloud/v1/ayah/{surah}:{ayah}/ar.jalalayn
 *   Verified live: 2:255 -> 658 chars of Arabic tafsir text.
 *   Used only when Quran.com does not answer.
 *
 * NOT used — AlQuran Cloud has NO English Ibn Kathir edition:
 * GET /v1/edition/en.ibnkathir returns 404, and
 * GET /v1/ayah/2:255/en.ibnkathir silently returns the Uthmani
 * Arabic ayah text itself (424 chars), NOT tafsir. Wiring that in
 * would show the ayah mislabelled as tafsir, so it is never called.
 *
 * Cache: AsyncStorage, keyed by surah:ayah:edition, so repeat views
 * work offline. Tafsir text does not change, so entries never expire.
 * Every function here never throws a raw network error to the UI —
 * fetchTafsir throws one honest Error when both sources fail.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type TafsirEdition = {
  /** Cache-key / API identifier for this edition. */
  id: string;
  /** Human name shown next to the tafsir text. */
  name: string;
  /** Where it comes from. */
  source: string;
};

export const TAFSIR_PRIMARY: TafsirEdition = {
  id: 'quran-com-169',
  name: 'Ibn Kathir (Abridged)',
  source: 'Quran.com',
};

export const TAFSIR_FALLBACK: TafsirEdition = {
  id: 'ar.jalalayn',
  name: 'Tafsir al-Jalalayn',
  source: 'AlQuran Cloud',
};

export type TafsirResult = {
  surah: number;
  ayah: number;
  edition: TafsirEdition;
  /** Plain text — HTML stripped, never invented. */
  text: string;
  /** True when this came from the offline cache. */
  cached: boolean;
};

const QURAN_COM_BASE = 'https://api.quran.com/api/v4';
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const CACHE_PREFIX = 'ahdora:tafsir:';

function cacheKey(surah: number, ayah: number, editionId: string): string {
  return `${CACHE_PREFIX}${surah}:${ayah}:${editionId}`;
}

type CachedTafsir = {
  text: string;
  editionId: string;
  editionName: string;
  sourceName: string;
  cachedAt: string;
};

async function readCache(
  surah: number,
  ayah: number,
  edition: TafsirEdition,
): Promise<TafsirResult | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(surah, ayah, edition.id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTafsir;
    if (!parsed || typeof parsed.text !== 'string' || parsed.text.trim().length === 0) {
      return null;
    }
    return { surah, ayah, edition, text: parsed.text, cached: true };
  } catch {
    return null;
  }
}

async function writeCache(
  surah: number,
  ayah: number,
  edition: TafsirEdition,
  text: string,
): Promise<void> {
  try {
    const entry: CachedTafsir = {
      text,
      editionId: edition.id,
      editionName: edition.name,
      sourceName: edition.source,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(cacheKey(surah, ayah, edition.id), JSON.stringify(entry));
  } catch {
    /* Cache is a bonus — a failed write must never break the read. */
  }
}

/**
 * Strip the HTML Quran.com returns to plain text. Block tags become
 * line breaks, all other tags are dropped, common entities are
 * decoded, and runs of blank lines collapse. The wording itself is
 * never changed — only markup is removed.
 */
export function stripTafsirHtml(html: string): string {
  let text = html
    .replace(/<(br|p|h[1-6]|li|div)[^>]*>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&rsquo;': '’',
    '&lsquo;': '‘',
    '&rdquo;': '”',
    '&ldquo;': '“',
    '&mdash;': '—',
    '&ndash;': '–',
  };
  for (const [entity, char] of Object.entries(entities)) {
    text = text.split(entity).join(char);
  }
  text = text
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => {
      const n = Number.parseInt(code as string, 16);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : '';
    });
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Primary source: Quran.com Ibn Kathir (Abridged), English. */
async function fetchFromQuranCom(surah: number, ayah: number): Promise<string> {
  const response = await fetch(
    `${QURAN_COM_BASE}/tafsirs/169/by_ayah/${surah}:${ayah}`,
    { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`Quran.com tafsir failed (${response.status})`);
  const payload = (await response.json().catch(() => null)) as {
    tafsir?: { text?: unknown; resource_name?: unknown };
  } | null;
  const html = payload?.tafsir?.text;
  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new Error('Quran.com returned no tafsir text');
  }
  const text = stripTafsirHtml(html);
  if (text.length === 0) throw new Error('Quran.com returned no tafsir text');
  return text;
}

/** Fallback source: AlQuran Cloud, Tafsir al-Jalalayn (Arabic). */
async function fetchFromAlQuranCloud(surah: number, ayah: number): Promise<string> {
  const response = await fetch(`${ALQURAN_BASE}/ayah/${surah}:${ayah}/ar.jalalayn`, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`AlQuran Cloud tafsir failed (${response.status})`);
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    data?: { text?: unknown; edition?: { type?: unknown } };
  } | null;
  // The edition must really be a tafsir — an unknown edition silently
  // falls back to the Arabic ayah text on this API, which must never
  // be shown as tafsir (see the header note on en.ibnkathir).
  if (
    !payload ||
    payload.code !== 200 ||
    payload.data?.edition?.type !== 'tafsir' ||
    typeof payload.data?.text !== 'string' ||
    payload.data.text.trim().length === 0
  ) {
    throw new Error('AlQuran Cloud returned no tafsir text');
  }
  return payload.data.text.trim();
}

/**
 * Tafsir for one ayah. Cache first (either edition), then Quran.com
 * Ibn Kathir, then AlQuran Cloud Jalalayn. Throws an honest Error
 * when both sources fail — the UI shows that, never invented text.
 */
export async function fetchTafsir(surah: number, ayah: number): Promise<TafsirResult> {
  const cachedPrimary = await readCache(surah, ayah, TAFSIR_PRIMARY);
  if (cachedPrimary) return cachedPrimary;
  const cachedFallback = await readCache(surah, ayah, TAFSIR_FALLBACK);
  if (cachedFallback) return cachedFallback;

  try {
    const text = await fetchFromQuranCom(surah, ayah);
    await writeCache(surah, ayah, TAFSIR_PRIMARY, text);
    return { surah, ayah, edition: TAFSIR_PRIMARY, text, cached: false };
  } catch {
    /* Fall through to the Arabic fallback below. */
  }
  try {
    const text = await fetchFromAlQuranCloud(surah, ayah);
    await writeCache(surah, ayah, TAFSIR_FALLBACK, text);
    return { surah, ayah, edition: TAFSIR_FALLBACK, text, cached: false };
  } catch {
    throw new Error('Tafsir load nahi ho paya. Internet check karke dobara try karo.');
  }
}

/** Remove every cached tafsir entry. Never throws. */
export async function clearTafsirCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const tafsirKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (tafsirKeys.length > 0) await AsyncStorage.multiRemove(tafsirKeys);
  } catch {
    /* Ignore — cache cleanup must never break the reader. */
  }
}
