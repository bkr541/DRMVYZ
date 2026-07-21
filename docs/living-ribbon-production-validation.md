# Living Ribbon Production Architecture and Validation

## Final architecture

```text
Music Intelligence
↓
SharedPerformanceContext
↓
Sound Drawing Performance Program
↓
Shared behavior-routing runtime
↓
Living Ribbon normalized controls and physical impulses
↓
Living Ribbon simulation
↓
Sound Drawing Canvas2D renderer
```

Music Intelligence remains the only track-analysis authority. `SharedPerformanceContext` is the musical snapshot used by every Performance Program. The Sound Drawing Performance Program is the Behavior Controller for Living Ribbon: it decides how sections, phrases, occurrences, confidence, and musical events become visual intent. The shared behavior-routing runtime supplies reusable continuous smoothing and bounded event envelopes. It does not decide what a song section means.

The Simulation Framework is a small toolbox for fixed-step timing, deterministic random values, lifecycle synchronization, structural signatures, and resource budgets. It is not an overlay. It does not draw over every engine, own a global renderer, create a global mutable simulation, or store simulation arrays in Zustand. An engine opts into only the utilities it needs and still owns its visual domain.

Sound Drawing owns Living Ribbon because Living Ribbon is a Sound Drawing generator, uses Sound Drawing authored shows and controls, renders through Sound Drawing's Canvas2D path, and falls back through Sound Drawing's established harmonic ribbon path. No additional top-level engine is created.

## Runtime ownership and lifecycle

Each Canvas2D owner context has an isolated weakly owned runtime state. A live renderer, preview, and thumbnail never share simulation arrays, trail buffers, failure records, seeds, or event history. Inactive layer runtimes are disposed during frame preparation. Engine switching removes inactive Living Ribbon runtimes. Renderer disposal releases simulation arrays, projected spline buffers, recent impulse history, failure records, and the WeakMap owner entry.

Lifecycle rules:

- Configure structural changes through the structural signature and rebuild deterministically.
- Apply ordinary normalized controls without replacing arrays.
- Pause freezes completed state.
- Resume reconstructs from the authoritative audio position instead of integrating a wall-clock gap.
- Seek, backward seek, loop wrap, timing discontinuity, source replacement, and track replacement reconstruct bounded state and clear future transient identities.
- Repeated synchronization with the same reason and identity is ignored, preventing duplicate loop-boundary firing.
- Disposal is idempotent and affects only the owning renderer.

## Deterministic transport reconstruction

Living Ribbon reconstructs from its deterministic initial geometry using an absolute-time bounded pre-roll. It never replays the track from zero and never uses elapsed wall-clock time.

- Fixed timestep: `1 / 120` second
- Maximum normal-frame substeps: `8`
- Maximum accepted frame delta: `0.1` second
- Warm-start duration: `0.25` second
- Warm-start step count: `30`
- Reconstruction comparison tolerance: `1e-6` per numeric component
- Restored state: normalized controls, deterministic seed, structural settings, target audio time, and stable authored identity
- Cleared state: future physical impulse identities and future renderer trail surface

Event identities that occur inside the bounded reconstruction window are restored when the authoritative authored frame emits them again. When advanced timeline information is unavailable, the Sound Drawing fallback scene retains visible band, energy, and rhythm reactivity instead of attempting speculative full-track replay.

## Auto quality

Manual Low, Medium, and High are fixed. Auto begins at Medium for live and preview rendering and Low for thumbnails. It uses a rolling frame-time signal with sustained thresholds:

- Step down after `45` sustained poor samples at or above the rolling `1 / 42` second threshold.
- Step up after `180` sustained good samples at or below the rolling `1 / 58` second threshold.
- Hold a `120` frame cooldown after a transition.
- Do not react to one slow frame.
- Rebuild structural quality deterministically at the same authoritative audio position.
- Report requested and resolved quality through Living Ribbon diagnostics.

Preview is capped at Medium-equivalent geometry when Auto recovers. Thumbnail quality remains separately capped and cannot recruit live-render budgets.

## Resource limits

Living Ribbon enforces these hard ceilings:

| Resource | Limit |
| --- | ---: |
| Live simulation points | 256 |
| Preview simulation points | 128 |
| Thumbnail simulation points | 64 |
| Runtimes per Canvas2D owner | 6 |
| Failure records per owner | 12 |
| Remembered simulation impulse identities | 256 |
| Recent rendered impulse diagnostics per runtime | 8 |
| Shared behavior route states | 1,024 |
| Shared behavior event bindings | 1,024 |
| Active event envelope states | 512 |
| Remembered behavior event identities | 2,048 |
| Fixed-step substeps per frame | 8 |
| Spline subdivisions | 3 |
| Glow passes | 3 |
| Live or preview sparks | 8 |
| Thumbnail sparks | 3 |
| Diagnostic counters | 1,000,000 |

Typed arrays and spline buffers are allocated only for the resolved structural budget and reused frame to frame. The renderer creates no Canvas element per Living Ribbon frame. Sound Drawing's existing offscreen trail surface remains renderer-owned and bounded by the surface dimensions.

## Finite-value recovery and fallback

The simulation checks point counts, typed-array capacities, interpolation alpha, positions, velocities, widths, heat, speed, displacement, and velocity bounds. Localized invalid values are repaired at their deterministic anchors. Widespread corruption or invalid capacity triggers a bounded deterministic reconstruction at the current audio time. Counters are bounded, and a failed recovery disposes only the affected Living Ribbon runtime.

The Sound Drawing renderer catches explicit Living Ribbon creation, configuration, synchronization, or render failures. It records a compact diagnostic, uses bounded exponential retry backoff, and draws the existing harmonic waveform or harmonic ribbon fallback with basic band and energy reactivity. The full DRMVYZ renderer remains alive and does not leave a blank canvas. Broad silent catch-all behavior is not used.

## Authoring another simulation-based Sound Drawing visual

1. Keep musical source names and section semantics in a Sound Drawing Performance Program.
2. Define continuous routes for normalized physical controls. Example: map build progress through a bounded curve into tension and collapse amount with attack/release smoothing.
3. Define event bindings for short physical impulses. Example: map a downbeat identity to a radial impact envelope and a snare identity to an alternating lateral shock.
4. Keep the simulation domain renderer-independent and music-agnostic. It should consume only normalized controls, deterministic seeds, and explicit physical impulses.
5. Give the Canvas2D renderer ownership of runtime arrays, presentation buffers, trail surfaces, preview/thumbnail modes, diagnostics, fallback, and disposal.
6. Add deterministic transport, stress, finite-recovery, thumbnail isolation, persistence, and integration tests before registering the visual in an authored show.

Another engine may use the shared simulation utilities only when it keeps its own choreography, controls, rendering, persistence, runtime ownership, and disposal local. Opting in does not place that engine beneath Sound Drawing and does not create a shared overlay.

## Validation commands

```bash
npm ci --ignore-scripts
npm run typecheck
npm run test:node -- --run
npm run test:dom -- --run
npm run lint
npm run build
```

Focused Living Ribbon validation:

```bash
npx vitest run --config vitest.node.config.ts \
  src/features/performanceCore/behaviorRouting.test.ts \
  src/features/visualSimulation/visualSimulation.test.ts \
  src/features/visualSimulation/livingRibbon/LivingRibbonSimulation.test.ts \
  src/components/vyzualz/react/soundDrawing/SoundDrawingBehaviorRuntime.test.ts \
  src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceEngine.test.ts \
  src/components/vyzualz/react/renderers/LivingRibbonCanvas2DRenderer.test.ts \
  src/components/vyzualz/react/renderers/LivingRibbonFinalIntegration.test.ts \
  src/components/vyzualz/react/renderers/SoundDrawingLivingRibbonIntegration.test.ts \
  src/stores/performancePersistenceMigration.test.ts
```

## Environment limitations

The deterministic stress and final integration tests run in Vitest without a real browser GPU. Browser-only smoke tests still require the repository's configured browser runtime and installed browser binaries. A complete dependency install is required; partial archived `node_modules` directories are not a reliable validation environment. This patch adds no dependency and does not change browser or build tooling.
