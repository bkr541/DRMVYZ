# LaserDMX WebGL Corrective Patch 3: Final Hardening

This document records the final corrective layer for the LaserDMX Show Director WebGL program. It covers professional fan density, deterministic beam-budget degradation, test-project boundaries, bounded WebGL recovery, context-loss handling, and the production validation workflow.

## Quality-dependent fan density

The global Show Director beam ceiling remains 300. Quality changes the maximum candidate density for a single source, not the global ceiling.

| Quality | Hero fan | Primary fan | Support fan | Texture fan | Decorative fan |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low | 8 | 8 | 6 | 4 | 4 |
| Medium | 12 | 12 | 8 | 6 | 6 |
| High | 16 | 16 | 10 | 8 | 8 |
| Ultra | 24 | 20 | 12 | 10 | 10 |
| Auto candidate ceiling | 16 | 16 | 10 | 8 | 8 |

Only laser sources recognized as coherent professional fan structures are expanded above their authored baseline. Eligible structures include fans, layered fans, parallel banks, sheets, tunnels, mirrored corridors, canopies, aperture bursts, and wide semantic hero banks. Moving heads, LED structures, washes, texture fixtures, and decorative sources retain lower limits.

Mirrored corridor and cage sources use a restrained per-source ceiling because their depth-layer multiplication already increases visual density. High and Auto cap these structures at 12 rays per source, and Ultra caps them at 16.

Ray placement remains deterministic. Candidate fans are generated symmetrically, and any partial allocation uses stable edge-and-center selection rather than deleting one side or taking a random prefix. WebGL and Canvas2D now use the same requested and allocated ray counts, so fallback does not reorder banks or change source identity.

Source aperture energy is normalized by active source energy. Higher ray counts receive only a bounded density lift, preventing a 24-ray source from multiplying exposure, bloom, or haze response linearly.

## Beam-budget degradation policy

Performance Shows provide a stable role for every active fixture:

1. `heroImpact`
2. `primaryArchitecture`
3. `secondaryFan`
4. `decorativeAccent`
5. `detailLattice`

The budget allocator fully services higher-priority groups before lower-priority groups. Within each role, deterministic round-robin allocation keeps mirrored and paired sources within one ray of each other. Under pressure, texture/detail rays disappear first, then decorative and support embellishment. Hero and primary geometry are reduced only after all lower-priority demand has been exhausted.

This policy preserves source identity, left/right balance, motif continuity, central apertures, protected corridors, and deterministic seek/loop reconstruction. It never drops a random subset from frame to frame.

## Validated Performance Shows

The final density and budget audit covers the twenty canonical Performance Shows. Dedicated visual scenarios additionally exercise:

- Prism Cathedral hero prism banks
- Cardinal Fan Reactor wide mirrored axis fans
- Cyan Mirror Cage corridor and tunnel structures
- Festival Front Beams layered festival fans
- High-quality 16-ray hero fans
- Ultra-quality 24-ray hero fans
- Auto quality under synthetic support and texture pressure

Quiet Intro, Breakdown, and Outro states continue to use their authored sparse composition. Density expansion follows fixture role, quality, and musical scene state rather than applying a blanket multiplier.

## Test-suite investigation and project boundaries

The audited snapshot did not contain a single post-suite leaked handle. The baseline complete Vitest command finished in roughly three minutes, but it failed for multiple concrete reasons that could be mistaken for a hang in a ten-minute external audit:

- A Deno `jsr:` edge-function test was collected by Vitest even though it requires Deno.
- Several expectations still described pre-corrective behavior.
- One final visual-validation test executed all twenty shows and 200 representative frames inside one five-second test case.
- Running the entire mixed Node and jsdom graph with an unconstrained or unsuitable worker layout caused heavy transform and collection pressure.

Corrections:

- `supabase/functions/**` is excluded from Vitest and has an explicit Deno command.
- The 200-frame validation is split into one test per show.
- Node and jsdom projects have explicit file ownership and setup. Node tests use bounded process forks; jsdom tests use bounded worker threads so browser-like timers and observers cannot strand a process pool.
- Native Electron bridge tests use Node's built-in test runner.
- Playwright owns browser/WebGL regression tests and does not overlap with Vitest discovery.
- E2E, native, edge, and generated artifact paths are excluded from the wrong runners.

Commands:

```bash
npm run test:node
npm run test:dom
npm run test:webgl
npm run test:electron
npm run test:edge
npm test
```

`test:edge` requires Deno. `test:webgl` requires Playwright Chromium and a WebGL2-capable environment. Linux CI may need Xvfb for the ANGLE/SwiftShader WebGL2 path.

The complete repository command remains `npm test`. The split commands are diagnostic and CI boundaries, not replacements that hide untested source areas.

### Reference validation snapshot

The final corrective validation on 2026-07-15 produced the following measured results:

| Command | Result | Duration |
| --- | --- | ---: |
| Baseline `npm test -- --reporter=verbose --logHeapUsage` | 303 files passed, 6 files failed; 4,889 tests passed, 5 failed | 181.80 s |
| Final `npm test` | 310 files passed; 4,921 tests passed; 0 failed; 0 skipped | 193.49 s |
| `npm run test:node` | 269 files; 4,675 tests passed | 107.88 s |
| `npm run test:dom` | 41 files; 246 tests passed | 78.36 s |
| Focused LaserDMX Vitest selection | 55 files; 1,560 tests passed | 28.08 s |
| `npm run test:webgl` | 1 Chromium test; 26 actual WebGL2 frames passed | 28.9 s Playwright, 32.22 s command wall time |
| `npm run test:electron` | 4 native bridge tests passed | 100 ms runner, 0.56 s command wall time |

