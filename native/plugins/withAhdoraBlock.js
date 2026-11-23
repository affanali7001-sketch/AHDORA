/**
 * Expo config plugin: REAL app blocking (AHDORA App Block).
 *
 * Injects into the prebuild-generated android/ project:
 *  1. Permissions in AndroidManifest.xml:
 *     - PACKAGE_USAGE_STATS  (Usage Access — lets the app list/check usage)
 *     - SYSTEM_ALERT_WINDOW  ("Display over other apps" — the block overlay)
 *  2. The Accessibility Service declaration (BIND_ACCESSIBILITY_SERVICE)
 *     pointing at the service config XML.
 *  3. The service source + config XML, copied from plugins/ahdora-block/:
 *     - android/app/src/main/java/com/ahdora/app/block/AhdoraBlockService.kt
 *     - android/app/src/main/res/xml/ahdora_block_service_config.xml
 *  4. The service description string (shown in Accessibility settings).
 *  5. A <queries> entry for the MAIN / LAUNCHER intent (2026-11-23):
 *     on Android 11+ an app only sees other packages it declares
 *     in <queries> (or holds QUERY_ALL_PACKAGES for, which Play
 *     restricts). The manifest already had a <queries> block, but
 *     only for the https/BROWSABLE intent — so queryIntentActivities
 *     for the launcher returned just the preinstalled apps and the
 *     browsers, and user-installed apps like Instagram and X never
 *     appeared in the picker at all. The launcher intent query is
 *     the Google-blessed way to see every launchable app without
 *     the broad permission.
 *
 * The JS bridge is an Expo inline module (app/AhdoraBlockModule.kt),
 * auto-discovered via expo.experiments.inlineModules — it shares the
 * same SharedPreferences ("ahdora_block") with the service, so the
 * service enforces blocking even when the app is closed.
 *
 * The user must still grant three things on the phone (the AppBlock
 * screen opens the exact Settings pages):
 *  - Accessibility > AHDORA App Block  (turn the service ON)
 *  - Usage Access for AHDORA
 *  - "Display over other apps" for AHDORA
 * This does NOT work in Expo Go — it needs the real APK build.
 */
const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const SERVICE_NAME = '.block.AhdoraBlockService';
const SERVICE_PERMISSION = 'android.permission.BIND_ACCESSIBILITY_SERVICE';
const SERVICE_CONFIG_RES = '@xml/ahdora_block_service_config';

function ensureUsesPermission(manifest, name) {
  const perms = manifest['uses-permission'] || [];
  if (!perms.some((p) => p && p.$ && p.$['android:name'] === name)) {
    perms.push({ $: { 'android:name': name } });
  }
  manifest['uses-permission'] = perms;
}

/**
 * Android 11+ package visibility: without a <queries> entry for the
 * launcher intent, queryIntentActivities(ACTION_MAIN + LAUNCHER)
 * returns only the preinstalled apps (and whatever other <queries>
 * entries grant — here just the https browsers). User-installed
 * apps like Instagram and X are invisible, so they can never be
 * picked for blocking. This adds the MAIN / LAUNCHER intent to the
 * manifest's <queries> (creating it when absent, and never
 * duplicating it when prebuild runs again) — the narrow, Play-safe
 * alternative to QUERY_ALL_PACKAGES.
 */
function ensureLauncherQueries(manifest) {
  const queries = manifest.queries || [];
  const first = queries[0] || { intent: [] };
  if (!queries[0]) queries.push(first);
  const intents = first.intent || [];
  const already = intents.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const actions = entry.action || [];
    const categories = entry.category || [];
    return (
      actions.some((a) => a && a.$ && a.$['android:name'] === 'android.intent.action.MAIN') &&
      categories.some(
        (c) => c && c.$ && c.$['android:name'] === 'android.intent.category.LAUNCHER'
      )
    );
  });
  if (!already) {
    intents.push({
      action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
      category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
    });
  }
  first.intent = intents;
  manifest.queries = queries;
}

function withAhdoraBlockManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    ensureUsesPermission(manifest, 'android.permission.PACKAGE_USAGE_STATS');
    ensureUsesPermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');
    ensureLauncherQueries(manifest);

    const app = manifest.application && manifest.application[0];
    if (!app) return config;
    const services = app.service || [];
    const already = services.some(
      (s) => s && s.$ && s.$['android:name'] === SERVICE_NAME
    );
    if (!already) {
      services.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:permission': SERVICE_PERMISSION,
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.accessibilityservice.AccessibilityService',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.accessibilityservice',
              'android:resource': SERVICE_CONFIG_RES,
            },
          },
        ],
      });
    }
    app.service = services;
    return config;
  });
}

function withAhdoraBlockFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, 'plugins', 'ahdora-block');

      const javaDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'ahdora',
        'app',
        'block'
      );
      const xmlDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });

      fs.copyFileSync(
        path.join(srcDir, 'AhdoraBlockService.kt'),
        path.join(javaDir, 'AhdoraBlockService.kt')
      );
      fs.copyFileSync(
        path.join(srcDir, 'ahdora_block_service_config.xml'),
        path.join(xmlDir, 'ahdora_block_service_config.xml')
      );
      return config;
    },
  ]);
}

function withAhdoraBlockStrings(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string || [];
    const name = 'ahdora_block_service_description';
    const already = strings.some((s) => s && s.$ && s.$.name === name);
    if (!already) {
      strings.push({
        $: { name },
        _: 'AHDORA App Block — blocks apps at namaz and sleep time.',
      });
    }
    config.modResults.resources.string = strings;
    return config;
  });
}

function withAhdoraBlock(config) {
  config = withAhdoraBlockManifest(config);
  config = withAhdoraBlockFiles(config);
  config = withAhdoraBlockStrings(config);
  return config;
}

module.exports = createRunOncePlugin(withAhdoraBlock, 'with-ahdora-block', '1.0.0');
