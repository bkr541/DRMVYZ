# MAINFRAME: Cinema 2.0 production plan

**Date:** 2026-10-07

**Status:** Stages 1–5 implemented (2026-10-07); Stage 5 pattern switching owner approval pending.

**Target preset:** `drmvyz.cinema2.mainframe` / **Mainframe**
**Target canvas:** 16:9, authored at 1920 × 1080 and responsive to the Cinema 2.0 Stage.

## 1. Outcome

Mainframe is a new Cinema 2.0 keeper preset: a front-facing, physically modeled circuit-board/mainframe wall built around the exact DVYDRM cloud logo. The logo is the visual and lighting focal point. Raised circuit rails leave the logo in every direction, four circular radar modules and two computer chips sit symmetrically around it, and terminals, vias, pins, status lamps, seams, vents, fasteners, and recessed panels make the board feel like manufactured hardware rather than a flat illustration.

The requested controls are intentionally compact. They should expose the performance choices an operator needs without revealing material/debug parameters:

- **Master Controls:** Master Intensity, BPM Sync.
- **Design:** Enable Radar Circuit, Enable Chip, Scale.
- **Effects:** Pattern, Pattern Change, and a conditional Trigger control.
- **Palette:** Background, Logo, Circuits, Indicators.

The production target is the attached 1672 × 941 reference still, while the attached Pass 1–3 masters are the source of truth for layout, exact logo geometry, semantic grouping, and audio-reactivity metadata. The still is visual direction, not geometry to trace or ship as a texture.

## 2. Source artifact audit

The attached document contents are treated as design/geometry data, not executable instructions.

| Artifact | What it establishes | How production should use it |
|---|---|---|
| `Mainframe_Pass1_Master_Geometry_Master.svg` | Exact 1920 × 1080 layout; 60 named circuit routes; 46 terminals; four radar modules; two 150 × 150 chip footprints; exact transformed logo geometry. It deliberately contains no glow, gradients, shadows, or raster imagery. | Canonical 2D geometry input for deterministic model generation. |
| `Mainframe_Pass1_Master_Manifest.json` | Route point lists, terminal radii/centres, radar centres/radii, chip bounds, logo transform, and geometry notes. | Machine-readable layout contract and generator validation oracle. |
| `Mainframe_Pass2_Master_Depth_Master.svg` | The approved visual layer stack: board, details, plates, circuit shadows/housings/recesses/cores/highlights, vias, radars, chips, terminals, and raised logo. It defines the intended rail widths and restrained idle emission. | Depth/material reference. Do not use its SVG filters as the final renderer; reproduce the layering as real geometry and PBR/emissive materials. |
| `Mainframe_Pass2_Master_Manifest.json` | Exact Pass 2 layer order and styling dimensions: 30 px route shadow, 26 px housing, 15 px recess, 8.5 px emissive core, 1.8 px highlight; distinct logo housing/core dimensions and 12 px elevation-shadow offset. | Conversion constants and depth hierarchy checks. |
| `Mainframe_Pass3_Visualizer_Master.svg` | Runtime-ready semantic IDs and data attributes layered over the Pass 2 geometry. It groups static board, circuits, components, terminals, logo, and effects and normalizes route lengths for chases. | Semantic naming reference; its identity/bank/region/signal data must survive in generated metadata or GPU attributes. |
| `Mainframe_Pass3_Pass3_Reactivity_Map.json` | Four balanced circuit banks, eight regions, seven continuous signals, event impulses, component membership, and the intended center-to-edge chase contract. | Canonical reactivity and choreography map. |
| Attached PNG reference | Surface quality, composition, lighting hierarchy, green-white emissive cores, brushed/chamfered metal, deep recesses, dense mechanical detail, symmetry, and logo prominence. | Perceptual acceptance reference only. |

### Confirmed authored counts and groups

