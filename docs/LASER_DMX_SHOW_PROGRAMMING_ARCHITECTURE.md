# LaserDMX Show Programming Architecture

## Status

Corrective Patches 1 and 2 provide the authoritative professional show-programming layer and its native physical-scanner execution path. Finite Cue Architecture Patch 1 extends that canonical layer with bounded DMX-style commands, explicit cue lifecycle state, parameter ownership, and a hard renderer-facing output gate. Finite Cue Physical Renderer Patch 2 carries that resolved state through ordered scanner exposure, WebGL, Canvas2D, atmosphere, bloom, and temporal history without allowing renderer-local choreography.

The runtime order is now:

```text
performance scene and cue stack
  -> effect macro
  -> stable pattern frame
  -> macro-aware scan planner
  -> ordered scanner path
  -> physical scanner solver
  -> normalized exposure samples
  -> scanned-path or intentional-ray integration
  -> shared WebGL or Canvas2D renderer plan
```

Corrective Patch 2 makes the stable pattern frame authoritative for macro-controlled fixtures. Authored and legacy scanner conversion remain available only for fixtures that have not been migrated to the macro route.

## Versioned persistence

Each normalized `LaserDmxShowDirectorPerformanceProgram` now carries a `laserProgramming` document. The persisted document owns:

- effect macros
- primary cue stacks and accent cue definitions
- cue-relative automation
- fixture-group assignments and relationships
- transition settings
- compatibility metadata and migration warnings

The Performance Program schema is version 5, the nested Laser Show Programming document is version 2, and the persisted React store is version 54. Older projects are normalized through the compatibility adapter without rewriting their original authored scenes. The adapter keeps a JSON-safe `originalProgramBackup` for migration preview and rollback workflows. Version-1 programming documents inherit bounded macro commands, finite lifecycle defaults, deterministic ownership, maximum-run limits, and blackout-after-completion behavior.

## Effect macros

`LaserEffectMacro` is a stable visual identity rather than a frame-level randomizer. It contains:

- one named effect family
- one stable topology identifier
- deterministic ray-slot count, spacing, and traversal
- stable transform, scan, color, optics, and envelope settings
- bounded automation lanes
- explicit fixture-group assignments
- explicit transition-in and transition-out policies

The supported family vocabulary includes held beams, stepped and smooth fans, mirrored and opposed banks, tunnels, corridors, canopy and rake looks, sequential circles, arcs, polygon outlines, progressive waves, grid scans, diffraction looks, moving-head looks, washes, strobes, blinders, LED chases, CO2 impacts, and mixed-fixture scenes.

A macro may move smoothly, but its topology ID and ray-slot layout remain unchanged for the active cue window.

## Stable pattern frames

`LaserStablePatternFrame` is reconstructed from canonical transport time. It contains the cue start, duration, progress, transform values, scanner settings, optical values, nonlaser automation values, deterministic ray slots, relationship modes, and transition state.

The frame ID is based on the program, stack, cue, macro, topology, section occurrence, and authored repeat cycle. It does not depend on render-frame count, seek identity, loop identity, or mutable previous-frame state. Direct seeks and loop reconstruction therefore return the same frame for the same musical position.

`geometryRebuildCount` and `unexpectedTopologyChanges` remain zero when the architecture boundary is respected. Diagnostics expose both counters so future native planners can report violations.

## Quantized cue stack

A `LaserPerformanceCue` selects a macro and defines:

- scene and section constraints
- quantized start type
- start offset in beats
- optional explicit Track Map start time
- cue duration
- optional authored repeat interval
- fixture-group assignments
- cue automation
- transitions
- transient accent cues
- occurrence variation seed offset
- energy constraints
- priority, blackout, and shutter behavior

Cue start offsets are quantized from the current macro-section anchor. A cue is active only inside its authored window. It repeats only when `repeatEveryBeats` is present. Multiple eligible cues are resolved by priority, latest active start, then stable ID order.

Kick, snare, hat, beat, bar, phrase, and section accents are reported as layers over the primary cue. They do not replace the primary macro.

## Finite cue lifecycle and command authority

Every resolved primary cue advances through explicit `off`, `attack`, `movement`, `hold`, `release`, and `blackout` states. Attack, movement, hold, release, required darkness, and maximum-run limits are evaluated from canonical musical position rather than accumulated render delta. A direct seek to a cue timestamp therefore reconstructs the same lifecycle state, progress, fixture recruitment, ownership, and output gate as uninterrupted playback.

Finite commands keep fixture pan/tilt, scanner-frame pattern position, pattern phase/rotation, pattern scale, intensity/shutter, color, optics, scan speed, and persistence intent as separate parameter domains. Pattern rotation does not rotate fixture aim unless a command explicitly targets fixture pan or tilt. Rotation commands require a bounded angle or turn count, duration, direction, easing, hold/completion behavior, and maximum duration. Looping is opt-in and remains bounded by an authored repeat count, maximum loop duration, maximum cue run duration, and shutdown behavior.

Parameter ownership is deterministic. Blackout authority wins first, then non-interruptible ownership, then priority, latest quantized start, and stable cue ID. Ownership is released when the cue completes. Program constraints cap simultaneously active laser fixtures, continuously open output, animated scanner patterns, and finite rotation duration, while requiring authored darkness between selected cue windows.

The runtime output gate is independent of nominal intensity. A closed gate suppresses scanner samples, legacy rays, Beam Matrix beams, fallback fixtures, glow/history contribution, and renderer temporal history. An inactive cue stack fails dark rather than returning an illuminated authored rig. Both WebGL and Canvas2D consume this same resolved gate and fixture state.

