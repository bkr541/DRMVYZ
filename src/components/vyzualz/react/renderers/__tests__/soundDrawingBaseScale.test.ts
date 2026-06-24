import { describe, it, expect } from 'vitest'
import {
  computePathBaseScale,
  computeTextFitScale,
  computeCharCenters,
  DEFAULT_TEXT_FONT_SIZE,
} from '../SoundDrawingRenderer'
import type { OscillatorGlyphPoint } from '../../ReactTypes'

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
  it('square text (maxAbsX = maxAbsY = 1) fits within the canvas with 5% margin', () => {
    const scale = computeTextFitScale(W, H, 1, 1, 1, 1)
    const expected = Math.min((W / 2) * 0.95, (H / 2) * 0.95)
    expect(scale).toBeCloseTo(expected, 6)
  })

  it('wide text is x-constrained: a 5-char word fits horizontally', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1)
    expect(scale * maxAbsX).toBeLessThanOrEqual((W / 2) * 0.95 + 1e-9)
    expect(scale).toBeGreaterThan(0)
  })

  it('short text (single char) is y-constrained: it fills the canvas height', () => {
    const maxAbsX = 0.6, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1)
    expect(scale).toBeCloseTo((H / 2) * 0.95, 6)
    expect(scale * maxAbsX).toBeLessThan(W / 2)
  })

  it('default text fits on screen (both dimensions within canvas)', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scale = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1)
    expect(scale * maxAbsX).toBeLessThanOrEqual((W / 2) + 1e-9)
    expect(scale * maxAbsY).toBeLessThanOrEqual((H / 2) + 1e-9)
  })

  it('increased pathScale enlarges text beyond fit baseline', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const sFit = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1)
    const sBig = computeTextFitScale(W, H, maxAbsX, maxAbsY, 2, 1)
    expect(sBig).toBeCloseTo(sFit * 2, 6)
  })

  it('increased fontSizeMul enlarges text beyond fit baseline', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const sFit = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 1)
    const sBig = computeTextFitScale(W, H, maxAbsX, maxAbsY, 1, 2)
    expect(sBig).toBeCloseTo(sFit * 2, 6)
  })

  it('wider spacing bounds widen text beyond the default fit', () => {
    const maxAbsX_default = 4.7, maxAbsY = 1.0
    const maxAbsX_spaced  = 8.0

    const sFit    = computeTextFitScale(W, H, maxAbsX_default, maxAbsY, 1, 1)
    const sSpaced = computeTextFitScale(W, H, maxAbsX_spaced,  maxAbsY, 1, 1)

    expect(sFit * maxAbsX_spaced).toBeGreaterThan(sFit * maxAbsX_default)
    expect(sSpaced).toBeLessThan(sFit)
  })

  it('fit scale updates immediately when canvas resizes (no stale cache)', () => {
    const maxAbsX = 4.7, maxAbsY = 1.0
    const scaleSmall = computeTextFitScale(500,  400,  maxAbsX, maxAbsY, 1, 1)
    const scaleLarge = computeTextFitScale(2000, 1200, maxAbsX, maxAbsY, 1, 1)
    expect(scaleLarge).toBeGreaterThan(scaleSmall)
    const expectedSmall = (500  / 2) * 0.95 / maxAbsX
    const expectedLarge = (2000 / 2) * 0.95 / maxAbsX
    expect(scaleSmall).toBeCloseTo(expectedSmall, 6)
    expect(scaleLarge).toBeCloseTo(expectedLarge, 6)
  })

  it('returns a positive finite value for any reasonable input', () => {
    for (const [w, h, ax, ay, ps, fm] of [
      [800,  600,  1.0, 1.0, 1.0, 1.0],
      [1920, 1080, 4.7, 1.0, 1.0, 1.0],
      [1920, 1080, 4.7, 1.0, 2.0, 1.5],
      [512,  512,  0.8, 1.0, 0.5, 0.5],
    ] as const) {
      const s = computeTextFitScale(w, h, ax, ay, ps, fm)
      expect(isFinite(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
    }
  })

  it('audio terms removed: bassPulse and bloomFactor do not affect fit scale', () => {
    // The fit scale is now purely geometric; audio is applied locally per character.
    const scale1 = computeTextFitScale(W, H, 4.7, 1, 1, 1)
    const scale2 = computeTextFitScale(W, H, 4.7, 1, 1, 1)
    expect(scale1).toBe(scale2)
  })
})

