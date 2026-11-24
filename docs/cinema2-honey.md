# HONEY | Cinema 2.0 native preset

## P01: native foundation and selectable static geometry

Historical P01 report: the arrival of the P02 prompt supplies human approval of P01. Its unverified production gate has not retroactively passed. Current P02 report follows below. P01 geometry/resource figures and neutral shader descriptions below are historical, superseded where noted in P02. Stable identity: `drmvyz.cinema2.honey`, module type `honey-native@1`, module instance `honey-wall`, manifest revision 1. The first-party declaration is `reference`, tags `cinematic`, `3d`, `static`. The real `Cinema2PresetsPanel` uses `cinema2NativePresetRegistry.list()`, filters `internal` and calls `resolvePresetScope`; new IDs without private catalog rows are system presets. No database entry or parallel picker is needed. Remove `static` in P03 only after actual motion is implemented; promotion to keeper requires the final human and technical gates.

### Reference observations (not an audio analysis)

Original supplied MOV decoded at 692 × 1070, video duration 6.2367 s (audio stream 6.1653 s). Inspection at approximately 0, 1, 2, 3, 4, 5 s and the final portion: close crop of flat-top solid graphite-blue hexagonal plates; a plate occupies roughly 1/3 of the portrait width (roughly 3–4 across with cropped edge tiles). Narrow orange gaps and selectively brighter outer bands, occasional thin inner rings, recessed dark wells, visible thick vertical sides and bottom bands, uneven elevations, subtle surface markings and warm light spilling onto neighbors. Camera mostly frontal with slight obliqueness and changing depth; no perimeter appears. Fine scattered warm particles and restrained glow are secondary to real geometry. These are visual observations, not evidence of kick, snare, beat, phrase, or instrument timing. P01 deliberately omits the final material and emissive treatment; P02 will add it. No source media is shipped.

### Ownership and source audit

Read root `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`, and `docs/documentation-index.md`. Implementation uses BLOCKSHIFT's native WebGL2 instanced-provider architecture (`modules/Cinema2BlockshiftNativeModule.ts`, `modules/blockshift/Cinema2BlockshiftRenderer.ts`), not its models or musical behaviors. EVERYWHERE, OPEN DECKS, AFTERHOURS and MAINFRAME supply existing examples of manifest/scene binding, camera, shared triggers, and mood authoring. OPEN DECKS uses the shared Three scene bridge for imported assets; HONEY needs no imported models or Three bridge. Static graph follows the native Switch It / Glassfall review topology but is a public reference, not a private study. All C2 paths below are under `src/components/vyzualz/cinema2/`.

- `contracts/Cinema2NativePresetManifest.ts`: `cinema2NamespacedId<T>`, `cinema2StableId<T>`, `cinema2Ref`, `Cinema2NativePresetManifest`, `Cinema2ParameterManifest`; use the shared IDs and schema version. Current required capabilities are `render.webgl2`, `render.depth`, `scene.3d`, `camera.world`. P02/P06 add optional `render.hdr` with rgba8 fallback only when HDR finishing actually exists; optional `lighting` only if shared lighting consumed. Current neutral shader is native local lighting, not a shared light rig.
- `presets/Cinema2PresetCompiler.ts`: `compileCinema2NativePreset(value, options?)`; `presets/Cinema2PresetAuthoring.ts`: `validateCinema2PresetAuthoringConventions(declaration)` checks actual schema consumers and capabilities. Registry compiles all declarations; `withCinema2AutoCoverage` returns unchanged if no Auto Performance parameter. `Cinema2AutoPerformanceInventory.test.ts` recognizes legitimate reference/static scenes, not an exemption for performance presets.
- `modules/Cinema2ModuleContracts.ts`: `Cinema2ModuleTypeDefinition.create(context: Cinema2ModuleCreateContext)` returns lifecycle and render provider; `context.parameters.get(name): Cinema2JsonValue | undefined` reads resolved values; `getAuthored`, `getEditRevision?` distinguish edits. Provider `execute(execution: Cinema2ModuleRenderExecutionContext)` receives engine-bound target, `depthAvailable`, final `camera.viewProjectionMatrix`, frame, resolved spatial nodes and lighting. No independently owned canvas, loop, store, camera or framebuffer. World node at identity; transforms currently cell-local, future moving transforms apply only to cap vertices. Shared scene graph and camera are the owners of world placement and projection. `context.resources.acquire<T>(key, kind, create(gl), dispose)` and `reportGpuBytes(bytes)` track GPU ownership; `Cinema2ModuleResourceScope.disposeAll()` retires on switch/context loss. HONEY reacquires in a fresh module generation; no textures are needed in P01. Future shipped maps may use `context.textures?: Cinema2AssetTextureService` after audit of its concrete loader API; no runtime network assets.
- `Cinema2ModuleFrameReadContext` carries audio, director, mood, transport, viewport, timestamp, elapsed time and contextGeneration. `context.randomness.sample(purpose,index?,substream?)` and event streams are shared randomness facets; fixed authored cell assignment instead uses a stable axial integer hash, independent of session/frame and not a musical RNG. `handleAction(action,event)` receives explicitly bound canonical events; no action is bound in P01. `Cinema2BeatClock.update(frame,syncEnabled,referenceBpm=120)` and `reset()`, `resolveCinema2AfterhoursTriggerEventIdentity(frame,trigger,previousTimeSec)`, `Cinema2MainframePatternController<Pattern>.update(input)`, `Cinema2PatternControlResolver<T>.update({saved,mood,autoPerformance})`/`inspect()`/`reset()` are the P03 route, not new trigger machinery. `withCinema2MoodDrives(manifest,spec)` tags shared policy and creates continuous routes, `withCinema2AutoCoverage` is applied by the catalog; no changes to shared policies or Inspector. P04 capabilities to declare only when consumed: `audio.transport`, `audio.bands`, `audio.features`, `music.beat`, `music.downbeat`, `music.rhythm-events`, `music.bar`, `music.phrase`, `music.section`, `music.drop`, `music.build`, `music.vocal-presence`; P05 `visual-director.significance`. No `audio.spectrum` or local detector required.

### Geometry and clearance lock

Native single instanced draw: 625 cells, 25 × 25 staggered axial coverage, 11 mesh parts, 192 triangles per cell (120,000 instanced triangles), 576 shared vertices × 8 floats plus 625 × 7 instance floats = 35,932 buffer bytes, excluding shader/VAO overhead. No rebuild on resize/color edits. Flat-top XY, +Z faces viewer; pitch is nearest center distance 1.8; centers `(sqrt(3)/2 * pitch*q, pitch*(r+q/2))`. IDs `q:r`, six reciprocal neighbor directions, immutable seed salts. Substrate tiles meet along exact hex boundaries at radius pitch/sqrt(3); substrate z=-.165; stationary cavity floor z=-.10; sleeve inner radius .985, outer 1.027, lip .42; actual sleeve edge gap `pitch - sqrt(3)*1.027 ≈ .0212`; cap radius .97, cap gap ≈ .1199; cap thickness .18, bevel .035, inner channel radius .79–.812, cut .009; separate outer side seat and lower sleeve channel seat. No coplanar duplicated surfaces; annular strips and separate walls share boundary vertices. Body underside and cavity floor are distinct. Five authored elevations .12/.32/.49/.75/.98; deepest bottom -.06 clears floor. The camera position [.32,.85,13], target [0,0,.25], FOV 40°, near .1/far 100; fixed vertical FOV retains close tile size and crops portrait naturally. Rectangular interior [-16,16] × [-19,19] overscans the viewport at 16:9, square and portrait; later sway must remain inside overscan. No orbit/dolly/alternate camera modes.

Pose bounds: elevation [.12,1.05], axial rotation and each tilt ±6° (radians internally), lateral displacement magnitude ≤.025. These conservative limits replace the proposed ±12/±10/.12, since closer packing would make those unsafe. `honeyPoseCorners` applies tilt X, tilt Y, then rotation Z about top center; `isHoneyPoseSafe` checks all twelve prism corners against floor and six half-planes. If the lowest point is below lip+.015, require all corners within sleeve inner apothem minus .003; otherwise own Voronoi half-space minus .006. Adjacent caps cannot enter each other's envelope, even with opposite rotations, since each is confined to its own half-spaces. `constrainHoneyPose` scales angular/lateral offsets toward neutral and clamps elevation, with a final safe result. P03 must use this function for every interpolated pose (not interpolate unchecked endpoints), keep sleeve geometry fixed and update instanced pose data without a topology rebuild. Limits can be refined only with equivalent clearance tests. No live motion controls yet.

