import { describe, it, expect } from 'vitest'
import {
  deriveColorGradeParams,
  isColorGradeActive,
  buildCanvasColorGradeFilter,
  NEUTRAL_GPU_COLOR_GRADE,
} from './colorGradeParams'
import { DEFAULT_COLOR_GRADE } from '../types/vzColorGrade'
import type { VzColorGrade } from '../types/vzColorGrade'

// ── Helpers ─────────────────────────────────────────────────────────────────

const grade = (patch: Partial<VzColorGrade>): VzColorGrade => ({
  ...DEFAULT_COLOR_GRADE,
  ...patch,
})

// ── DEFAULT_COLOR_GRADE is neutral ───────────────────────────────────────────

describe('DEFAULT_COLOR_GRADE', () => {
  it('is neutral (all adjustment fields 0, enabled true)', () => {
    expect(DEFAULT_COLOR_GRADE.enabled).toBe(true)
    expect(DEFAULT_COLOR_GRADE.brightness).toBe(0)
    expect(DEFAULT_COLOR_GRADE.contrast).toBe(0)
    expect(DEFAULT_COLOR_GRADE.saturation).toBe(0)
    expect(DEFAULT_COLOR_GRADE.hueRotation).toBe(0)
    expect(DEFAULT_COLOR_GRADE.temperature).toBe(0)
    expect(DEFAULT_COLOR_GRADE.tint).toBe(0)
  })

  it('derives to an inactive (no-op) GPU param set', () => {
    expect(isColorGradeActive(deriveColorGradeParams(DEFAULT_COLOR_GRADE))).toBe(false)
  })
})

// ── deriveColorGradeParams — no-op cases ──────────────────────────────────────

describe('deriveColorGradeParams() — no-op cases', () => {
  it('returns neutral params for undefined grade', () => {
    const p = deriveColorGradeParams(undefined)
    expect(isColorGradeActive(p)).toBe(false)
  })

  it('returns neutral params for the default grade', () => {
    const p = deriveColorGradeParams(DEFAULT_COLOR_GRADE)
    expect(isColorGradeActive(p)).toBe(false)
  })

  it('returns neutral params when bypass is true even for an adjusted grade', () => {
    const p = deriveColorGradeParams(grade({ brightness: 50, contrast: 50 }), true)
    expect(p).toEqual(NEUTRAL_GPU_COLOR_GRADE)
    expect(isColorGradeActive(p)).toBe(false)
  })

  it('returns neutral params when the grade is disabled', () => {
    const p = deriveColorGradeParams(grade({ enabled: false, brightness: 50 }))
    expect(isColorGradeActive(p)).toBe(false)
  })
})

// ── deriveColorGradeParams — parameter mapping ────────────────────────────────

describe('deriveColorGradeParams() — parameter mapping', () => {
  it('maps brightness -100..100 → -1..+1', () => {
    expect(deriveColorGradeParams(grade({ brightness: 100 })).brightness).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ brightness: -100 })).brightness).toBeCloseTo(-1)
    expect(deriveColorGradeParams(grade({ brightness: 50 })).brightness).toBeCloseTo(0.5)
  })

  it('maps contrast -100..100 → 0..2 (1 = neutral)', () => {
    expect(deriveColorGradeParams(grade({ contrast: 0 })).contrast).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ contrast: 100 })).contrast).toBeCloseTo(2)
    expect(deriveColorGradeParams(grade({ contrast: -100 })).contrast).toBeCloseTo(0)
  })

  it('maps saturation -100..100 → 0..2 (1 = neutral)', () => {
    expect(deriveColorGradeParams(grade({ saturation: 0 })).saturation).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ saturation: 100 })).saturation).toBeCloseTo(2)
    expect(deriveColorGradeParams(grade({ saturation: -100 })).saturation).toBeCloseTo(0)
  })

  it('maps hueRotation degrees → radians', () => {
    expect(deriveColorGradeParams(grade({ hueRotation: 180 })).hueRotation).toBeCloseTo(Math.PI)
    expect(deriveColorGradeParams(grade({ hueRotation: -180 })).hueRotation).toBeCloseTo(-Math.PI)
    expect(deriveColorGradeParams(grade({ hueRotation: 90 })).hueRotation).toBeCloseTo(Math.PI / 2)
  })

  it('maps temperature -100..100 → -1..+1', () => {
    expect(deriveColorGradeParams(grade({ temperature: 100 })).temperature).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ temperature: -50 })).temperature).toBeCloseTo(-0.5)
  })

  it('maps tint -100..100 → -1..+1', () => {
    expect(deriveColorGradeParams(grade({ tint: 100 })).tint).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ tint: -25 })).tint).toBeCloseTo(-0.25)
  })

  it('clamps out-of-range inputs', () => {
    expect(deriveColorGradeParams(grade({ brightness: 500 })).brightness).toBeCloseTo(1)
    expect(deriveColorGradeParams(grade({ hueRotation: 999 })).hueRotation).toBeCloseTo(Math.PI)
  })
})

