# Signal — Session Instructions

## Build Command (Android APK)
Always use this exact command to build. Never suggest a different build command.

```bash
cd ~/Signal/native && git pull && export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" && export ANDROID_HOME="$HOME/Library/Android/sdk" && eas build --platform android --profile preview --non-interactive --local
```

Builds run locally on the user's Mac and output an `.apk` file to `~/Signal/native/`.

## Security
- Never hardcode Anthropic API keys in source files. API key is stored in AsyncStorage only via `getAnthropicKey` / `setAnthropicKey` / `removeAnthropicKey` in `native/src/services/storage.ts`.

## Git
- Branch: `main`
- Always `git pull` before building
- Push all changes before telling the user to build
