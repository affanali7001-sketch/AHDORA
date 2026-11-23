/**
 * System (notification-bar) prayer alerts — LOCAL notifications only.
 *
 * What this does: schedules one local notification per enabled prayer
 * at that prayer's time TODAY and TOMORROW, using expo-notifications
 * (SDK 58 docs: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).
 * The alert appears in the Android notification bar like any other
 * app's notification, even when AHDORA is closed — the OS delivers
 * scheduled local notifications; no server, no push, no FCM.
 *
 * HONEST LIMITS (do not claim more than this):
 * - Today + tomorrow are scheduled, from the real prayer times the
 *   app loaded (fetchPrayerTimes). The app must be opened at least
 *   once a day (on startup, or the Prayer screen, or the
 *   Notifications toggle) after install and after each day's times
 *   load, or later days have no alerts.
 * - Delivery is best-effort on Android 12+: exact-time delivery
 *   needs the SCHEDULE_EXACT_ALARM permission, which Android 14
 *   denies by default for newly installed apps. This code does NOT
 *   request exact-alarm permission (it needs a system-settings
 *   detour and Play policy scrutiny), so the OS may shift an alert
 *   by a few minutes. The trigger uses the default 'bestEffort'
 *   delivery, NOT 'alarmClock'.
 * - Tapping a notification just opens the app; tap-to-a-specific-
 *   screen navigation is NOT wired (App.tsx is out of scope here).
 * - ADHAN: when a prayer alert arrives while the app is running, or
 *   the user taps one, the adhan voice picked on the Prayer screen
 *   plays (see src/lib/adhanAudio.ts) — only when adhan sound is
 *   switched on. When the app is closed the alert still arrives,
 *   with the phone's default sound: a remote adhan file cannot be a
 *   notification sound and no audio file can be bundled through the
 *   text-only push.
 * - A notification channel ('ahdora-prayer') is created on Android
 *   before the permission prompt, as the SDK 58 docs require for
 *   Android 13+: the prompt does not appear until at least one
 *   channel exists.
 *
 * Every function here never throws: failures resolve to a safe
 * default (false / 'undetermined' / 0 scheduled) so a notification
 * problem can never break a screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  fetchPrayerTimes,
  PRAYER_NAMES,
  tomorrowKey,
  type PrayerName,
  type PrayerTimesResponse,
} from './apiCore';
import { playAdhanForAlert } from './adhanAudio';

const CHANNEL_ID = 'ahdora-prayer';
const IDS_KEY = '@ahdora/notif/prayerIds';
const ENABLED_KEY = '@ahdora/notif/prayerEnabled';
/** Deep teal from the app theme (C.teal700) — on-brand, no new colour. */
const TEAL = '#0B4A41';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type RefreshResult = {
  scheduled: number;
  status: 'ok' | 'disabled' | 'no-permission' | 'no-times';
};

let handlerSet = false;
let adhanListenersSet = false;

/**
 * Foreground handler: when the app is open and an alert fires, still
 * show it as a banner + in the notification list, with sound.
 * Safe to call repeatedly — it only registers once.
 */
function ensureHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  ensureAdhanListeners();
}

/**
 * Adhan on alert: when a prayer notification arrives while the app
 * is running (foreground) or the user taps one, play the adhan voice
 * the user picked in the Prayer screen — but ONLY when adhan sound
 * is switched on (playAdhanForAlert no-ops otherwise). A notification
 * that arrives while the app is fully closed cannot trigger code,
 * so it arrives with the phone's default sound instead; the Prayer
 * screen says exactly that. Registered once, alongside the handler.
 */
function ensureAdhanListeners(): void {
  if (adhanListenersSet) return;
  adhanListenersSet = true;
  try {
    Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { type?: unknown } | undefined;
      if (data?.type === 'prayer') {
        void playAdhanForAlert();
      }
    });
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: unknown } | undefined;
      if (data?.type === 'prayer') {
        void playAdhanForAlert();
      }
    });
  } catch {
    // Listeners failing must never break notifications themselves.
  }
}

/** Create the Android channel (no-op on other platforms / on failure). */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Namaz reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: TEAL,
    });
  } catch {
    // Channel creation failing must never break the flow; scheduling
    // falls back to the system default channel.
  }
}

async function readStoredIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function storeIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
  } catch {
    // Best effort only; the worst case is a stale id list that the
    // next cancel simply cannot find (cancel ignores unknown ids).
  }
}

/** Current system permission status. Never throws. */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  ensureHandler();
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' || status === 'denied' ? status : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

/**
 * Ask the OS for notification permission. Creates the Android channel
 * first (SDK 58 docs: the Android 13 prompt does not appear until a
 * channel exists). Returns true only when permission is granted.
 * Never throws.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  ensureHandler();
  try {
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Whether the user switched system prayer alerts on (local flag). */
export async function isPrayerNotificationsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Persist the user's master prayer-alert choice (local flag). */
export async function setPrayerNotificationsEnabled(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch {
    // In-memory only for this session if storage fails.
  }
}

