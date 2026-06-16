import { describe, it, expect } from 'vitest'
import { resolveRgbWaveformColor } from '../rgbWaveformColor'

describe('resolveRgbWaveformColor — silent input', () => {
  it('returns black for all-zero input', () => {
    const c = resolveRgbWaveformColor({ low: 0, mid: 0, high: 0, rms: 0 })
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
  })
})

describe('resolveRgbWaveformColor — pure band inputs', () => {
  it('pure low energy is red-dominated', () => {
    const c = resolveRgbWaveformColor({ low: 1, mid: 0, high: 0, rms: 1 })
    expect(c.r).toBeGreaterThan(c.g)
    expect(c.r).toBeGreaterThan(c.b)
    expect(c.r).toBeGreaterThan(0)
  })

  it('pure mid energy is green-dominated', () => {
    const c = resolveRgbWaveformColor({ low: 0, mid: 1, high: 0, rms: 1 })
    expect(c.g).toBeGreaterThan(c.r)
    expect(c.g).toBeGreaterThan(c.b)
    expect(c.g).toBeGreaterThan(0)
  })

  it('pure high energy is blue-dominated', () => {
    const c = resolveRgbWaveformColor({ low: 0, mid: 0, high: 1, rms: 1 })
    expect(c.b).toBeGreaterThan(c.r)
    expect(c.b).toBeGreaterThan(0)
  })

  it('equal energy across all bands produces near-equal RGB channels', () => {
    const c = resolveRgbWaveformColor({ low: 1, mid: 1, high: 1, rms: 1 })
    // Cross-channel bleed means they're not exactly equal, but within ±30
    expect(Math.abs(c.r - c.g)).toBeLessThan(30)
    expect(Math.abs(c.g - c.b)).toBeLessThan(30)
  })
})

describe('resolveRgbWaveformColor — RMS brightness', () => {
  it('higher RMS gives brighter output', () => {
    const dim    = resolveRgbWaveformColor({ low: 0, mid: 1, high: 0, rms: 0.1 })
    const bright = resolveRgbWaveformColor({ low: 0, mid: 1, high: 0, rms: 1.0 })
    expect(bright.g).toBeGreaterThan(dim.g)
  })

  it('zero RMS still produces visible output for non-silent spectral signal', () => {
    const c = resolveRgbWaveformColor({ low: 0, mid: 1, high: 0, rms: 0 })
    // Not all black — spectral signal is present even if RMS is near zero
    expect(c.g + c.r + c.b).toBeGreaterThan(0)
  })
})

describe('resolveRgbWaveformColor — output range', () => {
  it('all output channels are in [0, 255]', () => {
    const inputs = [
      { low: 0,   mid: 0,   high: 0,   rms: 0   },
      { low: 1,   mid: 0,   high: 0,   rms: 1   },
      { low: 0,   mid: 1,   high: 0,   rms: 1   },
      { low: 0,   mid: 0,   high: 1,   rms: 1   },
      { low: 1,   mid: 1,   high: 1,   rms: 1   },
      { low: 0.5, mid: 0.5, high: 0.5, rms: 0.5 },
    ]
    for (const input of inputs) {
      const c = resolveRgbWaveformColor(input)
      expect(c.r).toBeGreaterThanOrEqual(0)
      expect(c.r).toBeLessThanOrEqual(255)
      expect(c.g).toBeGreaterThanOrEqual(0)
      expect(c.g).toBeLessThanOrEqual(255)
      expect(c.b).toBeGreaterThanOrEqual(0)
      expect(c.b).toBeLessThanOrEqual(255)
    }
  })

  it('clamps inputs greater than 1 without throwing', () => {
    const c = resolveRgbWaveformColor({ low: 2, mid: 3, high: 5, rms: 10 })
    expect(c.r).toBeLessThanOrEqual(255)
    expect(c.g).toBeLessThanOrEqual(255)
    expect(c.b).toBeLessThanOrEqual(255)
  })

  it('clamps negative inputs to zero without throwing', () => {
    const c = resolveRgbWaveformColor({ low: -1, mid: -0.5, high: 0, rms: 1 })
    expect(c.r).toBeGreaterThanOrEqual(0)
    expect(c.g).toBeGreaterThanOrEqual(0)
    expect(c.b).toBeGreaterThanOrEqual(0)
  })
})

describe('resolveRgbWaveformColor — integer output', () => {
  it('returns integer RGB values (Math.round applied)', () => {
    const c = resolveRgbWaveformColor({ low: 0.3, mid: 0.6, high: 0.2, rms: 0.8 })
    expect(Number.isInteger(c.r)).toBe(true)
    expect(Number.isInteger(c.g)).toBe(true)
    expect(Number.isInteger(c.b)).toBe(true)
  })
})
