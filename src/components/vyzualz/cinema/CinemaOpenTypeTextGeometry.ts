import type * as opentype from 'opentype.js'

import { layoutOpenTypeText, type OpenTypeTextAlignment } from '../shared/OpenTypeTextLayout'
import {
  extrudeCinemaVectorShape,
  normalizeCinemaVectorShape,
  type CinemaBounds2D,
  type CinemaNormalizedVectorShape,
  type CinemaVectorCpuMesh,
  type CinemaVectorPoint,
  type CinemaVectorRegionInput,
  type CinemaVectorShapeInput,
} from './CinemaVectorGeometry'

export const CINEMA_OPENTYPE_TEXT_COMPILER_VERSION = 1
export const CINEMA_OPENTYPE_TEXT_INTERNAL_FONT_SIZE = 160

const DEFAULT_CURVE_TOLERANCE = 0.35
const DEFAULT_MAX_CURVE_DEPTH = 12
const DEFAULT_CACHE_ENTRIES = 32
const POINT_EPSILON = 1e-8

export const CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS = Object.freeze({
  maxCharacters: 256,
  maxComponents: 256,
  maxRegions: 1024,
  maxRings: 2048,
  maxPointsPerRing: 2048,
  maxInputPoints: 32_768,
  maxOutputVertices: 131_072,
  maxOutputIndices: 393_216,
})

export interface CinemaOpenTypeTextTessellation {
  curveTolerance?: number
  maxCurveDepth?: number
}

export interface CinemaOpenTypeTextRequest {
  font: opentype.Font
  fontIdentity: string
  fontRevision?: string | number
  text: string
  letterSpacing?: number
  lineHeight?: number
  alignment?: OpenTypeTextAlignment
  tessellation?: CinemaOpenTypeTextTessellation
}

export interface CinemaOpenTypeGlyphMetadata {
  id: string
  character: string
  characterIndex: number
  glyphIndex: number
  lineIndex: number
  componentId: string | null
  localBounds: CinemaBounds2D | null
  localOrigin: CinemaVectorPoint
  advanceWidth: number
}

export interface CinemaOpenTypeTextCompilation {
  cacheKey: string
  compilerVersion: number
  shape: CinemaNormalizedVectorShape | null
  mesh: CinemaVectorCpuMesh | null
  glyphs: readonly CinemaOpenTypeGlyphMetadata[]
  localBounds: CinemaBounds2D | null
}

export type CinemaOpenTypeTextErrorCode =
  | 'invalid-font-identity'
  | 'invalid-layout'
  | 'invalid-tessellation'
  | 'invalid-glyph-topology'
  | 'too-complex'
  | 'vector-geometry-failed'

export interface CinemaOpenTypeTextError {
  code: CinemaOpenTypeTextErrorCode
  message: string
  characterIndex?: number
  glyphIndex?: number
}

export type CinemaOpenTypeTextResult =
  | { ok: true; value: CinemaOpenTypeTextCompilation }
  | { ok: false; error: CinemaOpenTypeTextError }

interface FlattenedContour {
  sourceIndex: number
  points: CinemaVectorPoint[]
  bounds: CinemaBounds2D
  absoluteArea: number
  parentIndex: number | null
  depth: number
}

interface PendingGlyph {
  id: string
  character: string
  characterIndex: number
  glyphIndex: number
  lineIndex: number
  componentId: string | null
  sourceBounds: CinemaBounds2D | null
  sourceOrigin: CinemaVectorPoint
  advanceWidth: number
}

type OpenTypePathCommand =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'Q'; x: number; y: number; x1: number; y1: number }
  | { type: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'Z' }

export function createCinemaOpenTypeTextMeshKey(request: CinemaOpenTypeTextRequest): string {
  const identity = request.fontIdentity.trim()
  if (!identity) throw new Error('Cinema OpenType text requires a non-empty font identity')
  validateTextComplexity(request.text)
  const tessellation = resolveTessellation(request.tessellation)
  const letterSpacing = request.letterSpacing ?? 0
  const lineHeight = request.lineHeight ?? 1.2
  const alignment = request.alignment ?? 'center'
  validateLayoutInputs(letterSpacing, lineHeight, alignment)
  return JSON.stringify([
    'cinema-opentype-text',
    CINEMA_OPENTYPE_TEXT_COMPILER_VERSION,
    identity,
    request.fontRevision ?? null,
    request.text,
    canonicalNumber(letterSpacing),
    canonicalNumber(lineHeight),
    alignment,
    canonicalNumber(tessellation.curveTolerance),
    tessellation.maxCurveDepth,
  ])
}

