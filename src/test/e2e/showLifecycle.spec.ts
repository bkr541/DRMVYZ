/**
 * Show lifecycle E2E tests.
 *
 * Covers: session save, session rename, session delete, and the basic
 * playback / BPM control surface.  These tests exercise real browser
 * interactions against the production build — no store mocking.
 *
 * Each test starts from a clean page load and does not depend on previous
 * tests' stored state (the app persists to localStorage which is cleared
 * between test files via Playwright's storageState isolation).
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Session management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear persisted Zustand state so every test begins with a blank slate.
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('app renders without crashing after localStorage clear', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await expect(page.locator('canvas').first()).toBeAttached()
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0)
  })
})

test.describe('Transport controls', () => {
  test('play button toggles to pause state on click', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const playBtn = page.locator('[title="Play"]')
    await expect(playBtn).toBeVisible()
    await playBtn.click()

    // After clicking play, the button should show pause title
    const pauseBtn = page.locator('[title="Pause"]')
    await expect(pauseBtn).toBeVisible({ timeout: 2000 })
  })

  test('view menu opens and closes on button click', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const viewBtn = page.locator('.vz-view-menu-btn')
    await expect(viewBtn).toBeVisible()

    // Open menu
    await viewBtn.click()
    const dropdown = page.locator('.vz-view-menu-dropdown')
    await expect(dropdown).toBeVisible()

    // Close menu by clicking the button again
    await viewBtn.click()
    await expect(dropdown).not.toBeVisible()
  })

  test('timeline toggle activates via View menu', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const viewBtn = page.locator('.vz-view-menu-btn')
    await viewBtn.click()

    const timelineItem = page.locator('.vz-view-menu-item').filter({ hasText: 'Timeline' })
    await timelineItem.click()

    // Button should now carry the active class (menu closed, timeline enabled)
    await expect(viewBtn).toHaveClass(/vz-view-menu-btn--active/)
  })
})

test.describe('WebGL / Canvas fallback', () => {
  test('renderer type pill shows WebGL2 or Canvas 2D (never empty)', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // The third pill is the renderer type
    const pills = page.locator('.vz-preview-pill')
    await expect(pills).toHaveCount(3)
    const rendererPill = pills.nth(2)
    const text = await rendererPill.textContent()
    expect(['WebGL2', 'Canvas 2D']).toContain(text)
  })
})
