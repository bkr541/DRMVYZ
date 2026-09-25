# Cinema 2.0 — Advanced 3D Visuals: Decisions, Findings, Build Order and Handoff

Handoff document, written so a new session (or a session that ran out of context) can resume with no other memory.
READ ORDER: 1) "STATUS SUMMARY" right below (the fastest way to review everything done and everything left); 2) the rest of this file as needed;
3) `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` and `AI_IMPLEMENTATION_CONTRACT.md` (repo root); 4) then "Where we are and what happens next" at the end.

Contents: STATUS SUMMARY · Goal · Reference images · Principles · What exists today · Roadmap table · Working rules · Delivered work (#1-#4, Threshold) · Detailed plan and results for #5-#10
(#5, #6, #7 and the native half of #10 delivered; #8, #9 and the Three half of #10 open) · Threshold refinement plan and batches A and B · Practical recipes and gotchas · Open decisions for the owner.

## STATUS SUMMARY (updated 2026-09-25, after #7 and the native half of #10)
Everything except the #10 work is committed in git by the owner (the #10 files were uncommitted when this was written). Working rules: the owner commits; never `git stash`; verify graphics claims in real Chrome
(Electron for packaging/protocol claims); ask questions in plain text, not popups; reuse existing components; never promise pixel-perfect matches to the references; Blender is not part of the plan.

### What was accomplished (steps 1-6 and the Threshold preset)
| # | Delivered | Key facts |
|---|---|---|
| 1 | `volumetric-atmosphere` effect | Depth-aware haze, ground mist, light beams from the light list, optional screen-space shafts; reduced-resolution march + temporal blend; ~6 ms at 1080p high |
| 2 | Light rig + choreography vocabulary | `beat-interval` condition (every Nth beat/bar/phrase), named light groups with stagger, authoring helpers (alternate, hit, phrase arrangement, ramp) |
| 3 | `cinematic-finish` + `reflective-floor` effects | Tone/grade/vignette/fringing/grain; virtual mirror floor plane with SSR reflections and light pools; volumetric can stop at and reflect in the floor; 5-pass chain ~9.3 ms high |
| 4 | Camera upgrades | Opt-in `camera.motion`: Catmull-Rom splines at constant speed, deterministic drift, bank, roll target, FOV rate limit, `repeatOffset` endless travel |
| 5 | Three.js spike (GO) | `three@0.186.1` pinned; Three draws straight into the engine framebuffer (`setRenderTargetFramebuffer` + XR-target flag), depth error ~2e-5, Three pass ~1 ms at 1080p; one shared renderer per GL context; minimal GL state guard; fixed light rig with calibrated intensity mapping; lazy chunks (three 190 KB gzip); works in real Electron; 10k-frame soak and 20 create/dispose cycles clean; reference code in `docs/cinema2-three-spike/` |
| - | Engine fix found by the spike | `Cinema2PerformanceDiagnostics` never re-requested the timer-query extension after a context restore, so every frame failed until reload (reproduced with no Three code); fixed (`handleContextLost/Restored`) and unit-tested |
| 6 | `three-scene` module | Lazy-loaded shipped GLB models (meshopt), asset registry by id (never URLs), reference-counted asset cache, placement from Scene Graph nodes, optional material parameters (color, emissive, roughness, metalness, environmentIntensity), quality tiers (low drops normal/AO maps), warm-up (`compileAsync`, one texture upload per frame), missing/corrupt asset -> diagnostic and skip; engine additions `reportGpuBytes` and `getDiagnostics`; internal "Three Model Reference" preset and a shipped 159 KB reference GLB; Three pass 0.8-1.4 ms; context loss recovers in ~6 frames |
| - | Threshold preset (`drmvyz.cinema2.threshold`) | 15 controls (4 Design parent groups), music map (kick, snare, beat, downbeat, phrase, build, drop, bass, highs, vocals), endless flight through corridor / hanging field / ring |
| - | Threshold batch A | Symmetric evenly spaced colonnade, centred camera, FOV 68, pure white screens, neutral grade |
| - | Threshold batch B | Housing towers with bezels/plinths/status lights lit analytically by their own screen (native, NOT Three: Threshold flies an endless camera-relative lap and `three-scene` places models at fixed nodes); vanishing-point glow; wet-concrete `grit` option on `reflective-floor`; bluer grade; 7 pairs at 13.3 spacing. 1080p whole chain: high 7.0-8.0 ms, medium 3.75, low 3.7 |
| 7 | Asset pipeline: native textures (7a) and build-time pipeline (7b) | DONE 2026-09-25 (see "#7 delivered" below). 7a: engine `Cinema2AssetTextureService` (`assets/`), reflective floor `surfaceTexture` + shipped 1024/512 px wet-concrete map, Threshold floor uses it: the water-like ripples became cracked, mottled concrete, zero measurable cost (6.9 vs 6.8 ms high, 2.0 ms low). 7b: `assets/cinema2/<id>/asset.json` records, `npm run assets:check` / `assets:build`, generated manifest + attribution list, both runtime registries filled from it |
| 10 (native half) | Engine shadow map for one key light | DONE 2026-09-25 (see "#10 delivered"). `Cinema2ShadowService` (2048 px high, 1024 medium, none on low), caster facet on module render providers, `volumetric-atmosphere` and `reflective-floor` sample it, Threshold's towers cast and Threshold has a shadow-casting key light: the towers now visibly block the light in the haze and the floor pool. Measured +0.4-0.5 ms at 1080p high, ~0 medium |
Test state: `npx vitest run src/components/vyzualz/cinema2` = the same 15 failing files / 40 failing tests that pre-date all this work (listed under "What exists today"), 604 passing after native #10; `npm run test:assets` 10 passing; lint and typecheck clean for touched files.

### Remaining issues and limits (known, not fixed)
- Threshold vs the reference: no billowing smoke (haze is smooth noise); the towers now block the key light (shafts read as shaded haze; still no hard diagonal beams, see "#10 delivered"); floor now uses the shipped wet-concrete map (cracks, mottling, broken reflections; the water look is largely gone) but has no puddle glare from the screens and the texture is a single generated tile; the screens do not light the floor or air (only the towers); housings are boxes without bolts/bevels/overhead structure; only 7 receding pairs; the hanging field and ring were not touched; low tier is dearer than before batch B (3.7 ms vs 1.9 ms, cause not investigated).
- `three-scene`: no Draco (meshopt or uncompressed only); one set of material overrides per module (no per-instance overrides); no skinned/animated meshes; no MSAA; layer `depthPolicy` is not passed to world providers (Three always tests and writes depth); quality variant chosen only when loading starts (a later low->high switch changes materials only and recompiles shaders once); environment is the procedural RoomEnvironment; no visible preset uses it yet.
- Engine: shadows exist for ONE light only (native effects + Threshold as the only caster; Three models neither cast nor receive, Threshold's own tower faces do not receive, no cascades); no runtime camera switching/cuts; precision degrades after hours of endless travel (effects reconstruct positions from camera matrices); the SVG extruder fails on hexagons (Spatial Reference preset fails 2 tests, pre-existing); scene `primitive` nodes draw nothing.
- Asset/installer: `three` adds ~190 KB gzip lazily; uncompressed 2k PBR sets cost ~50 MB GPU each (4k ~250 MB, above the 256 MB high budget), so texture compression (KTX2) is needed before real assets ship.

### Remaining steps and what each would add (#7 delivered; #8-#10 not started)
| Step | Purpose | What it fixes / adds (Threshold and beyond) | Notes and cautions |
|---|---|---|---|
| #7a native textures (DONE for the floor; smoke/noise and housing textures still open) | Engine `Cinema2AssetTextureService`: shipped images into GL textures with mipmaps, budgeted and disposed | Floor normal/roughness maps -> real cracked concrete, fewer "water" ripples (high confidence); tileable smoke/noise textures for the haze (medium); grime/normal maps for the Threshold housings (needs the native module renderer to accept textures too) | Needs the texture format decision (KTX2 recommended) and an installer budget |
| #7b asset pipeline (DONE except processing/KTX2/LODs, see "#7 delivered") | Build-time `assets:build` / `assets:check` (license allowlist, triangle/texture/GPU/installer budgets, attribution, generated manifest + `Cinema2AssetId` types) | Modelled housing detail (bevels, bolts, base rails), shippable skull/alien/rock assets, compressed textures | A Three-rendered housing cannot repeat along Threshold's endless lap unless `three-scene` learns lap repetition; the current hand-authored asset manifest gets replaced by the generated one |
| #8 PBR + environment lighting | Physical materials, shipped HDR environment, area lights for emissive panels | Floor glare/pools from the screens (could also be approximated natively), real environment reflections for screen-space misses, glossy skull/alien/wet rock; LESS important for Threshold's own housings (already lit analytically) | Area lights need Standard/Physical materials, no shadows from area lights; cost scales with light count |
| #9 instancing + distance detail | Generalise Threshold's instanced box renderer; Three `InstancedMesh`, LODs, impostors | More receding towers, overhead truss/cable detail, smoke drawn as textured billboards at the tower bases (with #7a), foliage/rocks for the jungle/cave | Native half needs no Three; per-tier instance budgets and deterministic seeded scatter |
| #10 limited shadows (native half DONE; Three consumption and module receivers still open) | One engine-owned shadow map for one key light shared by native modules, Three and effects | Towers visibly block the light shafts (the reference's signature look), occluded floor pools, grounded shadows | Threshold's key light would have to follow the camera along the endless flight (re-render the shadow map each frame; measure cost); volumetric march gets a shadow fetch per step |
Recommended order for the Threshold reference look (#7a and the native half of #10 are done):  the native half of #9, then #8 only if the floor glare still looks flat. Realistic expectation: composition, mood and main features (concrete floor, blocked beams, smoke) can converge;
offline-render quality (global illumination, simulated accumulated smoke) cannot be matched at 60 fps.

### Decisions still needed from the owner
Installer-size budget (proposal: at most +50 MB for the first wave); where source assets live (repo, Git LFS or an external bucket); texture format (KTX2 recommended, WebP simpler but ~4-8x more VRAM); whether to add runtime camera cuts; whether Threshold becomes the base for further stage presets. Details in "Open decisions for the owner".

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

## What exists today (verified 2026-09-25, after #1-#6 and Threshold batches A and B)
All under `src/components/vyzualz/cinema2/` unless noted. `three@0.186.1` (+ `@types/three@0.186.0`, exact pins) is used only through lazy `import()` in `modules/three/`; the `three-scene` module (#6) loads shipped GLB models with GLTFLoader + the meshopt decoder.
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
| 5 | Three.js SPIKE | Answers coexistence, color+depth handoff, cost | none | DONE (GO) |
| 6 | Three.js runtime module | Real 3D models in presets; zero cost when unused | #5 passes | DONE |
| 7 | Build-time asset pipeline (+ native texture support) | Small installer, GPU-safe models and textures | #6 (texture half: none) | DONE (7a floor texture + 7b checks; see "#7 delivered") |
| 8 | PBR + environment lighting | Glossy skull/alien, wet rock/metal, panel-lit surroundings | #6 | NOT STARTED |
| 9 | Instancing, distance detail | Dense foliage/rocks/housings within budget | #6 (native half: none) | NOT STARTED |
| 10 | Limited shadows (one key light) | Grounding, shadowed beams (the fix for light passing through occluders) | #6, #8 (native half: #1) | NATIVE HALF DONE (Three half open) |

Preset order it unlocks: Stage/LED hall (Threshold is the first consumer of #1-#4) -> Skull -> Cave -> Alien -> Jungle.
Recommended order from here (2026-09-25; (a), (b) and (c) are done): (a) native Threshold refinement, high-confidence batch (DONE, see "Threshold refinement plan"); (b) #7a native texture
support + asset pipeline skeleton (DONE, unblocks floor texture and smoke without Three.js); (c) #5 spike (DONE, GO); (d) #6-#10 as below. Reason: the biggest remaining
Threshold gaps are geometry/tuning (native) and assets (#7), and #5 is a go/no-go gate whose result may change #6-#10.

## Working rules with this owner
- Do not commit; the owner commits. Do not use `git stash` on their working tree (an interrupted stash once hid their changes).
- Verify UI/graphics claims in a real browser before asserting them; ask before guessing scope/design.
- Reuse existing components/patterns; keep changes proportional; no exhaustive test runs for mockup-scoped work.
- Supabase CLI is correctly logged in and linked (migration 0033 already applied).

## Delivered work (#1-#4 and Threshold)
Original design intent for #1: an effect/render-graph pass raymarching the view ray with depth + light list; its depth input accepts ANY module's depth (so a
future Three.js module works); without depth it degrades to unoccluded haze. Delivered as below.

### #1 Volumetric atmosphere — DELIVERED (2026-09-25)
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

### #2 Performance light rig + choreography vocabulary — DELIVERED (2026-09-25)
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

### #3 Cinematic finishing + reflective floor — DELIVERED (2026-09-25)
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

### #4 Camera upgrades — DELIVERED (2026-09-25)
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

### Threshold preset (first consumer of #1-#4) — DELIVERED (2026-09-25)
A visible first-party keeper, `drmvyz.cinema2.threshold` ("Threshold"), built to test whether the native stack reaches the monolith reference renders.
- Files: `presets/Cinema2ThresholdPreset.ts`, `modules/Cinema2ThresholdNativeModule.ts` (instanced monolith renderer), `modules/threshold/` (`Layout`,
  `ReactiveState`, `Renderer`), `__tests__/Cinema2Threshold.test.ts` (18 tests when first delivered, 22 after batch A). Extra platform changes made for it: camera path `repeatOffset` (endless travel
  through a repeating environment, absolute clamp lifted on the travel axis), volumetric `ambientHeight` (ambient glow that settles low), mock-GL
  `drawElementsInstanced`.
- Scenes (one 180-unit lap, repeated endlessly and seamlessly): corridor of standing monoliths, hanging-monolith field (camera rises above the mist),
  inward-facing ring of tilted panels (camera passes through and looks up). One spline flight, low and forward (first delivered as 80 s per lap with `gentle` motion; batch A changed it to 96 s, `steady` motion, centred, FOV 68).
- Controls (15 + the shared quality control): Master Controls - Master Intensity, Master Reactivity, BPM Sync, Camera Motion; Design - Panel Brightness,
  Fog Density, Corridor Width; Effects - Floor Reflection, Bloom, Light Shafts, Cinematic Finish; Palette - Primary, Accent, Atmosphere, Void (the contract needs four
  independent colors, so Void = background/floor/body is the fourth). Master Intensity drives the module and the bloom/atmosphere mix; Reactivity gates every music
  response and is the route strength for the choreography rules.
- Music map: kick -> support screens; snare -> alternate rows; beat -> rows alternate every 2 beats; downbeat -> sweep down the aisle + camera lean + shaft/bloom
  swell; phrase -> leading side swaps; build/energy -> how many screens are open; drop -> whole set flashes; bass -> fog swell; highs -> LED shimmer; vocals -> support
  screens step back. BPM Sync locks idle breathing, LED shimmer and sweep speed to the tempo (real consumer, tested).
- Measured in real Chrome on the M3 Pro (1080p, whole 5-pass frame): high 6.9 ms, medium 3.3 ms, low 1.9 ms as first delivered (after batch A: 8.7 / 3.3 / 1.9).
- Look tuning lessons (keep for the stage/LED preset): mist density must be scaled to the scene (a value carried over from a 20-unit scene was ~100x too thick and
  drowned the frame); screen-space shafts above ~0.3 smear every bright pixel like motion blur; the existing bloom shows echo ghosts at radius >= 4 on hard bright edges
  (use radius 2); a uniform ambient haze washes the sky, so use `ambientHeight`.
- Known limits vs. the references: no sculpted cloud volumes, no floor texture (the floor is a smooth mirror), no catwalk/truss/ring-structure detail, fog glow around the
  screens comes from bloom + shafts + low ambient haze (not from per-panel lights); low-resolution volumetric edges show slight stair-stepping on the brightest panels; SSR
  leaves some dotted noise on the floor where bright reflections are thin; the ring reads as tall fins, not the radial ring hall; the fine LED grid fades with distance to
  avoid moire.

## Detailed plan and results: steps #5-#10 (#5, #6, #7 and native #10 delivered; #8 and #9 not started)
Common rules for every step: opt-in per preset and zero cost when unused; honor `Cinema2RenderQualityLevel` (low/medium/high) and the GPU budgets (96/160/256 MB in
`runtime/Cinema2PerformanceDiagnostics.ts`); deterministic (no wall-clock randomness; use the engine random service / seeded generators); dispose everything
(verify with the mock-GL create/delete counters, as `Cinema2Threshold.test.ts` does); verify visually in a real browser before claiming a result; keep the
existing failing-test set unchanged; the owner commits.

### #5 Three.js spike (go/no-go gate) — DONE 2026-09-25: GO (all pass criteria met)
Question: can Three.js live inside the Cinema 2.0 render graph? Answer: yes, with one handoff design, one shared renderer per GL context and a GL state guard
(all measured below). Reference code is kept in `docs/cinema2-three-spike/` (see its README); nothing in `src/` uses Three yet. The only repo change is the pinned
dependency `three@0.186.1` (exact, in `package.json`); `@types/three` is NOT installed yet (add it in #6 so `tsc` can check the module).
Test setup: a throwaway `three-spike` module inside a clone of the Atmosphere Reference preset (scene -> floor -> volumetric -> bloom -> finish), one 100k-triangle
torus knot with a 3-map 2k PBR set (albedo/normal/ORM) + PMREM environment + a glossy sphere, emissive sphere and a box, real engine camera/lights/nodes.
Measured on the owner's M3 Pro, real Chrome (ANGLE Metal) and real Electron 43.1 (sandboxed window, a mirror of the production `drmvyz-app://` protocol handler).

| # | Question | Result |
|---|---|---|
| 1 | Size / lazy | Three is separate lazy chunks in a production `vite build`: `three` 747 KB raw / 190 KB gzip, GLTFLoader 47 KB / 14 KB gzip, RoomEnvironment 2 KB. Verified in the browser: none of them is requested until `import('three')` runs (28 ms to load all three). The engine chunk contains no Three code. |
| 2 | Shared context | `new WebGLRenderer({ canvas, context: gl })` on the engine context works. Three changes GL state (framebuffer, depth test/func, clear color, textures, program, array buffer...). `renderer.resetState()` before and after is NOT enough on its own: it left the clear color, depth state and framebuffer wrong. A small guard fixes it (see decisions). 10,000-frame soak with the guard: 0 GL errors, live GL object counts identical at start and end, frame cost flat (5.7-6.4 ms at 720p, no drift), output vs frame 40 differs by 0.72/255 (control run without Three: 0.70, i.e. haze animation, not state corruption). |
| 3 | Color + depth handoff | THREE options tested, all correct. **Primary: draw straight into the engine framebuffer** (`renderer.setRenderTargetFramebuffer(rt, engineFb)` + `rt.isXRRenderTarget = true` + `rt.texture.colorSpace = SRGBColorSpace`, so Three encodes display-referred sRGB itself; `NoToneMapping`). Zero copy, no extra memory, Three writes the engine's depth attachment directly. Depth error vs an analytic sphere: <= 2e-5 (24-bit quantization) so `reflective-floor` and `volumetric-atmosphere` see correct depth (floor reflections and haze occlusion visible in the frames). **Fallback: own half-float RT + depth texture, then a fullscreen copy writing `gl_FragDepth`** (works, identical image, ~0.4 ms slower, ~24 MB extra at 1080p, uses `renderer.properties` internals). A third route (`setRenderTargetTextures` with `ExternalTexture`) exists in 0.186 but was not needed. The XR flag/`setRenderTargetFramebuffer` path is a semi-internal API: pin the version and keep a contract test (probe sphere color + depth, like the spike's `calibrate`/`depthCheck`) so an upgrade fails loudly. Disposing the wrapper target does not delete the engine framebuffer (checked). |
| 4 | Camera | `projectionMatrix`, `viewMatrix` copied into a `PerspectiveCamera` with `matrixAutoUpdate` and `matrixWorldAutoUpdate` off (`matrixWorld` = inverse of the view matrix). Depth matches the engine's near/far (item 3). |
| 5 | Lights | Documented mapping (calibrated with a white diffuse sphere, standalone): engine ambient `intensity` -> Three `AmbientLight` intensity x PI; directional x PI; spot/point `intensity` -> `intensity x PI x (range/2)^2` with `distance = range`, `decay = 2`, angle = outer cone, `penumbra = 1 - inner/outer`; colors converted from sRGB to linear (`Color.setRGB(..., SRGBColorSpace)`). Measured: unlit sRGB 0.5 grey -> 128; ambient 1 -> 253, 0.5 -> 186; directional 1 -> 252; a spot at half range reads ~88% of nominal because Three windows the light by range. Use a FIXED rig (1 ambient + N spots) and set unused lights to intensity 0: adding/removing lights recompiles shaders. |
| 6 | Robustness | 20 create/dispose cycles of the whole runtime: live GL objects flat (constant 6 textures, 4 framebuffers, 1 buffer, 1 renderbuffer for the shared renderer + environment), 0 GL errors, in Chrome and Electron. Context loss + restore: the engine disposes and recreates the module, Three re-uploads, image recovers including the reflections (once GPU-generated resources are rebuilt, see findings). |
| 7 | Memory | An estimate from a scene traversal (geometry attribute bytes + texture width x height x 4 x 1.34 + render targets + environment) gives ~70 MB for the reference model (uncompressed 2k x 3 maps ~ 50 MB, 100k-triangle geometry ~ 6 MB) and ~264 MB with 4k maps, above the 256 MB high budget. The engine cannot see it yet: `Cinema2ModuleResourceFacet.acquire` has no byte reporting and `estimatedGpuMemoryBytes` (Resource Manager, 43.5 MB for the 1080p chain) only counts engine targets. #6 must add a byte-reporting hook. |
| 8 | Cost (1080p, whole chain, ms) | Three pass alone (sync readPixels bracket, includes CPU submit): 0.9-1.4 ms in every case (100k tris far away 0.8-1.2; hero filling the frame 100k 1.1, 300k 1.4, 100k with 4k maps 1.1; RT+copy fallback 1.3-1.6). Whole frame: engine chain alone 8.8-9.7 (high), with Three 10-11.3. Low/medium tiers 0.66-0.74 ms for the Three pass. Budget was <= 6 ms. First frame after the model is set up is a 80-150 ms hitch (shader compile + texture/geometry upload). Timer noise is about +-1 ms. |
| 9 | glTF offline | GLTFLoader with local decoders works in Chrome and in Electron through the production-style custom protocol (sandbox on): plain GLB, meshopt (decoder is one 29 KB inline module, no worker, no file paths) and Draco (`draco_wasm_wrapper.js` 58 KB + `draco_decoder.wasm` 192 KB copied locally, decoded in a worker; skip the 512 KB asm.js fallback). Reference GLB (100k tris + 3 PNG 2k maps): 7.66 MB plain, 6.12 MB meshopt, 5.72 MB Draco; decode + parse 31-51 ms (meshopt/plain) and 45-85 ms (Draco); triangle counts preserved (99,736), rendered images identical. |

Findings that shape #6 (all reproducible with the reference code):
- `WebGLRenderer.dispose()` does NOT delete the 3 scratch framebuffers and 5 textures it creates (WebGLState empty textures + the shared empty texture) and
  `PMREMGenerator` leaves 1 GL buffer per use (0.186): a renderer or PMREM per preset switch leaks steadily. So: ONE renderer per GL context for the context's life,
  the environment generated once per renderer and cached, and only scene content (geometry, materials, textures, targets) disposed per module.
- After context loss, GPU-generated resources (the PMREM environment, render targets) come back EMPTY (the chrome sphere reflected black until the environment was
  rebuilt). Drop the shared renderer and its caches on `webglcontextlost` and rebuild on demand; CPU-side decoded model data can be kept.
- Three's own `webglcontextlost/restored` listeners are attached to the canvas; the engine's handlers run first and dispose/recreate the module, which is fine.
- Engine targets are plain rgba8 (no hardware sRGB write), so any calibration target must be created RGBA8, or colors get encoded twice.
- No MSAA (same as the rest of the chain); edges alias unless a later step adds an AA pass.
- Not tested: skinned/animated meshes, transmission, shadow maps (that is #10), transparent sorting against engine effects, more than one Three module, very long
  (hours) flights, a real sculpted asset (the hero was a procedural torus knot with procedural maps, so overdraw and texture detail are optimistic).

Pre-existing engine bug found by the spike (reproduced with NO Three code) - FIXED 2026-09-25: `Cinema2PerformanceDiagnostics` requested
`EXT_disjoint_timer_query_webgl2` once in its constructor and never again, so after a WebGL context restore its timer queries raised INVALID_ENUM, the sticky error made
render-target creation fail ("could not be resolved ... reported WebGL errors") and EVERY frame failed until the runtime was recreated (60 of 60 frames in a real-Chrome
lose/restore test on the Atmosphere Reference preset). Fix: `handleContextLost()` (drop the extension and stale query handles) and `handleContextRestored()` (request the
extension again), called from the runtime's context-loss cleanup list and restore sequence in `runtime/Cinema2Runtime.ts`. Verified in real Chrome: without the fix 60/60
frames fail with GL error 0x500; with it 0 failed frames, no GL errors, timing supported again. New unit test in `__tests__/Cinema2PerformanceDiagnostics.test.ts`
(Cinema2 folder: same 15 failing files / 40 failing tests as before, 558 passing).

Decision: GO. #6 uses (in order): shared renderer per context; external-framebuffer handoff (RT+copy kept as the documented fallback if a future Three version breaks
the XR-flag path); `resetState()` + a minimal GL guard around every Three pass (query only framebuffers, viewport, scissor, blend/depth/cull enables, depth func and
mask, color mask, clear color, VAO and program - about 0.3-0.4 ms; a full 150-parameter capture costs ~1.4 ms and is not needed; restore the bound framebuffers,
unbind textures 0-15 and the array buffer); fixed light rig mapped per frame; meshopt as the default geometry compression (Draco supported but adds a worker and two
files); precompile (`compileAsync`) and pre-upload during the loading state so the first visible frame does not hitch; no tone mapping in Three (the finish effect grades).
Implication for #7: uncompressed 2k PBR sets are ~50 MB each of GPU memory and 4k sets ~250 MB, so KTX2/Basis (GPU-compressed, ~4-8x smaller in VRAM) is now clearly
preferable to WebP (which decodes to full RGBA) for anything but tiny textures; budget every shipped set against the 96/160/256 MB tiers.

### #6 Three.js runtime module — DELIVERED 2026-09-25
A `three-scene` module type that draws shipped glTF models with Three.js inside the Cinema 2.0 render graph. Cinema 2.0 keeps the camera, lights, audio and choreography; the module only turns asset ids into pixels.
Files (all under `src/components/vyzualz/cinema2/`): `modules/Cinema2ThreeSceneModule.ts` (module definition, state machine, config validation, parameters);
`modules/three/` = `Cinema2ThreeLibrary.ts` (lazy `import()` of three + GLTFLoader + meshopt + RoomEnvironment; failed loads are not cached), `Cinema2ThreeRendererHost.ts` (ONE renderer per GL context and a
cached PMREM environment, dropped on context loss), `Cinema2GlStateGuard.ts` (the minimal state guard), `Cinema2ThreeCameraLightMapping.ts` (camera copy + fixed light pool with the calibrated
intensity mapping), `Cinema2ThreeAssetRegistry.ts` / `Cinema2ThreeAssetManifest.ts` (asset ids -> app-origin URLs + license record; the manifest is hand-authored until #7 generates it),
`Cinema2ThreeAssetCache.ts` (reference-counted decoded models; GPU freed on last release, decoded data kept in a 4-entry idle list), `Cinema2ThreeSceneBridge.ts` (per-module scene, material clones and overrides, quality tiers,
warm-up, the draw into the engine framebuffer). Preset: `presets/Cinema2ThreeModelReferencePreset.ts` (`drmvyz.cinema2.three-model-reference`, role reference, tagged `internal`, registered in the first-party catalog).
Shipped asset: `public/cinema2/models/reference-torus-knot.glb` (24k triangles, meshopt, 159 KB, generated in-house, license `generated-in-house`). Tests: `__tests__/Cinema2ThreeScene.test.ts` (16).
Engine contract additions (small, additive): `Cinema2ModuleResourceFacet.reportGpuBytes(bytes)` + `estimatedGpuBytes` in the resource snapshot; optional `Cinema2ModuleInstance.getDiagnostics()` for non-fatal
problems (the module stays `active`); the module runtime snapshot gained `estimatedGpuBytes` and `degradedModuleCount`; the Runtime status message now says when module memory pushes the total over the quality policy budget, or
when a module skips an asset it could not load. Five test doubles of the resource facet were updated. New dev dependency `@types/three@0.186.0` (exact) next to `three@0.186.1`.
How it behaves: config `instances: [{ asset: "<asset id>", node?: "<Scene Graph node id>" }]` (unknown ids fail preset compile); nothing loads until the first render of a preset containing the module; state `idle -> loading -> building -> ready | failed`;
while not ready it draws nothing; warm-up takes one step per frame (environment, then one texture upload per frame, then `compileAsync`) so the first visible frame does not hitch; a missing/corrupt asset (checked with a GLB magic-number test, because a
missing file can come back as an HTML fallback page with status 200) produces a diagnostic and the instance is skipped while the rest render. Placement follows the Scene Graph node's world matrix (choreography can move it). Bindable module parameters,
all optional (missing = the asset's own value): `color` (multiplies the base color), `emissive`, `emissiveIntensity`, `roughness`, `metalness`, `environmentIntensity`. It never owns camera, lights or audio.
Quality tiers: low drops normal and ambient-occlusion maps (and does not upload them); medium/high use the full set; image-based lighting stays on for every tier (metal without an environment renders almost black, and the lookup cost was not measurable). Per-tier model/texture
variants are supported by the registry (`variants`) but the variant is chosen once when loading starts (quality changes later switch the material tier only).
Verified in real Chrome on the M3 Pro (and the asset/protocol path in real Electron 43): the reference scene renders four shipped knots placed on the Scene Graph nodes, lit by the cyan/amber/magenta spots, reflected in the wet floor and haze, with the Model Roughness control visibly changing
the material (0.28 glossy vs 0.95 matte); ready 6-10 frames (120-350 ms) after the first render; 1080p whole frame high 9.1 ms, medium 4.8-5.5 ms, low 2.4-3.0 ms; Three pass alone 0.8-1.4 ms (a textured 100k-triangle model x4 instances: 1.35 ms high, 1.16 medium, 0.98 low; its GPU estimate 70 MB high vs 48 MB low,
against 43.5 MB for the engine's own targets); failure paths (missing file, non-GLB file, one of two assets missing) show a diagnostic and `Cinema 2.0 is still running while a visual module skips an asset it could not load.` with 0 failed passes; 20 create/dispose cycles: live GL objects flat at the shared-renderer baseline
(1 buffer, 6 textures, 4 framebuffers, 1 renderbuffer); context loss and restore: the engine recreates the module, the model and reflections come back within 6 frames with 0 failed frames (this needed the #5 timer-query fix). Real app production build: Three is in separate chunks (three 747 KB raw / 190 KB gzip, GLTFLoader 47 KB / 14 KB,
meshopt decoder 26 KB / 7 KB, RoomEnvironment 2 KB); the entry chunk contains no Three code and `index.html` references only the entry; the model is copied to `dist/cinema2/models/`; in Electron the GLB (correct magic bytes) and the Three chunk load through the `drmvyz-app://` protocol.
Cinema2 test folder: same 15 failing files / 40 failing tests as before, 574 passing (16 new); lint and typecheck clean for the new and touched files.
Known limits / not done: Draco is not wired (meshopt or uncompressed only; the spike showed Draco works and would need the decoder files shipped); every instance of one module shares the same material overrides (no per-instance overrides); no skinned or animated meshes; no MSAA; layer `depthPolicy` is not passed to
world providers, so Three always tests and writes depth; quality-driven variants are chosen only at load time; a mid-run switch from low to medium/high recompiles shaders (one hitch); the environment is the procedural RoomEnvironment (a shipped HDR comes with #8); the reference asset has no textures, so the texture tier saving was measured with a textured spike model only;
the Three module has no visible preset yet (Three Model Reference is internal): the first real consumers are the skull/cave/alien presets.

### #7 Build-time asset pipeline (+ native texture support) — DELIVERED 2026-09-25 (original plan kept below; what was built and what was deferred is in "#7 delivered")
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

### #7 delivered (2026-09-25)
Owner decisions were not answered before the work started, so these defaults were used and are all easy to change: WebP/PNG textures (no KTX2 yet), sources in the repo under `assets/cinema2/`, installer budget 50 MB (`DEFAULT_BUDGETS.installerBytes`, overridable in `assets/cinema2/budgets.json`).
7a - native textures:
- `assets/Cinema2AssetTextureService.ts` (engine-owned, created by the runtime): `acquire(assetId, quality)` returns a handle (`status` loading | ready | failed, `texture`, `release()`); one GL texture per (asset, quality variant), reference counted, deleted with the last handle. Fetch + `createImageBitmap(premultiplyAlpha 'none', colorSpaceConversion 'none')`, uploaded with mipmaps, REPEAT wrap, anisotropy up to 8, RGBA8 for data layouts and SRGB8_ALPHA8 for `color`. Rejects non-image content types (the app protocol answers unknown paths with the index.html fallback and status 200), enforces a budget (20% of the tier's GPU budget, fed by the runtime), drops GL objects on context loss and re-uploads for surviving owners after restore, ignores loads that finish after release, loss or dispose. The Runtime status message covers "above GPU budget because of loaded assets" (models + textures) and "an effect skips a texture it could not load"; `Cinema2Runtime.getTextureServiceSnapshot()` exposes diagnostics.
- `assets/Cinema2TextureAssetRegistry.ts` (ids never URLs, app-origin paths only, license required, per-quality variants, `layout` says what the channels mean).
- Effects receive `textures` in `Cinema2EffectCreateContext` (optional so hosts without one still work).
- `reflective-floor` gained `surfaceTexture` (asset id, layout `surface-normal-crack-roughness`), `surfaceTextureScale` (world units per tile, 0.5-60) and `surfaceTextureStrength` (0-1). Two samples at unrelated scales/rotations hide the repeat; the map's normals replace the procedural fine ripples, its crack mask darkens/dulls the mirror, its roughness drives reflection blur; it fades in over 0.6 s once loaded; a missing/failed texture leaves the procedural look. `validate` rejects unknown ids and wrong layouts. Threshold now uses it (`surfaceTexture: cinema2-wet-concrete`, scale 6).
- Shipped texture `cinema2-wet-concrete`: generated in house by `scripts/cinema2-assets/generate-wet-concrete.mjs` (periodic value noise + domain-warped Voronoi-border cracks, sparse and broken), stored as lossless WebP (1024 px 1.09 MB, 512 px 0.44 MB for the low tier; GPU 5.6 MB / 1.4 MB). Lossless because the channels are data. Verified bit-exact against the PNG source through the production `drmvyz-app://` protocol in real Electron (content-type image/webp).
7b - pipeline (no in-app optimizer, everything build-time):
- `assets/cinema2/<id>/asset.json` records (README in that folder documents every field) for the two shipped assets (`cinema2-wet-concrete`, `cinema2-reference-torus-knot`).
- `npm run assets:check` fails on: missing/invalid asset.json, bad id or folder mismatch, duplicate id, unknown kind/layout/compression, missing license, license not on the allowlist (CC0, CC-BY-4.0/3.0, MIT, Apache-2.0, generated-in-house), missing attribution (all but CC0/in-house) or origin, missing/invalid/shared/out-of-tree files, file over 8 MB, texture over 2048 px (also embedded ones), model over 150k triangles, per-asset GPU estimate over the tier's asset budget (20% of 96/160/256 MB), total over the installer budget, stale generated files. `npm run assets:build` regenerates `assets/Cinema2AssetManifest.generated.ts` (records, per-tier GPU estimate, `Cinema2AssetId` union) and `public/cinema2/attributions.json`. `assets:check` and `test:assets` run in `verify:fast`.
- Both runtime registries (`Cinema2ThreeAssetManifest.ts`, `Cinema2TextureAssetManifest.ts`) are now filled from the generated manifest; nothing is registered by hand. A vitest checks that no first-party preset references an unknown asset or exceeds a tier's asset GPU budget.
- Tests: `scripts/cinema2-assets/assets-core.test.mjs` (10 tests, deliberately bad fixtures for every violation above), `__tests__/Cinema2TextureAssets.test.ts` (13 tests: registry, service lifecycle/budget/context loss, floor integration, manifest and per-preset budgets).
Measured (real Chrome, M3 Pro, 1080p, Threshold whole chain, synchronous readPixels, no idle waits): high 6.9 ms with the texture vs 6.8 ms without, low 2.0 ms both; recovery after context loss re-uploads the texture; 20 create/dispose style checks: texture entries and bytes return to 0 after `runtime.dispose()`.
Not done / deferred (need owner input or a first real asset): KTX2/Basis (needs the transcoder decision; the service and record shape already carry a `ktx2` size estimate); texture resize/format conversion and glTF-Transform processing as build steps (the two shipped assets were produced by generator scripts, so `assets:build` validates and generates but does not yet convert); hashed file names; LOD generation (belongs with #9); smoke/noise textures for `volumetric-atmosphere`; textures for the Threshold housings (the native module renderer does not accept textures yet). WebP conversion of the concrete texture used `sharp` from a scratch folder, it is not a repo dependency.

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

### #10 Limited shadows (one key light) — NATIVE HALF DELIVERED 2026-09-25 (see "#10 delivered"; original plan below)
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

### #10 delivered (native half, 2026-09-25)
Design: shadows are an engine resource. What exists:
- `runtime/Cinema2ShadowService.ts` (created by the runtime, passed to the render graph executor): owns ONE depth texture (DEPTH_COMPONENT24, hardware compare, so a single tap is already 2x2 filtered) + framebuffer, 2048 px on high (16 MB), 1024 on medium (4 MB), none on low; counted in the runtime's "above GPU budget because of loaded assets" check; released when there is no shadow-casting light or no caster; forgotten on context loss and rebuilt after restore; failures degrade to "no shadows" with a diagnostic. It selects the first light with `light.config.castShadow` that is directional or spot and has intensity > 0. `fitLight` builds the matrices in double precision: directional = an orthographic square (`shadowExtent` half-size, `shadowDepth` range) centred `shadowFocusAhead` units ahead of the camera and snapped to whole texels (no shimmer; the depth axis is snapped coarsely so a moving camera keeps one matrix for many frames); spot = perspective from the cone and `range`. Light config: `castShadow`, `shadowExtent` (default 40), `shadowDepth` (160), `shadowFocusAhead` (0.5 * extent), `shadowBias` (world units, 0.15), `shadowSoftness` (filter radius in texels, 1; 0 = one tap). Resolved into `Cinema2ResolvedLightFrame.shadow`.
- Caster facet: `Cinema2ModuleRenderPassProvider.renderShadow(ctx)` (+ `dynamicShadowCaster`). The executor refreshes the map once per frame before any pass; the service re-renders only when the light matrix changes or a caster is dynamic (Threshold is dynamic because its field/ring fade with the camera), sets up depth-only state (colour mask off, polygon offset, no culling), isolates a failing caster and restores the GL state. `lightViewProjection` arrives in world space and double precision; Threshold folds the camera translation into it, exactly like its camera-relative placement.
- Consumers: effects and modules get `shadow` in their execution context. `volumetric-atmosphere` multiplies the shadow-casting light's scatter by the map's visibility at every march sample (a shadowed directional light is no longer held back to 0.35); `reflective-floor` multiplies that light's pool and specular. Both take `shadowStrength` (0-1, default 1). Shared GLSL/uniform upload in `effects/Cinema2ShadowSampling.ts`; each effect owns a 1x1 fallback depth-compare texture so the shadow sampler is always valid.
- Threshold: a directional key light `shadow-key` (cool, intensity 0.9, travelling down the aisle toward the camera, high and from the left; extent 70, depth 200, focus 45 ahead, bias 0.25). Its towers cast via a depth-only instanced pass that mirrors the main vertex stage (corridor width shift, camera-relative laps, field dissolve). The preset now declares the `lighting` capability.
Measured in real Chrome, M3 Pro, 1080p, whole Threshold chain: high 8.2-8.3 ms with shadows vs 7.8 ms with the light unshadowed, medium 4.1 vs 4.2, low 2.1 (no map). A/B frames: without the map the key light floods the haze white; with it the towers block the light and the corridor stays dark with light streaming down the aisle. Floor pool A/B (poolIntensity 6): unshadowed the whole floor washes white; shadowed the tower shadows keep the floor dark. No shadow acne visible; context loss drops the map to 0 bytes and rebuilds it (130 renders after restore). Tests: `__tests__/Cinema2Shadows.test.ts` (12: fitting/snapping/spot, lighting-frame settings, service lifecycle/tiers/caching/loss), consumer tests in `Cinema2FinishAndFloor.test.ts`, Threshold production-path test (6 instanced draws high/medium, 3 low, GL objects balanced). Cinema2 folder: same 15 failing files / 40 tests as before, 604 passing.
Look-tuning lesson: with the camera on the corridor axis, light travelling across the aisle through the 2.8-unit gaps between towers reads as full-frame veils, and light from above floods; light travelling down the aisle toward the camera (from the far end, high, from one side) gave the structured, smoke-like shafts.
Not done: Three models cast/receive (needs `three-scene` to draw depth into the engine map and a shadow-aware material); Threshold's tower faces do not receive the key light; only one shadowed light; no cascades; static-caster caching is implemented but no shipped module uses it yet (Threshold is dynamic); the volumetric march pays a filtered fetch (5 taps at softness > 0) per step, cut to one tap with `shadowSoftness: 0` if a weaker machine needs it.

## Threshold refinement plan (native work; batches A and B applied, remaining items map to #7-#10 in the STATUS SUMMARY)
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

### Refinement batch A (differences 1, 2, 3, 4, 6, 13, 14-fringing/grain) - APPLIED 2026-09-25
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

### Refinement batch B (differences 5, 7-partial, 10, 11, 9-partial) - APPLIED 2026-09-25
Owner asked whether #5/#6 (Three.js) could bring Threshold to the reference. Decision, with reasons: the housing look is mostly LIGHTING (the screens lighting their own towers), not geometry, and Threshold flies an endless repeating lap in camera-relative
coordinates; `three-scene` places models at fixed Scene Graph nodes (no lap repetition) and lights only from the engine light list (static world lights), so Three would have needed lap-repeat and following lights first, and would have lost the analytic
"panel light falls on its own housing" that the native renderer can compute per instance. So the housing work was done natively in Threshold's instanced renderer; `three-scene` stays the right tool for sculpted assets (skull, alien, rocks).
What changed (Threshold only, plus one opt-in floor feature):
- Layout (`modules/threshold/Cinema2ThresholdLayout.ts`): the corridor is now 7 mirrored pairs at 13.3 spacing (was 5 at 20). Each screen sits (raised to y 19.5 on a plinth) in front of a 10.5 x 46 x 11 housing tower whose front face touches the screen's back, with a 4-bar bezel
  standing proud of the screen, a plinth reaching into the aisle, and two small status lights (new roles 3 = housing, 4 = bezel/plinth metal; role 2 lights). Same row/rank/side as the screen, so housings react with their screen.
- Shader (`Cinema2ThresholdRenderer.ts`): housings and bezels are dark weathered concrete (soft vertical streaks) lit by their own screen's emission, falling off with distance from the screen window (analytic spill, so it follows the music-driven brightness), with thin
  world-width edge highlights near the light. Corridor Width now shifts every corridor piece by the same amount so a housing stays attached to its screen. Screens dim less when near (nearDim ramp 9-28 units, was 14-44).
- Vanishing-point glow (difference 10): a depth-tested additive glow/cone at the corridor's far end (drawn behind everything, no depth write), strong while a corridor is ahead, faded out as the flight passes the last pair and back in for the next lap; per-lap `u_fieldVisibility` keeps the
  hanging field from showing as a dark skyline against the glow (it dissolves in as the camera leaves the corridor), and field/ring pieces dissolve beyond ~100 units.
- Floor (difference 11): the `reflective-floor` effect gained opt-in `grit` (0-1, default 0 = mirror), `gritScale` and `baseLift`: world-anchored damp patches, a rippled normal that breaks reflections into streaks, dark cracks and lightness variation. Threshold authors grit 0.8, scale 5, lift 3.5.
- Grade/atmosphere: bluer shadow tint (tintAmount 0.22), grain 0.025, shafts 0.26 (length 0.55, origin at the horizon), mist 0.11 / height 3.6, noise 0.9.
Measured on the M3 Pro, 1080p whole chain: high 7.0-8.0 ms, medium 3.75, low 3.7 (was 8.7 / 3.3 / 1.9 before batch B; the low-tier increase was not investigated - likely the extra housing instances and the full-screen glow pass, which do not shrink with the render-target scale as much as the effects do). Tests: Threshold suite updated (colonnade + new housing test), floor grit test added; Cinema2 folder unchanged failing set, 576 passing.
Still different from the reference: real smoke wisps (the mist is smooth noise), diagonal light shafts occluded by the towers (#10), true wet-concrete texture and puddle glare (#7a/#8), the panels are lit-but-flat (no glass/LED grid at distance), the floor reads a little like water at the flyby, the hanging field and ring are unchanged.

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
1. Installer-size budget for shipped 3D assets (50 MB default in `assets/cinema2/budgets.json` / `DEFAULT_BUDGETS`), and where source assets are stored (repo vs Git LFS vs external bucket; repo in use). Confirm or change before real third-party assets arrive.
2. Texture format: KTX2/Basis (needs a transcoder) vs WebP. #7 shipped with lossless WebP/PNG; KTX2 is the change to make before any 2k+ texture set ships.
3. (Settled: #7a was done after the spike; the floor texture shipped.)
4. Whether to add runtime camera switching / hard shot cuts (a small feature: choreography switches between authored cameras on a musical event). Not built.
5. Whether Threshold should become the stage/LED-hall base for further presets (e.g. the water-floor variant of the reference) or stay a one-off test.
6. Reference image files are not in the repo: `~/Downloads/cinema2-3d-reference-images/` (re-attach if missing); the Threshold reference frames were attached in chat only.

## Where we are and what happens next
DONE: #1-#4, the Threshold preset with refinement batches A and B, the #5 Three.js spike (GO), the context-restore engine fix, #6 (`three-scene`), #7 (texture service, floor surface texture, asset pipeline) and the native half of #10 (engine shadow map, volumetric and floor consumers, Threshold casting into it). The owner commits; the #10 files were uncommitted when this was written.
NEXT (recommended): the native half of #9 (more receding towers, overhead structure and smoke billboards using the texture service, per-tier instance budgets, seeded scatter; the file reading for this is done: Threshold layout/renderer/module are small and self-contained), smoke/noise textures for the volumetric haze, then #8 only if the floor glare still looks flat. Open owner decisions: installer budget (50 MB default in force), source-asset location (repo in force), KTX2 vs WebP (WebP in force), runtime camera cuts, whether Threshold becomes the base for more stage presets.
Keep verifying in a real browser, keep the baseline failing set unchanged (15 files / 40 tests), do not commit, never `git stash`.
