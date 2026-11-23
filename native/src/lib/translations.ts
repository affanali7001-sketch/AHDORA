/**
 * Quran translations for the reader — fetched LIVE from AlQuran Cloud,
 * never bundled, never copied from Mihrab (AGPL).
 *
 * Source: AlQuran Cloud `GET /v1/surah/{n}/{edition}` (the same public
 * API AHDORA already uses for the Arabic text and the Urdu/English
 * editions). Every edition below was verified live 2026-11-23:
 * `GET /v1/surah/1/{edition}` returned HTTP 200, code 200, all 7
 * ayahs of Al-Fatiha, and the translator names below match the
 * `/v1/edition` record for that identifier.
 *
 * The Urdu tarjuma (ur.junagarhi) and its Shamshad Ali Khan voice
 * stay exactly as they are — this picker controls the SECOND
 * translation line under each ayah (English Saheeh International
 * by default, as before). Picking Urdu Jalandhry shows that
 * translation as the second line; the tarjuma voice still reads
 * Junagarhi, and the reader says so in the picker note.
 *
 * Caching: one AsyncStorage entry per surah per edition
 * (`ahdora:quran:translation:{edition}:{surah}`), plus an
 * in-memory map — the same pattern as src/lib/tajweed.ts. A failed
 * fetch never breaks the reader: the caller falls back to the
 * Arabic + Urdu above and shows the translation as unavailable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** One translation edition the reader can show. */
export type QuranTranslation = {
  /** AlQuran Cloud edition id — also the stored value. */
  id: string;
  /** Language the translation is in. */
  language: string;
  /** Translator / edition name (a proper noun — not translated). */
  translator: string;
  /** Right-to-left script (Urdu). */
  rtl?: boolean;
};

/**
 * All 14 translations Mihrab ships, offered here from the live
 * AlQuran Cloud API instead of bundled files. Ordered with the
 * ones AHDORA's readers will actually use first.
 */
export const QURAN_TRANSLATIONS: readonly QuranTranslation[] = [
  { id: 'en.sahih', language: 'English', translator: 'Saheeh International' },
  {
    id: 'en.pickthall',
    language: 'English',
    translator: 'Mohammed Marmaduke William Pickthall',
  },
  {
    id: 'hi.hindi',
    language: 'Hindi',
    translator: 'Suhel Farooq Khan & Saifur Rahman Nadwi',
  },
  {
    id: 'ur.jalandhry',
    language: 'Urdu',
    translator: 'Fateh Muhammad Jalandhry',
    rtl: true,
  },
  { id: 'bn.bengali', language: 'Bengali', translator: 'Muhiuddin Khan' },
  {
    id: 'id.indonesian',
    language: 'Indonesian',
    translator: 'Indonesian Ministry of Religious Affairs',
  },
  { id: 'tr.diyanet', language: 'Turkish', translator: 'Diyanet İşleri' },
  { id: 'fr.hamidullah', language: 'French', translator: 'Muhammad Hamidullah' },
  { id: 'de.bubenheim', language: 'German', translator: 'Bubenheim & Elyas' },
  { id: 'es.cortes', language: 'Spanish', translator: 'Julio Cortés' },
  { id: 'es.garcia', language: 'Spanish', translator: 'Isa García' },
  { id: 'ru.kuliev', language: 'Russian', translator: 'Elmir Kuliev' },
  { id: 'sv.bernstrom', language: 'Swedish', translator: 'Knut Bernström' },
  { id: 'zh.jian', language: 'Chinese', translator: 'Ma Jian' },
];

export const DEFAULT_QURAN_TRANSLATION_ID = 'en.sahih';

export function translationFor(id: string): QuranTranslation {
  return (
    QURAN_TRANSLATIONS.find((t) => t.id === id) ?? QURAN_TRANSLATIONS[0]!
  );
}

/* ------------------------- picked translation ------------------------- */

