import { svgPathProperties } from 'svg-path-properties'

import {
  applySvgAffineMatrix,
  composeSvgAffineMatrices,
  getSvgContentHash,
  parseSvgPointsAttribute,
  parseSvgTransformAttribute,
  splitSvgCompoundPath,
  svgCircleToPathData,
  svgEllipseToPathData,
  svgPointsToPathData,
  svgRectToPathData,
  type SvgAffineMatrix,
} from '../react/renderers/svgGlyphUtils'
import type { CinemaAssetId } from './CinemaIdentifiers'
import type { CinemaAssetRuntimeService } from './CinemaRendererContracts'
import {
  cinemaSignedRingArea,
  extrudeCinemaVectorShape,
  normalizeCinemaVectorShape,
  type CinemaBounds2D,
  type CinemaNormalizedVectorShape,
  type CinemaVectorCpuMesh,
  type CinemaVectorFillRule,
  type CinemaVectorPoint,
  type CinemaVectorShapeInput,
} from './CinemaVectorGeometry'

export const CINEMA_SVG_VECTOR_COMPILER_VERSION = 1

export interface CinemaSvgVectorLimits {
  maxElements?: number
  maxContours?: number
  maxPointsPerContour?: number
  maxTotalPoints?: number
  maxOutputIndices?: number
  maxTraversalDepth?: number
}

export interface CinemaSvgVectorOptions {
  curveTolerance?: number
  limits?: CinemaSvgVectorLimits
}

export interface CinemaSvgVectorRequest {
  assetId: CinemaAssetId | string
  revision: string | number
  rawSvg: string
  options?: CinemaSvgVectorOptions
}

export interface CinemaSvgVectorCompilation {
  cacheKey: string
  compilerVersion: number
  assetId: string
  revision: string | number
  contentHash: string
  shape: CinemaNormalizedVectorShape
  mesh: CinemaVectorCpuMesh
  localBounds: CinemaBounds2D
}

export type CinemaSvgVectorErrorCode =
  | 'malformed-svg'
  | 'unsupported-svg'
  | 'too-complex'
  | 'invalid-topology'
  | 'vector-geometry-failed'

export interface CinemaSvgVectorError {
  code: CinemaSvgVectorErrorCode
  message: string
}

export type CinemaSvgVectorResult =
  | { ok: true; value: CinemaSvgVectorCompilation }
  | { ok: false; error: CinemaSvgVectorError }

interface SvgTraversalState {
  matrix: SvgAffineMatrix
  fillRule: CinemaVectorFillRule
  fill: string
  hidden: boolean
}

interface RawContour {
  id: string
  points: CinemaVectorPoint[]
  signedArea: number
  absoluteArea: number
  bounds: CinemaBounds2D
  parentIndex: number | null
  depth: number
}

interface BoundaryContour extends RawContour {
  role: 'outer' | 'hole' | 'neutral'
}

const IDENTITY: SvgAffineMatrix = [1, 0, 0, 1, 0, 0]
const DEFAULT_CURVE_TOLERANCE = 2
const DEFAULT_LIMITS: Required<CinemaSvgVectorLimits> = {
  maxElements: 512,
  maxContours: 128,
  maxPointsPerContour: 512,
  maxTotalPoints: 8192,
  maxOutputIndices: 196_608,
  maxTraversalDepth: 32,
}
const MIN_AREA = 1e-8
const MIN_SEGMENT = 1e-8
const MAX_CACHE_ENTRIES = 32
const UNSUPPORTED_TAGS = new Set(['clippath', 'mask', 'filter', 'pattern', 'image', 'foreignobject', 'text', 'use', 'symbol'])
const GEOMETRY_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'line', 'polyline'])

export function createCinemaSvgVectorMeshKey(request: CinemaSvgVectorRequest): string {
  const assetId = String(request.assetId).trim()
  if (!assetId) throw new Error('Cinema SVG vector source requires a non-empty asset identity')
  const options = resolveOptions(request.options)
  return JSON.stringify([
    'cinema-svg-vector',
    CINEMA_SVG_VECTOR_COMPILER_VERSION,
    assetId,
    String(request.revision),
    getSvgContentHash(request.rawSvg),
    canonicalNumber(options.curveTolerance),
    options.limits.maxElements,
    options.limits.maxContours,
    options.limits.maxPointsPerContour,
    options.limits.maxTotalPoints,
    options.limits.maxOutputIndices,
    options.limits.maxTraversalDepth,
  ])
}

