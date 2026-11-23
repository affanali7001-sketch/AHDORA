/**
 * Quran Book — mushaf-style reader (THE centerpiece), rebuilt to the
 * approved preview (§10 landing, §11 reader).
 *
 * Real data only: Uthmani Arabic from AlQuran Cloud
 * (GET /v1/page/{n}, 1–604), Urdu translation text from the
 * Junagarhi edition, a second translation line the reader picks
 * (14 editions, live from AlQuran Cloud, Saheeh International by
 * default — see src/lib/translations.ts) + transliteration from
 * AlQuran Cloud (verified live 2026-11-22), continuous tilawat
 * audio from EveryAyah (Mishary Rashid Alafasy) with the AlQuran
 * Cloud CDN as fallback, and Urdu tarjuma audio from Shamshad Ali
 * Khan (ur.khan, Islamic Network CDN, 64 kbps) — see
 * src/lib/apiWorship.ts for the verification notes.
 *
 * Reading progress: ayahs opened today + daily target come from
 * the live API (/api/quran/history, /read, /target) and persist
 * per user. The server tracks AYAHS, not pages — so the big line
 * shows the real ayah count and the goal in ayahs, honestly
 * labelled. Page counts are never faked. Minutes are real time
 * spent in the reader this session. Nothing is invented.
 *
 * Tajweed colours (King Fahd Complex QPC V4 palette) come from the
 * public quran.com API v4 `text_uthmani_tajweed` — see
 * src/lib/tajweed.ts; the surah heading, ۝ ayah markers and the
 * full Tilawah player (src/components/TilawahPlayer.tsx) follow the
 * Mihrab-style presentation, rebuilt from scratch in AHDORA's own
 * code. Audio is unchanged: EveryAyah tilawat + Shamshad Ali Khan
 * Urdu tarjuma, tilawat → tarjuma → next-page chain intact.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScreenProps } from '../lib/nav';
import { takeQuranPageTarget, takeQuranSurahTarget } from '../lib/navTarget';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { useAppTheme } from '../lib/appTheme';
import { Chip, Field, Input, PillButton, Switch, TealHead } from '../components/ui';
import TilawahPlayer from '../components/TilawahPlayer';
import {
  fetchTajweedSurah,
  TAJWEED_FAMILIES,
  tajweedColour,
  type TajweedFamilyId,
  type TajweedSegment,
} from '../lib/tajweed';
import {
  DEFAULT_QURAN_TRANSLATION_ID,
  fetchTranslationSurah,
  loadQuranTranslation,
  QURAN_TRANSLATIONS,
  setQuranTranslation,
  translationFor,
} from '../lib/translations';
import {
  getQuranAudioState,
  loadQuranPlaybackPrefs,
  loadQuranReciter,
  subscribeQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';
import { fetchTafsir, type TafsirResult } from '../lib/tafsir';
import {
  ARABIC_SOURCE,
  URDU_AUDIO,
  URDU_TEXT_NAME,
  fetchMushafPage,
  fetchQuranDailyLog,
  fetchQuranHistory,
  fetchSurahFirstPage,
  fetchSurahList,
  fetchUrduPage,
  recordRead,
  type MushafAyah,
  type MushafPage,
  type MushafSurahRef,
  type QuranDayLogEntry,
  type QuranHistory,
  type UrduAyah,
} from '../lib/apiWorship';

const TOTAL_PAGES = 604;
const TAJWEED_TOGGLE_KEY = 'ahdora:quran:tajweed:on';
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
/* Preview-mandated mushaf colours (preview §11, .mushaf / .mushaf-text /
 * .ayah.playing) — the only hex values outside the foundation tokens. */
const MUSHAF_BG = '#FFFDF6';
const MUSHAF_INK = '#1C1A15';
const MUSHAF_BG_DARK = '#0A2E28';
const MUSHAF_INK_DARK = '#F2EFE6';
const PLAYING_BG = '#FFF4E6';

/** Render tajweed segments as coloured spans (plain ink for rule null). */
function TajweedSpans({ segments, dark }: { segments: TajweedSegment[]; dark: boolean }) {
  return (
    <>
      {segments.map((sg, i) => (
        <Text
          key={i}
          style={sg.rule ? { color: tajweedColour(sg.rule, dark) } : undefined}
        >
          {sg.text}
        </Text>
      ))}
    </>
  );
}

/** Shared-strings key for a tajweed family label. */
function tajweedFamilyLabelKey(
  family: TajweedFamilyId,
):
  | 'tajweedFamSilent'
  | 'tajweedFamGhunnah'
  | 'tajweedFamMadd'
  | 'tajweedFamQalqalah'
  | 'tajweedFamTafkheem' {
  switch (family) {
    case 'silent':
      return 'tajweedFamSilent';
    case 'ghunnah':
      return 'tajweedFamGhunnah';
    case 'madd':
      return 'tajweedFamMadd';
    case 'qalqalah':
      return 'tajweedFamQalqalah';
    case 'tafkheem':
      return 'tajweedFamTafkheem';
  }
}

const STRINGS: Record<
  AppLanguage,
  {
    todayRead: string;
    ayahsWord: string;
    minutesWord: string;
    goalWord: string;
    noReadingYet: string;
    lastRead: (surah: string, ayah: number) => string;
    continueBtn: string;
    note604: string;
    pageMarked: string;
    markFailed: string;
    loading: string;
    loadFailed: string;
    historyUnavailable: string;
    audioLoading: string;
    audioFailed: string;
    playerNote: string;
    urduNote: string;
    tilawatCredit: string;
    urduAudioCredit: string;
    tarjumaUnavailable: string;
    mecca: string;
    medina: string;
    aayatWord: string;
    paraWord: string;
    stopAudio: string;
    pageJumpPh: string;
    pageJumpGo: string;
    pageJumpInvalid: string;
    dailyLogTitle: string;
    readWord: string;
    listenedWord: string;
    notRead: string;
    notListened: string;
    todayWord: string;
    dailyLogUnavailable: string;
    autoPlay: string;
    autoPlayNote: string;
    reciterTitle: string;
    reciterNote: string;
    tafsirTitle: string;
    tafsirBtn: string;
    tafsirLoading: string;
    tafsirFailed: string;
    tafsirSource: (edition: string, source: string) => string;
    tafsirClose: string;
    translationTitle: string;
    translationNote: string;
    translationLoading: string;
    translationFailed: string;
  }
