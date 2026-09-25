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
  instancing or shadows. UNVERIFIED: whether simple primitives (panels, truss, floor) can be drawn — check `Cinema2SceneGraph.ts`
  (`kind: 'primitive'`) before planning the stage preset.
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

## Current task
Start #1 (volumetric atmosphere) and, in parallel, #2–#4 design; #5 spike may run alongside. First step: read the contracts above,
confirm the two UNVERIFIED items, then propose a concrete design for #1 before coding.
