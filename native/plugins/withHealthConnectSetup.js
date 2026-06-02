const { withMainActivity, createRunOncePlugin } = require('@expo/config-plugins');

// Patches MainActivity.kt to call HealthConnectPermissionDelegate.setPermissionDelegate(this)
// in onCreate. This is required by react-native-health-connect v3 — without it, requestPermission()
// crashes with UninitializedPropertyAccessException. The expo-health-connect config plugin only
// handles AndroidManifest.xml and does NOT add this call. Source: github.com/matinzd/react-native-health-connect/issues/214
const withHealthConnectMainActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let { contents } = mod.modResults;

    if (contents.includes('setPermissionDelegate')) {
      return mod; // Already applied
    }

    // Add import after ReactActivity import
    if (!contents.includes('HealthConnectPermissionDelegate')) {
      contents = contents.replace(
        'import com.facebook.react.ReactActivity',
        'import com.facebook.react.ReactActivity\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate'
      );
    }

    // If onCreate already exists, inject after any super.onCreate(...) call
    const superOnCreateMatch = contents.match(/super\.onCreate\([^)]*\)/);
    if (superOnCreateMatch) {
      contents = contents.replace(
        superOnCreateMatch[0],
        superOnCreateMatch[0] + '\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)'
      );
    } else {
      // No onCreate yet — add it before getMainComponentName
      contents = contents.replace(
        '  override fun getMainComponentName',
        `  override fun onCreate(savedInstanceState: android.os.Bundle?) {\n    super.onCreate(null)\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n  }\n\n  override fun getMainComponentName`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = createRunOncePlugin(
  withHealthConnectMainActivity,
  'withHealthConnectMainActivity',
  '1.0.0'
);
