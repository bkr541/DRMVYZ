# Verification and source packaging

## Supported baseline

- Node.js `>=22.12 <23`, matching `package.json`, `.nvmrc`, and CI
- npm with the committed `package-lock.json`
- Chromium installed through Playwright for browser smoke tests
- Deno only when running Supabase Edge Function tests

Do not use Node 20 for the current dependency graph. The package engine declaration is the runtime authority.

## Canonical commands

### Fast local verification

```bash
npm run verify:fast
```

`verify:fast` runs:

1. Repository hygiene
2. The zero-import legacy Cinema boundary check
3. Cinema 2.0 asset and decoder integrity checks
4. Asset-tool tests
5. ESLint
6. TypeScript type-checking
7. Node native tests
8. The partitioned Vitest suite
9. The production build

### Full verification

```bash
npm run verify
```

`verify` runs `verify:fast`, installs Playwright Chromium, runs the Chromium smoke suite, and performs the high/critical dependency audit.

### Clean locked verification

```bash
npm run verify:clean
```

`verify:clean` starts with `npm ci` and then runs the full verification chain. Use it for release evidence and after changing dependencies or the lockfile.

## Expanded clean sequence

The equivalent explicit sequence is:

```bash
npm ci
npm run repo:hygiene
npm run cinema:legacy-boundary:check
npm run assets:check
npm run cinema2:decoders:check
npm run test:assets
npm run lint
npm run typecheck
npm run test:native
npm run test
npm run build
npm run playwright:install
npm run test:e2e:smoke
npm run audit
```

The scripts in `package.json` are the command authority. Update this document and CI in the same patch whenever the sequence changes.

The Cinema boundary check must continue to report zero importers even while the
data-only historical persistence decoder is retained. It rejects source imports
of the deleted runtime; migration identifiers and archived fixture data are not
runtime imports.

## Test partitioning and concurrency

`npm run test` uses `scripts/run-vitest-partitions.mjs` to separate Node and DOM-oriented partitions.

Vitest uses forked workers capped at four processes. Process boundaries prevent timers, DOM resources, and native handles from accumulating in one shared worker across the mixed Node/jsdom suite. The cap also prevents CPU-derived worker counts from exhausting high-core, low-memory runners.

Use:

```bash
npm run test:diagnose
```

when investigating a suspected leaked timer or open handle. It adds Vitest's hanging-process reporter without changing production timeouts.

## Specialized verification

### LaserDMX physical rendering

```bash
npm run verify:laser-dmx:physical
npm run verify:laser-dmx:programming
```

The WebGL visual-review scripts generate evidence but do not replace human review where the relevant acceptance document requires it.

### PixGrid

```bash
npm run verify:pix-grid:final
npm run verify:pix-grid:deck
npm run test:pix-grid:perceptual
```

`verify:pix-grid:deck` is the stable release alias for the full PixGrid verification chain. Its real Show Manager harness creates a 12-image Deck, loads a selected Audio Track, compiles through the worker/runtime path, creates and selects the generated Preset, then exports and imports source media before revalidating compiler and transition readiness.

The perceptual suite includes rendered-pixel response and the structural-choreography magnitude contract.

Screen-recording acceptance requires a real evidence manifest:

```bash
npm run verify:pix-grid:recording -- path/to/manifest.json
npm run verify:pix-grid:release -- path/to/manifest.json
```

Do not report the recording or release gate as complete without real recording files and reviewer signoff. See `docs/PIXGRID_SCREEN_RECORDING_ACCEPTANCE.md`.

### Supabase Edge Functions

```bash
npm run test:edge
```

This requires Deno and any environment assumptions declared by the Edge Function tests.

## Playwright

Local browser installation is intentionally separate from application runtime dependencies:

```bash
npm run playwright:install
```

CI uses:

```bash
npm run playwright:install:ci
```

which installs Chromium and its Linux system dependencies. The smoke suite starts `vite preview` from the production `dist` directory through `playwright.config.ts`.

## Audit policy

`npm run audit` uses `--audit-level=high`:

- High and critical advisories fail verification.
- Low and moderate advisories are reported and tracked but do not block the build.
- Major upgrades are reviewed explicitly rather than applied through `npm audit fix --force`.

## CI contract

`.github/workflows/ci.yml` must use a Node version accepted by `package.json`.

The main CI job performs:

