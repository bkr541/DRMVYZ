# LaserDMX Physical Scanner Architecture

## Status

Patch 1 introduced the CPU-side physical scanner domain. Patch 2 makes scanner exposure samples authoritative for normal WebGL scanner fixtures while retaining legacy beam data for Canvas2D compatibility, non-scanning lasers, nonlaser fixtures, and diagnostics.

## Physical contract

A normal `laser` Show Director fixture resolves to one aperture, one scanner head, one instantaneous base ray, and one ordered scan path. Multiple visible positions in a rendered frame come from deterministic camera-shutter exposure sampling, not from treating every target as a simultaneous physical beam.

Additional simultaneous rays require explicit optical or hardware representation. Patch 1 recognizes authored prism facets as optical copies. Future native models may add diffraction gratings, beam splitters, multiple emitters, or multiple scanner heads without changing the single-head default.

Nonlaser fixtures do not enter the scanner solver. Moving heads, washes, strobes, blinders, LEDs, atmosphere fixtures, CO2, and video surfaces remain on their existing render and production-output paths until their dedicated correction patches.

## Scene-frame fields

`LaserDmxSceneFrame` now distinguishes:

- `fixtures` and `targets`: existing physical and compatibility geometry
- `scannerHeads`: physical scanner limits and shutter settings
- `scanPaths`: ordered, validated scanner paths
- `scannerInstantaneousRays`: one base physical ray per active scanner head
- `exposureSamples`: bounded shutter-integrated samples for future WebGL rendering
- `opticalCopies`: explicit prism, diffraction, splitter, or multi-emitter copies
- `legacyCompatibilityBeamIds`: old beam instances still consumed by Patch 1 renderers
- `scannerDiagnostics`: migration, validation, sampling, blanking, and compatibility status

The legacy `beams` list remains available to Canvas2D and production compatibility paths. In WebGL, a fixture with a valid ordered scanner path is rendered only from `exposureSamples`; its overlapping legacy laser beams are suppressed and validated. The scanner fields do not alter Beam Matrix or production DMX compilation.

## Legacy conversion rules

The adapter is versioned by `LASER_DMX_SCANNER_DOMAIN_VERSION` and does not mutate the normalized Show Director state.

| Legacy intent | Ordered scanner conversion |
| --- | --- |
| Held beam | One stationary point with dwell |
| Fan or sweep | Angularly ordered open path with ping-pong traversal |
| Triangle or polygon | Stable perimeter order and closed edge traversal |
| Circle or ring | Sequential elliptical perimeter with arc interpolation |
| Scanner wave | X-ordered open curve with ping-pong traversal |
| Rotating lattice | Stable perimeter traversal instead of simultaneous spokes |
| Cross | One ordered sweep per physical fixture |
| Tunnel or mirrored corridor | Fixture-local nearest-neighbor path; distinct fixtures retain independent deterministic phase |
| Burst without prism | Rapid ordered radial scan |
| Burst with prism | One base scan plus explicit prism copies |
| Large disconnected jump | Insert a blanked retrace point before the new visible island |

Ambiguous cross, corridor, and burst conversions are recorded in scanner migration warnings. Loading a project does not persist scanner-domain data back into the saved project merely because the compatibility adapter ran.

## Deterministic scanner solver

The solver derives scanner state from authoritative audio time, BPM, occurrence seed, fixture identity, and authored path data. It keeps no mutable frame-to-frame scanner position.

Travel time is bounded by:

- authored point rate
- maximum angular velocity
- symmetric acceleration and deceleration time
- point dwell
- corner dwell
- blanking delay

Path traversal supports forward, reverse, alternating, loop, ping-pong, once, closed paths, open paths, and blanked retrace. Linear, arc, and Bezier-like eased interpolation are available. `durationBeats`, when authored, may slow a path to a musical duration but cannot force it faster than the physical travel bounds.

This stateless design reconstructs directly after seek, loop wrap, pause/resume, track change, preset change, renderer change, context restoration, or a timing discontinuity.

## Exposure sampling

For each scanner head, the solver evaluates a bounded set of samples over the virtual shutter interval ending at the current render time.

- Low: 4 samples per head
- Medium: 8 samples per head
- High: 16 samples per head
- Ultra: 28 samples per head
- Auto: 12 samples per head

Blanked and retrace positions are retained in `exposureSamples` as zero-energy topology markers and counted in diagnostics. WebGL consumes them only to break visible segment continuity. Dwell and low-velocity samples receive greater exposure weight. Held points therefore accumulate at one location, while fast spans distribute their energy across the path. Quality changes only the sampling density, not the authored path or musical phase.

Prism copies are emitted after the base scan evaluation and retain an explicit `opticalCopyIndex`. The base instantaneous ray remains singular.

## Diagnostics

Renderer Diagnostics now reports:

- scanner head count
- ordered path count
- exposure sample count
- legacy-converted path count
- explicit optical-copy count
- average active scan rate
- blanked sample count
- path validation error count
- scanner compatibility mode

Diagnostics remain hidden with the rest of the renderer diagnostics in Capture presentation mode.

## Patch 2 implementation

Patch 2 converts ordered shutter samples into target-to-target WebGL segments, uses analytic screen-space capsule coverage for sharp laser cores, hands scanner-derived segments to atmosphere, normalizes radiance by exposure density rather than sample count, and limits temporal history to restrained laser-only sensor persistence. The existing fixed camera, clipping, continuous depth, HDR, bloom, recovery, adaptive quality, production output, and Canvas2D fallback remain intact. See `LASER_DMX_PHYSICAL_SCANNER_PATCH_2.md` for the detailed rendering contract and regressions.
