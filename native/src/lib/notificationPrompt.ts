/**
 * Notification permission prompt, shown once after login / signup.
 *
 * The user asked: "app login yaa signup jaise ho waise hi
 * notification ka permission mangna hai" — as soon as login or
 * signup succeeds, the app explains (one line, EN+HI) why
 * notifications matter and then shows the system dialog.
 *
 * Rules (do not change without the user saying so):
 * - Ask ONLY right after a fresh login or signup — never on session
 *   restore (App.tsx's restoreSession path does not call this) and
 *   never on every app open or every login.
 * - Ask only when the OS permission is still undecided AND this user
 *   has never been asked before. Granted or denied already → never
 *   ask again here; the Notifications screen's "Give permission"
 *   button (reachable from Profile → Settings) is the later path.
 * - The "asked" flag is per-user AsyncStorage (`notif:asked:<uid>`),
 *   set the moment the user answers either way — including "Not
 *   now", so a dismissal is never re-asked on the next login.
 * - If granted: prayer alerts are switched on locally and scheduled
 *   with the existing refresh flow. The server's prayer category
 *   defaults to on for a new account, and the Notifications screen
 *   reconciles the local flag from the server on its next visit, so
 *   this cannot leave a permanent mismatch.
 * - If denied: nothing is blocked, nothing is scheduled, and the
 *   user goes straight into the app.
 *
 * No exported function ever throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getNotificationPermissionStatus,
  refreshPrayerNotifications,
  requestNotificationPermission,
  setPrayerNotificationsEnabled,
} from './prayerNotifications';

const askedKey = (uid: string): string => `@ahdora/notif/asked:${uid}`;

/** True when this user has already been asked (either answer). */
export async function hasAskedNotificationPermission(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(askedKey(uid))) === 'true';
  } catch {
    return false;
  }
}

export async function markNotificationPermissionAsked(uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(askedKey(uid), 'true');
  } catch {
    // Best effort; the worst case is asking once more next login.
  }
}

/**
 * Should the post-login/signup prompt be shown for this user?
 * Only when the OS permission is still undecided and the user has
 * never been asked before. Never throws.
 */
export async function shouldAskNotificationPermission(uid: string): Promise<boolean> {
  try {
    if (await hasAskedNotificationPermission(uid)) return false;
    return (await getNotificationPermissionStatus()) === 'undetermined';
  } catch {
    return false;
  }
}

/**
 * The "Allow" answer: mark asked, show the system dialog, and when
 * granted switch prayer alerts on locally and schedule them with
 * the existing refresh flow. Returns whether permission is granted
 * now. Never throws; a failure simply means "not granted".
 */
export async function allowNotificationsAfterAuth(uid: string): Promise<boolean> {
  try {
    await markNotificationPermissionAsked(uid);
    const granted = await requestNotificationPermission();
    if (!granted) return false;
    await setPrayerNotificationsEnabled(true);
    await refreshPrayerNotifications();
    return true;
  } catch {
    return false;
  }
}

/** The "Not now" answer: mark asked and move on. Never throws. */
export async function skipNotificationsAfterAuth(uid: string): Promise<void> {
  await markNotificationPermissionAsked(uid);
}
