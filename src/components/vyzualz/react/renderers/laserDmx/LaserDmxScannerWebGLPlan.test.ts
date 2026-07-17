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
import { createLaserDmxSceneFrame, type LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  aggregateLaserDmxScannerExposureSegments,
  buildLaserDmxScannerExposurePlan,
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
  }
}

function radialDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }): number {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y)
}

describe('LaserDMX scanner-sample WebGL planning', () => {
  it('traces a circle sequentially without projector-to-perimeter spokes', () => {
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
      positions.map((position, index) => sample(frame, position, 7.98 + index * 0.001, index)),
    ))

    expect(planned.segments).toHaveLength(11)
    expect(planned.segments.every(segment => radialDistance(segment.origin, frame.fixtures[0]!.position) > 0.1)).toBe(true)
    expect(planned.segments.every(segment => radialDistance(segment.origin, segment.target) < 0.2)).toBe(true)
  })

  it('renders triangle and polygon samples as ordered perimeter edges', () => {
    const frame = createBaseFrame()
    const vertices = [
      { x: 0.5, y: 0.2 },
      { x: 0.82, y: 0.78 },
      { x: 0.18, y: 0.78 },
      { x: 0.5, y: 0.2 },
    ]
    const path = customPath(frame, vertices.slice(0, -1).map((position, index) => point(`triangle-${index}`, position.x, position.y)), {
      closed: true,
      conversionKind: 'polygon',
    })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(
      frame,
      path,
      vertices.map((position, index) => sample(frame, position, 8 + index * 0.001, index % 3)),
    ))

    expect(planned.segments.map(segment => [
      { x: segment.origin.x, y: segment.origin.y },
      { x: segment.target.x, y: segment.target.y },
    ])).toEqual([
      [vertices[0], vertices[1]],
      [vertices[1], vertices[2]],
      [vertices[2], vertices[3]],
    ])
    expect(planned.validation.suppressedLegacyBeamIds.length).toBe(frame.beams.filter(beam => beam.fixtureKind === 'laser').length)
    expect(planned.validation.duplicateFixtureIds).toEqual([])
  })

  it('keeps progressive waves and fan sweeps ordered in sample time', () => {
    const frame = createBaseFrame()
    const positions = Array.from({ length: 9 }, (_, index) => ({
      x: 0.15 + index * 0.085,
      y: 0.55 + Math.sin(index / 8 * Math.PI * 2) * 0.16,
    }))
    const path = customPath(frame, positions.map((position, index) => point(`wave-${index}`, position.x, position.y)), {
      repeatMode: 'pingPong',
      conversionKind: 'wave',
    })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(
      frame,
      path,
      positions.map((position, index) => sample(frame, position, 4 + index * 0.002, index)),
    ))

    expect(planned.segments).toHaveLength(8)
    expect(planned.segments.every((segment, index) => segment.origin.x === positions[index]!.x)).toBe(true)
    expect(planned.segments.every((segment, index) => segment.target.x === positions[index + 1]!.x)).toBe(true)
  })

  it('breaks disconnected shapes at zero-energy blank markers', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [
      point('a', 0.15, 0.3),
      point('b', 0.3, 0.3),
      point('blank', 0.75, 0.75, 0, true),
      point('c', 0.7, 0.7),
      point('d', 0.85, 0.7),
    ])
    const samples = [
      sample(frame, { x: 0.15, y: 0.3 }, 1, 0),
      sample(frame, { x: 0.3, y: 0.3 }, 1.001, 1),
      sample(frame, { x: 0.75, y: 0.75 }, 1.002, 2, { blanked: true, intensity: 0, exposureWeight: 0 }),
      sample(frame, { x: 0.7, y: 0.7 }, 1.003, 3),
      sample(frame, { x: 0.85, y: 0.7 }, 1.004, 4),
    ]
    const planned = buildLaserDmxScannerExposurePlan(withScanner(frame, path, samples))

    expect(planned.segments).toHaveLength(2)
    expect(planned.validation.blankedBreakCount).toBeGreaterThan(0)
    expect(planned.segments.some(segment => radialDistance(segment.origin, segment.target) > 0.3)).toBe(false)
  })

  it('converts repeated point dwell into a bounded analytic point capsule', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [point('held', 0.5, 0.65)], { conversionKind: 'held' })
    const planned = buildLaserDmxScannerExposurePlan(withScanner(frame, path, [
      sample(frame, { x: 0.5, y: 0.65 }, 2, 0, { exposureWeight: 0.5, velocityRatio: 0 }),
      sample(frame, { x: 0.5, y: 0.65 }, 2.001, 0, { exposureWeight: 0.5, velocityRatio: 0 }),
    ]))

    expect(planned.segments).toHaveLength(1)
    expect(planned.segments[0]?.pointDwell).toBe(true)
    expect(radialDistance(planned.segments[0]!.origin, planned.segments[0]!.target)).toBeGreaterThan(0)
    expect(radialDistance(planned.segments[0]!.origin, planned.segments[0]!.target)).toBeLessThan(0.002)
  })

  it('keeps multiple scanner heads and optical copies explicitly separate', () => {
    const frame = createBaseFrame()
    const headA = frame.scannerHeads[0]!
    const headB: LaserDmxScannerHead = { ...headA, id: 'scanner-head-b', scanPhase: 0.5 }
    const pathA = customPath(frame, [point('a', 0.2, 0.7), point('b', 0.4, 0.8)])
    const pathB = customPath(frame, [point('c', 0.6, 0.8), point('d', 0.8, 0.7)], {
      id: 'path-b',
      scannerHeadId: headB.id,
    })
    const samples = [
      sample(frame, { x: 0.2, y: 0.7 }, 1, 0),
      sample(frame, { x: 0.4, y: 0.8 }, 1.001, 1),
      sample(frame, { x: 0.22, y: 0.68 }, 1, 0, { opticalCopyIndex: 1 }),
      sample(frame, { x: 0.42, y: 0.78 }, 1.001, 1, { opticalCopyIndex: 1 }),
      sample(frame, { x: 0.6, y: 0.8 }, 1, 0, { scannerHeadId: headB.id, pathId: 'path-b' }),
      sample(frame, { x: 0.8, y: 0.7 }, 1.001, 1, { scannerHeadId: headB.id, pathId: 'path-b' }),
    ]
    const planned = buildLaserDmxScannerExposurePlan({
      ...frame,
      scannerHeads: [headA, headB],
      scanPaths: [pathA, pathB],
      exposureSamples: samples,
    })

    expect(new Set(planned.segments.map(segment => segment.scannerHeadId))).toEqual(new Set([headA.id, headB.id]))
    expect(new Set(planned.segments.map(segment => segment.opticalCopyIndex))).toEqual(new Set([0, 1]))
  })

  it('aggregates atmosphere samples without joining blanked runs or optical copies', () => {
    const frame = createBaseFrame()
    const path = customPath(frame, [
      point('a', 0.12, 0.3),
      point('b', 0.24, 0.3),
      point('blank', 0.72, 0.72, 0, true),
      point('c', 0.72, 0.72),
      point('d', 0.84, 0.72),
    ])
    const plan = buildLaserDmxScannerExposurePlan(withScanner(frame, path, [
      sample(frame, { x: 0.12, y: 0.3 }, 1, 0),
      sample(frame, { x: 0.24, y: 0.3 }, 1.001, 1),
      sample(frame, { x: 0.72, y: 0.72 }, 1.002, 2, { blanked: true, intensity: 0, exposureWeight: 0 }),
      sample(frame, { x: 0.72, y: 0.72 }, 1.003, 3),
      sample(frame, { x: 0.84, y: 0.72 }, 1.004, 4),
      sample(frame, { x: 0.14, y: 0.28 }, 1, 0, { opticalCopyIndex: 1 }),
      sample(frame, { x: 0.26, y: 0.28 }, 1.001, 1, { opticalCopyIndex: 1 }),
    ]))
    const aggregated = aggregateLaserDmxScannerExposureSegments(plan.segments, 3)

    expect(aggregated).toHaveLength(3)
    expect(new Set(aggregated.map(segment => segment.opticalCopyIndex))).toEqual(new Set([0, 1]))
    expect(aggregated.every(segment => radialDistance(segment.origin, segment.target) < 0.3)).toBe(true)
  })

  it('bounds quality work while preserving deterministic first and last samples', () => {
    const positions = Array.from({ length: 901 }, (_, index) => ({ x: 0.05 + index / 1000, y: 0.5 }))
    const build = (quality: LaserDmxSceneFrame['quality']['qualityTier']) => {
      const frame = createBaseFrame(quality)
      const path = customPath(frame, positions.map((position, index) => point(`p-${index}`, position.x, position.y)))
      return buildLaserDmxScannerExposurePlan(withScanner(
        frame,
        path,
        positions.map((position, index) => sample(frame, position, 1 + index * 0.0001, index, { exposureWeight: 1 / positions.length })),
      ))
    }
    const low = build('low')
    const ultra = build('ultra')

    expect(low.segments.length).toBeLessThan(ultra.segments.length)
    expect(low.segments).toHaveLength(120)
    expect(ultra.segments).toHaveLength(860)
    expect(low.segments[0]?.origin.x).toBeCloseTo(positions[0]!.x, 6)
    expect(low.segments[low.segments.length - 1]?.target.x).toBeCloseTo(positions[positions.length - 1]!.x, 6)
  })

  it('keeps aperture energy stable when the same shutter exposure uses more samples', () => {
    const makePlan = (sampleCount: number) => {
      const frame = createBaseFrame('high')
      const positions = Array.from({ length: sampleCount }, (_, index) => ({
        x: 0.2 + index / Math.max(1, sampleCount - 1) * 0.6,
        y: 0.72,
      }))
      const path = customPath(frame, positions.map((position, index) => point(`p-${index}`, position.x, position.y)), {
        repeatMode: 'pingPong',
        conversionKind: 'fan',
      })
      const samples = positions.map((position, index) => sample(frame, position, 1 + index * 0.0001, index, {
        exposureWeight: 1 / sampleCount,
      }))
      return buildLaserDmxWebGLBeamRenderPlan(withScanner(frame, path, samples), VIEWPORT)
    }
    const sparse = makePlan(6)
    const dense = makePlan(48)

    expect(sparse.laserInputMode).toBe('scanner-samples')
    expect(dense.laserInputMode).toBe('scanner-samples')
    expect(dense.apertures[0]?.totalActiveEnergy).toBeCloseTo(sparse.apertures[0]?.totalActiveEnergy ?? 0, 6)
    expect(dense.apertures[0]?.intensity).toBeCloseTo(sparse.apertures[0]?.intensity ?? 0, 6)
  })

  it('scales aperture energy once for multiple physical heads', () => {
    const frame = createBaseFrame('high')
    const headA = frame.scannerHeads[0]!
    const headB: LaserDmxScannerHead = { ...headA, id: 'second-physical-head', scanPhase: 0.5 }
    const pathA = customPath(frame, [point('a0', 0.2, 0.7), point('a1', 0.4, 0.75)])
    const pathB = customPath(frame, [point('b0', 0.6, 0.75), point('b1', 0.8, 0.7)], {
      id: 'second-path',
      scannerHeadId: headB.id,
    })
    const oneHeadFrame = withScanner(frame, pathA, [
      sample(frame, { x: 0.2, y: 0.7 }, 1, 0, { exposureWeight: 0.5 }),
      sample(frame, { x: 0.4, y: 0.75 }, 1.001, 1, { exposureWeight: 0.5 }),
    ])
    const twoHeadFrame: LaserDmxSceneFrame = {
      ...frame,
      scannerHeads: [headA, headB],
      scanPaths: [pathA, pathB],
      exposureSamples: [
        ...oneHeadFrame.exposureSamples,
        sample(frame, { x: 0.6, y: 0.75 }, 1, 0, { scannerHeadId: headB.id, pathId: pathB.id, exposureWeight: 0.5 }),
        sample(frame, { x: 0.8, y: 0.7 }, 1.001, 1, { scannerHeadId: headB.id, pathId: pathB.id, exposureWeight: 0.5 }),
      ],
      scannerInstantaneousRays: [],
    }
    const oneHead = buildLaserDmxWebGLBeamRenderPlan(oneHeadFrame, VIEWPORT)
    const twoHeads = buildLaserDmxWebGLBeamRenderPlan(twoHeadFrame, VIEWPORT)

    expect(twoHeads.apertures[0]!.totalActiveEnergy).toBeCloseTo(oneHead.apertures[0]!.totalActiveEnergy * 2, 6)
    expect(twoHeads.apertures[0]!.totalActiveEnergy).toBeLessThan(oneHead.apertures[0]!.totalActiveEnergy * 2.01)
  })

  it('leaves legacy beams untouched for Canvas2D compatibility', () => {
    const frame = createBaseFrame()
    const before = structuredClone(frame.beams)
    buildLaserDmxWebGLBeamRenderPlan(frame, VIEWPORT)
    expect(frame.beams).toEqual(before)
  })

  it('projects scanner segments through depth slices without NaN or giant geometry', () => {
    const frame = createBaseFrame('ultra')
    const path = customPath(frame, [
      point('near', 0.25, 0.25, 0.78),
      point('far', 0.75, 0.75, -0.78),
    ])
    const plan = buildLaserDmxWebGLBeamRenderPlan(withScanner(frame, path, [
      sample(frame, { x: 0.25, y: 0.25, z: 0.78 }, 1, 0, { exposureWeight: 0.5 }),
      sample(frame, { x: 0.75, y: 0.75, z: -0.78 }, 1.001, 1, { exposureWeight: 0.5 }),
    ]), VIEWPORT)

    expect(plan.beams.length).toBeGreaterThan(1)
    expect(new Set(plan.beams.map(beam => beam.depthSlice)).size).toBeGreaterThan(1)
    expect(plan.beams.every(beam => [
      beam.origin.x, beam.origin.y, beam.origin.z,
      beam.target.x, beam.target.y, beam.target.z,
    ].every(Number.isFinite))).toBe(true)
    expect(plan.beams.every(beam => Math.abs(beam.origin.x) < 4 && Math.abs(beam.target.x) < 4)).toBe(true)
  })
})
