/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { arcAngelPreviewPlugin } from './src/dev/arcAngelPreviewPlugin.ts'
import { reviewNotesPlugin } from './src/dev/reviewNotes/reviewNotesPlugin.ts'
import { contentSecurityPolicyPlugin } from './src/dev/contentSecurityPolicyPlugin.ts'

// Which build a tester is running (beta remediation DEP-03): the package version, the commit and when it was built, shown in Settings and sent
// with issue reports (src/lib/buildInfo.ts).
function readBuildInfo() {
  const version = String(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version)
  let commit = 'unknown'
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
    if (execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) commit += '-modified'
  } catch { /* Not a git checkout: the commit stays unknown. */ }
  return { version, commit, builtAt: new Date().toISOString() }
}

export default defineConfig({
  define: { __STAGELESS_BUILD__: JSON.stringify(readBuildInfo()) },
  // Relative asset URLs let the built renderer resolve its own JS/CSS bundle
  // entrypoints when Electron serves dist/ through the app's custom protocol
  // (see electron/main.cjs) instead of the dev server's HTTP origin.
  base: './',
  // Development only: the review notes endpoints (see docs/review-notes.md). `apply: 'serve'` keeps them out of every build.
  // Production only: the Content Security Policy in every built page (`apply: 'build'`).
  plugins: [react(), reviewNotesPlugin(), arcAngelPreviewPlugin(), contentSecurityPolicyPlugin()],
  server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.asset-sources/**'] } },
  // Standalone generation engine: Phase 03 can import it lazily without adding
  // tracing or WASM to the app's initial renderer bundle.
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        modelGenerator: fileURLToPath(new URL('./src/features/models/generator/createModelArtifact.ts', import.meta.url)),
      },
      preserveEntrySignatures: 'exports-only',
      output: { entryFileNames: chunk => chunk.name === 'modelGenerator' ? 'assets/model-generator.js' : 'assets/[name]-[hash].js' },
    },
  },
  // Cinema 2.0 intentionally loads Three.js only when a 3D preset is selected.
  // Keep every package entry used by that lazy path in Vite's initial dependency
  // optimization pass. Otherwise the first activation after a backend dependency
  // change can trigger a mid-session re-optimization/reload, leaving all Three.js
  // presets in their recoverable "module could not load" state.
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/environments/RoomEnvironment.js',
      'three/examples/jsm/libs/meshopt_decoder.module.js',
      'three/examples/jsm/lights/RectAreaLightUniformsLib.js',
      'three/examples/jsm/loaders/DRACOLoader.js',
      'three/examples/jsm/loaders/EXRLoader.js',
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/loaders/HDRLoader.js',
      'three/examples/jsm/loaders/KTX2Loader.js',
      'three/examples/jsm/postprocessing/SMAAPass.js',
      'three/examples/jsm/shaders/FXAAShader.js',
      'three/examples/jsm/shaders/SMAAShader.js',
      'three/examples/jsm/utils/SkeletonUtils.js',
    ],
  },
  test: {
    // Global setup: localStorage stub + noise suppression for every test file.
    setupFiles: ['src/test/setup.ts'],

    // Default environment for unit/renderer tests (no DOM needed).
    environment: 'node',

    // Use process isolation so timers, DOM resources, and native handles cannot
    // keep a shared worker thread alive after a test file completes. Bound the
    // pool because CPU-derived fan-out overwhelms high-core, low-memory runners.
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 4,

    // E2E specs are Playwright-only, and native/**/*.test.cjs specs run under
    // Node's built-in test runner (npm run test:native) — Vitest must not collect either.
    exclude: ['**/node_modules/**', 'src/test/e2e/**', 'native/**', 'supabase/functions/**'],

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.bench.ts',
        'src/test/**',
        'src/main.tsx',
        // Shader strings — GLSL source, not executable JS.
        'src/renderers/shaders.ts',
      ],
      reporter: ['text', 'lcov', 'html'],
      // Coverage floors — set to current baselines; raise incrementally as tests grow.
      // Run `npm run test:coverage` to see per-file breakdown before tightening.
      thresholds: {
        lines:      8,
        functions: 30,
        branches:  60,
        statements: 8,
      },
    },
  },
})
