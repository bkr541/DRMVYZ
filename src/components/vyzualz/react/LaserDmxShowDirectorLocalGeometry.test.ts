import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from './ReactTypes'
import {
  createCentralVerticalCorridor,
  createRectangularExclusionRegion,
  localParallelFan,
  localRadialFan,
  rayViolatesNegativeSpace,
  targetAnglesFromOrigin,
  unwrapOrderedAngles,
} from './LaserDmxShowDirectorLocalGeometry'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

const BOUNDS = { minX: 0, maxX: 18, minY: 0, maxY: 11 }

function angularSpread(origin: { x: number; y: number }, targets: readonly { x: number; y: number }[]): number {
  const ordered = unwrapOrderedAngles(targetAnglesFromOrigin(origin, targets))
  return ordered.length < 2 ? 0 : ordered[ordered.length - 1] - ordered[0]
}

describe('Show Director local geometry helpers', () => {
  it('creates ordered monotonic local fan angles with a useful angular spread', () => {
    const origin = { x: 2, y: 5.5 }
    const targets = localRadialFan({
      idPrefix: 'left-fan',
      semanticRole: 'left-local-fan',
      origin,
      localTargetCenter: { x: 10, y: 5.5 },
      bounds: BOUNDS,
      rayCount: 7,
      fanSpreadDegrees: 54,
    })
    const ordered = unwrapOrderedAngles(targetAnglesFromOrigin(origin, targets))

    expect(targets).toHaveLength(7)
    expect(ordered.every((angle, index) => index === 0 || angle >= ordered[index - 1])).toBe(true)
    expect(ordered[ordered.length - 1] - ordered[0]).toBeGreaterThanOrEqual(45)
  })

  it('compiles every ray in a local fan from one readable fixture origin', () => {
    const origin = { x: 3, y: 5 }
    const targets = localParallelFan({
      idPrefix: 'compiled-local-fan',
      semanticRole: 'compiled-local-fan',
      origin,
      localTargetCenter: { x: 12, y: 5 },
      bounds: BOUNDS,
      rayCount: 6,
      fanSpreadDegrees: 42,
    })
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'local-fan-fixture', 0)
    const showDirector = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      fixtures: [{
        ...fixture,
        x: origin.x,
        y: origin.y,
        enabled: true,
        beam: {
          ...fixture.beam,
          targetMode: 'fixed',
          targets,
        },
      }],
    })
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })

    expect(compiled.beams).toHaveLength(targets.length)
    expect(new Set(compiled.beams.map(beam => JSON.stringify(beam.origin))).size).toBe(1)
    expect(new Set(compiled.beams.map(beam => JSON.stringify(beam.target))).size).toBe(targets.length)
  })

  it('keeps redirected rays inside canvas bounds and outside an edge exclusion region', () => {
    const origin = { x: 2, y: 5.5 }
    const edgeZone = createRectangularExclusionRegion('right-edge', 15.5, 18, 0, 11)
    const targets = localRadialFan({
      idPrefix: 'edge-safe-fan',
      semanticRole: 'edge-safe-fan',
      origin,
      localTargetCenter: { x: 18, y: 5.5 },
      bounds: BOUNDS,
      rayCount: 7,
      fanSpreadDegrees: 58,
      exclusionZones: [edgeZone],
      negativeSpacePolicy: 'redirect',
    })

    expect(targets.length).toBeGreaterThanOrEqual(3)
    for (const target of targets) {
      expect(target.x).toBeGreaterThanOrEqual(BOUNDS.minX)
      expect(target.x).toBeLessThanOrEqual(BOUNDS.maxX)
      expect(target.y).toBeGreaterThanOrEqual(BOUNDS.minY)
      expect(target.y).toBeLessThanOrEqual(BOUNDS.maxY)
      expect(rayViolatesNegativeSpace(origin, target, [edgeZone])).toBe(false)
    }
  })

  it('produces balanced mirrored left and right target geometry', () => {
    const corridor = createCentralVerticalCorridor('center-corridor', BOUNDS, 2.4, 0.35)
    const leftOrigin = { x: 2, y: 5.5 }
    const leftTargets = localRadialFan({
      idPrefix: 'mirror-left',
      semanticRole: 'mirror-left',
      origin: leftOrigin,
      localTargetCenter: { x: 7.2, y: 5.5 },
      bounds: BOUNDS,
      rayCount: 5,
      fanSpreadDegrees: 46,
      exclusionZones: [corridor],
      negativeSpacePolicy: 'redirect',
    })
    const mirroredTargets = localRadialFan({
      idPrefix: 'mirror-right',
      semanticRole: 'mirror-right',
      origin: leftOrigin,
      localTargetCenter: { x: 7.2, y: 5.5 },
      bounds: BOUNDS,
      rayCount: 5,
      fanSpreadDegrees: 46,
      mirror: true,
      allowZoneCrossing: true,
    })

    expect(leftTargets).toHaveLength(mirroredTargets.length)
    for (let index = 0; index < leftTargets.length; index++) {
      const left = leftTargets[index]
      const mirrored = mirroredTargets[index]
      expect(mirrored.x).toBeCloseTo(BOUNDS.maxX - left.x, 5)
      expect(mirrored.y).toBeCloseTo(left.y, 5)
    }
    expect(angularSpread(leftOrigin, leftTargets)).toBeGreaterThan(20)
  })
})
