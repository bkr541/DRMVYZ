import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface VisualReviewPixelMetrics {
  meanLuminance: number
  visibleLuminance: number
  meanSaturation: number
  blackFrameRatio: number
  litPixelRatio: number
  sourceBloomPeakRatio: number
  washedBrightPixelRatio: number
  centerLitPixelRatio: number
}

interface VisualReviewEffectMetrics {
  activeFixtureCount: number
  activeBeamFixtureCount: number
  activeLedFixtureCount: number
  activeRowCount: number
  activeColumnCount: number
  activeMovingHeadCount: number
  activeMovementBankCount: number
  strobeActivations: number
  blinderActivations: number
  hazeLevel: number
  co2BurstCount: number
  maximumStrobeDurationMs: number
  maximumBlinderDurationMs: number
  maximumCo2BurstDurationMs: number
  stateSignature: string
  movementSignature: string
  effectSignature: string
}

interface VisualReviewGeometryMetrics {
  activeSourceCount: number
  originDistinguishability: number
  angularDiversity: number
  protectedZoneOccupancy: number
  leftRightSymmetry: number
  topBottomSymmetry: number
  heroToTextureBrightnessRatio: number
  roleCounts: Record<string, number>
  geometrySignature: string
}

interface VisualReviewFrame {
  key: string
  canvasId: string
  presetId: string
  presetName: string
  sourceRigLayoutId: string | null
  performanceProgramId: string
  frameId: string
  timeSec: number
  renderSettleMs: number
  seed: number
  trackAssumptions: Record<string, unknown>
  section: string
  beat: number
  bar: number
  absoluteBar: number
  fourBarIndex: number
  eightBarIndex: number
  sixteenBarIndex: number
  dropOccurrence: number
  recruitmentStage: number
  activeMotif: string | null
  fixtureCount: number
  activeFixtureCount: number
  authoredBeamCount: number
  compiledBeamCount: number
  visibleBeamCount: number
  staticSourceRigImmutable: boolean
  geometryMetrics: VisualReviewGeometryMetrics
  effectMetrics: VisualReviewEffectMetrics
  pixelMetrics: VisualReviewPixelMetrics
  screenshotPath: string
  stateReportPath: string
}

interface VisualReviewReport {
  ready: boolean
  width: number
  height: number
  expectedFrameCount: number
  trackAssumptions: Record<string, unknown>
  frames: VisualReviewFrame[]
}

interface VisualReviewShowCountSummary {
  presetId: string
  presetName: string
  sourceRigLayoutId: string | null
  performanceProgramId: string
  frames: Array<{
    frameId: string
    section: string
    activeFixtureCount: number
    authoredBeamCount: number
    compiledBeamCount: number
    visibleBeamCount: number
    beamRoleCounts: Record<string, number>
    activeRows: number
    activeColumns: number
    movementBanks: number
    strobeActivations: number
    blinderActivations: number
    hazeLevel: number
    burstCount: number
    maximumEffectDurationMs: number
  }>
}

declare global {
  interface Window {
    __SHOW_DIRECTOR_VISUAL_REVIEW__?: VisualReviewReport
  }
}

const enabled = process.env.DRMVYZ_SHOW_DIRECTOR_VISUAL_REVIEW === '1'
const outputRoot = path.resolve(process.cwd(), 'artifacts/show-director-visual-review')
const beamShowIds = new Set([
  'prism-cathedral',
  'cardinal-fan-reactor',
  'cyan-mirror-cage',
  'small-club-rig-performance',
  'festival-front-beams-performance',
  'dubstep-drop-lasers-performance',
])
const continuouslyRenderedMixedShowIds = new Set([
  'led-bar-grid-performance',
  'moving-head-sweep-performance',
])