Fixed finish assignment is implemented as clustered deterministic metadata, not a material shader in P01. P02 must make graphite industrial metal, brushed steel, carbon-fiber composite and dark satin ceramic actually visible using compact original analytic texture or HONEY-only procedural maps (no texture picker or distribution controls). Stable `finish` and `tone` persist with the cell across every future pose, resize, seek and re-entry. Neutral face shading and muted channel-seat pigments are implemented now, not emission, AO, texture, or spill.

### Parameter inventory and phase of exposure

IDs below are `honey-<id>` except shared `quality-mode`. All color values are normalized RGBA; color controls have preset persistence and no automation. P01 and P02 expose only rows with actual consumers. Rows from P01/P02 retain their historical intent; the P03 inventory below supersedes proposed P03 IDs/defaults. P04/P06 rows are specifications, not currently registered controls. Numeric values clamp at listed bounds and use shared targets. Four canonical parents, no generic UI modifications.

| Parent | ID / label | Type; default; range | Consumer / authority / phase |
|---|---|---|---|
| Master Controls | quality-mode / Quality / Performance | enum auto; auto/performance/balanced/quality | Shared quality policy, user preference, P01 |
| Palette | face / Face | color #202C36; 0–1 | plate-face, user, P01 |
| Palette | edge / Edge / Sleeve | color #354650; 0–1 | bevel/rim/exterior, user, P01 |
| Palette | cavity / Cavity / Body | color #080D13; 0–1 | interior/floor/body, user, P01 |
| Palette | substrate / Substrate / Background | color #0E1318; 0–1 | substrate and environment clear, user, P01 |
| Palette | outer / Outer Channel | color #FF791B; 0–1 | side seat pigment P01; outer emitter implemented P02, user |
| Palette | inner / Inner Channel | color #FFC373; 0–1 | inner seat pigment P01; inner emitter implemented P02, user |
| Palette | under / Under Channel | color #E35D0E; 0–1 | lower seat pigment P01; under emitter implemented P02, user |
| Master Controls | master-intensity / Master Intensity | float 1; 0–2 | light/scene gain, base+modulation, P03 |
| Master Controls | bpm-sync / BPM Sync | bool true | shared tempo permission, user P03 |
| Master Controls | auto-performance / Auto Performance | bool false | shared mood policy/Inspector, user P03, full drives P05 |
| Master Controls | motion-amount / Motion Amount | float .55; 0–1 | governed motion envelope incl. camera, base+modulation P03; zero hard-off |
| Master Controls | audio-reactivity / Audio Reactivity | float .8; 0–1 | governed audio overlay gain, P04; zero hard-off |
| Master Controls | camera-motion / Camera Motion | bool true | shared camera drift permission, user P03 |
| Master Controls | camera-motion-intensity / Camera Motion Intensity | float .25; 0–1 | shared camera drift, base+modulation P03; visible if enabled |
| Design | pattern / Pattern | enum cascade; eight below | module controller; user base + effective shared switch, P03 |
| Design | pattern-change / Pattern Change | bool false | shared effective pattern policy, user saved / intelligence effective, P03 |
| Design | trigger / Trigger | enum bar4; shared 11 options | conditional on saved Pattern Change, user saved / intelligence effective, P03 |
| Design | travel / Axial Travel | float .65; 0–1 | elevation envelope, base+modulation P03 |
| Design | rotation-range / Rotation Range | float 4; 0–6 degrees | local normal angle, base+modulation P03 |
| Design | tilt-range / Tilt Range | float 4; 0–6 degrees | two-axis angles, base+modulation P03 |
| Design | separation / Lateral Separation | float .012; 0–.025 world units | local displacement envelope, base+modulation P03 |
| Design | motion-rate / Motion Rate | float 1; .25–2 | shared beat clock phase scaling, base+modulation P03 |
| Design | transition-length / Transition Length | enum 1; .5/1/2/4 beats | module eased pose blends, user P03 |
| Design | outer-intensity / Outer Channel Intensity | float 1; 0–2 | emitter gain P02, user; base+modulation later |
| Design | inner-intensity / Inner Channel Intensity | float 1; 0–2 | emitter gain P02, user; base+modulation later |
| Design | under-intensity / Underlighting | float 1; 0–2 | lower emitter gain P02, user; base+modulation later |
| Effects | camera-float-speed / Float Speed | float .7; .25–2 | shared camera motion speed P03 |
| Effects | bloom / Bloom | float .3; 0–1 | shared HDR bloom intensity, user P02 |
| Effects | light-spill / Light Spill | float .65; 0–1 | bounded local neighbor illumination, user P02 |
| Effects | ao / Ambient Occlusion | float .65; 0–1 | shared depth AO intensity, user P02 |
| Master Controls | ambient / Ambient Lighting | float .48; 0–1 | shared ambient light intensity, user P02 |
| Effects | atmosphere / Atmosphere | float .01; 0–.05 | shared depth haze P06 |
| Effects | particles / Ember Amount | float .15; 0–1 | bounded HONEY ember instances P06 |
| Effects | depth-of-field / Depth of Field | float .1; 0–1 | actual shared supported depth effect only P06 |
| Palette | particles-color / Ember Color | color #FF9C48; 0–1 | ember pigment, user P06 |

Future controls may be adjusted to actual shared effect parameter ranges after owner inspection. Never add a placebo or a new shared effect. No camera FOV/orbit control, no material selector, no genre or shape selector. Audio hidden targets (P04, runtime-only, not user knobs): sub/bass pressure, mid texture, high detail, energy, vocal presence, event action `musicalCue`; Director (P05): significance/build/drop, section contrast and mood drives. Exact target routes to be bound against canonical source paths/capability availability, not inferred from the clip.

### Eight pattern signatures (P03 implemented; see P03 validation below)

| ID | Geometry | Lighting choreography |
|---|---|---|
| cascade (default) | diagonal sequential axial rises, settle | moving bands of outer seats, restrained lower follow |
| shockwave | concentric outward displacement ripple | short warm wavefront, fading inner ring |
| fracture | bounded contiguous clusters tilt/rotate with separation | jagged selective boundary illumination |
| alternating | interleaved axial groups rise/retract opposite | alternating outer/inner roles, no global pulse |
| convergence | peripheral waves travel toward center | brightness concentrates at converging groups |
| current | flowing directional wave with phase offsets | asymmetric running inner highlights |
| submerge | local pockets sink below fixed lip and return | darker chamber with soft underlight |
| overdrive | layered fast but bounded waves and clusters | strong accents on selected paths, never whitewash |

All patterns preserve IDs, fixed sleeves/finishes, and phase-safe transitions. P03 use `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` exactly: beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop. Manual choice establishes base immediately, even with Pattern Change ON; only next fresh qualifying event advances; saved values never rewritten. Effective shared policy derives from mood/grid with Auto ON; fallback exactly saved with unavailable mood/grid or Auto OFF; silence holds per shared policy. P05 may temporarily substitute a pattern for a distinct build/drop; manual choice invalidates prior event; base resumes. Use shared pattern policy and controller, not local ladder; shared Inspector locks edits under Auto and displays effective choices.

### Authority and timing matrix

| Domain | User / manual | Audio | Director | Auto / fallback |
|---|---|---|---|---|
| Geometry identity/material | Fixed authored seed; no distribution knob | none | none | never changes |
| Motion permission | amount zero freezes; travel/angle envelopes saved | continuous bass/energy, transient kick/snare bounded by amount/reactivity | significance scales accent only | eligible numeric base modulation; never exceeds pose constraint |
| Pattern | saved base/permission/trigger; immediate fresh manual edit | canonical qualifying event only | meaningful build/drop cue only | effective shared policy and temporary substitution; restore base; no saved edits |
| Camera | sway permission/intensity; near-frontal fixed FOV | shared beat clock only for drift | no orbit/dolly/cut | shared camera drift modulation, hard-off respected |
| Channel lights/effects | editable gains and hard-off; palette user-only | selective kicks outer, snares inner, highs fine accents, bass lower, vocal space; no global pulse | meaning/peak/build modulates allowed gain | bounded shared drives; zero stays zero; no automatic palette |
| Quality | shared user preference | none | none | shared quality adaptation, not preset-local FPS logic |
| BPM/transport | preset and global BPM Sync both must be true for governed lock; otherwise shared 120 reference clock | unrelated audio routes continue | no timing ownership | no competing clock |

