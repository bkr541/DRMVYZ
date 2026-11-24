# Phase 06 — Six user model reference previews

**Historical record:** the six preview identifiers remain valid, but live representation selection and shared model ownership now follow [the unified 3D effects documentation](cinema2-unified-3d-effects.md).

## Authored behavior specification

These are separately selectable reference previews, not keeper effects or physical
simulations. All use the Phase 05 private slot, centered two-unit model and shared
neutral stage. World-space geometry sits at y=1.1; the fixed camera looks from
[3, 2.4, 5]. Motion stays inside a 1.5-unit model envelope, above the floor.
No camera automation, stage overlay, independent transport or audio analysis.

| Preview | Representation | Six authored patterns |
| --- | --- | --- |
| Form | Original PBR mesh, accent pedestal | Frontispiece, Three Quarter, Suspended, Rocking Plinth, Breathing Form, Slow Turn |
| Shatter | Surface-sampled tetrahedral proxy clusters; no fracture | Radial Burst, Twin Banks, Crown Lift, Pinwheel Debris, Ripple Break, Rejoined Clusters |
| Dust | Surface-sampled points; no dissolution simulation | Surface Cloud, Rising Drift, Halo Orbit, Twin Plumes, Wave Gather, Compressed Mist |
| Hologram | Cloned wireframe mesh plus scan plane and edge echo | Wire Signal, Scan Sweep, Double Echo, Tilted Projection, Signal Pulse, Cross Scan |
| Slices | Surface samples grouped into horizontal ribbon proxies; no exact sectioning | Layer Stack, Stair Step, Fan Sections, Alternating Bands, Ribbon Wave, Collapsed Layers |
| Voxel | Capped surface-occupied cube instances; no volume filling | Surface Blocks, Column Lift, Checker Split, Orbital Blocks, Wave Grid, Compact Blocks |

Pattern transforms are distinct within each representation, including different
static arrangements so patterns remain distinguishable when paused. Default idle
is static. With playback, shared timing drives bounded motion. BPM Sync uses the
existing shared beat resolver (track grid/tempo ON, 120 BPM reference OFF); pause
freezes phase, seek/loop/track/context changes reset temporary state deterministically.

| Domain | Authority / real consumer |
| --- | --- |
| Model/version | User only; Phase 05 resolver, pinned identity |
| Pattern | User base; existing generic Mainframe pattern controller advances on fresh canonical Afterhours triggers only when Pattern Change ON |
| Pattern Change/Trigger | User only; boolean OFF by default; exactly 11 imported shared triggers; manual Pattern leaves toggle ON and suppresses the current event |
| Movement amount/speed | User base; shared timing with bounded energy/rhythm/structure modulation |
| React strength/response | User ceiling/decay for shared overallEnergy and kick/downbeat + phrase/drop impulses; no detector |
| Primary | Saved front material multiplied by user tint (or proxy primary) |
| Secondary | Saved sides multiplied separately (or alternate proxy regions) |
| Accent | Pedestal ring/scan proxy, independent of primary and secondary |
| Background | Shared environment background, independent of all model colors |
| Effects opacity/emission | Actual model/proxy material alpha and emissive/point brightness |
| Master intensity | Overall model/proxy brightness, never rewrites palette or pattern |
| Auto Performance | Not offered by these small previews; no hidden automatic domains |

Geometry/proxy preparation happens only on model attachment. No geometry/material
allocation per frame. Instanced voxel and fragment pools, sampled point buffers
and capped layer proxy meshes use quality draw-count limits. Original cached GLB
geometry/materials remain immutable; controller-owned buffers/materials are freed
on replacement and module disposal. The authored base stage remains replaceable.

## Registered entries and parameter routes

All six are first-party **reference** declarations. Their names include Preview;
none is a keeper and no existing keeper declaration or shipped model is changed.

