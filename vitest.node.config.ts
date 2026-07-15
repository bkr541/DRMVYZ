/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const DOM_TS_TESTS = [
  'src/components/vyzualz/hooks/__tests__/useWaveformPeaks.test.ts',
  'src/components/vyzualz/media/generateThumbnail.test.ts',
  'src/components/vyzualz/react/CanvasControlsContract.test.ts',
  'src/components/vyzualz/react/__tests__/ReactPerformanceActions.test.ts',
  'src/components/vyzualz/react/renderers/CanvasParticleAuraRenderer.test.ts',
  'src/features/lyrics/components/AiLyricExtractor.test.ts',
  'src/features/personalization/__tests__/appAccentPersonalization.test.ts',
  'src/features/rekordboxImport/nativeBridge.test.ts',
  'src/stores/mediaManagerWorkflows.test.ts',
]

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'node-unit',
    setupFiles: ['src/test/setup.ts'],
    environment: 'node',
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 4,
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      'src/test/e2e/**',
      'native/**',
      'supabase/functions/**',
      ...DOM_TS_TESTS,
    ],
  },
})
