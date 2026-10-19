# CANVAS

## Purpose

CANVAS is the media-performance engine for still images, SVG, and video. It combines the shared Media Library with authored composition templates, media roles, section-aware playback, effects, transitions, preloading, and Shared Performance orchestration.

The React View engine ID is `canvas`.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| React shell and live surface | `src/components/vyzualz/react/ReactCanvasEngineShell.tsx` |
| Performance resolver | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceEngine.ts` |
| Authored shows | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceShows.ts` |
| Performance types and limits | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes.ts` |
| Composition templates | `src/components/vyzualz/react/canvasPerformance/CanvasCompositionTemplates.ts` |
| Effect recipes | `src/components/vyzualz/react/canvasPerformance/CanvasEffectRecipes.ts` |
| Media roles | `src/components/vyzualz/react/canvasPerformance/CanvasMediaRoles.ts` |
| Playback resolver | `src/components/vyzualz/react/canvasPerformance/CanvasPlayback.ts` |
| Preload manager | `src/components/vyzualz/react/canvasPerformance/CanvasPreloadManager.ts` |
| Transitions | `src/components/vyzualz/react/canvasPerformance/CanvasTransitions.ts` |
| Orchestration stage | `src/components/vyzualz/react/canvasPerformance/CanvasOrchestrationStage.tsx` |
| Validation | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceValidation.ts` |
| SHIFTGRID foundation | `src/components/vyzualz/react/renderers/shiftgrid/` |

## React View composition

CANVAS uses:

- **WORKSPACE → SOURCE** in the left rail
- **PRESETS** for authored looks
- **DESIGN → ENGINE / SELECTION** for global and selected-media controls
- **REACT → ROUTING / ANALYSIS** for Shared Performance behavior and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map and Performance Pads in the lower workspace

The CANVAS shell owns its Media Library browser and performance pool inside the engine workspace.

## Media authority

The shared Media Library is the canonical persistent source for CANVAS media. Supported runtime types include common video, still-image, and SVG formats accepted by `getCanvasLibraryMediaType`.

CANVAS maps shared media records into runtime `CanvasMediaItem` values. Storage URLs, proxy URLs, timing metadata, and media roles are resolved through the shared media model.

Legacy session media remains visible only as a compatibility path for older in-memory or blob-URL sessions. New features must not deepen that legacy path or treat session blob URLs as durable storage.

## Performance pool and roles

The performance pool defines the media available to authored CANVAS shows. Each item may receive explicit or inferred roles through `CanvasMediaRoles.ts`.

Manual media selection can establish a lock. Shared Performance orchestration must respect that lock until the user clears it. Automatic selection and authored recruitment must not silently override a current manual lock.

## Authored performance

`CanvasPerformanceEngine` resolves the active show against the authoritative Shared Performance context. It may select media, composition, effects, playback behavior, and transitions based on section, phrase, event, and track state.

Authored behavior is split into reusable domains:

- Composition templates
- Media-role resolution
- Effect recipes
- Playback decisions
- Transitions
- Preload candidates

The resolver must remain deterministic across seek, loop, pause, stop, track replacement, and media-library changes.

## Playback and preloading

`CanvasPlayback.ts` owns section-aware playback intent. The UI and renderer must not create separate playback clocks.

`CanvasPreloadManager.ts` owns bounded preload candidates and lifecycle. It must release stale resources and avoid downloading or decoding the complete library merely because CANVAS is selected.

Unavailable, deleted, unsupported, or inaccessible media must produce a clear fallback rather than an endless loading state.

## Rendering and effects

The live output is mounted by `CanvasEngineSurface` exported from `ReactCanvasEngineShell.tsx`.

Layout and effect values that change every frame may use CSS custom properties or runtime styles. Static layout belongs in React View CSS.

Effects and transitions must:

- Preserve the selected source aspect policy
- Stay within authored intensity and safety clamps
- Avoid per-frame DOM node growth
- Bound trail and overlay layers
- Keep video playback and visibility synchronized
- Release media listeners and timers on replacement

## SHIFTGRID

`canvas-shiftgrid` is a dedicated CANVAS preset with renderer kind
`shiftgrid`. It does not reuse Fractures geometry, CUTBANK composition, or the
generic authored-layer renderer. One SHIFTGRID renderer owns the complete tile
grid, so its source count is independent of the four-layer CANVAS compositor.

Phase 5 adds the complete Design inspector and motion-derived rendering effects
on top of the deterministic P0-P4 tile, mosaic, and performance systems:

