# Verification and source packaging

## Supported baseline

- Node.js 20, matching CI
- npm with the committed `package-lock.json`
- Chromium installed through Playwright for browser tests

## Clean verification sequence

Run this from a clean checkout:

```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run playwright:install
npm run test:e2e:smoke
npm run audit
```

`npm run verify` runs typecheck, the full Vitest suite, the production build,
Playwright's Chromium installation, the Chromium smoke suite, and the dependency
audit. `npm run verify:clean` prepends a locked `npm ci`; `npm run verify:fast`
omits browser and audit checks for local iteration.

There is currently no ESLint configuration in this repository. Lint is therefore
not represented as a fake pass in the verification chain. Adding a lint policy
should be a separate change with an agreed ruleset and an explicit baseline.

### Vitest concurrency policy

Vitest uses forked workers capped at four processes. The process boundary prevents
timers, DOM resources, and native handles from accumulating in a shared worker
thread across this mixed Node/jsdom suite. The cap also prevents CPU-derived worker
counts from exhausting high-core, low-memory runners. Use `npm run test:diagnose`
when investigating a suspected leaked timer or open handle; it adds Vitest's
hanging-process reporter without changing test timeouts.

### Audit policy

`npm run audit` uses `--audit-level=high`:

- High and critical advisories fail verification.
- Low and moderate advisories are reported and tracked but do not block the build.
- Major upgrades are reviewed explicitly rather than applied through
  `npm audit fix --force`.

## Playwright

Local browser installation is intentionally separate from application runtime
dependencies:

```bash
npm run playwright:install
```

CI uses `npm run playwright:install:ci`, which installs Chromium and its Linux
system dependencies. The smoke suite starts `vite preview` from the production
`dist` directory through `playwright.config.ts`.

## Source archives

First remove generated directories from Git tracking, then commit the cleanup.
Create a source-only archive from a committed ref with:

```bash
npm run package:source
# or package another committed ref
npm run package:source -- v1.2.3
```

The packager uses `git archive`, so untracked files and ignored machine output are
not included. It also refuses to package a ref that still tracks known generated
paths such as `node_modules`, `dist`, `coverage`, logs, or Playwright output.
