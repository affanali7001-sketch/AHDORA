/**
 * Quran Book — mushaf-style reader (THE centerpiece).
 *
 * Real data only: Uthmani Arabic from AlQuran Cloud
 * (GET /v1/page/{n}, 1–604), Urdu translation text from the
 * Junagarhi edition, continuous tilawat audio from EveryAyah
 * (Mishary Rashid Alafasy) with the AlQuran Cloud CDN as fallback,
 * and Urdu tarjuma audio from Shamshad Ali Khan (ur.khan, Islamic
 * Network CDN, 64 kbps) — see src/lib/apiWorship.ts for the
 * verification notes. Nothing is invented.
 *
 * Reading progress: ayahs opened today + daily target come from
 * the live API (/api/quran/history, /read, /target) and persist
 * per user. Pages read and minutes shown here are counted in this
 * session only and are labelled as such.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import {
  ARABIC_SOURCE,
  TILAWAT_RECITER,
  URDU_AUDIO,
  URDU_TEXT_NAME,
  everyAyahUrl,
  fetchMushafPage,
  fetchQuranHistory,
  fetchSurahFirstPage,
  fetchSurahList,
  fetchUrduPage,
  recordRead,
  setDailyTarget,
  tilawatFallbackUrl,
  urduAudioUrl,
  type MushafAyah,
  type MushafPage,
  type MushafSurahRef,
  type QuranHistory,
  type UrduAyah,
} from '../lib/apiWorship';

/** Ice White / Deep Teal / Soft Peach — the AHDORA palette. No gold. */
const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
};

const TOTAL_PAGES = 604;
const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    todayRead: string;
    ayahsToday: string;
    pagesSession: string;
    minutesSession: string;
    dailyGoal: string;
    goalAyahs: string;
    continueReading: string;
    openBook: string;
    markPageRead: string;
    pageMarked: string;
    markFailed: string;
    surahIndex: string;
    searchSurahs: string;
    pageOf: string;
    prev: string;
    next: string;
    jumpTo: string;
    go: string;
    invalidPage: string;
    listenTilawat: string;
    listenUrdu: string;
    stopAudio: string;
    tilawatCredit: string;
    urduAudioCredit: string;
    urduText: string;
    urduTextCredit: string;
    showUrdu: string;
    hideUrdu: string;
    loading: string;
    loadFailed: string;
    retry: string;
    back: string;
    historyUnavailable: string;
    sessionOnly: string;
    targetSaved: string;
    setGoal: string;
    ayahs: string;
    audioLoading: string;
    audioFailed: string;
    source: string;
    mecca: string;
    medina: string;
    ayahWord: string;
  }