export function compileCinemaOpenTypeText(request: CinemaOpenTypeTextRequest): CinemaOpenTypeTextResult {
  const fontIdentity = request.fontIdentity.trim()
  if (!fontIdentity) return failure('invalid-font-identity', 'Cinema OpenType text requires a non-empty font identity')
  try {
    validateTextComplexity(request.text)
  } catch (error) {
    return failure('too-complex', errorMessage(error))
  }

  let tessellation: Required<CinemaOpenTypeTextTessellation>
  try {
    tessellation = resolveTessellation(request.tessellation)
  } catch (error) {
    return failure('invalid-tessellation', errorMessage(error))
  }

  const letterSpacing = request.letterSpacing ?? 0
  const lineHeight = request.lineHeight ?? 1.2
  const alignment = request.alignment ?? 'center'
  try {
    validateLayoutInputs(letterSpacing, lineHeight, alignment)
  } catch (error) {
    return failure('invalid-layout', errorMessage(error))
  }

  const cacheKey = createCinemaOpenTypeTextMeshKey({
    ...request,
    fontIdentity,
    letterSpacing,
    lineHeight,
    alignment,
    tessellation,
  })

  let layout
  try {
    layout = layoutOpenTypeText(request.font, request.text, CINEMA_OPENTYPE_TEXT_INTERNAL_FONT_SIZE, {
      letterSpacing,
      lineHeight,
      alignment,
    })
  } catch (error) {
    return failure('invalid-layout', `Cinema could not lay out OpenType text: ${errorMessage(error)}`)
  }
  if (layout.glyphs.length > CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS.maxComponents) {
    return failure('too-complex', `Cinema 3D text exceeds the ${CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS.maxComponents}-glyph live geometry limit`)
  }

  if (layout.glyphs.length === 0) {
    return success({
      cacheKey,
      compilerVersion: CINEMA_OPENTYPE_TEXT_COMPILER_VERSION,
      shape: null,
      mesh: null,
      glyphs: Object.freeze([]),
      localBounds: null,
    })
  }

  const components: CinemaVectorShapeInput['components'][number][] = []
  const pendingGlyphs: PendingGlyph[] = []
  const allGeometryBounds: CinemaBounds2D[] = []

  for (const laidOutGlyph of layout.glyphs) {
    const glyphId = `glyph:${laidOutGlyph.characterIndex}:font:${laidOutGlyph.glyphIndex}`
    let contours: FlattenedContour[]
    try {
      const path = laidOutGlyph.glyph.getPath(
        laidOutGlyph.x,
        laidOutGlyph.y,
        CINEMA_OPENTYPE_TEXT_INTERNAL_FONT_SIZE,
      )
      contours = flattenGlyphPath(path, tessellation)
      assignContourHierarchy(contours)
    } catch (error) {
      return failure(
        'invalid-glyph-topology',
        `Cinema could not compile glyph ${laidOutGlyph.glyphIndex}: ${errorMessage(error)}`,
        laidOutGlyph.characterIndex,
        laidOutGlyph.glyphIndex,
      )
    }

    const sourceBounds = contours.length > 0 ? mergeBounds(contours.map(contour => contour.bounds)) : null
    if (sourceBounds) allGeometryBounds.push(sourceBounds)
    const regions = buildGlyphRegions(glyphId, contours)
    const componentId = regions.length > 0 ? glyphId : null
    if (componentId) components.push({ id: componentId, regions })
    pendingGlyphs.push({
      id: glyphId,
      character: laidOutGlyph.character,
      characterIndex: laidOutGlyph.characterIndex,
      glyphIndex: laidOutGlyph.glyphIndex,
      lineIndex: laidOutGlyph.lineIndex,
      componentId,
      sourceBounds,
      sourceOrigin: [laidOutGlyph.x, laidOutGlyph.y],
      advanceWidth: laidOutGlyph.advanceWidth,
    })
  }

  if (components.length === 0) {
    return success({
      cacheKey,
      compilerVersion: CINEMA_OPENTYPE_TEXT_COMPILER_VERSION,
      shape: null,
      mesh: null,
      glyphs: Object.freeze(pendingGlyphs.map(glyph => freezeGlyphMetadata({
        ...glyph,
        localBounds: null,
        localOrigin: [0, 0],
        advanceWidth: 0,
      }))),
      localBounds: null,
    })
  }

  const sourceBounds = mergeBounds(allGeometryBounds)
  let normalization: { center: CinemaVectorPoint; scale: number }
  try {
    normalization = createNormalization(sourceBounds)
  } catch (error) {
    return failure('invalid-glyph-topology', `Cinema text normalization failed: ${errorMessage(error)}`)
  }
  const transformedComponents = components.map(component => ({
    ...component,
    regions: component.regions.map(region => ({
      ...region,
      outer: { ...region.outer, points: region.outer.points.map(point => transformPoint(point, normalization)) },
      holes: region.holes?.map(hole => ({ ...hole, points: hole.points.map(point => transformPoint(point, normalization)) })),
    })),
  }))

  const shapeResult = normalizeCinemaVectorShape({
    fillRule: 'evenodd',
    components: transformedComponents,
    sourceBounds,
  }, { limits: CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS })
  if (!shapeResult.ok) {
    return failure(
      shapeResult.error.code === 'limit-exceeded' ? 'too-complex' : 'vector-geometry-failed',
      `Cinema text vector normalization failed: ${shapeResult.error.message}`,
    )
  }
  const meshResult = extrudeCinemaVectorShape(shapeResult.value, { limits: CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS })
  if (!meshResult.ok) {
    return failure(
      meshResult.error.code === 'limit-exceeded' ? 'too-complex' : 'vector-geometry-failed',
      `Cinema text extrusion failed: ${meshResult.error.message}`,
    )
  }

  const glyphs = pendingGlyphs.map(glyph => freezeGlyphMetadata({
    ...glyph,
    localBounds: glyph.sourceBounds ? transformBounds(glyph.sourceBounds, normalization) : null,
    localOrigin: transformPoint(glyph.sourceOrigin, normalization),
    advanceWidth: glyph.advanceWidth * normalization.scale,
  }))

  return success({
    cacheKey,
    compilerVersion: CINEMA_OPENTYPE_TEXT_COMPILER_VERSION,
    shape: shapeResult.value,
    mesh: meshResult.value,
    glyphs: Object.freeze(glyphs),
    localBounds: shapeResult.value.localBounds,
  })
}

