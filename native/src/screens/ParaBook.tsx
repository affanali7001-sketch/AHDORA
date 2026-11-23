/**
 * 30 Para (Juz) Book — the Quran as a real book, split into its 30 parts.
 *
 * The page-based Quran Book stays as it is; this is a SEPARATE section
 * for reading para-by-para, the way the Quran is read over a month.
 * The reader is a real book: a horizontal paging view where each page
 * is one mushaf page (Uthmani Arabic, ornate border, surah heading
 * band) and swiping left/right FLIPS the page like turning a book.
 * Tarjuma (Urdu + English + transliteration) sits under each page,
 * and audio uses the GLOBAL manager (src/lib/quranAudio.ts) — tilawat
 * + Urdu tarjuma voice, with the same auto-play chain as the Quran
 * Book (tilawat -> tarjuma -> next page -> mark read). No second
 * player is built here.
 *
 * Real data only: Uthmani Arabic + tarjuma from AlQuran Cloud,
 * audio from EveryAyah / Islamic Network (see src/lib/apiWorship.ts).
 * The 30 Juz page ranges below were VERIFIED live 2026-11-22 against
 * AlQuran Cloud GET /v1/juz/{n} (Uthmani edition): each Juz's min/max
 * `page` over its ayahs. Ranges OVERLAP at Juz boundaries (a boundary
 * ayah falls mid-page — e.g. page 62 belongs to both Juz 3 and Juz 4);
 * that is the real Madani mushaf, not an error. Juz names are the
 * standard South Asian Para names, confirmed against public Juz
 * listings (ayahdailyapp / quransarif / quranvocab).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { PillButton } from '../components/ui';
import TilawahPlayer from '../components/TilawahPlayer';
import {
  getQuranAudioState,
  subscribeQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';
import {
  ARABIC_SOURCE,
  URDU_AUDIO,
  URDU_TEXT_NAME,
  fetchMushafPage,
  fetchUrduPage,
  recordRead,
  type MushafAyah,
  type MushafPage,
  type MushafSurahRef,
  type UrduAyah,
} from '../lib/apiWorship';

const TOTAL_PAGES = 604;
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
/* Same mushaf colours as QuranBook (Mihrab palette) — the only hex
 * values outside the foundation tokens. */
const MUSHAF_BG = '#FFFFFF';
const MUSHAF_INK = '#191814';
const PLAYING_BG = '#E2EEEA';

export type JuzInfo = {
  number: number;
  name: string;
  arabic: string;
  startPage: number;
  endPage: number;
};

/** The 30 Juz — page ranges VERIFIED live against /v1/juz/{n} (see header). */
export const JUZ: JuzInfo[] = [
  { number: 1, name: 'Alif Lam Meem', arabic: 'الم', startPage: 1, endPage: 21 },
  { number: 2, name: 'Sayaqulu', arabic: 'سيقول', startPage: 22, endPage: 41 },
  { number: 3, name: "Tilka 'r-Rusul", arabic: 'تلك الرسل', startPage: 42, endPage: 62 },
  { number: 4, name: 'Lan Tanalu', arabic: 'لن تنالوا', startPage: 62, endPage: 81 },
  { number: 5, name: "Wa'l-Muhsanat", arabic: 'والمحصنات', startPage: 82, endPage: 101 },
  { number: 6, name: 'La Yuhibbullah', arabic: 'لا يحب الله', startPage: 102, endPage: 121 },
  { number: 7, name: "Wa Idha Sami'u", arabic: 'وإذا سمعوا', startPage: 121, endPage: 141 },
  { number: 8, name: 'Wa Lau Annana', arabic: 'ولو أننا', startPage: 142, endPage: 161 },
  { number: 9, name: "Qal al-Mala'u", arabic: 'قال الملأ', startPage: 162, endPage: 181 },
  { number: 10, name: "Wa'lamu", arabic: 'واعلموا', startPage: 182, endPage: 201 },
  { number: 11, name: "Ya'tadhirun", arabic: 'يعتذرون', startPage: 201, endPage: 221 },
  { number: 12, name: "Wa Mamin Da'bbah", arabic: 'وما من دابة', startPage: 222, endPage: 241 },
  { number: 13, name: "Wa Ma Ubarri'u", arabic: 'وما أبرئ', startPage: 242, endPage: 261 },
  { number: 14, name: 'Rubama', arabic: 'ربما', startPage: 262, endPage: 281 },
  { number: 15, name: 'Subhanalladhi', arabic: 'سبحان الذي', startPage: 282, endPage: 301 },
  { number: 16, name: 'Qal Alam', arabic: 'قال ألم', startPage: 302, endPage: 321 },
  { number: 17, name: 'Iqtaraba', arabic: 'اقترب', startPage: 322, endPage: 341 },
  { number: 18, name: 'Qad Aflaha', arabic: 'قد أفلح', startPage: 342, endPage: 361 },
  { number: 19, name: 'Wa Qalalladhina', arabic: 'وقال الذين', startPage: 362, endPage: 381 },
  { number: 20, name: 'Amman Khalaqa', arabic: 'أمن خلق', startPage: 382, endPage: 401 },
  { number: 21, name: 'Utlu Ma Uhiya', arabic: 'اتل ما أوحي', startPage: 402, endPage: 421 },
  { number: 22, name: 'Wa Manyaqnut', arabic: 'ومن يقنت', startPage: 422, endPage: 441 },
  { number: 23, name: 'Wa Mali', arabic: 'وما لي', startPage: 442, endPage: 461 },
  { number: 24, name: 'Faman Azlam', arabic: 'فمن أظلم', startPage: 462, endPage: 481 },
  { number: 25, name: 'Ilaihi Yuraddu', arabic: 'إليه يرد', startPage: 482, endPage: 502 },
  { number: 26, name: 'Ha Meem', arabic: 'حم', startPage: 502, endPage: 521 },
  { number: 27, name: 'Qal Fama Khatbukum', arabic: 'قال فما خطبكم', startPage: 522, endPage: 541 },
  { number: 28, name: "Qad Sami'allah", arabic: 'قد سمع الله', startPage: 542, endPage: 561 },
  { number: 29, name: 'Tabarakalladhi', arabic: 'تبارك الذي', startPage: 562, endPage: 581 },
  { number: 30, name: 'Amma', arabic: 'عم', startPage: 582, endPage: 604 },
];

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
function toArabicIndic(n: number): string {
  return String(n)
    .split('')
    .map((d) => ARABIC_INDIC[Number(d)] ?? d)
    .join('');
}

