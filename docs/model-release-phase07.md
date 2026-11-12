# Phase 07 — Executed release validation and handoff

**Implementation is ready for the owner's account testing. Production release
acceptance is incomplete.** Live Supabase acceptance, complete media regression
and repository-wide release gates remain open. No additional real users were
created. The owner reports migrations 0047/0048 already pushed; this phase did
not reapply or independently verify them.

## Scope and repository state

Phases 01–06 implement the model domain, generator, Media Manager editor,
versioned private persistence, native Cinema model binding and six reference
previews. This final phase adds executable release/security checks and user and
migration guidance. It does not add advanced effect choreography.

Branch: `main`; starting commit: `2bd6e01` (`sound drawing`). All implementation
changes remain **uncommitted**; no commit was requested. Earlier user edits,
including authentication UI and shared typography, are preserved. Historical
phase handoffs record their state at the time; this report and
[model-migrations.md](model-migrations.md) supersede their deployment status.

Phase 07 files: `scripts/model-assets/verify-editor.mjs` (integrated `--release`
flow), `verify-desktop-package.mjs`, `verify-sql-fixture.mjs`, script lint fixes,
`supabase/tests/model_release_preflight.sql`, this report, migration guide and
README/documentation links. Historical migration files were not changed by this
phase. No new runtime dependency was added.

## Executed checks

Checks ran with Node 22.23.3. Logs and screenshots are in ignored
`artifacts/model-release-phase07/`, including copies of the global-check logs.

| Check | Exit | Observed result |
| --- | ---: | --- |
| Focused Vitest, command below | 0 | 251 passed, 3 known unrelated cases skipped; 17 files |
| `npm run typecheck` | 0 | TypeScript passed |
| `npm run build` | 0 | TypeScript/Vite production build passed, 12.17 s |
| `npm run lint` | 1 | Initial run: 106 errors, 10 warnings; four model-script errors fixed; unrelated existing findings remain |
| Focused ESLint on model scripts/domain/runtime/UI | 0 | No errors or warnings; scripts rechecked after final harness correction |
| `npm run repo:hygiene` | 1 | Existing tracked generated files, including node_modules, dist and coverage; no unrelated untracking attempted |
| `node scripts/model-assets/verify-editor.mjs --release` | 0 | 10 workflow assertions; real WebGL/editor/export and all six native presets, remote service fixture only |
| `node scripts/model-assets/verify-generator.mjs browser` | 0 | 16 engine checks each in Vite and production browser; PNG/SVG/JPG/WebP, hostile SVG, cancellation and GLB |
| `npm run test:e2e:smoke` | 0 | 2 passed; configured-login case skipped because no Supabase environment is configured here |
| `npm run electron:dev` | 0 | Actual development main/preload boot with `devServer=true`; Vite HTTP 200; then controlled shutdown |
| `node scripts/model-assets/verify-desktop-package.mjs` | 0 | Actual unsigned macOS arm64 product directory package launched through app protocol; packaged worker/WASM and GLB export passed |
| SQL fixture, command below | 0 | Actual 0047/0048 + read-only preflight + both security suites passed in disposable PGlite |
| VTracer version/hash check | 0 | Exact 1.0.0-alpha.4; vendored binary matches expected upstream SHA-256 |
| `git diff --check` | 0 | No whitespace errors |

Focused test command:

```bash
npx vitest run \
  src/features/models \
  src/features/media/MediaManagerView.test.tsx \
  src/features/media/MediaManagerModels.test.tsx \
  src/components/vyzualz/media/ModelLibraryCards.test.tsx \
  src/components/vyzualz/media/MediaLibraryBrowser.test.tsx \
  src/components/vyzualz/VyzualzViewMediaGuard.test.tsx \
  src/components/vyzualz/MediaUploadModalFonts.test.tsx \
  src/components/vyzualz/cinema2/model \
  src/components/vyzualz/cinema2/__tests__/Cinema2ThreeScene.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2ThreePbr.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2PresetCompiler.test.ts \
  src/components/vyzualz/cinema2/__tests__/Cinema2MainframePreset.test.ts \
  src/stores/cinema2WorkspacePersistence.test.ts \
  -t '^(?!.*(?:keeps audio loading|exposes saved-audio loading|still holds navigation.*lyrics)).*'
```

SQL command used an already available disposable module, without installing a
production dependency:

```bash
DRMVYZ_MODEL_PGLITE_MODULE=/tmp/drmvyz-model-sql/package/dist/index.js \
  node scripts/model-assets/verify-sql-fixture.mjs
```

The two skipped MediaLibraryBrowser cases have stale saved-audio loader argument
expectations; the skipped lyrics-navigation case has a stale dialog expectation.
They were documented before this phase. The earlier Inspector jsdom suite's
unsupported `hidePopover` failure was not repeated; real Chromium inspector
interactions have been exercised. Global lint and hygiene failures are release
blockers, not evidence that all repository checks passed.

## Workflow acceptance matrix

“Fixture” means actual source/UI/WebGL/GLB with only the remote service boundary
replaced. Prior-phase evidence is explicitly identified and was not recaptured
without a relevant change.

