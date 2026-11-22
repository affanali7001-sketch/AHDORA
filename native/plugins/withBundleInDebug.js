/**
 * Expo config plugin: bundle the JS into the DEBUG APK.
 *
 * By default React Native treats `debug` as a debuggable variant and SKIPS
 * bundling the JS bundle + assets into the APK (it expects Metro to serve
 * the JS). That makes a standalone debug APK show "Unable to load script"
 * on a phone with no Metro running.
 *
 * Setting `debuggableVariants = []` in the `react { }` block of
 * android/app/build.gradle forces the bundle task to run for debug too,
 * so the APK works standalone.
 */
const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

function withBundleInDebug(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    // NOTE: the template already mentions "debuggableVariants" in comments,
    // so check for the actual active assignment, not just the word.
    if (!contents.includes('debuggableVariants = []')) {
      contents = contents.replace(
        'bundleCommand = "export:embed"',
        'bundleCommand = "export:embed"\n    debuggableVariants = []'
      );
    }
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withBundleInDebug, 'with-bundle-in-debug', '1.0.0');