| Stable preset ID | Catalog name |
| --- | --- |
| `drmvyz.cinema2.user-model-form` | 3D FORM (Preview) |
| `drmvyz.cinema2.user-model-shatter` | 3D SHATTER (Preview) |
| `drmvyz.cinema2.user-model-dust` | 3D DUST (Preview) |
| `drmvyz.cinema2.user-model-hologram` | 3D HOLOGRAM (Preview) |
| `drmvyz.cinema2.user-model-slices` | 3D SLICES (Preview) |
| `drmvyz.cinema2.user-model-voxel` | 3D VOXEL (Preview) |

Each parameter ID is `user-model-<kind>-<property-in-kebab-case>`. The six small
declaration files use `Cinema2UserModelPresetFactory.ts`; the factory authors the
existing scene, depth target/output pass, parameters and module bindings.

- Master Controls: Master Intensity → `intensity`; BPM Sync → `bpmSync`.
- Design: Model → `userModel`, a Phase 05 pinned binding; Pattern → `pattern`;
  Pattern Change → `patternChange`; Trigger → `trigger` (conditional on toggle);
  Movement Amount → `movement`; Movement Speed → `speed`.
- Effects: Opacity → `opacity`; Emission → `emission`. Opacity changes real
  material alpha, with shader invalidation when crossing the opaque/transparent
  boundary. Emission changes proxy/scan/halo brightness and emissive materials.
- Palette: Background → shared environment background binding; Primary,
  Secondary and Accent → corresponding controller material regions. Secondary
  also colors the contour halo so it remains effective on a single-material
  source mesh. Accent colors the pedestal ring and scan plane independently.
- React: Reactive Strength → `reactivity`; Response Decay → `response` seconds.
  These bound runtime values cap continuous response and transient decay.
- Shared Quality / Performance retains its existing output control and runtime
  quality authority. No creative controls were added to the header or stage.

The preview controller is selected by `config.userModelPreview` on the existing
`three-scene` module. Without this opt-in, earlier presets keep their behavior.
The bridge's optional controller callbacks now receive the dynamic-slot flag and
quality tier, and support detach. Only dynamic model trees get preview geometry;
the floor remains independent. Replacement detaches/disposes controller-owned
buffers before releasing old model leases. Preview before-draw opts into running after shared part
visibility so proxy sources stay hidden; other controllers retain their prior ordering. Material clones retain the saved GLB's
base colors; no published model material or binary is modified.

The motion domain uses `Cinema2MainframeBeatClockResolver`; event identity comes
from `resolveCinema2AfterhoursTriggerEventIdentity`. The generic
`Cinema2MainframePatternController` owns runtime-only progression. Same-value
manual edits use the existing edit-revision facet to reclaim the base pattern,
without disabling Pattern Change. Duplicate events cannot advance twice. New
phrase/drop events add a bounded stronger spread/scan/scale response; kicks and
downbeats add a smaller pulse, while overall energy supplies a continuous base.
These are temporary visual responses, not a second audio detector or full
production choreography. Transport pause holds phase; seek/loop, source,
analysis/context discontinuities clear impulses and restore authored pattern
state. BPM Sync governs movement timing; Trigger always means the selected
canonical musical event even with motion sync OFF. Auto Performance is not
exposed by these previews and cannot silently own their patterns or colors.

## Resource limits and approximation boundaries

Preparation samples at most 1,536 triangle-informed points once per attachment.
Samples are deterministic barycentric points selected across triangle indices;
they are not area-weighted simulation particles. Surface-derived proxies retain
source shape information but do not guarantee topology or enclosed-volume
accuracy. Slices use sample-band envelopes, so internal holes can be bridged.
Voxels quantize sampled surfaces rather than filling volume; overlapping samples
may occupy the same cell. Shatter uses tetrahedral proxies rather than cutting
the actual mesh. Hologram has no true volumetric scattering. All are reference
scaffolds, with limitations visible in catalog descriptions.

| Tier | Fragment instances | Dust points | Slice cap | Cube instances |
| --- | ---: | ---: | ---: | ---: |
| Low | 24 | 256 | 6 | 64 |
| Medium | 48 | 768 | 10 | 160 |
| High | 96 | 1,536 | 14 | 320 |

