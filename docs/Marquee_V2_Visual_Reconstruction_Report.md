# MARQUEE V2 — Visual Reconstruction & Rendering Repair Report

Status: **AWAITING HUMAN APPROVAL.** The existing Cinema 2.0 MARQUEE preset now renders the V2 reconstruction through the production path with a recalibrated camera, rebuilt materials/lighting, sharp editable signage and batched fixtures. It is a large, evidence-backed improvement over the failing render, but it is **not** claimed to be reference-accurate (see "Remaining mismatches").

Evidence lives in `docs/Marquee/validation_v2/` (production captures) and the three-up comparison `Marquee_Reference_vs_Failing_vs_Corrected.png`. Every capture was taken from the real `Cinema2Runtime` production path (shared WebGL context, HDR scene → floor → haze → bloom → finish), not from an isolated model viewer.

## 1. Audit before the change

Inspected: preset manifest, native module, scene controller, asset registry/cache, `Cinema2ThreeSceneBridge`, effect parameters, production harness and acceptance script.

| Problem | Existing implementation | Root cause / evidence | Correction | Validation |
|---|---|---|---|---|
| Flat blockout, shallow canopy | `marquee-theater.glb`: the original blockout (1,833 nodes, 43 shared meshes, canopy soffit 1 box) | Asset. The blockout geometry has no pleated curtain, thin crown, no underside depth | Shipped the V2 reconstruction (true projecting canopy to z≈5.7, 444 individually placed canopy bulbs, 27 ribs, pleated curtain, 6-door entrance) | wireframe + normals captures; low-canopy view |
| Fixture mapping would silently break on V2 | Controller matched `bulbs.tower.left/right`, `bulbs.canopy.rNN.bNN`, names with dots stripped by the glTF loader | **Confirmed**: V2 renamed tower (`bulbs.tower.-1/1…`) and canopy (`row##.position##`) fixtures; towers matched nothing; canopy counts fell below the old 718 minimum | `Cinema2MarqueeFixtureMap.ts` understands V2 and legacy names; neon recognised by material; geometry-derived rows for towers | `Cinema2MarqueeRuntimeModel.test.ts` (fixture counts on the shipped GLB) |
| Patterns could not light bulbs independently | `bridge` clones one material per mesh; the controller wrote emissive per material, V2 shares one bulb material across 868 meshes | **Confirmed**; also ~1,600 meshes = ~1,600 draw calls | Runtime batching: one mesh per fixture family with a per-vertex emission attribute; statics merged per material | draw-call test (1,624 → <120 meshes); production CPU 9.05 → 3.9 ms |
| Overexposed sign / bloom | Letterboard `emissive` was a flat colour (`emissiveIntensity` up to 0.34) multiplied over the whole board **including the lettering**; bloom 0.64, threshold 1.2; unlit bulbs were cream and lit by the scene lights | Confirmed in code: no `emissiveMap`, so letters glowed as brightly as the board; bulbs' cream diffuse hid emission | `emissiveMap` = the text texture (letters stay dark); sign emission lowered; unlit bulbs are dark glass whose brightness is their own emission; bloom 0.5/threshold 1.35 | emission-off / bloom-off / bloom-on captures; lettering legible in all |
| Even "studio" lighting, daylight look | `environmentIntensity` 0.5 via the neutral studio IBL | Confirmed: facade was lit by an even fill | Module passes `environmentIntensity 0.07`; lights re-ordered/rebuilt (forecourt glow, wall washes, blue rim) | hero capture |
| Hero camera: empty frame, flat | `[0,3.15,20.5]` → `[0,4.7,1.2]`, FOV 39 | Confirmed by projection: tower tops at 0.13 H, ground line 0.85 H (reference 0.02 / 0.82) | `[0,1.7,19.2]` → `[0,4.35,0.3]`, FOV 40.5 | landmark table below |
| Wet-ground reflections absent | Reflective-floor effect `floorY -0.2` | Confirmed: V2 slab top is y≈-0.025, so the effect's plane was 0.17 below the ground | `floorY -0.025`; single continuous slab (the V2 curb/lowered road and 0.01 hairline joint rods tore the screen-space reflection) | floor crops |
| Letters tiny / blurry | 1024×220 canvas, mid-grey filtering, fixed sizes | Confirmed | 2048×440 canvas, anisotropy 16, trilinear mipmaps, condense-then-shrink fitting | text captures |
| Placeholder copy "DVYDRM PRESENTS / ONE NIGHT ONLY / LIVE PREMIERE" | Preset defaults | By design in the old preset | Defaults are now `DVYDRM`, `SHOWINGS`, `SHOWINGS`; saved overrides are untouched | preset test |

