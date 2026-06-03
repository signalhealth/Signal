const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

// Adds the two AndroidManifest.xml entries required for Health Connect to
// recognise Signal and show it in App Permissions:
//
// 1. <queries> block so the app can see the HC package
// 2. <activity> with ACTION_SHOW_PERMISSIONS_RATIONALE intent-filter
//    (without this, HC never lists the app in its permissions manager)
const withHealthConnectManifest = (config) => {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;

    // ── 1. <queries> block ──────────────────────────────────────────
    if (!manifest.manifest.queries) {
      manifest.manifest.queries = [];
    }
    const hasHCQuery = manifest.manifest.queries.some(
      (q) => q.package && q.package.some((p) => p.$['android:name'] === 'com.google.android.apps.healthdata')
    );
    if (!hasHCQuery) {
      manifest.manifest.queries.push({
        package: [{ $: { 'android:name': 'com.google.android.apps.healthdata' } }],
      });
    }

    // ── 2. HealthConnect permissions rationale activity ─────────────
    const application = manifest.manifest.application[0];
    if (!application.activity) application.activity = [];

    const activityName = 'dev.matinzd.healthconnect.permissions.HealthConnectPermissionActivity';
    const alreadyAdded = application.activity.some(
      (a) => a.$['android:name'] === activityName
    );
    if (!alreadyAdded) {
      application.activity.push({
        $: {
          'android:name': activityName,
          'android:exported': 'true',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } }],
          },
        ],
      });
    }

    return mod;
  });
};

module.exports = createRunOncePlugin(
  withHealthConnectManifest,
  'withHealthConnectManifest',
  '1.0.0'
);
