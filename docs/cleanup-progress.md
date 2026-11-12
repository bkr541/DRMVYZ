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

## Remaining chunks

1. Review other generated outputs individually. Historical evidence and design
   packages remain intact pending a durable archive and link-preserving plan.
2. Evaluate unused dependencies and isolated source candidates separately with
   build and focused behavior validation.

Do not run blanket cleanup of artifacts or raw model sources. Earlier Git
commits still contain the removed tracked files; no history rewrite is included.