No source: fully composed static wall; no fabricated event, no audio motion. P03 manual authored preview may move only under deliberate native preview permission consistent with existing transport contract; no-source defaults still. Pause holds musical state; seek/loop/source/analysis/track/context generation discontinuities clear pending cues, reset shared controller and establish deterministic pose without replaying stale publication. Re-entry builds same cells, resets transient state, retains serialized parameter base. P04 route continuous and cue events through native choreographic targets; P05 uses `withCinema2MoodDrives` with actual patternControls and Auto toggle, canonical mood drives and Inspector. Do not change shared policies or hard permission semantics. P06 engine-owned HDR/depth effects and standard quality lifecycle; target ~60fps at 1080p capable hardware and ~30 fallback, no measurements yet.

### Sequence and checkpoint ledger

| Phase | Scope | Status |
|---|---|---|
| P01 | audit, registration, static geometry, palette, pose limits | code present; local compiler/geometry/lease checks pass; production gate unverified; human approval conveyed by P02 prompt |
| P02 | mixed finishes, lighting, real emission, static visual baseline | implementation candidate; native GPU diagnostics pass; production and human acceptance pending |
| P03 | real controls, mechanical motion, eight patterns, shared timing/pattern policy | pending; remove static tag when moving |
| P04 | standard Audio Intelligence and event choreography | pending |
| P05 | Director and full Auto Performance | pending |
| P06 | shared finishing, atmosphere, optimization | pending |
| P07 | production validation, human acceptance, release | pending |

### P01 validation and exact changed files

Commands run: `ffprobe` + `ffmpeg` reference sampling; temporary Node/TypeScript transpilation of actual repository domain/layout/mesh, `compileCinema2NativePreset`, `validateCinema2PresetAuthoringConventions`, `Cinema2ParameterState`, `Cinema2CameraRuntime`, native module/resource scope (Vite DEV/BASE_URL substituted only in temporary loader, no shared source edits). Results: 625 unique deterministic cells, all four finish IDs, 3,552 reciprocal directed neighbor links within allocation, all five static elevations safe, 1,944 combined constrained pose cases safe, 11 finite mesh parts / 192 triangles per cell, unit normals; real compiler and authoring gate passed, all seven palette values persist, camera projected overscan passed at 960×540, 540×960, 640×640; injected renderer resource seam passed acquire once/live palette/retire once. These are not production GPU screenshots. `tsc --noEmit --skipLibCheck --strict --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --typeRoots /tmp/honey-empty-types ...Cinema2HoneyNativeModule.ts ...Cinema2HoneyPreset.ts` reports missing external Supabase and Vite environment declarations, no diagnostics in HONEY files; not a full typecheck pass. `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0` failed (registry DNS EAI_AGAIN, npm exit handler never called). Vitest/catalog inventory and full production browser checks therefore cannot execute here. No actual app capture, selector interaction, GPU/console acceptance or z-fighting inspection claimed. `node --check scripts/run-cinema2-honey-browser.mjs` passed. The browser harness mounts `Cinema2Runtime.create` with real registry/compiler/renderer, actual `Cinema2PresetsPanel` and `Cinema2InspectorPanel`; no mock render. Run locally with dependencies installed:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Honey{Preset,Layout,Geometry}.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2AutoPerformanceInventory.test.ts
node scripts/run-cinema2-honey-browser.mjs
```

Inspect captures under `artifacts/cinema2-honey/p01`: selector, baseline, 16:9/square/portrait, seven palette variants, inspector, re-entry. Compare depth without bloom, crop, plate scale, dark sleeve, narrow gap, topology silhouette and console; a pixel change alone does not establish visual quality. Later phases extend harness for pose/motion, controls, shared audio/trigger discontinuities, Auto lock/authority, quality and performance. P01 final gate remains **unverified** until production canvas and regression checks run successfully. At P01 delivery human approval was pending; P02 prompt now conveys it. Production acceptance remained unverified. No unrelated source changes.

Changed files (relative C2 unless marked root):

- `presets/Cinema2HoneyPreset.ts`, `modules/Cinema2HoneyNativeModule.ts`, `modules/honey/Cinema2HoneyDomain.ts`, `Cinema2HoneyLayout.ts`, `Cinema2HoneyGeometry.ts`, `Cinema2HoneyRenderer.ts` (last three in same honey directory).
- additive `modules/Cinema2ModuleRegistry.ts`, `presets/Cinema2FirstPartyPresetCatalog.ts`, `index.ts`.
- `__tests__/Cinema2HoneyPreset.test.ts`, `Cinema2HoneyLayout.test.ts`, `Cinema2HoneyGeometry.test.ts`.
- root `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts`, `src/test/browser/cinema2-honey-production.html`, `scripts/run-cinema2-honey-browser.mjs`, `docs/cinema2-honey.md`, `docs/documentation-index.md`.

Final delivery checks: explicit Vitest invocation failed because `node_modules/vitest/vitest.mjs` is missing; the production browser runner failed to resolve `@playwright/test`. An additional isolated native-shader diagnostic using the system Chromium and the actual engine camera matrices could not produce a screenshot because SwiftShader/EGL initialization failed (`EGL_NOT_INITIALIZED`). The staged patch passes `git diff --cached --check`, and `git apply --check` plus actual `git apply` were performed against a clean detached worktree of the supplied baseline. Only the 17 paths listed above are included. No production screenshot or user visual acceptance is implied by these checks.

## P02: materials, illumination and static baseline

**Status:** implementation candidate, not a human-approved visual baseline or release. P01 is present and human-approved by the P02 prompt. P01 full browser gate remains unverified. Stable IDs, camera, grid/pose envelope, catalog `reference` role and `static` tag retained. No motion, music routes, Auto, pattern controls or atmosphere added. No changes to shared code or other presets.

### A. Fixed finishes and geometry

`Cinema2HoneyMaterials.ts` assigns four finishes using stable 3×3 axial clusters plus 25% scattered accents, keyed by cell identity. `honeySeed` now lives in the HONEY domain and is re-exported by Layout. The actual 625-cell distribution is graphite 347 (55.52%), brushed 129 (20.64%), carbon 90 (14.4%), ceramic 59 (9.44%). All four occur within the representative center crop. Fixed physical values (metalness, roughness, relative tint, anisotropy): graphite (.65,.48,1,.12), steel (.83,.38,1.25,.72), carbon (.16,.58,.84,.08), ceramic (.05,.53,.95,0). Edge .8/.32, body .6/.65, cavity .2/.85. `Cinema2HoneyShaders.ts` uses local-coordinate analytic brushed grain, weave, shallow engraving, subtle scratches, derivative attenuation and bounded specular response. No images, asset licensing dependencies, runtime downloads, texture controls or material mode. Original procedural detail is generated in the HONEY shader; no texture allocations are needed.

The bevel is now .065; outer channel is a recessed sloped strip with radial width .026 at cap-local z -.059 to -.034; inner ring radius .79–.808, width .018 and recess .004; lower channel remains at the stationary sleeve lip with .007 groove. This supersedes P01 seat-only geometry. Cap radius, clearance, pitch, elevations, fixed camera and sleeve envelope retained. 11 parts, 216 triangles per cell (135,000 instanced triangles). Vertex buffer 20,736 bytes; 34-float instance records 85,000 bytes; 1×1 depth fallback 2 bytes; total reported 105,738 bytes, excluding programs/VAO and shared targets. One instanced world draw and one depth-only instanced draw when the shared shadow service refreshes. Resource leases own two buffers, VAO, two programs and depth-compare fallback; disposed on retirement.

### B. Independent physical channels and finishing

`honeyStaticChannels` creates an authored deterministic density composition, not musical timing. The eight outer/inner/under on/off combinations across the wall are 000:140, 001:97, 010:17, 011:25, 100:113, 101:64, 110:87, 111:82. Active outer range .65–1, inner .6–.9, under .45–.9. Linear HDR emitter factors 2.8, 1.45, 2.5, with narrower hot cores and warmer edges. Output uses display-encoded HDR (preserves values >1), matching the shared HDR effect's power-2.2 conversion. The upper channels belong to the cap; lower channel belongs to the fixed sleeve. Seven original palette IDs/defaults remain, with separate actual shader consumers. Saved P01 parameters restore with new P02 defaults; no migration or revision bump necessary.

Seven real new floats with .01 step, user-only preset persistence, authored reset, no automation/modulation/choreography yet: `honey-outer-intensity`, `honey-inner-intensity`, `honey-under-intensity` (Design, 1, 0–2, module `outerGain`, `innerGain`, `underGain`); `honey-light-spill` (Effects, .65, 0–1, module `lightSpill`); `honey-ambient` (Master Controls, .48, 0–1, shared ambient light intensity); `honey-bloom` (Effects, .30, 0–1, shared HDR bloom intensity); `honey-ao` (Effects, .65, 0–1, shared AO intensity). Zero channel gain extinguishes that emitter and its corresponding spill. Zero spill disables local illumination without disabling physical emitters. Palette remains user-owned. See persistent inventory above; future rows are not exposed.

`finishHoney` in `presets/Cinema2HoneyFinishing.ts` uses engine-owned scene color/depth, shared AO, HDR bloom and cinematic finish in that order. AO consumes actual scene depth (`radius .32`, intensity .65, power 1.1, emissiveProtect .95); bloom intensity .30, threshold .85, knee .22, spread .35, levels 4, clampMax 4; final shared neutral grade soft tone-map 2, exposure 1, no vignette/grain/aberration. Scene, AO and bloom targets rgba16f with rgba8 fallback; final grade rgba8. Optional `render.hdr`, required `lighting`. No private postprocessing targets or loops. Bloom zero leaves native emitter geometry intact. Actual shared effect image output still requires production-browser verification.

### C. Local illumination and shared shadow depth

`honeyLightInstances` in `Cinema2HoneyLighting.ts` packs self and six axial neighbors in seven vec4 records with individual emission and elevation, plus cell and finish attributes. `Cinema2HoneyShaders.ts` chooses the nearest edge candidates (three per source, maximum 21 bounded samples), applies normal-facing distance falloff `(1-d/1.05)^2`, height/cavity occlusion and per-channel .62 contribution cap. Lower emitter elevation .413 is stationary. This is a bounded local-light approximation, not ray-traced area lighting or a separate light system. Contact darkening, cool ambient, rough wells and separate shadows remain when bloom is zero. In P03 update neighbor pose/elevation and light positions to match moving caps, mark dynamic casters appropriately, and preserve stationary sleeve channels; P02 does not animate anything.

The manifest supplies actual shared ambient ([.76,.86,1], .48) and directional ([.83,.91,1], 1.1, rotation [-.55,.46,0]) lights. HONEY's `renderShadow` provides depth to `Cinema2ShadowService`; shadow extent 13, depth 45, focus ahead 13, bias .012, softness 1. Shared shadow quality/service governs allocation (low disabled, medium 1024, high 2048); native 3×3 comparison PCF uses the shared matrix and actual depth map. Static cast participation only; low-quality fallback remains dark via contact/ambient independently. No changes to shared lighting, renderer, shadow service, AO or engine clocks.

### Validation and actual observations

- Source audit: root instructions, P01 report, shared effect owners (`Cinema2HdrBloomEffect`, `Cinema2AmbientOcclusionEffect`, `Cinema2CinematicFinishEffect`), native provider/depth contracts, lighting environment/shadow runtime and reference preset finishing audited. Actual `compileCinema2NativePreset` and `validateCinema2PresetAuthoringConventions` passed using the real HONEY manifest via a temporary TS transpilation loader. All three actual shared effect definitions passed their validation. Registry/catalog source unchanged, full catalog execution not verified.
- 12 focused cases from actual HONEY Layout, Geometry, Materials, Lighting and LocalLight test files passed using a temporary Node/TypeScript loader and minimal standalone assertion adapter; **not a Vitest run**. Tests cover deterministic layouts/finishes, clearance and winding, local seed stability, resource retirement, no texture selector, all activation combinations, gain/palette isolation, prior save restoration, actual shared target bindings, fallback/depth graph, neighbor isolation/decay/bounds, shader guards and shadow binding/fallback. P01 Preset test updated for the new renderer and resource bytes; full registry/auto inventory regression not run.
- `npm ci --offline --ignore-scripts --no-audit --no-fund` failed ENOTCACHED (`zustand@5.0.13`); `npm exec --offline -- vitest run ...` failed ENOTCACHED (Vitest). Targeted strict `tsc --noEmit --skipLibCheck --strict --target es2022 --module esnext --moduleResolution bundler --lib es2022,dom --typeRoots /tmp/honey-empty-types` on HONEY native module and preset failed due missing external Vite/Supabase/Zustand declarations, no HONEY diagnostics; not a full typecheck pass. `node --check scripts/run-cinema2-honey-browser.mjs` passed. Production runner cannot resolve `@playwright/test`; system Chromium could not establish WebGL2 under tested flags.
- Actual isolated native GPU diagnostics used system Mesa surfaceless OpenGL ES 3.2, the real shader sources, compiled mesh/instance records, shared camera/light fit, depth24 shadow map and RGBA16F color target. Both world and shadow shader programs compiled/linked. Twelve final captures (960×540 and 540×960, each default, neutral, spill-off, shadow-off, dense, sparse) rendered with zero GL errors. Also rendered native rgba8 targets. These are diagnostic renders of the native geometry/shaders, **not production-runtime screenshots**, and do not execute shared fullscreen AO/bloom/grade. No performance benchmark.
- Actual diagnostic image inspection: close portrait crop shows roughly three cells across, substantial dark chambers, varying elevations, restrained brushed striation and woven carbon detail; satin is subtler. The first outer strip was too fragmented at the camera angle, corrected to a wider sloped inset and slightly wider inner channel. Final hot orange outer and yellow-orange inner remain narrower than plate edges; dark separation and shadows survive. Warm spill catches adjacent edges and recessed faces without filling entire tiles. Thin inner stripes show some pixel stair-stepping at un-antialiased diagnostic resolution; production anti-aliasing and final tone map require inspection. Neutral image retains a readable layered industrial wall without LEDs. HDR native default peaks at 1.623 encoded (above 1 on 21,956 landscape pixels), neutral .3984; dense peaks 1.9424, sparse 1.1299. Landscape spill-off mean absolute RGB difference 3.141 (203,799 changed pixels), shadow-off 1.213 (76,250 changed); independent visible effects. No claim of exact reference match: the original MOV was not in the P02 upload or retrievable from the file search, so fresh decoding at 0–6 s is blocked; comparison uses the P01 recorded observations above only.
- Production harness extended to use actual manifest, registry, camera, renderer and native runtime, plus captures and checks for independent gains, palette, neutral/sparse/dense, ambient, bloom, AO, spill, shadow status, resize, restore and re-entry. It was not executed here. Run with dependencies installed and a working WebGL2 browser:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Honey{Preset,Layout,Geometry,Materials,Lighting,LocalLight}.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2AutoPerformanceInventory.test.ts
node scripts/run-cinema2-honey-browser.mjs
```