The final complete run is 11.69 seconds longer than the failing baseline because it executes 27 additional tests and the new lifecycle, density, fallback-parity, and recovery coverage. The goal was reliable completion and correct project ownership rather than hiding work behind broad exclusions or inflated timeouts.

The longest final Vitest files by reported test execution time were:

1. `LaserDmxShowDirectorSectionEnergyArc.test.ts`: 7.186 s
2. `LaserDmxShowDirectorFinalVisualValidation.test.ts`: 6.772 s
3. `LaserDmxShowDirectorPerformanceShowcasePresets.test.ts`: 4.613 s
4. `structuralSegmentation.test.ts`: 4.455 s
5. `LaserDmxShowDirectorPerformanceFinalIntegration.test.ts`: 4.391 s

The WebGL run used Chromium WebGL2 through ANGLE with Vulkan SwiftShader. GPU timer queries were unavailable in that software environment, so GPU timing remains nullable and is reported only where the runtime supports it. The Deno edge command was defined but could not run in the validation container because Deno was not installed; it is not counted as a pass or skip.

## WebGL failure classification and retry

WebGL recovery state is runtime-only and tracks:

- failure code and user-safe reason
- transient or session-stable classification
- failure timestamp
- automatic retry count
- next retry time
- last successful initialization
- context-loss count
- final fallback reason

Session-stable failures do not automatically retry:

- WebGL2 unavailable
- shader compile/link failure
- repeated context loss
- explicit Canvas2D selection

Potentially transient failures receive bounded retry:

- context loss
- GPU resource allocation failure
- runtime render failure, including temporary lifecycle or GPU reset conditions

Automatic retry uses stepped cooldowns of 1 second, 3 seconds, and 8 seconds. After three failed automatic attempts, Canvas2D remains active and diagnostics report the final fallback reason. Retry is never attempted every frame.

A newly created runtime does not clear retry history immediately. Recovery is considered successful only after the runtime completes its first production render. This prevents a create-success/render-failure cycle from resetting the counter forever.

## Manual retry

Renderer Diagnostics exposes **Retry WebGL** only when a transient failure is retryable and the presentation mode is not Capture. The action:

1. disposes stale WebGL resources,
2. clears transient retry state,
3. requests a clean runtime recreation,
4. keeps Canvas2D visible during the attempt,
5. publishes the result through diagnostics,
6. leaves authored fixtures, programs, cues, and show state unchanged.

Permanent or session-stable capability failures do not present a misleading retry control.

## Context-loss behavior

The first recoverable `webglcontextlost` event keeps the runtime object available for browser restoration while Canvas2D renders the current evaluated frame. On `webglcontextrestored`, the runtime reconstructs shaders, buffers, HDR/LDR targets, depth slices, atmosphere targets, bloom buffers, exposure state, scanner-history targets, fixture textures, gobos, prism resources, and video-wall resources.

Temporal scanner history is cleared after restoration so stale laser trails cannot cross a GPU reset. Repeated context loss is bounded. The third loss in one renderer session is classified as repeated context loss and locks the session to Canvas2D until an explicit renderer reset or remount.

## Diagnostics

Outside Capture mode, Renderer Diagnostics reports:

- requested and active renderer
- WebGL and float-target capability
- requested and effective quality
- active and requested beam counts
- active fixture count
- CPU and GPU frame timing where supported
- atmosphere resolution, samples, and depth slices
- bloom and temporal-history cost indicators
- last WebGL failure
- failure classification
- retry count and next retry time
- context-loss count
- last successful initialization
- manual retry availability
- final fallback reason

Raw stack traces are not displayed in normal UI.

## Actual WebGL visual regression

Run:

```bash
npm run visual:show-director:webgl
```

The harness renders 26 deterministic Chromium/WebGL2 frames. Coverage includes Intro, Build, Drop 1, Breakdown, Drop 2, Outro, 16-ray High hero fans, 24-ray Ultra hero fans, budget degradation, Auto support-first reduction, mirrored corridor balance, laser-only history, continuous depth, foreground haze veiling, fixture-specific optics, manual retry simulation, automatic retry cooldown, permanent capability fallback, actual context loss/restoration, and clean Capture output.

Generated screenshots and JSON reports live under `artifacts/show-director-webgl-visual-review/` and remain ignored by Git. To update a baseline or threshold:

1. run the harness in a documented WebGL environment,
2. review every generated image and capability report,
3. confirm WebGL remained active and Capture contains no editor overlays,
4. update only the intended threshold or representative state,
5. rerun deterministic replay and context-loss coverage,
6. do not commit transient output unless an approved baseline is explicitly part of repository policy.

## Final renderer architecture

The final path is:

1. authored Show Director fixtures and Performance Program state,
2. deterministic Music Intelligence, Track Map, section, phrase, and occurrence resolution,
3. quality-aware role budgeting with a 300-beam hard ceiling,
4. one continuous engine-neutral scene with a locked front-center camera,
5. continuous depth segmentation and far-to-near transparent light compositing,
6. fixture-specific optical passes,
7. laser-only scanner history,
8. depth-aware atmosphere, CO2, and foreground veiling,
9. HDR accumulation, bloom, exposure, tone mapping, and restrained glare,
10. clean Live/Capture composition,
11. Canvas2D compatibility output using the same beam allocation,
12. bounded WebGL fallback and recovery diagnostics.

The renderer creates no visible room, audience, stage shell, floor, wall, ceiling, truss, or movable camera.