- Locked install
- Repository hygiene
- Lint
- Type-check
- Node native tests
- Partitioned Vitest tests
- Production build
- Dependency audit

Coverage and Chromium smoke jobs use the same Node baseline.

## Source archives

Create a source-only archive from a committed ref:

```bash
npm run package:source
# or package another committed ref
npm run package:source -- v1.2.3
```

The packager uses `git archive`, so untracked files and ignored machine output are excluded. It refuses to package a ref that tracks known generated paths such as `node_modules`, `dist`, `coverage`, logs, release output, or Playwright output.

To clear local generated output:

```bash
npm run clean:generated
```

To also remove installed dependencies:

```bash
npm run clean:all
```

See `docs/source-packaging.md`.

### MUTAGEN production smoke

With Node 22 and Playwright Chromium installed, start the existing Vite server
(`npm run dev -- --host 127.0.0.1`) and run:

```bash
node scripts/validate-mutagen-production-browser.mjs
```

`MUTAGEN_BASE_URL` defaults to `http://127.0.0.1:5173`.
`MUTAGEN_OUTPUT_DIR` defaults to `/tmp/mutagen-production-validation`.
`MUTAGEN_SOAK_SECONDS` defaults to 60 seconds of real browser playback; raise it
for an endurance run. Synthetic fixtures require no external image/audio service.
The script mounts the real CANVAS surface/stores and uses WebGL2, generated media,
a known deterministic Shared Performance context, Canvas2D pixel comparisons and
MediaRecorder. It writes all patterns, original/low/high strength, arrangement and
failure captures, a contact sheet, WebM, live/output parity captures and JSON GPU
profiles at 720p/1080p/4K logical sizes (Auto may internally downscale).

Assertions cover clean reconstruction, alpha and transforms/aspect extremes,
Auto shader/history budgets, stable allocations after warmup, pause/seek/resize,
context loss with one restoration retry, unavailable WebGL2 and shader failure,
signed/expired/deleted media, authored/Show priority, source/preset manual locks,
rapid preset disposal, the canonical preset card/modified badge and persisted
recipe/media ID after reload. Pixel reads and `gl.finish` are confined to the
validation harness. Timings identify the actual Chromium GL driver and do not
promise hardware-independent frame rates. This does not exercise native Electron
cast windows, authenticated cloud scope or prolonged hardware endurance.

### Data Bleed browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-data-bleed-browser.mjs
```

Set `DATA_BLEED_BASE_URL` to override `http://127.0.0.1:5173` and
`DATA_BLEED_OUTPUT_DIR` to override `/tmp/data-bleed-validation`.
`DATA_BLEED_SOAK_SECONDS` defaults to 60. Use 1 for a short functional check.

The harness generates image and video fixtures, exercises the CANVAS surface,
compares live preview and published output, and checks seek/freeze, media
replacement, renderer fallback, owner handoff, and persistence. It saves PNG
captures, a WebM recording, and a report with GPU diagnostics. Run focused unit
tests with `npx vitest run src/components/vyzualz/react/renderers/dataBleed`.

### Phase Drag browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-phase-drag-browser.mjs
```

Set `PHASE_DRAG_BASE_URL` to override `http://127.0.0.1:5173` and
`PHASE_DRAG_OUTPUT_DIR` to override `/tmp/phase-drag-validation`. The check
uses generated frames and a local WebM fixture to verify GPU temporal sampling,
scan fields, reconstruction, and CANVAS preview and frozen video seek behavior.


### Cellular browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-cellular-browser.mjs
```

Set `CELLULAR_BASE_URL` to override `http://127.0.0.1:5173` and
`CELLULAR_OUTPUT_DIR` to override `/tmp/cellular-validation`. The check generates
an alpha PNG, compares two feed/kill regimes, and verifies alpha expansion,
native reconstruction, processed CANVAS screenshots, pause and reseed.


### Terminal browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-terminal-browser.mjs
```

Set `TERMINAL_BASE_URL` to override `http://127.0.0.1:5173` and
`TERMINAL_OUTPUT_DIR` to override `/tmp/terminal-validation`. The check generates
an alpha PNG and a moving WebM fixture. It verifies glyph density, transparency,
seeded substitutions, fit, native reconstruction, processed CANVAS screenshots,
context-loss fallback and recovery, and decoded video updates, pause and seek.