Not determined: why the baseline screenshot supplied with the task differs slightly from the regenerated baseline (the task image was not in the workspace; the "failing" panel is a regeneration from `HEAD`).

## 2. Model selection and mapping

* **Selected:** `DVYDRM_Marquee_HighFidelity_v2.glb`, rebuilt reproducibly with `scripts/cinema2-assets/build-marquee-runtime.mjs` from `scripts/cinema2-assets/marquee/build_marquee_runtime_model.py` (the owner's V2 builder plus changes marked `# RUNTIME DELTA`). The unmodified V2 package stays in `docs/Marquee/Marquee_Reconstruction_v2/`.
* **Rollback:** the previous runtime blockout is preserved at `docs/Marquee/DVYDRM_Cinema2_Theater_runtime_blockout_rollback.glb`; reverting `assets/cinema2/cinema2-marquee-theater/asset.json` to that file restores it (the controller still understands the legacy names).
* **Runtime deltas from V2** (builder diffs): thicker, proud stepped crown layers; fat blue/amber/red fluted crown fins and amber-flanked roof stripes; black panels behind the tower lenses and larger lenses; larger LED cells on black housings; one continuous polished forecourt slab (V2 curb, lowered road, reflection-lane slabs and 47 hairline joint rods removed because they z-fight/tear the floor reflection).
* **Texture caps** (documented, reproducible): brick albedo 1280 px, default sign planes 640 px (fallback only), velvet 1024. Budgets were **not** changed; the model needed these caps to fit the 19.2 MB low-tier asset budget.
* **Name mapping:** see `Cinema2MarqueeFixtureMap.ts` header. Counts on the shipped model: marquee front 90 / left 70 / right 70, canopy 444, towers 97 + 97, LEDs 171 + 171, neon red/amber/blue by material. The canopy has 444 bulbs (V2) rather than 718 (blockout).

## 3. Code and files

Added: `modules/marquee/Cinema2MarqueeFixtureMap.ts`, `…Batching.ts`, `…Look.ts`, `…Debug.ts`; `scripts/cinema2-assets/{build-marquee-runtime,capture-marquee,profile-marquee}.mjs`; `scripts/cinema2-assets/marquee/build_marquee_runtime_model.py`; `__tests__/Cinema2MarqueeRuntimeModel.test.ts`; `public/cinema2/models/marquee-theater-v2.glb`; `docs/Marquee/validation_v2/*`.
Modified: `Cinema2MarqueeSceneController.ts` (rewritten around the map and batching), `Cinema2MarqueeNativeModule.ts` (IBL level, default copy), `Cinema2MarqueePreset.ts` (hero camera, extra authored cameras, lights, effect parameters, copy defaults), `assets/cinema2/cinema2-marquee-theater/asset.json` + generated manifest/attributions, `MarqueeProductionBrowserHarness.ts` (dev-only camera/lighting/emission/geometry diagnostics), `accept-marquee-production.mjs`, `Cinema2MarqueePreset.test.ts`.
Untouched: pattern programs, pattern controller, trigger options, Inspector parameters and parents, choreography rules, Audio Intelligence plumbing, shared effects, other presets.

## 4. Geometry, camera, lighting, materials, signage

* **Geometry:** V2 canopy projects ~5.7 units; underside bulbs are individual meshes; wireframe/normal captures show depth with bloom disabled. Crown/tower/LED/roof-stripe strengthening via builder deltas.
* **Batching:** controller merges ~1,600 parts into 11 fixture-family meshes + merged static meshes (≈60 draw calls); each authored node keeps a vertex range. V2 has no normals, so creased normals are derived (boxes stay hard, bulbs/tubes/crown smooth).
* **Camera:** hero `[0,1.7,19.2]`→`[0,4.35,0.3]`, FOV 40.5, safety bounds and motion preserved; left/right three-quarter and low-canopy cameras added as authored (non-default) cameras. There is no runtime camera-selection UI in Cinema 2.0 (the manifest default decides), so those exist for capture/look-development only.
* **Materials:** brick gets a derived relief normal map (from the albedo; no source normal map exists), tint equals 1 at the default Architectural Accent; velvet tinted by Marquee Red; glass translucent/glossier; ground roughness driven by the reflection control; interior windows emit warm light.
* **Lighting:** separate values in `Cinema2MarqueeLook.ts` for structural light, bulbs, neon, letterboard, interior, and IBL; bloom is a separate effect. Fixture level = base + peak·gain^1.8 so travelling patterns stay distinguishable. Zero Master Intensity is dark.
* **Signage:** three independent `CanvasTexture`s (2048×440) on `marquee.front/left/right.TEXT_SURFACE`; regenerated only when that face's text or the red palette changes; no GLB reload; lettering never touched by patterns/auto performance; saved text preserved; blank text allowed.

## 5. Landmark comparison (16:9 hero vs reference, fractions of frame height; reference read by eye from the 4:3 image)

| Landmark | Reference y | Failing (HEAD) y | Corrected y |
|---|---|---|---|
| Tower top | 0.02 | 0.13 | 0.05 |
| Front board top | 0.34 | 0.40 | 0.34 |
| Side-wing outer corner top | 0.44 | 0.46 | 0.41 |
| Canopy front underside | 0.52–0.60 | 0.60 | 0.55 |
| Entrance door top | 0.65 | 0.67 | 0.62 |
| Ground line | 0.82 | 0.85 | 0.80 |

Horizontal positions cannot be compared directly (4:3 vs 16:9); the front-board half-width to wing-outer half-width ratio is 2.15 in the reference and ≈1.7 in the render.

## 6. Validation

| Check | Result |
|---|---|
| Marquee Vitest (`Cinema2MarqueePreset` 5, `Cinema2MarqueeRuntimeModel` 9) | PASS — 14/14 |
| Whole `src/components/vyzualz/cinema2` Vitest | 1,115 tests: 40 failing in 16 files, the same count and file count recorded for the repository before this work (Inspector panel, production path, Afterhours/Interlock/Reactor rendering, etc.; none are MARQUEE). One MARQUEE test failed in that run (Master Intensity 0 still left a base glow); it was a real bug, fixed (base glow now scales with Master Intensity and zone), and the two MARQUEE files were re-run green. The failing-file list was not diffed file-by-file against `HEAD`, only counted |
| `assets:check` | PASS (20 assets, 71.15 MB; budgets unchanged) |
| ESLint on touched files | PASS |
| `npm run visual:marquee:production` (`artifacts/cinema2-marquee-acceptance/run-nyJMkA`, run before the Master-Intensity-0 fix, which changes no structure) | PASS — 21 captures at 1920×1080 and 2048×1041, high/medium/low, all seven patterns distinct per hash, independent/long/empty copy, resize, WebGL context loss and recovery (`contextGeneration: 2`), missing-asset diagnostic |
| Performance (1080p high, headless Chrome, this Mac) | CPU 3.84 ms/frame (was ≈9.05 ms), GPU 14.4 ms mean over 12×30 frames (was ≈14.1 ms), wall 16.6 ms (vsync); module GPU residency 38.2 MB (was 16.0 MB; batched copies, sign and relief textures) within the 256 MB budget |
| Lighting debug captures | `01b` neutral lighting + emission off, `02` emission off, `03` emission on / bloom off, `04` bloom on, `01` production |
| Signage test | `08` three different strings, `08b` only the left changed (front/right textures identical objects in the unit test), `08c` long front copy |
| Audio-reactive captures | `09a` canopy cascade, `09b` premiere burst (different moments/patterns) |

"Neutral lighting" in `01b` is a diagnostic manifest variant (white ambient + one white key) with emission off. `02` keeps the production warm lights with emission off.

## 7. Gate results

| Gate | Result | Evidence / note |
|---|---|---|
| A — Geometry | **PASS (pending human approval)** | projecting canopy with visible bulb rows, crown, towers, curtain, six doors in neutral and wireframe/normal captures. Crown is still smaller and less stepped than the reference |
| B — Camera | **PASS (pending human approval)** | all three faces, canopy underside, both towers, crown and entrance in the 16:9 hero; landmark table |
| C — Materials | **PARTIAL** | brick, velvet, glass, trim distinguishable; brick/stone remain flat-coloured, no authored normal/roughness maps; entrance glass dull |
| D — Lighting | **PASS (pending human approval)** | bulbs distinct with bloom off and on; lettering legible in every mode; sign not a white rectangle (it is warm ivory) |
| E — Signage | **PASS for rendering and unit tests; NOT TESTED through the real Inspector UI** | production captures set text via parameter state, the same state the Inspector writes |
| F — Cinema 2.0 regression | **PASS for covered paths** | all seven patterns distinct, fixture mapping intact, choreography/trigger/palette code untouched, `Cinema2MarqueePreset` and acceptance green |

## 7a. Post-review correction: floor glitching with audio

Owner report: with audio playing the floor showed horizontal black streaks that flickered. Cause (confirmed by captures): I had tuned the reflective-floor effect with `streak 0.5`, `samplingStability 0.85`, `edgeFallback 0.6`. The streak path smears each ray sample vertically and the stochastic sampling re-jitters every frame, so rows where a ray missed fell back to the near-black sky colour and the pattern changed whenever the emissive LEDs and bulbs changed with the music. The captures I took at one audio moment hid this and I wrongly logged it as a minor artifact. Fix: `streak 0`, `samplingStability 1` (fixed samples), `edgeFallback 0`. Verified with five production captures at different audio moments (0.5, 1.25, 2.6, 3.1, 4.4 s): no streaks and no frame-to-frame change in the floor. Two tiny static dark specks remain on the floor (about 10 px wide) and are not yet explained. They do not move or flicker.

## 8. Remaining mismatches and limitations

* Facade, pilasters and cornices are simpler than the reference (no engraved relief on stone, flat tan limestone); brick colour is more saturated than the reference's brown-orange.
* Crown: thicker and with fat fins, but not the stepped red/amber/blue stack of the reference.
* Marquee side wings are shorter in projection than the reference (ratio 1.7 vs 2.15).
* Windows and storefronts: lit but flat; the reference has visible interiors, furniture and coloured door interiors.
* Wet street: the screen-space floor reflection can only mirror what is on screen; at this framing the marquee's reflection falls below the frame, so only a warm light pool and the low facade reflect. The reference's strong coloured street reflections are **not** reproduced.
* Letterboard reads warm ivory rather than reference white.
* Entrance LED columns are dimmer and less saturated than the reference's glowing red/yellow panels.
* Left/right three-quarter views show void beyond the 27-unit facade, and a small screen-space reflection artifact remains at the bottom of the low-canopy view.
* "Neutral lighting" is a diagnostic variant, not a flag in the production manifest; headless-Chrome GPU timings are indicative only.
* Python (trimesh, numpy, Pillow, shapely) is needed only to rebuild the model; the built GLB is committed.
* The V2 builder was not executed in Blender (not used); the package's Blender script remains unverified.
* Not tested: other GPUs/OS/browsers/Electron; Inspector UI interaction; real audio playback (the harness publishes a deterministic Audio Intelligence frame).

## 9. Human approval

**Outstanding.** Please compare `docs/Marquee/validation_v2/Marquee_Reference_vs_Failing_vs_Corrected.png` and the hero/view captures with the approved reference. Automated measurements here support, but do not replace, that approval.

## 10. Commands

```
node scripts/cinema2-assets/build-marquee-runtime.mjs     # rebuild the shipped GLB (MARQUEE_PYTHON=<venv python>)
npm run assets:build && npm run assets:check
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2MarqueePreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MarqueeRuntimeModel.test.ts
node scripts/cinema2-assets/capture-marquee.mjs all <outDir>   # hero | views | modes | text | audio | all
node scripts/cinema2-assets/profile-marquee.mjs high
npm run visual:marquee:production
```
