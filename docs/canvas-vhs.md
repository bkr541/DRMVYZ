# CANVAS preset specification: VHS

**Implementation status: Started**

VHS is selectable in CANVAS. The direct renderer, versioned recipe and Design
controls are implemented. The checklist below tracks release acceptance.

| Identity | Value |
| --- | --- |
| Preset name | VHS |
| Visual effect | CRT / analog display and tape treatment |
| Stable preset ID | `canvas-vhs` |
| Renderer kind / nested settings key | `vhs` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/vhs/` |
| Initial nested settings version | `1` in CANVAS settings schema 21 |

## Desired effect and media

Treat media as an imperfect analog signal: tape tracking, chroma bleed, dropouts, rolling distortion and grain, with optional CRT curvature, scanlines, phosphor texture and persistence. Tape artifacts and CRT display artifacts are separate models with a deliberate Hybrid option. This is a visual treatment, not VHS encoding or a new audio effect.

Support PNG, JPEG, WebP, SVG and video without retiming or degrading the stored media file. Preserve source alpha. The initial effect must not add an opaque screen/background rectangle behind transparent artwork.

## Parameters

The scoped Design group uses the defaults below. Normalization restores defaults
for non-finite values, clamps out-of-range values and validates enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Treatment | tape / crt / hybrid | hybrid | Select the active models; hide controls for inactive models. |
| Signal Amount | 0–1 | 0.65 | Master treatment strength; zero bypasses every signal/display artifact. |
| Signal Damage | 0–1 | 0.25 | Tape instability macro, bounded by the individual authored controls. |
| Tracking Error | 0–1 | 0.15 | Horizontal tape misregistration; Tape/Hybrid only. |
| Dropout Amount | 0–1 | 0.1 | Seeded short tape dropouts; Tape/Hybrid only. |
| Color Bleed | 0–1 | 0.25 | Horizontal chroma smearing; Tape/Hybrid only. |
| Warp / Roll | 0–1 | 0.15 | Bounded geometry and vertical synchronization disturbance. |
| Grain | 0–1 | 0.15 | Seeded analog noise inside source coverage. |
| Scanline Strength | 0–1 | 0.3 | CRT line modulation; CRT/Hybrid only. |
| Screen Curvature | 0–1 | 0.08 | CRT display curvature; CRT/Hybrid only. |
| Phosphor Mask | 0–1 | 0.2 | RGB phosphor structure; CRT/Hybrid only. |
| Phosphor Persistence | 0–0.85 | 0.15 | Optional single-pass temporal persistence; CRT/Hybrid only. |
| RGB Misalignment | 0–1 | 0.08 | Bounded channel registration error. |
| Artifact Speed | 0–4 | 1 | Manual time-based movement of tracking, grain and roll. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation and event choices; runtime cursors remain outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound drawing-buffer and history resolution, chroma taps and scanline detail. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Increase bounded tracking/geometry movement and persistence accents. |
| Kick | Briefly increase phosphor brightness or tape displacement with a controlled release. |
| Snare/transient | Trigger a short seeded dropout or synchronization accent, never a source restart. |
| Mids / highs | Adjust signal texture / restrained scanline and chroma detail. |
| Build / drop | Increase signal tension through a build and release a short bounded damage burst at a qualified drop. |
| Intro / breakdown / outro | Reduce damage and persistence while restoring the original image; keep authored Treatment fixed when Auto Performance is off. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Auto Performance reduces treatment strength and afterglow in intro, breakdown
and outro sections. Choosing a Treatment disables Auto Performance. The
authored Treatment stays fixed. BPM Sync uses the qualified shared beat position
independently of Audio Reactivity. With Audio Reactivity at zero, artifact
movement follows the authored timing and musical accents are disabled.

## Rendering and reset policy

- **Tape** introduces line-level time-base error, a lower-edge head-switching
  band, horizontally delayed chroma and seeded, interrupted dropout streaks.
- **CRT** bends the display and applies luminance-sensitive scanlines, a
  staggered RGB phosphor pattern and optional decaying bright afterglow.
- **Hybrid** feeds the tape signal into the CRT display. Roll, grain and RGB
  registration are available in all three treatments.

The WebGL2 shader uses the original source texture on each draw. Signal Amount
scales the active models, and source alpha anchors the processed silhouette.
Zero Signal Amount and full Source Reconstruction route preview and capture
to the original source.

Low, Balanced and High cap the output edge at 960, 1440 and 2560 pixels, the
chroma kernel at 3, 5 and 7 taps, and the CRT scanline grid at 144, 216 and 270
rows. The effective CRT grid also accounts for physical output pixels. Auto
chooses the tier from the logical stage area. The source texture is capped
at a 4096-pixel edge. Tape and CRT without persistence use one draw. When CRT
persistence is active, two RGBA8 targets store one recursive draw plus a
presentation copy. The targets use up to 50 MiB together, excluding the source
texture, drawing buffer and CANVAS capture. The weight is capped at 0.85, and
history is released when persistence is disabled or Tape is selected.

Source changes, resize, Treatment changes and transport discontinuities clear
history influence. The next six advancing draws use zero history weight.
Pause holds the processed frame. A paused seek reconstructs the new position
without carrying old phosphor or firing a musical accent. Grain and dropouts
are deterministic from seed and position. Phosphor afterglow depends on
previous frames. WebGL2 failures fall back to the original source. Authored
layers and active Shows retain output ownership.

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

The [VHS browser smoke](verification.md#vhs-browser-smoke) verified all three
treatments on a color chart and a transparent logo, conditional controls,
seeded reconstruction, clean endpoints, phosphor warmup and reset,
processed screenshots and WebM recording, decoded video, pause, seek,
resize, context recovery, and authored and Show handoffs. With Chromium
SwiftShader, Auto rendered 1280×720, 1440×810 and 960×540 at logical stages of
1280×720, 1920×1080 and 3840×2160 respectively. Their two history textures
used about 7.0, 8.9 and 4.0 MiB, excluding the source and output surfaces.

Focused tests cover recipe migration, provenance, quality bounds and
musical authority. Desktop recording and casting, analyzed-track review,
physical GPU endurance, and additional media and failure cases remain
release checks.

## Completion criteria

Capture Tape, CRT and Hybrid separately. Verify conditional parameters, visible chroma bleed versus real phosphor/scanline structure, seeded dropouts, persistence bounds, no source restart on accents, transparent logos, neutral clean endpoints, and no stale feedback after rapid switching.

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

- [Analog Effect in TouchDesigner — phase space](https://www.youtube.com/watch?v=kc5mgjoGWRo)
- [ANALOG_TV demonstration — Basement Vibes](https://www.youtube.com/watch?v=5d7zizvAfrk)