- `ShiftgridSettings.ts` owns the versioned persistent preferences and strict normalization.
- `ShiftgridTileGeometry.ts` owns stable row/column tile identity, supported/automatic grid selection, and square or rectangular geometry.
- `ShiftgridSourceMedia.ts` resolves up to ten eligible images from the existing active CANVAS Media Pool, preserving pool order or deterministic selection without adding a media library or pool pointer.
- `ShiftgridGridState.ts` owns deterministic, validated permutations and transient animated movement state that is never persisted.
- `ShiftgridChoreography.ts` owns eight distinct permutation planners, staggered movement queues, timeline playback, seeking, pausing, interruption safety, magnetic reconstruction, and valid directional kick/snare impulses.
- `ShiftgridPerformanceController.ts` owns manual, Pattern Change, and Auto Performance precedence; canonical musical-event identity and deduplication; deterministic pattern cycles; section-level Auto direction; and independent audio routing. It reads `SharedPerformanceContext` and never creates a parallel analyzer or preview metronome.
- `ShiftgridMosaic.ts` owns the independent per-tile source-assignment timeline, deterministic target selection, six mosaic behaviors, and complete-image source resolution. Source ownership never mutates spatial tile position.
- `ShiftgridEffects.ts` gates tile edge glow, light trails, directional blur, RGB separation, beat pulse, snap flash, and tile gap independently, while preserving a zero-effect clean path.
- `ShiftgridRenderPlan.ts` maps stable, per-source crop coordinates to animated destination slots, carries current/pending source identity independently from spatial movement, and emits batched motion, trail, gap, pulse, and snap metadata.
- `ShiftgridTextureAtlas.ts` bounds one shared RGBA atlas to the device texture limit; `ShiftgridWebGLRenderer.ts` draws dual-source tile transitions and P5 effects in one batched WebGL2 call and `ShiftgridCanvas2DRenderer.ts` provides the alpha-aware equivalent fallback.
- `CanvasShiftgridLayer.tsx` uses the canonical Canvas preload manager, stages its five-item queue up to the ten-handle budget, handles source/pool revisions and failures, publishes output, falls back on context loss, and cleans up retained resources.
- `ShiftgridControls.tsx` owns one canonical four-section Design surface built from shared Canvas control rows. It conditionally exposes Media Pool, Mosaic Type, Trigger, reconstruction, and effect-strength controls; the REACT tab retains shared analysis/routing rather than duplicating SHIFTGRID authoring.

P2 adds Row Runner, Column Cascade, Checker Shift, Domino Chain, Center Collapse,
Edge Expansion, Wave Relay, and Magnetic Resolve. Each produces a distinct,
validated movement topology. Continuous Puzzle, Phrase Resolve, Drop Resolve,
Progressive Resolve, and Manual Resolve share the same deterministic timeline;
phrase/drop boundaries are routed from shared Audio Intelligence.
P3 adds Image Takeover, Hybrid Mosaic, Traveling Image Wave, Visual
Call-and-Response, Progressive Identity Reveal, and Auto Mosaic. These source
assignment modes remain combinable with every P2 choreography pattern. PNG,
JPEG, WebP, SVG, and transparency are supported; pool video sources are ignored.
Manual Pattern owns the runtime when both automatic modes are off. Pattern
Change has precedence over Auto Performance and advances only on a new selected
event identity. Auto Performance may choose a temporary runtime pattern at
section, phrase, or drop structure without overwriting the authored Pattern.
The canonical trigger vocabulary is Beat, Kick, Snare, Downbeat, Every 2 Beats,
Every 4 Beats, Bar, Every 4 Bars, Every 8 Bars, Phrase, and Drop. Missing grids,
paused transport, seeks, and track replacement do not synthesize trigger events.
Master Intensity scales performance motion and transient effect accents but does
not alter source identity, crop coordinates, grid dimensions, or authored tile
gap. Every P5 effect is opt-in; with Effects disabled (the default), assembled
output takes the clean source-image path with no overlays or sampling shifts.

## Persistence

CANVAS settings, selected media, pool membership, role assignments, authored-show settings, and timing metadata use the React engine store and shared media records.

Any persisted schema change requires normalization or migration. SHIFTGRID's
settings are nested in the normalized CANVAS preset document; its tile state,
pattern cursor, source handles, and audio envelopes are runtime-only. Runtime
media elements, blob URLs, object references, preload handles, and diagnostics
must not be persisted.

## Diagnostics and validation

Shared Performance diagnostics expose the selected show, media lock, role resolution, section and phrase context, effect decisions, and fallback state.

Current tests cover the performance foundation and authored shows. Changes to media recruitment, limits, effects, playback, or transitions should extend `CanvasPerformanceValidation.ts` and the relevant tests rather than adding a disconnected validator.
