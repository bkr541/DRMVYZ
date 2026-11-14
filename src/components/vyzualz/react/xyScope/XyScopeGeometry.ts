// Sound Drawing XY: text outlines -> beam geometry. Pure and deterministic: no DOM, no audio, no randomness.
//
// A letter is an element made of closed contours. Each contour is flattened from the font's path commands,
// filtered for specks, then resampled by arc length with sharp corners kept as mandatory points so a heavy
// display font keeps its edges. Every point carries a normal (for vibration) and a glyph-level arc fraction
// `s` (for the unspool order of a dissolve and for the standing-wave phase).

import type * as opentype from 'opentype.js'
import defaultFontData from './XyScopeDefaultFont.generated.json'

export type XyScopePathCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' }

export interface XyScopeFontGlyph {
  /** Advance width in outline units (1000 per em). */
  advance: number
  commands: readonly XyScopePathCommand[]
}

export interface XyScopeFontSource {
  id: string
  unitsPerEm: number
  /** Height of a capital H in outline units. */
  capHeight: number
  getGlyph(character: string): XyScopeFontGlyph | null
}

export const XY_SCOPE_OUTLINE_UNITS = 1000
const QUAD_STEPS = 8
const CUBIC_STEPS = 12
/** A turn sharper than this keeps its vertex as a mandatory point. cos(38°). */
const CORNER_COS = 0.78
const DEFAULT_POINT_BUDGET = 3200
const MAX_TOTAL_POINTS = 12000
const MIN_SPACING_PX = 2.2

// ── Font sources ──────────────────────────────────────────────────────────────

interface DefaultFontGlyphRecord { adv: number; ops: string; pts: number[] }
interface DefaultFontFile { unitsPerEm: number; capHeight: number; glyphs: Record<string, DefaultFontGlyphRecord> }

function commandsFromRecord(record: DefaultFontGlyphRecord): XyScopePathCommand[] {
  const commands: XyScopePathCommand[] = []
  let cursor = 0
  for (const op of record.ops) {
    const p = record.pts
    if (op === 'M' || op === 'L') { commands.push({ type: op, x: p[cursor], y: p[cursor + 1] }); cursor += 2 }
    else if (op === 'Q') { commands.push({ type: 'Q', x1: p[cursor], y1: p[cursor + 1], x: p[cursor + 2], y: p[cursor + 3] }); cursor += 4 }
    else if (op === 'C') { commands.push({ type: 'C', x1: p[cursor], y1: p[cursor + 1], x2: p[cursor + 2], y2: p[cursor + 3], x: p[cursor + 4], y: p[cursor + 5] }); cursor += 6 }
    else if (op === 'Z') commands.push({ type: 'Z' })
  }
  return commands
}

let defaultSource: XyScopeFontSource | null = null

/** The bundled default font (Anton Regular, OFL-1.1), baked to outline commands. */
export function getDefaultXyScopeFont(): XyScopeFontSource {
  if (defaultSource) return defaultSource
  const file = defaultFontData as unknown as DefaultFontFile
  const cache = new Map<string, XyScopeFontGlyph | null>()
  defaultSource = {
    id: 'default',
    unitsPerEm: file.unitsPerEm,
    capHeight: file.capHeight,
    getGlyph(character) {
      if (cache.has(character)) return cache.get(character) ?? null
      const record = file.glyphs[character]
      const glyph = record ? { advance: record.adv, commands: commandsFromRecord(record) } : null
      cache.set(character, glyph)
      return glyph
    },
  }
  return defaultSource
}

/** Adapts a parsed font-library font (opentype.js) to the same outline interface. */
export function createOpenTypeXyScopeFont(font: opentype.Font, id: string): XyScopeFontSource {
  const cache = new Map<string, XyScopeFontGlyph | null>()
  const capGlyph = font.charToGlyph('H')
  const capBox = capGlyph && capGlyph.index !== 0 ? capGlyph.getPath(0, 0, XY_SCOPE_OUTLINE_UNITS).getBoundingBox() : null
  return {
    id,
    unitsPerEm: XY_SCOPE_OUTLINE_UNITS,
    capHeight: capBox ? Math.max(1, capBox.y2 - capBox.y1) : XY_SCOPE_OUTLINE_UNITS * 0.7,
    getGlyph(character) {
      if (cache.has(character)) return cache.get(character) ?? null
      const glyph = font.charToGlyph(character)
      let result: XyScopeFontGlyph | null = null
      if (glyph && (glyph.index !== 0 || character === ' ')) {
        result = {
          advance: (glyph.advanceWidth ?? 0) * XY_SCOPE_OUTLINE_UNITS / font.unitsPerEm,
          commands: glyph.getPath(0, 0, XY_SCOPE_OUTLINE_UNITS).commands as unknown as XyScopePathCommand[],
        }
      }
      cache.set(character, result)
      return result
    },
  }
}

// ── Flattening ────────────────────────────────────────────────────────────────

