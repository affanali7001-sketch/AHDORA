/**
 * Tilawah player — the Quran audio player for the Quran Book, the
 * 30-Para reader and Now Playing. ONE component, same UI everywhere.
 *
 * Layout (rebuilt from scratch in AHDORA's own code to match the
 * layout of Mihrab's Tilawah player — see
 * src/screens/quran/TilawahScreen.tsx in MihrabHQ/Mihrab, and the
 * screenshot the user sent: a compact dark card, top to bottom):
 *   1. small label ("Playing through" / "Paused" / "Tap play…") +
 *      a round dismiss (stop) button at the top right;
 *   2. BIG surah name on the left, Arabic surah name on the right,
 *      same row;
 *   3. reciter name as a tappable row ("Name >") — opens the
 *      reciter picker panel;
 *   4. thin seek bar WITH a round handle (the current ayah —
 *      drag it to seek inside the ayah), time "elapsed / total"
 *      right-aligned under it;
 *   5. "Ayah X of Y" label + a thin progress bar under it
 *      (progress through the surah's ayahs — display only);
 *   6. transport, five in this order: prev-SURAH "<" chevron,
 *      prev-ayah skip-back, BIG round central play/pause, next-ayah
 *      skip-forward, next-SURAH ">" chevron;
 *   7. one row of small pills: speed ("1×", cycles), "Sleep
 *      timer" (opens the sleep choices), repeat (cycles
 *      off → ayah → surah), reciter (opens the "Choose reciter"
 *      sheet — search + preview in that voice), list (opens the
 *      surah list). There is NO cast pill: no real casting
 *      exists, so none is shown. Mihrab palette: dark navy card,
 *      cream-white text, light-blue play button and fills.
 *
 * Everything here is real state from the global manager
 * (src/lib/quranAudio.ts): tilawat stays EveryAyah in the picked
 * reciter, the Urdu tarjuma voice stays Shamshad Ali Khan, and the
 * tilawat → tarjuma → next-page chain is untouched. The extra
 * AHDORA controls the screenshot has no room for — tilawat/tarjuma
 * mode, auto-play, translation text — live in the reciter panel
 * that the reciter row / cast pill opens; nothing was removed.
 *
 * Prev/next SURAH is real: it fetches that surah's first mushaf
 * page (AlQuran Cloud, the same source as the reader) and starts
 * its tilawat — it does not fake a jump by turning a page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, S } from '../lib/theme';
import { Chip, Input, PillButton, Switch } from './ui';
import {
  QURAN_PLAYBACK_RATES,
  QURAN_RECITERS,
  getQuranAudioState,
  getQuranSleepTimer,
  nextQuranAyah,
  prevQuranAyah,
  reciterFor,
  seekQuranBy,
  seekQuranTo,
  setQuranAutoPlay,
  setQuranPlaybackRate,
  setQuranReciter,
  setQuranRepeatMode,
  setQuranSleepTimer,
  startQuranPage,
  stopQuranAudio,
  subscribeQuranAudio,
  toggleQuranAudio,
  type QuranAudioState,
  type QuranRepeatMode,
  type QuranSleepTimerOption,
} from '../lib/quranAudio';
import { fetchSurahFirstPage, type MushafAyah } from '../lib/apiWorship';

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const REPEAT_CYCLE: QuranRepeatMode[] = ['off', 'ayah', 'surah'];

type SleepChip = {
  value: QuranSleepTimerOption;
  labelKey:
    | 'tilawahSleepOff'
    | 'tilawahSleep5'
    | 'tilawahSleep10'
    | 'tilawahSleep15'
    | 'tilawahSleep30'
    | 'tilawahSleep60'
    | 'tilawahSleepSurah'
    | 'tilawahSleepPara';
};

const SLEEP_CHIPS: SleepChip[] = [
  { value: null, labelKey: 'tilawahSleepOff' },
  { value: { kind: 'minutes', minutes: 5 }, labelKey: 'tilawahSleep5' },
  { value: { kind: 'minutes', minutes: 10 }, labelKey: 'tilawahSleep10' },
  { value: { kind: 'minutes', minutes: 15 }, labelKey: 'tilawahSleep15' },
  { value: { kind: 'minutes', minutes: 30 }, labelKey: 'tilawahSleep30' },
  { value: { kind: 'minutes', minutes: 60 }, labelKey: 'tilawahSleep60' },
  { value: { kind: 'surah-end' }, labelKey: 'tilawahSleepSurah' },
  { value: { kind: 'para-end' }, labelKey: 'tilawahSleepPara' },
];

function sameSleepOption(
  a: QuranSleepTimerOption,
  b: QuranSleepTimerOption,
): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'minutes' && b.kind === 'minutes') return a.minutes === b.minutes;
  return a.kind === b.kind;
}

/**
 * A bar you can drag. Takes a ratio and hands one back — the ayah
 * seek bar uses it for time/duration. While a finger is down the
 * fill follows the FINGER, not the player, or the next progress
 * tick yanks the thumb back to where playback still is.
 */
