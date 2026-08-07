# Cinema Stage 19: Composer Modulation, Performance, Camera, and Timeline

Stage 19 extends the structured Cinema Composer from Stage 18. It does not create a second graph, timeline, lyrics store, renderer, canvas, WebGL context, or animation loop.

## Production ownership

- The existing React engine selector remains the owner of active engine selection.
- `CinemaStore` remains the canonical owner of persisted compositions, modulation routes, performance rules, camera resources, history, and package serialization.
- `CinemaWorkspaceFrameBridge` adapts the existing effective beat grid, Music Intelligence phrase markers, resolved Track Timeline sections, runtime lyric cues, Shared Performance actions, and normalized audio time into runtime-only Composer timeline context.
- `CinemaRuntime` and `CinemaGraphExecutor` remain the only Cinema rendering/execution owners.
- Composer route tests and manual rule triggers are runtime-only audition commands. They are intentionally excluded from Cinema persisted snapshots, undo history, and package export.

## Composer panels

The structured Composer now exposes four authoring groups:

1. **Modulation** builds source choices from `CINEMA_MODULATION_SOURCE_CATALOG` and destinations from the existing parameter schemas. Route amount, offset, ranges, attack/release, smoothing, curve, musical quantization, condition, clamp, and runtime-only testing are editable.
2. **Performance** edits conditions, event triggers, priority, musical durations, parameter/node/camera actions, manual audition triggers, and explicit renderer reset actions.
3. **Camera** edits camera mode, schema-backed transform parameters, safe ranges, authored shots, Auto Director eligibility, and compatible-node assignments. Assignments are stable node IDs stored in camera metadata.
4. **Timeline** visualizes the canonical Cinema playhead with the effective beat grid, downbeats/bars, Music Intelligence phrase markers, resolved sections, runtime lyrics, modulation markers, and performance cues. Older analyses without phrase markers receive a deterministic four-bar display fallback only; no fallback data is persisted.

## Runtime preview semantics

`composerRuntimePreview` is Zustand runtime state outside `CinemaPersistedState`. Modulation audition supplies a full test signal to only the selected compiled route, then uses the normal modulation and parameter resolution stack. Manual performance preview injects a stable action/sequence identity into the normal performance evaluator for one consumption. Neither path mutates authored parameter baselines each frame.

Preview state is cleared by full hydrate/replace/reset/import operations and when the active Cinema composition changes or is deleted.

## Schema and compatibility

Stage 19 does not increment the Cinema persisted schema. The existing schema already persists modulation routes, performance rules, cameras, metadata, and stable IDs required by these panels. Legacy Shader Pads and Cinematic Worlds renderer ownership is unchanged.
