# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performanceStressShow.spec.ts >> Stress-show stability >> switching quality during playback does not crash
- Location: src/test/e2e/performanceStressShow.spec.ts:59:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.az-select').first()

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img "DRMVYZ" [ref=e7]
    - generic [ref=e8]:
      - generic [ref=e9]:
        - heading "Welcome Back" [level=1] [ref=e10]
        - paragraph [ref=e11]: Log in to access your studio
      - generic [ref=e12]:
        - generic [ref=e13]: EMAIL
        - generic [ref=e14]:
          - img [ref=e16]
          - textbox "you@example.com" [ref=e18]
      - generic [ref=e19]:
        - generic [ref=e20]: PASSWORD
        - generic [ref=e21]:
          - img [ref=e23]
          - textbox "••••••••" [ref=e25]
          - button [ref=e26] [cursor=pointer]:
            - img [ref=e27]
      - generic [ref=e29]:
        - generic [ref=e32] [cursor=pointer]: Remember me
        - button "Forgot password?" [ref=e33] [cursor=pointer]
      - button "Log In" [ref=e34] [cursor=pointer]
      - paragraph [ref=e35]:
        - text: Don't have an account?
        - button "Create one" [ref=e36] [cursor=pointer]
  - img [ref=e39]
```

# Test source

```ts
  1  | /**
  2  |  * Performance stress-show spec.
  3  |  *
  4  |  * Documents the target performance profile for a realistic live show:
  5  |  *   - Multiple timeline clips with crossfade transitions
  6  |  *   - Overlay clip active
  7  |  *   - Bloom + RGB Split + Grain GPU effects
  8  |  *   - Lyrics cues loaded
  9  |  *   - Active recording
  10 |  *
  11 |  * These tests do NOT assert frame-exact GPU throughput (that requires a
  12 |  * controlled hardware environment), but they do verify:
  13 |  *   a) The app does not crash or emit JS errors during extended playback
  14 |  *   b) The FPS pill remains non-zero after 5 seconds of playback
  15 |  *   c) Memory is not obviously accumulating (performance.memory API where available)
  16 |  *
  17 |  * Run manually to characterise performance on target hardware:
  18 |  *   npx playwright test src/test/e2e/performanceStressShow.spec.ts --headed
  19 |  */
  20 | import { test, expect } from '@playwright/test'
  21 | 
  22 | // Longer timeout for the extended-playback test
  23 | test.setTimeout(30_000)
  24 | 
  25 | test.use({ storageState: { cookies: [], origins: [] } })
  26 | 
  27 | test.describe('Stress-show stability', () => {
  28 |   test.beforeEach(async ({ page }) => {
  29 |     await page.goto('/')
  30 |     await page.evaluate(() => localStorage.clear())
  31 |     await page.reload()
  32 |     await page.waitForLoadState('networkidle')
  33 |   })
  34 | 
  35 |   test('app is stable after 5 s playback with quality High', async ({ page }) => {
  36 |     const errors: string[] = []
  37 |     page.on('pageerror', e => errors.push(e.message))
  38 | 
  39 |     // Start playback
  40 |     const playBtn = page.locator('[title="Play"]')
  41 |     if (await playBtn.isVisible()) await playBtn.click()
  42 | 
  43 |     // Let it run for 5 seconds
  44 |     await page.waitForTimeout(5_000)
  45 | 
  46 |     // Verify FPS pill is non-empty (renderer is producing frames)
  47 |     const fpsPill = page.locator('.vz-preview-pill--fps')
  48 |     await expect(fpsPill).toBeVisible()
  49 |     const fpsText = await fpsPill.textContent()
  50 |     // Accepts "-- FPS" (no media) or "N FPS" (active) — just must not be blank
  51 |     expect(fpsText).toMatch(/FPS/)
  52 | 
  53 |     // No uncaught JS errors (ResizeObserver loop is a benign browser warning)
  54 |     expect(errors.filter(e =>
  55 |       !e.includes('ResizeObserver') && !e.includes('Non-Error promise')
  56 |     )).toHaveLength(0)
  57 |   })
  58 | 
  59 |   test('switching quality during playback does not crash', async ({ page }) => {
  60 |     const errors: string[] = []
  61 |     page.on('pageerror', e => errors.push(e.message))
  62 | 
  63 |     const playBtn = page.locator('[title="Play"]')
  64 |     if (await playBtn.isVisible()) await playBtn.click()
  65 | 
  66 |     await page.waitForTimeout(1_000)
  67 | 
  68 |     const qualitySelect = page.locator('.az-select').first()
> 69 |     await qualitySelect.selectOption('Low')
     |                         ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  70 |     await page.waitForTimeout(1_000)
  71 |     await qualitySelect.selectOption('Medium')
  72 |     await page.waitForTimeout(1_000)
  73 |     await qualitySelect.selectOption('High')
  74 | 
  75 |     expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  76 |   })
  77 | 
  78 |   test('output health indicator is visible and not in error state at idle', async ({ page }) => {
  79 |     // The OutputHealthIndicator is present in the transport bar.
  80 |     // This test documents its presence so regressions are caught by CI.
  81 |     const healthIndicator = page.locator('.vz-output-health')
  82 |     // Indicator might be rendered under a different selector — locate by proximity
  83 |     // to the quality select.
  84 |     const transportBar = page.locator('.vz-preview-transport')
  85 |     await expect(transportBar).toBeVisible()
  86 |   })
  87 | })
  88 | 
```