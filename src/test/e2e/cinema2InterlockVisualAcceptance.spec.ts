import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID,
  CINEMA2_INTERLOCK_BANK_STAGGER_ID,
  CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID,
  CINEMA2_INTERLOCK_LIT_DENSITY_ID,
  CINEMA2_INTERLOCK_LED_INTENSITY_ID,
  CINEMA2_INTERLOCK_BLOOM_PASS_ID,
  CINEMA2_INTERLOCK_MORPH_DURATION_ID,
  CINEMA2_INTERLOCK_RENDER_PASS_ID,
  CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID,
  CINEMA2_INTERLOCK_PRESET_ID,
  CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID,
  CINEMA2_INTERLOCK_SEGMENT_SPEED_ID,
  CINEMA2_INTERLOCK_TRAILS_PASS_ID,
  CINEMA2_REACTOR_PRESET_ID,
} from '../../components/vyzualz/cinema2'
import type {
  Cinema2InterlockDifferenceMetrics,
  Cinema2InterlockFixtureDifferenceMetrics,
  Cinema2InterlockPixelMetrics,
} from '../visual/Cinema2InterlockPixelMetrics'
import { isCinema2InterlockFixtureDifferenceVisible, isCinema2InterlockFrameVisible } from '../visual/Cinema2InterlockPixelMetrics'

type BrowserHarnessApi = {
  getAudioState(): { trackId: string | null; analyzedBpm: number | null; analysisStatus: string | null }
  measureScreenshotDataUrl(dataUrl: string): Promise<Cinema2InterlockPixelMetrics>
  compareScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string): Promise<Cinema2InterlockDifferenceMetrics>
  compareFixtureScreenshotDataUrls(beforeDataUrl: string, afterDataUrl: string, patternId: 'diamondTunnel' | 'mechanicalIris' | 'doubleWing' | 'bassPortal' | 'fourWayVortex'): Promise<Cinema2InterlockFixtureDifferenceMetrics>
  runRawSceneProbe(): Promise<{
    presetId: string
    phase: string
    frameCount: number
    failedPassCount: number
    activeModuleCount: number
    activeResourceLeaseCount: number
    executedPassCount: number
    lastExecutedPassIds: readonly string[]
    sceneCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
    outputCheckpoint: { maxRgbByte: number | null; rgbEnergyDetected: boolean | null; error: string | null } | null
  }>
}

declare global {
  interface Window {
    __DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__?: BrowserHarnessApi
  }
}

const enabled = process.env.DRMVYZ_CINEMA2_INTERLOCK_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_INTERLOCK_PAGE ?? '/cinema2-interlock-production.html'
const toDataUrl = (buffer: Buffer) => `data:image/png;base64,${buffer.toString('base64')}`

