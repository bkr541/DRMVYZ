# NIGHTSHIFT playback and lighting corrections

October 23, 2026. This follow-up supersedes the brightness, camera and ceiling
behavior in the original final acceptance captures. Preset ID and revision 2
remain stable so saved edits continue to load.

- The shared beat clock corrects toward fresh grid positions only. Repeated
  grid samples no longer pull the animation toward a stationary target, and
  phase correction cannot cancel forward tempo motion on slower tracks.
- NIGHTSHIFT keeps its animation and pattern transitions running during playback
  even if analysis temporarily becomes inactive. Pause and explicit stop hold
  motion. Missing audio or refreshed analysis/timeline revisions do not reset
  the animation; actual source changes, seeks and discontinuities still do.
- Floor output is multiplied by 3 in linear light, retaining the existing
  master/floor/coverage controls and their zero states. Displayed pixel values
  need not triple because display conversion and highlights limit that ratio.
- Camera drift position, target, field-of-view and speed increase by 50%, with
  matching safety bounds. New/default settings use Camera Motion 0.5; saved
  settings retain their values, and zero restores the reference shot.
- All three ceiling rails now have independently addressed light segments.
  They display the selected spatial program and its crossfade, with shared
  kick/drop travel, snare, energy, build and Director impact responses. The
  Ceiling Cyan palette and ceiling/master intensity controls remain active.
  The shipped model and physical rail placement are retained.

The focused regression covers 60 seconds with held beat-grid data, analysis
gaps, revision refreshes, pause/resume, eight ceiling patterns, audio response
and zero intensity controls. Run the rendered regression with:

```sh
node scripts/cinema2-assets/accept-nightshift-reactivity-fix.mjs
```

Captures and numerical results are written under
`artifacts/cinema2-nightshift-reactivity-fix/`. Historical phase acceptance scripts
retain their old reference-image and camera-default expectations; use this
regression for the corrected behavior.

Validation: 89 focused NIGHTSHIFT, beat-clock and camera tests passed, along with
TypeScript, scoped ESLint and diff whitespace checks. Eight rendered browser
checks passed, including sustained floor/ceiling movement, pause, a ceiling audio
accent, increased floor brightness and default camera travel. No browser,
shader or render-graph failures were recorded. The run used deterministic audio
publications through the real renderer; live desktop playback was not tested.
No commit was requested or created. Unrelated existing edits were left intact.

## Dense club fog follow-up

The Club Haze / Fog slider now raises both physical mist density and output
opacity. The old configuration had mist amount 0.02, ambient haze 0.02 and only
0.7 units of height, so blending it in barely changed the scene. The revised
effect uses a 1.5-unit ground-fog layer above the dance floor, stronger low
ambient scattering, and the shipped 3D smoke texture with warped, drifting
billows. Density varies from 0 to 1 with the slider; its existing 0.35 default
is retained. Zero bypasses the fog, and Master Intensity zero suppresses it.
The room's upper portion stays less foggy than the area above the floor.

Eight focused finishing/preset tests and ten browser checks passed. Captures
verify progressively denser fog at 0.35, 0.7 and 1, visible drift, pause, zero
and master gates, with no shader or render failures. Run
`node scripts/cinema2-assets/accept-nightshift-fog.mjs`; results and captures are
saved to `artifacts/cinema2-nightshift-fog/`. The earlier restrained-haze phase
captures are historical. Live desktop playback has not been independently
tested. This follow-up remains uncommitted.

## Freestanding neon signs

Design contains a **Signs** group. **Enable Signs** defaults off. Enabling it
reveals four editable inputs: **Back Sign Text**, **Left Sign Text**, **Front
Sign Text**, and **Right Sign Text**, followed by **Sign Size**. Back defaults to
`NIGHTSHIFT`; the other sides default empty. Messages and the enabled/size/color
settings survive preset re-entry. See [room pan and editable signs](NIGHTSHIFT-room-pan-and-signs.md)
for the current four-sided behavior and validation. The original fixed-text
acceptance notes below are historical.

The sign is freestanding 3D glass outline text behind the dance floor. The
previous brick wall, wall textures, mounting standoffs and wall-wash lights have
been removed. Its outline-tube construction follows Backstreet. The tubes
sample the active NIGHTSHIFT spatial program by physical contour positions,
including pattern crossfades, and consume the existing resolved Audio
Intelligence/Director kick, snare, drop, build and impact channels. Master zero
hides the sign; no new detector or musical clock is introduced.

The fixed outline package uses the existing vendored Anton font (OFL-1.1).
Regenerate it with `node scripts/cinema2-assets/generate-nightshift-sign.mjs`.
Run `node scripts/cinema2-assets/accept-nightshift-signs.mjs` for the focused
native browser check; captures and telemetry are saved under
`artifacts/cinema2-nightshift-signs/`. Earlier sign captures with brick are
superseded by this freestanding design.

Validation: eleven focused preset/sign/choreography tests and fourteen native
browser checks passed, including actual slider operation, rendered small/large
lettering, absence of a backdrop, audio/palette response and saved sizing.
No browser, shader or render failures were recorded. Live desktop playback has
not been independently tested. Changes remain uncommitted.

## Default floor choreography visibility

The default Nightshift program now runs a four-beat travelling intensity wave
with dim intervals that remain visible at the brighter floor output. Previously
its fixed palette varied only between 88% and 100% brightness over a slow cycle;
the brightest tiles clipped to essentially constant display colors, obscuring
both the motion and additive audio accents after the opening activity.

Live-app diagnostics confirmed the animation clock continued advancing while
a stale development session supplied silent analyser buffers. Restarting React
effects recreated the audio element but retained a MediaElementAudioSourceNode
bound to the retired element. The replacement element could play outside the
analyser graph. AudioEngine cleanup now disconnects and retires that source and
clears its media-load identity, so the replacement element is connected to the
existing analysis graph on playback. A StrictMode effect-restart regression
failed before the fix and passes afterwards. Temporary logging was removed.

The sustained browser regression now uses the actual default `nightshift`
program rather than `runway`, requires a substantial floor-pixel change after
60 seconds, and separately checks a fresh shared kick with procedural motion
held. This closes the earlier validation gap. Palette, 3x floor output, intensity
zero, pause and manual pattern selection remain authoritative.

Validation: 42 focused Nightshift and AudioEngine tests pass, along with
TypeScript, scoped lint and diff whitespace checks. The rendered default floor
still changes substantially after a simulated 60 seconds (mean pixel difference
11.61/255); a fresh shared kick changes the held default floor by 2.39/255.
Browser/shader/render checks pass. The running Dev app was also checked with
the saved Trace of You track after a clean reload, with developer tools closed.
These corrections remain uncommitted.
