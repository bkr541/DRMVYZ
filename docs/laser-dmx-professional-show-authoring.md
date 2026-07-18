# LaserDMX Professional Show Authoring

## Authority and compatibility

First-party Show Director content is authored through `LaserShowProgrammingDocument`. Each shipped Performance Show owns a native effect-macro library, a quantized cue stack, and explicit fixture-group relationships. The legacy adapter remains available only for user-created projects that do not yet contain a native programming document. It is not the authoritative path for first-party shows.

The physical scanner solver, ordered paths, dwell, velocity and acceleration limits, blanking, retrace blanking, exposure samples, optical copies, linear-light color, atmosphere, and WebGL/Canvas2D renderer boundaries remain unchanged.

## Effect macros

The professional effect catalog lives in `LaserDmxShowDirectorProfessionalEffectLibrary.ts`. Every definition has:

- a stable ID and display name
- a bounded ray-slot count and scanner rate
- a physical scanner pattern and traversal mode
- explicit optical-copy limits
- a musical duration
- bounded transform and intensity values
- optional continuous automation lanes
- a quality priority
- safe blanked transitions
- an intended fixture family and group relationship

A macro owns topology. Audio and cue automation may change scalar parameters such as fan spread, size, intensity, phase, scan speed, haze, moving-head position, wash level, and LED chase position. They do not change ray-slot count, pattern family, path point identity, optical-copy count, or fixture membership inside a cue.

## Cue stacks and stable pattern frames

First-party scenes are divided into four readable four-bar stages. The stages repeat on a deterministic 16-bar cycle:

1. establish the section motif
2. develop motion or bank relationship
3. recruit depth and support fixtures
4. deliver phrase evolution or a controlled optical accent

Cue resolution is section anchored and quantized. Stable pattern frames are cached by program, cue, macro, topology, section occurrence, fixture topology, and deterministic variation identity. Seek, loop, and repeated section playback resolve to the same frame identity and ray slots.

Pre-drop scenes add a one-beat authored shutter cue at a bar boundary. The blackout is explicit, clears temporal history, preserves retrace blanking, and cannot expand into accidental long darkness.

## Fixture-group relationships

Laser assignments always declare a relationship. Available relationships include parallel, mirrored, opposed, alternating, phase offset, chase, center-out, outside-in, leader/follower, call-and-response, left/right banks, front/rear depth planes, symmetrical pair, rotational offset, and color alternation.

Relationships may share speed, spread, intensity, and color. Relationship phase is derived from the stable cue frame, never from independent per-fixture random state. This prevents mirrored banks from drifting apart.

Nonlaser fixture assignments are purpose-specific:

- moving heads provide held positions, convergence, slow pan/tilt, gobo, prism, zoom, and frosted breakdown looks
- PAR/wash fixtures provide section color beds and energy lift
- LEDs provide coordinated chases and fills
- strobes and blinders are event-gated accents
- haze is a bounded section parameter
- CO₂ is enabled only by authored impact accents

## Audio modulation policy

Continuous Audio Intelligence may modulate bounded intensity, fan spread, size, color blend, scan speed, haze, moving-head parameters, wash intensity, and LED chase position. Transient payload sanitation removes topology mutations from kick, snare, hat, and beat actions.

Topology changes occur only at cue boundaries. Audio cannot directly rewrite target coordinates, ray-slot count, path geometry, pattern family, optical-copy count, or fixture-bank membership.

## Color and energy normalization

Each first-party show has an authored four-color scene palette. Colors remain stable for the duration of a cue. Group alternation uses deterministic fixture identity. Ray-slot energy is normalized by the scanner/exposure aggregation pipeline, and optical copies conserve source power.

Readability should be tuned with atmosphere, aperture energy, exposure, fixture recruitment, and controlled ray count. Beam cores must not be thickened to compensate for dim output.

Quality degradation preserves cue timing, topology, ray-slot layout, group relationships, blanking, and hero macro identity. Reduce texture copies, secondary atmosphere, low-priority fixtures, nonessential prism copies, and support exposure precision before altering hero structure.

## Visual and temporal acceptance

The WebGL reference manifest covers physical laser primitives, nonlaser fixtures, stable fans, mirrored/opposed/crossing banks, fan opening and closing, sheets, tunnels, corridors, outlines, waves, bank handoff, call-and-response, moving-head looks, wash, strobe, blinder, LED, CO₂, blackout, and the full musical section arc.

The review harness renders four-frame sequences and records:

- cue identity stability
- topology stability
- color-scene stability
- fixture-bank phase drift
- adjacent-frame pixel difference
- exposure sample-count range
- blackout-frame count

Per-frame validation also measures black floor, meaningful lit pixels, connected light, highlight and wash ratios, haze occupancy, core-to-envelope ratio, source aperture brightness, path continuity, scanner progression, symmetry, color saturation, optical energy, CO₂ lifetime, and editor-overlay absence.

## Adding a future macro

1. Add a stable catalog ID and definition.
2. Keep all numeric parameters bounded.
3. Choose one physical scanner pattern and fixed ray-slot layout.
4. Define a musical duration and safe transition.
5. Assign a quality priority.
6. Add structural tests for bounds and determinism.
7. Add a WebGL reference scene when the macro introduces a new visual language.

## Adding a future relationship

1. Define the relationship in the programming document.
2. Reference it from every coordinated laser assignment.
3. Share speed and spread for mirrored, opposed, or symmetrical banks.
4. Derive phase offsets deterministically from cue progress.
5. Add temporal tests that prove relative phase does not drift.
6. Preserve the relationship under all quality tiers.
