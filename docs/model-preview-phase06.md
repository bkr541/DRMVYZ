# Phase 06 — Six user model reference previews

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
