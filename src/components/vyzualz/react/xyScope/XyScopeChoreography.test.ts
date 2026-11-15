import { describe, expect, it } from 'vitest'
import { applyXyScopeBeamChoreography, xyScopeChoreographyPhrase } from './XyScopeChoreography'
import { buildXyScopeLayout, getDefaultXyScopeFont } from './XyScopeGeometry'
import { createXyScopePointBuffers } from './XyScopeMotion'
import { createXyScopeFormDrive, XY_SCOPE_PATTERN_IDS } from './XyScopePatterns'

function layout(width = 900, height = 600) {
  return buildXyScopeLayout({ text: 'DRMVYZ', font: getDefaultXyScopeFont(), width, height, size: 0.84, letterSpacing: 0.024, minPieceSize: 0.07 })
}
const word = layout()
const base = { pattern: 'word' as const, beat: 0, amount: 1, width: 900, height: 600, transitionBeats: 1, answerDelayBeats: 0.09, drive: createXyScopeFormDrive() }
function points(index: number, geometry = word) {
  const glyph = geometry.glyphs[index]
  const buffer = createXyScopePointBuffers(glyph.count)
  for (let i = 0; i < glyph.count; i += 1) { buffer.x[i] = glyph.centerX + glyph.x[i]; buffer.y[i] = glyph.y[i] }
  return buffer
}
const offset = (index: number) => word.glyphs.slice(0, index).reduce((sum, glyph) => sum + glyph.count, 0)