> = {
  en: {
    todayRead: 'Aaj kitna padha',
    ayahsWord: 'ayahs',
    minutesWord: 'minute',
    goalWord: 'Daily goal',
    noReadingYet: 'Nothing read today yet.',
    lastRead: (surah, ayah) => `Last read: Surah ${surah} · Ayah ${ayah}`,
    continueBtn: 'Continue from where you left off →',
    note604:
      'The whole book — all 604 pages, with continuous recitation and Urdu translation voice, from authorized sources.',
    pageMarked: 'Page marked as read.',
    markFailed: 'Could not save. Try again.',
    loading: 'Loading…',
    loadFailed: 'Page could not be loaded.',
    historyUnavailable: 'Log in and read — your progress will be saved in your account.',
    audioLoading: 'Audio is loading…',
    audioFailed: 'Audio could not play. Try again.',
    playerNote: 'No pause after an ayah — from Bismillah to the last ayah in one flow.',
    urduNote: 'Hear the meaning in Urdu — ayah by ayah, in the same flow.',
    tilawatCredit: 'Recitation: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu translation voice: Shamshad Ali Khan (Islamic Network)',
    tarjumaUnavailable:
      'Translation could not be loaded — the Arabic text above is complete.',
    mecca: 'Meccan',
    medina: 'Medinan',
    aayatWord: 'ayahs',
    paraWord: 'Para',
    stopAudio: 'Stop audio',
    pageJumpPh: 'Page no. (1–604)',
    pageJumpGo: 'Go',
    pageJumpInvalid: 'Enter a page number from 1 to 604.',
    dailyLogTitle: 'Daily log',
    readWord: 'Read',
    listenedWord: 'Listened',
    notRead: 'Not read',
    notListened: 'Not listened',
    todayWord: 'Today',
    dailyLogUnavailable: 'Log in to see your daily log.',
    autoPlay: 'Auto-play',
    autoPlayNote: 'Tilawat → Urdu tarjuma → next page, automatically. The page is marked as done.',
    reciterTitle: 'Reciter',
    reciterNote:
      'Applies from the next play. The Urdu tarjuma voice stays Shamshad Ali Khan.',
    tafsirTitle: 'Tafsir',
    tafsirBtn: 'Read tafsir',
    tafsirLoading: 'Loading tafsir…',
    tafsirFailed: 'Tafsir could not be loaded. Check your connection and try again.',
    tafsirSource: (edition, source) => `Source: ${edition} · ${source}`,
    tafsirClose: 'Close',
    translationTitle: 'Translation',
    translationNote:
      'Urdu (Junagarhi) above never changes — the tarjuma voice reads that. This picks the second translation line.',
    translationLoading: 'Loading translation…',
    translationFailed: 'Translation could not be loaded — the Urdu above is complete.',
  },
  hi: {
    todayRead: 'Aaj kitna padha',
    ayahsWord: 'ayahs',
    minutesWord: 'minute',
    goalWord: 'Roz ka goal',
    noReadingYet: 'Aaj abhi kuch padha nahi gaya.',
    lastRead: (surah, ayah) => `Aakhri padha: Surah ${surah} · Ayah ${ayah}`,
    continueBtn: 'Wahin se aage padho →',
    note604:
      'Poori kitaab — 604 pages, continuous tilawat aur Urdu tarjume ki voice ke saath, authorized sources se.',
    pageMarked: 'Page padha hua mark ho gaya.',
    markFailed: 'Save nahi ho paya. Dobara try karo.',
    loading: 'Load ho raha hai…',
    loadFailed: 'Page load nahi ho paya.',
    historyUnavailable: 'Login karke padho — progress aapke account me save hoga.',
    audioLoading: 'Audio load ho raha hai…',
    audioFailed: 'Audio nahi chal paya. Dobara try karo.',
    playerNote: 'Ek aayat ke baad rukawat nahi — Bismillah se aakhri aayat tak ek flow me.',
    urduNote: 'Urdu me ma’ani suno — aayat-dar-aayat, usi flow me.',
    tilawatCredit: 'Tilawat: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu tarjuma awaaz: Shamshad Ali Khan (Islamic Network)',
    tarjumaUnavailable: 'Tarjuma load nahi ho paya — upar wala Arabic text poora hai.',
    mecca: 'Makki',
    medina: 'Madani',
    aayatWord: 'aayat',
    paraWord: 'Para',
    stopAudio: 'Audio roko',
    pageJumpPh: 'Page no. (1–604)',
    pageJumpGo: 'Jao',
    pageJumpInvalid: '1 se 604 ke beech page number likho.',
    dailyLogTitle: 'Roz ka hisaab',
    readWord: 'Padha',
    listenedWord: 'Suna',
    notRead: 'Nahi padha',
    notListened: 'Nahi suna',
    todayWord: 'Aaj',
    dailyLogUnavailable: 'Roz ka hisaab dekhne ke liye login karo.',
    autoPlay: 'Auto-play',
    autoPlayNote: 'Tilawat → Urdu tarjuma → agla page, apne aap. Page padha hua mark ho jayega.',
    reciterTitle: 'Qari',
    reciterNote:
      'Agli baar play karne se lagega. Urdu tarjume ki awaaz Shamshad Ali Khan hi rahegi.',
    tafsirTitle: 'Tafsir',
    tafsirBtn: 'Tafsir padho',
    tafsirLoading: 'Tafsir load ho raha hai…',
    tafsirFailed: 'Tafsir load nahi ho paya. Internet check karke dobara try karo.',
    tafsirSource: (edition, source) => `Source: ${edition} · ${source}`,
    tafsirClose: 'Band karo',
    translationTitle: 'Tarjuma',
    translationNote:
      'Upar wala Urdu (Junagarhi) kabhi nahi badlega — tarjume ki awaaz wahi padhti hai. Ye dusri tarjuma line chunega.',
    translationLoading: 'Tarjuma load ho raha hai…',
    translationFailed: 'Tarjuma load nahi ho paya — upar wala Urdu poora hai.',
  },
};