| Checkpoint | Gate result |
|---|---|
| A fixed finishes | Focused deterministic/clearance/consumer checks and isolated native neutral/crop inspection pass. Production close and normal captures unverified. |
| B emissive channels | Native geometry, independent channels, shared manifest effect validation and HDR diagnostic pass. Production bloom on/off and fallback graph execution unverified. |
| C local illumination | Native GPU spill/shadow diagnostic and focused neighbor/depth checks pass. Production AO on/off, full graph, reference re-decode and performance blocked. |
| P02 final | Code implementation candidate; full production acceptance **not passed**; no human approval inferred. |

Next prerequisite: apply P02, run the full production harness and inspect actual AO/bloom/shadow output against the original video. Arrival of P03 prompt conveys human approval, not a substitute for technical tests. Preserve this record, keep unresolved production checks visible, and implement motion/patterns only in P03. No measured 60/30 fps claim.

### P02 exact changed files

C2-relative: `modules/Cinema2HoneyNativeModule.ts`; `modules/honey/Cinema2HoneyDomain.ts`, `Cinema2HoneyGeometry.ts`, `Cinema2HoneyLayout.ts`, `Cinema2HoneyRenderer.ts`, `Cinema2HoneyMaterials.ts`, `Cinema2HoneyShaders.ts`, `Cinema2HoneyLighting.ts`; `presets/Cinema2HoneyPreset.ts`, `presets/Cinema2HoneyFinishing.ts`; `__tests__/Cinema2HoneyPreset.test.ts`, `Cinema2HoneyMaterials.test.ts`, `Cinema2HoneyLighting.test.ts`, `Cinema2HoneyLocalLight.test.ts` (last three in same test directory). Root: `scripts/run-cinema2-honey-browser.mjs`, `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts`, `docs/cinema2-honey.md`. No new dependency, binary asset, reference media, or shared logic changes. Final packaging: `git diff --cached --check`, `git apply --check` and actual application to a detached pristine worktree of the supplied P01 baseline passed; applied staged tree matched the intended staged tree exactly. This is a patch-integrity gate, not production acceptance.

## Phase 03 (P03) — mechanical performance reference

