import { describe, it, expect } from 'vitest'
import { buildTextWaveformMeta, applyTextWaveformDisplacement } from '../SoundDrawingRenderer'
import type { TextWaveformMeta } from '../SoundDrawingRenderer'
import type { OscillatorGlyphPoint } from '../../ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Build N points spread evenly from x=-1 to x=1, y=0, all pathIndex 0. */
function makeLinePoints(n: number): OscillatorGlyphPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x:         n > 1 ? -1 + (2 * i) / (n - 1) : 0,
    y:         0,
    pathIndex: 0,
    progress:  n > 1 ? i / (n - 1) : 0,
    normalX:   0,
    normalY:   1,
  }))
}

/** Build N points each in its own pathIndex group (simulates OpenType per-letter groups). */
function makeMultiGroupPoints(n: number): OscillatorGlyphPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    x:         -1 + (2 * i) / (n - 1),
    y:         0,
    pathIndex: i,
    progress:  n > 1 ? i / (n - 1) : 0,
    normalX:   0,
    normalY:   1,
  }))
}

function sourceGroupsFor(points: OscillatorGlyphPoint[]): number[][] {
  const map = new Map<number, number[]>()
  for (let i = 0; i < points.length; i++) {
    const pidx = points[i].pathIndex ?? 0
    if (!map.has(pidx)) map.set(pidx, [])
    map.get(pidx)!.push(i)
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

/** Fake time-domain buffer with non-zero, varying values. */
function makeTimeDomainBuf(len = 256): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(len)
  for (let i = 0; i < len; i++) buf[i] = 100 + Math.round(Math.sin(i * 0.3) * 50)
  return buf as unknown as Uint8Array<ArrayBuffer>
}

// ── buildTextWaveformMeta ─────────────────────────────────────────────────────

describe('buildTextWaveformMeta', () => {
  it('produces non-monotonic localProgress for single-group canvas-fallback text ("GOONZ")', () => {
    const n      = 20
    const points = makeLinePoints(n)
    const groups = sourceGroupsFor(points)  // one group, all pathIndex 0
    const meta   = buildTextWaveformMeta(points, groups, 'GOONZ')

    expect(meta.charCount).toBe(5)
    expect(meta.localProgressByPointIndex).toHaveLength(n)

    // Check that the sequence is NOT monotonically increasing (it cycles per-char)
    const prog = meta.localProgressByPointIndex
    let seenDecrease = false
    for (let i = 1; i < prog.length; i++) {
      if (prog[i] < prog[i - 1]) { seenDecrease = true; break }
    }
    expect(seenDecrease, 'progress should cycle (not be monotonically increasing) for GOONZ').toBe(true)
  })

  it('uses per-group 0→1 progress for multi-group (OpenType) text', () => {
    const n      = 10
    const points = makeMultiGroupPoints(n)
    const groups = sourceGroupsFor(points)  // one group per point
    const meta   = buildTextWaveformMeta(points, groups, 'GOONZ')

    // Each group has exactly one point → pathLocalProgress = 0 for all
    for (const v of meta.localProgressByPointIndex) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('charCount is at least 1 even for empty text', () => {
    const points = makeLinePoints(4)
    const groups = sourceGroupsFor(points)
    const meta   = buildTextWaveformMeta(points, groups, '')
    expect(meta.charCount).toBeGreaterThanOrEqual(1)
  })

  it('all localProgress values are in [0, 1]', () => {
    const points = makeLinePoints(30)
    const groups = sourceGroupsFor(points)
    const meta   = buildTextWaveformMeta(points, groups, 'DRMVYZ')
    for (const v of meta.localProgressByPointIndex) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('handles empty points array without throwing', () => {
    const meta = buildTextWaveformMeta([], [], 'GOONZ')
    expect(meta.localProgressByPointIndex).toHaveLength(0)
    expect(meta.charCount).toBe(5)
  })
})

// ── applyTextWaveformDisplacement ─────────────────────────────────────────────

describe('applyTextWaveformDisplacement', () => {
  const meta: TextWaveformMeta = {
    minX: -1, maxX: 1, minY: -1, maxY: 1,
    charCount: 5,
    localProgressByPointIndex: [0, 0.2, 0.4, 0.6, 0.8],
  }
  const td = makeTimeDomainBuf()

  it('amount=0 produces no coordinate change regardless of waveform data', () => {
    for (const mode of ['normal', 'radial', 'tangent', 'xy'] as const) {
      const { px, py } = applyTextWaveformDisplacement(
        0.5, 0.3, 0.5, 0.3, 0, 1, 0, meta, mode,
        0,    // amount = 0
        5, 0, td, 0.5,
      )
      expect(px).toBeCloseTo(0.5, 10)
      expect(py).toBeCloseTo(0.3, 10)
    }
  })

  it("mode 'off' returns coordinates unchanged", () => {
    const { px, py } = applyTextWaveformDisplacement(
      0.5, 0.3, 0.5, 0.3, 0, 1, 0, meta, 'off',
      0.20, 5, 0, td, 0.5,
    )
    expect(px).toBeCloseTo(0.5, 10)
    expect(py).toBeCloseTo(0.3, 10)
  })

  it("mode 'normal' displaces along the normal vector", () => {
    // normalX=0, normalY=1 → only py should change
    const { px, py } = applyTextWaveformDisplacement(
      0.5, 0.3, 0.5, 0.3, 0, 1, 0, meta, 'normal',
      0.20, 5, 0, td, 0,
    )
    expect(px).toBeCloseTo(0.5, 10)   // normalX=0, no x change
    expect(py).not.toBeCloseTo(0.3, 5) // normalY=1 with non-zero wave → y shifts
  })

  it("mode 'tangent' displaces perpendicular to the normal", () => {
    // normalX=0, normalY=1 → tangent is (-1, 0), so only px changes
    const { px, py } = applyTextWaveformDisplacement(
      0.5, 0.3, 0.5, 0.3, 0, 1, 0, meta, 'tangent',
      0.20, 5, 0, td, 0,
    )
    expect(py).toBeCloseTo(0.3, 10)   // normalX=0, no py change in tangent mode
    expect(px).not.toBeCloseTo(0.5, 5) // -normalY * dispAmt applied to px
  })

  it("mode 'radial' displaces outward from origin when orig coords are non-zero", () => {
    // origX=1, origY=0 → radial direction is (1,0), so px changes
    const { px, py } = applyTextWaveformDisplacement(
      1.0, 0.0, 1.0, 0.0, 0, 1, 0, meta, 'radial',
      0.20, 5, 0, td, 0,
    )
    expect(py).toBeCloseTo(0.0, 10)
    expect(px).not.toBeCloseTo(1.0, 5)
  })

  it("mode 'radial' returns unchanged coords when orig is at center (0,0)", () => {
    const { px, py } = applyTextWaveformDisplacement(
      0, 0, 0, 0, 0, 1, 0, meta, 'radial',
      0.20, 5, 0, td, 0,
    )
    expect(px).toBe(0)
    expect(py).toBe(0)
  })

  it("mode 'xy' displaces both axes independently", () => {
    // With normalX=0, normalY=0, xy mode still works from waveform values
    const { px, py } = applyTextWaveformDisplacement(
      0.5, 0.3, 0.5, 0.3, 0, 0, 2, meta, 'xy',
      0.20, 5, 0, td, 0,
    )
    // Both should move unless both wave samples happen to be 0
    const xMoved = Math.abs(px - 0.5) > 1e-6
    const yMoved = Math.abs(py - 0.3) > 1e-6
    expect(xMoved || yMoved).toBe(true)
  })

  it('output is finite for all modes', () => {
    for (const mode of ['normal', 'radial', 'tangent', 'xy', 'off'] as const) {
      const { px, py } = applyTextWaveformDisplacement(
        0.5, 0.3, 0.5, 0.3, 0.7, 0.7, 1, meta, mode,
        0.20, 5, 0.15, td, 0.8,
      )
      expect(isFinite(px)).toBe(true)
      expect(isFinite(py)).toBe(true)
    }
  })

  it('null timeDomainData returns unchanged coords (wave=0)', () => {
    const { px, py } = applyTextWaveformDisplacement(
      0.5, 0.3, 0.5, 0.3, 1, 0, 0, meta, 'normal',
      0.20, 5, 0, null, 0,
    )
    // getTimeDomainNorm(null, ...) = 0 → dispAmt = 0 → no change
    expect(px).toBeCloseTo(0.5, 10)
    expect(py).toBeCloseTo(0.3, 10)
  })
})

// ── Non-text source isolation ─────────────────────────────────────────────────

describe('text waveform source isolation', () => {
  it('buildTextWaveformMeta produces same output for same inputs (deterministic)', () => {
    const points = makeLinePoints(16)
    const groups = sourceGroupsFor(points)
    const a = buildTextWaveformMeta(points, groups, 'GOONZ')
    const b = buildTextWaveformMeta(points, groups, 'GOONZ')
    expect(a.localProgressByPointIndex).toEqual(b.localProgressByPointIndex)
  })
})
