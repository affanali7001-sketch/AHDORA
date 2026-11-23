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
 *   (EveryAyah, in the reciter picked in QuranBook — Alafasy by
 *   default; the AlQuran Cloud CDN fallback exists for Alafasy only,
 *   other reciters retry the same EveryAyah URL once instead).
 * - A page's Urdu tarjuma queue is one item per ayah
 *   (Shamshad Ali Khan, Islamic Network; no fallback host exists,
 *   and the reciter picker never changes it).
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
 * playback), 'surah-end' (the chain stops after the page holding
 * the current surah's last ayah) or 'para-end' (the auto-play chain
 * stops after the current Juz's last page instead of advancing).
 * Applies to page playback AND Life Ayahs (same player, same stop
 * path).
 *
 * Audio <-> book sync (2026-11-23): the state now also carries the
 * queue position (queueIndex / queueLength) and the surah of the
 * ayah playing (playingSurah / playingAyahInSurah /
 * playingSurahAyahs / playingSurahName / playingSurahArabic), so
 * the readers can follow the audio — navigate to the page the voice
 * is on, scroll to the playing ayah, and show the tarjuma text
 * while the tarjuma voice plays. The page in state.page IS the
 * mushaf page of the playing ayah: the manager only ever plays a
 * queue it built from the /v1/page/{n} data it fetched for that
 * page, and the chain advances it with startQuranPage(page+1).
 * jumpToQuranQueueIndex lets the reader's page scrubber start any
 * ayah of the current page.
 *
 * Playback speed (setQuranPlaybackRate, 0.5–2x) applies to the
 * current player and every player created after; repeat
 * (setQuranRepeatMode) is off, the current ayah again, or the
 * surah on the current page again (page-scoped — playback is
 * page-based). Both persist in AsyncStorage.
 *
 * All recording calls (recordListened / recordRead) are wrapped in
 * try/catch — they need login and must never break playback.
 * No exported function ever throws.
 *
 * Background playback (2026-11-24): audio keeps playing after the
 * app is minimised or the screen locks ONLY when all three hold:
 * (1) the app.json expo-audio plugin has enableBackgroundPlayback
 * (it adds the Android media-playback foreground service +
 * FOREGROUND_SERVICE / FOREGROUND_SERVICE_MEDIA_PLAYBACK, and the
 * iOS audio background mode); (2) the runtime audio mode sets
 * shouldPlayInBackground + interruptionMode 'doNotMix'
 * (ensureAudioMode, once, on first play); (3) every player calls
 * setActiveForLockScreen(true, metadata) — without lock-screen
 * controls Android stops background audio after ~3 minutes (an OS
 * limit). The lock-screen controls also let the user pause/resume
 * from the notification / lock screen. None of this is faked: it
 * is expo-audio's own background path, and it needs the real APK
 * (a prebuild) to take effect — Expo Go has no such service.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import {
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
  /** EveryAyah folder id of the tilawat reciter in use. */
  reciterId: string;
  /** Current playback speed (0.5–2). Applied to every new player. */
  playbackRate: number;
  /** Repeat mode: off, repeat the current ayah, or repeat the
   * surah on the current page (page-scoped — playback is page-based). */
  repeatMode: QuranRepeatMode;
  /** Index of the ayah playing inside the current queue (0-based),
   * and the queue's length — the reader's page scrubber is
   * (queueIndex + within-ayah fraction) / queueLength. */
  queueIndex: number;
  queueLength: number;
  /** Surah of the ayah currently playing (from the page's mushaf
   * data, or the Life Ayah playlist) — the reader follows the
   * audio by surah AND page, so the book never stays on the old
   * surah while the voice has moved on. Null when nothing plays. */
  playingSurah: number | null;
  /** Ayah number inside that surah (1-based). */
  playingAyahInSurah: number | null;
  /** Total ayahs in that surah (null for Life Ayahs — the manager
   * never fetched that surah's metadata). */
  playingSurahAyahs: number | null;
  /** English + Arabic name of that surah (Arabic null for Life Ayahs). */
  playingSurahName: string | null;
  playingSurahArabic: string | null;
};

/** Repeat mode for Tilawah playback. */
export type QuranRepeatMode = 'off' | 'ayah' | 'surah';

/** Playback speeds offered by the Tilawah player. */
export const QURAN_PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Sleep timer option: stop after N minutes, when the current
 * Surah ends, or when the current Para (Juz) ends. */
export type QuranSleepTimerOption =
  | null
  | { kind: 'minutes'; minutes: number }
  | { kind: 'surah-end' }
  | { kind: 'para-end' };

/** Minute choices offered by the UI for the sleep timer. */
export const QURAN_SLEEP_TIMER_MINUTES = [5, 10, 15, 30, 60] as const;

/* ------------------------- tilawat reciters ------------------------- */
/**
 * Tilawat reciters, all on EveryAyah per-ayah audio — the same
 * authorized pattern as the existing Alafasy audio:
 *   https://everyayah.com/data/<folder>/<surah 3-digit><ayah 3-digit>.mp3
 * Every folder below was verified live (HEAD of 001001.mp3,
 * 002286.mp3 and 114006.mp3 — all three HTTP 200, audio/mpeg —
 * plus a ranged GET returning real MP3 bytes): the first 7 on
 * 2026-11-23 (HEAD + a ranged GET of 001001.mp3), the next 24 on
 * 2026-11-23 (HEAD of all three files + ranged GETs of 001001 and
 * 002286). Folders that 404'd and were NOT included:
 * Minshawi_Murattal_128kbps (correct spelling is Minshawy),
 * Abdurrahman_As-Sudais_192kbps (correct spelling is Abdurrahmaan),
 * MaherAlMuaiqly_64kbps (needs the underscore:
 * Maher_AlMuaiqly_64kbps), Saad_Al-Ghamdi_64kbps (Ghamadi_40kbps
 * is the working folder), AbdulBasit_Murattal_192kbps (needs the
 * underscore: Abdul_Basit_Murattal_192kbps). The mp3quran/ and
 * warsh/ folders were NOT included — whole-surah files, not
 * EveryAyah per-ayah audio.
 * The Urdu tarjuma voice (Shamshad Ali Khan) is NOT in this list —
 * the picker never changes it.
 */
export type QuranReciter = {
  /** EveryAyah folder id — also the stored value. */
  id: string;
  name: string;
  bitrate: string;
};

export const QURAN_RECITERS: QuranReciter[] = [
  { id: 'Alafasy_128kbps', name: 'Mishary Rashid Alafasy', bitrate: '128 kbps' },
  { id: 'Husary_128kbps', name: 'Mahmoud Khalil Al-Husary', bitrate: '128 kbps' },
  {
    id: 'Abdul_Basit_Murattal_192kbps',
    name: 'Abdul Basit Abdus-Samad',
    bitrate: '192 kbps',
  },
  {
    id: 'Minshawy_Murattal_128kbps',
    name: 'Mohamed Siddiq El-Minshawi',
    bitrate: '128 kbps',
  },
  {
    id: 'Abdurrahmaan_As-Sudais_192kbps',
    name: 'Abdul-Rahman As-Sudais',
    bitrate: '192 kbps',
  },
  { id: 'Maher_AlMuaiqly_64kbps', name: 'Maher Al-Muaiqly', bitrate: '64 kbps' },
  { id: 'Ghamadi_40kbps', name: 'Saad Al-Ghamdi', bitrate: '40 kbps' },
  // Added 2026-11-23 (Rest area) — all HEAD-verified at 001001,
  // 002286 and 114006, plus ranged GETs with real MP3 bytes.
  { id: 'Saood_ash-Shuraym_128kbps', name: 'Saood Ash-Shuraym', bitrate: '128 kbps' },
  {
    id: 'Abu_Bakr_Ash-Shaatree_128kbps',
    name: 'Abu Bakr Al-Shatri',
    bitrate: '128 kbps',
  },
  { id: 'Hani_Rifai_192kbps', name: 'Hani Ar-Rifai', bitrate: '192 kbps' },
  {
    id: 'Mohammad_al_Tablaway_128kbps',
    name: 'Mohammad Al-Tablawi',
    bitrate: '128 kbps',
  },
  {
    id: 'ahmed_ibn_ali_al_ajamy_128kbps',
    name: 'Ahmed ibn Ali Al-Ajamy',
    bitrate: '128 kbps',
  },
  { id: 'Muhammad_Ayyoub_128kbps', name: 'Muhammad Ayyub', bitrate: '128 kbps' },
  { id: 'Muhammad_Jibreel_128kbps', name: 'Muhammad Jibreel', bitrate: '128 kbps' },
  { id: 'Yasser_Ad-Dussary_128kbps', name: 'Yasser Al-Dosari', bitrate: '128 kbps' },
  { id: 'Hudhaify_128kbps', name: 'Ali Al-Hudhaify', bitrate: '128 kbps' },
  { id: 'Nasser_Alqatami_128kbps', name: 'Nasser Al-Qatami', bitrate: '128 kbps' },
  { id: 'Abdullah_Basfar_64kbps', name: 'Abdullah Basfar', bitrate: '64 kbps' },
  { id: 'Fares_Abbad_64kbps', name: 'Fares Abbad', bitrate: '64 kbps' },
  { id: 'Salah_Al_Budair_128kbps', name: 'Salah Al-Budair', bitrate: '128 kbps' },
  {
    id: 'Abdul_Basit_Murattal_64kbps',
    name: 'Abdul Basit Abdus-Samad (Murattal 64 kbps)',
    bitrate: '64 kbps',
  },
  {
    id: 'Husary_64kbps',
    name: 'Mahmoud Khalil Al-Husary (64 kbps)',
    bitrate: '64 kbps',
  },
  { id: 'Ibrahim_Akhdar_32kbps', name: 'Ibrahim Al-Akhdar', bitrate: '32 kbps' },
  {
    id: 'Mahmoud_Ali_Al_Banna_32kbps',
    name: 'Mahmoud Ali Al-Banna',
    bitrate: '32 kbps',
  },
  { id: 'Ali_Jaber_64kbps', name: 'Ali Jaber', bitrate: '64 kbps' },
  {
    id: 'Abdullah_Matroud_128kbps',
    name: 'Abdullah Al-Matroud',
    bitrate: '128 kbps',
  },
  {
    id: 'Muhammad_AbdulKareem_128kbps',
    name: 'Muhammad Abdul Kareem',
    bitrate: '128 kbps',
  },
  {
    id: 'Minshawy_Mujawwad_192kbps',
    name: 'Mohamed Siddiq El-Minshawi (Mujawwad)',
    bitrate: '192 kbps',
  },
  {
    id: 'Abdul_Basit_Mujawwad_128kbps',
    name: 'Abdul Basit Abdus-Samad (Mujawwad)',
    bitrate: '128 kbps',
  },
  {
    id: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps',
    name: 'Abdullah Awwad Al-Juhani',
    bitrate: '128 kbps',
  },
  {
    id: 'Husary_Muallim_128kbps',
    name: 'Mahmoud Khalil Al-Husary (Muallim — teaching)',
    bitrate: '128 kbps',
  },
];

export const DEFAULT_QURAN_RECITER_ID = 'Alafasy_128kbps';
const RECITER_STORAGE_KEY = 'ahdora:quran:reciter';

/** EveryAyah audio URL for one ayah, in the given reciter's folder. */
export function reciterAyahUrl(
  reciter: QuranReciter,
  surahNumber: number,
  ayahNumber: number,
): string {
  const surah = String(surahNumber).padStart(3, '0');
  const ayah = String(ayahNumber).padStart(3, '0');
  return `https://everyayah.com/data/${reciter.id}/${surah}${ayah}.mp3`;
}

export function reciterFor(id: string): QuranReciter {
  return QURAN_RECITERS.find((r) => r.id === id) ?? QURAN_RECITERS[0]!;
}

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
/** Tilawat reciter in use (persisted; Alafasy until the user picks one). */
let reciterId = DEFAULT_QURAN_RECITER_ID;
const RATE_STORAGE_KEY = 'ahdora:quran:rate';
const REPEAT_STORAGE_KEY = 'ahdora:quran:repeat';
/** Current playback speed (persisted; 1 until the user picks one). */
let playbackRate = 1;
/** Current repeat mode (persisted; off until the user picks one). */
let repeatMode: QuranRepeatMode = 'off';
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
  if (sleepTimer.kind === 'surah-end') return 'Surah khatm';
  return 'Para khatm';
}

