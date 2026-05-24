import { describe, it, expect } from 'vitest'
import {
  derivePostProcessParams,
  isPostProcessActive,
} from './postProcessParams'

// ── helpers ───────────────────────────────────────────────────────────────────

const fx = (...names: string[]) => new Set(names)
const eff  = (noiseFog: number, scanlines: number) => ({ noiseFog, scanlines })
const qual = (scanlineStep: number) => ({ scanlineStep })

// ── derivePostProcessParams — grainAmount ─────────────────────────────────────

describe('derivePostProcessParams() — grain (Noise Fog)', () => {
  it('returns grainAmount=0 when "Noise Fog" is not in fxSet', () => {
    const p = derivePostProcessParams(fx(), eff(0.8, 0), qual(3))
    expect(p.grainAmount).toBe(0)
  })

  it('returns grainAmount=0 when intensity is 0 even if enabled', () => {
    const p = derivePostProcessParams(fx('Noise Fog'), eff(0, 0), qual(3))
    expect(p.grainAmount).toBe(0)
  })

  it('returns grainAmount matching noiseFog intensity when enabled', () => {
    const p = derivePostProcessParams(fx('Noise Fog'), eff(0.6, 0), qual(3))
    expect(p.grainAmount).toBe(0.6)
  })

  it('clamps negative intensity to 0', () => {
    const p = derivePostProcessParams(fx('Noise Fog'), eff(-0.3, 0), qual(3))
    expect(p.grainAmount).toBe(0)
  })

  it('passes through intensity=1 unchanged', () => {
    const p = derivePostProcessParams(fx('Noise Fog'), eff(1, 0), qual(3))
    expect(p.grainAmount).toBe(1)
  })
})

// ── derivePostProcessParams — scanAlpha ───────────────────────────────────────

describe('derivePostProcessParams() — scanlines', () => {
  it('returns scanAlpha=0 when "Scanlines" is not in fxSet', () => {
    const p = derivePostProcessParams(fx(), eff(0, 0.9), qual(3))
    expect(p.scanAlpha).toBe(0)
  })

  it('returns scanAlpha=0 when intensity is 0 even if enabled', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, 0), qual(3))
    expect(p.scanAlpha).toBe(0)
  })

  it('returns scanAlpha matching scanlines intensity when enabled', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, 0.4), qual(3))
    expect(p.scanAlpha).toBe(0.4)
  })

  it('clamps negative scanlines intensity to 0', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, -0.1), qual(3))
    expect(p.scanAlpha).toBe(0)
  })
})

// ── derivePostProcessParams — scanStep ────────────────────────────────────────

describe('derivePostProcessParams() — scanStep', () => {
  it('passes scanlineStep from quality unchanged (step=3)', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, 0.5), qual(3))
    expect(p.scanStep).toBe(3)
  })

  it('passes scanlineStep from quality unchanged (step=6)', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, 0.5), qual(6))
    expect(p.scanStep).toBe(6)
  })

  it('carries scanStep even when Scanlines is disabled (renderer ignores if scanAlpha=0)', () => {
    const p = derivePostProcessParams(fx(), eff(0, 0), qual(4))
    expect(p.scanStep).toBe(4)
  })
})

// ── derivePostProcessParams — both effects ────────────────────────────────────

describe('derivePostProcessParams() — both effects active', () => {
  it('sets both grainAmount and scanAlpha correctly', () => {
    const p = derivePostProcessParams(fx('Noise Fog', 'Scanlines'), eff(0.5, 0.7), qual(4))
    expect(p.grainAmount).toBe(0.5)
    expect(p.scanAlpha).toBe(0.7)
    expect(p.scanStep).toBe(4)
  })

  it('is deterministic — same inputs produce same outputs', () => {
    const inputs = [fx('Noise Fog', 'Scanlines'), eff(0.33, 0.66), qual(3)] as const
    const p1 = derivePostProcessParams(...inputs)
    const p2 = derivePostProcessParams(...inputs)
    expect(p1).toEqual(p2)
  })
})

