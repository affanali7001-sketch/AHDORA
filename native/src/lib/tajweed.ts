/**
 * Tajweed-coloured mushaf text.
 *
 * Source: the PUBLIC quran.com API v4 — `text_uthmani_tajweed`
 * (GET /api/v4/quran/verses/uthmani_tajweed?chapter_number={n}).
 * Verified live 2026-11-23: HTTP 200, one verse per ayah, each
 * word's letters wrapped like `<tajweed class=ham_wasl>…</tajweed>`
 * (class unquoted) plus a `<span class=end>…</span>` ayah-number
 * marker that we drop (QuranBook renders its own ۝ marker).
 * Nothing here is copied from Mihrab (AGPL) — no bundled tajweed
 * JSON, no Mihrab code. The rule ids are quran.com's own ids, and
 * the colours are the King Fahd Complex QPC V4 palette — a public
 * standard from the printed mushaf, not Mihrab's invention.
 *
 * What the live API actually returns (sampled chapters 1, 2, 3, 9,
 * 18, 23, 36, 55, 67, 112, 114 on 2026-11-23):
 * - 17 classes appear. The API collapses both obligatory madds
 *   into ONE class, `madda_obligatory` (no mottasel/monfasel split
 *   in the markup); both split ids are still mapped to the same
 *   verified obligatory colour, so they colour correctly if the
 *   API ever returns them.
 * - `tafkheem` NEVER appears in the markup (Mihrab's rules.ts says
 *   the same: the font knows the word, the markup does not). Its
 *   colour is verified from the same palette and shown in the
 *   legend, but no letter is ever coloured for it — we never guess.
 * - `idgham_mutaqaribayn` is rare (5 spans in the sampled chapters)
 *   but real, so it stays in the table.
 * - Any class we do not recognise is left UNCOLOURED rather than
 *   guessed (parseTajweedText maps unknown classes to rule null).
 *
 * Hafs only — Warsh's extra rules are out of scope (AHDORA is Hafs).
 *
 * Caching: one AsyncStorage entry per surah
 * (`ahdora:quran:tajweed:{surah}`), plus an in-memory map, so a
 * surah's tajweed text is fetched once and then read offline.
 * A failed fetch never breaks the reader — the caller falls back
 * to the plain AlQuran Cloud text.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Hafs tajweed rule ids (quran.com's ids, plus the two obligatory
 * madd split ids for forward-compatibility — same colour). */
export type TajweedRuleId =
  | 'ham_wasl'
  | 'laam_shamsiyah'
  | 'slnt'
  | 'idgham_wo_ghunnah'
  | 'idgham_mutajanisayn'
  | 'idgham_mutaqaribayn'
  | 'ghunnah'
  | 'ikhafa'
  | 'idgham_ghunnah'
  | 'iqlab'
  | 'ikhafa_shafawi'
  | 'idgham_shafawi'
  | 'madda_normal'
  | 'madda_permissible'
  | 'madda_obligatory'
  | 'madda_obligatory_mottasel'
  | 'madda_obligatory_monfasel'
  | 'madda_necessary'
  | 'qalaqah'
  | 'tafkheem';

/** Families, in the order the legend lists them. */
export type TajweedFamilyId = 'silent' | 'ghunnah' | 'madd' | 'qalqalah' | 'tafkheem';

export type TajweedRule = {
  id: TajweedRuleId;
  family: TajweedFamilyId;
  /** King Fahd Complex QPC V4 palette: light page / dark page. */
  light: string;
  dark: string;
};

/* The QPC V4 palette entries (light, dark), verified against the
 * published palette: grey #a3a5a5/#999999, green #09b000/#26b55d,
 * madda_normal #ce9e00/#ffc1e0, madda_permissible #ff7b00/#ff8e3b,
 * madda_obligatory #f40000/#ff5e8e, madda_necessary #b50000/#e30000,
 * qalaqah #2fadff/#00deff, tafkheem #3f48e6/#3c84d5. */
