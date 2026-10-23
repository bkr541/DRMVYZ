# BLOCKSHIFT — Larger cubes, illuminated atmosphere and varied rotation

2026-10-23. User-requested refinements before the final acceptance phase. Preset revision 15. Fifteen objects and both user GLBs remain; Phase 8 has not begun. Branch `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Work remains uncommitted, with no commit requested.

## Size that grows visibly

**Block Size now spans 1.05–6.00**, retaining the six-world-unit model multiplier and saved values. The new maximum has a 36-unit side, twice the old 18-unit maximum. Defaults remain 1.35.

The previous safety solver multiplied every cube's distance from the observer whenever any pair needed more clearance. Increasing size therefore pushed the entire field away, canceling much of the apparent size increase. Clearance now uses stable, near-first priority and moves only a conflicting cube outward along its own observer-relative ray. Foreground cubes retain their proximity; rear geometry cannot push the whole composition away. Spread remains a separate post-layout control.

Transformed AABB gaps stay at least 1.5 units, with the same 2.5-unit observer exclusion. To accommodate the doubled size ceiling, the finite field envelope grows from 300 to 600 units and camera far plane from 420 to 840. This changes rear capacity, not the observer's position, lens, float limits or automatic framing. Large peripheral crops are still intentional. Tests cover all six patterns, size/depth/spread extrema and full added rotations.

## Brighter LEDs and Threshold-style atmosphere

LED material emission is approximately doubled at the same authored Master Intensity and circuit level. The segmented diffuser, housing and core remain independently readable; source colors, musical circuit addressing and geometry choreography are preserved.

BLOCKSHIFT now reuses Threshold's **shared volumetric-atmosphere effect and shipped smoke volume**: scene color/depth → smoke/haze and colored shafts → HDR bloom. Screen-space shafts gather actual bright LED pixels, so illumination follows the visible bars, their colors, musical pulses and motion. Depth-aware haze stops at scene surfaces. No per-cube spotlights or duplicate fog engine were introduced.

**Effects > Scene > Atmosphere** is a boolean toggle, default ON. OFF bypasses the entire effect. Its mix also follows Master Intensity, so zero cannot leave fog light behind. Bloom remains independently editable, including zero. The atmosphere's own audio reactivity stays zero: it receives its musical illumination from the already-reactive LED source image, avoiding duplicate impact routes. The smoke volume and restrained ambient fill supply the surrounding haze; the source-driven shafts supply colored light. This is Threshold's established volumetric plus screen-space approach, not ray-traced emission from every LED cell.

## Rotate Cubes

**2026-10-23 speed refinement, preset revision 16:** The user requested faster rotation. Added cube spin is now **3× faster** on both axes, retaining each cube's distinct direction/rate. At 120 BPM, Motion Amount 0.55 and Motion Rate 1, primary-axis speeds are approximately **12–22 degrees/second**; the slowest cube reaches a quarter turn within eight seconds. Motion Amount/Rate, OFF hold, pause, resets and clearance still apply. The five focused refinement tests and scoped lint were rerun for this adjustment; the earlier browser recording below depicts the previous slower rate. No broad build/browser or unrelated baseline checks were repeated. This tuning remains uncommitted.

**Design > Motion > Rotate Cubes** is a boolean toggle, default OFF, placed before the existing Orbit Camera controls. ON adds independent signed primary and secondary axis rotations to all fifteen cubes. Rates vary by stable cube ID; existing Motion Rate and Motion Amount govern speed. It consumes the same shared performance-beat delta as pattern motion, with no new timer, clock or randomness.

OFF stops the additional spin and holds its attained orientation. Existing native pattern tilts/audio accents remain. Pause and Motion Amount zero hold the added rotation exactly; resume continues without catch-up. Seek, source/context changes and preset disposal clear transient angles. Turning the toggle on starts from the current added orientation without a reset jump. Rotation Range still governs the pre-existing pattern/audio tilts; the explicitly enabled new spin can make full turns. Final rotated geometry passes the same clearance/observer solver before upload. Rotation never changes authored Pattern, Pattern Change, Trigger, palette, size or spread.

## Validation and evidence

**67/67 focused tests PASS**, across Refinement, LED, Preset, Controls, Audio, Motion, Performance and HDR Bloom. New checks prove actual foreground size-to-distance growth, doubled size ceiling, extreme-size full-turn clearance, fifteen distinct signed rotation vectors, OFF/pause/master-zero holds, resets, Inspector placement, stock smoke identity, color/depth input wiring and atmosphere/master-disable bindings. Existing eleven-trigger/audio/manual-authority and Spread interval checks pass with the new solver.

**Focused ESLint PASS.** Scoped TypeScript: **zero changed-file diagnostics**, the same nine unrelated dependency diagnostics. Broad failing repository checks were not repeated. The first extrema check showed that the old 300-unit rear envelope was too small for doubled-size rotating objects; the explicit 600-unit bound and corresponding camera far plane now pass the expanded test.

**Fresh production build and browser acceptance PASS** on Chromium ANGLE Metal. Normal-app checks prove the 6.00 slider ceiling, Rotate Cubes placement/default/persistence, fifteen objects/four native batches, three aspect ratios and GPU disposal/re-entry. The dedicated canvas proves physical sizes 8.1/18/36 units, increasing foreground size-to-distance ratios (0.336/0.747/0.938), visible colored atmospheric illumination outside geometry, unchanged cube poses under atmosphere, exact dry-scene restoration at OFF, intensity-zero authority, fifteen different rotation vectors, opposing directions, OFF hold, pause/master-zero hold and source reset. Maximum-size rotating geometry with atmosphere ON stays healthy; no GL/module/effect/render-pass failures occurred.

The browser first caught out-of-range shared mist settings; these were corrected to the effect's supported limits and the focused test now checks the effect registry as well as manifest compilation. GPU size assertions use Float32 tolerance. Visual review shortened source-light shafts to 0.08 at strength 0.28 to avoid long streaks from segmented LEDs. The final production capture was reviewed again. `git diff --check` passes, and the working tree/source changes were reviewed for scope.

[Size/atmosphere/rotation comparison](evidence/size-atmosphere-rotation/refinement-comparison.png) · [Production motion recording](evidence/size-atmosphere-rotation/size-atmosphere-rotation.webm) · [Detailed acceptance](evidence/size-atmosphere-rotation/refinement-acceptance.json) · [Normal workspace and lifecycle results](evidence/size-atmosphere-rotation/acceptance.json) · [Rotate Cubes in the Inspector](evidence/size-atmosphere-rotation/production-inspector.png).

Functional audio playback uses deterministic upstream fixtures; real-track human approval and the full final acceptance/performance sweep remain outstanding. These changes were functionally validated, not reprofiled across every device/quality tier. **Requested refinements implemented for user review; STOP before Phase 8.** The preset remains BLOCKSHIFT (Preview).

Production changes: domain size/envelope limits; local layout clearance; new `Cinema2BlockshiftRotation.ts`; native rotation composition; brighter LED shader; manifest controls and shared atmosphere graph. Validation changes: new refinement tests/browser helper, updated size/effect assertions, test-fixture atmosphere isolation, browser runner and package command. Existing pure audio/geometry fixtures turn atmosphere OFF explicitly; dedicated atmosphere acceptance turns it ON. Normal application defaults keep atmosphere ON. The root creation contract's existing edits were preserved.

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --refine`.