/** Cancel every AHDORA prayer notification scheduled earlier. Never throws. */
export async function cancelPrayerNotifications(): Promise<void> {
  ensureHandler();
  const ids = await readStoredIds();
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
  await storeIds([]);
}

/** "HH:mm" on the date today + `dayOffset` days (0 = today, 1 = tomorrow). */
function timeToDate(hhmm: string, dayOffset: number): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/**
 * Schedule one day's alerts into the shared `ids` list. No cancel,
 * no store — the caller owns those (see refreshPrayerNotifications),
 * so scheduling today and tomorrow in one refresh can never cancel
 * the other day's ids. Prayers whose time has already passed on
 * that date are skipped; for tomorrow every prayer is still in the
 * future, so all 5 get scheduled. Silently does nothing when
 * permission is not granted. Never throws.
 */
async function scheduleDay(
  times: PrayerTimesResponse,
  enabled: { [prayer: string]: boolean },
  dayOffset: number,
  ids: string[],
): Promise<void> {
  ensureHandler();
  try {
    if ((await getNotificationPermissionStatus()) !== 'granted') return;
    const now = new Date();
    for (const prayer of PRAYER_NAMES) {
      if (!enabled[prayer]) continue;
      const timeStr =
        times.perPrayer[prayer]?.time ?? times.timings[prayer] ?? '';
      const date = timeToDate(timeStr, dayOffset);
      if (!date || date.getTime() <= now.getTime()) continue;
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${prayer} ka waqt ho gaya`,
            body: 'Namaz ka waqt hai — padh lijiye.',
            data: { type: 'prayer', prayer },
            sound: 'default',
            color: TEAL,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
            channelId: CHANNEL_ID,
          },
        });
        ids.push(id);
      } catch {
        // One prayer failing must not block the others.
      }
    }
  } catch {
    // Scheduling must never throw into a screen.
  }
}

/**
 * Cancel any previously scheduled AHDORA prayer alerts, then schedule
 * one local notification per enabled prayer at that prayer's time
 * on the date today + `dayOffset` (0 = today, 1 = tomorrow; DATE
 * trigger, exact clock time). Prayers whose time has already passed
 * on that date are skipped. `enabled` is keyed by prayer name —
 * pass each prayer's real reminder flag, never a guess. Silently
 * does nothing when permission is not granted. Never throws.
 */
export async function schedulePrayerNotifications(
  times: PrayerTimesResponse,
  enabled: { [prayer: string]: boolean },
  dayOffset = 0,
): Promise<void> {
  ensureHandler();
  try {
    await cancelPrayerNotifications();
    const ids: string[] = [];
    await scheduleDay(times, enabled, dayOffset, ids);
    await storeIds(ids);
  } catch {
    // Scheduling must never throw into a screen.
  }
}

/**
 * One-call refresh for app startup, the Prayer screen and the
 * Notifications toggle: if system prayer alerts are enabled and
 * permission is granted, fetch TODAY's and TOMORROW's real prayer
 * times and schedule the alerts whose per-prayer reminder flag is
 * on (each day's flags from its own response). Returns how many
 * were scheduled in total and why it stopped when it did. If
 * tomorrow's fetch fails, today is still scheduled. If today's
 * fetch fails, nothing is scheduled. Never throws.
 */
export async function refreshPrayerNotifications(): Promise<RefreshResult> {
  try {
    if (!(await isPrayerNotificationsEnabled())) {
      return { scheduled: 0, status: 'disabled' };
    }
    if ((await getNotificationPermissionStatus()) !== 'granted') {
      return { scheduled: 0, status: 'no-permission' };
    }
    let today: PrayerTimesResponse;
    try {
      today = await fetchPrayerTimes();
    } catch {
      return { scheduled: 0, status: 'no-times' };
    }
    // Tomorrow's times are best-effort: if the fetch fails, today
    // is still scheduled (see below).
    let tomorrow: PrayerTimesResponse | null = null;
    try {
      tomorrow = await fetchPrayerTimes(tomorrowKey());
    } catch {
      tomorrow = null;
    }
    // One cancel for the whole refresh, then both days into the
    // same id list — so the two days never cancel each other.
    await cancelPrayerNotifications();
    const ids: string[] = [];
    const enabledToday: { [key: string]: boolean } = {};
    for (const prayer of PRAYER_NAMES) {
      enabledToday[prayer] = today.perPrayer[prayer]?.reminder ?? true;
    }
    await scheduleDay(today, enabledToday, 0, ids);
    if (tomorrow) {
      const enabledTomorrow: { [key: string]: boolean } = {};
      for (const prayer of PRAYER_NAMES) {
        enabledTomorrow[prayer] = tomorrow.perPrayer[prayer]?.reminder ?? true;
      }
      await scheduleDay(tomorrow, enabledTomorrow, 1, ids);
    }
    await storeIds(ids);
    return { scheduled: ids.length, status: 'ok' };
  } catch {
    return { scheduled: 0, status: 'no-times' };
  }
}

export type { PrayerName };
