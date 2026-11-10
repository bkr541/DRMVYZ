import { describe, expect, it } from 'vitest'
import {
  computeXyScopeFormPoint,
  createXyScopeFormDrive,
  xyScopeFormBreak,
  isXyScopePattern,
  XY_SCOPE_PATTERN_CYCLE,
  XY_SCOPE_PATTERN_IDS,
  XY_SCOPE_PATTERN_LABELS,
  type XyScopeFormDrive,
  type XyScopeFormPattern,
  type XyScopePoint,
} from './XyScopePatterns'

const FORMS = XY_SCOPE_PATTERN_IDS.filter((id): id is XyScopeFormPattern => id !== 'word')

function drive(overrides: Partial<XyScopeFormDrive> = {}): XyScopeFormDrive {
  const d = createXyScopeFormDrive()
  for (let i = 0; i < d.cloudX.length; i += 1) {
    d.cloudX[i] = 0.5 * Math.sin(i * 0.09)
    d.cloudY[i] = 0.5 * Math.sin(i * 0.05 + 1)
    d.trace[i] = 0.6 * Math.sin(i * 0.04)
  }
  return { ...d, radius: 200, halfWidth: 400, halfHeight: 120, ...overrides }
}

function trace(pattern: XyScopeFormPattern, d: XyScopeFormDrive, count = 400): XyScopePoint[] {
  const out: XyScopePoint = { x: 0, y: 0 }
  const points: XyScopePoint[] = []
  for (let i = 0; i < count; i += 1) { computeXyScopeFormPoint(pattern, i / count, d, out); points.push({ x: out.x, y: out.y }) }
  return points
}

describe('Sound Drawing XY patterns', () => {
  it('starts with the letters and steps through every form, labelled for the Pattern dropdown', () => {
    expect(XY_SCOPE_PATTERN_IDS[0]).toBe('word')
    expect(XY_SCOPE_PATTERN_CYCLE).toEqual(XY_SCOPE_PATTERN_IDS)
    for (const id of XY_SCOPE_PATTERN_IDS) expect(XY_SCOPE_PATTERN_LABELS[id].length).toBeGreaterThan(2)
    expect(isXyScopePattern('rosette')).toBe(true)
    expect(isXyScopePattern('spiral')).toBe(false)
  })

  it('is deterministic and always finite', () => {
    for (const pattern of FORMS) {
      const a = trace(pattern, drive({ phase: 3.3, variation: 2, bass: 0.6, mid: 0.4, high: 0.8, kick: 1, snare: 1 }))
      const b = trace(pattern, drive({ phase: 3.3, variation: 2, bass: 0.6, mid: 0.4, high: 0.8, kick: 1, snare: 1 }))
      expect(a).toEqual(b)
      expect(a.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
  })

  it('keeps every form on the stage', () => {
    for (const pattern of FORMS) {
      for (const variation of [0, 1, 2, 3, 4]) {
        for (const p of trace(pattern, drive({ phase: 1.7, variation, bass: 1, mid: 1, high: 1, kick: 1, snare: 1 }))) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(600)
          expect(Math.abs(p.y)).toBeLessThanOrEqual(400)
        }
      }
    }
  })

  it('draws closed oscillator figures: the end of the trace meets its start', () => {
    for (const pattern of ['ring', 'rosette', 'weave'] as const) {
      const d = drive({ phase: 0.4 })
      const out: XyScopePoint = { x: 0, y: 0 }
      computeXyScopeFormPoint(pattern, 0, d, out)
      const start = { ...out }
      computeXyScopeFormPoint(pattern, 1 - 1e-9, d, out)
      expect(Math.hypot(out.x - start.x, out.y - start.y)).toBeLessThan(0.5)
    }
  })

  it('draws the waveform across the stage from left to right, from the real audio trace', () => {
    const d = drive()
    const points = trace('waveform', d)
    expect(points[0].x).toBeCloseTo(-400, 0)
    expect(points[points.length - 1].x).toBeGreaterThan(390)
    for (let i = 1; i < points.length; i += 1) expect(points[i].x).toBeGreaterThan(points[i - 1].x)
    // Silence is a flat line; a signal moves it.
    const flat = trace('waveform', drive({ trace: new Float32Array(512) }))
    expect(Math.max(...flat.map(p => Math.abs(p.y)))).toBe(0)
    expect(Math.max(...points.map(p => Math.abs(p.y)))).toBeGreaterThan(10)
  })

  it('draws the stereo scope from the live mid/side trace', () => {
    const d = drive({ cloudGain: 2 })
    const out: XyScopePoint = { x: 0, y: 0 }
    computeXyScopeFormPoint('scope', 0.5, d, out)
    const j = Math.floor(0.5 * 512)
    expect(out.x).toBeCloseTo(d.cloudX[j] * 2 * 200 * 1.35, 3)
    expect(out.y).toBeCloseTo(-d.cloudY[j] * 2 * 200, 3)
  })

  it('turns the figures with the phase, and gives repeat visits a different variant', () => {
    for (const pattern of ['ring', 'rosette', 'weave', 'pinwheel'] as const) {
      expect(trace(pattern, drive({ phase: 0 }))).not.toEqual(trace(pattern, drive({ phase: 2 })))
    }
    for (const pattern of ['ring', 'rosette', 'weave', 'pinwheel'] as const) {
      expect(trace(pattern, drive({ variation: 0 }))).not.toEqual(trace(pattern, drive({ variation: 1 })))
    }
  })

  it('swells with the bass and the kick', () => {
    const radius = (d: XyScopeFormDrive) => Math.max(...trace('ring', d).map(p => Math.hypot(p.x, p.y)))
    expect(radius(drive({ bass: 1, kick: 1 }))).toBeGreaterThan(radius(drive({ bass: 0, kick: 0 })) * 1.15)
  })

  it('makes a pinwheel of separate arms and a rosette of several petals', () => {
    const arms = trace('pinwheel', drive({ variation: 0 }), 600)
    let jumps = 0
    for (let i = 1; i < arms.length; i += 1) if (Math.hypot(arms[i].x - arms[i - 1].x, arms[i].y - arms[i - 1].y) > 60) jumps += 1
    expect(jumps).toBe(5) // six arms, five hand-overs
    const petals = trace('rosette', drive({ variation: 0 }), 600)
    const radii = petals.map(p => Math.hypot(p.x, p.y))
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii) * 1.5)
  })

  it('lifts the beam only between the arms of a pinwheel', () => {
    const count = 600
    let breaks = 0
    for (let i = 0; i < count; i += 1) if (xyScopeFormBreak('pinwheel', i / count, (i + 1) / count, 0)) breaks += 1
    expect(breaks).toBe(5) // six arms, five hand-overs (the last point wraps to nothing)
    for (const pattern of ['waveform', 'scope', 'ring', 'rosette', 'weave'] as const) {
      for (let i = 0; i < count; i += 1) expect(xyScopeFormBreak(pattern, i / count, (i + 1) / count, 1)).toBe(false)
    }
  })
})