**Status:** implementation candidate; P01/P02 approvals accepted from the incoming P03 prompt, P03 not human-approved. Native implementation, source-level checks and isolated shader diagnostics completed. Full production acceptance remains open. Preset ID, module ID, revision, first-party reference registration, palette and P02 finishing graph are unchanged. Removed `static` tag; no shared logic, registry, coverage exemptions, UI or dependencies changed.

### Current authority and parameters (supersedes proposed P03 rows above)

All new parameters are preset-persistent with authored reset and actual module/shared-camera bindings. Numeric values are final resolved targets; the catalog's existing Auto Coverage adds shared drives. Master Motion is the authority and zero holds the current cap pose, independently of emission motion; camera hard-off is shared. `Master Intensity` multiplies the three emissive gains and their spill, not ambient or the base materials. Each P02 color remains user-owned, including the existing substrate/background shared role. Geometry pitch, cap radius, thickness, bevel, lip and camera lens remain fixed authored values: live changes would compromise the close-packed clearance contract. No texture, shape, FOV, orbit or material selectors. Camera speed is not exposed: it is a deliberately bounded shared reference sway. No particle/atmosphere controls until P06. Audio Reactivity and detailed audio overlays are P04.

| Parent | ID (honey- prefix) | Default; range / options | Consumer |
|---|---|---|---|
| Master Controls | master-intensity | 1; 0–2 | native outer/inner/under multiplier |
| Master Controls | motion-amount | .72; 0–1 | cap movement authority and shared camera master |
| Master Controls | bpm-sync | true | shared native beat clock, composed with global transport BPM sync |
| Master Controls | auto-performance | false | shared tagged mood and Inspector authority |
| Master Controls | camera-motion | true | shared camera permission |
| Master Controls | camera-motion-intensity | .55; 0–1, conditional | shared camera motionAmount |
| Design / Pattern | pattern | cascade; eight ordered options | native shared pattern controller |
| Design / Pattern | pattern-change | false | saved shared policy |
| Design / Pattern | trigger | bar4; exact Afterhours options, conditional | canonical event identity |
| Design / Pattern | transition-length | 1; .5/1/2/4 beats | current-cell pose/light snapshot |
| Design / Pattern | width | 1; .5–1.5 multiplier | pulse width in travelling patterns |
| Design / Pattern | delay | .125; .0625–.25 beats | spatial propagation spacing |
| Design / Mechanical Motion | motion-rate | 1; .25–2 multiplier | shared beat phase scaling |
| Design / Mechanical Motion | attack | .14; .04–.5 seconds | rising pose damping |
| Design / Mechanical Motion | release | .55; .15–1.2 seconds | returning pose damping |
| Design / Mechanical Motion | travel | 1; 0–1 fraction | bounded axial excursion |
| Design / Mechanical Motion | rotation-range | .65; 0–1 fraction of 6 degrees | local normal rotation |
| Design / Mechanical Motion | tilt-range | .65; 0–1 fraction of 6 degrees per axis | raised-cap tilt |
| Design / Mechanical Motion | separation | .65; 0–1 fraction of .025 world units | lateral displacement |
| Design / Lighting | coverage | .72; 0–1 | seeded activation gate (base material lighting remains) |

Existing light controls remain at P02 defaults; they are now eligible for shared choreography/Auto Coverage. Four canonical parents use the existing Inspector. `withCinema2MoodDrives` authors activity/calm motion multipliers 1.22/.72 and activity/silence coverage multipliers 1.18/.6, with motion as strength. Catalog coverage augments all other eligible numeric controls automatically, no manual policy tags or exemptions. `computeCinema2AutoCoverage(withCinema2AutoCoverage(manifest))` reports no remaining drives or unbound controls. The shared camera uses authored static rig and `motion.tempo.weave=.35`, scaled by the camera permission/intensity and master motion; no z translation, lens animation, orbit, bob or roll. The actual shared camera tempo binding reads the preset toggle without composing the global host toggle, so HONEY deliberately leaves camera tempo sync unbound and uses the shared 120 BPM reference for subtle camera sway; native wall timing explicitly composes both BPM permissions. A synchronized camera would require a shared contract change, which is out of scope.

### Implementation and pattern math

`Cinema2HoneyPatterns.ts`: typed continuous per-cell output (axial displacement, rotation, two tilts, separation and three independent emitter levels). Stable axial seed and cluster seed; no frame RNG. Cascade directional phase x/y offsets; Shockwave radial distance; Fracture coherent crossed spatial fields with seeded cluster offsets; Alternating three axial group counterphases; Convergence inward distance to offset focal point; Current warped diagonal front; Submerge broad low-frequency regions with seeded elevated islands; Overdrive bounded sum of three moving fronts. Travelling envelopes use .14 s attack/.09 s hold/.55 s release with smooth compact support, capped inside a cycle at fast tempos. Width and spread delay apply to travelling fronts, not the slow region masks. All patterns retain fixed sleeve, finish and identity. Light output retains subdued seed-based base channels with gated accent additions, not a single uniform global pulse.

`Cinema2HoneyMotion.ts`: target/current pose and channels plus per-axis velocity; exponential attack/release damping using dt, zero overshoot. Interpolated poses are checked by the existing prism clearance solver. Descending caps align before dropping below the raised clearance threshold; a final exact constraint prevents collisions at all sampled intermediate poses. Motion Amount zero holds current physical transforms. `Cinema2HoneyOrchestration.ts`: shared `Cinema2BeatClock`, `Cinema2MainframePatternController` and `Cinema2PatternControlResolver`; canonical `resolveCinema2AfterhoursTriggerEventIdentity` only, no synthesized musical events or secondary clock. Pattern switches snapshot current visual cells, smoothstep blend over selected beat duration and pass through the same solver. Saved selections are never overwritten. Active manual selection switches authority immediately; idle/paused explicit selection generates a deterministic still preview while normal pause holds. Default idle retains P02 static wall. Source/analysis/timeline/context identity or transport discontinuity resets the clock and state; observed canonical identities suppress held events at edit/reset/silence/resume boundaries.

Renderer retains a single instanced native world draw and shadow draw, fixed topology, dynamic 39-float instance record (existing 34 plus rotation, tilt X/Y, x/y separation), and a 625 x 2 RGBA32F nearest-sampled pose texture for exact moving source ring positions in bounded neighbor spill. Both world and shadow vertex programs use matching Rz*Ry*Rx transforms only for moving parts; normals rotate with caps, stationary sleeves do not. Neighbor records carry current cap elevation/channels; fragment shader reconstructs moving ring source points with source pose, lower channel stays fixed. Dynamic shadow caster flag refreshes the shared map. Same resource lease and disposal, no alternate canvas or loop. Extra buffer/texture are reused across frames. Actual measured GPU performance is pending.

### Validation and gates

- Actual compiler and authoring conventions passed for HONEY, both raw and after the catalog's `withCinema2AutoCoverage` step. Standalone coverage audit: zero remaining drives, zero unbound controls. Full catalog/registry import in this container fails on missing `@supabase/supabase-js`; full inventory Vitest test was not executed.
- Direct Node execution with a temporary TypeScript transpilation loader and standalone assertions: 30,000 target poses across eight patterns and six beat samples, all safe and distinct; 56,250 intermediate pose checks through the shared controller/solver passed, as did pause, freeze, transition and global sync-off. The actual new HONEY Controls and Patterns test files, prior HONEY Layout/Geometry tests, and unchanged shared PatternControlPolicy/MainframePatternController test files ran using a minimal local assertion adapter: 29 cases passed (not a Vitest run). These include all eleven canonical trigger options with held-ID suppression, manual edit under switching, no grid/silence authority, 30/60/120 Hz constant-target damping, all axes, saved values and reset, four Inspector groups/locks, shared camera permission/intensity, 90/150 BPM and seek. Continuous moving-target frame-rate equivalence and exhaustive live renderer control extrema are not established by the constant-target test.
- `npm ci --offline --ignore-scripts --no-audit --no-fund` failed ENOTCACHED (`zustand@5.0.13`); `npm exec --offline -- vitest run ...` failed ENOTCACHED (`vitest`). Targeted strict `tsc` is limited by missing external packages and Vite declarations; no full typecheck pass. `node --check scripts/run-cinema2-honey-browser.mjs` passed. Production harness launch failed `ERR_MODULE_NOT_FOUND` for `@playwright/test`; no production-runtime screenshots or actual shared postprocess/shadow performance validation. Harness now exercises all eight patterns and pause with the actual runtime, registry, camera and real test transport, not mocked rendering.
- Native isolated GPU diagnostic: Mesa llvmpipe OpenGL ES 3.2 compiled/linked both actual moving world and shadow shader programs. Eleven actual world draws using the real authored mesh, camera matrices, resolved orchestrator instance/pose records and shader: idle 640x360, 360x640, 480x480 and all eight pattern frames at 640x360, zero GL errors. These draws use a depth-tested RGBA8 native output, fallback depth comparison texture and no shared AO/bloom/grade or real shadow pass execution; they are not production-runtime screenshots. Visual inspection of the landscape montage and portrait idle: full-frame wall, orange channels and recessed dark gaps remain, with varied cap elevations and selective illumination. Overdrive produces denser orange accents, Submerge/Fracture show larger dark pockets, and the other fronts differ in distribution; stills at one sampled moment are relatively similar due to the fixed close framing. Fine channel edges show stair-stepping at diagnostic resolution. Temporal readability and depth after the production effect graph remain unverified. Original video was not present in this turn; prior recorded reference observations, not a fresh decode, inform the camera baseline.

