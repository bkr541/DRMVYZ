import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const enabled = process.env.DRMVYZ_CINEMA2_HUMN_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_HUMN_PAGE ?? '/cinema2-humn-reactivity.html'
const sheetDir = process.env.DRMVYZ_HUMN_SHEET_DIR

type Step = Record<string, number | boolean | string | undefined | readonly { id: string; timeSec: number }[] | Record<string, number | boolean | string>>
type Scenario = { state?: Record<string, number | boolean | string>; steps: readonly Step[]; size?: { width: number; height: number }; hostSync?: boolean }
type Bounds = { minX: number; maxX: number; minY: number; maxY: number }
type Inspection = { history: { activeBufferCount: number; validBufferCount: number; buffers: readonly { valid: boolean; width: number; height: number }[] }; effects: readonly { status: string }[]; executedPassCount: number; resourcesAfterDispose: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number; disposed: boolean }; historyAfterDispose: { activeBufferCount: number; disposed: boolean } }
type Metrics = {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  meanLuma: number
  failedPassCount: number
  identical: boolean
  litBoundsAfter: Bounds | null
  litBoundsBefore: Bounds | null
  energyBefore: number
  energyAfter: number
  hashBefore: string
  hashAfter: string
  inspectionBefore: Inspection
  inspectionAfter: Inspection
}
type Inspected = { hash: string; inspection: Inspection; failedPassCount: number; litBounds: Bounds | null; meanLuma: number }

