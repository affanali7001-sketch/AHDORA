/**
 * Now Playing — full-screen Quran audio player, music-app style.
 *
 * Opened by tapping the MiniPlayer bar. The CURRENT mushaf page
 * (from the global audio state's page) is the "album art" on top —
 * real Uthmani Arabic from AlQuran Cloud, rendered exactly like the
 * Quran Book reader (cream page, teal frame, surah band, circled
 * ayah markers, playing ayah highlighted). Below it: title,
 * progress + tap-to-seek bar, big transport controls, sleep timer,
 * auto-play, and a button back into the book. Nothing else.
 *
 * The audio itself lives in the global manager (src/lib/quranAudio);
 * this screen only subscribes and drives it — playback survives
 * navigation, and leaving this screen never stops it.
 *
 * Sleep timer: wired to the real API in quranAudio.ts —
 * setQuranSleepTimer(option) where the option is null (Off),
 * { kind: 'minutes', minutes } or { kind: 'para-end' }. The
 * manager's state.sleepTimer is the human label ("15 min" /
 * "Para khatm"); getQuranSleepTimer() returns the live option.
 *
 * Labels: global strings (stringsFor) where they exist; the few
 * labels with no global key live in the local STRINGS record below,
 * the same pattern QuranBook.tsx uses for its own screen-local
 * labels. strings.ts itself is untouched.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Chip, EmptyState, PillButton, Switch } from '../components/ui';
import {
  getQuranAudioState,
  getQuranSleepTimer,
  nextQuranAyah,
  prevQuranAyah,
  seekQuranBy,
  seekQuranTo,
  setQuranAutoPlay,
  setQuranSleepTimer,
  startQuranPage,
  stopQuranAudio,
  subscribeQuranAudio,
  toggleQuranAudio,
  type QuranAudioState,
  type QuranSleepTimerOption,
} from '../lib/quranAudio';
import {
  fetchMushafPage,
  type MushafAyah,
  type MushafPage,
  type MushafSurahRef,
} from '../lib/apiWorship';

const BISMILLAH = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
/* Preview-mandated mushaf colours — same values as QuranBook.tsx. */
const MUSHAF_BG = '#FFFDF6';
const MUSHAF_INK = '#1C1A15';

/** Screen-local labels with no global key in strings.ts. */
const STRINGS: Record<
  AppLanguage,
  {
    emptyTitle: string;
    emptyBody: string;
    autoPlay: string;
    autoPlayNote: string;
    sleepOff: string;
    sleep15: string;
    sleep30: string;
    sleep60: string;
    sleepPara: string;
    sleepPending: string;
    sleepStopsIn: (v: string) => string;
    sleepStopsPara: string;
  }
