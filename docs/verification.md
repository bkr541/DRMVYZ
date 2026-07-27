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
2. ESLint
3. TypeScript type-checking
4. Node native tests
5. The partitioned Vitest suite
6. The production build

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
npm run test:pix-grid:perceptual
```

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
