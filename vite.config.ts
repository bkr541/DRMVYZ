/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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

    // E2E specs are Playwright-only — Vitest must not collect them.
    exclude: ['**/node_modules/**', 'src/test/e2e/**'],

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
