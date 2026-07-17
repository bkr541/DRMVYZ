# LaserDMX Show Programming Architecture

## Status

Corrective Patch 1 adds the authoritative professional show-programming layer above the existing physical scanner system. It does not replace ordered scan paths, scanner kinematics, blanking, exposure sampling, WebGL rendering, Canvas2D fallback, production output, or recovery behavior.

The runtime order is now:

```text
performance scene and cue stack
  -> effect macro
  -> stable pattern frame
  -> existing scanner runtime overrides
  -> physical scanner solver
  -> exposure samples
  -> WebGL or Canvas2D output
```

Patch 1 deliberately keeps the existing scanner planner as the final geometry authority. Corrective Patch 2 will make scanner-path planning consume stable pattern frames natively.

## Versioned persistence

Each normalized `LaserDmxShowDirectorPerformanceProgram` now carries a `laserProgramming` document. The persisted document owns:

- effect macros
- primary cue stacks and accent cue definitions
- cue-relative automation
- fixture-group assignments and relationships
- transition settings
- compatibility metadata and migration warnings

The Performance Program schema is version 4 and the persisted React store is version 52. Older projects are normalized through the compatibility adapter without rewriting their original authored scenes. The adapter keeps a JSON-safe `originalProgramBackup` for migration preview and rollback workflows.

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

## Deferred to Corrective Patch 2

Corrective Patch 2 should:

- replace compatibility scanner override projection with a macro-aware scan planner
- compile stable ray slots into native ordered paths
- perform transition-safe path handoff and disconnected-travel blanking in the planner
- route moving-head, wash, LED, haze, and optical automation through dedicated runtime plans
- measure actual topology revisions and geometry rebuilds across the planner boundary
- add authoring controls for macros, cue stacks, relationships, and automation

Complete first-party preset and Performance Show re-authoring remains deferred to Corrective Patch 3.
