# Threshold camera and LED correction

Threshold combined a 1.8-unit beat weave with handheld drift, beat bobbing,
rolling, FOV breathing, kick zoom and a downbeat roll envelope. These independent
motions made the otherwise smooth spline flight appear erratic.

The camera now uses a 0.25-unit lateral wave, subtle 0.08-unit drift and 180 ms
pose smoothing. Beat bobbing, beat roll, FOV breathing, kick zoom and downbeat
camera lean are removed. The lens holds at 68 degrees; banking is limited to
0.2 degrees. The hanging-field path's lateral excursion is reduced from ±1 to
±0.25 units. The gradual elevation changes, continuous forward spline, tempo
scaling and three-scene loop are retained. Camera Motion scales the gentle wave;
zero removes incidental motion while forward travel continues.

The main LED resting emission now uses Cathedral's full-program level,
`0.08 + 2.7 = 2.78`, versus the previous default 1.205. Support emission increases
from 0.6 to 2.36. These are approximately 2.3x and 3.9x increases respectively,
before fog, per-panel proximity attenuation and display conversion. Panel
Brightness scales the emission and musical accents together, with a true zero
for the screens; its existing 0.7 default is retained. Existing kick, snare,
beat, sweep, build, drop, vocal and shimmer lighting responses remain active.

All four intermediate color targets now use RGBA16F to retain emission above
white. The old basic bloom is replaced with Cathedral's HDR bloom and identical
settings: threshold 1.7, knee 0.42, intensity 0.38, spread 0.32, four levels and
clamp 14. The final grade adopts Cathedral's tone mapping, exposure 0.96,
contrast 1.22 and saturation 0.86. Threshold retains its wet floor, mist,
volumetric shafts, palette and geometry. Float targets increase color-buffer
memory compared with the previous RGBA8 targets, as in Cathedral's HDR path.
Parameter IDs and saved edits remain compatible; saved Bloom values retain
user authority, while new/reset Bloom uses 0.38.

## Validation

40 focused tests pass across Threshold, its continuous camera regression and
HDR bloom. The camera test samples 196 seconds at 60 Hz with repeated kicks and
downbeats, checking forward progression, small frame-to-frame lateral changes,
bounded roll and a constant lens through every scene and two loop boundaries.
Production tests verify the brighter LED levels, brightness zero/max controls,
HDR targets and resource disposal. TypeScript, scoped ESLint and diff whitespace
checks pass.

Run `node scripts/cinema2-assets/accept-threshold-lighting-motion.mjs` for the
native rendered check. Captures and measurements are saved under
`artifacts/cinema2-threshold-loop/`. It verifies visible HDR bloom, greater
brightness at the default than a lower output setting, gentle advancing camera
positions and render health. The default LED capture was visually reviewed;
no browser, shader or render failures occurred. The brightness comparison
isolates slider output within the new HDR pipeline, rather than claiming a
pixel-exact comparison with the old preset. Live desktop playback was not tested.
Changes remain uncommitted; no commit was requested.
