import { expect, test } from '@playwright/test'
import path from 'node:path'

const enabled = process.env.DRMVYZ_PIX_GRID_MARQUEE_STAGE3_BROWSER === '1'
const outputRoot = path.resolve(process.cwd(), 'artifacts/pix-grid-marquee-stage3-browser')

async function choose(page: import('@playwright/test').Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.describe('Marquee Sign Cycle Stage 3 browser controls', () => {
  test.skip(!enabled, 'Run with npm run test:e2e:pix-grid-marquee-stage3')

  test('connects Editing Context controls to the deterministic live logical renderer', async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#080b10;color:#eef8ff;font:13px system-ui,sans-serif}.stage3-layout{display:grid;grid-template-columns:360px 1fr;gap:20px;padding:20px}.stage3-preview{min-width:0}.stage3-canvas-wrap{position:relative;max-width:960px;background:#000}.stage3-canvas-wrap canvas{display:block;width:100%;image-rendering:pixelated;background:#000}.stage3-selected-layer{position:absolute;inset:3px;border:2px solid #7eeeff;pointer-events:none;color:#7eeeff;padding:6px;text-shadow:0 1px 2px #000}.drm-dropdown__menu{z-index:20;background:#10151d}.drm-dropdown__option{padding:8px;cursor:pointer}
    </style></head><body><div id="root"></div></body></html>`)
    await page.addScriptTag({ path: path.join(outputRoot, '.runtime/pixGridMarqueeStage3.bundle.js') })
    await page.waitForFunction(() => document.documentElement.dataset.pixGridMarqueeStage3Ready === 'true')

    await choose(page, 'PixGrid Preset', 'Marquee Sign Cycle')
    await page.waitForFunction(() => (window as Window & { __PIXGRID_MARQUEE_STAGE3__?: { selectedPresetId: string | null } }).__PIXGRID_MARQUEE_STAGE3__?.selectedPresetId === 'pix-grid-neon-marquee-cycle')
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-verse')

    await choose(page, 'Active Scene', 'Intro')
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-intro')
    await expect(page.getByTestId('active-plan')).toHaveText('marquee-intro')
    const introHash = await page.getByTestId('logical-hash').textContent()
    const introActivity = Number(await page.getByTestId('active-cells').textContent())

    await choose(page, 'Active Scene', 'Drop')
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-drop')
    await expect(page.getByTestId('active-plan')).toHaveText('marquee-drop')
    await page.evaluate(() => (window as Window & { __setPixGridMarqueeTrackScene?: (sceneId: string | null) => void }).__setPixGridMarqueeTrackScene?.('pix-grid-neon-marquee-cycle-intro'))
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-drop')
    await expect(page.getByTestId('active-plan')).toHaveText('marquee-drop')
    const dropHash = await page.getByTestId('logical-hash').textContent()
    const dropActivity = Number(await page.getByTestId('active-cells').textContent())
    expect(dropHash).not.toBe(introHash)
    expect(dropActivity).toBeGreaterThan(introActivity)

    const canvasMetrics = await page.getByTestId('logical-canvas').evaluate(canvas => {
      const element = canvas as HTMLCanvasElement
      const data = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
      let alphaCells = 0
      for (let offset = 3; offset < data.length; offset += 4) if (data[offset] > 0) alphaCells += 1
      return { width: element.width, height: element.height, alphaCells }
    })
    expect(canvasMetrics).toMatchObject({ width: 96, height: 54 })
    expect(canvasMetrics.alphaCells).toBeGreaterThan(0)

    await choose(page, 'Edit Target', 'Perimeter Bulbs A')
    await expect(page.getByRole('tab', { name: 'Layer' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.rv-ctrl-info strong')).toHaveText('Perimeter Bulbs A')
    await expect(page.getByRole('slider', { name: 'Opacity' })).toBeVisible()
    await expect(page.getByTestId('selected-layer-highlight')).toHaveText('Perimeter Bulbs A')

    await choose(page, 'Edit Target', 'Scene Pixels')
    await expect(page.getByRole('tab', { name: 'Scene' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('selected-layer-highlight')).toHaveCount(0)
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-drop')

    await page.evaluate(() => (window as Window & { __setPixGridMarqueeTrackScene?: (sceneId: string | null) => void }).__setPixGridMarqueeTrackScene?.('pix-grid-neon-marquee-cycle-verse'))
    await choose(page, 'Active Scene', 'Follow Track')
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-verse')
    await expect(page.getByTestId('active-plan')).toHaveText('marquee-verse')
    await page.evaluate(() => (window as Window & { __setPixGridMarqueeTrackScene?: (sceneId: string | null) => void }).__setPixGridMarqueeTrackScene?.('pix-grid-neon-marquee-cycle-intro'))
    await expect(page.getByTestId('runtime-scene')).toHaveText('pix-grid-neon-marquee-cycle-intro')
    await expect(page.getByTestId('active-plan')).toHaveText('marquee-intro')
  })
})