| ID | Evidence and status |
| --- | --- |
| E2E-01 | PNG hole extrusion passed in current Vite/production engine checks; manager entry covered in Phase 03. |
| E2E-02 | SVG direct route and holes passed in engine and current editor workflow. |
| E2E-03 | JPG/WebP real decoding/foreground preparation passed now; opaque confirmation and canonical upload UI have Phase 03 evidence. |
| E2E-04 | Orbit/zoom/pan/reset/rail resize and context recovery passed in Phase 03 browser evidence; owner hardware interaction remains to be accepted. |
| E2E-05 | Current editor changes depth, bevel, gold/clay/chrome, clearcoat and opacity; regenerated and saved binary/material checks passed. Broader emission controls have focused unit/Phase 04 coverage. |
| E2E-06 | Four real artifact blobs and publish/re-download verification passed with HTTP persistence fixture. **Authenticated private Storage publish remains pending.** |
| E2E-07 | Browser reload restores recipe, metadata, favorite, tags and collections in fixture. **Real logout/login and cloud reopen pending.** |
| E2E-08 | Three immutable original versions and independent Save As history passed with fixture; SQL expected-version conflicts passed. Live service concurrency pending. |
| E2E-09 | Real GLB download byte size/header matched persisted bytes; independent GLTFLoader geometry/PBR verification passed. |
| E2E-10 | Current flow removes original source, loads saved GLB in Cinema and reopens editable source snapshot successfully. Live deletion remains owner's test. |
| E2E-11 | Same editor-saved GLB loaded in all six real native presets with no module diagnostics; contact sheet reviewed. |
| E2E-12 | Pinned workspace serialization/recreation passed for all six now. Model/Pattern/Palette persistence and visible controls also have Phase 06 WebGL evidence. Live account workspace acceptance pending. |
| E2E-13 | 36 arrangements, exact 11 shared triggers, conditional Trigger, default OFF and fresh-event/manual precedence covered by current focused tests and Phase 06 WebGL evidence. |
| E2E-14 | Shared musical fixture and BPM Sync behavior have Phase 06 real-render coverage. **Representative user music playback/hardware acceptance pending**; no claim of a new real-track listening test. |
| E2E-15 | Missing/unauthorized fallbacks and context recovery have Phase 05/06 browser evidence; resolver expiry refresh is unit tested. Live signed-URL/Storage loss acceptance pending. |
| E2E-16 | Current six switches/restores keep one held private model and one bridge lease; return releases cache to zero. Earlier Phase 06 A/B/A checks bound geometry counts. No long-running hardware memory/frame-time certification. |
| E2E-17 | Focused media/upload/navigation regression tests passed with noted exclusions. **Complete video/crop/drag/drop/audio manual regression remains pending.** |
| E2E-18 | Vite and production browser generation passed; actual development Electron launch and unsigned packaged product WASM/GLB passed. Authenticated packaged model UI, installed/signed builds and Windows/Linux remain untested. |

## Security and native contract

The actual SQL suites verify ownership, cross-owner denial, immutable publication,
organization joins, compare-and-swap conflicts and cleanup state against minimal
Supabase-shaped dependencies. They do **not** validate a complete deployed schema,
GoTrue, PostgREST or Storage HTTP. No live A/B identities were created, per the
owner's instruction. The read-only deployed preflight is ready but has not been
executed against the cloud here.

Current focused tests cover hostile SVG, corrupt/oversize GLB rejection, URI
rejection, URL refresh, interrupted upload/publish recovery and cache account
isolation. The runtime consumes owner-authorized pinned model IDs/versions and
private signed URLs. Existing auth/public renderer configuration is reused;
there is no service-role renderer credential or public model bucket.

The six declarations compile through the native registry and use one shared
`three-scene` path, canonical Design parent groups, four independent palette
roles, shared Mainframe timing and Afterhours triggers. Phase 06 documents the
actual control consumers and proxy limits. The current integrated screenshots
confirm distinct visible representations of the same saved model. Authored model
geometry/materials remain unchanged by preview effects.

## Package and size evidence

The actual unsigned `.app` is at
`/tmp/drmvyz-model-release-package/mac-arm64/DRMVYZ.app`. Its total file bytes are
**799,299,138**; `app.asar` is **510,342,011** bytes. No clean pre-feature package
was built, so **total installer size delta is unmeasured**. Existing generated
asset copies are present in the package; hygiene is not clean.

The current standalone engine entry is **42,825** bytes, VTracer WASM **668,378**
bytes and six public preview artworks total **95,584** bytes. Shared chunks and
worker assets are additional; these figures are not an installer delta. The
packaged real transparent PNG produced **128 triangles / 14,868-byte GLB**.
ASAR contains the engine, WASM, artwork and MIT license. No signed/notarized DMG
or Windows/Linux installer was built or installed.

## Release disposition

| Category | Disposition |
| --- | --- |
| Implemented and verified | Model domain/generation/editor/version/export; real WebGL fixture workflow into six native previews; focused regression, SQL logic, Vite and unsigned macOS product worker/WASM. |
| Implemented, needs live validation | Owner-account cloud save/reopen/logout/login; deployed-schema preflight; real Storage isolation/expiry/network failures; music/hardware and full media regression. No test users are to be created. |
| Deferred | Full Shatter/Dust/Hologram/Slices/Voxel choreography, authored base environment, AI photo-to-3D reconstruction. |
| Blocked | Production acceptance until live gates are recorded and existing global lint/repository hygiene failures are resolved. Signed distribution/other platforms have no acceptance evidence. |

Next: follow the [owner acceptance session](model-migrations.md), record actual
results, and address the unrelated global release failures separately. Do not
describe this report as proof of a production-ready release.