> = {
  en: {
    title: 'Quran Book',
    subtitle: 'Read the mushaf, page by page.',
    todayRead: 'Aaj kitna padha',
    ayahsToday: 'Ayahs today',
    pagesSession: 'Pages (this session)',
    minutesSession: 'Minutes (this session)',
    dailyGoal: 'Daily goal',
    goalAyahs: 'ayahs / day',
    continueReading: 'Continue reading',
    openBook: 'Open the Book',
    markPageRead: 'Mark this page read',
    pageMarked: 'Page marked as read.',
    markFailed: 'Could not save. Try again.',
    surahIndex: 'Surah index',
    searchSurahs: 'Search surah…',
    pageOf: 'Page',
    prev: '← Prev',
    next: 'Next →',
    jumpTo: 'Jump to page (1–604)',
    go: 'Go',
    invalidPage: 'Page number must be 1–604.',
    listenTilawat: '▶ Listen — Tilawat',
    listenUrdu: '▶ Listen — Urdu tarjuma',
    stopAudio: '■ Stop audio',
    tilawatCredit: 'Tilawat: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu tarjuma voice: Shamshad Ali Khan (Islamic Network)',
    urduText: 'Urdu tarjuma',
    urduTextCredit: 'Urdu text: Muhammad Junagarhi',
    showUrdu: 'Urdu tarjuma dikhao',
    hideUrdu: 'Urdu tarjuma chhupao',
    loading: 'Loading…',
    loadFailed: 'Page load nahi ho paya.',
    retry: 'Dobara try karo',
    back: '← Back',
    historyUnavailable: 'Login karke padho — progress aapke account me save hoga.',
    sessionOnly: 'Pages aur minutes sirf is session ke hain.',
    targetSaved: 'Daily goal save ho gaya.',
    setGoal: 'Goal badlo',
    ayahs: 'ayahs',
    audioLoading: 'Audio load ho raha hai…',
    audioFailed: 'Audio nahi chal paya. Dobara try karo.',
    source: 'Source',
    mecca: 'Meccan',
    medina: 'Medinan',
    ayahWord: 'Ayah',
  },
  hi: {
    title: 'Quran Book',
    subtitle: 'Mushaf ko page by page padho.',
    todayRead: 'Aaj kitna padha',
    ayahsToday: 'Aaj ki ayahs',
    pagesSession: 'Pages (is session me)',
    minutesSession: 'Minutes (is session me)',
    dailyGoal: 'Roz ka goal',
    goalAyahs: 'ayahs / din',
    continueReading: 'Padhna jaari rakho',
    openBook: 'Kitab kholo',
    markPageRead: 'Is page ko padha hua mark karo',
    pageMarked: 'Page padha hua mark ho gaya.',
    markFailed: 'Save nahi ho paya. Dobara try karo.',
    surahIndex: 'Surah index',
    searchSurahs: 'Surah dhoondho…',
    pageOf: 'Page',
    prev: '← Pichla',
    next: 'Agla →',
    jumpTo: 'Page par jao (1–604)',
    go: 'Jao',
    invalidPage: 'Page number 1–604 ke beech hona chahiye.',
    listenTilawat: '▶ Suno — Tilawat',
    listenUrdu: '▶ Suno — Urdu tarjuma',
    stopAudio: '■ Audio roko',
    tilawatCredit: 'Tilawat: Mishary Rashid Alafasy (EveryAyah)',
    urduAudioCredit: 'Urdu tarjuma awaaz: Shamshad Ali Khan (Islamic Network)',
    urduText: 'Urdu tarjuma',
    urduTextCredit: 'Urdu text: Muhammad Junagarhi',
    showUrdu: 'Urdu tarjuma dikhao',
    hideUrdu: 'Urdu tarjuma chhupao',
    loading: 'Load ho raha hai…',
    loadFailed: 'Page load nahi ho paya.',
    retry: 'Dobara try karo',
    back: '← Wapas',
    historyUnavailable: 'Login karke padho — progress aapke account me save hoga.',
    sessionOnly: 'Pages aur minutes sirf is session ke hain.',
    targetSaved: 'Roz ka goal save ho gaya.',
    setGoal: 'Goal badlo',
    ayahs: 'ayahs',
    audioLoading: 'Audio load ho raha hai…',
    audioFailed: 'Audio nahi chal paya. Dobara try karo.',
    source: 'Source',
    mecca: 'Makki',
    medina: 'Madani',
    ayahWord: 'Ayah',
  },
};

type AudioItem = { uri: string; fallbackUri?: string; globalAyah: number };
type AudioMode = 'tilawat' | 'urdu' | null;

