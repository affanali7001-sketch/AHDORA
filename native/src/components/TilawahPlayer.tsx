/**
 * Tilawah player — the full Quran audio player for the Quran Book
 * reader (Mihrab-style controls, AHDORA's own audio underneath).
 *
 * Everything here is real state from the global manager
 * (src/lib/quranAudio.ts): play/pause, prev/next ayah, a seek bar
 * through the CURRENT ayah (the progress bar is the real
 * time/duration of the ayah playing — never faked), playback speed,
 * repeat, sleep timer, reciter picker, auto-play and the translation
 * toggle. It never replaces AHDORA's audio: tilawat stays EveryAyah
 * in the picked reciter, the Urdu tarjuma voice stays Shamshad Ali
 * Khan, and the tilawat → tarjuma → next-page chain is untouched.
 *
 * The seek bar is a Pressable track (same pattern as NowPlaying):
 * tapping it seeks to that fraction of the current ayah.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, S } from '../lib/theme';
import { Chip, PillButton, Switch } from './ui';
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
import type { MushafAyah } from '../lib/apiWorship';

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

export default function TilawahPlayer({
  lang,
  page,
  ayahs,
  showTranslation,
  onTranslationChange,
}: {
  lang: AppLanguage;
  page: number;
  /** Ayahs of the page being read — used for the "now playing" label. */
  ayahs: MushafAyah[];
  showTranslation: boolean;
  onTranslationChange: (show: boolean) => void;
}) {
  const s = stringsFor(lang);
  const [audio, setAudio] = useState<QuranAudioState>(() => getQuranAudioState());
  useEffect(() => subscribeQuranAudio(setAudio), []);
  const [trackWidth, setTrackWidth] = useState(0);

  const onThisPage = audio.hasAudio && audio.page === page && audio.mode !== null;
  const time = onThisPage ? audio.time : 0;
  const duration = onThisPage ? audio.duration : 0;
  const pct = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const liveTimer = getQuranSleepTimer();

  const playingAyah = ayahs.find((a) => a.number === audio.playingAyah);
  const nowLabel = onThisPage
    ? playingAyah
      ? `Surah ${playingAyah.surah.englishName} · Ayah ${playingAyah.numberInSurah}`
      : audio.title
    : s.tilawahPlayPage;

  function onPlayPause(): void {
    if (onThisPage) {
      toggleQuranAudio();
    } else {
      void startQuranPage(page, 'tilawat');
    }
  }

  function onMode(mode: 'tilawat' | 'urdu'): void {
    if (onThisPage && audio.mode === mode) {
      toggleQuranAudio();
    } else {
      void startQuranPage(page, mode);
    }
  }

  function cycleRepeat(): void {
    const idx = REPEAT_CYCLE.indexOf(audio.repeatMode);
    setQuranRepeatMode(REPEAT_CYCLE[(idx + 1) % REPEAT_CYCLE.length] ?? 'off');
  }

  const repeatLabel =
    audio.repeatMode === 'ayah'
      ? s.tilawahRepeatAyah
      : audio.repeatMode === 'surah'
        ? s.tilawahRepeatSurah
        : s.tilawahRepeatOff;

  return (
    <View style={styles.card}>
      {/* Now playing + seek bar (real time/duration of the ayah). */}
      <Text style={styles.nowLabel}>{nowLabel}</Text>
      <Pressable
        onPress={(e) => {
          if (trackWidth <= 0 || duration <= 0) return;
          const fraction = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth));
          seekQuranTo(fraction * duration);
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
        <Text style={styles.timeText}>{fmtTime(time)}</Text>
        <Text style={styles.timeText}>
          {duration > 0 ? fmtTime(duration) : `Page ${page}`}
        </Text>
      </View>
      {audio.busy && audio.mode ? (
        <Text style={styles.loading}>{s.audioLoading}</Text>
      ) : null}
      {audio.error ? <Text style={styles.error}>{audio.error}</Text> : null}

      {/* Transport: prev / play-pause / next / stop + skip. */}
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
          onPress={onPlayPause}
          style={[styles.ctrlBtn, styles.playBtn]}
          accessibilityRole="button"
          accessibilityLabel={audio.playing ? 'Pause' : 'Play'}
        >
          {audio.busy && onThisPage ? (
            <ActivityIndicator color={C.peachText} size="large" />
          ) : (
            <Text style={[styles.ctrlIcon, styles.playIcon]}>
              {onThisPage && audio.playing ? '⏸' : '▶'}
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
      <View style={styles.skipRow}>
        <PillButton label="−10s" small variant="ghost" onPress={() => seekQuranBy(-10)} />
        <PillButton label="+10s" small variant="ghost" onPress={() => seekQuranBy(10)} />
      </View>

      {/* Tilawat / tarjuma mode — the tarjuma voice never changes. */}
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
      <Text style={styles.credit}>
        Tilawat: {reciterFor(audio.reciterId).name} (EveryAyah) ·{' '}
        {reciterFor(audio.reciterId).bitrate}
      </Text>

      {/* Speed. */}
      <Text style={styles.rowTitle}>{s.tilawahSpeed}</Text>
      <View style={styles.chipRow}>
        {QURAN_PLAYBACK_RATES.map((r) => (
          <Chip
            key={r}
            label={`${r}x`}
            selected={audio.playbackRate === r}
            onPress={() => setQuranPlaybackRate(r)}
          />
        ))}
      </View>

      {/* Repeat: off → ayah → surah → off. */}
      <Text style={styles.rowTitle}>{s.tilawahRepeat}</Text>
      <View style={styles.chipRow}>
        <Chip label={repeatLabel} selected={audio.repeatMode !== 'off'} onPress={cycleRepeat} />
      </View>

      {/* Sleep timer: minutes, end of surah, end of para. */}
      <Text style={styles.rowTitle}>{s.tilawahSleep}</Text>
      <View style={styles.chipRow}>
        {SLEEP_CHIPS.map((chip) => (
          <Chip
            key={chip.labelKey}
            label={s[chip.labelKey]}
            selected={sameSleepOption(liveTimer, chip.value)}
            onPress={() => setQuranSleepTimer(chip.value)}
          />
        ))}
      </View>
      {audio.sleepTimer ? (
        <Text style={styles.sleepStatus}>
          {s.tilawahSleep}: {audio.sleepTimer}
        </Text>
      ) : null}

      {/* Auto-play + translation toggle. */}
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>{s.autoPlay}</Text>
          <Text style={styles.switchNote}>{s.autoPlayNote}</Text>
        </View>
        <Switch value={audio.autoPlay} onValueChange={setQuranAutoPlay} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchTitle}>
            {showTranslation ? s.tilawahHideTarjuma : s.tilawahShowTarjuma}
          </Text>
          <Text style={styles.switchNote}>{s.rdTarjumaH}</Text>
        </View>
        <Switch value={showTranslation} onValueChange={onTranslationChange} />
      </View>

      {/* Reciter picker — tilawat only; the Urdu tarjuma voice never changes. */}
      <Text style={styles.rowTitle}>{s.reciterTitle}</Text>
      <View style={styles.chipRow}>
        {QURAN_RECITERS.map((r) => (
          <Chip
            key={r.id}
            label={r.name}
            selected={audio.reciterId === r.id}
            onPress={() => void setQuranReciter(r.id)}
          />
        ))}
      </View>
      <Text style={styles.credit}>{s.reciterNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.teal900,
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
  nowLabel: {
    fontFamily: F.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: C.white,
  },
  seekTouch: { paddingVertical: 10 },
  seekTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  seekFill: { height: 6, borderRadius: 999, backgroundColor: C.peachMid },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontFamily: F.sans, fontSize: 12, color: C.navInactive },
  loading: {
    fontFamily: F.sans,
    fontSize: 13,
    color: C.navInactive,
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    fontFamily: F.sans,
    fontSize: 13,
    color: '#FFB4A2',
    textAlign: 'center',
    marginTop: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    marginTop: 10,
  },
  ctrlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.peachMid },
  ctrlIcon: { fontSize: 22, color: C.white, textAlign: 'center' },
  playIcon: { color: C.peachText, fontSize: 26 },
  skipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'center',
  },
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 14, justifyContent: 'center' },
  credit: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.navInactive,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  rowTitle: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '800',
    color: C.white,
    marginTop: 16,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sleepStatus: {
    fontFamily: F.sans,
    fontSize: 12.5,
    color: C.peachMid,
    marginTop: 8,
  },
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
});
