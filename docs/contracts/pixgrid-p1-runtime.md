# PixGrid P1 runtime contract

## Timing precedence

PixGrid resolves sequence timing in this order:

1. Explicit Track Map or musical boundary cues select the next occurrence.
2. Per-image timing overrides control that occurrence's hold duration.
3. Section timing overrides control occurrences without an image override.
4. Auto Performance section cadence applies when enabled and no explicit duration exists.
5. The Deck default image duration applies otherwise.
6. Legacy projects without meter metadata use four beats per bar.

Beat-to-bar conversion uses the Shared Performance Context time signature. Transition duration remains expressed in beats, and arrival-anchored transitions calculate their start from the quantized completion point.

Historical section spans may carry a `sceneId`. Follow Track reconstruction evaluates each span with that historical scene rather than applying the currently selected scene to the entire past. Manual selected-scene preview deliberately continues to use the selected scene.

## Transition lifecycle and interruption

The sequence clock reports `scheduled`, `preparing`, `active`, `completing`, `completed`, `interrupted`, or `cancelled`. The production policy finishes the active transition and queues a newer boundary; it never changes the nominal source midway through a rendered transition. Drop and Track Map boundaries remain authoritative selection events, while simultaneous events are deterministically coalesced.

## Compiler scheduling and readiness

Prepared source frames remain content-addressed, so repeated sequence occurrences share the same pixel buffers. Transition plans remain occurrence-addressed and directional.

The transition coordinator separates required, prefetch, and speculative pairs. Ordered modes prepare reachable adjacent pairs. Shuffle uses a bounded adjacent baseline and accepts up to four actual runtime lookahead pairs from the sequence planner instead of compiling every directed pair. Required work is queued before background work, concurrency remains bounded, and identical cache keys are deduplicated.

Preset readiness has five levels:

- `invalid`: required source data failed validation or compilation.
- `preparing`: required images or the active pair are not ready.
- `playable`: required startup work is ready; background preparation continues.
- `fullyPrepared`: every currently known pair is ready.
- `degraded`: playback is safe, but optional work failed.

Worker jobs have independent total and lack-of-progress watchdogs. Timeout, cancellation, stale results, worker errors, and normal completion all use the same settle-once cleanup path.

Runtime diagnostics expose queued and running work, deduplicated jobs, expected pairs, cache entries and bytes, completed jobs, and total/average transition compilation time. These counters are observational only and do not participate in deterministic playback.

The new readiness fields are emitted for every newly resolved preset. Their TypeScript properties remain optional at legacy producer boundaries so older persisted/test integration objects continue to load; the legacy `ready` field aliases `playable`.
