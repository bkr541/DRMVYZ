# Cinema 2.0 — Advanced 3D Visuals: Decisions, Findings and Build Order

Handoff document. A new session should read this, then `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`
and `AI_IMPLEMENTATION_CONTRACT.md` (repo root), then start at "Current task".

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

## What the repo has today (verified by reading, not by running)
All under `src/components/vyzualz/cinema2/`.
- Modules (`modules/Cinema2ModuleContracts.ts`): create/update/dispose lifecycle; render providers (`intent: 'fullscreen' | 'world'`)
  get a shared WebGL2 context, an engine-owned framebuffer, optional depth (`depthAvailable`), `spatialNodes`, `camera`
  (`Cinema2CameraFrame` with view/projection matrices), `lightingEnvironment`, and compiled upstream `inputs` (color/depth textures).
- Render targets (`contracts/Cinema2RenderTargets.ts`): rgba8/rgba16f/rgba32f, depth none/depth16/depth24; render graph
  (`render/Cinema2RenderGraph.ts`) validates depth sampling.
- Lighting (`spatial/Cinema2LightingEnvironmentRuntime.ts`): lights (type/color/intensity/position/direction), fog is ONLY linear or
  exponential depth fog, exposure. No volumetric light.
- Camera (`spatial/Cinema2CameraRuntime.ts`): rigs static/orbit/path/fly.
- Existing 3D (`modules/Cinema2Object3DModule.ts`, `spatial/Cinema2Object3D*.ts`): extruded text/SVG meshes only. No glTF, textures, PBR,
  instancing or shadows. VERIFIED (2026-09-25): `kind: 'primitive'` scene nodes are only transform anchors; nothing draws them. The
  stage preset (panels, truss, floor) therefore needs a small drawable-primitive module (box/quad, emissive) before #3's floor work.
  Also found: the SVG extruder currently fails on a hexagon ("degenerate triangle"), which breaks the existing Spatial Reference preset
  (2 pre-existing failing tests); rectangles/triangles/circles extrude fine.
- Effects (`effects/Cinema2BuiltinEffects.ts`): feedback/trails, blur, bloom.
- Choreography (`choreography/Cinema2ChoreographyRuntime.ts`): operations pulse/envelope/toggle/trigger/spawn/set-for-duration/
  variation-switch, `quantizeBeats`, delay; audio bridge exposes beat/bar index, downbeat, phrase events, buildProgress,
  dropConfidence. UNVERIFIED: whether "alternate every 2 beats" and phrase-level state changes are fully covered — confirm first.
- Visual Director (`director/Cinema2VisualDirector.ts`): intensity, momentum, impact, variation, phase, build, section.
- Three.js is NOT installed. No glTF loader exists anywhere.
- Recent, unrelated: HUM:N is manifest revision 21; pre-existing unrelated test/typecheck failures exist (~90 tsc errors, many test files).

## Build order (priority) and what each gives
| # | Component | Gives the app | Depends on |
|---|---|---|---|
| 1 | Volumetric atmosphere — native engine effect, NO Three.js | Visible light shafts, colored haze/ground mist, beams that react to music; any preset can use it | depth + light list (exist) |
| 2 | Performance light rig + choreography vocabulary | Named light groups, 2-beat alternation, downbeat shafts, phrase rearrangement, build/drop/release ramps | #1 |
| 3 | Cinematic finishing (tone map, grade, vignette, grain) + reflective floor | Filmic polish; wet-floor reflection for the stage look | existing bloom/render graph |
| 4 | Camera upgrades (smooth paths, slow drift, bank, restrained FOV) | Cinematic travel on the existing rigs | camera runtime |
| 5 | Three.js SPIKE (one small bundled model) — start alongside #1 | Answers: coexistence with raw-GL modules, color+depth handoff, frame/memory cost | none |
| 6 | Three.js runtime module (lazy, quality-aware, reports memory, disposes) | Real 3D models in presets; zero cost when unused | #5 passes |
| 7 | Build-time asset pipeline (compress, budget checks, license record) | Small installer, GPU-safe assets | #6 |
| 8 | PBR + environment lighting | Glossy skull/alien, wet rock/metal | #6 |
| 9 | Instancing, distance detail | Dense foliage/rocks within budget | #6 |
| 10 | Limited shadows (one key light) | Depth/grounding, last because expensive | #6, #8 |

Preset order it unlocks: (1) Stage/LED hall [mostly #1–#3, maybe no Three.js] → (2) Skull → (3) Cave → (4) Alien → (5) Jungle.

## Design notes for #1 (volumetric atmosphere)
- Implement as a Cinema 2.0 effect/render-graph pass, raymarching along the view ray using the depth input, camera frame and the
  `lightingEnvironment.lights`; noise-modulated density; tint from light colors; quality-scaled step count / render-target scale.
- Its depth input must accept ANY module's depth (including a future Three.js module) — design the contract for that now.
- Without depth (fullscreen-shader presets) it degrades to unoccluded haze/glow.
- Follow the Preset Creation Contract; add tests in the existing `cinema2/__tests__` style; verify visually in a real browser
  (Playwright + system Chrome is used elsewhere in this repo; see `scripts/run-cinema2-humn-browser.mjs`).

## Design notes for the Three.js spike (#5)
Preferred integration: Three renders into its OWN render target (HalfFloat color + DepthTexture) inside the shared GL context,
calling `renderer.resetState()` around use; Three's camera is set directly from `Cinema2CameraFrame`; lights come from the Cinema 2.0
light list; result is handed to the engine target by blit/wrapped texture. Fallback: separate OffscreenCanvas (loses HDR/depth sharing).
To verify against the pinned Three version: texture handoff API (ExternalTexture vs internal properties), depth linearization,
context-loss recovery, disposal, `renderer.info` memory reporting into the budget.

## Working rules with this owner
- Do not commit; the owner commits. Do not use `git stash` on their working tree (an interrupted stash once hid their changes).
- Verify UI/graphics claims in a real browser before asserting them; ask before guessing scope/design.
- Reuse existing components/patterns; keep changes proportional; no exhaustive test runs for mockup-scoped work.
- Supabase CLI is correctly logged in and linked (migration 0033 already applied).

## Status
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

### Roadmap status
#1-#4 (all the native, no-Three.js work) are done. Remaining, in order: #5 Three.js spike (independent, can start any time), then #6 runtime module, #7
asset pipeline, #8 PBR/environment lighting, #9 instancing, #10 limited shadows (also the fix for beams/pools ignoring occluders). The stage/LED-hall preset
can be built now on #1-#4 plus a small drawable-primitive module (LED panels, truss).
