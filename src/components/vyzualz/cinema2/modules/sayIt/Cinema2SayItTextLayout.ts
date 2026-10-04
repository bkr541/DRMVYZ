import metricsJson from './Cinema2SayItGlyphMetrics.generated.json'

export const CINEMA2_SAY_IT_DEFAULT_TEXT = 'SAY IT'
export const CINEMA2_SAY_IT_MAX_LINES = 2
export const CINEMA2_SAY_IT_MAX_CHARACTERS = 20
export const CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE = 12
export const CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH = 5.4
export const CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT = 3.45

export type Cinema2SayItAlignment = 'left' | 'center' | 'right'
export type Cinema2SayItLineMode = 'one' | 'two'

export interface Cinema2SayItLayoutOptions {
  alignment: Cinema2SayItAlignment
  lineMode: Cinema2SayItLineMode
  tracking: number
  lineSpacing: number
  glyphScale: number
}

export interface Cinema2SayItLayoutGlyph {
  id: string
  character: string
  codePoint: number
  mesh: string
  lineIndex: number
  characterIndex: number
  position: readonly [number, number, number]
  scale: number
}

export interface Cinema2SayItTextLayout {
  text: string
  lines: readonly string[]
  glyphs: readonly Readonly<Cinema2SayItLayoutGlyph>[]
  width: number
  height: number
  truncated: boolean
  replacementCount: number
}

