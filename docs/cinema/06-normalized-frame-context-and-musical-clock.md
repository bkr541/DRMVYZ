# Cinema Stage 6: Normalized Frame Context and Deterministic Musical Clock

Cinema Stage 6 adds one public, immutable frame contract for every future Cinema runtime consumer. It normalizes DRMVYZ transport, analyser-derived Music Intelligence, authoritative sections, timed lyrics, Shared Performance, Brand Kit, media availability, camera state, and deterministic timing without allocating a canvas, WebGL context, animation loop, or GPU resource.

## Production route

The user-visible production route is:

```text
React engine selection / persisted restore
→ ReactView canonical transport and feature snapshots
→ buildCinemaWorkspaceFrameBridge
→ buildCinemaFrameContext
→ CinemaWorkspace Stage 6 status and structured diagnostics
```

`ReactView` remains the integration owner because it already receives canonical audio transport, section, lyrics, performance, Brand Kit, media, and engine-selection state. The bridge reads one current `AudioFeatureBus` publication and passes snapshots into the pure frame builder. Cinema nodes and future runtime modules do not poll those application stores independently.

## Public contract

`CinemaFrameContext` version 1 contains:

- viewport, frame timing, deterministic seeds, and transport state
- normalized audio bands, RMS, energy, spectral values, build/drop/tension, and vocal presence
- deterministic beat, 2-beat, 4-beat, bar, 4-bar, 8-bar, and phrase clocks
- beat, downbeat, kick, snare, transient, section, drop, lyric-line, and lyric-word impulses with stable event IDs
- authoritative section and lyric snapshots
- Shared Performance action/toggle snapshots
- Brand Kit colors, camera snapshot, and explicit capability flags

The builder returns the frame, a bounded serializable builder state for the next invocation, and structured diagnostics. Builder state is runtime-only and is not added to persisted Cinema state.

## Determinism and de-duplication

Event IDs use stable hashes of event kind, normalized track identity, and discrete musical position. Seeds are independently derived for composition, track, musical position, and event identity. Repeating an equivalent snapshot therefore produces equivalent IDs and seeds.

The previous builder state records clock indices and the last observed impulse IDs. Continuous playback can emit each boundary once. Seek, loop wrap, track replacement, replay, resume, visibility suspension/restoration, backwards time, and explicit timing discontinuities create reset/reconstruction signals and suppress boundary impulses on the discontinuity frame, preventing duplicate bar, section, and drop events.

## Pause and fallback behavior

A user pause freezes elapsed time and frame index, reports zero delta time, and emits no musical impulses. Resume creates an explicit reconstruction signal.

Missing analyser data, Music Intelligence, beat grid, authoritative sections, lyrics, Brand Kit, Shared Performance, or media produces neutral values plus capability flags. Missing data does not throw and does not invent a second source of truth. A valid BPM can still provide deterministic BPM-derived clocks when a reliable beat grid is unavailable.

## Ownership and Stage 7 handoff

Stage 6 deliberately leaves `runtimeAvailable: false`. `CinemaWorkspace` can show that the normalized frame bridge is active, but still creates no renderer owner, canvas, WebGL context, requestAnimationFrame loop, target pool, texture, or GPU object.

Stage 7 may call `buildCinemaFrameContext` from the single Cinema runtime loop and use the returned discontinuity/reset signal to reconstruct stateful nodes. It must retain the same canonical-source and no-independent-store-polling boundary.