Slice visibility uses a fixed prepared pool with a tier-dependent stride, so a
lower tier can draw fewer than its cap. All geometry/materials are prepared at
attachment; frame updates change transforms, instance matrices and point-buffer
positions. Form/Hologram retain the source mesh subject to Phase 05's GLB budget;
there are no private LOD files. The procedural neutral floor, camera, lights and
environment still come from `Cinema2UserModelBaseEnvironment.ts`. A future
authored stage can replace those fields without editing bindings or six presets.

## Files and artwork

New runtime files:

- `src/components/vyzualz/cinema2/model/Cinema2UserModelPreviewEffects.ts`
- `src/components/vyzualz/cinema2/model/Cinema2UserModelPreviewPatterns.ts`
- `src/components/vyzualz/cinema2/model/Cinema2UserModelPreviews.test.ts`

New authoring files under `src/components/vyzualz/cinema2/presets/`:
`Cinema2UserModelPresetFactory.ts`, `Cinema2UserModelFormPreset.ts`,
`Cinema2UserModelShatterPreset.ts`, `Cinema2UserModelDustPreset.ts`,
`Cinema2UserModelHologramPreset.ts`, `Cinema2UserModelSlicesPreset.ts`, and
`Cinema2UserModelVoxelPreset.ts`.

Existing integration changes: `Cinema2FirstPartyPresetCatalog.ts`,
`Cinema2ThreeSceneModule.ts`, and `three/Cinema2ThreeSceneBridge.ts`. No shared
inspector branches or parameter schema changes were needed for Phase 06.
`verify-previews.mjs` is the new focused browser script. Six distinct WebP catalog
thumbnails live at `public/preset-artwork/drmvyz.cinema2.user-model-<kind>.webp`,
matching the existing preset-card artwork convention. They are actual neutral
placeholder renders, contain no private user artwork, and can be refreshed with
`--thumbnails` after browser validation.

## Validation and handoff

- 104 focused tests pass: all six declarations and authoring/compilation,
  duplicate IDs, four Design parents, shared quality/schema state, source
  immutability/disposal, 36 distinct arrangements, all 11 canonical trigger
  events and duplicate suppression, same-value/manual precedence, reset behavior,
  pinned workspace persistence, Phase 05 private runtime, existing Three
  scene/PBR/compiler and Mainframe keeper regression tests.
- Chromium/WebGL uses the real `Cinema2Runtime`, preset catalog and generic
  Inspector, Three.js bridge, generated GLB bytes and Phase 05 resolver/cache.
  Only the remote repository/Auth boundary is a fixture. Captures cover every
  representation and its six patterns; all pairwise pattern differences, four
  independent palette roles per preset, energy/kick/phrase response, model
  A/B/A, three quality tiers, reentry/workspace reload, BPM Sync ON/OFF, trigger
  duplication/manual precedence, missing assets and aspect resizing are checked.
  GPU geometry counts remain bounded across model and preset switching; cache
  entries/holders reach zero after shutdown. No browser page errors.
- A separate focused browser pass checks minimum/mid/maximum scalar values for
  all six previews, including real opacity, intensity, emission, movement speed
  and amount, reactive strength and response decay. The first pass caught and
  fixed transparent-material shader invalidation; the corrected pass passes.
- TypeScript and production build pass; focused ESLint passes. Existing large
  build-chunk advisories remain. No unrelated failing inspector/jsdom test was
  repeated. Working tree/diff review preserves earlier phase and unrelated edits.

```sh
# Node 22 and installed Playwright Chromium
npx vitest run src/components/vyzualz/cinema2/model/Cinema2UserModelPreviews.test.ts
node scripts/model-assets/verify-previews.mjs
node scripts/model-assets/verify-previews.mjs --controls-only
# Refresh only public neutral catalog captures after the full render checks:
node scripts/model-assets/verify-previews.mjs --thumbnails
npm run build
```

