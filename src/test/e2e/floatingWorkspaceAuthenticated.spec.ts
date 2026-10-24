/**
 * Optional real-UI regression smoke: this cannot run in public CI without an
 * explicitly approved authenticated Playwright state. No media, hardware or
 * external output device is required. It does not measure audio/WebGL quality.
 *
 * DRMVYZ_FLOATING_WORKSPACE_BROWSER=1 \
 * DRMVYZ_E2E_AUTH_STORAGE_STATE=/path/to/approved-state.json \
 * npx playwright test src/test/e2e/floatingWorkspaceAuthenticated.spec.ts --project=chromium
 */
import { expect, test, type Page } from '@playwright/test'

const authenticatedState = process.env.DRMVYZ_E2E_AUTH_STORAGE_STATE
const enabled = process.env.DRMVYZ_FLOATING_WORKSPACE_BROWSER === '1' && Boolean(authenticatedState)
test.use({ storageState: authenticatedState ?? { cookies: [], origins: [] } })

test('five floating workspaces preserve app chrome, stage geometry and drawer bounds', async ({ page }: { page: Page }) => {
  test.skip(!enabled, 'Requires opt-in and an approved authenticated Playwright storage state.')
  await page.goto('/')
  await expect(page.locator('.az-nav-item[aria-label="React"]')).toBeVisible({ timeout: 30_000 })

  const routes = [
    { label: 'React', view: 'react', stage: '.rv-canvas-wrap' },
    { label: 'Preset Manager', view: 'presetManager', stage: '.pmv-stage' },
    { label: 'Show Manager', view: 'showManager', stage: '.sm-center' },
    { label: 'Lyric Manager', view: 'lyrics', stage: '.lmv-center' },
    { label: 'Media Manager', view: 'media', stage: '.mmv-stage-area' },
  ] as const

  for (const viewport of [{ width: 1588, height: 960 }, { width: 954, height: 844 }, { width: 800, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.locator(`.az-nav-item[aria-label="${route.label}"]`).click()
      const frame = page.locator(`[data-workspace-layout="floating"][data-app-workspace="${route.view}"]`)
      await expect(frame).toBeVisible({ timeout: 30_000 })
      await expect(frame.locator('.fw-app-header .az-logo')).toHaveCount(1)
      await expect(frame.locator('.fw-app-navigation > .az-sidebar')).toHaveCount(1)
      await expect(frame.locator('.fw-app-header-controls')).toHaveCount(1)
      await expect(page.locator('[data-workspace-layout="floating"]')).toHaveCount(1)

      const stage = frame.locator(route.stage).first()
      await expect(stage).toBeVisible({ timeout: 30_000 })
      const stageBox = await stage.boundingBox()
      expect(stageBox?.width ?? 0).toBeGreaterThan(0)
      expect(stageBox?.height ?? 0).toBeGreaterThan(0)

      // This is a geometric change; its existing stage DOM must not be replaced.
      const originalStage = await stage.elementHandle()
      expect(originalStage).not.toBeNull()
      const brandToggle = frame.locator('.fw-app-header .az-logo')
      const wasExpanded = await brandToggle.getAttribute('aria-expanded') === 'true'
      await brandToggle.click()
      await expect(brandToggle).toHaveAttribute('aria-expanded', String(!wasExpanded))
      expect(await originalStage!.evaluate((element: Element, selector: string) =>
        element === document.querySelector(selector),
      `[data-app-workspace="${route.view}"] ${route.stage}`)).toBe(true)
      await brandToggle.click()
      await expect(brandToggle).toHaveAttribute('aria-expanded', String(wasExpanded))
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(2)

      if (route.view === 'lyrics' && viewport.width <= 954) {
        const drawer = frame.getByRole('button', { name: /Tracks & Versions/ })
        await expect(drawer).toBeVisible()
        await drawer.click()
        await expect(drawer).toHaveAttribute('aria-expanded', 'true')
        const openedRail = frame.locator('.lmv-rail--drawer-open').first()
        const railBounds = await openedRail.boundingBox()
        const frameBounds = await frame.boundingBox()
        expect(railBounds).not.toBeNull()
        expect(frameBounds).not.toBeNull()
        expect(railBounds!.x).toBeGreaterThanOrEqual(frameBounds!.x - 2)
        expect(railBounds!.x + railBounds!.width).toBeLessThanOrEqual(frameBounds!.x + frameBounds!.width + 2)
        await frame.getByRole('button', { name: 'Close tracks and versions' }).click()
        await expect(drawer).toHaveAttribute('aria-expanded', 'false')
      }
    }
  }
})
