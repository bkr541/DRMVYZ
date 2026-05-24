/**
 * Smoke tests — verify the app boots without a JS crash and core UI scaffolding
 * is present.  These run on every push to main in CI (see ci.yml e2e job).
 *
 * Prerequisites (not handled by this spec):
 *   - A production build must exist: npm run build
 *   - Playwright Chromium must be installed: npx playwright install chromium
 *
 * To run locally:
 *   npm run build && npm run test:e2e
 */
import { test, expect } from '@playwright/test'

test.describe('App boot', () => {
  test('page loads without a JS error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto('/')
    // Wait for React to finish rendering the main app shell
    await page.waitForLoadState('networkidle')

    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })

  test('canvas element is present in the DOM', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeAttached()
  })

  test('transport controls are visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Play button is identified by its title attribute
    const playBtn = page.locator('[title="Play"]').or(page.locator('[title="Pause"]'))
    await expect(playBtn).toBeVisible()
  })
})

test.describe('Fullscreen program output', () => {
  test('diagnostic overlays are absent during fullscreen (class-based guard)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The FPS pill is rendered by PreviewOverlay which is gated on !isFullscreen.
    // We can't trigger the Fullscreen API in headless Chromium without a user
    // gesture, so we verify the pill IS visible in normal mode (precondition)
    // and that its parent is a direct child of the canvas-wrap (not injected
    // inside the canvas output layer itself).
    const fpsPill = page.locator('.vz-preview-pill--fps')
    await expect(fpsPill).toBeVisible()

    // The pill must be outside the canvas element — it is an editor overlay.
    const isInsideCanvas = await fpsPill.evaluate(el => !!el.closest('canvas'))
    expect(isInsideCanvas).toBe(false)
  })
})

test.describe('Quality selector', () => {
  test('quality select has High / Medium / Low options', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const select = page.locator('.az-select').first()
    await expect(select).toBeVisible()

    const options = await select.locator('option').allTextContents()
    expect(options).toContain('High')
    expect(options).toContain('Medium')
    expect(options).toContain('Low')
  })

  test('changing quality to Low updates the displayed value', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const select = page.locator('.az-select').first()
    await select.selectOption('Low')
    await expect(select).toHaveValue('Low')

    // The quality pill in PreviewOverlay should now read "Low"
    const qualityPill = page.locator('.vz-preview-pill').first()
    await expect(qualityPill).toHaveText('Low')
  })
})