Ignored local evidence: `artifacts/model-preview-phase06/result.json`,
`controls-result.json`, six default/model captures, 36 pattern captures,
inspector captures, aspect captures and missing-model screenshot. Static render
captures were visually inspected. **Human visual/musical approval is pending;
these remain Preview/reference entries, not finished effects.**

No new dependencies, SQL migrations, storage domain, schema version, transport,
output canvas or renderer was added. No commit was requested or created. Existing
Media Manager flows, shared Music Intelligence, persistent parameter state and
private model versioning remain the owners established in earlier phases.
Authenticated real-Supabase end-to-end validation and migration 0047/0048
deployment remain pending. Packaging, real-account/security acceptance and the
release gate belong to Phase 07, which was not started.


## User-model buildout — Phase 2: shared preparation

All six previews now use `Cinema2UserModelPreparation.ts` once on model attachment.
It reads the pinned model's actual indexed or non-indexed triangles through nested
transforms, retains mesh/material-slot and source-triangle identities, transformed
normals and UV0, and computes exact surface bounds. A centered rest frame and
`scaleToUnit` (two-unit longest side) provide consistent coordinates without changing
the GLB, its buffers, materials, hierarchy or saved model/version binding. This replaces
sample-derived framing; the existing camera and neutral stage are unchanged.

A deterministic area-stratified sampler provides 1,536 surface positions plus normals,
UVs, triangle IDs and barycentric weights. This avoids assigning most particles to
small but densely tessellated details. Preparation also records 14 horizontal section
intervals and each triangle's overlapping section range, including triangles crossing
multiple intervals. These are broad-phase inputs for future actual cuts, not completed
slice meshes, end caps, fracture pieces, voxel volumes or dissolution choreography.

Limits are checked before large buffer allocation: 250,000 source triangles, 1,024
meshes and 32 MiB of typed preparation buffers per attachment. The estimate reserves
116 bytes per source triangle and 48 bytes per surface sample. This is a **CPU**
preparation allowance, separate from Cinema 2.0's GPU quality budgets; existing proxy
quality draw limits still apply. Invalid indices/coordinates/UVs, incomplete triangles,
unsupported skinned/instanced meshes and empty surfaces fail explicitly. Zero-area
triangles are excluded. Existing import validation and account authorization remain
in place. No cross-account or idle preparation cache is introduced.

Duplicate attach is idempotent. Quality switches and animation reuse the prepared
rest data. Detach restores the original subtree and instance material state, releases
owned proxies and preparation buffers, and does not dispose leased source geometry
or textures. Failed attachment rolls back reparenting and releases its owned resources.
Inspection reports triangle/sample/section counts, buffer bytes and frame dimensions.
Dust's point buffers are now sized to the maximum rendered count rather than twice
that count per cloud. No effect-specific buildout from Phases 3–8 is included.

Validation: focused preparation, preview, musical-state and private-model lifecycle
tests cover transformed bounds, area weighting, provenance, material groups, crossing
sections, invalid/over-budget geometry, repeated attachment, failure rollback, and all
six preview lifecycles. Final visual approval of the individual effects belongs to their
later implementation phases.

## User-model buildout — Phases 3 and 4: Form and Dust

Form and Dust now have a frontal neutral studio presentation using the existing
shipped neutral HDR reflection environment and a palette-controlled rim light. Their
placeholder floor, pedestal ring and contour halo are hidden/omitted. The other four
previews retain their earlier presentation and effects. Names and preset IDs stay
unchanged. Revision 1 is retained for these additive controls so the Phase 1 pinned
asset/version and previously saved settings restore; absent new fields take defaults.

### Form

The original mesh, UVs, texture maps, roughness, metalness and other physical-material
properties remain the baseline. Primary/Secondary tint is now opt-in via **Tint Model
from Palette**, default off. Intensity, opacity and emission remain intentional user
controls; their saved values are respected. New defaults use intensity 1 and emission 0.
Model Rotation is -180…180 degrees and Model Scale is 0.5…1.2. The six existing patterns
provide distinct whole-model motions: frontal drift, three-quarter presentation,
suspension, rocking, breathing and a slow turn. They animate during playback with
Pattern Change and Auto Performance off; zero movement/speed holds the pose.