export function compileCinemaSvgVector(request: CinemaSvgVectorRequest): CinemaSvgVectorResult {
  const assetId = String(request.assetId).trim()
  if (!assetId) return failure('malformed-svg', 'Cinema SVG vector source requires a non-empty asset identity')
  if (!request.rawSvg.trim()) return failure('malformed-svg', 'Cinema SVG vector source is empty')

  let options: ResolvedOptions
  let cacheKey: string
  try {
    options = resolveOptions(request.options)
    cacheKey = createCinemaSvgVectorMeshKey(request)
  } catch (error) {
    return failure('too-complex', errorMessage(error))
  }

  const parsed = collectSvgContours(request.rawSvg, options)
  if ('error' in parsed) return { ok: false, error: parsed.error }
  if (parsed.value.contours.length === 0) {
    return failure('unsupported-svg', 'Cinema SVG vector source contains no supported filled closed geometry')
  }

  const contours = parsed.value.contours
  assignContainment(contours)
  if (contours.some(contour => hasSelfIntersection(contour.points))) {
    return failure('invalid-topology', 'Cinema SVG vector source contains self-intersecting geometry')
  }
  const boundaries = classifyBoundaries(contours, parsed.value.fillRule)
  const vectorInput = buildVectorInput(boundaries, parsed.value.fillRule)
  if (vectorInput.components.length === 0) {
    return failure('unsupported-svg', 'Cinema SVG fill topology produced no solid filled regions')
  }

  const sourceBounds = mergeBounds(contours.map(contour => contour.bounds))
  const normalization = createNormalization(sourceBounds)
  const transformed: CinemaVectorShapeInput = {
    fillRule: parsed.value.fillRule,
    sourceBounds,
    components: vectorInput.components.map(component => ({
      id: component.id,
      regions: component.regions.map(region => ({
        id: region.id,
        outer: { id: region.outer.id, points: region.outer.points.map(point => normalizePoint(point, normalization)) },
        holes: region.holes?.map(hole => ({ id: hole.id, points: hole.points.map(point => normalizePoint(point, normalization)) })),
      })),
    })),
  }

  const normalized = normalizeCinemaVectorShape(transformed, {
    limits: {
      maxComponents: options.limits.maxContours,
      maxRegions: options.limits.maxContours,
      maxRings: options.limits.maxContours,
      maxPointsPerRing: options.limits.maxPointsPerContour,
      maxInputPoints: options.limits.maxTotalPoints,
      maxOutputIndices: options.limits.maxOutputIndices,
    },
  })
  if ('error' in normalized) {
    return failure(
      normalized.error.code === 'limit-exceeded' ? 'too-complex' : 'vector-geometry-failed',
      `Cinema SVG vector normalization failed: ${normalized.error.message}`,
    )
  }
  const mesh = extrudeCinemaVectorShape(normalized.value, {
    limits: { maxOutputIndices: options.limits.maxOutputIndices },
  })
  if ('error' in mesh) {
    return failure(
      mesh.error.code === 'limit-exceeded' ? 'too-complex' : 'vector-geometry-failed',
      `Cinema SVG extrusion failed: ${mesh.error.message}`,
    )
  }

  return success({
    cacheKey,
    compilerVersion: CINEMA_SVG_VECTOR_COMPILER_VERSION,
    assetId,
    revision: request.revision,
    contentHash: getSvgContentHash(request.rawSvg),
    shape: normalized.value,
    mesh: mesh.value,
    localBounds: normalized.value.localBounds,
  })
}

export class CinemaSvgVectorMeshCache {
  private readonly entries = new Map<string, CinemaSvgVectorCompilation>()
  private readonly latestRevisionByAsset = new Map<string, string>()
  private buildCount = 0
  private hitCount = 0

  constructor(private readonly maximumEntries = MAX_CACHE_ENTRIES) {
    if (!Number.isInteger(maximumEntries) || maximumEntries <= 0) {
      throw new Error('Cinema SVG vector cache capacity must be a positive integer')
    }
  }

