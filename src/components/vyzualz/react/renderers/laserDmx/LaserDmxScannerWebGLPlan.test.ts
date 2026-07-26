import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
} from '../../ReactTypes'
import type {
  LaserDmxExposureSample,
  LaserDmxScanPath,
  LaserDmxScanPoint,
  LaserDmxScannerHead,
} from './LaserDmxScannerDomain'
import { buildLaserDmxCanvas2DScannerPlan } from './LaserDmxCanvas2DScannerRenderer'
import { createLaserDmxSceneFrame, type LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  aggregateLaserDmxScannerExposureSegments,
  buildLaserDmxScannerExposurePlan,
  resolveLaserDmxScannerExposureDensity,
} from './LaserDmxScannerWebGLPlan'
import { buildLaserDmxWebGLBeamRenderPlan } from './LaserDmxWebGLBeamPlan'

const VIEWPORT = { backingWidth: 1920, backingHeight: 1080, cssWidth: 960, cssHeight: 540 }
const COLOR = { r: 0.2, g: 0.85, b: 1, a: 1 }

function createBaseFrame(quality: LaserDmxSceneFrame['quality']['qualityTier'] = 'high'): LaserDmxSceneFrame {
  const showDirector = createDefaultLaserDmxShowDirectorState()
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'scanner-fixture', 0)
  fixture.brightness = 1
  fixture.x = 7
  fixture.y = 2
  fixture.beam.targetMode = 'fan'
  fixture.beam.beamSpread = 72
  fixture.optics.sourceIntensity = 1
  fixture.optics.rayCount = 12
  showDirector.fixtures = [fixture]
  showDirector.settings.webglQuality = quality
  return createLaserDmxSceneFrame({
    showDirector,
    evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    audioTimeSec: 8,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: false,
    trackKey: 'scanner-webgl-test',
    bpm: 150,
    devicePixelRatio: 2,
  })
}

function point(id: string, x: number, y: number, z = 0, blanked = false): LaserDmxScanPoint {
  return {
    id,
    position: { x, y, z },
    blanked,
    dwellMicros: blanked ? 0 : 24,
    intensity: blanked ? 0 : 1,
    color: COLOR,
    cornerBehavior: blanked ? 'blank' : 'continuous',
  }
}

function customPath(
  frame: LaserDmxSceneFrame,
  points: LaserDmxScanPoint[],
  patch: Partial<LaserDmxScanPath> = {},
): LaserDmxScanPath {
  const head = frame.scannerHeads[0]!
  return {
    schemaVersion: 1,
    id: patch.id ?? 'custom-path',
    fixtureId: patch.fixtureId ?? frame.fixtures[0]!.id,
    scannerHeadId: patch.scannerHeadId ?? head.id,
    points,
    closed: false,
    interpolation: 'linear',
    repeatMode: 'loop',
    scanDirection: 'forward',
    conversionKind: 'native',
    compatibilityMode: 'native',
    validationErrors: [],
    migrationWarnings: [],
    presentationMode: 'scannedPath',
    patternAnimationActive: false,
    fixtureMovementActive: false,
    ...patch,
  }
}

function sample(
  frame: LaserDmxSceneFrame,
  target: { x: number; y: number; z?: number },
  sampleTime: number,
  pointIndex: number,
  patch: Partial<LaserDmxExposureSample> = {},
): LaserDmxExposureSample {
  const head = frame.scannerHeads[0]!
  return {
    scannerHeadId: head.id,
    fixtureId: frame.fixtures[0]!.id,
    origin: { ...frame.fixtures[0]!.position },
    targetOrDirection: { x: target.x, y: target.y, z: target.z ?? 0 },
    sampleTime,
    exposureWeight: 0.125,
    intensity: 1,
    color: COLOR,
    blanked: false,
    opticalCopyIndex: 0,
    pathId: 'custom-path',
    pointIndex,
    velocityRatio: 0.7,
    accelerationRatio: 0.2,
    dwellWeight: 1,
    historyWeight: 0.16,
    scannerFramePhase: pointIndex / 16,
    eventKind: 'travel',
    ...patch,
  }
}