function Scrubber({
  ratio,
  onSeekRatio,
  label,
}: {
  ratio: number;
  onSeekRatio: (ratio: number) => void;
  label: string;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const widthRef = useRef(0);
  widthRef.current = width;
  const seekRef = useRef(onSeekRatio);
  seekRef.current = onSeekRatio;

  const ratioAt = (x: number): number => {
    const w = widthRef.current;
    if (w <= 0) return 0;
    return Math.max(0, Math.min(1, x / w));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setDragging(ratioAt(e.nativeEvent.locationX)),
        onPanResponderMove: (e) => setDragging(ratioAt(e.nativeEvent.locationX)),
        onPanResponderRelease: (e) => {
          const at = ratioAt(e.nativeEvent.locationX);
          setDragging(null);
          seekRef.current(at);
        },
        onPanResponderTerminate: () => setDragging(null),
      }),
    [],
  );

  const shown = dragging ?? Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      style={styles.scrubTouch}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View style={styles.scrubTrack}>
        <View style={[styles.scrubFill, { width: `${shown * 100}%` }]} />
      </View>
      <View style={[styles.scrubThumb, { left: `${shown * 100}%` }]} />
    </View>
  );
}

export default function TilawahPlayer({
  lang,
  page,
  ayahs,
  showTranslation,
  onTranslationChange,
  followPaused = false,
  onFollowResume = () => undefined,
  showTranslationToggle = true,
  onOpenList,
}: {
  lang: AppLanguage;
  page: number;
  /** Ayahs of the page being read — the idle surah name + ayah count. */
  ayahs: MushafAyah[];
  showTranslation: boolean;
  onTranslationChange: (show: boolean) => void;
  /** The reader paused auto-follow after a manual navigation. */
  followPaused?: boolean;
  /** Resume auto-follow (jump to the playing page). */
  onFollowResume?: () => void;
  /** Now Playing shows no tarjuma text, so its translation toggle
   * is hidden rather than offered as a dead switch. */
  showTranslationToggle?: boolean;
  /** Open the surah list (the list pill). */
  onOpenList: () => void;
}) {
  const s = stringsFor(lang);
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());
  useEffect(() => subscribeQuranAudio(setAudio), []);
  const [panel, setPanel] = useState<'none' | 'reciter' | 'sleep'>('none');
  const [surahNavBusy, setSurahNavBusy] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [reciterQuery, setReciterQuery] = useState('');
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);

  // Audio is live somewhere (this page or another) when a queue is
  // loaded. The scrubbers + labels follow the LIVE audio, not the
  // page prop — the voice must never look idle while it plays.
  const audioActive = audio.hasAudio && audio.mode !== null;
  const onThisPage = audioActive && audio.page === page;
  const time = audioActive ? audio.time : 0;
  const duration = audioActive ? audio.duration : 0;
  const ayahPct = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const liveTimer = getQuranSleepTimer();

  // The surah on screen: the playing ayah's surah while audio is
  // live, else the first surah of the page being read.
  const firstAyah = ayahs[0] ?? null;
  const surahName = audio.playingSurahName ?? firstAyah?.surah.englishName ?? null;
  const surahArabic = audio.playingSurahArabic ?? firstAyah?.surah.name ?? null;
  const currentSurah = audio.playingSurah ?? firstAyah?.surah.number ?? null;

  const topLabel = !audioActive
    ? s.tilawahPlayPage
    : audio.playing
      ? s.tilawahPlayingThrough
      : s.tilawahPaused;

  // "Ayah X of Y" — progress through the SURAH's ayahs, as the
  // screenshot shows it (not the page): the manager knows the
  // playing ayah's number inside its surah and the surah's total.
  const ayahOfLabel = (() => {
    if (audioActive && audio.playingSurahAyahs && audio.playingAyahInSurah) {
      const done = audio.playingAyahInSurah;
      const total = audio.playingSurahAyahs;
      return lang === 'en'
        ? `${s.tilawahAyahWord} ${done} of ${total}`
        : `${s.tilawahAyahWord} ${done} / ${total}`;
    }
    if (audioActive && audio.playingAyahInSurah) {
      return `${s.tilawahAyahWord} ${audio.playingAyahInSurah}`;
    }
    if (firstAyah) {
      return `${firstAyah.surah.englishName} · ${firstAyah.surah.numberOfAyahs} ayahs`;
    }
    return `Page ${page}`;
  })();
  const surahPct = (() => {
    if (
      audioActive &&
      audio.playingSurahAyahs &&
      audio.playingAyahInSurah &&
      audio.playingSurahAyahs > 0
    ) {
      return Math.min(
        1,
        Math.max(0, (audio.playingAyahInSurah - 1 + ayahPct) / audio.playingSurahAyahs),
      );
    }
    if (audioActive && audio.queueLength > 0) {
      return Math.min(
        1,
        Math.max(0, (audio.queueIndex + ayahPct) / audio.queueLength),
      );
    }
    return 0;
  })();

  function onPlayPause(): void {
    if (audioActive) {
      // Play is resume/pause for whatever is loaded — the label
      // above names it, so this never silently starts another page.
      toggleQuranAudio();
    } else {
      void startQuranPage(page, 'tilawat');
    }
  }

  function onMode(mode: 'tilawat' | 'urdu'): void {
    if (onThisPage && audio.mode === mode) {
      toggleQuranAudio();
    } else {
      // The mode pills mean "play THIS page" — the page in front
      // of the user, in that voice.
      void startQuranPage(page, mode);
    }
  }

  /** Prev/next SURAH (the outer chevrons): fetch that surah's
   * first mushaf page and start its tilawat there. Real navigation,
   * not a page turn. */
  async function jumpSurah(dir: -1 | 1): Promise<void> {
    if (currentSurah === null || surahNavBusy) return;
    const target = currentSurah + dir;
    if (target < 1 || target > 114) return;
    setSurahNavBusy(true);
    setNavError(null);
    try {
      const firstPage = await fetchSurahFirstPage(target);
      await startQuranPage(firstPage, audio.mode ?? 'tilawat');
    } catch {
      setNavError(s.loadFailed);
    } finally {
      setSurahNavBusy(false);
    }
  }

  function cycleRate(): void {
    const idx = QURAN_PLAYBACK_RATES.findIndex((r) => r === audio.playbackRate);
    const next =
      QURAN_PLAYBACK_RATES[(idx + 1) % QURAN_PLAYBACK_RATES.length] ?? 1;
    setQuranPlaybackRate(next);
  }

  function cycleRepeat(): void {
    const idx = REPEAT_CYCLE.indexOf(audio.repeatMode);
    setQuranRepeatMode(REPEAT_CYCLE[(idx + 1) % REPEAT_CYCLE.length] ?? 'off');
  }

  function cycleSleep(): void {
    // The sleep pill opens the choices (see the panel below); the
    // chips there pick the timer.
    setPanel((p) => (p === 'sleep' ? 'none' : 'sleep'));
  }

  /** Preview a reciter for real: switch the voice, then play THIS
   * page in it — the listener hears that exact voice on the page
   * in front of them. No sample file is faked. */
  async function previewReciter(id: string): Promise<void> {
    if (previewBusyId !== null) return;
    setPreviewBusyId(id);
    try {
      await setQuranReciter(id);
      await startQuranPage(page, audio.mode ?? 'tilawat');
    } finally {
      setPreviewBusyId(null);
    }
  }

  const filteredReciters = QURAN_RECITERS.filter((r) => {
    const q = reciterQuery.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q);
  });

  const repeatLabel =
    audio.repeatMode === 'ayah'
      ? s.tilawahRepeatAyah
      : audio.repeatMode === 'surah'
        ? s.tilawahRepeatSurah
        : s.tilawahRepeatOff;

  // The player card stays dark navy in both themes — the Mihrab
  // Tilawah card (sampled #232C49, 11-33-42-51), never the green.
  const cardBg = C.navy;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* 1 — label + dismiss (stop) at the top right. */}
      <View style={styles.topRow}>
        <Text style={styles.topLabel} numberOfLines={1}>
          {topLabel}
        </Text>
        {audioActive ? (
          <Pressable
            onPress={() => stopQuranAudio()}
            style={styles.dismissBtn}
            accessibilityRole="button"
            accessibilityLabel="Stop audio"
            hitSlop={8}
          >
            <Text style={styles.dismissGlyph}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 2 — BIG surah name left, Arabic name right, same row. */}
      <View style={styles.namesRow}>
        <Text style={styles.surahName} numberOfLines={1}>
          {surahName ?? 'Quran Book'}
        </Text>
        {surahArabic ? (
          <Text style={styles.surahArabic} numberOfLines={1}>
            {surahArabic}
          </Text>
        ) : null}
      </View>

      {/* 3 — reciter row: a choice, reads as one — name + chevron. */}
      <Pressable
        onPress={() => setPanel((p) => (p === 'reciter' ? 'none' : 'reciter'))}
        style={styles.reciterLine}
        accessibilityRole="button"
        accessibilityLabel={s.reciterTitle}
        hitSlop={8}
      >
        <Text style={styles.reciterName} numberOfLines={1}>
          {reciterFor(audio.reciterId).name}
        </Text>
        <Text style={styles.reciterChevron}>›</Text>
      </Pressable>

      {/* 4 — ayah seek bar (drag it) + elapsed / total on the right. */}
      <Scrubber
        ratio={ayahPct}
        onSeekRatio={(r) => {
          if (audioActive && duration > 0) seekQuranTo(r * duration);
        }}
        label={s.tilawahSeekAyah}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>
          {audio.busy && audioActive ? s.audioLoading : ''}
        </Text>
        <Text style={styles.timeText}>
          {duration > 0 ? `${fmtTime(time)} / ${fmtTime(duration)}` : `Page ${page}`}
        </Text>
      </View>
      {audio.error ? <Text style={styles.error}>{audio.error}</Text> : null}
      {navError ? <Text style={styles.error}>{navError}</Text> : null}

      {/* 5 — "Ayah X of Y" + thin surah-progress bar under it. */}
      <Text style={styles.ayahOf}>{ayahOfLabel}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${surahPct * 100}%` }]} />
      </View>

      {/* 6 — transport: prev surah, prev ayah, big play, next ayah,
          next surah. Left-to-right in every language, as media
          controls are on both platforms. */}
      <View style={styles.transport}>
        <Pressable
          onPress={() => void jumpSurah(-1)}
          disabled={
            currentSurah === null || currentSurah <= 1 || surahNavBusy
          }
          style={styles.transportBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous surah"
          hitSlop={10}
        >
          <Text
            style={[
              styles.surahStepGlyph,
              (currentSurah === null || currentSurah <= 1) && styles.glyphDim,
            ]}
          >
            ‹
          </Text>
        </Pressable>
        <Pressable
          onPress={() => prevQuranAyah()}
          disabled={!audioActive}
          style={styles.transportBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous ayah"
          hitSlop={10}
        >
          <Text style={[styles.ayahStepGlyph, !audioActive && styles.glyphDim]}>
            ⏮
          </Text>
        </Pressable>
        <Pressable
          onPress={onPlayPause}
          style={styles.playBtn}
          accessibilityRole="button"
          accessibilityLabel={audio.playing ? 'Pause' : 'Play'}
          hitSlop={6}
        >
          {audio.busy && audioActive ? (
            <ActivityIndicator color={C.white} size="large" />
          ) : (
            <Text style={styles.playGlyph}>{audio.playing ? '❚❚' : '▶'}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => nextQuranAyah()}
          disabled={!audioActive}
          style={styles.transportBtn}
          accessibilityRole="button"
          accessibilityLabel="Next ayah"
          hitSlop={10}
        >
          <Text style={[styles.ayahStepGlyph, !audioActive && styles.glyphDim]}>
            ⏭
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void jumpSurah(1)}
          disabled={
            currentSurah === null || currentSurah >= 114 || surahNavBusy
          }
          style={styles.transportBtn}
          accessibilityRole="button"
          accessibilityLabel="Next surah"
          hitSlop={10}
        >
          <Text
            style={[
              styles.surahStepGlyph,
              (currentSurah === null || currentSurah >= 114) && styles.glyphDim,
            ]}
          >
            ›
          </Text>
        </Pressable>
      </View>

      {/* 7 — one quiet row of pills: speed, sleep, repeat, reciter
          (opens the "Choose reciter" sheet), list. No cast pill:
          there is no real casting, so none is shown. */}
      <View style={styles.optionsRow}>
        <Pressable
          onPress={cycleRate}
          style={[styles.pill, audio.playbackRate !== 1 && styles.pillOn]}
          accessibilityRole="button"
          accessibilityLabel={s.tilawahSpeed}
        >
          <Text style={[styles.pillText, audio.playbackRate !== 1 && styles.pillTextOn]}>
            {`${audio.playbackRate}×`}
          </Text>
        </Pressable>
        <Pressable
          onPress={cycleSleep}
          style={[styles.pill, liveTimer !== null && styles.pillOn]}
          accessibilityRole="button"
          accessibilityLabel={s.tilawahSleep}
        >
          <Text style={[styles.pillText, liveTimer !== null && styles.pillTextOn]}>
            {s.tilawahSleep}
          </Text>
        </Pressable>
        <Pressable
          onPress={cycleRepeat}
          style={[styles.pill, audio.repeatMode !== 'off' && styles.pillOn]}
          accessibilityRole="button"
          accessibilityLabel={s.tilawahRepeat}
        >
          <Text style={[styles.pillText, audio.repeatMode !== 'off' && styles.pillTextOn]}>
            ↻ {repeatLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPanel((p) => (p === 'reciter' ? 'none' : 'reciter'))}
          style={styles.pill}
          accessibilityRole="button"
          accessibilityLabel={s.reciterTitle}
        >
          <Text style={styles.pillText}>♪</Text>
        </Pressable>
        <Pressable
          onPress={onOpenList}
          style={styles.pill}
          accessibilityRole="button"
          accessibilityLabel="Surah list"
        >
          <Text style={styles.pillText}>☰</Text>
        </Pressable>
      </View>
      {audio.sleepTimer ? (
        <Text style={styles.sleepStatus}>
          {s.tilawahSleep}: {audio.sleepTimer}
        </Text>
      ) : null}

      {/* Follow — only while the reader paused it after a manual
          navigation. Tapping jumps back to the playing page. */}
      {followPaused ? (
        <View style={styles.followWrap}>
          <PillButton
            label={s.tilawahFollow}
            small
            variant="peach"
            block
            onPress={onFollowResume}
          />
        </View>
      ) : null}

      {/* Sleep choices — opened by the "Sleep timer" pill. */}
      {panel === 'sleep' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{s.tilawahSleep}</Text>
          <View style={styles.chipRow}>
            {SLEEP_CHIPS.map((chip) => (
              <Chip
                key={chip.labelKey}
                label={s[chip.labelKey]}
                selected={sameSleepOption(liveTimer, chip.value)}
                onPress={() => {
                  setQuranSleepTimer(chip.value);
                  setPanel('none');
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* "Choose reciter" sheet (Mihrab layout): search + a row
          per reciter — tap the row to pick it (applies from the
          next play), tap Preview to hear THIS page in that voice
          right now. No download button: offline reciter downloads
          are not built, so none is shown. The AHDORA controls the
          screenshot has no room for — tilawat/tarjuma mode,
          auto-play, translation text — live below the list;
          nothing was removed. */}
      {panel === 'reciter' ? (
        <View style={styles.panel}>
          <View style={styles.sheetHead}>
            <Text style={styles.panelTitle}>{s.tilawahChooseReciter}</Text>
            <Pressable
              onPress={() => setPanel('none')}
              style={styles.dismissBtn}
              accessibilityRole="button"
              accessibilityLabel={s.understandClose}
              hitSlop={8}
            >
              <Text style={styles.dismissGlyph}>✕</Text>
            </Pressable>
          </View>
          <Input
            value={reciterQuery}
            onChangeText={setReciterQuery}
            placeholder={s.tilawahSearchReciters}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.credit}>{s.tilawahPreviewNote}</Text>
          <ScrollView
            style={styles.reciterList}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {filteredReciters.length === 0 ? (
              <Text style={styles.credit}>{s.tilawahNoReciters}</Text>
            ) : (
              filteredReciters.map((r) => {
                const selected = audio.reciterId === r.id;
                const previewing = previewBusyId === r.id;
                return (
                  <View
                    key={r.id}
                    style={[styles.reciterRow, selected && styles.reciterRowOn]}
                  >
                    <Pressable
                      onPress={() => void setQuranReciter(r.id)}
                      style={styles.reciterMain}
                      accessibilityRole="button"
                      accessibilityLabel={r.name}
                    >
                      <Text style={styles.reciterRowName} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={styles.reciterRowMeta}>{r.bitrate} · EveryAyah</Text>
                    </Pressable>
                    {selected ? <Text style={styles.reciterCheck}>✓</Text> : null}
                    <Pressable
                      onPress={() => void previewReciter(r.id)}
                      disabled={previewBusyId !== null}
                      style={styles.previewBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.tilawahPreview} ${r.name}`}
                      hitSlop={6}
                    >
                      {previewing ? (
                        <ActivityIndicator color={C.navy} size="small" />
                      ) : (
                        <Text style={styles.previewGlyph}>▶</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
          <Text style={styles.credit}>{s.reciterNote}</Text>

          <Text style={styles.panelTitle}>{s.tilawahTilawat} / {s.tilawahTarjuma}</Text>
          <View style={styles.modeRow}>
            <PillButton
              label={s.tilawahTilawat}
              small
              variant={audio.mode === 'tilawat' && onThisPage ? 'primary' : 'ghost'}
              onPress={() => onMode('tilawat')}
            />
            <PillButton
              label={s.tilawahTarjuma}
              small
              variant={audio.mode === 'urdu' && onThisPage ? 'primary' : 'ghost'}
              onPress={() => onMode('urdu')}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={styles.switchTitle}>{s.autoPlay}</Text>
              <Text style={styles.switchNote}>{s.autoPlayNote}</Text>
            </View>
            <Switch value={audio.autoPlay} onValueChange={setQuranAutoPlay} />
          </View>
          {showTranslationToggle ? (
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.switchTitle}>
                  {showTranslation ? s.tilawahHideTarjuma : s.tilawahShowTarjuma}
                </Text>
                <Text style={styles.switchNote}>{s.rdTarjumaH}</Text>
              </View>
              <Switch value={showTranslation} onValueChange={onTranslationChange} />
            </View>
          ) : null}
          <View style={styles.skipRow}>
            <PillButton
              label="−10s"
              small
              variant="ghost"
              onPress={() => seekQuranBy(-10)}
            />
            <PillButton
              label="+10s"
              small
              variant="ghost"
              onPress={() => seekQuranBy(10)}
            />
          </View>
          <Text style={styles.credit}>
            Tilawat: {reciterFor(audio.reciterId).name} (EveryAyah) ·{' '}
            {reciterFor(audio.reciterId).bitrate}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: C.teal950,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  /* 1 — top label + dismiss. */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLabel: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.navInactive,
    flexShrink: 1,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissGlyph: { fontSize: 13, color: C.navInactive, textAlign: 'center' },
  /* 2 — surah names. */
  namesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  surahName: {
    fontFamily: F.sans,
    fontSize: 26,
    fontWeight: '800',
    color: C.white,
    flexShrink: 1,
  },
  surahArabic: { fontFamily: F.arabic, fontSize: 24, color: C.white, flexShrink: 0 },
  /* 3 — reciter row: a choice, not a card. */
  reciterLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  reciterName: { fontFamily: F.sans, fontSize: 14, color: C.skyBlue },
  reciterChevron: { fontSize: 16, color: C.skyBlue },
  /* 4 — ayah seek bar (draggable, thumb) + time. */
  scrubTouch: { height: 28, justifyContent: 'center', marginTop: 8 },
  scrubTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  scrubFill: { height: 5, borderRadius: 2.5, backgroundColor: C.skyBlue },
  scrubThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.skyBlue,
    marginLeft: -6,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeText: { fontFamily: F.sans, fontSize: 12.5, color: C.navInactive },
  error: {
    fontFamily: F.sans,
    fontSize: 13,
    color: '#FFB4A2',
    textAlign: 'center',
    marginTop: 8,
  },
  /* 5 — "Ayah X of Y" + thin surah progress. */
  ayahOf: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.navInactive,
    marginTop: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: { height: 3, borderRadius: 1.5, backgroundColor: C.skyBlue },
  /* 6 — transport. Not mirrored: previous on the left, next on the
     right, in every language — media transport keeps its
     left-to-right order on both platforms. */
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 14,
    marginBottom: 4,
  },
  transportBtn: { padding: 8, minWidth: 40, alignItems: 'center' },
  /* The surah step: a chevron at the transport's ends, quiet by size. */
  surahStepGlyph: { fontSize: 28, color: C.white, lineHeight: 32 },
  ayahStepGlyph: { fontSize: 22, color: C.white, textAlign: 'center' },
  glyphDim: { color: 'rgba(255,255,255,0.35)' },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 26, color: C.navy, textAlign: 'center' },
  /* 7 — one quiet row of pills. Painted only when on. */
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  pill: {
    minHeight: 34,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: C.skyBlue },
  pillText: { fontFamily: F.sans, fontSize: 13, fontWeight: '700', color: C.white },
  pillTextOn: { color: C.navy },
  sleepStatus: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.skyBlue,
    textAlign: 'center',
    marginTop: 8,
  },
  followWrap: { marginTop: 12 },
  /* Expandable panels (sleep choices / reciter + extra controls). */
  panel: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: S.radius,
    padding: 12,
  },
  panelTitle: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '800',
    color: C.white,
    marginBottom: 8,
  },
  /* "Choose reciter" sheet: search + rows. */
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reciterList: { maxHeight: 300, marginTop: 8 },
  reciterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  reciterRowOn: { backgroundColor: 'rgba(135,165,217,0.28)' },
  reciterMain: { flex: 1 },
  reciterRowName: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '700', color: C.white },
  reciterRowMeta: { fontFamily: F.sans, fontSize: 12, color: C.navInactive, marginTop: 2 },
  reciterCheck: { fontSize: 16, fontWeight: '800', color: C.skyBlue },
  previewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewGlyph: { fontSize: 14, color: C.navy, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  credit: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.navInactive,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  modeRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: S.radius,
    padding: 12,
    marginTop: 12,
  },
  switchText: { flex: 1 },
  switchTitle: { fontFamily: F.sans, fontSize: 14.5, fontWeight: '700', color: C.white },
  switchNote: { fontFamily: F.sans, fontSize: 12.5, color: C.navInactive, marginTop: 2 },
  skipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
});
