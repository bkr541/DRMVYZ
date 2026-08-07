# Cinema Stage 13: Camera System and Shared Auto Director

Stage 13 adds a Cinema-owned, serialization-safe camera layer without changing the standalone Cinematic Worlds camera runtime.

## Production path

`CinemaWorkspace` supplies the canonical composition, instance, definitions, and normalized `CinemaFrameContext` to `CinemaRuntime`. `CinemaGraphExecutor` resolves the active composition camera once per frame through `resolveCinemaCameraFrame`, after performance and modulation have produced transient parameter values. The executor then fans the same immutable camera snapshot to compatible nodes.

Node camera capabilities are enforced at both registry and render boundaries:

- `uniformCamera` and `worldCamera` receive the shared camera snapshot.
- `none` and `nativeCamera` receive a frame with `camera` and `activeCameraId` cleared.
- Reset and seek-reconstruction callbacks receive the same capability-gated frame as render callbacks.
- Legacy aliases (`uniform`, `world`, and `native`) remain accepted for definitions created before Stage 13.
- Invalid native/shared ownership combinations are rejected with `CINEMA_CAMERA_CAPABILITY_MISMATCH` diagnostics.

No camera resolver owns a canvas, WebGL context, animation loop, GPU resource, or canonical store mutation.

## Persisted camera resources

`CinemaCameraResourceDefinition` now supports optional authored paths, safe ranges, invalid regions, and authored Auto Director shots. Existing Stage 1-12 compositions remain valid because the new fields are additive and optional, so no schema-version increment is required. Camera instance overrides continue to use stable parameter IDs and are applied only when the instance belongs to the active composition.

The built-in runtime-neutral camera schemas cover position, rotation, target, FOV, roll, near/far planes, orbit, dolly, fly speed, banking, shake, beat punch, handheld strength, focus distance, and aperture. The same schemas drive instance overrides, master influence, modulation, performance overrides, final safety clamping, and future schema-generated controls.

Persistence preflight validates camera modes, paths, ranges, invalid regions, unique authored-shot IDs, positive shot weights, and pose data before canonical state changes.

## Modes, Auto Director, and safety

Locked, dolly, orbit, fly, handheld, authored path, and Auto Director modes resolve from transport time and normalized musical data. Path and motion reconstruction is stateless, so seek, loop, reload, resize, and composition replacement do not require persisted interpolation state.

Auto Director filters authored shots by the active section, then selects from a stable weighted pool using camera identity, composition/track seeds, section identity, and deterministic bar windows. Authored minimum shot durations enlarge the selection window, preventing musical-position seed changes inside that window from changing the selected shot.

Manual and automatic poses are clamped to hard camera limits. Positions inside authored invalid regions move to a declared fallback or the nearest valid point inside the safe range. Overlapping regions are resolved with bounded correction passes; impossible safety metadata produces a structured error instead of an uncaught failure.

## Cinematic Worlds bridge

Cinematic Worlds definitions with direction metadata publish a reusable Cinema camera resource in generated reference compositions. Authored legacy shots, safe camera ranges, supported rigs, and fly-through path metadata are adapted into the Cinema-neutral contract. The Cinema adapter maps resolved Cinema modes and shot IDs back into the existing renderer frame contract.

Standalone Cinematic Worlds retains its existing `CinematicCameraSystem`, scheduler, controls, canvas ownership, and behavior. The bridge does not create a second director, context, or animation loop inside Cinema.

## Stage 14 handoff

The public `CinemaCameraRuntime` boundary exposes reusable camera resources, stable parameter schemas, deterministic Auto Director resolution, and immutable resolved frames. Stage 14 can consume those frames alongside asset and Brand Kit bindings without adding another runtime owner or camera source of truth.
