# LaserDMX Physical Scanner Architecture

## Status

Patch 1 introduces the CPU-side physical scanner domain and keeps the existing WebGL and Canvas2D beam renderers active as compatibility output. Patch 2 is responsible for consuming scanner exposure samples in the WebGL laser renderer.

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

The legacy `beams` list remains authoritative for current WebGL and Canvas2D drawing during Patch 1. The new scanner fields do not alter Beam Matrix or production DMX compilation.

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

Blanked and retrace samples are excluded from `exposureSamples` and counted in diagnostics. Dwell and low-velocity samples receive greater exposure weight. Held points therefore accumulate at one location, while fast spans distribute their energy across the path. Quality changes only the sampling density, not the authored path or musical phase.

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

## Patch 2 boundary

Patch 2 must replace laser beam instance generation with scanner exposure-sample consumption and add the analytic laser shader integration. It must not recreate scanner timing or migration logic in the GPU layer. Patch 2 should preserve the current fixed camera, continuous depth, HDR, bloom, temporal optics, atmosphere, recovery, adaptive quality, and Canvas2D fallback behavior while switching the WebGL laser source of truth from `legacyCompatibilityBeamIds` to `exposureSamples`.