const GREY: [string, string] = ['#a3a5a5', '#999999'];
const GREEN: [string, string] = ['#09b000', '#26b55d'];
const MADD_NORMAL: [string, string] = ['#ce9e00', '#ffc1e0'];
const MADD_PERMISSIBLE: [string, string] = ['#ff7b00', '#ff8e3b'];
const MADD_OBLIGATORY: [string, string] = ['#f40000', '#ff5e8e'];
const MADD_NECESSARY: [string, string] = ['#b50000', '#e30000'];
const QALAQAH: [string, string] = ['#2fadff', '#00deff'];
const TAFKHEEM: [string, string] = ['#3f48e6', '#3c84d5'];

function rule(
  id: TajweedRuleId,
  family: TajweedFamilyId,
  ink: [string, string],
): TajweedRule {
  return { id, family, light: ink[0], dark: ink[1] };
}

/** Every Hafs rule, grouped by family in legend order. */
export const TAJWEED_RULES: readonly TajweedRule[] = [
  // Grey: written, not sounded.
  rule('ham_wasl', 'silent', GREY),
  rule('laam_shamsiyah', 'silent', GREY),
  rule('slnt', 'silent', GREY),
  rule('idgham_wo_ghunnah', 'silent', GREY),
  rule('idgham_mutajanisayn', 'silent', GREY),
  rule('idgham_mutaqaribayn', 'silent', GREY),
  // Green: the hum.
  rule('ghunnah', 'ghunnah', GREEN),
  rule('ikhafa', 'ghunnah', GREEN),
  rule('idgham_ghunnah', 'ghunnah', GREEN),
  rule('iqlab', 'ghunnah', GREEN),
  rule('ikhafa_shafawi', 'ghunnah', GREEN),
  rule('idgham_shafawi', 'ghunnah', GREEN),
  // Madd: orange/red, by how long.
  rule('madda_normal', 'madd', MADD_NORMAL),
  rule('madda_permissible', 'madd', MADD_PERMISSIBLE),
  rule('madda_obligatory', 'madd', MADD_OBLIGATORY),
  rule('madda_obligatory_mottasel', 'madd', MADD_OBLIGATORY),
  rule('madda_obligatory_monfasel', 'madd', MADD_OBLIGATORY),
  rule('madda_necessary', 'madd', MADD_NECESSARY),
  // Blue: the bounce, and the heavy letter.
  rule('qalaqah', 'qalqalah', QALAQAH),
  rule('tafkheem', 'tafkheem', TAFKHEEM),
];

const BY_ID = new Map<TajweedRuleId, TajweedRule>(
  TAJWEED_RULES.map((r) => [r.id, r]),
);

export function tajweedRule(id: string): TajweedRule | undefined {
  return BY_ID.get(id as TajweedRuleId);
}

/** The rule's page ink for the theme the page is in. */
export function tajweedColour(id: TajweedRuleId, dark: boolean): string {
  const r = BY_ID.get(id);
  if (!r) return dark ? '#999999' : '#a3a5a5';
  return dark ? r.dark : r.light;
}

/** Legend order: families, each with its rules in table order. */
export const TAJWEED_FAMILIES: readonly {
  family: TajweedFamilyId;
  rules: readonly TajweedRule[];
}[] = (['silent', 'ghunnah', 'madd', 'qalqalah', 'tafkheem'] as const).map(
  (family) => ({
    family,
    rules: TAJWEED_RULES.filter((r) => r.family === family),
  }),
);

/** One coloured run of an ayah: `rule` null = plain ink. */
export type TajweedSegment = { text: string; rule: TajweedRuleId | null };

export type TajweedVerse = {
  ayahInSurah: number;
  segments: TajweedSegment[];
};

export type TajweedSurah = {
  surah: number;
  verses: TajweedVerse[];
};

const TAJWEED_BASE = 'https://api.quran.com/api/v4/quran/verses/uthmani_tajweed';
const CACHE_KEY = (surah: number): string => `ahdora:quran:tajweed:${surah}`;

const memoryCache = new Map<number, TajweedSurah>();

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Parse one `text_uthmani_tajweed` string into coloured segments.
 * Tags: `<tajweed class=X>…</tajweed>` (class quoted or unquoted)
 * and `<span class=end>…</span>` (ayah number — dropped, the reader
 * renders its own ۝ marker). Unknown classes → rule null (plain).
 * Never throws; a malformed string degrades to one plain segment.
 */
