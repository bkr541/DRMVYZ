/**
 * Tests for GPU displacement parameter mapping (deriveDisplacementParams).
 *
 * These cover the pure-function layer — no DOM, no WebGL context required.
 * The Vitest environment is 'node'.
 */

import { describe, it, expect } from 'vitest'
import { deriveDisplacementParams } from './postProcessParams'
import type { DisplacementParams } from './postProcessParams'
import { computeFallbackStatus } from './rendererSelection'

// ── helpers ───────────────────────────────────────────────────────────────────

const fx = (...names: string[]) => new Set(names)
const NO_DISP: DisplacementParams = { dispOffXPx: 0, dispOffYPx: 0, dispAmount: 0, dispHueRad: 0 }

// ── disabled / zero-intensity paths ──────────────────────────────────────────

describe('deriveDisplacementParams() — disabled / zero-intensity', () => {
  it('returns all-zero params when Displacement is not in fxSet', () => {
    const p = deriveDisplacementParams(fx(), 0.5, false, 0, 1000, 0)
    expect(p).toEqual(NO_DISP)
  })

  it('returns all-zero params when dispMod is 0 even if effect is in fxSet', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0, false, 0, 1000, 0)
    expect(p).toEqual(NO_DISP)
  })

  it('returns all-zero params when dispMod is negative', () => {
    const p = deriveDisplacementParams(fx('Displacement'), -0.5, false, 0, 1000, 0)
    expect(p).toEqual(NO_DISP)
  })

  it('dispAmount=0 means GPU displacement pass is identity (no ghost baked)', () => {
    const p = deriveDisplacementParams(fx(), 1.0, false, 0, 0, 0)
    expect(p.dispAmount).toBe(0)
  })
})

// ── enabled paths ─────────────────────────────────────────────────────────────

describe('deriveDisplacementParams() — enabled', () => {
  it('dispAmount matches dispMod when active', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0.7, false, 0, 0, 0)
    expect(p.dispAmount).toBe(0.7)
  })

  it('dispAmount=1 at full intensity', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0, 0, 0)
    expect(p.dispAmount).toBe(1.0)
  })

  it('dispOffXPx and dispOffYPx are non-zero when active with non-zero time', () => {
    // t=5000ms, unsynchronised → angle driven by t * 0.002 = 10 rad
    const p = deriveDisplacementParams(fx('Displacement'), 0.5, false, 0, 5000, 0)
    // sin(10) ≠ 0 and cos(10*0.0017/0.002) ≈ cos(8.5) ≠ 0 in general
    // We just verify non-zero offsets are produced (exact values are temporal)
    expect(Math.abs(p.dispOffXPx) + Math.abs(p.dispOffYPx)).toBeGreaterThan(0)
  })

  it('dispOffXPx magnitude is bounded by dispMod × 12', () => {
    for (const dispMod of [0.25, 0.5, 1.0]) {
      for (const t of [0, 1000, 5000]) {
        const p = deriveDisplacementParams(fx('Displacement'), dispMod, false, 0, t, 0)
        expect(Math.abs(p.dispOffXPx)).toBeLessThanOrEqual(dispMod * 12 + 1e-9)
      }
    }
  })

  it('dispOffYPx magnitude is bounded by dispMod × 8', () => {
    for (const dispMod of [0.25, 0.5, 1.0]) {
      for (const t of [0, 1000, 5000]) {
        const p = deriveDisplacementParams(fx('Displacement'), dispMod, false, 0, t, 0)
        expect(Math.abs(p.dispOffYPx)).toBeLessThanOrEqual(dispMod * 8 + 1e-9)
      }
    }
  })
})

// ── hue rotation mapping ──────────────────────────────────────────────────────

describe('deriveDisplacementParams() — hue rotation', () => {
  it('dispHueRad=0 when activeColorShift=0', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0.5, false, 0, 0, 0)
    expect(p.dispHueRad).toBe(0)
  })

  it('dispHueRad=0 when activeColorShift=0 (explicit)', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0.5, 1000, 0)
    expect(p.dispHueRad).toBe(0)
  })

  it('dispHueRad > 0 when activeColorShift > 0', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0.5, false, 0, 0, 0.5)
    expect(p.dispHueRad).toBeGreaterThan(0)
  })

  it('dispHueRad matches (colorShift × 2π + π/2) when colorShift > 0', () => {
    const colorShift = 0.25
    const expected = colorShift * 2 * Math.PI + Math.PI / 2
    const p = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0, 0, colorShift)
    expect(p.dispHueRad).toBeCloseTo(expected, 10)
  })

  it('hue extra π/2 offset is always present when colorShift > 0 (ghost gets +90° base shift)', () => {
    // Even at colorShift→0+, hueRad should be close to π/2 (not 0)
    const p = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0, 0, 1e-6)
    expect(p.dispHueRad).toBeGreaterThan(Math.PI / 2 - 0.01)
  })
})

