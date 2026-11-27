# NIGHTSHIFT dance-floor brightness

## Cathedral reference

Cathedral builds instanced arches, columns, luminous ribs, accent strips, sparks
and floor rails. Its custom shader separates dark structural surfaces from
directly emissive light geometry. Rib/strip emission is
`(0.08 + programLight * 2.7 + drop * 0.75) * intensity`, with a small edge falloff;
sparks can reach `5.5 * energy * intensity`.

The five light programs vary spatial pulses, alternating ribs, build reveals
and drop ruptures. Density and vocal restraint reduce program lighting;
kick, beat, downbeat, phrase and continuous energy add light. Intensity scales
the luminous geometry independently of structural shading. The dark room and
low ambient light preserve contrast. Reflective-floor pools/specular, atmospheric
shafts, HDR bloom and the final tone/contrast grade reinforce that emission.
Cathedral has a reflective aisle rather than NIGHTSHIFT's addressed dance tiles.

## NIGHTSHIFT diagnosis and change

NIGHTSHIFT batches 100 textured glass inserts above separate dark floor frames.
Linear palette colors are multiplied by each tile's program/audio gain, then
used for both diffuse color and emission. Tile levels in the default program
are 0.1, 1/2.2 and 1; travelling waves, coverage, music level and build/vocal
restraint can attenuate them further. The glass emissive texture also reduces
output. Spotlights and the environment primarily shape the room and mirror
ball; they do not determine the self-lit floor's emission.

The floor material retains emissive intensity 2.2. Its runtime output gain is
now **9 rather than 3**, tripling floor radiance at every existing nonzero
Floor Intensity setting. The zone multiplier is `9 * floor / 0.8` and the master
multiplier is `master / 0.85`; the default floor gain is 9 and its slider maximum
is 11.25. This also applies to saved settings without changing parameter IDs,
defaults or persistence. Display brightness does not triple because highlights
can saturate during display conversion.

All eight spatial programs, their dark intervals, audio accents and crossfades
remain intact. Floor/master zero and coverage zero still extinguish the tiles.
The ceiling, ball, room lights, geometry and shared finishing settings are
unchanged. Existing bloom receives the stronger floor source; raising global
exposure or haze is unnecessary.

## Focused validation

Run the Nightshift reactivity, preset and finishing Vitest files, scoped ESLint,
and `node scripts/cinema2-assets/accept-nightshift-reactivity-fix.mjs`.
The browser regression compares the new default with Floor Intensity `0.8/3`,
which reproduces the previous 3x output, and checks sustained choreography,
audio accents, pause and render health. Captures and measured brightness ratio
are written to `artifacts/cinema2-nightshift-reactivity-fix/`.

Display-level thresholds account for saturation: at least 20% more mean floor
luminance for the default travelling program and 15% for highlight-heavy Full
House. These measure the rendered result, separately from the 3x radiance gain.

Validation passed: 12 focused unit tests, scoped ESLint, diff whitespace checks
and 10 browser checks. With camera/motion held and finishing bypassed, mean
floor luminance increased 26.1% for Nightshift and 18.1% for Full House. The
60-second choreography and fresh kick checks remain visibly active, with no
browser, shader or render failures. Live desktop playback was not tested.
Changes are uncommitted; no commit was requested.
