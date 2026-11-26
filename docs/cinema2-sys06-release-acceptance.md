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