function snapshot(): QuranAudioState {
  // Surah of the ayah currently playing. Page playback: the
  // page's mushaf data names it (the same AlQuran Cloud
  // /v1/page/{n} data the reader shows — an ayah's `page` field
  // in that data IS the mapping, so the reader following
  // `state.page` follows the true mushaf page). Life Ayah
  // playback: the playlist item names the surah and the ayah
  // range; the ayah-in-surah is the offset from the range start.
  let playingSurah: number | null = null;
  let playingAyahInSurah: number | null = null;
  let playingSurahAyahs: number | null = null;
  let playingSurahName: string | null = null;
  let playingSurahArabic: string | null = null;
  if (playingAyah !== null && mushaf) {
    const found = mushaf.ayahs.find((a) => a.number === playingAyah);
    if (found) {
      playingSurah = found.surah.number;
      playingAyahInSurah = found.numberInSurah;
      playingSurahAyahs = found.surah.numberOfAyahs;
      playingSurahName = found.surah.englishName;
      playingSurahArabic = found.surah.name;
    }
  } else if (playingAyah !== null && lifeAyah) {
    const current = lifePlaylist[lifeIndex];
    if (current) {
      playingSurah = current.surah;
      playingAyahInSurah =
        current.ayahStart + (playingAyah - current.globalAyahStart);
    }
  }
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
    reciterId,
    playbackRate,
    repeatMode,
    queueIndex,
    queueLength: queue.length,
    playingSurah,
    playingAyahInSurah,
    playingSurahAyahs,
    playingSurahName,
    playingSurahArabic,
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

/** Current tilawat reciter id (synchronous; loadQuranReciter first restores the saved one). */
export function getQuranReciterId(): string {
  return reciterId;
}

/**
 * Restore the saved tilawat reciter from AsyncStorage. Call once
 * from the Quran Book screen on mount; an unknown saved value falls
 * back to Alafasy. Never throws.
 */
export async function loadQuranReciter(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(RECITER_STORAGE_KEY);
    if (saved && QURAN_RECITERS.some((r) => r.id === saved)) {
      reciterId = saved;
    }
  } catch {
    /* Keep the default — playback must never break on storage. */
  }
  emit(true);
  return reciterId;
}

