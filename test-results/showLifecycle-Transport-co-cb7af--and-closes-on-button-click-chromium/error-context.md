# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: showLifecycle.spec.ts >> Transport controls >> view menu opens and closes on button click
- Location: src/test/e2e/showLifecycle.spec.ts:47:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.vz-view-menu-btn')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.vz-view-menu-btn')

```

```yaml
- img "DRMVYZ"
- heading "Welcome Back" [level=1]
- paragraph: Log in to access your studio
- text: EMAIL
- img
- textbox "you@example.com"
- text: PASSWORD
- img
- textbox "••••••••"
- button:
  - img
- text: Remember me
- button "Forgot password?"
- button "Log In"
- paragraph:
  - text: Don't have an account?
  - button "Create one"
```

# Test source

```ts
  1  | /**
  2  |  * Show lifecycle E2E tests.
  3  |  *
  4  |  * Covers: session save, session rename, session delete, and the basic
  5  |  * playback / BPM control surface.  These tests exercise real browser
  6  |  * interactions against the production build — no store mocking.
  7  |  *
  8  |  * Each test starts from a clean page load and does not depend on previous
  9  |  * tests' stored state (the app persists to localStorage which is cleared
  10 |  * between test files via Playwright's storageState isolation).
  11 |  */
  12 | import { test, expect } from '@playwright/test'
  13 | 
  14 | test.use({ storageState: { cookies: [], origins: [] } })
  15 | 
  16 | test.describe('Session management', () => {
  17 |   test.beforeEach(async ({ page }) => {
  18 |     // Clear persisted Zustand state so every test begins with a blank slate.
  19 |     await page.goto('/')
  20 |     await page.evaluate(() => localStorage.clear())
  21 |     await page.reload()
  22 |     await page.waitForLoadState('networkidle')
  23 |   })
  24 | 
  25 |   test('app renders without crashing after localStorage clear', async ({ page }) => {
  26 |     const errors: string[] = []
  27 |     page.on('pageerror', e => errors.push(e.message))
  28 |     await expect(page.locator('canvas').first()).toBeAttached()
  29 |     expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  30 |   })
  31 | })
  32 | 
  33 | test.describe('Transport controls', () => {
  34 |   test('play button toggles to pause state on click', async ({ page }) => {
  35 |     await page.goto('/')
  36 |     await page.waitForLoadState('networkidle')
  37 | 
  38 |     const playBtn = page.locator('[title="Play"]')
  39 |     await expect(playBtn).toBeVisible()
  40 |     await playBtn.click()
  41 | 
  42 |     // After clicking play, the button should show pause title
  43 |     const pauseBtn = page.locator('[title="Pause"]')
  44 |     await expect(pauseBtn).toBeVisible({ timeout: 2000 })
  45 |   })
  46 | 
  47 |   test('view menu opens and closes on button click', async ({ page }) => {
  48 |     await page.goto('/')
  49 |     await page.waitForLoadState('networkidle')
  50 | 
  51 |     const viewBtn = page.locator('.vz-view-menu-btn')
> 52 |     await expect(viewBtn).toBeVisible()
     |                           ^ Error: expect(locator).toBeVisible() failed
  53 | 
  54 |     // Open menu
  55 |     await viewBtn.click()
  56 |     const dropdown = page.locator('.vz-view-menu-dropdown')
  57 |     await expect(dropdown).toBeVisible()
  58 | 
  59 |     // Close menu by clicking the button again
  60 |     await viewBtn.click()
  61 |     await expect(dropdown).not.toBeVisible()
  62 |   })
  63 | 
  64 |   test('timeline toggle activates via View menu', async ({ page }) => {
  65 |     await page.goto('/')
  66 |     await page.waitForLoadState('networkidle')
  67 | 
  68 |     const viewBtn = page.locator('.vz-view-menu-btn')
  69 |     await viewBtn.click()
  70 | 
  71 |     const timelineItem = page.locator('.vz-view-menu-item').filter({ hasText: 'Timeline' })
  72 |     await timelineItem.click()
  73 | 
  74 |     // Button should now carry the active class (menu closed, timeline enabled)
  75 |     await expect(viewBtn).toHaveClass(/vz-view-menu-btn--active/)
  76 |   })
  77 | })
  78 | 
  79 | test.describe('WebGL / Canvas fallback', () => {
  80 |   test('renderer type pill shows WebGL2 or Canvas 2D (never empty)', async ({ page }) => {
  81 |     await page.goto('/')
  82 |     await page.waitForLoadState('networkidle')
  83 | 
  84 |     // The third pill is the renderer type
  85 |     const pills = page.locator('.vz-preview-pill')
  86 |     await expect(pills).toHaveCount(3)
  87 |     const rendererPill = pills.nth(2)
  88 |     const text = await rendererPill.textContent()
  89 |     expect(['WebGL2', 'Canvas 2D']).toContain(text)
  90 |   })
  91 | })
  92 | 
```