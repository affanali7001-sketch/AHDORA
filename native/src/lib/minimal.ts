/**
 * Minimal today-view preference — one honest boolean per user.
 *
 * Stored in AsyncStorage under `minimal:<uid>` (the same
 * `<feature>:<uid>` convention as hifz.ts / khatmah.ts, with the
 * Tasbeeh fallback `user?.id ?? 'anon'` when no user is signed in).
 * Value is the string 'true' / 'false'; anything else (including
 * nothing stored yet) means OFF — the normal Home view.
 *
 * This only decides which Home layout renders. It stores no prayer
 * data, no times, no counts — Home keeps fetching all of that itself.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Storage key for one user's Minimal preference. */
export function minimalKey(uid: string): string {
  return `minimal:${uid}`;
}

/** True when this user turned the Minimal today view on (default OFF). */
export async function loadMinimal(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(minimalKey(uid))) === 'true';
  } catch {
    return false;
  }
}

/** Save this user's Minimal today-view preference. */
export async function saveMinimal(uid: string, on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(minimalKey(uid), on ? 'true' : 'false');
  } catch {
    // Kept in memory for this session; the toggle still works.
  }
}
