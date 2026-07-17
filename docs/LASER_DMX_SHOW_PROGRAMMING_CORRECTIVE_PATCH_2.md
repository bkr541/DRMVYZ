# LaserDMX Show Programming Architecture Corrective Patch 2

## Scope

Corrective Patch 2 connects the versioned effect-macro and cue-stack layer introduced in Corrective Patch 1 to the physical scanner solver and production WebGL renderer. It does not replace scanner kinematics, exposure timing, aperture anchoring, HDR, linear-light color, haze, fallback, or recovery. It also does not complete the first-party preset rewrite reserved for Corrective Patch 3.

## Authoritative execution pipeline

Macro-controlled laser fixtures now execute through one authoritative route:

```text
resolved performance cue
  -> laser effect macro
  -> stable pattern frame
  -> macro-aware scan plan
  -> ordered scanner path
  -> physical scanner solver
  -> raw shutter exposure samples
  -> intended-slot exposure aggregation
  -> aerial-ray WebGL plan
  -> production WebGL renderer
```

A macro-controlled fixture carries `runtimeScanner.authoritativeSource = "macro"` and a versioned `macroPlan`. Scene-frame construction checks this route before authored and legacy scanner conversion. The same fixture therefore cannot simultaneously contribute macro paths, authored/legacy paths, and legacy target beams. WebGL suppresses compatibility beams whenever a physical scanner path owns that fixture, and diagnostics report conflicting path sources or duplicate path ownership.

## Stable topology cache

Stable pattern frames are memoized by a topology key containing:

- macro identity
- cue occurrence and authored revision
- effect family and topology ID
- ray-slot count and spacing curve
- traversal, closed/open state, and stable point identifiers
- optical mode and output count
- aperture count
- active fixture-group assignments and relationships

The key deliberately excludes current Audio Intelligence values, cue-relative center/width/rotation/intensity, and other non-topology parameters. These values are evaluated into the current pattern frame while the cached slot layout remains stable. Diagnostics expose cache hits, cache misses, topology changes per cue, and current slot count.

## Macro-aware scan planners

`LaserDmxMacroScannerPlanner` compiles the stable frame into native scanner heads, ordered scan paths, and explicit optical copies.

Implemented families include:

- held beam
- stepped fan
- smooth fan sweep
- mirrored, opposed, crossing, and paired fan relationships
- parallel sheet
- tunnel and corridor
- sequential circle and arc
- polygon perimeter
- progressive wave
- grid scan
- line, grid, and burst diffraction

Stepped fans use stable normalized ray slots, deterministic traversal, optional blanked travel between slots, edge dwell, point dwell, scan direction, repeat behavior, and a bounded total duty cycle. Smooth sweeps remain a single moving beam with stable intended angular bins for exposure aggregation. Circles, polygons, waves, tunnels, and corridors keep their point topology for the full cue and only automate bounded transforms.

## Physical aperture and optical-copy semantics

The planner combines the macro optical layout with the fixture's explicit physical-aperture layout. The direct output and every prism, diffraction, or multi-emitter copy retain:

- one scanner-head identity
- one optical-copy identity
- a physical origin offset
- angular offsets
- spectral channel
- normalized intensity scale

The product of all direct and copied output scales is energy-conserving. Multiple apertures therefore remain physically separated at the projector rather than appearing as unrelated targets.

## Exposure-slot aggregation

The scanner solver still produces raw samples across the camera shutter interval. A new aggregation stage groups macro-controlled samples by:

- scanner head
- fixture and physical/optical output
- scan path
- cue frame
- intended ray slot or smooth-sweep angular bin
- blanked state

Each visible group emits one aerial-ray sample with a weighted mean origin, aim position, color, time, and velocity. Exposure energy and dwell contribution are summed, duty-cycle bounded, and normalized. Blanked travel remains blanked. Unrelated slots are never merged.

This removes sample-count-dependent brightness, hundreds of near-identical rays, solid triangular wedges, and quality-dependent slot layouts. Quality changes shutter sampling precision, not the programmed fan geometry.

