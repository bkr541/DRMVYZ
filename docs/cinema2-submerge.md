# SUBMERGE

SUBMERGE renders configurable beveled 3D lettering floating in dark water above
an uneven ocean floor. The previous columns, arches and floor inlays have been
removed entirely, including for previously saved settings. An overhead displaced
water mesh forms rolling, curling crests with broken foam highlights. Three
selective downward spotlights and translucent light shafts illuminate parts of
the letters and seabed, leaving the surrounding water dark. Environment
reflections and fill light are deliberately restrained.

- **Master Controls** retains Motion Amount, BPM Sync, Auto Performance and Motion
  Safety. The existing shared beat clock owns timing; pause freezes the water,
  particles, lights and lettering. Zero Motion Amount and Lock Off hold the water
  and assemble the letters.
- **Design** retains editable one/two-line text, alignment, tracking, line spacing,
  scale, letter depth and rusted-metal/clean-metal/frosted-glass finishes. Breaking Waves
  controls crest height/curl; Surface Light controls the actual spotlights and
  visible shafts. Seabed controls the ocean floor. Its persisted ID remains
  `submerge-architecture` for compatibility, but it cannot restore any arches.
  Caustic Light, Depth Haze, Suspended Particles and Bubble Trails remain active.
- **Design > Pattern** contains Pattern, Pattern Change and the canonical Trigger
  options. Pressure Wave is the default. Suspension gives the letters a gentle
  drift. Undertow draws light back across the seabed. Crosscurrent sweeps the
  two sides in opposite directions, Vortex rotates the light and sediment, and
  Upwelling carries light and bubbles toward the surface. Pattern Change defaults
  OFF and uses the existing musical event controller without overwriting authored
  parameters.
- **Palette** offers independent Water Tint, Letter Tint, Edge Glow, Surface Light
  Tint and Wave Foam Tint. Water Tint is attenuated for the deep-water background.
- Source/Pool use the existing Text Scenes library and migration 0045. New water
  and light parameters are included in saved SUBMERGE Text Scenes.

Auto Performance uses the shared music intelligence and beat clock. Quiet
passages narrow the lighting toward the text. A kick starts at the lettering,
then travels through the seabed lighting and reaches the surface foam. Builds
gather the letters, light and sediment toward the center while the camera moves
in. A drop opens the shafts, fans letters in depth, raises a surface crest and
leaves a bubble wake. The release settles over four beats. Pressure Wave has the
strongest kick response. Bass adds swell, mids drive seabed caustics and highs
accent bubbles and particles.

The waves are stylized displaced geometry with procedural crest foam, not a fluid
simulation or physically simulated breaking-water collision. Light shafts use
bounded translucent geometry paired with real spotlights, not volumetric ray
marching. Wave geometry, beam materials and shadow resources are owned by the
bridge and disposed on teardown/context restoration. Low/medium tiers disable
shadow rendering through the existing shared quality profile and reduce particles.

`node scripts/verify-cinema2-submerge.mjs` runs the real native WebGL renderer,
text edits, all six patterns, water/light/environment controls, materials, musical
response, pause/resume, aspect ratios and context recovery. It captures the quiet,
kick, build and drop poses and writes the results to `artifacts/cinema2-submerge/`.

The default Rusted Metal finish uses object-space procedural oxide patches,
mineral streaks, variable roughness/metalness and derivative-based pitting.
Corrosion stays attached as letters float; there are no external texture fetches.
The legacy `ceramic` material ID is retained so existing saved scenes receive
the weathered finish. Clean Metal and Frosted Glass remain selectable.
