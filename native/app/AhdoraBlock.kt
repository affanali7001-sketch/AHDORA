// AhdoraBlock — Expo inline module (SDK 56+, experimental).
//
// File name, class name and the module Name() MUST all be "AhdoraBlock"
// (Expo inline-module convention). The module is discovered from the
// project's `app/` directory (app.json: expo.experiments.inlineModules.
// watchedDirectories) and compiled into the native build — no separate
// package, no MainApplication edit.
//
// This is the JS bridge to the AHDORA blocker:
//   * Checks the three permissions the blocker needs
//     (Accessibility service, Usage Access, "Display over other apps").
//   * Opens the exact Android Settings screens to grant them.
//   * Reads the launchable apps so the user can pick which ones to block.
//   * Reads/writes the block config in SharedPreferences ("ahdora_block"),
//     which the Accessibility Service (AhdoraBlockService) enforces even
//     when the app is closed.
//   * Lets the JS side record that a prayer was prayed (unlock).
//
// Returns JSON strings for objects/arrays, because the Expo Module API
// only maps primitives directly. In Expo Go this module does not exist;
// the JS side (src/lib/appBlock.ts) loads it with requireNativeModule
// inside a try/catch and falls back to null.
package app

import android.app.Activity
import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class AhdoraBlock : Module() {
  override fun definition() = ModuleDefinition {
    Name("AhdoraBlock")

    AsyncFunction("isAccessibilityEnabled") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val enabledServices = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: return@AsyncFunction false
      val ourComponent =
        "${context.packageName}/${context.packageName}.block.AhdoraBlockService"
      TextUtils.SimpleStringSplitter(':').run {
        setString(enabledServices)
        while (hasNext()) {
          if (next().equals(ourComponent, ignoreCase = true)) {
            return@AsyncFunction true
          }
        }
      }
      false
    }

    AsyncFunction("isUsageAccessGranted") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager
        ?: return@AsyncFunction false
      val mode = appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
      mode == AppOpsManager.MODE_ALLOWED
    }

    AsyncFunction("isOverlayPermissionGranted") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }

    AsyncFunction("getInstalledApps") {
      val context = appContext.reactContext ?: return@AsyncFunction "[]"
      val pm = context.packageManager
      val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
      }
      val apps = pm.queryIntentActivities(mainIntent, 0)
      val out = JSONArray()
      for (info in apps) {
        val activityInfo = info.activityInfo ?: continue
        val packageName = activityInfo.packageName ?: continue
        if (packageName == context.packageName) continue
        val appInfo = try {
          pm.getApplicationInfo(packageName, 0)
        } catch (e: PackageManager.NameNotFoundException) {
          null
        }
        if (appInfo != null && appInfo.flags and ApplicationInfo.FLAG_SYSTEM != 0) {
          continue
        }
        val label = pm.getApplicationLabel(appInfo ?: continue).toString()
        val obj = JSONObject()
        obj.put("packageName", packageName)
        obj.put("label", label)
        out.put(obj)
      }
      // Sort by label (case-insensitive) for a stable picker.
      val list = mutableListOf<JSONObject>()
      for (i in 0 until out.length()) list.add(out.getJSONObject(i))
      list.sortBy { it.optString("label").lowercase() }
      val sorted = JSONArray()
      for (obj in list) sorted.put(obj)
      sorted.toString()
    }

    AsyncFunction("getConfig") {
      val context = appContext.reactContext ?: return@AsyncFunction ""
      context.getSharedPreferences("ahdora_block", Context.MODE_PRIVATE)
        .getString("config", "")
        ?: ""
    }

    AsyncFunction("setConfig") { json: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.getSharedPreferences("ahdora_block", Context.MODE_PRIVATE)
        .edit()
        .putString("config", json)
        .commit()
    }

    AsyncFunction("confirmPrayer") { prayer: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences("ahdora_block", Context.MODE_PRIVATE)
      val raw = prefs.getString("config", "") ?: ""
      if (raw.isEmpty()) return@AsyncFunction false
      val obj = JSONObject(raw)
      val prayed = obj.optJSONObject("prayed") ?: JSONObject()
      val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        .format(java.util.Date())
      prayed.put(prayer, today)
      obj.put("prayed", prayed)
      prefs.edit().putString("config", obj.toString()).commit()
    }

    Function("openAccessibilitySettings") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context as? Activity)?.startActivity(intent) ?: context.startActivity(intent)
    }

    Function("openUsageAccessSettings") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context as? Activity)?.startActivity(intent) ?: context.startActivity(intent)
    }

    Function("openOverlaySettings") {
      val context = appContext.reactContext ?: return@Function
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (context as? Activity)?.startActivity(intent) ?: context.startActivity(intent)
    }
  }
}