| Gate | Result |
|---|---|
| A manual controls and camera | Source compiler, Inspector/persistence and shared camera tests pass; three native aspect captures. Production independent visual extrema/save-discard and fresh reference comparison pending. |
| B mechanical motion | Native tests, safe poses, constant-target Hz consistency, tempo permissions and actual shader draws pass. Moving production capture, full transport regression and performance pending. |
| C first four patterns | Distinct deterministic signatures and native captures; production temporal visual verification pending. |
| D eight patterns and shared policy | All eight signatures, canonical eleven-trigger tests, shared policy and coverage audit pass. Actual browser/registry inventory blocked by dependencies. |
| P03 final | Implementation candidate only. Production acceptance not passed; no human visual approval claimed. |

Next prerequisite: install repo dependencies and run the following, then inspect the production captures and original reference before P04; P04 must preserve P03 mechanics and add canonical continuous/event overlays only.

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Honey{Preset,Layout,Geometry,Materials,Lighting,LocalLight,Controls,Patterns}.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2{PatternControlPolicy,MainframePatternController,AutoPerformanceInventory}.test.ts
node scripts/run-cinema2-honey-browser.mjs
```

### P03 exact changed files

C2: `modules/Cinema2HoneyNativeModule.ts`; `modules/honey/Cinema2HoneyLayout.ts`, `Cinema2HoneyMotion.ts`, `Cinema2HoneyOrchestration.ts`, `Cinema2HoneyPatterns.ts`, `Cinema2HoneyRenderer.ts`, `Cinema2HoneyShaders.ts`; `presets/Cinema2HoneyPreset.ts`; `__tests__/Cinema2HoneyPreset.test.ts`, `Cinema2HoneyControls.test.ts`, `Cinema2HoneyPatterns.test.ts`. Root: `docs/cinema2-honey.md`, `scripts/run-cinema2-honey-browser.mjs`, `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts`. No other files, no binary assets or new libraries.

## P04: standard Audio Intelligence and event choreography

P04 builds on the supplied P03 baseline (`c1bd77e8b79f4209ed8619e32b377abec9ef18fd` ZIP comment). Arrival of this prompt approves earlier patches only; outstanding P03 production verification remains outstanding. P04 is an implementation candidate, not a human-approved visual or release gate. Identity, eight selectable patterns, camera, materials, geometry, renderer, resource ownership, effect graph, catalog role and previous saved values are unchanged. No shared file or other preset is modified.

### A: continuous mapping and authority

`presets/Cinema2HoneyChoreography.ts` declares ten unique `continuous` replace routes, using existing shared source paths, optional capabilities, and unbound native numeric module targets initialized to zero. The actual bridge, source-path union and shared choreography implementation support both `audio.bands.lowMid` and `audio.bands.air`; no substitute paths were needed. The shared resolver removes transient contributions when a signal is absent, so native targets return to neutral; `Cinema2HoneyAudio` reads resolved values only, with 75 ms visual attack / 220 ms release time constants. Its availability diagnostic distinguishes available measured zero from unavailable routed signals, without using raw audio values to duplicate shared routes. No independent clock, FFT, genre model or detector. `audio.transport`, `audio.bands`, `audio.features`, `music.vocal-presence`, `music.build`, and `music.section` are new optional declarations; all prior beat/rhythm/grid/drop capabilities are retained. The shared capability gate for build requires available structural build confidence; build progress itself is the separate canonical continuous signal.

| Shared source | Module target | Native visual role |
|---|---|---|
| audio.bands.sub | sub | sustained axial pressure, varied underlight |
| audio.bands.bass | bass | clustered extension/retraction, bounded local lateral offset and underlight |
| audio.bands.lowMid | lowMid | regional plate activation and outer channels |
| audio.bands.mid | mid | alternating small tilts and inner channels |
| audio.bands.high | high | fine seeded inner-channel accents |
| audio.bands.air | air | sparser independent fine glints |
| audio.features.spectralFlux | flux | localized outer detail |
| audio.features.overallEnergy | energy | expanding seeded regional light coverage |
| audio.features.vocalPresence | vocal | attenuate kinetic audio additions, up to 55%, not authored pattern or palette |
| audio.features.buildProgress | tension | restrained axial compression and underlight tension, no pattern takeover |

New Master Controls / Motion slider `honey-audio-reactivity` (`audioReactivity`): 0–1, step .01, default .8, preset-persistent, reset to authored default, live binding to native module. Existing catalog coverage adds only its standard multiplicative mood drives (zero stays zero). Phase 05 adds the full Director/Auto Performance work; there are no new Director intensity routes in P04. Motion Amount zero holds actual prior rendered poses on ordinary updates; lighting still reacts. Reactivity zero clears audio state and removes audio overlays without feeding them into the base pose or pattern-transition snapshots; if both motion and reactivity are off, frozen poses take precedence until motion is permitted. Master Intensity and each physical channel gain remain applied once by the existing renderer; color edits remain independent. Per-cell additions are clamped to existing physical emitter ceilings and coverage; `honeyAudioPose` uses the existing solver and axis permissions. Fixed sleeves/finish/seed identity remain intact. No new user-facing light or geometry controls, no persistent writes. BPM sync remains composed by the native shared clock; no choreography tempo-sync declaration is added because that shared option substitutes clock ticks for canonical beat/bar/phrase sources. Thus unsynced procedural movement does not suppress ordinary canonical audio events.

### B: canonical cue/action dispatch

Hidden `honey-musical-cue` is a runtime-only trigger in React/Runtime, bound to module action `musicalCue`. Shared `spawn` dispatch uses the existing event ID plus the action ID, as in BLOCKSHIFT. HONEY consumes the typed action payload through `handleAction`, checks identity and recognized kind, then passes the bounded queue to native visual envelopes. Kick/snare strength is read from the same canonical dispatched rhythm event (not a second detector). Other spawn actions use fixed authored cue strength because the shared payload does not expose strength. Shared `not-silent` gates beat/downbeat/bar/phrase; drop and build remain canonical exceptions, as in existing shared authoring. Build cue uses shared threshold .6; section-change uses the shared Director transition identity only (no Phase 05 significance overlay). Visual envelope durations are seconds, independently authored attack/hold/release:

| Cue | A/H/R (s) | Visual role |
|---|---|---|
| kick | .035/.045/.24 | localized extension and underlight |
| snare | .025/.06/.23 | separate alternating cell retraction and inner flash |
| beat | .045/.025/.15 | sparse cell accents |
| downbeat | .07/.09/.40 | coordinated regional displacement and channels |
| bar | .12/.10/.55 | regional tilt / outer detail |
| phrase | .20/.18/.75 | contrasting regional elevation and underlight |
| section-change | .18/.22/.85 | local tilt / inner accents |
| build | .25/.20/.65 | local compression and underlight |
| drop | .055/.14/.80 | bounded regional expansion, contrast and channels |

Event masks derive from canonical action identity and immutable cell/cluster coordinates; no per-frame randomness. Envelopes are capped at 64, seen IDs at 2048; dedup is in addition to the shared dispatcher and is scoped to the current discontinuity. Paused frames consume held identities without firing and hold the existing visual state; resume, source/track/generation changes, seek/loop (including shared discontinuity flags), and relevant control edit revisions suppress the boundary event and clear volatile envelopes. Shared pattern switching continues independently (may legitimately occur on the same canonical event). No event changes saved pattern or overrides selected program. The base transition snapshot contains only procedural states, never the already-reactive output, preventing duplicate contributions. No new event bus or local trigger ladder is introduced. Explicit reset/stop returns to neutral base composition.

### Validation and visual observations

- Raw and catalog-coverage HONEY manifests compiled with `compileCinema2NativePreset`; `validateCinema2PresetAuthoringConventions({role:'reference',manifest})` passed both. Existing coverage test reports no unbound eligible controls or remaining coverage drives. Registry/catalog integration tests cannot import missing `@supabase/supabase-js` here; HONEY catalog entry and native registration remain unchanged.
- New `Cinema2HoneyAudio.test.ts`: seven cases executed with the actual TypeScript implementations via a temporary transpilation loader and minimal local assertion adapter. The test fixture uses the real MI bridge, compiler, resolved target pipeline, Director, shared choreography dispatch, native module lifecycle and shared camera; renderer injection captures native cell records, not simulated pixels. Tests exercised unique target/capability bindings; all six bands plus flux, energy and tension at matched time; vocal attenuation; missing signals/available silence; all nine cues including build threshold, phrase/drop markers and Director section transition; held ID suppression; simultaneous pattern switch/cue; both BPM permissions disabled; saved-state invariance; mute/freeze/light; pause/resume/seek/track/Trigger edits/re-entry. Seven passed. Combined unchanged focused tests plus the HONEY-only material regression correction passed 66 cases using the adapter (not a Vitest execution). The previous material test rejected every `sampler2D`, which was already false in the P03 baseline because `u_poses` is a runtime pose data texture; the corrected test explicitly allows only that data sampler and guards against material texture sampling. No shared tests altered.
- `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0` did not complete installation (npm exit-handler error); `npm ci --offline --ignore-scripts --no-audit --no-fund` failed ENOTCACHED for `zustand@5.0.13`. `npm exec --offline -- vitest run src/components/vyzualz/cinema2/__tests__/Cinema2HoneyAudio.test.ts` failed ENOTCACHED for Vitest. Targeted strict `tsc` with temporary config excluding absent Vite types reported no HONEY production-file diagnostics; missing dependency/type errors remain (including Vitest, React and React DOM), so full typecheck is not passed. `node --check scripts/run-cinema2-honey-browser.mjs` passed. Production harness now injects actual typed MI bridge fixtures and captures bands/events/mute/seek on the real registered runtime, retaining P03 captures. Launch blocked by `ERR_MODULE_NOT_FOUND: @playwright/test`. Separate bare Chromium isolated WebGL launch also failed ANGLE EGL initialization. No production screenshot or actual track playback verified.
- Isolated native GPU diagnostic: Mesa llvmpipe OpenGL ES 3.2 compiled and linked both unchanged actual HONEY world and shadow shaders. Eleven 640×360 depth-tested RGBA8 native world draws used the real authored mesh, camera matrix, resolved native module cell/neighbor/pose records and actual shader, with the renderer's fallback light values and fallback shadow texture, no shared postprocess or executed shadow pass. Zero GL errors. Visually inspected montage: dark graphite-blue cells and narrow warm channels remain throughout; sub lifts selected clusters, bass changes a different distribution of elevations, low-mid adds regional warmth, mid and high show restrained inner details, air is particularly subtle. Kick and snare affect distinct areas; drop opens a stronger regional depth contrast. The mute and available silence captures are pixel-identical. Mean absolute RGB differences versus silence (0–255 units): sub 7.885, bass 10.720, low-mid 1.695, mid .993, high .395, air .112, kick 3.164, snare 1.976, drop 6.311, muted 0. These diagnostics do not establish full production finishing, temporal aesthetic approval, or actual hardware FPS.
- Only repository ZIP attached in this turn; prior source video was not available in the upload or recovered from Library title search. Original 6.2367 s reference observations recorded in P01 remain the design basis. No fresh decoding or claim of audio/instrument mapping from the reference. No video or diagnostic image included in the patch.

| Gate | Result |
|---|---|
| A continuous mapping, target/capability binding and matched-time differentiation | Focused code and native draw diagnostics pass; production canvas/actual track and fresh reference decode unavailable. |
| B canonical cue dispatch, identity, transport and authority | Focused runtime tests pass for all nine cues and lifecycle boundaries; full production playback/capture unverified. |
| P04 regression | 66 focused cases pass via local adapter; real Vitest/full registry/typecheck blocked by unavailable packages. Native GPU diagnostic passes. |
| P04 final | Candidate patch; complete production acceptance gate remains unverified. No human approval or release claim. |

Next prerequisite: after applying P04, run actual Vitest and production browser captures with installed dependencies; inspect original reference and the combined real production output. Then P05 may extend shared Director significance and standard Auto Performance only, without revisiting the earlier patch unless a specific HONEY-only defect is discovered. Commands from project root:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Honey{Audio,Preset,Layout,Geometry,Materials,Lighting,LocalLight,Controls,Patterns}.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2{ChoreographyRuntime,TargetRegistryResolver,PatternControlPolicy,MainframePatternController,AutoPerformanceInventory}.test.ts
node scripts/run-cinema2-honey-browser.mjs
```

