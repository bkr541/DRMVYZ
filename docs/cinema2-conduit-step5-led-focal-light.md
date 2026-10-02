# CONDUIT step 5 — LED focal light

This step changes the emitters and their immediate housing, not the room's grade, bloom settings, floor material, camera, or wordmark geometry. Those remain in the separate step-6 review.

## Changes

- Narrowed the segment shader's light into a front-facing core. The core shifts toward warm white for the default amber Energy Color, while its edges keep the selected hue. Blue and other cooler selections shift toward neutral white rather than acquiring an amber center.
- Gave the four tube windows the strongest core, chamber bars a gentler one, and the logo perimeter very little whitening so its thin outline remains colored and does not flatten the white letters.
- Lifted the existing thin logo perimeter's emission without enlarging its geometry. The wall-climbing fade still limits where the light can appear.
- Darkened the recessed tube channels and unlit LED diffusers, reduced the broad resting point-light spill, and slightly reduced peak segment strength. The lights gain prominence against their own housing without adding another wall wash or boosting bloom.
- Extended the diagnostic capture harness with a no-audio, Master Intensity 1 Energy Flow state and an alternate blue Energy Color. The existing steady Pulse and full-energy drop captures remain available.

## Review boundary

Compare locked-camera 16:9 steady, no-audio Energy Flow, full-energy Pulse/drop, and alternate-color captures. Check all four tubes, the perimeter, and chamber bars for a visible colored path with bright cores and dark adjacent tracks. The floor is expected to remain too light until step 6, so it is not used as a step-5 acceptance criterion.

No GLB or SVG regeneration was needed: the existing rounded tube windows and recessed channels already provide the geometry needed for this treatment.

## Verification

- Locked-camera browser captures: [steady Pulse](../artifacts/cinema2-conduit-baseline/run-jERGjR/reference-16x9-high-steady-baseline.png), [quiet Energy Flow](../artifacts/cinema2-conduit-baseline/run-sdWvzo/reference-16x9-high-idle-baseline.png), [full-energy Pulse/drop](../artifacts/cinema2-conduit-baseline/run-rDOiko/reference-16x9-high-peak-baseline.png), and [blue Energy Color](../artifacts/cinema2-conduit-baseline/run-rDOiko/reference-16x9-high-steady-baseline-blue.png). These captures are git-ignored local diagnostics; regenerate them with `capture-conduit-baseline.mjs`. The quiet Energy Flow capture predates only the small perimeter-intensity lift, not the tube or chamber tuning.
- All four tube windows remain visibly colored in each state; the blue capture confirms the tube windows, logo perimeter, and chamber bars still change together. Lit windows remain separated by dark recessed channels, and the peak has a brighter center than the resting views.
- Focused tests: 44 passed across the Conduit preset, Three PBR bridge, and segment-lighting suites. Targeted lint and `npm run assets:check` passed. Repository-wide TypeScript still reports existing errors outside the changed files; no errors were reported for the step-5 files.
