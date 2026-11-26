# SYS-06: Cinema 2.0 production WebGL release acceptance

## Scope and evidence

This extends the existing SYS-04 production `Cinema2QualityReviewHarness` and its pixel analysis rather than adding a second renderer. The actual `Cinema2Runtime` compiles the registered first-party manifest, drives the real native module/render graph and consumes a deterministic upstream 120 BPM Music Intelligence publication through the shared bridge. No artistic default, preset ID, shader, parameter, Inspector, engine or catalog thumbnail is changed. The existing SPE-01, SYS-03, SYS-04 and SYS-05 work is present in the input. Existing dedicated preset and shader tests remain complementary.

The original Review 01 DOCX and video were not supplied. The matrix intentionally covers a **19-preset source-derived superset**, not an asserted exact transcription of the sixteen reviewed presets: Colossus, Exoskeleton, Seraph, Paradox, Relic, Monolith, Honey (SYS-04); Spectrum, Corridor, Everywhere, Fracture, Refraction, Mosaic, Overdrive (SYS-05); HUD, Purity, Livewire, Wireframe Portal and Allstar (SYS-03 and named browser/re-entry anchors). Wireframe Portal uses its actual `crate-wireframe-portal` ID. Confirm the original inventory before final release sign-off.

## Commands

```sh
npm ci
npm run playwright:install
npm run test:cinema2:release-policy
npm run test:e2e:cinema2-release
# Targeted development run (not full inventory acceptance):
npm run test:e2e:cinema2-release -- --presets spectrum,honey
# Candidate compared against a previous matching complete run:
npm run test:e2e:cinema2-release -- --baseline /path/to/baseline/manifest.json
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an existing compatible browser. Run the same harness revision on both baseline and candidate source, on the same machine/browser/GPU, with clean local browser storage. The command saves an aggregate manifest and per-preset JSON and numbered/named PNGs in a fresh ignored `artifacts/cinema2-release/run-*` directory. Keep both directories; compare frame hashes and paired actual images. The performance comparison rejects mismatched settings, environment, inventory and missing/failed evidence. The conservative CPU callback p95 and estimated allocation tripwires are not GPU throughput or VRAM measurements; verify real hardware frame pacing separately. `--presets` is a diagnostic subset only. Missing packages/WebGL and preset initialization failures are explicitly recorded, not silently skipped; the process exits nonzero. Full matrix runs in CI on manual dispatch; small policy tests run in regular CI.

## Capture and decision policy

- Default/no-media reference must show spatially distinguishable output. SPECTRUM additionally uses the existing arena light-distribution criterion. All captures store 3x3 zone occupancy/chroma, spatial variation, dimensions and hashes. Dark transition/pattern frames are allowed, but the default and at least one sustained performance checkpoint must be visible. A bright background is not proof of hero geometry; inspect the actual subject against SYS-04's scene-specific rubric.
- Manual mode uses authored controls, not injected target values. The palette and one unconditional Design slider receive an A/A drift reference and changed values; an ignored edit or change below the noise floor fails the policy. The actual PNGs and saved values are retained. BPM Sync toggle reaches transport. The complete authored Pattern list is captured through build/drop/hold; module-reported base/active patterns are checked where exposed. Pattern Change remains enabled through manual takeover and subsequent fresh drop. Camera OFF/ON poses, Auto Performance build/drop/breakdown, pause clock, backward seek, reset and two switch/re-entry cycles are recorded. Pattern geometry, BPM timing differentiation and Auto/Inspector authority require further subject-specific checks; passing this matrix is not proof of every contract control/enum or Inspector lock.
- Synthetic RGB quadrant media is loaded via the real slot service; removal checks zero ready textures and captures fallback. A generated donut GLB is loaded through the actual pinned model resolver, cache, slot and renderer; only account/repository boundary is stubbed locally, using no account or private asset. Imported textured models, media pools, video playback, source UI and color fidelity require the existing dedicated tests or additional actual-app checks. No unsupported slot is counted as exercised.
- Render/GL diagnostics, runtime phase, module readiness, saved value mutations and disposal counters are checked. Re-entry recreates the runtime on the same canvas, checks retired leases/estimated bytes and saved state. Capture portrait resize and medium-quality landscape. If `WEBGL_lose_context` is supported, force loss/restoration and capture recovered output; unsupported recovery is explicitly incomplete. Browser callback times and engine-estimated resource counts are retained. No visual approval is inferred from these metrics.
- Human visual approval is mandatory and remains pending; use SYS-04 `compare` and `publish-thumbnail` only after matched captures, actual review and approval. Never refresh thumbnails simply because a technical test passes. In actual Electron verify preview, fullscreen and each supported casting path, including pause/seek, aspect, model/media and a sustained drop; record OS/GPU, receiver, output, evidence, reviewer and decision. Browser matrix cannot validate these routes. Release sign-off requires all mandatory gates, not merely zero exit from the browser command.

## Verification of this patch

On the supplied archive, Node policy tests (five new plus four existing) pass, including blank/flat and ignored-control negative cases. `npm ci --offline --ignore-scripts --no-audit` failed with ENOTCACHED (zustand); registry DNS resolution was unavailable. `npm run typecheck` and `npm run build` stopped with TS2688 (`vite/client` missing). Targeted Vitest could not execute without dependencies. The new browser runner was invoked and wrote an aggregate manifest marking all nineteen presets not-run (missing `@playwright/test`), exiting nonzero. Existing baseline browser review is likewise dependency-blocked. No before/after rendered captures, GPU timings, context recovery, Electron preview/fullscreen/cast, model/media fidelity or human visual approval are claimed. No thumbnail change is justified. Run the above commands on the development machine and resolve any actual failures before release.

## QA-01 follow-up: evidence assertions (report schema 2)

The earlier capture-only `pattern-motion`, `media-pixel-evidence` and `context-restored` successes have been replaced. `required` lists the expected checks (including manifest-derived patterns and controls), `missingChecks` exposes absent observations, and each `scenario:*` summarizes its actual child assertions. Frame checks are namespaced `frame:`; frame file names and the original build/drop/hold review images are retained. Results distinguish `pass`, `fail`, `incomplete`, and reasoned `not-applicable`; the aggregate `technicalStatus` and exit code are computed from the requested inventory. Startup infrastructure failures go into `blockers`, with presets `not-run` and aggregate `incomplete`. A subset pass is not full-inventory approval, and the external gates remain separate. Version 2 changes the fixture identity to `qa01-v2/sys04-review-v1`; rerun both sides before comparing performance baselines.

### Evidence and calibration

- **Motion:** recreate the native runtime from identical saved activation state and deterministic random seed, edit only the selected Pattern, warm up for 60 frames, and capture two independent A/A checkpoints after 30 fixed-energy, no-hit frames at 30 Hz. Disable camera permission when present; verify camera pose, pattern, settings, fixture, frame count, clock and quality when comparing. Advance another 30 and 60 frames under the same musical fixture. Evaluate spatial gradients within nine projected scene regions, normalized by per-channel contrast (floor 24 RGB levels), instead of relying on global brightness or section changes. Compare phase/travel inspection where exposed; phase alone never passes. Adjacent patterns are compared at the same checkpoint with exactly one saved parameter changed. Temporary holds can pass on the later sample if actual motion is observed; no blanket exemption for darkness or an unaudited permanently held pattern is introduced. Any permanent hold exception must document the authored policy, verify the expected held state and demonstrate an eligible release into motion before being added to the matrix. Missing effective pattern/pose metadata is incomplete.
- **Sources:** use the production media slot service and deterministic RGB quadrant image. Independently reset and warm the same native runtime for source-off A/A, source-on, and a loaded-then-removed sample. Use the same fixture phase, time, settings, camera and viewport; prefer Automatic source where available. For model samples only the explicitly exercised pinned model binding is excluded from the saved-value comparison; the complete state is still saved with each image. Evaluate localized RGB differences and the appearance of at least two distinct fixture hues within changed expected zones (wrapping panels can occupy all nine zones; central model/core sources use center-facing regions). The chromatic test is a visibility tripwire, not fidelity certification. A hidden-but-loaded texture is tested in-browser wherever a hard Media Visible permission exists; the pure negative fixture always runs. Removal requires a previously ready fixture, actual cleared slot or restored `default-model` binding, no remaining user-media indication where exposed, matching source-mode inspection where exposed, and a nonuniform frame matching the no-source A/A reference within noise. QA-04 and QA-05 still own exhaustive model and media formats/fidelity.
- **Thresholds:** within each ROI, the change must exceed both mean 0.25 RGB/normalized-edge levels and changed-pixel fraction 0.002, and exceed twice that ROI's measured A/A drift in both metrics; a changed pixel has max channel/edge difference at least eight levels. The quadrant signature requires at least max(4, 0.005% of all pixels) per qualifying hue. These conservative initial tripwires are derived from the existing SYS-06 drift policy, with a more localized comparison. They are **not yet calibrated on real rendered captures in this environment**. On a supported development machine, retain A/A and known-positive/negative ROI measurements for each preset, inspect failed regions alongside the PNGs, and document any preset-specific calibration based on repeated measurements. Never lower thresholds simply to turn a failing candidate green.
- **Trigger:** keep the section and energy fixed; publish a real semantic drop, edit to a distinct pattern, repeat the existing event identity, publish no event, publish a stale event, then one fresh semantic drop, duplicate and hold. Inspect actual effective pattern, saved pattern, effective trigger and Pattern Change; validate event identities and times and exact authored next-pattern policy. The harness reproduces the source-defined fixed or seeded shared Mainframe cycles for Honey, HUD, Purity, Allstar, Wireframe Portal, Spectrum, Corridor, Fracture, Refraction, Mosaic, Overdrive, Colossus, Exoskeleton, Monument and Everywhere. Unknown/unexposed policies are deliberately incomplete rather than assuming an arbitrary transition. No new production event detector or creative policy is introduced.
- **Recovery:** observe context-lost phase, retired module leases, zero resident render allocations (logical persistent render leases are allowed to survive context loss), reconstructed render allocations, exactly one new generation, one owned context, running scheduler and new nonuniform production frame. Preserve fatal GL/resource diagnostics and existing disposal checks. Unsupported context loss is incomplete. The per-preset watchdog is now 600 seconds to accommodate matched resets and extra captures.

### QA-01 verification on the supplied snapshot

Linux x64, Node v22.16.0. `npm ci --offline --ignore-scripts --no-audit` exited 1 (ENOTCACHED for `zustand@5.0.13`; registry DNS unavailable). `npm run test:cinema2:release-policy` exited 0 (12/12 tests); `node --test scripts/cinema2-assets/quality-review-core.test.mjs` exited 0 (4/4). Negative controls include frozen and exposure-only motion, measured noise, invalid/mismatched frames, ready/invisible texture, wrong ROI and musical phase, stale/duplicate/missed or wrong fresh transition, wrong fallback identity, unreconstructed context and failed/missing scenario propagation to report/exit status. `npm run test:e2e:cinema2-release -- --presets spectrum,honey,corridor` exited 1 with `ERR_MODULE_NOT_FOUND` for `@playwright/test`; the manifest reported all three presets not-run and technical status incomplete. `npm run typecheck` and `npm run build` both exited 2 with TS2688 (`vite/client` missing). JavaScript syntax checks passed. No positive production rendering, browser negative-control execution, hardware, casting, Electron or human approval is claimed. Run the documented commands after installing locked dependencies. The prior Review 01 reference document/recordings were not supplied; the source contract and existing implementation notes are the basis of this change.

## QA-02: reviewed inventory (schema 3, `reviewed-v1`)

The definitive prompt-derived release matrix is `scripts/cinema2-assets/reviewed-release-inventory.mjs`. It preserves the original 19 and adds **Chamber and Monument**, for 21 unique registered IDs. All IDs use `drmvyz.cinema2.` plus the exact key (including `crate-wireframe-portal`). Monument, Monolith and Paradox are distinct. The original recording and original 33-file archive were not attached to QA-02; the following mapping uses the prior prompt index and source implementation notes, not a new visual review or a claim of exact recording coverage.

| # | Prompt subject | Reviewed keys / applicable scenario focus |
|---|---|---|
| 01 | Spectrum rendering failure | `spectrum`: default, performance visibility, camera |
| 02 | Unified Source interface | Shared; compiled source and fallback checks, no extra ID |
| 03 | Imported model preservation | Shared; bound model, original presentation, removal |
| 04 | Camera and pattern authority | Shared; camera, pattern/trigger, transport |
| 05 | Visual-quality guardrails | Shared; default and performance captures, separate human rubric |
| 06 | User-media readability | Shared; compiled image/video/SVG slots and visibility |
| 07 | Production WebGL acceptance | Shared; matrix, reentry, retirement, context recovery |
| 08 | Design Inspector hierarchy | Shared; manual controls; separate Inspector tests |
| 09 | Everywhere Active Source/reset | `everywhere`: source, reset |
| 10 | Everywhere Inspector | `everywhere`: manual controls; separate Inspector tests |
| 11 | Colossus megastructure | `colossus`: default, performance, model |
| 12 | Colossus patterns/camera | `colossus`: patterns, camera |
| 13 | Colossus model controls | `colossus`: bound model, original presentation, fallback |
| 14 | Chamber model color/transparency | `chamber`: original import, placement, visibility, removal; dedicated Chamber model harness also required |
| 15 | Corridor media color/visibility | `corridor`: media formats, visibility, fallback |
| 16 | Corridor media choreography | `corridor`: patterns, media, transport |
| 17 | Wireframe Portal spatial expansion | `crate-wireframe-portal`: structure controls, portrait, patterns |
| 18 | Exoskeleton armor redesign | `exoskeleton`: default, patterns, model |
| 19 | Exoskeleton model appearance | `exoskeleton`: model, original presentation, fallback |
| 20 | Fracture spatial rupture | `fracture`: default, patterns, media |
| 21 | HUD negative space | `hud`: default, patterns, portrait |
| 22 | Livewire camera | `livewire`: camera, patterns |
| 23 | Livewire background | `livewire`: default, performance, patterns |
| 24 | Monument architecture | `monument`: default, native typography, patterns, camera |
| 25 | Monument source/typography | `monument`: text/font, pinned model, replacement, failed load, restoration |
| 26 | Purity forward flight | `purity`: camera, motion, transport |
| 27 | Seraph scale/model compatibility | `seraph`: default, portrait, compiled model applicability |
| 28 | Relic volumetric artifact | `relic`: default, pattern motion, portrait |
| 29 | Relic scale/model compatibility | `relic`: framing, compiled model applicability |
| 30 | Refraction optical architecture | `refraction`: default, patterns, media |
| 31 | Honey physical extrusion | `honey`: default, controls, spatial motion |
| 32 | Honey choreography/depth | `honey`: patterns, transport, motion |
| 33 | Honey camera profile | `honey`: camera, portrait |

The five retained matrix entries not individually named in this prompt index are `paradox`, `monolith`, `mosaic`, `overdrive`, and `allstar`. They remain covered by the inherited SYS-04/05/06 anchors. Their applicable scenarios are derived from their compiled manifests, not inferred from their names. All 21 receive default, manual controls, patterns, applicable camera controls, transport, reset, portrait/quality, reentry, retirement and context recovery. No catalog-wide expansion is implied.

Before creating any production runtime, a separate Vite page resolves **every** reviewed ID through the native registry/compiler and checks first-party declaration, non-foundation role and non-internal visibility. The runner rejects duplicate or unknown requested keys, missing/duplicate/mismapped reviewed IDs and unresolved/inactive compiled entries. The preflight is offline with respect to user catalog/account state; it does not test account-specific visibility. The report includes inventory version, expected/requested keys and IDs, absent entries, percentage of requested coverage (not percentage passed), registry preflight, scope, technical status and full-inventory status. The full run requires a passing result for every key; `--presets` remains a development-only scope, even when the explicit selection lists every key. Schema-2 comparisons are incompatible. `releaseApproval` remains false: the independent human/Electron/casting/performance gates are not completed by this browser script.

Capability discovery records compiled slot accept lists and required flags, actual bound model selectors, fixed authored assets, text/model modes, camera refs and trigger options. For this technical matrix each advertised media format requires ready and visible fixture evidence; unsupported formats are reasoned not-applicable. An optional user source is optional for the artwork, not optional for testing its advertised capability. Image retains QA-01's removal and hidden negative checks; the SVG and constant-quadrant WebM fixtures exercise their own actual slot paths. Format-specific playback/fidelity and exhaustive imported material/alpha checks remain QA-04/05 and the dedicated Chamber harness's responsibility. Chamber's Home/Drift rig modes are exercised directly and kick zoom disabled for matched camera comparisons. Chamber has no hard Model Visible control; placement, rendered contribution and removal are the checks, not an invented control. Monument's custom saved text/font, native text visibility, original imported GLB, replacement and failed binding, model-mode fallback and restored text mode are compared against independently recreated matched reference frames. Missing required evidence, including an unsupported test environment, remains incomplete/fail. No production rendering/creative behavior was changed.

Run from repository root after locked dependencies and Chromium are installed:

```sh
npm run test:cinema2:release-policy
npm exec -- vitest run src/components/vyzualz/cinema2/__tests__/Cinema2KeeperPresetFramework.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2Chamber.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MonumentPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MonumentScene.test.ts
npm run test:e2e:chamber-model
npm run test:e2e:cinema2-release -- --presets chamber,monument
npm run test:e2e:cinema2-release
npm run typecheck
npm run build
```

QA-02 verification in Linux x64 / Node 22.16.0: release-policy **16/16**, exit 0; offline locked installation exit 1 (`ENOTCACHED` for zustand); targeted Vitest invocation exit 1 (Vitest unavailable in offline cache); Chamber browser exit 1 (missing Playwright); subset and full browser commands exit 1 (missing `@playwright/test`, no captures); typecheck/build exit 2 (`vite/client` missing). The subset manifest reports 2 requested / 21 expected, 19 absent, subset-only and incomplete; the default manifest lists all 21 expected/requested and incomplete. Neither verifies real registry preflight or runtime rendering in this environment. Calibration of the new media/model/camera cases, Chamber's authored Standby behavior under QA-01 motion criteria, and any browser failures remain pending actual execution. No release approval is claimed.
