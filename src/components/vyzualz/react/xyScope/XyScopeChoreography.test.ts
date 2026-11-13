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
  it('includes full figure, fade, blanking and word redraw phases with every transition length', () => {
    for (const transition of [0.5, 1, 2, 4]) {
      const length = 8 + transition * 4
      expect(xyScopeChoreographyPhrase(length * 0.02, transition).phase).toBe('word')
      expect(xyScopeChoreographyPhrase(length * 0.55, transition).morph).toBe(1)
      expect(xyScopeChoreographyPhrase(length * 0.7, transition).phase).toBe('fade')
      expect(xyScopeChoreographyPhrase(length * 0.78, transition).visibility).toBe(0)
      expect(xyScopeChoreographyPhrase(length * 0.85, transition).phase).toBe('redraw')
      expect(xyScopeChoreographyPhrase(length * 0.98, transition).phase).toBe('word')
    }
  })

  it('features one letter at a time during Word before the whole word dissolves', () => {
    const beat = 12 + 12 * (0.12 + 0.24 * 2.5 / word.glyphs.length)
    const featured = points(2), neighbor = points(3)
    applyXyScopeBeamChoreography(word.glyphs[2], 2, word.glyphs.length, offset(2), word.totalPoints, featured, { ...base, beat })
    applyXyScopeBeamChoreography(word.glyphs[3], 3, word.glyphs.length, offset(3), word.totalPoints, neighbor, { ...base, beat })
    expect(Math.max(...neighbor.gap)).toBeGreaterThan(0.8)
    expect(Math.max(...featured.gap)).toBe(0)
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

  it('blanks all former lettering and redraws it progressively before returning exactly home', () => {
    const visible: number[] = []
    for (const progress of [0.78, 0.82, 0.87, 0.92, 0.98]) {
      const buffer = points(0)
      applyXyScopeBeamChoreography(word.glyphs[0], 0, word.glyphs.length, 0, word.totalPoints, buffer, { ...base, beat: progress * 12 })
      visible.push(Array.from(buffer.gap).filter(gap => gap < 0.8).length)
      if (progress === 0.78) expect(visible.at(-1)).toBe(0)
      if (progress === 0.98) expect(buffer.x).toEqual(points(0).x)
    }
    expect(visible).toEqual([...visible].sort((a, b) => a - b))
    expect(visible.at(-1)).toBe(word.glyphs[0].count)
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
