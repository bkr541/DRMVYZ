import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorMacroScanPlan,
} from '../../ReactTypes'
import {
  aggregateLaserDmxScannerExposureSamples,
  solveLaserDmxScannerExposure,
} from './LaserDmxScannerDomain'
import { createLaserDmxMacroScannerPlan } from './LaserDmxMacroScannerPlanner'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { buildLaserDmxScannerExposurePlan } from './LaserDmxScannerWebGLPlan'

const COLOR = { r: 0.1, g: 0.85, b: 1, a: 1 }
const ORIGIN = { x: 0.5, y: 0.05, z: 0 }

function macro(patch: Partial<LaserDmxShowDirectorMacroScanPlan> = {}): LaserDmxShowDirectorMacroScanPlan {
  const raySlots = patch.raySlots ?? Array.from({ length: 12 }, (_, index) => index / 11)
  return {
    schemaVersion: 1,
    authoritative: true,
    cueFrameId: 'frame-1',
    cueId: 'cue-1',
    macroId: 'macro-1',
    topologyId: 'fan-12',
    topologyRevision: 7,
    topologyCacheKey: 'cache:fan-12',
    family: 'steppedFan',
    assignmentId: 'bank-a',
    fixtureMemberIndex: 0,
    fixtureMemberCount: 1,
    raySlots,
    pathPointCount: raySlots.length,
    spacingCurve: 'linear',
    traversal: 'sequential',
    centerX: 0.5,
    centerY: 0.62,
    depth: 0,
    width: 0.8,
    height: 0.7,
    radius: 0.38,
    rotationDeg: 0,
    fanSpreadDeg: 84,
    scanRatePps: 24_000,
    direction: 'forward',
    phase: 0.25,
    pointDwellMicros: 36,
    cornerDwellMicros: 64,
    edgeDwellMicros: 96,
    blankingDelayMicros: 18,
    retraceBlanking: true,
    blankBetweenSlots: true,
    repeatMode: 'loop',
    interpolation: 'linear',
    totalDutyCycle: 0.82,
    intensity: 1,
    colorBlend: 0,
    opticalMode: 'normal',
    opticalCopyCount: 1,
    opticalCopySpreadDeg: 0,
    apertureCount: 1,
    transitionType: 'steady',
    transitionProgress: 1,
    shutterClosed: false,
    clearTemporalHistory: false,
    preservePhase: true,
    ...patch,
  }
}

function fixture(id = 'laser-a') {
  const value = createDefaultLaserDmxShowDirectorFixture('laser', id, 0)
  value.brightness = 1
  value.enabled = true
  value.beam.beamEnabled = true
  return value
}

function plan(input = macro(), id = 'laser-a') {
  return createLaserDmxMacroScannerPlan({
    fixture: fixture(id),
    macro: input,
    origin: ORIGIN,
    primitiveType: 'fan',
    color: COLOR,
  })
}

function solve(input: ReturnType<typeof plan>, quality: 'low' | 'ultra') {
  const solved = solveLaserDmxScannerExposure({
    heads: input.heads,
    paths: input.paths,
    opticalCopies: input.opticalCopies,
    originByFixtureId: new Map([[input.heads[0]!.fixtureId, ORIGIN]]),
    audioTimeSec: 8,
    bpm: 150,
    quality,
  })
  return aggregateLaserDmxScannerExposureSamples({ samples: solved.exposureSamples, paths: input.paths })
}

