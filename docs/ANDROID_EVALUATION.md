# AHDORA — Android Evaluation

> Evaluation ONLY. No Android app was built in Phase 6. This document
> compares the options for this codebase and recommends one.

## 1. The codebase today

- Web app: React 19 + TypeScript + Vite, served as static files.
- API: Node.js + Express + MongoDB, with Socket.IO realtime.
- The web app already works on mobile browsers (responsive layout,
  mobile nav). Anything "Android" is about packaging it as an
  installable app and reaching native features.

## 2. Options compared

### Option A — Capacitor (recommended)

Wrap the existing web build in a native shell with Capacitor
(`@capacitor/core`, `@capacitor/cli`, plus an Android project).
The React code is reused ~100% — the same `dist/` output runs inside
a WebView, and the API stays unchanged.

- Pros: fastest path (days, not months); one codebase for web +
  Android; official plugins for the features AHDORA needs
  (see §3); Play Store distribution; push notifications via
  Firebase Cloud Messaging when a scheduler exists.
- Cons: the app is still a WebView — it cannot do things a native
  app can (see §4); WebView performance is fine for this app's
  screens but not for heavy animation; Play Store review still
  applies.
- Effort: small — add Capacitor, configure `capacitor.config.ts`
  (`server.url` for dev, bundled `dist/` for production), generate
  the Android project, set the app id / icons / splash, test on a
  real device.

### Option B — Native Android (Kotlin + Jetpack Compose)

Rewrite the frontend natively against the same API.

- Pros: best performance, full access to every Android API, best
  Play Store standing.
- Cons: a second codebase to maintain (the web app still exists);
  weeks of work to re-implement 8 screens + Socket.IO client +
  offline behaviour; every future feature must be built twice.
- Effort: large. Not justified while the web app is still changing
  fast.

### Option C — PWA (Progressive Web App)

Add a manifest + service worker; users "install" from the browser.

- Pros: zero native code; works today with a manifest and a few
  lines; updates are instant (no store review).
- Cons: no Play Store listing; iOS/Android PWA support for
  notifications and background work is limited and inconsistent;
  cannot use native plugins (secure storage, local notifications
  are partial at best).
- Effort: tiny — but it does not deliver the native features the
  vision asks for (app blocking, reliable reminders).

## 3. Recommendation: Capacitor

For THIS codebase, Capacitor is the right call: the web app is the
product, the API already exists, and the native needs are narrow.
Build the Capacitor shell after the web app is stable (post-PR),
keeping the web build as the single source of truth.

Plugins needed (all official Capacitor plugins unless noted):

| Need | Plugin |
| --- | --- |
| Local notifications (prayer/study reminders while the app is installed) | `@capacitor/local-notifications` |
| Geolocation (mosque finder without the browser prompt) | `@capacitor/geolocation` |
| Secure storage (tokens — replaces cookie storage if needed) | `@capacitor/preferences` (non-sensitive) / `@capacitor/secure-storage` or Keystore via a community plugin for secrets |
| Push notifications (later, when a scheduler exists) | `@capacitor/push-notifications` + Firebase |
| Share / open maps | `@capacitor/share`, plain `https://maps.google.com` links (already used) |

## 4. Honest limits — read this before promising anything

- **The web cannot block other Android apps, and neither can a
  Capacitor WebView.** Real app-blocking needs native Android APIs:
  `UsageStatsManager` (to detect foreground apps) plus an
  accessibility service or device-admin / Digital Wellbeing-style
  flow to actually interrupt another app. That is a native
  (Kotlin) module — it can be added to a Capacitor app as a custom
  plugin, but it is a separate, sensitive piece of work and needs
  careful Play Store policy review.
- **Calls + emergency access are always preserved.** Any blocking
  design must exempt the phone app, emergency numbers and emergency
  calls — no exceptions, no "focus mode" that can block them.
- **No uninstall lock / no forced lock-in.** The user must always
  be able to uninstall the app or turn blocking off. A "focus"
  feature that traps the user is not acceptable and would likely be
  rejected by Play Store policy.
- **Focus/sleep controls are transparent and user-controlled:**
  the user picks which apps, which hours, and can stop it at any
  time. Nothing runs hidden.
- **Background work is limited on Android.** Doze mode and battery
  optimisation delay alarms and network. Prayer reminders need
  exact alarms (`SCHEDULE_EXACT_ALARM` permission) and the user
  must exempt the app from battery optimisation — this has to be
  explained in the UI, not silently assumed.

## 5. Play Store steps (when the time comes)

1. Create a Google Play developer account ($25 one-time).
2. Capacitor: set the app id (e.g. `com.ahdora.app`), name, icons,
   splash screen; build a signed release bundle (`.aab`) with
   `keytool`/`jarsigner` (or Android Studio).
3. Complete the Play Console listing: description, screenshots,
   privacy policy URL (required — the app collects accounts and
   location), data-safety form (account data, location, app
   activity — answer from the real data flows, not guesses).
4. Complete the content questionnaires (religious content is fine;
   the app-blocking feature needs the accessibility / usage-stats
   declarations and a clear in-app explanation).
5. Internal testing track first (a few real devices), then closed,
   then production. Expect review feedback on permissions — answer
   with the in-app explanations, not with new promises.

## 6. What is NOT built in this phase

No Capacitor project, no native code, no Play Store listing, no
push-notification service, no app-blocking implementation. This
document is the evaluation the vision asked for; the build is a
separate decision for after the web app ships.
