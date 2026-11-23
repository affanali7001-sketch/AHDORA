/**
 * Adhan audio — the real adhan for prayer alerts + in-app preview.
 *
 * SOURCE (verified live 2026-11-23, HEAD 200 audio/mpeg, first 1 KB
 * confirmed MPEG Layer III): AlAdhan's own CDN — the same provider
 * that already supplies AHDORA's prayer times:
 *   https://aladhan.com/download-adhans
 *   https://cdn.aladhan.com/audio/adhans/a9.mp3  — Mishary Rashid Alafasy
 *   https://cdn.aladhan.com/audio/adhans/a1.mp3  — Ahmad al-Nafees
 *   https://cdn.aladhan.com/audio/adhans/a2.mp3  — Hafiz Mustafa Özcan (Turkey)
 * No file is bundled (the push tool is text-only) and nothing is
 * faked with a beep: the picker plays these exact files over the
 * network via expo-audio, the same player the Quran audio uses.
 *
 * HONEST LIMIT (do not claim more): a scheduled local notification
 * can only play the phone's default sound or a sound bundled in the
 * app — a remote URL cannot be a notification sound, and no adhan
 * file can be bundled through the text-only push. So the adhan plays
 * when a prayer alert arrives while the app is running (foreground
 * listener in prayerNotifications.ts) and when the user taps the
 * alert; when the app is closed, the alert still arrives with the
 * default sound. The Prayer screen says exactly this.
 *
 * Preferences are device-level (like the prayer-alert master flag
 * `@ahdora/notif/prayerEnabled`), not per-user: the sound comes out
 * of this phone, and the notification listeners run without a user
 * in scope.
 *
 * No exported function ever throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

export type AdhanVoice = {
  id: string;
  /** Muezzin name, as AlAdhan lists it. */
  name: string;
  url: string;
};

export const ADHAN_VOICES: readonly AdhanVoice[] = [
  {
    id: 'alafasy',
    name: 'Mishary Rashid Alafasy',
    url: 'https://cdn.aladhan.com/audio/adhans/a9.mp3',
  },
  {
    id: 'alnafees',
    name: 'Ahmad al-Nafees',
    url: 'https://cdn.aladhan.com/audio/adhans/a1.mp3',
  },
  {
    id: 'ozcan',
    name: 'Hafiz Mustafa Özcan (Turkey)',
    url: 'https://cdn.aladhan.com/audio/adhans/a2.mp3',
  },
];

export const DEFAULT_ADHAN_VOICE_ID = 'alafasy';

const ENABLED_KEY = '@ahdora/adhan/enabled';
const VOICE_KEY = '@ahdora/adhan/voice';

export function findAdhanVoice(id: string): AdhanVoice {
  return ADHAN_VOICES.find((v) => v.id === id) ?? ADHAN_VOICES[0];
}

export function coerceAdhanVoiceId(id: unknown): string {
  return typeof id === 'string' && ADHAN_VOICES.some((v) => v.id === id)
    ? id
    : DEFAULT_ADHAN_VOICE_ID;
}

export type AdhanPrefs = { enabled: boolean; voiceId: string };

export async function getAdhanPrefs(): Promise<AdhanPrefs> {
  try {
    const [enabledRaw, voiceRaw] = await Promise.all([
      AsyncStorage.getItem(ENABLED_KEY),
      AsyncStorage.getItem(VOICE_KEY),
    ]);
    return {
      enabled: enabledRaw === 'true',
      voiceId: coerceAdhanVoiceId(voiceRaw),
    };
  } catch {
    return { enabled: false, voiceId: DEFAULT_ADHAN_VOICE_ID };
  }
}

export async function setAdhanEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // Kept in memory for this session only.
  }
  if (!value) stopAdhanPreview();
}

export async function setAdhanVoiceId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(VOICE_KEY, coerceAdhanVoiceId(id));
  } catch {
    // Kept in memory for this session only.
  }
}

// ─── Playback (one module-level player, like quranAudio) ─────────────

let player: AudioPlayer | null = null;
let previewVoiceId: string | null = null;
let previewPlaying = false;
const previewListeners = new Set<(state: { playing: boolean; voiceId: string | null }) => void>();

function emitPreview(): void {
  const state = { playing: previewPlaying, voiceId: previewVoiceId };
  previewListeners.forEach((cb) => {
    try {
      cb(state);
    } catch {
      // A listener must never break playback.
    }
  });
}

export function subscribeAdhanPreview(
  cb: (state: { playing: boolean; voiceId: string | null }) => void,
): () => void {
  previewListeners.add(cb);
  return () => {
    previewListeners.delete(cb);
  };
}

export function getAdhanPreviewState(): { playing: boolean; voiceId: string | null } {
  return { playing: previewPlaying, voiceId: previewVoiceId };
}

function removePlayer(): void {
  if (!player) return;
  try {
    player.pause();
  } catch {
    // Already stopped.
  }
  try {
    player.remove();
  } catch {
    // Already removed.
  }
  player = null;
}

function startPlayer(url: string, voiceId: string | null, preview: boolean): void {
  const hadPreview = previewPlaying;
  removePlayer();
  try {
    const p = createAudioPlayer({ uri: url });
    player = p;
    // Alert playback (app running, notification fired) is not a
    // preview: it must not flip the Prayer screen's Play/Stop state.
    previewVoiceId = preview ? voiceId : null;
    previewPlaying = preview;
    // An alert starting over a playing preview must clear the
    // preview's Play/Stop state too.
    if (preview || hadPreview) emitPreview();
    p.addListener('playbackStatusUpdate', (status) => {
      if (player !== p) return;
      if (status.error || status.didJustFinish) {
        const wasPreview = previewPlaying;
        previewPlaying = false;
        previewVoiceId = null;
        removePlayer();
        if (wasPreview) emitPreview();
      }
    });
    p.play();
  } catch {
    const wasPreview = previewPlaying || hadPreview;
    previewPlaying = false;
    previewVoiceId = null;
    removePlayer();
    if (wasPreview) emitPreview();
  }
}

/**
 * Play a voice as a preview (Prayer screen). Tapping the playing
 * voice again stops it. Never throws.
 */
export function playAdhanPreview(voiceId: string): void {
  if (previewPlaying && previewVoiceId === voiceId) {
    stopAdhanPreview();
    return;
  }
  startPlayer(findAdhanVoice(voiceId).url, voiceId, true);
}

export function stopAdhanPreview(): void {
  if (!previewPlaying && !player) return;
  previewPlaying = false;
  previewVoiceId = null;
  removePlayer();
  emitPreview();
}

/**
 * Play the user's chosen adhan for a prayer alert (called from the
 * notification listeners in prayerNotifications.ts). Silent no-op
 * when adhan sound is off or the audio cannot load — the alert
 * itself has already arrived with the default sound. Never throws.
 */
export async function playAdhanForAlert(): Promise<void> {
  try {
    const prefs = await getAdhanPrefs();
    if (!prefs.enabled) return;
    startPlayer(findAdhanVoice(prefs.voiceId).url, null, false);
  } catch {
    // The alert was already delivered; a failed adhan must not crash.
  }
}
