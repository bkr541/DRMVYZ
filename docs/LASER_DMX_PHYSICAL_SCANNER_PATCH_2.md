# LaserDMX Physical Scanner Correction: Patch 2

## Scope

Patch 2 makes ordered scanner exposure samples the authoritative WebGL input for normal laser scanner fixtures. Legacy source-to-target beams remain available for Canvas2D compatibility, explicit held/non-scanning lasers, transitional diagnostics, and nonlaser fixture rendering, but the WebGL planners suppress legacy laser rays whenever a valid scanner path exists for the same fixture.

## Scanner-sample rendering

`LaserDmxScannerWebGLPlan` converts shutter samples into ordered target-to-target exposure segments grouped by scanner head, path, and optical-copy index. Sample time determines order. Zero-energy blank markers break topology, so disconnected shapes and open-path retrace never generate visible connector segments.

The sharp beam and atmosphere planners independently validate that an authoritative scanner fixture is not also present in the rendered legacy-laser set. Runtime diagnostics expose the selected laser input mode, scanner sample and segment counts, suppressed legacy beam count, and duplicate rendered-input count.

## Exposure density and aperture energy

Segment radiance is derived from exposure weight per authored path length rather than raw sample count. This keeps sparse and dense shutter sampling visually stable while preserving brighter corner or point dwell and localized low-rate scanning.

Source apertures use visible shutter energy, fixture optical power, explicit optical-copy attenuation, and the number of independently sampled physical heads already represented by the exposure samples. Sample count is never used as a source-brightness multiplier.

## Analytic laser coverage

The production sharp-beam shader expands an instanced screen-space quad around each projected segment and evaluates a signed-distance capsule in pixel space. Derivative-based coverage via `fwidth` gives subpixel diagonal continuity without thickening the authored beam into a neon tube. The shader layers a narrow saturated body, pale core, intensity-dependent white-hot center, and a separately controlled atmosphere envelope.

Widths are expressed in CSS pixels and converted using the existing backing-scale uniforms, so device-pixel ratio and adaptive render scale do not change the intended visual width.

## Camera, clipping, and depth

Every scanner segment passes through the existing locked front-center camera, near/far segment clipping, perspective projection, continuous depth slicing, foreground extinction, CO2 attenuation, and HDR accumulation. Scanner segments that cross clipping planes are clipped before projection, preventing giant triangles and non-finite coordinates.

## Atmosphere handoff

Atmosphere illumination uses the same scanner-derived target-to-target segments. Lower atmosphere quality combines only contiguous segments and never merges across blanked retrace, scanner heads, paths, or optical copies. This preserves ordered motion and energy while reducing volumetric work.

## Temporal history

The shutter samples already integrate scanner motion. Laser-only history is therefore limited to restrained sensor persistence and max-composited with the current laser layer rather than additively re-exposing a complete path. Atmosphere, source bloom, moving-head cones, washes, LEDs, strobes, blinders, CO2, final bloom, and final exposure response remain outside history.

History clears on initial mount, timing discontinuity, identity change, blackout, dark strobe phase, capture entry, quality change, scanner path topology edits, renderer/context lifecycle changes, and disposal.

## Regression coverage

CPU regressions cover circles, triangle/polygon perimeters, progressive waves, fan sweeps, blank retrace, low/high sample density, corner/point dwell, multiple heads, multiple physical apertures, optical copies, duplicate-path suppression, depth slicing, clipping safety, deterministic aggregation, aperture-energy stability, seek/loop reconstruction, history reset, and Canvas2D data preservation.

The browser visual review now rejects frames lit by only a handful of pixels and records connected versus isolated lit-pixel ratios. It also asserts zero duplicate laser inputs and scanner diagnostics for laser frames.

## Deferred to Patch 3

Patch 3 remains responsible for final linear-light laser color science, wavelength-aware spectral behavior, physically richer prism/diffraction energy distribution, and any additional optical-copy authoring or calibration. Dedicated nonlaser fixture renderers, scanner authoring UI, and full preset migration remain outside Patch 2.