async function compare(page: Page, before: Scenario, after: Scenario): Promise<Metrics> {
  const metrics = await page.evaluate(([a, b]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.compare(a as never, b as never, []) as unknown as Metrics, [before, after] as const)
  expect(metrics.failedPassCount, 'HUM:N must render without render-graph failures (real GLSL compile)').toBe(0)
  return metrics
}

async function inspect(page: Page, scenario: Scenario): Promise<Inspected> {
  const result = await page.evaluate(s => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.inspect(s as never) as unknown as Inspected, scenario)
  expect(result.failedPassCount, 'HUM:N must render without render-graph failures (real GLSL compile)').toBe(0)
  return result
}

// Stable HUM:N parameter ids (the preset module is not importable in the Node test runner).
const INTENSITY = 'hum-n-master-intensity'
const FILL = 'hum-n-facet-fill'
const FILL_STYLE = 'hum-n-fill-style'
const FLICKER = 'hum-n-flicker-amount'
const JITTER = 'hum-n-fragment-jitter'
const MOTION = 'hum-n-motion-amount'
const MOTION_RATE = 'hum-n-motion-rate'
const BPM_SYNC = 'hum-n-bpm-sync'
const AUTO = 'hum-n-auto-performance'
const AUTO_COLOR = 'hum-n-auto-color'
const SCALE = 'hum-n-figure-scale'
const GLOW = 'hum-n-glow'
const TRAILS = 'hum-n-trails'
const DETAIL = 'hum-n-mesh-detail'

const still: Step[] = [{ frames: 24, energy: 0.3 }]
const hit: Step = { beat: true, downbeat: true, kick: 1, snare: 1, energy: 0.3, frames: 1 }
const drop = (id: string): Step[] => [{ frames: 3 }, { dropMoments: [{ id, timeSec: 10.12 }], frames: 1 }, { frames: 4, dt: 0.05 }]
/** The same timeline as `drop`, with no drop in it, so the two only differ by the event. */
const noDrop: Step[] = [{ frames: 3 }, { frames: 1 }, { frames: 4, dt: 0.05 }]
const width = (bounds: Bounds | null) => (bounds ? bounds.maxX - bounds.minX : 0)
/** Everything that moves by itself switched off: only the property under test can change the frame. */
const calm = { [MOTION]: 0, [AUTO]: false, [GLOW]: 0, [TRAILS]: 0 }
/** As calm, and Master Intensity 0 removes the small beat pulse too, so the rhythm sliders are the only thing left reacting to it. */
const deaf = { ...calm, [INTENSITY]: 0 }

test.describe('HUM:N 3D figure in a real WebGL2 browser', () => {
  test.skip(!enabled, 'Run through npm run test:e2e:cinema2-humn.')
  test.setTimeout(420_000)

  test.beforeEach(async ({ page }) => {
    await page.goto(pagePath)
    await expect(page.locator('[data-cinema2-humn-status]')).toHaveAttribute('data-result', 'ready')
  })

  test('compiles its GLSL, draws the figure through scene -> trails -> bloom -> output, and leaves the stage empty (no grid)', async ({ page }) => {
    const result = await inspect(page, { state: calm, steps: still })
    expect(result.inspection.executedPassCount).toBe(3 * 24)
    expect(result.litBounds).not.toBeNull()
    // The bust sits in the middle of the frame; the left and right thirds of the stage are empty black (no background grid at all).
    const width = 640
    expect(result.litBounds!.minX).toBeGreaterThan(width * 0.2)
    expect(result.litBounds!.maxX).toBeLessThan(width * 0.8)
    const lit = await compare(page, { state: calm, steps: still }, { state: { ...calm, 'hum-n-background': [0.2, 0, 0, 1] as never }, steps: still })
    expect(lit.changedPixels, 'the Background color fills the whole stage').toBeGreaterThan(lit.totalPixels * 0.5)
  })

  test('the figure is a rotating 3D body: Motion Amount moves it and it is still when it is 0', async ({ page }) => {
    // Lines only, manual colors and no beat pulse, so the color scroll, the fill turnover and the pulse are not in the picture: nothing may move.
    const bare = { ...deaf, [FILL]: 0, [AUTO_COLOR]: false }
    const rest = await compare(page, { state: bare, steps: still }, { state: bare, steps: [{ frames: 60, energy: 0.3 }] })
    expect(rest.identical, 'Motion Amount 0 holds the figure perfectly still while the track plays').toBe(true)
    const moving = await compare(page, { state: { ...calm, [MOTION]: 1 }, steps: still }, { state: { ...calm, [MOTION]: 1 }, steps: [{ frames: 70, energy: 0.3 }] })
    expect(moving.changedPixels).toBeGreaterThan(500)
  })

  test('BPM Sync on and off run different clocks, and pause freezes the figure', async ({ page }) => {
    const base = { ...calm, [MOTION]: 1 }
    const track: Step[] = [{ frames: 90, energy: 0.3, bpm: 150 }]
    const on = await compare(page, { state: { ...base, [BPM_SYNC]: true }, steps: track }, { state: { ...base, [BPM_SYNC]: false }, steps: track })
    expect(on.changedPixels, 'locked to the beat grid versus free-running').toBeGreaterThan(300)
    // The Audio Dock Sync neither enables nor blocks the preset switch.
    const dock = await compare(page, { state: { ...base, [BPM_SYNC]: true }, steps: track, hostSync: true }, { state: { ...base, [BPM_SYNC]: true }, steps: track, hostSync: false })
    expect(dock.identical).toBe(true)
    const rate = await compare(page, { state: { ...base, [MOTION_RATE]: '1x' }, steps: track }, { state: { ...base, [MOTION_RATE]: '4x' }, steps: track })
    expect(rate.changedPixels).toBeGreaterThan(300)
    const paused = await compare(page, { state: base, steps: [{ frames: 30, energy: 0.3 }, { pause: true, frames: 3 }] }, { state: base, steps: [{ frames: 30, energy: 0.3 }, { pause: true, frames: 40 }] })
    expect(paused.identical).toBe(true)
  })

  test('Facet Fill fills triangles with color: none at 0, all of them at 1', async ({ page }) => {
    const none = await inspect(page, { state: { ...calm, [FILL]: 0 }, steps: still })
    const half = await inspect(page, { state: { ...calm, [FILL]: 0.5 }, steps: still })
    const full = await inspect(page, { state: { ...calm, [FILL]: 1 }, steps: still })
    expect(half.meanLuma).toBeGreaterThan(none.meanLuma * 1.2)
    expect(full.meanLuma).toBeGreaterThan(half.meanLuma * 1.2)
    // Fill Style changes what fills look like.
    for (const style of ['Solid', 'Gradient', 'Stripe', 'Mixed']) {
      const styled = await compare(page, { state: { ...calm, [FILL]: 1, [FILL_STYLE]: 'Mixed' }, steps: still }, { state: { ...calm, [FILL]: 1, [FILL_STYLE]: style }, steps: still })
      if (style !== 'Mixed') expect(styled.changedPixels, style).toBeGreaterThan(500)
    }
  })

  test('the filled triangles turn over and the gradients scroll as the track plays', async ({ page }) => {
    const state = { ...calm, [FILL]: 0.4 }
    const moved = await compare(page, { state, steps: [{ frames: 10, energy: 0.3 }] }, { state, steps: [{ frames: 120, energy: 0.3 }] })
    expect(moved.changedPixels).toBeGreaterThan(2000)
  })

  test('Flicker Amount flashes triangles on the beat and Fragment Jitter throws them off the body on the kick, visibly, and the thrown triangles settle back', async ({ page }) => {
    const base = { ...deaf, [FILL]: 0.3, [FLICKER]: 0, [JITTER]: 0 }
    const off = await compare(page, { state: base, steps: [{ frames: 23, energy: 0.3 }, { frames: 1, energy: 0.3 }] }, { state: base, steps: [{ frames: 23, energy: 0.3 }, hit] })
    expect(off.changedPixels, 'at 0 (and with Master Intensity 0) a beat, kick, snare and downbeat change nothing').toBeLessThan(400)
    const flicker = await compare(page, { state: { ...base, [FLICKER]: 0 }, steps: [...still, hit] }, { state: { ...base, [FLICKER]: 1 }, steps: [...still, hit] })
    expect(flicker.changedPixels, 'Flicker Amount 1 flashes a lot of triangles').toBeGreaterThan(3000)
    const jitter = await compare(page, { state: { ...base, [JITTER]: 0 }, steps: [...still, hit] }, { state: { ...base, [JITTER]: 1 }, steps: [...still, hit] })
    expect(jitter.changedPixels, 'Fragment Jitter 1 throws triangles off the body').toBeGreaterThan(1500)
    // Long after a kick the thrown triangles are back exactly where they were (a downbeat also re-rolls which triangles are filled, for good).
    const settle: Step = { frames: 60, dt: 0.1, energy: 0.3 }
    const settled = await compare(page, { state: { ...base, [JITTER]: 1 }, steps: [{ frames: 23, energy: 0.3 }, { frames: 1, energy: 0.3 }, settle] }, { state: { ...base, [JITTER]: 1 }, steps: [{ frames: 23, energy: 0.3 }, hit, settle] })
    expect(settled.changedPixels).toBeLessThan(1500)
  })

  test('Auto Color follows the music, and the manual colors only count with it off', async ({ page }) => {
    const state = { ...calm, [FILL]: 1 }
    const keyed = (key: string, mode: string): Step[] => [{ frames: 150, energy: 0.3, key, mode }]
    const c = await inspect(page, { state, steps: keyed('C', 'major') })
    const fsharp = await inspect(page, { state, steps: keyed('F#', 'major') })
    expect(c.hash).not.toBe(fsharp.hash)
    const manualA = await inspect(page, { state: { ...state, 'hum-n-skin-primary': [1, 0, 0, 1] as never }, steps: keyed('C', 'major') })
    expect(manualA.hash, 'with Auto Color on, a manual color is ignored').toBe(c.hash)
    const off = { ...state, [AUTO_COLOR]: false }
    const red = await inspect(page, { state: { ...off, 'hum-n-skin-primary': [1, 0, 0, 1] as never }, steps: keyed('C', 'major') })
    const blue = await inspect(page, { state: { ...off, 'hum-n-skin-primary': [0, 0, 1, 1] as never }, steps: keyed('C', 'major') })
    expect(red.hash).not.toBe(blue.hash)
    expect(red.hash).not.toBe(c.hash)
  })

  test('Figure Scale grows the figure up to a close-up and shrinks it down', async ({ page }) => {
    const bounds = async (scale: number) => (await inspect(page, { state: { ...calm, [SCALE]: scale }, steps: still })).litBounds
    const small = width(await bounds(0.6))
    const normal = width(await bounds(1))
    const big = width(await bounds(1.7))
    expect(small).toBeLessThan(normal * 0.85)
    expect(big).toBeGreaterThan(normal * 1.2)
    // At the top of the range the head fills the frame from edge to edge: the crown is cropped by the top and the chin sits low.
    const huge = (await bounds(2.5))!
    expect(huge.minY).toBeLessThanOrEqual(2)
    expect(huge.maxY).toBeGreaterThan(300)
    const closeUp = await inspect(page, { state: { ...calm, [SCALE]: 2.5, [FILL]: 0.6 }, steps: still })
    expect(closeUp.meanLuma).toBeGreaterThan(5)
  })

  test('Auto Performance poses the figure on a drop, and nothing else does; Master Intensity scales it', async ({ page }) => {
    // Manual colors: Auto Color also reacts to a drop (saturation swells), which is not what is under test here.
    const auto = { ...calm, [AUTO]: true, [INTENSITY]: 1, [AUTO_COLOR]: false }
    const dropped = await compare(page, { state: auto, steps: noDrop }, { state: auto, steps: drop('drop-0') })
    expect(dropped.changedPixels, 'a drop reaches, recoils, grabs or lunges').toBeGreaterThan(3000)
    const manual = await compare(page, { state: { ...auto, [AUTO]: false }, steps: noDrop }, { state: { ...auto, [AUTO]: false }, steps: drop('drop-0') })
    expect(manual.changedPixels, 'with Auto Performance off the drop leaves the pose alone').toBeLessThan(1500)
    const weak = await compare(page, { state: { ...auto, [INTENSITY]: 0 }, steps: noDrop }, { state: { ...auto, [INTENSITY]: 0 }, steps: drop('drop-0') })
    expect(weak.changedPixels, 'Master Intensity 0 plays no gesture').toBeLessThan(1500)
    // The same drop event reproduces the same frame.
    const a = await inspect(page, { state: auto, steps: drop('drop-2') })
    const b = await inspect(page, { state: auto, steps: drop('drop-2') })
    expect(a.hash).toBe(b.hash)
  })

  test('Mesh Detail changes the body: sparse thins the lines and dense doubles the triangles', async ({ page }) => {
    const state = { ...calm, [FILL]: 0.5 }
    const sparse = await compare(page, { state: { ...state, [DETAIL]: 'Reference' }, steps: still }, { state: { ...state, [DETAIL]: 'Sparse' }, steps: still })
    expect(sparse.changedPixels).toBeGreaterThan(500)
    const dense = await compare(page, { state: { ...state, [DETAIL]: 'Reference' }, steps: still }, { state: { ...state, [DETAIL]: 'Dense' }, steps: still })
    expect(dense.changedPixels).toBeGreaterThan(3000)
  })

  test('Glow 0 and Trails 0 are hard offs, and Glow and Trails run their engine effects when set', async ({ page }) => {
    const never = await inspect(page, { state: calm, steps: [{ frames: 14 }] })
    const toggled = await inspect(page, { state: { ...calm, [GLOW]: 0.8, [TRAILS]: 0.8 }, steps: [{ frames: 8 }, { state: { [GLOW]: 0, [TRAILS]: 0 }, frames: 6 }] })
    expect(toggled.hash).toBe(never.hash)
    expect(toggled.inspection.history.activeBufferCount).toBe(0)
    expect(toggled.inspection.effects.map(effect => effect.status)).toEqual(['inactive', 'inactive'])
    const running = await inspect(page, { state: { ...calm, [GLOW]: 0.5, [TRAILS]: 0.5 }, steps: still })
    expect(running.inspection.effects.map(effect => effect.status)).toEqual(['active', 'active'])
    expect(running.inspection.history.buffers[0]).toMatchObject({ valid: true, width: 640, height: 360 })
    const glow = await compare(page, { state: { ...calm, [FILL]: 0.5 }, steps: still }, { state: { ...calm, [FILL]: 0.5, [GLOW]: 0.6 }, steps: still })
    expect(glow.energyAfter).toBeGreaterThan(glow.energyBefore)
  })

  test('every viewport shape renders the figure without failures, and the runtime releases every GPU resource on disposal', async ({ page }) => {
    for (const size of [{ width: 640, height: 360 }, { width: 800, height: 800 }, { width: 400, height: 500 }, { width: 960, height: 400 }]) {
      const result = await inspect(page, { size, state: { ...calm, [GLOW]: 0.5, [TRAILS]: 0.5, [FILL]: 0.6 }, steps: [...still, ...drop('drop-1')] })
      expect(result.litBounds, `${size.width}x${size.height}`).not.toBeNull()
    }
    const result = await inspect(page, { state: { ...calm, [GLOW]: 0.5, [TRAILS]: 0.5 }, steps: still })
    expect(result.inspection.resourcesAfterDispose).toMatchObject({ activeLeaseCount: 0, activeSurfaceCount: 0, disposed: true })
    expect(result.inspection.historyAfterDispose).toMatchObject({ activeBufferCount: 0, disposed: true })
  })

  test('is deterministic: identical event identities and states reproduce the same frame', async ({ page }) => {
    const scenario: Scenario = { state: { [INTENSITY]: 1, [GLOW]: 0.5, [FLICKER]: 1, [JITTER]: 1 }, steps: [...drop('drop-3'), { beat: true, kick: 1, snare: 1, downbeat: true, frames: 2, dt: 0.05 }] }
    const a = await inspect(page, scenario)
    const b = await inspect(page, scenario)
    expect(a.hash).toBe(b.hash)
  })

  test('writes the human visual-acceptance contact sheets', async ({ page }) => {
    test.skip(!sheetDir, 'Human visual acceptance sheets are written only when DRMVYZ_HUMN_SHEET_DIR is set.')
    const size = { width: 960, height: 540 }
    const sheets: Record<string, { label: string; scenario: Scenario }[]> = {
      look: [
        { label: 'default', scenario: { steps: [{ frames: 60, energy: 0.4, key: 'A', mode: 'minor' }] } },
        { label: 'fill 1, gradient', scenario: { state: { [FILL]: 1, [FILL_STYLE]: 'Gradient' }, steps: [{ frames: 60, energy: 0.6, key: 'C', mode: 'major' }] } },
        { label: 'fill 0.6 mixed, glow 0.6', scenario: { state: { [FILL]: 0.6, [GLOW]: 0.6 }, steps: [{ frames: 60, energy: 0.6, key: 'E', mode: 'major' }] } },
        { label: 'dense, fill 0.5', scenario: { state: { [DETAIL]: 'Dense', [FILL]: 0.5 }, steps: [{ frames: 60, energy: 0.5, key: 'D', mode: 'minor' }] } },
        { label: 'scale 2, fill 0.7', scenario: { state: { [SCALE]: 2, [FILL]: 0.7 }, steps: [{ frames: 60, energy: 0.5, key: 'G', mode: 'major' }] } },
        { label: 'kick + snare + downbeat, flicker 1, jitter 1', scenario: { state: { [FLICKER]: 1, [JITTER]: 1, [FILL]: 0.4 }, steps: [{ frames: 40, energy: 0.6 }, hit] } },
      ],
      poses: ['drop-0', 'drop-1', 'drop-2', 'drop-3', 'drop-4', 'drop-5'].map(id => ({ label: id, scenario: { state: { [INTENSITY]: 1, [FILL]: 0.5, [MOTION]: 0.3 }, steps: [...drop(id), { frames: 2, dt: 0.05 }] } })),
    }
    for (const [name, scenarios] of Object.entries(sheets)) {
      const dataUrl = await page.evaluate(([entries, box]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.contactSheet(entries as never, box as never), [scenarios, size] as const)
      writeFileSync(`${sheetDir}/humn-${name}.png`, Buffer.from(String(dataUrl).split(',')[1]!, 'base64'))
    }
  })
})
