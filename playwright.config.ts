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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173',
    trace:   'on-first-retry',
    video:   'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Launch a preview server from the production build before running tests.
  webServer: {
    command: 'npm run preview',
    url:     'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
