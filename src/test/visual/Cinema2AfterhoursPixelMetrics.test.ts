import { describe, expect, it } from 'vitest'
import {
  compareCinema2RgbaPixels,
  isCinema2FrameMeaningfullyVisible,
  measureCinema2RgbaPixels,
} from './Cinema2AfterhoursPixelMetrics'

function solid(width: number, height: number, rgba: readonly [number, number, number, number]): Uint8Array {
  const result = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < result.length; offset += 4) result.set(rgba, offset)
  return result
}

describe('Cinema 2.0 After Hours 2.0 pixel metrics', () => {
  it('rejects a completely black frame', () => {
    const metrics = measureCinema2RgbaPixels(solid(64, 36, [0, 0, 0, 255]))
    expect(metrics.activePixelCount).toBe(0)
    expect(metrics.maxLuminance).toBe(0)
    expect(isCinema2FrameMeaningfullyVisible(metrics)).toBe(false)
  })

  it('rejects very dim non-zero framebuffer noise', () => {
    const metrics = measureCinema2RgbaPixels(solid(64, 36, [1, 1, 1, 255]))
    expect(metrics.maxLuminance).toBeGreaterThan(0)
    expect(metrics.maxLuminance).toBeLessThan(0.01)
    expect(isCinema2FrameMeaningfullyVisible(metrics)).toBe(false)
  })

  it('accepts a sparse representative laser frame', () => {
    const pixels = solid(100, 100, [0, 0, 0, 255])
    for (let y = 45; y < 55; y += 1) {
      for (let x = 15; x < 85; x += 1) {
        const offset = (y * 100 + x) * 4
        pixels[offset] = 110
        pixels[offset + 1] = 245
        pixels[offset + 2] = 255
      }
    }
    const metrics = measureCinema2RgbaPixels(pixels)
    expect(metrics.activePixelRatio).toBeGreaterThan(0.05)
    expect(metrics.maxLuminance).toBeGreaterThan(0.8)
    expect(isCinema2FrameMeaningfullyVisible(metrics)).toBe(true)
  })

  it('reports a measurable pixel difference rather than only state changes', () => {
    const before = solid(32, 32, [0, 0, 0, 255])
    const after = before.slice()
    for (let y = 8; y < 24; y += 1) {
      for (let x = 8; x < 24; x += 1) {
        const offset = (y * 32 + x) * 4
        after[offset] = 255
        after[offset + 1] = 64
        after[offset + 2] = 32
      }
    }
    const difference = compareCinema2RgbaPixels(before, after)
    expect(difference.changedPixelRatio).toBeGreaterThan(0.2)
    expect(difference.meanAbsoluteLuminanceDelta).toBeGreaterThan(0.05)
    expect(difference.maxLuminanceDelta).toBeGreaterThan(0.2)
  })
})