  getOrCompile(request: CinemaSvgVectorRequest): CinemaSvgVectorResult {
    const assetId = String(request.assetId)
    const revision = String(request.revision)
    const previousRevision = this.latestRevisionByAsset.get(assetId)
    if (previousRevision !== undefined && previousRevision !== revision) this.invalidateAsset(assetId)
    this.latestRevisionByAsset.set(assetId, revision)
    let key: string
    try {
      key = createCinemaSvgVectorMeshKey(request)
    } catch (error) {
      return failure('too-complex', errorMessage(error))
    }
    const cached = this.entries.get(key)
    if (cached) {
      this.entries.delete(key)
      this.entries.set(key, cached)
      this.hitCount += 1
      return success(cached)
    }
    const result = compileCinemaSvgVector(request)
    this.buildCount += 1
    if (!result.ok) return result
    this.entries.set(key, result.value)
    while (this.entries.size > this.maximumEntries) {
      const oldest = this.entries.keys().next().value as string | undefined
      if (!oldest) break
      this.entries.delete(oldest)
    }
    return result
  }

  invalidateAsset(assetId: CinemaAssetId | string): void {
    const normalized = String(assetId)
    this.latestRevisionByAsset.delete(normalized)
    for (const [key, value] of this.entries) {
      if (value.assetId === normalized) this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
    this.latestRevisionByAsset.clear()
  }

  getStats(): Readonly<{ entries: number; buildCount: number; hitCount: number }> {
    return Object.freeze({ entries: this.entries.size, buildCount: this.buildCount, hitCount: this.hitCount })
  }
}


export async function compileCinemaSvgAssetSource(
  assetManager: CinemaAssetRuntimeService,
  cache: CinemaSvgVectorMeshCache,
  assetId: CinemaAssetId,
  options?: CinemaSvgVectorOptions,
  signal?: AbortSignal,
): Promise<CinemaSvgVectorResult> {
  if (!assetManager.loadRawSource) {
    return failure('unsupported-svg', 'Cinema asset runtime does not expose raw SVG source loading')
  }
  const source = await assetManager.loadRawSource(assetId, signal)
  if (!source || source.mediaKind !== 'svg' || source.text == null) {
    cache.invalidateAsset(assetId)
    return failure('unsupported-svg', 'Cinema SVG asset is missing, deleted, or unavailable')
  }
  return cache.getOrCompile({ assetId, revision: source.revision, rawSvg: source.text, options })
}

type ResolvedOptions = {
  curveTolerance: number
  limits: Required<CinemaSvgVectorLimits>
}

function resolveOptions(options: CinemaSvgVectorOptions | undefined): ResolvedOptions {
  const curveTolerance = options?.curveTolerance ?? DEFAULT_CURVE_TOLERANCE
  if (!Number.isFinite(curveTolerance) || curveTolerance <= 0) {
    throw new Error('Cinema SVG curve tolerance must be a positive finite number')
  }
  const limits = { ...DEFAULT_LIMITS, ...(options?.limits ?? {}) }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`Cinema SVG ${name} limit must be a positive integer`)
  }
  return { curveTolerance, limits }
}

