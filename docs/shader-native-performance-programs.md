# Shader Pads Native Performance Programs

Shader Pads use Shared Performance Core as the timing and section authority. This document covers authored performance behavior only. The wider engine, UI, persistence, and renderer architecture is documented in [`shader-pads.md`](./shader-pads.md).

A production `ShaderDefinition` may declare a `performanceProgram` containing stable authored modulation routes, section scenes, phrase and cadence development, occurrence variation, feedback instructions, and section-transition metadata.

## Runtime order

1. `ShaderEngineRenderer` builds `SharedPerformanceContext` from the canonical audio clock, Music Intelligence frame, track analysis, and resolved section map.
2. `ShaderSectionChoreography` resolves same-scene section instructions and feedback policy. It is reconstructible on first frame, seek, loop wrap, track replacement, and timing discontinuity.
3. `ShaderPerformanceRuntime` resolves the authored scene plan from the current context. Manual parameter values remain the base layer; authored scene actions are deterministic transient offsets, not persisted slider mutations.
4. `ShaderModulationEvaluator` applies the merged authored and user route matrix with source confidence, source fallbacks, target capability fallbacks, section, phase, occurrence conditions, thresholds, curves, smoothing, and event envelopes.
5. Effective values are uploaded to the active shader graph. Manual values stay intact for editing and persistence.

## Route ownership and precedence

Routes persist with stable ownership metadata:

- `built-in`, `modified: false`: may receive safe authored-program improvements
- `built-in`, `modified: true`: user-edited authored route; never overwritten
- Disabled built-in route: retained as modified authored state so reselection does not restore it
- `user`: user-created route; preserved independently of authored migrations
- `legacy`: route loaded from older state without ownership metadata; preserved as user state

Precedence is deterministic:

1. Manual values form the base.
2. Authored section and cadence actions apply.
3. The ordered modulation matrix applies built-in and user routes.
4. Parameter-schema clamps remain the final boundary.

## Production registry

The production registry is exported from:

- `src/components/vyzualz/react/shaders/scenes/index.ts`

It contains eight authored Shader Pads:

- Prism Tunnel
- Liquid Metaballs
- Brand Echo Signal
- Reactor
- Bass Cathedral
- Laser Lattice Overdrive
- Wobble Glyph Forge
- Melodic Rift Bloom

Each program has its own route and target fingerprint and includes four-bar motifs, eight-bar recruitment, sixteen-bar evolution, build and pre-drop handling, Drop 1 versus later-drop variation, breakdown decompression, and outro reduction.

Advanced files folded into Reactor or explicitly retired remain excluded from the production registry. Exclusion reasons live beside `PRODUCTION_SCENES`.

## Determinism and lifecycle

Performance state must reconstruct from authoritative musical time.

The runtime must handle:

- First frame
- Backward and forward seek
- Loop wrap
- Track replacement
- Analysis or timeline revision change
- Pause and resume
- WebGL context loss and restoration
- Shader scene replacement

Transient event identities and feedback state must not leak into a new transport pass or a different scene.

## Validation

`ShaderDefinitionValidator` rejects authored routes and performance actions that cannot resolve a safe target.

Runtime target fallbacks are explicit and ordered. Invalid runtime targets are surfaced in `ShaderPerformanceRuntimeSnapshot.invalidTargetIds` rather than failing silently.

Changes to production Shader Pads should run the relevant Shader unit tests, type-check, build, and browser compilation coverage. See [`verification.md`](./verification.md).