/**
 * Pick the tilawat reciter. Persisted in AsyncStorage and used for
 * every tilawat queue built after this call — including the
 * tilawat → tarjuma → next-page chain. A queue already playing keeps
 * its reciter until the next play, so switching never cuts audio
 * mid-ayah. Unknown ids are ignored. Never throws.
 */
export async function setQuranReciter(id: string): Promise<void> {
  if (!QURAN_RECITERS.some((r) => r.id === id)) return;
  reciterId = id;
  try {
    await AsyncStorage.setItem(RECITER_STORAGE_KEY, id);
  } catch {
    /* In-memory choice still applies for this session. */
  }
  emit(true);
}

/** Current playback speed (synchronous; loadQuranPlaybackPrefs first restores the saved one). */
export function getQuranPlaybackRate(): number {
  return playbackRate;
}

/** Current repeat mode (synchronous). */
export function getQuranRepeatMode(): QuranRepeatMode {
  return repeatMode;
}

/**
 * Restore the saved playback speed + repeat mode from AsyncStorage.
 * Call once from the Quran Book screen on mount alongside
 * loadQuranReciter. Unknown saved values fall back to 1x / off.
 * Never throws.
 */
export async function loadQuranPlaybackPrefs(): Promise<void> {
  try {
    const [savedRate, savedRepeat] = await Promise.all([
      AsyncStorage.getItem(RATE_STORAGE_KEY),
      AsyncStorage.getItem(REPEAT_STORAGE_KEY),
    ]);
    const rate = Number.parseFloat(savedRate ?? '');
    if (QURAN_PLAYBACK_RATES.some((r) => r === rate)) playbackRate = rate;
    if (savedRepeat === 'ayah' || savedRepeat === 'surah' || savedRepeat === 'off') {
      repeatMode = savedRepeat;
    }
  } catch {
    /* Keep the defaults — playback must never break on storage. */
  }
  emit(true);
}