async function bootProductionInterlock(page: Page): Promise<Locator> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto(pagePath)
  await expect(page.locator('[data-cinema2-interlock-status]')).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })

  await page.locator('.rv-engine-dropdown-trigger').click()
  await page.getByRole('option', { name: /Cinema 2\.0/i }).click()
  await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })

  const preset = page.locator(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`)
  await expect(preset).toBeVisible()
  await preset.click()
  await expect(preset).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })

  const canvas = page.locator('[data-cinema2-output-canvas="true"]')
  await expect(canvas).toBeVisible()
  await expect.poll(async () => {
    const box = await canvas.boundingBox()
    return box ? Math.min(box.width, box.height) : 0
  }, { timeout: 15_000 }).toBeGreaterThan(100)
  return canvas
}

async function capture(page: Page, canvas: Locator): Promise<{ dataUrl: string; metrics: Cinema2InterlockPixelMetrics }> {
  const screenshot = await canvas.screenshot({ animations: 'disabled' })
  const dataUrl = toDataUrl(screenshot)
  const metrics = await page.evaluate(async data => {
    const harness = window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__
    if (!harness) throw new Error('Interlock acceptance API is unavailable.')
    return harness.measureScreenshotDataUrl(data)
  }, dataUrl)
  return { dataUrl, metrics }
}

async function compare(page: Page, before: string, after: string): Promise<Cinema2InterlockDifferenceMetrics> {
  return page.evaluate(async ({ beforeDataUrl, afterDataUrl }) => {
    const harness = window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__
    if (!harness) throw new Error('Interlock acceptance API is unavailable.')
    return harness.compareScreenshotDataUrls(beforeDataUrl, afterDataUrl)
  }, { beforeDataUrl: before, afterDataUrl: after })
}

async function compareFixtureSamples(
  page: Page,
  before: string,
  after: string,
  patternId: 'diamondTunnel' | 'mechanicalIris' | 'doubleWing' | 'bassPortal' | 'fourWayVortex',
): Promise<Cinema2InterlockFixtureDifferenceMetrics> {
  return page.evaluate(async ({ beforeDataUrl, afterDataUrl, patternId }) => {
    const harness = window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__
    if (!harness) throw new Error('Interlock acceptance API is unavailable.')
    return harness.compareFixtureScreenshotDataUrls(beforeDataUrl, afterDataUrl, patternId)
  }, { beforeDataUrl: before, afterDataUrl: after, patternId })
}

async function selectRightTab(page: Page, name: 'PRESETS' | 'DESIGN' | 'REACT'): Promise<void> {
  await page.getByRole('tablist', { name: 'React right workspace panels' }).getByRole('tab', { name }).click()
}

async function setRangeParameter(page: Page, parameterId: string, value: number): Promise<void> {
  const input = page.locator(`[data-cinema2-control-id="${parameterId}"] input[type="range"]`)
  await expect(input).toBeVisible()
  await input.evaluate((element, nextValue) => {
    const inputElement = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(inputElement, String(nextValue))
    inputElement.dispatchEvent(new Event('input', { bubbles: true }))
    inputElement.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
  await expect(input).toHaveValue(String(value))
}

async function setBooleanParameter(page: Page, parameterId: string, value: boolean): Promise<void> {
  const toggle = page.locator(`[data-cinema2-control-id="${parameterId}"] [role="switch"]`)
  await expect(toggle).toBeVisible()
  const current = await toggle.getAttribute('aria-checked')
  if ((current === 'true') !== value) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', String(value))
}

async function setEnumParameter(page: Page, parameterId: string, optionLabel: string): Promise<void> {
  const control = page.locator(`[data-cinema2-control-id="${parameterId}"]`)
  const trigger = control.getByRole('combobox')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await page.getByRole('option', { name: optionLabel, exact: true }).click()
  await expect(trigger).toContainText(optionLabel)
}

async function configureManualCheckpointBase(page: Page): Promise<void> {
  await selectRightTab(page, 'DESIGN')
  await setBooleanParameter(page, String(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID), false)
  await setRangeParameter(page, String(CINEMA2_INTERLOCK_MORPH_DURATION_ID), 0.25)
  await setRangeParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_SPEED_ID), 0)
  await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_FLOW_ID), 0)
}

test.describe('Cinema 2.0 Interlock Stage 7 real-browser visual acceptance', () => {
  test.skip(!enabled, 'Run with npm run test:e2e:cinema2-interlock')

  test('renders the no-source production keeper, exposes live controls, and survives neighboring-preset re-entry', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    const canvas = await bootProductionInterlock(page)

    const environment = await page.evaluate(() => ({ dpr: window.devicePixelRatio, width: window.innerWidth, height: window.innerHeight }))
    expect(environment).toMatchObject({ width: 1440, height: 900 })
    expect(environment.dpr).toBe(1)

    const audio = await page.evaluate(() => window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__!.getAudioState())
    expect(audio.trackId).toBeNull()
    expect(audio.analyzedBpm).toBeNull()

    let idle: Awaited<ReturnType<typeof capture>> | null = null
    await expect.poll(async () => {
      idle = await capture(page, canvas)
      return isCinema2InterlockFrameVisible(idle.metrics)
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] }).toBe(true)
    expect(idle!.metrics.nearWhiteRatio).toBeLessThan(0.5)
    expect(idle!.metrics.segmentGapContrastRatio).toBeGreaterThan(0)
    await testInfo.attach('interlock-idle-metrics.json', { body: Buffer.from(JSON.stringify({ environment, audio, metrics: idle!.metrics }, null, 2)), contentType: 'application/json' })

    await selectRightTab(page, 'DESIGN')
    await expect(page.locator(`[data-cinema2-control-id="${CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID}"]`)).toBeVisible()
    await expect(page.locator(`[data-cinema2-control-id="${CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID}"]`)).toBeVisible()
    await expect(page.locator(`[data-cinema2-control-id="${CINEMA2_INTERLOCK_BANK_STAGGER_ID}"]`)).toBeVisible()
    await expect(page.locator('[data-cinema2-inspector="design"]')).not.toContainText(/BPM Sync|Sync BPM/i)

    await selectRightTab(page, 'PRESETS')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })
    await expect.poll(async () => isCinema2InterlockFrameVisible((await capture(page, canvas)).metrics), { timeout: 15_000 }).toBe(true)
    expect(pageErrors).toEqual([])
  })

  test('captures isolated deterministic stills for all five layouts with fixture-region signal', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const canvas = await bootProductionInterlock(page)
    await configureManualCheckpointBase(page)
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Solid')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LIT_DENSITY_ID), 1)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LED_INTENSITY_ID), 0)
    await page.waitForTimeout(300)
    const backgroundOnly = await capture(page, canvas)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LED_INTENSITY_ID), 1)

    const layouts = [
      ['diamondTunnel', 'Diamond Tunnel'],
      ['mechanicalIris', 'Mechanical Iris'],
      ['doubleWing', 'Double Wing'],
      ['bassPortal', 'Bass Portal'],
      ['fourWayVortex', 'Four-Way Vortex'],
    ] as const
    const report: Record<string, { metrics: Cinema2InterlockPixelMetrics; fixtureSignal: Cinema2InterlockFixtureDifferenceMetrics }> = {}
    let previousDataUrl: string | null = null

    for (const [id, label] of layouts) {
      await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), label)
      await page.waitForTimeout(450)
      const frame = await capture(page, canvas)
      const fixtureSignal = await compareFixtureSamples(page, backgroundOnly.dataUrl, frame.dataUrl, id)
      expect(isCinema2InterlockFrameVisible(frame.metrics)).toBe(true)
      expect(fixtureSignal.changedFixtureCount).toBeGreaterThanOrEqual(24)
      expect(fixtureSignal.changedSampleRatio).toBeGreaterThan(0.2)
      if (previousDataUrl) {
        expect((await compare(page, previousDataUrl, frame.dataUrl)).changedPixelRatio).toBeGreaterThan(0.002)
      }
      report[id] = { metrics: frame.metrics, fixtureSignal }
      await testInfo.attach(`interlock-layout-${id}.png`, {
        body: Buffer.from(frame.dataUrl.split(',')[1]!, 'base64'),
        contentType: 'image/png',
      })
      previousDataUrl = frame.dataUrl
    }

    await testInfo.attach('interlock-layout-isolation-metrics.json', {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: 'application/json',
    })
  })

  test('captures deterministic manual layout checkpoints and bounded atmosphere/effect extremes', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const canvas = await bootProductionInterlock(page)
    await configureManualCheckpointBase(page)

    const checkpoints: Record<string, Cinema2InterlockPixelMetrics> = {}
    const captureCheckpoint = async (name: string) => {
      await page.waitForTimeout(450)
      const frame = await capture(page, canvas)
      expect(isCinema2InterlockFrameVisible(frame.metrics)).toBe(true)
      expect(frame.metrics.nearWhiteRatio).toBeLessThan(0.5)
      checkpoints[name] = frame.metrics
      await testInfo.attach(`interlock-${name}.png`, { body: Buffer.from(frame.dataUrl.split(',')[1]!, 'base64'), contentType: 'image/png' })
      return frame
    }

    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Diamond Tunnel')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Forward Chase')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LIT_DENSITY_ID), 0.55)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0.35)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0.25)
    const steady = await captureCheckpoint('steady')

    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Mechanical Iris')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Center Out')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LIT_DENSITY_ID), 0.78)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0.38)
    const build = await captureCheckpoint('build')
    expect((await compare(page, steady.dataUrl, build.dataUrl)).changedPixelRatio).toBeGreaterThan(0.002)

    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Four-Way Vortex')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Impact Burst')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LIT_DENSITY_ID), 0.95)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 1)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0.6)
    const drop = await captureCheckpoint('drop')
    expect((await compare(page, build.dataUrl, drop.dataUrl)).changedPixelRatio).toBeGreaterThan(0.002)
    expect(drop.metrics.clippedRatio).toBeLessThan(0.35)

    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Double Wing')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Solid')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LIT_DENSITY_ID), 0.35)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0.1)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0.15)
    const release = await captureCheckpoint('vocal-release')
    expect((await compare(page, drop.dataUrl, release.dataUrl)).changedPixelRatio).toBeGreaterThan(0.002)

    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0)
    const effectsZero = await captureCheckpoint('effects-0')
    const effectsZeroRepeat = await captureCheckpoint('effects-0-repeat')
    expect((await compare(page, effectsZero.dataUrl, effectsZeroRepeat.dataUrl)).repeatSimilarity).toBeGreaterThan(0.995)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 1)
    const effectsOne = await captureCheckpoint('effects-1')
    expect((await compare(page, effectsZero.dataUrl, effectsOne.dataUrl)).changedPixelRatio).toBeGreaterThan(0.0005)
    expect(effectsOne.metrics.nearWhiteRatio).toBeLessThan(0.5)

    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0.35)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 0)
    const atmosphereZero = await captureCheckpoint('atmosphere-0')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 1)
    const atmosphereOne = await captureCheckpoint('atmosphere-1')
    expect((await compare(page, atmosphereZero.dataUrl, atmosphereOne.dataUrl)).changedPixelRatio).toBeGreaterThan(0.0005)
    expect(atmosphereOne.metrics.nearWhiteRatio).toBeLessThan(0.5)

    await testInfo.attach('interlock-checkpoint-metrics.json', { body: Buffer.from(JSON.stringify(checkpoints, null, 2)), contentType: 'application/json' })
  })

  test('distinguishes LED fixture output from a frozen background-only frame and survives preset re-entry', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const canvas = await bootProductionInterlock(page)
    await configureManualCheckpointBase(page)
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Diamond Tunnel')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Solid')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 1)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LED_INTENSITY_ID), 0)
    await page.waitForTimeout(250)
    const backgroundOnly = await capture(page, canvas)
    const backgroundOnlyRepeat = await capture(page, canvas)
    const negative = await compareFixtureSamples(page, backgroundOnly.dataUrl, backgroundOnlyRepeat.dataUrl, 'diamondTunnel')
    expect(isCinema2InterlockFrameVisible(backgroundOnly.metrics)).toBe(true)
    expect(isCinema2InterlockFixtureDifferenceVisible(negative)).toBe(false)

    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LED_INTENSITY_ID), 1)
    await page.waitForTimeout(250)
    const ledFrame = await capture(page, canvas)
    const fixtureDelta = await compareFixtureSamples(page, backgroundOnly.dataUrl, ledFrame.dataUrl, 'diamondTunnel')
    expect(isCinema2InterlockFixtureDifferenceVisible(fixtureDelta)).toBe(true)
    expect(fixtureDelta.changedFixtureCount).toBeGreaterThanOrEqual(8)

    await selectRightTab(page, 'PRESETS')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_REACTOR_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await page.locator(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`).click()
    await expect(page.locator(`[data-cinema2-preset-id="${CINEMA2_INTERLOCK_PRESET_ID}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-cinema2-stage="runtime"]')).toHaveAttribute('data-runtime-phase', 'running', { timeout: 30_000 })
    await configureManualCheckpointBase(page)
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_PATTERN_PARAMETER_ID), 'Diamond Tunnel')
    await setEnumParameter(page, String(CINEMA2_INTERLOCK_SEGMENT_PATTERN_ID), 'Solid')
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_BACKGROUND_ATMOSPHERE_ID), 1)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_EFFECTS_INTENSITY_ID), 0)
    await setRangeParameter(page, String(CINEMA2_INTERLOCK_LED_INTENSITY_ID), 1)
    await page.waitForTimeout(250)
    const reentry = await capture(page, canvas)
    const reentryDelta = await compareFixtureSamples(page, backgroundOnly.dataUrl, reentry.dataUrl, 'diamondTunnel')
    expect(isCinema2InterlockFixtureDifferenceVisible(reentryDelta)).toBe(true)

    await testInfo.attach('interlock-fixture-specific-metrics.json', {
      body: Buffer.from(JSON.stringify({ negative, fixtureDelta, reentryDelta }, null, 2)),
      contentType: 'application/json',
    })
  })

  test('proves the real Interlock scene, trails, and bloom graph produces WebGL pixels without failed modules', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto(pagePath)
    await expect(page.locator('[data-cinema2-interlock-status]')).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
    const probe = await page.evaluate(() => window.__DRMVYZ_CINEMA2_INTERLOCK_ACCEPTANCE__!.runRawSceneProbe())
    await testInfo.attach('interlock-raw-scene-probe.json', { body: Buffer.from(JSON.stringify(probe, null, 2)), contentType: 'application/json' })
    expect(probe.presetId).toBe(String(CINEMA2_INTERLOCK_PRESET_ID))
    expect(probe.phase).toBe('running')
    expect(probe.frameCount).toBeGreaterThanOrEqual(4)
    expect(probe.activeModuleCount).toBe(2)
    expect(probe.activeResourceLeaseCount).toBeGreaterThan(0)
    expect(probe.executedPassCount).toBe(probe.frameCount * 3)
    expect(probe.lastExecutedPassIds).toEqual([
      String(CINEMA2_INTERLOCK_RENDER_PASS_ID),
      String(CINEMA2_INTERLOCK_TRAILS_PASS_ID),
      String(CINEMA2_INTERLOCK_BLOOM_PASS_ID),
    ])
    expect(probe.failedPassCount).toBe(0)
    expect(probe.sceneCheckpoint).toMatchObject({ rgbEnergyDetected: true, error: null })
    expect(probe.sceneCheckpoint?.maxRgbByte).toBeGreaterThan(12)
    expect(probe.outputCheckpoint).toMatchObject({ rgbEnergyDetected: true, error: null })
    expect(probe.outputCheckpoint?.maxRgbByte).toBeGreaterThan(12)
  })
})
