# 28. Phase 8 — Production acceptance

**Subsequent checkpoint:** The [Phase 9 review](29_P9_RELEASE_SIGNOFF_REPORT.md) records explicit user visual/behavior approval. Release validation blockers remain open. The status below is the original Phase 8 checkpoint.

**2026-10-23 · BLOCKSHIFT revision 17 · automated functional acceptance PASS.** Human visual review is pending; Gate P8 is not signed off and Phase 9 has not started. BLOCKSHIFT remains a reference preset named **BLOCKSHIFT (Preview)**. All work is uncommitted on `main`, based on `9c2aa74831103c1589e589c8cedc5af5f94f1643` plus the existing implementation changes. No release, promotion or commit was requested or performed.

This run covers the current user-approved field: fourteen Hallow Cubes plus one Impossible Cube, supplied GLBs, Size up to 6.00, Spread up to 3.00, segmented LED bars, shared Threshold atmosphere, faster varied cube rotations and additive float/orbit camera. Fifteen persistent GPU instances surround an inside observer; rear objects and peripheral crops are intentional. Earlier nine-object, outside-camera and noncropping criteria are superseded.

[Current visual comparison](evidence/p8-acceptance/phase8-visual-review.png) · [six normalized pattern filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png) · [production Inspector](evidence/p8-acceptance/production-inspector.png) · [complete browser report](evidence/p8-acceptance/acceptance.json).

## Fixes found by acceptance

**Idle Pattern selection:** The real runtime supplies zero animation delta without a playing source. The earlier test supplied a nonzero delta, hiding a stalled transition in the normal empty-track workspace. BLOCKSHIFT now derives only the idle manual transition delta from the runtime's existing frame timestamps. Native pattern phase, audio and added spin remain stopped; pause/Motion Amount zero still hold. The focused test now supplies the actual zero-delta idle condition, and all six chooser-driven manual formations visibly change. Preset revision advances from 16 to 17.

**Context-loss event timing:** WebGL can become lost before the browser delivers `webglcontextlost`. A queued runtime frame in that gap attempted framebuffer allocation and reported `FRAMEBUFFER_UNSUPPORTED`, followed by two safely skipped dependent passes. The runtime now checks `gl.isContextLost()` before executing that frame. The normal context event handlers, restoration draw and single RAF owner remain intact. A new runtime test exercises the exact event gap. Three successive wet recovery cycles and three successive dry recoveries now pass; dry recovery restores exact pixels and authored values. [wet recovery](evidence/p8-acceptance/wet-context-diagnostics.json) · [dry recovery](evidence/p8-acceptance/context-recovery-diagnostics.json).

The acceptance helpers also use the current Size/Spread ceilings, an adequately contrasting accent test color, and palette assertions that account for Block Body coloring LED housings. Palette roles have distinct visible consumers; edge/body masks legitimately overlap at housings. GPU statistics now include only queries completed during the measured mode, avoiding stale last-known values.

## Production evidence

The browser builds the real `VyzualzView` entry with Vite, enters through the normal first-party chooser, and tests the actual Inspector and production output canvas. Controlled transport/audio checks use the production catalog/runtime, shipped GLBs, shared AudioFeatureBus bridge, Director, choreography, beat clock, camera, atmosphere and bloom. Synthetic upstream fixtures are explicitly identified; these are not claims of real-file analysis or audio-player loop integration.

