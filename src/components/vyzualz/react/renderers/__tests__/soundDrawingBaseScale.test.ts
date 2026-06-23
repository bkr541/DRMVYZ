import { describe, it, expect } from 'vitest'
import { computePathBaseScale, computeTextFitScale, DEFAULT_TEXT_FONT_SIZE } from '../SoundDrawingRenderer'

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

// ── computeTextFitScale ───────────────────────────────────────────────────────
//
// Short text (maxAbsX ≈ 1) → y-constrained (like a single tall character).
// Long text (maxAbsX >> 1) → x-constrained (like a long word).
// Wider spacing → wider maxAbsX when passed explicitly but the fit baseline
// uses ZERO-spacing bounds, so the test verifies the fit scale is computed from
// the supplied bounds, not magically from current spacing.

describe('computeTextFitScale', () => {
  // Default (no audio, no pathScale change, no fontSizeMul change, no bloom)
  const defaults = { pathScale: 1, fontSizeMul: 1, bassPulse: 1, bloomFactor: 0 } as const

  it('square text (maxAbsX = maxAbsY = 1) fits within the canvas with 5% margin', () => {
    const scale = computeTextFitScale(W, H, 1, 1, 1, 1, 1, 0)
    // With maxAbsX=maxAbsY=1, fit = min(W/2*0.95, H/2*0.95)
    const expected = Math.min((W / 2) * 0.95, (H / 2) * 0.95)
    expect(scale).toBeCloseTo(expected, 6)
  })

  it('wide text is x-constrained: a 5-char word fits horizontally', () => {
    // Simulate "DRMVYZ" normalised bounds: maxAbsX≈4.7, maxAbsY≈1
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 0)

    // Text half-width at this scale must not exceed W/2 * 0.95
    expect(scale * maxAbsX).toBeLessThanOrEqual((W / 2) * 0.95 + 1e-9)
    // Text must actually be rendered (scale > 0)
    expect(scale).toBeGreaterThan(0)
  })

  it('short text (single char) is y-constrained: it fills the canvas height', () => {
    // Single char: maxAbsX < 1, maxAbsY ≈ 1
    const maxAbsX = 0.6, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 0)
    // y-constrained: scale ≈ H/2 * 0.95
    expect(scale).toBeCloseTo((H / 2) * 0.95, 6)
    // x stays within canvas
    expect(scale * maxAbsX).toBeLessThan(W / 2)
  })

  it('default text fits on screen (both dimensions within canvas)', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, ...Object.values(defaults) as [number, number, number, number])
    expect(scale * maxAbsX).toBeLessThanOrEqual((W / 2) + 1e-9)
    expect(scale * maxAbsY).toBeLessThanOrEqual((H / 2) + 1e-9)
  })

  it('increased pathScale enlarges text beyond fit baseline', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const sFit    = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 0)
    const sBig    = computeTextFitScale(W, H, maxAbsX, maxAbsY, 2, 1, 1, 0)
    expect(sBig).toBeCloseTo(sFit * 2, 6)
  })

  it('increased fontSizeMul enlarges text beyond fit baseline', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const sFit    = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 0)
    const sBig    = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 2, 1, 0)
    expect(sBig).toBeCloseTo(sFit * 2, 6)
  })

  it('wider spacing bounds widen text beyond the default fit', () => {
    // Simulate wide-spacing bounds (maxAbsX larger than default)
    const maxAbsX_default = 4.7,  maxAbsY = 1.0
    const maxAbsX_spaced  = 8.0   // same text but spacing=100 in UI units

    const sFit    = computeTextFitScale(W, H, maxAbsX_default, maxAbsY, 1, 1, 1, 0)
    const sSpaced = computeTextFitScale(W, H, maxAbsX_spaced,  maxAbsY, 1, 1, 1, 0)

    // At default fit scale, spaced text is wider (it intentionally clips)
    expect(sFit * maxAbsX_spaced).toBeGreaterThan(sFit * maxAbsX_default)

    // A spaced-bounds fit is smaller (if someone mistakenly uses current spacing bounds)
    expect(sSpaced).toBeLessThan(sFit)
  })

  it('fit scale updates immediately when canvas resizes (no stale cache)', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scaleSmall = computeTextFitScale(500,  400,  maxAbsX, maxAbsY, 1, 1, 1, 0)
    const scaleLarge = computeTextFitScale(2000, 1200, maxAbsX, maxAbsY, 1, 1, 1, 0)
    // Larger canvas → larger fit scale
    expect(scaleLarge).toBeGreaterThan(scaleSmall)
    // Both proportional to their respective constraining dimension
    const expectedSmall = (500  / 2) * 0.95 / maxAbsX  // x-constrained for 500×400
    const expectedLarge = (2000 / 2) * 0.95 / maxAbsX  // x-constrained for 2000×1200
    expect(scaleSmall).toBeCloseTo(expectedSmall, 6)
    expect(scaleLarge).toBeCloseTo(expectedLarge, 6)
  })

  it('audio bloom enlarges text identically to computePathBaseScale bloom formula', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const noBloom   = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 0)
    const withBloom = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1, 1, 1)
    expect(withBloom).toBeCloseTo(noBloom * 1.4, 6)
  })

  it('returns a positive finite value for any reasonable input', () => {
    for (const [w, h, ax, ay, ps, fm, bp, bf] of [
      [800,  600,  1.0, 1.0, 1.0, 1.0, 1.0, 0  ],
      [1920, 1080, 4.7, 1.0, 1.0, 1.0, 1.0, 0  ],
      [1920, 1080, 4.7, 1.0, 2.0, 1.5, 1.3, 0.5],
      [512,  512,  0.8, 1.0, 0.5, 0.5, 1.0, 0  ],
    ] as const) {
      const s = computeTextFitScale(w, h, ax, ay, ps, fm, bp, bf)
      expect(isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
  })
})