P04 changed files (C2 relative unless root): `presets/Cinema2HoneyChoreography.ts`, `presets/Cinema2HoneyPreset.ts`, `modules/honey/Cinema2HoneyAudio.ts`, `modules/honey/Cinema2HoneyMotion.ts`, `modules/honey/Cinema2HoneyLighting.ts`, `modules/honey/Cinema2HoneyOrchestration.ts`, `modules/Cinema2HoneyNativeModule.ts`, `__tests__/Cinema2HoneyAudio.test.ts`, `__tests__/Cinema2HoneyMaterials.test.ts`; root `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts`, `scripts/run-cinema2-honey-browser.mjs`, `docs/cinema2-honey.md`. No binaries, shared contract changes or additional dependencies.

Single-patch verification: the staged whitespace check passed; `git apply --check` and actual indexed application succeeded on a pristine disposable worktree of the supplied baseline, and the resulting full-index binary diff matched the generated patch byte-for-byte.

## P05 — Visual Director and full Auto Performance (implementation candidate)

The supplied P04 source is the baseline and the P05 prompt grants human approval of P01–04, not P05. Existing native registry, reference catalog entry, geometry, four seeded finishes, eight patterns, saved IDs/revision, camera, palette and effect graph remain intact. No shared code, other preset, coverage exemption, Inspector, dependency or global behavior changed. Phase 06 atmosphere/optimization is not included. Earlier production test limitations remain open.

### A: Director and overlay ownership

`presets/Cinema2HoneyChoreography.ts` routes `director.intensity`, `director.build`, `director.impact` through the existing canonical continuous resolver, gated by `visual-director.significance`, to three zero-neutral native targets. `modules/honey/Cinema2HoneyPerformance.ts` computes presentation weights only; no independent significance estimator, drop detector or musical clock. `Cinema2HoneyAudio.ts` consumes these targets via `Cinema2HoneyOrchestration.ts` and the existing native module lifecycle. Intensity/build use .14 s attack/.32 s release smoothing; impact is sampled on the existing cue frame. Cue weight is 1 + .15 intensity + .25 impact (impact only for kick, snare, downbeat, drop), bounded 1–1.4; coverage expansion .08 intensity + .14 impact, bounded 0–.22. Cue weights are latched to the existing event identity and envelope, never a second impulse. Ordinary kick still uses its canonical event strength. Missing Director authority is neutral. Normal Director-weighted audio reactions operate with Auto off, subject to audio/motion permissions.

Build tension is the maximum of existing canonical build progress and smoothed Director build, not their sum. The seeded spatial concentration narrows axial compression and underlighting to clusters (continuous compression coefficient .13, underlight .12); as build increases more nearby regions participate. The existing canonical build cue now has .35/.20/.90 s attack/hold/release and shared not-silent gate; drop remains .055/.14/.80 s. A drop retires the build cue and suppresses a simultaneous build envelope; underlying continuous build still follows canonical data. Drop spreads the existing coordinated expansion and light response rather than swapping patterns. Existing pose bounds (-.35/+ .38 normalized audio extension), emitter ceilings and solver clearance remain authoritative. Vocal restraint from P04 remains in place; Auto calm drives further restrain motion. No palette, mesh or authored pattern mutations.

Manual pattern edits, Auto transitions, authored trigger/reactivity edits and transport discontinuities clear old envelopes and suppress stale boundary events. Changing the effective shared trigger due to changing mood alone does not clear a legitimate cue. The shared pattern controller retains base program progression independently of overlays; there is no temporary pattern substitution. Auto off restores the saved pattern policy through the shared controller and clears prior transient envelopes. Pause holds the current rendered pose; live authority changes affect subsequent motion when playback resumes. Source loss and re-entry use the existing reset lifecycle. Motion zero freezes governed geometry; reactivity zero disables audio overlays and removes mood-drive strength; zero channel gain/effect intensity remains zero. No-source composition, independent light behavior, both BPM permissions, hard camera permission and fixed sleeves remain unchanged.

