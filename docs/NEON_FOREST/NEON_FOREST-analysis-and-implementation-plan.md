# NEON FOREST — reference analysis and implementation plan

Status: approved implementation plan. Native implementation and automated acceptance are now complete; see [current behavior specification](NEON_FOREST-behavior-spec.md) and [implementation report](NEON_FOREST-implementation-report.md). Human visual acceptance is pending. The analysis and original proposal below are retained as the design record.
Analysis date: November 13, 2026.

## 1. Inputs and method

Resolved the requested `/Downloads/neon_stage.glb` to
`/Users/kodyrobinson/Downloads/neon_stage.glb` and the requested contract to the
repository-root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`.

Inspected the binary glTF JSON and geometry, ran the repository's asset inspector
and glTF validator using Node 22, and rendered front, three-quarter, rear, and
neutral structure views in Three.js through headless Chrome. These are reference
inspection renders with added neutral lighting and ACES tone mapping, not the
original Sketchfab presentation or Cinema 2.0 acceptance captures. No bloom or
atmosphere was added. The rear view deliberately exposes the source's obstructed
sightline; it is not an approved camera shot.

Read the creation contract and inspected the existing manifests, native modules,
shared camera, parameter/target resolver, Audio Intelligence bridge, Visual
Director, choreography, render graph, effect runtime, and production acceptance
harness. MAINFRAME, NIGHTSHIFT, and Cathedral inform lighting and finishing;
PSYLO supplies an additional relevant example of shared forest travel/orbit rigs.

Evidence:

- [Reference contact sheet](reference-contact-sheet.png): top left front, top right
  three-quarter, bottom left rear, bottom right neutral structure with sky hidden.
- [Repository asset inspection](source-inspection.json).
- [Three.js scene inspection](scene-inspection.json): object bounding boxes are
  conservative transformed boxes, not exact vertex bounds.
- Source SHA-256: `a8ca9b80117027adb23db5c4d80e00fa42e7b6071291f295484a77099563e4bb`.

## 2. What the artifact actually contains

### Visual identity

The model is a low-poly crystal grove/stage. Dense, angular spires rise on both
sides of an open aisle. Tall upright crystals, outward-leaning fans, and small
ground shards establish a jagged silhouette. A thin multicolor circular portal
marks the central destination. Dark mottled ground and a large purple/black
textured sky enclosure complete the composition.

This is the reference for a **crystal forest**, rather than a botanical tree or
mushroom forest. The strongest identity cues to preserve are the faceted spires,
clustered banks, navigable aisle, luminous ring, dark separation, and cool neon
palette with magenta accents. Full surrounding scenery, stronger emission,
choreography, beams, mist, and camera routes are proposed additions, not existing
features discovered in the file.

### Measured inventory

| Item | Finding | Implementation implication |
|---|---|---|
| File | 5,476,724 bytes, approximately 5.22 MiB | Modest source download size |
| Scene | 1 scene, 78 nodes | Most nodes are import wrappers or empty markers |
| Meshes | 5 meshes / 5 triangle primitives | Low source draw count; little semantic addressability |
| Geometry | 42,834 triangles; 86,367 primitive vertex records | Within the 250,000-triangle per-asset budget |
| Materials | 4 | Ground, crystal body, portal, sky |
| Textures | 5 embedded PNGs: four 1024² and one 512² | Ground base/roughness/emission, portal emission, sky emission |
| Memory | Inspector estimate 25.79 MiB: 3.13 MiB geometry + 22.67 MiB textures | Excludes render targets, effects, environment maps, duplication, and runtime overhead |
| Animation | 0 clips, 0 skins, 0 morph targets | All motion must be authored |
| Cameras | 0 | Framing and camera routes must be authored |
| Lights | No exported punctual-light definitions; 22 empty `Point*` marker groups | Names do not provide working lights or beams |
| Extensions | `KHR_materials_clearcoat`, optional; no geometry compression | Supported material feature; optimization remains possible |

The source alone fits the current 32/48/80 MiB low/medium/high per-asset memory
budgets. That does not establish the performance or memory cost of the expanded
preset. Texture storage dominates the source estimate.

### Geometry and coordinates

The imported root contains an axis conversion and a 0.01 scale. Bake the combined
world transform into a prepared derivative before adding pivots. Use Y-up with
ground Y=0, preserve proportions, and document the final world-unit convention.
Do not assume the source was authored in physical meters.

| Source primitive | Triangles | Role |
|---|---:|---|
| `Plane_Material_0` | 2 | Flat textured ground |
| First `Cylinder.067_Material.002_0` | 31,885 | Large merged portion of crystal field |
| Second identically named mesh | 10,211 | Remaining merged crystal field |
| `Torus_Material.003_0` | 512 | Thin emissive portal |
| `Sphere_Material.004_0` | 224 | Large sky enclosure |

Exact transformed vertex measurements, rounded:

- Ground: X −14.51 to 16.05, Z −20.30 to 12.70, essentially Y=0.
- Combined crystals: X −11.82 to 10.96, Y −1.48 to 8.71,
  Z −16.73 to 8.49. Some geometry is below ground.
- Portal center: approximately `(0.805, 2.262, −5.740)`; diameter about 3.56,
  depth about 0.07, approximately in the XY plane.
- Sky: roughly 95 units across by exact vertex bounds. Its conservative box
  inflates the whole-scene extent further. Exclude it from framing, scene scale,
  collision analysis, and hero-visibility measurements.

The two crystal chunks account for 42,096 triangles, approximately 98.3% of all
triangles. Their names do not identify separate crystals, roots, banks, or tips.
A diagnostic position-weld/connectivity scan found 1,414 and 442 surface
components. These are **surface components, not a verified physical crystal
count**: export seams, partial surfaces, and intersecting pieces prevent treating
each component as a complete independently movable object without preparation.

A whole-chunk rotation would move much of the forest around one imported pivot.
That would fail the requested geometry choreography. Prepare coherent clusters
and anchored pivots, or reconstruct simple prism families from measured source
shapes. Prefer an offline prepared asset plus instanced surrounding geometry;
do not run expensive topology segmentation every frame or create thousands of
independent scene objects solely to animate tiny fragments.

### Materials and illumination

- **Ground (`Material`):** alpha BLEND, opacity approximately 0.572, roughness
  0.566, clearcoat approximately 0.724, and textured emission scaled to 0.1.
  This transparency can complicate depth, fog, reflections, and overlapping
  surfaces. Use a visually matched opaque prepared ground unless transparency
  proves necessary in the approved look.
- **Crystals (`Material.002`):** gray/blue base, metallic 0.6, roughness 0.5,
  extremely small purple emission. They have no crystal-specific texture maps.
  Their facets can be recolored and relit without elaborate texture work.
- **Portal (`Material.003`):** black base plus full-strength emissive texture.
  Its thin rainbow contour is the main existing neon element. Independent
  palette roles will require a controlled gradient/mask rather than merely
  multiplying an already colored texture by another color.
- **Sky (`Material.004`):** black base and emissive sky texture. It supplies an
  image backdrop, not scene illumination, scattering, or fog.

The source does not provide animated beams, volumetric lighting, fog, reflective
hero geometry, or a ready musical performance. Neutral inspection lighting makes
the spires readable but does not reproduce the original author's viewer setup.

### Preparation defects and provenance

The inspector reports no engine-fatal issue and warns about duplicate crystal
node names. The glTF validator **fails** with one error:

`NODE_MATRIX_NON_TRS` at `/nodes/10/matrix` (the Sphere transform).

Bake the full affine transform into geometry before resetting the derivative
node to valid TRS; simply decomposing and recomposing the matrix can change the
shape. Rename addressed pieces deterministically and validate the derivative.
The untouched source remains the reference.

Embedded source metadata identifies **Neon Stage**, author **AnixMoon**, license
**CC-BY-4.0**, and the source model:
[Neon Stage on Sketchfab](https://sketchfab.com/3d-models/neon-stage-6037d87967fc4acf8e8ba1de875dc743).
Carry that embedded provenance, author link, and a modification record through
the repository's asset attribution workflow when deriving runtime geometry.

## 3. Proposed NEON FOREST design

Create a true world-space crystal environment centered on the portal grove.
Keep the reference aisle and faceted clusters recognizable. Extend terrain and
crystal banks around the clearing and behind the portal so travel and a full
orbit reveal finished scenery. Keep the portal as a world object, not a camera
billboard. Give its luminous rim enough physical depth to read from oblique
angles. An edge-on ring may naturally become thin; the surrounding grove must
remain a strong composition from those views.

Use a proposed initial footprint of roughly 50–60 units across, subject to the
Phase 1 camera-clearance study. Retain the source's approximate 3.56-unit portal
diameter and 8–9-unit major-spire height unless framing review justifies a
documented adjustment. Final counts and bounds are Phase 1 outputs, not claims
about existing geometry.

The result should have luminous cyan/teal crystal cores, violet/magenta banks,
contrasting portal accents, readable shaded facets, restrained ground spill,
visible spatial beams, layered distance haze, and drifting low mist. Maintain
dark gaps and color saturation. Avoid a uniformly glowing white forest.

No-track idle uses gentle, visibly slower ambient motion. Explicit pause holds
geometry and camera motion; seeking and source changes reset or reconstruct
transient state. Active music must introduce additional timed spatial behavior,
not merely continue the same idle animation with a brightness multiplier.

### Eight proposed native patterns

These are NEON FOREST-specific proposals; they are not changes to shared pattern
names or Inspector rules. Each must work manually before musical integration.

| Pattern | Distinct geometry behavior | Supporting light behavior |
|---|---|---|
| Prism Tide | A lateral wave of rooted cluster bends passes across the grove | Cyan-to-violet bank sweep |
| Root Resonance | Anchored vertical growth/contraction radiates from the portal clearing | Ground-to-tip light progression |
| Aisle Cascade | Successive depth rows fan open along the travel corridor | Front-to-back chase |
| Crown Spiral | Upper crystal sections twist in azimuth around anchored bases | Spiral crown highlights |
| Portal Bloom | Portal segments expand/rotate while adjacent crystal fans open | Ring-to-grove radial illumination |
| Crosscurrent | Diagonal cluster groups counter-lean in alternating phases | Opposed diagonal accents |
| Crystal Choir | Selected cluster groups rise in anchored scale while others hold, forming changing spatial tiers | Distinct group call/response |
| Supernova Grove | A bounded outward fan and portal expansion releases, then settles | Broad multibank impact and recovery |

Patterns must remain distinguishable with bloom and atmosphere OFF. Rooted
scaling and bending must preserve attachment to terrain; do not translate every
crystal upward as a substitute for articulated motion. Ground remains stable.
All pattern bounds feed the camera clearance envelope.

### Proposed control and palette map

**BPM Sync and Auto Performance are mandatory boolean toggles for NEON FOREST.**
Both must appear under **Design > Master Controls**, have real runtime consumers,
persist as authored settings, and pass production-canvas ON/OFF tests. Neither
control may be omitted, deferred beyond the completed preset, or implemented as
an Inspector-only value. Proposed defaults are BPM Sync ON and Auto Performance
OFF; Auto Performance remains opt-in despite its mandatory inclusion.

All controls use existing generic parameter definitions/bindings and the four
required Design-inspector parent groups. Final ranges/defaults are authored in
Phase 1 and visually tested in Phase 2.

| Parent | Proposed controls | Visible consumer |
|---|---|---|
| Master Controls | Master Intensity, BPM Sync, Geometry Motion, Motion Amount/Speed, Music Response, Auto Performance, Quality | Emission ceiling, shared timing, native deformation, bounded music gains, temporary performance, quality tier |
| Design / Pattern | Pattern, Pattern Change, conditional Trigger, in that order | Eight native programs and canonical event-driven progression |
| Design / Forest | Grove Density, Crystal Scale, Portal Size/Motion | Addressed instance occupancy, anchored dimensions, ring geometry |
| Design / Camera | Mode, Camera Motion, Speed, FOV, conditional Orbit Radius/Heading/Elevation | Shared camera rig variants and safe manual framing |
| Effects / Lighting | Scene Lights, Light Strength, Crystal Emission, Beam Amount | Real surface illumination, material emission and visible spatial light |
| Effects / Atmosphere | Atmosphere, Fog Density, Ground Mist, Mist Height, Light Shafts | Depth-aware density field and light scattering |
| Effects / Finish | Bloom enable/amount, Ground Reflections enable/amount | Bounded post-processing |
| Palette | Background, Crystal Primary, Crystal Secondary, Portal Accent, Ground, Atmosphere | Six independent color roles |

Crystal Primary and Secondary address separate banks or material regions;
Portal Accent controls its own ring regions. Background controls sky output as
well as the environment clear color, so an enclosing sphere cannot hide the
control. Atmosphere color affects the density-field tint; light colors derive
from documented crystal/portal roles. Palette controls must have independently
visible effects, not aliases of one shared tint.

### Timing and canonical triggers

BPM Sync ON uses the existing shared beat/transport timing to govern native
pattern phase, portal cycles, and camera travel/orbit timing. OFF uses a declared
free-running reference rate, initially 100 BPM equivalent, through existing
timing infrastructure; it does not disable beat/kick/snare reactions or invent
new musical events. Document composition with the host Audio Dock toggle using
the existing explicit local-control convention. ON/OFF changes preserve phase
continuity and respect pause/discontinuities.

Pattern Change defaults OFF. Reuse `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` exactly:
`beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`,
`phrase`, `drop` — Beat, Kick, Snare, Downbeat, Every 2 Beats, Every 4 Beats, Bar,
Every 4 Bars, Every 8 Bars, Phrase, Drop.

Manual Pattern edits take effect immediately and leave Pattern Change ON if it
was ON. Consume stale event identities, then wait for a fresh qualifying event.
Runtime progression does not overwrite the persisted authored Pattern.

### Initial authority matrix

| Property | Manual base | Audio / Director permission | Auto Performance permission | Manual edit result |
|---|---|---|---|---|
| Palette | Exclusive | None | None | Immediate, retained |
| Brightness / motion strength | User ceilings | Bounded gain/envelopes within ceiling | Same ceiling | Immediate new base |
| Feature enables | Hard authorization | Cannot re-enable | Cannot re-enable | OFF stays OFF |
| Density / scale / portal size | User base and safe range | Bounded transient modulation | No permanent change | Immediate new base |
| Pattern | Authored base selection | Selected Trigger advances runtime base only when enabled | Temporary, fresh build/drop substitution | Immediate base; cancels active override; Pattern Change stays enabled |
| Pattern Change / Trigger | Exclusive settings | Consume canonical event semantics | Cannot modify settings | Consume current identities; no stale jump |
| Camera mode / route / orbit framing | Exclusive | Bounded energy modulation of enabled movement only | None in initial scope | Immediate safe manual state |
| Fog / mist / bloom / reflections | User base, ceiling, enable | Small bounded envelopes where documented | No enable or ceiling override | Immediate new base |

The mandatory Auto Performance toggle owns **temporary build/drop performance programs
only**. It does not select camera shots or recolor the scene. The underlying
Pattern Change controller continues deterministic progression during an
override; expiration returns to its current base. A manual edit suppresses the
already-active build/drop; only a later independently qualifying event can
start a new override. Ordinary audio reactivity remains independent of the
Auto Performance toggle.

## 4. Architecture grounded in the current repository

| Responsibility | Existing implementation to use |
|---|---|
| Manifest, parameter schema, validation | `contracts/Cinema2NativePresetManifest.ts`, `presets/Cinema2PresetAuthoring.ts`, parameter schema/state |
| Registration | `presets/Cinema2FirstPartyPresetCatalog.ts`, `modules/Cinema2ModuleRegistry.ts` |
| Model loading / scene integration | `modules/three/Cinema2ThreeAssetCache.ts`, `Cinema2ThreeSceneBridge.ts`, asset/environment manifests |
| Final resolved values | `parameters/Cinema2TargetRuntime.ts` / `Cinema2FinalValueResolver` |
| Musical facts | `audio/Cinema2AudioIntelligenceBridge.ts` and shared `Cinema2BeatClock` |
| Significance | `director/Cinema2VisualDirector.ts` |
| Transient modulation | `choreography/Cinema2ChoreographyRuntime.ts` and declared module/light/effect targets |
| World camera | `spatial/Cinema2CameraRuntime.ts`: static/orbit/path/fly, rig variants, spline, safety and parameter bindings |
| Shared light mapping | `spatial/Cinema2LightingEnvironmentRuntime.ts`, `modules/three/Cinema2ThreeCameraLightMapping.ts` |
| Composition / finish | `render/Cinema2RenderGraph.ts`, `runtime/Cinema2RenderGraphExecutor.ts`, effect runtime |
| Atmosphere | `effects/Cinema2VolumetricAtmosphereEffect.ts`, shipped smoke volume |
| Production evidence | NIGHTSHIFT/PSYLO production harness conventions; MAINFRAME/Cathedral acceptance scripts |

Paths in this table are relative to `src/components/vyzualz/cinema2/` unless
stated otherwise. Reuse systems and conventions, not unrelated artwork or every
historical preset setting. For example, the inspected MAINFRAME manifest places
its pattern controls under Effects, and Cathedral advertises five programs;
NEON FOREST must follow the current contract's **Design placement and six-plus
minimum**, regardless of those older examples.

Proposed additions are `Cinema2NeonForestPreset.ts`,
`Cinema2NeonForestNativeModule.ts`, focused `modules/neonForest/` layout, scene,
pattern, audio, Director and Auto Performance components, plus preset
choreography/finishing declarations. Add only components required by the actual
implementation; these names do not require a large new abstraction layer.

The native module renders the prepared environment and consumes resolved values.
It does not own an independent Three camera or second musical analyzer.
Choreography routes shared inputs to declared transient targets; the native
pattern engine applies the resulting bounded transforms to addressed geometry.

Lighting should use a small deliberate shared rig, within the current **12-light
shared limit**, rather than turn all 22 imported markers into dynamic lights.
The Three bridge currently allows zero shadowed spotlights on low and two on
medium/high. Emission makes crystals glow; real lights create surface spill;
depth-aware scattering makes shafts visible. Each has a separate job.

Use a depth-backed HDR scene target (`rgba16f`, with the supported fallback),
then optional ground reflection, volumetric atmosphere, HDR bloom, and final
tone mapping/output. Confirm shader-deformed geometry writes matching depth and
shadows; transparent decor must not corrupt the terrain depth.

## 5. Detailed implementation phases

The phases follow contract Section 23. Each phase ends with a focused check and
reviewable evidence. Do not repeat passed expensive sections unless later
changes invalidate them. Early captures validate only the features then present;
they are not claims of final preset acceptance.

### Phase 1 — Approved specification, asset preparation, static visual core

1. Finalize this proposal into a behavior specification, ownership map,
   authority matrix, parameter/output map, audio map, timing contract, eight
   pattern definitions, palette role map, and reference-preservation checklist.
2. Preserve the source; bake transforms into a derivative, correct the validator
   error, assign unique semantic names, isolate ground/sky/portal, and establish
   stable cluster IDs, rooted pivots, and deformation limits. Reconstruct simple
   prism families only where needed for coherent animation or surrounding banks.
3. Build continuous surrounding terrain, rear/side grove coverage, portal
   clearing, and reserved camera corridors. Use instances/batched geometry for
   repeating crystals. Prepare tiered textures/geometry and record provenance.
4. Add the native manifest/module and necessary asset/catalog registration in
   development form. Render the static world with readable baseline PBR/emissive
   lighting, no musical automation, bloom, fog, or reflection dependency.
5. Capture MAINFRAME, NIGHTSHIFT, and Cathedral on the same production canvas,
   quality, aspect ratio, and declared settings to establish a brightness board.

**Exit gate:** derivative validates; addressed geometry and bounds are documented;
the static aisle, crystal banks, portal and surrounding scenery are correct;
primary facets remain visible with finishing OFF. Review a front and elevated
view plus a spatial layout/clearance image. Approval of the plan establishes the
design direction; final human visual acceptance remains Phase 8.

### Phase 2 — Camera, complete manual controls, native geometry motion

1. Implement Fixed View, Aisle Travel, Grove Orbit and Elevated Passage with
   existing camera rig variants. Start with authored clear paths; camera safety
   clamps alone are not obstacle avoidance. Reserve clearance for the largest
   permitted crystal/portal deformation and near plane.
2. Provide speed, motion enable, FOV and orbit controls. Prove a complete orbit,
   travel into/through the portal where clearance allows, route loops and safe
   mode transitions. Camera OFF holds the authored fixed view. Inspect the rear
   and side views; no exposed terrain edges or unfinished backs.
3. Wire every manual parameter through the resolver. Implement all eight native
   geometry patterns and their transitions before adding musical modulation.
4. Expose and verify both mandatory boolean toggles, BPM Sync and Auto Performance,
   under Design > Master Controls. Prove BPM Sync ON/OFF timing; complete Auto
   Performance ON/OFF behavior and authority tests in Phase 6. Verify independent palette colors, pattern dropdown,
   Pattern Change/conditional Trigger placement and canonical options in the
   actual Inspector. Complete automatic event behavior after Phase 3.
5. Capture min/default/max and discrete control states; capture multiple frames
   with camera fixed to isolate geometry motion, then geometry fixed to isolate
   camera motion. Include affected control typography and portaled dropdowns.

**Exit gate:** every primary manual control has its intended visible effect;
patterns differ spatially; camera movement traverses real depth and remains safe
at supported aspect ratios. A moving camera cannot substitute for moving geometry.

### Phase 3 — Shared Audio Intelligence and transport correctness

1. Route shared bands, energy, rhythm, vocal and structural facts through the
   bridge/choreography targets; use existing canonical trigger resolution and
   event identities. Do not build a local beat/drop detector.
2. Add initial distinct reactions: bass changes bounded bend/growth amplitude;
   kick excites lower clusters; snare accents upper tips/portal segments; highs
   drive small shimmer/particle activity; vocals restrain density/range.
3. Complete Pattern Change event progression across all 11 triggers, manual edit
   preservation, duplicate suppression and toggles/Trigger changes.
4. Define unavailable-analysis fallback, no-track idle, explicit pause, resume,
   seek, loop, track change, analysis replacement and preset re-entry behavior.

**Exit gate:** deterministic fixtures show quiet/groove/build/drop differences,
rhythmic and structural responses in documented regions, correct event-driven
pattern changes, and stable shared timing. Reactions are more than brightness.

### Phase 4 — Full preset-specific geometry choreography

1. Author transient actions for rooted bend, anchored scale, crown twist, row
   fan-out, portal expansion/rotation and cluster phasing. Keep terrain stable.
2. Specify each rule's source, target, add/multiply composition, maximum gain,
   attack/hold/decay, conditions, reset and user authority. Initial design bounds:
   roughly 2–6° extra bend, up to 8% extra rooted scale, 10–20° crown twist and
   up to 12% portal expansion, reduced wherever clearance demands it.
3. Initial event envelopes: kick approximately 20 ms attack / 220 ms release;
   snare 20 / 300 ms; downbeat 40 / 600 ms; drop 30 ms attack / 1.5 s release.
   These are proposed starting values to tune visibly, not source animation data.
4. Build pressure compresses upper geometry toward the aisle without moving
   roots or blocking travel. Drop releases an outward wave; vocal restraint
   reduces motion and occupancy without changing the user's authored density.
5. Compose envelopes through resolved targets; clamp combined motion against
   the authored safety envelope and return cleanly to base values.

**Exit gate:** isolated events and sustained passages produce recognizable
pattern-specific spatial choreography. OFF/zero motion remains OFF/zero and no
envelope leaves stale deformations or violates camera clearance.

### Phase 5 — Visual Director meaning

1. Consume shared intensity, momentum, build pressure, impact and transition
   significance, gated by capability availability.
2. Use these for bounded performance range, wave reach, reveal emphasis and
   modest camera energy within the user's chosen mode. Significant section
   transitions can redistribute accents inside the active pattern; they cannot
   silently change the manually selected pattern or camera mode.
3. Keep continuous Director shaping separate from event envelopes so impact is
   not accidentally applied twice. Missing Director data returns neutral gains.

**Exit gate:** macro musical sections differ in movement/space as well as light;
manual palette, composition and route remain authoritative.

### Phase 6 — Explicit Auto Performance

1. Complete the mandatory Auto Performance toggle's runtime consumer with opt-in
   temporary build/drop programs, initially a gathering Portal Bloom
   build and Supernova Grove release, with documented event identity and expiry.
2. Continue the underlying Pattern Change progression during overrides and
   restore its current base afterward. Never overwrite saved Pattern/Trigger.
3. Manual Pattern selection cancels the active override immediately and leaves
   Pattern Change untouched. A held build/drop cannot instantly steal it back.
4. Keep camera mode, palette, disabled features and all strength ceilings manual.

**Exit gate:** Auto Performance OFF prevents automatic build/drop program overrides
while ordinary audio reactivity remains available; ON visibly enables qualified
overrides. Production tests prove temporary override expiry, correct base
restoration, manual takeover, fresh-event requirements and hard-disable gates.

### Phase 7 — Bright lighting, atmosphere and finishing

1. Refine the baseline rig with crystal-bank spill, portal rim lights and a
   small set of spatial spots. Animate permitted light targets through the shared
   resolver. Preserve facet shading and saturated luminous cores.
2. Add depth-aware distance fog, drifting ground mist, layered smoke/noise,
   visible spatial light shafts and restrained particulate depth cues. Separate
   fog density, low mist, height and beam controls. Use the existing volume
   texture and ray-marched atmosphere; do not substitute a flat fog overlay.
3. Add subtle ground reflections and HDR bloom after the base world is correct.
   Reflections must remain credible under orbit; do not promise complete mirror
   reflections from the existing screen/depth-based effect.
4. Calibrate against the Phase 1 reference board using hero-region brightness,
   luminous coverage, dark-gap contrast, hue retention and clipped-highlight
   coverage. Compare matched settings/checkpoints; different geometries do not
   justify forcing identical whole-frame average luminance. Agree numerical
   acceptance bands from actual captures, rather than inventing them now.
5. Test effects OFF/default/maximum and combined maxima from every camera mode.
   Reduce atmosphere sampling, particles and shadow cost by quality tier without
   removing the core grove or making lighting unreadable.

**Exit gate:** lighting has a comparably strong visible presence to MAINFRAME,
NIGHTSHIFT and Cathedral; fog and shafts are clear at defaults; maximum effects
retain geometry, color and depth. Record measured CPU/GPU/memory results at
720p/1080p on the test hardware. Target 60 FPS on an appropriate tier; report
actual results rather than promising high-tier 60 FPS before measurement.

### Phase 8 — Integrated acceptance, documentation and handoff

1. Run focused unit tests for patterns, resolved controls, timing, envelopes,
   authority and resets; typecheck and scoped lint. Run relevant asset/decoder
   checks after asset integration and a production build for the final change.
2. Run the real renderer/Inspector acceptance harness: baseline hero visibility,
   all primary controls, six-plus distinct patterns, all 11 triggers, independent
   colors, mandatory BPM Sync and Auto Performance toggles with visible ON/OFF
   behavior, meaningful motion, shared audio timing, Director and
   Auto Performance takeover/restoration.
3. Cover pause/resume/seek/loop/track/analysis changes, switching away/back,
   resize, 16:9/1:1/9:16, quality tiers, resource disposal and bounded memory.
   Check full orbit and complete travel loops at maximum allowed deformation.
4. Record idle, quiet verse, groove, vocal, build midpoint, final build, first
   drop, sustained drop, phrase and section checkpoints. Inspect foreground,
   portal, far grove, mist and light shafts separately; bright sky cannot pass
   hero visibility. Include real analyzed playback as well as reproducible
   deterministic fixtures.
5. Present captures and short motion clips for human review against the GLB
   reference and brightness board. This is a new preset: legacy-port pixel parity
   is not applicable, but reference identity and approved design remain mandatory.
6. Complete the behavior/ownership/control/audio/timing/palette documents, asset
   provenance, known limitations, acceptance report and documentation index.
   Review the final diff and preserve unrelated user changes. Create a commit
   only if requested; report commit status explicitly.

**Exit gate:** all applicable contract stop-ship checks pass and human visual
acceptance is complete. Only then describe NEON FOREST as production-ready.

## 6. Original analysis handoff state (before implementation)

Completed: detailed source inspection, four-angle reference render, contract and
relevant architecture review, proposed design, authority matrix and eight-phase
implementation plan. Saved analysis and evidence only; no runtime source,
preset registration, original GLB or existing preset was changed.

Validation performed: asset inspection passes with a duplicate-name warning;
source glTF validation fails with the single documented Sphere transform error;
all four inspection views rendered 42,834 triangles without a page error (the
structure-only view hides the 224-triangle sky). No implementation tests/build
were run because implementation has not begun. Existing unrelated working-tree
changes were present before this analysis and are outside this proposal.

No commit was requested or created. Implementation awaits user approval. The
remaining uncertainties are coherent crystal segmentation/pivot preparation,
final camera clearance, calibrated brightness thresholds and measured runtime
performance; the phases above explicitly resolve each one.