## Fixture-group synchronization

Fixture relationships compile into the final per-fixture macro scan plan after cue resolution:

- mirrored banks use one shared reference frame and mirrored transform math
- opposed banks share speed and spread with opposite deterministic direction
- phase-offset groups derive from one leader phase
- chase groups use discrete stable member ordering
- leader/follower groups retain authored offsets
- parallel and symmetric groups share cue progress, rate, spread, size, intensity envelope, and deterministic color relationship

A macro-controlled fixture cannot keep an independent legacy topology override. Conflicts are reported and the authoritative macro plan wins.

## Controlled Music Intelligence modulation

Continuous Music Intelligence is evaluated only through bounded macro parameters and existing Shared Performance Core envelopes. Supported continuous modulation includes intensity, fan spread within authored limits, pattern size, color blend, haze, moving-head zoom, and LED chase speed/position.

Raw audio frames cannot replace effect family, rebuild ray slots, change aperture or optical-copy count, reassign groups, randomize direction, recalculate perimeter points, or create target collections. Direction changes are quantized. Transient events may add bounded accents, stepped-fan advances, or authored reversals without replacing the primary cue.

## Transition and scanner safety

Macro transitions now project explicit scanner safety state:

- cut
- crossfade
- shutter swap
- bank handoff
- direction reverse
- collapse and expand
- blackout
- strobe transition

Optical swaps and bank handoffs close the shutter around unsafe travel. Disconnected paths retain retrace blanking. The planner marks incompatible temporal history for clearing while preserving the physical aperture origin. Phase is preserved for compatible fades and deliberately reset for incompatible cuts or swaps. The scene transport emits a timing-discontinuity event when a macro transition requests history clearing, allowing laser-only persistence to discard incompatible samples.

## Nonlaser cue-stack execution

The macro frame also owns bounded nonlaser behavior:

- moving heads use stable pan/tilt looks, smooth movement, and quantized gobo/prism rotation
- strobes run event-based accent envelopes
- blinders use bounded impact envelopes
- LED bars and tubes use shared deterministic chase position
- haze follows cue-level density automation
- CO2 runs only as an authored transient with a bounded burst duration

Raw energy no longer continuously retriggers CO2 or creates persistent strobe geometry.

## Diagnostics

Runtime and renderer diagnostics now expose:

- active macro and cue frame
- pattern-frame cache hits and misses
- ray-slot count
- topology changes per cue
- fixture-group synchronization status
- conflicting runtime overrides
- bounded audio modulation values
- transition state and history-clear state
- raw exposure sample count
- aggregated aerial-ray count
- energy before and after aggregation
- macro-controlled path count
- duplicate-rendering fixture IDs

Capture mode remains free of authoring overlays.

## Regression coverage

Focused unit coverage verifies stable topology, macro-to-path compilation, stepped-fan spacing, energy normalization, smooth-fan aggregation, no dense-sample wedge inflation, circle/wave/tunnel stability, relationship symmetry and opposition, phase/chase behavior, bounded audio modulation, quantized direction changes, transition blanking, scanner velocity and acceleration, seek/loop reconstruction, frame-rate and quality independence, duplicate-path suppression, and optical/aperture energy conservation.

The WebGL reference manifest adds actual rendered states for:

- stable 8-ray fan
- stable 12-ray fan
- mirrored 12-ray fan banks
- smooth opening and closing fans
- parallel sheet
- tunnel
- circle
- wave
- cue transition
- bank handoff
- strobe accent
- blinder impact
- LED chase
- CO2 event

## Deferred to Corrective Patch 3

Corrective Patch 3 remains responsible for:

- complete first-party preset and Performance Show re-authoring against the native macro vocabulary
- removal or narrowing of remaining compatibility programming after migration acceptance
- final reference-video acceptance audit
- final visual tuning for each built-in show and song-section arc
- final migration documentation and release hardening