function showCountSummary(frames: readonly VisualReviewFrame[]): VisualReviewShowCountSummary[] {
  const byShow = new Map<string, VisualReviewShowCountSummary>()
  for (const frame of frames) {
    const current = byShow.get(frame.presetId) ?? {
      presetId: frame.presetId,
      presetName: frame.presetName,
      sourceRigLayoutId: frame.sourceRigLayoutId,
      performanceProgramId: frame.performanceProgramId,
      frames: [],
    }
    current.frames.push({
      frameId: frame.frameId,
      section: frame.section,
      activeFixtureCount: frame.activeFixtureCount,
      authoredBeamCount: frame.authoredBeamCount,
      compiledBeamCount: frame.compiledBeamCount,
      visibleBeamCount: frame.visibleBeamCount,
      beamRoleCounts: frame.geometryMetrics.roleCounts,
      activeRows: frame.effectMetrics.activeRowCount,
      activeColumns: frame.effectMetrics.activeColumnCount,
      movementBanks: frame.effectMetrics.activeMovementBankCount,
      strobeActivations: frame.effectMetrics.strobeActivations,
      blinderActivations: frame.effectMetrics.blinderActivations,
      hazeLevel: frame.effectMetrics.hazeLevel,
      burstCount: frame.effectMetrics.co2BurstCount,
      maximumEffectDurationMs: Math.max(
        frame.effectMetrics.maximumStrobeDurationMs,
        frame.effectMetrics.maximumBlinderDurationMs,
        frame.effectMetrics.maximumCo2BurstDurationMs,
      ),
    })
    byShow.set(frame.presetId, current)
  }
  return [...byShow.values()]
}

