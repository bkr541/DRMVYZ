import { describe, expect, it } from 'vitest'
import metrics from '../modules/sayIt/Cinema2SayItGlyphMetrics.generated.json'
import { cinema2SayItIsExactlyAssembled, resolveCinema2SayItGlyphPoses } from '../modules/sayIt/Cinema2SayItMotion'
import {
  CINEMA2_SAY_IT_DEFAULT_TEXT,
  CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT,
  CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH,
  CINEMA2_SAY_IT_MAX_CHARACTERS,
  CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE,
  resolveCinema2SayItTextLayout,
  sanitizeCinema2SayItText,
} from '../modules/sayIt/Cinema2SayItTextLayout'

const OPTIONS = Object.freeze({ alignment: 'center' as const, lineMode: 'two' as const, tracking: 0.06, lineSpacing: 0.7, glyphScale: 1 })

describe('Cinema 2.0 SAY IT production text layout', () => {
  it('ships metrics for all 95 printable Basic Latin characters', () => {
    expect(metrics.version).toBe(1)
    expect(metrics.repertoire).toEqual({ firstCodePoint: 32, lastCodePoint: 126, fallbackCodePoint: 63 })
    expect(Object.keys(metrics.glyphs)).toHaveLength(95)
    for (let codePoint = 32; codePoint <= 126; codePoint += 1) {
      const metric = metrics.glyphs[String(codePoint) as keyof typeof metrics.glyphs]
      expect(metric, `U+${codePoint.toString(16)}`).toBeDefined()
      expect(metric.advance).toBeGreaterThan(0)
      if (codePoint === 32) expect(metric.mesh).toBeNull()
      else expect(metric.mesh).toBe(`glyph-u${codePoint.toString(16).padStart(4, '0').toUpperCase()}`)
    }
  })

  it('supports explicit and automatic two-line wrapping with hard bounds', () => {
    const explicit = sanitizeCinema2SayItText('HELLO\nWORLD')
    expect(explicit.lines).toEqual(['HELLO', 'WORLD'])
    expect(explicit.truncated).toBe(false)

    const automatic = sanitizeCinema2SayItText('ABCDEFGHIJKLMNOPQRSTUVWX')
    expect(automatic.lines).toHaveLength(2)
    expect(automatic.lines[0]).toHaveLength(CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE)
    expect(automatic.lines.join('')).toHaveLength(CINEMA2_SAY_IT_MAX_CHARACTERS)
    expect(automatic.truncated).toBe(true)
    expect(sanitizeCinema2SayItText('FIRST\nSECOND', 1)).toEqual(expect.objectContaining({ lines: ['FIRSTSECOND'], truncated: true }))
  })

  it('uses SAY IT for empty input and replaces unsupported Unicode explicitly', () => {
    expect(sanitizeCinema2SayItText('   ').lines).toEqual([CINEMA2_SAY_IT_DEFAULT_TEXT])
    const unsupported = sanitizeCinema2SayItText('CAFÉ 🚀')
    expect(unsupported.lines).toEqual(['CAF? ?'])
    expect(unsupported.replacementCount).toBe(2)
  })

  it('instances repeated glyph geometry independently and fits the assembled block', () => {
    const layout = resolveCinema2SayItTextLayout('AAAAAAAAAAAA\n99999999', { ...OPTIONS, glyphScale: 1.5 })
    expect(layout.glyphs).toHaveLength(20)
    expect(new Set(layout.glyphs.map(glyph => glyph.id)).size).toBe(20)
    expect(new Set(layout.glyphs.slice(0, 12).map(glyph => glyph.mesh))).toEqual(new Set(['glyph-u0041']))
    expect(layout.width).toBeLessThanOrEqual(CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH + 1e-9)
    expect(layout.height).toBeLessThanOrEqual(CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT + 1e-9)
  })

  it('feeds exact assembled positions into the generalized motion system', () => {
    const layout = resolveCinema2SayItTextLayout('FLIP\n360!', OPTIONS)
    const assembled = resolveCinema2SayItGlyphPoses(0, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
    const moving = resolveCinema2SayItGlyphPoses(4, { cycleSeconds: 8, motionAmount: 1, spread: 1 }, layout.glyphs)
    expect(cinema2SayItIsExactlyAssembled(assembled, layout.glyphs)).toBe(true)
    expect(cinema2SayItIsExactlyAssembled(moving, layout.glyphs)).toBe(false)
    expect(moving.every(pose => pose.rotation.some(value => Math.abs(value) >= Math.PI * 2))).toBe(true)
  })
})
