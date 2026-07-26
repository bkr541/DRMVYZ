# LaserDMX Finite Cue Physical Renderer Correction: Patch 2

## Scope

This patch preserves the finite cue lifecycle, parameter ownership, output gating, and deterministic transport introduced by Finite Cue Architecture Patch 1 while correcting the scanner-to-renderer boundary. The renderer now presents ordered galvanometer exposure as a scanned trajectory instead of converting every exposure sample into an equally bright aperture-to-target ray.

Preset re-authoring is intentionally deferred to Patch 3.

## Authoritative renderer input

The resolved `LaserDmxShowDirectorMacroScanPlan` now carries finite-cue animation state, fixture-motion state, movement progress, lifecycle state, cue ownership, and owned parameters into `LaserDmxScanPath`.

WebGL and Canvas2D consume the same `buildLaserDmxScannerExposurePlan` result. Neither renderer advances phase, rotates a pattern, oscillates a target, extends a cue, or opens output from local time. Renderer delta time is limited to presentation interpolation and history decay.

## Presentation modes

Each ordered path declares one physical presentation mode:

- `scannedPath`: circles, polygons, smooth fan sweeps, waves, grids, tunnels, corridors, and other sequential frames become target-to-target scan strokes.
- `intentionalRays`: authored stepped, mirrored, opposed, crossing, X, center-out, and outside-in fan slots remain deliberate aperture rays.
- `heldRay`: a held beam, parallel fixture sheet member, or explicit diffraction source remains one held optical output.

Path points never become independent fixtures. Prism, diffraction, and physical-aperture copies are created only by the optical-copy plan, and their combined energy is normalized.

## Scanner frame integration

The physical scanner solver samples one complete repeated scanner frame for each render exposure. A stable authored path therefore produces the same integrated frame at every transport position even though its instantaneous galvanometer ray continues to move around the path.

Finite cue movement changes the authored path geometry before sampling. The renderer does not use the galvanometer's scanner-frame phase as choreography.

Exposure samples include:

- represented sample duration
- scanner-space segment length
- normalized velocity and acceleration
- dwell weighting
- blanking and retrace identity
- scanner-frame phase for diagnostics
- cue-aware history weighting

Visible exposure is normalized per physical optical output. Draft through Ultra tiers change sample density and segment fidelity without changing emitted energy or cue state.

## Blanking and retrace

Blanked travel and retrace remain zero-energy topology breaks through the scanner solver, WebGL plan, Canvas2D plan, sharp-beam plan, atmosphere plan, and temporal-history plan.

A blank marker:

- emits no sharp body, core, glow, or atmosphere contribution
- contributes no temporal history
- resets stroke continuity
- prevents closed-path stitching across a visibility break
- remains available to diagnostics without becoming renderer geometry

## Exposure geometry and energy

`LaserDmxScannerWebGLPlan` groups samples by scanner head, path, and optical copy.

For sequential paths it connects consecutive visible target positions into scan strokes. Dwell samples reinforce adjacent exposure instead of creating aperture spokes. The resulting segment energy is normalized back to the visible shutter energy.

For intentional rays it aggregates by authored slot. Increasing sample count improves the statistical estimate of that slot but does not increase brightness.

Quality thinning allocates deterministic per-path budgets and rescales retained segments to preserve each path's energy.

## Core, glow, atmosphere, and bloom

Scanner strokes use narrower bodies, lower core baselines, restrained white-hot mixing, and smaller atmosphere envelopes than held or intentional rays. Exposure density is computed per unit scanned path length, with bounded velocity, acceleration, and dwell response.

Atmosphere visibility still depends on fixture optical power, haze response, local density, depth, view angle, wavelength response, and exposure density. Fast authored cue motion receives a modest width and visibility reduction without globally dimming haze.

Bloom gain and radius are reduced for scanner frames, especially during fast authored cue movement. Strobe and blinder flash gain remains independent so the scanner safeguard does not suppress nonlaser impact fixtures.

## Motion-responsive temporal history

Temporal motion compares consecutive authoritative path geometries. Galvanometer velocity inside a stable repeated frame is not treated as cue motion.

- Stable held scanner frames receive restrained sensor-like persistence.
- Authored finite cue motion receives progressively shorter retention as path movement increases.
- Blackout, output-gate closure, timing discontinuity, identity change, quality change, capture entry, topology change, explicit path clear, and dark strobe phases clear history.
- Blanked and retrace samples never enter history.
- Finite rotations stop contributing new geometry when the finite cue runtime reaches its endpoint.

## Canvas2D parity

Canvas2D projects and draws the same scanner exposure segments as WebGL. It suppresses overlapping legacy Beam Matrix laser rays for authoritative scanner fixtures and applies scanner-aware decay. It no longer uses a separate continuously advancing laser oscillator for those fixtures.

Canvas2D remains visually simpler, but active fixtures, blackout, cue progress, aim, pattern replacement, optical-copy intent, finite completion, and deterministic reconstruction match WebGL.

## Diagnostics

Renderer diagnostics now expose retrace segment count, average scanner velocity, dwell weight, exposure weight, history weight, normalized fixture energy, cue owner, and stable versus animated path counts in addition to existing scanner and aggregation metrics.

## Regression coverage

Focused tests cover:

- stable circles and sequential paths producing scan strokes rather than aperture spokes
- intentional fan slots remaining deliberate rays
- blanked and retrace travel breaking topology
- dwell reinforcement and velocity-weighted exposure
- sample-density and quality-tier energy invariance
- optical-copy energy conservation
- WebGL and Canvas2D geometry parity
- absence of renderer-local scanner phase
- stable full-frame reconstruction at different transport positions
- motion-responsive history and topology clearing
- scanner-aware bloom restraint
- finite-cue gate closure and deterministic seek reconstruction