export class CinemaOpenTypeTextMeshCache {
  private readonly entries = new Map<string, CinemaOpenTypeTextCompilation>()
  private buildCount = 0
  private hitCount = 0

  constructor(private readonly maximumEntries = DEFAULT_CACHE_ENTRIES) {
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error('Cinema OpenType text cache capacity must be a positive integer')
    }
  }

  getOrCompile(request: CinemaOpenTypeTextRequest): CinemaOpenTypeTextResult {
    let key: string
    try {
      key = createCinemaOpenTypeTextMeshKey(request)
    } catch (error) {
      const message = errorMessage(error)
      const code: CinemaOpenTypeTextErrorCode = message.includes('font identity')
        ? 'invalid-font-identity'
        : message.includes('live geometry limit')
          ? 'too-complex'
          : message.includes('curve tolerance') || message.includes('curve depth')
            ? 'invalid-tessellation'
            : 'invalid-layout'
      return failure(code, message)
    }
    const cached = this.entries.get(key)
    if (cached) {
      this.entries.delete(key)
      this.entries.set(key, cached)
      this.hitCount += 1
      return success(cached)
    }

    const result = compileCinemaOpenTypeText(request)
    this.buildCount += 1
    if (!result.ok) return result
    this.entries.set(key, result.value)
    while (this.entries.size > this.maximumEntries) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (oldest == null) break
      this.entries.delete(oldest)
    }
    return result
  }

  clear(): void {
    this.entries.clear()
  }

  getStats(): Readonly<{ entries: number; buildCount: number; hitCount: number }> {
    return Object.freeze({ entries: this.entries.size, buildCount: this.buildCount, hitCount: this.hitCount })
  }
}

