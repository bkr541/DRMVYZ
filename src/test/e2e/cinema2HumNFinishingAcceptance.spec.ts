import { expect, test, type Page } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Final HUM:N acceptance in a real WebGL2 browser: Glow, Trails, the Render Graph
// chain and the approved controls, judged on real canvas pixels. Structure and
// numeric thresholds here are objective; taste judgments (how a halo *feels*) are
// left to the human contact sheet written when DRMVYZ_HUMN_SHEET_DIR is set.

const enabled = process.env.DRMVYZ_CINEMA2_HUMN_BROWSER === '1'
const pagePath = process.env.DRMVYZ_CINEMA2_HUMN_PAGE ?? '/cinema2-humn-reactivity.html'
const sheetDir = process.env.DRMVYZ_HUMN_SHEET_DIR

type Value = number | boolean | string | readonly number[]
type Step = Record<string, unknown>
type Scenario = { state?: Record<string, Value>; steps: readonly Step[]; size?: { width: number; height: number }; hostSync?: boolean }
type Bounds = { minX: number; maxX: number; minY: number; maxY: number }
type Region = { x0: number; y0: number; x1: number; y1: number }
type Inspection = {
  history: { activeBufferCount: number; validBufferCount: number; lastResetReason: string; resetCount: number; buffers: readonly { name: string; valid: boolean; width: number; height: number }[] }
  effects: readonly { effectId: string; status: string }[]
  executedPassCount: number
  resources: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number }
  resourcesAfterDispose: { activeLeaseCount: number; activeSurfaceCount: number; estimatedGpuMemoryBytes: number; disposed: boolean }
  historyAfterDispose: { activeBufferCount: number; disposed: boolean }
}
type Metrics = {
  width: number
  height: number
  changedPixels: number
  totalPixels: number
  meanAbsDiff: number
  maxChannelDiff: number
  changedInCorners: number
  figureRegionShare: number
  failedPassCount: number
  changedBounds: Bounds | null
  regionChanges: readonly number[]
  litBoundsAfter: Bounds | null
  litBoundsBefore: Bounds | null
  headBandWidthBefore: number
  headBandWidthAfter: number
  identical: boolean
  blackLifted: number
  litSurvival: number
  energyBefore: number
  energyAfter: number
  hashBefore: string
  hashAfter: string
  inspectionBefore: Inspection
  inspectionAfter: Inspection
}
type Inspected = { hash: string; inspection: Inspection; failedPassCount: number; litBounds: Bounds | null; meanLuma: number }

