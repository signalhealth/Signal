const { withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

// Adds the AndroidManifest.xml entries required for Health Connect to
// recognise Signal and show it in App Permissions on all Android versions:
//
// 1. <queries> block so the app can see the HC package
// 2. <activity> with ACTION_SHOW_PERMISSIONS_RATIONALE — required on Android 13 and lower
// 3. <activity-alias> with VIEW_PERMISSION_USAGE + HEALTH_PERMISSIONS — required on Android 14+
//    (without #3, HC never lists the app in App Permissions on Android 14+)
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

    const application = manifest.manifest.application[0];

    // ── 2. Rationale activity (Android ≤ 13) ───────────────────────
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

    // ── 3. VIEW_PERMISSION_USAGE alias (Android 14+) ────────────────
    // Without this, Health Connect never shows the app in App Permissions
    // on Android 14+ (where HC is a platform module, not a separate APK).
    if (!application['activity-alias']) application['activity-alias'] = [];

    const aliasName = 'ViewPermissionUsageActivity';
    const aliasAlreadyAdded = application['activity-alias'].some(
      (a) => a.$['android:name'] === aliasName
    );
    if (!aliasAlreadyAdded) {
      application['activity-alias'].push({
        $: {
          'android:name': aliasName,
          'android:exported': 'true',
          'android:targetActivity': activityName,
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
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