function flattenGlyphPath(
  path: opentype.Path,
  tessellation: Required<CinemaOpenTypeTextTessellation>,
): FlattenedContour[] {
  const commands = path.commands as unknown as readonly OpenTypePathCommand[]
  const rawContours: CinemaVectorPoint[][] = []
  let current: CinemaVectorPoint[] | null = null
  let cursor: CinemaVectorPoint = [0, 0]

  const finishCurrent = () => {
    if (!current) return
    const points = dedupeContour(current)
    if (points.length >= 3) rawContours.push(points)
    current = null
  }

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        finishCurrent()
        cursor = [command.x, command.y]
        current = [cursor]
        break
      case 'L': {
        cursor = [command.x, command.y]
        current?.push(cursor)
        break
      }
      case 'Q': {
        if (current) {
          const end: CinemaVectorPoint = [command.x, command.y]
          flattenQuadratic(cursor, [command.x1, command.y1], end, tessellation, 0, current)
          cursor = end
        }
        break
      }
      case 'C': {
        if (current) {
          const end: CinemaVectorPoint = [command.x, command.y]
          flattenCubic(cursor, [command.x1, command.y1], [command.x2, command.y2], end, tessellation, 0, current)
          cursor = end
        }
        break
      }
      case 'Z':
        finishCurrent()
        break
    }
  }
  finishCurrent()

  return rawContours.map((points, sourceIndex) => {
    const signedArea = ringArea(points)
    if (!Number.isFinite(signedArea) || Math.abs(signedArea) <= POINT_EPSILON) {
      throw new Error(`glyph contour ${sourceIndex} is degenerate`)
    }
    return {
      sourceIndex,
      points,
      bounds: boundsFromPoints(points),
      absoluteArea: Math.abs(signedArea),
      parentIndex: null,
      depth: 0,
    }
  })
}

function assignContourHierarchy(contours: FlattenedContour[]): void {
  for (const contour of contours) {
    let parent: FlattenedContour | null = null
    for (const candidate of contours) {
      if (candidate === contour || candidate.absoluteArea <= contour.absoluteArea) continue
      if (!boundsContains(candidate.bounds, contour.bounds)) continue
      if (!pointInRing(contour.points[0], candidate.points)) continue
      if (!parent || candidate.absoluteArea < parent.absoluteArea) parent = candidate
    }
    contour.parentIndex = parent?.sourceIndex ?? null
  }

  const byIndex = new Map(contours.map(contour => [contour.sourceIndex, contour]))
  const resolveDepth = (contour: FlattenedContour, seen: Set<number>): number => {
    if (contour.parentIndex == null) return 0
    if (seen.has(contour.sourceIndex)) throw new Error('glyph contour containment cycle detected')
    const parent = byIndex.get(contour.parentIndex)
    if (!parent) throw new Error('glyph contour parent is missing')
    const nextSeen = new Set(seen)
    nextSeen.add(contour.sourceIndex)
    return resolveDepth(parent, nextSeen) + 1
  }
  for (const contour of contours) contour.depth = resolveDepth(contour, new Set())
}

function buildGlyphRegions(glyphId: string, contours: readonly FlattenedContour[]): CinemaVectorRegionInput[] {
  return contours
    .filter(contour => contour.depth % 2 === 0)
    .map(contour => ({
      id: `${glyphId}:region:${contour.sourceIndex}`,
      outer: { id: `${glyphId}:ring:${contour.sourceIndex}`, points: contour.points },
      holes: contours
        .filter(candidate => candidate.parentIndex === contour.sourceIndex && candidate.depth === contour.depth + 1)
        .map(hole => ({ id: `${glyphId}:ring:${hole.sourceIndex}`, points: hole.points })),
    }))
}

function flattenQuadratic(
  start: CinemaVectorPoint,
  control: CinemaVectorPoint,
  end: CinemaVectorPoint,
  tessellation: Required<CinemaOpenTypeTextTessellation>,
  depth: number,
  output: CinemaVectorPoint[],
): void {
  if (depth >= tessellation.maxCurveDepth || pointLineDistance(control, start, end) <= tessellation.curveTolerance) {
    output.push(end)
    return
  }
  const startControl = midpoint(start, control)
  const controlEnd = midpoint(control, end)
  const center = midpoint(startControl, controlEnd)
  flattenQuadratic(start, startControl, center, tessellation, depth + 1, output)
  flattenQuadratic(center, controlEnd, end, tessellation, depth + 1, output)
}