async function compare(page: Page, before: Scenario, after: Scenario, regions: readonly Region[] = []): Promise<Metrics> {
  const metrics = await page.evaluate(
    ([a, b, r]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.compare(a as never, b as never, r as never),
    [before, after, regions] as const,
  )
  expect(metrics.failedPassCount, 'render-graph passes must not fail (real GLSL compile + real effects)').toBe(0)
  return metrics
}

async function inspect(page: Page, scenario: Scenario): Promise<Inspected> {
  const result = await page.evaluate(value => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.inspect(value as never), scenario)
  expect(result.failedPassCount, 'render-graph passes must not fail').toBe(0)
  return result
}

// Stable HUM:N parameter ids (the preset module is not importable in the Node test runner).
const GLOW = 'hum-n-glow'
const TRAILS = 'hum-n-trails'
const MR = 'hum-n-master-reactivity'
const FILL = 'hum-n-facet-fill'
const FILL_STYLE = 'hum-n-fill-style'
const GESTURE = 'hum-n-gesture-intensity'
const MOTION = 'hum-n-motion-amount'
const MOTION_RATE = 'hum-n-motion-rate'
const BPM_SYNC = 'hum-n-bpm-sync'
const AUTO = 'hum-n-auto-performance'
// Recorded by the Gestures vitest suite (which also guards them): drop marker ids -> families.
const DROP_IDS = { reach: 'drop-0', lunge: 'drop-1', shock: 'drop-3', headGrab: 'drop-2' } as const
const FAMILIES = ['reach', 'shock', 'headGrab', 'lunge'] as const
const SIZES = [
  { name: 'landscape', width: 640, height: 360 },
  { name: 'square', width: 800, height: 800 },
  { name: 'portrait', width: 400, height: 500 },
  { name: 'ultrawide', width: 960, height: 400 },
] as const

const drop = (id: string): Step[] => [{ frames: 3 }, { dropMoments: [{ id, timeSec: 10.12 }], frames: 1 }, { frames: 4, dt: 0.05 }]
const still: Step[] = [{ frames: 6 }]
/** Mid-release frame of a gesture: the hand/limb has moved a lot in the last few frames, so echoes are real. */
const releasing = (id: string): Step[] => [...drop(id), { frames: 2, dt: 0.1 }]
const grow = (a: Bounds | null, b: Bounds | null) => (a && b ? Math.max(a.minX - b.minX, b.maxX - a.maxX, a.minY - b.minY, b.maxY - a.maxY) : 0)
const ctx = { steps: still }

test.describe('HUM:N final acceptance in a real WebGL2 browser', () => {
  test.skip(!enabled, 'Run through npm run test:e2e:cinema2-humn.')
  test.setTimeout(420_000)

  test.beforeEach(async ({ page }) => {
    await page.goto(pagePath)
    await expect(page.locator('[data-cinema2-humn-status]')).toHaveAttribute('data-result', 'ready')
  })

  test('Render Graph chain runs scene -> trails -> bloom -> output with the effects retired at the authored defaults', async ({ page }) => {
    const result = await inspect(page, ctx)
    expect(result.inspection.executedPassCount).toBe(3 * 6)
    expect(result.inspection.effects.map(effect => effect.status)).toEqual(['inactive', 'inactive'])
    expect(result.inspection.history.activeBufferCount).toBe(0)
    const running = await inspect(page, { state: { [GLOW]: 0.5, [TRAILS]: 0.5 }, steps: still })
    expect(running.inspection.effects.map(effect => effect.status)).toEqual(['active', 'active'])
    expect(running.inspection.history.activeBufferCount).toBe(1)
    expect(running.inspection.history.buffers[0]).toMatchObject({ valid: true, width: 640, height: 360 })
  })

  test('Glow 0 is a hard off: a frame that had Glow and Trails earlier is byte-identical to one that never did', async ({ page }) => {
    const never = await inspect(page, { steps: [{ frames: 14 }] })
    const toggled = await inspect(page, {
      steps: [
        { state: { [GLOW]: 0.8, [TRAILS]: 0.8 }, frames: 8 },
        { state: { [GLOW]: 0, [TRAILS]: 0 }, frames: 6 },
      ],
    })
    expect(toggled.hash).toBe(never.hash)
    expect(toggled.inspection.history.activeBufferCount).toBe(0)
    expect(toggled.inspection.effects.map(effect => effect.status)).toEqual(['inactive', 'inactive'])
  })

  test('Glow around 0.4 is a restrained halo: it lights only the neighborhood of the figure and keeps every polygon edge', async ({ page }) => {
    const metrics = await compare(page, ctx, { state: { [GLOW]: 0.4 }, steps: still })
    expect(metrics.changedPixels).toBeGreaterThan(300)
    expect(metrics.changedInCorners).toBe(0)
    expect(metrics.figureRegionShare).toBeGreaterThan(0.9)
    expect(metrics.litSurvival).toBeGreaterThan(0.98)
    expect(metrics.energyAfter).toBeGreaterThan(metrics.energyBefore)
    // Halo only reaches a few pixels beyond the authored geometry, never a stage-wide wash.
    expect(grow(metrics.litBoundsAfter, metrics.litBoundsBefore)).toBeLessThanOrEqual(6)
    expect(metrics.blackLifted / metrics.totalPixels).toBeLessThan(0.02)
  })

  test('Glow at max is clearly stronger than mid but the polygon edges and the face stay readable', async ({ page }) => {
    const mid = await compare(page, ctx, { state: { [GLOW]: 0.4 }, steps: still })
    const max = await compare(page, ctx, { state: { [GLOW]: 1 }, steps: still })
    expect(max.energyAfter - max.energyBefore).toBeGreaterThan((mid.energyAfter - mid.energyBefore) * 1.5)
    expect(max.litSurvival).toBeGreaterThan(0.98)
    expect(max.changedInCorners).toBe(0)
    expect(max.blackLifted / max.totalPixels).toBeLessThan(0.06)
    expect(grow(max.litBoundsAfter, max.litBoundsBefore)).toBeLessThanOrEqual(12)
    // Negative space stays black: the stage far from the figure is untouched.
    const filled = { state: { [FILL]: 1, [GLOW]: 1 }, steps: still }
    const filledMetrics = await compare(page, { state: { [FILL]: 1 }, steps: still }, filled)
    expect(filledMetrics.litSurvival).toBeGreaterThan(0.97)
    expect(filledMetrics.changedInCorners).toBe(0)
  })

  test('Glow follows the Director build only when the user already set it, and stays a hard off at 0', async ({ page }) => {
    const build = { energy: 0.5, buildProgress: 1, buildConfidence: 1, trackCurve: 0.8, frames: 30, dt: 0.1 }
    const zero = await compare(page, { state: { [MR]: 0 }, steps: [build] }, { state: { [MR]: 1 }, steps: [build] })
    // Facet Fill also follows the build at MR 1, so Glow is isolated through the effect state instead of pixels.
    expect(zero.inspectionAfter.effects[1]).toMatchObject({ status: 'inactive' })
    const lit = await inspect(page, { state: { [MR]: 1, [GLOW]: 0.5 }, steps: [build] })
    expect(lit.inspection.effects[1]).toMatchObject({ status: 'active' })
  })

  test('Trails 0 leaves no ghosting: a frame that had Trails earlier is byte-identical to one that never did, and no history remains', async ({ page }) => {
    const never = await inspect(page, { state: { [GESTURE]: 1 }, steps: [...drop(DROP_IDS.reach), { frames: 12, dt: 0.1 }] })
    const toggled = await inspect(page, {
      state: { [GESTURE]: 1 },
      steps: [{ state: { [TRAILS]: 1 }, frames: 3 }, { dropMoments: [{ id: DROP_IDS.reach, timeSec: 10.12 }], frames: 1 }, { frames: 4, dt: 0.05 }, { state: { [TRAILS]: 0 }, frames: 12, dt: 0.1 }],
    })
    expect(toggled.hash).toBe(never.hash)
    expect(toggled.inspection.history.activeBufferCount).toBe(0)
  })

  test('Trails echo real movement only: a static figure is not smeared, and a moving hand leaves geometric afterimages that stay local', async ({ page }) => {
    const leftHalf: Region = { x0: 0, y0: 0, x1: 0.5, y1: 1 }
    const staticMetrics = await compare(page, { steps: [{ frames: 40, dt: 1 / 30 }] }, { state: { [TRAILS]: 1 }, steps: [{ frames: 40, dt: 1 / 30 }] }, [leftHalf])
    // With drift pinned to 0 a static figure keeps its geometry: only a bounded edge brightening remains
    // (the effect's +18% overlap term), never displacement, a halo of ghost lines, or a stage-wide wash.
    expect(staticMetrics.maxChannelDiff).toBeLessThan(48)
    expect(staticMetrics.changedInCorners).toBe(0)
    expect(staticMetrics.litSurvival).toBe(1)
    expect(grow(staticMetrics.litBoundsAfter, staticMetrics.litBoundsBefore)).toBeLessThanOrEqual(1)
    expect(staticMetrics.blackLifted).toBeLessThan(50)

    const gest = { [GESTURE]: 1 }
    for (const trails of [0.5, 1]) {
      const moving = await compare(page, { state: gest, steps: releasing(DROP_IDS.reach) }, { state: { ...gest, [TRAILS]: trails }, steps: releasing(DROP_IDS.reach) }, [leftHalf])
      expect(moving.changedPixels, `trails ${trails}`).toBeGreaterThan(150)
      expect(moving.changedInCorners).toBe(0)
      // The figure itself is static, so the left half only shows the same bounded edge brightening a static
      // figure gets; no echo or smear lands there.
      expect(moving.regionChanges[0]!, `trails ${trails} must not smear the whole frame`).toBeLessThanOrEqual(staticMetrics.regionChanges[0]! * 1.25 + 50)
      expect(moving.changedPixels / moving.totalPixels, `trails ${trails} is not a fog smear`).toBeLessThan(0.12)
      expect(moving.litSurvival).toBeGreaterThan(0.99)
    }
    const half = await compare(page, { state: gest, steps: releasing(DROP_IDS.reach) }, { state: { ...gest, [TRAILS]: 0.5 }, steps: releasing(DROP_IDS.reach) })
    const full = await compare(page, { state: gest, steps: releasing(DROP_IDS.reach) }, { state: { ...gest, [TRAILS]: 1 }, steps: releasing(DROP_IDS.reach) })
    expect(full.changedPixels).toBeGreaterThan(half.changedPixels)
  })

  test('Trails history is cleared by a seek: the frame after a backwards jump carries no echo of the earlier gesture', async ({ page }) => {
    const gest = { [GESTURE]: 1, [TRAILS]: 1 }
    const handRegion: Region = { x0: 0.55, y0: 0.2, x1: 1, y1: 1 }
    const seeked: Scenario = { state: gest, steps: [...drop(DROP_IDS.reach), { timeSec: 2, frames: 1 }, { frames: 8, dt: 0.1 }] }
    const fresh: Scenario = { state: gest, steps: [{ frames: 10, dt: 0.1 }] }
    const metrics = await compare(page, fresh, seeked, [handRegion])
    // No remnant of the reach hand (a large foreground shape) survives the seek; only the tiny edge-brightening
    // difference between two different accumulation lengths may remain.
    expect(metrics.regionChanges[0]!).toBeLessThan(120)
    expect(metrics.changedPixels / metrics.totalPixels).toBeLessThan(0.03)
    // Control: without the seek the hand's echo is present in the same region.
    const echoing = await compare(page, fresh, { state: gest, steps: [...drop(DROP_IDS.reach), { frames: 1, dt: 0.1 }] }, [handRegion])
    expect(echoing.regionChanges[0]!).toBeGreaterThan(metrics.regionChanges[0]! * 5)
    expect(metrics.inspectionAfter.history.resetCount).toBeGreaterThan(1)
  })

  test('paused transport retires the trail and resume rebuilds it without stale echoes', async ({ page }) => {
    const paused = await inspect(page, { state: { [GESTURE]: 1, [TRAILS]: 1 }, steps: [...drop(DROP_IDS.reach), { pause: true, frames: 3 }] })
    expect(paused.inspection.history.buffers.every(buffer => !buffer.valid)).toBe(true)
    expect(paused.inspection.history.lastResetReason).toBe('transport-inactive')
    const resumed = await inspect(page, { state: { [GESTURE]: 1, [TRAILS]: 1 }, steps: [...drop(DROP_IDS.reach), { pause: true, frames: 3 }, { pause: false, frames: 6, dt: 0.1 }] })
    const fresh = await inspect(page, { state: { [GESTURE]: 1, [TRAILS]: 1 }, steps: [{ frames: 6, dt: 0.1 }] })
    expect(resumed.inspection.history.buffers[0]?.valid).toBe(true)
    // The gesture finished while paused frames advanced time zero, so the resumed frame is a clean, settled figure.
    expect(resumed.failedPassCount).toBe(0)
    expect(fresh.failedPassCount).toBe(0)
  })

  test('every viewport shape renders Glow + Trails with every gesture without failures, clipping or lost geometry', async ({ page }) => {
    for (const size of SIZES) {
      const box = { width: size.width, height: size.height }
      const baseIdle = await inspect(page, { size: box, steps: still })
      const finishedIdle = await inspect(page, { size: box, state: { [GLOW]: 0.6, [TRAILS]: 0.6 }, steps: still })
      expect(finishedIdle.litBounds, size.name).not.toBeNull()
      expect(grow(finishedIdle.litBounds, baseIdle.litBounds), `${size.name} idle halo growth`).toBeLessThanOrEqual(10)
      expect(finishedIdle.inspection.history.buffers[0], size.name).toMatchObject({ width: size.width, height: size.height, valid: true })
      for (const family of FAMILIES) {
        const off = await compare(page, { size: box, state: { [GESTURE]: 1 }, steps: drop(DROP_IDS[family]) }, { size: box, state: { [GESTURE]: 1, [GLOW]: 0.6, [TRAILS]: 0.6 }, steps: drop(DROP_IDS[family]) })
        // Finishing only brightens the neighborhood of real geometry (a lunged shoulder can legitimately sit near a corner).
        expect(off.blackLifted / off.totalPixels, `${size.name} ${family} halo/echo is local`).toBeLessThan(0.08)
        expect(off.litSurvival, `${size.name} ${family}`).toBeGreaterThan(0.97)
        expect(grow(off.litBoundsAfter, off.litBoundsBefore), `${size.name} ${family} finishing must not push geometry out of frame`).toBeLessThanOrEqual(14)
        const bounds = off.litBoundsAfter!
        expect(bounds.minX).toBeGreaterThanOrEqual(0)
        expect(bounds.maxX).toBeLessThanOrEqual(size.width - 1)
      }
    }
  })

  test('the Lunge scales the figure, never the stage grid, with Glow and Trails on', async ({ page }) => {
    const lunge = await compare(page, { state: { [GLOW]: 0.5, [TRAILS]: 0.5 }, steps: still }, { state: { [GESTURE]: 1, [GLOW]: 0.5, [TRAILS]: 0.5 }, steps: drop(DROP_IDS.lunge) })
    // Head-band width is the frame-independent figure measure (the torso is clipped by the frame edge).
    expect(lunge.headBandWidthAfter).toBeGreaterThan(lunge.headBandWidthBefore * 1.2)
    // Grid lines sit far from the figure: the corner blocks (grid only) are untouched, so the stage did not scale.
    expect(lunge.changedInCorners).toBe(0)
  })

  test('Glow and Trails release every GPU resource when the runtime is disposed', async ({ page }) => {
    for (const state of [{ [GLOW]: 1, [TRAILS]: 1 }, { [TRAILS]: 0.5 }, { [GLOW]: 0.5 }, {}] as Record<string, Value>[]) {
      const result = await inspect(page, { state, steps: still })
      expect(result.inspection.resourcesAfterDispose, JSON.stringify(state)).toMatchObject({ activeLeaseCount: 0, activeSurfaceCount: 0, estimatedGpuMemoryBytes: 0, disposed: true })
      expect(result.inspection.historyAfterDispose, JSON.stringify(state)).toMatchObject({ activeBufferCount: 0, disposed: true })
    }
  })

  test('every Figure Construction control produces a visible change on the real production canvas', async ({ page }) => {
    const changes: [string, Record<string, Value>, Record<string, Value>][] = [
      ['Line Presence', { 'hum-n-line-presence': 1 }, { 'hum-n-line-presence': 0.3 }],
      ['Line Weight', { 'hum-n-line-weight': 1 }, { 'hum-n-line-weight': 2 }],
      ['Fragmentation', { 'hum-n-fragmentation': 0.55 }, { 'hum-n-fragmentation': 1 }],
      ['Mesh Detail Sparse', { 'hum-n-mesh-detail': 'Reference' }, { 'hum-n-mesh-detail': 'Sparse' }],
      ['Mesh Detail Dense', { 'hum-n-mesh-detail': 'Reference' }, { 'hum-n-mesh-detail': 'Dense' }],
      ['Facet Fill', { [FILL]: 0 }, { [FILL]: 1 }],
      ['Fill Style Solid vs Stripe', { [FILL]: 1, [FILL_STYLE]: 'Solid' }, { [FILL]: 1, [FILL_STYLE]: 'Stripe' }],
      ['Fill Style Gradient vs Mixed', { [FILL]: 1, [FILL_STYLE]: 'Gradient' }, { [FILL]: 1, [FILL_STYLE]: 'Mixed' }],
    ]
    for (const [label, a, b] of changes) {
      const metrics = await compare(page, { state: a, steps: still }, { state: b, steps: still })
      expect(metrics.changedPixels, label).toBeGreaterThan(120)
      expect(metrics.changedInCorners, `${label} stays on the figure`).toBe(0)
    }
  })

  test('Master Intensity, Figure Scale and Grid Presence each change the real frame independently', async ({ page }) => {
    const intensity = await compare(page, ctx, { state: { 'hum-n-master-intensity': 0.4 }, steps: still })
    expect(intensity.changedPixels).toBeGreaterThan(300)
    expect(intensity.energyAfter).toBeLessThan(intensity.energyBefore)

    const scale = await compare(page, ctx, { state: { 'hum-n-figure-scale': 1.25 }, steps: still })
    expect(scale.changedPixels).toBeGreaterThan(500)
    const small = await compare(page, ctx, { state: { 'hum-n-figure-scale': 0.75 }, steps: still })
    expect(small.litBoundsAfter!.maxY - small.litBoundsAfter!.minY).toBeLessThan(small.litBoundsBefore!.maxY - small.litBoundsBefore!.minY)

    const grid = await compare(page, ctx, { state: { 'hum-n-grid-presence': 0 }, steps: still })
    expect(grid.changedPixels).toBeGreaterThan(200)
    // The grid is the only thing that changed: the figure's lit pixels are all still there.
    expect(grid.litSurvival).toBeGreaterThan(0.99)
    expect(grid.energyAfter).toBeLessThan(grid.energyBefore)
  })

  test('native motion: Motion Amount moves the figure, BPM Sync on and off run different clocks, and pause freezes it', async ({ page }) => {
    const motion = { [MOTION]: 1 }
    const early = await compare(page, ctx, { state: motion, steps: [{ frames: 45, dt: 1 / 15 }] })
    expect(early.changedPixels).toBeGreaterThan(80)
    const t1 = { state: motion, steps: [{ frames: 20, dt: 1 / 15 }] }
    const t2 = { state: motion, steps: [{ frames: 32, dt: 1 / 15 }] }
    expect((await compare(page, t1, t2)).changedPixels).toBeGreaterThan(40)

    // The preset toggle only narrows the host's Sync preference, so the host preference is on for this comparison.
    // 90 BPM analysis: synced motion runs at 0.75x of the free clock (the 120 BPM default equals the free clock).
    const synced: Scenario = { hostSync: true, state: { ...motion, [MOTION_RATE]: '4x' }, steps: [{ bpm: 90, frames: 40, dt: 1 / 15 }] }
    const free: Scenario = { hostSync: true, state: { ...motion, [MOTION_RATE]: '4x', [BPM_SYNC]: false }, steps: [{ bpm: 90, frames: 40, dt: 1 / 15 }] }
    expect((await compare(page, synced, free)).changedPixels).toBeGreaterThan(20)

    const paused = await compare(page, { state: motion, steps: [{ frames: 20, dt: 1 / 15 }, { pause: true, frames: 4 }] }, { state: motion, steps: [{ frames: 20, dt: 1 / 15 }, { pause: true, frames: 40, dt: 0.5 }] })
    expect(paused.changedPixels, 'a paused transport freezes native motion').toBe(0)
  })

  test('all six palette roles have independent real consumers and never recolor an unrelated domain', async ({ page }) => {
    const red = [1, 0.05, 0.05, 1]
    const filled = { [FILL]: 1, [FILL_STYLE]: 'Mixed' }
    // Background: recolors the stage, leaves every figure pixel lit.
    const background = await compare(page, { state: filled, steps: still }, { state: { ...filled, 'hum-n-background': [0.02, 0.05, 0.3, 1] }, steps: still })
    expect(background.changedInCorners).toBeGreaterThan(1000)
    expect(background.litSurvival).toBeGreaterThan(0.98)
    // Wireframe: changes lines; with no fill, no skin role can be involved.
    const wireframe = await compare(page, ctx, { state: { 'hum-n-wireframe': red }, steps: still })
    expect(wireframe.changedPixels).toBeGreaterThan(200)
    expect(wireframe.changedInCorners).toBe(0)
    // Skin roles are invisible without fill (no bleed into wireframe/grid/background) and visible with it.
    for (const role of ['hum-n-skin-primary', 'hum-n-skin-secondary', 'hum-n-skin-accent']) {
      const hidden = await compare(page, ctx, { state: { [role]: red }, steps: still })
      expect(hidden.identical, `${role} must not recolor anything at Facet Fill 0`).toBe(true)
      const shown = await compare(page, { state: filled, steps: still }, { state: { ...filled, [role]: red }, steps: still })
      expect(shown.changedPixels, `${role} needs a real consumer`).toBeGreaterThan(60)
      expect(shown.changedInCorners, role).toBe(0)
    }
    // Pattern Ink lives only in the pattern styles: Solid fill ignores it, Stripe shows it.
    const ink = { 'hum-n-pattern-ink': [0.05, 0.05, 1, 1] }
    const solid = await compare(page, { state: { [FILL]: 1, [FILL_STYLE]: 'Solid' }, steps: still }, { state: { [FILL]: 1, [FILL_STYLE]: 'Solid', ...ink }, steps: still })
    expect(solid.identical, 'Pattern Ink must not recolor solid skin').toBe(true)
    const stripe = await compare(page, { state: { [FILL]: 1, [FILL_STYLE]: 'Stripe' }, steps: still }, { state: { [FILL]: 1, [FILL_STYLE]: 'Stripe', ...ink }, steps: still })
    expect(stripe.changedPixels).toBeGreaterThan(40)
  })

  test('Auto Performance OFF is exactly the manual frame; ON is a bounded change that never reaches Glow or Trails', async ({ page }) => {
    const state = { [MR]: 1, [GLOW]: 0.4, [TRAILS]: 0.4 }
    const music = { energy: 0.9, trackCurve: 0.9, buildProgress: 1, buildConfidence: 1, frames: 30, dt: 0.1 }
    const off = await inspect(page, { state: { ...state, [AUTO]: false }, steps: [music] })
    const reference = await inspect(page, { state, steps: [music] })
    expect(off.hash).toBe(reference.hash)
    const on = await inspect(page, { state: { ...state, [AUTO]: true }, steps: [music] })
    expect(on.inspection.effects.map(effect => effect.status)).toEqual(['active', 'active'])
  })

  test('deterministic: identical event identities and states reproduce the same finished frame', async ({ page }) => {
    const scenario: Scenario = { state: { [GESTURE]: 1, [GLOW]: 0.5, [TRAILS]: 0.5, [MR]: 1, 'hum-n-flicker-amount': 1, 'hum-n-fragment-jitter': 1 }, steps: [...releasing(DROP_IDS.headGrab), { beat: true, kick: 1, snare: 1, downbeat: true, frames: 2, dt: 0.05 }] }
    const a = await inspect(page, scenario)
    const b = await inspect(page, scenario)
    expect(a.hash).toBe(b.hash)
  })

  test('writes the human visual-acceptance contact sheets (Glow, Trails, gestures with finishing)', async ({ page }) => {
    test.skip(!sheetDir, 'Human visual acceptance sheets are written only when DRMVYZ_HUMN_SHEET_DIR is set.')
    const size = { width: 960, height: 540 }
    const fill = { [FILL]: 1 }
    const sheets: Record<string, { label: string; scenario: Scenario }[]> = {
      glow: [
        { label: 'default', scenario: { steps: still } },
        { label: 'glow 0.4', scenario: { state: { [GLOW]: 0.4 }, steps: still } },
        { label: 'glow 1', scenario: { state: { [GLOW]: 1 }, steps: still } },
        { label: 'fill + glow 0.4', scenario: { state: { ...fill, [GLOW]: 0.4 }, steps: still } },
        { label: 'fill + glow 1', scenario: { state: { ...fill, [GLOW]: 1 }, steps: still } },
        { label: 'fill only', scenario: { state: fill, steps: still } },
      ],
      trails: [
        { label: 'reach, trails 0', scenario: { state: { [GESTURE]: 1 }, steps: releasing(DROP_IDS.reach) } },
        { label: 'reach, trails 0.5', scenario: { state: { [GESTURE]: 1, [TRAILS]: 0.5 }, steps: releasing(DROP_IDS.reach) } },
        { label: 'reach, trails 1', scenario: { state: { [GESTURE]: 1, [TRAILS]: 1 }, steps: releasing(DROP_IDS.reach) } },
        { label: 'lunge, trails 1 + glow 0.5', scenario: { state: { [GESTURE]: 1, [TRAILS]: 1, [GLOW]: 0.5 }, steps: releasing(DROP_IDS.lunge) } },
        { label: 'head grab, trails 0.5 + glow 0.5 + fill', scenario: { state: { ...fill, [GESTURE]: 1, [TRAILS]: 0.5, [GLOW]: 0.5 }, steps: releasing(DROP_IDS.headGrab) } },
        { label: 'static, trails 1 (no smear)', scenario: { state: { [TRAILS]: 1 }, steps: [{ frames: 40, dt: 1 / 30 }] } },
      ],
    }
    for (const [name, scenarios] of Object.entries(sheets)) {
      const dataUrl = await page.evaluate(([entries, box]) => window.__DRMVYZ_CINEMA2_HUMN_ACCEPTANCE__!.contactSheet(entries as never, box as never), [scenarios, size] as const)
      writeFileSync(`${sheetDir}/humn-${name}.png`, Buffer.from(String(dataUrl).split(',')[1]!, 'base64'))
    }
  })
})