### Dust

Each selected pattern now runs a complete repeatable lifecycle: solid hold, progressive
surface dissolution, particle choreography, gathering, and surface reconstruction.
**Dissolve Cycle** defaults to 16 beats (8 seconds at 120 BPM and speed 1), range 8…64
beats; Movement Speed scales its timing. It does not depend on Pattern Change. Manual
pattern changes and transport discontinuities restart from the solid model. With no
track playing it shows the solid model. Ordinary pause freezes the base cycle. Shared
Auto Performance retains its existing authority: a build gathers and a fresh drop
releases particles, without writing to the authored Pattern or toggles.

Dissolution patches the instance's original PBR shader rather than replacing its
material. A root-local surface rank shared by the shader and CPU controls where the
mesh disappears and where sampled particles release. The particle field is bounded
and uses six distinct vector fields: surface dispersal, rising drift, halo orbit, twin
plumes, wave gathering and compressed mist. Gathering brings every particle back to
its own sampled rest position before the original mesh is progressively restored.
Grains have circular soft edges and individual opacity; the source file is never edited.

Dust quality limits are 1,024 / 4,096 / 16,384 total grains at Low / Medium / High.
Preparation accepts an explicitly bounded sample count up to 16,384, while the other
previews keep their 1,536-sample default and the 32 MiB typed preparation limit. Point
buffers are allocated once and reused; quality changes alter draw counts. Their
resident 256 KiB at maximum quality allocation are now included in the bridge's GPU
estimate (the existing mesh-only measurement omitted Points). Shader hooks, proxy
buffers and preparation are released/restored on detach.

Both developed previews also follow real transport playback and the shared tempo
fallback while analysis is unavailable, without inventing energy, beats or semantic
musical events. Analyzed audio continues to use the established shared beat clock.
Existing Auto Performance, source binding and palette controls are preserved.

Validation: 113 focused tests pass across preparation, all six declarations/arrangements,
Form/Dust lifecycle, saved-state compatibility, private-model ownership and shared
Auto Performance. TypeScript and focused lint checks pass. An isolated WebGL browser
fixture rendered Form plus all Dust stages (solid, dissolve, drift, gather, reform,
restored), with no shader errors or GL errors. Live app inspection confirmed the
user's pinned **DVYDRM Logo Pure Diamond 3D · v1** loads in both developed previews
and exposes the new canonical controls. No live song was started; representative
whole-song visual acceptance and casting validation remain part of Phase 9.

## User-model buildout — Phase 5: actual Slices

The Source panel now omits the selected-model status row, Remove Model and Open
Media Manager in **all six** previews, as well as Bass Sigil. Search, grid/list,
model selection, pinned versions and availability/update notices remain functional.
This is enforced by shared preview identity, not separate duplicated panels.

Slices now clips the pinned model's actual triangles into 14 horizontal bands;
rectangular envelope proxies are removed. Intersections interpolate normals, UV0–UV3
and vertex RGBA. Source material groups and cloned physical materials retain their
texture references and other PBR properties. The source buffers and textures remain
leased and immutable. Closed cut contours are welded and triangulated with nested
hole support; both neighboring bands receive outward-facing cut caps. Open or
non-manifold contours remain uncapped and report a recoverable model diagnostic.
They are not filled with invented geometry. A flat model without vertical thickness,
or preparation exceeding a limit, keeps the original visible and reports the reason.

The existing six names now drive actual sections: Layer Stack, Stair Step, Fan
Sections, Alternating Bands, Ribbon Wave and Collapsed Layers. Every selected pattern
runs an assembled → separated → reassembled cycle with Pattern Change off. Slice
Cycle defaults to 16 beats, range 8–64; Movement Amount, Movement Speed, shared BPM,
reactivity, rotation and scale retain their bounds. Ordinary pause freezes the base
cycle. Auto Performance gathers during a detected build and releases on a fresh drop
without changing authored settings. All bands stay present at every quality tier;
Low no longer drops sections and destroys the model's silhouette.

