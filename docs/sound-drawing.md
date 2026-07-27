# Sound Drawing

## Purpose

Sound Drawing turns waveform, shape, text, SVG, lyric, and generated sources into audio-reactive line art. It combines source preparation, authored clips, a timeline lane, Shared Performance programs, bounded simulation, Canvas2D rendering, and the Living Ribbon generator.

The React View engine ID is `oscilloscope`.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Renderer | `src/components/vyzualz/react/renderers/SoundDrawingRenderer.ts` |
| React stage integration | `src/components/vyzualz/react/ReactPlaceholderCanvas.tsx` |
| Timeline lane | `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx` |
| Performance resolver | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceEngine.ts` |
| Authored shows | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceShows.ts` |
| Performance types and limits | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes.ts` |
| Behavior runtime | `src/components/vyzualz/react/soundDrawing/SoundDrawingBehaviorRuntime.ts` |
| Source resolution | `src/components/vyzualz/react/soundDrawing/SoundDrawingSourceResolver.ts` |
| Control visibility | `src/components/vyzualz/react/soundDrawing/SoundDrawingControlVisibility.ts` |
| Visual size normalization | `src/components/vyzualz/react/soundDrawing/SoundDrawingVisualSize.ts` |
| Living Ribbon renderer | `src/components/vyzualz/react/renderers/LivingRibbonCanvas2DRenderer.ts` |
| Shared simulation rules | `docs/visual-simulation.md` |

## React View composition

Sound Drawing uses:

- **WORKSPACE → SOURCE** for engine source controls
- **MEDIA → SOURCE** for shared SVG media
- **FONTS → SOURCE** for text and font selection
- **PRESETS** for authored looks
- **DESIGN → ENGINE / SELECTION** for global and source-specific controls
- **REACT → ROUTING / ANALYSIS** for Music Intelligence behavior and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map, Performance Pads, and the Sound Drawing timeline in the lower workspace

## Source model

Supported source families include:

- Classic waveform and scope modes
- Built-in shapes
- Text and font geometry
- SVG artwork
- Lyric text
- Generated performance layers
- Living Ribbon

Expensive source preparation must occur at upload, selection, resolution change, or cache fill, not repeatedly inside the render loop. The renderer reads prepared SVG and glyph points from bounded caches.

A source identity must remain stable across ordinary section changes. Performance programs may transform presentation without silently replacing the selected text, SVG, shape, or lyric source.

## Timeline and clips

`SoundDrawingTimelineLane` is the canonical clip and lane editor. Clip time is resolved against the same Track Map duration and transport authority used by the renderer.

Timeline edits must preserve stable IDs, normalized ranges, deterministic ordering, and bounded clip counts. The lane is an authoring surface, not a second playback clock.

## Performance programs

`SoundDrawingPerformanceEngine` resolves authored show definitions against Shared Performance context. Programs may recruit bounded layers, traces, particles, treatments, and event actions while respecting source-aware locks and safety limits.

The performance resolver distinguishes:

- Continuous Music Intelligence routes
- Discrete kick, snare, hat, beat, downbeat, transient, and semantic events
- Section and phrase development
- Four-, eight-, and sixteen-bar evolution
- Deterministic seek, loop, track replacement, and source replacement

Transient envelope state is runtime-only and must reset when its authoritative track or source identity changes.

## Living Ribbon

Living Ribbon uses the shared visual-simulation foundation and a Canvas2D renderer. It must follow the shared fixed-step, deterministic seed, bounded node, bounded particle, pause, reset, and dispose contracts.

Living Ribbon controls are shown only when the authored show or explicit generator selection requires them. See `docs/living-ribbon-production-validation.md` for production acceptance.

## Rendering and caches

`SoundDrawingRenderer` owns bounded per-canvas runtime maps for trails, beat envelopes, rotation phase, prepared paths, lyric runtime, Shared Performance temporal state, and Living Ribbon instances.

The renderer must:

- Reuse offscreen canvases and cached geometry
- Bound path and glyph caches
- Reset trails and transient state on authoritative discontinuities
- Pause simulation without advancing hidden time
- Dispose behavior and Living Ribbon runtimes when the canvas is replaced
- Avoid parsing SVG or rasterizing text each frame

## Size and identity controls

Visual size is normalized through `SoundDrawingVisualSize.ts`. Classic Scope, Built-In Shape, text, SVG, and generated sources should use the same normalized size contract rather than separate incompatible scale semantics.

Source treatments may alter contour, repetition, deformation, color, trail, and motion while retaining source identity unless the user explicitly chooses an abstracting mode.

## Diagnostics and validation

Shared Performance diagnostics report active routes, event reasons, locks, clamps, source identity, and bounded runtime statistics. A visual moving autonomously must not be reported as proof of music reaction.

Tests under `src/components/vyzualz/react/soundDrawing/` cover performance sources, deterministic identity, limits, temporal routing, Living Ribbon control visibility, and authored shows. Shared simulation and Living Ribbon validation remain separate required gates for changes to that generator.
