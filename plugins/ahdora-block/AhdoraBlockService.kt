package com.ahdora.app.block

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * AHDORA app-blocking Accessibility Service.
 *
 * Enforces blocking by watching the foreground app. When blocking is active
 * and the foreground app is blocked, a full-screen overlay is shown.
 *
 * Two modes (both driven by the single "config" JSON blob in
 * SharedPreferences, written by the JS side via the AhdoraBlock
 * inline module — same PREFS_NAME, field names are the KEY_* values):
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
  /**
   * Uptime (ms) when the overlay was last added. Adding the overlay
   * itself fires a TYPE_WINDOW_STATE_CHANGED event for OUR OWN
   * package (com.ahdora.app) — and removing it fires another one
   * when the blocked app regains focus. Without a guard, evaluate()
   * sees our own package (always allowed) and tears the overlay
   * down, the blocked app fires again, and the overlay is rebuilt
   * — a visible flicker/glitch loop on every blocked app, exactly
   * what the user reported on WhatsApp at sleep time. Events from
   * our own package within GRACE_MS of showing the overlay are the
   * overlay's own echo and are ignored; a genuine switch to AHDORA
   * after that still removes it (see onAccessibilityEvent).
   */
  private var overlayShownAt: Long = 0L
  private val overlayGraceMs: Long = 5000L
  /** Last foreground package seen, for the periodic re-check below. */
  private var lastPkg: String? = null
  private val handler = Handler(Looper.getMainLooper())
  /**
   * Accessibility events only fire when the foreground window CHANGES.
   * Without this, blocking would never start if the user is already
   * inside a blocked app when the sleep window (or a prayer lock)
   * begins, and a sleep overlay would never lift when the window
   * ends while the app is still in front. Re-evaluate the last
   * foreground package every 30 seconds so time-based windows are
   * enforced and released even with no window change. (30s, not
   * 60s: a block that should have lifted — window ended, schedule
   * changed — must not linger a full minute.)
   */
  private val recheckRunnable = object : Runnable {
    override fun run() {
      try {
        lastPkg?.let { evaluate(it) }
      } catch (_: Exception) {
        // Never crash the service on a re-check failure.
      }
      handler.postDelayed(this, 30_000L)
    }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    handler.postDelayed(recheckRunnable, 30_000L)
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    lastPkg = pkg
    // Our own package: when the overlay is showing, an event from
    // com.ahdora.app within a few seconds of the overlay appearing
    // is the overlay's own echo (see overlayShownAt) — evaluating
    // it would tear the overlay down and start the flicker loop.
    // After the grace window, a genuine switch to AHDORA still
    // evaluates normally and lifts the overlay.
    if (pkg == PKG_AHDORA && overlayView != null &&
      android.os.SystemClock.uptimeMillis() - overlayShownAt < overlayGraceMs
    ) {
      return
    }
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
    handler.removeCallbacks(recheckRunnable)
    removeOverlay()
    super.onDestroy()
  }

  private fun prefs(): SharedPreferences =
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /**
   * ROOT CAUSE (fixed 2026-11-23): the JS bridge (AhdoraBlock inline
   * module) writes the WHOLE config as ONE JSON string under the
   * single key "config" (see setConfig/getConfig). This service used
   * to read each field as its own SharedPreferences key
   * (getBoolean("blocking_enabled"), getString("prayer_times"), …) —
   * keys the bridge never writes — so every read fell back to its
   * default: blocking_enabled=false, empty blocked list, no sleep
   * window. The service therefore NEVER blocked anything, no matter
   * which permissions the user granted. All config reads below go
   * through this one blob now; the keys above are only the field
   * names inside that JSON object.
   */
  private fun readConfig(): JSONObject? {
    val raw = prefs().getString("config", null) ?: return null
    if (raw.isEmpty()) return null
    return try {
      JSONObject(raw)
    } catch (_: Exception) {
      null
    }
  }

  private fun configBool(cfg: JSONObject, key: String, default: Boolean): Boolean =
    if (cfg.has(key)) cfg.optBoolean(key, default) else default

  private fun configString(cfg: JSONObject, key: String): String? {
    val v = cfg.optString(key, "")
    return if (v.isEmpty()) null else v
  }

  private fun configInt(cfg: JSONObject, key: String, default: Int): Int =
    cfg.optInt(key, default)

  private fun configStringList(cfg: JSONObject, key: String): List<String> {
    val arr = cfg.optJSONArray(key) ?: return emptyList()
    return List(arr.length()) { arr.optString(it) }.filter { it.isNotEmpty() }
  }

  private fun configPrayed(cfg: JSONObject): Map<String, String> {
    val obj = cfg.optJSONObject(KEY_PRAYED) ?: return emptyMap()
    val out = mutableMapOf<String, String>()
    val keys = obj.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      out[k] = obj.optString(k)
    }
    return out
  }

  /** Decide whether [pkg] should be blocked right now; show/remove overlay. */
  private fun evaluate(pkg: String) {
    val cfg = readConfig() ?: run {
      removeOverlay()
      return
    }
    if (!configBool(cfg, KEY_BLOCKING_ENABLED, false)) {
      removeOverlay()
      return
    }
    if (ALWAYS_ALLOWED.contains(pkg)) {
      removeOverlay()
      return
    }
    val now = Calendar.getInstance()
    // Prayer lock: blocks ALL apps.
    val prayer = currentPrayerLock(cfg, now)
    if (prayer != null) {
      showOverlay("prayer", prayer)
      return
    }
    // Sleep block: blocks only the user-picked packages.
    if (isSleepWindow(cfg, now) && configBool(cfg, KEY_SLEEP_BLOCK_ENABLED, false)) {
      val blocked = configStringList(cfg, KEY_BLOCKED_PACKAGES).toSet()
      val youtubeAllowed = configBool(cfg, KEY_YOUTUBE_ALLOWED, false)
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
  private fun currentPrayerLock(cfg: JSONObject, now: Calendar): String? {
    if (!configBool(cfg, KEY_PRAYER_BLOCK_ENABLED, false)) return null
    val times = configStringList(cfg, KEY_PRAYER_TIMES)
    val names = configStringList(cfg, KEY_PRAYER_NAMES)
    if (times.isEmpty()) return null
    val grace = configInt(cfg, KEY_PRAYER_GRACE_MIN, DEFAULT_GRACE_MIN)
    val prayed = configPrayed(cfg)
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
  private fun isSleepWindow(cfg: JSONObject, now: Calendar): Boolean {
    val startStr = configString(cfg, KEY_SLEEP_START) ?: return false
    val endStr = configString(cfg, KEY_SLEEP_END) ?: return false
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

  private fun recordPrayed(prayerName: String) {
    // The "prayed" map lives INSIDE the "config" blob (the bridge's
    // confirmPrayer edits the same blob). Writing it as a separate
    // SharedPreferences key — as this used to do — meant the service
    // and the bridge each kept their own copy and neither saw the
    // other's unlock.
    val p = prefs()
    val cfg = readConfig() ?: JSONObject()
    val today = dateKey(Calendar.getInstance())
    val map = configPrayed(cfg).toMutableMap()
    map[prayerName] = today
    cfg.put(KEY_PRAYED, JSONObject(map as Map<*, *>))
    p.edit().putString("config", cfg.toString()).apply()
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
      // Sleep has no button, so the overlay never takes input focus:
      // without this, showing it steals focus from the blocked app
      // and the focus change fires another window event — more
      // churn for the flicker loop above. The overlay still eats
      // every touch (it is a full-screen view), so the app behind
      // stays unusable. Prayer keeps focus so its "prayed" button
      // can be tapped.
      if (mode == "sleep") {
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
      } else {
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
      },
      android.graphics.PixelFormat.TRANSLUCENT
    )
    try {
      wm.addView(root, params)
      overlayView = root
      overlayMode = mode
      overlayPrayerName = prayerName
      overlayShownAt = android.os.SystemClock.uptimeMillis()
    } catch (_: Exception) {
      // Overlay permission missing or WindowManager rejected it; skip.
      overlayView = null
      overlayMode = null
      overlayPrayerName = null
      overlayShownAt = 0L
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
    overlayShownAt = 0L
  }
}
