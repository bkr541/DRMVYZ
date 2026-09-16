import { describe, expect, it } from 'vitest'
import { resolveCinema2InterlockLayout } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockGeometry'
import { CINEMA2_INTERLOCK_RIG } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockRig'
import { resolveCinema2InterlockCellCount } from '../../components/vyzualz/cinema2/modules/interlock/Cinema2InterlockSegments'
import {
  compareCinema2InterlockRgbaPixels,
  isCinema2InterlockFixtureReadable,
  measureCinema2InterlockFixtureReadability,
  measureCinema2InterlockRgbaPixels,
} from './Cinema2InterlockPixelMetrics'

describe('Cinema2InterlockPixelMetrics', () => {
  it('measures visibility, clipping, local gap contrast, and luminance separation deterministically', () => {
    const width = 4
    const height = 2
    const pixels = new Uint8Array([
      0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 64, 200, 255, 255,
      0, 0, 0, 255, 220, 240, 255, 255, 0, 0, 0, 255, 32, 80, 120, 255,
    ])
    const metrics = measureCinema2InterlockRgbaPixels(pixels, width, height)
    expect(metrics.pixelCount).toBe(8)
    expect(metrics.activePixelRatio).toBeGreaterThan(0)
    expect(metrics.brightCoreRatio).toBeGreaterThan(0)
    expect(metrics.clippedRatio).toBeGreaterThan(0)
    expect(metrics.segmentGapContrastRatio).toBeGreaterThan(0)
    expect(metrics.highlightToMedianSeparation).toBeGreaterThan(0)
  })

  it('requires signal on the authored fixture geometry and rejects a background-only negative control', () => {
    const width = 640
    const height = 360
    const background = new Uint8Array(width * height * 4)
    for (let offset = 0; offset < background.length; offset += 4) {
      background[offset] = 7
      background[offset + 1] = 11
      background[offset + 2] = 18
      background[offset + 3] = 255
    }

    const backgroundMetrics = measureCinema2InterlockFixtureReadability(background, width, height, 'diamondTunnel', 1)
    expect(isCinema2InterlockFixtureReadable(backgroundMetrics)).toBe(false)
    expect(backgroundMetrics.visibleFixtureCount).toBe(0)

    const rig = new Uint8Array(background)
    const layout = resolveCinema2InterlockLayout('diamondTunnel', { width, height, dpr: 1 })
    const authoredFixtureById = new Map(CINEMA2_INTERLOCK_RIG.fixtures.map(fixture => [fixture.id, fixture] as const))
    for (const fixture of layout.fixtures) {
      const dx = fixture.bottom[0] - fixture.top[0]
      const dy = fixture.bottom[1] - fixture.top[1]
      const length = Math.max(1, Math.hypot(dx, dy))
      const steps = Math.ceil(length * 2)
      const radius = Math.max(1, Math.round(fixture.thicknessPx * 0.34))
      const nx = -dy / length
      const ny = dx / length
      const authoredFixture = authoredFixtureById.get(fixture.fixtureId)
      const cellCount = authoredFixture ? resolveCinema2InterlockCellCount(authoredFixture) : 24
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps
        const cellLocal = ((t * cellCount) % 1) - 0.5
        // Mirror the shader's segmented-body idea closely enough for a deterministic
        // CPU-only negative/positive control without pretending this is GPU evidence.
        if (Math.abs(cellLocal) > 0.36) continue
        const cx = fixture.top[0] + dx * t
        const cy = fixture.top[1] + dy * t
        for (let cross = -radius; cross <= radius; cross += 1) {
          const x = Math.round(cx + nx * cross)
          const y = Math.round(cy + ny * cross)
          if (x < 0 || y < 0 || x >= width || y >= height) continue
          const offset = (y * width + x) * 4
          rig[offset] = 150
          rig[offset + 1] = 225
          rig[offset + 2] = 255
          rig[offset + 3] = 255
        }
      }
    }

    const rigMetrics = measureCinema2InterlockFixtureReadability(rig, width, height, 'diamondTunnel', 1)
    expect(rigMetrics.fixtureCount).toBe(28)
    expect(rigMetrics.visibleFixtureCount).toBeGreaterThanOrEqual(26)
    expect(rigMetrics.meanCoreBackgroundSeparation).toBeGreaterThan(0.004)
    expect(rigMetrics.segmentGapSampleCount).toBeGreaterThan(0)
    expect(rigMetrics.readableSegmentGapCount).toBeGreaterThan(0)
    expect(rigMetrics.meanSegmentGapContrast).toBeGreaterThan(0.004)
    expect(rigMetrics.segmentGapContrastRatio).toBeGreaterThan(0)
    expect(isCinema2InterlockFixtureReadable(rigMetrics)).toBe(true)
  })

  it('reports repeat similarity from deterministic frame deltas', () => {
    const a = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255])
    const b = new Uint8Array(a)
    const c = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255])
    expect(compareCinema2InterlockRgbaPixels(a, b)).toMatchObject({ changedPixelRatio: 0, repeatSimilarity: 1 })
    expect(compareCinema2InterlockRgbaPixels(a, c)).toMatchObject({ changedPixelRatio: 1, repeatSimilarity: 0 })
  })
})