export default function QuranBookScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const [view, setView] = useState<'landing' | 'reader'>('landing');
  const [page, setPage] = useState(1);
  const [mushaf, setMushaf] = useState<MushafPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [jumpText, setJumpText] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);

  const [history, setHistory] = useState<QuranHistory | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [markMsg, setMarkMsg] = useState<string | null>(null);
  const [markBusy, setMarkBusy] = useState(false);
  const [targetBusy, setTargetBusy] = useState(false);

  const [surahs, setSurahs] = useState<MushafSurahRef[]>([]);
  const [surahQuery, setSurahQuery] = useState('');
  const [surahError, setSurahError] = useState<string | null>(null);

  const [showUrdu, setShowUrdu] = useState(false);
  const [urduAyahs, setUrduAyahs] = useState<UrduAyah[] | null>(null);
  const [urduLoading, setUrduLoading] = useState(false);

  const [audioMode, setAudioMode] = useState<AudioMode>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);

  const lastPageRef = useRef(1);
  const sessionPagesRef = useRef<Set<number>>(new Set());
  const [sessionPages, setSessionPages] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const soundRef = useRef<AudioPlayer | null>(null);
  const queueRef = useRef<AudioItem[]>([]);
  const queueIndexRef = useRef(0);
  const modeRef = useRef<AudioMode>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopAudio();
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
    } catch {
      // Not logged in (or offline): progress stays session-only.
      if (mountedRef.current) setHistoryNote(s.historyUnavailable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    // Surah index for the landing screen.
    fetchSurahList()
      .then((list) => {
        if (mountedRef.current) setSurahs(list);
      })
      .catch(() => {
        if (mountedRef.current) setSurahError(s.loadFailed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = useCallback(async (n: number) => {
    setPageLoading(true);
    setPageError(null);
    setUrduAyahs(null);
    try {
      const data = await fetchMushafPage(n);
      if (!mountedRef.current) return;
      setMushaf(data);
      setPage(n);
      lastPageRef.current = n;
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
      void stopAudio();
      setView('reader');
      void loadPage(n);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadPage],
  );

  async function stopAudio(): Promise<void> {
    modeRef.current = null;
    queueRef.current = [];
    queueIndexRef.current = 0;
    setPlayingAyah(null);
    setAudioMode(null);
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      sound.remove();
    }
  }

  async function playAt(index: number): Promise<void> {
    const queue = queueRef.current;
    if (index >= queue.length) {
      await stopAudio();
      return;
    }
    const item = queue[index];
    if (!item) return;
    queueIndexRef.current = index;
    setPlayingAyah(item.globalAyah);
    const old = soundRef.current;
    soundRef.current = null;
    if (old) {
      old.remove();
    }
    const tryLoad = (uri: string): AudioPlayer => {
      const player = createAudioPlayer({ uri }, { updateInterval: 500 });
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          void playAt(queueIndexRef.current + 1);
        } else if (status.error) {
          if (item.fallbackUri && uri === item.uri) {
            player.replace({ uri: item.fallbackUri });
            player.play();
          } else {
            setAudioError(s.audioFailed);
            void stopAudio();
          }
        }
      });
      player.play();
      return player;
    };
    try {
      soundRef.current = tryLoad(item.uri);
    } catch {
      if (item.fallbackUri) {
        try {
          soundRef.current = tryLoad(item.fallbackUri);
        } catch {
          setAudioError(s.audioFailed);
          await stopAudio();
          return;
        }
      } else {
        setAudioError(s.audioFailed);
        await stopAudio();
        return;
      }
    }
  }

  async function startAudio(mode: Exclude<AudioMode, null>): Promise<void> {
    if (!mushaf) return;
    setAudioError(null);
    setAudioBusy(true);
    await stopAudio();
    const queue: AudioItem[] =
      mode === 'tilawat'
        ? mushaf.ayahs.map((a) => ({
            uri: everyAyahUrl(a.surah.number, a.numberInSurah),
            fallbackUri: tilawatFallbackUrl(a.number),
            globalAyah: a.number,
          }))
        : mushaf.ayahs.map((a) => ({
            uri: urduAudioUrl(a.number),
            globalAyah: a.number,
          }));
    queueRef.current = queue;
    modeRef.current = mode;
    setAudioMode(mode);
    setAudioBusy(false);
    await playAt(0);
  }

  async function toggleUrdu(): Promise<void> {
    const next = !showUrdu;
    setShowUrdu(next);
    if (next && mushaf && !urduAyahs) {
      setUrduLoading(true);
      try {
        const list = await fetchUrduPage(mushaf.number);
        if (mountedRef.current) setUrduAyahs(list);
      } catch {
        if (mountedRef.current) setShowUrdu(false);
      } finally {
        if (mountedRef.current) setUrduLoading(false);
      }
    }
  }

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
      if (!sessionPagesRef.current.has(mushaf.number)) {
        sessionPagesRef.current.add(mushaf.number);
        setSessionPages(sessionPagesRef.current.size);
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

  async function changeTarget(next: number): Promise<void> {
    setTargetBusy(true);
    try {
      const res = await setDailyTarget(next);
      const h = await fetchQuranHistory();
      if (mountedRef.current) {
        setHistory({ ...h, dailyTarget: res.dailyTarget });
        setMarkMsg(s.targetSaved);
      }
    } catch {
      if (mountedRef.current) setMarkMsg(s.markFailed);
    } finally {
      if (mountedRef.current) setTargetBusy(false);
    }
  }

  function jumpToPage(): void {
    const n = Number(jumpText.trim());
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) {
      setJumpError(s.invalidPage);
      return;
    }
    setJumpError(null);
    setJumpText('');
    openReader(n);
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

  const goalProgress =
    history && history.dailyTarget > 0
      ? Math.min(1, history.ayahsOpenedToday / history.dailyTarget)
      : 0;

  /* ------------------------------ Landing ------------------------------ */
  if (view === 'landing') {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.sub}>{s.subtitle}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{s.todayRead}</Text>
          {history ? (
            <>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{history.ayahsOpenedToday}</Text>
                  <Text style={styles.statLabel}>{s.ayahsToday}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{sessionPages}</Text>
                  <Text style={styles.statLabel}>{s.pagesSession}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{Math.floor(sessionSeconds / 60)}</Text>
                  <Text style={styles.statLabel}>{s.minutesSession}</Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${goalProgress * 100}%` }]} />
              </View>
              <Text style={styles.goalLine}>
                {s.dailyGoal}: {history.ayahsOpenedToday} / {history.dailyTarget} {s.goalAyahs}
              </Text>
              <View style={styles.goalRow}>
                {[10, 20, 50].map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => void changeTarget(g)}
                    disabled={targetBusy || history.dailyTarget === g}
                    style={[
                      styles.goalChip,
                      history.dailyTarget === g && styles.goalChipOn,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.goalChipText,
                        history.dailyTarget === g && styles.goalChipTextOn,
                      ]}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.setGoalLabel}>{s.setGoal}</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.note}>{historyNote ?? s.loading}</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{sessionPages}</Text>
                  <Text style={styles.statLabel}>{s.pagesSession}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{Math.floor(sessionSeconds / 60)}</Text>
                  <Text style={styles.statLabel}>{s.minutesSession}</Text>
                </View>
              </View>
            </>
          )}
          <Text style={styles.tinyNote}>{s.sessionOnly}</Text>
          {markMsg ? <Text style={styles.infoMsg}>{markMsg}</Text> : null}

          <Pressable
            onPress={() => openReader(lastPageRef.current)}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {s.continueReading} · {s.pageOf} {lastPageRef.current} / {TOTAL_PAGES}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => openReader(1)}
            style={styles.peachBtn}
            accessibilityRole="button"
          >
            <Text style={styles.peachBtnText}>{s.openBook}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{s.surahIndex}</Text>
        <TextInput
          style={styles.input}
          value={surahQuery}
          onChangeText={setSurahQuery}
          placeholder={s.searchSurahs}
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {surahError ? <Text style={styles.error}>{surahError}</Text> : null}
        {filteredSurahs.map((su) => (
          <Pressable
            key={su.number}
            onPress={() => {
              void (async () => {
                try {
                  const firstPage = await fetchSurahFirstPage(su.number);
                  openReader(firstPage);
                } catch {
                  openReader(1);
                }
              })();
            }}
            style={styles.surahRow}
            accessibilityRole="button"
          >
            <View style={styles.surahNum}>
              <Text style={styles.surahNumText}>{su.number}</Text>
            </View>
            <View style={styles.surahMeta}>
              <Text style={styles.surahName}>{su.englishName}</Text>
              <Text style={styles.surahSub}>
                {su.englishNameTranslation} · {su.numberOfAyahs} {s.ayahs} ·{' '}
                {su.revelationType === 'Meccan' ? s.mecca : s.medina}
              </Text>
            </View>
            <Text style={styles.surahArabic}>{su.name}</Text>
          </Pressable>
        ))}
        <Text style={styles.tinyNote}>
          {s.source}: {ARABIC_SOURCE}
        </Text>
      </ScrollView>
    );
  }

  /* ------------------------------ Reader ------------------------------ */
  const urduByGlobal = new Map<number, string>();
  if (urduAyahs) {
    for (const u of urduAyahs) urduByGlobal.set(u.number, u.text);
  }

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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Pressable
        onPress={() => {
          void stopAudio();
          setView('landing');
          void loadHistory();
        }}
        accessibilityRole="button"
      >
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>

      <Text style={styles.pageLabel}>
        {s.pageOf} {page} / {TOTAL_PAGES}
      </Text>

      {pageLoading ? (
        <ActivityIndicator color={C.teal} size="large" style={styles.loader} />
      ) : pageError ? (
        <View style={styles.card}>
          <Text style={styles.error}>{pageError}</Text>
          <Pressable
            onPress={() => void loadPage(page)}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : mushaf ? (
        <View style={styles.mushafFrame}>
          <View style={styles.mushafInner}>
            {segments.map((seg) => (
              <View key={`${seg.surah.number}-${seg.ayahs[0]?.numberInSurah ?? 0}`}>
                {seg.ayahs[0]?.numberInSurah === 1 ? (
                  <View style={styles.surahBand}>
                    <Text style={styles.surahBandArabic}>{seg.surah.name}</Text>
                    <Text style={styles.surahBandSub}>
                      {seg.surah.englishName} · {seg.surah.englishNameTranslation} ·{' '}
                      {seg.surah.revelationType === 'Meccan' ? s.mecca : s.medina}
                    </Text>
                    {seg.surah.number !== 1 && seg.surah.number !== 9 ? (
                      <Text style={styles.bismillah}>{BISMILLAH}</Text>
                    ) : null}
                  </View>
                ) : null}
                {showUrdu ? (
                  seg.ayahs.map((a) => (
                    <View key={a.number} style={styles.ayahBlock}>
                      <Text
                        style={[
                          styles.ayahText,
                          playingAyah === a.number && styles.ayahPlaying,
                        ]}
                      >
                        {a.text.trim()} {'\uFD3F'}
                        {a.numberInSurah}
                        {'\uFD3E'}
                      </Text>
                      {urduByGlobal.get(a.number) ? (
                        <Text style={styles.urduText}>{urduByGlobal.get(a.number)}</Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <Text style={styles.ayahFlow}>
                    {seg.ayahs.map((a) => (
                      <Text
                        key={a.number}
                        style={playingAyah === a.number ? styles.ayahPlaying : undefined}
                      >
                        {a.text.trim()} {'\uFD3F'}
                        {a.numberInSurah}
                        {'\uFD3E'}{' '}
                      </Text>
                    ))}
                  </Text>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.pageFooter}>
            {s.pageOf} {page} / {TOTAL_PAGES}
          </Text>
        </View>
      ) : null}

      {mushaf && !pageLoading ? (
        <>
          <View style={styles.audioCard}>
            <Text style={styles.audioTitle}>
              {audioMode === 'tilawat'
                ? s.listenTilawat
                : audioMode === 'urdu'
                  ? s.listenUrdu
                  : s.listenTilawat}
            </Text>
            {audioBusy ? (
              <ActivityIndicator color={C.teal} />
            ) : audioMode ? (
              <Pressable
                onPress={() => void stopAudio()}
                style={styles.peachBtn}
                accessibilityRole="button"
              >
                <Text style={styles.peachBtnText}>{s.stopAudio}</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => void startAudio('tilawat')}
                  style={styles.primaryBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>{s.listenTilawat}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void startAudio('urdu')}
                  style={styles.peachBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.peachBtnText}>{s.listenUrdu}</Text>
                </Pressable>
              </>
            )}
            {audioError ? <Text style={styles.error}>{audioError}</Text> : null}
            <Text style={styles.tinyNote}>{s.tilawatCredit}</Text>
            <Text style={styles.tinyNote}>{s.urduAudioCredit}</Text>
          </View>

          <Pressable
            onPress={() => void toggleUrdu()}
            style={styles.outlineBtn}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>
              {showUrdu ? s.hideUrdu : s.showUrdu}
            </Text>
          </Pressable>
          {urduLoading ? <ActivityIndicator color={C.teal} /> : null}
          {showUrdu ? (
            <Text style={styles.tinyNote}>
              {s.urduText}: {s.urduTextCredit}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void markPageRead()}
            disabled={markBusy}
            style={[styles.primaryBtn, markBusy && styles.btnDisabled]}
            accessibilityRole="button"
          >
            {markBusy ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.primaryBtnText}>{s.markPageRead}</Text>
            )}
          </Pressable>
          {markMsg ? <Text style={styles.infoMsg}>{markMsg}</Text> : null}

          <View style={styles.navRow}>
            <Pressable
              onPress={() => page > 1 && openReader(page - 1)}
              disabled={page <= 1}
              style={[styles.navBtn, page <= 1 && styles.btnDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnText}>{s.prev}</Text>
            </Pressable>
            <Pressable
              onPress={() => page < TOTAL_PAGES && openReader(page + 1)}
              disabled={page >= TOTAL_PAGES}
              style={[styles.navBtn, page >= TOTAL_PAGES && styles.btnDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.navBtnText}>{s.next}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>{s.jumpTo}</Text>
          <View style={styles.jumpRow}>
            <TextInput
              style={styles.jumpInput}
              value={jumpText}
              onChangeText={setJumpText}
              placeholder="1"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              onSubmitEditing={jumpToPage}
            />
            <Pressable
              onPress={jumpToPage}
              style={styles.jumpBtn}
              accessibilityRole="button"
            >
              <Text style={styles.jumpBtnText}>{s.go}</Text>
            </Pressable>
          </View>
          {jumpError ? <Text style={styles.error}>{jumpError}</Text> : null}

          <Text style={styles.tinyNote}>
            {s.source}: {ARABIC_SOURCE}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 18 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 12 },
  pageLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: C.teal900,
    textAlign: 'center',
    marginBottom: 12,
  },
  loader: { marginVertical: 40 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 18,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800', color: C.teal },
  statLabel: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 2 },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: C.peach2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: { height: 10, backgroundColor: C.teal, borderRadius: 5 },
  goalLine: { fontSize: 13, color: C.muted, marginBottom: 10 },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalChip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    backgroundColor: C.white,
  },
  goalChipOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  goalChipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  goalChipTextOn: { color: C.white },
  setGoalLabel: { fontSize: 12, color: C.muted },
  note: { fontSize: 14, lineHeight: 21, color: C.muted, marginBottom: 12 },
  tinyNote: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 10 },
  infoMsg: { fontSize: 13, color: C.teal2, textAlign: 'center', marginTop: 10 },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginVertical: 8 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  peachBtnText: { color: C.peachDeep, fontSize: 16, fontWeight: '800' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: C.teal,
    borderRadius: 999,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  outlineBtnText: { color: C.teal, fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 10 },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginBottom: 12,
  },
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
    borderRadius: 19,
    backgroundColor: C.peach2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  surahNumText: { fontSize: 15, fontWeight: '800', color: C.peachDeep },
  surahMeta: { flex: 1 },
  surahName: { fontSize: 16, fontWeight: '700', color: C.ink },
  surahSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  surahArabic: { fontSize: 20, color: C.teal },
  mushafFrame: {
    backgroundColor: C.white,
    borderWidth: 3,
    borderColor: C.teal,
    borderRadius: 8,
    padding: 6,
    marginBottom: 16,
  },
  mushafInner: {
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: '#FDFBF7',
  },
  surahBand: {
    backgroundColor: C.teal950,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  surahBandArabic: { fontSize: 24, color: C.white, textAlign: 'center' },
  surahBandSub: { fontSize: 12, color: '#B8CFCB', marginTop: 4, textAlign: 'center' },
  bismillah: {
    fontSize: 20,
    color: C.peach,
    textAlign: 'center',
    marginTop: 10,
  },
  ayahFlow: {
    fontSize: 24,
    lineHeight: 46,
    color: C.ink,
    textAlign: 'justify',
  },
  ayahBlock: { marginBottom: 14 },
  ayahText: {
    fontSize: 24,
    lineHeight: 44,
    color: C.ink,
    textAlign: 'right',
  },
  ayahPlaying: { color: C.teal2 },
  urduText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#3D4A46',
    textAlign: 'right',
    marginTop: 6,
  },
  pageFooter: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    marginTop: 14,
  },
  audioCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 18,
    marginBottom: 4,
  },
  audioTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 6 },
  navRow: { flexDirection: 'row', marginTop: 16 },
  navBtn: {
    flex: 1,
    backgroundColor: C.teal950,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  navBtnText: { color: C.white, fontSize: 15, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', color: C.ink, marginTop: 18, marginBottom: 6 },
  jumpRow: { flexDirection: 'row' },
  jumpInput: {
    flex: 1,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
    marginRight: 10,
  },
  jumpBtn: {
    backgroundColor: C.teal,
    borderRadius: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
});
