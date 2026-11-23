// AhdoraAdmin — Expo inline module (SDK 56+, experimental).
//
// File name, class name and the module Name() MUST all be "AhdoraAdmin"
// (Expo inline-module convention). The module is discovered from the
// project's `app/` directory (app.json: expo.experiments.inlineModules.
// watchedDirectories) and compiled into the native build — no separate
// package, no MainApplication edit.
//
// This is the JS bridge to AHDORA's uninstall protection (Device Admin):
//   * isAdminActive() — asks DevicePolicyManager whether
//     AhdoraDeviceAdminReceiver is currently an active device admin.
//     The Profile toggle shows THIS real state, never a saved flag.
//   * checkAdminSetup() — { receiverPresent, active } in one call,
//     so the Profile screen can tell a missing receiver (a build
//     problem) from a not-yet-activated admin (a user step).
//   * openDeviceAdminSettings() — opens Android's own activation
//     screen (ACTION_ADD_DEVICE_ADMIN) for the receiver. Activation
//     can never be silent: the system screen appears and the user
//     must tap Activate. When the admin is already active the same
//     screen shows Deactivate, which is how protection is switched
//     off — deliberately through the system, not one tap in the app.
//   * openAppInfoSettings() — opens Settings → Apps → AHDORA, whose
//     ⋮ menu holds "Allow restricted settings". Android 13+ blocks
//     Device Admin for apps installed outside the Play Store until
//     that is allowed — that is why a tap on the switch alone could
//     never turn protection on for a sideloaded APK.
//
// The receiver class is addressed by fully-qualified name string,
// not imported: the module must still compile if the receiver file
// is ever missing (admin then simply never activates). No policies
// are requested — the admin only makes uninstall need the extra step
// of switching it off first. It cannot stop a deliberate uninstall;
// no app on stock Android can.
//
// The receiver class is addressed by fully-qualified name string,
// not imported: the module must still compile if the receiver file
// is ever missing (admin then simply never activates). No policies
// are requested — the admin only makes uninstall need the extra step
// of switching it off first. It cannot stop a deliberate uninstall;
// no app on stock Android can.
//
// In Expo Go this module does not exist; the JS side
// (src/lib/deviceAdmin.ts) loads it with requireNativeModule inside
// a try/catch and falls back to null.
package app

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Fully-qualified name of the receiver declared by withAhdoraAdmin. */
private const val RECEIVER_CLASS_SUFFIX = ".admin.AhdoraDeviceAdminReceiver"

class AhdoraAdmin : Module() {
  /** Is the receiver actually declared in this build? (A missing
   * receiver is a build problem, not a user problem — the JS side
   * shows a different message for it.) */
  private fun receiverExists(context: Context, admin: ComponentName): Boolean {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.packageManager.getReceiverInfo(
          admin,
          PackageManager.ComponentInfoFlags.of(0),
        )
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getReceiverInfo(admin, 0)
      }
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    } catch (_: Exception) {
      false
    }
  }

  /** Start a system intent from the current Activity when there is
   * one (the reliable path), else from the React context with
   * NEW_TASK. The old code cast the React context to Activity —
   * that cast is always null, so every intent went through the
   * fallback path. */
  private fun launchIntent(intent: Intent): Boolean {
    val context = appContext.reactContext ?: return false
    return try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AhdoraAdmin")

    AsyncFunction("isAdminActive") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        ?: return@AsyncFunction false
      val admin = ComponentName(context, context.packageName + RECEIVER_CLASS_SUFFIX)
      dpm.isAdminActive(admin)
    }

    /**
     * Full setup state in one call, so the Profile screen can tell
     * the user EXACTLY what is wrong: the receiver is missing from
     * the build (reinstall the latest APK) vs the admin simply not
     * activated yet (tap the switch / allow restricted settings).
     * Returns { receiverPresent, active } — both false when the
     * module itself is unavailable.
     */
    AsyncFunction("checkAdminSetup") {
      val context = appContext.reactContext
        ?: return@AsyncFunction mapOf<String, Any>(
          "receiverPresent" to false,
          "active" to false,
        )
      val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
      val admin = ComponentName(context, context.packageName + RECEIVER_CLASS_SUFFIX)
      val active = try {
        dpm?.isAdminActive(admin) == true
      } catch (_: Exception) {
        false
      }
      mapOf<String, Any>(
        "receiverPresent" to receiverExists(context, admin),
        "active" to active,
      )
    }

    /**
     * Opens Android's own device-admin activation screen for the
     * receiver and reports what actually happened — the old version
     * was a fire-and-forget Function that returned nothing, so when
     * the screen failed to open (receiver missing from the build,
     * intent rejected) the toggle just sat there and the Profile
     * screen "refreshed" with nothing to show for it. Returns
     * { opened: true } when the system screen was launched,
     * { opened: false, error: 'receiver-missing' } when the
     * receiver is not in this build, { opened: false, error:
     * 'start-failed' } when Android refused the intent, and
     * { opened: false, error: 'unavailable' } with no React
     * context. The JS side shows the matching honest message and
     * offers the Security-settings fallback instead of a dead
     * toggle. If the admin is already active, the same screen shows
     * Deactivate — that is how protection is switched off.
     */
    AsyncFunction("openDeviceAdminSettings") {
      val context = appContext.reactContext
        ?: return@AsyncFunction mapOf<String, Any>("opened" to false, "error" to "unavailable")
      val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
      val admin = ComponentName(context, context.packageName + RECEIVER_CLASS_SUFFIX)
      // Already active: the system screen opens on Deactivate.
      val alreadyActive = try {
        dpm?.isAdminActive(admin) == true
      } catch (_: Exception) {
        false
      }
      if (!alreadyActive) {
        // Is the receiver actually in this build? If the config
        // plugin never declared it, ACTION_ADD_DEVICE_ADMIN has
        // nothing to activate and startActivity throws — check
        // first so the failure is reported, not swallowed.
        if (!receiverExists(context, admin)) {
          return@AsyncFunction mapOf<String, Any>(
            "opened" to false,
            "error" to "receiver-missing",
          )
        }
      }
      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
        putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
        putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "While this is on, AHDORA cannot be uninstalled. To uninstall, switch it off first."
        )
      }
      return@AsyncFunction if (launchIntent(intent)) {
        mapOf<String, Any>("opened" to true)
      } else {
        mapOf<String, Any>("opened" to false, "error" to "start-failed")
      }
    }

    /**
     * Opens this app's own info page (Settings → Apps → AHDORA) —
     * the page whose ⋮ menu holds "Allow restricted settings".
     * Android 13+ blocks Device Admin for apps installed outside
     * the Play Store until that is allowed, so a tap on the
     * Profile switch alone can never turn protection on: the user
     * must allow restricted settings first, then tap the switch
     * again. Returns true only when the page was actually launched.
     */
    AsyncFunction("openAppInfoSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:" + context.packageName)
      }
      launchIntent(intent)
    }

    /**
     * Fallback when the activation screen cannot be opened: the
     * system Security settings page, where "Device admin apps"
     * lists AHDORA and the admin can be switched on by hand.
     * Returns true only when the page was actually launched.
     */
    AsyncFunction("openSecuritySettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(Settings.ACTION_SECURITY_SETTINGS)
      launchIntent(intent)
    }
  }
}