At full assembly the original model is shown, avoiding coincident internal cap seams.
During separation only the actual sections are drawn. Slices uses the same neutral
studio presentation and opt-in material tint as Form/Dust; Accent colors the cut caps
and rim light. The compatible preset ID/revision and pinned asset/version persist.

Preparation is once per attachment, never per animation frame or quality switch.
Output is bounded by 400,000 generated triangles **or** 64 MiB of typed vertex data,
whichever is reached first, plus 100,000 cut segments, 2,048 loops per boundary and
8,192 material groups. Chunked temporary buffers avoid unbounded number arrays;
finalization can temporarily retain both chunks and completed attribute buffers.
These limits are separate from the 32 MiB shared rest-data limit. Resident slice
geometry is measured by the existing bridge GPU accounting. Owned geometry and
material clones are disposed once on replacement, failure or shutdown; shared textures
and source geometry are never disposed by the slice representation.

Validation: 15 Source-panel DOM tests include each preview and Bass Sigil. The model
suite passes 125 tests, including 12 actual-slicing checks for area/volume preservation,
cap winding, hollow sections, material/UV/color interpolation, open surfaces, pause,
reassembly and cleanup. An isolated GPU fixture rendered all six slice patterns plus
assembled/reassembled poses without GL or shader errors. The torus fixture produced
14 bands, 7,564 triangles (2,552 cap triangles), zero open contours, approximately
1.56 MiB vertex buffers and 28 separated draw calls. Representative live-song and
casting acceptance remain in Phase 9; Shatter, Hologram and Voxel buildouts are not
part of this phase.

## Model buildout — Phases 6–9 (2026-11-20)

These sections supersede the original proxy descriptions for Shatter, Hologram
and Voxel above. All six presets now use the neutral studio presentation and
preserve their existing preset IDs, revision 1 and pinned model/version bindings.

### Phase 6: Shatter

Shatter partitions the actual model through three differently oriented cutting
stages (4 × 3 × 2), producing up to 24 independently pivoted fragments. Exterior
normals, vertex colors, UV channels and PBR texture references survive clipping.
Closed contours receive triangulated cut faces; open/non-manifold contours are
reported and are not filled with invented geometry. Fragment choreography covers
the six existing patterns and returns to the exact assembled rest pose.

Preparation is bounded to 400,000 output triangles and 64 MiB of final geometry,
plus the shared per-cut/intersection/preparation limits. All fragments remain
present at every quality tier. This is geometric partitioning, not a physics
simulation. An over-budget preparation keeps the original model visible and
reports the limitation.

### Phase 7: Hologram

Projection is applied to the actual PBR surface shader: spatial scan lines,
traveling scan fronts, bounded signal modulation, pulse and cross-scan variants.
Actual crease edges supply the wire contour and paired echoes. Tilt and pulse
also affect model presentation. No generic scan-plane substitute remains.
Shader hooks are chained and restored when the asset detaches.

Contour preparation is limited to 120,000 input triangles and 200,000 edge
vertices. Models over that budget retain surface projection with an explicit
contour limitation. Edge buffers are counted in GPU estimates. This is surface
projection, not volumetric light scattering.

### Phase 8: Voxel

Each quality tier builds a unique spatial occupancy grid from triangle/AABB
intersection tests, rather than snapping random samples or filling a bounding
box. Welded edge incidence identifies closed geometry. Closed models receive an
exterior flood fill and solid interior; open/non-manifold models use their
actual surface shell with an explicit notice. Through-holes remain empty when
resolved by the grid. Six existing choreographies animate this representation,
with a short material crossfade and return to the original model each cycle.

