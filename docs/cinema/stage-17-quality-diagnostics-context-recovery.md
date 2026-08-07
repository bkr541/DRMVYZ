# Cinema Stage 17: Graph-Aware Quality, Diagnostics, and Context Recovery

Stage 17 keeps Cinema's existing single-canvas, single-WebGL2-context, single-loop ownership model and adds runtime-only quality, telemetry, and recovery coordination. It does not change the Cinema persisted schema.

## Production path

`React engine selection -> CinemaWorkspace -> CinemaCanvas -> CinemaRuntime -> CinemaGraphExecutor -> registered Cinema nodes -> output node -> Cinema canvas`

`ReactLiveEngineOwnership` remains the live preview ownership arbiter. `useCinemaStore` remains the canonical authored/persisted Cinema state owner. Quality decisions and diagnostics never write transient values back into that store.

## Graph-aware quality

`CinemaQualityManager` evaluates the compiled reachable graph using node cost metadata, viewport size, render-target allocations, estimated target memory, and a bounded render-time sample window. It classifies nodes as output, foreground, or background, then applies deterministic quality tiers with downgrade/upgrade hysteresis.

The runtime preferentially protects output and foreground work. Under pressure it can:

- reduce background render-target resolution;
- scale declared quality-sensitive numeric parameters;
- scale Cinematic Worlds particle density and cap their runtime quality tier;
- reduce Shader multipass optional bloom work to near-minimum target resolution;
- reduce feedback history depth;
- freeze zero-opacity nodes and skip disabled nodes while publishing a tiny transparent fallback texture so downstream graph contracts remain valid.

All decisions are derived runtime state. Authored `enabled`, `opacity`, parameters, graph connections, and project state are unchanged.

## Runtime diagnostics

`CinemaRuntimeDiagnosticsStore` publishes a bounded snapshot containing:

- composition and per-node quality/visibility/error attribution;
- render-target pool allocation count, estimated memory, and active leases by node owner;
- texture graph and asset-manager counts;
- frame-time samples and average/p95/max values;
- graph quality pressure and decisions;
- adapter diagnostic counts;
- context generation and bounded recovery events.

Frame samples, recovery events, diagnostic history, GPU handles, media elements, and quality decisions remain runtime-only and are never serialized.

## Context loss and restoration

On `webglcontextlost`, Cinema cancels its scheduled frame, retires graph node instances, abandons context-bound target/asset resources, and records a recovery event. On restoration, the same `CinemaRuntime` rebuilds targets and media resources, reapplies the current canvas resolution, recompiles/recreates the complete reachable graph, and issues the existing context-restore state reset.

Rendering resumes only when the runtime had already been requested to run. If any restoration step fails, Cinema cancels scheduling, retires any partially rebuilt graph/asset/target resources, enters `unavailable`, and emits `CINEMA_CONTEXT_RECOVERY_FAILED`. No alternate renderer, context, or loop is created.

## Persistence and compatibility

There is no Stage 17 Cinema store/schema migration. Existing Stage 1-16 authored data remains valid. Shader Pads and Cinematic Worlds keep their standalone engine paths; their Cinema adapters only consume the new runtime quality hint when executing inside Cinema.

## Validation focus

Stage 17 tests cover graph-cost/visibility decisions, hysteresis, bounded telemetry, target accounting, transparent/disabled skip behavior, successful full-graph context restoration, failed restoration cleanup, Strict Mode/single-owner production routing, and the real browser WebGL2 recovery harness.
