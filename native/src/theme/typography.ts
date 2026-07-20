// Centralized font tokens. Change the brand font here once — every screen
// that imports FONT_DISPLAY picks it up, instead of hunting through every
// StyleSheet in the app.
//
// FONT_DISPLAY is for labels, headings, buttons, and badges (anything
// currently styled fontWeight: "700"). Only the Bold weight is bundled
// (see App.tsx useFonts) — do not pair fontFamily with fontWeight on the
// same style, Android silently drops the custom font and falls back to
// the system font when both are set.
//
// Body copy and every numeric value (scores, stats, chart values) are left
// on the system default (Roboto on Android, San Francisco on iOS) on
// purpose — no token needed, just omit fontFamily.
export const FONT_DISPLAY = "SpaceGrotesk_700Bold";