const TRANSLATION_STORAGE_KEY = 'ahdora:quran:translation';

/** Translation edition in use (persisted; Saheeh International until picked). */
let translationId = DEFAULT_QURAN_TRANSLATION_ID;

/** Current translation edition id (synchronous; loadQuranTranslation first restores the saved one). */
export function getQuranTranslationId(): string {
  return translationId;
}

/**
 * Restore the saved translation edition from AsyncStorage. Call once
 * at reader start; returns the edition id in use.
 */
export async function loadQuranTranslation(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(TRANSLATION_STORAGE_KEY);
    if (saved && QURAN_TRANSLATIONS.some((t) => t.id === saved)) {
      translationId = saved;
    }
  } catch {
    /* Default (Saheeh International) on any storage failure. */
  }
  return translationId;
}

/**
 * Pick the translation edition. Persisted in AsyncStorage and used
 * for the next page load, so switching never cuts the audio.
 */
export async function setQuranTranslation(id: string): Promise<void> {
  if (!QURAN_TRANSLATIONS.some((t) => t.id === id)) return;
  translationId = id;
  try {
    await AsyncStorage.setItem(TRANSLATION_STORAGE_KEY, id);
  } catch {
    /* In-memory choice still applies for this session. */
  }
}

/* ------------------------- per-surah fetch + cache ------------------------- */

export type TranslationAyah = {
  /** Global ayah number (1–6236) — the reader keys rows by this. */
  number: number;
  numberInSurah: number;
  text: string;
};

export type TranslationSurah = {
  surah: number;
  edition: string;
  ayahs: TranslationAyah[];
};

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const CACHE_KEY = (edition: string, surah: number): string =>
  `ahdora:quran:translation:${edition}:${surah}`;

const memoryCache = new Map<string, TranslationSurah>();

/**
 * Fetch one surah in one translation edition from AlQuran Cloud,
 * with AsyncStorage + in-memory caching. Never returns a partial
 * surah: the response must carry every ayah, or it throws and the
 * caller keeps the previous text / shows the translation as
 * unavailable.
 */
export async function fetchTranslationSurah(
  surahNumber: number,
  edition: string,
): Promise<TranslationSurah> {
  const key = CACHE_KEY(edition, surahNumber);
  const cached = memoryCache.get(key);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as TranslationSurah;
      if (
        parsed &&
        parsed.surah === surahNumber &&
        parsed.edition === edition &&
        Array.isArray(parsed.ayahs) &&
        parsed.ayahs.length > 0
      ) {
        memoryCache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    /* Cache read failure — fetch live instead. */
  }
  let response: Response;
  try {
    response = await fetch(`${ALQURAN_BASE}/surah/${surahNumber}/${edition}`, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Translation load nahi ho paya. Internet check karo.');
  }
  if (!response.ok) {
    throw new Error('Translation load nahi ho paya. Dobara try karo.');
  }
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    data?: {
      number?: number;
      numberOfAyahs?: number;
      ayahs?: { number?: number; numberInSurah?: number; text?: string }[];
    };
  } | null;
  const ayahs = payload?.data?.ayahs ?? [];
  const expected = payload?.data?.numberOfAyahs;
  if (
    !payload ||
    payload.code !== 200 ||
    ayahs.length === 0 ||
    (typeof expected === 'number' && ayahs.length !== expected)
  ) {
    throw new Error('Translation load nahi ho paya. Dobara try karo.');
  }
  const result: TranslationSurah = {
    surah: surahNumber,
    edition,
    ayahs: ayahs
      .filter(
        (a) => typeof a.number === 'number' && typeof a.text === 'string',
      )
      .map((a) => ({
        number: a.number as number,
        numberInSurah: a.numberInSurah ?? 0,
        text: (a.text as string).trim(),
      })),
  };
  memoryCache.set(key, result);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(result));
  } catch {
    /* In-memory cache still applies for this session. */
  }
  return result;
}