### B: complete HONEY mood-drive inventory

`presets/Cinema2HoneyPreset.ts` uses the existing `withCinema2MoodDrives` enabled parameter `honey-auto-performance`, with strength `honey-audio-reactivity` (saved value) and the existing Pattern Change/Trigger targets. Exactly one standard Auto toggle, default unchanged (off). All entries below use existing shared multiply operations: factors are interpolated from neutral 1 by source strength and saved reactivity, combined by the existing resolver and clamped to the authored control range. Drives never add a positive offset to zero. The normal catalog coverage wrapper remains unchanged; the isolated HONEY manifest compiled with that same wrapper reports 21 eligible controls, no uncovered target and no additional coverage drives. This is an isolated manifest audit, not a successful import of the full production catalog (see blockers below). All numeric drives target real consumers, not UI-only values. No color drive, permission drive, new persistent control or topology rebuild.

| Target / consumer | Default [range] | Shared mood source: full factor | Effect |
|---|---|---|---|
| motion / native solver | .72 [0,1] | activity 1.30; calm .65; silence .65 | physical displacement permission/amount |
| coverage / native field | .72 [0,1] | activity 1.25; calm .72; silence .60 | active cell distribution |
| rate / native clock input | 1 [.25,2] | drive 1.32; calm .70 | procedural progression |
| attack / native solver | .14 [.04,.50] | shock .65; calm 1.40 | mechanical attack seconds |
| release / native solver | .55 [.15,1.20] | calm 1.45; drive .72 | mechanical settle seconds |
| elevation / native solver | 1 [0,1] | calm .62; peak 1.12 | axial amplitude |
| rotation / native solver | .65 [0,1] | complexity 1.22; calm .70 | bounded local rotation |
| tilt / native solver | .65 [0,1] | tense 1.28; calm .68 | bounded local tilt |
| separation / native solver | .65 [0,1] | peak 1.30; calm .70 | local lateral clearance |
| width / pattern field | 1 [.5,1.5] | build .70; peak 1.25 | spatial width |
| delay / pattern field | .125 [.0625,.25] | build 1.35; drive .72 | cell timing offset |
| masterIntensity / native emitters | 1 [0,2] | peak 1.16; calm .80 | overall physical light |
| audioReactivity / native audio | .8 [0,1] | activity 1.18; calm .75 | overlay amplitude |
| outerGain / native emitters | 1 [0,2] | peak 1.18; calm .76 | outer channel intensity |
| innerGain / native emitters | 1 [0,2] | brightness 1.25; calm .80 | inner channel detail |
| underGain / native emitters | 1 [0,2] | build 1.22; shock 1.18; calm .72 | underlight tension/impact |
| lightSpill / native neighbor lighting | .65 [0,1] | peak 1.18; calm .78 | bounded local warm spill |
| honey-ambient.intensity / shared light | .48 [0,1] | calm 1.15; peak .85 | shadow fill |
| honey-bloom.intensity / shared effect | .30 [0,1] | peak 1.30; calm .70 | HDR bloom strength |
| honey-ao.intensity / shared effect | .65 [0,1] | build 1.18; peak .82 | contact depth |
| camera control.motionAmount / shared camera | .55 [0,1] | activity 1.15; calm .68 | slight lateral sway only |

All rows are authorized only when shared Auto is enabled and mood is available; authored reactivity zero neutralizes their contribution. Parameter ranges are existing saved-control bounds (not new limits). The existing Inspector model provides locks and live resolved values for Design/Effects/Master Controls, except standard Auto/BPM Sync and other contract-defined exceptions; Palette stays editable and persists. Quality, pattern enums and hard permission switches use their existing shared contracts, not numeric mood drives. Pattern policy is the existing `Cinema2PatternControlResolver` with actual mood and grid; silence holds its prior valid state, unavailable mood/grid falls back to saved values. No local override of authored controls or shared policy. Manual edits through supported paths remain authoritative as prescribed by the existing pattern controller. P05 inventory supersedes the historical partial mood bindings above.

### Validation, actual output and outstanding gates

- New `Cinema2HoneyAutoPerformance.test.ts` contains six focused cases: isolated compiled coverage and Director routes; identical audio/different Director significance with missing authority neutral; real canonical build/drop decay, event identity and manual/Auto boundaries; all eligible numeric targets varied/restored through actual shared mood/resolver and native lifecycle; actual Mood Conductor silence/return and missing-grid fallback; hard-off controls, shared Inspector model, palette, saved state and re-entry. `__tests__/support/HoneyRuntimeFixture.ts` extracts the existing P04 runtime fixture (default unchanged), uses actual compiler, bridge, Director, choreography, camera, module lifecycle and optionally actual Mood Conductor; renderer injection captures actual native cell records, not pixels. Existing HONEY audio regression cases remain in place.
- Six P05 cases and existing focused HONEY/Director/choreography/pattern/lock cases executed with actual TypeScript source via temporary transpilation loader and limited assertion adapter (not Vitest). 115 distinct passing cases after correcting two missing adapter matchers; three suite imports blocked by missing `@supabase/supabase-js` (`Cinema2HoneyPreset`, `Cinema2AutoCoverage`, `Cinema2AutoPerformanceInventory`). No remaining executed assertion failures. Actual full registry/catalog, full Inspector browser interaction and hardware performance remain unverified.
- `npm ci --offline --ignore-scripts --no-audit --no-fund` failed ENOTCACHED (`zustand@5.0.13`); `npm exec --offline -- vitest run` for requested suites failed ENOTCACHED (Vitest). Targeted strict `tsc` with temporary config excluding missing Vite types reported no HONEY production-file diagnostics; missing dependency/type diagnostics remain, including Vitest for HONEY tests. Full typecheck is not passed. `node --check scripts/run-cinema2-honey-browser.mjs` passed.
- `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts` and `scripts/run-cinema2-honey-browser.mjs` extend the existing production-path harness with actual canonical fixtures for calm/build/drop/release/silence/return, missing grid, Auto locks/live values, saved palette and re-entry. Production launch blocked by missing `@playwright/test`. No production screenshots or visual review achieved this phase; numerical native cell comparisons are not visual approval. Prior P04 native draw observations remain historical only. The current ZIP did not contain the original HONEY video and it was not recovered by Library search; P01 reference observations remain the design basis. No fresh video decode, no claims of visually verified P05 output or measured FPS.

| Gate | Result |
|---|---|
| A Director route/availability, bounded envelopes, matched audio significance and transport | Focused source/native state assertions pass; visual production comparison blocked. |
| B shared Auto coverage, numeric restoration, pattern policy and Inspector | Isolated compiled HONEY coverage and focused source tests pass; full catalog and browser gates blocked. |
| P05 regression | 115 distinct adapter assertions/cases pass; 3 suite imports blocked; actual Vitest/typecheck incomplete. |
| P05 final | Candidate patch only, production acceptance not passed; no human approval or release claim. |

Local validation commands, from project root after applying with dependencies installed:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Honey{AutoPerformance,Audio,Preset,Patterns,Layout,Geometry,Materials,Lighting,LocalLight,Controls}.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2{VisualDirector,ChoreographyRuntime,AutoCoverage,AutoPerformanceInventory,AutoPerformanceLock,PatternAutoPerformance,PatternControlPolicy}.test.ts
node scripts/run-cinema2-honey-browser.mjs
```

Exact P05 changed files (C2 relative unless root): `modules/honey/Cinema2HoneyPerformance.ts`, `modules/honey/Cinema2HoneyAudio.ts`, `modules/honey/Cinema2HoneyOrchestration.ts`, `presets/Cinema2HoneyChoreography.ts`, `presets/Cinema2HoneyPreset.ts`, `__tests__/Cinema2HoneyAudio.test.ts`, `__tests__/Cinema2HoneyAutoPerformance.test.ts`, `__tests__/support/HoneyRuntimeFixture.ts`; root `src/test/browser/Cinema2HoneyProductionBrowserHarness.ts`, `scripts/run-cinema2-honey-browser.mjs`, `docs/cinema2-honey.md`. Native module itself consumes the existing orchestrator and needed no separate edit. No binaries or shared changes.

Single-patch verification: staged whitespace check, `git apply --check`, actual indexed application and byte-for-byte comparison of the full-index binary diff on a pristine disposable baseline worktree. Next prerequisite: apply and run actual tests and production visual captures; review reference and resulting performance before approval and Phase 06. Phase 06 must not be considered implemented by this patch.
