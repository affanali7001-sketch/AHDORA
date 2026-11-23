/**
 * Uninstall protection — JS bridge to the native Device Admin flow.
 *
 * The native side is two parts (both Android-only, real APK only):
 *  - `AhdoraAdmin` inline module (app/AhdoraAdmin.kt): checks
 *    whether the admin is active and opens Android's own activation
 *    screen (ACTION_ADD_DEVICE_ADMIN).
 *  - `AhdoraDeviceAdminReceiver` (injected by the withAhdoraAdmin
 *    config plugin): the DeviceAdminReceiver. While it is an ACTIVE
 *    device admin, Android refuses to uninstall the app.
 *
 * Platform truth, stated plainly: on stock Android a regular app
 * CANNOT truly prevent its own uninstall. Device Admin is as far as
 * the platform allows — uninstalling first needs the admin switched
 * off in Settings (or on the system activation screen). The user can
 * always switch it off there and then uninstall; no app can stop a
 * deliberate uninstall. This bridge therefore never claims more:
 * the Profile toggle shows the REAL admin state from
 * DevicePolicyManager, never a saved preference, and turning it on
 * or off always goes through Android's own screen — activation can
 * never be silent.
 *
 * In Expo Go the native module does not exist. Every function here
 * degrades gracefully (returns null/false) instead of crashing, and
 * the Profile screen explains that the real APK is needed.
 */
import { requireNativeModule } from 'expo';

type AhdoraAdminNativeModule = {
  isAdminActive: () => Promise<boolean>;
  /** { receiverPresent, active } in one call (see checkAdminSetup). */
  checkAdminSetup: () => Promise<{ receiverPresent?: unknown; active?: unknown }>;
  /**
   * Opens Android's own device-admin activation screen and reports
   * what actually happened: { opened: true } when the system screen
   * launched, { opened: false, error } when it could not be opened
   * ('receiver-missing' | 'start-failed' | 'unavailable' | 'unknown').
   * The old fire-and-forget call returned nothing, so a failed open
   * looked exactly like a successful one until the toggle never moved.
   */
  openDeviceAdminSettings: () => Promise<{ opened?: unknown; error?: unknown }>;
  /** Opens this app's own info page (Settings → Apps → AHDORA). */
  openAppInfoSettings: () => Promise<boolean>;
  /** Opens the system Security settings page (fallback path). */
  openSecuritySettings: () => Promise<boolean>;
};

let cachedModule: AhdoraAdminNativeModule | null | undefined;

function getNativeModule(): AhdoraAdminNativeModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = requireNativeModule<AhdoraAdminNativeModule>('AhdoraAdmin');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

/** False in Expo Go / on iOS — Device Admin is Android APK only. */
export function isDeviceAdminAvailable(): boolean {
  return getNativeModule() !== null;
}

/**
 * The REAL protection state from DevicePolicyManager — true only
 * while AhdoraDeviceAdminReceiver is an active device admin. False
 * in Expo Go, on iOS, or when the admin was never activated.
 */
export async function isDeviceAdminActive(): Promise<boolean> {
  const m = getNativeModule();
  if (!m) return false;
  try {
    return await m.isAdminActive();
  } catch {
    return false;
  }
}

export type AdminActivationResult = {
  opened: boolean;
  error?: 'receiver-missing' | 'start-failed' | 'unavailable' | 'unknown';
};

export type AdminSetupStatus = {
  /** False when the native module is missing (Expo Go / iOS) or
   * when the receiver is not in this build. */
  receiverPresent: boolean;
  /** True only while the receiver is an active device admin. */
  active: boolean;
};

/**
 * Full setup state in one call: is the receiver in this build, and
 * is it active? Lets the Profile screen tell a missing receiver (a
 * build problem — reinstall the latest APK) from a not-yet-activated
 * admin (a user step — tap the switch, or allow restricted settings
 * first). Returns { receiverPresent: false, active: false } when
 * the native module is missing.
 */
export async function checkAdminSetup(): Promise<AdminSetupStatus> {
  const m = getNativeModule();
  if (!m) return { receiverPresent: false, active: false };
  try {
    const res = await m.checkAdminSetup();
    return {
      receiverPresent: res?.receiverPresent === true,
      active: res?.active === true,
    };
  } catch {
    return { receiverPresent: false, active: false };
  }
}

/**
 * Opens Android's own device-admin screen for AHDORA. If the admin
 * is not active it shows Activate; if it is active it shows
 * Deactivate. Returns whether the system screen actually opened
 * (and why not, when it did not) — the caller must show that
 * result, because a failed open otherwise looks like a tap that
 * did nothing. Returns { opened: false, error: 'unavailable' }
 * when the native module is missing (Expo Go / iOS) — the caller
 * shows the "needs the real APK" note.
 */
export async function requestDeviceAdminActivation(): Promise<AdminActivationResult> {
  const m = getNativeModule();
  if (!m) return { opened: false, error: 'unavailable' };
  try {
    const res = await m.openDeviceAdminSettings();
    if (!res || typeof res !== 'object') return { opened: false, error: 'unknown' };
    if (res.opened === true) return { opened: true };
    const err = res.error;
    return {
      opened: false,
      error:
        err === 'receiver-missing' || err === 'start-failed' || err === 'unavailable'
          ? err
          : 'unknown',
    };
  } catch {
    return { opened: false, error: 'unknown' };
  }
}

/**
 * Opens this app's own info page (Settings → Apps → AHDORA) —
 * the page whose ⋮ menu holds "Allow restricted settings".
 * Android 13+ blocks Device Admin for apps installed outside the
 * Play Store until that is allowed, so this is the step a tap on
 * the Profile switch alone can never do. Returns false when the
 * native module is unavailable or the page could not be opened.
 */
export async function openAppInfoSettings(): Promise<boolean> {
  const m = getNativeModule();
  if (!m) return false;
  try {
    return (await m.openAppInfoSettings()) === true;
  } catch {
    return false;
  }
}

/**
 * Fallback: opens the system Security settings page, where
 * "Device admin apps" lists AHDORA and the admin can be switched
 * on by hand. Returns false when the native module is unavailable
 * or the page could not be opened.
 */
export async function openDeviceAdminSecuritySettings(): Promise<boolean> {
  const m = getNativeModule();
  if (!m) return false;
  try {
    return (await m.openSecuritySettings()) === true;
  } catch {
    return false;
  }
}
