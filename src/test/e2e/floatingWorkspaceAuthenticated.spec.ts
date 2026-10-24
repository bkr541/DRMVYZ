/**
 * Optional real-UI regression smoke: this cannot run in public CI without an
 * explicitly approved authenticated Playwright state. No media, hardware or
 * external output device is required. It does not measure audio/WebGL quality.
 *
 * Without BOTH variables below the test is reported as SKIPPED, which is not a
 * pass. See docs/floating-workspace-contract.md ("Browser smoke") for the full
 * procedure (production build, preview origin, storage state).
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
  test.setTimeout(300_000)
  test.skip(!enabled, 'Requires opt-in and an approved authenticated Playwright storage state.')
  await page.goto('/')
  await expect(page.locator('.az-nav-item[aria-label="React"]')).toBeVisible({ timeout: 30_000 })

  interface Route {
    label: string
    view: string
    stage: string
    /** Viewport width at or below which the workspace intentionally hides its stage (Preset Manager: presetManager.css `@media (max-width: 900px)`). */
    hideStageAtOrBelow?: number
    /** The grid that owns the rail collapse state (`data-left-collapsed` / `data-right-collapsed`). */
    rails?: string
    /** Independent floating surfaces that must carry the shared corner radius. */
    surfaces?: string
    /** A performance dock that must sit in its own grid row beneath the stage. */
    dock?: string
    /** The live renderer canvas: the same DOM node must survive every layout change (no remount). */
    canvas?: string
    /** Stage Focus (maximise the live stage) must also keep that canvas node. */
    stageFocus?: boolean
  }
  const routes: Route[] = [
    { label: 'React', view: 'react', stage: '.rv-canvas-wrap', rails: '.rv-layout', dock: '.rv-shell--floating > .az-dock.vz-transport-dock', canvas: '.rv-canvas-wrap canvas', stageFocus: true },
    { label: 'Preset Manager', view: 'presetManager', stage: '.pmv-stage', hideStageAtOrBelow: 900, rails: '.pmv-content', surfaces: '.pmv-content > .fw-surface' },
    { label: 'Show Manager', view: 'showManager', stage: '.sm-center', dock: '.sm-root > .az-dock.vz-transport-dock' },
    { label: 'Lyric Manager', view: 'lyrics', stage: '.lmv-center' },
    { label: 'Media Manager', view: 'media', stage: '.mmv-stage-area', rails: '.mmv-content', surfaces: '.mmv-content > .fw-surface' },
  ]
  const noHorizontalOverflow = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2)

  for (const viewport of [{ width: 1588, height: 960 }, { width: 1280, height: 800 }, { width: 954, height: 844 }, { width: 800, height: 844 }]) {
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
      const stageHidden = route.hideStageAtOrBelow !== undefined && viewport.width <= route.hideStageAtOrBelow
      if (stageHidden) {
        // Intentional responsive behaviour: the preview stays mounted but is not displayed, and both rails stay usable.
        await expect(stage).toBeHidden()
        await expect(frame.locator(route.stage)).toHaveCount(1)
        for (const rail of ['.rw-frame--left', '.rw-frame--right']) {
          const railBox = await frame.locator(`${route.rails} > ${rail}`).boundingBox()
          expect(railBox?.width ?? 0, `${route.label} ${rail} at ${viewport.width}px`).toBeGreaterThan(0)
        }
      } else {
        await expect(stage).toBeVisible({ timeout: 30_000 })
        const stageBox = await stage.boundingBox()
        expect(stageBox?.width ?? 0).toBeGreaterThan(0)
        expect(stageBox?.height ?? 0).toBeGreaterThan(0)
      }

      if (route.surfaces) {
        const radii = await frame.locator(route.surfaces).evaluateAll(elements =>
          elements.filter(element => (element as HTMLElement).offsetParent !== null).map(element => getComputedStyle(element).borderRadius))
        expect(radii.length, `${route.label} visible surfaces at ${viewport.width}px`).toBeGreaterThanOrEqual(stageHidden ? 2 : 3)
        for (const radius of radii) expect(radius).toBe('11px')
      }

      if (route.dock) {
        const dock = frame.locator(route.dock)
        await expect(dock).toHaveCount(1)
        await expect(dock).toBeVisible()
        // Its own grid row, never the legacy viewport-fixed dock.
        expect(await dock.evaluate(element => { const style = getComputedStyle(element); return `${style.position}/${style.gridRowStart}` })).toBe('relative/2')
        const dockBox = (await dock.boundingBox())!
        const frameBox = (await frame.boundingBox())!
        const stageBox = (await stage.boundingBox())!
        expect(dockBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 2)
        expect(dockBox.y + dockBox.height).toBeLessThanOrEqual(frameBox.y + frameBox.height + 2)
        // The dock has no button: clicking the blank gap between its first two cards collapses and re-expands it, bottom edge fixed.
        const toggleDock = async () => {
          const gap = await dock.evaluate(element => {
            const [first, second] = [...element.children].filter(child => child.classList.contains('vz-dock-region')).map(child => child.getBoundingClientRect())
            return { x: (first!.right + second!.left) / 2, y: first!.top + first!.height / 2 }
          })
          await page.mouse.click(gap.x, gap.y)
        }
        const expandedHeight = dockBox.height
        await toggleDock()
        await expect.poll(async () => (await dock.boundingBox())?.height ?? expandedHeight).toBeLessThan(expandedHeight - 10)
        // The dock animates between heights; wait for it to settle before comparing its bottom edge.
        await expect.poll(async () => {
          const box = await dock.boundingBox()
          return box ? Math.abs(box.y + box.height - (dockBox.y + dockBox.height)) : Number.POSITIVE_INFINITY
        }).toBeLessThanOrEqual(2)
        await toggleDock()
        await expect.poll(async () => (await dock.boundingBox())?.height ?? 0).toBeGreaterThan(expandedHeight - 2)
      }

      // This is a geometric change; its existing stage DOM must not be replaced.
      const originalStage = await stage.elementHandle()
      expect(originalStage).not.toBeNull()
      const originalCanvas = route.canvas && (await frame.locator(route.canvas).count()) > 0 ? await frame.locator(route.canvas).first().elementHandle() : null
      const canvasIsOriginal = async () => originalCanvas === null
        || originalCanvas.evaluate((element: Element, selector: string) => element === document.querySelector(selector), `[data-app-workspace="${route.view}"] ${route.canvas}`)
      const brandToggle = frame.locator('.fw-app-header .az-logo')
      const wasExpanded = await brandToggle.getAttribute('aria-expanded') === 'true'
      await brandToggle.click()
      await expect(brandToggle).toHaveAttribute('aria-expanded', String(!wasExpanded))
      expect(await originalStage!.evaluate((element: Element, selector: string) =>
        element === document.querySelector(selector),
      `[data-app-workspace="${route.view}"] ${route.stage}`)).toBe(true)
      expect(await canvasIsOriginal(), `${route.label} canvas after sidebar toggle`).toBe(true)
      await brandToggle.click()
      await expect(brandToggle).toHaveAttribute('aria-expanded', String(wasExpanded))
      await noHorizontalOverflow()

      if (route.rails) {
        // Each original rail grip stays reachable, collapsing either rail never replaces the stage, and nothing overflows.
        const grid = frame.locator(route.rails).first()
        for (const side of ['left', 'right'] as const) {
          await frame.getByRole('button', { name: `Collapse ${side} inspector` }).first().click()
          await expect(grid).toHaveAttribute(`data-${side}-collapsed`, 'true')
          await noHorizontalOverflow()
        }
        expect(await originalStage!.evaluate((element: Element, selector: string) =>
          element === document.querySelector(selector),
        `[data-app-workspace="${route.view}"] ${route.stage}`)).toBe(true)
        expect(await canvasIsOriginal(), `${route.label} canvas after rail collapse`).toBe(true)
        for (const side of ['left', 'right'] as const) {
          await frame.getByRole('button', { name: `Expand ${side} inspector` }).first().click()
          await expect(grid).not.toHaveAttribute(`data-${side}-collapsed`, 'true')
        }
      }

      if (route.stageFocus) {
        await frame.getByRole('button', { name: 'Maximize the live output stage' }).click()
        await expect(frame.locator('.rv-shell')).toHaveAttribute('data-stage-focus', 'true')
        await noHorizontalOverflow()
        expect(await canvasIsOriginal(), `${route.label} canvas in Stage Focus`).toBe(true)
        await frame.getByRole('button', { name: 'Restore workspace rails and timeline' }).click()
        await expect(frame.locator('.rv-shell')).not.toHaveAttribute('data-stage-focus', 'true')
        expect(await canvasIsOriginal(), `${route.label} canvas after leaving Stage Focus`).toBe(true)
      }

      if (route.view === 'lyrics' && viewport.width <= 954) {
        const drawer = frame.getByRole('button', { name: /Tracks & Versions/ })
        await expect(drawer).toBeVisible()
        await drawer.click()
        await expect(drawer).toHaveAttribute('aria-expanded', 'true')
        const openedRail = frame.locator('.lmv-rail--drawer-open').first()
        const frameBounds = await frame.boundingBox()
        expect(frameBounds).not.toBeNull()
        // The rail slides in over 0.18s; measuring before it settles reads a mid-transition position.
        await expect.poll(async () => (await openedRail.boundingBox())?.x ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual(frameBounds!.x - 2)
        const railBounds = await openedRail.boundingBox()
        expect(railBounds).not.toBeNull()
        expect(railBounds!.x + railBounds!.width).toBeLessThanOrEqual(frameBounds!.x + frameBounds!.width + 2)
        await frame.getByRole('button', { name: 'Close tracks and versions' }).click()
        await expect(drawer).toHaveAttribute('aria-expanded', 'false')
      }
    }
  }
})
