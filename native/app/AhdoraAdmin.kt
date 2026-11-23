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
//   * openDeviceAdminSettings() — opens Android's own activation
//     screen (ACTION_ADD_DEVICE_ADMIN) for the receiver. Activation
//     can never be silent: the system screen appears and the user
//     must tap Activate. When the admin is already active the same
//     screen shows Deactivate, which is how protection is switched
//     off — deliberately through the system, not one tap in the app.
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

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Fully-qualified name of the receiver declared by withAhdoraAdmin. */
private const val RECEIVER_CLASS_SUFFIX = ".admin.AhdoraDeviceAdminReceiver"

class AhdoraAdmin : Module() {
  override fun definition() = ModuleDefinition {
    Name("AhdoraAdmin")

    AsyncFunction("isAdminActive") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        ?: return@AsyncFunction false
      val admin = ComponentName(context, context.packageName + RECEIVER_CLASS_SUFFIX)
      dpm.isAdminActive(admin)
    }

    Function("openDeviceAdminSettings") {
      val context = appContext.reactContext ?: return@Function null
      val admin = ComponentName(context, context.packageName + RECEIVER_CLASS_SUFFIX)
      val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
        putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, admin)
        putExtra(
          DevicePolicyManager.EXTRA_ADD_EXPLANATION,
          "While this is on, AHDORA cannot be uninstalled. To uninstall, switch it off first."
        )
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      (context as? Activity)?.startActivity(intent) ?: context.startActivity(intent)
      null
    }
  }
}
