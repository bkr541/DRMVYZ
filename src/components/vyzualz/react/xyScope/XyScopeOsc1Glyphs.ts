import { flattenXyScopePath, type XyScopeFontSource } from './XyScopeGeometry'
import type { Osc1Glyph } from './XyScopeOsc1Engine'

const FALLBACK_ADVANCE = .35

/**
 * Adapts any Sound Drawing font to the Text Lab's glyph space (the same normalisation its Anton converter used):
 * cap height = 1, y down with the baseline at 1, and each glyph centred on x = .5 with its advance in cap heights.
 * Contours are closed by repeating their first point, as the Text Lab's polylines are.
 */
export function createOsc1GlyphSource(font: XyScopeFontSource): (char: string) => Osc1Glyph | null {
  const cache = new Map<string, Osc1Glyph | null>()
  const cap = Math.max(1, font.capHeight)
  return char => {
    if (cache.has(char)) return cache.get(char) ?? null
    const source = font.getGlyph(char)
    let glyph: Osc1Glyph | null = null
    if (source) {
      const paths = flattenXyScopePath(source.commands).map(contour => {
        const path: number[][] = []
        for (let i = 0; i < contour.length; i += 2) path.push([.5 + (contour[i] - source.advance / 2) / cap, 1 + contour[i + 1] / cap])
        path.push([path[0][0], path[0][1]])
        return path
      }).filter(path => path.length > 2)
      glyph = { paths, advance: source.advance > 0 ? source.advance / cap : FALLBACK_ADVANCE }
    }
    cache.set(char, glyph)
    return glyph
  }
}
