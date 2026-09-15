import { describe, expect, it } from 'vitest'
import { compareCinema2InterlockRgbaPixels, measureCinema2InterlockRgbaPixels } from './Cinema2InterlockPixelMetrics'

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

  it('reports repeat similarity from deterministic frame deltas', () => {
    const a = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255])
    const b = new Uint8Array(a)
    const c = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255])
    expect(compareCinema2InterlockRgbaPixels(a, b)).toMatchObject({ changedPixelRatio: 0, repeatSimilarity: 1 })
    expect(compareCinema2InterlockRgbaPixels(a, c)).toMatchObject({ changedPixelRatio: 1, repeatSimilarity: 0 })
  })
})