### Fluidity browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-fluidity-browser.mjs
```

Set `FLUIDITY_BASE_URL` to override `http://127.0.0.1:5173` and
`FLUIDITY_OUTPUT_DIR` to override `/tmp/fluidity-validation`. The check compares
all four surfaces on a transparent PNG and an opaque JPEG. It exercises
reconstruction, dispersion gating, audio pressure, Auto sizes, CANVAS preview
and screenshot capture, browser recording, decoded video, resize, context
recovery and authored and Show ownership. It saves a contact sheet and WebM.


### Divinity browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-divinity-browser.mjs
```

Set `DIVINITY_BASE_URL` to override `http://127.0.0.1:5173` and
`DIVINITY_OUTPUT_DIR` to override `/tmp/divinity-validation`. The check compares
luminance and alpha masks, origin direction, alpha expansion and clipping,
manual tint, musical accents, clean reconstruction, preview and capture. It
also exercises browser recording, decoded video, resize, context recovery,
and authored and Show ownership. It saves a contact sheet and WebM.


### VHS browser smoke

With Node 22, Playwright Chromium and the Vite dev server running:

```bash
node scripts/validate-vhs-browser.mjs
```

Set `VHS_BASE_URL` to override `http://127.0.0.1:5173` and
`VHS_OUTPUT_DIR` to override `/tmp/vhs-validation`. The check compares Tape,
CRT and Hybrid on the same color chart and transparent logo. It exercises
seeded reconstruction, phosphor warmup and reset, control visibility, preview
and capture, browser recording, decoded video, resize, WebGL2 recovery, and
authored and Show ownership. It saves a contact sheet and WebM.


### Private Cinema model runtime (Phase 05)

With Node 22 and Playwright Chromium installed, run
`node scripts/model-assets/verify-cinema-runtime.mjs`. It mounts the actual
Cinema2Runtime/three-scene bridge and generic model inspector with local
Auth/repository boundary fixtures. Evidence is written to the ignored
`artifacts/model-runtime-phase05/` directory. It validates render switching,
resource release, palette reset, pinned workspace restore, context recovery and
safe denial/deletion fallbacks. It does not deploy Supabase or establish cloud
end-to-end acceptance; see [model-runtime-phase05.md](model-runtime-phase05.md).


### Six model reference previews (Phase 06)

`node scripts/model-assets/verify-previews.mjs` validates the six actual Cinema
reference presets and their 36 patterns using WebGL and a local repository/Auth
fixture. `--controls-only` runs focused scalar minimum/mid/maximum checks.
`--thumbnails` refreshes the public, neutral default-model WebP artwork after
the full checks pass. Evidence is written to ignored
`artifacts/model-preview-phase06/`. See [model-preview-phase06.md](model-preview-phase06.md)
for scope and cloud/human acceptance gates. This script does not deploy a
Supabase migration or validate cloud storage credentials.

### Model release acceptance (Phase 07)

`node scripts/model-assets/verify-editor.mjs --release` extends the real Media
Manager workflow to use the same saved GLB in all six native Cinema previews,
restore pinned workspace state, return to the manager and reopen after original
source deletion. Only the remote repository boundary is a local HTTP fixture.
`node scripts/model-assets/verify-generator.mjs browser` exercises VTracer,
source formats, SVG rejection and GLB export in Vite and production bundles.

The unsigned macOS arm64 product package check is
`node scripts/model-assets/verify-desktop-package.mjs`. Set
`DRMVYZ_MODEL_ELECTRON_DISTRIBUTION` to the matching cached Electron distribution
and `DRMVYZ_MODEL_PACKAGE_OUTPUT` to a disposable directory. It uses the actual
builder configuration/main/preload, launches the packaged product, checks the
setup gate, and executes the packaged VTracer worker/WASM and GLB export. It does
not publish, sign or notarize an installer. Run `npm run build` first.

`scripts/model-assets/verify-sql-fixture.mjs` requires an existing disposable
PGlite module through `DRMVYZ_MODEL_PGLITE_MODULE`. It tests the model migrations
and security SQL against minimal Supabase-shaped dependencies. The separate
`supabase/tests/model_release_preflight.sql` is a read-only deployed-schema
catalog check. See [model-migrations.md](model-migrations.md) before using either.

Evidence is under ignored `artifacts/model-release-phase07/`. Actual results,
baseline failures and the still-pending authenticated cloud gate are recorded in
[model-release-phase07.md](model-release-phase07.md).
