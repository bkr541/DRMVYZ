# PixGrid P2 final hardening contract

## Completion map

| P2 item | Result |
| --- | --- |
| P2-01 sequence capacity | Completed. A Deck supports 2–64 occurrence records. Occurrence IDs remain unique, media IDs may repeat, and the Deck Builder can duplicate an occurrence without duplicating its media asset. Source preparation is keyed by media revision and pair compilation remains demand-driven rather than all-pairs. |
| P2-02 section coverage | Completed. Built-ins author Intro, Verse, Build, Pre-drop, Drop, Breakdown, Bridge, Outro, and Unknown mappings. `scene.sectionType` is authoritative; name inference is compatibility-only. Unknown sections use an explicit mapping or preserve the safe current/fallback scene. |
| P2-03 registries | Completed. Preset conformance resolves performance programs, motion profiles, assets, audio sources, and audio destinations through the shared registries. Duplicate and unknown IDs produce field-addressed issues. |
| P2-04 media safety | Completed. Content-Length is checked before consumption, streamed bytes are counted and cancelled at the 64 MiB limit, aborts clean readers, and declared plus decoded dimensions are checked against Deck media limits. ImageBitmap disposal, SVG checks, animated-WebP rejection, and revision-aware invalidation remain in force. |
| P2-05 caches and scene preparation | Completed. Prepared media is capped at 24 entries/16 MiB, prepared frames at 64 entries/64 MiB, transition plans at 256 entries/32 MiB, generated groups at 128 entries, and column extents at 128 LRU entries. Live preparation follows the effective current and next playback scenes; selected-scene preview remains isolated. Deleted media invalidates its prepared entry. |
| P2-06 visual regression | Completed for the P2 contract, with existing suite debt recorded below. The reusable quality test samples 0/10/25/50/75/90/100%, checks exact endpoints, deterministic hashes, occupancy, brightness bounds, spatial intermediates, and distinct Flow/Disperse/Clustered results. Existing sequence, seeking, audio, GPU/Canvas, worker, and persistence suites provide the broader matrix. |
| P2-07 expansion validator | Completed. `validatePixGridPresetConformance()` returns blocking errors and warnings carrying preset ID, field path, and stable code. `PIX_GRID_PRESET_CONFORMANCE_REPORTS` evaluates every registered definition. |
| P2-08 diagnostics | Completed. Development snapshots expose preset/scene/item/pair identities, requested and resolved transition, profile, timing/progress, compiler/preparation/worker state, cache counters, fallback reason, audio signals, and frame cost without normal-playback console output. |

## Sequence and compatibility rules

The 64-occurrence ceiling is a resource-aware authoring constraint, not a unique-asset limit. A repeated occurrence receives a new item ID but retains the underlying `mediaId`; timing and directed pair overrides therefore remain occurrence-specific while prepared source pixels are shared. Removing an occurrence only updates the Deck definition and never deletes the canonical media record.

Existing saved Decks require no schema migration. Decks at or below the former 12-item ceiling normalize unchanged. Legacy scenes without `sectionType` continue to use name/ID inference, while newly generated scenes persist authoritative section metadata. No built-in preset or performance-program ID changed.

## Media and cache constraints

- Source body: 64 MiB maximum, enforced before download when Content-Length is trustworthy and during stream consumption in all cases.
- Raster dimensions and decoded pixel count: the existing Deck media-validation constants are checked both from metadata and after decode.
- Prepared generic media: 24 entries and 16 MiB, LRU.
- Prepared Deck frames: 64 entries and 64 MiB, LRU.
- Transition plans: 256 entries and 32 MiB, LRU.
- Column extents: 128 entries, LRU.
- Transition compiler concurrency: two jobs by default, with cancellation and watchdog behavior retained from P1.

The development diagnostics report cache entries/bytes and hit/miss/eviction counters where available. Eviction affects reuse only; recomputation is deterministic.

## Adding and validating a preset

Register the definition through `PixGridPresetRegistry.ts`, then call `validatePixGridPresetConformance(definition, allDefinitions)` in tooling or tests. Treat `compatible: false` as blocking. Warnings are non-blocking but must be reviewed; intentional static layers do not fail merely because they do not transform. Runtime and editor discovery both consume the registry, so a new preset does not require a second validation whitelist.

## Repeatable performance measurement

Run `npm run benchmark:pix-grid:p2`. The benchmark uses two deterministic 160×90 logical frames, 12 correspondence compilations, 240 composed transition frames, and a 64-occurrence/16-asset shuffle Deck.

Measured on an Apple M3 Pro MacBook Pro (12 CPU cores, 18 GB RAM), macOS, Node 26.11.1:

- Logical compose: 3.15 ms mean, 3.54 ms p95, 7.84 ms worst observed.
- Transition compilation: 5.76 ms mean, 7.99 ms p95/worst observed.
- Compiled transition-plan estimate: 30,696 bytes.
- Long-sequence initial work: 64 reachable pairs for 64 occurrences, versus 4,032 possible directed pairs avoided.
- Configured worker concurrency: 2; prepared-frame and transition-cache ceilings: 64 MiB and 32 MiB.

These are CPU logical-frame measurements, not browser FPS claims. Browser media decode/preparation peak memory and repeated-preset browser memory could not be measured reliably because the existing runtime acceptance timed out waiting for Deck compilation. No number is reported for those fields rather than substituting an estimate.

## Validation record and known baseline issues

The P2-focused run passed 33 tests across bounded media, cache eviction, section metadata, conformance, animation quality, Deck domain, preview timeline, and the updated persistence capacity assertion. TypeScript typecheck passed. The bundled-worker Chromium acceptance passed.

The repository's broader PixGrid suites still contain pre-existing failures: file-fixture URL resolution under Node, legacy persistence/canonical-graph expectations, two rendered-pixel expectations, performance-program assignment-count expectations, a WebP fixture, two GPU expectations, runtime browser compilation timeout, and Show Manager selected-track loading timeout. The full unit run was stopped after those known failures and a long-running GPU test; `test:pix-grid:final` and `verify:pix-grid:final` were not redundantly rerun because they begin with the same failing unit prerequisite. These failures are not hidden by fallback behavior and remain release-suite debt.
