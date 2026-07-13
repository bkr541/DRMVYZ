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
export default defineConfig({
  testDir: 'src/test/e2e',
  testMatch: '**/*.spec.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    // The dev server must be running or the build must be served.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173',
    trace:   'on-first-retry',
    video: process.env.DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW === '1' ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Normal E2E runs use the production preview server. The deterministic
  // Show Director review injects an offline browser bundle and needs no server.
  webServer: process.env.DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW === '1' ? undefined : {
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
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
})
