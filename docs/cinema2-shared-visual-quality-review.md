# Cinema 2.0 SYS-04 / VIS-01: visual acceptance and thumbnail publication

## Scope and provenance

QA-02's exact 21 compiled IDs are the review inventory; `quality-review-core.mjs` asserts that its scene-specific rubrics cover that inventory, including `crate-wireframe-portal`, Chamber and Monument (distinct from Monolith). The original Review 01 recording and original pre-redesign snapshot are unavailable in this archive. Rubrics derive from the prompt, current manifests and existing authoring notes, not an invented visual comparison. No preset, renderer, Inspector, source ownership, camera, choreography or authored default changes are made. A verified older comparable source can be reviewed; otherwise use a prospective baseline captured with this workflow on the current unchanged visual implementation. Prospective approval is not proof of improvement against the original recording.

## Capture production evidence

Install the locked dependencies (`npm ci`, `npm run playwright:install`); alternatively set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible executable. Run in the actual repository on the same machine, browser and renderer for both sides:

```sh
npm run test:cinema2:release-policy
npm run visual:cinema2:quality-review
npm run test:e2e:cinema2-release -- --media-masks /absolute/path/to/independently-calibrated-masks.json
```

See `cinema2-qa05-media-fidelity.md` for mask calibration; do not invent masks to obtain a pass. The default quality command captures all 21 presets, authored/manual/auto, landscape/portrait, high quality. Optional `capture --presets honey --modes authored --aspects landscape` is a diagnostic subset and cannot authorize publication. The actual native runtime consumes a deterministic upstream 120 BPM fixture through the production shared bridge. No user media, duplicate audio analysis, mocked scenes or overlays. Every case starts with a fresh runtime; the only intentional persistent change is the Auto Performance control in manual/auto cases. The reference, idle and two-second build/drop/breakdown sequences are sampled at onset and roughly six frames per second, with actual canvas PNGs and chronological contact sheets. Individual full-resolution images remain alongside each sheet. Review the complete sequence; a contact sheet is not a video or continuous-playback proof.

The QA-01/04/05/06 full technical matrix supplies separate native pattern sequences, camera permission/safety, trigger/Auto Performance states, and deterministic image/video/SVG/model cases based on actual compiled capabilities. Inspect those sequences as well as the default phase sheets. Each run records manifest IDs, revision, saved parameter IDs/values, fixture, source slot IDs, settings, viewport, browser and GL renderer, CPU timings, diagnostics, frame and contact sheet SHA-256. Low luminance alone is not a failure. A uniform default is failed; transitional uniformity is a diagnostic requiring review and rationale; a uniform thumbnail is prohibited. No single numerical aesthetic score is used. The source digest covers runtime, native/electron, public assets except catalog thumbnails, relevant tooling/config and lockfile bytes (including local uncommitted changes). Keep both ignored run directories intact. Do not edit captures or reports. Intermediate technical manifests are not final sealed evidence.

## Review and compare

Keep the printed roots of the two quality runs, and the two technical `manifest.json` files. Set these paths from actual runs:

```sh
BASE=/absolute/path/to/baseline-quality-run
CAND=/absolute/path/to/candidate-quality-run
BASE_MATRIX=/absolute/path/to/baseline-release-run/manifest.json
CAND_MATRIX=/absolute/path/to/candidate-release-run/manifest.json
REVIEWS=/absolute/path/to/review-decisions
npm run visual:cinema2:quality-review -- compare "$BASE" "$CAND" "$BASE_MATRIX" "$CAND_MATRIX" "$REVIEWS" --prospective --preset=honey
npm run visual:compare-captures -- "$BASE/honey/authored/landscape" "$CAND/honey/authored/landscape" --tolerance 0 --max-different-fraction 0
```

Repeat for each required key. Use `--matched-older` instead of `--prospective` only for a verified older source run with identical fixture, settings, camera/source conditions and comparable environment. Document `baselineProvenance` and any reference availability; do not claim the original review was supplied. If no source change is planned, a prospective baseline and candidate can be the same verified run (approval is of current appearance, not a before/after improvement). A differing preset revision is allowed only with matching authored settings and metadata. Incompatible older evidence must be recaptured under the same harness, or use prospective approval. The pixel comparison command reports differences, not artistic pass/fail; a difference is expected for intentional changes. The approval CLI requires complete, sealed, error-free captures on both sides and passing full-inventory technical reports. Missing QA-05 calibration, failed gates or absent capture evidence are blockers, not waivers. Raw artifacts can still be inspected before technical gates pass.

