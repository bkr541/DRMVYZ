import type * as opentype from 'opentype.js'

export type OpenTypeTextAlignment = 'left' | 'center' | 'right'

export interface OpenTypeTextLayoutOptions {
  letterSpacing?: number
  lineHeight?: number
  alignment?: OpenTypeTextAlignment
}

export interface OpenTypeTextLayoutGlyph {
  character: string
  characterIndex: number
  glyphIndex: number
  lineIndex: number
  glyph: opentype.Glyph
  x: number
  y: number
  advanceWidth: number
  kerningToNext: number
}

export interface OpenTypeTextLayoutLine {
  lineIndex: number
  text: string
  width: number
  xOffset: number
  yOffset: number
}

export interface OpenTypeTextLayoutResult {
  glyphs: readonly OpenTypeTextLayoutGlyph[]
  lines: readonly OpenTypeTextLayoutLine[]
  maxLineWidth: number
  lineStep: number
}

interface MutableGlyph extends Omit<OpenTypeTextLayoutGlyph, 'x' | 'y'> {
  cursorX: number
}

interface MutableLine {
  text: string
  width: number
  glyphs: MutableGlyph[]
}

/**
 * Shared OpenType layout semantics used by existing vector text and Cinema solid text.
 * Empty/whitespace-only lines are ignored to preserve the established renderer behavior.
 */
export function layoutOpenTypeText(
  font: opentype.Font,
  text: string,
  fontSize: number,
  options: OpenTypeTextLayoutOptions = {},
): OpenTypeTextLayoutResult {
  if (!Number.isFinite(fontSize) || fontSize <= 0) throw new Error('OpenType text font size must be a positive finite number')

  const letterSpacing = options.letterSpacing ?? 0
  const lineHeight = options.lineHeight ?? 1.2
  const alignment = options.alignment ?? 'center'
  const rawLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  if (rawLines.length === 0) return { glyphs: [], lines: [], maxLineWidth: 0, lineStep: 0 }

  const scaleUnitsPerEm = font.unitsPerEm || 1000
  const scale = fontSize / scaleUnitsPerEm
  let characterIndexOffset = 0
  const mutableLines: MutableLine[] = []

  for (const lineText of rawLines) {
    const characters = Array.from(lineText)
    let cursorX = 0
    const glyphs: MutableGlyph[] = []
    for (let index = 0; index < characters.length; index += 1) {
      const character = characters[index]
      const glyph = font.charToGlyph(character)
      const nextGlyph = index + 1 < characters.length ? font.charToGlyph(characters[index + 1]) : null
      const kerningToNext = nextGlyph ? font.getKerningValue(glyph, nextGlyph) * scale : 0
      const glyphAdvance = (glyph.advanceWidth ?? 0) * scale
      glyphs.push({
        character,
        characterIndex: characterIndexOffset + index,
        glyphIndex: glyph.index,
        lineIndex: mutableLines.length,
        glyph,
        cursorX,
        advanceWidth: glyphAdvance,
        kerningToNext,
      })
      cursorX += glyphAdvance + kerningToNext + letterSpacing
    }
    mutableLines.push({ text: lineText, width: cursorX, glyphs })
    characterIndexOffset += characters.length
  }

  const maxLineWidth = Math.max(...mutableLines.map(line => line.width))
  const ascender = typeof font.ascender === 'number' ? font.ascender : (font.unitsPerEm ?? 1000)
  const lineStep = (ascender / scaleUnitsPerEm) * fontSize * lineHeight
  const lines: OpenTypeTextLayoutLine[] = []
  const glyphs: OpenTypeTextLayoutGlyph[] = []

  for (let lineIndex = 0; lineIndex < mutableLines.length; lineIndex += 1) {
    const line = mutableLines[lineIndex]
    const xOffset = alignment === 'left'
      ? 0
      : alignment === 'right'
        ? maxLineWidth - line.width
        : (maxLineWidth - line.width) / 2
    const yOffset = lineIndex * lineStep
    lines.push({ lineIndex, text: line.text, width: line.width, xOffset, yOffset })
    for (const glyph of line.glyphs) {
      glyphs.push({
        character: glyph.character,
        characterIndex: glyph.characterIndex,
        glyphIndex: glyph.glyphIndex,
        lineIndex,
        glyph: glyph.glyph,
        x: glyph.cursorX + xOffset,
        y: yOffset,
        advanceWidth: glyph.advanceWidth,
        kerningToNext: glyph.kerningToNext,
      })
    }
  }

  return { glyphs, lines, maxLineWidth, lineStep }
}
