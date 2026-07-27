# Shared Performance Core and Authored Performance Shows

## Authority boundary

Loaded-track analysis and Music Intelligence own the resolved beat grid, downbeats, bars, phrases, section families and occurrences, semantic moments, confidence, and capability reporting.

Shared Performance Core converts that authoritative timeline into an engine-neutral `SharedPerformanceContext`. Engine Performance Programs interpret the context and emit engine-specific visual intent. They do not analyze tracks.

Adding a second global behavior controller, beat grid, or section detector inside an engine would create conflicting timelines and non-deterministic seeking.

## Current consumers

The shared context is consumed by:

- LaserDMX Show Director
- Sound Drawing
- CANVAS
- Shader Pads
- PixGrid

Cinematic Worlds consumes Music Intelligence and shared resolved sections through its own renderer and camera-direction systems. It must not introduce a competing structural-analysis authority.

Consumer-specific runtime and payload types remain in their engine folders. Shared Performance Core does not contain a mega-union of fixtures, drawing roles, shader parameters, media roles, PixGrid groups, transitions, and effects.

## Core modules

The engine-neutral implementation lives in `src/features/performanceCore/`:

- `context.ts`: authoritative context construction, cadence, occurrences, confidence, capabilities, and transport discontinuities
- `signals.ts`: discrete events and continuous performance signals
- `programRuntime.ts`: scene matching, fallback selection, deterministic variation, cadence actions, and event intent
- `behaviorRouting.ts`: continuous-route smoothing, curves, capability/confidence/section gates, event envelopes, duplicate suppression, and bounded state
- `authoring.ts`: typed metadata, requirements, validation adapters, and resource estimates
- `diagnostics.ts`: compact cross-engine runtime snapshots
- `determinism.ts`, `envelopes.ts`, and `transport.ts`: stable variation, bounded envelopes, and transport-change detection

Development catalog validation is coordinated by:

- `src/components/vyzualz/react/PerformanceProgramDevelopmentValidation.ts`

It validates the catalogs wired into that coordinator. Engine-specific validators remain authoritative for engine-only schemas and acceptance rules.

## Engine-owned payloads and runtimes

| Engine | Primary sources |
| --- | --- |
| LaserDMX | `src/components/vyzualz/react/LaserDmxShowDirectorPerformanceProgram.ts`, `LaserDmxShowDirectorPerformanceContext.ts`, and related Show Director runtime/validation files |
| Sound Drawing | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes.ts`, `SoundDrawingPerformanceEngine.ts`, and `SoundDrawingBehaviorRuntime.ts` |
| CANVAS | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes.ts`, `CanvasPerformanceEngine.ts`, and composition/effect/transition registries |
| Shader Pads | `src/components/vyzualz/react/shaders/performance/` plus the authored `performanceProgram` on shader definitions |
| PixGrid | `src/components/vyzualz/react/pixGrid/PixGridPerformancePrograms.ts`, `PixGridPerformanceRuntime.ts`, `PixGridAudioRouting.ts`, and `PixGridUnifiedPerformanceRuntime.ts` |

The shared layer owns musical context and generic routing mechanics. Each engine owns target names, visual roles, normalization, resource limits, simulation, rendering, UI, persistence, and recovery.

## Behavior-routing runtime

`SharedBehaviorRoutingRuntime` sits beneath an engine-specific program.

Engines supply:

- Source resolvers
- Event identities
- Capability and confidence interpretation
- Target sinks
- Normalization and clamps

The runtime does not read `AudioFeatureBus` directly and does not own a union of engine targets. It stores bounded smoothing state by route ID and bounded event state by deterministic event identity.

Continuous routes reuse shared curves and attack/release smoothing. Event bindings reuse shared attack/hold/release envelopes. Section, confidence, capability, occurrence, and phase gates are evaluated through the engine adapter.

Seek, backward seek, loop wrap, track replacement, source replacement, and timing discontinuities reset or synchronize volatile state rather than carrying stale history into a new musical position.

## Runtime flow

```text
Audio engine and loaded-track analysis
↓
Music Intelligence frame and resolved sections
↓
SharedPerformanceContext
↓
Engine-specific Performance Program
↓
Optional SharedBehaviorRoutingRuntime
↓
Engine-normalized controls, events, and actions
↓
Optional shared visual-simulation utilities
↓
Engine-owned runtime and renderer
```

Shared Performance Core is infrastructure, not a second authoring authority.

## Resolution and precedence

Highest authority wins in this order:

1. Safety and resource clamps
2. Explicit user locks
3. Required fallback corrections
4. Authored scene state
5. Phrase and bar progression
6. Discrete event actions
7. Continuous modulation
8. Engine defaults