describe('LaserDMX macro-aware scanner planning', () => {
  it('compiles a stable 12-ray stepped fan with explicit blanked travel', () => {
    const first = plan()
    const second = plan()
    const path = first.paths[0]!
    expect(first.diagnostics.raySlotCount).toBe(12)
    expect(path.intendedRaySlots).toHaveLength(12)
    expect(path.points.filter(point => !point.blanked)).toHaveLength(12)
    expect(path.points.filter(point => point.blanked)).toHaveLength(11)
    expect(second.paths).toEqual(first.paths)
    expect(new Set(path.points.filter(point => !point.blanked).map(point => point.intendedRaySlotId)).size).toBe(12)
  })

  it('keeps equal fan spacing deterministic and symmetric', () => {
    const targets = plan().paths[0]!.intendedRaySlots!.map(slot => slot.target)
    const center = 0.5
    for (let index = 0; index < Math.floor(targets.length / 2); index += 1) {
      expect(targets[index]!.x - center).toBeCloseTo(-(targets[targets.length - 1 - index]!.x - center), 6)
    }
  })

  it('aggregates dense smooth-fan exposure into bounded angular slots', () => {
    const smooth = plan(macro({
      family: 'smoothFanSweep',
      topologyId: 'smooth-12',
      topologyCacheKey: 'cache:smooth-12',
      repeatMode: 'pingPong',
      interpolation: 'bezier',
      blankBetweenSlots: false,
    }))
    const result = solve(smooth, 'ultra')
    const visible = result.exposureSamples.filter(sample => !sample.blanked)
    expect(visible.length).toBeLessThanOrEqual(12)
    expect(new Set(visible.map(sample => sample.intendedRaySlotId)).size).toBe(visible.length)
    expect(result.diagnostics.aggregatedRayCount).toBe(visible.length)
    expect(result.diagnostics.energyAfterAggregation).toBeLessThanOrEqual(result.diagnostics.energyBeforeAggregation + 1e-9)
  })

  it('keeps aggregated slot layout and energy independent of quality sample count', () => {
    const scannerPlan = plan()
    const low = solve(scannerPlan, 'low')
    const ultra = solve(scannerPlan, 'ultra')
    const visibleSlots = (result: typeof low) => result.exposureSamples
      .filter(sample => !sample.blanked)
      .map(sample => sample.intendedRaySlotId)
      .sort()
    expect(visibleSlots(low)).toEqual(visibleSlots(ultra))
    expect(low.diagnostics.energyAfterAggregation).toBeCloseTo(ultra.diagnostics.energyAfterAggregation, 6)
  })

  it('preserves stable circle, polygon, wave, and tunnel topology across frames', () => {
    for (const family of ['sequentialCircle', 'polygonOutline', 'progressiveWave', 'tunnel'] as const) {
      const definition = macro({
        family,
        topologyId: `stable-${family}`,
        topologyCacheKey: `cache:${family}`,
        pathPointCount: family === 'sequentialCircle' ? 24 : 12,
        raySlots: Array.from({ length: family === 'sequentialCircle' ? 24 : 12 }, (_, index) => {
          const count = family === 'sequentialCircle' ? 24 : 12
          return index / Math.max(1, count - 1)
        }),
      })
      const first = plan(definition)
      const later = plan({ ...definition, phase: 0.7, rotationDeg: 12 })
      expect(later.paths[0]!.points.map(point => point.id)).toEqual(first.paths[0]!.points.map(point => point.id))
      expect(later.paths[0]!.points).toHaveLength(first.paths[0]!.points.length)
    }
  })

  it('conserves diffraction energy across explicit optical copies', () => {
    const scannerPlan = plan(macro({
      family: 'burstDiffraction',
      opticalMode: 'burstDiffraction',
      opticalCopyCount: 5,
      opticalCopySpreadDeg: 18,
      raySlots: [0.5],
      pathPointCount: 1,
    }))
    expect(scannerPlan.opticalCopies).toHaveLength(4)
    const totalScale = (scannerPlan.heads[0]!.directIntensityScale ?? 1)
      + scannerPlan.opticalCopies.reduce((sum, copy) => sum + copy.intensityScale, 0)
    expect(totalScale).toBeCloseTo(1, 6)
  })

  it('keeps explicit physical apertures anchored and conserves combined optical energy', () => {
    const sourceFixture = fixture()
    sourceFixture.optics.apertureCount = 3
    sourceFixture.optics.apertureSpacing = 0.024
    const scannerPlan = createLaserDmxMacroScannerPlan({
      fixture: sourceFixture,
      macro: macro({
        family: 'lineDiffraction',
        opticalMode: 'lineDiffraction',
        opticalCopyCount: 3,
        opticalCopySpreadDeg: 12,
        apertureCount: 3,
      }),
      origin: ORIGIN,
      primitiveType: 'fan',
      color: COLOR,
    })
    const outputs = [
      {
        originOffset: scannerPlan.heads[0]!.directOriginOffset ?? { x: 0, y: 0, z: 0 },
        intensityScale: scannerPlan.heads[0]!.directIntensityScale ?? 1,
      },
      ...scannerPlan.opticalCopies.map(copy => ({
        originOffset: copy.originOffset ?? { x: 0, y: 0, z: 0 },
        intensityScale: copy.intensityScale,
      })),
    ]
    expect(outputs).toHaveLength(9)
    expect(new Set(outputs.map(output => output.originOffset.x.toFixed(5))).size).toBe(3)
    expect(outputs.reduce((sum, output) => sum + output.intensityScale, 0)).toBeCloseTo(1, 6)
  })

  it('closes the shutter and clears incompatible history during a swap', () => {
    const scannerPlan = plan(macro({
      transitionType: 'shutterOutIn',
      transitionProgress: 0.5,
      shutterClosed: true,
      clearTemporalHistory: true,
      preservePhase: false,
    }))
    expect(scannerPlan.paths[0]!.points.every(point => point.blanked && point.intensity === 0)).toBe(true)
    expect(scannerPlan.paths[0]!.clearTemporalHistory).toBe(true)
  })

  it('emits no scanner path, legacy ray, or scene-frame history contribution when the finite cue gate is closed', () => {
    const gatedFixture = fixture()
    gatedFixture.runtimeOutputGate = {
      open: false,
      reason: 'blackout',
      cueId: 'cue-blackout',
      lifecycleState: 'blackout',
      clearTemporalHistory: true,
    }
    gatedFixture.runtimeScanner = {
      authoritativeSource: 'macro',
      macroPlan: macro({ outputGateOpen: false, lifecycleState: 'blackout', shutterClosed: true, clearTemporalHistory: true }),
    }
    const scannerPlan = createLaserDmxMacroScannerPlan({
      fixture: gatedFixture,
      macro: gatedFixture.runtimeScanner.macroPlan!,
      origin: ORIGIN,
      primitiveType: 'fan',
      color: COLOR,
    })
    expect(scannerPlan.paths).toEqual([])
    expect(scannerPlan.heads).toEqual([])
    expect(scannerPlan.opticalCopies).toEqual([])

    const showDirector = createDefaultLaserDmxShowDirectorState()
    showDirector.fixtures = [gatedFixture]
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 8,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'finite-blackout-gate-test',
      bpm: 150,
      devicePixelRatio: 2,
    })
    expect(frame.scanPaths).toEqual([])
    expect(frame.beams).toEqual([])
    expect(frame.fixtures[0]?.enabled).toBe(false)
  })

  it('routes macro-controlled fixtures through one scanner path and one aggregated WebGL path', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const laser = fixture()
    laser.runtimeScanner = {
      authoritativeSource: 'macro',
      macroPlan: macro(),
      patternType: 'fanSweep',
      scanRatePps: 24_000,
    }
    showDirector.fixtures = [laser]
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 8,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'macro-pipeline-test',
      bpm: 150,
      devicePixelRatio: 2,
    })
    const webgl = buildLaserDmxScannerExposurePlan(frame)
    expect(frame.scanPaths).toHaveLength(1)
    expect(frame.scanPaths[0]!.macroControlled).toBe(true)
    expect(frame.scannerDiagnostics.duplicateRenderingFixtureIds).toEqual([])
    expect(frame.exposureAggregation.rawSampleCount).toBeGreaterThanOrEqual(frame.exposureAggregation.aggregatedRayCount)
    expect(webgl.validation.duplicateFixtureIds).toEqual([])
    expect(webgl.validation.filledWedgeRiskCount).toBe(0)
    expect(webgl.validation.suppressedLegacyBeamIds.length).toBeGreaterThan(0)

    laser.runtimeScanner.macroPlan = macro({
      transitionType: 'bankHandoff',
      clearTemporalHistory: true,
      preservePhase: false,
    })
    const transitionFrame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 8.25,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'macro-transition-test',
      bpm: 150,
      devicePixelRatio: 2,
    })
    expect(transitionFrame.transport.timingDiscontinuity).toBe(true)
    expect(transitionFrame.transientEvents.some(event => event.kind === 'timingDiscontinuity')).toBe(true)
  })
})
