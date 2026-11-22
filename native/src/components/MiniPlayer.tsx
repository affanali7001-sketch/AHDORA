/**
 * MiniPlayer — bottom audio bar, music-app style.
 *
 * Visible on EVERY screen while Quran audio is active (the audio
 * manager is a module singleton, so playback survives navigation).
 * The WHOLE bar is tappable — tapping anywhere on it (except the
 * prev / play / next / stop buttons, which keep their own actions)
 * calls onOpenReader, which the parent points at the Now Playing
 * screen ('now-playing'). Renders nothing when no audio is active.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '../lib/theme';
import {
  getQuranAudioState,
  nextQuranAyah,
  prevQuranAyah,
  stopQuranAudio,
  subscribeQuranAudio,
  toggleQuranAudio,
  type QuranAudioState,
} from '../lib/quranAudio';

function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function MiniPlayer({ onOpenReader }: { onOpenReader: () => void }) {
  const [state, setState] = useState<QuranAudioState>(() => getQuranAudioState());

  useEffect(() => subscribeQuranAudio(setState), []);

  if (!state.hasAudio) return null;

  const progress =
    state.duration > 0 ? Math.min(1, Math.max(0, state.time / state.duration)) : 0;

  return (
    <Pressable
      onPress={onOpenReader}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Open now playing"
    >
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.bar}>
        <Pressable
          onPress={onOpenReader}
          style={styles.info}
          accessibilityRole="button"
          accessibilityLabel="Open Quran reader"
        >
          <Text style={styles.title} numberOfLines={1}>
            {state.title || 'Quran audio'}
          </Text>
          <Text style={styles.time} numberOfLines={1}>
            {state.busy
              ? 'Load ho raha hai…'
              : `${fmtTime(state.time)} / ${fmtTime(state.duration)}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => prevQuranAyah()}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel="Previous ayah"
        >
          <Text style={styles.btnText}>⏮</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleQuranAudio()}
          style={[styles.btn, styles.playBtn]}
          accessibilityRole="button"
          accessibilityLabel={state.playing ? 'Pause' : 'Play'}
        >
          <Text style={[styles.btnText, styles.playBtnText]}>
            {state.playing ? '⏸' : '▶'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => nextQuranAyah()}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel="Next ayah"
        >
          <Text style={styles.btnText}>⏭</Text>
        </Pressable>
        <Pressable
          onPress={() => stopQuranAudio()}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel="Stop audio"
        >
          <Text style={styles.btnText}>✕</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.teal900,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressFill: {
    height: 3,
    backgroundColor: C.peachMid,
  },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  title: {
    fontFamily: F.sans,
    fontWeight: '700',
    fontSize: 13,
    color: C.white,
  },
  time: {
    fontFamily: F.sans,
    fontSize: 11,
    color: C.navInactive,
    marginTop: 1,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.peach,
  },
  btnText: {
    fontSize: 15,
    color: C.white,
    textAlign: 'center',
  },
  playBtnText: {
    color: C.teal900,
  },
});
