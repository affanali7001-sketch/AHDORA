/**
 * Expo config plugin: REAL uninstall protection via Device Admin.
 *
 * What this does — and what it honestly cannot do:
 *  On stock Android a regular app CANNOT truly prevent its own
 *  uninstall. Device Admin is as far as the platform allows: while
 *  AhdoraDeviceAdminReceiver is an ACTIVE device admin, Android
 *  refuses to uninstall the app. Uninstalling first needs the admin
 *  switched off in Settings (or on the system activation screen) —
 *  the user can always do that and then uninstall. Device-owner /
 *  profile-owner modes could truly block uninstall, but they need
 *  provisioning and are not available to a normally installed app.
 *
 * Injects into the prebuild-generated android/ project:
 *  1. The DeviceAdminReceiver declaration (BIND_DEVICE_ADMIN,
 *     DEVICE_ADMIN_ENABLED, meta-data → @xml/ahdora_device_admin).
 *  2. The receiver source + device-admin XML, copied from
 *     plugins/ahdora-admin/:
 *     - android/app/src/main/java/com/ahdora/app/admin/AhdoraDeviceAdminReceiver.kt
 *     - android/app/src/main/res/xml/ahdora_device_admin.xml
 *  3. The admin description string (shown on the system activation
 *     screen).
 *
 * The receiver requests NO policies (empty <uses-policies />) — it
 * controls nothing, it only makes uninstall need the extra step.
 *
 * The JS bridge is an Expo inline module (app/AhdoraAdmin.kt):
 * it checks whether the admin is active and opens the system
 * activation screen. Activation can NEVER be silent — Android
 * always shows its own screen and the user must tap Activate.
 * Turning protection OFF also goes through that system screen
 * (Deactivate there), on purpose: a one-tap off inside the app
 * would make the protection meaningless.
 *
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

const RECEIVER_NAME = '.admin.AhdoraDeviceAdminReceiver';
const RECEIVER_PERMISSION = 'android.permission.BIND_DEVICE_ADMIN';
const ADMIN_META_RES = '@xml/ahdora_device_admin';

function withAhdoraAdminManifest(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application && manifest.application[0];
    if (!app) return config;
    const receivers = app.receiver || [];
    const already = receivers.some(
      (r) => r && r.$ && r.$['android:name'] === RECEIVER_NAME
    );
    if (!already) {
      receivers.push({
        $: {
          'android:name': RECEIVER_NAME,
          'android:permission': RECEIVER_PERMISSION,
          'android:exported': 'false',
          'android:description': '@string/ahdora_device_admin_description',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.app.device_admin',
              'android:resource': ADMIN_META_RES,
            },
          },
        ],
      });
    }
    app.receiver = receivers;
    return config;
  });
}

function withAhdoraAdminFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;
      const srcDir = path.join(projectRoot, 'plugins', 'ahdora-admin');

      const javaDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'ahdora',
        'app',
        'admin'
      );
      const xmlDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });

      fs.copyFileSync(
        path.join(srcDir, 'AhdoraDeviceAdminReceiver.kt'),
        path.join(javaDir, 'AhdoraDeviceAdminReceiver.kt')
      );
      fs.copyFileSync(
        path.join(srcDir, 'ahdora_device_admin.xml'),
        path.join(xmlDir, 'ahdora_device_admin.xml')
      );
      return config;
    },
  ]);
}

function withAhdoraAdminStrings(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string || [];
    const name = 'ahdora_device_admin_description';
    const already = strings.some((s) => s && s.$ && s.$.name === name);
    if (!already) {
      strings.push({
        $: { name },
        _: 'AHDORA uninstall protection — while this admin is active, AHDORA cannot be uninstalled. Switch it off first to uninstall.',
      });
    }
    config.modResults.resources.string = strings;
    return config;
  });
}

function withAhdoraAdmin(config) {
  config = withAhdoraAdminManifest(config);
  config = withAhdoraAdminFiles(config);
  config = withAhdoraAdminStrings(config);
  return config;
}

module.exports = createRunOncePlugin(withAhdoraAdmin, 'with-ahdora-admin', '1.0.0');
