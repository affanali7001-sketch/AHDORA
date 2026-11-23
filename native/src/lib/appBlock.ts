/**
 * App Block — JS bridge to the native blocker.
 *
 * The native side is two parts (both Android-only, real APK only):
 *  - `AhdoraBlock` inline module (app/AhdoraBlockModule.kt): checks and
 *    opens the three permissions, lists launchable apps, and reads/writes
 *    the blocking config in SharedPreferences ("ahdora_block").
 *  - `AhdoraBlockService` (Accessibility Service, injected by the
 *    withAhdoraBlock config plugin): reads the same SharedPreferences
 *    and enforces blocking even when the app is closed.
 *
 * In Expo Go the native module does not exist. Every function here
 * degrades gracefully (returns null/false) instead of crashing, and
 * the AppBlock screen explains that the real APK is needed.
 */
import { requireNativeModule } from 'expo';
import { fetchPrayerTimes, PRAYER_NAMES, tomorrowKey, type PrayerName } from './apiCore';
import { getProfile, pomodoroActive } from './apiSocial';

export type AppBlockConfig = {
  blocking_enabled: boolean;
  prayer_block_enabled: boolean;
  sleep_block_enabled: boolean;
  /** Study blocking: while a Focus (Pomodoro) session is running. */
  study_block_enabled: boolean;
  /** Written by the Focus screen / startup sync: true while a
      session is running, with its wall-clock end in study_end. */
  study_active: boolean;
  /** ISO timestamp when the active study session ends, or null. */
  study_end: string | null;
  blocked_packages: string[];
  youtube_allowed: boolean;
  prayer_times: string[];
  prayer_names: string[];
  /** Date (yyyy-MM-dd) the prayer_times above belong to. */
  prayer_date: string | null;
  /** Tomorrow's prayer times/names — the service uses these after
      midnight, so prayer blocking keeps working across days even
      if the app is never opened (today's list alone goes stale). */
  prayer_times_tomorrow: string[];
  prayer_names_tomorrow: string[];
  prayer_grace_min: number;
  sleep_start: string | null;
  sleep_end: string | null;
  prayed: Record<string, string>;
};

export type InstalledApp = {
  packageName: string;
  label: string;
};

export type AppBlockStatus = {
  accessibility: boolean;
  usageAccess: boolean;
  overlay: boolean;
};

export const DEFAULT_APP_BLOCK_CONFIG: AppBlockConfig = {
  blocking_enabled: false,
  prayer_block_enabled: true,
  sleep_block_enabled: false,
  study_block_enabled: false,
  study_active: false,
  study_end: null,
  blocked_packages: [],
  youtube_allowed: false,
  prayer_times: [],
  prayer_names: [],
  prayer_date: null,
  prayer_times_tomorrow: [],
  prayer_names_tomorrow: [],
  prayer_grace_min: 30,
  sleep_start: null,
  sleep_end: null,
  prayed: {},
};

type AhdoraBlockNativeModule = {
  isAccessibilityEnabled: () => Promise<boolean>;
  isUsageAccessGranted: () => Promise<boolean>;
  isOverlayPermissionGranted: () => Promise<boolean>;
  openAccessibilitySettings: () => void;
  openUsageAccessSettings: () => void;
  openOverlaySettings: () => void;
  getInstalledApps: () => Promise<string>;
  getConfig: () => Promise<string>;
  setConfig: (configJson: string) => Promise<void>;
  confirmPrayer: (prayerName: string) => Promise<void>;
  /** True when Android lets the app schedule exact alarms (see AhdoraBlock.kt). */
  canScheduleExactAlarms: () => Promise<boolean>;
  /** Opens the system "Alarms & reminders" page for AHDORA. */
  openExactAlarmSettings: () => void;
};

let cachedModule: AhdoraBlockNativeModule | null | undefined;

function getNativeModule(): AhdoraBlockNativeModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = requireNativeModule<AhdoraBlockNativeModule>('AhdoraBlock');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** False in Expo Go / on iOS — the native blocker is Android APK only. */
export function isAppBlockAvailable(): boolean {
  return getNativeModule() !== null;
}

export async function getAppBlockStatus(): Promise<AppBlockStatus | null> {
  const m = getNativeModule();
  if (!m) return null;
  const [accessibility, usageAccess, overlay] = await Promise.all([
    m.isAccessibilityEnabled(),
    m.isUsageAccessGranted(),
    m.isOverlayPermissionGranted(),
  ]);
  return { accessibility, usageAccess, overlay };
}

