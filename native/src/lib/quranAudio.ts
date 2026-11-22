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
 * - A Life Ayah queue (startLifeAyah) never runs the chain: when it
 *   ends it just stops.
 *
 * Seeking (fixed 2026-11-22): seekQuranTo NEVER seeks into the last
 * second of a track. Seeking to the exact end made ExoPlayer fire
 * didJustFinish while the old player was still audible — expo-audio
 * releases the native player asynchronously (GlobalScope.launch in
 * BaseAudioPlayer.sharedObjectDidRelease), so the next ayah's player
 * started before the old one stopped, and a rapid repeat tap could
 * re-seek the not-yet-released old player out of its ENDED state and
 * resume the old audio. Instead, a seek that lands in the end zone
 * advances cleanly to the next ayah (old player paused + removed
 * first, synchronously), and removePlayer() now pauses before
 * removing so the old audio stops immediately.
 *
 * Sleep timer (setQuranSleepTimer): minutes (a timeout that stops
 * playback) or 'para-end' (the auto-play chain stops after the
 * current Juz's last page instead of advancing). Applies to page
 * playback AND Life Ayahs (same player, same stop path).
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
  /** Human label for the active sleep timer, or null. */
  sleepTimer: string | null;
};

/** Sleep timer option: stop after N minutes, or when the current Para (Juz) ends. */
export type QuranSleepTimerOption =
  | null
  | { kind: 'minutes'; minutes: number }
  | { kind: 'para-end' };

/** Minute choices offered by the UI for the sleep timer. */
export const QURAN_SLEEP_TIMER_MINUTES = [15, 30, 60] as const;

const AUDIO_FAILED = 'Audio nahi chal paya. Dobara try karo.';
const PAGE_FAILED = 'Page load nahi ho paya. Dobara try karo.';
const TOTAL_PAGES = 604;
/** Seeking to within this many seconds of a track's end advances to
 * the next ayah instead (see the header note on the seek bug). */
const END_ZONE_SECONDS = 1;
/** Last mushaf page of each Juz (1–30), from the same ranges as
 * ParaBook.tsx's JUZ table (verified live against AlQuran Cloud
 * /v1/juz/{n}). Used by the 'para-end' sleep timer. */
const JUZ_END_PAGES = [
  21, 41, 62, 81, 101, 121, 141, 161, 181, 201, 221, 241, 261, 281, 301, 321,
  341, 361, 381, 401, 421, 441, 461, 481, 502, 521, 541, 561, 581, 604,
];

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
/** One curated Life Ayah, enough to rebuild its audio queue. */
export type LifeAyahRef = {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  globalAyahStart: number;
  /** Title for the tilawat queue. */
  title: string;
  /** Title for the tarjuma queue. */
  titleTarjuma: string;
};

/** True while the current queue is a Life Ayah (startLifeAyah) rather
 * than a mushaf page. A Life Ayah runs the continue chain (see
 * onQueueFinished): tilawat → tarjuma → next ayah, while autoPlay
 * is on and a playlist was passed. */
let lifeAyah = false;
/** The 4 curated Life Ayahs in order, when the screen passed them —
 * the continue chain walks this list (see onQueueFinished). */
let lifePlaylist: LifeAyahRef[] = [];
/** Index of the Life Ayah currently playing in lifePlaylist. */
let lifeIndex = 0;
/** Active sleep timer (minutes timeout or 'para-end' flag). */
let sleepTimer: QuranSleepTimerOption = null;
let sleepTimerHandle: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<(s: QuranAudioState) => void>();

function sleepTimerLabel(): string | null {
  if (!sleepTimer) return null;
  if (sleepTimer.kind === 'minutes') return `${sleepTimer.minutes} min`;
  return 'Para khatm';
}

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
    sleepTimer: sleepTimerLabel(),
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

/** Clear the sleep timer (timeout + flag). Called on every real stop. */
function clearSleepTimer(): void {
  if (sleepTimerHandle !== null) {
    clearTimeout(sleepTimerHandle);
    sleepTimerHandle = null;
  }
  sleepTimer = null;
}

/**
 * Sleep timer. Minutes: stops playback when the timeout fires (the
 * timeout is cleared when a new timer is set or playback stops).
 * 'para-end': the auto-play chain stops after the current Juz's last
 * page instead of advancing (checked in onQueueFinished). Setting
 * null cancels the timer. Applies to page playback and Life Ayahs
 * alike — both go through the same stop path.
 */
export function setQuranSleepTimer(option: QuranSleepTimerOption): void {
  clearSleepTimer();
  sleepTimer = option;
  if (option && option.kind === 'minutes') {
    const handle = setTimeout(() => {
      stopQuranAudio();
    }, option.minutes * 60 * 1000);
    sleepTimerHandle = handle;
  }
  emit(true);
}

export function getQuranSleepTimer(): QuranSleepTimerOption {
  return sleepTimer;
}

/** Last mushaf page of the Juz the given page starts in (from the
 * first ayah's juz — a boundary page starts with the Juz that is
 * ending on it). Null when the page is unknown (Life Ayah mode). */
function juzEndPageFor(m: MushafPage | null): number | null {
  const first = m?.ayahs[0];
  if (!first) return null;
  const juz = first.juz;
  if (juz < 1 || juz > 30) return null;
  return JUZ_END_PAGES[juz - 1] ?? null;
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
    // Pause FIRST, synchronously: expo-audio releases the native
    // player asynchronously (GlobalScope.launch in its
    // sharedObjectDidRelease), so remove() alone leaves the old
    // audio audible for a moment — pause stops it immediately.
    try {
      p.pause();
    } catch {
      /* Already paused or gone — ignore. */
    }
    try {
      p.remove();
    } catch {
      /* Already gone — ignore. */
    }
  }
}