| Coverage | Result and evidence |
|---|---|
| V01 static field | Exact stationary pixels at three aspects; fifteen uploaded identities, surrounding positions and four native batches in [workspace report](evidence/p8-acceptance/acceptance.json). |
| V02 six formations | Actual Inspector selections and visibly distinct static output; [Stack](evidence/p8-acceptance/pattern-stack.png), [Orbit](evidence/p8-acceptance/pattern-orbit.png), [Stagger](evidence/p8-acceptance/pattern-stagger.png), [Split](evidence/p8-acceptance/pattern-split.png), [Wave](evidence/p8-acceptance/pattern-wave.png), [Collapse](evidence/p8-acceptance/pattern-collapse.png). |
| V03 four phases each | All six patterns captured at normalized 0/.25/.5/.75, checking changing finite GPU poses and physical pixels; [filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png). |
| V04 transitions | Stack→Orbit and Split→Collapse beginning/middle/end; all four transition durations have distinct intermediate poses. [Motion report](evidence/p8-acceptance/motion-acceptance.json), [duration and phase report](evidence/p8-acceptance/phase8-acceptance.json). |
| V05 controls | Five static numeric ranges through the Inspector, six temporal ranges compared at equal transport time, camera FOV/Bloom extremes, six Pattern values, all four Transition Length values and three Quality modes. Conditional controls and re-entry persistence checked. [Workspace](evidence/p8-acceptance/acceptance.json), [temporal controls](evidence/p8-acceptance/phase8-acceptance.json), [finishing](evidence/p8-acceptance/polish-acceptance.json). |
| V06 palettes | Five diagnostic colors independently affect actual output, including the deeper Impossible Cube accent. [Five-color capture](evidence/p8-acceptance/palette-five-independent-colors.png); pixel counts and overlaps in the workspace report. |
| V07 hard disables | Motion/audio/camera/atmosphere/Bloom/intensity authority under audio/Auto, including exact dry bypass and held added rotation. [Refinement](evidence/p8-acceptance/refinement-acceptance.json), [LED](evidence/p8-acceptance/led-acceptance.json), [Auto](evidence/p8-acceptance/performance-acceptance.json). |
| V08 continuous audio | Silence/verse/bass/mids/highs/vocals have actual output contrasts. [Audio report](evidence/p8-acceptance/audio-acceptance.json). |
| V09 event audio/LED | Kick/snare distinct spatial and circuit signatures; downbeat/bar/phrase/section/build/drop consumers, decay and audio-zero steady LEDs. [LED report](evidence/p8-acceptance/led-acceptance.json). |
| V10 eleven triggers | All exact shared choices tested OFF/ON with GPU/pixel contrasts; identical publications do not double-advance any choice. [Audio](evidence/p8-acceptance/audio-acceptance.json), [duplicate matrix](evidence/p8-acceptance/phase8-acceptance.json). |
| V11 manual authority | Manual Pattern remains authored while Pattern Change stays ON; replay cannot steal control, and a later fresh event can perform. Browser checks plus the focused authority tests. |
| V12 build/drop Auto | OFF/ON peaks, restoration to the moving base, manual takeover/cooldown, later independent cue, no saved control/hue mutation. [Auto report](evidence/p8-acceptance/performance-acceptance.json). |
| V13 transport | Play/pause/resume, seek forward/back, backward jump representing loop boundary, track identity swap, preset re-entry and local/host BPM Sync. [Transport](evidence/p8-acceptance/phase8-acceptance.json), [timing](evidence/p8-acceptance/timing-acceptance.json), [orbit](evidence/p8-acceptance/orbit-acceptance.json). |
| V14 aspects/resize | Six patterns × landscape/square/portrait, Bloom off/default contrasts, FOV 60/85/100 and live wet resize. [Aspect matrix](evidence/p8-acceptance/polish-acceptance.json). |
| V15 performance/lifecycle | Three chooser exit/re-entry cycles, three runtime recreations, bounded GPU handles, no steady-state GPU-object allocation, dry and wet context interruption. Current hardware observations below. |

Depth, Backstreet and Afterhours each activate through the real chooser and produce nonblank running output. Their manifests/modules are unchanged by this phase; targeted unit regressions also pass. This is a runtime smoke/regression claim, not a pixel-identical historical A/B comparison. [Depth](evidence/p8-acceptance/neighbor-depth.png) · [Backstreet](evidence/p8-acceptance/neighbor-backstreet.png) · [Afterhours](evidence/p8-acceptance/neighbor-afterhours.png).

Recordings: [patterns/transport](evidence/p8-acceptance/phase8-pattern-transport.webm), [size/atmosphere/current faster rotation](evidence/p8-acceptance/size-atmosphere-rotation.webm), [LED circuits](evidence/p8-acceptance/led-bars.webm), [audio](evidence/p8-acceptance/phase5-audio.webm), [Auto build/drop](evidence/p8-acceptance/phase6-performance.webm), [float/orbit](evidence/p8-acceptance/orbit-camera.webm), [motion/transitions](evidence/p8-acceptance/phase4-motion.webm), [aspects/finishing/recovery](evidence/p8-acceptance/phase7-polish.webm). Fixture recordings use controlled transport time and are not real-time musical-performance approval.

## Validation and baseline separation

