# CANVAS preset specification: Divinity

**Implementation status: Started**

Divinity is selectable in CANVAS. The direct renderer, versioned recipe and
Design controls are implemented. The checklist below tracks broader release acceptance.

| Identity | Value |
| --- | --- |
| Preset name | Divinity |
| Visual effect | God rays / image-driven light shafts |
| Stable preset ID | `canvas-divinity` |
| Renderer kind / nested settings key | `divinity` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/divinity/` |
| Initial nested settings version | `1` in CANVAS settings schema 20 |

## Desired effect and media

Generate directional light shafts from source highlights or silhouettes. Logos cast rays around their edges and photographs develop shafts from bright areas, with a movable light origin controlling their direction. Use image-driven screen-space scattering, distinct from uniform bloom or a laser-outline treatment; no volumetric 3D scene is implied.

Support PNG, JPEG, WebP, SVG and video. Luminance masking handles opaque images; alpha masking handles logos. Rays may intentionally extend alpha into surrounding transparent space, but unlit space must remain transparent without an opaque backing rectangle.

## Parameters

The scoped Design group uses the defaults below. Normalization restores defaults
for non-finite values, clamps out-of-range values and validates enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Ray Amount | 0–1 | 0.6 | Master scattered-light contribution; zero is the original source. |
| Mask Source | luminance / alpha | luminance | Choose image highlights or source coverage for the ray mask. |
| Light Origin X / Y | 0–1 each | 0.5 / 0.5 | Light origin in normalized source-image coordinates, before global display transforms. |
| Ray Length | 0–1 | 0.65 | Maximum source-relative scattering distance. |
| Ray Spread | 0–1 | 0.5 | Angular width/dispersion of shafts. |
| Density | 0–1 | 0.45 | Ray accumulation strength within a bounded exposure range. |
| Decay | 0–1 | 0.92 | Attenuation along the ray. |
| Highlight Threshold | 0–1 | 0.65 | Brightness required to seed rays; conditional on a luminance mask. |
| Light Motion Speed | 0–4 | 0.2 | Optional canonical-time movement around the authored origin. |
| Ray Color | source / manual | source | Sample source light colors or use an existing ColorRow control. |
| Manual Ray Color | hex color | #ffffff | Conditional on Manual Ray Color mode; one canonical ColorRow. |
| Clip Rays to Source Alpha | off / on | off | Optionally confine emission to the original silhouette. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation and event choices; runtime cursors remain outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound drawing-buffer and mask resolution and scattering taps. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Expand shafts and slightly move the light origin within authored bounds. |
| Kick | Create a short ray-strength impulse without flashing the entire frame. |
| Snare/transient | Briefly change shaft spread or add a narrow light accent. |
| Mids / highs | Vary beam detail / restrained bright-edge shimmer. |
| Build / drop | Lengthen and intensify shafts through a build, followed by a bounded expansion at a qualified drop. |
| Intro / breakdown / outro | Use softer rays and progressively restore the source contribution. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Auto Performance softens the rays in intro, breakdown and outro sections. It
preserves the authored mask, and choosing a mask disables Auto Performance.
BPM Sync uses the qualified shared beat position independently of Audio
Reactivity. Audio Reactivity at zero leaves authored ray motion active and
disables musical strength, spread and origin accents.

## Rendering and reset policy

The mask pass extracts premultiplied light energy and color from either soft
luminance highlights or source alpha. Dark silhouettes remain visible as
neutral light in source-color alpha mode. The presentation pass samples toward
the resolved light origin through a deterministic angular fan, applying a
distance falloff and bounded exposure. A filtered mask footprint smooths the
spacing between taps. An origin outside a bright feature
casts light away from it along the radial direction. Source samples outside
the image contribute zero. By default the light contributes alpha around the
source and leaves unlit pixels transparent. With clipping enabled the source
alpha is retained. Zero Ray Amount, Ray Length or Density, or full Source
Reconstruction uses the native source in preview and capture.

Low, Balanced and High cap the longest drawing-buffer edge at 960, 1440 and
2560 pixels and the longest mask edge at 384, 640 and 1024 pixels. The
scattering loop has 12, 24 and 40 taps respectively, with a compile-time
ceiling of 40. Auto chooses a tier from the logical stage area. The renderer
owns one reusable RGBA8 mask target with mip levels, up to about 5.33 MiB.
It refreshes the mask when the source, mask mode, luminance threshold or mask
size changes. Source upload,
drawing buffer and CANVAS capture allocations are separate. No temporal
feedback is used.

Motion evaluates from canonical time and the authored seed. Pause holds the
frame. Discontinuities clear transient envelopes and reconstruct light
placement at the new time. While a video seek is pending, CANVAS can hold
the last drawable processed frame. A source revision replaces the mask.
Context loss falls back to the original and can retry on restoration.
Authored layers and active Shows retain output ownership.

## CANVAS architectural requirements

- Reuse `ReactTypes.ts` / `CANVAS_PRESETS` and the existing preset cards. Add the ID, renderer kind and a versioned nested settings record only during implementation; no separate engine or registry. Add strict normalizers/migration/reset in `reactStore.ts` and the record to explicit preset provenance. Missing settings in older saves receive safe defaults.
- Use `activeCanvasMediaId`, `useCanvasRuntimeMediaItems` and the existing Media Manager/preloader. Keep source identity separate from the recipe. Never persist URLs, blobs, decoded pixels, glyph atlases, textures, frame histories or runtime envelopes in SYSTEM presets. Preserve manual media locks and Auto Select authority. Primary image inputs do not use authored-overlay transparency admission.
- Mount only through the specialized direct renderer dispatch in `ReactCanvasEngineShell.tsx`. Initially this is a direct preset: active Show Manager and authored-layer owners retain precedence and their existing mask/effect/blend order. No implicit global Show postprocess or new layer effect ID. A future opt-in integration needs its own complete versioned compositor contract.
- Reuse canonical Design `SelectRow`, `SliderRow`, `ToggleRow`, `NumberInputRow`, `ColorRow` and `Collapsible` as needed. Show only effective controls. Reuse Display fit/scale/position/rotation/output opacity; no new picker, inspector window or center-stage setup UI.
- Own GPU resources within the preset's dedicated subsystem. Reuse `ShaderCompiler` / `ShaderProgram` where applicable. Keep per-frame state out of Zustand/React renders; no per-frame CPU `getImageData`/GPU readback or extra media subscriptions. Honor shared composition/transition/feedback budgets: at most one recursive feedback pass; two ping-pong targets are storage for that one pass, not two passes.
- Proposed quality ceilings: 4096-pixel source texture edge, 2560-pixel processed-output edge and 64 MiB of transient effect textures, further limited by device capabilities. Source textures, drawing buffers and Canvas2D output are separate allocations and must be reported. Auto must reduce both resolution and algorithm/history cost from the same logical viewport. These are design ceilings requiring profiling, not measured guarantees.
- Preserve source aspect, source transforms, premultiplied alpha and source palette unless an explicit optical/color treatment changes them. The preset's master Amount at 0 or Source Reconstruction at 1 uses the native original contribution for exact clean preview/capture. `dryOnly` keeps processed output visible at Dry Source Mix 0; `legacyComposite` retains its single multiplier. Apply global output opacity once, without doubling the original beneath processed alpha.
- Publish the current visible result through the existing CANVAS output canvas for screenshots, recording and visual casting. Drawable original-source fallback is available during GPU/shader failure; missing/failed/deleted media clears stale capture and reports output unavailable. Preserve signed URLs verbatim. `ProductionOutput.ts` remains the LaserDMX adapter.
- Handle source revisions, resize/DPR, visibility, pause/resume, fine and large seeks, loops, track/preset/engine transitions and WebGL context loss. Cancel RAF/timers, remove listeners and dispose textures/framebuffers/programs on departure. A restored context may retry once per source identity; then keep the original and allow deliberate preset re-entry to retry.

Follow [CANVAS](canvas.md), the [implementation contract](../AI_IMPLEMENTATION_CONTRACT.md),
[Shared Performance Core](shared-performance-core.md) and
[recording/output ownership](react-recording-and-output.md). Inspect current source
again before implementing; do not copy MUTAGEN or SHIFTGRID runtime state.

## Verification

The [Divinity browser smoke](verification.md#divinity-browser-smoke) verified
directional shafts on a transparent PNG and an opaque JPEG, clean
reconstruction, alpha clipping, tint, a deterministic kick accent,
processed CANVAS screenshots and WebM recording, decoded video, paused
transport seeks, resize, context recovery, and authored and Show handoffs.
With Chromium SwiftShader, Auto rendered 1280×720, 1440×810 and 960×540
at logical stages of 1280×720, 1920×1080 and 3840×2160 respectively.

Focused tests cover settings migration, provenance, quality caps, musical
authority, and trigger resets. Desktop recording and casting, analyzed-track
review, physical GPU endurance, and additional media and failure cases remain
release checks.

## Completion criteria

Prove rays originate in the selected mask and change direction with the origin. Test opaque highlights and alpha logos, intended alpha expansion/clipping, exposure clamps, source transform order, sample ceilings, clean reconstruction, and video mask updates without CPU pixel readback.

- [ ] Registration, enum/range normalization, old-save hydration, reset and Exact/Modified provenance tests pass; source IDs remain separate from SYSTEM recipes.
- [ ] Browser captures show the named effect on common fixtures, original/low/high strength, clean reconstruction, alpha PNG, opaque JPEG, SVG and video where specified; every visible control has an effect.
- [ ] Deterministic synthetic Performance Core frames demonstrate bass/kick/snare/build/drop/reconstruction behavior, Audio Reactivity 0, missing-capability fallback and manual authority without source replacement.
- [ ] Pause, fine/large seek, loop, replacement, source deletion, signed URLs, resize, rapid switching, shader failure, unavailable WebGL2 and context loss/recovery are exercised.
- [ ] Live preview, screenshots and a real recorded/cast-source canvas agree in alpha, aspect, transforms and opacity; Show/authored owner handoffs remain correct.
- [ ] GPU allocations/passes/texture bytes and extended-playback cleanup are measured at logical 1280×720, 1920×1080 and 3840×2160 where available. Record actual device, internal render sizes and remaining limits.
- [ ] Focused preset plus affected CANVAS/Show/persistence regressions, typecheck and production build run successfully for the patch, or unchanged baseline failures are explicitly identified. Update canonical engine/output documentation with actual implemented capability.

## Status tracking

- **Not started** — specification only.
- **Started** — current. Direct implementation is available with the remaining release checks above.
- **Completed** — set only after the above acceptance checks have evidence and actual limitations are documented. Writing this specification does not complete the preset.

## Visual references

These demonstrate the target effect; their host-application projects are visual
references rather than drop-in CANVAS implementations.

- [God Rays in TouchDesigner — exsstas](https://www.youtube.com/watch?v=G5k0ieMr8q0)
- [Realistic Light Beams — Will Carmack](https://www.youtube.com/watch?v=ER8RV_VeeCM)
