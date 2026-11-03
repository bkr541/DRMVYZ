# CANVAS preset specification: Phase Drag

**Implementation status: Completed**

Phase Drag is available in CANVAS Presets. Select a video or still in Media Manager
and adjust the scan in Design.

| Identity | Value |
| --- | --- |
| Preset name | Phase Drag |
| Visual effect | Slit scan / time displacement |
| Stable preset ID | `canvas-phase-drag` |
| Renderer kind / nested settings key | `phaseDrag` |
| Renderer subsystem | `src/components/vyzualz/react/renderers/phaseDrag/` |
| Nested settings version | `1` in CANVAS schema `16` |

## Desired effect and media

Distribute different moments of a source across the image. Moving subjects stretch into ribbons, waves, and time-bent silhouettes as a slit or displacement field selects earlier frames. Temporal sampling must be real; a static spatial warp alone does not fulfill this effect.

Video is the primary temporal input. Still PNG, JPEG, WebP and SVG use an explicitly labelled Animated Still mode: apply deterministic source movement before retaining its frames. With still movement disabled, show the original image and explain that an unchanged still has no time variation.

## Parameters

Use one scoped Design group. Normalize non-finite numbers to defaults and clamp
finite out-of-range values and validate exact enum IDs.

| Parameter | Range / choices | Default | Purpose |
| --- | --- | --- | --- |
| Scan Mode | vertical / horizontal / radial / map | vertical | Choose the time-selection field; Map uses a built-in procedural field, without a new media picker. |
| Drag Amount | 0–1 | 0.65 | Master temporal displacement strength; zero returns the current original frame. |
| History Window | 0.1–2 seconds | 1 | Maximum past-source interval; no future-frame reconstruction is implied. |
| History Samples | 4–12 | 8 | Requested samples, capped by Quality. Fixed tiers show their cap in Design. Auto shows its adaptive range. |
| Slit Width | 0.01–1 | 0.15 | Width of the moving region that selects or refreshes time slices. |
| Scan Speed | 0–4 | 1 | Rate of scan movement; BPM Sync may quantize its cycle length. |
| Direction | forward / reverse / pingPong | forward | Direction through the available past-frame sequence. |
| Time Curve | linear / ease / wave | wave | Spatial-to-temporal mapping curve. |
| Still Movement | 0–1 | 0.25 | Animated Still movement amount; conditional on a still source. |
| Freeze History | off / on | off | Hold the time volume and processed output until released or reset. |
| Clear History | action | — | Fill the history with the current source and begin collecting new samples. |
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
| Bass/sub | Increase time displacement and wave amplitude within the authored window. |
| Kick | Briefly expand a scan region; do not seek or restart the source video. |
| Snare/transient | Accent a narrow temporal discontinuity with a short release. |
| Mids / highs | Vary time-map detail / restrained fine scan ripples. |
| Build / drop | Expand the temporal span through a build, with a brief increase on a qualified drop. |
| Phrase / breakdown | In Auto Performance, change scan direction on a new phrase; reduce delay toward the current frame during breakdown. |

Consume the existing `SharedPerformanceContext` and canonical transport position. Add no analyzer, beat detector, metronome or alternate transport. Gate bands, rhythm events and section semantics by capabilities/confidence, smooth continuous modulation, clamp impulses and deduplicate event identities. Seek/loop/replacement/reset samples must not invent a drop or trigger.

Authored parameters are durable authority. Audio modulation and Auto Performance produce temporary resolved frames. Choosing a manual mode disables Auto Performance; with Auto off the mode stays locked, while Audio Reactivity may still modulate its effective parameters. BPM Sync changes movement timing independently. Without qualified analysis/grid/sections, retain the authored look and manual animation; do not fabricate musical structure. Use qualified drop/phrase events only once per identity. Authored Freeze History takes priority over audio events. During stopped manual playback, elapsed animation time may drive movement without inventing a beat clock.

## Effect-specific rendering and reset policy

Store a finite ring or texture array of original source frames, never recursively warped output. Low requests at most 4 samples with a 384-pixel longest edge, Balanced 8 at 640, and High 12 at 960; Auto reduces these by logical stage/device budget. A square 12×960×960 RGBA8 history is about 42.2 MiB. Interpolate adjacent temporal samples where practical. A source-history copy is not a recursive feedback pass; keep copy/presentation passes bounded and document their actual cost. Reuse the existing decoder and canonical source playback position.

Sample history against canonical transport/source positions, without a private playback clock. On seek, loop, replacement, discontinuity, or resize, invalidate the ring and start from the current drawable frame. The shader samples only written slots. A pending video seek holds the last drawable preview and capture until the next source frame is ready. Paused large/fine seeks rebuild once, then freeze. Exact pre-seek time-volume replay is unsupported without separately decoding that interval, which is outside this specification.

## CANVAS architectural requirements