- **66/66 BLOCKSHIFT tests PASS** after the idle-transition fix, across seven files. [Focused log](evidence/p8-acceptance/focused.log).
- **101/101 shared/neighboring tests PASS** on the final runtime change: Runtime 16; seven other files 85, covering render graph, resources, production lifecycle, Depth, Backstreet and Afterhours preset/pattern behavior. [Runtime](evidence/p8-acceptance/runtime.log), [shared/neighboring](evidence/p8-acceptance/shared-runtime.log).
- **Full P8 production browser matrix PASS**, Chromium 149.0.7827.55 / ANGLE Metal / Apple M3 Pro, macOS arm64, Node 22.23.3. Actual Vite production bundling passed; output has existing chunk-size warnings. [Browser log](evidence/p8-acceptance/browser.log).
- **Focused ESLint PASS** for the changed source, fixtures and acceptance scripts. [Lint log](evidence/p8-acceptance/lint.log). `git diff --check` passes; source/diff reviewed for scope.
- **Scoped TypeScript: zero changed-file diagnostics**, with nine diagnostics in the imported dependency graph. These include the existing asset/environment attribution typing, Constellation/Event Horizon choreography source paths and audio diagnostics typing. This is not a whole-repository typecheck PASS. [Types](evidence/p8-acceptance/types.log).
- The initial broad Cinema2 sweep found **1,316 passing / 24 failing assertions across 127 files**. All 24 failing assertion identities reproduce against archived base source. The direct invocation ran InspectorPanel under Node; using the repository DOM config makes seven of those pass, with the same remaining assertion failing in both base and current. The remaining **17 failures are preexisting**, including the Afterhours mock-renderer checks and Conduit's shipped-asset budget. [Comparison](evidence/p8-acceptance/baseline-comparison.json), [current initial suite](evidence/p8-acceptance/regressions.log), [base](evidence/p8-acceptance/baseline.log), [correct DOM current](evidence/p8-acceptance/inspector-dom.log), [correct DOM base](evidence/p8-acceptance/baseline-inspector-dom.log).

The already failing repository-wide `npm run typecheck` and its dependent `npm run build` were not repeated, per AGENTS.md. The [P0 audit](12_P0_CURRENT_SOURCE_AUDIT.md) records that broader baseline. Successful Vite bundling and scoped typechecking do not clear that release blocker. After the context guard, affected runtime/neighbor tests and the production matrix were rerun; the unrelated failing broad suite was not repeated.

## Current hardware observations

1920×1080, DPR 1, atmosphere ON, Bloom 0.30, Rotate Cubes/float/orbit ON, synthetic bass. Each mode uses 60 RAF observations with the first ten discarded. Values include browser/instrumentation overhead and are local observations, not universal FPS guarantees.

| Mode | CPU median / p95 | Probe-tracked allocations |
|---|---|---|
| Quality | 10.8 / 11.9 ms | 57,356,280 bytes |
| Balanced | 7.6 / 12.0 ms | 42,417,488 bytes |
| Performance | 6.2 / 7.1 ms | 31,550,840 bytes |

The native module reports **722,040 GPU bytes**, fifteen objects and four instanced draws. No per-frame GPU-object allocations were observed, and repeated entry/recreation is bounded. Allocation totals are estimates from intercepted buffers/2D textures/renderbuffers, not complete driver memory accounting.

The GPU timer extension is present, but **zero fresh query results completed during these measurement windows**. GPU percentiles are explicitly `null`; the engine's cached last-known timing is excluded. No current GPU-time percentile or cross-device performance claim is made. [Raw profiling and recovery report](evidence/p8-acceptance/polish-acceptance.json).

## Handoff and remaining gate

The agent inspected the actual contact sheet and six-pattern filmstrips for geometry readability, intended immersive cropping, varying poses and atmospheric spill. This is not human approval. The authoritative root creation contract §20 states: **“Every new or ported first-party preset must receive a human visual review against its reference.”** Review scale, movement speed/quality, camera behavior, LED brightness/light spill, musicality and build/drop behavior using the captures and application with a real track.

**P8 automated functional work is complete; mandatory human review remains open.** Repository baseline type/test failures and unavailable fresh GPU timing are recorded limitations. The preset remains Preview and no Phase 9 release sign-off has been performed. The existing user edits to the root creation contract were preserved.

Reproduce with Node 22: `npm run test:e2e:cinema2-blockshift:p8`. `--reuse-build` is for an unchanged production bundle; rebuild after source/fixture changes. `--resume-p8` can reuse completed matrix reports only when newer than that bundle and their helper source. `--only=context` or another named matrix isolates a failing check. Raw build output stays in ignored `artifacts/blockshift/p8-acceptance`; review media, reports and validation logs are retained under this report's evidence directory.
