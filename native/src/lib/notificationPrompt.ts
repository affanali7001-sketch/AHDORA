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
 * - Ask only when the OS dialog can still be shown AND this user
 *   has never been asked before. Granted, or denied anywhere before
 *   (login card, Notifications screen, Sleep screen) → never ask
 *   again here; the Notifications screen's "Give permission"
 *   button (reachable from Profile → Settings) is the later path,
 *   and when the OS dialog can no longer appear at all it opens
 *   system Settings instead of silently doing nothing.
 * - The "asked" flag is per-user AsyncStorage (`notif:asked:<uid>`),
 *   set the moment the user answers either way — including "Not
 *   now", so a dismissal is never re-asked on the next login.
 * - A genuine OS denial is ALSO recorded device-wide
 *   (`notif:osDenied`, see prayerNotifications.ts): permission is
 *   per-device, not per-account, so a denial on this phone means
 *   "do not ask again" for every account on it.
 *
 * ROOT CAUSE, fixed 2026-11-23: shouldAsk used to require
 * getNotificationPermissionStatus() === 'undetermined'. On Android
 * 13+ that is NEVER true — expo-notifications' native module reports
 * a never-asked user as 'denied' (NotificationManagerCompat
 * .areNotificationsEnabled() is false until POST_NOTIFICATIONS is
 * granted, and the module maps "not enabled" to DENIED), so the
 * in-app card could never appear and login went straight in. The
 * askable state is status 'denied' WITH canAskAgain true;
 * canAskAgain false means the dialog will not appear and only
 * system Settings can help. The per-user "asked" flag was NOT
 * wrongly set for anyone — it is only written after the card is
 * shown, which could never happen on Android — so no flag repair
 * or reset is needed (and a reset would risk re-asking a genuine
 * denial).
 *
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
  getNotificationPermissionDetail,
  hasOsDeniedNotificationPermission,
  openAppNotificationSettings,
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
 * Only when the OS dialog can still be shown and the user has
 * never been asked before — in-app card or OS dialog — and has
 * never denied the OS dialog on this phone. Never throws.
 *
 * The check is canAskAgain, NOT status === 'undetermined': on
 * Android 13+ a never-asked user reads status 'denied' with
 * canAskAgain true, and 'undetermined' never occurs (see the
 * header note). canAskAgain false = permanently denied / switched
 * off in Settings: the dialog will not appear, so no card here —
 * isNotificationPermissionBlocked covers that state instead.
 */
export async function shouldAskNotificationPermission(uid: string): Promise<boolean> {
  try {
    if (await hasAskedNotificationPermission(uid)) return false;
    if (await hasOsDeniedNotificationPermission()) return false;
    const detail = await getNotificationPermissionDetail();
    if (detail.status === 'granted') return false;
    return detail.canAskAgain;
  } catch {
    return false;
  }
}

/**
 * Is permission blocked in a way the OS dialog can never fix — not
 * granted AND the dialog will not appear again (denied twice /
 * "don't ask again" / switched off in system Settings)? Then the
 * post-login flow shows the Settings card (open system Settings /
 * not now) instead of the ask card, once per user. A user who
 * already answered any post-login card never sees it. Never throws.
 */
export async function isNotificationPermissionBlocked(uid: string): Promise<boolean> {
  try {
    if (await hasAskedNotificationPermission(uid)) return false;
    const detail = await getNotificationPermissionDetail();
    if (detail.status === 'granted') return false;
    return !detail.canAskAgain;
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

/**
 * The blocked card's "Open Settings" answer: mark asked (so the
 * card never repeats) and open the app's system Settings page,
 * where notifications can be switched on by hand. Never throws.
 */
export async function openNotificationSettingsAfterAuth(uid: string): Promise<void> {
  await markNotificationPermissionAsked(uid);
  await openAppNotificationSettings();
}
