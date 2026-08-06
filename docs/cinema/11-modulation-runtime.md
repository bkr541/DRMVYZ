# Cinema Stage 11: Modulation Runtime

Stage 11 adds the runtime-only bridge between persisted Cinema modulation routes and the established parameter-resolution pipeline.

## Ownership

- The Cinema composition continues to own serializable route definitions.
- `CinemaModulationRuntime` owns transient envelopes, smoothing state, pending impulses, quantized event identities, and held samples.
- `CinemaGraphExecutor` evaluates one immutable modulation snapshot per frame and passes it to `resolveCinemaParameterSnapshot`.
- No frame evaluation writes resolved values, envelopes, event identities, or diagnostics into the Cinema store or persisted composition.

## Prior-stage boundary repair

`CinemaGraphExecutor` now builds its definition registry through the runtime-neutral `CinemaDefinitionRegistry` module. `CinemaFoundation` preserves its existing public wrapper, but graph execution no longer imports the foundation, Shader, and Cinematic adapter bundle merely to translate persisted definition metadata. This keeps the production executor boundary testable without activating competing renderer ownership.

## Stable source catalog

`CinemaModulationSources.ts` publishes namespaced source IDs for:

- normalized audio and Music Intelligence values
- beat, downbeat, kick, snare, transient, section, drop, lyric, and phrase impulses
- beat, two-beat, four-beat, bar, four-bar, eight-bar, and phrase clocks
- playing, paused, vocals-active, build-active, and drop-active states

Each source declares its kind, capability requirement, neutral value, and disabled reason. Labels are presentation metadata and are not identifiers.

## Determinism

Route runtime state is keyed by stable route ID and track identity. It resets on normalized frame discontinuities, graph replacement, route deletion, context reconstruction, or explicit executor reset. Impulse and quantized events are deduplicated with deterministic event IDs supplied by `CinemaFrameContext`.

Paused or suspended frames do not advance envelopes or consume events. Continuous quantized routes hold the sample taken at the last accepted musical identity. Trigger routes emit a one-frame boolean and never persist that result.

## Resolution order

The existing parameter resolver remains authoritative:

1. definition default
2. saved composition value
3. instance override
4. master influence
5. immutable modulation snapshot
6. performance override
7. schema safety clamp
8. final runtime value

Multiple routes targeting the same destination are evaluated in authored order. `add`, `multiply`, `replace`, and `trigger` operations are isolated per route; invalid routes produce diagnostics while valid routes continue.

## Persistence compatibility

No schema version changes are required. The Stage 1 composition contract already contains every field used by this stage. Runtime envelopes, snapshots, pending events, and source availability remain non-serializable derived state.
