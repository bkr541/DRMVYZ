# Shared Performance Core and Authored Performance Shows

## Authority boundary

Loaded-track analysis is shared infrastructure. It owns the resolved Track Sections, beat and downbeat grid, bars, phrases, section families and occurrences, semantic moments, confidence, and capability reporting. LaserDMX, Sound Drawing, and CANVAS consume that same context through `src/features/performanceCore/context.ts`.

Engine Performance Programs do not analyze tracks. They interpret the authoritative context and emit engine-specific actions. Adding a separate section detector inside an engine would create conflicting timelines, non-deterministic seeking, and disagreement with Track Map.

## Architecture

The core is split into small engine-neutral modules:

- `context.ts`: authoritative musical context, transport discontinuities, cadence, occurrences, and analysis adapters.
- `signals.ts`: discrete beat/kick/snare/hat/downbeat events versus continuous bass, energy, tension, complexity, phrase, and vocal signals.
- `programRuntime.ts`: scene matching, occurrence and bar matching, fallback selection, deterministic variation, cadence actions, and event intents.
- `authoring.ts`: typed metadata, capability/confidence requirements, bar ranges, validation adapters, resource estimates, and collection validation.
- `diagnostics.ts`: compact cross-engine runtime snapshots.
- `PerformanceProgramDevelopmentValidation.ts`: one-shot, development-only catalog validation that logs errors without interrupting playback.
- `determinism.ts`, `envelopes.ts`, and `transport.ts`: stable variation, bounded musical envelopes, and seek/loop/track-replacement detection.

Engine payloads remain separate:

- LaserDMX: `LaserDmxShowDirectorPerformanceProgram.ts`
- Sound Drawing: `soundDrawing/SoundDrawingPerformanceTypes.ts`
- CANVAS: `canvasPerformance/CanvasPerformanceTypes.ts`

This avoids a single mega-union containing fixtures, drawing layers, media roles, transitions, and effects.

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

Adapters construct state from the bottom upward. Sound Drawing, for example, starts with defaults, resolves authored/cadence actions, applies continuous routes, applies transient envelopes, restores user locks, then clamps layers, traces, particles, feedback, transforms, and camera bounds. CANVAS resolves authored composition and media decisions, respects media/layer/global locks, then enforces decoder, layer, texture, feedback, preload, and effect limits. LaserDMX retains its established beam and safety budgets.

## Event actions versus continuous routes

Event actions are short musical envelopes triggered by beat, downbeat, kick, snare, hat, transient, or semantic moments. They are suitable for impacts, cuts, topology flips, flashes, and brief motion accents.

Continuous routes map sustained analysis values such as bass, energy, tension, build progress, phrase progress, or vocal energy into bounded parameters. Routes must define finite ranges and should include clamps. They are recomputed from the current track position rather than historical frame accumulation, so seeking and looping resolve deterministically.

## Seeking, looping, and track replacement

Every frame is derived from track position, timeline revision, section occurrence, cadence block, deterministic seed, and transport identities. Volatile envelopes are not persisted. On seek, loop wrap, track restart, or replacement, renderers clear transient surfaces and rebuild the resolved frame from the authoritative context. CANVAS preload work is scoped to track identity and pool revision; inactive media resources are released.

## Confidence and capability gates

Scenes may require capabilities and confidence channels. Low-confidence section interpretation retains beat-level reactivity when possible, disables aggressive anticipatory choreography, selects a safe fallback scene, and exposes the limitation in diagnostics. Validation never crashes production playback.

## Diagnostics

Each engine publishes a compact, collapsible inspector containing the current show, scene, section/family/occurrence, drop occurrence, bar and 4/8/16-bar stages, motif or composition, active layers, event envelopes, continuous routes, semantic look-ahead, locks, fallback state, capability/confidence limitations, and resource-limit decisions. Diagnostics are throttled to a bounded update rate, cleared on engine switches, and never persisted, so inactive or stale frame state cannot leak between engines.

## Sound Drawing authoring

A Sound Drawing show contains scene actions made from separately typed layers and roles:

- `primaryMotif`
- `harmonicLayer`
- `rhythmAccent`
- `echoLayer`
- `atmosphereLayer`
- `transitionLayer`

To add a show, create a `SoundDrawingPerformanceShowDefinition` in `SoundDrawingPerformanceShows.ts`, declare program metadata and a fallback scene, author section scenes and cadence arrays, then run `validateSoundDrawingPerformanceShows()`. New action types belong in `SoundDrawingPerformanceTypes.ts` and must be handled in `SoundDrawingPerformanceEngine.ts` plus its validator.

## CANVAS authoring

CANVAS separates media roles from composition slots. Media can be tagged as hero, alternate hero, background, texture, foreground accent, mask, transition, or section-specialized assets. Composition templates define bounded layer layouts; effect recipes define bounded chains; transitions define duration, interruption policy, and fallback.

To add a show, create scenes in `CanvasPerformanceShows.ts`, assign a declared fallback scene, and compose only registered template, recipe, transition, and layer-role IDs. Run `validateCanvasPerformanceShows()`. New action types belong in `CanvasPerformanceTypes.ts`, are resolved in `CanvasPerformanceEngine.ts`, and must be added to `CanvasPerformanceValidation.ts`.

## Production limits

Sound Drawing caps layers, traces, particles, event envelopes, expensive generators, and feedback passes. CANVAS caps active layers, video decoders, media handles, preload requests, transition/effect depth, and feedback passes while retaining original media fidelity. LaserDMX continues to use its existing beam-budget and safety rules. `LaserDmxShowDirectorPerformanceValidation.ts` validates the compatibility schema, bank-role references, modulation targets, durations, transitions, fallbacks, and built-in registry without changing rendered output. Limits are reported when they alter authored demand.

## Validation commands

```bash
npm run typecheck
npm test -- --run src/features/performanceCore src/components/vyzualz/react/PerformanceProgramFinalValidation.test.ts src/components/vyzualz/react/soundDrawing src/components/vyzualz/react/canvasPerformance src/stores/performancePersistenceMigration.test.ts
npm run lint
npm run build
```