export function parseTajweedText(marked: string): TajweedSegment[] {
  const segments: TajweedSegment[] = [];
  if (!marked) return segments;
  const push = (text: string, ruleId: TajweedRuleId | null): void => {
    if (!text) return;
    const clean = decodeEntities(text.replace(/<[^>]*>/g, ''));
    if (!clean) return;
    const last = segments[segments.length - 1];
    if (last && last.rule === ruleId) {
      last.text += clean;
    } else {
      segments.push({ text: clean, rule: ruleId });
    }
  };
  try {
    const tagRe = /<(tajweed|span)\s+class=["']?([a-z_]+)["']?>([^<]*)<\/\1>/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(marked)) !== null) {
      if (m.index > lastIndex) {
        push(marked.slice(lastIndex, m.index), null);
      }
      const [, tag, cls, inner] = m;
      if (tag === 'tajweed') {
        // Unknown class → plain, never a guessed colour.
        push(inner ?? '', tajweedRule(cls ?? '') ? (cls as TajweedRuleId) : null);
      }
      // <span class=end>…</span> is dropped on purpose.
      lastIndex = tagRe.lastIndex;
    }
    if (lastIndex < marked.length) {
      push(marked.slice(lastIndex), null);
    }
  } catch {
    return marked
      ? [{ text: decodeEntities(marked.replace(/<[^>]*>/g, '')), rule: null }]
      : [];
  }
  // Trim the verse's outer whitespace only (inner word spaces stay).
  const first = segments[0];
  if (first) first.text = first.text.replace(/^\s+/, '');
  const last = segments[segments.length - 1];
  if (last) last.text = last.text.replace(/\s+$/, '');
  return segments.filter((s) => s.text.length > 0);
}

/**
 * Fetch one surah's tajweed-marked verses from quran.com v4, with
 * AsyncStorage + in-memory caching. The response returns every
 * verse by default (no pagination needed — chapter 2 returns all
 * 286). Never throws: on any failure it throws an Error the caller
 * catches and falls back to plain text.
 */
export async function fetchTajweedSurah(surahNumber: number): Promise<TajweedSurah> {
  const cached = memoryCache.get(surahNumber);
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY(surahNumber));
    if (raw) {
      const parsed = JSON.parse(raw) as TajweedSurah;
      if (parsed && parsed.surah === surahNumber && Array.isArray(parsed.verses)) {
        memoryCache.set(surahNumber, parsed);
        return parsed;
      }
    }
  } catch {
    /* Cache read failure — fetch live instead. */
  }
  let response: Response;
  try {
    response = await fetch(
      `${TAJWEED_BASE}?chapter_number=${surahNumber}`,
      {
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AHDORA/1.0 (Quran reader; tajweed colours)',
        },
      },
    );
  } catch {
    throw new Error('Tajweed colours load nahi ho paye. Internet check karo.');
  }
  if (!response.ok) {
    throw new Error('Tajweed colours load nahi ho paye. Dobara try karo.');
  }
  const payload = (await response.json().catch(() => null)) as {
    verses?: { verse_key?: string; text_uthmani_tajweed?: string }[];
  } | null;
  if (!payload || !Array.isArray(payload.verses)) {
    throw new Error('Tajweed colours load nahi ho paye. Dobara try karo.');
  }
  const verses: TajweedVerse[] = [];
  for (const v of payload.verses) {
    const key = v.verse_key ?? '';
    const ayahInSurah = Number.parseInt(key.split(':')[1] ?? '', 10);
    if (!Number.isFinite(ayahInSurah)) continue;
    verses.push({
      ayahInSurah,
      segments: parseTajweedText(v.text_uthmani_tajweed ?? ''),
    });
  }
  const result: TajweedSurah = { surah: surahNumber, verses };
  memoryCache.set(surahNumber, result);
  try {
    await AsyncStorage.setItem(CACHE_KEY(surahNumber), JSON.stringify(result));
  } catch {
    /* In-memory cache still applies for this session. */
  }
  return result;
}
