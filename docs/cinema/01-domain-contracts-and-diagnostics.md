# Cinema Stage 1: Domain Contracts and Diagnostics

Cinema Stage 1 is an additive contract boundary. It does not register the `cinema` engine, create a store, mount a canvas, acquire `ReactLiveEngineOwnership`, allocate WebGL resources, or adapt Shader Pads/Cinematic Worlds.

## Public boundary

Production code should import Stage 1 contracts through:

```ts
import type { CinemaCompositionDefinition, CinemaRenderNode } from '../cinema'
```

The public module exports:

- schema-versioned, JSON-serializable composition, instance, collection, asset-binding, camera, modulation, performance, parameter, port, node, connection, and package contracts
- stable ID and parameter destination helpers
- renderer lifecycle, capability, target, output, cost, shader-pass, Canvas2D compatibility, reset, normalized frame, and seek-reconstruction contracts
- serialization-safe, deterministically deduplicated, severity-sorted, bounded diagnostic snapshots

## Ownership boundary

Persisted Cinema state contains authored definitions and stable references only. Parameter maps require branded stable parameter IDs at compile time; display labels are never accepted as keys. It cannot contain WebGL objects, DOM/media objects, target leases, texture views, compiled plans, node instances, analyser buffers, diagnostics buffers, or per-frame modulation/performance results.

Runtime contracts expose opaque Cinema-owned target and texture handles. They deliberately do not expose `WebGLTexture`, `WebGLFramebuffer`, `CanvasRenderingContext2D`, or legacy engine runtime ownership. A future Cinema runtime can implement these handles while retaining one canvas/context/loop/target pool/texture graph/quality controller/transition compositor/diagnostics owner.

## Schema versions

- Composition schema: `drmvyz.cinema.composition`, version `1`
- Package schema: `drmvyz.cinema.package`, version `1`

There was no earlier Cinema persisted schema in the supplied repository, so Stage 1 adds no React-store migration and does not increment React store persistence version `65`. Future schema changes must migrate explicitly and must reject unknown future versions rather than reinterpreting them.

## Fidelity contracts

The renderer contracts explicitly retain the four migration-critical capabilities:

1. Canvas2D nodes declare native, raster-upload, or unsupported compatibility.
2. Shader passes describe stable pass/resource IDs, custom/shared vertex programs, fragment programs, parameter/frame/camera/Brand Kit uniform bindings, texture/history bindings, dependencies, target format/filter/wrap/blend, bloom tiers, persistent targets, ping-pong feedback, history, fullscreen drawing, and custom geometry/instancing.
3. Reset commands use stable action identifiers for activation, track replacement, restart, seek, loop wrap, section change, resize, context restoration, and manual reset.
4. Stateful nodes declare stateless, reset-at-position, deterministic replay, checkpoint replay, or explicit unsupported seek reconstruction.

## Stage 2 handoff

Stage 2 can consume these contracts to implement graph normalization, validation, and deterministic compilation. It should use `CinemaIdentifiers` for stable identity checks, `CinemaDiagnostics` for all failures, `CINEMA_SAFE_OUTPUT_DESCRIPTOR` for invalid graphs, and the public `CinemaNodeTypeDefinition`/port contracts for registry-backed compilation.