Adapters construct state from the bottom upward, then restore higher-authority locks and apply final clamps.

## Event actions and continuous routes

Event actions are short musical envelopes triggered by beat, downbeat, kick, snare, hat, transient, semantic moments, or other discrete identities. They suit impacts, cuts, topology changes, flashes, recruitment, and brief motion accents.

Continuous routes map sustained values such as bass, energy, tension, complexity, build progress, phrase progress, or vocal energy into bounded parameters.

Routes must define finite ranges and explicit clamps. They resolve from the current authoritative position rather than unbounded frame history.

## Seeking, looping, and replacement

Every resolved frame derives from track identity, audio position, timeline and analysis revisions, section occurrence, cadence block, event identity, and deterministic seed.

Volatile envelopes are not persisted.

On seek, loop wrap, track restart, track replacement, source replacement, or incompatible analysis replacement, engines must clear or reconstruct transient state. Pause remains distinct from stop: a paused engine may hold visual state while stopped playback returns transient musical input toward neutral.

## Confidence and capability gates

Scenes and routes may declare capability and confidence requirements.

Low-confidence structural interpretation should retain safe beat-level or band-level reactivity when available, suppress aggressive anticipatory behavior, choose an explicit fallback, and expose the limitation in diagnostics.

Validation must report unsupported targets and requirements without crashing playback.

## Diagnostics

Engine diagnostics should expose the information needed to explain visual behavior:

- Current show and scene
- Section family, occurrence, and phase
- Bar and 4/8/16-bar stages
- Active motif, composition, or visual roles
- Event envelopes and continuous routes
- Locks, fallbacks, confidence, and capability gates
- Resource-limit decisions
- Transport discontinuities and reconstruction state

Diagnostics are bounded, throttled, cleared on engine switches, and never persisted.

React View surfaces common analysis under **REACT → ANALYSIS**. Engines with deeper authoring diagnostics may expose additional engine-specific analysis surfaces.

## Optional visual simulation

Simulation-based visuals may use `src/features/visualSimulation/`.

The module provides:

- Bounded fixed-step timing
- Deterministic random and noise utilities
- Structural signatures
- Lifecycle coordination
- Quality budgets
- Small reusable math helpers

It is not a top-level engine, React provider, Zustand store, global mutable simulation, or rendered overlay.

Each renderer owns its simulation domain, typed arrays, clock, lifecycle controller, preview mode, and disposal. Per-frame simulation state must not live in Zustand.

See:

- `docs/visual-simulation.md`
- `docs/living-ribbon-production-validation.md`

## Engine authoring notes

### Sound Drawing

A Sound Drawing show uses typed visual roles such as `primaryMotif`, `harmonicLayer`, `rhythmAccent`, `echoLayer`, `atmosphereLayer`, and `transitionLayer`.

Author shows in:

- `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceShows.ts`

Add new action types in:

- `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes.ts`

Resolve and validate them in the corresponding engine and validation files.

### CANVAS

CANVAS separates media roles from composition slots. Shows compose registered media roles, templates, effect recipes, transitions, event bindings, and bounded routes.

Author shows in:

- `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceShows.ts`

Add new action types in:

- `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes.ts`

Resolve and validate them in `CanvasPerformanceEngine.ts` and `CanvasPerformanceValidation.ts`.

### Shader Pads

A production shader definition may include an authored `performanceProgram`. The shader runtime merges authored scene actions and the route matrix without mutating persisted manual parameter values.

See:

- `docs/shader-pads.md`
- `docs/shader-native-performance-programs.md`

### PixGrid

PixGrid resolves typed audio assignments, performance-program actions, Track Map cues, structural choreography, and post-composite perceptual effects into one semantic frame shared by Canvas2D and WebGL2.

See `docs/pixgrid.md`.

## Production limits

Each engine owns bounded resource policies:

- Sound Drawing: layers, traces, particles, feedback, event envelopes, and expensive generators
- CANVAS: active layers, media handles, video decoders, preload work, transitions, effect depth, and feedback
- Shader Pads: route, graph, texture, feedback, render-target, and WebGL lifecycle limits
- PixGrid: layers, groups, routes, cues, masks, logical framebuffers, transitions, diagnostic history, and post-composite effect count
- LaserDMX: fixtures, beams, scanner samples, atmosphere, cues, output universes, and safety-related clamps

Limits must be visible in validation or diagnostics when they alter authored demand.

## Validation

Use the repository-level sequence for broad validation:

```bash
npm run verify:fast
```

Useful focused checks include:

```bash
npm run test:laser-dmx:programming
npm run test:pix-grid:perceptual
npm run test:node
```

Engine-specific validation suites remain required when changing an engine's payload, target schema, resource limits, or rendered acceptance behavior.
