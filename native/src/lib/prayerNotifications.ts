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
 * SLEEP WARNINGS (same system, second channel 'ahdora-sleep'):
 * before this file had them, NOTHING was ever scheduled at sleep
 * time — the Sleep screen's warning switch only saved a local flag,
 * so no warning could ever arrive. refreshSleepWarnings() below
 * schedules the real thing: a notification at the sleep time itself
 * and, when the 5-minute warning is on, one 5 minutes before it —
 * for today and tomorrow, from the real sleep schedule. The same
 * best-effort limit as prayer alerts applies (Android 12+ may shift
 * a non-exact alarm by a few minutes; this code does not request
 * SCHEDULE_EXACT_ALARM). Sleep warnings have their own id list, so
 * cancelling prayer alerts never cancels sleep warnings or vice
 * versa.
 *
 * Every function here never throws: failures resolve to a safe
 * default (false / 'undetermined' / 0 scheduled) so a notification
 * problem can never break a screen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  fetchPrayerTimes,
  PRAYER_NAMES,
  tomorrowKey,
  type PrayerName,
  type PrayerTimesResponse,
} from './apiCore';
import { getProfile } from './apiSocial';
import { playAdhanForAlert } from './adhanAudio';

const CHANNEL_ID = 'ahdora-prayer';
const IDS_KEY = '@ahdora/notif/prayerIds';
const ENABLED_KEY = '@ahdora/notif/prayerEnabled';
/**
 * Device-level record that the OS notification dialog was shown and
 * the user said no (set by requestNotificationPermission below, from
 * ANY screen — login card, Notifications, Sleep). Permission is
 * per-device, not per-account, so this is deliberately NOT per-uid:
 * a denial on this phone means "do not ask again" for every account
 * on it. Cleared when permission is ever granted. It never blocks the
 * Settings path — only the re-ask.
 */
const OS_DENIED_KEY = '@ahdora/notif/osDenied';
/** Sleep-setting flags, owned by the Sleep screen (same keys it reads). */
export const SLEEP_BLOCK_KEY = '@ahdora/sleep/blockApps';
export const SLEEP_WARN_KEY = '@ahdora/sleep/warn5min';
/** Sleep warnings live on their own channel + id list (see header). */
const SLEEP_CHANNEL_ID = 'ahdora-sleep';
const SLEEP_IDS_KEY = '@ahdora/notif/sleepIds';
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

/**
 * Current system permission status. Never throws.
 *
 * WARNING — do NOT gate a "should we ask?" check on 'undetermined':
 * on Android 13+ a user who was NEVER asked reads 'denied' here, not
 * 'undetermined'. expo-notifications' native module reports DENIED
 * whenever notifications are switched off at system level
 * (NotificationManagerCompat.areNotificationsEnabled() is false until
 * POST_NOTIFICATIONS is granted), and 'undetermined' is only reachable
 * on iOS. The askable state on Android is status 'denied' WITH
 * canAskAgain true — see getNotificationPermissionDetail below.
 * (This wrong gate is exactly why the post-login prompt never appeared
 * before 2026-11-23: see src/lib/notificationPrompt.ts.)
 */
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
 * Full permission detail: status plus whether the OS dialog can still
 * be shown (canAskAgain). This is the only correct "should we ask?"
 * input — see the warning on getNotificationPermissionStatus. Never
 * throws; on error it fails closed (canAskAgain false) so an unknown
 * state never triggers a prompt.
 */
export async function getNotificationPermissionDetail(): Promise<{
  status: PermissionStatus;
  canAskAgain: boolean;
}> {
  ensureHandler();
  try {
    const res = await Notifications.getPermissionsAsync();
    return {
      status:
        res.status === 'granted' || res.status === 'denied'
          ? res.status
          : 'undetermined',
      canAskAgain: res.canAskAgain !== false,
    };
  } catch {
    return { status: 'undetermined', canAskAgain: false };
  }
}

/** True when the OS dialog was shown before and the user denied it (any screen). Never throws. */
export async function hasOsDeniedNotificationPermission(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OS_DENIED_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function setOsDeniedNotificationPermission(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(OS_DENIED_KEY, value ? 'true' : 'false');
  } catch {
    // Best effort; the worst case is asking once more next login.
  }
}

/**
 * Open the app's page in system Settings (where notifications can be
 * switched on by hand). Returns true only when the Settings page was
 * actually opened. Never throws. No new dependency — react-native
 * Linking, a core API.
 */
export async function openAppNotificationSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the OS for notification permission. Creates the Android channel
 * first (SDK 58 docs: the Android 13 prompt does not appear until a
 * channel exists). Returns true only when permission is granted.
 * Never throws.
 *
 * Blocked (permanently denied, or switched off in system Settings):
 * the OS will NOT show the dialog again, so calling
 * requestPermissionsAsync would silently return denied and leave the
 * caller with a dead button. Route to system Settings instead —
 * real work, no re-ask. The OS answer itself is recorded (any
 * screen): a denial means the post-login prompt must never re-ask on
 * this phone, and a grant clears a stale denial.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  ensureHandler();
  try {
    const detail = await getNotificationPermissionDetail();
    if (detail.status !== 'granted' && !detail.canAskAgain) {
      await openAppNotificationSettings();
      return false;
    }
    await ensureChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    const granted = status === 'granted';
    await setOsDeniedNotificationPermission(!granted);
    return granted;
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

/** Create the Android sleep channel (no-op on other platforms / on failure). */
async function ensureSleepChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(SLEEP_CHANNEL_ID, {
      name: 'Sleep reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: TEAL,
    });
  } catch {
    // Scheduling falls back to the system default channel.
  }
}

async function readSleepIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SLEEP_IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function storeSleepIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SLEEP_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Best effort only; the next cancel simply cannot find a stale id.
  }
}

