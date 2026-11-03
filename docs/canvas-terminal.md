# CANVAS preset specification: Terminal

**Implementation status: Started**

Terminal is selectable in CANVAS. The direct renderer, versioned recipe and Design controls are implemented. See Verification for the checks and remaining release coverage.

| Identity | Value |
| --- | --- |
| Preset name | Terminal |
| Visual effect | ASCII / glyph reconstruction |
| Stable preset ID | `canvas-terminal` |
| Renderer kind / nested settings key | `terminal` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/terminal/` |
| Initial nested settings version | `1` in CANVAS settings schema 18 |

## Desired effect and media

Reconstruct media as a grid of letters, numbers, and punctuation selected from local brightness and optional edge direction. Preserve source colors or use a deliberate terminal palette. The result should remain readable as both the source image and a field of actual glyphs, distinct from Particle Aura, halftone dots, and SHIFTGRID tiles.

Support still PNG, JPEG, WebP, SVG and the existing video source. Transparent regions produce transparent empty cells. Use packaged or locally generated glyph atlases; no new font library, upload flow, remote font dependency, or DOM node per character.

## Parameters

The scoped Design group uses the defaults below. Normalization restores defaults
for non-finite values, clamps out-of-range values and validates enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Glyph Amount | 0–1 | 1 | Master glyph reconstruction influence; zero returns the native source. |
| Character Set | ascii / numbers / symbols | ascii | Validated built-in sets ordered by visual coverage. |
| Cell Size | 4–48 px | 10 | Nominal glyph height in stage pixels, constrained by the effective Quality grid. |
| Glyph Contrast | 0–2 | 1 | Brightness-to-character selection contrast. |
| Brightness Bias | −1–1 | 0 | Bias character coverage without changing source opacity. |
| Edge Awareness | 0–1 | 0.4 | Favor directional glyph strokes near image edges. |
| Character Change Rate | 0–4 | 0.5 | Deterministic decorative substitutions; never destroy the coverage mapping. |
| Color Mode | source / monochrome | source | Source-sampled glyph color or an authored ColorRow color. |
| Monochrome Color | hex color | #55ff99 | Conditional on Monochrome; one canonical ColorRow. |
| Background Fill | 0–1 | 0 | Optional cell background within source coverage; transparent source pixels remain transparent. |
| Glyph Glow | 0–1 | 0 | Optional bounded halo, scaled away at clean endpoints. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation and event choices; runtime cursors remain outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound drawing-buffer resolution and glyph-grid size. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Increase glyph coverage through a smoothed brightness bias. |
| Kick | Briefly emphasize coverage and character brightness. |
| Snare/transient | Trigger a short seeded substitution accent, deduplicated by event identity. |
| Mids / highs | Modulate glyph detail / restrained edge emphasis. |
| Build / drop | Increase substitution activity during builds; introduce a stronger temporary glyph treatment at a qualified drop. |
| Phrase / breakdown | Auto Performance may select a temporary character family on a phrase; breakdowns gradually reconstruct the original. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Choosing a Character Set disables Auto Performance. Auto Performance can
temporarily change the runtime family at qualified phrases and increase source
reconstruction in intro, breakdown and outro sections. The Design field
continues to show the authored set. BPM Sync uses the qualified beat position
for substitution timing, independently of Audio Reactivity. With Audio
Reactivity at zero, audio-driven accents and family changes are disabled.

## Rendering and reset policy

The WebGL2 pass samples the source and looks up actual rasterized monospace
glyphs in a locally generated 48-entry atlas. Each family is sorted by measured
ink coverage. Edge awareness and seeded substitution choose between adjacent
glyphs within a coverage band. The local platform monospace font can differ
between devices. Decorative choices are repeatable with the same atlas,
settings, cell coordinates and time.

Low, Balanced and High cap the grid at 96×72, 160×120 and 240×180 and the drawing
buffer at 960, 1920 and 2560 pixels on its longest edge. Auto chooses a tier
from the logical stage area. The source texture is capped at 4096 pixels per
edge and the atlas is 384×96. There is one presentation pass and no feedback
history. Video reuses the CANVAS decoder and updates the source texture as
frames become available. The atlas is generated at renderer initialization.

Glyphs, background fill and glow remain within original source alpha. The GPU
frame feeds the direct capture compositor. Zero Glyph Amount and full Source
Reconstruction route preview and capture to the native source. The renderer
holds the last drawable frame while a video seek is pending. Pause freezes
decorative substitutions. Source and transport discontinuities clear transient
modulation without replaying accents. A lost WebGL2 context falls back to the
native source and can retry on restoration.

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

Focused tests cover registration, settings normalization, migration, provenance,
quality caps, phrase authority, BPM Sync, and trigger reset behavior.
The [Terminal browser smoke](verification.md#terminal-browser-smoke) passed
with a transparent PNG and moving WebM, including processed screenshot
capture, native reconstruction, context recovery, and pause and seek.

Native recording and casting, hardware profiling, extended playback, and the
broader media and ownership regression matrix are pending.

## Full release checklist

Verify luminance-to-coverage ordering, actual glyph silhouettes, conditional character/color controls, transparency and non-square source mapping. Test video updates without rebuilding the atlas every frame, seeded substitution repeatability, legibility, and no CPU/DOM growth with cell count.

- [ ] Registration, enum/range normalization, old-save hydration, reset and Exact/Modified provenance tests pass; source IDs remain separate from SYSTEM recipes.
- [ ] Browser captures show the named effect on common fixtures, original/low/high strength, clean reconstruction, alpha PNG, opaque JPEG, SVG and video where specified; every visible control has an effect.
- [ ] Deterministic synthetic Performance Core frames demonstrate bass/kick/snare/build/drop/reconstruction behavior, Audio Reactivity 0, missing-capability fallback and manual authority without source replacement.
- [ ] Pause, fine/large seek, loop, replacement, source deletion, signed URLs, resize, rapid switching, shader failure, unavailable WebGL2 and context loss/recovery are exercised.
- [ ] Live preview, screenshots and a real recorded/cast-source canvas agree in alpha, aspect, transforms and opacity; Show/authored owner handoffs remain correct.
- [ ] GPU allocations/passes/texture bytes and extended-playback cleanup are measured at logical 1280×720, 1920×1080 and 3840×2160 where available. Record actual device, internal render sizes and remaining limits.
- [ ] Focused preset plus affected CANVAS/Show/persistence regressions, typecheck and production build run successfully for the patch, or unchanged baseline failures are explicitly identified. Update canonical engine/output documentation with actual implemented capability.

## Visual references

These demonstrate the target effect; their host-application projects are visual
references rather than drop-in CANVAS implementations.

- [ASCII Effect in TouchDesigner — Simon Alexander-Adams](https://www.youtube.com/watch?v=LzcZBvc0WqY)
- [Severance Inspired ASCII Text Effect — Dean Cheesman](https://www.youtube.com/watch?v=WdwRsiC85rE)
