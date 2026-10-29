# Inertia — Phase Five bounded choreography

Date: 2026-10-29  
Status: this checkpoint was accepted by the user's instruction to complete the remaining implementation. See [the final implementation and acceptance report](cinema2-inertia.md) for completed Director, Auto Performance, finishing, and final technical checks. The report below records the Phase Five checkpoint.

## Result

Musical accents now have distinct force, follow-through, and recovery stages. Kicks expand the cage, then produce a smaller inward recoil. Snares/transients shear rows, then briefly move them in the opposing direction. Drops release build tension, recover through a small inward displacement, and resume the current shared build facts afterward. The core has a separate, shorter kick pulse.

Every stage is an authored shared Cinema 2.0 envelope targeting a resolved native property. There is no preset-local event detector, musical clock, spring accumulator, or hidden parameter replacement. Five continuous routes and four event rules now address fourteen channels; event rules contain nine finite envelopes in total.

## Envelope specification

All timings are seconds. Each event rule uses the canonical shared source, confidence >= 0.45, once-per-event delivery, replace composition on a runtime-only channel, and restart retrigger behavior. Repeated identical events remain deduplicated by the shared runtime. Replace composition prevents rapid events from accumulating unbounded force.

| Source / stage | Target | Attack | Hold | Release | Visible maximum before manual gains |
| --- | --- | --- | --- | --- | --- |
| Kick force | `kickDisplacement` | 0.015 | 0.025 | 0.160 | +0.035 world units radial |
| Kick core | `corePulse` | 0.015 | 0.010 | 0.180 | +3.5% core radius |
| Kick recovery | `kickRecovery` | 0.200 | 0 | 0.180 | -0.012 world units radial × recoil gain |
| Snare force | `shearAccent` | 0.010 | 0.015 | 0.180 | +0.025 world units shear |
| Snare recovery | `snareRecovery` | 0.205 | 0 | 0.160 | -0.009 world units shear × recoil gain |
| Transient force | `transientAccent` | 0.010 | 0.015 | 0.180 | Same shear domain as snare |
| Transient recovery | `transientRecovery` | 0.205 | 0 | 0.160 | Same recovery domain as snare |
| Drop force | `dropRelease` | 0.020 | 0.060 | 0.420 | +0.050 world units radial |
| Drop recovery | `dropRecovery` | 0.500 | 0 | 0.350 | -0.015 world units radial × recoil gain |

Resolved envelope gains pass through smoothstep (`x*x*(3-2*x)`) before visual composition, softening corners in the shared runtime's linear envelope. Recovery channels rise slowly while the initial force decays; they do not require a second event or delayed local timer. The force dominates the initial strike, recovery dominates the tail, and all finite channels reach zero afterward.

Recoil gain is `1 - 0.7 * Damping`: higher user Damping reduces overshoot without granting longer authority. Continuous route smoothing is now 180ms energy, 100ms bass, 70ms highs, 220ms vocals, and 220ms build. Shared upstream analysis remains unchanged.

## Composition and control authority

- Audio Response scales all musical contribution. Zero cancels force and recovery immediately; re-enabling cannot replay the old cue's tail.
- Cage radial/shear responses also multiply Motion Amount and Deformation. Core pulse multiplies Motion Amount independently. Motion Amount zero blocks recoil as well as initial force.
- Same-hit snare/transient force uses their maximum; recovery likewise uses its maximum. Neither stage adds duplicate force for one hit.
- During a drop, current build compression is multiplied by `1 - max(dropRelease, dropRecovery)` after envelope easing. This lets the authorized drop visibly release stored tension rather than fight it. Current shared build facts resume when the finite drop ends; no saved build value is mutated or locally latched.
- Combined radial displacement remains clamped to ±0.060 world units, then shares the established final geometric safety bound with native motion. Core pulse stays <= 3.5%; shear remains bounded by its authored maximum.
- Source validation, pause/resume fences, seek/loop resets, analysis/track identity handling, Pattern Change authority, manual reselection, and saved parameter ownership remain in force.
- Camera, palette, density, structural base sizes, and intensity remain user owned. No controls or Inspector typography were added or changed in this phase.

