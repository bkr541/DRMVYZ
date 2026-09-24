import { expect, test, type Page } from '@playwright/test'
const enabled = process.env.DRMVYZ_CINEMA2_HUMN_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_HUMN_PAGE ?? '/cinema2-humn-reactivity.html'

type Step = Record<string, number | boolean | string | undefined | readonly { id: string; timeSec: number }[]>
type Scenario = { state?: Record<string, number | boolean | string>; steps: readonly Step[]; size?: { width: number; height: number } }
type Bounds = { minX: number; maxX: number; minY: number; maxY: number }
type Metrics = {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  meanAbsDiff: number
  maxChannelDiff: number
  changedInCorners: number
  figureRegionShare: number
  meanLuma: number
  failedPassCount: number
  changedBounds: Bounds | null
  regionChanges: number[]
  litBoundsAfter: Bounds | null
  litBoundsBefore: Bounds | null
  headBoundsAfter: Bounds | null
  headBandWidthBefore: number
  headBandWidthAfter: number
}
type Region = { x0: number; y0: number; x1: number; y1: number }

async function compare(page: Page, before: Scenario, after: Scenario, regions: readonly Region[] = []): Promise<Metrics> {
  const metrics = await page.evaluate(
    ([a, b, r]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.compare(a as never, b as never, r as never),
    [before, after, regions] as const,
  )
  expect(metrics.failedPassCount, 'HUM:N must render without render-graph failures (real GLSL compile)').toBe(0)
  return metrics
}

// Stable HUM:N parameter ids (the preset module is not importable in the Node test runner).
const MR = 'hum-n-master-reactivity'
const FILL = 'hum-n-facet-fill'
const SHIFT = 'hum-n-color-shift-amount'
const FLICKER = 'hum-n-flicker-amount'
const JITTER = 'hum-n-fragment-jitter'
const GESTURE = 'hum-n-gesture-intensity'
const MOTION = 'hum-n-motion-amount'
const AUTO = 'hum-n-auto-performance'
// Recorded by the Gestures vitest suite (which also guards them): drop marker ids -> families.
const DROP_IDS = { reach: 'drop-0', lunge: 'drop-1', shock: 'drop-3', headGrab: 'drop-2' } as const
const FAMILIES = ['reach', 'shock', 'headGrab', 'lunge'] as const

test.describe('HUM:N reactive behavior in a real WebGL2 browser', () => {
  test.skip(!enabled, 'Run through npm run test:e2e:cinema2-humn.')
  test.setTimeout(240_000)

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

  const playDrop = (id: string, state: Record<string, number | boolean | string> = { [GESTURE]: 1 }, size?: { width: number; height: number }): Scenario => ({
    state,
    size,
    steps: [{ frames: 3 }, { dropMoments: [{ id, timeSec: 10.12 }], frames: 1 }, { frames: 4, dt: 0.05 }],
  })
  const playAndRelease = (id: string, state: Record<string, number | boolean | string> = { [GESTURE]: 1 }): Scenario => ({
    state,
    steps: [{ frames: 3 }, { dropMoments: [{ id, timeSec: 10.12 }], frames: 1 }, { frames: 4, dt: 0.05 }, { frames: 8, dt: 0.3 }, { frames: 2 }],
  })
  const rest = (state: Record<string, number | boolean | string> = { [GESTURE]: 1 }, size?: { width: number; height: number }): Scenario => ({ state, size, steps: [{ frames: 8 }] })

  test('Gesture Intensity 0: no drop creates any large pose', async ({ page }) => {
    for (const id of Object.values(DROP_IDS)) {
      const metrics = await compare(page, rest({ [GESTURE]: 0 }), playDrop(id, { [GESTURE]: 0 }))
      expect(metrics.changedPixels, id).toBe(0)
    }
  })

  test('the four drop gestures are visibly distinct, purposeful, and each returns exactly to the authored frame', async ({ page }) => {
    for (const family of FAMILIES) {
      const id = DROP_IDS[family]
      const peak = await compare(page, rest(), playDrop(id))
      expect(peak.changedPixels, `${family} must change native output`).toBeGreaterThan(1500)
      const released = await compare(page, rest(), playAndRelease(id))
      expect(released.changedPixels, `${family} must return exactly to base`).toBe(0)
    }
    for (let a = 0; a < FAMILIES.length; a++) {
      for (let b = a + 1; b < FAMILIES.length; b++) {
        const distinct = await compare(page, playDrop(DROP_IDS[FAMILIES[a]!]), playDrop(DROP_IDS[FAMILIES[b]!]))
        expect(distinct.changedPixels, `${FAMILIES[a]} vs ${FAMILIES[b]}`).toBeGreaterThan(1500)
      }
    }
  })

  test('Reach: one foreground hand of roughly 30-40% of frame width, connected to the figure, face preserved, never the whole canvas', async ({ page }) => {
    const faceRegion: Region = { x0: 0.36, y0: 0.12, x1: 0.56, y1: 0.5 }
    for (const size of [{ width: 640, height: 360 }, { width: 400, height: 500 }, { width: 800, height: 800 }, { width: 960, height: 400 }]) {
      const metrics = await compare(page, rest({ [GESTURE]: 1 }, size), playDrop(DROP_IDS.reach, { [GESTURE]: 1 }, size), [faceRegion])
      expect(metrics.changedBounds, `${size.width}x${size.height}`).not.toBeNull()
      const bounds = metrics.changedBounds!
      const share = (bounds.maxX - bounds.minX + 1) / metrics.width
      expect(share, `${size.width}x${size.height} hand width share`).toBeGreaterThan(0.24)
      expect(share, `${size.width}x${size.height} hand width share`).toBeLessThan(0.5)
      expect(metrics.changedPixels / metrics.totalPixels, 'must not consume the canvas').toBeLessThan(0.3)
      // The head region (face) is not covered by the reaching hand.
      const faceArea = (faceRegion.x1 - faceRegion.x0) * metrics.width * (faceRegion.y1 - faceRegion.y0) * metrics.height
      expect(metrics.regionChanges[0]! / faceArea, `${size.width}x${size.height} face preserved`).toBeLessThan(0.12)
      // The hand reaches in from the figure's own side of the frame: it touches the lower region near the body.
      expect(bounds.maxY, 'forearm connects toward the body').toBeGreaterThan(metrics.height * 0.6)
    }
  })

  test('Head Grab: two hands reach the sides/top of the head and the limbs stay readable', async ({ page }) => {
    const left: Region = { x0: 0.2, y0: 0.02, x1: 0.4, y1: 0.62 }
    const right: Region = { x0: 0.6, y0: 0.02, x1: 0.8, y1: 0.62 }
    const metrics = await compare(page, rest(), playDrop(DROP_IDS.headGrab), [left, right])
    expect(metrics.regionChanges[0]!).toBeGreaterThan(900)
    expect(metrics.regionChanges[1]!).toBeGreaterThan(900)
    const ratio = metrics.regionChanges[0]! / metrics.regionChanges[1]!
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2)
    expect(metrics.changedInCorners, 'stage grid stays put').toBe(0)
  })

  test('Shock: the head pulls back and the shoulders recoil without any limb geometry', async ({ page }) => {
    const metrics = await compare(page, rest(), playDrop(DROP_IDS.shock))
    expect(metrics.changedPixels).toBeGreaterThan(800)
    expect(metrics.changedInCorners).toBe(0)
    expect(metrics.headBandWidthAfter).toBeLessThan(metrics.headBandWidthBefore)
  })

  test('Lunge: figure geometry grows ~20-35% while the stage never scales and the face stays inside the frame', async ({ page }) => {
    for (const size of [{ width: 640, height: 360 }, { width: 400, height: 500 }, { width: 800, height: 800 }, { width: 960, height: 400 }]) {
      const metrics = await compare(page, rest({ [GESTURE]: 1 }, size), playDrop(DROP_IDS.lunge, { [GESTURE]: 1 }, size))
      const grow = metrics.headBandWidthAfter / metrics.headBandWidthBefore
      expect(grow, `${size.width}x${size.height} head growth`).toBeGreaterThan(1.05)
      expect(grow, `${size.width}x${size.height} head growth`).toBeLessThan(1.4)
      const head = metrics.headBoundsAfter!
      expect(head.minY, `${size.width}x${size.height} crown stays inside the frame`).toBeGreaterThan(0)
      expect(head.minX, `${size.width}x${size.height} head stays inside the frame`).toBeGreaterThan(0)
      expect(head.maxX, `${size.width}x${size.height} head stays inside the frame`).toBeLessThan(metrics.width - 1)
    }
    // The stage is untouched: margins that contain only grid do not change.
    const stage: Region[] = [{ x0: 0, y0: 0, x1: 0.15, y1: 0.55 }, { x0: 0.85, y0: 0, x1: 1, y1: 0.55 }]
    const metrics = await compare(page, rest(), playDrop(DROP_IDS.lunge), stage)
    expect(metrics.regionChanges).toEqual([0, 0])
  })

  test('phrase and section-change body language is modest, deterministic, and silent at zero ceilings', async ({ page }) => {
    // Motion Amount adds idle sway, so every baseline replays the identical clock without the marker.
    const phraseSteps = (marker: boolean): Step[] => [{ frames: 3 }, { ...(marker ? { phrases: [{ id: 'phrase-a', timeSec: 10.12 }] } : {}), frames: 1 }, { frames: 4, dt: 0.1 }]
    const sectionSteps = (change: boolean): Step[] => [
      { frames: 3, sectionType: 'verse', sectionStartSec: 0 },
      { sectionType: change ? 'chorus' : 'verse', sectionStartSec: change ? 10.12 : 0, frames: 1 },
      { frames: 4, dt: 0.1 },
    ]
    const dropSteps = (marker: boolean): Step[] => [{ frames: 3 }, { ...(marker ? { dropMoments: [{ id: DROP_IDS.reach, timeSec: 10.12 }] } : {}), frames: 1 }, { frames: 4, dt: 0.05 }]
    const silent = await compare(page, { steps: phraseSteps(false) }, { steps: phraseSteps(true) })
    expect(silent.changedPixels).toBe(0)
    const silentSection = await compare(page, { steps: sectionSteps(false) }, { steps: sectionSteps(true) })
    expect(silentSection.changedPixels).toBe(0)
    const both = { [GESTURE]: 1, [MOTION]: 1 }
    const phraseMetrics = await compare(page, { state: both, steps: phraseSteps(false) }, { state: both, steps: phraseSteps(true) })
    const sectionMetrics = await compare(page, { state: both, steps: sectionSteps(false) }, { state: both, steps: sectionSteps(true) })
    const dropMetrics = await compare(page, { state: both, steps: dropSteps(false) }, { state: both, steps: dropSteps(true) })
    expect(phraseMetrics.changedPixels).toBeGreaterThan(0)
    expect(sectionMetrics.changedPixels).toBeGreaterThan(0)
    expect(phraseMetrics.changedPixels).toBeLessThan(dropMetrics.changedPixels)
    expect(sectionMetrics.changedPixels).toBeLessThan(dropMetrics.changedPixels)
    const release = (marker: boolean): Step[] => [...phraseSteps(marker), { frames: 8, dt: 0.3 }, { frames: 2 }]
    const back = await compare(page, { state: both, steps: release(false) }, { state: both, steps: release(true) })
    expect(back.changedPixels).toBe(0)
  })

  test('Auto Performance ON makes materially different choices only where authorized', async ({ page }) => {
    const music = { energy: 0.95, trackCurve: 0.95, frames: 14, dt: 0.05 }
    const scene = (auto: boolean, state: Record<string, number | boolean | string>): Scenario => ({ state: { ...state, [AUTO]: auto }, steps: [music] })
    // Nothing authorized: identical.
    const unauthorized = await compare(page, scene(false, {}), scene(true, {}))
    expect(unauthorized.changedPixels).toBe(0)
    // Master Reactivity authorizes skin emphasis: the frame differs.
    const authorized = await compare(page, scene(false, { [MR]: 1 }), scene(true, { [MR]: 1 }))
    expect(authorized.changedPixels).toBeGreaterThan(400)
    expect(authorized.changedInCorners).toBe(0)
    // Low-intensity music: Auto favors sparse lines within the user's ceiling.
    const calm = { energy: 0.05, trackCurve: 0.05, frames: 14, dt: 0.05 }
    const sparse = await compare(page, { state: { [MR]: 1, [AUTO]: false }, steps: [calm] }, { state: { [MR]: 1, [AUTO]: true }, steps: [calm] })
    expect(sparse.changedPixels).toBeGreaterThan(200)
    expect(sparse.meanLuma).toBeGreaterThan(0)
    // A zeroed Gesture Intensity keeps Auto from staging a large gesture.
    const gesture = (auto: boolean): Scenario => ({ state: { [GESTURE]: 0, [AUTO]: auto }, steps: [{ ...music }, { dropMoments: [{ id: DROP_IDS.reach, timeSec: 10.71 }], frames: 1 }, { frames: 4, dt: 0.05 }] })
    const zeroed = await compare(page, gesture(false), gesture(true))
    expect(zeroed.changedPixels).toBe(0)
  })
})