## Finite-cue physical renderer boundary

The macro scan plan propagates cue lifecycle, cue and macro ownership, owned parameters, stable-versus-animated state, and deterministic movement progress into the ordered scan path. The scanner solver samples one complete repeated scanner frame for presentation. Stable paths therefore converge to stable images instead of revealing renderer-shutter phase as apparent rotation.

Sequential circles, polygons, smooth sweeps, waves, grids, tunnels, and corridors render as integrated target-to-target scan strokes. Only explicitly authored stepped fan slots, held beams, physical apertures, prisms, and diffraction copies remain aperture rays. Blanked travel and retrace are zero-energy topology breaks in both renderers and in temporal history.

Sample density and adaptive quality alter smoothness only. Per-output energy is normalized before optical-copy expansion, path integration preserves visible shutter energy, and deterministic segment thinning preserves per-path energy. Temporal retention is based on authoritative cue geometry movement rather than galvanometer velocity. See `LASER_DMX_FINITE_CUE_PHYSICAL_RENDERER_PATCH_2.md`.

## Fixture-group relationships

The programming document supports these relationship modes:

- parallel
- mirrored
- opposed
- alternating
- phase offset
- chase
- center out
- outside in
- leader and follower
- call and response
- left and right banks
- front and rear depth planes
- symmetrical pair
- rotational offset
- color alternation

Relationships share deterministic speed, spread, intensity, color, phase, rotation, or depth according to their mode. Mirrored and opposed fixtures no longer choose unrelated directions. Relationship validation warns when coordinated banks disable shared speed or spread, when an assignment references a missing relationship, or when multiple assignments have no explicit relationship.

## Cue-relative automation

Automation lanes are immutable source data and are evaluated from cue progress. Supported curves are hold, linear, ease in, ease out, ease in-out, sine, triangle, stepped, and pulse.

Supported frame parameters include center, depth, width, height, radius, rotation, fan spread, scan speed, direction, phase, intensity, color blend, optical-copy spread, moving-head pan, tilt, zoom, gobo rotation, wash intensity, LED chase position, and haze amount.

The evaluator clamps values to bounded operational ranges. It never mutates the source macro or cue.

## Audio Intelligence boundary

Legacy scenes still run through the Shared Performance Core, but transient layers are now sanitized and deferred until after the stable macro frame is established.

Transient layers may retain bounded accents such as:

- brightness and aperture pulses
- small fan-spread changes
- scanner phase changes
- focus, beam appearance, color, strobe, blinder, LED, haze, and CO2 accents

Transient layers may not change:

- target points or target positions
- target modes
- fixture rotation or direct beam angle
- pattern type
- scan direction or path reversal
- path reset token
- scanner radius, size, or depth layer
- optical mode or optical-copy count
- held-beam identity or cue duration
- geometry or ray-count modulation targets

Blocked mappings are reported through runtime diagnostics. Bar, four-bar, eight-bar, phrase, section, and authored scene layers remain structural and may develop the macro on deterministic musical boundaries.

## Transitions and blanking

Macros and cues support cut, fade, crossfade, shutter out/in, collapse/expand, center-out, outside-in, direction reverse, bank handoff, color crossfade, optical-mode swap, brief blackout, strobe transition, and blinder impact.

Transitions carry explicit blank-disconnected-travel and shutter-during-swap flags. Validation rejects an optical-mode swap that does not blank disconnected scanner travel.

## Diagnostics

Outside Capture presentation mode, the Performance Program panel reports:

- active primary and accent cues
- cue lifecycle state, lifecycle progress, remaining duration, and completion reason
- owning macro and deterministically owned parameters
- active and blacked-out fixture IDs
- current quantization boundary and finite-command validation warnings
- active macro
- cue start and remaining beats
- fixture-group relationships
- stable pattern-frame ID and revision
- transition state
- audio modulation values
- geometry rebuild and unexpected topology counts
- blocked audio geometry mappings
- compatibility source
- programming validation warnings

Capture mode receives no new overlay or renderer-facing diagnostic element.

## Compatibility adapter

The adapter converts each legacy scene into one provisional macro and one section-quantized cue. It preserves:

- scene and fixture addressing
- section constraints and priority
- valid scanner pattern, rate, direction, phase, radius, size, optics, and retrace blanking
- authored transitions
- kick, snare, hat, beat, and bar accent identities
- fixture IDs and source program backup

Linked mirror pairs are inferred only when exactly two fixtures share a pair ID and an authored mirror axis. Ambiguous relationships are recorded rather than guessed.

## Validation and regression coverage

Focused tests cover adapter creation, persistence round trips, stable topology, deterministic ray slots, quantized starts, cue duration, authored repeat cycles, transition state, cue-relative automation, seek and loop reconstruction, mirrored and opposed banks, phase offset, chase, center-out behavior, accent layering, audio geometry suppression, integrated resolver behavior, validation warnings, and Live/Capture state preservation.

## Corrective Patch 2 implementation

Corrective Patch 2 adds native macro-aware scan planning, intended-slot exposure aggregation, fixture-group execution, bounded music modulation, transition-aware history clearing, nonlaser cue-stack execution, and the associated diagnostics and WebGL regression states. See `LASER_DMX_SHOW_PROGRAMMING_CORRECTIVE_PATCH_2.md` for the implementation contract and validation surface.

## Deferred to Corrective Patch 3

Complete first-party preset and Performance Show re-authoring, compatibility retirement, and the final reference-based acceptance audit remain deferred to Corrective Patch 3.
