import { describe, expect, it } from 'vitest'
import { buildXyScopeLayout, getDefaultXyScopeFont } from './XyScopeGeometry'
import { createXyScopeGlyphState } from './XyScopeConversation'
import { createXyScopeFormDrive, XY_SCOPE_PATTERN_IDS, xyScopePatternIndex, type XyScopePattern } from './XyScopePatterns'
import {
  computeXyScopeGlyphPoints,
  createXyScopePointBuffers,
  createXyScopeScopeFrame,
  XyScopeScopeWindow,
  XY_SCOPE_CLOUD_SAMPLES,
} from './XyScopeMotion'

const layout = buildXyScopeLayout({ text: 'DRM', font: getDefaultXyScopeFont(), width: 1000, height: 700, size: 0.84, letterSpacing: 0.024, minPieceSize: 0.07 })
const glyph = layout.glyphs[1]

function stereoSine(frames: number, leftGain: number, rightGain: number): { left: Float32Array; right: Float32Array } {
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    const v = Math.sin(i * 0.05)
    left[i] = v * leftGain
    right[i] = v * rightGain
  }
  return { left, right }
}

describe('XyScopeScopeWindow', () => {
  it('draws a centred (mono) signal as a vertical line', () => {
    const { left, right } = stereoSine(4096, 0.5, 0.5)
    const frame = new XyScopeScopeWindow().update(left, right, 1 / 60, 0)
    expect(frame.source).toBe('stereo')
    let maxX = 0
    let maxY = 0
    for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) { maxX = Math.max(maxX, Math.abs(frame.cloudX[k])); maxY = Math.max(maxY, Math.abs(frame.cloudY[k])) }
    expect(maxX).toBeLessThan(1e-4)
    expect(maxY).toBeGreaterThan(0.3)
  })

  it('draws a hard-panned signal as a horizontal-leaning line and reports stereo width honestly', () => {
    const { left, right } = stereoSine(4096, 0.5, 0)
    const frame = new XyScopeScopeWindow().update(left, right, 1 / 60, 0)
    let maxX = 0
    for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) maxX = Math.max(maxX, Math.abs(frame.cloudX[k]))
    expect(maxX).toBeGreaterThan(0.2)
  })

  it('falls back to a labelled procedural figure with no capture, and without NaN', () => {
    const frame = new XyScopeScopeWindow().update(null, null, 1 / 60, 3)
    expect(frame.source).toBe('fallback')
    expect(Array.from(frame.cloudX).every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(frame.cloudGain)).toBe(true)
  })

  it('never lets the gain clip a loud signal', () => {
    const { left, right } = stereoSine(4096, 1, 0.2)
    const window = new XyScopeScopeWindow()
    const frame = window.update(left, right, 1 / 60, 0)
    let peak = 0
    for (let k = 0; k < XY_SCOPE_CLOUD_SAMPLES; k += 1) peak = Math.max(peak, Math.abs(frame.cloudX[k]) * frame.cloudGain, Math.abs(frame.cloudY[k]) * frame.cloudGain)
    expect(peak).toBeLessThanOrEqual(1.0001)
  })
})

describe('computeXyScopeGlyphPoints', () => {
  const rest = createXyScopeGlyphState()
  const scope = createXyScopeScopeFrame()

  it('draws the letter exactly at rest with no vibration, no hits and no dissolve', () => {
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 0, dissolveDepth: 1 }, scope, out)
    for (let i = 0; i < glyph.count; i += 1) {
      expect(out.x[i]).toBeCloseTo(glyph.centerX + glyph.x[i], 3)
      expect(out.y[i]).toBeCloseTo(glyph.y[i], 3)
      expect(out.dissolved[i]).toBe(0)
    }
  })

  it('never translates the whole letter: a ringing letter keeps its centre of mass', () => {
    const state = { ...createXyScopeGlyphState(), vibration: 1, ringPhase: 0 }
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, state, 0, { vibration: 1, dissolveDepth: 1 }, scope, out)
    let dx = 0
    let dy = 0
    for (let i = 0; i < glyph.count; i += 1) { dx += out.x[i] - (glyph.centerX + glyph.x[i]); dy += out.y[i] - glyph.y[i] }
    expect(Math.abs(dx / glyph.count)).toBeLessThan(glyph.heightPx * 0.01)
    expect(Math.abs(dy / glyph.count)).toBeLessThan(glyph.heightPx * 0.01)
  })

  it('keeps neighbouring points moving together, so edges never tear', () => {
    const state = { ...createXyScopeGlyphState(), vibration: 1, ringPhase: 0, ripple: 1, ripplePhase: 1 }
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, state, 0, { vibration: 1.5, dissolveDepth: 1 }, scope, out)
    let worst = 0
    for (let i = 1; i < glyph.count; i += 1) {
      if (glyph.s[i] - glyph.s[i - 1] > 0.05) continue
      const offsetNow = Math.hypot(out.x[i] - (glyph.centerX + glyph.x[i]), out.y[i] - glyph.y[i])
      const offsetBefore = Math.hypot(out.x[i - 1] - (glyph.centerX + glyph.x[i - 1]), out.y[i - 1] - glyph.y[i - 1])
      worst = Math.max(worst, Math.abs(offsetNow - offsetBefore))
    }
    expect(worst).toBeLessThan(glyph.heightPx * 0.02)
  })

  it('moves every point into the scope cloud at a full dissolve, and none at zero', () => {
    const { left, right } = stereoSine(4096, 0.4, 0.2)
    const frame = new XyScopeScopeWindow().update(left, right, 1 / 60, 0)
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, { ...createXyScopeGlyphState(), fray: 0 }, 1, { vibration: 0, dissolveDepth: 1 }, frame, out)
    let moved = 0
    for (let i = 0; i < glyph.count; i += 1) {
      expect(out.dissolved[i]).toBeGreaterThan(0.99)
      if (Math.hypot(out.x[i] - (glyph.centerX + glyph.x[i]), out.y[i] - glyph.y[i]) > 1) moved += 1
    }
    expect(moved).toBeGreaterThan(glyph.count * 0.9)
    computeXyScopeGlyphPoints(glyph, 1, createXyScopeGlyphState(), 0, { vibration: 0, dissolveDepth: 1 }, frame, out)
    expect(Math.max(...Array.from(out.dissolved))).toBe(0)
  })

  it('frays only part of the letter on a small dissolve', () => {
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, createXyScopeGlyphState(), 0.15, { vibration: 0, dissolveDepth: 1 }, scope, out)
    let dissolved = 0
    for (let i = 0; i < glyph.count; i += 1) if (out.dissolved[i] > 0.05) dissolved += 1
    expect(dissolved).toBeGreaterThan(0)
    expect(dissolved).toBeLessThan(glyph.count * 0.4)
  })

  it('is deterministic', () => {
    const state = { ...createXyScopeGlyphState(), vibration: 0.7, ringPhase: 2.1, ripple: 0.4, ripplePhase: 3 }
    const a = createXyScopePointBuffers(glyph.count)
    const b = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, state, 0.3, { vibration: 1, dissolveDepth: 1 }, scope, a)
    computeXyScopeGlyphPoints(glyph, 1, state, 0.3, { vibration: 1, dissolveDepth: 1 }, scope, b)
    expect(Array.from(a.x)).toEqual(Array.from(b.x))
    expect(Array.from(a.y)).toEqual(Array.from(b.y))
  })
})