function withScanner(
  frame: LaserDmxSceneFrame,
  path: LaserDmxScanPath,
  exposureSamples: LaserDmxExposureSample[],
  heads: LaserDmxScannerHead[] = frame.scannerHeads,
): LaserDmxSceneFrame {
  return {
    ...frame,
    scannerHeads: heads,
    scanPaths: [path],
    exposureSamples,
    scannerInstantaneousRays: [],
    exposureAggregation: {
      rawSampleCount: exposureSamples.length,
      aggregatedRayCount: exposureSamples.filter(candidate => !candidate.blanked).length,
      visibleSlotCount: exposureSamples.filter(candidate => !candidate.blanked).length,
      blankedSampleCount: exposureSamples.filter(candidate => candidate.blanked).length,
      energyBeforeAggregation: exposureSamples.reduce((sum, candidate) => sum + candidate.exposureWeight * candidate.intensity, 0),
      energyAfterAggregation: exposureSamples.reduce((sum, candidate) => sum + candidate.exposureWeight * candidate.intensity, 0),
    },
  }
}

function distance2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('LaserDMX ordered scanner exposure planning', () => {
  it('integrates a stable circle into connected scan strokes without aperture spokes', () => {
    const frame = createBaseFrame()
    const center = { x: 0.5, y: 0.58 }
    const radius = 0.22
    const positions = Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
    })
    const path = customPath(frame, positions.map((position, index) => point(`circle-${index}`, position.x, position.y)), {
      closed: true,
      interpolation: 'arc',
      conversionKind: 'circle',
    })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(
      frame,
      path,
      positions.map((position, index) => sample(frame, position, 7.98 + index * 0.001, index, {
        exposureWeight: 1 / positions.length,
      })),
    ))

    expect(planned.segments).toHaveLength(12)
    expect(planned.segments.every(segment => segment.geometry === 'scanStroke')).toBe(true)
    expect(planned.segments.every(segment => distance2d(segment.origin, frame.fixtures[0]!.position) > 0.05)).toBe(true)
    expect(planned.segments.every(segment => segment.stable && !segment.animated)).toBe(true)
    expect(planned.validation.filledWedgeRiskCount).toBe(0)
    expect(planned.validation.normalizedSegmentEnergy).toBeCloseTo(1, 6)
  })

  it('never bridges blanked or retrace travel', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [
      point('a', 0.15, 0.3),
      point('b', 0.3, 0.3),
      point('blank', 0.75, 0.75, 0, true),
      point('c', 0.7, 0.7),
      point('d', 0.85, 0.7),
    ])
    const samples = [
      sample(frame, { x: 0.15, y: 0.3 }, 1, 0, { exposureWeight: 0.25 }),
      sample(frame, { x: 0.3, y: 0.3 }, 1.001, 1, { exposureWeight: 0.25 }),
      sample(frame, { x: 0.75, y: 0.75 }, 1.002, 2, {
        blanked: true,
        retrace: true,
        intensity: 0,
        exposureWeight: 0,
      }),
      sample(frame, { x: 0.7, y: 0.7 }, 1.003, 3, { exposureWeight: 0.25 }),
      sample(frame, { x: 0.85, y: 0.7 }, 1.004, 4, { exposureWeight: 0.25 }),
    ]
    const planned = buildLaserDmxScannerExposurePlan(withScanner(frame, path, samples))

    expect(planned.segments).toHaveLength(2)
    expect(planned.validation.blankedBreakCount).toBeGreaterThan(0)
    expect(planned.validation.retraceBreakCount).toBe(1)
    expect(planned.segments.some(segment =>
      distance2d(segment.origin, { x: 0.3, y: 0.3 }) < 1e-6
      && distance2d(segment.target, { x: 0.7, y: 0.7 }) < 1e-6,
    )).toBe(false)
  })

  it('retains only explicitly authored fan slots as aperture rays', () => {
    const frame = createBaseFrame()
    const positions = [
      { x: 0.2, y: 0.75 },
      { x: 0.5, y: 0.82 },
      { x: 0.8, y: 0.75 },
    ]
    const path = customPath(frame, positions.map((position, index) => ({
      ...point(`fan-${index}`, position.x, position.y),
      intendedRaySlotId: `slot-${index}`,
    })), {
      conversionKind: 'fan',
      presentationMode: 'intentionalRays',
      exposureAggregation: 'intendedSlots',
    })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(frame, path, positions.map((position, index) =>
      sample(frame, position, 2 + index * 0.001, index, {
        intendedRaySlotId: `slot-${index}`,
        exposureWeight: 1 / positions.length,
        eventKind: 'dwell',
        velocityRatio: 0,
      }),
    )))

    expect(planned.segments).toHaveLength(3)
    expect(planned.segments.every(segment => segment.geometry === 'intentionalRay')).toBe(true)
    expect(planned.segments.every(segment => distance2d(segment.origin, frame.fixtures[0]!.position) < 1e-6)).toBe(true)
  })

  it('merges held dwell samples into one controlled bright ray', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [point('held', 0.5, 0.65)], {
      conversionKind: 'held',
      presentationMode: 'heldRay',
      exposureAggregation: 'intendedSlots',
    })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(frame, path, [
      sample(frame, { x: 0.5, y: 0.65 }, 2, 0, {
        exposureWeight: 0.5,
        velocityRatio: 0,
        dwellWeight: 1.5,
        eventKind: 'dwell',
      }),
      sample(frame, { x: 0.5, y: 0.65 }, 2.001, 0, {
        exposureWeight: 0.5,
        velocityRatio: 0,
        dwellWeight: 1.5,
        eventKind: 'dwell',
      }),
    ]))

    expect(planned.segments).toHaveLength(1)
    expect(planned.segments[0]).toMatchObject({ geometry: 'heldRay', pointDwell: true })
    expect(planned.segments[0]?.exposureContribution).toBeCloseTo(1, 6)
  })

  it('preserves normalized exposure energy when quality thins path samples', () => {
    const positions = Array.from({ length: 901 }, (_, index) => ({ x: 0.05 + index / 1000, y: 0.5 }))
    const build = (quality: LaserDmxSceneFrame['quality']['qualityTier']) => {
      const frame = createBaseFrame(quality)
      const path = customPath(frame, positions.map((position, index) => point(`p-${index}`, position.x, position.y)))
      return buildLaserDmxScannerExposurePlan(withScanner(
        frame,
        path,
        positions.map((position, index) => sample(frame, position, 1 + index * 0.0001, index, {
          exposureWeight: 1 / positions.length,
        })),
      ))
    }
    const low = build('low')
    const ultra = build('ultra')

    expect(low.segments).toHaveLength(180)
    expect(ultra.segments).toHaveLength(900)
    expect(low.validation.normalizedSegmentEnergy).toBeCloseTo(ultra.validation.normalizedSegmentEnergy, 6)
    expect(low.segments[0]?.geometry).toBe('scanStroke')
    for (let index = 1; index < low.segments.length; index += 1) {
      expect(low.segments[index]?.origin).toEqual(low.segments[index - 1]?.target)
    }
    expect(low.segments[low.segments.length - 1]?.target.x).toBeCloseTo(positions[positions.length - 1]!.x, 6)
  })

  it('keeps exposure density stable as scanner sample count increases', () => {
    const makePlan = (sampleCount: number) => {
      const frame = createBaseFrame('high')
      const positions = Array.from({ length: sampleCount }, (_, index) => ({
        x: 0.2 + index / Math.max(1, sampleCount - 1) * 0.6,
        y: 0.72,
      }))
      const path = customPath(frame, positions.map((position, index) => point(`p-${index}`, position.x, position.y)))
      const resolvedFrame = withScanner(frame, path, positions.map((position, index) => sample(frame, position, 1 + index * 0.0001, index, {
        exposureWeight: 1 / sampleCount,
      })))
      const plan = buildLaserDmxScannerExposurePlan(resolvedFrame)
      const averageDensity = plan.segments.reduce(
        (sum, segment) => sum + resolveLaserDmxScannerExposureDensity(resolvedFrame, segment),
        0,
      ) / plan.segments.length
      return { resolvedFrame, plan, averageDensity }
    }
    const sparse = makePlan(8)
    const dense = makePlan(64)

    expect(dense.averageDensity).toBeCloseTo(sparse.averageDensity, 1)
    const sparseWebGL = buildLaserDmxWebGLBeamRenderPlan(sparse.resolvedFrame, VIEWPORT)
    const denseWebGL = buildLaserDmxWebGLBeamRenderPlan(dense.resolvedFrame, VIEWPORT)
    expect(denseWebGL.apertures[0]?.totalActiveEnergy).toBeCloseTo(sparseWebGL.apertures[0]?.totalActiveEnergy ?? 0, 6)
  })

  it('preserves optical-copy separation and energy during deterministic aggregation', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [point('a', 0.2, 0.7), point('b', 0.8, 0.7)])
    const plan = buildLaserDmxScannerExposurePlan(withScanner(frame, path, [
      sample(frame, { x: 0.2, y: 0.7 }, 1, 0, { exposureWeight: 0.25 }),
      sample(frame, { x: 0.8, y: 0.7 }, 1.001, 1, { exposureWeight: 0.25 }),
      sample(frame, { x: 0.22, y: 0.68 }, 1, 0, { opticalCopyIndex: 1, exposureWeight: 0.25 }),
      sample(frame, { x: 0.82, y: 0.68 }, 1.001, 1, { opticalCopyIndex: 1, exposureWeight: 0.25 }),
    ]))
    const aggregated = aggregateLaserDmxScannerExposureSegments(plan.segments, 1)

    expect(new Set(plan.segments.map(segment => segment.opticalCopyIndex))).toEqual(new Set([0, 1]))
    expect(aggregated).toHaveLength(1)
    expect(aggregated.reduce((sum, segment) => sum + segment.exposureContribution, 0))
      .toBeLessThanOrEqual(plan.validation.normalizedSegmentEnergy)
  })

  it('uses the same authoritative exposure geometry in Canvas2D and WebGL', () => {
    const frame = createBaseFrame()
    const positions = [
      { x: 0.2, y: 0.35 },
      { x: 0.5, y: 0.75 },
      { x: 0.8, y: 0.35 },
    ]
    const path = customPath(frame, positions.map((position, index) => point(`triangle-${index}`, position.x, position.y)), {
      closed: true,
      conversionKind: 'polygon',
    })
    const resolved = withScanner(frame, path, positions.map((position, index) => sample(frame, position, 1 + index * 0.001, index, {
      exposureWeight: 1 / positions.length,
    })))
    const webgl = buildLaserDmxScannerExposurePlan(resolved)
    const canvas = buildLaserDmxCanvas2DScannerPlan(resolved, 1920, 1080)

    expect(canvas.segments.map(segment => segment.id)).toEqual(webgl.segments.map(segment => segment.id))
    expect(canvas.segments.map(segment => segment.geometry)).toEqual(webgl.segments.map(segment => segment.geometry))
    expect(canvas.validation.suppressedLegacyBeamIds).toEqual(webgl.validation.suppressedLegacyBeamIds)
  })

  it('does not derive scanner shader phase from renderer-local time', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [point('a', 0.2, 0.4), point('b', 0.8, 0.7)])
    const samples = [
      sample(frame, { x: 0.2, y: 0.4 }, 1, 0, { exposureWeight: 0.5 }),
      sample(frame, { x: 0.8, y: 0.7 }, 1.001, 1, { exposureWeight: 0.5 }),
    ]
    const first = buildLaserDmxWebGLBeamRenderPlan(withScanner(frame, path, samples), VIEWPORT)
    const laterFrame = withScanner(structuredClone(frame), structuredClone(path), structuredClone(samples))
    laterFrame.transport.audioTimeSec += 16
    const second = buildLaserDmxWebGLBeamRenderPlan(laterFrame, VIEWPORT)

    expect(second.beams.map(beam => beam.phase)).toEqual(first.beams.map(beam => beam.phase))
    expect(second.beams.map(beam => [beam.origin, beam.target])).toEqual(first.beams.map(beam => [beam.origin, beam.target]))
  })
})