Low/medium/high use 12/18/24 cells along the maximum extent, with a 20,000-cell
limit per tier and 8,000,000 triangle/box tests across preparation. Geometry,
instance matrices and colors are allocated once; switching tiers does not
allocate instance color buffers. GPU estimates include all resident instance
buffers. Cell colors average intersected source material base colors; voxel
cubes do not reproduce the original texture maps. Resolution can merge details
smaller than a cell. Watertightness is conservatively diagnosed; intersecting or
non-manifold input is not silently repaired.

### Phase 9: integration and validation

Shatter, Hologram and Voxel have an 8–64 beat Transformation Cycle (16 by default).
Each selected pattern transforms and reforms the model while Pattern Change is
off. Movement Amount or Movement Speed zero assembles the original. Shared BPM
Sync, rhythm/structure event identities, manual pattern authority and bounded
Auto Performance build/drop overrides remain authoritative. Basic transport
motion works before analysis is available; no synthetic beat events are created.
Pause freezes baseline transport choreography; Auto Performance intentionally
releases its override on pause. Seek, track change and context-generation changes
reset transient state. Added controls restore defaults in legacy saved states
without losing pinned private asset versions.

Preparation notices now say “Model effect preparation” in both the Source panel
and model selector. They do not tell the user that a successfully loaded model
is unavailable. Fatal private-model loading errors retain their existing handling.
The three removed Source-panel elements remain absent from all six presets.

Validation:

- Focused model suites cover exact fragment volume/bounds/reassembly, nested
  transforms, texture ownership, real projection shader hooks, complete voxel
  occupancy, torus holes, open shells, all six pattern arrangements, musical
  trigger/Auto Performance authority, persistence and cleanup.
- A synthetic three-minute transport for each preset exercises repeated cycles,
  quality switching, pause, seek, track/context resets and stable buffer counts.
- Isolated real WebGL fixture: 36 patterns, 144 renders across all quality tiers
  and reassembly, zero shader/WebGL errors, 36 live canvas-capture checks. Each
  relay copy's visible-pixel count matches its rendered source (tolerance 10
  pixels). Output dispatch and preview source replacement also pass their
  existing production-path tests. This does not certify a physical receiver.
- Fixture preparation peaked at 65.9 ms on this machine. The recorded render
  timings include shader compilation and synchronous pixel readback and are
  not a real-time FPS benchmark.
- Native app inspection confirmed the saved DVYDRM Logo Pure Diamond 3D · v1
  selection loads in Shatter, with the new controls and the three Source actions
  absent. Its open contour notice is retained honestly. Native whole-song
  playback and physical external-display/Google Cast receiver acceptance were
  not performed; no track or receiver was active.
- TypeScript and focused ESLint checks passed. Generated fixture files and
  screenshots are local ignored artifacts under `artifacts/user-model-final/`.

### Notification placement correction

Live model warnings are owned once by the Cinema 2.0 Stage and registered through
`DrawerNotice` in React's standard right-side Notifications modal. They remain
available independently of the Source/Design tab selection, deduplicate identical
module diagnostics and disappear when resolved or when the runtime retires.
Source and Inspector no longer draw duplicate runtime warning cards inline.
Model-library errors and newer-version notices also use the existing drawer
workflow, retaining their original retry/update actions. Transient loading does
not register a warning notification.

### Removed built-in model placeholder

The six previews no longer instantiate a torus knot before a private model loads.
The shared model slot is genuinely empty during loading, after clearing a
selection and on load failure. The legacy `default-model` saved binding remains
compatible and now means an empty slot; the selector displays “No model.”
Import diagnostics continue through Notifications. Empty dynamic scenes remain
buildable so the selected model can attach when its asynchronous load finishes.
The optional neutral floor used by other model stages remains independent.

### Model selection stays in Source

All six previews hide the Model selector from the Design inspector using the
standard parameter exposure rule. Its thumbnail, pinned-model summary, search,
dropdown and Create in Media Manager action no longer appear there. The model
parameter and its saved binding remain intact; the left Source library continues
to select the model. Pattern is the first visible control in the Design group.