/** Clear playback state (keeps page/title/autoPlay/error). Never throws. */
function stopInternal(): void {
  clearSleepTimer();
  removePlayer();
  queue = [];
  queueIndex = 0;
  mode = null;
  lifeAyah = false;
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
    try {
      p.play();
    } catch (e) {
      // The player was created (and may already be audible) but
      // could not be started — remove it before rethrowing so it
      // can never keep playing as an orphan no one holds a
      // reference to (that would be two audible players at once).
      try {
        p.pause();
      } catch {
        /* Ignore. */
      }
      try {
        p.remove();
      } catch {
        /* Ignore. */
      }
      throw e;
    }
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
  // A Life Ayah queue ends here. Continue chain (user request
  // 2026-11-22): while autoPlay is on and the screen passed the
  // 4-ayah playlist, tilawat → tarjuma of the SAME ayah, then the
  // NEXT ayah's tilawat — immediately, no tap needed. After the
  // last ayah's tarjuma, stop. autoPlay off (or no playlist) →
  // stop, as before. No recording (the screen never recorded).
  if (lifeAyah) {
    if (!autoPlay || lifePlaylist.length === 0) {
      stopInternal();
      return;
    }
    const finishedMode = mode;
    const current = lifePlaylist[lifeIndex];
    if (!current) {
      stopInternal();
      return;
    }
    if (finishedMode === 'tilawat') {
      // Same ayah, now its tarjuma.
      await startLifeAyah(
        current.surah,
        current.ayahStart,
        current.ayahEnd,
        current.globalAyahStart,
        'urdu',
        current.titleTarjuma,
        lifePlaylist,
        lifeIndex,
      );
      return;
    }
    // Tarjuma done → next ayah's tilawat, or stop at the end.
    const nextIndex = lifeIndex + 1;
    if (nextIndex >= lifePlaylist.length) {
      stopInternal();
      return;
    }
    const nextAyah = lifePlaylist[nextIndex];
    await startLifeAyah(
      nextAyah.surah,
      nextAyah.ayahStart,
      nextAyah.ayahEnd,
      nextAyah.globalAyahStart,
      'tilawat',
      nextAyah.title,
      lifePlaylist,
      nextIndex,
    );
    return;
  }
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
    // 'para-end' sleep timer: stop after this Juz's last page
    // instead of advancing to the next page.
    if (
      sleepTimer?.kind === 'para-end' &&
      finishedMushaf &&
      finishedPage >= (juzEndPageFor(finishedMushaf) ?? Number.POSITIVE_INFINITY)
    ) {
      stopInternal();
      return;
    }
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
  lifeAyah = false;
  lifePlaylist = [];
  lifeIndex = 0;
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

/** One queue item per ayah in a Life Ayah range. Tilawat uses
 * EveryAyah + the AlQuran Cloud fallback (same as the page queue);
 * tarjuma uses the Urdu audio only (no fallback host exists — the
 * playAt retry rule retries the same URI once). */
function buildLifeQueue(
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
  globalAyahStart: number,
  md: 'tilawat' | 'urdu',
): AudioItem[] {
  const items: AudioItem[] = [];
  for (let a = ayahStart; a <= ayahEnd; a += 1) {
    const globalAyah = globalAyahStart + (a - ayahStart);
    if (md === 'tilawat') {
      items.push({
        uri: everyAyahUrl(surahNumber, a),
        fallbackUri: tilawatFallbackUrl(globalAyah),
        globalAyah,
      });
    } else {
      items.push({ uri: urduAudioUrl(globalAyah), globalAyah });
    }
  }
  return items;
}

/**
 * Play one Life Ayah (curated ayah range) through the SAME global
 * manager as the Quran Book — so it shows in the MiniPlayer, keeps
 * playing in the background, obeys the sleep timer, and gets the
 * seek fix. `globalAyahStart` is the global number (1..6236) of
 * `ayahStart` (surah starts: Al-Baqarah 8, Ar-Ra'd 1708, Taha 2349,
 * Al-Mu'minun 2674). When the queue ends, the continue chain runs
 * (see onQueueFinished): with a playlist, tilawat → tarjuma of the
 * same ayah → next ayah's tilawat, while autoPlay is on.
 */
export async function startLifeAyah(
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number,
  globalAyahStart: number,
  md: 'tilawat' | 'urdu',
  titleText: string,
  playlist: LifeAyahRef[] = [],
  playlistIndex = 0,
): Promise<void> {
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
  lifeAyah = true;
  lifePlaylist = playlist;
  lifeIndex = playlistIndex;
  mushaf = null;
  title = titleText;
  hasAudio = true;
  emit(true);
  try {
    queue = buildLifeQueue(surahNumber, ayahStart, ayahEnd, globalAyahStart, md);
    queueIndex = 0;
    await playAt(0, gen);
  } catch {
    if (gen !== generation) return;
    error = AUDIO_FAILED;
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
    // Never seek into the last second of a track: seeking to the
    // exact end makes ExoPlayer fire didJustFinish while the old
    // player is still audible (its native release is async), so
    // the old audio and the next ayah play at the same time. A
    // seek that lands in the end zone advances cleanly instead —
    // playAt pauses + removes the old player BEFORE starting the
    // next ayah, so only one player is ever audible. On the last
    // ayah of the queue, playAt runs the normal queue-end path
    // (auto-play chain / stop).
    if (duration > 0 && seconds >= duration - END_ZONE_SECONDS) {
      void playAt(queueIndex + 1, generation);
      return;
    }
    const target =
      duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds);
    player.seekTo(target);
    time = target;
    emit(true);
  } catch {
    /* Ignore — the player is gone or not seekable. */
  }
}