function collectSvgContours(rawSvg: string, options: ResolvedOptions):
  | { ok: true; value: { contours: RawContour[]; fillRule: CinemaVectorFillRule } }
  | { ok: false; error: CinemaSvgVectorError } {
  if (!/<svg\b/i.test(rawSvg)) return failure('malformed-svg', 'Cinema SVG vector source does not contain an <svg> root')
  if (/<(?:script|style)\b/i.test(rawSvg)) return failure('unsupported-svg', 'Cinema SVG vector source contains script/style content')

  const contours: RawContour[] = []
  const stack: SvgTraversalState[] = [{ matrix: IDENTITY, fillRule: 'nonzero', fill: 'black', hidden: false }]
  let elementCount = 0
  let totalPoints = 0
  let contourIndex = 0
  let establishedFillRule: CinemaVectorFillRule | null = null
  let strokeOnlySeen = false
  let depth = 0
  const tagRe = /<!--[\s\S]*?-->|<\?[^>]*\?>|<![^>]*>|<\/?\s*([A-Za-z][\w:.-]*)([^>]*)>/g
  let match: RegExpExecArray | null

  try {
    while ((match = tagRe.exec(rawSvg)) !== null) {
      if (!match[1]) continue
      const rawName = match[1]
      const name = rawName.toLowerCase().replace(/^.*:/, '')
      const full = match[0]
      const closing = /^<\//.test(full)
      const selfClosing = /\/\s*>$/.test(full)
      if (closing) {
        if (depth > 0) depth -= 1
        if (stack.length > 1) stack.pop()
        continue
      }

      elementCount += 1
      if (elementCount > options.limits.maxElements) return failure('too-complex', 'Cinema SVG element budget exceeded')
      depth += 1
      if (depth > options.limits.maxTraversalDepth) return failure('too-complex', 'Cinema SVG traversal depth budget exceeded')

      const attrs = parseAttributes(match[2] ?? '')
      if (attrs.href || attrs['xlink:href']) return failure('unsupported-svg', 'Cinema SVG external/reference semantics are unsupported')
      if (UNSUPPORTED_TAGS.has(name)) return failure('unsupported-svg', `Cinema SVG <${rawName}> is unsupported for true 3D geometry`)

      const parent = stack[stack.length - 1]
      const style = parseStyle(attrs.style)
      const transform = attrs.transform ? parseSvgTransformAttribute(attrs.transform) : IDENTITY
      const fillRule = parseFillRule(attrs['fill-rule'] ?? style['fill-rule'] ?? parent.fillRule)
      if (!fillRule) return failure('unsupported-svg', 'Cinema SVG uses an unsupported fill-rule')
      const fill = (attrs.fill ?? style.fill ?? parent.fill).trim().toLowerCase()
      const hidden = parent.hidden
        || (attrs.display ?? style.display ?? '').trim().toLowerCase() === 'none'
        || (attrs.visibility ?? style.visibility ?? '').trim().toLowerCase() === 'hidden'
      const state: SvgTraversalState = {
        matrix: composeSvgAffineMatrices(parent.matrix, transform),
        fillRule,
        fill,
        hidden,
      }
      stack.push(state)

      if (!hidden && GEOMETRY_TAGS.has(name)) {
        const stroke = (attrs.stroke ?? style.stroke ?? '').trim().toLowerCase()
        if (fill === 'none' || fill === 'transparent') {
          if (stroke && stroke !== 'none' && stroke !== 'transparent') strokeOnlySeen = true
        } else {
          if (establishedFillRule && establishedFillRule !== fillRule) {
            return failure('unsupported-svg', 'Cinema SVG mixed fill-rule geometry is not supported in the initial true 3D subset')
          }
          establishedFillRule = fillRule
          const pathData = geometryPathData(name, attrs)
          if (name === 'line' || name === 'polyline') {
            return failure('unsupported-svg', `Cinema SVG <${rawName}> requires stroke expansion, which is unsupported`)
          }
          if (pathData) {
            const subpaths = splitSvgCompoundPath(pathData)
            for (const subpath of subpaths) {
              if (!/[zZ](?:\s*)$/.test(subpath.trim())) {
                return failure('unsupported-svg', 'Cinema SVG contains an open path that would require stroke expansion')
              }
              const sampled = sampleClosedSubpath(subpath, state.matrix, options)
              if ('error' in sampled) return { ok: false, error: sampled.error }
              if (sampled.value.length < 3) continue
              totalPoints += sampled.value.length
              if (totalPoints > options.limits.maxTotalPoints) return failure('too-complex', 'Cinema SVG point budget exceeded')
              contourIndex += 1
              if (contourIndex > options.limits.maxContours) return failure('too-complex', 'Cinema SVG contour budget exceeded')
              const signedArea = cinemaSignedRingArea(sampled.value)
              if (Math.abs(signedArea) <= MIN_AREA) continue
              contours.push({
                id: `svg-contour:${contourIndex}`,
                points: sampled.value,
                signedArea,
                absoluteArea: Math.abs(signedArea),
                bounds: boundsOf(sampled.value),
                parentIndex: null,
                depth: 0,
              })
            }
          }
        }
      }

      if (selfClosing) {
        stack.pop()
        depth -= 1
      }
    }
  } catch (error) {
    return failure('malformed-svg', `Cinema SVG parse failed: ${errorMessage(error)}`)
  }

  if (stack.length !== 1) return failure('malformed-svg', 'Cinema SVG markup has unbalanced element nesting')
  if (contours.length === 0 && strokeOnlySeen) {
    return failure('unsupported-svg', 'Cinema SVG contains stroke-only geometry; stroke expansion is unsupported')
  }
  return { ok: true, value: { contours, fillRule: establishedFillRule ?? 'nonzero' } }
}

function geometryPathData(name: string, attrs: Record<string, string>): string | null {
  const n = (key: string, fallback = 0) => numericAttribute(attrs[key], fallback)
  switch (name) {
    case 'path': return attrs.d?.trim() || null
    case 'rect': return svgRectToPathData({
      x: n('x'), y: n('y'), width: n('width'), height: n('height'), rx: n('rx'), ry: n('ry'),
    })
    case 'circle': return svgCircleToPathData(n('cx'), n('cy'), n('r'))
    case 'ellipse': return svgEllipseToPathData(n('cx'), n('cy'), n('rx'), n('ry'))
    case 'polygon': return attrs.points ? svgPointsToPathData(parseSvgPointsAttribute(attrs.points), true) : null
    default: return null
  }
}

