import { expect, test, type Page } from '@playwright/test'
const enabled = process.env.DRMVYZ_CINEMA2_HUMN_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_HUMN_PAGE ?? '/cinema2-humn-reactivity.html'

type Step = Record<string, number | boolean | undefined>
type Scenario = { state?: Record<string, number | boolean | string>; steps: readonly Step[] }
type Metrics = {
  changedPixels: number
  totalPixels: number
  meanAbsDiff: number
  maxChannelDiff: number
  changedInCorners: number
  figureRegionShare: number
  magentaPixels: number
  meanLuma: number
  failedPassCount: number
}

async function compare(page: Page, before: Scenario, after: Scenario): Promise<Metrics> {
  const metrics = await page.evaluate(([a, b]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.compare(a as never, b as never), [before, after] as const)
  expect(metrics.failedPassCount, 'HUM:N must render without render-graph failures (real GLSL compile)').toBe(0)
  return metrics
}

// Stable HUM:N parameter ids (the preset module is not importable in the Node test runner).
const MR = 'hum-n-master-reactivity'
const FILL = 'hum-n-facet-fill'
const SHIFT = 'hum-n-color-shift-amount'
const FLICKER = 'hum-n-flicker-amount'
const JITTER = 'hum-n-fragment-jitter'

test.describe('HUM:N reactive behavior in a real WebGL2 browser', () => {
  test.skip(!enabled, 'Run through npm run test:e2e:cinema2-humn.')

  test.beforeEach(async ({ page }) => {
    await page.goto(pagePath)
    await expect(page.locator('[data-cinema2-humn-status]')).toHaveAttribute('data-result', 'ready')
  })

  test('Master Reactivity 0: music changes nothing, and the authored default frame is exactly reproduced', async ({ page }) => {
    const silent: Scenario = { steps: [{ energy: 0, complexity: 0, frames: 12 }] }
    const loud: Scenario = { steps: [{ energy: 1, complexity: 1, trackCurve: 1, tension: 1, buildProgress: 1, buildConfidence: 1, vocal: 1, high: 1, air: 1, frames: 12 }] }
    const metrics = await compare(page, silent, loud)
    expect(metrics.changedPixels).toBe(0)
    expect(metrics.maxChannelDiff).toBe(0)
  })

  test('Master Reactivity > 0: low versus high energy visibly changes the wireframe, only on the figure', async ({ page }) => {
    const state = { [MR]: 1 }
    const metrics = await compare(page, { state, steps: [{ energy: 0, frames: 12 }] }, { state, steps: [{ energy: 1, frames: 12 }] })
    expect(metrics.changedPixels).toBeGreaterThan(150)
    expect(metrics.changedInCorners).toBe(0)
    expect(metrics.figureRegionShare).toBeGreaterThan(0.9)
  })

  test('track energy + build coalesce the figure: skin facets appear and the frame materially changes', async ({ page }) => {
    const state = { [MR]: 1 }
    const still = { state, steps: [{ energy: 0.5, trackCurve: 0, frames: 30, dt: 0.1 }] }
    const energetic = { state, steps: [{ energy: 0.5, trackCurve: 1, buildProgress: 1, buildConfidence: 1, frames: 30, dt: 0.1 }] }
    const metrics = await compare(page, still, energetic)
    expect(metrics.changedPixels).toBeGreaterThan(400)
    expect(metrics.changedInCorners).toBe(0)
  })

  test('Color Shift moves authored skin colors between roles on filled facets and never touches the stage', async ({ page }) => {
    const filled = { [MR]: 1, [FILL]: 1, [SHIFT]: 1 }
    const metrics = await compare(page, { state: filled, steps: [{ high: 0, air: 0, frames: 12 }] }, { state: filled, steps: [{ high: 1, air: 1, frames: 12 }] })
    expect(metrics.changedPixels).toBeGreaterThan(1500)
    expect(metrics.changedInCorners).toBe(0)
    // A shift of zero amount must leave the frame byte-identical.
    const stable = { [MR]: 1, [FILL]: 1, [SHIFT]: 0 }
    const none = await compare(page, { state: stable, steps: [{ high: 0, air: 0, frames: 12 }] }, { state: stable, steps: [{ high: 1, air: 1, frames: 12 }] })
    expect(none.changedPixels).toBe(0)
  })

  test('downbeat, beat, kick and snare each visibly change native output, stay local, and fully return to base', async ({ page }) => {
    const state = { [FLICKER]: 1, [JITTER]: 1, [FILL]: 0 }
    const quiet: Scenario = { state, steps: [{ frames: 6 }] }
    const cases: Array<[string, Step, number]> = [
      ['downbeat', { downbeat: true }, 20],
      ['kick', { kick: 1 }, 20],
      ['snare', { snare: 1 }, 20],
      ['beat', { beat: true }, 1],
    ]
    for (const [name, event, minChanged] of cases) {
      const hit = await compare(page, quiet, { state, steps: [{ frames: 6 }, { ...event, frames: 1 }] })
      expect(hit.changedPixels, `${name} must change native output`).toBeGreaterThanOrEqual(minChanged)
      expect(hit.changedInCorners, `${name} must not touch the stage`).toBe(0)
      expect(hit.changedPixels / hit.totalPixels, `${name} must stay a local fragment effect`).toBeLessThan(0.08)
      expect(Math.abs(hit.meanLuma), 'no whole-frame strobe').toBeLessThan(255)

      const released = await compare(page, quiet, { state, steps: [{ frames: 6 }, { ...event, frames: 1 }, { dt: 2, frames: 1 }, { frames: 4 }] })
      expect(released.changedPixels, `${name} must return exactly to base`).toBe(0)
    }
  })

  test('rhythmic events do nothing at Flicker Amount 0 and Fragment Jitter 0', async ({ page }) => {
    const state = { [FLICKER]: 0, [JITTER]: 0 }
    const metrics = await compare(page, { state, steps: [{ frames: 6 }] }, { state, steps: [{ frames: 6 }, { kick: 1, snare: 1, beat: true, downbeat: true, frames: 1 }] })
    expect(metrics.changedPixels).toBe(0)
  })

  test('kick displacement is bounded: it moves fragments by at most a sliver and leaves the silhouette intact', async ({ page }) => {
    const state = { [FLICKER]: 0, [JITTER]: 1 }
    const metrics = await compare(page, { state, steps: [{ frames: 6 }] }, { state, steps: [{ frames: 6 }, { kick: 1, frames: 1 }] })
    expect(metrics.changedPixels).toBeGreaterThan(20)
    expect(metrics.changedPixels / metrics.totalPixels).toBeLessThan(0.05)
    expect(metrics.changedInCorners).toBe(0)
  })
})