/**
 * Set the playback speed (0.5–2x). Persisted, applied to the
 * current player immediately (if any) and to every player created
 * after this call. Unknown values are ignored. Never throws.
 */
export function setQuranPlaybackRate(rate: number): void {
  if (!QURAN_PLAYBACK_RATES.some((r) => r === rate)) return;
  playbackRate = rate;
  if (player) {
    try {
      player.setPlaybackRate(rate);
    } catch {
      /* Status listener will correct the state on the next update. */
    }
  }
  void AsyncStorage.setItem(RATE_STORAGE_KEY, String(rate)).catch(() => undefined);
  emit(true);
}

/**
 * Set the repeat mode. Persisted; applies from the ayah/queue
 * currently playing. 'ayah' replays the current ayah when it ends;
 * 'surah' restarts the tilawat of the current page when its queue
 * ends (page-scoped — playback is page-based, so a surah that spans
 * pages repeats its portion on this page). Never throws.
 */
export function setQuranRepeatMode(mode: QuranRepeatMode): void {
  repeatMode = mode;
  void AsyncStorage.setItem(REPEAT_STORAGE_KEY, mode).catch(() => undefined);
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
 * 'surah-end': the auto-play chain stops after the page that holds
 * the current surah's last ayah finishes (checked in
 * onQueueFinished). 'para-end': the auto-play chain stops after the
 * current Juz's last page instead of advancing (checked in
 * onQueueFinished). Setting null cancels the timer. Applies to page
 * playback and Life Ayahs alike — both go through the same stop path.
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
  if (md === 'urdu') {
    return m.ayahs.map((a) => ({ uri: urduAudioUrl(a.number), globalAyah: a.number }));
  }
  // Tilawat in the picked reciter. The AlQuran Cloud CDN fallback
  // exists for Alafasy only — for other reciters there is no second
  // host, so fallbackUri stays undefined and playAt retries the
  // same EveryAyah URL once instead of silently playing Alafasy.
  const reciter = reciterFor(reciterId);
  return m.ayahs.map((a) => ({
    uri: reciterAyahUrl(reciter, a.surah.number, a.numberInSurah),
    fallbackUri:
      reciter.id === DEFAULT_QURAN_RECITER_ID
        ? tilawatFallbackUrl(a.number)
        : undefined,
    globalAyah: a.number,
  }));
}

