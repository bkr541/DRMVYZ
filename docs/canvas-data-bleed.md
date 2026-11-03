# CANVAS preset specification: Data Bleed

**Implementation status: Completed**

Data Bleed is available in CANVAS Presets. Select a still image or video in Media
Manager and open Design to adjust the recipe.

| Identity | Value |
| --- | --- |
| Preset name | Data Bleed |
| Visual effect | Data moshing |
| Stable preset ID | `canvas-data-bleed` |
| Renderer kind / nested settings key | `dataBleed` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/dataBleed/` |
| Nested settings version | `1` in CANVAS schema `15` |

## Desired effect and media

Smear earlier image information through current movement so colors cling to subjects, break into blocks, and bleed between recognizable source frames. This is a controllable real-time datamosh appearance using GPU motion/displacement and bounded history; it does not modify video codec I/P frames.

Use video for motion-driven corruption. PNG, JPEG, WebP and SVG must also work through a deterministic procedural flow field. A still image must animate without requiring a video or an upload outside Media Manager.

## Parameters

Use one scoped Design group. Normalize non-finite numbers to defaults and clamp
finite out-of-range values and validate exact enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Flow Mode | motion / procedural / mixed | mixed | Select source-motion estimates, authored procedural movement, or their blend; images use procedural movement when no temporal motion exists. |
| Bleed Amount | 0–1 | 0.65 | Scales displacement and the visible processed contribution. |
| Block Size | 2–64 px | 16 | Quantize the displacement field in source-relative image pixels. |
| Motion Sensitivity | 0–1 | 0.5 | Sensitivity to video movement; show only when source-motion estimation is active. |
| Flow Speed | 0–4 | 1 | Procedural flow rate; independent of Audio Reactivity. |
| History Retention | 0–0.95 | 0.7 | Controls the contribution of the previous processed frame. |
| Source Refresh | 0–1 | 0.25 | Fresh source injection with a nonzero internal minimum to prevent indefinite drift. |
| Direction Bias | −180–180° | 0 | Bias the procedural field; do not rotate or retime the actual source asset. |
| Freeze History | off / on | off | Hold the processed snapshot; source/transport reset boundaries still clear incompatible history. |
| Clear History | action | — | Restart from the current source without changing the recipe or media. |
| Source Reconstruction | 0–1 | 0 | 0 = processed image; 1 = original current source. This is separate from CANVAS Dry Source Mix. |
| Audio Reactivity | 0–1 | 0.65 | Scales audio modulation; 0 retains controllable manual time-based animation. |
| BPM Sync | off / on | off | Use a qualified shared beat position for movement rate; independent of Audio Reactivity. |
| Auto Performance | off / on | off | Allow temporary section-aware runtime direction within authored bounds; never overwrite the recipe. |
| Deterministic Seed | 0–2147483647 integer | 91817 | Seed procedural variation and event choices; runtime cursors remain outside persistence. |
| Quality | auto / low / balanced / high | auto | Bound internal resolution, history, sample counts and effect-specific workload. |
| Reset Preset | action | — | Restore this preset's defaults while preserving active media, library IDs, pools and other presets. |

## Audio Intelligence behavior

| Shared intelligence | Intended response |
| --- | --- |
| Bass/sub | Increase bounded displacement and flow velocity rather than only changing brightness. |
| Kick | Create a brief block-displacement impulse and inject recognizable source pixels. |
| Snare/transient | Introduce short directional tears or block resets. |
| Mids / highs | Adjust field detail / restrained chromatic edge detail respectively. |
| Build / drop | Increase corruption progressively, then trigger a bounded release/injection on a qualified drop. |
| Intro / breakdown / outro | Increase reconstruction and release accumulated history. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Authored parameters are durable authority. Audio modulation and Auto Performance produce temporary resolved frames. Choosing a manual mode disables Auto Performance; with Auto off the mode stays locked, while Audio Reactivity may still modulate its effective parameters. BPM Sync changes movement timing independently. Without qualified analysis/grid/sections, retain the authored look and manual animation; do not fabricate musical structure. Use each qualified drop once per identity. Freeze History takes priority over audio events. During stopped manual playback, elapsed animation time may drive movement without inventing a beat clock.

## Effect-specific rendering and reset policy

Estimate video motion from a bounded pair of reduced source frames using GPU luminance/gradient information. Optical flow is visual processing, not another audio analyzer. Keep original/current source sampling separate from recursively processed history. Use two reusable ping-pong targets for at most one recursive feedback update per frame; cap any auxiliary motion textures independently. Reuse existing video decoding and timing rather than seeking a second decoder.

Source URL or revision changes, seeks, loops, track replacement, discontinuities, resize and preset departure discard incompatible history. A native video seek holds the last drawable processed frame during decoding, then refreshes once even while frozen. Resume with six successful zero-history-weight frames before restoring retention. Pause and Freeze History must hold the published processed snapshot. Seeded flow/event choices must repeat after equivalent resets; exact historical corruption replay is not promised.

## CANVAS architectural requirements

- Reuse `ReactTypes.ts` / `CANVAS_PRESETS` and the existing preset cards. Add the ID, renderer kind and a versioned nested settings record only during implementation; no separate engine or registry. Add strict normalizers/migration/reset in `reactStore.ts` and the record to explicit preset provenance. Missing settings in older saves receive safe defaults.
- Use `activeCanvasMediaId`, `useCanvasRuntimeMediaItems` and the existing Media Manager/preloader. Keep source identity separate from the recipe. Never persist URLs, blobs, decoded pixels, glyph atlases, textures, frame histories or runtime envelopes in SYSTEM presets. Preserve manual media locks and Auto Select authority. Primary image inputs do not use authored-overlay transparency admission.
- Mount only through the specialized direct renderer dispatch in `ReactCanvasEngineShell.tsx`. Initially this is a direct preset: active Show Manager and authored-layer owners retain precedence and their existing mask/effect/blend order. No implicit global Show postprocess or new layer effect ID. A future opt-in integration needs its own complete versioned compositor contract.
- Reuse canonical Design `SelectRow`, `SliderRow`, `ToggleRow`, `NumberInputRow`, `ColorRow` and `Collapsible` as needed. Show only effective controls. Reuse Display fit/scale/position/rotation/output opacity; no new picker, inspector window or center-stage setup UI.
- Own GPU resources within the preset's dedicated subsystem. Reuse `ShaderCompiler` / `ShaderProgram` where applicable. Keep per-frame state out of Zustand/React renders; no per-frame CPU `getImageData`/GPU readback or extra media subscriptions. Honor shared composition/transition/feedback budgets: at most one recursive feedback pass; two ping-pong targets are storage for that one pass, not two passes.
- Quality ceilings: 4096-pixel source texture edge, 2560-pixel processed-output edge and 64 MiB of transient effect textures, further limited by device capabilities. Source textures, drawing buffers and Canvas2D output are separate allocations and must be reported. Auto must reduce both resolution and algorithm/history cost from the same logical viewport. The profile results below describe the tested software device.
- Preserve source aspect, source transforms, premultiplied alpha and source palette unless an explicit optical/color treatment changes them. The preset's master Amount at 0 or Source Reconstruction at 1 uses the native original contribution for exact clean preview/capture. `dryOnly` keeps processed output visible at Dry Source Mix 0; `legacyComposite` retains its single multiplier. Apply global output opacity once, without doubling the original beneath processed alpha.
- Publish the current visible result through the existing CANVAS output canvas for screenshots, recording and visual casting. Drawable original-source fallback is available during GPU/shader failure; missing/failed/deleted media clears stale capture and reports output unavailable. Preserve signed URLs verbatim. `ProductionOutput.ts` remains the LaserDMX adapter.
- Handle source revisions, resize/DPR, visibility, pause/resume, fine and large seeks, loops, track/preset/engine transitions and WebGL context loss. Cancel RAF/timers, remove listeners and dispose textures/framebuffers/programs on departure. A restored context may retry once per source identity; then keep the original and allow deliberate preset re-entry to retry.

Follow [CANVAS](canvas.md), the [implementation contract](../AI_IMPLEMENTATION_CONTRACT.md),
[Shared Performance Core](shared-performance-core.md) and
[recording/output ownership](react-recording-and-output.md). Inspect current source
again before implementing; do not copy MUTAGEN or SHIFTGRID runtime state.

## Verification

- The final focused run passed 42 tests covering the preset and shared MUTAGEN
  surface. Earlier regression runs passed 357 tests across CANVAS renderers,
  composition, performance and persistence. The production build passed with
  its TypeScript step.
- Chromium verified generated alpha PNG, opaque JPEG, SVG and decoded WebM,
  clean reconstruction, fit and transforms, and independent motion sensitivity,
  bass, kick and snare responses. The real CANVAS surface passed frozen video
  seek, pause and resize, signed and missing media, GPU fallback, preset card,
  recipe reload, and authored and Show owner checks.
- The short final run recorded a 95,819-byte WebM. Mean preview/output error
  stayed below one 8-bit channel step across all five tested variants. The earlier
  60-second still-image run rendered 7,202 frames without further texture
  allocations after warmup.
- Auto used 1280×720 and 1920×1080 internal output at the matching logical sizes,
  and 960×540 at logical 4K. With the 1920×1080 fixture, transient textures used
  about 8.16 MiB at Balanced and 2.04 MiB at Low. Chromium reported SwiftShader.
  Native Electron casting and physical GPU performance remain unverified.

See the [browser smoke command](verification.md#data-bleed-browser-smoke) for
reproduction and generated artifacts.

## Visual references

These demonstrate the target effect; their host-application projects are visual
references rather than drop-in CANVAS implementations.

- [Datamoshing on TouchDesigner — Neurotypique](https://www.youtube.com/watch?v=w8c33t2CgtA)
- [Datamosh in TouchDesigner — paketa12](https://www.youtube.com/watch?v=_MJ71LyBAjk)
