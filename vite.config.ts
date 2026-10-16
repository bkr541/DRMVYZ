/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset URLs let the built renderer resolve its own JS/CSS bundle
  // entrypoints when Electron serves dist/ through the app's custom protocol
  // (see electron/main.cjs) instead of the dev server's HTTP origin.
  base: './',
  plugins: [react()],
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
