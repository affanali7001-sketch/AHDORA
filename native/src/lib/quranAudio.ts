/**
 * Global Quran audio manager — module-level singleton.
 *
 * The player lives in module scope (NOT in component state) so audio
 * keeps playing while the user navigates to other screens. Screens
 * (QuranBook) and the MiniPlayer subscribe to state changes via
 * subscribeQuranAudio / getQuranAudioState.
 *
 * Playback model (mirrors QuranBook's verified logic exactly):
 * - A page's tilawat queue is one AudioItem per ayah
 *   (EveryAyah Alafasy, AlQuran Cloud CDN as fallback).
 * - A page's Urdu tarjuma queue is one item per ayah
 *   (Shamshad Ali Khan, Islamic Network; no fallback host exists).
 * - On status.error: try the fallback URI first (tilawat only), else
 *   retry the same URI once, else fail with a short error and stop.
 * - On status.isLoaded: clear the loading state. On didJustFinish:
 *   advance to the next queue item; when the queue ends, the auto-play
 *   chain runs (see onQueueFinished).
 *
 * Auto-play chain (autoPlay defaults to true):
 * - tilawat queue finished -> Urdu tarjuma queue for the SAME page.
 * - urdu queue finished -> record the page as listened + mark it read,
 *   then start tilawat for page+1 (or stop at page 604).
 * - autoPlay off -> stop when the current queue ends.
 *
 * All recording calls (recordListened / recordRead) are wrapped in
 * try/catch — they need login and must never break playback.
 * No exported function ever throws.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import {
  everyAyahUrl,
  fetchMushafPage,
  recordListened,
  recordRead,
  tilawatFallbackUrl,
  urduAudioUrl,
  type MushafPage,
} from './apiWorship';

export type QuranAudioMode = 'tilawat' | 'urdu' | null;

export type QuranAudioState = {
  mode: QuranAudioMode;
  playing: boolean;
  busy: boolean;
  error: string | null;
  playingAyah: number | null;
  time: number;
  duration: number;
  page: number;
  autoPlay: boolean;
  title: string;
  hasAudio: boolean;
};

const AUDIO_FAILED = 'Audio nahi chal paya. Dobara try karo.';
const PAGE_FAILED = 'Page load nahi ho paya. Dobara try karo.';
const TOTAL_PAGES = 604;

type AudioItem = { uri: string; fallbackUri?: string; globalAyah: number };

/* ------------------------- module state ------------------------- */
let player: AudioPlayer | null = null;
let queue: AudioItem[] = [];
let queueIndex = 0;
let mode: QuranAudioMode = null;
let page = 1;
let mushaf: MushafPage | null = null;
let title = '';
let autoPlay = true;
let isPlaying = false;
let busy = false;
let error: string | null = null;
let playingAyah: number | null = null;
let time = 0;
let duration = 0;
let hasAudio = false;
/* Generation counter: every start/stop bumps it, so an async
 * completion (page fetch, queue finish) from a superseded start
 * can never start audio for the wrong page. */
let generation = 0;
/* Listened seconds accumulated on the current page+mode (sum of the
 * durations of finished tracks) — reported to recordListened. */
let pageSeconds = 0;
let lastNotifiedSecond = -1;

const listeners = new Set<(s: QuranAudioState) => void>();

function snapshot(): QuranAudioState {
  return {
    mode,
    playing: isPlaying,
    busy,
    error,
    playingAyah,
    time,
    duration,
    page,
    autoPlay,
    title,
    hasAudio,
  };
}

/**
 * Notify subscribers. Time updates are throttled: a plain (non-force)
 * notify only goes out when the floored second changed; non-time
 * changes must pass force=true.
 */
function emit(force = false): void {
  const second = Math.floor(time);
  if (!force && second === lastNotifiedSecond) return;
  lastNotifiedSecond = second;
  const s = snapshot();
  listeners.forEach((fn) => {
    try {
      fn(s);
    } catch {
      /* A subscriber must never break playback. */
    }
  });
}