/** Flattens path commands into closed contours of [x0, y0, x1, y1, ...]. Contours under three points are dropped. */
export function flattenXyScopePath(commands: readonly XyScopePathCommand[]): number[][] {
  const contours: number[][] = []
  let current: number[] | null = null
  let cx = 0
  let cy = 0
  const finish = () => {
    if (current && current.length >= 6) {
      const n = current.length
      // A contour that repeats its first point at the end is already closed.
      if (Math.abs(current[0] - current[n - 2]) < 0.5 && Math.abs(current[1] - current[n - 1]) < 0.5) current.length = n - 2
      if (current.length >= 6) contours.push(current)
    }
    current = null
  }
  for (const command of commands) {
    if (command.type === 'M') { finish(); current = [command.x, command.y]; cx = command.x; cy = command.y }
    else if (!current) continue
    else if (command.type === 'L') { current.push(command.x, command.y); cx = command.x; cy = command.y }
    else if (command.type === 'Q') {
      for (let i = 1; i <= QUAD_STEPS; i += 1) {
        const t = i / QUAD_STEPS
        const u = 1 - t
        current.push(u * u * cx + 2 * u * t * command.x1 + t * t * command.x, u * u * cy + 2 * u * t * command.y1 + t * t * command.y)
      }
      cx = command.x; cy = command.y
    } else if (command.type === 'C') {
      for (let i = 1; i <= CUBIC_STEPS; i += 1) {
        const t = i / CUBIC_STEPS
        const u = 1 - t
        current.push(
          u * u * u * cx + 3 * u * u * t * command.x1 + 3 * u * t * t * command.x2 + t * t * t * command.x,
          u * u * u * cy + 3 * u * u * t * command.y1 + 3 * u * t * t * command.y2 + t * t * t * command.y,
        )
      }
      cx = command.x; cy = command.y
    } else if (command.type === 'Z') finish()
  }
  finish()
  return contours
}

export function contourPerimeter(contour: readonly number[]): number {
  const n = contour.length / 2
  let length = 0
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    length += Math.hypot(contour[2 * j] - contour[2 * i], contour[2 * j + 1] - contour[2 * i + 1])
  }
  return length
}

/**
 * Resamples a closed contour at roughly `spacing` units, keeping every sharp corner as a point.
 * Returns [x, y] pairs in order, without repeating the first point.
 */
export function resampleXyScopeContour(contour: readonly number[], spacing: number): Array<[number, number]> {
  const n = contour.length / 2
  if (n < 3 || spacing <= 0) return []
  const isCorner = (i: number) => {
    const a = (i + n - 1) % n
    const b = (i + 1) % n
    const ax = contour[2 * i] - contour[2 * a]
    const ay = contour[2 * i + 1] - contour[2 * a + 1]
    const bx = contour[2 * b] - contour[2 * i]
    const by = contour[2 * b + 1] - contour[2 * i + 1]
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) return false
    return (ax * bx + ay * by) / (la * lb) < CORNER_COS
  }
  const corners: number[] = []
  for (let i = 0; i < n; i += 1) if (isCorner(i)) corners.push(i)
  const starts = corners.length > 0 ? corners : [0]
  const out: Array<[number, number]> = []
  for (let s = 0; s < starts.length; s += 1) {
    const from = starts[s]
    const to = starts[(s + 1) % starts.length]
    const run: Array<[number, number]> = [[contour[2 * from], contour[2 * from + 1]]]
    let i = from
    do {
      i = (i + 1) % n
      run.push([contour[2 * i], contour[2 * i + 1]])
    } while (i !== to && run.length <= n + 1)
    const cumulative = [0]
    for (let k = 1; k < run.length; k += 1) cumulative.push(cumulative[k - 1] + Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]))
    const length = cumulative[cumulative.length - 1]
    const segments = Math.max(1, Math.round(length / spacing))
    let cursor = 1
    for (let q = 0; q < segments; q += 1) {
      const target = length * q / segments
      while (cursor < cumulative.length - 1 && cumulative[cursor] < target) cursor += 1
      const a = run[cursor - 1]
      const b = run[cursor]
      const span = cumulative[cursor] - cumulative[cursor - 1] || 1
      const u = (target - cumulative[cursor - 1]) / span
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
    }
  }
  return out
}

// ── Layout ────────────────────────────────────────────────────────────────────

export interface XyScopeGlyphGeometry {
  /** Omitted for font contours, which are closed. SVG strokes may be open. */
  closed?: readonly boolean[]
  drawMode?: 'outline' | 'segments' | 'points'
  character: string
  /** Letter centre, in px from the stage centre (x) — letters share one baseline so y is 0. */
  centerX: number
  /** Cap height in px: the size of this letter's dissolve cloud. */
  heightPx: number
  count: number
  /** Index of the first point of each contour, plus the total as the last entry. */
  starts: readonly number[]
  /** Point positions in px from the letter centre. */
  x: Float32Array
  y: Float32Array
  /** Unit normals. */
  nx: Float32Array
  ny: Float32Array
  /** Arc fraction 0..1 across the whole letter, in contour order. */
  s: Float32Array
}