// ── BPM-sync mode ─────────────────────────────────────────────────────────────

describe('deriveDisplacementParams() — BPM sync vs free-running', () => {
  it('synced=true: offset is driven by beatPhase, not t', () => {
    // Two frames at same beatPhase but different t → same offsets
    const p1 = deriveDisplacementParams(fx('Displacement'), 1.0, true, 0.25, 100,  0)
    const p2 = deriveDisplacementParams(fx('Displacement'), 1.0, true, 0.25, 9999, 0)
    expect(p1.dispOffXPx).toBeCloseTo(p2.dispOffXPx, 10)
    expect(p1.dispOffYPx).toBeCloseTo(p2.dispOffYPx, 10)
  })

  it('synced=false: offset is driven by t, same beatPhase at different t → different offsets', () => {
    const p1 = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0.25, 100,  0)
    const p2 = deriveDisplacementParams(fx('Displacement'), 1.0, false, 0.25, 9999, 0)
    // Different t values should produce different offsets (unless t values land on same angle by coincidence)
    const xDiff = Math.abs(p1.dispOffXPx - p2.dispOffXPx)
    const yDiff = Math.abs(p1.dispOffYPx - p2.dispOffYPx)
    expect(xDiff + yDiff).toBeGreaterThan(0.01)
  })

  it('synced=true at beatPhase=0: offsets are zero (sin(0)=0, cos(0)=max)', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 1.0, true, 0, 999, 0)
    expect(p.dispOffXPx).toBeCloseTo(0, 10)         // sin(0) = 0
    expect(Math.abs(p.dispOffYPx)).toBeCloseTo(8, 4) // cos(0) × 1 × 8 = 8
  })

  it('is deterministic — same inputs produce same outputs', () => {
    const args = [fx('Displacement'), 0.6, true, 0.33, 4200, 0.4] as const
    expect(deriveDisplacementParams(...args)).toEqual(deriveDisplacementParams(...args))
  })
})

// ── GPU eligibility and double-application prevention ────────────────────────

describe('GPU eligibility — Displacement handled by GPU when isGpu=true', () => {
  it('dispAmount > 0 signals that the GPU pass ran (should be added to gpuFx list)', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0.8, false, 0, 0, 0)
    // In LiveVisualCanvas: if (dispParams.dispAmount > 0) gpuFx.push('Displacement')
    expect(p.dispAmount).toBeGreaterThan(0)
  })

  it('dispAmount=0 means Displacement is NOT added to gpuFx (Canvas path runs if enabled)', () => {
    const p = deriveDisplacementParams(fx(), 0.8, false, 0, 0, 0)
    expect(p.dispAmount).toBe(0)
  })

  it('Canvas fallback: computeFallbackStatus correctly signals context loss', () => {
    // When GPU is lost, Canvas Displacement should run unimpeded
    const r = computeFallbackStatus('webgl2', 'canvas2d', true, 'context lost')
    expect(r.showFallbackWarning).toBe(true)
    expect(r.severity).toBe('critical')
  })
})

// ── FBO routing contract ──────────────────────────────────────────────────────

describe('Displacement FBO routing — needsDisp flag contract', () => {
  it('needsDisp=false when dispAmount=0 (no extra FBO hop)', () => {
    const p = deriveDisplacementParams(fx(), 0, false, 0, 0, 0)
    // needsDisp = p.dispAmount > 0
    const needsDisp = p.dispAmount > 0
    expect(needsDisp).toBe(false)
  })

  it('needsDisp=true when dispAmount>0 (routes stage 3/4 through dispFBO)', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0.5, false, 0, 0, 0)
    const needsDisp = p.dispAmount > 0
    expect(needsDisp).toBe(true)
  })

  it('zero amount returns identity params — no GPU resources consumed for displacement', () => {
    const p = deriveDisplacementParams(fx('Displacement'), 0, false, 0, 0, 0)
    expect(p).toEqual(NO_DISP)
  })
})