export function openAccessibilitySettings(): boolean {
  const m = getNativeModule();
  if (!m) return false;
  m.openAccessibilitySettings();
  return true;
}

export function openUsageAccessSettings(): boolean {
  const m = getNativeModule();
  if (!m) return false;
  m.openUsageAccessSettings();
  return true;
}

export function openOverlaySettings(): boolean {
  const m = getNativeModule();
  if (!m) return false;
  m.openOverlaySettings();
  return true;
}

/**
 * True when Android lets AHDORA schedule exact alarms — the
 * permission the sleep warnings' 'alarmClock' delivery needs.
 * Null in Expo Go / on iOS, or when the check itself fails.
 */
export async function canScheduleExactAlarms(): Promise<boolean | null> {
  const m = getNativeModule();
  if (!m) return null;
  try {
    return (await m.canScheduleExactAlarms()) === true;
  } catch {
    return null;
  }
}

/** Opens the system "Alarms & reminders" page for AHDORA. */
export function openExactAlarmSettings(): boolean {
  const m = getNativeModule();
  if (!m) return false;
  try {
    m.openExactAlarmSettings();
    return true;
  } catch {
    return false;
  }
}

export async function getInstalledApps(): Promise<InstalledApp[] | null> {
  const m = getNativeModule();
  if (!m) return null;
  try {
    const raw = await m.getInstalledApps();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is InstalledApp =>
          !!x && typeof x === 'object' && typeof (x as InstalledApp).packageName === 'string'
      )
      .map((x) => ({
        packageName: x.packageName,
        label: typeof x.label === 'string' && x.label ? x.label : x.packageName,
      }));
  } catch {
    return [];
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

function asRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val;
  }
  return out;
}

export async function loadAppBlockConfig(): Promise<AppBlockConfig | null> {
  const m = getNativeModule();
  if (!m) return null;
  try {
    const raw = await m.getConfig();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_APP_BLOCK_CONFIG };
    const o = parsed as Partial<AppBlockConfig>;
    return {
      blocking_enabled: o.blocking_enabled === true,
      prayer_block_enabled: o.prayer_block_enabled !== false,
      sleep_block_enabled: o.sleep_block_enabled === true,
      study_block_enabled: o.study_block_enabled === true,
      study_active: o.study_active === true,
      study_end: typeof o.study_end === 'string' ? o.study_end : null,
      blocked_packages: asStringArray(o.blocked_packages),
      youtube_allowed: o.youtube_allowed === true,
      prayer_times: asStringArray(o.prayer_times),
      prayer_names: asStringArray(o.prayer_names),
      prayer_date: typeof o.prayer_date === 'string' ? o.prayer_date : null,
      prayer_times_tomorrow: asStringArray(o.prayer_times_tomorrow),
      prayer_names_tomorrow: asStringArray(o.prayer_names_tomorrow),
      prayer_grace_min:
        typeof o.prayer_grace_min === 'number' && o.prayer_grace_min > 0
          ? o.prayer_grace_min
          : 30,
      sleep_start: typeof o.sleep_start === 'string' ? o.sleep_start : null,
      sleep_end: typeof o.sleep_end === 'string' ? o.sleep_end : null,
      prayed: asRecord(o.prayed),
    };
  } catch {
    return { ...DEFAULT_APP_BLOCK_CONFIG };
  }
}