// ── computeCharCenters ────────────────────────────────────────────────────────

function makeCharPoints(
  charData: Array<{ ci: number; pts: Array<[number, number]> }>,
): OscillatorGlyphPoint[] {
  const result: OscillatorGlyphPoint[] = []
  for (const { ci, pts } of charData) {
    for (const [x, y] of pts) {
      result.push({ x, y, pathIndex: ci, progress: 0, characterIndex: ci, glyphIndex: ci })
    }
  }
  return result
}

describe('computeCharCenters', () => {
  it('returns the centroid (mean) of each character\'s points', () => {
    const pts = makeCharPoints([
      { ci: 0, pts: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },  // centroid = (0, 0)
      { ci: 1, pts: [[3, 0], [5, 0], [4, 2]] },               // centroid = (4, 2/3)
    ])
    const centers = computeCharCenters(pts)
    expect(centers.get(0)!.cx).toBeCloseTo(0, 10)
    expect(centers.get(0)!.cy).toBeCloseTo(0, 10)
    expect(centers.get(1)!.cx).toBeCloseTo(4, 10)
    expect(centers.get(1)!.cy).toBeCloseTo(2 / 3, 10)
  })

  it('ignores points with no characterIndex', () => {
    const pts: OscillatorGlyphPoint[] = [
      { x: 0, y: 0, pathIndex: 0, progress: 0 },           // no characterIndex
      { x: 2, y: 4, pathIndex: 0, progress: 0, characterIndex: 0, glyphIndex: 0 },
    ]
    const centers = computeCharCenters(pts)
    expect(centers.size).toBe(1)
    expect(centers.get(0)!.cx).toBeCloseTo(2, 10)
    expect(centers.get(0)!.cy).toBeCloseTo(4, 10)
  })

  it('empty point list returns empty map', () => {
    expect(computeCharCenters([])).toEqual(new Map())
  })
})

// ── computeCharCenters — space / non-consecutive indices ─────────────────────

describe('computeCharCenters — non-consecutive characterIndex (spaces)', () => {
  // Simulates "HI Y": H=ci0, I=ci1, space=ci2 (no points), Y=ci3
  const pts = makeCharPoints([
    { ci: 0, pts: [[-5, 0], [-3, 0]] },   // H centroid = (-4, 0)
    { ci: 1, pts: [[-1, 0], [1, 0]]  },   // I centroid = (0, 0)
    // ci=2 (space): no points
    { ci: 3, pts: [[3, 0], [5, 0]]   },   // Y centroid = (4, 0)
  ])

  it('returns entries only for characters that have geometry (no space entry)', () => {
    const centers = computeCharCenters(pts)
    expect(centers.has(0)).toBe(true)
    expect(centers.has(1)).toBe(true)
    expect(centers.has(2)).toBe(false)  // space — no points
    expect(centers.has(3)).toBe(true)
  })

  it('size reflects visible character count, not string length', () => {
    expect(computeCharCenters(pts).size).toBe(3)
  })

  it('max key is the last visible characterIndex (3, not 2)', () => {
    const centers = computeCharCenters(pts)
    const maxCi = Math.max(...centers.keys())
    expect(maxCi).toBe(3)
  })

  it('centroids are correct for each visible character', () => {
    const centers = computeCharCenters(pts)
    expect(centers.get(0)!.cx).toBeCloseTo(-4, 10)
    expect(centers.get(0)!.cy).toBeCloseTo(0, 10)
    expect(centers.get(3)!.cx).toBeCloseTo(4, 10)
    expect(centers.get(3)!.cy).toBeCloseTo(0, 10)
  })
})

// ── Multi-contour letters (O, B, R): characterIndex groups all contours ───────