export function subscribeQuranAudio(fn: (s: QuranAudioState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getQuranAudioState(): QuranAudioState {
  return snapshot();
}

export function setQuranAutoPlay(on: boolean): void {
  autoPlay = on;
  emit(true);
}

function buildQueue(m: MushafPage, md: 'tilawat' | 'urdu'): AudioItem[] {
  return md === 'tilawat'
    ? m.ayahs.map((a) => ({
        uri: everyAyahUrl(a.surah.number, a.numberInSurah),
        fallbackUri: tilawatFallbackUrl(a.number),
        globalAyah: a.number,
      }))
    : m.ayahs.map((a) => ({ uri: urduAudioUrl(a.number), globalAyah: a.number }));
}

function pageTitle(md: 'tilawat' | 'urdu', pg: number, m: MushafPage | null): string {
  const surah = m?.ayahs[0]?.surah.englishName ?? '';
  const kind = md === 'tilawat' ? 'Tilawat' : 'Tarjuma';
  return surah ? `${kind} · Page ${pg} · ${surah}` : `${kind} · Page ${pg}`;
}

function removePlayer(): void {
  const p = player;
  player = null;
  if (p) {
    try {
      p.remove();
    } catch {
      /* Already gone — ignore. */
    }
  }
}

/** Clear playback state (keeps page/title/autoPlay/error). Never throws. */
function stopInternal(): void {
  removePlayer();
  queue = [];
  queueIndex = 0;
  mode = null;
  isPlaying = false;
  busy = false;
  playingAyah = null;
  time = 0;
  duration = 0;
  hasAudio = false;
  pageSeconds = 0;
  emit(true);
}

async function playAt(index: number, gen: number): Promise<void> {
  if (gen !== generation) return;
  if (index >= queue.length) {
    await onQueueFinished(gen);
    return;
  }
  const item = queue[index];
  if (!item) return;
  queueIndex = index;
  playingAyah = item.globalAyah;
  time = 0;
  duration = 0;
  busy = true;
  emit(true);
  removePlayer();

  const tryLoad = (uri: string): AudioPlayer => {
    const p = createAudioPlayer({ uri }, { updateInterval: 500 });
    let retried = false;
    p.addListener('playbackStatusUpdate', (status) => {
      // Stale player (replaced by a newer start/skip) — ignore.
      if (gen !== generation || player !== p) return;
      // Error FIRST: a failed load must never be swallowed by a finish event.
      if (status.error) {
        try {
          if (item.fallbackUri && uri === item.uri) {
            p.replace({ uri: item.fallbackUri });
            p.play();
          } else if (!retried) {
            retried = true;
            p.replace({ uri });
            p.play();
          } else {
            error = AUDIO_FAILED;
            stopInternal();
          }
        } catch {
          error = AUDIO_FAILED;
          stopInternal();
        }
        return;
      }
      const prevPlaying = isPlaying;
      const prevBusy = busy;
      // Clear the loading state as soon as the player is actually loaded,
      // so a slow-network stall shows "loading" instead of silence.
      if (status.isLoaded && busy) busy = false;
      if (typeof status.playing === 'boolean') isPlaying = status.playing;
      if (typeof status.currentTime === 'number') time = status.currentTime;
      if (typeof status.duration === 'number') duration = status.duration;
      if (status.didJustFinish) {
        if (duration > 0) pageSeconds += duration;
        void playAt(queueIndex + 1, gen);
        return;
      }
      if (isPlaying !== prevPlaying || busy !== prevBusy) emit(true);
      else emit(false);
    });
    p.play();
    return p;
  };

  try {
    player = tryLoad(item.uri);
    hasAudio = true;
  } catch {
    if (item.fallbackUri) {
      try {
        player = tryLoad(item.fallbackUri);
        hasAudio = true;
      } catch {
        error = AUDIO_FAILED;
        stopInternal();
      }
    } else {
      error = AUDIO_FAILED;
      stopInternal();
    }
  }
  emit(true);
}

/**
 * Runs when a queue ends. Tilawat -> tarjuma (same page); tarjuma ->
 * record listened + mark read -> next page tilawat (or stop at 604).
 * autoPlay off -> stop.
 */
async function onQueueFinished(gen: number): Promise<void> {
  if (gen !== generation) return;
  const finishedMode = mode;
  const finishedPage = page;
  const finishedMushaf = mushaf;
  // The phase that just finished was genuinely listened to.
  const minutes = Math.max(0, Math.round(pageSeconds / 60));
  pageSeconds = 0;
  if (finishedMode) {
    try {
      await recordListened(minutes);
    } catch {
      /* Needs login; never break playback. */
    }
  }
  if (gen !== generation) return;
  if (!autoPlay) {
    stopInternal();
    return;
  }
  if (finishedMode === 'tilawat' && finishedMushaf) {
    // Auto tarjuma for the same page.
    mode = 'urdu';
    title = pageTitle('urdu', finishedPage, finishedMushaf);
    queue = buildQueue(finishedMushaf, 'urdu');
    queueIndex = 0;
    busy = true;
    emit(true);
    await playAt(0, gen);
    return;
  }
  if (finishedMode === 'urdu' && finishedMushaf) {
    // Mark the page read (furthest ayah of each surah on the page),
    // then auto-advance to the next page.
    try {
      const furthest = new Map<number, number>();
      for (const a of finishedMushaf.ayahs) {
        const prev = furthest.get(a.surah.number) ?? 0;
        if (a.numberInSurah > prev) furthest.set(a.surah.number, a.numberInSurah);
      }
      for (const [surahNumber, ayahNumber] of furthest) {
        await recordRead(surahNumber, ayahNumber);
      }
    } catch {
      /* Never break playback. */
    }
    if (gen !== generation) return;
    if (finishedPage < TOTAL_PAGES) {
      await startQuranPage(finishedPage + 1, 'tilawat');
    } else {
      stopInternal();
    }
    return;
  }
  stopInternal();
}

export async function startQuranPage(pg: number, md: 'tilawat' | 'urdu'): Promise<void> {
  const gen = ++generation;
  error = null;
  busy = true;
  // Stop any current playback immediately.
  removePlayer();
  queue = [];
  queueIndex = 0;
  isPlaying = false;
  playingAyah = null;
  time = 0;
  duration = 0;
  pageSeconds = 0;
  mode = md;
  page = pg;
  title = pageTitle(md, pg, null);
  hasAudio = true;
  emit(true);
  try {
    const data = await fetchMushafPage(pg);
    if (gen !== generation) return; // superseded by a newer start/stop
    mushaf = data;
    title = pageTitle(md, pg, data);
    queue = buildQueue(data, md);
    queueIndex = 0;
    emit(true);
    await playAt(0, gen);
  } catch {
    if (gen !== generation) return;
    error = PAGE_FAILED;
    stopInternal();
  }
}

export function toggleQuranAudio(): void {
  if (!player) return;
  try {
    if (isPlaying) {
      player.pause();
      isPlaying = false;
    } else {
      player.play();
      isPlaying = true;
    }
    emit(true);
  } catch {
    /* Status listener will correct the state on the next update. */
  }
}

export function stopQuranAudio(): void {
  generation++;
  error = null;
  stopInternal();
}

export function nextQuranAyah(): void {
  if (!player || queue.length === 0) return;
  if (queueIndex >= queue.length - 1) return; // already on the last ayah
  void playAt(queueIndex + 1, generation);
}

export function prevQuranAyah(): void {
  if (!player || queue.length === 0) return;
  if (queueIndex > 0) {
    void playAt(queueIndex - 1, generation);
  } else {
    // On the first ayah: restart it from the beginning.
    seekQuranTo(0);
  }
}

export function seekQuranBy(seconds: number): void {
  if (!player) return;
  const target =
    duration > 0
      ? Math.min(Math.max(0, time + seconds), duration)
      : Math.max(0, time + seconds);
  seekQuranTo(target);
}

export function seekQuranTo(seconds: number): void {
  if (!player) return;
  try {
    const target =
      duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds);
    player.seekTo(target);
    time = target;
    emit(true);
  } catch {
    /* Ignore — the player is gone or not seekable. */
  }
}