- Reuse `ReactTypes.ts` / `CANVAS_PRESETS` and the existing preset cards. Add the ID, renderer kind and a versioned nested settings record only during implementation; no separate engine or registry. Add strict normalizers/migration/reset in `reactStore.ts` and the record to explicit preset provenance. Missing settings in older saves receive safe defaults.
- Use `activeCanvasMediaId`, `useCanvasRuntimeMediaItems` and the existing Media Manager/preloader. Keep source identity separate from the recipe. Never persist URLs, blobs, decoded pixels, glyph atlases, textures, frame histories or runtime envelopes in SYSTEM presets. Preserve manual media locks and Auto Select authority. Primary image inputs do not use authored-overlay transparency admission.
- Mount only through the specialized direct renderer dispatch in `ReactCanvasEngineShell.tsx`. Initially this is a direct preset: active Show Manager and authored-layer owners retain precedence and their existing mask/effect/blend order. No implicit global Show postprocess or new layer effect ID. A future opt-in integration needs its own complete versioned compositor contract.
- Reuse canonical Design `SelectRow`, `SliderRow`, `ToggleRow`, `NumberInputRow`, `ColorRow` and `Collapsible` as needed. Show only effective controls. Reuse Display fit/scale/position/rotation/output opacity; no new picker, inspector window or center-stage setup UI.
- Own GPU resources within the preset's dedicated subsystem. Reuse `ShaderCompiler` / `ShaderProgram` where applicable. Keep per-frame state out of Zustand/React renders; no per-frame CPU `getImageData`/GPU readback or extra media subscriptions. Honor shared composition/transition/feedback budgets: at most one recursive feedback pass; two ping-pong targets are storage for that one pass, not two passes.
- Quality ceilings: 4096-pixel source texture edge, 2560-pixel processed-output edge and 64 MiB of transient effect textures, further limited by device capabilities. Source textures, drawing buffers and Canvas2D output are separate allocations and must be reported. Auto must reduce both resolution and algorithm/history cost from the same logical viewport. The history allocation follows the source aspect ratio.
- Preserve source aspect, source transforms, premultiplied alpha and source palette unless an explicit optical/color treatment changes them. The preset's master Amount at 0 or Source Reconstruction at 1 uses the native original contribution for exact clean preview/capture. `dryOnly` keeps processed output visible at Dry Source Mix 0; `legacyComposite` retains its single multiplier. Apply global output opacity once, without doubling the original beneath processed alpha.
- Publish the current visible result through the existing CANVAS output canvas for screenshots, recording and visual casting. Drawable original-source fallback is available during GPU/shader failure; missing/failed/deleted media clears stale capture and reports output unavailable. Preserve signed URLs verbatim. `ProductionOutput.ts` remains the LaserDMX adapter.
- Handle source revisions, resize/DPR, visibility, pause/resume, fine and large seeks, loops, track/preset/engine transitions and WebGL context loss. Cancel RAF/timers, remove listeners and dispose textures/framebuffers/programs on departure. A restored context may retry once per source identity; then keep the original and allow deliberate preset re-entry to retry.

Follow [CANVAS](canvas.md), the [implementation contract](../AI_IMPLEMENTATION_CONTRACT.md),
[Shared Performance Core](shared-performance-core.md) and
[recording/output ownership](react-recording-and-output.md). Inspect current source
again before implementing; do not copy MUTAGEN or SHIFTGRID runtime state.

## Verification

- The focused run passed 15 tests covering Phase Drag, recipe hydration,
  provenance, the bounded history ring, musical gating, and existing Data Bleed
  and SHIFTGRID foundations. The production build passed its TypeScript step.
- Chromium verified four distinct scan fields, actual selection and interpolation
  of earlier frames with a color-coded source, cold history reset, and
  reconstruction. The CANVAS surface rendered an animated still and a generated
  WebM, reused the current media source, and refreshed a frozen video seek once.
  The GPU preserved source alpha and the shared capture compositor applied the
  stage background selected for the fixture.
- Auto quality follows logical stage area. Low, Balanced and High cap history
  at 4, 8 and 12 frames with longest edges of 384, 640 and 960 pixels. A maximum
  square RGBA8 history requires about 42.2 MiB. Rendering uses one presentation
  pass and one source copy when a sample is due.
- Native casting, long-duration profiling, and a dedicated real recording run
  remain unverified for Phase Drag. The browser smoke covers the published
  CANVAS canvas that those consumers share.

See the [browser smoke command](verification.md#phase-drag-browser-smoke) for
reproduction and artifacts.

## Visual references

These demonstrate the target effect; their host-application projects are visual
references rather than drop-in CANVAS implementations.

- [Slit Scan Photography — unclegrayvisuals](https://www.youtube.com/watch?v=cTzW82zshfY)
- [Slit Scan Effect + Time Displacement — Xtal](https://www.youtube.com/watch?v=kcbu4XUFdeI)