export interface XyScopeLayout {
  glyphs: readonly XyScopeGlyphGeometry[]
  totalPoints: number
  /** Px per outline unit. */
  scale: number
}

export interface XyScopeLayoutInput {
  text: string
  font: XyScopeFontSource
  width: number
  height: number
  /** Share of the stage the word may fill (0.3–1). */
  size: number
  /** Extra space between letters, in ems. */
  letterSpacing: number
  /** Contours with a perimeter under this share of the cap height are dropped. */
  minPieceSize: number
  pointBudget?: number
}

export const EMPTY_XY_SCOPE_LAYOUT: XyScopeLayout = Object.freeze({ glyphs: Object.freeze([]), totalPoints: 0, scale: 1 })

export function buildXyScopeLayout(input: XyScopeLayoutInput): XyScopeLayout {
  const { font, width, height } = input
  if (!(width > 0) || !(height > 0)) return EMPTY_XY_SCOPE_LAYOUT
  const characters = [...input.text.toUpperCase()]
  const entries: Array<{ character: string; advance: number; contours: number[][] }> = []
  const minPerimeter = Math.max(0, input.minPieceSize) * font.capHeight
  for (const character of characters) {
    const glyph = font.getGlyph(character)
    if (!glyph) continue
    const contours = flattenXyScopePath(glyph.commands).filter(contour => contourPerimeter(contour) >= minPerimeter)
    entries.push({ character, advance: glyph.advance, contours })
  }
  if (!entries.some(entry => entry.contours.length > 0)) return EMPTY_XY_SCOPE_LAYOUT

  const track = input.letterSpacing * font.unitsPerEm
  const totalAdvance = entries.reduce((sum, entry) => sum + entry.advance, 0) + track * (entries.length - 1)
  const size = Math.min(1, Math.max(0.1, input.size))
  const scale = Math.min(width * size / totalAdvance, height * size * 0.55 / font.capHeight)

  const perimeterPx = entries.reduce((sum, entry) => sum + entry.contours.reduce((inner, contour) => inner + contourPerimeter(contour) * scale, 0), 0)
  const budget = input.pointBudget ?? DEFAULT_POINT_BUDGET
  let spacingPx = Math.max(MIN_SPACING_PX, perimeterPx / budget)

  const build = (spacing: number): XyScopeLayout => {
    const glyphs: XyScopeGlyphGeometry[] = []
    let total = 0
    let cursor = -totalAdvance * scale / 2
    for (const entry of entries) {
      const advancePx = entry.advance * scale
      const centerX = cursor + advancePx / 2
      cursor += advancePx + track * scale
      if (entry.contours.length === 0) continue
      const contours = entry.contours.map(contour => {
        const points = resampleXyScopeContour(contour, spacing / scale)
          .map(([px, py]) => [px * scale - advancePx / 2, (py + font.capHeight / 2) * scale] as [number, number])
        let length = 0
        for (let i = 0; i < points.length; i += 1) {
          const j = (i + 1) % points.length
          length += Math.hypot(points[j][0] - points[i][0], points[j][1] - points[i][1])
        }
        return { points, length }
      }).filter(contour => contour.points.length >= 3)
      const perimeter = contours.reduce((sum, contour) => sum + contour.length, 0)
      const count = contours.reduce((sum, contour) => sum + contour.points.length, 0)
      if (count === 0 || perimeter <= 0) continue
      const x = new Float32Array(count)
      const y = new Float32Array(count)
      const nx = new Float32Array(count)
      const ny = new Float32Array(count)
      const s = new Float32Array(count)
      const starts: number[] = []
      let write = 0
      let run = 0
      for (const contour of contours) {
        starts.push(write)
        const n = contour.points.length
        let travelled = 0
        for (let i = 0; i < n; i += 1) {
          const before = contour.points[(i + n - 1) % n]
          const here = contour.points[i]
          const after = contour.points[(i + 1) % n]
          let tx = after[0] - before[0]
          let ty = after[1] - before[1]
          const tl = Math.hypot(tx, ty) || 1
          tx /= tl; ty /= tl
          x[write] = here[0]; y[write] = here[1]
          nx[write] = -ty; ny[write] = tx
          s[write] = (run + travelled) / perimeter
          travelled += Math.hypot(after[0] - here[0], after[1] - here[1])
          write += 1
        }
        run += contour.length
      }
      starts.push(count)
      glyphs.push({ character: entry.character, centerX, heightPx: font.capHeight * scale, count, starts, x, y, nx, ny, s })
      total += count
    }
    return { glyphs, totalPoints: total, scale }
  }

  let layout = build(spacingPx)
  // Ornate fonts add a point per corner no matter the spacing, so thin the rest until the word fits the cap.
  for (let attempt = 0; attempt < 4 && layout.totalPoints > MAX_TOTAL_POINTS; attempt += 1) {
    spacingPx *= 1.6
    layout = build(spacingPx)
  }
  return layout
}