export type SleepWarningStatus = 'ok' | 'disabled' | 'no-permission' | 'no-schedule';

export type SleepWarningState = {
  scheduled: number;
  status: SleepWarningStatus;
  /** Soonest warning that will fire (5-min or sleep-time, whichever is first). */
  nextWarning: Date | null;
  /** Next 5-minutes-before warning, or null when that warning is off / passed. */
  nextEarly: Date | null;
  /** Next sleep-time warning, or null when it is off / passed. */
  nextAtTime: Date | null;
};

const EMPTY_SLEEP_STATE: SleepWarningState = {
  scheduled: 0,
  status: 'no-schedule',
  nextWarning: null,
  nextEarly: null,
  nextAtTime: null,
};

/** Cancel every scheduled AHDORA sleep warning. Never throws. */
export async function cancelSleepWarnings(): Promise<void> {
  ensureHandler();
  const ids = await readSleepIds();
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
  await storeSleepIds([]);
}

/**
 * Schedule the REAL sleep warnings from the real sleep schedule:
 * one notification at the sleep time itself, and — when the
 * 5-minute warning is on — one 5 minutes before it. Both are
 * scheduled for today and tomorrow (whichever times are still in
 * the future), so the warning survives a day without opening the
 * app, exactly like the prayer alerts. The sleep-time warning is
 * scheduled when either sleep switch is on (warning or bedtime
 * block); the 5-minute warning only when the warning switch is on.
 * When neither switch is on, or there is no sleep time, any
 * previously scheduled sleep warnings are cancelled and nothing
 * new is scheduled. Returns what was actually scheduled and the
 * real next warning time (null when none). Never throws.
 */
export async function refreshSleepWarnings(
  sleepStart: string | null,
  warn5min: boolean,
  blockApps: boolean,
): Promise<SleepWarningState> {
  ensureHandler();
  try {
    if (!sleepStart || (!warn5min && !blockApps)) {
      await cancelSleepWarnings();
      return {
        ...EMPTY_SLEEP_STATE,
        status: !sleepStart ? 'no-schedule' : 'disabled',
      };
    }
    if ((await getNotificationPermissionStatus()) !== 'granted') {
      await cancelSleepWarnings();
      return { ...EMPTY_SLEEP_STATE, status: 'no-permission' };
    }
    await ensureSleepChannel();
    await cancelSleepWarnings();
    const ids: string[] = [];
    const now = new Date();
    let nextEarly: Date | null = null;
    let nextAtTime: Date | null = null;
    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
      const at = timeToDate(sleepStart, dayOffset);
      if (!at) return { ...EMPTY_SLEEP_STATE, status: 'no-schedule' };
      if (at.getTime() > now.getTime()) {
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Sone ka waqt ho gaya',
              body: 'Neend ka waqt hai — apps ab band hain. Phone rakh do.',
              data: { type: 'sleep', kind: 'at-time' },
              sound: 'default',
              color: TEAL,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: at,
              channelId: SLEEP_CHANNEL_ID,
            },
          });
          ids.push(id);
          if (!nextAtTime) nextAtTime = at;
        } catch {
          // One warning failing must not block the other.
        }
      }
      if (warn5min) {
        const early = new Date(at.getTime() - 5 * 60 * 1000);
        if (early.getTime() > now.getTime()) {
          try {
            const id = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Sone ka waqt — 5 minute bache hain',
                body: 'Apps band kar do, warna AHDORA sone ke waqt band kar dega.',
                data: { type: 'sleep', kind: 'early' },
                sound: 'default',
                color: TEAL,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: early,
                channelId: SLEEP_CHANNEL_ID,
              },
            });
            ids.push(id);
            if (!nextEarly) nextEarly = early;
          } catch {
            // One warning failing must not block the other.
          }
        }
      }
    }
    await storeSleepIds(ids);
    const soonest = [nextEarly, nextAtTime]
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    return { scheduled: ids.length, status: 'ok', nextWarning: soonest, nextEarly, nextAtTime };
  } catch {
    return { ...EMPTY_SLEEP_STATE, status: 'no-schedule' };
  }
}

/**
 * No-arg refresh for app startup: reads the real sleep schedule
 * from the profile and the two Sleep-screen flags from storage,
 * then (re-)schedules the sleep warnings. This is the one-liner
 * App.tsx startup should call next to refreshPrayerNotifications.
 * Never throws.
 */
export async function refreshSleepWarningsFromStorage(): Promise<SleepWarningState> {
  try {
    const [{ profile }, warnRaw, blockRaw] = await Promise.all([
      getProfile(),
      AsyncStorage.getItem(SLEEP_WARN_KEY),
      AsyncStorage.getItem(SLEEP_BLOCK_KEY),
    ]);
    const start =
      typeof profile?.sleepStartTime === 'string'
        ? profile.sleepStartTime
        : typeof profile?.sleepTime === 'string'
          ? profile.sleepTime
          : null;
    return refreshSleepWarnings(start, warnRaw !== 'false', blockRaw === 'true');
  } catch {
    return { ...EMPTY_SLEEP_STATE };
  }
}

/**
 * Fire a REAL sleep warning right now through the real sleep
 * channel (the Sleep screen's test button). Returns true only
 * when the notification was actually handed to the OS. Never throws.
 */
export async function sendSleepTestNotification(): Promise<boolean> {
  ensureHandler();
  try {
    if ((await getNotificationPermissionStatus()) !== 'granted') return false;
    await ensureSleepChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sone ka waqt — 5 minute bache hain',
        body: 'Ye ek asal test warning hai — sleep warning isi tarah aayegi.',
        data: { type: 'sleep', kind: 'test' },
        sound: 'default',
        color: TEAL,
      },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}

export type { PrayerName };
