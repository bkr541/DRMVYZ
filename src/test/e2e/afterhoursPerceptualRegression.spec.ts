import { expect, test, type Page } from '@playwright/test'
import type { AfterhoursSettings } from '../../components/vyzualz/react/CinematicWorldSettings'
import type {
  AfterhoursVisualAcceptanceCheckpointId,
  AfterhoursVisualAcceptanceMusicState,
} from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceHarness'
import type {
  AfterhoursVisualAcceptanceBeamMetadata,
  AfterhoursVisualAcceptanceMetadata,
} from '../../components/vyzualz/react/renderers/cinematic/worlds/AfterhoursVisualAcceptanceDiagnostics'

interface BrowserReport {
  checkpointId: string
  metadata: AfterhoursVisualAcceptanceMetadata
  graph: { activeNodeCount: number; initializedNodeCount: number; failedNodeCount: number; outputRendered: boolean }
}

type MusicOverride = Partial<Omit<AfterhoursVisualAcceptanceMusicState, 'impulses'>> & {
  impulses?: Partial<AfterhoursVisualAcceptanceMusicState['impulses']>
}

interface BrowserScenario {
  id: string
  checkpointId: AfterhoursVisualAcceptanceCheckpointId
  settings?: Partial<AfterhoursSettings>
  music?: MusicOverride
  clockHits?: Partial<Record<'bar' | 'bar4' | 'bar8' | 'phrase', boolean>>
  transport?: { discontinuity?: boolean; seeking?: boolean; looped?: boolean }
  reuseGraph?: boolean
}

interface BrowserPixelSample {
  width: number
  height: number
  maxRgb: number
  meanRgb: number
  litPixelRatio: number
}

type AcceptanceWindow = Window & {
  __DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__?: {
    renderScenario(scenario: BrowserScenario): Promise<BrowserReport>
    sampleCanvasPixels(): Promise<BrowserPixelSample>
  }
}

const enabled = process.env.DRMVYZ_AFTERHOURS_PERCEPTUAL_REGRESSION === '1'

async function boot(page: Page): Promise<void> {
  await page.goto(process.env.DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE_PAGE ?? '/afterhours-visual-acceptance.html')
  await expect(page.locator('[data-afterhours-acceptance-status]')).toHaveAttribute('data-result', 'ready', { timeout: 30_000 })
}

