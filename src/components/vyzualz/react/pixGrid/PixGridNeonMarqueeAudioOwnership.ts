/**
 * Direct preset routes shipped before the Marquee Performance Program became
 * the sole owner of audio-reactive programming. These IDs are retained only so
 * built-in preset migration can remove the obsolete duplicate routes from
 * older saved states without touching user-authored assignments.
 */
export const PIX_GRID_NEON_MARQUEE_LEGACY_DIRECT_ASSIGNMENT_IDS: ReadonlySet<string> = new Set([
  'neon-marquee-bass-perimeter',
  'neon-marquee-sub-focal',
  'neon-marquee-mid-letters',
  'neon-marquee-vocal-focal',
  'neon-marquee-vocal-letters',
  'neon-marquee-high-equalizer',
  'neon-marquee-high-equalizer-brightness',
  'neon-marquee-build-recruitment',
  'neon-marquee-kick-perimeter',
  'neon-marquee-kick-focal',
  'neon-marquee-snare-letters',
  'neon-marquee-snare-trim',
  'neon-marquee-hat-sparkle',
  'neon-marquee-hat-equalizer',
  'neon-marquee-downbeat-perimeter',
  'neon-marquee-downbeat-convergence',
  'neon-marquee-drop-power-on',
] as const)