function sampleClosedSubpath(
  pathData: string,
  matrix: SvgAffineMatrix,
  options: ResolvedOptions,
): { ok: true; value: CinemaVectorPoint[] } | { ok: false; error: CinemaSvgVectorError } {
  try {
    const properties = new svgPathProperties(pathData)
    const length = properties.getTotalLength()
    if (!Number.isFinite(length) || length <= 0) return { ok: true, value: [] }
    const count = Math.max(4, Math.min(options.limits.maxPointsPerContour, Math.ceil(length / options.curveTolerance)))
    if (count >= options.limits.maxPointsPerContour && length / options.curveTolerance > options.limits.maxPointsPerContour) {
      return failure('too-complex', 'Cinema SVG contour tessellation budget exceeded')
    }
    const points: CinemaVectorPoint[] = []
    for (let index = 0; index < count; index += 1) {
      const point = properties.getPointAtLength((index / count) * length)
      const transformed = applySvgAffineMatrix(matrix, point.x, point.y)
      const next: CinemaVectorPoint = [transformed[0], -transformed[1]]
      const previous = points[points.length - 1]
      if (!previous || distanceSquared(previous, next) > MIN_SEGMENT * MIN_SEGMENT) points.push(next)
    }
    if (points.length > 2 && distanceSquared(points[0], points[points.length - 1]) <= MIN_SEGMENT * MIN_SEGMENT) points.pop()
    return { ok: true, value: points }
  } catch (error) {
    return failure('malformed-svg', `Cinema SVG path data is malformed: ${errorMessage(error)}`)
  }
}

function assignContainment(contours: RawContour[]): void {
  const order = contours.map((_, index) => index).sort((a, b) => contours[b].absoluteArea - contours[a].absoluteArea)
  for (const index of order) {
    const contour = contours[index]
    let parentIndex: number | null = null
    let parentArea = Number.POSITIVE_INFINITY
    const probe = interiorProbe(contour.points)
    for (const candidateIndex of order) {
      if (candidateIndex === index) continue
      const candidate = contours[candidateIndex]
      if (candidate.absoluteArea <= contour.absoluteArea || candidate.absoluteArea >= parentArea) continue
      if (!boundsContain(candidate.bounds, contour.bounds)) continue
      if (!pointInPolygon(probe, candidate.points)) continue
      parentIndex = candidateIndex
      parentArea = candidate.absoluteArea
    }
    contour.parentIndex = parentIndex
    contour.depth = parentIndex == null ? 0 : contours[parentIndex].depth + 1
  }
}

function classifyBoundaries(contours: RawContour[], fillRule: CinemaVectorFillRule): BoundaryContour[] {
  return contours.map((contour, index) => {
    if (fillRule === 'evenodd') return { ...contour, role: contour.depth % 2 === 0 ? 'outer' : 'hole' }
    let outsideWinding = 0
    let parent = contour.parentIndex
    while (parent != null) {
      outsideWinding += Math.sign(contours[parent].signedArea)
      parent = contours[parent].parentIndex
    }
    const insideWinding = outsideWinding + Math.sign(contour.signedArea)
    const outsideFilled = outsideWinding !== 0
    const insideFilled = insideWinding !== 0
    return {
      ...contour,
      role: outsideFilled === insideFilled ? 'neutral' : insideFilled ? 'outer' : 'hole',
      parentIndex: contour.parentIndex,
      depth: contour.depth,
    }
  })
}

function buildVectorInput(boundaries: BoundaryContour[], fillRule: CinemaVectorFillRule): CinemaVectorShapeInput {
  const components: CinemaVectorShapeInput['components'][number][] = []
  let componentIndex = 0
  for (let index = 0; index < boundaries.length; index += 1) {
    const outer = boundaries[index]
    if (outer.role !== 'outer') continue
    const holes = boundaries.filter((candidate, candidateIndex) => {
      if (candidate.role !== 'hole') return false
      let parent = candidate.parentIndex
      while (parent != null) {
        if (parent === index) return true
        if (boundaries[parent].role === 'outer') return false
        parent = boundaries[parent].parentIndex
      }
      return false
    })
    componentIndex += 1
    components.push({
      id: `svg-component:${componentIndex}`,
      regions: [{
        id: `svg-region:${componentIndex}`,
        outer: { id: outer.id, points: outer.points },
        holes: holes.map(hole => ({ id: hole.id, points: hole.points })),
      }],
    })
  }
  return { fillRule, components }
}