function pageTitle(md: 'tilawat' | 'urdu', pg: number, m: MushafPage | null): string {
  const surah = m?.ayahs[0]?.surah.englishName ?? '';
  const kind = md === 'tilawat' ? 'Tilawat' : 'Tarjuma';
  return surah ? `${kind} · Page ${pg} · ${surah}` : `${kind} · Page ${pg}`;
}

/** True after the runtime audio mode was set once (see ensureAudioMode). */
let audioModeReady = false;

/**
 * Runtime audio mode for background playback (see the header note).
 * Runs once, lazily, on the first play — never throws, never blocks
 * playback. 'doNotMix' is required for lock-screen controls and is
 * also the right behaviour for a Quran app (no other audio mixes
 * with tilawat).
 */
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch {
    /* Foreground playback still works; background may stop. */
  }
}

/** Lock-screen / notification metadata for the current queue:
 * the queue title, and the voice (reciter for tilawat, Shamshad
 * Ali Khan for the Urdu tarjuma). */
function lockScreenMeta(): { title: string; artist: string } {
  const artist =
    mode === 'urdu'
      ? 'Shamshad Ali Khan · Tarjuma'
      : reciterFor(reciterId).name;
  return { title: title || 'Quran audio', artist };
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
    // Release the lock-screen controls for this player, so the
    // notification does not linger after playback stops.
    try {
      p.setActiveForLockScreen(false);
    } catch {
      /* Already gone — ignore. */
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
  // Background mode first: the mode must be set before the player
  // is created, or the OS may still kill playback on minimise.
  await ensureAudioMode();
  removePlayer();

  const tryLoad = (uri: string): AudioPlayer => {
    const p = createAudioPlayer({ uri }, { updateInterval: 500 });
    // Playback speed: the picked rate applies to every new player.
    try {
      p.setPlaybackRate(playbackRate);
    } catch {
      /* Rate stays 1x for this player — never break playback. */
    }
    // Lock-screen controls (Android): without these the OS stops
    // background audio after ~3 minutes. The notification also
    // lets the user pause/resume from the lock screen.
    try {
      p.setActiveForLockScreen(true, lockScreenMeta());
    } catch {
      /* Lock-screen controls are a bonus, never a blocker. */
    }
    let retried = false;
    p.addListener('playbackStatusUpdate', (status) => {
      // Stale player (replaced by a newer start/skip) — ignore.
      if (gen !== generation || player !== p) return;
      // Error FIRST: a failed load must never be swallowed by a finish event.
      if (status.error) {
        try {
          if (item.fallbackUri && uri === item.uri) {
            p.replace({ uri: item.fallbackUri });
            try {
              p.setPlaybackRate(playbackRate);
            } catch {
              /* Ignore. */
            }
            p.play();
          } else if (!retried) {
            retried = true;
            p.replace({ uri });
            try {
              p.setPlaybackRate(playbackRate);
            } catch {
              /* Ignore. */
            }
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
        // Repeat ayah: the same ayah plays again instead of advancing.
        if (repeatMode === 'ayah') {
          void playAt(queueIndex, gen);
          return;
        }
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
  // Repeat surah (page-scoped): restart the tilawat of this page
  // instead of the tarjuma chain or advancing. Beats autoPlay-off:
  // the user explicitly asked for the repeat.
  if (repeatMode === 'surah' && finishedMushaf) {
    mode = 'tilawat';
    title = pageTitle('tilawat', finishedPage, finishedMushaf);
    queue = buildQueue(finishedMushaf, 'tilawat');
    queueIndex = 0;
    busy = true;
    emit(true);
    await playAt(0, gen);
    return;
  }
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
    // 'surah-end' sleep timer: stop after the page that holds a
    // surah's last ayah finishes, instead of advancing.
    if (
      sleepTimer?.kind === 'surah-end' &&
      finishedMushaf &&
      finishedMushaf.ayahs.some(
        (a) => a.numberInSurah >= a.surah.numberOfAyahs,
      )
    ) {
      stopInternal();
      return;
    }
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
 * EveryAyah in the picked reciter (AlQuran Cloud fallback for
 * Alafasy only — see buildQueue); tarjuma uses the Urdu audio
 * only (no fallback host exists — the playAt retry rule retries
 * the same URI once). */
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
      const reciter = reciterFor(reciterId);
      items.push({
        uri: reciterAyahUrl(reciter, surahNumber, a),
        fallbackUri:
          reciter.id === DEFAULT_QURAN_RECITER_ID
            ? tilawatFallbackUrl(globalAyah)
            : undefined,
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

/**
 * Jump to one ayah of the current queue by its index (0-based) —
 * the reader's page scrubber: dragging to a fraction of the page
 * starts that ayah. Out-of-range indexes and an empty queue are
 * ignored. Never throws.
 */
export function jumpToQuranQueueIndex(index: number): void {
  if (!player || queue.length === 0) return;
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return;
  void playAt(index, generation);
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