The compare command creates one pending JSON decision per preset with exact baseline/candidate hashes and revision binding, concept notes, capabilities and suggested evidence refs/hashes. It never overwrites an existing review. A human must inspect the referenced images (resolve `baseline/` and `candidate/` against the respective quality roots; `matrix/` against the corresponding technical run's preset directory). Evidence references are prepopulated for review, not evidence of having reviewed them. Keep each required evidence reference and record concrete observations per criterion, including intentional darkness/crop/stylization where applicable. Add focused evidence refs from the indexed captures if needed. Set statuses `pass`, `fail`, `pending`, or `not-applicable` (only media/model fidelity with no compiled source capability, with a reason). Review the seven original criteria and three new ones:

| Criterion | What to inspect |
| --- | --- |
| Subject legibility | Scene signature in idle, build and drop. |
| Negative space | Deliberate focal hierarchy, aperture and composition. |
| Depth/parallax | Foreground, middle and far layers and their independent movement. |
| Selective lighting | Readability through local illumination without destroying darkness. |
| Pattern distinction | Every authored pattern's ordered production sequence; not just palette variation. |
| Media fidelity | Supported deterministic media/model cases, color, alpha, UV, geometry, fallback and authored stylization. |
| No clipping | Focal silhouettes, motion extrema and both orientations. |
| Meaningful motion | Ordered phase sheets plus selected camera sequences; actual perceived forward flight for Purity. |
| Consistency | Intent across orientations, Auto Performance, idle and performance states. |
| Distinct identity | Scene-specific goals; no generic replacement identity. |

Each criterion must carry a reason and valid capture ref/hash, including all six matched case sheets for composition/motion/identity criteria, every pattern sequence for pattern distinction, supported media and model cases for fidelity, and off/on/auto camera sequences when supported. Reviewer enters their real name, ISO date, explicit `decision: "approved"` only when all criteria pass or are justified capability N/A, and `thumbnailFrame` from the authored landscape candidate. No program supplies human approval. Keep rejected decisions and evidence; after changes create a new review directory. If a visual defect is confirmed, record evidence and the narrow fix or separate authoring task. No blanket redesign authorized.

## Dry run and publication

```sh
npm run visual:cinema2:quality-review -- publish-thumbnail "$BASE" "$CAND" "$BASE_MATRIX" "$CAND_MATRIX" "$REVIEWS" --prospective --preset=honey
# After inspecting the dry-run path and hashes, explicitly write the approved thumbnail:
npm run visual:cinema2:quality-review -- publish-thumbnail "$BASE" "$CAND" "$BASE_MATRIX" "$CAND_MATRIX" "$REVIEWS" --prospective --preset=honey --apply
npm run visual:cinema2:quality-review -- status "$BASE" "$CAND" "$BASE_MATRIX" "$CAND_MATRIX" "$REVIEWS" --prospective
```

Dry run is the default and writes no catalog asset; `--apply` is required. The publisher re-reads report and frame bytes, checks SHA-256, exact source revision, full technical gates, matched configurations, human approval, required rubric and frame selection. It uses the catalog's actual `PresetBlueprintImage` ID mapping and the existing artwork generator's 480×270 WebP quality 86 convention. It checks the source PNG and resulting WebP dimensions and prints exact relative path, old/new hash and source frame hash before replacing only that one file. Existing missing assets remain missing until approved; existing unapproved thumbnails are preserved. General `generate-preset-artwork.mjs` skips reviewed IDs (including missing artwork and explicit requests); this prevents an alternate ungated generator from rewriting them. No transient captures are staged.

Status lists each reviewed preset as approved, failed, pending or blocked. Per-preset approval is **not overall release approval**. QA-07 hardware GPU, Electron preview/fullscreen and casting/external receiver evidence remain separate mandatory release decisions; VIS-01 does not certify them. Manual reviewer authenticity and the quality of their judgment are human responsibilities, not cryptographic identity verification.

## Verification on supplied archive

Linux x64, Node 22.16.0. Offline `npm ci --offline --no-audit --no-fund` exited 1 (`ENOTCACHED`, `zustand@5.0.13`). Dependency-free visual policy tests passed, including synthetic publication mapping, stale/rejected/missing capture and tampered bytes cases. The actual quality capture and full technical matrix commands exited 1 (`@playwright/test` missing); the technical manifest records 21 not-run presets and incomplete status. Pixel comparison exited 1 (`sharp` missing); typecheck/build exited 2 (`vite/client` missing). No actual rendered sequence, successful real-image publication dry run, artistic correction, thumbnail refresh, human approval, live hardware timing, Electron or casting acceptance is claimed. Run the commands above on an installed checkout with calibrated evidence. All 21 visual approvals and thumbnail refreshes remain pending.
