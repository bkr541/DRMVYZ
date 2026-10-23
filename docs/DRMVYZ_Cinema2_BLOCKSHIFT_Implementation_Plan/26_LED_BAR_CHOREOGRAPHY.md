# BLOCKSHIFT — Physical LED bar surfaces and shared choreography

2026-10-22. User-directed visual/behavior revision after Phase 7. Preset revision 14. This change does not begin Phase 8 or promote the preview to keeper/release.

## Visible result and geometry

The colored frames of both supplied GLBs now render as LED bars: dark housings surround segmented emissive diffusers with brighter cores. The light is self-emissive on each bar face, independent of the scene's directional shading. Bloom adds a halo; the LED construction remains visible with Bloom zero. The dark cube bodies retain their existing shading and geometry.

Original GLB triangles, transformed positions, normals, object identities, scale, spacing and camera are preserved. Frame faces are charted along their actual longest axis, with the transverse coordinate defining housing/diffuser width. Face vertices are expanded only to isolate per-face bar coordinates; no silhouette is displaced or replacement cube/model imported. Each cube has twelve logical axis/sign circuits. These circuits also group the Impossible Cube's internal frame pieces; they do not claim that its complex mesh consists of only twelve physical struts. Diffusers have 24 repeated cells per normalized bar length, with derivative-based filtering for distant edges.

The fifteen cubes retain stable IDs and four instanced material batches. The former reserved packed float now carries the original cube index, so the fourteen-cube batch and separate Impossible Cube retain their correct LED addresses. A fixed 720-float uniform record supplies 180 circuits (level, chase head, occupancy, transient core accent). There are two additional static bar-coordinate buffers, no per-bar draw calls, lights, dynamic geometry allocation or additional renderer. Native GPU geometry storage is **722,040 bytes**, below the revised 1 MiB module budget. Earlier P7 timing/memory numbers describe revision 13 and must not be presented as this new shader's performance profile.

## Standard shared Audio Intelligence and geometry choreography

The existing eight continuous audio mappings, three Director mappings and nine shared cue rules remain the source of musical facts. No duplicate analysis, detector, event scheduler or musical clock was added. LED choreography consumes the same native pattern, phase, held audio channels/envelopes and bounded Director gain that already govern cube motion. The original physical geometry reactions and all eleven canonical Pattern Change triggers remain intact.

| Shared input | LED behavior |
|---|---|
| Energy, sub, bass | Circuit level and lit occupancy; geometry-aware traveling/chase selection |
| Mids | Occupancy/selection emphasis alongside the existing bounded physical tilt |
| Highs / spectral flux | Core glints and per-circuit accents |
| Vocals | Restrains agitation, emphasizes the Impossible Cube's center LED circuits |
| Kick | Longitudinal circuits on alternating cubes |
| Snare | Cross circuits on the opposing cube bank |
| Downbeat | Larger axis-weighted accent |
| Bar / phrase | Bank sweep and phase-offset emphasis |
| Section | Center-led response and bounded distributed accent |
| Build | Reduced occupancy/tension alongside existing build geometry; Auto adds its temporary bounded bias |
| Drop | Wider lit release and transient core accent alongside existing outward geometry |
| Visual Director | Existing significance gain, capped at 1.25× before final circuit values are clamped |

The selected pattern also defines a native LED program: **Stack** climbs rows/axes; **Orbit** travels around perimeter circuits; **Stagger** alternates neighboring cube/bar selections; **Split** opposes banks; **Wave** travels through cube/circuit order; **Collapse** folds emphasis inward. All use the existing shared-clock phase and Motion Rate; every cycle is periodic at the existing phase wrap.

## Ownership and disables

All circuit records are bounded to 0–1. Authored edge colors still define each bank's light, with a physically bright core; a black authored edge color also extinguishes its core. The five palette roles and existing Inspector controls remain independent. Master Intensity multiplies the final housing/light output and zero extinguishes it, even at maximum Bloom. Audio Reactivity zero gives a steady, fully occupied LED fixture with no music chase/accent. Silence alone creates no musical flashes. Pause and Motion Amount zero hold existing LED and cube choreography; manual Pattern edits still take effect while held. Source changes reset through the same native audio/controller lifecycle. Auto Performance remains default OFF and cannot write saved settings or re-enable camera/Bloom.

## Validation and evidence

**61 unique focused tests PASS** across LED, Preset, Audio, Performance, Controls and Motion. The initial six-file run passed 60 tests and exposed an overly strict assertion expecting three levels from the intentionally two-bank Stagger/Split programs; the assertion now requires multiple levels and all four LED tests passed again. Tests cover lossless triangle charting, stable 180-circuit addressing, six distinct programs, independent kick/snare groups, structural cues, zero reactivity, bounded maximum inputs/Director/Auto, renderer buffer/uniform/disposal and the unchanged shared event/manual-authority suite.

**Focused ESLint PASS.** Scoped TypeScript reports **zero changed-file diagnostics**, with the same nine unrelated dependency errors. **Fresh production build and browser acceptance PASS** on Chromium ANGLE Metal: normal catalog/Inspector, fifteen objects/four batches, wide/square/portrait output, saved camera controls and preset disposal/re-entry. The focused LED canvas additionally verifies actual 720-float GPU circuit records and visible pixels for twelve synthetic continuous/rhythm/structural profiles, six distinct patterns, pause, master-motion freeze, steady audio-zero LEDs, master-intensity zero and source reset. No shader, GL, module or choreography failures occurred. Captures were visually reviewed, and working-tree/source review plus `git diff --check` passed.

[Steady and reactive LED comparison](evidence/led-bars/led-comparison.png) · [Actual LED motion recording](evidence/led-bars/led-bars.webm) · [LED acceptance](evidence/led-bars/led-acceptance.json) · [Normal-workspace/lifecycle acceptance](evidence/led-bars/acceptance.json) · [No-bloom LED construction](evidence/led-bars/led-idle-bloom-off.png).

The browser uses production runtime/rendering and explicit synthetic upstream AudioFeatureBus publications, not a private renderer or detector. Real-track listening/visual approval and the full Phase 8 regression/performance matrix remain pending.

Production files: new `Cinema2BlockshiftLeds.ts`; model baker, renderer, native module, packed layout and audio snapshot; preset revision/capability description. Validation: new LED tests/browser helper, updated native geometry assertions, runner `--leds` and package command. No generic Inspector, shared camera, Audio Intelligence bridge or Director implementation was changed. No new controls were needed: existing Palette, Audio Reactivity, Motion Amount/Rate, Pattern and master intensity govern the new surfaces.

Branch `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Changes remain uncommitted; no commit was requested. **Implemented for user review; STOP before Phase 8.** The root creation contract's existing edits were preserved. Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --leds`.