// ── isPostProcessActive ───────────────────────────────────────────────────────

describe('isPostProcessActive()', () => {
  it('returns false when both grainAmount and scanAlpha are 0', () => {
    expect(isPostProcessActive({ grainAmount: 0, scanAlpha: 0, scanStep: 3 })).toBe(false)
  })

  it('returns true when grainAmount > 0', () => {
    expect(isPostProcessActive({ grainAmount: 0.5, scanAlpha: 0, scanStep: 3 })).toBe(true)
  })

  it('returns true when scanAlpha > 0', () => {
    expect(isPostProcessActive({ grainAmount: 0, scanAlpha: 0.4, scanStep: 3 })).toBe(true)
  })

  it('returns true when both are > 0', () => {
    expect(isPostProcessActive({ grainAmount: 0.3, scanAlpha: 0.6, scanStep: 4 })).toBe(true)
  })
})

// ── GPU routing — Canvas 2D mode emulation ────────────────────────────────────
// These tests verify the expected effect routing by checking derivePostProcessParams
// output under "Canvas 2D" conditions (fxSet may be populated, but GPU path is
// not invoked — grainAmount/scanAlpha being >0 is the trigger, not renderer type).

describe('GPU vs Canvas 2D routing logic', () => {
  it('GPU mode: both effects pass non-zero params when active', () => {
    const p = derivePostProcessParams(fx('Noise Fog', 'Scanlines'), eff(0.6, 0.4), qual(3))
    expect(p.grainAmount).toBeGreaterThan(0)
    expect(p.scanAlpha).toBeGreaterThan(0)
  })

  it('Canvas 2D mode: disabling fxSet produces zero params (GPU pass skipped)', () => {
    // In Canvas 2D mode the GPU pass is not called, but if it were, passing an
    // empty fxSet guarantees zero params → pass does nothing.
    const p = derivePostProcessParams(fx(), eff(0.9, 0.9), qual(3))
    expect(p.grainAmount).toBe(0)
    expect(p.scanAlpha).toBe(0)
  })

  it('effect not double-applied: GPU params non-zero ↔ Canvas 2D modules skipped', () => {
    // When GPU params are non-zero the Canvas 2D modules are skipped.
    // Verify the inverse: zero params → Canvas 2D modules should run.
    const gpuParams = derivePostProcessParams(fx(), eff(0.5, 0.5), qual(3))
    // Zero params mean isPostProcessActive = false → Canvas 2D modules should NOT be skipped
    expect(isPostProcessActive(gpuParams)).toBe(false)
  })

  it('gpuEffects list includes "Noise Fog" when grainAmount > 0', () => {
    const p = derivePostProcessParams(fx('Noise Fog'), eff(0.4, 0), qual(3))
    const gpuFx: string[] = []
    if (p.grainAmount > 0) gpuFx.push('Noise Fog')
    if (p.scanAlpha   > 0) gpuFx.push('Scanlines')
    expect(gpuFx).toContain('Noise Fog')
    expect(gpuFx).not.toContain('Scanlines')
  })

  it('gpuEffects list includes "Scanlines" when scanAlpha > 0', () => {
    const p = derivePostProcessParams(fx('Scanlines'), eff(0, 0.5), qual(3))
    const gpuFx: string[] = []
    if (p.grainAmount > 0) gpuFx.push('Noise Fog')
    if (p.scanAlpha   > 0) gpuFx.push('Scanlines')
    expect(gpuFx).toContain('Scanlines')
    expect(gpuFx).not.toContain('Noise Fog')
  })

  it('gpuEffects is empty when neither effect is active (Canvas 2D handles both)', () => {
    const p = derivePostProcessParams(fx(), eff(0, 0), qual(3))
    const gpuFx: string[] = []
    if (p.grainAmount > 0) gpuFx.push('Noise Fog')
    if (p.scanAlpha   > 0) gpuFx.push('Scanlines')
    expect(gpuFx).toHaveLength(0)
  })
})
