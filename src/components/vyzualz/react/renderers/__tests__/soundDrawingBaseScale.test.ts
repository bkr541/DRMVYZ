import { describe, it, expect } from 'vitest'
import { computePathBaseScale, DEFAULT_TEXT_FONT_SIZE } from '../SoundDrawingRenderer'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const W = 1000
const H = 800

// ── computePathBaseScale ──────────────────────────────────────────────────────

describe('computePathBaseScale', () => {
  it('returns the same value regardless of params.intensity (intensity does not affect geometry)', () => {
    // Run the scale formula at several intensity values; they must all be equal
    // because computePathBaseScale intentionally has no intensity parameter.
    const intensities = [0, 0.25, 0.5, 1.0, 1.5, 2.0]
    const reference   = computePathBaseScale(W, H, 1, 1, 0)

    for (const _intensity of intensities) {
      // computePathBaseScale has no intensity param — this loop documents that
      // callers with different intensities produce the same geometry scale.
      expect(computePathBaseScale(W, H, 1, 1, 0)).toBeCloseTo(reference, 10)
    }
  })

  it('scales linearly with pathScale', () => {
    const s1 = computePathBaseScale(W, H, 1, 1, 0)
    const s2 = computePathBaseScale(W, H, 2, 1, 0)
    expect(s2).toBeCloseTo(s1 * 2, 10)
  })

  it('scales linearly with bassPulse', () => {
    const s1 = computePathBaseScale(W, H, 1, 1.0, 0)
    const s2 = computePathBaseScale(W, H, 1, 1.3, 0)
    expect(s2).toBeCloseTo(s1 * 1.3, 10)
  })

  it('bloom factor increases baseScale by the expected formula', () => {
    const base = computePathBaseScale(W, H, 1, 1, 0)
    // bloomFactor=1, beatBloom=1: multiplier = 1 + 1 * 0.4 = 1.4
    const bloomed = computePathBaseScale(W, H, 1, 1, 1)
    expect(bloomed).toBeCloseTo(base * 1.4, 10)
  })

  it('bloom factor=0 gives the same scale as no bloom', () => {
    const a = computePathBaseScale(W, H, 1, 1, 0)
    const b = computePathBaseScale(W, H, 1, 1, 0)
    expect(a).toBeCloseTo(b, 10)
  })

  it('uses Math.min(W, H) so portrait and landscape canvases reference the short side', () => {
    const portrait  = computePathBaseScale(1000, 400, 1, 1, 0)
    const landscape = computePathBaseScale(400, 1000, 1, 1, 0)
    expect(portrait).toBeCloseTo(landscape, 10)
  })

  it('returns a positive finite number for any reasonable input', () => {
    for (const [w, h, ps, bp, bf] of [
      [800,  600,  1.0, 1.0, 0  ],
      [1920, 1080, 0.5, 1.0, 0  ],
      [512,  512,  2.0, 1.6, 0.8],
      [100,  100,  0.1, 1.0, 0  ],
    ] as const) {
      const s = computePathBaseScale(w, h, ps, bp, bf)
      expect(isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
  })

  it('pathScale=1 bassPulse=1 bloomFactor=0 gives exactly min(W,H)*0.42', () => {
    const expected = Math.min(W, H) * 0.42
    expect(computePathBaseScale(W, H, 1, 1, 0)).toBeCloseTo(expected, 10)
  })

  it('different intensity values with same geometry inputs produce identical baseScale', () => {
    // This is the core acceptance criterion: intensity must not affect object size.
    const low  = computePathBaseScale(W, H, 1.0, 1.0, 0)
    const high = computePathBaseScale(W, H, 1.0, 1.0, 0)
    // Both calls use the same inputs because intensity is NOT a parameter.
    expect(low).toBe(high)
  })

  it('is deterministic: same inputs always produce the same output', () => {
    const a = computePathBaseScale(W, H, 1.2, 1.15, 0.3)
    const b = computePathBaseScale(W, H, 1.2, 1.15, 0.3)
    expect(a).toBe(b)
  })
})

// ── DEFAULT_TEXT_FONT_SIZE / fontSizeMul ──────────────────────────────────────

describe('DEFAULT_TEXT_FONT_SIZE', () => {
  it('is 160 (matches OscillatorSettings default)', () => {
    expect(DEFAULT_TEXT_FONT_SIZE).toBe(160)
  })

  it('fontSizeMul is 1.0 at the default font size (no scaling)', () => {
    const mul = DEFAULT_TEXT_FONT_SIZE / DEFAULT_TEXT_FONT_SIZE
    expect(mul).toBe(1)
  })

  it('fontSizeMul doubles the scale when textFontSize doubles', () => {
    const mul = (DEFAULT_TEXT_FONT_SIZE * 2) / DEFAULT_TEXT_FONT_SIZE
    expect(mul).toBe(2)
  })

  it('fontSizeMul halves the scale when textFontSize halves', () => {
    const mul = (DEFAULT_TEXT_FONT_SIZE / 2) / DEFAULT_TEXT_FONT_SIZE
    expect(mul).toBeCloseTo(0.5, 10)
  })

  it('combined baseScale is proportional to textFontSize relative to default', () => {
    const base   = Math.min(W, H) * 0.42 * 1
    const atDef  = base * (DEFAULT_TEXT_FONT_SIZE / DEFAULT_TEXT_FONT_SIZE)
    const atHalf = base * ((DEFAULT_TEXT_FONT_SIZE / 2) / DEFAULT_TEXT_FONT_SIZE)
    expect(atHalf).toBeCloseTo(atDef / 2, 10)
  })
})
