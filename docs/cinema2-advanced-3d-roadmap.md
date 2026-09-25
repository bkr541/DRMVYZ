# Cinema 2.0 — Advanced 3D Visuals: Decisions, Findings, Build Order and Handoff

Handoff document, written so a new session (or a session that ran out of context) can resume with no other memory.
READ ORDER: 1) this file, top to bottom; 2) `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` and `AI_IMPLEMENTATION_CONTRACT.md` (repo root);
3) then start at "Where we are and what happens next".

Contents: Goal · Reference images · Principles · Working rules · What exists today (post-#4) · Roadmap table · Detailed plan for every step
(#1-#4 delivered, #5-#10 specified) · Threshold preset (delivered) and its refinement plan · Practical recipes and gotchas · Open decisions for the owner.

## Goal
Raise the visual ceiling of the Cinema 2.0 engine so it can ship far more cinematic, music-choreographed
base presets (stage halls, glossy skull, neon cave, alien figure, jungle). Users do NOT upload 3D models:
every 3D asset is authored offline and SHIPPED with the app, so there is no Media Manager / Supabase /
upload work for 3D. Electron-only. Performance target: 60 fps at 1080p on the owner's MacBook, with the
engine's existing auto-quality system scaling down on weaker machines.

## Reference images (art direction, NOT pixel-perfect targets)
Saved outside the repo at `~/Downloads/cinema2-3d-reference-images/` (re-attach if missing):
1. Alien biomechanical figure — glossy black PBR, orange emissive accents. Hard: it is a sculpted-asset problem.
2. Stage with LED panels, truss, haze, wet floor — most achievable: emissive panels + volumetric haze + reflective floor + bloom.
3. Cave with neon frames, wet rock — neon/fog easy; convincing rock needs real assets.
4. Skull with circuit/binary overlays (has a stock-site watermark; do not copy it) — glossy skull + ghosted feedback trails + 2D overlays.
5. Jungle contact sheet — dense foliage, slow camera, dark baseline, cyan/amber/magenta lighting, visible light shafts in fog,
   lighting choreographed to musical structure (Spectacle → Darkness → Rhythmic lighting → Escalation → Climax → Release).
Honest expectation: these are offline-quality renders. Real-time at 60 fps within the GPU budget means matching mood,
composition, palette and musical behavior — not pixel-for-pixel. Judge results side by side with the references.

## Principles (agreed)
- Cinema 2.0 stays authoritative for audio intelligence, Visual Director, choreography, parameters, camera, lights,
  render graph, resources. Any 3D backend is an OPTIONAL MODULE a preset can include (like the existing fullscreen-shader
  and Object3D modules). It never owns camera, lights or audio logic.
- Existing presets (HUM:N, Interlock, Afterhours, Electric Storm, Reactor…) are not migrated. Nothing new is loaded or paid
  for unless a preset includes it. Hybrids (native modules + a Three.js module + engine effects) are allowed.
- Musical behavior is `Audio Analysis → Musical Event → Choreography Decision → Visual Action`, gated by the Visual Director
  (it must NOT respond maximally to every event). World/camera = continuous cinematic motion; lights/atmosphere = musical motion.
- Do not rebuild audio intelligence. Do not bake video. Do not build an in-app model optimizer.
- Everything must honor `Cinema2RenderQualityLevel` (low/medium/high) and the GPU memory budgets
  (96/160/256 MB in `runtime/Cinema2PerformanceDiagnostics.ts`).
- Blender is NOT part of the plan; assets can come from libraries (e.g. Poly Haven), any 3D tool that exports GLB, or code.

## What exists today (verified 2026-09-25, after #1-#4 and Threshold)
All under `src/components/vyzualz/cinema2/` unless noted. Three.js is still NOT installed and no glTF loader exists anywhere.
- Modules (`modules/Cinema2ModuleContracts.ts`): create/update/dispose lifecycle; render providers (`intent: 'fullscreen' | 'world'`) get the shared
  WebGL2 context, an engine-owned framebuffer, optional depth (`depthAvailable`), `spatialNodes`, `camera` (`Cinema2CameraFrame`), `lightingEnvironment`,
  and compiled upstream `inputs`. GL resources go through `context.resources.acquire(key, kind, create, dispose)` so the host disposes them even on failure.
  Registered module types (`modules/Cinema2ModuleRegistry.ts`): fullscreen-shader, reactor, object3d, electric-storm, afterhours, interlock (+liquid light),
  hum-n, **threshold-native-render**.
- Effects (`effects/Cinema2EffectRegistry.ts`), all opt-in per preset: blur, bloom, feedback-trails, **volumetric-atmosphere**, **reflective-floor**,
  **cinematic-finish**. Effect renders now receive `camera`, `lightingEnvironment` and `quality` (added in #1). Shared helpers:
  `effects/Cinema2EffectParameterHelpers.ts` (validation, color/number reads, uniform-array upload). Effects with reduced-resolution work use the
  engine `Cinema2HistoryService` (paired buffers, budgeted) as scratch + temporal history.
- Render targets/graph (`contracts/Cinema2RenderTargets.ts`, `render/Cinema2RenderGraph.ts`): rgba8/rgba16f/rgba32f, depth none/depth16/depth24, viewport
  scale per target; passes: scene (layers), module, fullscreen (module or effect), composite, output. An effect pass needs exactly one color input and may take
  a depth input. Effect `order` must be a non-negative integer. Passes run in `passOrder`; the output pass writes the canvas.
- Lighting (`spatial/Cinema2LightingEnvironmentRuntime.ts`): ambient/directional/point/spot; spot cone (`config.coneAngleDegrees`, `config.penumbra`) and
  `config.range` resolve into `light.spot` / `light.range` (added in #1). Quality light caps: low 2, medium 4, high 8 (ambient counts as a light). Fog in the
  environment is still only linear/exponential depth fog; atmosphere/haze comes from the volumetric effect instead.
- Camera (`spatial/Cinema2CameraRuntime.ts`): rigs static/orbit/path/fly plus the opt-in `camera.motion` block (#4): spline interpolation with constant speed,
  deterministic drift, bank, roll (+ writable `roll` target), FOV rate limit, `controls.motionAmount`, and path `repeatOffset` (endless travel). `Cinema2CameraFrame`
  now carries `rollDegrees`. Only ONE authored camera is active per preset (`defaults.camera`, else the first); there is no runtime camera switching or cut.
- Choreography (`choreography/Cinema2ChoreographyRuntime.ts`): signals continuous/parameter/beat/downbeat/kick/snare/transient/bar/phrase/section-change/build/
  drop/vocal-presence/lyrics; operations map/set/replace/add/multiply/pulse/envelope/toggle/trigger/spawn/set-for-duration/variation-switch; `delayBeats`,
  `quantizeBeats`, cooldown, probability; conditions incl. director-phase, build, drop, and the new `beat-interval` (#2). Named light groups (`lighting.groups` +
  `light-group` targets, optional stagger) are expanded to per-light actions at compile time (`presets/Cinema2LightGroupExpansion.ts`). Authoring helpers:
  `presets/Cinema2LightRigAuthoring.ts` (alternate/hit/phrase arrangement/ramp) and `presets/Cinema2CameraMotionAuthoring.ts` (steady/gentle/dynamic).
- Visual Director (`director/Cinema2VisualDirector.ts`): intensity, momentum, impact, variation, phase, build, section, transition.
- Existing 3D (`modules/Cinema2Object3DModule.ts`, `spatial/Cinema2Object3D*.ts`): extruded text/SVG meshes only; no glTF, textures, PBR or shadows.
  Scene nodes of `kind: 'primitive'` are transform anchors only (nothing draws them). The SVG extruder fails on a hexagon ("degenerate triangle"), which
  breaks the older Spatial Reference preset (pre-existing); rectangles/triangles/circles extrude fine. Threshold has its own instanced box renderer
  (`modules/threshold/Cinema2ThresholdRenderer.ts`) which is the seed of a generic "instanced primitive" renderer.
- Presets (`presets/Cinema2FirstPartyPresetCatalog.ts`): foundation, reference visual, Reactor, Spatial Reference (internal), Atmosphere Reference (visible),
  Electric Storm, Afterhours, Interlock, HUM:N, **Threshold**. Presets tagged `internal` are hidden from the Cinema 2.0 preset list.
- Test baseline: `npx vitest run src/components/vyzualz/cinema2` has 15 failing files / 40 failing tests that pre-date all of this work (verified against a clean
  worktree of HEAD): AfterhoursNativeRendering, EffectRuntime, ElectricStormNativeRendering, InspectorPanel, InterlockDomain, InterlockNativeRendering,
  InterlockPreset, NativePresetManifest, ProductionPath, ReactorNativeRendering, ReferenceVisual, SceneGraph, SpatialReferencePreset, TargetRegistryResolver,
  WorkspaceSession. New work must not change that failing set. The repo also has ~90 pre-existing `tsc` errors elsewhere; the cinema2 folders touched here are clean.

## Roadmap table (priority order) and current state
| # | Component | Gives the app | Depends on | State |
|---|---|---|---|---|
| 1 | Volumetric atmosphere — native effect, no Three.js | Light shafts, colored haze/mist, beams that react to music | depth + light list | DONE |
| 2 | Performance light rig + choreography vocabulary | Light groups, every-Nth-beat gating, staggered hits, phrase arrangement, build ramps | #1 | DONE |
| 3 | Cinematic finishing + reflective floor | Filmic polish; wet floor with reflections and beam reflections | bloom/render graph | DONE |
| 4 | Camera upgrades | Spline paths, drift, bank, roll target, FOV limit, endless travel | camera runtime | DONE |
| 5 | Three.js SPIKE | Answers coexistence, color+depth handoff, cost | none | NOT STARTED |
| 6 | Three.js runtime module | Real 3D models in presets; zero cost when unused | #5 passes | NOT STARTED |
| 7 | Build-time asset pipeline (+ native texture support) | Small installer, GPU-safe models and textures | #6 (texture half: none) | NOT STARTED |
| 8 | PBR + environment lighting | Glossy skull/alien, wet rock/metal, panel-lit surroundings | #6 | NOT STARTED |
| 9 | Instancing, distance detail | Dense foliage/rocks/housings within budget | #6 (native half: none) | NOT STARTED |
| 10 | Limited shadows (one key light) | Grounding, shadowed beams (the fix for light passing through occluders) | #6, #8 (native half: #1) | NOT STARTED |

Preset order it unlocks: Stage/LED hall (Threshold is the first consumer of #1-#4) -> Skull -> Cave -> Alien -> Jungle.
Recommended order from here (2026-09-25): (a) native Threshold refinement, high-confidence batch (see "Threshold refinement plan"); (b) #7a native texture
support + asset pipeline skeleton (unblocks floor texture and smoke without Three.js); (c) #5 spike; (d) #6-#10 as below. Reason: the biggest remaining
Threshold gaps are geometry/tuning (native) and assets (#7), and #5 is a go/no-go gate whose result may change #6-#10.

## Working rules with this owner
- Do not commit; the owner commits. Do not use `git stash` on their working tree (an interrupted stash once hid their changes).
- Verify UI/graphics claims in a real browser before asserting them; ask before guessing scope/design.
- Reuse existing components/patterns; keep changes proportional; no exhaustive test runs for mockup-scoped work.
- Supabase CLI is correctly logged in and linked (migration 0033 already applied).

## Delivered work (#1-#4 and Threshold)
Original design intent for #1: an effect/render-graph pass raymarching the view ray with depth + light list; its depth input accepts ANY module's depth (so a
future Three.js module works); without depth it degrades to unoccluded haze. Delivered as below.

### #1 Volumetric atmosphere — DELIVERED (2026-09-25), not committed by the assistant
Files: `effects/Cinema2VolumetricAtmosphereEffect.ts` (effect `volumetric-atmosphere` v1, registered in `Cinema2EffectRegistry.ts`),
`presets/Cinema2AtmosphereReferencePreset.ts` (visible "Atmosphere Reference" preset, role `reference`; add the `internal` tag to hide it),
`__tests__/Cinema2VolumetricAtmosphere.test.ts` (11 tests). Contract changes: effect executions now receive `camera`,
`lightingEnvironment` and `quality`; light frames gained `spot` (`config.coneAngleDegrees`, `config.penumbra`) and `range` (`config.range`).
How it works: per-pixel view ray from the inverse view-projection (perspective or orthographic), marched to the scene depth when a depth
input is wired (any module's depth) or to `maxDistance` otherwise; noise-modulated haze + exponential ground mist; in-scatter from
spot/point/directional lights with Henyey-Greenstein phase, ambient lights tint the fill; hue-preserving highlight roll-off.
Marched at reduced resolution (low 0.4 / medium 0.5 / high 0.5) into a history-owned buffer, blended with the previous frame to remove
jitter grain, then upsampled with a depth-aware 4-tap filter; falls back to a full-resolution march if the buffer is unavailable.
Optional screen-space shafts (`shafts`) need neither lights nor a camera, so fullscreen-shader presets can use them.
Musical response: `reactivity` follows the Visual Director's gated impact (0.35 s decay); any parameter is bindable/choreographable
(the reference preset swells `beamIntensity` on the downbeat).
Measured in real Chrome on the owner's M3 Pro (1080p, whole frame incl. scene + bloom): high 6.1 ms, medium 3.2 ms, low 1.8 ms.
Known limits: no shadows (light scatters through occluders between the light and the ray; roadmap #10); pillar silhouettes show
slight low-resolution stair-stepping under bright beams; grain is fully averaged only in motion; the effect has not been placed in any
existing preset (opt-in per preset by adding a pass fed by scene color + depth).
Verification: 11 new unit tests pass; `Cinema2` test folder failure set is identical to clean HEAD (40 pre-existing failures);
real-browser screenshots checked for baseline-off, default, downbeat, low quality, full-resolution fallback and screen-space shafts.

### #2 Performance light rig + choreography vocabulary — DELIVERED (2026-09-25), not committed by the assistant
The unverified question is settled: choreography already had beat/downbeat/bar/phrase/drop/section signals, envelopes, hold-for-duration,
delay/quantize, variations and director-phase conditions, but could not say "every Nth beat" or address a set of lights. Added:
- `beat-interval` condition (`every`, `phase`, `unit: beat | bar | phrase`): passes when `counter % every === phase`; counters come from the
  beat grid (`phrase` = floor(beat index / 16), the fixed 16-beat clock, so it stays deterministic); fails closed without beat timing.
- Named light groups: `lighting.groups` + a `light-group` choreography target (optional `stagger: { beats, order }`, orders forward /
  reverse / center-out / edges-in). Groups are authoring-only: `presets/Cinema2LightGroupExpansion.ts` expands them to one ordinary light
  action per member (`<action>-<light>`, stagger becomes `delayBeats`) inside `compileCinema2NativePreset`, so the runtime, target resolver
  and Inspector are unchanged. Bad groups fail compile with `CINEMA2_PRESET_LIGHT_GROUP_*` diagnostics.
- Spot cones/range come from `light.config` (from #1); light intensity/color/position/rotation are already writable targets.
- Authoring helpers in `presets/Cinema2LightRigAuthoring.ts`: `cinema2LightRigAlternate` (N groups take turns every B beats),
  `cinema2LightRigHit` (envelope on any musical signal, optional stagger and counter gating), `cinema2LightRigPhraseArrangement`
  (groups go dark on a repeating phrase pattern; give it a higher priority than the alternation), `cinema2LightRigRamp` (additive lift that
  follows `director.intensity`/`director.build`, i.e. build -> drop -> release without a discrete trigger).
- The Atmosphere Reference preset now demonstrates all four: key and sides alternate every 2 beats, the sides sweep left-to-right a quarter
  beat apart on the downbeat, the key drops out on alternate phrases, and everything lifts with the build; idle spot intensity is 0.6, lit 2.6.
Notes for authors: lit values scale with the triggering event's strength (a weak beat lights a group less), and route strength scales them too
(the reference routes the rig through its Reactivity control). Higher-priority rules win when several replace the same target.
Verified: 13 new unit tests (expansion, compile validation, helpers, and rig timing driven by synthetic beat/phrase/build frames), lint/typecheck
clean, `Cinema2` test folder failure set identical to clean HEAD, and real-browser frames on the M3 Pro at beats 1, 3, 8.25 and 17 showing the
key lit, sides lit, the staggered downbeat sweep and the phrase blackout.
Not done: color swapping (a `set-for-duration` on a color would scale it by event strength, so alternation is done with intensity groups of
differently colored lights instead); nothing yet consumes `bar`/`drop` hits in a shipped preset beyond the helpers being available.

### #3 Cinematic finishing + reflective floor — DELIVERED (2026-09-25), not committed by the assistant
Two new opt-in effects (registered in `Cinema2EffectRegistry`, shared parameter helpers in `effects/Cinema2EffectParameterHelpers.ts`) plus a floor hook in
the volumetric effect. A reflective floor did NOT need a drawable primitive after all: it is a virtual plane, so scene `primitive` nodes still draw
nothing and the drawable-primitive module is now only needed for the stage preset's LED panels and truss.
- `cinematic-finish` v1 (`effects/Cinema2CinematicFinishEffect.ts`): exposure, tone curve (`toneMap` 0 none / 1 filmic ACES fit / 2 soft), white balance
  (`temperature`, `tint`), contrast, saturation, split-toning (`shadowTint`, `highlightTint`, `tintAmount`), lens fringing, vignette, animated mid-tone
  grain and a sub-LSB dither. Defaults are a restrained filmic look, so `{ mix: 1 }` is enough. Place it last. Contrast is a display-space S-curve on
  purpose: a linear-light pivot clipped everything under ~0.016 to black on a dark stage. Inputs are 8-bit display-referred targets, so the curve shapes
  roll-off and contrast; it cannot recover already-clipped highlights.
- `reflective-floor` v1 (`effects/Cinema2ReflectiveFloorEffect.ts`): intersects each view ray with a plane at `floorY`; where the plane is nearer than the
  scene depth the pixel becomes floor (objects still occlude it). Shaded with a dark base, light pools and specular from the shared light list, and a
  screen-space reflection (mirrored ray marched through the depth buffer, 4-step bisection, Fresnel weight, edge fade, small blur for `roughness`, horizon
  fade via `fadeDistance`). Needs a depth input and a world camera, otherwise it passes the image through. Limits: only on-screen content is reflected and
  reflections fade at the screen edge.
- Volumetric integration: authoring `floorY` on `volumetric-atmosphere` stops the haze at the plane and marches a mirrored segment (3/4 of the steps) so
  beams reflect in the floor (`floorReflection`). Put the floor pass BEFORE volumetric so haze and beams sit on top of the floor.
- Atmosphere Reference is now the full chain scene -> floor -> volumetric -> bloom -> finish with two new controls (Floor Reflection, Cinematic Finish),
  brighter defaults (idle spot 0.9, beam 1.9) and a wet floor at y = -1.2.
Measured in real Chrome on the M3 Pro (1080p, whole 5-pass frame): high 9.3 ms, medium 4.5 ms, low 2.2 ms.
Verified: 8 new tests (registration/validation, uniforms per quality, passthrough without depth/camera, volumetric floor clamp on/off, pass order) plus the
existing suites; lint/typecheck clean; `Cinema2` folder failure set identical to clean HEAD; real-browser frames with finish on/off, floor pools and
mirrored pillars/beams, and Low quality.
Known limits: no shadows, so pools/beams ignore occluders (roadmap #10); frame-to-frame grain only averages out at normal playback rates (a step over
100 ms deliberately restarts the volumetric history); Low quality allows only 2 lights (existing limit), so a 3-spot rig shows 2 there.

### #4 Camera upgrades — DELIVERED (2026-09-25), not committed by the assistant
Everything is opt-in through one `camera.motion` block (`Cinema2CameraMotionManifest`), so cameras without it behave exactly as before. Runtime order:
rig -> transition -> user controls -> target contributions -> drift -> safety clamp -> FOV rate limit -> smoothing -> bank -> matrices
(`spatial/Cinema2CameraRuntime.ts`). Compile-time validation is `CINEMA2_PRESET_CAMERA_MOTION_INVALID`.
- Smooth paths: `motion.interpolation: 'spline'` runs a Catmull-Rom curve through path/fly points (position, target and FOV) instead of straight segments;
  `constantSpeed` (default true with spline) reparametrizes by arc length so speed is even across uneven waypoint spacing; `loop` closes the curve without
  a kink; speed-based durations use the curve length. Linear stays the default. The arc-length table uses 200 samples per segment (24 caused +-10% speed jitter).
- Slow drift: `motion.drift` { position, target, rollDegrees, fovDegrees, speed, seed }: three incommensurate sines per channel, a pure function of
  time, so exports and scrubbing are reproducible. `controls.motionAmount` scales drift and bank together (0 = locked off).
- Bank: `motion.bank` { maxDegrees, gain, smoothingMs } leans the camera into turns from the heading change of its own (pre-drift) travel, and relaxes to
  level on straight runs or when stopped. Positive roll = right bank.
- Roll: a fixed `motion.rollDegrees` and a writable camera `roll` target (present only on cameras that author `motion`), so choreography can lean the camera
  on the beat. `Cinema2CameraFrame` gained `rollDegrees` (0 for implicit/unauthored cameras); the view matrix takes roll.
- Restrained FOV: `motion.fovRateLimitDegreesPerSecond` caps how fast the lens can change, so FOV pulses can't jerk.
- `presets/Cinema2CameraMotionAuthoring.ts`: `cinema2CinematicMotion('steady' | 'gentle' | 'dynamic', { splinePath?, overrides? })`.
- Atmosphere Reference now uses an 80 s closed dolly (6 points, varying radius/height, all above the floor), `gentle` motion, a Camera Motion control, and a
  0.3-beat eased 1.2 degree roll lean on the downbeat. It replaces the old orbit camera in that preset only.
Also fixed as a side effect: the 3 pre-existing TypeScript errors in `Cinema2CameraRuntime.ts` (null vs undefined control reads).
Verified: 16 new camera tests (linear vs spline corners and speed, waypoint pass-through, loop seam, drift bounds/determinism/seed/motionAmount, bank sign
and limits, level on straight runs, roll target composition, FOV rate limit, validation, reference-dolly guarantees); lint/typecheck clean; `Cinema2` folder
failure set identical to clean HEAD; a real-browser 40 s run on the M3 Pro (camera stayed 0.65-1.83 above the -1.2 floor, bank -3.1..+0.7 degrees, FOV
45.5-46.6, per-frame step 0.0167-0.0219 including drift) with frames from several vantage points.
Known limits: bank follows horizontal heading only (no pitch/vertical banking); drift adds to the pose before the safety clamp, so a preset with a very
tight `maxPositionOffset` will clip it; the roll target is only exposed when `motion` is authored.

### Threshold preset (first consumer of #1-#4) — DELIVERED (2026-09-25), not committed by the assistant
A visible first-party keeper, `drmvyz.cinema2.threshold` ("Threshold"), built to test whether the native stack reaches the monolith reference renders.
- Files: `presets/Cinema2ThresholdPreset.ts`, `modules/Cinema2ThresholdNativeModule.ts` (instanced monolith renderer), `modules/threshold/` (`Layout`,
  `ReactiveState`, `Renderer`), `__tests__/Cinema2Threshold.test.ts` (18 tests). Extra platform changes made for it: camera path `repeatOffset` (endless travel
  through a repeating environment, absolute clamp lifted on the travel axis), volumetric `ambientHeight` (ambient glow that settles low), mock-GL
  `drawElementsInstanced`.
- Scenes (one 180-unit lap, repeated endlessly and seamlessly): corridor of standing monoliths, hanging-monolith field (camera rises above the mist),
  inward-facing ring of tilted panels (camera passes through and looks up). One spline flight, 80 s per lap, low and forward, `gentle` motion.
- Controls (15 + the shared quality control): Master Controls - Master Intensity, Master Reactivity, BPM Sync, Camera Motion; Design - Panel Brightness,
  Fog Density, Corridor Width; Effects - Floor Reflection, Bloom, Light Shafts, Cinematic Finish; Palette - Primary, Accent, Atmosphere, Void (the contract needs four
  independent colors, so Void = background/floor/body is the fourth). Master Intensity drives the module and the bloom/atmosphere mix; Reactivity gates every music
  response and is the route strength for the choreography rules.
- Music map: kick -> support screens; snare -> alternate rows; beat -> rows alternate every 2 beats; downbeat -> sweep down the aisle + camera lean + shaft/bloom
  swell; phrase -> leading side swaps; build/energy -> how many screens are open; drop -> whole set flashes; bass -> fog swell; highs -> LED shimmer; vocals -> support
  screens step back. BPM Sync locks idle breathing, LED shimmer and sweep speed to the tempo (real consumer, tested).
- Measured in real Chrome on the M3 Pro (1080p, whole 5-pass frame): high 6.9 ms, medium 3.3 ms, low 1.9 ms.
- Look tuning lessons (keep for the stage/LED preset): mist density must be scaled to the scene (a value carried over from a 20-unit scene was ~100x too thick and
  drowned the frame); screen-space shafts above ~0.3 smear every bright pixel like motion blur; the existing bloom shows echo ghosts at radius >= 4 on hard bright edges
  (use radius 2); a uniform ambient haze washes the sky, so use `ambientHeight`.
- Known limits vs. the references: no sculpted cloud volumes, no floor texture (the floor is a smooth mirror), no catwalk/truss/ring-structure detail, fog glow around the
  screens comes from bloom + shafts + low ambient haze (not from per-panel lights); low-resolution volumetric edges show slight stair-stepping on the brightest panels; SSR
  leaves some dotted noise on the floor where bright reflections are thin; the ring reads as tall fins, not the radial ring hall; the fine LED grid fades with distance to
  avoid moire.

## Detailed plan: steps #5-#10 (not started)
Common rules for every step: opt-in per preset and zero cost when unused; honor `Cinema2RenderQualityLevel` (low/medium/high) and the GPU budgets (96/160/256 MB in
`runtime/Cinema2PerformanceDiagnostics.ts`); deterministic (no wall-clock randomness; use the engine random service / seeded generators); dispose everything
(verify with the mock-GL create/delete counters, as `Cinema2Threshold.test.ts` does); verify visually in a real browser before claiming a result; keep the
existing failing-test set unchanged; the owner commits.

### #5 Three.js spike (go/no-go gate) — NOT STARTED
Purpose: cheaply answer whether Three.js can live inside the Cinema 2.0 render graph before any product code depends on it. Throwaway code on a scratch harness
page (same pattern as the temp browser harnesses used for #1-#4); delete or quarantine afterwards. Output: a short spike report appended to this doc with numbers.
Questions and how to answer each:
1. Install/size: add `three` at an EXACT pinned version (no caret); measure the production bundle delta with it in a lazy chunk (`import('three')`) vs not
   loaded; confirm Vite/Electron packaging tree-shakes and the chunk is not fetched by presets that do not use it.
2. Shared context: construct `new THREE.WebGLRenderer({ canvas, context: gl })` over the engine's existing WebGL2 context (the module receives `gl` via
   `context.resources.acquire`); set `autoClear = false`, tone mapping off, `outputColorSpace` chosen deliberately (engine targets are display-referred rgba8; final
   grade is done by the `cinematic-finish` effect). Call `renderer.resetState()` before and after every use. Prove no state leaks in either direction: after a Three
   draw, run the existing effects/native modules for 10,000 frames and diff framebuffer/VAO/program/blend/depth/viewport/active-texture/pixelStorei state; look for
   visual corruption.
3. Handoff of color + depth (the crux): the engine expects the module to write into its OWN framebuffer (color + depth24, depth sampleable for downstream effects).
   Preferred: Three renders into its own `WebGLRenderTarget` (HalfFloat color + `DepthTexture`), then the module composites into the engine target with a small
   fullscreen pass that copies color AND writes `gl_FragDepth` from Three's depth texture so `volumetric-atmosphere`/`reflective-floor` see correct depth. Alternatives
   to test: `blitFramebuffer` from Three's internal framebuffer (needs `renderer.properties` internals; brittle across versions), or wrapping the engine's
   framebuffer/textures in a Three render target (again internals). Verify against the PINNED version's actual API; do not assume.
4. Camera: set `camera.matrixAutoUpdate = false`, copy `Cinema2CameraFrame.projectionMatrix` into `camera.projectionMatrix` (+ inverse) and `viewMatrix` into
   `matrixWorldInverse` (both column-major, OpenGL clip space, same as Three). Confirm depth values match the engine's near/far so downstream depth effects agree.
5. Lights: map the Cinema 2.0 light list to Three lights (ambient/directional/point/spot; use `light.spot` and `light.range` from the lighting frame), no Three-owned
   light logic. Confirm intensity/color conventions (physical units differ) and choose a documented mapping.
6. Robustness: WebGL context loss/restore (the engine has `handleContextLost/Restored` hooks on runtime, resources, effects), repeated create/dispose cycles (no leaked
   GL objects: compare create/delete counters), disposal of geometries/materials/textures/render targets.
7. Memory reporting: use `renderer.info.memory` + tracked textures/render-target sizes to produce an estimated-bytes number the engine can add to its budget.
8. Cost: one bundled mid-size model (~100k triangles, one 2k PBR texture set) with `MeshStandardMaterial` at 1080p on the owner's M3 Pro; report ms/frame for the
   Three pass alone and for a full chain (Three -> floor -> volumetric -> bloom -> finish). Also lazy-load latency (first frame after `import()` + model decode).
9. glTF decode: GLTFLoader with locally bundled Draco/meshopt decoders (no CDN, Electron offline), decode time and where it runs (worker vs main thread).
Pass criteria (all): no state leakage; correct depth seen by downstream effects; zero leaked GL objects after 20 create/dispose cycles; survives context loss;
Three pass <= ~6 ms at 1080p high for the reference model; lazy chunk not loaded when unused. FAIL/PARTIAL fallbacks, in order: (a) Three on a separate
`OffscreenCanvas` with a texture upload (loses depth sharing, so floor/volumetric cannot occlude against Three content; only viable for isolated hero objects);
(b) skip Three entirely and write a small native glTF loader + PBR-lite + IBL renderer in raw GL (more work, full control, same module contract). Record the
decision here.

### #6 Three.js runtime module — NOT STARTED (needs #5 pass)
Purpose: let a preset include real 3D models. A new module type (working name `three-scene`) registered in the module registry like the others; a preset that does
not include it never loads Three.
- Loading: `await import('three')` and GLTFLoader/Draco/meshopt only when a preset containing the module activates; module state machine
  `loading -> ready | failed`; while loading render nothing (or an authored placeholder), surface a diagnostic on failure and skip safely (never crash the frame).
- Contract: config lists shipped asset ids (resolved via the #7 manifest, never arbitrary URLs); placement comes from Scene Graph module nodes (`spatialNodes[].worldMatrix`)
  so choreography can move/rotate/scale models; material overrides exposed as module parameters (color, emissive, roughness) so the Design inspector can bind them.
  It NEVER owns camera, lights or audio: camera from `Cinema2CameraFrame`, lights from the light list, music via choreography targets/module parameters.
- Rendering: world-intent provider; renders through the #5 handoff into the engine target (color + depth) honoring layer `depthPolicy`; multiple Three modules in one
  preset share ONE renderer instance (keyed resource) to avoid duplicated GL state.
- Quality gating: low = simplified materials + LOD1 + smaller textures (via #7 variants); medium/high progressively richer. Budget: report estimated GPU bytes to the
  engine (extend the module resource snapshot/`Cinema2PerformanceDiagnostics`) so auto-quality can react.
- Lifecycle/robustness: full dispose on preset exit (zero leaked GL objects), context-loss recovery (rebuild GPU resources lazily, keep decoded CPU data), preset
  re-entry resets state deterministically.
Acceptance: a test preset with one shipped model renders through the real Runtime path with correct occlusion by/against other modules; leaving and re-entering the preset
leaks nothing; missing/corrupt asset produces a diagnostic and a safe skip; quality change measurably reduces cost; bundle check confirms zero cost when unused.
Files (proposed): `modules/Cinema2ThreeSceneModule.ts`, `modules/three/` (loader, renderer bridge, material mapping, disposal tracker), tests in `__tests__/`.

### #7 Build-time asset pipeline (+ native texture support) — NOT STARTED
Purpose: ship models and textures with the app at controlled size and GPU cost. NO in-app optimizer (agreed principle): everything here is build-time.
Two independent halves:
7a. Native texture support (does NOT need Three.js; recommended early): an engine `Cinema2AssetTextureService` that loads shipped images (PNG/WebP, optionally KTX2 if
    the basis transcoder is accepted) into GL textures with mipmaps, tracked by the ResourceManager budget and disposed with the owner. Effects receive textures through
    an explicit, validated parameter/asset reference. First consumers: floor normal/roughness maps for `reflective-floor` (breaks the mirror into streaks, fixes the
    "smooth mirror" gap), tileable 3D-ish noise / smoke sprite sheets for `volumetric-atmosphere` (fixes the "procedural haze" look better than more sine noise).
7b. Model/texture pipeline: a build script (e.g. `scripts/cinema2-assets/`, run by `npm run assets:build`, verified by `npm run assets:check` in CI):
    - Sources live in `assets/cinema2/src/<asset-id>/` with an `asset.json` record: id, kind (model|texture|environment), source URL, author, license (allowlist:
      CC0, CC-BY [needs attribution entry], MIT/Apache for code-generated), attribution text, triangle budget, max texture size, per-quality variants.
    - Processing (e.g. glTF-Transform): dedupe/prune, weld/quantize, meshopt or Draco, texture resize + format conversion (WebP or KTX2), generated LODs (feeds #9),
      per-asset GPU-cost estimate per quality tier.
    - Output: hashed files under the app's static assets + a generated `manifest.json`/TypeScript types (`Cinema2AssetId` union) so presets reference assets by id and
      the preset compiler can fail on unknown ids.
    - `assets:check` FAILS the build on: missing/invalid license record, license not on the allowlist, missing attribution, triangle/texture over budget, per-preset asset
      total over the GPU budget for a tier, or total shipped-asset size above the owner-set installer limit. A generated attribution list is included in the app.
    Decisions the owner must make first: installer-size budget for the first wave (proposal: <= +50 MB), where sources are stored (repo vs Git LFS vs an external
    private bucket pulled at build time), KTX2/Basis (small VRAM, needs a ~0.3-0.5 MB transcoder) vs WebP (simple, larger VRAM).
Acceptance: `assets:check` demonstrably fails for each violation above (test with deliberately bad fixtures); one texture reaches the floor effect through 7a and is
visible; disposing the effect frees it (counter test).

### #8 PBR materials + environment lighting — NOT STARTED (needs #6)
Purpose: glossy black (skull, alien), wet rock and metal that reflect the scene properly, and surfaces that pick up light from emissive panels.
- Materials: `MeshStandardMaterial`/`MeshPhysicalMaterial` (clearcoat for the glossy skull), normal/roughness/metalness/emissive maps from #7.
- Environment: a small shipped HDR/EXR (1k-2k) or a generated studio-style environment -> PMREM once at load; intensity/rotation exposed as module parameters (and
  choreography targets) tied to the Cinema 2.0 environment exposure; static probe only (no dynamic reflection probes). Optionally also offer this environment to the native
  reflective floor for its screen-space misses (currently a flat sky color).
- LED-panel lighting: use Three's `RectAreaLight` (LTC) fed from the Cinema 2.0 light list / panel state so emissive panels actually light nearby surfaces and the floor
  (this is the fix for Threshold difference #7, "light spill"). Notes to verify: works only with Standard/Physical materials, no shadows from area lights,
  `RectAreaLightUniformsLib.init()` required, cost scales with light count. The native Threshold renderer would need an equivalent native spill approximation.
- Quality tiers: low = no clearcoat, no normal maps, lower-res env; medium = normal maps; high = full.
Acceptance: a glossy test model visibly re-reflects when light colors change and when the environment rotates; reflections respect the material parameters; budget
reported; low tier stays within the low budget.

### #9 Instancing, distance detail — NOT STARTED (needs #6 for the Three half)
Purpose: dense repeated objects (foliage, ferns, rocks, monolith housings) within the frame budget.
- Native half (no Three.js, can start any time): generalize Threshold's instanced box renderer into an "instanced primitive/mesh" module: one static instance buffer
  (position/scale/rotation/role/seed), per-frame state as uniforms, camera-relative coordinates for precision, N lap copies for endless flights, chunked frustum culling.
- Three half: `InstancedMesh` with per-instance color/emissive attributes; chunk the instances into a grid so frustum culling works per chunk; distance LODs (LOD meshes
  from #7, or cross-plane impostors for far foliage); alpha-tested leaves use alpha-to-coverage or dithered cutout to control overdraw; wind/sway in the vertex shader from
  the engine clock (deterministic, BPM Sync aware) rather than wall time.
- Budgets: max instances and max triangles per quality tier, declared per module and checked at compile/create; deterministic scatter from a seeded generator.
Acceptance: e.g. 5,000-20,000 foliage instances at 60 fps 1080p on the M3 Pro at high; low tier at roughly a quarter of the count; identical layout run to run.

### #10 Limited shadows (one key light) — NOT STARTED
Purpose: grounding/depth in dense scenes AND the structural fix for "beams and light pools ignore occluders" (see #1/#3 known limits).
Design decision to make first: shadows are an ENGINE resource, not a Three feature, so native modules, Three models and effects all share one shadow map.
- Add an optional shadow-caster facet to module render providers (`renderDepth(light view/proj)`), an engine-owned shadow map resource for at most one light chosen by
  `light.config.castShadow` (directional or spot), sized by quality (e.g. 512/1024/2048, counted in the GPU budget; off at low), rendered only when casters move (static
  casters cached, e.g. Threshold's layout renders once).
- Consumers: (1) `volumetric-atmosphere` samples the shadow map along the ray so beams are properly blocked (real god rays through gaps between towers); (2)
  `reflective-floor` light pools respect occlusion; (3) Three materials use the same map (or their own shadow map with matching light); (4) native module bodies can receive.
- Quality/artifacts: PCF/soft filtering, slope-scaled bias to avoid acne and peter-panning; no cascades in v1; only one shadowed light.
- Cost note: the volumetric march gets a shadow-map fetch per step, so step counts may need trimming; measure on the M3 Pro before promising 60 fps. The native
  half (shadow map + volumetric/floor consumers + Threshold as caster) does NOT need Three and can be built before #6.
Acceptance: towers visibly block a spot beam in the volumetric haze; a floor light pool is occluded by an object; shadow map memory counted; off at low; no acne on
the reference scenes; frame cost within budget.

## Threshold refinement plan (native work, before or alongside #5)
Owner asked for a side-by-side analysis of the current Threshold against the original reference (bright symmetric corridor of tall LED monoliths, smoke, wet cracked
floor). 14 differences were identified (numbering is stable and used in conversation):
1 symmetry (reference centred and mirrored; Threshold uneven, swaying) · 2 near-panel framing (reference panels inset ~10% from the edges; Threshold's are cropped at the
edges and read as walls) · 3 rhythm of the row (reference: evenly spaced shrinking colonnade; Threshold: clutter from random rear/support panels) · 4 FOV and scale
(reference wider, panels run off the top) · 5 housings (reference panels sit in massive dark towers with thickness, edges, mounts, bases with small lights; Threshold: flat
slabs) · 6 panel brightness (reference pure even white; Threshold grey-white/irregular) · 7 light spill (reference panels light tower edges, floor and air; Threshold:
bloom halo only) · 8 ground smoke (reference billowing wisps; Threshold a smooth horizon glow strip) · 9 light shafts (reference diagonal beams; Threshold faint) ·
10 vanishing point and ceiling (reference glow spilling up/down into faint overhead structure; Threshold flat dark upper half, hard horizon line) · 11 floor surface
(reference wet cracked rough concrete with broken bright streaks; Threshold near-perfect smooth mirror, large empty black foreground) · 12 reflection artefacts (dotted,
stair-stepped edges) · 13 tint (reference cool desaturated blue-grey with neutral white panels; Threshold saturated navy) · 14 edge quality (colour fringing on the
leftmost slab, grain, stair-stepped bright panel edges).
Confidence and plan (owner-approved ordering: do the high group first, then re-compare side by side):
- HIGH (native, mostly geometry/tuning): 1, 2, 3, 4, 6, 13, and the fringing/grain part of 14. Concrete moves: remove the random rear/support clutter in the corridor
  and use evenly spaced mirrored pairs; centre the camera and cut lateral sway; inset the first pair; FOV ~65-70 and taller panels; drive panel emission to pure white;
  neutral grade (lower saturation, neutral tint); reduce `aberration`, keep grain low.
- MEDIUM-HIGH: 5 (dark housing boxes behind each panel with depth, edge highlights, a base and small lights; proper modelled housings arrive with #6/#7), 7 (glow onto
  nearby tower edges/floor from panel brightness; physically based version is #8), 10 (vanishing-point glow; overhead structure needs geometry), 12 and the edge part of 14
  (reduce SSR jitter noise; raise volumetric resolution or improve the depth-aware upsample near bright edges; check speed).
- MEDIUM: 9 (stronger, better-shaped shafts; real occluded beams need #10), 11 (roughness noise in the floor effect for broken streaks; real wet-concrete detail needs
  #7a textures).
- LOW: 8 (wispy smoke; better with #7a shipped noise/smoke textures, or #9 sprites; unlikely to match the reference without them).
Also: keep Threshold's other scenes (hanging field, ring) working; verification method = real Chrome renders compared against the reference, judged by the owner.

### Refinement batch A (differences 1, 2, 3, 4, 6, 13, 14-fringing/grain) - APPLIED 2026-09-25, not committed by the assistant
What changed (all in Threshold; 22 tests in `Cinema2Threshold.test.ts` cover it):
- Layout (`modules/threshold/Cinema2ThresholdLayout.ts`): period 216; corridor is now ONLY 5 mirrored pairs of main LED screens (7 x 36, half-width 26, spacing 20, first pair at
  d=24), identical height/rank on both sides, ranks increasing with distance so the set opens symmetrically. The dark rear towers and small support panels are gone from the corridor.
  Field: 14 taller panels (x 12-30). Ring: centre 184 (`THRESHOLD_RING_CENTER`), 26 tall panels.
- Camera: dead centre (x = 0) with a slight upward look in the corridor, `steady` motion (drift 0.04, bank <= 1.5), FOV 68 (70-72 through the field), 96 s per lap (~2.25 u/s);
  only the field section has lateral sway (+-1).
- Screens: pure white by default (Primary 0.97/0.985/1, level above 1 so it clips to white), even glow (pixel grid 10%, gradient 4%), no filmic curve (`toneMap: 0`, exposure 1),
  vignette 0.2, desaturated grade (saturation 0.55, tint 0.1, neutral tints), aberration 0.04, grain 0.06, shafts default 0.12.
- Music on white panels: an 8-bit target clips anything above white, so brightness on top of white is invisible. New reactive `level`: idle = full white; with music, quiet passages dim
  the set (down to ~55%) and energy/build bring it back, while beats/snare/kick/sweep lift over the top. Idle also has arc = 1 and no leading side (`phraseSide = -1`), so idle is perfectly
  symmetric. Kick now also gently pulses the main screens (the corridor has no support panels any more).
- Field/ring screens surface out of the fog only when the camera is within ~75 units (and at 72% brightness), so the far end of the corridor is a clean vanishing point; every screen dims
  smoothly when the camera is within ~14-44 units of it (`nearDim`), so flying past one never blows out the frame.
Lessons: (1) a filmic tone curve greys pure-white screens (ACES maps 1.0 to ~0.8), and boosting exposure to compensate lifts noise everywhere - drop the curve instead; (2) the vignette darkens
the frame edges where the near panels sit, making white panels grey; (3) flying BESIDE a big panel is the worst frame (huge grazing-angle stretch at the periphery of a wide lens) - judge
the flyby, not just the still; (4) with no track loaded the engine freezes visual time, so the camera holds the start of the lap - idle screenshots do not show the flyby; (5) fine LED-pixel
patterns alias into moire at grazing angles unless their detail fades early (`pixelDetail` factor 1.8); (6) when a frame looks wrong, isolate by switching effects off one at a time
before theorizing.
Measured after the batch: 1080p on the M3 Pro - high 8.7 ms, medium 3.3 ms, low 1.9 ms.
Still different from the reference (unchanged by this batch): 5 housings, 7 light spill, 8 smoke, 9 shafts, 10 vanishing-point glow / ceiling, 11 floor surface, 12 SSR dotted noise,
14 stair-stepped bright edges. The near flybys are still large and bright; the corridor is emptier than the reference (dark void between panels where the reference has towers - that is item 5).

## Practical recipes and gotchas (learned the hard way)
Verification recipes
- Unit tests: `npx vitest run src/components/vyzualz/cinema2` (compare the failing set to the baseline above); typecheck `npx tsc --noEmit -p tsconfig.json` (grep for the
  folders you touched); lint `npx eslint <paths>`.
- Baseline comparison without stashing: `git worktree add --detach <scratchpad>/base HEAD`, then `rm -rf base/node_modules && ln -s <repo>/node_modules base/node_modules`,
  run the same vitest command there, diff the sorted `FAIL`/summary lines, then `git worktree remove --force`. NEVER `git stash` (owner rule).
- Real-browser check: create a temporary harness page under `src/test/browser/` (an `.html` + `.ts` that builds `Cinema2Runtime.create(canvas, { presetId, requestAnimationFrame,
  cancelAnimationFrame, audioIntelligenceBridge, transportSource, renderQuality })` with a synthetic 120 BPM music frame from
  `__tests__/support/Cinema2HumNFrameFactory.ts`, steps frames manually, and returns `canvas.toDataURL()`); serve with `npx vite --port 5197 --host 127.0.0.1 --strictPort`;
  drive it with a small Node script using `@playwright/test` `chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })` (this
  runs on the real Apple GPU via Metal, so timings are meaningful). Step frames at <= 1/30 s: a frame gap over 100 ms deliberately restarts the volumetric temporal history
  and looks grainier than real playback. Delete the harness and kill vite afterwards.
- Measure cost with a synchronous 1x1 `gl.readPixels` after each frame, at 1920x1080, for high/medium/low.
Gotchas
- macOS: `sed -i ''` (BSD) and zsh needs quoted globs (`--include='*.ts'`); `timeout` is not installed.
- Effect `order` must be >= 0; parameter bindings only for parameters authored in the effect's `parameters`; a binding's parameter type must match the authored value
  (float, boolean, or 4-number `color`); transient contributions need a writer id `choreography`/`modulation` and a contributor id prefixed `choreography:`.
- Every capability a preset uses (including nested choreography sources) must be declared at the preset boundary or the authoring gate fails; keeper presets need
  `designParentGroup` on every user-facing Design parameter and every such parameter must be consumed by a binding.
- A preset's user-facing minimums (contract): a BPM Sync toggle under Master Controls with a real consumer, and at least four independent `color` parameters under Palette,
  plus a master Intensity control (owner requirement). Presets use `Cinema2SyncedMotionClockResolver` (`modules/Cinema2SyncedMotionClock.ts`) for BPM Sync.
- Effects with a reduced-resolution pass use `Cinema2HistoryService.beginFrame(name, w, h)` and must never sample the surface they are writing.
- Look-tuning lessons: scale mist/haze density to the scene size; keep screen-space shafts low (~0.3) to avoid smear; keep bloom radius small (2) to avoid echo ghosts on hard
  edges; a uniform ambient haze washes the sky (use `ambientHeight`); contrast in linear light around 0.18 crushes dark scenes (use display-space S-curve); a jump of many seconds in
  test audio frames is treated as a seek and resets choreography/module state (step gradually in tests).
- Precision: endless flights use camera-relative rendering in the module; effects that reconstruct world positions from the camera matrices lose precision after many
  thousands of units of travel (hours), acceptable for now.

## Open decisions for the owner
1. Installer-size budget for shipped 3D assets, and where source assets are stored (repo vs Git LFS vs external bucket). Blocks #7b/#6 real assets.
2. Texture format: KTX2/Basis (needs a transcoder) vs WebP. Blocks #7.
3. Whether to do #7a native textures (floor/smoke) BEFORE the #5 Three.js spike. Recommended: yes.
4. Whether to add runtime camera switching / hard shot cuts (a small feature: choreography switches between authored cameras on a musical event). Not built.
5. Whether Threshold should become the stage/LED-hall base for further presets (e.g. the water-floor variant of the reference) or stay a one-off test.
6. Reference image files are not in the repo: `~/Downloads/cinema2-3d-reference-images/` (re-attach if missing); the Threshold reference frames were attached in chat only.

## Where we are and what happens next
DONE: #1-#4 and the Threshold preset (all uncommitted by the assistant; the owner commits). NEXT (recommended): Threshold high-confidence refinement batch, then #7a, then #5,
then #6-#10 per the detailed plan above. Do not start #5 without checking the open decisions; do not commit; verify in a real browser; keep the baseline failing set unchanged.
