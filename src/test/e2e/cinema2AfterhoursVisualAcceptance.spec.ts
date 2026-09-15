import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  CINEMA2_AFTERHOURS_BEAM_COUNT_ID,
  CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID,
  CINEMA2_AFTERHOURS_PRESET_ID,
  CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID,
  CINEMA2_REACTOR_PRESET_ID,
} from '../../components/vyzualz/cinema2'
import {
  isCinema2FrameMeaningfullyVisible,
  type Cinema2PixelDifferenceMetrics,
  type Cinema2PixelMetrics,
} from '../visual/Cinema2AfterhoursPixelMetrics'

type BrowserHarnessApi = {
  getAudioState(): { trackId: string | null; analyzedBpm: number | null; analysisStatus: string | null }
  measureScreenshotDataUrl(dataUrl: string): Promise<Cinema2PixelMetrics>
  compareScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string): Promise<Cinema2PixelDifferenceMetrics>
  runRawSceneProbe(): Promise<{
    presetId: string
    phase: string
    frameCount: number
    failedPassCount: number
    sceneCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
    outputCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
  }>
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__?: BrowserHarnessApi
  }
}

const enabled = process.env.DRMVYZ_CINEMA2_AFTERHOURS_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_AFTERHOURS_PAGE ?? '/cinema2-afterhours-production.html'