/** One mushaf page in a translation/transliteration edition (same as QuranBook). */
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

const STRINGS: Record<
  AppLanguage,
  {
    listSub: string;
    note30: string;
    pageInPara: (i: number, n: number) => string;
    paraComplete: string;
    paraCompleteBody: (n: number) => string;
    nextParaBtn: (n: number) => string;
    allDone: string;
    backToList: string;
    loading: string;
    loadFailed: string;
    pageMarked: string;
    markFailed: string;
    tarjumaUnavailable: string;
    autoPlay: string;
    autoPlayNote: string;
    stopAudio: string;
    playTilawat: string;
    playTarjuma: string;
    stopBtn: string;
    audioLoading: string;
    playerNote: string;
    urduNote: string;
    tilawatCredit: string;
    urduAudioCredit: string;
    mecca: string;
    medina: string;
    aayatWord: string;
    paraWord: string;
  }
> = {
  en: {
    listSub:
      'One para a day — read the Quran like a real book, page by page, flipping each page.',
    note30:
      'All 30 Para — the whole Quran, 604 pages, in the real book order. Tap a para to open it.',
    pageInPara: (i, n) => `Page ${i} of ${n}`,
    paraComplete: 'Para complete ✓',
    paraCompleteBody: (n) => `You finished Para ${n}. Continue to the next Para.`,
    nextParaBtn: (n) => `Open Para ${n} →`,
    allDone: 'Alhamdulillah — you finished all 30 Para.',
    backToList: '← 30 Para',
    loading: 'Loading…',
    loadFailed: 'Page could not be loaded.',
    pageMarked: 'Page marked as read.',
    markFailed: 'Could not save. Try again.',
    tarjumaUnavailable:
      'Translation could not be loaded — the Arabic text above is complete.',
    autoPlay: 'Auto-play',
    autoPlayNote: 'Tilawat → Urdu tarjuma → next page, automatically',
    stopAudio: 'Stop audio',
    playTilawat: '▶ Tilawat suno',
    playTarjuma: '▶ Tarjuma suno',
    stopBtn: '■ Roko',
    audioLoading: 'Audio is loading…',
    playerNote: 'No pause after an ayah — from Bismillah to the last ayah in one flow.',
    urduNote: 'Hear the meaning in Urdu — ayah by ayah, in the same flow.',
    tilawatCredit: 'Recitation: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu translation voice: Shamshad Ali Khan (Islamic Network)',
    mecca: 'Meccan',
    medina: 'Medinan',
    aayatWord: 'ayahs',
    paraWord: 'Para',
  },
  hi: {
    listSub:
      'Roz ek para — Quran ko asli kitaab ki tarah padho, page-by-page, har page palat kar.',
    note30:
      'Poore 30 paare — poora Quran, 604 pages, asal kitaab ki tartib me. Para kholne ke liye dabao.',
    pageInPara: (i, n) => `Page ${i} / ${n}`,
    paraComplete: 'Para poora ho gaya ✓',
    paraCompleteBody: (n) => `Aapne Para ${n} poora kar liya. Agle Para par jaari rakho.`,
    nextParaBtn: (n) => `Para ${n} kholo →`,
    allDone: 'Alhamdulillah — aapne 30 paare poore kar liye.',
    backToList: '← 30 Paare',
    loading: 'Load ho raha hai…',
    loadFailed: 'Page load nahi ho paya.',
    pageMarked: 'Page padha hua mark ho gaya.',
    markFailed: 'Save nahi ho paya. Dobara try karo.',
    tarjumaUnavailable:
      'Tarjuma load nahi ho paya — upar wala Arabic text poora hai.',
    autoPlay: 'Auto-play',
    autoPlayNote: 'Tilawat → Urdu tarjuma → agla page, apne aap',
    stopAudio: 'Audio roko',
    playTilawat: '▶ Tilawat suno',
    playTarjuma: '▶ Tarjuma suno',
    stopBtn: '■ Roko',
    audioLoading: 'Audio load ho raha hai…',
    playerNote: 'Ek aayat ke baad rukawat nahi — Bismillah se aakhri aayat tak ek flow me.',
    urduNote: 'Urdu me ma’ani suno — aayat-dar-aayat, usi flow me.',
    tilawatCredit: 'Tilawat: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu tarjuma awaaz: Shamshad Ali Khan (Islamic Network)',
    mecca: 'Makki',
    medina: 'Madani',
    aayatWord: 'aayat',
    paraWord: 'Para',
  },
};

