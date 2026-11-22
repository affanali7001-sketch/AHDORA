/**
 * Quran Book — mushaf-style reader (THE centerpiece), rebuilt to the
 * approved preview (§10 landing, §11 reader).
 *
 * Real data only: Uthmani Arabic from AlQuran Cloud
 * (GET /v1/page/{n}, 1–604), Urdu translation text from the
 * Junagarhi edition, English (Saheeh International) + transliteration
 * from AlQuran Cloud (verified live 2026-11-22), continuous tilawat
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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { takeQuranSurahTarget } from '../lib/navTarget';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Chip, Field, Input, PillButton, Switch, TealHead } from '../components/ui';
import {
  getQuranAudioState,
  nextQuranAyah,
  prevQuranAyah,
  seekQuranBy,
  setQuranAutoPlay,
  startQuranPage,
  stopQuranAudio,
  subscribeQuranAudio,
  toggleQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';
import {
  ARABIC_SOURCE,
  TILAWAT_RECITER,
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
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
/* Preview-mandated mushaf colours (preview §11, .mushaf / .mushaf-text /
 * .ayah.playing) — the only hex values outside the foundation tokens. */
const MUSHAF_BG = '#FFFDF6';
const MUSHAF_INK = '#1C1A15';
const PLAYING_BG = '#FFF4E6';

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
  },
};

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

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

  // Tarjuma: always visible (no toggle). Urdu + English + transliteration.
  const [urduByGlobal, setUrduByGlobal] = useState<Map<number, string>>(new Map());
  const [englishByGlobal, setEnglishByGlobal] = useState<Map<number, string>>(new Map());
  const [translitByGlobal, setTranslitByGlobal] = useState<Map<number, string>>(new Map());
  const [tarjumaFailed, setTarjumaFailed] = useState(false);

  // Audio lives in the GLOBAL player (src/lib/quranAudio) so it keeps
  // playing on other screens; this screen only mirrors its state.
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());
  useEffect(() => subscribeQuranAudio(setAudio), []);

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

  const loadPage = useCallback(async (n: number) => {
    setPageLoading(true);
    setPageError(null);
    setUrduByGlobal(new Map());
    setEnglishByGlobal(new Map());
    setTranslitByGlobal(new Map());
    setTarjumaFailed(false);
    try {
      const data = await fetchMushafPage(n);
      if (!mountedRef.current) return;
      setMushaf(data);
      setPage(n);
      lastPageRef.current = n;
      sessionOpenedRef.current = true;
      // Tarjuma (always visible): Urdu + English + transliteration.
      // Each edition failing on its own must not fail the page.
      const [urduRes, enRes, trRes] = await Promise.allSettled([
        fetchUrduPage(n),
        fetchEditionPage(n, 'en.sahih'),
        fetchEditionPage(n, 'en.transliteration'),
      ]);
      if (!mountedRef.current) return;
      let anyOk = false;
      if (urduRes.status === 'fulfilled') {
        anyOk = true;
        setUrduByGlobal(new Map(urduRes.value.map((u: UrduAyah) => [u.number, u.text])));
      }
      if (enRes.status === 'fulfilled') {
        anyOk = true;
        setEnglishByGlobal(new Map(enRes.value.map((a) => [a.number, a.text])));
      }
      if (trRes.status === 'fulfilled') {
        anyOk = true;
        setTranslitByGlobal(new Map(trRes.value.map((a) => [a.number, a.text])));
      }
      if (!anyOk) setTarjumaFailed(true);
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
    (n: number) => {
      // Audio is global — opening another page does NOT stop it.
      setView('reader');
      void loadPage(n);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadPage],
  );

  /* 'reader' route (App.tsx): open at the last-read surah's first
   * page when history exists, else page 1. */
  useEffect(() => {
    if (initialView !== 'reader' || bootedRef.current) return;
    bootedRef.current = true;
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
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
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

      {/* Audio controls at the TOP of the reader (user request
          2026-11-22): the play buttons sit right under the page
          label, above the mushaf page — visible without scrolling. */}
      <PlayerCard
        dark
        title={shared.playerTitle}
        note={s.playerNote}
        time={audio.mode === 'tilawat' && audio.page === page ? audio.time : 0}
        duration={audio.mode === 'tilawat' && audio.page === page ? audio.duration : 0}
        timeLabel={
          audio.mode === 'tilawat' && audio.page === page && audio.duration > 0
            ? `${fmtTime(audio.duration)} · Page ${page}`
            : `Page ${page}`
        }
        playing={audio.mode === 'tilawat' && audio.page === page && audio.playing}
        busy={audio.busy && audio.mode === 'tilawat' && audio.page === page}
        onToggle={() => {
          if (audio.mode === 'tilawat' && audio.page === page) {
            toggleQuranAudio();
          } else {
            void startQuranPage(page, 'tilawat');
          }
        }}
      />
      <PlayerCard
        title={shared.urduTitle}
        note={s.urduNote}
        time={audio.mode === 'urdu' && audio.page === page ? audio.time : 0}
        duration={audio.mode === 'urdu' && audio.page === page ? audio.duration : 0}
        timeLabel={
          audio.mode === 'urdu' && audio.page === page && audio.duration > 0
            ? `${fmtTime(audio.duration)} · Page ${page}`
            : `Page ${page}`
        }
        playing={audio.mode === 'urdu' && audio.page === page && audio.playing}
        busy={audio.busy && audio.mode === 'urdu' && audio.page === page}
        onToggle={() => {
          if (audio.mode === 'urdu' && audio.page === page) {
            toggleQuranAudio();
          } else {
            void startQuranPage(page, 'urdu');
          }
        }}
      />
      {audio.busy && audio.mode ? (
        <Text style={styles.audioLoading}>{s.audioLoading}</Text>
      ) : null}
      {audio.error ? <Text style={T.error}>{audio.error}</Text> : null}

      {/* Auto-play: tilawat → tarjuma → next page, and mark done. */}
      <View style={styles.autoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.autoTitle}>{s.autoPlay}</Text>
          <Text style={styles.autoNote}>{s.autoPlayNote}</Text>
        </View>
        <Switch value={audio.autoPlay} onValueChange={setQuranAutoPlay} />
      </View>

      {/* Seek + prev/next ayah + stop — works even off this page. */}
      {audio.hasAudio ? (
        <View style={styles.seekRow}>
          <PillButton label="−10s" small variant="ghost" onPress={() => seekQuranBy(-10)} />
          <PillButton label="⏮" small variant="ghost" onPress={() => prevQuranAyah()} />
          <PillButton label="⏭" small variant="ghost" onPress={() => nextQuranAyah()} />
          <PillButton label="+10s" small variant="ghost" onPress={() => seekQuranBy(10)} />
          <PillButton
            label={s.stopAudio}
            small
            variant="ghost"
            onPress={() => stopQuranAudio()}
          />
        </View>
      ) : null}
      <Text style={T.note}>
        {s.tilawatCredit} · {TILAWAT_RECITER.bitrate}
      </Text>
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
          <View style={styles.mushaf}>
            <View style={styles.mushafInner}>
              <View style={styles.stripe} />
              <Text style={styles.pageNo}>— {page} —</Text>
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
                          <Text style={styles.surahBandArabic}>
                            ۞ {seg.surah.name} ۞
                          </Text>
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
                          style={audio.playingAyah === a.number ? styles.ayahPlaying : undefined}
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
                <Text style={styles.footText}>PAGE {page}</Text>
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

          <Text style={styles.sectionTitle}>{shared.rdTarjumaH}</Text>
          {tarjumaFailed ? <Text style={T.error}>{s.tarjumaUnavailable}</Text> : null}
          {mushaf.ayahs.map((a) => (
            <View
              key={a.number}
              style={[
                styles.ayahRow,
                audio.playingAyah === a.number && styles.ayahRowPlaying,
              ]}
            >
              <Text style={styles.ayahArabic}>{a.text.trim()}</Text>
              {translitByGlobal.get(a.number) ? (
                <Text style={styles.translit}>{translitByGlobal.get(a.number)}</Text>
              ) : null}
              {urduByGlobal.get(a.number) ? (
                <Text style={styles.urduText}>{urduByGlobal.get(a.number)}</Text>
              ) : null}
              {englishByGlobal.get(a.number) ? (
                <Text style={styles.english}>{englishByGlobal.get(a.number)}</Text>
              ) : null}
            </View>
          ))}

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

/** One audio player card (preview §11): round 52px play button,
 * title, progress bar, current / total times, note. */
function PlayerCard({
  dark = false,
  title,
  note,
  time,
  duration,
  timeLabel,
  playing,
  busy,
  onToggle,
}: {
  dark?: boolean;
  title: string;
  note: string;
  time: number;
  duration: number;
  timeLabel: string;
  playing: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const pct = duration > 0 ? Math.min(1, time / duration) : 0;
  return (
    <View style={[styles.player, dark ? styles.playerDark : styles.playerLight]}>
      <View style={styles.playerRow}>
        <Pressable
          onPress={onToggle}
          style={[styles.playBtn, dark ? styles.playBtnPeach : styles.playBtnTeal]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Stop' : 'Play'}
        >
          {busy ? (
            <ActivityIndicator color={dark ? C.peachText : C.white} />
          ) : (
            <Text style={[styles.playIcon, dark ? styles.playIconPeach : styles.playIconTeal]}>
              {playing ? '■' : '▶'}
            </Text>
          )}
        </Pressable>
        <View style={styles.playerBody}>
          <Text style={[styles.playerTitle, dark && styles.playerTitleDark]}>{title}</Text>
          <View
            style={[styles.playerTrack, dark ? styles.playerTrackDark : styles.playerTrackLight]}
          >
            <View
              style={[
                styles.playerFill,
                {
                  width: `${pct * 100}%`,
                  backgroundColor: dark ? C.peachMid : C.teal500,
                },
              ]}
            />
          </View>
          <View style={styles.playerTimes}>
            <Text style={[styles.playerTime, dark && styles.playerTimeDark]}>
              {fmtTime(time)}
            </Text>
            <Text style={[styles.playerTime, dark && styles.playerTimeDark]}>{timeLabel}</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.playerNote, dark ? styles.playerNoteDark : styles.playerNoteLight]}>
        {note}
      </Text>
    </View>
  );
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