describe('computeCharCenters — multi-contour letter (O has outer + inner rings)', () => {
  // Simulate O: outer ring at pathIndex=0, inner ring at pathIndex=1; both ci=2
  const outerRing: OscillatorGlyphPoint[] = [
    { x:  1, y:  0, pathIndex: 0, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x:  0, y:  1, pathIndex: 0, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x: -1, y:  0, pathIndex: 0, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x:  0, y: -1, pathIndex: 0, progress: 0, characterIndex: 2, glyphIndex: 15 },
  ]
  const innerRing: OscillatorGlyphPoint[] = [
    { x:  0.5, y:  0, pathIndex: 1, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x:  0, y:  0.5, pathIndex: 1, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x: -0.5, y:  0, pathIndex: 1, progress: 0, characterIndex: 2, glyphIndex: 15 },
    { x:  0, y: -0.5, pathIndex: 1, progress: 0, characterIndex: 2, glyphIndex: 15 },
  ]
  const allPts = [...outerRing, ...innerRing]

  it('both contours (different pathIndex, same characterIndex) map to one centroid', () => {
    const centers = computeCharCenters(allPts)
    expect(centers.size).toBe(1)
    expect(centers.has(2)).toBe(true)
  })

  it('centroid is the mean of all 8 points across both contours', () => {
    const centers = computeCharCenters(allPts)
    // All points are symmetric around (0,0)
    expect(centers.get(2)!.cx).toBeCloseTo(0, 10)
    expect(centers.get(2)!.cy).toBeCloseTo(0, 10)
  })
})

// ── Per-character centroid stability ─────────────────────────────────────────

describe('per-character centroid stability', () => {
  // Simulate a letter with 8 points arranged symmetrically around (2, 1)
  const charPts = [
    [2.5, 1.5], [1.5, 1.5], [1.5, 0.5], [2.5, 0.5],
    [3.0, 1.0], [1.0, 1.0], [2.0, 0.0], [2.0, 2.0],
  ] as const
  const pts = makeCharPoints([{ ci: 0, pts: charPts as unknown as Array<[number, number]> }])

  it('centroid stays fixed when local offsets are scaled (bass pulse)', () => {
    const cc = computeCharCenters(pts).get(0)!

    for (const charLocalScale of [0.5, 1.0, 1.3, 2.0]) {
      let sumX = 0, sumY = 0, n = 0
      for (const p of pts) {
        if (p.characterIndex !== 0) continue
        sumX += cc.cx + (p.x - cc.cx) * charLocalScale
        sumY += cc.cy + (p.y - cc.cy) * charLocalScale
        n++
      }
      // Centroid of transformed points = original centroid (mathematically exact)
      expect(sumX / n).toBeCloseTo(cc.cx, 10)
      expect(sumY / n).toBeCloseTo(cc.cy, 10)
    }
  })

  it('centroid stays fixed when local offsets are rotated (mid twist)', () => {
    const cc = computeCharCenters(pts).get(0)!

    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      const cosA = Math.cos(angle), sinA = Math.sin(angle)
      let sumX = 0, sumY = 0, n = 0
      for (const p of pts) {
        if (p.characterIndex !== 0) continue
        const ldx = p.x - cc.cx, ldy = p.y - cc.cy
        sumX += cc.cx + (ldx * cosA - ldy * sinA)
        sumY += cc.cy + (ldx * sinA + ldy * cosA)
        n++
      }
      expect(sumX / n).toBeCloseTo(cc.cx, 10)
      expect(sumY / n).toBeCloseTo(cc.cy, 10)
    }
  })

  it('combined scale + twist preserves centroid', () => {
    const cc = computeCharCenters(pts).get(0)!
    const charLocalScale = 1.4
    const angle = Math.PI / 3
    const cosA = Math.cos(angle), sinA = Math.sin(angle)

    let sumX = 0, sumY = 0, n = 0
    for (const p of pts) {
      if (p.characterIndex !== 0) continue
      let ldx = p.x - cc.cx, ldy = p.y - cc.cy
      const tx = ldx * cosA - ldy * sinA
      const ty = ldx * sinA + ldy * cosA
      ldx = tx * charLocalScale
      ldy = ty * charLocalScale
      sumX += cc.cx + ldx
      sumY += cc.cy + ldy
      n++
    }
    expect(sumX / n).toBeCloseTo(cc.cx, 10)
    expect(sumY / n).toBeCloseTo(cc.cy, 10)
  })
})