test.describe('Show Director rendered visual review', () => {
  test.skip(!enabled, 'Run with npm run visual:show-director')

  test('captures 100 representative frames and writes deterministic visual, state, and count reports', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>
      :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#05070b;color:#e9faff}*{box-sizing:border-box}body{margin:0;padding:20px;background:#05070b}h1{margin:0 0 6px;font-size:22px}p{margin:0 0 18px;color:#99a9b8;font-size:13px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(470px,1fr));gap:16px}article{border:1px solid #1b2b37;border-radius:10px;padding:10px;background:#080d13}header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}h2{margin:0;font-size:13px;font-weight:650}code{color:#7eeeff;font-size:10px}canvas{display:block;width:100%;height:auto;background:#000;border-radius:6px}
    </style></head><body><h1>Show Director Final Visual Validation</h1><p>Deterministic 120 BPM test track, seed 0x5a17cafe, Canvas2D Beam Matrix and fog renderers.</p><main id="review-grid"></main></body></html>`)
    await page.addScriptTag({ path: path.join(outputRoot, '.runtime/showDirectorVisualReview.bundle.js') })
    await page.waitForFunction(() => document.documentElement.dataset.visualReviewReady === 'true')
    const report = await page.evaluate<VisualReviewReport | undefined>(() => window.__SHOW_DIRECTOR_VISUAL_REVIEW__)
    expect(report?.ready).toBe(true)
    expect(report?.expectedFrameCount).toBe(100)
    expect(report?.frames).toHaveLength(100)
    expect(new Set(report!.frames.map(frame => frame.presetId)).size).toBe(10)
    expect(new Set(report!.frames.map(frame => frame.key)).size).toBe(100)
    await mkdir(outputRoot, { recursive: true })

    for (const frame of report!.frames) {
      expect(frame.authoredBeamCount, frame.key).toBeLessThanOrEqual(300)
      expect(frame.compiledBeamCount, frame.key).toBeLessThanOrEqual(300)
      expect(frame.staticSourceRigImmutable, frame.key).toBe(true)
      expect(frame.effectMetrics.maximumStrobeDurationMs, frame.key).toBeLessThanOrEqual(120)
      expect(frame.effectMetrics.maximumBlinderDurationMs, frame.key).toBeLessThanOrEqual(250)
      expect(frame.effectMetrics.maximumCo2BurstDurationMs, frame.key).toBeLessThanOrEqual(700)
      expect(frame.effectMetrics.hazeLevel, frame.key).toBeLessThanOrEqual(0.65)
      expect(frame.pixelMetrics.sourceBloomPeakRatio, frame.key).toBeLessThan(0.12)
      const isBoundedImpactFrame = frame.key.endsWith('/drop-1-impact') || frame.key.endsWith('/drop-2-impact')
      expect(frame.pixelMetrics.washedBrightPixelRatio, frame.key).toBeLessThan(
        isBoundedImpactFrame ? 0.12 : 0.08,
      )

      const requiresContinuousCanvasOutput = beamShowIds.has(frame.presetId)
        || continuouslyRenderedMixedShowIds.has(frame.presetId)
      if (requiresContinuousCanvasOutput) {
        expect(frame.compiledBeamCount, frame.key).toBeGreaterThan(0)
        expect(frame.visibleBeamCount, frame.key).toBeGreaterThan(0)
        expect(frame.pixelMetrics.litPixelRatio, frame.key).toBeGreaterThan(0.00005)
        expect(frame.pixelMetrics.blackFrameRatio, frame.key).toBeLessThan(0.99995)
      }

      const directory = path.join(outputRoot, frame.presetId)
      await mkdir(directory, { recursive: true })
      await page.locator(`#${frame.canvasId}`).screenshot({ path: path.join(outputRoot, frame.screenshotPath) })
      await writeFile(
        path.join(outputRoot, frame.stateReportPath),
        `${JSON.stringify(frame, null, 2)}\n`,
        'utf8',
      )
    }

    const reportWithCommand = { generatedBy: 'npm run visual:show-director', ...report }
    await writeFile(path.join(outputRoot, 'report.json'), `${JSON.stringify(reportWithCommand, null, 2)}\n`, 'utf8')
    await writeFile(path.join(outputRoot, 'counts.json'), `${JSON.stringify(showCountSummary(report!.frames), null, 2)}\n`, 'utf8')

    const byKey = new Map(report!.frames.map(frame => [frame.key, frame]))
    for (const presetId of beamShowIds) {
      const verse = byKey.get(`${presetId}/verse`)!
      const dropOneImpact = byKey.get(`${presetId}/drop-1-impact`)!
      const dropOne = byKey.get(`${presetId}/drop-1-body`)!
      const breakdown = byKey.get(`${presetId}/breakdown`)!
      const dropTwoImpact = byKey.get(`${presetId}/drop-2-impact`)!
      const dropTwo = byKey.get(`${presetId}/drop-2-body`)!
      expect(dropOne.compiledBeamCount, presetId).toBeGreaterThan(verse.compiledBeamCount)
      expect(breakdown.compiledBeamCount, presetId).toBeLessThan(dropTwo.compiledBeamCount)
      expect(dropTwoImpact.effectMetrics.stateSignature, presetId).not.toBe(dropOneImpact.effectMetrics.stateSignature)
      expect(dropTwo.compiledBeamCount, presetId).toBeGreaterThan(verse.compiledBeamCount)
      expect(dropOne.pixelMetrics.meanSaturation, presetId).toBeGreaterThan(0.08)
      expect(dropTwo.effectMetrics.stateSignature, presetId).not.toBe(dropOne.effectMetrics.stateSignature)
    }

    const ledDropOne = byKey.get('led-bar-grid-performance/drop-1-body')!
    const ledDropTwo = byKey.get('led-bar-grid-performance/drop-2-body')!
    expect(ledDropOne.effectMetrics.activeRowCount).toBeGreaterThan(1)
    expect(ledDropOne.effectMetrics.activeColumnCount).toBeGreaterThan(1)
    expect(ledDropTwo.effectMetrics.stateSignature).not.toBe(ledDropOne.effectMetrics.stateSignature)

    const movingDropOne = byKey.get('moving-head-sweep-performance/drop-1-body')!
    const movingDropTwo = byKey.get('moving-head-sweep-performance/drop-2-body')!
    expect(movingDropOne.effectMetrics.activeMovementBankCount).toBeGreaterThanOrEqual(2)
    expect(movingDropTwo.effectMetrics.movementSignature).not.toBe(movingDropOne.effectMetrics.movementSignature)

    const strobeImpact = byKey.get('strobe-blinder-hits-performance/drop-2-impact')!
    expect(strobeImpact.effectMetrics.strobeActivations).toBeGreaterThan(0)
    expect(strobeImpact.effectMetrics.blinderActivations).toBeGreaterThan(0)
    expect(strobeImpact.effectMetrics.maximumStrobeDurationMs).toBeLessThanOrEqual(100)
    expect(strobeImpact.effectMetrics.maximumBlinderDurationMs).toBeLessThanOrEqual(250)

    const hazeBreakdown = byKey.get('haze-co2-drops-performance/breakdown')!
    const hazeDropTwo = byKey.get('haze-co2-drops-performance/drop-2-impact')!
    const hazeOutro = byKey.get('haze-co2-drops-performance/outro')!
    expect(hazeBreakdown.effectMetrics.co2BurstCount).toBe(0)
    expect(hazeDropTwo.effectMetrics.co2BurstCount).toBeGreaterThan(0)
    expect(hazeOutro.effectMetrics.hazeLevel).toBeLessThan(0.08)
  })
})