- 60 circuit routes: 20 major side routes, 12 minor side routes, 12 top/bottom centre routes, and 16 branches.
- Circuit banks A/B are balanced alternating major routes; C contains minor routes; D emphasizes branch routes.
- Eight regions: left/right major, left/right minor, top/bottom centre, and left/right branch.
- 46 terminals, each with independently addressable core/dot lighting in Pass 3.
- 36 via positions represented by 72 vector elements (ring + core).
- Four radar modules with concentric rings, a centre, four spokes, and four nodes each.
- Two chips with a die, 24 pins, and an orientation marker each.
- Three reactive logo lighting parts: outer contour, cloud body/spirals, and star.
- Continuous sources: sub energy, bass, mids, highs, spectral flux, vocal presence, and build progress.
- Authored event intent: kick → terminals; snare → logo outline; beat → alternating circuit banks; four-beat → radars; eight-beat → logo body; phrase → full-board chase/chip activation; drop → global energy jump with logo priority.

## 3. Visual target

### Composition

- Keep the logo centred and dominant, approximately 40–45% of frame width at the default Scale.
- Preserve the strong mirror symmetry without making the lighting perfectly uniform. A small left/right key-to-rim imbalance is needed for readable bevels.
- Circuits should appear to originate beneath/behind the logo and travel outward to all four edges.
- The four radar assemblies sit in the upper-left, upper-right, lower-left, and lower-right fields. The two chips sit mid-left and mid-right.
- Preserve meaningful content near all edges, but protect the logo and primary routes in non-16:9 Stage crops.

### Physical depth stack

From back to front:

1. A near-black circuit-board substrate with subtle roughness variation.
2. Recessed panel fields, seams, vents, honeycomb perforations, and plate breaks.
3. Dark circuit channels and contact-shadow cavities.
4. Raised gunmetal trace housings with bevelled edges.
5. Recessed translucent/emissive trace cores plus narrow specular highlights.
6. Vias, terminals, chip sockets/pins, and radar housings at multiple elevations.
7. A deeply raised DVYDRM logo with a dark rear cavity, polished metal face/rim, and inset emissive channel.

The Pass 2 SVG's fake offset shadows are useful depth cues, but the production asset must use actual z separation, bevels, PBR lighting, and real shadow maps. SVG blur filters should not be rasterized into the model.

### Material and lighting language

- **Board:** dark charcoal/black, mostly dielectric, rough and slightly varied rather than flat green.
- **Housing and hardware:** gunmetal/chrome with different roughness values so bevels separate from face planes.
- **Emissive channels:** saturated user-selected Circuit colour at the edge, rolling to a near-white HDR core at high intensity.
- **Logo:** user-selected Logo colour applied to its emissive inset; its structural metal remains readable and should not become a flat colour silhouette.
- **Indicators:** user-selected Indicator colour applied to terminals, vias, radar centres/nodes, chip pins/markers, and status lamps.
- **Lighting:** neutral studio environment plus restrained area/key/rim lights. Emission supplies the coloured look; general illumination should not wash the board green.
- **Finish:** deep blacks, preserved metal midtones, selective HDR bloom, a subtle vignette, and restrained grain. No heavy chromatic aberration.

### What “3D” means for this preset

The target does not require a freely orbiting scene. It does require real geometry, perspective, parallax across the depth stack, bevel highlights, self-occlusion, contact shadows, material response, and bloom from HDR emissive surfaces. A shallow hard-surface wall viewed by a mostly orthographic-feeling perspective camera is the correct production approach.

## 4. MVP control contract

All controls live in the existing Cinema 2.0 Design surface and use the existing `designParentGroup` contract.