async function render(page: Page, scenario: BrowserScenario): Promise<BrowserReport> {
  const report = await page.evaluate(async value => {
    const harness = (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__
    if (!harness) throw new Error('Afterhours acceptance harness is unavailable.')
    return harness.renderScenario(value)
  }, scenario) as BrowserReport
  expect(report.graph.outputRendered, scenario.id).toBe(true)
  expect(report.graph.activeNodeCount, scenario.id).toBe(2)
  expect(report.graph.initializedNodeCount, scenario.id).toBe(2)
  expect(report.graph.failedNodeCount, scenario.id).toBe(0)
  return report
}

async function pixels(page: Page): Promise<BrowserPixelSample> {
  return page.evaluate(() => {
    const harness = (window as AcceptanceWindow).__DRMVYZ_AFTERHOURS_VISUAL_ACCEPTANCE__
    if (!harness) throw new Error('Afterhours acceptance harness is unavailable.')
    return harness.sampleCanvasPixels()
  })
}

function visibleBeams(report: BrowserReport): readonly AfterhoursVisualAcceptanceBeamMetadata[] {
  return report.metadata.beams.filter(beam => !beam.blanked)
}

function beamGeometrySignature(report: BrowserReport): string {
  return visibleBeams(report)
    .map(beam => [
      beam.fixtureId,
      beam.bank,
      beam.origin.x.toFixed(4), beam.origin.y.toFixed(4),
      beam.direction.x.toFixed(4), beam.direction.y.toFixed(4),
      beam.endpoint.x.toFixed(4), beam.endpoint.y.toFixed(4),
    ].join(':'))
    .sort()
    .join('|')
}

function directionAngleDeltaDeg(a: AfterhoursVisualAcceptanceBeamMetadata, b: AfterhoursVisualAcceptanceBeamMetadata): number {
  const dot = Math.max(-1, Math.min(1, a.direction.x * b.direction.x + a.direction.y * b.direction.y))
  return Math.acos(dot) * 180 / Math.PI
}

function maximumDirectionDeltaDeg(a: BrowserReport, b: BrowserReport): number {
  const bByFixture = new Map(visibleBeams(b).map(beam => [beam.fixtureId, beam]))
  let maximum = 0
  let compared = 0
  for (const beam of visibleBeams(a)) {
    const other = bByFixture.get(beam.fixtureId)
    if (!other) continue
    compared += 1
    maximum = Math.max(maximum, directionAngleDeltaDeg(beam, other))
  }
  expect(compared, `${a.checkpointId} vs ${b.checkpointId} must share physical fixtures`).toBeGreaterThanOrEqual(4)
  return maximum
}

function expectMirroredGeometry(report: BrowserReport): void {
  const beams = report.metadata.beams
  const pairs = new Set(beams.map(beam => beam.symmetry?.pairId).filter((pairId): pairId is string => Boolean(pairId)))
  expect(pairs.size, `${report.checkpointId} must expose bilateral pairs`).toBeGreaterThanOrEqual(2)
  for (const pairId of pairs) {
    const left = beams.find(beam => beam.symmetry?.pairId === pairId && beam.symmetry.side === 'left')
    const right = beams.find(beam => beam.symmetry?.pairId === pairId && beam.symmetry.side === 'right')
    expect(left, `${pairId} left beam`).toBeDefined()
    expect(right, `${pairId} right beam`).toBeDefined()
    expect(left!.role, `${pairId} topology role`).toBe(right!.role)
    expect(left!.origin.x, `${pairId} mirrored origin x`).toBeCloseTo(1 - right!.origin.x, 5)
    expect(left!.origin.y, `${pairId} mirrored origin y`).toBeCloseTo(right!.origin.y, 5)
    expect(left!.direction.x, `${pairId} mirrored direction x`).toBeCloseTo(-right!.direction.x, 5)
    expect(left!.direction.y, `${pairId} mirrored direction y`).toBeCloseTo(right!.direction.y, 5)
    expect(left!.endpoint.x, `${pairId} mirrored endpoint x`).toBeCloseTo(1 - right!.endpoint.x, 5)
    expect(left!.endpoint.y, `${pairId} mirrored endpoint y`).toBeCloseTo(right!.endpoint.y, 5)
    if (left!.bank === 'left') {
      expect(right!.bank, `${pairId} mirrored wing bank`).toBe('right')
      expect(left!.fixtureRole).toBe('leftWing')
      expect(right!.fixtureRole).toBe('rightWing')
    } else if (left!.bank === 'right') {
      expect(right!.bank, `${pairId} mirrored wing bank`).toBe('left')
      expect(left!.fixtureRole).toBe('rightWing')
      expect(right!.fixtureRole).toBe('leftWing')
    } else {
      expect(right!.bank, `${pairId} same-family mirror bank`).toBe(left!.bank)
      expect(right!.fixtureRole).toBe(left!.fixtureRole)
    }
  }
}

function musicAtBar(barIndex: number, overrides: MusicOverride = {}): MusicOverride {
  const beatIndex = barIndex * 4
  return {
    timeSec: barIndex * 2,
    beatIndex,
    barIndex,
    beatPhase: 0.25,
    barPhase: 0.25,
    sectionId: 'stage8-replay-section',
    sectionType: 'verse',
    sectionProgress: 0.5,
    energy: 0.62,
    bass: 0.66,
    mid: 0.48,
    high: 0.42,
    buildProgress: 0,
    dropImpact: 0,
    vocalPresence: 0.1,
    ...overrides,
    impulses: {
      beat: false,
      downbeat: false,
      kick: false,
      snare: false,
      transient: false,
      sectionStart: false,
      dropStart: false,
      ...overrides.impulses,
    },
  }
}

test.describe('Afterhours Stage 8 perceptual and production regressions', () => {
  test.skip(!enabled, 'Run with npm run test:afterhours:perceptual')

  test('enforces literal power, blackout, beam-budget, and bank authority in the live Cinema renderer', async ({ page }) => {
    test.setTimeout(120_000)
    await boot(page)

    const masterOff = await render(page, {
      id: 'stage8-master-off', checkpointId: 'music-drop-impact',
      settings: { masterIntensity: 0, blackoutAmount: 0, atmosphere: 1 },
    })
    const masterOffPixels = await pixels(page)
    expect(masterOff.metadata.masterIntensity).toBe(0)
    expect(masterOff.metadata.laserAuthority).toBe(0)
    expect(masterOffPixels.maxRgb, 'Master 0 must leave no visible ray/core/glow/scatter/source light').toBeLessThanOrEqual(2)

    const masterOn = await render(page, {
      id: 'stage8-master-on', checkpointId: 'music-drop-impact',
      settings: { masterIntensity: 1, blackoutAmount: 0, atmosphere: 1 },
    })
    const masterOnPixels = await pixels(page)
    expect(masterOn.metadata.laserAuthority).toBeGreaterThan(0.5)
    expect(masterOnPixels.maxRgb, 'Master 1 must visibly energize a non-blackout scene').toBeGreaterThan(16)
    expect(masterOnPixels.litPixelRatio, 'Master 1 must light a non-zero region, not one accidental pixel').toBeGreaterThan(0.0001)

    const blackout = await render(page, { id: 'stage8-full-blackout', checkpointId: 'full-blackout' })
    const blackoutPixels = await pixels(page)
    expect(blackout.metadata.blackout).toEqual({ amount: 1, multiplier: 0 })
    expect(blackout.metadata.laserAuthority).toBe(0)
    expect(blackoutPixels.maxRgb, 'Full blackout must zero every visible laser contribution').toBeLessThanOrEqual(2)

    const noBlackout = await render(page, {
      id: 'stage8-blackout-zero', checkpointId: 'music-drop-impact', settings: { blackoutAmount: 0 },
    })
    const noBlackoutPixels = await pixels(page)
    expect(noBlackout.metadata.blackout).toEqual({ amount: 0, multiplier: 1 })
    expect(noBlackout.metadata.laserAuthority).toBeCloseTo(noBlackout.metadata.resolvedIntensity, 5)
    expect(noBlackoutPixels.maxRgb).toBeGreaterThan(16)

    const fullBanks = await render(page, { id: 'stage8-eight-full-banks', checkpointId: 'beam-8-side-top' })
    expect(fullBanks.metadata.requestedBeamCount).toBe(8)
    expect(fullBanks.metadata.resolvedBeamCount).toBe(8)
    expect(fullBanks.metadata.beams).toHaveLength(8)
    expect(fullBanks.metadata.activeBanks).toEqual(['bottom', 'left', 'right', 'top'])

    const noSides = await render(page, {
      id: 'stage8-eight-no-sides', checkpointId: 'beam-8-side-top', settings: { sideLasers: false },
    })
    expect(noSides.metadata.requestedBeamCount).toBe(8)
    expect(noSides.metadata.beams).toHaveLength(8)
    expect(noSides.metadata.activeBanks).toEqual(['bottom', 'top'])
    expect(noSides.metadata.beams.some(beam => beam.bank === 'left' || beam.bank === 'right')).toBe(false)

    const noTop = await render(page, {
      id: 'stage8-eight-no-top', checkpointId: 'beam-8-side-top', settings: { topLasers: false },
    })
    expect(noTop.metadata.activeBanks).toEqual(['bottom', 'left', 'right'])
    expect(noTop.metadata.beams.some(beam => beam.bank === 'top')).toBe(false)
  })

  test('keeps symmetric geometry, scene topology, and scanner motion perceptually distinct and deterministic', async ({ page }) => {
    test.setTimeout(150_000)
    await boot(page)

    const symmetric = await render(page, { id: 'stage8-symmetry', checkpointId: 'beam-8-side-top' })
    expectMirroredGeometry(symmetric)

    const patterns = ['wideFan', 'splitWings', 'crossCanopy', 'diamondStar'] as const
    const sceneReports: BrowserReport[] = []
    for (const pattern of patterns) {
      sceneReports.push(await render(page, {
        id: `stage8-scene-${pattern}`,
        checkpointId: 'beam-8-side-top',
        settings: { pattern, patternChange: 'off', motionAmount: 0, beamCount: 8, sideLasers: true, topLasers: true },
      }))
    }
    expect(new Set(sceneReports.map(beamGeometrySignature)).size, 'manual scene families must not collapse to one geometry').toBe(patterns.length)
    for (let index = 0; index < sceneReports.length; index += 1) {
      for (let other = index + 1; other < sceneReports.length; other += 1) {
        expect(maximumDirectionDeltaDeg(sceneReports[index]!, sceneReports[other]!), `${patterns[index]} vs ${patterns[other]} geometry delta`).toBeGreaterThan(4)
      }
    }

    const bar8Start = await render(page, {
      id: 'stage8-pattern-change-start', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'bar8' },
      music: musicAtBar(0), clockHits: { bar8: true },
    })
    const bar8Next = await render(page, {
      id: 'stage8-pattern-change-next', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'bar8' },
      music: musicAtBar(8), clockHits: { bar8: true },
    })
    expect(bar8Next.metadata.sceneId, 'Pattern Change must change topology identity, not only variation/seed').not.toBe(bar8Start.metadata.sceneId)
    expect(beamGeometrySignature(bar8Next)).not.toBe(beamGeometrySignature(bar8Start))

    const still = await render(page, {
      id: 'stage8-motion-zero', checkpointId: 'mid-motion-wide-sweep',
      settings: { motionAmount: 0, patternChange: 'off' },
    })
    const stillOtherPhase = await render(page, {
      id: 'stage8-motion-zero-other-phase', checkpointId: 'mid-motion-wide-sweep',
      settings: { motionAmount: 0, patternChange: 'off' },
      music: { timeSec: 20.25, beatPhase: 0.9, barPhase: 0.9 },
    })
    expect(still.metadata.motion.authority).toBe(0)
    expect(maximumDirectionDeltaDeg(still, stillOtherPhase), 'Motion 0 must be an exact/negligible scanner no-op').toBeLessThan(0.01)

    const moving = await render(page, {
      id: 'stage8-motion-high', checkpointId: 'mid-motion-wide-sweep',
      settings: { motionAmount: 1, patternChange: 'off' },
    })
    const movingDelta = maximumDirectionDeltaDeg(still, moving)
    expect(moving.metadata.motion.authority).toBeGreaterThan(0.5)
    expect(movingDelta, 'High Motion must produce stage-scale angular travel').toBeGreaterThan(8)
    expect(movingDelta, 'Scanner travel must remain inside the authored 54 degree bound').toBeLessThanOrEqual(54.5)

    // Adversarial reorder before replay catches hidden frame-order/random-seed leaks.
    await render(page, { id: 'stage8-order-blackout', checkpointId: 'full-blackout' })
    await render(page, { id: 'stage8-order-diamond', checkpointId: 'diamond-star' })
    const movingReplay = await render(page, {
      id: 'stage8-motion-high-replay', checkpointId: 'mid-motion-wide-sweep',
      settings: { motionAmount: 1, patternChange: 'off' },
    })
    expect(beamGeometrySignature(movingReplay), 'fixed motion checkpoint changed after reordered replay').toBe(beamGeometrySignature(moving))
    expect(movingReplay.metadata.motion).toEqual(moving.metadata.motion)
  })

  test('preserves music-directed hierarchy and reconstructs the same logical cue after direct seek', async ({ page }) => {
    test.setTimeout(150_000)
    await boot(page)

    const phraseStart = await render(page, {
      id: 'stage8-phrase-start', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'phrase' },
      music: musicAtBar(0), clockHits: { phrase: true },
    })
    const phraseNext = await render(page, {
      id: 'stage8-phrase-next', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'phrase' },
      music: musicAtBar(8), clockHits: { phrase: true },
    })
    expect(phraseNext.metadata.sceneId, 'phrase cadence must be able to change topology').not.toBe(phraseStart.metadata.sceneId)

    const bar8Start = await render(page, {
      id: 'stage8-audio-bar8-start', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'bar8' },
      music: musicAtBar(0), clockHits: { bar8: true },
    })
    const bar8Next = await render(page, {
      id: 'stage8-audio-bar8-next', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'bar8' },
      music: musicAtBar(8), clockHits: { bar8: true },
    })
    expect(bar8Next.metadata.sceneId, '8-bar cadence must be able to change topology').not.toBe(bar8Start.metadata.sceneId)

    const beforeDrop = await render(page, {
      id: 'stage8-before-drop', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'drop' },
      music: musicAtBar(7, { sectionId: 'stage8-pre-drop', sectionType: 'build', buildProgress: 0.9 }),
    })
    const onDrop = await render(page, {
      id: 'stage8-on-drop', checkpointId: 'static-wide-fan',
      settings: { pattern: 'wideFan', patternChange: 'drop' },
      music: musicAtBar(8, {
        sectionId: 'stage8-drop', sectionType: 'drop', energy: 1, bass: 1, mid: 0.84, high: 0.78, dropImpact: 1,
        impulses: { beat: true, downbeat: true, kick: true, transient: true, sectionStart: true, dropStart: true },
      }),
    })
    expect(beforeDrop.metadata.sceneId).toBe('wideFan')
    expect(onDrop.metadata.sceneId, 'drop cadence must resolve a different authored topology').not.toBe('wideFan')
    expect(onDrop.metadata.cue.dropStart).toBe(true)

    const kick = await render(page, {
      id: 'stage8-kick-response', checkpointId: 'full-rig',
      settings: { pulseAmount: 0, blackoutAmount: 0 },
      music: { high: 0.4, impulses: { kick: true, snare: false, transient: true } },
    })
    const snare = await render(page, {
      id: 'stage8-snare-response', checkpointId: 'full-rig',
      settings: { pulseAmount: 0, blackoutAmount: 0 },
      music: { high: 0.9, impulses: { kick: false, snare: true, transient: true } },
    })
    expect(kick.metadata.bankWeights.bottom, 'kick should favor the lower fixture bank').toBeGreaterThan(snare.metadata.bankWeights.bottom)
    expect(snare.metadata.bankWeights.top, 'snare/high should favor the overhead bank').toBeGreaterThan(kick.metadata.bankWeights.top)
    expect(kick.metadata.bankWeights).not.toEqual(snare.metadata.bankWeights)

    const quiet = await render(page, { id: 'stage8-quiet', checkpointId: 'music-quiet-sparse' })
    const drop = await render(page, { id: 'stage8-drop', checkpointId: 'music-drop-impact' })
    expect(quiet.metadata.cue.sceneScale).toBe('quiet')
    expect(quiet.metadata.cue.densityTier).toBe('sparse')
    expect(drop.metadata.cue.sceneScale).toBe('drop')
    expect(drop.metadata.resolvedBeamCount).toBeGreaterThan(quiet.metadata.resolvedBeamCount)
    expect(drop.metadata.resolvedIntensity).toBeGreaterThan(quiet.metadata.resolvedIntensity)

    const replaySettings: Partial<AfterhoursSettings> = {
      pattern: 'wideFan', patternChange: 'bar8', motionAmount: 0.4, beamCount: 8, sideLasers: true, topLasers: true, blackoutAmount: 0,
    }
    await render(page, {
      id: 'stage8-sequential-0', checkpointId: 'beam-8-side-top', settings: replaySettings,
      music: musicAtBar(0, { timeSec: 0 }), transport: { discontinuity: false, seeking: false },
    })
    await render(page, {
      id: 'stage8-sequential-4', checkpointId: 'beam-8-side-top', settings: replaySettings,
      music: musicAtBar(4, { timeSec: 0.1 }), transport: { discontinuity: false, seeking: false }, reuseGraph: true,
    })
    const sequential = await render(page, {
      id: 'stage8-sequential-8', checkpointId: 'beam-8-side-top', settings: replaySettings,
      music: musicAtBar(8, { timeSec: 0.2 }), clockHits: { bar8: true },
      transport: { discontinuity: false, seeking: false }, reuseGraph: true,
    })
    const direct = await render(page, {
      id: 'stage8-direct-seek-8', checkpointId: 'beam-8-side-top', settings: replaySettings,
      music: musicAtBar(8, { timeSec: 0.2 }), clockHits: { bar8: true },
      transport: { discontinuity: true, seeking: true },
    })
    expect(direct.metadata.sceneId).toBe(sequential.metadata.sceneId)
    expect(direct.metadata.variation).toBe(sequential.metadata.variation)
    expect(direct.metadata.cue.structuralOrdinal).toBe(sequential.metadata.cue.structuralOrdinal)
    expect(direct.metadata.cue.majorOrdinal).toBe(sequential.metadata.cue.majorOrdinal)
    expect(direct.metadata.resolvedBeamCount).toBe(sequential.metadata.resolvedBeamCount)
    expect(direct.metadata.activeFixtureIds).toEqual(sequential.metadata.activeFixtureIds)
    expect(beamGeometrySignature(direct), 'direct seek must reconstruct the same logical ray geometry as sequential playback').toBe(beamGeometrySignature(sequential))
  })
})
