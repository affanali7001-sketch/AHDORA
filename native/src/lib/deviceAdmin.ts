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
  openDeviceAdminSettings: () => void;
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

/**
 * Opens Android's own device-admin screen for AHDORA. If the admin
 * is not active it shows Activate; if it is active it shows
 * Deactivate. Returns false when the native module is unavailable
 * (Expo Go / iOS) — the caller shows the "needs the real APK" note.
 */
export function requestDeviceAdminActivation(): boolean {
  const m = getNativeModule();
  if (!m) return false;
  try {
    m.openDeviceAdminSettings();
    return true;
  } catch {
    return false;
  }
}
