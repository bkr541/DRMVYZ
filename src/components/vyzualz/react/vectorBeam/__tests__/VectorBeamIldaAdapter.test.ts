import { describe, expect, it, vi } from 'vitest'
import { adaptVectorBeamSegmentsToLaserDmxScannerSegments } from '../VectorBeamIldaAdapter'
import { renderLaserDmxCanvas2DScannerPlan } from '../../renderers/laserDmx/LaserDmxCanvas2DScannerRenderer'
import type { LaserDmxSceneFrame } from '../../renderers/laserDmx/LaserDmxSceneFrame'
import type { VectorBeamSegment } from '../VectorBeamTypes'

function soundDrawingFrameSegments(): VectorBeamSegment[] {
  // Representative of what SoundDrawingRenderer.ts builds for one frame: a
  // short open trace with varying density/dwell/velocity/history.
  return [
    {
      origin: { x: 10, y: 20 },
      target: { x: 30, y: 40 },
      color: { r: 0.1, g: 0.7, b: 0.86, a: 0.9 },
      density: 1,
      dwellWeight: 0.1,
      velocityRatio: 0.9,
      historyWeight: 0.9,
    },
    {
      origin: { x: 30, y: 40 },
      target: { x: 50, y: 10 },
      color: { r: 0.1, g: 0.7, b: 0.86, a: 0.9 },
      density: 0.8,
      dwellWeight: 0.7,
      velocityRatio: 0.3,
      historyWeight: 0.9,
    },
  ]
}

describe('adaptVectorBeamSegmentsToLaserDmxScannerSegments', () => {
  it('round-trips every shared field unchanged', () => {
    const source = soundDrawingFrameSegments()
    const adapted = adaptVectorBeamSegmentsToLaserDmxScannerSegments(source)

    expect(adapted).toHaveLength(source.length)
    adapted.forEach((segment, index) => {
      expect(segment.origin).toEqual(source[index].origin)
      expect(segment.target).toEqual(source[index].target)
      expect(segment.color).toEqual(source[index].color)
      expect(segment.density).toBe(source[index].density)
      expect(segment.dwellWeight).toBe(source[index].dwellWeight)
      expect(segment.velocityRatio).toBe(source[index].velocityRatio)
      expect(segment.historyWeight).toBe(source[index].historyWeight)
    })
  })

  it('fills in the laser-specific identity fields the shared type omits', () => {
    const [segment] = adaptVectorBeamSegmentsToLaserDmxScannerSegments(soundDrawingFrameSegments())
    expect(typeof segment.id).toBe('string')
    expect(segment.id.length).toBeGreaterThan(0)
    expect(typeof segment.fixtureId).toBe('string')
    expect(['scanExposure', 'scanStroke', 'intentionalRay', 'heldRay']).toContain(segment.geometry)
    expect(typeof segment.stable).toBe('boolean')
    expect(typeof segment.animated).toBe('boolean')
  })

  it('produces unique, stable-format ids across the whole frame', () => {
    const adapted = adaptVectorBeamSegmentsToLaserDmxScannerSegments(soundDrawingFrameSegments())
    const ids = adapted.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('respects explicit fixtureId/geometry/idPrefix overrides', () => {
    const [segment] = adaptVectorBeamSegmentsToLaserDmxScannerSegments(soundDrawingFrameSegments(), {
      fixtureId: 'custom-fixture',
      geometry: 'intentionalRay',
      idPrefix: 'frame-7',
    })
    expect(segment.fixtureId).toBe('custom-fixture')
    expect(segment.geometry).toBe('intentionalRay')
    expect(segment.id.startsWith('frame-7')).toBe(true)
  })

  it('an empty Sound Drawing frame adapts to an empty laser segment array', () => {
    expect(adaptVectorBeamSegmentsToLaserDmxScannerSegments([])).toEqual([])
  })

  it('the adapted segments are directly consumable by the laser Canvas2D scanner renderer with no further translation', () => {
    const adapted = adaptVectorBeamSegmentsToLaserDmxScannerSegments(soundDrawingFrameSegments())
    const plan = {
      segments: adapted,
      validation: {
        authoritativeFixtureIds: [] as string[],
        scannerSampleCount: adapted.length,
        visibleScannerSampleCount: adapted.length,
        legacyLaserBeamCount: 0,
        suppressedLegacyBeamIds: [] as string[],
        duplicateFixtureIds: [] as string[],
        blankedBreakCount: 0,
        retraceBreakCount: 0,
        invalidSampleCount: 0,
        rawExposureSampleCount: adapted.length,
        aggregatedRayCount: adapted.length,
        energyBeforeAggregation: 1,
        energyAfterAggregation: 1,
        normalizedSegmentEnergy: 1,
        filledWedgeRiskCount: 0,
      },
      averageHistoryWeight: 0.9,
    }
    const frame = {
      output: { blackout: false, globalBeamWidth: 1 },
      atmosphere: { enabled: false, opacity: 0, beamScatter: 0 },
    } as unknown as LaserDmxSceneFrame

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      globalCompositeOperation: 'source-over',
      lineCap: 'butt',
      lineJoin: 'miter',
      lineWidth: 1,
      strokeStyle: '#000000',
    } as unknown as CanvasRenderingContext2D

    expect(() => renderLaserDmxCanvas2DScannerPlan(ctx, frame, plan, 1, 1)).not.toThrow()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})
