const { withMainActivity } = require('@expo/config-plugins');

// Patches MainActivity.kt to register the HealthConnect ActivityResultLauncher.
// react-native-health-connect's requestPermission() crashes with
// UninitializedPropertyAccessException if this isn't done.
module.exports = function withHealthConnectSetup(config) {
  return withMainActivity(config, (mod) => {
    const { modResults } = mod;
    if (
      modResults.language !== 'kt' ||
      modResults.contents.includes('HealthConnectPermissionDelegate')
    ) {
      return mod;
    }

    let { contents } = modResults;

    // Add import after the last existing import line
    const importLines = contents.match(/^import .+$/gm) || [];
    if (importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      contents = contents.replace(
        lastImport,
        `${lastImport}\nimport dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate`
      );
    }

    // Add delegate field inside the class
    contents = contents.replace(
      'class MainActivity : ReactActivity() {',
      'class MainActivity : ReactActivity() {\n  private val healthConnectDelegate = HealthConnectPermissionDelegate()'
    );

    // Add onCreate before getMainComponentName
    contents = contents.replace(
      '  override fun getMainComponentName',
      `  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    super.onCreate(savedInstanceState)
    healthConnectDelegate.registerForActivityResult(this)
  }

  override fun getMainComponentName`
    );

    modResults.contents = contents;
    return mod;
  });
};
