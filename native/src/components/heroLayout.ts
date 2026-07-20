// Shared minimum height for the colored hero band at the top of each tab,
// sized to fit Recovery's (the tallest, since it has the extra breakdown row)
// so switching tabs doesn't cause the header to jump.
export const HERO_MIN_HEIGHT = 300;

// Shared top offset for the gauge inside the hero band. Content is
// top-aligned (not centered) so the ring sits at the same Y position on
// every tab, regardless of how much text trails it below the gauge.
export const HERO_CONTENT_TOP = 20;

// Shared outer diameter for every hero gauge (Recovery ring, macro rings,
// lab-status rings) so they read as one consistent size across tabs.
export const GAUGE_SIZE = 200;
