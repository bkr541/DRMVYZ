# Trippy, Bro — Phase 1 implementation

Historical checkpoint: the user approved this enlarged composition and authorized subsequent phases. Current implementation details are in `cinema2-trippy-bro-production.md`; the static-only descriptions below record Phase 1, not the current runtime.

## Scope and review status

Implemented the static Prism Lattice core only, following the user's instruction to begin implementation. The display name is **Trippy, Bro**, preset ID `drmvyz.cinema2.trippy-bro`, module type `trippy-bro-native`, revision/version 1. The catalog role is `reference`, not `keeper`; its description explicitly identifies the unfinished Phase 1 scope.

The preset is ready for review of its static composition. User visual acceptance remains pending. Other patterns, manual controls, musical performance, and finishing belong to later phases. Their absence here is intentional and prevents this development checkpoint from qualifying as a finished preset under the creation contract.

## Authored baseline

The reference is `/Users/kodyrobinson/Desktop/TrippyBro.mov`; the full creative specification and authority matrix are in `cinema2-trippy-bro-implementation-plan.md`.

The baseline contains:

- Two opposing diagonal line banks, 13 lines each, clipped to a centered diamond.
- Three separated diamond border bands with open tips.
- One bold amber circular orbit and four small diagonal orbit markers.
- Four cardinal jewels, each with magenta and amber contours and a pale center.
- One larger central jewel and a blue outer diamond accent.
- A black background and deliberately unfilled gaps.

No shader time/audio input exists. All frames render the same frozen pose. Native stroke antialiasing defines geometry edges; no bloom, trails, feedback, distortion, lighting, postprocessing, or decorative motion is involved.

## Geometry contract

The scene root declares `normalized-screen`. The native fullscreen provider explicitly converts fragment coordinates into its own isotropic artwork coordinates:

`p = (2 * fragmentPixel - outputResolution) / (1.65 * max(outputWidth, outputHeight))`

The origin is at the output center, X points right, and Y points up. The longer dimension spans approximately −0.606 to +0.606. The artwork uses uniform cover framing with intentional overscan on all four sides, as requested during review. Every size below is in those local units, not engine scene-node units.

| Property | Authored value |
|---|---|
| Lattice diamond Manhattan radius | 0.681 |
| Lattice spacing | 0.105 along X+Y / X−Y |
| Border Manhattan radii | 0.74, 0.80, 0.86 |
| Orbit Euclidean radius | 0.685 |
| Cardinal jewel centers | (±0.59, 0), (0, ±0.59) |
| Cardinal jewel Manhattan radius | 0.039 |
| Central jewel Manhattan radius | 0.095 |
| Central blue contour Manhattan radius | 0.14 |
| Diagonal orbit marker radius | 0.016 |
| Stroke half-widths | 0.0032–0.0056 (2× the initial authored widths) |

Diamond distances are normalized by √2 so stroke thickness is consistent with circular strokes. The derivative-free antialias width is 1.1 / artworkSpan; the same span converts all stroke distances to pixels. Endpoint clipping is explicit at the lattice diamond boundary. Outer borders retain authored tip gaps and intentionally continue beyond the viewport. There is no depth buffer policy beyond the authored layer's disabled depth; no camera or perspective transform changes the output.

The outer diamond radius reaches approximately 71% of the longer dimension from the center; the lattice itself reaches approximately 56%. Outer geometry therefore continues off the left, right, top, and bottom at square, landscape, and portrait sizes. Relative to the initial square capture, composition size increases 65% and stroke widths increase approximately 3.3× in pixels (2× authored thickness combined with 1.65× scale). Aspect ratios preserve circular geometry and square angles while deliberately cropping the oversized artwork. The central jewel remains anchored at the canvas center. This replaces the initial fit-with-padding proposal at the user’s request.

## Palette and future control specification

Current colors are fixed shader constants for this static checkpoint. These roles become independent bound color parameters in Phase 2; no editable palette is advertised yet.

| Role | Baseline RGB (0–1) | Consumer |
|---|---|---|
| Background | 0, 0, 0 | Full output background |
| Cyan Structure | 0.10, 0.83, 0.94 | Grid bank subdivisions and inner border |
| Blue Weave | 0.16, 0.28, 0.97 | Grid bank subdivisions and center contour |
| Magenta Accent | 0.96, 0.16, 0.64 | Grid subdivisions and jewel contours |
| Amber Orbit | 1.00, 0.63, 0.06 | Orbit, markers, middle border, jewel interiors |
| Highlight | 1.00, 0.94, 0.78 | Jewel centers |

The outer red-orange border is currently authored at (0.95, 0.18, 0.09). In Phase 2 derive its warm hue from the Amber Orbit role with a documented color transform; it must not remain an unrelated hidden color once palette controls are offered.