function flattenCubic(
  start: CinemaVectorPoint,
  control1: CinemaVectorPoint,
  control2: CinemaVectorPoint,
  end: CinemaVectorPoint,
  tessellation: Required<CinemaOpenTypeTextTessellation>,
  depth: number,
  output: CinemaVectorPoint[],
): void {
  const flatness = Math.max(
    pointLineDistance(control1, start, end),
    pointLineDistance(control2, start, end),
  )
  if (depth >= tessellation.maxCurveDepth || flatness <= tessellation.curveTolerance) {
    output.push(end)
    return
  }
  const p01 = midpoint(start, control1)
  const p12 = midpoint(control1, control2)
  const p23 = midpoint(control2, end)
  const p012 = midpoint(p01, p12)
  const p123 = midpoint(p12, p23)
  const center = midpoint(p012, p123)
  flattenCubic(start, p01, p012, center, tessellation, depth + 1, output)
  flattenCubic(center, p123, p23, end, tessellation, depth + 1, output)
}

function resolveTessellation(
  tessellation: CinemaOpenTypeTextTessellation | undefined,
): Required<CinemaOpenTypeTextTessellation> {
  const curveTolerance = tessellation?.curveTolerance ?? DEFAULT_CURVE_TOLERANCE
  const maxCurveDepth = tessellation?.maxCurveDepth ?? DEFAULT_MAX_CURVE_DEPTH
  if (!Number.isFinite(curveTolerance) || curveTolerance <= 0) {
    throw new Error('Cinema OpenType curve tolerance must be a positive finite number')
  }
  if (!Number.isInteger(maxCurveDepth) || maxCurveDepth < 1 || maxCurveDepth > 20) {
    throw new Error('Cinema OpenType maximum curve depth must be an integer from 1 through 20')
  }
  return { curveTolerance, maxCurveDepth }
}

function dedupeContour(points: readonly CinemaVectorPoint[]): CinemaVectorPoint[] {
  const result: CinemaVectorPoint[] = []
  for (const point of points) {
    const normalized: CinemaVectorPoint = [canonicalZero(point[0]), canonicalZero(point[1])]
    const previous = result[result.length - 1]
    if (!previous || distanceSquared(previous, normalized) > POINT_EPSILON * POINT_EPSILON) result.push(normalized)
  }
  if (result.length > 1 && distanceSquared(result[0], result[result.length - 1]) <= POINT_EPSILON * POINT_EPSILON) result.pop()
  return result
}

function boundsFromPoints(points: readonly CinemaVectorPoint[]): CinemaBounds2D {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point[0])
    minY = Math.min(minY, point[1])
    maxX = Math.max(maxX, point[0])
    maxY = Math.max(maxY, point[1])
  }
  return makeBounds(minX, minY, maxX, maxY)
}

function mergeBounds(bounds: readonly CinemaBounds2D[]): CinemaBounds2D {
  if (bounds.length === 0) throw new Error('Cannot merge an empty bounds set')
  return makeBounds(
    Math.min(...bounds.map(bound => bound.min[0])),
    Math.min(...bounds.map(bound => bound.min[1])),
    Math.max(...bounds.map(bound => bound.max[0])),
    Math.max(...bounds.map(bound => bound.max[1])),
  )
}

function makeBounds(minX: number, minY: number, maxX: number, maxY: number): CinemaBounds2D {
  return {
    min: [minX, minY],
    max: [maxX, maxY],
    size: [maxX - minX, maxY - minY],
    center: [(minX + maxX) / 2, (minY + maxY) / 2],
  }
}

function createNormalization(bounds: CinemaBounds2D): { center: CinemaVectorPoint; scale: number } {
  const height = bounds.size[1]
  if (!Number.isFinite(height) || height <= POINT_EPSILON) throw new Error('Cinema OpenType text has no usable vertical extent')
  return { center: bounds.center, scale: 2 / height }
}

function transformPoint(
  point: CinemaVectorPoint,
  normalization: Readonly<{ center: CinemaVectorPoint; scale: number }>,
): CinemaVectorPoint {
  return [
    canonicalZero((point[0] - normalization.center[0]) * normalization.scale),
    canonicalZero((point[1] - normalization.center[1]) * normalization.scale),
  ]
}

