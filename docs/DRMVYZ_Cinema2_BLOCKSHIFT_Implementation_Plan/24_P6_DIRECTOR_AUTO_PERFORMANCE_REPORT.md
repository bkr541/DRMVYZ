# BLOCKSHIFT Phase 6 — Visual Director and Auto Performance

2026-10-22. Preset revision 12; fifteen-object field, user GLBs and additive orbit camera retained. Phase 6 only: Phase 7 camera polish/effects/performance work has not begun.

## User-visible result

**Auto Performance** is available in **Master Controls**, default **OFF**. With it ON, fresh shared build events compress the performing field toward Collapse tension; fresh shared drops add a Split-like outward release. These are temporary offsets around the currently moving native pattern. The saved Pattern, Pattern Change, Trigger, geometry and palette values are never changed by automation. Ordinary shared audio reactions remain available with Auto Performance OFF.

The shared Visual Director now scales existing audio movement and frame emission. It creates no independent movement or musical events. Transform gain is `min(1.25, 1 + 0.10×intensity + 0.05×build + 0.10×impact)`; emission gain is at most 1.12× and final emission stays below the authored Master Intensity ceiling. Audio Reactivity scales both contributions.

## Bounds and ownership

- Build: peak weight 0.25, maximum four performance beats. Drop: peak 0.35, maximum two beats. Both use quarter-beat smooth attack/release. Drop replaces a simultaneous/active build; build cannot replace an active drop.
- Translation is additionally capped per object at the smaller of two world units and 22% of its size. Rotation is a small bank-dependent bias inside the authored Rotation Range. Combined audio and macro output passes the existing clearance, observer exclusion and finite-volume constraints; bounded attenuation applies if necessary.
- Pattern, Block Size, Spread, Depth or Rotation Range edits cancel an active macro on the same engine frame. Pattern takeover snaps to the requested native formation during an overlay. A two-performance-beat cooldown consumes coincident and intervening cues. A held old event stays suppressed after cooldown; only a later independent event can start a new macro.
- Underlying Pattern Change and native phase continue throughout the overlay. Expiry reveals their **current** pose; no saved old pose or persisted parameter is restored.
- Auto OFF and Audio Reactivity zero remove the macro immediately. Pause and Motion Amount zero hold its existing physical pose and consume incoming cues. Resume does not replay queued events. Source/discontinuity resets clear transient state. Camera Motion OFF, Bloom zero and Master Intensity zero remain authoritative.

The existing performance beat clock supplies durations/cooldown. No additional clock, detector, section classifier, camera choreography, palette mode or effect is added. Persistent Director build context alone cannot launch Auto Performance.

## Implementation

Production files: `Cinema2BlockshiftPerformance.ts` owns transient envelope/authority state; the native module composes it with the current orchestration pose and existing audio safety evaluation. `Cinema2BlockshiftAudio.ts` applies bounded Director gain to its existing channels. `Cinema2BlockshiftChoreography.ts` adds three shared Director continuous routes and a shared build-edge cue (threshold 0.6 on the shared build signal). Total: eight audio routes, three Director routes and nine musical cues. The manifest exposes Auto Performance, declares the optional Director capability and retains reference-preview status.

Validation files: the new focused performance test, expanded audio integration tests, updated Inspector/preset assertions, coherent synthetic fixture rhythm progression, and `cinema2-blockshift-performance.mjs` via the `--p6` browser runner. Browser status exposes persisted authored state and the shared Director frame solely for test observation.

## Validation and handoff

- **56/56 focused tests PASS** across Performance, Audio, Controls, Motion and Preset. Includes the actual shared bridge/choreography/native module, all eleven canonical Pattern Change triggers, same-frame manual priority, evolving underlying Pattern, cooldown, stale events, resets, Director cap, zero controls and combined geometry safety across six patterns/extreme geometry.
- **Focused ESLint PASS.** Scoped TypeScript: **zero changed-file diagnostics**, nine unchanged unrelated dependency diagnostics. Broad repository checks were not repeated.
- **Fresh production build and browser acceptance PASS.** Normal-app Auto Performance availability/default, camera-control persistence, fifteen instances/four draw batches, wide/square/portrait captures and GPU exit/re-entry lifecycle passed. The shared production runtime/GLB canvas shows different native GPU transforms and pixels for Auto OFF/ON build and drop, identical current-base output after expiry, persisted controls and hues preserved, manual takeover/cooldown, later fresh drop, exact pause/zero-motion hold, Audio Reactivity zero removal and Master Intensity zero. No runtime or choreography errors occurred.
- Reviewed real build/drop comparison captures and working-tree/source changes; `git diff --check` passed. The geometry test was expanded to include minimum Block Size 1.05 as well as default/maximum; all five Performance tests passed again. Only that affected test was repeated.

[Canvas comparison](evidence/p6-performance/phase6-comparison.png) · [Motion recording](evidence/p6-performance/phase6-performance.webm) · [Performance acceptance](evidence/p6-performance/performance-acceptance.json) · [Workspace/GL lifecycle results](evidence/p6-performance/acceptance.json) · [Inspector](evidence/p6-performance/production-inspector.png) · [Focused test log](evidence/p6-performance/focused-tests.log).

Browser evidence uses the actual production catalog, shared bridge/Director/choreography, native module and renderer, with synthetic upstream AudioFeatureBus profiles and a controlled host clock. It proves deterministic routing/authority/rendering; it does not replace listening/visual review with a real track. Chromium ANGLE SwiftShader was used, so no hardware frame-time/performance claim is made. The first browser attempt exposed a test tab-click blocked by its fullscreen capture overlay; the test was corrected and acceptance resumed with the same production build. No production workaround was added.

**Gate P6: PASS for implemented phase and user review. STOP at this checkpoint; Phase 7 is not authorized by this implementation.** The preset remains **BLOCKSHIFT (Preview)**, with no keeper/release promotion.

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --p6` and the five focused `Cinema2Blockshift{Performance,Audio,Controls,Motion,Preset}.test.ts` files in Vitest.

Branch: `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Changes are uncommitted; no commit was requested. The root creation contract's existing user edits were preserved. Human visual approval and final keeper/release acceptance remain outstanding.