type PageCacheEntry = {
  mushaf?: MushafPage;
  urdu?: Map<number, string>;
  english?: Map<number, string>;
  translit?: Map<number, string>;
  tarjumaFailed?: boolean;
  error?: string;
};

export default function ParaBookScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const shared = stringsFor(lang);
  const { width: pageWidth, height: winHeight } = useWindowDimensions();
  // The book gets a GUARANTEED height (55% of the screen, at least
  // 400dp): the old flex:1 book was squeezed to ~0 by the ~350dp
  // player above it, so the mushaf page vanished and only the music
  // showed. The leaf turns around the book's own left edge, so its
  // width is the book width (screen minus the reader's side padding),
  // not the full screen width.
  const bookHeight = Math.max(400, Math.round(winHeight * 0.55));
  const bookWidth = pageWidth - S.pad * 2;
  const [view, setView] = useState<'list' | 'reader'>('list');
  const [juz, setJuz] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [cache, setCache] = useState<Record<number, PageCacheEntry>>({});
  const [markMsg, setMarkMsg] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [paraDone, setParaDone] = useState(false);
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());

  const cacheRef = useRef<Record<number, PageCacheEntry>>({});
  const loadingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);
  const indexRef = useRef(0);
  const juzRef = useRef<number | null>(null);
  const viewRef = useRef<'list' | 'reader'>('list');
  const lastAudioPageRef = useRef(audio.page);

  // --- Real page-turn state ---
  // A flip is { from, to, dir }: the leaf (the `from` page going
  // forward, the `to` page coming back) rotates around the book's
  // left edge (the spine) while the under-page sits beneath it.
  // `flipProgress` 0 = leaf flat on the right, 1 = leaf flat on
  // the left. Forward: 0 -> 1. Backward: 1 -> 0.
  type FlipState = { from: number; to: number; dir: 1 | -1 };
  const [flip, setFlip] = useState<FlipState | null>(null);
  const flipProgress = useRef(new Animated.Value(0)).current;
  const flippingRef = useRef(false);

  // The leaf's rotateY, pivoted on its left edge: translate the
  // leaf left by half its width (so the spine sits at the origin),
  // rotate, then translate back. Perspective makes it read as 3D.
  const leafRotateY = useMemo(
    () =>
      flipProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '-180deg'],
      }),
    [flipProgress],
  );
  const leafTransform = useMemo(
    () => [
      { perspective: 900 },
      { translateX: -bookWidth / 2 },
      { rotateY: leafRotateY },
      { translateX: bookWidth / 2 },
    ],
    [bookWidth, leafRotateY],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Global audio state (the manager owns playback; this screen only mirrors it).
  useEffect(() => subscribeQuranAudio(setAudio), []);
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  // Audio <-> book sync (same rule as the Quran Book): the book
  // follows the voice, but a manual page turn or swipe pauses
  // follow for the ayah playing at that moment — it resumes by
  // itself when the recitation moves to the next ayah, or at once
  // from the player's "Follow" pill.
  const [followPausedAyah, setFollowPausedAyah] = useState<number | null>(null);
  const followPausedAyahRef = useRef<number | null>(null);
  // Tarjuma text: visible by default (as before); the player can
  // hide it — and the tarjuma-sync effect below forces it back
  // on while the tarjuma voice plays.
  const [showTranslation, setShowTranslation] = useState(true);
  // Scroll the playing ayah into view: the current page's
  // ScrollView + each tarjuma row's Y, measured when it lays out.
  const pageScrollRef = useRef<ScrollViewInstance | null>(null);
  const ayahRowY = useRef(new Map<number, number>());

  /** Pause auto-follow for the ayah playing right now. */
  function pauseFollow(): void {
    const a = audioRef.current;
    if (a.playing && a.mode !== null && a.playingAyah !== null) {
      followPausedAyahRef.current = a.playingAyah;
      setFollowPausedAyah(a.playingAyah);
    }
  }

  /** Resume auto-follow at once (the player's "Follow" pill). */
  function resumeFollow(): void {
    followPausedAyahRef.current = null;
    setFollowPausedAyah(null);
    const a = audioRef.current;
    if (a.playing && a.mode !== null && juzRef.current) {
      const j = JUZ[juzRef.current - 1];
      if (a.page >= j.startPage && a.page <= j.endPage) {
        flipTo(a.page - j.startPage, true);
      }
    }
  }

  // Keep the refs the audio effect + callbacks read in sync with state.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    juzRef.current = juz;
  }, [juz]);

  function commitCache(pageNum: number, entry: PageCacheEntry): void {
    cacheRef.current = {
      ...cacheRef.current,
      [pageNum]: { ...cacheRef.current[pageNum], ...entry },
    };
    setCache(cacheRef.current);
  }

  /** Load one mushaf page + its tarjuma (Urdu + English + transliteration). */
  const loadPage = useCallback(async (pageNum: number) => {
    const existing = cacheRef.current[pageNum];
    if (existing?.mushaf || existing?.error || loadingRef.current.has(pageNum)) return;
    loadingRef.current.add(pageNum);
    try {
      const data = await fetchMushafPage(pageNum);
      if (!mountedRef.current) return;
      commitCache(pageNum, { mushaf: data });
      // Tarjuma (always visible): Urdu + English + transliteration.
      // Each edition failing on its own must not fail the page.
      const [urduRes, enRes, trRes] = await Promise.allSettled([
        fetchUrduPage(pageNum),
        fetchEditionPage(pageNum, 'en.sahih'),
        fetchEditionPage(pageNum, 'en.transliteration'),
      ]);
      if (!mountedRef.current) return;
      let anyOk = false;
      const entry: PageCacheEntry = {};
      if (urduRes.status === 'fulfilled') {
        anyOk = true;
        entry.urdu = new Map(urduRes.value.map((u: UrduAyah) => [u.number, u.text]));
      }
      if (enRes.status === 'fulfilled') {
        anyOk = true;
        entry.english = new Map(enRes.value.map((a) => [a.number, a.text]));
      }
      if (trRes.status === 'fulfilled') {
        anyOk = true;
        entry.translit = new Map(trRes.value.map((a) => [a.number, a.text]));
      }
      if (!anyOk) entry.tarjumaFailed = true;
      commitCache(pageNum, entry);
    } catch (e) {
      if (mountedRef.current) {
        commitCache(pageNum, {
          error: e instanceof Error ? e.message : 'Page load nahi ho paya.',
        });
      }
    } finally {
      loadingRef.current.delete(pageNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Clear a failed page entry so loadPage fetches it again. */
  const retryPage = useCallback((pageNum: number) => {
    cacheRef.current = { ...cacheRef.current, [pageNum]: {} };
    setCache(cacheRef.current);
    void loadPage(pageNum);
  }, [loadPage]);

  const goToIndex = useCallback(
    (i: number) => {
      const jNum = juzRef.current;
      if (!jNum) return;
      const j = JUZ[jNum - 1];
      const count = j.endPage - j.startPage + 1;
      const clamped = Math.max(0, Math.min(count - 1, i));
      indexRef.current = clamped;
      setIndex(clamped);
      setParaDone(false);
      const pageNum = j.startPage + clamped;
      void loadPage(pageNum);
      if (clamped + 1 < count) void loadPage(pageNum + 1);
    },
    [loadPage],
  );

  /** Start a visible page turn to `to`. dir 1 = forward (the
   * current page turns over to reveal the next), dir -1 = backward
   * (the previous page turns back over the current one). The
   * animation itself runs in the effect below, after the leaf has
   * mounted, so the first frame is not lost. */
  const startFlip = useCallback(
    (to: number, dir: 1 | -1) => {
      if (flippingRef.current) return;
      const from = indexRef.current;
      if (to === from) return;
      flippingRef.current = true;
      setFlip({ from, to, dir });
    },
    [],
  );

  // Run the turn once the leaf is mounted. On completion the index
  // moves to the new page (the base already shows it, so there is
  // no jump) and the leaf is removed. If the animation is
  // interrupted (reader closed mid-flip), the index stays put and
  // the flip lock is released so the next flip is not blocked.
  useEffect(() => {
    if (!flip) return;
    flipProgress.setValue(flip.dir === 1 ? 0 : 1);
    const anim = Animated.timing(flipProgress, {
      toValue: flip.dir === 1 ? 1 : 0,
      duration: 650,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) goToIndex(flip.to);
      setFlip(null);
      flippingRef.current = false;
    });
    return () => {
      anim.stop();
      flippingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  const flipTo = useCallback(
    (i: number, fromFollow = false) => {
      const jNum = juzRef.current;
      if (!jNum || flippingRef.current) return;
      // A manual page turn pauses auto-follow for the ayah playing
      // now; a follow turn (the audio moving on) must not pause it.
      if (!fromFollow) pauseFollow();
      const j = JUZ[jNum - 1];
      const count = j.endPage - j.startPage + 1;
      const clamped = Math.max(0, Math.min(count - 1, i));
      if (clamped === indexRef.current) return;
      startFlip(clamped, clamped > indexRef.current ? 1 : -1);
    },
    [startFlip],
  );

  // Swipe on the book: a horizontal swipe runs the SAME turn
  // animation as the Prev/Next buttons. The capture handler only
  // claims clearly-horizontal gestures, so vertical scrolling of
  // the page still works. The handler reads refs (never stale),
  // so the PanResponder can be created once.
  const swipeRef = useRef<(dx: number) => void>(() => {});
  swipeRef.current = (dx: number) => {
    const jNum = juzRef.current;
    if (!jNum || flippingRef.current) return;
    const j = JUZ[jNum - 1];
    const count = j.endPage - j.startPage + 1;
    if (dx < 0) {
      if (indexRef.current < count - 1) startFlip(indexRef.current + 1, 1);
    } else if (indexRef.current > 0) {
      startFlip(indexRef.current - 1, -1);
    }
  };
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gs) =>
        !flippingRef.current &&
        Math.abs(gs.dx) > 24 &&
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2,
      onPanResponderRelease: (_evt, gs) => {
        if (Math.abs(gs.dx) > 50) swipeRef.current(gs.dx);
      },
    }),
  ).current;

  const openJuz = useCallback(
    (n: number) => {
      const j = JUZ[n - 1];
      if (!j) return;
      // Opening another Juz is a manual navigation — pause follow.
      pauseFollow();
      juzRef.current = n;
      viewRef.current = 'reader';
      setJuz(n);
      setView('reader');
      setIndex(0);
      indexRef.current = 0;
      setParaDone(false);
      setMarkMsg(null);
      setFlip(null);
      flippingRef.current = false;
      flipProgress.setValue(0);
      void loadPage(j.startPage);
      void loadPage(j.startPage + 1);
    },
    [loadPage, flipProgress],
  );

  // Follow the global manager: when auto-play advances the page, flip
  // the book to it — but only while this reader is open, the page
  // is inside this Juz, audio is actually playing, and follow is
  // not paused for the ayah playing now. A manual turn pauses
  // follow; the pause clears itself when the recitation moves to
  // the next ayah. When the manager advances PAST this Juz's last
  // page, show the honest "Para complete" card instead.
  useEffect(() => {
    const prev = lastAudioPageRef.current;
    lastAudioPageRef.current = audio.page;
    if (viewRef.current !== 'reader' || !juzRef.current) return;
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
    const j = JUZ[juzRef.current - 1];
    if (audio.page >= j.startPage && audio.page <= j.endPage) {
      const idx = audio.page - j.startPage;
      if (idx !== indexRef.current) flipTo(idx, true);
    } else if (prev >= j.startPage && prev <= j.endPage && audio.page > j.endPage) {
      setParaDone(true);
    }
  }, [audio.page, audio.playingAyah, audio.playing, flipTo]);

  // Tarjuma sync: while the Urdu tarjuma voice plays for the page
  // open here, the tarjuma TEXT must be visible — never play
  // tarjuma audio with the text hidden.
  useEffect(() => {
    if (view !== 'reader' || !juz) return;
    if (audio.mode !== 'urdu' || !audio.playing) return;
    const j = JUZ[juz - 1];
    if (audio.page !== j.startPage + indexRef.current) return;
    if (!showTranslation) setShowTranslation(true);
  }, [audio.mode, audio.playing, audio.page, view, juz, showTranslation]);

  // Scroll the playing ayah into view while following. A manual
  // scroll of the page pauses follow, so this never fights the
  // user's finger.
  useEffect(() => {
    if (view !== 'reader' || !audio.playing || audio.mode === null) return;
    if (
      followPausedAyahRef.current !== null &&
      audio.playingAyah === followPausedAyahRef.current
    ) {
      return;
    }
    if (!juz) return;
    const j = JUZ[juz - 1];
    if (audio.page !== j.startPage + indexRef.current) return;
    if (audio.playingAyah === null) return;
    const y = ayahRowY.current.get(audio.playingAyah);
    if (y !== undefined) {
      pageScrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
    }
  }, [audio.playingAyah, audio.page, audio.playing, view, juz]);

  async function markPageRead(): Promise<void> {
    if (!juz || markBusy) return;
    const j = JUZ[juz - 1];
    const pageNum = j.startPage + indexRef.current;
    const m = cacheRef.current[pageNum]?.mushaf;
    if (!m) return;
    setMarkBusy(true);
    setMarkMsg(null);
    try {
      // Record the furthest ayah of each surah on this page; the
      // server counts forward progress only.
      const furthest = new Map<number, number>();
      for (const a of m.ayahs) {
        const prev = furthest.get(a.surah.number) ?? 0;
        if (a.numberInSurah > prev) furthest.set(a.surah.number, a.numberInSurah);
      }
      for (const [surahNumber, ayahNumber] of furthest) {
        await recordRead(surahNumber, ayahNumber);
      }
      if (mountedRef.current) setMarkMsg(s.pageMarked);
    } catch {
      if (mountedRef.current) setMarkMsg(s.markFailed);
    } finally {
      if (mountedRef.current) setMarkBusy(false);
    }
  }

  /* ------------------------------ List ------------------------------ */
  if (view === 'list') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
        <Text style={T.title}>{shared.paraBookTitle}</Text>
        <Text style={T.sub}>{s.listSub}</Text>
        {JUZ.map((j) => (
          <Pressable
            key={j.number}
            onPress={() => openJuz(j.number)}
            style={styles.juzRow}
            accessibilityRole="button"
            accessibilityLabel={`${shared.paraBookTitle} ${j.number} — ${j.name}`}
          >
            <View style={styles.juzNum}>
              <Text style={styles.juzNumText}>{j.number}</Text>
            </View>
            <View style={styles.juzMeta}>
              <Text style={styles.juzName}>{j.name}</Text>
              <Text style={styles.juzSub}>
                Page {j.startPage}–{j.endPage}
              </Text>
            </View>
            <Text style={styles.juzArabic}>{j.arabic}</Text>
          </Pressable>
        ))}
        <Text style={T.note}>{s.note30}</Text>
        <Text style={T.note}>Source: {ARABIC_SOURCE}</Text>
      </ScrollView>
    );
  }

  /* ------------------------------ Reader ------------------------------ */
  const j = juz ? JUZ[juz - 1] : null;
  if (!j) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
        <Text style={T.error}>{s.loadFailed}</Text>
        <PillButton label={s.backToList} variant="primary" onPress={() => setView('list')} />
      </ScrollView>
    );
  }
  const pageCount = j.endPage - j.startPage + 1;
  const currentPage = j.startPage + index;
  // The base layer shows the under-page during a flip (the next
  // page going forward, the current page going back) and the
  // current page when idle. The leaf is the turning page (the
  // current page going forward, the previous page coming back).
  const baseIndex = flip ? (flip.dir === 1 ? flip.to : flip.from) : index;
  const leafIndex = flip ? (flip.dir === 1 ? flip.from : flip.to) : null;
  const basePageNum = j.startPage + baseIndex;
  const leafPageNum = leafIndex !== null ? j.startPage + leafIndex : null;
  const currentEntry = cache[currentPage];
  const currentMushaf = currentEntry?.mushaf ?? null;
  const firstAyah = currentMushaf?.ayahs[0] ?? null;
  const firstSurah = firstAyah?.surah ?? null;
  const readerSub =
    firstSurah && firstAyah
      ? `${firstSurah.englishName} · ${
          firstSurah.revelationType === 'Meccan' ? s.mecca : s.medina
        } · ${firstSurah.numberOfAyahs} ${s.aayatWord} · ${s.paraWord} ${firstAyah.juz}`
      : null;

  // The WHOLE reader scrolls, exactly like the Quran Book: header,
  // player, mushaf page, page controls, Next Para — all in one scroll
  // flow. The old fixed flex column let the ~350dp player squeeze
  // the flex:1 book to nothing (only the music showed, no page), and
  // crammed the page buttons at the very bottom under the pill nav.
  // Now the book has a guaranteed height (see bookHeight above) so
  // the page is always visible, and every button lives inside the
  // scroll content — always above the pill nav, always tappable.
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={L.scroll}
      onScrollBeginDrag={pauseFollow}
    >
      <View style={styles.readerTop}>
        <PillButton label={s.backToList} variant="ghost" small onPress={() => setView('list')} />
        <View style={styles.readerHead}>
          <Text style={T.h2}>
            {s.paraWord} {j.number} · {j.name}
          </Text>
          <View style={styles.pageTag}>
            <Text style={styles.pageTagText}>
              {s.pageInPara(index + 1, pageCount)}
            </Text>
          </View>
        </View>
        {readerSub ? <Text style={styles.readerSub}>{readerSub}</Text> : null}
      </View>

      {/* The SAME Tilawah player as the Quran Book (Mihrab layout):
          one compact player at the top of the reader, above the book.
          Every control the old per-page players had (play
          tilawat/tarjuma, seek, auto-play, speed, repeat, sleep,
          reciter) lives in this one player. */}
      <TilawahPlayer
        lang={lang}
        page={currentPage}
        ayahs={currentMushaf?.ayahs ?? []}
        showTranslation={showTranslation}
        onTranslationChange={setShowTranslation}
        followPaused={followPausedAyah !== null}
        onFollowResume={resumeFollow}
        onOpenList={() => setView('list')}
      />
      <Text style={T.note}>
        {s.urduAudioCredit} · {URDU_AUDIO.bitrate}
      </Text>

      <View style={[styles.book, { height: bookHeight }]} {...panResponder.panHandlers}>
        {/* Base layer: the page underneath the turn. Keyed by page
            so it remounts (scroll back to top) when the page changes. */}
        <View key={basePageNum} style={styles.baseLayer}>
          {renderBookPage(
            basePageNum,
            baseIndex,
            index,
            cache[basePageNum],
            audio,
            currentPage,
            s,
            shared,
            markPageRead,
            markBusy,
            markMsg,
            retryPage,
            showTranslation,
            pageScrollRef,
            ayahRowY,
            pauseFollow,
          )}
        </View>

        {/* Turning leaf: the page rotating around the spine (left
            edge). Front face = the turning page; back face = a
            plain cream page, the back of the leaf. The leaf takes
            no touches — swipes keep reaching the book beneath it. */}
        {flip && leafIndex !== null && leafPageNum !== null ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.leaf, { width: bookWidth, transform: leafTransform }]}
          >
            <View style={[styles.face, { backfaceVisibility: 'hidden' }]}>
              {renderBookPage(
                leafPageNum,
                leafIndex,
                index,
                cache[leafPageNum],
                audio,
                currentPage,
                s,
                shared,
                markPageRead,
                markBusy,
                markMsg,
                retryPage,
                showTranslation,
                pageScrollRef,
                ayahRowY,
                pauseFollow,
              )}
            </View>
            <View
              style={[
                styles.face,
                styles.backFace,
                { backfaceVisibility: 'hidden', transform: [{ rotateY: '180deg' }] },
              ]}
            />
          </Animated.View>
        ) : null}
      </View>

      {paraDone ? (
        <View style={styles.doneCard}>
          <Text style={styles.doneTitle}>{s.paraComplete}</Text>
          <Text style={styles.doneBody}>{s.paraCompleteBody(j.number)}</Text>
          {j.number < 30 ? (
            <PillButton
              label={s.nextParaBtn(j.number + 1)}
              variant="peach"
              block
              onPress={() => openJuz(j.number + 1)}
            />
          ) : (
            <Text style={styles.doneBody}>{s.allDone}</Text>
          )}
        </View>
      ) : null}

      <View style={styles.flipRow}>
        <PillButton
          label={shared.prevPage}
          variant="ghost"
          disabled={index <= 0 || flip !== null}
          onPress={() => index > 0 && flipTo(index - 1)}
          style={styles.flipBtn}
        />
        <Text style={styles.flipLabel}>
          {s.pageInPara(index + 1, pageCount)} · Page {currentPage}
        </Text>
        <PillButton
          label={shared.nextPage}
          variant="primary"
          disabled={index >= pageCount - 1 || flip !== null}
          onPress={() => index < pageCount - 1 && flipTo(index + 1)}
          style={styles.flipBtn}
        />
      </View>

      {/* Next Para, right after the page controls and inside the
          scroll flow — always above the pill nav and tappable, never
          crammed at the very bottom under it. Shown on the para's
          last page (the done card above already carries it when the
          audio finishes the para). */}
      {index >= pageCount - 1 && !paraDone ? (
        j.number < 30 ? (
          <View style={styles.nextParaWrap}>
            <PillButton
              label={s.nextParaBtn(j.number + 1)}
              variant="peach"
              block
              onPress={() => openJuz(j.number + 1)}
            />
          </View>
        ) : (
          <Text style={styles.doneBody}>{s.allDone}</Text>
        )
      ) : null}
    </ScrollView>
  );
}