const toDataUrl = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`

async function bootProductionAfterhours(page: Page): Promise<Locator> {
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto(pagePath)
  await expect(page.locator('[data-cinema2-afterhours-status]')).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })

  await page.locator('.rv-engine-dropdown-trigger').click()
  await page.getByRole('option', { name: /Cinema 2\.0/i }).click()
  await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })

  const preset = page.locator(`[data-cinema2-preset-id="${CINEMA2_AFTERHOURS_PRESET_ID}"]`)
  await expect(preset).toBeVisible()
  await preset.click()
  await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })

  const canvas = page.locator('[data-cinema2-output-canvas="true"]')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => {
    const box = await canvas.boundingBox()
    return box ? Math.min(box.width, box.height) : 0
  }, { timeout: 15_000 }).toBeGreaterThan(100)
  return canvas
}

async function capture(page: Page, canvas: Locator): Promise<{ dataUrl: string; metrics: Cinema2PixelMetrics }> {
  const screenshot = await canvas.screenshot({ animations: 'disabled' })
  const dataUrl = toDataUrl(screenshot)
  const metrics = await page.evaluate(async data => {
    const harness = window.__DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__
    if (!harness) throw new Error('After Hours 2.0 acceptance API is unavailable.')
    return harness.measureScreenshotDataUrl(data)
  }, dataUrl)
  return { dataUrl, metrics }
}

async function compare(page: Page, before: string, after: string): Promise<Cinema2PixelDifferenceMetrics> {
  return page.evaluate(async ({ beforeDataUrl, afterDataUrl }) => {
    const harness = window.__DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__
    if (!harness) throw new Error('After Hours 2.0 acceptance API is unavailable.')
    return harness.compareScreenshotDataUrls(beforeDataUrl, afterDataUrl)
  }, { beforeDataUrl: before, afterDataUrl: after })
}

async function selectRightTab(page: Page, name: 'PRESETS' | 'DESIGN' | 'REACT'): Promise<void> {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name }).click()
}

async function setRangeParameter(page: Page, parameterId: string, value: number): Promise<void> {
  const input = page.locator(`[data-cinema2-control-id="${parameterId}"] input[type="range"]`)
  await expect(input).toBeVisible()
  await input.evaluate((element, nextValue) => {
    const inputElement = element as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    valueSetter?.call(inputElement, String(nextValue))
    inputElement.dispatchEvent(new Event('input', { bubbles: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await expect(input).toHaveValue(String(value))
}

async function setColorParameter(page: Page, parameterId: string, value: string): Promise<void> {
  const input = page.locator(`[data-cinema2-control-id="${parameterId}"] input[type="color"]`)
  await expect(input).toBeVisible()
  await input.evaluate((element, nextValue) => {
    const inputElement = element as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    valueSetter?.call(inputElement, String(nextValue))
    inputElement.dispatchEvent(new Event('input', { bubbles: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await expect(input).toHaveValue(value)
}

test.describe('Cinema 2.0 After Hours 2.0 real-browser visual acceptance', () => {
  test.skip(!enabled, 'Run with npm run test:e2e:cinema2-afterhours')

  test('renders visible no-audio pixels and controls change the production canvas end-to-end', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const canvas = await bootProductionAfterhours(page)

    const audio = await page.evaluate(() => window.__DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__!.getAudioState())
    expect(audio.trackId).toBeNull()
    expect(audio.analyzedBpm).toBeNull()

    let baseline: Awaited<ReturnType<typeof capture>> | null = null
    await expect.poll(async () => {
      baseline = await capture(page, canvas)
      return isCinema2FrameMeaningfullyVisible(baseline.metrics)
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBe(true)
    expect(baseline).not.toBeNull()
    await testInfo.attach('afterhours2-baseline-metrics.json', {
      body: Buffer.from(JSON.stringify(baseline!.metrics, null, 2)),
      contentType: 'application/json',
    })

    await selectRightTab(page, 'DESIGN')
    await setRangeParameter(page, String(CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID), 0)
    let intensityZero: Awaited<ReturnType<typeof capture>> | null = null
    await expect.poll(async () => {
      intensityZero = await capture(page, canvas)
      return intensityZero.metrics.meanLuminance
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBeLessThan(baseline!.metrics.meanLuminance * 0.35)
    expect(intensityZero!.metrics.maxLuminance).toBeLessThan(baseline!.metrics.maxLuminance * 0.75)

    await setRangeParameter(page, String(CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID), 0.75)
    let restored: Awaited<ReturnType<typeof capture>> | null = null
    await expect.poll(async () => {
      restored = await capture(page, canvas)
      return isCinema2FrameMeaningfullyVisible(restored.metrics)
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBe(true)
    expect(restored!.metrics.meanLuminance).toBeGreaterThan(intensityZero!.metrics.meanLuminance * 2)

    const geometryBefore = restored!
    await setRangeParameter(page, String(CINEMA2_AFTERHOURS_BEAM_COUNT_ID), 16)
    let geometryAfter: Awaited<ReturnType<typeof capture>> | null = null
    let geometryDifference: Cinema2PixelDifferenceMetrics | null = null
    await expect.poll(async () => {
      geometryAfter = await capture(page, canvas)
      geometryDifference = await compare(page, geometryBefore.dataUrl, geometryAfter.dataUrl)
      return geometryDifference.changedPixelRatio
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBeGreaterThan(0.0002)
    expect(geometryDifference!.maxLuminanceDelta).toBeGreaterThan(0.03)

    await setColorParameter(page, String(CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID), '#ff2040')
    let redFrame: Awaited<ReturnType<typeof capture>> | null = null
    await expect.poll(async () => {
      redFrame = await capture(page, canvas)
      return redFrame.metrics.meanRed - redFrame.metrics.meanBlue
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBeGreaterThan(0)
    expect(redFrame!.metrics.meanRed).toBeGreaterThan(redFrame!.metrics.meanGreen)

    await selectRightTab(page, 'PRESETS')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_AFTERHOURS_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_AFTERHOURS_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })
    await expect.poll(async () => isCinema2FrameMeaningfullyVisible((await capture(page, canvas)).metrics), {
      timeout: 15_000,
      intervals: [100, 200, 400, 800],
    }).toBe(true)

    expect(pageErrors).toEqual([])
  })

  test('proves raw scene and trails/output passes produce real WebGL pixels', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto(pagePath)
    await expect(page.locator('[data-cinema2-afterhours-status]')).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
    const probe = await page.evaluate(() => window.__DRMVYZ_CINEMA2_AFTERHOURS_ACCEPTANCE__!.runRawSceneProbe())
    await testInfo.attach('afterhours2-raw-scene-probe.json', {
      body: Buffer.from(JSON.stringify(probe, null, 2)),
      contentType: 'application/json',
    })
    expect(probe.presetId).toBe(String(CINEMA2_AFTERHOURS_PRESET_ID))
    expect(probe.phase).toBe('running')
    expect(probe.frameCount).toBeGreaterThanOrEqual(4)
    expect(probe.failedPassCount).toBe(0)
    expect(probe.sceneCheckpoint).toMatchObject({ rgbEnergyDetected: true, error: null })
    expect(probe.sceneCheckpoint?.maxRgbByte).toBeGreaterThan(12)
    expect(probe.outputCheckpoint).toMatchObject({ rgbEnergyDetected: true, error: null })
    expect(probe.outputCheckpoint?.maxRgbByte).toBeGreaterThan(12)
  })
})