> = {
  en: {
    emptyTitle: 'No audio is playing right now',
    emptyBody: 'Play a page from the Quran Book and the player will show here.',
    autoPlay: 'Auto-play',
    autoPlayNote:
      'Tilawat → Urdu tarjuma → next page, automatically. The page is marked as done.',
    sleepOff: 'Off',
    sleep15: '15 min',
    sleep30: '30 min',
    sleep60: '1 hour',
    sleepPara: 'Para end',
    sleepPending: 'Sleep timer is coming soon — the controls above already work.',
    sleepStopsIn: (v: string) => `Stops in ${v}.`,
    sleepStopsPara: 'Stops when this para ends.',
  },
  hi: {
    emptyTitle: 'Abhi koi audio nahi chal raha hai',
    emptyBody: 'Quran Book se koi page chalao, phir yahan player dikhega.',
    autoPlay: 'Auto-play',
    autoPlayNote:
      'Tilawat → Urdu tarjuma → agla page, apne aap. Page padha hua mark ho jayega.',
    sleepOff: 'Band',
    sleep15: '15 min',
    sleep30: '30 min',
    sleep60: '1 ghanta',
    sleepPara: 'Paara khatm',
    sleepPending: 'Sleep timer jald aa raha hai — upar wale controls pehle se kaam karte hain.',
    sleepStopsIn: (v: string) => `${v} baad band ho jayega.`,
    sleepStopsPara: 'Paara khatm hote hi band ho jayega.',
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

/* ------------------------------------------------------------------ */
/* Sleep timer — real API in quranAudio.ts                             */
/* ------------------------------------------------------------------ */

/** One sleep-timer choice: minutes, stop at the end of the para, or off. */
type SleepChoice = number | 'para-end' | null;

const SLEEP_OPTIONS: { value: SleepChoice; key: 'sleepOff' | 'sleep15' | 'sleep30' | 'sleep60' | 'sleepPara' }[] = [
  { value: null, key: 'sleepOff' },
  { value: 15, key: 'sleep15' },
  { value: 30, key: 'sleep30' },
  { value: 60, key: 'sleep60' },
  { value: 'para-end', key: 'sleepPara' },
];

/* ------------------------------------------------------------------ */
/* Mushaf page — same rendering as the Quran Book reader               */
/* ------------------------------------------------------------------ */

function MushafPageView({
  page,
  playingAyah,
}: {
  page: MushafPage;
  playingAyah: number | null;
}) {
  const segments: { surah: MushafSurahRef; ayahs: MushafAyah[] }[] = [];
  for (const a of page.ayahs) {
    const last = segments[segments.length - 1];
    if (last && last.surah.number === a.surah.number) last.ayahs.push(a);
    else segments.push({ surah: a.surah, ayahs: [a] });
  }
  const firstAyah = page.ayahs[0];
  const firstSeg = segments[0];
  return (
    <View style={styles.mushaf}>
      <View style={styles.mushafInner}>
        <View style={styles.stripe} />
        <Text style={styles.pageNo}>— {page.number} —</Text>
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
                    style={playingAyah === a.number ? styles.ayahPlaying : undefined}
                  >
                    {a.text.trim()}{' '}
                    <Text style={styles.marker}> {toArabicIndic(a.numberInSurah)} </Text>{' '}
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
          <Text style={styles.footText}>PAGE {page.number}</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

export default function NowPlayingScreen({ lang, goTo }: ScreenProps) {
  const shared = stringsFor(lang);
  const s = STRINGS[lang];
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());

  useEffect(() => subscribeQuranAudio(setAudio), []);

  /* --- mushaf page for the currently playing page (cached per page) --- */
  const pageCache = useRef(new Map<number, MushafPage>());
  const [pageData, setPageData] = useState<MushafPage | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const page = audio.page;
  useEffect(() => {
    const cached = pageCache.current.get(page);
    if (cached) {
      setPageData(cached);
      setPageLoading(false);
      setPageError(null);
      return;
    }
    let cancelled = false;
    setPageData(null);
    setPageLoading(true);
    setPageError(null);
    void fetchMushafPage(page)
      .then((data) => {
        if (cancelled) return;
        pageCache.current.set(page, data);
        setPageData(data);
        setPageLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setPageError(
          e instanceof Error ? e.message : 'Page load nahi ho paya. Dobara try karo.',
        );
        setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick]);

  /* --- seek bar --- */
  const [trackWidth, setTrackWidth] = useState(0);
  const pct =
    audio.duration > 0 ? Math.min(1, Math.max(0, audio.time / audio.duration)) : 0;

  /* --- sleep timer (real API in quranAudio.ts) --- */
  // The manager's state.sleepTimer is a label string ("15 min" /
  // "Para khatm"); the live option comes from getQuranSleepTimer().
  // The chips below work with the UI choice (minutes | 'para-end' |
  // null) and chooseSleep converts it to the manager's option shape.
  const liveTimer = getQuranSleepTimer();
  const activeTimer: SleepChoice =
    liveTimer === null
      ? null
      : liveTimer.kind === 'para-end'
        ? 'para-end'
        : liveTimer.minutes;

  function chooseSleep(value: SleepChoice) {
    const option: QuranSleepTimerOption =
      value === null
        ? null
        : value === 'para-end'
          ? { kind: 'para-end' }
          : { kind: 'minutes', minutes: value };
    try {
      setQuranSleepTimer(option);
    } catch {
      /* Never break the screen. */
    }
  }

  const sleepStatus =
    activeTimer === null
      ? null
      : activeTimer === 'para-end'
        ? s.sleepStopsPara
        : s.sleepStopsIn(`${activeTimer} min`);

  if (!audio.hasAudio) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
        <EmptyState title={s.emptyTitle} body={s.emptyBody} />
        <View style={styles.emptyBtn}>
          <PillButton
            label={shared.openQuran}
            variant="primary"
            block
            onPress={() => goTo('quran')}
          />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={L.scroll}>
      {pageLoading ? (
        <ActivityIndicator color={C.teal500} size="large" style={styles.loader} />
      ) : pageError ? (
        <View style={styles.errorCard}>
          <Text style={T.error}>{pageError}</Text>
          <PillButton
            label={shared.retry}
            variant="primary"
            block
            onPress={() => setReloadTick((t) => t + 1)}
          />
        </View>
      ) : pageData ? (
        <MushafPageView page={pageData} playingAyah={audio.playingAyah} />
      ) : null}

      <Text style={styles.trackTitle}>{audio.title || 'Quran audio'}</Text>

      <Pressable
        onPress={(e) => {
          if (trackWidth <= 0 || audio.duration <= 0) return;
          const fraction = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth));
          seekQuranTo(fraction * audio.duration);
        }}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={styles.seekTouch}
        accessibilityLabel="Seek"
      >
        <View style={styles.seekTrack}>
          <View style={[styles.seekFill, { width: `${pct * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {audio.busy ? shared.loading : fmtTime(audio.time)}
        </Text>
        <Text style={styles.timeText}>{fmtTime(audio.duration)}</Text>
      </View>
      {audio.error ? <Text style={T.error}>{audio.error}</Text> : null}

      <View style={styles.controls}>
        <Pressable
          onPress={() => prevQuranAyah()}
          style={styles.ctrlBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous ayah"
        >
          <Text style={styles.ctrlIcon}>⏮</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleQuranAudio()}
          style={[styles.ctrlBtn, styles.playBtn]}
          accessibilityRole="button"
          accessibilityLabel={audio.playing ? 'Pause' : 'Play'}
        >
          {audio.busy ? (
            <ActivityIndicator color={C.peachText} size="large" />
          ) : (
            <Text style={[styles.ctrlIcon, styles.playIcon]}>
              {audio.playing ? '⏸' : '▶'}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => nextQuranAyah()}
          style={styles.ctrlBtn}
          accessibilityRole="button"
          accessibilityLabel="Next ayah"
        >
          <Text style={styles.ctrlIcon}>⏭</Text>
        </Pressable>
        <Pressable
          onPress={() => stopQuranAudio()}
          style={styles.ctrlBtn}
          accessibilityRole="button"
          accessibilityLabel="Stop audio"
        >
          <Text style={styles.ctrlIcon}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.seekRow}>
        <PillButton label="−10s" variant="ghost" small onPress={() => seekQuranBy(-10)} />
        <PillButton label="+10s" variant="ghost" small onPress={() => seekQuranBy(10)} />
      </View>

      {/* Next page — music-app style: the play button is above, and
          right below it a clear way to the next page (the user asked
          for it here, 2026-11-22). Starts the next page playing in
          the same mode; hidden on the last page. */}
      {audio.page < 604 ? (
        <View style={styles.nextPageBtn}>
          <PillButton
            label={shared.nextPage}
            variant="peach"
            block
            onPress={() => void startQuranPage(audio.page + 1, audio.mode ?? 'tilawat')}
          />
        </View>
      ) : null}

      <View style={styles.sleepCard}>
        <View style={styles.sleepHead}>
          <Text style={styles.sleepTitle}>{shared.sleepTitle}</Text>
          {sleepStatus ? <Text style={styles.sleepStatus}>{sleepStatus}</Text> : null}
        </View>
        <View style={styles.chipRow}>
          {SLEEP_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={s[opt.key]}
              selected={activeTimer === opt.value}
              onPress={() => chooseSleep(opt.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.autoRow}>
        <View style={styles.autoText}>
          <Text style={styles.autoTitle}>{s.autoPlay}</Text>
          <Text style={styles.autoNote}>{s.autoPlayNote}</Text>
        </View>
        <Switch value={audio.autoPlay} onValueChange={setQuranAutoPlay} />
      </View>

      <View style={styles.openBtn}>
        <PillButton
          label={shared.openQuran}
          variant="peach"
          block
          onPress={() => goTo('reader')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  loader: { marginVertical: 40 },
  emptyBtn: { marginTop: 16 },
  errorCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    padding: 16,
    marginTop: 14,
  },
  /* ---- Mushaf page (same values as QuranBook.tsx) ---- */
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
    lineHeight: 53,
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
  /* ---- Track / progress ---- */
  trackTitle: {
    fontFamily: F.sans,
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
    marginTop: 18,
    textAlign: 'center',
  },
  seekTouch: {
    height: 28,
    justifyContent: 'center',
    marginTop: 10,
  },
  seekTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: C.teal100,
    overflow: 'hidden',
  },
  seekFill: { height: 6, borderRadius: 999, backgroundColor: C.teal500 },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: { fontFamily: F.sans, fontSize: 12.5, color: C.muted },
  /* ---- Controls ---- */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 18,
  },
  ctrlBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.peachMid,
    borderWidth: 0,
  },
  ctrlIcon: { fontSize: 22, color: C.teal900, textAlign: 'center' },
  playIcon: { fontSize: 28, color: C.peachText },
  seekRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  nextPageBtn: { marginTop: 14 },
  /* ---- Sleep timer ---- */
  sleepCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    padding: 14,
    marginTop: 16,
  },
  sleepHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  sleepTitle: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '800', color: C.ink },
  sleepStatus: { fontFamily: F.sans, fontSize: 12.5, color: C.teal500, textAlign: 'right' },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  /* ---- Auto-play ---- */
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
  autoText: { flex: 1 },
  autoTitle: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '700', color: C.ink },
  autoNote: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  openBtn: { marginTop: 16 },
});