/**
 * One book page: the mushaf page (ornate border, Uthmani script, surah
 * heading band) + tarjuma + audio + mark-read. The full detail (tarjuma,
 * players, mark button) renders only for the current page and its
 * neighbours, so flipping stays fast; far pages render the mushaf
 * alone (or a spinner while loading).
 */
function renderBookPage(
  pageNum: number,
  pageIdx: number,
  currentIndex: number,
  entry: PageCacheEntry | undefined,
  audio: QuranAudioState,
  currentPage: number,
  s: (typeof STRINGS)['en'],
  shared: ReturnType<typeof stringsFor>,
  markPageRead: () => void,
  markBusy: boolean,
  markMsg: string | null,
  retryPage: (pageNum: number) => void,
  showTranslation: boolean,
  pageScrollRef: RefObject<ScrollViewInstance | null>,
  ayahRowY: RefObject<Map<number, number>>,
  onUserScroll: () => void,
) {
  if (entry?.error) {
    return (
      <View style={styles.pageChildContent}>
        <View style={styles.errorCard}>
          <Text style={T.error}>{entry.error}</Text>
          <PillButton
            label={shared.retry}
            variant="primary"
            block
            onPress={() => retryPage(pageNum)}
          />
        </View>
      </View>
    );
  }
  const m = entry?.mushaf;
  if (!m) {
    return (
      <View style={styles.pageChildContent}>
        <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
      </View>
    );
  }
  // Group the page's ayahs by surah, in page order.
  const segments: { surah: MushafSurahRef; ayahs: MushafAyah[] }[] = [];
  for (const a of m.ayahs) {
    const last = segments[segments.length - 1];
    if (last && last.surah.number === a.surah.number) {
      last.ayahs.push(a);
    } else {
      segments.push({ surah: a.surah, ayahs: [a] });
    }
  }
  const firstSeg = segments[0];
  const firstAyah = m.ayahs[0];
  const isCurrent = pageNum === currentPage;
  const showDetail = Math.abs(pageIdx - currentIndex) <= 1;

  return (
    <ScrollView
      ref={isCurrent ? pageScrollRef : undefined}
      onScrollBeginDrag={isCurrent ? onUserScroll : undefined}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.pageChildContent}
    >
      <View style={styles.mushaf}>
        <View style={styles.mushafInner}>
          <View style={styles.stripe} />
          <Text style={styles.pageNo}>— {pageNum} —</Text>
          {segments.map((seg) => {
            const startsHere = seg.ayahs[0]?.numberInSurah === 1;
            // Surah Al-Fatiha's ayah 1 IS the Bismillah: it is shown
            // as the separate Bismillah line, not again in the flow.
            const flowAyahs =
              seg.surah.number === 1 && startsHere ? seg.ayahs.slice(1) : seg.ayahs;
            return (
              <View key={`${seg.surah.number}-${seg.ayahs[0]?.numberInSurah ?? 0}`}>
                {startsHere ? (
                  <View style={styles.bandOuter}>
                    <View style={styles.surahBand}>
                      <Text style={styles.surahBandArabic}>۞ {seg.surah.name} ۞</Text>
                    </View>
                  </View>
                ) : null}
                {startsHere && seg.surah.number !== 9 ? (
                  <Text style={styles.bismillah}>
                    {BISMILLAH}
                    {seg.surah.number === 1 ? (
                      <Text style={styles.marker}> {toArabicIndic(1)} </Text>
                    ) : null}
                  </Text>
                ) : null}
                <Text style={styles.ayahFlow}>
                  {flowAyahs.map((a) => (
                    <Text
                      key={a.number}
                      style={
                        isCurrent && audio.playingAyah === a.number
                          ? styles.ayahPlaying
                          : undefined
                      }
                    >
                      {a.text.trim()}{' '}
                      <Text style={styles.marker}>
                        {' '}
                        {toArabicIndic(a.numberInSurah)}{' '}
                      </Text>{' '}
                    </Text>
                  ))}
                </Text>
              </View>
            );
          })}
          <View style={styles.stripe} />
          <View style={styles.mushafFoot}>
            <Text style={styles.footText}>PARA {firstAyah?.juz ?? ''}</Text>
            <Text style={styles.footText}>
              SURAH {firstSeg?.surah.englishName.toUpperCase() ?? ''}
            </Text>
            <Text style={styles.footText}>PAGE {pageNum}</Text>
          </View>
        </View>
      </View>

      {showDetail ? (
        <>
          <Text style={styles.sectionTitle}>{shared.rdTarjumaH}</Text>
          {entry.tarjumaFailed ? <Text style={T.error}>{s.tarjumaUnavailable}</Text> : null}
          {m.ayahs.map((a) => (
            <View
              key={a.number}
              onLayout={
                isCurrent
                  ? (e) => {
                      ayahRowY.current.set(a.number, e.nativeEvent.layout.y);
                    }
                  : undefined
              }
              style={[
                styles.ayahRow,
                isCurrent && audio.playingAyah === a.number && styles.ayahRowPlaying,
              ]}
            >
              <Text style={styles.ayahArabic}>{a.text.trim()}</Text>
              {showTranslation ? (
                <>
                  {entry.translit?.get(a.number) ? (
                    <Text style={styles.translit}>{entry.translit.get(a.number)}</Text>
                  ) : null}
                  {entry.urdu?.get(a.number) ? (
                    <Text style={styles.urduText}>{entry.urdu.get(a.number)}</Text>
                  ) : null}
                  {entry.english?.get(a.number) ? (
                    <Text style={styles.english}>{entry.english.get(a.number)}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ))}

          <PillButton
            label={shared.markRead}
            variant="peach"
            block
            busy={markBusy}
            onPress={() => markPageRead()}
          />
          {markMsg ? <Text style={styles.infoMsg}>{markMsg}</Text> : null}

          <Text style={styles.pageFooter}>
            Page {pageNum} of {TOTAL_PAGES} · Surah {firstSeg?.surah.englishName ?? ''}
          </Text>
          <Text style={T.note}>Urdu text: {URDU_TEXT_NAME}</Text>
        </>
      ) : null}
    </ScrollView>
  );
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
  /* ---- List ---- */
  juzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 12,
  },
  juzNum: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  juzNumText: { fontFamily: F.sans, fontSize: 16, fontWeight: '800', color: C.teal900 },
  juzMeta: { flex: 1 },
  juzName: { fontFamily: F.sans, fontSize: 16, fontWeight: '700', color: C.ink },
  juzSub: { fontFamily: F.sans, fontSize: 13, color: C.muted, marginTop: 2 },
  juzArabic: { fontFamily: F.arabic, fontSize: 24, color: C.teal700 },
  /* ---- Reader (scrolls as one, like the Quran Book) ---- */
  readerTop: {},
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
  /* The book keeps a guaranteed height (set inline from the window
     height) — never flex:1, so the player above it can never squeeze
     it to nothing. The page inside scrolls; the leaf turns within
     these bounds. */
  book: { marginTop: 12 },
  baseLayer: { flex: 1 },
  /* Turning leaf: absolutely positioned over the base, pivoting on
   * the spine (left edge). Width is set inline to the page width. */
  leaf: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  /* One side of the leaf. The front shows the turning page; the
   * back is a plain cream page. overflow hidden clips the page's
   * long ScrollView to the visible page area. */
  face: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  backFace: {
    backgroundColor: MUSHAF_BG,
    borderWidth: 2.5,
    borderColor: C.teal900,
    borderRadius: 8,
    marginHorizontal: S.pad,
    marginTop: 4,
    marginBottom: 24,
  },
  pageChildContent: {
    paddingHorizontal: S.pad,
    paddingBottom: 24,
  },
  flipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    paddingBottom: 0,
  },
  flipBtn: { flex: 1 },
  nextParaWrap: { marginTop: 12 },
  flipLabel: {
    fontFamily: F.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
  },
  doneCard: {
    backgroundColor: C.teal900,
    borderRadius: S.radius,
    padding: 16,
    marginTop: 10,
  },
  doneTitle: { fontFamily: F.sans, fontSize: 16, fontWeight: '800', color: C.white },
  doneBody: { fontFamily: F.sans, fontSize: 13.5, color: C.navInactive, marginTop: 6, lineHeight: 20 },
  /* ---- Mushaf page (same as QuranBook) ---- */
  mushaf: {
    marginTop: 4,
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
  stripe: { height: 7, backgroundColor: 'rgba(31,94,73,0.16)', borderRadius: 3 },
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
  ayahPlaying: { color: C.teal500 },
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
  playIconPeach: { color: C.white },
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
  pageFooter: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});
