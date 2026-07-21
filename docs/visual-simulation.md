# Visual Simulation Architecture

## Purpose and boundary

`src/features/visualSimulation/` is an optional engine-neutral toolbox for visuals that need deterministic motion, particles, trails, force fields, or other stateful simulation. It does not render anything by itself.

It is not:

- a top-level DRMVYZ engine
- a visual overlay applied to existing engines
- a global React provider
- a Zustand simulation store
- a global mutable simulation singleton
- an alternate Behavior Controller

Shared Performance Programs remain the Behavior Controller layer. They interpret `SharedPerformanceContext` and author engine-specific visual intent. The shared behavior-routing runtime turns that intent into smoothed controls and bounded event impulses. A renderer may then feed those values into an engine-owned simulation domain.

```text
Music Intelligence
↓
SharedPerformanceContext
↓
Engine-specific Performance Program
↓
Shared behavior-routing runtime
↓
Engine-normalized controls and impulses
↓
Optional shared visual-simulation utilities
↓
Engine-owned simulation domain
↓
Engine renderer
```

## Fixed-step clock

`FixedStepSimulationClock` accepts a renderer frame delta and advances an engine-owned domain with a configured fixed timestep. It clamps the accepted frame delta, bounds the accumulator, limits substeps, reports interpolation alpha, and drops excess catch-up time after tab suspension or long stalls.

Pause, resume, freeze, unfreeze, seek, backward seek, loop wrap, timing discontinuity, and track replacement clear the accumulator without taking an unwanted simulation step. This prevents a giant physics step after pause/resume and prevents stale interpolation across transport jumps.

The clock has no React, Canvas, WebGL, Zustand, or audio dependency. Each renderer creates and disposes its own instance.

## Deterministic random and noise

`random.ts` provides stable string and numeric hashing, seeded pseudorandom sequences, deterministic unit/signed/range values, smooth scalar value noise, and allocation-free two- and three-component vector-noise writers.

Simulation updates must not call `Math.random()`. Identical seeds and coordinates must produce identical results across seek reconstruction, preview, thumbnail, and live playback. Vector noise writes into caller-owned arrays to avoid per-sample object allocation.

## Lifecycle contract

`VisualSimulationLifecycleController` compares a stable structural signature during configuration:

- a changed structural signature calls the engine domain's `rebuild`
- an unchanged structural signature calls `updateParameters`

The engine-owned adapter implements deterministic reset, timing synchronization, pause, resume, runtime mode changes, and resource release. Runtime modes are `live`, `preview`, and `thumbnail`; the domain decides what those modes mean within shared quality and safety budgets.

Seek, backward seek, loop wrap, and track replacement are explicit lifecycle events. Synchronization must reposition timing state without silently integrating skipped time.

On disposal, the renderer must release or replace typed arrays, CPU buffers, GPU buffers, and any internal resource pools it owns. Disposal must be idempotent at the renderer boundary.

## Quality and resource budgets

The shared `auto`, `low`, `medium`, and `high` descriptors bound generic resource categories:

- simulation points
- particles
- trail samples
- substeps
- auxiliary effects
- event states

These descriptors are caps, not visual prescriptions. An engine maps its own concepts onto the generic categories and may enforce stricter limits. Living Ribbon, Reactive Constellation, and future simulations keep their visual-specific budgets and semantics in their own domains.

## Ownership rules

The shared foundation may contain only genuinely reusable timing, determinism, lifecycle, budget, and math infrastructure.

Keep these outside the shared module:

- Sound Drawing target names
- Music Intelligence source names
- Living Ribbon choreography
- constellation graph generation and visual roles
- engine-specific physics and rendering
- engine-specific UI
- engine-specific persistence

Simulation state is volatile renderer state. It must not be persisted and must not be updated per frame through Zustand. A renderer owns exactly the runtime instances and buffers it creates, and it disposes them when its surface, preview, thumbnail, context, or engine lifecycle ends.