export async function saveAppBlockConfig(config: AppBlockConfig): Promise<boolean> {
  const m = getNativeModule();
  if (!m) return false;
  try {
    await m.setConfig(JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export async function confirmPrayer(prayerName: string): Promise<boolean> {
  const m = getNativeModule();
  if (!m) return false;
  try {
    await m.confirmPrayer(prayerName);
    return true;
  } catch {
    return false;
  }
}

/** Extract "HH:mm" from a time string ("05:12", "05:12:00", "5:12 AM"). */
export function normalizeHHmm(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Pull today's prayer times + the profile sleep window from the live API
 * and merge them into the native config, so the Accessibility Service
 * can enforce blocking even when the app is closed. Returns the merged
 * config (already saved), or null when the native module is unavailable.
 *
 * Tomorrow's prayer times are synced too (with the date the list
 * belongs to): after midnight the service switches to the tomorrow
 * list, so prayer blocking keeps working across days even if the
 * app is never opened — today's list alone would go stale.
 */
export async function syncScheduleFromServer(
  base?: AppBlockConfig
): Promise<AppBlockConfig | null> {
  const m = getNativeModule();
  if (!m) return null;
  const config = base ?? (await loadAppBlockConfig()) ?? { ...DEFAULT_APP_BLOCK_CONFIG };

  try {
    const times = await fetchPrayerTimes();
    const names: string[] = [];
    const hhmm: string[] = [];
    for (const name of PRAYER_NAMES as PrayerName[]) {
      const raw = times.perPrayer?.[name]?.time ?? times.timings?.[name] ?? '';
      const norm = normalizeHHmm(raw);
      if (norm) {
        names.push(name);
        hhmm.push(norm);
      }
    }
    if (hhmm.length > 0) {
      config.prayer_names = names;
      config.prayer_times = hhmm;
      config.prayer_date = todayKey(new Date());
    }
    // Tomorrow's list (best-effort — today still syncs if it fails).
    try {
      const tTimes = await fetchPrayerTimes(tomorrowKey());
      const tNames: string[] = [];
      const tHhmm: string[] = [];
      for (const name of PRAYER_NAMES as PrayerName[]) {
        const raw = tTimes.perPrayer?.[name]?.time ?? tTimes.timings?.[name] ?? '';
        const norm = normalizeHHmm(raw);
        if (norm) {
          tNames.push(name);
          tHhmm.push(norm);
        }
      }
      if (tHhmm.length > 0) {
        config.prayer_names_tomorrow = tNames;
        config.prayer_times_tomorrow = tHhmm;
      }
    } catch {
      // Tomorrow stays as previously saved (or empty).
    }
  } catch {
    // Keep whatever prayer times were saved before; blocking still works
    // off the last synced schedule.
  }

  try {
    const { profile } = await getProfile();
    // The profile is the source of truth for the sleep window: write
    // what it says, including clearing a window the user removed.
    // Before this, a missing sleep time left the OLD window in the
    // native config, so apps kept blocking at a sleep time the user
    // had already changed. (A failed fetch keeps the old window —
    // the catch below — rather than wiping it on a network error.)
    config.sleep_start = normalizeHHmm(profile?.sleepStartTime ?? profile?.sleepTime);
    config.sleep_end = normalizeHHmm(profile?.sleepEndTime);
  } catch {
    // Keep the previously saved sleep window.
  }

  await saveAppBlockConfig(config);
  return config;
}

/** "yyyy-MM-dd" for a date (local time). */
export function todayKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export type StudySessionState = {
  status: string;
  remainingMs: number;
} | null;

/**
 * Write the Focus (Pomodoro) session state into the native block
 * config, so the Accessibility Service can block the picked apps
 * while a study session is running — even when the app is closed.
 * A running session sets study_active + its wall-clock end; any
 * other state (paused / completed / abandoned / none) clears it.
 * The service also self-heals: past study_end it treats the
 * session as over even if this was never called. Fire-and-forget
 * from the Focus screen (start / pause / resume / complete /
 * abandon) and from startup sync. Returns the saved config, or
 * null when the native module is unavailable.
 */
export async function syncStudyBlockFromSession(
  session: StudySessionState,
  base?: AppBlockConfig,
): Promise<AppBlockConfig | null> {
  const m = getNativeModule();
  if (!m) return null;
  const config = base ?? (await loadAppBlockConfig()) ?? { ...DEFAULT_APP_BLOCK_CONFIG };
  if (session && session.status === 'running' && session.remainingMs > 0) {
    config.study_active = true;
    config.study_end = new Date(Date.now() + session.remainingMs).toISOString();
  } else {
    config.study_active = false;
    config.study_end = null;
  }
  await saveAppBlockConfig(config);
  return config;
}

/**
 * Startup sync: ask the server for the active Pomodoro session and
 * mirror it into the native config. Covers the app being killed
 * mid-session and reopened, and sessions that ended while the app
 * was closed (the server says none → the block clears).
 */
export async function syncStudyBlockFromServer(): Promise<AppBlockConfig | null> {
  try {
    const active = await pomodoroActive();
    return syncStudyBlockFromSession(
      active ? { status: active.status, remainingMs: active.remainingMs } : null,
    );
  } catch {
    return null;
  }
}