describe('complete XY beam performances', () => {
  it('includes the word, a full figure, and the beam drawing its way back, with no fade or blank phase, at every transition length', () => {
    for (const transition of [0.5, 1, 2, 4]) {
      const length = 8 + transition * 4
      expect(xyScopeChoreographyPhrase(length * 0.02, transition).phase).toBe('word')
      expect(xyScopeChoreographyPhrase(length * 0.55, transition).morph).toBe(1)
      expect(xyScopeChoreographyPhrase(length * 0.7, transition).phase).toBe('redraw')
      expect(xyScopeChoreographyPhrase(length * 0.85, transition).phase).toBe('redraw')
      expect(xyScopeChoreographyPhrase(length * 0.98, transition).phase).toBe('word')
      const phases = new Set(Array.from({ length: 200 }, (_, i) => xyScopeChoreographyPhrase(length * i / 200, transition).phase))
      expect([...phases].sort()).toEqual(['depart', 'figure', 'redraw', 'word'])
    }
  })

  it('never bobs or sways the letters: before a letter turns into its trace it sits exactly where it was', () => {
    // Early in the departure only the first letter has begun to turn; the last is untouched, and nothing slides up or down.
    const last = word.glyphs.length - 1
    const untouched = points(last)
    applyXyScopeBeamChoreography(word.glyphs[last], last, word.glyphs.length, offset(last), word.totalPoints, untouched, { ...base, beat: 12 * 0.13 })
    expect(untouched.x).toEqual(points(last).x)
    expect(untouched.y).toEqual(points(last).y)
    const first = points(0)
    applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, first, { ...base, beat: 12 * 0.2 })
    expect(first.y).not.toEqual(points(0).y)
  })

  it('turns each letter, one after another, into its own chaotic sine trace before the figure', () => {
    const progress = 0.3
    const amountAt = (index: number) => {
      const buffer = points(index)
      applyXyScopeBeamChoreography(word.glyphs[index], index, word.glyphs.length, offset(index), word.totalPoints, buffer, { ...base, beat: progress * 12 })
      return buffer
    }
    for (const index of [0, 2, word.glyphs.length - 1]) {
      const buffer = amountAt(index), glyph = word.glyphs[index]
      // The outline is unrolled left to right across the letter's own width: a trace, not a letter.
      for (let i = 1; i < glyph.count; i += 1) expect(buffer.x[i]).toBeGreaterThanOrEqual(buffer.x[i - 1] - 1e-4)
      const width = Math.max(...glyph.x) - Math.min(...glyph.x)
      expect(Math.max(...buffer.x) - Math.min(...buffer.x)).toBeGreaterThan(width * 0.9)
      expect(Math.max(...buffer.x) - glyph.centerX).toBeLessThan(width)
      const mean = buffer.y.reduce((sum, y) => sum + y, 0) / glyph.count
      const spread = Math.sqrt(buffer.y.reduce((sum, y) => sum + (y - mean) ** 2, 0) / glyph.count)
      expect(spread).toBeGreaterThan(glyph.heightPx * 0.05)
      expect(Math.min(...buffer.form)).toBeGreaterThan(0.3)
    }
    // Chaotic: it crosses its own centre line many times, and no two letters trace the same curve.
    const a = amountAt(0).y, b = amountAt(1).y
    let crossings = 0
    for (let i = 1; i < a.length; i += 1) if (Math.sign(a[i]) !== Math.sign(a[i - 1])) crossings += 1
    expect(crossings).toBeGreaterThan(4)
    expect(Array.from(a.slice(0, 40))).not.toEqual(Array.from(b.slice(0, 40)))
  })

  it('draws a different trace on each visit and keeps it moving with time', () => {
    const at = (visit: number, time: number) => {
      const buffer = points(0)
      applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, beat: visit * 12 + 12 * 0.3, drive: { ...base.drive, variation: visit, time } })
      return Array.from(buffer.y)
    }
    expect(at(1, 0)).not.toEqual(at(0, 0))
    expect(at(0, 0.4)).not.toEqual(at(0, 0))
  })

  it.each(XY_SCOPE_PATTERN_IDS)('%s completely leaves the letters and uses the field in both aspect ratios', pattern => {
    for (const [width, height] of [[900, 600], [393, 700]]) {
      const geometry = layout(width, height)
      const drive = createXyScopeFormDrive()
      drive.radius = Math.min(width, height) * 0.38
      for (let i = 0; i < drive.trace.length; i += 1) {
        const angle = i / drive.trace.length * Math.PI * 2
        drive.trace[i] = Math.sin(angle * 4) * 0.7
        drive.cloudX[i] = Math.sin(angle * 3) * 0.7
        drive.cloudY[i] = Math.cos(angle * 2) * 0.7
      }
      let start = 0, left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
      for (const [index, glyph] of geometry.glyphs.entries()) {
        const buffer = points(index, geometry)
        applyXyScopeBeamChoreography(glyph, index, geometry.glyphs.length, start, geometry.totalPoints, buffer, { ...base, pattern, width, height, beat: 6.6, drive })
        expect(Math.min(...buffer.form)).toBe(1)
        expect([...buffer.x, ...buffer.y].every(Number.isFinite)).toBe(true)
        left = Math.min(left, ...buffer.x); right = Math.max(right, ...buffer.x)
        top = Math.min(top, ...buffer.y); bottom = Math.max(bottom, ...buffer.y)
        start += glyph.count
      }
      expect(right - left).toBeGreaterThan(width * 0.2)
      // A real quiet waveform may be an almost flat horizontal line.
      if (pattern !== 'waveform') expect(bottom - top).toBeGreaterThan(height * 0.2)
      expect(left).toBeGreaterThanOrEqual(-width * 0.47 - 0.001)
      expect(right).toBeLessThanOrEqual(width * 0.47 + 0.001)
      expect(top).toBeGreaterThanOrEqual(-height * 0.47 - 0.001)
      expect(bottom).toBeLessThanOrEqual(height * 0.47 + 0.001)
    }
  })

  it('never blanks the beam between the word and the figure: it stays lit all the way there and all the way back', () => {
    for (const pattern of ['waveform', 'scope', 'ring', 'rosette', 'weave'] as const) {
      for (let progress = 0; progress < 1; progress += 0.02) {
        const buffer = points(1)
        applyXyScopeBeamChoreography(word.glyphs[1], 1, word.glyphs.length, offset(1), word.totalPoints, buffer, { ...base, pattern, beat: progress * 12 })
        expect(Math.max(...buffer.gap), `${pattern} ${progress.toFixed(2)}`).toBeLessThan(0.5)
      }
    }
  })

  it('draws the figure back into the letters continuously and lands exactly home', () => {
    const home = points(0)
    const distance = (buffer: ReturnType<typeof points>) => buffer.x.reduce((sum, x, i) => sum + Math.hypot(x - home.x[i], buffer.y[i] - home.y[i]), 0) / buffer.x.length
    const steps = [0.66, 0.72, 0.78, 0.84, 0.88].map(progress => {
      const buffer = points(0)
      applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, pattern: 'ring', beat: progress * 12 })
      return distance(buffer)
    })
    expect(steps).toEqual([...steps].sort((a, b) => b - a))
    expect(steps[0]).toBeGreaterThan(100)
    expect(steps.at(-1)).toBeLessThan(1)
    const settled = points(0)
    applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, settled, { ...base, beat: 0.98 * 12 })
    expect(settled.x).toEqual(points(0).x)
  })

  it('keeps every figure vibrating: the same figure at the same beat is never quite still', () => {
    for (const pattern of ['waveform', 'ring', 'rosette', 'weave', 'pinwheel'] as const) {
      const frames = [0, 0.016, 0.5].map(time => {
        const buffer = points(0)
        applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, pattern, beat: 6.6, drive: { ...base.drive, time, radius: 220, vibration: 1 } })
        return Array.from(buffer.y)
      })
      expect(frames[1], pattern).not.toEqual(frames[0])
      expect(frames[2], pattern).not.toEqual(frames[0])
      // It shivers by a few percent of the figure, not a scatter.
      const worst = Math.max(...frames[2].map((y, i) => Math.abs(y - frames[0][i])))
      expect(worst, pattern).toBeLessThan(600 * 0.12)
    }
    const still = points(0)
    applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, still, { ...base, pattern: 'ring', beat: 6.6, drive: { ...base.drive, time: 0, vibration: 0, radius: 220 } })
    const moving = points(0)
    applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, moving, { ...base, pattern: 'ring', beat: 6.6, drive: { ...base.drive, time: 0, vibration: 1, radius: 220 } })
    expect(moving.y).not.toEqual(still.y)
  })

  it('moves the active perimeter strokes instead of permanently painting a border', () => {
    const masks = [0.3, 0.6].map(phase => {
      const buffer = points(0)
      applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, beat: 6.6, drive: { ...base.drive, phase } })
      return Array.from(buffer.gap)
    })
    expect(masks[0]).not.toEqual(masks[1])
  })

  it('varies the complete Word performance across visits without changing its selected pattern', () => {
    const signatures = [0, 1, 2].map(visit => {
      const buffer = points(0)
      applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, beat: visit * 12 + 6.6 })
      return Math.round(buffer.x[0])
    })
    expect(new Set(signatures).size).toBe(3)
  })
})
