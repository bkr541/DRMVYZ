# STAGELESS repository asset governance

Applies to Cinema 2.0, legacy Cinema, Sound Drawing, PixGrid, LaserDMX, CANVAS, Layout Lab, Media Manager, Admin Console and every other engine or feature.

The main repository contains what is necessary to build, run, test, maintain and distribute Studio. Production visuals are not expendable. Asset owners must explain purpose, attribution, license, expected runtime paths and intentional quality tiers. Review SHA-256 duplicates before consolidating; different logical URLs can be contracts even when bytes match. Never reduce quality solely for size. Keep original hashes separate from test inputs.

| Location | Responsibility |
|---|---|
| `src/`, `electron/`, `native/`, `supabase/`, `scripts/`, `assets/` | Source, tooling, configuration and manifests. |
| `public/`, `src/assets/`, `electron/assets/` | Production runtime/build assets, branding, fonts and model/decoder tiers. |
| `src/test/fixtures/` | Essential independently justified test media and golden references, e.g. NIGHTSHIFT pixel baseline. |
| `docs/` | Written specifications, licensing, attribution and historical results. Existing active visual references/source packages are grandfathered in `assets/repository-asset-policy.json`; do not add binary evidence by default. |
| `artifacts/`, `.development/` | Ignored screenshots, recordings, intermediate designs, QA evidence, scratch processing and exported ZIPs. Clean disposable evidence after approval. |
| `asset-sources/` | Transitional tracked preservation of irreplaceable original models relocated from documentation; excluded from development export and production packages. No new originals without explicit review. |
| `.asset-sources/` or external storage | Ignored optional originals; before removing a tracked source, verify a separate copy against its checksum, retain licenses and document restoration steps. |
| User storage | Supabase user-scoped media/audio/font buckets, browser storage, Electron userData, user-selected locations and application caches. Never commit actual user data. |

### Developer commands

Run from a Git checkout using Node 22.12+ and Git. No extra npm package is needed for export/audit. The standard export uses current on-disk tracked files plus new, non-ignored source files in approved code/documentation paths. Stage any intentionally new runtime assets (`git add <file>`) so they are included. Unrelated root files, untracked binaries, ignored content, generated output, common credential paths and local secrets are excluded. This is a path policy, not a secret scanner: review tracked content and new source for hardcoded credentials before sharing. Symlinks are not followed. Deleted files are not included. The output has repository-root-relative paths, not a wrapper directory.

- `npm run export:development` creates `artifacts/development-export/STAGELESS-Studio-Development.zip`. Includes all runtime assets and normal build/test inputs, excludes optional preserved originals and legacy documentation/educational binaries.
- `npm run export:development -- --full-assets` additionally includes retained documentation and educational media, but still excludes preserved originals, secrets and generated content.
- `npm run export:development -- --source-only` additionally excludes binary-format files at least 256 KiB; **not runnable**. Every intentionally omitted binary has its path, size and SHA-256 in `DEVELOPMENT-EXPORT-INVENTORY.json` in the ZIP. Standard and full-assets also include this inventory. Optional restoration/regeneration is not part of normal build.
- `npm run export:development -- --dry-run` reports file counts and uncompressed sizes without writing an archive. Ignored untracked files are not enumerated or included in the excluded byte total. Combine with a mode flag. `STAGELESS_EXPORT_BUDGET_MIB` overrides the warning threshold (450 MiB compressed by default).
- `npm run audit:assets` reports tracked working-tree sizes, largest assets, SHA-256 duplicate groups, categories and policy violations. `--json` emits machine-readable results; `--check` exits nonzero on policy violations or budget excess. Duplicate candidates are advisory, not deletion instructions. The policy budget is 650 MiB uncompressed, with an explicit legacy path allowlist. CI checks new violations and runs tooling tests.
- `npm run test:asset-governance` validates export selection, deterministic ZIP bytes and optional source configuration without app dependencies.

### Optional source regeneration

VACANCY and NIGHTSHIFT originals now reside in `asset-sources/vacancy` and `asset-sources/nightshift`. The unique CDJ original is in `asset-sources/crate`. The included builders use their original inputs, never substitute optimized models. `STAGELESS_SOURCE_ASSETS` may point to an external directory containing `vacancy/`, `nightshift/`, `psylo/` or `neon-forest/` subdirectories (exact original basenames). On macOS: `STAGELESS_SOURCE_ASSETS=/path/to/models node scripts/cinema2-assets/build-vacancy-runtime.mjs`. In PowerShell: `$env:STAGELESS_SOURCE_ASSETS='C:\models'; node scripts/cinema2-assets/build-vacancy-runtime.mjs`. Missing originals produce explicit restoration instructions. PSYLO and NEON FOREST original GLBs remain included in standard export because their existing automated geometry tests verify source bytes and provenance. MARQUEE uses a procedural Python builder; original package assets and its outstanding visual comparison evidence remain retained, not silently disposed. BWC remains a reference/development case; preserve its distinct original inputs.

After approval, remove disposable evidence, replace duplicate-dependent tests with fixed approved checksums, verify references, run CI/build and actual visual acceptance, update licenses and document net byte impact. Do not change preset identity, classification, packs, choreography or user storage to save repository space. Electron packaging already selects `dist`, `electron`, `native`, and package metadata; keep development evidence out of production runtime directories.