| Parent group | Control | Type / range | Default | Required semantics |
|---|---|---:|---:|---|
| Master Controls | Master Intensity | Float, 0–1 | 0.8 | Scales all emissive output and music-driven lifts. At 0, hardware remains visible under neutral scene light but reactive emission is off. |
| Master Controls | BPM Sync | Boolean | On | On uses the track beat/bar grid. Off, or no usable grid, runs temporal patterns from a stable 120 BPM free clock. Pause holds the current choreography frame. |
| Design | Enable Radar Circuit | Boolean | On | Shows/hides all four complete radar assemblies, including housings, rings, nodes, and their light. No orphan glow or shadow remains. |
| Design | Enable Chip | Boolean | On | Shows/hides both chip assemblies, sockets, pins, and associated indicators. Circuit routes remain present. |
| Design | Scale | Float, 0.45–1.35 | 1.0 | Camera-relative zoom about the logo centre. It must not rescale timing, glow width, or UI. The extended physical wall keeps covering the Stage at the deepest zoom-out. |
| Effects | Pattern | Enum, six options | Outward Bus | Selects the active authored lighting choreography immediately and resets that pattern to a deterministic start boundary. |
| Effects | Pattern Change | Boolean | Off | Off keeps the selected Pattern authoritative. On allows Trigger events to advance to a different pattern. |
| Effects | Trigger | Enum | Every 4 Bars | Visible only while Pattern Change is On. Uses exactly the Afterhours 2.0 trigger choices listed below. Each qualified event advances deterministically through a shuffled six-pattern cycle with no immediate repeat. |
| Palette | Background | Colour | Near-black green-charcoal | Tints the physical board/substrate while retaining roughness, shading, and metal separation. |
| Palette | Logo | Colour | Lime green | Controls logo emission/accent colour, not the whole logo material. |
| Palette | Circuits | Colour | Lime green | Controls trace-core emission. |
| Palette | Indicators | Colour | Lime green | Controls terminals, vias, radar nodes/centres, chip pins/markers, and small lamps. |

### Trigger options copied from Afterhours 2.0

The Mainframe Trigger enum should reuse the canonical Cinema 2.0 IDs and user-facing labels instead of creating a similar private list:

| ID | Label |
|---|---|
| `beat` | Beat |
| `kick` | Kick |
| `snare` | Snare |
| `downbeat` | Downbeat |
| `beat2` | Every 2 Beats |
| `beat4` | Every 4 Beats |
| `bar` | Bar |
| `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars |
| `phrase` | Phrase |
| `drop` | Drop |

The Inspector already supports conditional `visibleWhen` rules, so Trigger can be hidden with a `Pattern Change == true` condition without bespoke React UI.

## 5. Six lighting patterns

Each pattern controls the same physical lighting systems; it does not replace geometry. Continuous band energy provides low-amplitude texture underneath the authored sequence, while musical events create clear accents. Idle emission should remain around 0.35–0.60 effective intensity so drops retain headroom, matching the Pass 3 guidance.

1. **Outward Bus** — Logo star/body ignites, then circuit fronts travel from the centre toward every edge. Terminals fire as the front reaches them; radar rings and chip pins finish the phrase. This is the default and clearest expression of the requested centre-out motion.
2. **Inward Boot** — Edge terminals and minor routes wake first, then mirrored routes converge through chips/radars into the logo. The logo produces a short resolved hold on the next downbeat.
3. **Bank Alternator** — Banks A and B trade on beats, C fills subdivisions, and D branches answer on snares. Radar diagonals alternate every four beats while the logo breathes underneath.
4. **Quadrant Relay** — Upper-left → upper-right → lower-right → lower-left relay around the board, with symmetric counter-pulses on strong downbeats. Chip and radar modules inherit their quadrant state.
5. **Radar Sweep** — Concentric radar rings sweep outward on four-beat boundaries; spokes hand energy into nearby circuit regions. High-frequency transients sparkle in vias/indicator dots while major traces remain restrained.
6. **System Surge** — A sparse pre-charge builds through top/bottom centre routes, then a full-board HDR impact on downbeats/drops with a controlled decay. This is the peak-energy pattern, not a continuous all-on state.

Pattern behaviour must be deterministic for a given runtime seed and musical position, stable through resize, and discontinuity-safe after seeking, source replacement, pause/resume, or context restoration.

## 6. Recommended production architecture

### 6.1 Dedicated native module

Implement a `mainframe-native-render` Cinema 2.0 module rather than forcing Mainframe through the generic `three-scene` module.

Reasons:

- The preset needs independent, efficient addressing of 60 routes, 46 terminals, four multi-part radars, two chips, vias, and three logo zones.
- Radar/chip toggles must remove complete assemblies, including shadows and emission.
- Six purpose-built patterns need bank, region, route progress, system, and signal awareness.
- Per-route animation should update a small uniform/texture/instance buffer, not clone or mutate dozens of materials every frame.
- A dedicated module can still reuse Cinema 2.0's renderer host, shared WebGL context, asset cache, camera, light environment, quality level, diagnostics, audio intelligence, and resource lifecycle. It must not create a second canvas, renderer, animation loop, or audio analyser.

### 6.2 Deterministically generated hard-surface asset

Create a repository-owned generator, proposed as `scripts/cinema2-assets/generate-mainframe.mjs`, and keep canonical source copies under `scripts/cinema2-assets/sources/mainframe/`. The generated model should be shipped through the existing `assets/cinema2/<id>/asset.json` pipeline as `cinema2-mainframe`.

The generator should reuse the existing Cinema 2.0 asset helpers:

- `cinema2-svg-relief-kit.mjs` for exact SVG path extraction, nesting, bevelled extrusion, and logo relief.
- `cinema2-hard-surface-kit.mjs` for rounded boxes, lathes, placement, mirroring, and merged geometry.
- The existing GLB writer and custom vertex-attribute conventions used by CONDUIT and RELIQUARY.

Recommended model parts/material families:

- `board`, `plates`, `recesses`, `housings`, `hardware`;
- `circuitCores`, `indicatorCores`, `radarCores`, `chipCores`, `logoCore`;
- `radarHardware`, `chipHardware`, `logoHousing`.

Recommended custom GPU metadata:

- `_GLOW_PHASE`: normalized travel from logo/region origin to route end.
- `_MAINFRAME_ROUTE`: route identity encoded into a stable scalar/index.
- `_MAINFRAME_BANK`: A/B/C/D.
- `_MAINFRAME_REGION`: the eight authored Pass 3 regions.
- `_MAINFRAME_SYSTEM`: circuits, terminals, vias, radar, chip, logo outer/body/star.
- Optional `_MAINFRAME_SEED`: stable per-component variation for indicator twinkle without frame-random noise.

The 2D source coordinates should map into a consistent wall plane centred at world origin, with SVG +Y inverted into world +Y. Depth values must be explicit constants derived from the Pass 2 layer order. Generator tests should fail on count drift, missing IDs, changed logo path data, non-finite vertices, or out-of-budget triangles.

### 6.3 Renderer and shader strategy

- Render opaque physical hardware with shared indexed geometry and a small set of PBR materials.
- Render emissive cores with one or a few draw calls per system and custom shader attributes/uniforms. Avoid one material per route.
- Use the track/audio frame already normalized by `Cinema2AudioIntelligenceBridge`.
- Run pattern planning on the CPU as a pure deterministic state function; pass compact current/previous pattern state, phase, event envelopes, band values, and colours to the GPU.
- Use analytic route progress in the shader to reveal/chase core light. Do not animate SVG dash arrays in production.
- Use Cinema 2.0 shadow maps for logo/component cast shadows and board receive shadows. Keep the straight-on camera slightly offset and use asymmetric key/rim lights so bevel depth remains visible.
- Render to `rgba16f` with `rgba8` fallback. HDR emission should exceed 1.0 only in reactive cores; filmic finishing handles the white-hot centre.
- Proposed render graph: **Mainframe scene/depth → HDR bloom → cinematic finish**. Add glare only if review shows bloom cannot reproduce the tight hot-core flare; do not add haze, floor reflection, trails, or depth of field to the MVP.
- If modeled recesses plus the existing shadow service do not provide enough cavity depth, add a small Mainframe-local baked/vertex AO term before considering a new engine-wide SSAO effect.

### 6.4 Preset manifest and registration

Create `Cinema2MainframePreset.ts` with:

- required `render.webgl2`, `render.depth`, `scene.3d`, and `camera.world` capabilities;
- optional music capabilities matching the eleven trigger sources and the Pass 3 signal/event map;
- the exact MVP parameter schema above;
- one `mainframe-native-render` module with parameter bindings;
- a static, front-facing world camera whose distance/FOV is modified by Scale;
- a neutral environment and a small key/rim/fill light rig;
- float scene and bloom targets plus the existing filmic finish;
- keeper registration in `Cinema2FirstPartyPresetCatalog.ts`.

The module and preset should share a small Mainframe domain package for IDs, parsed production metadata, pattern definitions, clock semantics, and pure validation.

## 7. Implementation stages

Each stage ends with one focused validation pass. Do not begin a later stage until the current stage's visual/contract gate is accepted.

### Stage 1 — Canonical source ingestion and geometry contract

1. Copy the owner-supplied Pass 1–3 SVG/JSON files into a repository source folder with provenance notes; do not edit the masters in place.
2. Add a parser/normalizer for the 1920 × 1080 route/component contract.
3. Validate the exact 60 routes, 46 terminals, four radars, two chips, 36 vias, three logo parts, four banks, eight regions, and referenced selectors/IDs.
4. Produce a lightweight debug layout render or generator audit showing bounds, IDs, banks, and regions.

**Gate:** deterministic parsing; all counts/IDs match; exact logo path data and 16:9 coordinate system are preserved; no runtime code yet.

**Completed 2026-10-07; extended 2026-10-08:** The eight owner-supplied source artifacts are preserved under `scripts/cinema2-assets/sources/mainframe/` with immutable SHA-256 provenance. `mainframe-source-contract.mjs` loads and validates the cross-pass layout, exact logo paths, route coordinates/layers/metadata, component counts, systems, banks, regions, full-canvas bounds, and the later 3840 × 2160 extension master. The extension contract also proves that the accepted center routes and logo remain unchanged. `audit-mainframe-sources.mjs` emits the deterministic source audit, and the focused node test covers the contract.

### Stage 2 — Production 3D asset generator

1. Build the substrate, recessed plates, seams/vents, raised trace housings, core channels, terminals/vias, radar hardware, chip hardware, and layered logo.
2. Add bevels and deliberate z separation using the Pass 2 layer order.
3. Emit named model parts and custom attributes for systems/banks/regions/route progress.
4. Generate high/medium/low variants only where measured geometry cost justifies them; prefer shared instancing and merged indexed parts first.
5. Register the asset and run existing asset budget/provenance checks.

**Gate:** front and shallow three-quarter neutral-light renders prove real depth, intact logo geometry, complete component counts, clean symmetry, no z-fighting, no detached parts, and no silhouette regression against Pass 1.

**Completed and accepted 2026-10-07; extension integrated 2026-10-08:** `generate-mainframe.mjs` deterministically converts the source contract into a 149,932-triangle, 7.81 MiB GLB with 13 named merged parts. It models the original substrate, plates, recesses, 60 routes, 46 terminals, 36 vias, four radar assemblies, two chips, and exact three-part logo relief, then adds the owner-authored extension's 356 routes, 30 plates, 16 radar modules, eight chips, and 584 reactive terminal elements. Four secondary daughterboards replace the empty north/south outer bays: the upper pair uses controller and heat-sink detailing, while the lower pair uses power-regulator and capacitor detailing. These assemblies share the existing Chip toggle and reactive chip system. Four larger symmetric power-regulation nodes fill the remaining inner bays; each combines a raised housing, inductor and capacitor hardware, high-frequency reactive rings and connector pads, plus kick-reactive corner lamps. Their face-plane dimensions were subsequently increased by 80% while preserving their centers and depth. The exact central composition remains unchanged; the authored extension fills the 2× visual field while the 2.5× physical substrate preserves guaranteed deep-zoom coverage. Route/system/bank/region/progress attributes are embedded for runtime use. The registered `cinema2-mainframe` asset remains inside the shared file and triangle budgets.

### Stage 3 — Native renderer and static visual match

1. Add the Mainframe native module, shared-context resource lifecycle, model loading, quality-tier handling, and diagnostics.
2. Implement PBR materials, environment lighting, key/rim/fill lights, component visibility masks, shadow casting/receiving, and Scale camera mapping.
3. Add HDR emissive materials for the logo, circuits, and indicators.
4. Add HDR bloom and filmic finishing with restrained defaults.
5. Wire Background, Logo, Circuits, Indicators, Enable Radar Circuit, Enable Chip, Scale, and Master Intensity.

**Gate:** the unanimated resting frame matches the reference hierarchy at 1920 × 1080 and the owner Stage aspect: deep board, readable recesses and bevels, dominant raised logo, clear chip/radar silhouettes, restrained idle light, and no clipped green wash.

**Completed and accepted 2026-10-07:** Mainframe is registered as a keeper preset backed by the dedicated `mainframe-native-render` module. It loads the production GLB through the shared Three asset cache and renderer context, reports GPU residency, uses PBR material families and neutral environment/key/rim/fill lighting, casts and receives real shadows, and renders through float HDR bloom plus filmic finishing. The Stage 3 Inspector surface contains Master Intensity, both complete component toggles, Scale, and the four independent palette controls. Deterministic production-path captures at 1920 × 1080, portrait, ultrawide, and a components-off/Scale state are emitted under `artifacts/cinema2-mainframe-stage3/`. Progression to Stage 4 records acceptance of this static-render checkpoint.

**Framing corrections 2026-10-07; authored extension 2026-10-08:** Mainframe uses cover framing rather than the engine's 16:9 fit-to-width camera constraint. Narrow Stages intentionally crop the left/right model extent and wider Stages crop top/bottom, so the physical wall always continues past every visualizer edge. A 12% default overscan reserve supports later motion. The Design Scale range reaches 0.45, the physical substrate extends to 2.5× the original width and height, and the visible outer architecture now comes from the supplied 2× extension master rather than procedural route continuation. The prior 1000 × 1200 production-path capture at Scale 0.45 verified top/bottom coverage; it should be refreshed for visual approval of the new authored outer hardware.

### Stage 4 — Reactivity engine and six patterns

1. Convert the Pass 3 signal/event map into typed pure runtime data.
2. Implement event envelopes with the authored attack/release intent and discontinuity-safe reset behaviour.
3. Implement the six patterns and GPU route-progress evaluation.
4. Layer continuous sub/bass/mid/high/flux/vocal/build response below event accents.
5. Add BPM Sync and 120 BPM free-run semantics; freeze on pause.

**Gate:** deterministic pattern snapshots across at least two bars; centre-out travel is visible; every system participates; idle headroom remains; kick/snare/downbeat/phrase/drop accents hit the intended systems; seeking and source changes do not leave stale light.

**Completed and accepted 2026-10-07:** The owner-authored Pass 3 systems, A–D banks, eight encoded regions, seven continuous signals, and impulse attack/release timings are represented as typed runtime data. A pure deterministic planner implements Outward Bus, Inward Boot, Bank Alternator, Quadrant Relay, Radar Sweep, and System Surge. The native module evaluates its default Outward Bus program against canonical audio intelligence, applies duplicate-safe envelopes, resets transient state on seeks/source/context changes, and freezes exactly on pause. BPM Sync follows canonical bar/beat phase when available and falls back to a stable 120 BPM timeline otherwise. The shared Three bridge consumes the model's `_GLOW_PHASE`, route, bank, region, and system attributes in a Mainframe-specific HDR emissive shader, keeping circuit, indicator, radar/chip, and logo colors independent. Deterministic production-path captures at near and far Outward Bus phases prove the route front moves through the real WebGL shader without module/effect diagnostics. Progression to Stage 5 records acceptance of this reactivity checkpoint.

### Stage 5 — Pattern switching and complete Inspector contract

1. Add the six-option Pattern enum.
2. Add Pattern Change as a boolean.
3. Reuse the eleven Afterhours trigger IDs/labels for Trigger.
4. Add the conditional visibility rule and deterministic no-repeat pattern advancement.
5. Confirm persistence/reset behaviour and schema-driven Inspector placement under all four requested parent groups.

**Gate:** Pattern is immediately authoritative when Pattern Change is off; Trigger is absent when off and visible when on; every trigger option advances exactly once per qualified event; manual edits, preset reload, pause/resume, and history restore are stable.

**Implemented 2026-10-07; owner approval pending:** The Effects parent now exposes the six authored patterns and a boolean Pattern Change control. Trigger is schema-hidden until Pattern Change is enabled and then presents the exact eleven canonical Afterhours IDs and labels. The runtime uses an engine-seeded deterministic six-pattern permutation, advances once per new qualified event identity without immediate repeats, and suppresses already-present events at toggle, trigger-edit, manual-pattern, reload, seek, source, and context boundaries. Manual Pattern edits remain authoritative and restart the selected choreography from a deterministic local beat boundary. All three controls use preset persistence and authored-default reset semantics; focused tests cover Inspector projection, serialization/history restore, all trigger choices, duplicate suppression, pause/resume, reset, and local phase restart. Stage 6 performance-tier and final visual-acceptance work has not started.

### Stage 6 — Performance, quality tiers, and production acceptance

1. Profile the whole Cinema 2.0 frame, not only the module, at 1920 × 1080 on the target MacBook.
2. Reduce draw calls/material count and shadow casters before reducing authored detail.
3. Define high/medium/low policies for shadow resolution, bevel/mesh variant, radar/chip small details, bloom sampling, and any normal/AO detail.
4. Add context-loss/recovery and asset failure validation.
5. Capture one controlled visual acceptance set: resting frame plus all six patterns at representative phases, at 16:9 and the owner Stage aspect.
6. Compare against the reference for composition, depth, logo priority, black level, emission roll-off, metal readability, and component density.

**Gate:** no failed render passes or WebGL errors; no first-visible-frame hitch after warmup; stable resize; high tier targets 60 fps/≤16.7 ms at 1080p on the target machine, with medium/low degrading deliberately; focused tests and asset checks pass.

### Stage 7 — Documentation and clean handoff

1. Document source provenance, regeneration command, attribute schema, pattern semantics, quality-tier behaviour, and known visual limits.
2. Add the preset to user-facing preset documentation if that catalog is maintained separately.
3. Review the final diff and generated asset sizes, then create the requested implementation commit/checkpoint.

**Gate:** another developer can regenerate the assets and explain every control without the original Downloads package.

## 8. Expected code and asset surface

Names may change slightly during implementation, but the change should remain concentrated around:

- `scripts/cinema2-assets/sources/mainframe/*`
- `scripts/cinema2-assets/generate-mainframe.mjs`
- focused generator tests under `scripts/cinema2-assets/`
- `assets/cinema2/cinema2-mainframe/asset.json`
- generated GLB files under `public/cinema2/models/`
- `src/components/vyzualz/cinema2/modules/mainframe/*`
- `src/components/vyzualz/cinema2/modules/Cinema2MainframeNativeModule.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2MainframePreset.ts`
- `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts`
- focused Mainframe unit/production-path tests and one visual acceptance harness.

Avoid changing generic engine contracts unless a focused Stage 3 spike proves a missing capability. In particular, Mainframe should not require a second post-processing stack or renderer.

## 9. Tools and libraries

### Required now

**No new npm package or external application is required for the planned MVP.** The repository already contains:

- `three` and `@types/three` for geometry, PBR materials, glTF loading, instancing, and shaders;
- `earcut` and existing SVG relief/triangulation helpers;
- `svg-path-properties` where path measurement is needed;
- the Cinema 2.0 asset manifest/budget pipeline and in-house GLB writer;
- HDR render targets, shadow maps, HDR bloom, cinematic filmic finishing, and quality tiers;
- Vitest/node tests plus Playwright/browser visual harnesses.

### Optional only if a measured problem appears

- **Blender:** useful for one-off visual inspection, but not recommended as a required build dependency. Code generation keeps the asset reproducible and preserves exact SVG/JSON coordinates.
- **glTF Transform / glTF Validator:** consider a dev-only addition only if the generated model becomes large enough to need mesh optimization/compression or if existing asset checks cannot diagnose malformed glTF. Do not add it speculatively.
- **Texture baker:** avoid for the first pass. Prefer modeled recesses, shadow maps, generated roughness/normal detail, or vertex AO. Add a baker only if owner review shows the board still lacks close-up material richness.
- **SSAO/GTAO library:** not recommended. If contact depth remains insufficient after real geometry and existing shadows, implement a bounded Cinema 2.0 effect or baked AO rather than introducing an incompatible post-processing owner.

Any optional tool decision belongs at the stage where profiling or review demonstrates the need and should include license, package-size, startup, and reproducibility impact.

## 10. Validation plan

### Focused automated coverage

- Source parser/count/schema tests and exact ID coverage.
- Generator topology tests: finite vertices, bounds, winding, indices, named parts, custom attributes, and triangle budgets.
- Native module validation and resource lifecycle tests.
- Pattern tests for determinism, bank/region coverage, phase direction, no-repeat switching, BPM/free-run clocks, pause, seek, and source replacement.
- Preset authoring/compiler tests for keeper registration, capability declarations, parameter defaults/ranges/groups, conditional Trigger visibility, bindings, target formats, effect order, and camera.
- Palette tests ensuring colours affect the requested emissive/material family without flattening PBR shading.
- Component toggle tests ensuring hardware, light, and shadows disappear together.
- WebGL production-path/context-recovery smoke test.

### Visual acceptance views

Use a fixed seed and fixed synthetic audio frames so comparisons are repeatable:

- rest/default at 16:9;
- rest/default at the owner Stage aspect;
- Scale min/default/max;
- radar off and chips off;
- all six patterns at one signature phase and at a peak;
- default palette plus one non-green palette to prove semantic separation;
- high/medium/low tier contact sheet;
- an oblique debug view used only to verify depth and self-occlusion.

The acceptance comparison should judge relative hierarchy, not pixel identity with the concept still. The still contains more ornamental micro-detail than the production masters; any added detail must remain deterministic, symmetric where intended, and subordinate to the supplied geometry.

## 11. Risks and decisions already made

| Risk | Decision / mitigation |
|---|---|
| A flat SVG import would not reproduce the reference's metal, bevels, parallax, or shadows. | Build deterministic 3D geometry from the masters; do not ship the concept still or a flattened SVG as the scene. |
| One mesh/material per element would create too many draw calls and updates. | Merge/instance hardware and encode identity/bank/region/progress in attributes or compact GPU lookup data. |
| Strong green lights can turn all metal green and erase depth. | Keep scene illumination mostly neutral; let user colours drive emissive systems and controlled local spill. |
| Bloom can flatten the logo and circuit housings. | Use HDR cores, thresholded bloom, and filmic tone mapping; tune exposure last. |
| Straight-on symmetry can look like 2D art. | Use real z separation, bevels, contact shadows, and slightly asymmetric key/rim lighting while keeping the camera nearly frontal. |
| Frequent Trigger choices such as Beat can make patterns incoherent. | A qualified trigger changes the pattern once, resets it deterministically, and allows the chosen pattern to own subsequent sub-beat animation. Default to Every 4 Bars. |
| Non-16:9 crops can remove edge hardware. | Keep the logo and primary route origins in a protected centre region; Scale provides deliberate operator framing. |
| The generic `three-scene` module lacks the required per-system visibility and 60-route choreography control. | Use a dedicated native Mainframe renderer while retaining all shared Cinema 2.0 ownership/lifecycle services. |

## 12. Definition of done

Mainframe is complete when:

- it appears as a Cinema 2.0 keeper named **Mainframe**;
- the exact supplied logo and circuit layout are preserved in real layered geometry;
- the resting frame convincingly matches the reference's hard-surface depth, dark metal, green-white light hierarchy, symmetry, and component density;
- all twelve requested controls work in the correct Design parent groups, including conditional Trigger visibility;
- the six patterns choreograph every lighting system and Pattern Change uses the complete Afterhours trigger list;
- audio, BPM/free-run, pause, seek, resize, persistence, and context recovery behave deterministically;
- focused tests, asset checks, production-path rendering, and the single final visual acceptance pass succeed;
- documentation and source provenance make the asset reproducible without relying on the user's Downloads folder.

## 13. Recommendation before implementation

Start with Stage 1 and Stage 2 as one visual checkpoint: prove the authored geometry can become a convincing unlit/neutral-lit hard-surface model before writing the reactive renderer. The largest risk is not audio choreography—the Pass 3 map already specifies that well. The largest risk is whether the generated board, route housings, component elevations, bevels, and logo relief create the same physical depth as the reference without excessive geometry.

After that checkpoint, build the static production look before animation. If the default still does not read as premium mainframe hardware, more patterns will only animate the wrong visual. Once the static image is approved, the existing Pass 3 semantic map gives an unusually strong foundation for the six lighting programs and should make the reactivity stage comparatively direct.
