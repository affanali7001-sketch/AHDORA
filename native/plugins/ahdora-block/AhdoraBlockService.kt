package com.ahdora.app.block

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * AHDORA app-blocking Accessibility Service.
 *
 * Enforces blocking by watching the foreground app. When blocking is active
 * and the foreground app is blocked, a full-screen overlay is shown.
 *
 * Two modes (both driven by SharedPreferences written by the JS side via
 * the AhdoraBlock inline module — same PREFS_NAME and keys):
 *  - PRAYER: at namaz time, ALL apps are blocked (except the allowlist)
 *    until the user taps "Haan, maine namaz padh li", which records that
 *    prayer as prayed for today and removes the overlay.
 *  - SLEEP: during the sleep window, only the user-picked blocked apps
 *    are blocked (YouTube is exempt only if the user allowed it).
 *
 * Never blocked (calls / emergency / the app itself / Settings):
 * the dialer, emergency, System UI, Settings, and AHDORA itself.
 *
 * Requires the user to enable this service in
 * Settings > Accessibility > AHDORA App Block, plus Usage Access and
 * "Display over other apps" for the overlay. It does NOT run in Expo Go.
 */
class AhdoraBlockService : AccessibilityService() {

  companion object {
    const val PREFS_NAME = "ahdora_block"
    const val KEY_BLOCKING_ENABLED = "blocking_enabled"
    const val KEY_PRAYER_BLOCK_ENABLED = "prayer_block_enabled"
    const val KEY_SLEEP_BLOCK_ENABLED = "sleep_block_enabled"
    const val KEY_BLOCKED_PACKAGES = "blocked_packages"
    const val KEY_YOUTUBE_ALLOWED = "youtube_allowed"
    const val KEY_PRAYER_TIMES = "prayer_times"
    const val KEY_PRAYER_NAMES = "prayer_names"
    const val KEY_PRAYER_GRACE_MIN = "prayer_grace_min"
    const val KEY_SLEEP_START = "sleep_start"
    const val KEY_SLEEP_END = "sleep_end"
    const val KEY_PRAYED = "prayed"

    const val PKG_AHDORA = "com.ahdora.app"
    const val PKG_YOUTUBE = "com.google.android.youtube"

    private val ALWAYS_ALLOWED = setOf(
      PKG_AHDORA,
      "com.android.systemui",
      "com.android.settings",
      "com.android.dialer",
      "com.google.android.dialer",
      "com.samsung.android.dialer",
      "com.google.android.apps.dialer",
      "com.android.phone",
      "com.android.server.telecom",
      "com.android.emergency",
      "com.google.android.apps.safetyhub"
    )

    private const val DEFAULT_GRACE_MIN = 30
  }

  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var overlayMode: String? = null // "prayer" or "sleep"
  private var overlayPrayerName: String? = null

  override fun onServiceConnected() {
    super.onServiceConnected()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    try {
      evaluate(pkg)
    } catch (_: Exception) {
      // Never crash the service on a bad event; blocking just skips this time.
    }
  }

  override fun onInterrupt() {
    removeOverlay()
  }

  override fun onDestroy() {
    removeOverlay()
    super.onDestroy()
  }

  private fun prefs(): SharedPreferences =
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** Decide whether [pkg] should be blocked right now; show/remove overlay. */
  private fun evaluate(pkg: String) {
    val p = prefs()
    if (!p.getBoolean(KEY_BLOCKING_ENABLED, false)) {
      removeOverlay()
      return
    }
    if (ALWAYS_ALLOWED.contains(pkg)) {
      removeOverlay()
      return
    }
    val now = Calendar.getInstance()
    // Prayer lock: blocks ALL apps.
    val prayer = currentPrayerLock(p, now)
    if (prayer != null) {
      showOverlay("prayer", prayer)
      return
    }
    // Sleep block: blocks only the user-picked packages.
    if (isSleepWindow(p, now) && p.getBoolean(KEY_SLEEP_BLOCK_ENABLED, false)) {
      val blocked = readStringSet(p, KEY_BLOCKED_PACKAGES)
      val youtubeAllowed = p.getBoolean(KEY_YOUTUBE_ALLOWED, false)
      if (blocked.contains(pkg) && !(youtubeAllowed && pkg == PKG_YOUTUBE)) {
        showOverlay("sleep", null)
        return
      }
    }
    removeOverlay()
  }

  /**
   * Returns the prayer name whose lock window covers [now], or null.
   * A prayer locks from its time until time + grace minutes, unless the
   * user already confirmed that prayer today.
   */
  private fun currentPrayerLock(p: SharedPreferences, now: Calendar): String? {
    if (!p.getBoolean(KEY_PRAYER_BLOCK_ENABLED, false)) return null
    val times = readStringList(p, KEY_PRAYER_TIMES)
    val names = readStringList(p, KEY_PRAYER_NAMES)
    if (times.isEmpty()) return null
    val grace = p.getInt(KEY_PRAYER_GRACE_MIN, DEFAULT_GRACE_MIN)
    val prayed = readPrayed(p)
    val today = dateKey(now)
    for (i in times.indices) {
      val name = names.getOrNull(i) ?: "Namaz"
      if (prayed[name] == today) continue
      val start = parseHHmm(times[i]) ?: continue
      val end = (start.clone() as Calendar).apply { add(Calendar.MINUTE, grace) }
      if (!now.before(start) && now.before(end)) return name
    }
    return null
  }

