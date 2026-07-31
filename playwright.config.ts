import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration for DRMVYZ.
 *
 * Requires browsers to be installed:
 *   npx playwright install chromium
 *
 * Run:
 *   npm run test:e2e              — all E2E tests
 *   npx playwright test --ui      — interactive trace viewer
 *   npx playwright show-report    — last HTML report
 *
 * CI: browsers are installed by the e2e job in .github/workflows/ci.yml.
 */
const marqueeRealBrowser = process.env.DRMVYZ_PIX_GRID_MARQUEE_REAL_BROWSER === '1'
const offlineVisualReview = process.env.DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW === '1'
  || process.env.DRMVYZ_SHOW_DIRECTOR_WEBGL_VISUAL === '1'
  || marqueeRealBrowser
const webglVisualReview = process.env.DRMVYZ_SHOW_DIRECTOR_WEBGL_VISUAL === '1'
const forceWebglBrowser = webglVisualReview || marqueeRealBrowser
const recordFailureVideo = !!process.env.CI || process.env.DRMVYZ_PLAYWRIGHT_VIDEO === '1'

export default defineConfig({
  testDir: 'src/test/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: marqueeRealBrowser ? 'artifacts/pix-grid-marquee-real-browser/results' : 'test-results',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: offlineVisualReview ? 0 : process.env.CI ? 1 : 0,
  // Browser and WebGL suites share scarce GPU/context resources; serialize them
  // instead of creating nondeterministic launch storms on developer and CI hosts.
  workers: 1,

  reporter: offlineVisualReview
    ? [['list']]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
      ],

  use: {
    // The dev server must be running or the build must be served.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
    trace:   'on-first-retry',
    video: offlineVisualReview || !recordFailureVideo ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Normal E2E runs use the production preview server. The deterministic
  // Show Director review injects an offline browser bundle and needs no server.
  webServer: offlineVisualReview ? undefined : {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(webglVisualReview ? { headless: process.env.DRMVYZ_WEBGL_HEADLESS === '1' } : {}),
        launchOptions: {
          ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
            : {}),
          ...(forceWebglBrowser ? {
            args: [
              '--enable-webgl',
              '--ignore-gpu-blocklist',
              '--enable-unsafe-swiftshader',
              '--use-angle=swiftshader',
            ],
          } : {}),
        },
      },
    },
  ],
})