## Validation

Passed focused checks:

```sh
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaStatic.test.ts
npx tsc --noEmit --pretty false
node scripts/run-cinema2-inertia-choreography-browser.mjs
```

**30 tests passed:** the prior 24 geometry/motion/shared-audio tests plus six choreography tests. New coverage proves signed force/recovery and exact settlement, independent core timing, build/drop composition, Damping, coalesced snare/transient stages, immediate cancellation, and bounded rapid overlapping cues. At most nine event envelopes are active; there are no pending delayed events, and all envelopes clear after settlement. The final focused audio file was rerun after correcting a test sample at 200ms to 215ms: the core's authored endpoint is 205ms, so the original assertion sampled just before completion. Production code did not change during that correction.

The real runtime/registry/camera/renderer browser harness completed **13 rendered assertions across 15 deterministic trajectories**. It uses isolated anchor centroids and core bounds to measure direction and magnitude, and compares each cue against native output at the same time. Full hero captures retain the approved visual identity.

Measured examples at a 954px square viewport and the test's full response/geometry settings:

- Kick: approximately +13.19px mean anchor-radius change at strike, then -2.49px recoil.
- Drop: approximately +18.82px strike, then -3.00px recoil.
- Core: approximately +5px radius at strike, then exact baseline pixels at 215ms.
- Low/high Damping: approximately -4.61px/-1.34px recoil relative to their respective native baselines.
- Settled kick, snare, and drop output matches the native baseline exactly at tested checkpoints. Build restoration, Audio Response zero, re-enable fencing, and Motion Amount zero likewise produce the expected baseline pixels.

Targeted ESLint, type checking, and `git diff --check` passed. No unrelated broad suite or repeat real-soundtrack analysis was necessary: shared analysis/event definitions did not change. Existing event/lifecycle unit checks ran with the new envelopes.

The final browser execution used `--resume` to read the already validated unchanged neutral/kick/snare/drop captures and finish remaining trajectories after the test-only core endpoint correction. Reused captures are explicitly identified in the JSON trace. A normal invocation regenerates the entire evidence set; `--resume` requires that existing set.

## Review artifacts

All captures are local ignored files, reproducible with the runner above:

- [Rendered assertion report and envelope traces](../artifacts/inertia-phase5/report.json)
- Full sculpture: [kick force at 30ms](../artifacts/inertia-phase5/hero-kick-30ms.png), [recoil at 200ms](../artifacts/inertia-phase5/hero-kick-200ms.png), [settled at 400ms](../artifacts/inertia-phase5/hero-kick-400ms.png)
- Isolated cage anchors: [kick force](../artifacts/inertia-phase5/kick-30ms.png), [kick recoil](../artifacts/inertia-phase5/kick-200ms.png)
- Core: [pulse](../artifacts/inertia-phase5/core-kick-20ms.png), [settled](../artifacts/inertia-phase5/core-kick-215ms.png)
- Build/drop: [release](../artifacts/inertia-phase5/build-drop-40ms.png), [recovery](../artifacts/inertia-phase5/build-drop-520ms.png), [current build restored](../artifacts/inertia-phase5/build-drop-900ms.png)

The author inspected the full sculpture force/recoil captures for preserved core readability, ordered cage structure, monochrome hierarchy, and restrained movement. Human approval of this checkpoint remains pending; pixel metrics establish behavior but do not alone establish musical quality.

## Handoff

Phase Five is implemented and validated. Phase Six will add broad Director meaning within these same bounds; it has not begun. No Auto Performance, pattern substitutions, camera choreography, or finishing effects were added. The preset has not been promoted to keeper.

No commit was requested or created. The accumulated Inertia implementation, tests, harnesses, and documentation remain uncommitted. Shared runtime behavior is unchanged by this phase.