// ── isColorGradeActive ────────────────────────────────────────────────────────

describe('isColorGradeActive()', () => {
  it('returns false for the neutral param set', () => {
    expect(isColorGradeActive(NEUTRAL_GPU_COLOR_GRADE)).toBe(false)
  })

  it('returns false for a derived default grade', () => {
    expect(isColorGradeActive(deriveColorGradeParams(DEFAULT_COLOR_GRADE))).toBe(false)
  })

  it('returns false when bypassed', () => {
    expect(isColorGradeActive(deriveColorGradeParams(grade({ saturation: 80 }), true))).toBe(false)
  })

  it('returns true for an adjusted brightness', () => {
    expect(isColorGradeActive(deriveColorGradeParams(grade({ brightness: 10 })))).toBe(true)
  })

  it('returns true for an adjusted contrast', () => {
    expect(isColorGradeActive(deriveColorGradeParams(grade({ contrast: -20 })))).toBe(true)
  })

  it('returns true for an adjusted temperature (GPU-only)', () => {
    expect(isColorGradeActive(deriveColorGradeParams(grade({ temperature: 30 })))).toBe(true)
  })
})

// ── buildCanvasColorGradeFilter ───────────────────────────────────────────────

describe('buildCanvasColorGradeFilter()', () => {
  it('returns "none" for undefined / default / disabled / bypassed', () => {
    expect(buildCanvasColorGradeFilter(undefined)).toBe('none')
    expect(buildCanvasColorGradeFilter(DEFAULT_COLOR_GRADE)).toBe('none')
    expect(buildCanvasColorGradeFilter(grade({ enabled: false, brightness: 50 }))).toBe('none')
    expect(buildCanvasColorGradeFilter(grade({ brightness: 50 }), true)).toBe('none')
  })

  it('emits brightness percentage', () => {
    expect(buildCanvasColorGradeFilter(grade({ brightness: 50 }))).toBe('brightness(150%)')
    expect(buildCanvasColorGradeFilter(grade({ brightness: -50 }))).toBe('brightness(50%)')
  })

  it('emits contrast percentage', () => {
    expect(buildCanvasColorGradeFilter(grade({ contrast: 25 }))).toBe('contrast(125%)')
  })

  it('emits saturate percentage', () => {
    expect(buildCanvasColorGradeFilter(grade({ saturation: -100 }))).toBe('saturate(0%)')
  })

  it('emits hue-rotate degrees', () => {
    expect(buildCanvasColorGradeFilter(grade({ hueRotation: 90 }))).toBe('hue-rotate(90deg)')
    expect(buildCanvasColorGradeFilter(grade({ hueRotation: -45 }))).toBe('hue-rotate(-45deg)')
  })

  it('combines multiple parts in canonical order', () => {
    const f = buildCanvasColorGradeFilter(grade({ brightness: 10, contrast: 20, saturation: 30, hueRotation: 15 }))
    expect(f).toBe('brightness(110%) contrast(120%) saturate(130%) hue-rotate(15deg)')
  })

  it('does NOT emit temperature or tint (GPU-only)', () => {
    const f = buildCanvasColorGradeFilter(grade({ temperature: 80, tint: -40 }))
    expect(f).toBe('none')
  })
})