function transformBounds(
  bounds: CinemaBounds2D,
  normalization: Readonly<{ center: CinemaVectorPoint; scale: number }>,
): CinemaBounds2D {
  const min = transformPoint(bounds.min, normalization)
  const max = transformPoint(bounds.max, normalization)
  return makeBounds(Math.min(min[0], max[0]), Math.min(min[1], max[1]), Math.max(min[0], max[0]), Math.max(min[1], max[1]))
}

function freezeGlyphMetadata(
  glyph: PendingGlyph & Pick<CinemaOpenTypeGlyphMetadata, 'localBounds' | 'localOrigin'>,
): CinemaOpenTypeGlyphMetadata {
  return Object.freeze({
    id: glyph.id,
    character: glyph.character,
    characterIndex: glyph.characterIndex,
    glyphIndex: glyph.glyphIndex,
    lineIndex: glyph.lineIndex,
    componentId: glyph.componentId,
    localBounds: glyph.localBounds ? Object.freeze({
      min: Object.freeze([...glyph.localBounds.min]) as CinemaVectorPoint,
      max: Object.freeze([...glyph.localBounds.max]) as CinemaVectorPoint,
      size: Object.freeze([...glyph.localBounds.size]) as CinemaVectorPoint,
      center: Object.freeze([...glyph.localBounds.center]) as CinemaVectorPoint,
    }) : null,
    localOrigin: Object.freeze([...glyph.localOrigin]) as CinemaVectorPoint,
    advanceWidth: glyph.advanceWidth,
  })
}

function pointInRing(point: CinemaVectorPoint, ring: readonly CinemaVectorPoint[]): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]
    const b = ring[previous]
    const crosses = (a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    if (crosses) inside = !inside
  }
  return inside
}

function boundsContains(outer: CinemaBounds2D, inner: CinemaBounds2D): boolean {
  return inner.min[0] >= outer.min[0] - POINT_EPSILON
    && inner.min[1] >= outer.min[1] - POINT_EPSILON
    && inner.max[0] <= outer.max[0] + POINT_EPSILON
    && inner.max[1] <= outer.max[1] + POINT_EPSILON
}

function ringArea(points: readonly CinemaVectorPoint[]): number {
  let doubledArea = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    doubledArea += current[0] * next[1] - next[0] * current[1]
  }
  return doubledArea * 0.5
}

function pointLineDistance(point: CinemaVectorPoint, start: CinemaVectorPoint, end: CinemaVectorPoint): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= POINT_EPSILON * POINT_EPSILON) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const area2 = Math.abs(dx * (start[1] - point[1]) - (start[0] - point[0]) * dy)
  return area2 / Math.sqrt(lengthSquared)
}

function midpoint(left: CinemaVectorPoint, right: CinemaVectorPoint): CinemaVectorPoint {
  return [(left[0] + right[0]) * 0.5, (left[1] + right[1]) * 0.5]
}

function distanceSquared(left: CinemaVectorPoint, right: CinemaVectorPoint): number {
  const dx = left[0] - right[0]
  const dy = left[1] - right[1]
  return dx * dx + dy * dy
}

function validateLayoutInputs(letterSpacing: number, lineHeight: number, alignment: OpenTypeTextAlignment): void {
  if (!Number.isFinite(letterSpacing)) throw new Error('Cinema OpenType letter spacing must be finite')
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) throw new Error('Cinema OpenType line height must be a positive finite number')
  if (alignment !== 'left' && alignment !== 'center' && alignment !== 'right') {
    throw new Error(`Unsupported OpenType text alignment: ${String(alignment)}`)
  }
}

function canonicalNumber(value: number): number {
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15))
}

function canonicalZero(value: number): number {
  return Math.abs(value) <= POINT_EPSILON ? 0 : value
}

function success(value: CinemaOpenTypeTextCompilation): CinemaOpenTypeTextResult {
  return { ok: true, value }
}

function failure(
  code: CinemaOpenTypeTextErrorCode,
  message: string,
  characterIndex?: number,
  glyphIndex?: number,
): CinemaOpenTypeTextResult {
  return { ok: false, error: { code, message, characterIndex, glyphIndex } }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function validateTextComplexity(text: string): void {
  const characterCount = Array.from(text).length
  if (characterCount > CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS.maxCharacters) {
    throw new Error(`Cinema 3D text exceeds the ${CINEMA_OPENTYPE_TEXT_COMPLEXITY_LIMITS.maxCharacters}-character live geometry limit`)
  }
}