const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(n: number): string {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' -> '22 Nov'. Returns the raw key if it does not parse. */
function fmtDayKey(dayKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return dayKey;
  const month = MONTH_SHORT[Number(m[2]) - 1] ?? '';
  return `${Number(m[3])} ${month}`;
}
/** Today's day key in the device's local timezone. */
function todayKeyLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** One mushaf page in a translation/transliteration edition. */
async function fetchEditionPage(
  page: number,
  edition: string,
): Promise<{ number: number; text: string }[]> {
  const response = await fetch(`${ALQURAN_BASE}/page/${page}/${edition}`, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Edition ${edition} failed`);
  const payload = (await response.json().catch(() => null)) as {
    code?: number;
    data?: { ayahs?: { number: number; text: string }[] };
  } | null;
  if (!payload || payload.code !== 200 || !payload.data?.ayahs) {
    throw new Error(`Edition ${edition} failed`);
  }
  return payload.data.ayahs;
}

export default function QuranBookScreen({
  lang,
  goTo,
  initialView = 'landing',
}: ScreenProps & { initialView?: 'landing' | 'reader' }) {
  const s = STRINGS[lang];
  const shared = stringsFor(lang);
  const [view, setView] = useState<'landing' | 'reader'>(initialView);
  const [page, setPage] = useState(1);
  const [pageJump, setPageJump] = useState('');
  const [pageJumpMsg, setPageJumpMsg] = useState<string | null>(null);
  const [mushaf, setMushaf] = useState<MushafPage | null>(null);
  const [pageLoading, setPageLoading] = useState(initialView === 'reader');
  const [pageError, setPageError] = useState<string | null>(null);

  const [history, setHistory] = useState<QuranHistory | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [markMsg, setMarkMsg] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [dailyLog, setDailyLog] = useState<QuranDayLogEntry[] | null>(null);
  const [dailyLogNote, setDailyLogNote] = useState<string | null>(null);

  const [surahs, setSurahs] = useState<MushafSurahRef[]>([]);
  const [surahQuery, setSurahQuery] = useState('');
  const [surahError, setSurahError] = useState<string | null>(null);

  // Tarjuma: always visible (no toggle). Urdu + transliteration +
  // a second translation line the reader picks (Saheeh International
  // by default — see src/lib/translations.ts). The Urdu (Junagarhi)
  // never changes: the tarjuma voice reads that edition.
  const [urduByGlobal, setUrduByGlobal] = useState<Map<number, string>>(new Map());
  const [translationByGlobal, setTranslationByGlobal] = useState<Map<number, string>>(
    new Map(),
  );
  const [translitByGlobal, setTranslitByGlobal] = useState<Map<number, string>>(new Map());
  const [tarjumaFailed, setTarjumaFailed] = useState(false);
  const [translationId, setTranslationId] = useState(DEFAULT_QURAN_TRANSLATION_ID);
  const translationIdRef = useRef(DEFAULT_QURAN_TRANSLATION_ID);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);
  const pickedTranslation = translationFor(translationId);

  // Audio lives in the GLOBAL player (src/lib/quranAudio) so it keeps
  // playing on other screens; this screen only mirrors its state.
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());
  useEffect(() => subscribeQuranAudio(setAudio), []);
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  // Audio <-> book sync: the book follows the voice (see the follow
  // effect below). A manual navigation or scroll pauses follow for
  // the ayah playing at that moment — it resumes by itself when
  // the recitation moves to the next ayah, or at once from the
  // player's "Follow" pill.
  const [followPausedAyah, setFollowPausedAyah] = useState<number | null>(null);
  const followPausedAyahRef = useRef<number | null>(null);
  // Scroll the playing ayah into view: each tarjuma row's Y,
  // measured when it lays out.
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const ayahRowY = useRef(new Map<number, number>());

  /** Pause auto-follow for the ayah playing right now. */
  function pauseFollow(): void {
    const a = audioRef.current;
    if (a.playing && a.mode !== null && a.playingAyah !== null) {
      followPausedAyahRef.current = a.playingAyah;
      setFollowPausedAyah(a.playingAyah);
    }
  }

  // Restore the saved tilawat reciter + playback prefs once
  // (defaults: Alafasy, 1x, repeat off, tajweed colours on).
  useEffect(() => {
    void loadQuranReciter();
    void loadQuranPlaybackPrefs();
    void loadQuranTranslation().then((id) => {
      translationIdRef.current = id;
      setTranslationId(id);
    });
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(TAJWEED_TOGGLE_KEY);
        if (saved === 'false') setTajweedOn(false);
      } catch {
        /* Default on — colours must never break the reader. */
      }
    })();
  }, []);

  // Tafsir panel: one ayah at a time, fetched on demand from
  // Quran.com Ibn Kathir (see src/lib/tafsir.ts) and cached offline.
  const [tafsirAyah, setTafsirAyah] = useState<MushafAyah | null>(null);
  const [tafsir, setTafsir] = useState<TafsirResult | null>(null);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState<string | null>(null);

  // Tajweed colours (quran.com v4, cached per surah — see
  // src/lib/tajweed.ts). Keyed `${surah}:${ayahInSurah}`. On by
  // default; the toggle persists on this phone. A failed fetch
  // falls back to the plain AlQuran Cloud text — never a blocker.
  const th = useAppTheme();
  const [tajweedOn, setTajweedOn] = useState(true);
  const [tajweedByKey, setTajweedByKey] = useState<Map<string, TajweedSegment[]>>(
    new Map(),
  );
  const [tajweedLoading, setTajweedLoading] = useState(false);
  const [tajweedFailed, setTajweedFailed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  // Translation (Urdu + English + transliteration) under each ayah:
  // visible by default, hideable from the player and the list head.
  const [showTranslation, setShowTranslation] = useState(true);

  const lastPageRef = useRef(1);
  const sessionOpenedRef = useRef(false);
  const bootedRef = useRef(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Session minutes: count real time spent on the reader. */
  useEffect(() => {
    if (view !== 'reader') return;
    const id = setInterval(() => setSessionSeconds((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [view]);

  const loadHistory = useCallback(async () => {
    try {
      const h = await fetchQuranHistory();
      if (mountedRef.current) {
        setHistory(h);
        setHistoryNote(null);
      }
      return h;
    } catch {
      // Not logged in (or offline): progress stays unavailable.
      if (mountedRef.current) setHistoryNote(s.historyUnavailable);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadHistory();
    fetchQuranDailyLog(7)
      .then((res) => {
        if (mountedRef.current) {
          setDailyLog(res.days);
          setDailyLogNote(null);
        }
      })
      .catch(() => {
        if (mountedRef.current) setDailyLogNote(s.dailyLogUnavailable);
      });
  }, [loadHistory]);

  useEffect(() => {
    // Surah index for the landing screen.
    fetchSurahList()
      .then((list) => {
        if (!mountedRef.current) return;
        setSurahs(list);
        // Search deep-link: open the surah the user picked in Search.
        const target = takeQuranSurahTarget();
        if (target !== null) {
          const su = list.find((x) => x.number === target);
          if (su) openSurah(su);
        }
      })
      .catch(() => {
        if (mountedRef.current) setSurahError(s.loadFailed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load the picked translation for the surahs on one page, from the
   * per-surah cache (see src/lib/translations.ts). Returns true when
   * at least one surah loaded; a failure never throws — the Urdu
   * above stays complete and the picker shows the failure note.
   */
  const loadTranslationForPage = useCallback(
    async (surahNumbers: number[], edition: string): Promise<boolean> => {
      setTranslationLoading(true);
      setTranslationFailed(false);
      const results = await Promise.allSettled(
        surahNumbers.map((sn) => fetchTranslationSurah(sn, edition)),
      );
      if (!mountedRef.current) return false;
      const next = new Map<number, string>();
      let ok = false;
      for (const res of results) {
        if (res.status === 'fulfilled') {
          ok = true;
          for (const a of res.value.ayahs) next.set(a.number, a.text);
        }
      }
      setTranslationByGlobal(next);
      setTranslationFailed(!ok);
      setTranslationLoading(false);
      return ok;
    },
    [],
  );

  /** Switch the picked translation (persisted) and reload this
   * page's second translation line. The Urdu above and the audio
   * are untouched. */
  function onTranslationPick(id: string): void {
    if (id === translationIdRef.current) return;
    translationIdRef.current = id;
    setTranslationId(id);
    void setQuranTranslation(id);
    if (!mushaf) return;
    const surahNumbers = [...new Set(mushaf.ayahs.map((a) => a.surah.number))];
    void loadTranslationForPage(surahNumbers, id);
  }

  const loadPage = useCallback(async (n: number) => {
    setPageLoading(true);
    setPageError(null);
    setTafsirAyah(null);
    setTafsir(null);
    setTafsirLoading(false);
    setTafsirError(null);
    setUrduByGlobal(new Map());
    setTranslationByGlobal(new Map());
    setTranslitByGlobal(new Map());
    setTarjumaFailed(false);
    setTranslationFailed(false);
    setTajweedByKey(new Map());
    setTajweedFailed(false);
    setTajweedLoading(false);
    try {
      const data = await fetchMushafPage(n);
      if (!mountedRef.current) return;
      setMushaf(data);
      setPage(n);
      lastPageRef.current = n;
      sessionOpenedRef.current = true;
      // Tarjuma (always visible): Urdu + transliteration + the
      // picked translation (per-surah cache). Each edition failing
      // on its own must not fail the page.
      const surahNumbers = [...new Set(data.ayahs.map((a) => a.surah.number))];
      const [urduRes, trRes] = await Promise.allSettled([
        fetchUrduPage(n),
        fetchEditionPage(n, 'en.transliteration'),
      ]);
      const translationOk = await loadTranslationForPage(
        surahNumbers,
        translationIdRef.current,
      );
      if (!mountedRef.current) return;
      let anyOk = translationOk;
      if (urduRes.status === 'fulfilled') {
        anyOk = true;
        setUrduByGlobal(new Map(urduRes.value.map((u: UrduAyah) => [u.number, u.text])));
      }
      if (trRes.status === 'fulfilled') {
        anyOk = true;
        setTranslitByGlobal(new Map(trRes.value.map((a) => [a.number, a.text])));
      }
      if (!anyOk) setTarjumaFailed(true);
      // Tajweed colours: one cached fetch per surah on this page
      // (quran.com v4). Independent of the tarjuma — if it fails,
      // the plain Arabic above stays complete.
      setTajweedLoading(true);
      const tajweedResults = await Promise.allSettled(
        surahNumbers.map((n) => fetchTajweedSurah(n)),
      );
      if (!mountedRef.current) return;
      const nextTajweed = new Map<string, TajweedSegment[]>();
      let tajweedOk = false;
      for (const res of tajweedResults) {
        if (res.status === 'fulfilled') {
          tajweedOk = true;
          for (const v of res.value.verses) {
            nextTajweed.set(`${res.value.surah}:${v.ayahInSurah}`, v.segments);
          }
        }
      }
      setTajweedByKey(nextTajweed);
      setTajweedFailed(!tajweedOk);
      setTajweedLoading(false);
    } catch (e) {
      if (mountedRef.current) {
        setPageError(e instanceof Error ? e.message : s.loadFailed);
      }
    } finally {
      if (mountedRef.current) setPageLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openReader = useCallback(
    (n: number, fromFollow = false) => {
      // A manual page turn pauses auto-follow for the ayah playing
      // now; a follow turn (the audio moving on) must not pause it.
      if (!fromFollow) pauseFollow();
      // Audio is global — opening another page does NOT stop it.
      setView('reader');
      void loadPage(n);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadPage],
  );

  /** Resume auto-follow at once (the player's "Follow" pill) —
   * jump back to the page the voice is on. */
  function resumeFollow(): void {
    followPausedAyahRef.current = null;
    setFollowPausedAyah(null);
    const a = audioRef.current;
    if (a.playing && a.mode !== null && a.page !== page) {
      openReader(a.page, true);
    }
  }

  /* Audio <-> book sync: when the recitation moves to another page,
     the book follows it — but only while audio is actually playing
     and follow is not paused for the ayah playing now. The pause
     clears itself the moment the recitation moves to the next ayah. */
  useEffect(() => {
    if (view !== 'reader') return;
    if (!audio.playing || audio.mode === null) return;
    if (
      followPausedAyahRef.current !== null &&
      audio.playingAyah === followPausedAyahRef.current
    ) {
      return;
    }
    if (followPausedAyahRef.current !== null) {
      followPausedAyahRef.current = null;
      setFollowPausedAyah(null);
    }
    if (audio.page !== page) {
      openReader(audio.page, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.playingAyah, audio.page, audio.playing, view, page]);

  /* Tarjuma sync: when the Urdu tarjuma voice is playing for this
     page, the tarjuma TEXT must be visible — never play tarjuma
     audio with the text hidden. The reader's own toggle can hide
     it again afterwards. */
  useEffect(() => {
    if (
      view === 'reader' &&
      audio.mode === 'urdu' &&
      audio.playing &&
      audio.page === page &&
      !showTranslation
    ) {
      setShowTranslation(true);
    }
  }, [audio.mode, audio.playing, audio.page, view, page, showTranslation]);

  /* Scroll the playing ayah into view while following. A manual
     scroll pauses follow (onScrollBeginDrag on the reader), so
     this never fights the user's finger. */
  useEffect(() => {
    if (view !== 'reader' || !audio.playing || audio.mode === null) return;
    if (
      followPausedAyahRef.current !== null &&
      audio.playingAyah === followPausedAyahRef.current
    ) {
      return;
    }
    if (audio.page !== page || audio.playingAyah === null) return;
    const y = ayahRowY.current.get(audio.playingAyah);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
    }
  }, [audio.playingAyah, audio.page, audio.playing, view, page]);

  /* 'reader' route (App.tsx): open at the last-read surah's first
   * page when history exists, else page 1. A Khatmah Continue target
   * (set by KhatmahScreen) wins over history: open at that page. */
  useEffect(() => {
    if (initialView !== 'reader' || bootedRef.current) return;
    bootedRef.current = true;
    const khatmahPage = takeQuranPageTarget();
    if (khatmahPage !== null && khatmahPage >= 1 && khatmahPage <= 604) {
      openReader(khatmahPage);
      return;
    }
    void (async () => {
      const h = await loadHistory();
      const last = latestEntry(h);
      if (!mountedRef.current) return;
      if (last) {
        try {
          const firstPage = await fetchSurahFirstPage(last.surahNumber);
          openReader(firstPage);
          return;
        } catch {
          // Fall through to page 1.
        }
      }
      openReader(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markPageRead(): Promise<void> {
    if (!mushaf || markBusy) return;
    setMarkBusy(true);
    setMarkMsg(null);
    try {
      // Record the furthest ayah of each surah on this page; the
      // server counts forward progress only.
      const furthest = new Map<number, number>();
      for (const a of mushaf.ayahs) {
        const prev = furthest.get(a.surah.number) ?? 0;
        if (a.numberInSurah > prev) furthest.set(a.surah.number, a.numberInSurah);
      }
      for (const [surahNumber, ayahNumber] of furthest) {
        await recordRead(surahNumber, ayahNumber);
      }
      const h = await fetchQuranHistory();
      if (mountedRef.current) {
        setHistory(h);
        setMarkMsg(s.pageMarked);
      }
    } catch {
      if (mountedRef.current) setMarkMsg(s.markFailed);
    } finally {
      if (mountedRef.current) setMarkBusy(false);
    }
  }

  async function continueReading(): Promise<void> {
    if (sessionOpenedRef.current) {
      openReader(lastPageRef.current);
      return;
    }
    const last = latestEntry(history);
    if (last) {
      try {
        const firstPage = await fetchSurahFirstPage(last.surahNumber);
        openReader(firstPage);
        return;
      } catch {
        // Fall through to page 1.
      }
    }
    openReader(1);
  }

  function openSurah(su: MushafSurahRef): void {
    void (async () => {
      try {
        const firstPage = await fetchSurahFirstPage(su.number);
        openReader(firstPage);
      } catch {
        openReader(1);
      }
    })();
  }

  /** Open the Tafsir panel for one ayah (fetched on demand, cached offline). */
  function openTafsir(a: MushafAyah): void {
    setTafsirAyah(a);
    setTafsir(null);
    setTafsirError(null);
    setTafsirLoading(true);
    void (async () => {
      try {
        const result = await fetchTafsir(a.surah.number, a.numberInSurah);
        if (!mountedRef.current) return;
        setTafsir(result);
      } catch (e) {
        if (!mountedRef.current) return;
        setTafsirError(e instanceof Error ? e.message : s.tafsirFailed);
      } finally {
        if (mountedRef.current) setTafsirLoading(false);
      }
    })();
  }

  function closeTafsir(): void {
    setTafsirAyah(null);
    setTafsir(null);
    setTafsirLoading(false);
    setTafsirError(null);
  }

  /** Tajweed colours on/off (persisted on this phone). */
  function onTajweedToggle(on: boolean): void {
    setTajweedOn(on);
    void AsyncStorage.setItem(TAJWEED_TOGGLE_KEY, on ? 'true' : 'false').catch(
      () => undefined,
    );
  }

  const filteredSurahs = surahs.filter((su) => {
    const q = surahQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      su.englishName.toLowerCase().includes(q) ||
      su.englishNameTranslation.toLowerCase().includes(q) ||
      String(su.number) === q
    );
  });

  const lastEntry = latestEntry(history);
  const lastSurahName = lastEntry
    ? (surahs.find((su) => su.number === lastEntry.surahNumber)?.englishName ??
      `Surah ${lastEntry.surahNumber}`)
    : null;
  const lastSurah = lastEntry
    ? surahs.find((su) => su.number === lastEntry.surahNumber) ?? null
    : null;
  const goalProgress =
    history && history.dailyTarget > 0
      ? Math.min(1, history.ayahsOpenedToday / history.dailyTarget)
      : 0;
  const sessionMinutes = Math.floor(sessionSeconds / 60);

  /* ------------------------------ Landing ------------------------------ */
  if (view === 'landing') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
        <Text style={T.title}>{shared.quranTitle}</Text>
        <Text style={T.sub}>{shared.quranSub}</Text>

        <TealHead style={styles.tealHead}>
          <Text style={styles.todayTitle}>{s.todayRead}</Text>
          {history ? (
            <>
              <Text style={styles.bigLine}>
                <Text style={styles.bigNum}>{history.ayahsOpenedToday}</Text>
                <Text style={styles.bigUnit}> {s.ayahsWord} </Text>
                <Text style={styles.bigMeta}>
                  · {sessionMinutes} {s.minutesWord} · {s.goalWord}: {history.dailyTarget}{' '}
                  {s.ayahsWord}
                </Text>
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${goalProgress * 100}%` }]}
                />
              </View>
              <Text style={styles.lastLine}>
                {lastEntry && lastSurahName
                  ? s.lastRead(lastSurahName, lastEntry.lastAyahNumber)
                  : s.noReadingYet}
              </Text>
            </>
          ) : (
            <Text style={styles.lastLine}>{historyNote ?? s.loading}</Text>
          )}
          <PillButton
            label={s.continueBtn}
            variant="peach"
            block
            onPress={() => void continueReading()}
          />
        </TealHead>
        {markMsg ? <Text style={styles.infoMsg}>{markMsg}</Text> : null}

        <Text style={styles.sectionTitle}>{s.dailyLogTitle}</Text>
        {dailyLog ? (
          <View style={styles.logCard}>
            {dailyLog.map((d) => {
              const isToday = d.dayKey === todayKeyLocal();
              const read = d.ayahsRead > 0;
              return (
                <View key={d.dayKey} style={styles.logRow}>
                  <Text style={[styles.logDate, isToday && styles.logDateToday]}>
                    {isToday ? s.todayWord : fmtDayKey(d.dayKey)}
                  </Text>
                  <Text style={[styles.logCell, read ? styles.logDone : styles.logMissed]}>
                    {read ? `✓ ${s.readWord} · ${d.ayahsRead}` : `✗ ${s.notRead}`}
                  </Text>
                  <Text
                    style={[styles.logCell, d.listened ? styles.logDone : styles.logMissed]}
                  >
                    {d.listened ? `✓ ${s.listenedWord}` : `✗ ${s.notListened}`}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={T.note}>{dailyLogNote ?? s.loading}</Text>
        )}

        <Text style={styles.sectionTitle}>{shared.indexTitle}</Text>
        <Field label={shared.quranSearchLbl}>
          <Input
            value={surahQuery}
            onChangeText={setSurahQuery}
            placeholder="e.g. Al-Kahf, 18…"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Field>
        <View style={styles.chipRow}>
          <Chip label={shared.quranAll} selected />
          {lastSurah ? (
            <Chip
              label={
                lang === 'hi'
                  ? `Aakhri padhi: ${lastSurah.englishName}`
                  : `Last read: ${lastSurah.englishName}`
              }
              onPress={() => openSurah(lastSurah)}
            />
          ) : null}
        </View>
        {surahError ? <Text style={T.error}>{surahError}</Text> : null}
        {filteredSurahs.map((su) => (
          <Pressable
            key={su.number}
            onPress={() => openSurah(su)}
            style={styles.surahRow}
            accessibilityRole="button"
          >
            <View style={styles.surahNum}>
              <Text style={styles.surahNumText}>{su.number}</Text>
            </View>
            <View style={styles.surahMeta}>
              <Text style={styles.surahName}>{su.englishName}</Text>
              <Text style={styles.surahSub}>
                {su.revelationType === 'Meccan' ? s.mecca : s.medina} ·{' '}
                {su.numberOfAyahs} {s.aayatWord}
              </Text>
            </View>
            <Text style={styles.surahArabic}>{su.name}</Text>
          </Pressable>
        ))}
        <Text style={T.note}>{s.note604}</Text>
        <Text style={T.note}>
          Source: {ARABIC_SOURCE}
        </Text>
      </ScrollView>
    );
  }

  /* ------------------------------ Reader ------------------------------ */
  // Group the page's ayahs by surah, in page order.
  const segments: { surah: MushafSurahRef; ayahs: MushafAyah[] }[] = [];
  if (mushaf) {
    for (const a of mushaf.ayahs) {
      const last = segments[segments.length - 1];
      if (last && last.surah.number === a.surah.number) {
        last.ayahs.push(a);
      } else {
        segments.push({ surah: a.surah, ayahs: [a] });
      }
    }
  }
  const firstSeg = segments[0];
  const firstAyah = mushaf?.ayahs[0];
  const readerSub =
    firstSeg && firstAyah
      ? `${firstSeg.surah.englishName} · ${
          firstSeg.surah.revelationType === 'Meccan' ? s.mecca : s.medina
        } · ${firstSeg.surah.numberOfAyahs} ${s.aayatWord} · ${s.paraWord} ${firstAyah.juz}`
      : null;

  return (
    <ScrollView
      ref={scrollRef}
      onScrollBeginDrag={pauseFollow}
      style={styles.scroll}
      contentContainerStyle={L.scroll}
    >
      <PillButton
        label={shared.readerBack}
        variant="ghost"
        small
        onPress={() => {
          // Audio is global — leaving the reader does NOT stop it.
          if (initialView === 'reader') {
            goTo('quran');
          } else {
            setView('landing');
            void loadHistory();
          }
        }}
      />
      <View style={styles.readerHead}>
        <Text style={T.h2}>Quran Book</Text>
        <View style={styles.pageTag}>
          <Text style={styles.pageTagText}>
            Page {page} / {TOTAL_PAGES}
          </Text>
        </View>
      </View>
      {readerSub ? <Text style={styles.readerSub}>{readerSub}</Text> : null}

      {/* Tilawah player at the TOP of the reader (user request
          2026-11-22): the play controls sit right under the page
          label, above the mushaf page — visible without scrolling.
          Full player: play/pause, prev/next ayah, seek bar, speed,
          repeat, sleep timer, reciter picker, auto-play, translation
          toggle — all wired to the global audio manager. */}
      <TilawahPlayer
        lang={lang}
        page={page}
        ayahs={mushaf?.ayahs ?? []}
        showTranslation={showTranslation}
        onTranslationChange={setShowTranslation}
        followPaused={followPausedAyah !== null}
        onFollowResume={resumeFollow}
        onOpenList={() => {
          if (initialView === 'reader') {
            goTo('quran');
          } else {
            setView('landing');
            void loadHistory();
          }
        }}
      />
      <Text style={T.note}>
        {s.urduAudioCredit} · {URDU_AUDIO.bitrate}
      </Text>

      {/* Next page right below the play controls (user request
          2026-11-22) — the same Next also sits below the mushaf
          page; this one is for turning the page without scrolling. */}
      {page < TOTAL_PAGES ? (
        <View style={{ marginTop: 12 }}>
          <PillButton
            label={shared.nextPage}
            variant="peach"
            block
            onPress={() => openReader(page + 1)}
          />
        </View>
      ) : null}

      {pageLoading ? (
        <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
      ) : pageError ? (
        <View style={styles.errorCard}>
          <Text style={T.error}>{pageError}</Text>
          <PillButton
            label={shared.retry}
            variant="primary"
            block
            onPress={() => void loadPage(page)}
          />
        </View>
      ) : mushaf ? (
        <>
          {/* Tajweed colours: on/off + legend (King Fahd palette). */}
          <View style={styles.tajweedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.autoTitle}>{shared.tajweedTitle}</Text>
              <Text style={styles.autoNote}>{shared.tajweedNote}</Text>
            </View>
            <Switch value={tajweedOn} onValueChange={onTajweedToggle} />
            <PillButton
              label={legendOpen ? shared.tajweedHideLegend : shared.tajweedLegend}
              small
              variant="ghost"
              onPress={() => setLegendOpen((v) => !v)}
            />
          </View>
          {tajweedLoading ? (
            <Text style={styles.audioLoading}>{shared.tajweedLoading}</Text>
          ) : null}
          {tajweedFailed && tajweedOn ? (
            <Text style={T.error}>{shared.tajweedFailed}</Text>
          ) : null}
          {legendOpen ? (
            <View style={styles.legendCard}>
              {TAJWEED_FAMILIES.map((fam) => (
                <View key={fam.family}>
                  <Text style={styles.legendFam}>
                    {shared[tajweedFamilyLabelKey(fam.family)]}
                  </Text>
                  {fam.rules.map((r) => (
                    <View key={r.id} style={styles.legendRow}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: tajweedColour(r.id, th.dark) },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {(shared as Record<string, string>)[`tajweedRule_${r.id}`] ??
                          r.id}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              <Text style={T.note}>{shared.tajweedTafkheemNote}</Text>
            </View>
          ) : null}

          <View style={[styles.mushaf, th.dark && styles.mushafDark]}>
            <View style={[styles.mushafInner, th.dark && styles.mushafInnerDark]}>
              <View style={styles.stripe} />
              <Text style={[styles.pageNo, th.dark && { color: '#A7C3B6' }]}>
                — {page} —
              </Text>
              {segments.map((seg) => {
                const startsHere = seg.ayahs[0]?.numberInSurah === 1;
                // Surah Al-Fatiha's ayah 1 IS the Bismillah: it is shown
                // as the separate Bismillah line, not again in the flow.
                const flowAyahs =
                  seg.surah.number === 1 && startsHere ? seg.ayahs.slice(1) : seg.ayahs;
                // Surah 1's Bismillah line, tajweed-coloured when on.
                const bismillahSegs =
                  seg.surah.number === 1 && tajweedOn
                    ? tajweedByKey.get('1:1')
                    : undefined;
                return (
                  <View key={`${seg.surah.number}-${seg.ayahs[0]?.numberInSurah ?? 0}`}>
                    {startsHere ? (
                      <View style={styles.bandOuter}>
                        <View style={[styles.surahBand, th.dark && styles.surahBandDark]}>
                          <Text
                            style={[
                              styles.surahBandArabic,
                              th.dark && { color: MUSHAF_INK_DARK },
                            ]}
                          >
                            ۞ {seg.surah.name} ۞
                          </Text>
                          <Text
                            style={[styles.surahBandMeta, th.dark && { color: '#A7C3B6' }]}
                          >
                            Surah {seg.surah.number} · {seg.surah.englishName} ·{' '}
                            {seg.surah.numberOfAyahs} {s.aayatWord} ·{' '}
                            {seg.surah.revelationType === 'Meccan' ? s.mecca : s.medina}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                    {startsHere && seg.surah.number !== 9 ? (
                      <Text style={[styles.bismillah, th.dark && { color: MUSHAF_INK_DARK }]}>
                        {bismillahSegs && bismillahSegs.length > 0 ? (
                          <TajweedSpans segments={bismillahSegs} dark={th.dark} />
                        ) : (
                          BISMILLAH
                        )}
                        {seg.surah.number === 1 ? (
                          <Text style={[styles.marker, th.dark && styles.markerDark]}>
                            {' '}۝ {toArabicIndic(1)}{' '}
                          </Text>
                        ) : null}
                      </Text>
                    ) : null}
                    <Text style={[styles.ayahFlow, th.dark && { color: MUSHAF_INK_DARK }]}>
                      {flowAyahs.map((a) => {
                        const segs = tajweedOn
                          ? tajweedByKey.get(`${a.surah.number}:${a.numberInSurah}`)
                          : undefined;
                        const playing = audio.playingAyah === a.number;
                        return (
                          <Text
                            key={a.number}
                            style={
                              playing
                                ? {
                                    backgroundColor: th.dark
                                      ? 'rgba(251,217,190,0.22)'
                                      : PLAYING_BG,
                                  }
                                : undefined
                            }
                          >
                            {segs && segs.length > 0 ? (
                              <TajweedSpans segments={segs} dark={th.dark} />
                            ) : (
                              a.text.trim()
                            )}{' '}
                            <Text style={[styles.marker, th.dark && styles.markerDark]}>
                              {' '}۝ {toArabicIndic(a.numberInSurah)}{' '}
                            </Text>{' '}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                );
              })}
              <View style={styles.stripe} />
              <View style={styles.mushafFoot}>
                <Text style={[styles.footText, th.dark && { color: '#A7C3B6' }]}>
                  PARA {firstAyah?.juz ?? ''}
                </Text>
                <Text style={[styles.footText, th.dark && { color: '#A7C3B6' }]}>
                  SURAH {firstSeg?.surah.englishName.toUpperCase() ?? ''}
                </Text>
                <Text style={[styles.footText, th.dark && { color: '#A7C3B6' }]}>
                  PAGE {page}
                </Text>
              </View>
            </View>
          </View>

          {/* Prev/Next + page jump directly below the page
              (user request 2026-11-22) — not at the bottom. */}
          <View style={styles.navRow}>
            <PillButton
              label={shared.prevPage}
              variant="ghost"
              disabled={page <= 1}
              onPress={() => page > 1 && openReader(page - 1)}
              style={styles.navBtn}
            />
            <PillButton
              label={shared.nextPage}
              variant="primary"
              disabled={page >= TOTAL_PAGES}
              onPress={() => page < TOTAL_PAGES && openReader(page + 1)}
              style={styles.navBtn}
            />
          </View>

          <View style={styles.jumpRow}>
            <Input
              value={pageJump}
              onChangeText={(t) => {
                setPageJump(t.replace(/[^0-9]/g, ''));
                setPageJumpMsg(null);
              }}
              placeholder={s.pageJumpPh}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.jumpInput}
            />
            <PillButton
              label={s.pageJumpGo}
              variant="primary"
              onPress={() => {
                const n = Number.parseInt(pageJump, 10);
                if (!Number.isFinite(n) || n < 1 || n > TOTAL_PAGES) {
                  setPageJumpMsg(s.pageJumpInvalid);
                  return;
                }
                setPageJumpMsg(null);
                setPageJump('');
                openReader(n);
              }}
            />
          </View>
          {pageJumpMsg ? <Text style={T.error}>{pageJumpMsg}</Text> : null}

          {/* Translation picker: 14 live AlQuran Cloud editions
              (see src/lib/translations.ts). The Urdu (Junagarhi)
              above never changes — this picks the second line only,
              and the tarjuma voice still reads Junagarhi. */}
          <View style={styles.translationRow}>
            <Text style={styles.autoTitle}>{s.translationTitle}</Text>
            <Text style={styles.autoNote}>{s.translationNote}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.translationChips}
            >
              {QURAN_TRANSLATIONS.map((t) => (
                <Chip
                  key={t.id}
                  label={`${t.language} · ${t.translator}`}
                  selected={translationId === t.id}
                  onPress={() => onTranslationPick(t.id)}
                />
              ))}
            </ScrollView>
            <Text style={styles.autoNote}>
              {pickedTranslation.language} — {pickedTranslation.translator}{' '}
              (AlQuran Cloud)
            </Text>
            {translationLoading ? (
              <Text style={styles.audioLoading}>{s.translationLoading}</Text>
            ) : null}
            {translationFailed ? (
              <Text style={T.error}>{s.translationFailed}</Text>
            ) : null}
          </View>

          <View style={styles.tarjumaHead}>
            <Text style={styles.sectionTitle}>{shared.rdTarjumaH}</Text>
            <PillButton
              label={
                showTranslation ? shared.tilawahHideTarjuma : shared.tilawahShowTarjuma
              }
              small
              variant="ghost"
              onPress={() => setShowTranslation((v) => !v)}
            />
          </View>
          {tarjumaFailed ? <Text style={T.error}>{s.tarjumaUnavailable}</Text> : null}
          {mushaf.ayahs.map((a) => (
            <View
              key={a.number}
              onLayout={(e) => {
                ayahRowY.current.set(a.number, e.nativeEvent.layout.y);
              }}
              style={[
                styles.ayahRow,
                audio.playingAyah === a.number && styles.ayahRowPlaying,
              ]}
            >
              <Text style={styles.ayahLabel}>
                Surah {a.surah.englishName} · Ayah {a.numberInSurah}
              </Text>
              <Text style={styles.ayahArabic}>{a.text.trim()}</Text>
              {showTranslation ? (
                <>
                  {translitByGlobal.get(a.number) ? (
                    <Text style={styles.translit}>{translitByGlobal.get(a.number)}</Text>
                  ) : null}
                  {urduByGlobal.get(a.number) ? (
                    <Text style={styles.urduText}>{urduByGlobal.get(a.number)}</Text>
                  ) : null}
                  {translationByGlobal.get(a.number) ? (
                    <Text
                      style={
                        pickedTranslation.rtl ? styles.urduText : styles.english
                      }
                    >
                      {translationByGlobal.get(a.number)}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <View style={styles.tafsirBtnRow}>
                <PillButton
                  label={s.tafsirBtn}
                  small
                  variant="ghost"
                  onPress={() => openTafsir(a)}
                />
              </View>
            </View>
          ))}

          {/* Tafsir panel for the selected ayah — real text only,
              always with its source/edition name (see src/lib/tafsir.ts). */}
          {tafsirAyah ? (
            <View style={styles.tafsirCard}>
              <Text style={styles.tafsirTitle}>
                {s.tafsirTitle} — Surah {tafsirAyah.surah.englishName} · Ayah{' '}
                {tafsirAyah.numberInSurah}
              </Text>
              {tafsir ? (
                <Text style={styles.tafsirSource}>
                  {s.tafsirSource(tafsir.edition.name, tafsir.edition.source)}
                </Text>
              ) : null}
              {tafsirLoading ? (
                <ActivityIndicator
                  color={C.teal500}
                  size="small"
                  style={styles.tafsirLoader}
                />
              ) : tafsirError ? (
                <>
                  <Text style={T.error}>{tafsirError}</Text>
                  <View style={styles.tafsirBtnRow}>
                    <PillButton
                      label={shared.retry}
                      small
                      variant="primary"
                      onPress={() => openTafsir(tafsirAyah)}
                    />
                  </View>
                </>
              ) : tafsir ? (
                <Text style={styles.tafsirText}>{tafsir.text}</Text>
              ) : null}
              <View style={styles.tafsirBtnRow}>
                <PillButton
                  label={s.tafsirClose}
                  small
                  variant="ghost"
                  onPress={() => closeTafsir()}
                />
              </View>
            </View>
          ) : null}

          <PillButton
            label={shared.markRead}
            variant="peach"
            block
            busy={markBusy}
            onPress={() => void markPageRead()}
          />
          {markMsg ? <Text style={styles.infoMsg}>{markMsg}</Text> : null}

          <Text style={styles.pageFooter}>
            Page {page} of {TOTAL_PAGES} · Surah {firstSeg?.surah.englishName ?? ''}
          </Text>
          <Text style={T.note}>Urdu text: {URDU_TEXT_NAME}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

function latestEntry(
  h: QuranHistory | null,
): { surahNumber: number; lastAyahNumber: number; lastReadAt: string } | null {
  if (!h || h.history.length === 0) return null;
  let best = h.history[0];
  for (const e of h.history) {
    if (best && e.lastReadAt > best.lastReadAt) best = e;
  }
  return best ?? null;
}


/** Reader view for the 'reader' route (App.tsx) — opens at the
 * last-read surah's first page, else page 1. */
export function QuranReaderScreen(props: ScreenProps) {
  return <QuranBookScreen {...props} initialView="reader" />;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  loader: { marginVertical: 40 },
  infoMsg: { fontFamily: F.sans, fontSize: 13, color: C.teal500, textAlign: 'center', marginTop: 10 },
  audioLoading: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: F.sans,
    fontSize: 16.5,
    fontWeight: '800',
    color: C.ink,
    marginTop: 20,
    marginBottom: 10,
  },
  errorCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginTop: 16,
  },
  /* ---- Landing ---- */
  tealHead: { marginTop: 14 },
  todayTitle: { fontFamily: F.sans, fontSize: 18, fontWeight: '800', color: C.white },
  bigLine: { marginTop: 10, marginBottom: 2 },
  bigNum: { fontFamily: F.sans, fontSize: 24, fontWeight: '800', color: C.white },
  bigUnit: { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.white },
  bigMeta: { fontFamily: F.sans, fontSize: 14, fontWeight: '600', color: C.navInactive },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: { height: 8, backgroundColor: C.peachMid, borderRadius: 999 },
  lastLine: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.navInactive,
    marginTop: 8,
    marginBottom: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: 6 },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  surahNum: {
    width: 38,
    height: 38,
    borderRadius: 10, // square badge (preview .surah-num)
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  surahNumText: { fontFamily: F.sans, fontSize: 15, fontWeight: '800', color: C.teal900 },
  surahMeta: { flex: 1 },
  surahName: { fontFamily: F.sans, fontSize: 16, fontWeight: '700', color: C.ink },
  surahSub: { fontFamily: F.sans, fontSize: 12, color: C.muted, marginTop: 2 },
  surahArabic: { fontFamily: F.arabic, fontSize: 20, color: C.teal900 },
  /* ---- Reader ---- */
  readerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  pageTag: {
    backgroundColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pageTagText: { fontFamily: F.sans, fontSize: 11, fontWeight: '800', color: C.peachInk },
  readerSub: { fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 4 },
  mushaf: {
    marginTop: 14,
    backgroundColor: MUSHAF_BG,
    borderWidth: 2.5,
    borderColor: C.teal900,
    borderRadius: 8,
    padding: 8,
    shadowColor: C.teal950,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  mushafInner: {
    borderWidth: 1.5,
    borderColor: C.teal700,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: MUSHAF_BG,
  },
  /* RN has no repeating-linear-gradient: a translucent teal bar is
   * the closest honest stand-in for the preview's stripe rows. */
  stripe: { height: 7, backgroundColor: 'rgba(11,74,65,0.16)', borderRadius: 3 },
  pageNo: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 4,
    color: C.teal700,
    textAlign: 'center',
    marginVertical: 10,
  },
  bandOuter: {
    borderWidth: 1,
    borderColor: C.teal700,
    padding: 3,
    marginHorizontal: 6,
  },
  surahBand: {
    borderWidth: 2,
    borderColor: C.teal900,
    backgroundColor: C.teal100,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  surahBandArabic: {
    fontFamily: F.arabic,
    fontSize: 25,
    lineHeight: 38,
    color: C.teal950,
    textAlign: 'center',
  },
  bismillah: {
    fontFamily: F.arabic,
    fontSize: 24,
    lineHeight: 46,
    color: MUSHAF_INK,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  ayahFlow: {
    fontFamily: F.arabic,
    fontSize: 23.5,
    lineHeight: 53, // 23.5 * 2.25
    color: MUSHAF_INK,
    textAlign: 'justify',
    marginVertical: 6,
  },
  marker: {
    fontFamily: F.arabic,
    fontSize: 14.5,
    color: C.teal700,
    backgroundColor: C.teal100,
    borderRadius: 13,
  },
  markerDark: { color: '#A7C3B6', backgroundColor: 'rgba(255,255,255,0.12)' },
  mushafDark: { backgroundColor: MUSHAF_BG_DARK, borderColor: '#155E4E' },
  mushafInnerDark: { backgroundColor: MUSHAF_BG_DARK, borderColor: '#155E4E' },
  surahBandDark: { backgroundColor: '#0E4A3E', borderColor: '#155E4E' },
  surahBandMeta: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    textAlign: 'center',
    marginTop: 4,
  },
  /* ---- Tajweed toggle + legend ---- */
  tajweedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 12,
  },
  translationRow: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 12,
    gap: 8,
  },
  translationChips: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  legendCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 12,
  },
  legendFam: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  legendDot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  legendText: { fontFamily: F.sans, fontSize: 13.5, color: C.ink },
  /* ---- Tarjuma list head ---- */
  tarjumaHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ayahLabel: {
    fontFamily: F.sans,
    fontSize: 12,
    fontWeight: '800',
    color: C.teal700,
    marginBottom: 4,
  },
  mushafFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.line,
    borderStyle: 'dashed',
    marginTop: 10,
    paddingTop: 8,
  },
  footText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.muted,
  },
  /* ---- Players ---- */
  player: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginTop: 16 },
  playerDark: {
    backgroundColor: C.teal900,
    shadowColor: C.teal950,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  playerLight: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
  },
  playerRow: { flexDirection: 'row', gap: 14 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playBtnPeach: { backgroundColor: C.peachMid },
  playBtnTeal: { backgroundColor: C.teal700 },
  playIcon: { fontSize: 20, textAlign: 'center' },
  playIconPeach: { color: C.peachText },
  playIconTeal: { color: C.white },
  playerBody: { flex: 1 },
  playerTitle: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '800', color: C.ink },
  playerTitleDark: { color: C.white },
  playerTrack: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 10, marginBottom: 6 },
  playerTrackDark: { backgroundColor: 'rgba(255,255,255,0.22)' },
  playerTrackLight: { backgroundColor: C.teal100 },
  playerFill: { height: 6, borderRadius: 999 },
  playerTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  playerTime: { fontFamily: F.sans, fontSize: 12, color: C.muted },
  playerTimeDark: { color: C.navInactive },
  playerNote: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  playerNoteDark: { color: C.navInactive },
  playerNoteLight: { color: C.muted },
  /* ---- Tarjuma list ---- */
  ayahRow: {
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  ayahRowPlaying: { backgroundColor: PLAYING_BG },
  ayahArabic: {
    fontFamily: F.arabic,
    fontSize: 25,
    lineHeight: 52,
    color: C.ink,
    textAlign: 'right',
  },
  translit: {
    fontFamily: F.sans,
    fontSize: 13.5,
    color: C.teal700,
    lineHeight: 21,
    marginTop: 6,
  },
  urduText: {
    fontSize: 15,
    lineHeight: 26,
    color: C.ink,
    textAlign: 'right',
    marginTop: 6,
  },
  english: {
    fontFamily: F.sans,
    fontSize: 13.5,
    color: C.muted,
    lineHeight: 21,
    marginTop: 3,
  },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  navBtn: { flex: 1 },
  /* ---- Reciter picker + Tafsir ---- */
  reciterRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 8 },
  tafsirBtnRow: { flexDirection: 'row', marginTop: 10 },
  tafsirCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 16,
  },
  tafsirTitle: {
    fontFamily: F.sans,
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },
  tafsirSource: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 4,
  },
  tafsirText: {
    fontFamily: F.sans,
    fontSize: 14.5,
    lineHeight: 23,
    color: C.ink,
    marginTop: 12,
  },
  tafsirLoader: { marginVertical: 16 },
  jumpRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  jumpInput: { flex: 1 },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 12,
  },
  autoTitle: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '700' as const, color: C.ink },
  autoNote: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  seekRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  logCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  logDate: { fontFamily: F.sans, fontSize: 13, color: C.muted, width: 64 },
  logDateToday: { color: C.teal700, fontWeight: '700' as const },
  logCell: { flex: 1, fontFamily: F.sans, fontSize: 13, textAlign: 'center' as const },
  logDone: { color: C.teal500 },
  logMissed: { color: C.red },
  pageFooter: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});
