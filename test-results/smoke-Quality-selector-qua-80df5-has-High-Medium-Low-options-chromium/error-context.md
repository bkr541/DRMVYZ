# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Quality selector >> quality select has High / Medium / Low options
- Location: src/test/e2e/smoke.spec.ts:62:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.az-select').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.az-select').first()

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
  2  |  * Smoke tests — verify the app boots without a JS crash and core UI scaffolding
  3  |  * is present.  These run on every push to main in CI (see ci.yml e2e job).
  4  |  *
  5  |  * Prerequisites (not handled by this spec):
  6  |  *   - A production build must exist: npm run build
  7  |  *   - Playwright Chromium must be installed: npx playwright install chromium
  8  |  *
  9  |  * To run locally:
  10 |  *   npm run build && npm run test:e2e
  11 |  */
  12 | import { test, expect } from '@playwright/test'
  13 | 
  14 | test.describe('App boot', () => {
  15 |   test('page loads without a JS error', async ({ page }) => {
  16 |     const errors: string[] = []
  17 |     page.on('pageerror', e => errors.push(e.message))
  18 | 
  19 |     await page.goto('/')
  20 |     // Wait for React to finish rendering the main app shell
  21 |     await page.waitForLoadState('networkidle')
  22 | 
  23 |     expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  24 |   })
  25 | 
  26 |   test('canvas element is present in the DOM', async ({ page }) => {
  27 |     await page.goto('/')
  28 |     await page.waitForLoadState('networkidle')
  29 |     const canvas = page.locator('canvas').first()
  30 |     await expect(canvas).toBeAttached()
  31 |   })
  32 | 
  33 |   test('transport controls are visible', async ({ page }) => {
  34 |     await page.goto('/')
  35 |     await page.waitForLoadState('networkidle')
  36 |     // Play button is identified by its title attribute
  37 |     const playBtn = page.locator('[title="Play"]').or(page.locator('[title="Pause"]'))
  38 |     await expect(playBtn).toBeVisible()
  39 |   })
  40 | })
  41 | 
  42 | test.describe('Fullscreen program output', () => {
  43 |   test('diagnostic overlays are absent during fullscreen (class-based guard)', async ({ page }) => {
  44 |     await page.goto('/')
  45 |     await page.waitForLoadState('networkidle')
  46 | 
  47 |     // The FPS pill is rendered by PreviewOverlay which is gated on !isFullscreen.
  48 |     // We can't trigger the Fullscreen API in headless Chromium without a user
  49 |     // gesture, so we verify the pill IS visible in normal mode (precondition)
  50 |     // and that its parent is a direct child of the canvas-wrap (not injected
  51 |     // inside the canvas output layer itself).
  52 |     const fpsPill = page.locator('.vz-preview-pill--fps')
  53 |     await expect(fpsPill).toBeVisible()
  54 | 
  55 |     // The pill must be outside the canvas element — it is an editor overlay.
  56 |     const isInsideCanvas = await fpsPill.evaluate(el => !!el.closest('canvas'))
  57 |     expect(isInsideCanvas).toBe(false)
  58 |   })
  59 | })
  60 | 
  61 | test.describe('Quality selector', () => {
  62 |   test('quality select has High / Medium / Low options', async ({ page }) => {
  63 |     await page.goto('/')
  64 |     await page.waitForLoadState('networkidle')
  65 | 
  66 |     const select = page.locator('.az-select').first()
> 67 |     await expect(select).toBeVisible()
     |                          ^ Error: expect(locator).toBeVisible() failed
  68 | 
  69 |     const options = await select.locator('option').allTextContents()
  70 |     expect(options).toContain('High')
  71 |     expect(options).toContain('Medium')
  72 |     expect(options).toContain('Low')
  73 |   })
  74 | 
  75 |   test('changing quality to Low updates the displayed value', async ({ page }) => {
  76 |     await page.goto('/')
  77 |     await page.waitForLoadState('networkidle')
  78 | 
  79 |     const select = page.locator('.az-select').first()
  80 |     await select.selectOption('Low')
  81 |     await expect(select).toHaveValue('Low')
  82 | 
  83 |     // The quality pill in PreviewOverlay should now read "Low"
  84 |     const qualityPill = page.locator('.vz-preview-pill').first()
  85 |     await expect(qualityPill).toHaveText('Low')
  86 |   })
  87 | })
  88 | 
```