  /** True when [now] falls inside the sleep window (handles overnight). */
  private fun isSleepWindow(p: SharedPreferences, now: Calendar): Boolean {
    val startStr = p.getString(KEY_SLEEP_START, null) ?: return false
    val endStr = p.getString(KEY_SLEEP_END, null) ?: return false
    val start = parseHHmm(startStr) ?: return false
    val end = parseHHmm(endStr) ?: return false
    val nowMin = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
    val startMin = start.get(Calendar.HOUR_OF_DAY) * 60 + start.get(Calendar.MINUTE)
    val endMin = end.get(Calendar.HOUR_OF_DAY) * 60 + end.get(Calendar.MINUTE)
    return if (startMin <= endMin) {
      nowMin in startMin until endMin
    } else {
      nowMin >= startMin || nowMin < endMin
    }
  }

  /** Parse "HH:mm" into a Calendar set to today. */
  private fun parseHHmm(value: String): Calendar? {
    return try {
      val parts = value.split(":")
      if (parts.size != 2) return null
      val h = parts[0].toInt()
      val m = parts[1].toInt()
      if (h !in 0..23 || m !in 0..59) return null
      Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, h)
        set(Calendar.MINUTE, m)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun dateKey(cal: Calendar): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)

  private fun readStringList(p: SharedPreferences, key: String): List<String> {
    val raw = p.getString(key, null) ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      List(arr.length()) { arr.optString(it) }.filter { it.isNotEmpty() }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun readStringSet(p: SharedPreferences, key: String): Set<String> =
    readStringList(p, key).toSet()

  private fun readPrayed(p: SharedPreferences): Map<String, String> {
    val raw = p.getString(KEY_PRAYED, null) ?: return emptyMap()
    return try {
      val obj = JSONObject(raw)
      val out = mutableMapOf<String, String>()
      val keys = obj.keys()
      while (keys.hasNext()) {
        val k = keys.next()
        out[k] = obj.optString(k)
      }
      out
    } catch (_: Exception) {
      emptyMap()
    }
  }

  private fun recordPrayed(prayerName: String) {
    val p = prefs()
    val today = dateKey(Calendar.getInstance())
    val map = readPrayed(p).toMutableMap()
    map[prayerName] = today
    p.edit().putString(KEY_PRAYED, JSONObject(map as Map<*, *>).toString()).apply()
  }

  // ---- Overlay ----

  private fun showOverlay(mode: String, prayerName: String?) {
    if (overlayView != null && overlayMode == mode && overlayPrayerName == prayerName) return
    removeOverlay()
    val wm = windowManager ?: return
    val ctx: Context = this
    val root = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#06231F"))
      setPadding(48, 48, 48, 48)
    }
    val title = TextView(ctx).apply {
      text = if (mode == "prayer") "Namaz ka time" else "Sone ka time"
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 28f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    val body = TextView(ctx).apply {
      text = if (mode == "prayer") {
        "Saare apps band hain jab tak aap namaz na padh lein."
      } else {
        "Sone ka time hai. Ye apps ab band hain — subah uthne par khulenge."
      }
      setTextColor(Color.parseColor("#B8CFCB"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 32)
    }
    root.addView(title)
    root.addView(body)
    if (mode == "prayer") {
      val btn = Button(ctx).apply {
        text = "Haan, maine namaz padh li"
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.parseColor("#0B4F4A"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        setPadding(32, 24, 32, 24)
        setOnClickListener {
          val name = overlayPrayerName ?: return@setOnClickListener
          recordPrayed(name)
          removeOverlay()
        }
      }
      root.addView(btn)
      val hint = TextView(ctx).apply {
        text = "Namaz padhne ke baad dabao — saare apps khul jayenge."
        setTextColor(Color.parseColor("#B8CFCB"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        gravity = Gravity.CENTER
        setPadding(0, 20, 0, 0)
      }
      root.addView(hint)
    } else {
      val hint = TextView(ctx).apply {
        text = "Calls aur emergency hamesha khule rehte hain."
        setTextColor(Color.parseColor("#B8CFCB"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
        gravity = Gravity.CENTER
      }
      root.addView(hint)
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      android.graphics.PixelFormat.TRANSLUCENT
    )
    try {
      wm.addView(root, params)
      overlayView = root
      overlayMode = mode
      overlayPrayerName = prayerName
    } catch (_: Exception) {
      // Overlay permission missing or WindowManager rejected it; skip.
      overlayView = null
      overlayMode = null
      overlayPrayerName = null
    }
  }

  private fun removeOverlay() {
    val view = overlayView ?: return
    try {
      windowManager?.removeView(view)
    } catch (_: Exception) {
      // Already removed.
    }
    overlayView = null
    overlayMode = null
    overlayPrayerName = null
  }
}
