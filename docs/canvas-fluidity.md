# CANVAS preset specification: Fluidity

**Implementation status: Started**

Fluidity is selectable in CANVAS. The direct renderer, versioned recipe and Design controls are implemented. The release checklist below tracks broader acceptance.

| Identity | Value |
| --- | --- |
| Preset name | Fluidity |
| Visual effect | Liquid glass / optical refraction |
| Stable preset ID | `canvas-fluidity` |
| Renderer kind / nested settings key | `fluidity` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/fluidity/` |
| Initial nested settings version | `1` in CANVAS settings schema 19 |

## Desired effect and media

Bend the selected image through animated glass-like surfaces: rounded lenses, liquid contours, ripples, or ribbed glass. Magnification, beveled edges, moving highlights and optional color dispersion establish an optical material. This must have a distinct glass-normal/refraction path rather than reuse MUTAGEN Liquify with different numbers.

Support PNG, JPEG, WebP, SVG and video. Derive glass normals from source alpha/luminance or built-in surface fields; an opaque photograph does not require segmentation or a transparent overlay. Fluidity preserves the original source silhouette, including when highlights, frost or dispersion are enabled.

## Parameters

The scoped Design group uses the defaults below. Normalization restores defaults
for non-finite values, clamps out-of-range values and validates enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Surface | sourceContours / ripples / lenses / ribs | ripples | Select distinct bounded surface-normal fields. |
| Glass Amount | 0–1 | 0.65 | Master refraction and surface contribution; zero is the original source. |
| Refraction | 0–1 | 0.45 | Image displacement through the glass surface, with bounded UV sampling. |
| Surface Scale | 0–1 | 0.5 | Lens/ripple/rib size relative to the image. |
| Flow Speed | 0–4 | 0.7 | Continuous surface evolution; supports manual animation with audio response off. |
| Edge Bevel | 0–1 | 0.4 | Apparent edge rounding and thickness. |
| Frostiness | 0–1 | 0 | Optional bounded blur through the material. |
| Highlight Strength | 0–1 | 0.3 | Surface reflection/rim emphasis. |
| Preserve Colors | off / on | on | Retain source palette; disable additional chromatic dispersion while on. |
| Dispersion | 0–1 | 0.15 | Optional separated-channel refraction; show only with Preserve Colors off. |
| Light Angle | −180–180° | −45 | Direction of synthetic surface lighting. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation and event choices; runtime cursors remain outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound drawing-buffer resolution, frost samples and surface detail. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Increase bounded surface curvature and liquid velocity. |
| Kick | Launch a brief refractive pressure/ripple impulse. |
| Snare/transient | Create a small surface ripple or rim-light accent. |
| Mids / highs | Vary surface detail / restrained specular shimmer. |
| Build / drop | Progressively increase optical deformation, with a bounded drop pulse. |
| Intro / breakdown / outro | Reduce refraction and recover source readability without retaining blur or highlight artifacts. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Auto Performance adds temporary source reconstruction in intro, breakdown and
outro sections. The authored surface stays selected, and choosing a surface
disables Auto Performance. BPM Sync uses the shared beat position independently
of Audio Reactivity. With Audio Reactivity at zero, glass motion remains
time-based or beat-synced as authored, and musical pressure and lighting
accents are disabled.

## Rendering and reset policy

- **Source Contours** derives a normal field from premultiplied luminance and
  alpha. The animated bevel stays anchored to the selected media's features.
- **Ripples** combines moving circular wave fronts and a fine surface wave.
- **Lenses** uses a staggered field of seeded convex caps with rounded bevels.
- **Ribs** uses curved cylindrical ridges for directional magnification.

A single WebGL2 pass bends rays through the surface normals, applies directional
specular highlights and optional frost, and samples color from the original
texture. Glass Amount scales the optical path and lighting directly, so lower
strength does not overlay a second copy of the original. Preserve Colors disables channel separation. Frost and dispersion
are bounded texture samples. Samples beyond the image rectangle contribute
transparent black, and the original silhouette anchors the result at thin edges.
Zero Glass Amount and full Source Reconstruction route preview and capture
through the native source.

Low, Balanced and High cap the drawing buffer at 960, 1920 and 2560 pixels on the
longest edge and use 3, 5 and 9 taps for frost. Auto chooses the tier from the
logical stage area. The single source texture is capped at 4096 pixels per
edge and at the device texture limit. There are no feedback targets or
intermediate effect textures. The drawing buffer and shell capture canvas
are separate allocations.

The existing CANVAS decoder supplies video frames. The direct renderer holds
the latest drawable processed frame while a video seek is pending. Pausing
freezes procedural motion and transient envelopes. Transport discontinuities
recompute the base position and clear pressure rings instead of replaying
musical events. Context loss falls back to the original and can retry on
restoration. Authored layers and active Shows retain output ownership.

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

The [Fluidity browser smoke](verification.md#fluidity-browser-smoke) compared
all four surfaces on a transparent PNG and an opaque JPEG. It verified the
clean endpoints, alpha, dispersion gating, pressure modulation, preview,
screenshots, WebM recording and decoding, paused transport seeks, resize,
context recovery, and authored and Show handoffs. In Chromium SwiftShader,
the 720p and 1080p logical stages used their full dimensions and the 4K
logical stage used a 960×540 drawing buffer.

Focused tests cover settings, migration, provenance, quality bounds, musical
authority, and trigger resets. Desktop recording and casting, analyzed-track
review, physical GPU endurance, and the remaining media and failure matrix
are still release checks.

## Completion criteria

Capture each surface with the same logo, transparent PNG and opaque photo/video. Verify visible refraction, distinct normals, conditional dispersion, no palette changes with Preserve Colors on apart from authored lighting, exact clean endpoints and artifact-free extreme aspect ratios.

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

- [Liquid Glass — g3n0m4](https://www.youtube.com/watch?v=lc9gZwFgI1w)
- [Glass Refraction FX — Xtal](https://www.youtube.com/watch?v=uRgXsCT46h8)
