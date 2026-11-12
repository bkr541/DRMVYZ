# Cleanup progress

## Chunk 01: repository tracking hygiene

Starting checkpoint: `387ffd5458c7` (`before cleanup`).

Removed generated and machine-local paths from Git tracking while preserving
their local files: 7,760 dependency files, 321 coverage
files, 1 build-output file, and 9 Supabase CLI metadata files.
Dependencies, current build output and CLI linkage remain available locally.
Added an explicit Supabase metadata ignore rule and source-package hygiene guard.
No application code, dependency versions, lockfile, runtime assets, migrations or
acceptance evidence were removed. No commit was created.

Verification checks tracked-path hygiene, identical before/after local-file
hashes, intended staged deletions only, and protection of Supabase metadata.
The ignored `artifacts/cleanup-chunk01/` directory holds the verification manifest.
Source packaging still reads committed HEAD, so the tracking cleanup must be
committed before HEAD-based source archives can benefit from it.

## Chunk 02: small orphan artifacts and duplicate contract

Removed `sb.css`, `public/homeicon.svg`, and `public/drmvyz_logo.png` after a
repository-wide authored-file reference check found no consumers. Retained the
active `drmvyz_logo2.png` and `drmvyz_logo_icon.png` assets. Removed NIGHTSHIFT’s
byte-identical local creation contract and redirected its behavior specification
link to the canonical root contract. Total removed: 200,229 bytes across four files.
An ignored recovery copy and hash manifest live in `artifacts/cleanup-chunk02/`.
Validation passed: all 31 Cinema assets, production typecheck/build, retained
production logos and removed-logo absence, canonical contract link resolution,
repository hygiene, intended diff boundaries, and whitespace checks. Build
evidence and results are retained beside the recovery manifest.
No dependency, runtime behavior, model source, migration, or evidence was removed.
No commit was created.

## Chunk 03: disposable browser-test bundles

Removed 15 ignored `artifacts/blockshift/*/bundle/` directories containing
2,099,140,275 bytes (2001.9 MiB) of reproducible browser-test output.
The normal BLOCKSHIFT browser script builds each bundle before serving it.
After this cleanup, omit `--reuse-build` for the first run of each mode; do not
use `--resume-p8` until that mode has a fresh build. Old exact bundle bytes are
not archived; they were generated outputs, not retained evidence. Rebuilding
from current source produces current output rather than the old candidate.

Verified all 5,313 other artifact files retained identical size/mtime, and
all 906 BLOCKSHIFT documentation-evidence and MARQUEE files retained their
content hashes. Screenshots, recordings, reports, model sources, the main app’s
`dist/`, and cleanup recovery manifests remain in place. The ignored
`artifacts/cleanup-chunk03/` directory records removed paths and validation.
No application code changed; no build rerun is needed for deletion of ignored
test bundles. No commit was created.

## Chunk 04: PixGrid browser-test build copies

Removed 244 ignored generated build files totaling 319,696,142 bytes
(304.9 MiB) from these browser-test output directories:

- `artifacts/pix-grid-deck-show-manager-browser/`
- `artifacts/pix-grid-deck-runtime-browser/`
- `artifacts/pix-grid-deck-compiler-browser/`

Retained their `results/` directories unchanged. Each corresponding script in
`scripts/run-pix-grid-deck-*-browser.mjs` removes its output and builds from source
before serving it, so its next normal invocation regenerates the deleted files.
Directly serving an old build from those output folders requires a rebuild first.
Old compiled bytes are not archived; test results remain available.

All 5,071 other artifact files retained their size and modification time;
8 files inside results directories additionally retained content hashes.
No tracked files changed during deletion, and no app code, public assets,
source models, acceptance records, or installed dependencies were removed.
The removal manifest and preservation-check results are in ignored
`artifacts/cleanup-chunk04/`. No commit was created.

## Chunk 05: unused waveform and analysis dependencies

Removed `@wavesurfer/react`, `wavesurfer.js` and `essentia.js` through npm after
checking authored source, scripts and configuration for executable references.
Npm also removed Essentia’s now-unused `node-wav` dependency. No retained package
versions changed and no new packages were added. Npm updated development-only
metadata for optional build-tool packages in the lockfile.

Kept `peaks.js`, `konva` and `waveform-data`; the active waveform implementation
uses Peaks and its peers. Removed Essentia from the README’s active technology
list. Its optional server-side reference in music-intelligence documentation
remains accurate and is retained.

All 74 focused waveform tests passed across PeaksWaveformView, the audio-engine
adapter and useWaveformPeaks. Package/lock consistency and retained waveform
peer installation checks passed. Production typecheck/build validation passed.
Package-file recovery copies and validation logs are retained under ignored
`artifacts/cleanup-chunk05/`. No commit was created.

## Chunk 06: four unused UI components

Removed these standalone components after checking repository-wide imports,
re-exports, filename references, dynamic loaders and authored documentation:

- `src/components/shared/TrackScrubber.tsx`
- `src/components/vyzualz/BpmInput.tsx`
- `src/components/vyzualz/layout/HeaderToggleKey.tsx`
- `src/components/vyzualz/react/controls/AudioTrackRow.tsx`

Total source removed: 5,941 bytes. Active waveform/transport controls,
shared styling and primitives remain intact. The unrelated `AudioTrackRow`
interface in the lyric-transcription Edge Function is retained. Historical
source captures/reports are retained; generic source-audit globs have no
requirement for these four filenames.

Recovery copies and a hash manifest are in ignored `artifacts/cleanup-chunk06/`.
All 36 focused control tests and the production typecheck/build passed.
Repository hygiene, preservation of shared controls and diff checks also passed.
The diff contains only these removals, this log and earlier cleanup changes.
No commit was created.

## Chunk 07: unused hooks and helpers

Removed six unreferenced source files (55,403 bytes):

- `src/hooks/useAnimationFrame.ts`
- `src/hooks/useModuleSystem.ts`
- `src/hooks/usePresets.ts`
- `src/components/vyzualz/hooks/useVyzualzKeyboard.ts`
- `src/lib/colorGradePresets.ts`
- `src/lib/transitionRenderer.ts`

Repository-wide searches found no consumer imports, re-exports, executable
filename references or callers of their exported APIs. The general source-audit
glob does not require these filenames. Removed a stale comment referencing the
unused transition helper from the retained GPU transition lookup table.

No local-storage data was removed, including the old `drmvyz_presets` key.
Current preset persistence, keyboard targets, rendering, timeline types and
color-grade state remain intact. Recovery copies and a hash manifest are retained
under ignored `artifacts/cleanup-chunk07/`. All 72 focused rendering/color-grade
tests, production typecheck/build, repository hygiene and diff checks passed.
No commit was created.

## Remaining chunks

1. Review other generated outputs individually. Historical evidence and design
   packages remain intact pending a durable archive and link-preserving plan.
2. Review isolated unused source candidates separately with focused validation.
   The three audited dependency candidates have now been removed.

Do not run blanket cleanup of artifacts or raw model sources. Earlier Git
commits still contain the removed tracked files; no history rewrite is included.