interface GlyphMetric {
  mesh: string | null
  advance: number
  centerX: number
  centerY: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const metrics = metricsJson as {
  version: number
  repertoire: { firstCodePoint: number; lastCodePoint: number; fallbackCodePoint: number }
  font: { family: string; lineAdvance: number }
  glyphs: Record<string, GlyphMetric>
  kerning: Record<string, number>
}

export const CINEMA2_SAY_IT_GLYPH_METRICS_VERSION = metrics.version
export const CINEMA2_SAY_IT_FONT_FAMILY = metrics.font.family

export function resolveCinema2SayItTextLayout(
  input: unknown,
  options: Readonly<Cinema2SayItLayoutOptions>,
): Readonly<Cinema2SayItTextLayout> {
  const sanitized = sanitizeCinema2SayItText(input, options.lineMode === 'one' ? 1 : 2)
  const scale = clamp(options.glyphScale, 0.35, 1.5)
  const tracking = clamp(options.tracking, -0.15, 0.5) * scale
  const lineStep = metrics.font.lineAdvance * clamp(options.lineSpacing, 0.55, 1.2) * scale
  const lineLayouts = sanitized.lines.map((line, lineIndex) => layoutLine(line, lineIndex, tracking, scale))
  const maxWidth = Math.max(0, ...lineLayouts.map(line => line.width))
  const rawGlyphs: Array<Cinema2SayItLayoutGlyph & { bounds: readonly [number, number, number, number] }> = []

  for (const line of lineLayouts) {
    const offset = options.alignment === 'left'
      ? 0
      : options.alignment === 'right'
        ? maxWidth - line.width
        : (maxWidth - line.width) / 2
    const baselineY = -line.lineIndex * lineStep
    for (const placement of line.placements) {
      const metric = placement.metric
      if (!metric.mesh) continue
      const x = offset + placement.penX + metric.centerX * scale
      const y = baselineY + metric.centerY * scale
      rawGlyphs.push({
        id: `glyph-${placement.characterIndex}`,
        character: placement.character,
        codePoint: placement.codePoint,
        mesh: metric.mesh,
        lineIndex: line.lineIndex,
        characterIndex: placement.characterIndex,
        position: [x, y, 0],
        scale,
        bounds: [
          offset + placement.penX + metric.minX * scale,
          baselineY + metric.minY * scale,
          offset + placement.penX + metric.maxX * scale,
          baselineY + metric.maxY * scale,
        ],
      })
    }
  }

  const minX = Math.min(...rawGlyphs.map(glyph => glyph.bounds[0]))
  const minY = Math.min(...rawGlyphs.map(glyph => glyph.bounds[1]))
  const maxX = Math.max(...rawGlyphs.map(glyph => glyph.bounds[2]))
  const maxY = Math.max(...rawGlyphs.map(glyph => glyph.bounds[3]))
  const centerX = Number.isFinite(minX) ? (minX + maxX) / 2 : 0
  const centerY = Number.isFinite(minY) ? (minY + maxY) / 2 : 0
  const rawWidth = Number.isFinite(minX) ? maxX - minX : 0
  const rawHeight = Number.isFinite(minY) ? maxY - minY : 0
  const fit = Math.min(
    1,
    rawWidth > 0 ? CINEMA2_SAY_IT_MAX_ASSEMBLED_WIDTH / rawWidth : 1,
    rawHeight > 0 ? CINEMA2_SAY_IT_MAX_ASSEMBLED_HEIGHT / rawHeight : 1,
  )
  const glyphs = rawGlyphs.map(({ bounds: _bounds, ...glyph }) => Object.freeze({
    ...glyph,
    position: Object.freeze([(glyph.position[0] - centerX) * fit, (glyph.position[1] - centerY) * fit, 0] as const),
    scale: glyph.scale * fit,
  }))

  return Object.freeze({
    text: sanitized.lines.join('\n'),
    lines: Object.freeze([...sanitized.lines]),
    glyphs: Object.freeze(glyphs),
    width: rawWidth * fit,
    height: rawHeight * fit,
    truncated: sanitized.truncated,
    replacementCount: sanitized.replacementCount,
  })
}

export function sanitizeCinema2SayItText(input: unknown, maximumLines: 1 | 2 = 2): Readonly<{
  lines: readonly string[]
  truncated: boolean
  replacementCount: number
}> {
  const source = typeof input === 'string' && input.trim().length > 0 ? input : CINEMA2_SAY_IT_DEFAULT_TEXT
  const normalized = source.replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
  const lines: string[][] = [[]]
  const characterLimit = Math.min(CINEMA2_SAY_IT_MAX_CHARACTERS, CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE * maximumLines)
  let count = 0
  let truncated = false
  let replacementCount = 0

  const nextLine = () => {
    if (lines.length >= maximumLines) { truncated = true; return false }
    lines.push([])
    return true
  }

  for (const rawCharacter of Array.from(normalized)) {
    if (rawCharacter === '\n') {
      if (lines[lines.length - 1]!.length > 0) nextLine()
      continue
    }
    if (count >= characterLimit) { truncated = true; break }
    if (lines[lines.length - 1]!.length >= CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE && !nextLine()) break
    const rawCodePoint = rawCharacter.codePointAt(0) ?? metrics.repertoire.fallbackCodePoint
    const supported = rawCodePoint >= metrics.repertoire.firstCodePoint && rawCodePoint <= metrics.repertoire.lastCodePoint
    const codePoint = supported ? rawCodePoint : metrics.repertoire.fallbackCodePoint
    if (!supported) replacementCount += 1
    lines[lines.length - 1]!.push(String.fromCodePoint(codePoint))
    count += 1
  }

  const cleaned = lines
    .map(line => line.join('').replace(/^ +| +$/g, ''))
    .filter(line => line.length > 0)
  if (cleaned.length === 0) return Object.freeze({ lines: Object.freeze([CINEMA2_SAY_IT_DEFAULT_TEXT]), truncated, replacementCount })
  return Object.freeze({ lines: Object.freeze(cleaned), truncated, replacementCount })
}

function layoutLine(line: string, lineIndex: number, tracking: number, scale: number) {
  const characters = Array.from(line)
  const placements: Array<{
    character: string
    codePoint: number
    characterIndex: number
    penX: number
    metric: GlyphMetric
  }> = []
  let penX = 0
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!
    const codePoint = character.codePointAt(0) ?? metrics.repertoire.fallbackCodePoint
    const metric = glyphMetric(codePoint)
    placements.push({ character, codePoint, characterIndex: lineIndex * CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE + index, penX, metric })
    penX += metric.advance * scale
    if (index + 1 < characters.length) {
      const next = characters[index + 1]!.codePointAt(0) ?? metrics.repertoire.fallbackCodePoint
      penX += (metrics.kerning[`${codePoint}:${next}`] ?? 0) * scale + tracking
    }
  }
  return { lineIndex, width: penX, placements }
}

function glyphMetric(codePoint: number): GlyphMetric {
  return metrics.glyphs[String(codePoint)] ?? metrics.glyphs[String(metrics.repertoire.fallbackCodePoint)]!
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}
