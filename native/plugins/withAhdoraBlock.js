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

function withAhdoraBlockManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    ensureUsesPermission(manifest, 'android.permission.PACKAGE_USAGE_STATS');
    ensureUsesPermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');

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