function hasSelfIntersection(points: readonly CinemaVectorPoint[]): boolean {
  const count = points.length
  for (let a = 0; a < count; a += 1) {
    const a1 = points[a]
    const a2 = points[(a + 1) % count]
    for (let b = a + 1; b < count; b += 1) {
      if (Math.abs(a - b) <= 1 || (a === 0 && b === count - 1)) continue
      const b1 = points[b]
      const b2 = points[(b + 1) % count]
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

function segmentsIntersect(a: CinemaVectorPoint, b: CinemaVectorPoint, c: CinemaVectorPoint, d: CinemaVectorPoint): boolean {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  return ((abC > MIN_AREA && abD < -MIN_AREA) || (abC < -MIN_AREA && abD > MIN_AREA))
    && ((cdA > MIN_AREA && cdB < -MIN_AREA) || (cdA < -MIN_AREA && cdB > MIN_AREA))
}

function cross(a: CinemaVectorPoint, b: CinemaVectorPoint, c: CinemaVectorPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function interiorProbe(points: readonly CinemaVectorPoint[]): CinemaVectorPoint {
  const a = points[0]
  const b = points[1] ?? a
  return [(a[0] * 0.999) + (b[0] * 0.001), (a[1] * 0.999) + (b[1] * 0.001)]
}

function pointInPolygon(point: CinemaVectorPoint, polygon: readonly CinemaVectorPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? ''
  return attrs
}

function parseStyle(style: string | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  for (const declaration of style?.split(';') ?? []) {
    const separator = declaration.indexOf(':')
    if (separator <= 0) continue
    result[declaration.slice(0, separator).trim().toLowerCase()] = declaration.slice(separator + 1).trim()
  }
  return result
}

function parseFillRule(value: string): CinemaVectorFillRule | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'nonzero' || normalized === 'evenodd') return normalized
  return null
}

function numericAttribute(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric SVG attribute: ${value}`)
  return parsed
}

function boundsOf(points: readonly CinemaVectorPoint[]): CinemaBounds2D {
  let minX = Number.POSITIVE_INFINITY, minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY
  for (const [x, y] of points) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return {
    min: [minX, minY], max: [maxX, maxY], size: [maxX - minX, maxY - minY], center: [(minX + maxX) / 2, (minY + maxY) / 2],
  }
}

function mergeBounds(bounds: readonly CinemaBounds2D[]): CinemaBounds2D {
  const minX = Math.min(...bounds.map(value => value.min[0]))
  const minY = Math.min(...bounds.map(value => value.min[1]))
  const maxX = Math.max(...bounds.map(value => value.max[0]))
  const maxY = Math.max(...bounds.map(value => value.max[1]))
  return { min: [minX, minY], max: [maxX, maxY], size: [maxX - minX, maxY - minY], center: [(minX + maxX) / 2, (minY + maxY) / 2] }
}

function boundsContain(outer: CinemaBounds2D, inner: CinemaBounds2D): boolean {
  return outer.min[0] <= inner.min[0] && outer.min[1] <= inner.min[1]
    && outer.max[0] >= inner.max[0] && outer.max[1] >= inner.max[1]
}

function createNormalization(bounds: CinemaBounds2D): { center: CinemaVectorPoint; scale: number } {
  const maximum = Math.max(bounds.size[0], bounds.size[1])
  if (!Number.isFinite(maximum) || maximum <= 0) throw new Error('Cinema SVG has no usable geometric extent')
  return { center: bounds.center, scale: 2 / maximum }
}

function normalizePoint(point: CinemaVectorPoint, normalization: { center: CinemaVectorPoint; scale: number }): CinemaVectorPoint {
  return [(point[0] - normalization.center[0]) * normalization.scale, (point[1] - normalization.center[1]) * normalization.scale]
}

function distanceSquared(a: CinemaVectorPoint, b: CinemaVectorPoint): number {
  const x = a[0] - b[0], y = a[1] - b[1]
  return x * x + y * y
}

function canonicalNumber(value: number): string {
  return Number(value.toPrecision(12)).toString()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function success(value: CinemaSvgVectorCompilation): CinemaSvgVectorResult {
  return { ok: true, value }
}

function failure(code: CinemaSvgVectorErrorCode, message: string): { ok: false; error: CinemaSvgVectorError } {
  return { ok: false, error: { code, message } }
}
