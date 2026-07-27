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

## Persistence

CANVAS settings, selected media, pool membership, role assignments, authored-show settings, and timing metadata use the React engine store and shared media records.

Any persisted schema change requires normalization or migration. Runtime media elements, blob URLs, object references, preload handles, and diagnostics must not be persisted.

## Diagnostics and validation

Shared Performance diagnostics expose the selected show, media lock, role resolution, section and phrase context, effect decisions, and fallback state.

Current tests cover the performance foundation and authored shows. Changes to media recruitment, limits, effects, playback, or transitions should extend `CanvasPerformanceValidation.ts` and the relevant tests rather than adding a disconnected validator.