describe('computeXyScopeGlyphPoints: moving into an oscillator form and back', () => {
  const scope = createXyScopeScopeFrame()
  const total = layout.totalPoints
  const offset = layout.glyphs.slice(0, 1).reduce((sum, g) => sum + g.count, 0)
  const rest = createXyScopeGlyphState()

  function formFor(pattern: XyScopePattern, weight: number) {
    const weights = new Float32Array(XY_SCOPE_PATTERN_IDS.length)
    weights[xyScopePatternIndex(pattern)] = weight
    weights[0] = 1 - weight
    const drive = createXyScopeFormDrive()
    drive.radius = 220
    drive.cloudX.fill(0.2); drive.cloudY.fill(0.3)
    return { weights, globalOffset: offset, globalTotal: total, drive }
  }

  it('is exactly the letter when the word weight is one, with the loops closed', () => {
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 0, dissolveDepth: 1 }, scope, out, formFor('ring', 0))
    for (let i = 0; i < glyph.count; i += 1) {
      expect(out.x[i]).toBeCloseTo(glyph.centerX + glyph.x[i], 3)
      expect(out.form[i]).toBe(0)
    }
  })

  it('puts every point on the form at full weight, and none of the letter remains', () => {
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 0, dissolveDepth: 1 }, scope, out, formFor('ring', 1))
    for (let i = 0; i < glyph.count; i += 1) {
      expect(out.form[i]).toBeGreaterThan(0.999)
      // The ring is centred on the stage, so every point sits at about the ring radius from the origin.
      expect(Math.hypot(out.x[i], out.y[i])).toBeGreaterThan(100)
      expect(Math.hypot(out.x[i], out.y[i])).toBeLessThan(260)
    }
  })

  it('moves the whole outline together: a half-way change has every stretch under way, the start slightly ahead', () => {
    const out = createXyScopePointBuffers(glyph.count)
    computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 0, dissolveDepth: 1 }, scope, out, formFor('ring', 0.5))
    let early = 0
    let late = 0
    let earlyN = 0
    let lateN = 0
    for (let i = 0; i < glyph.count; i += 1) {
      if (glyph.s[i] < 0.3) { early += out.form[i]; earlyN += 1 }
      if (glyph.s[i] > 0.8) { late += out.form[i]; lateN += 1 }
    }
    expect(early / earlyN).toBeGreaterThan(late / lateN)
    // No stretch of the letter is left behind while another has gone: even the end has begun to move.
    expect(late / lateN).toBeGreaterThan(0.2)
    expect(early / earlyN - late / lateN).toBeLessThan(0.5)
  })

  it('is deterministic and never produces NaN', () => {
    const a = createXyScopePointBuffers(glyph.count)
    const b = createXyScopePointBuffers(glyph.count)
    for (const pattern of XY_SCOPE_PATTERN_IDS.filter(id => id !== 'word')) {
      computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 1, dissolveDepth: 1 }, scope, a, formFor(pattern, 0.6))
      computeXyScopeGlyphPoints(glyph, 1, rest, 0, { vibration: 1, dissolveDepth: 1 }, scope, b, formFor(pattern, 0.6))
      expect(Array.from(a.x)).toEqual(Array.from(b.x))
      expect(Array.from(a.x).every(Number.isFinite) && Array.from(a.y).every(Number.isFinite)).toBe(true)
    }
  })
})