The following numeric ranges finalize the starting parameter design for Phase 2. Validate each perceptually before accepting its final range; do not expose parameters before a consumer exists.

| Parameter | Min / default / max | Authority |
|---|---|---|
| Master Intensity | 0 / 0.85 / 1 | Emission ceiling, background independent |
| Music Reactivity | 0 / 0.65 / 1 | Multiplies permitted musical modulation |
| Composition Scale | 0.55 / 1 / 1.04 | User base relative to the new cover framing; outer cropping is intentional |
| Line Density | 5 / 13 / 21 lines per bank | Integer user ceiling; other patterns define equivalent subdivisions |
| Stroke Width | 0.6 / 1 / 2 | Multiplier of authored half-widths |
| Motion Speed | 0 / 1 / 2 | Multiplier of pattern-specific authored rates |
| Motion Amount | 0 / 0.45 / 1 | Multiplier of documented displacement bounds |
| Secondary Detail | 0 / 0.3 / 1 | Budget multiplier; zero removes supporting details |

Mandatory future toggles/enums and exact grouping, the eight-pattern library, authority matrix, and musical mapping remain as specified in the implementation plan. Phase 7 effect ranges will be chosen with their actual effect consumers. They are not implemented or exposed in Phase 1.

## Ownership and timing decision

- Parameter State will own authored controls; the native module will read resolved values on rendering/update rather than cache defaults.
- Shared Audio Intelligence owns musical facts. Existing shared timing utilities provide beat position; no local detector or BPM clock will be introduced.
- Choreography owns bounded temporary contributions through target resolution. Visual Director supplies broad significance only. The native module owns geometry and animation phase.
- The preset BPM Sync toggle will be authoritative for its own motion domains. The host exposes BPM/beat facts and its global sync preference separately; that preference will not silently veto this module's toggle. The existing shared `Cinema2BeatClock.update(frame, syncEnabled)` API accepts the explicit preset choice and resolves analyzed BPM before the host BPM fallback.
- Sync OFF will use authored seconds-based motion. Pattern Change uses shared musical events independently of that motion toggle.
- Clock/reset behavior and continuity must be proven in Phase 2/3 when motion/audio are implemented. This static phase consumes neither timing path and makes no claim of implemented BPM Sync.
- Fixed camera remains the design choice. No camera controls or automated camera domain are planned.

## Runtime architecture

The preset is registered through `Cinema2FirstPartyPresetCatalog` with reference role. Its module is registered through `Cinema2ModuleRegistry`. Rendering uses the real `Cinema2Runtime` scene/layer/provider path and a native fullscreen shader. No separate canvas renderer or imported video playback is used.

The module acquires its `ShaderProgram` and `FullscreenPass` through host-managed resource leases. Their release callbacks dispose the objects. Shader compilation errors surface through module failure diagnostics. The module owns no timer, event listener, texture, history surface, or private WebGL context. The browser harness owns its resize/unload listeners.

Only `render.webgl2` is required. No dependency or shared Inspector change was necessary. The shader's small fixed loop budget is 26 grid lines plus four jewel/marker placements; no unbounded geometry or per-frame allocation is introduced by the artwork.

## Validation and reproducible review

Commands:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2TrippyBroPreset.test.ts
npx tsc --noEmit
node scripts/run-cinema2-trippy-bro-browser.mjs
```

The browser runner launches a local Vite server and Chromium, renders through production registries/runtime, and writes ignored artifacts under `artifacts/cinema2-trippy-bro/phase1/`:

- `square.png` — 954 × 954, matching the source dimensions.
- `landscape.png` — 1280 × 720.
- `portrait.png` — 720 × 1280.
- `report.json` — measured hero occupancy/bounds and runtime/disposal snapshots.

Assertions verify central geometry, substantial negative space, centered bounds, visible strokes crossing every canvas edge, measurable jewel contour thickness, live resizing on the same runtime, unchanged output across multiple frames, no browser/module errors, and released WebGL/RAF ownership on disposal. Focused unit tests verify native compilation/registration, reference status, and absence of unfinished controls or later-phase requirements.

Validation results: both focused unit tests passed; TypeScript checking passed after correcting contextual manifest/module types; production browser validation passed at all three sizes. Focused ESLint checking covers the new TypeScript and runner files. The only shared-source changes are the native module and reference catalog registrations.

The captures were visually inspected: the enlarged lattice stays centered and unstretched in all three sizes, strokes have substantially more weight, and outer geometry continues off all four sides. Peripheral jewels and outer borders are deliberately cropped where the new framing places them outside the viewport. This is a crisp geometry baseline; luminous finishing intentionally comes later. User aesthetic approval is still required before proceeding past the static composition gate.

No broad build, unrelated test suite, or commit was requested. Work remains uncommitted.
