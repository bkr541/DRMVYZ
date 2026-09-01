import earcut from 'earcut'

import type { CinemaVector3 } from './CinemaDomain'

export type CinemaVectorFillRule = 'nonzero' | 'evenodd'
export type CinemaVectorWinding = 'counter-clockwise' | 'clockwise'
export type CinemaVectorRingRole = 'outer' | 'hole'

export type CinemaVectorPoint = readonly [number, number]

export interface CinemaBounds2D {
  min: CinemaVectorPoint
  max: CinemaVectorPoint
  size: CinemaVectorPoint
  center: CinemaVectorPoint
}

export interface CinemaBounds3D {
  min: CinemaVector3
  max: CinemaVector3
  size: CinemaVector3
  center: CinemaVector3
}

export interface CinemaVectorRingInput {
  id: string
  points: readonly CinemaVectorPoint[]
}

export interface CinemaVectorRegionInput {
  id: string
  outer: CinemaVectorRingInput
  holes?: readonly CinemaVectorRingInput[]
}

export interface CinemaVectorComponentInput {
  id: string
  regions: readonly CinemaVectorRegionInput[]
}

export interface CinemaVectorShapeInput {
  fillRule: CinemaVectorFillRule
  components: readonly CinemaVectorComponentInput[]
  sourceBounds?: CinemaBounds2D
}

export interface CinemaVectorGeometryLimits {
  maxComponents?: number
  maxRegions?: number
  maxRings?: number
  maxPointsPerRing?: number
  maxInputPoints?: number
  maxOutputVertices?: number
  maxOutputIndices?: number
}

export interface CinemaVectorGeometryOptions {
  epsilon?: number
  limits?: CinemaVectorGeometryLimits
}

export interface CinemaNormalizedVectorRing {
  id: string
  role: CinemaVectorRingRole
  points: readonly CinemaVectorPoint[]
  signedArea: number
  winding: CinemaVectorWinding
  bounds: CinemaBounds2D
}

export interface CinemaNormalizedVectorRegion {
  id: string
  outer: CinemaNormalizedVectorRing
  holes: readonly CinemaNormalizedVectorRing[]
  bounds: CinemaBounds2D
}

export interface CinemaNormalizedVectorComponent {
  id: string
  regions: readonly CinemaNormalizedVectorRegion[]
  bounds: CinemaBounds2D
}

export interface CinemaNormalizedVectorShape {
  fillRule: CinemaVectorFillRule
  components: readonly CinemaNormalizedVectorComponent[]
  sourceBounds?: CinemaBounds2D
  localBounds: CinemaBounds2D
  pointCount: number
  ringCount: number
  regionCount: number
}

export type CinemaVectorGeometryErrorCode =
  | 'malformed-input'
  | 'degenerate-input'
  | 'invalid-topology'
  | 'limit-exceeded'
  | 'triangulation-failed'

export interface CinemaVectorGeometryError {
  code: CinemaVectorGeometryErrorCode
  message: string
  componentId?: string
  regionId?: string
  ringId?: string
}

export type CinemaVectorGeometryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CinemaVectorGeometryError }

export interface CinemaMeshIndexRange {
  indexStart: number
  indexCount: number
}

export interface CinemaVectorMeshComponentRanges {
  componentId: string
  front: CinemaMeshIndexRange
  back: CinemaMeshIndexRange
  sides: CinemaMeshIndexRange
}

export interface CinemaVectorMeshRegionRanges {
  componentId: string
  regionId: string
  front: CinemaMeshIndexRange
  back: CinemaMeshIndexRange
  sides: CinemaMeshIndexRange
}

export interface CinemaVectorCpuMesh {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
  surfaces: {
    front: CinemaMeshIndexRange
    back: CinemaMeshIndexRange
    sides: CinemaMeshIndexRange
  }
  components: readonly CinemaVectorMeshComponentRanges[]
  regions: readonly CinemaVectorMeshRegionRanges[]
  bounds: CinemaBounds3D
  pivot: CinemaVector3
  boundingRadius: number
}

export interface CinemaPolygonTriangulator {
  triangulate(
    vertices: readonly number[],
    holeIndices: readonly number[],
    dimensions: 2,
  ): readonly number[]
}

interface CinemaTriangulatedRegion {
  componentId: string
  region: CinemaNormalizedVectorRegion
  points: readonly CinemaVectorPoint[]
  indices: readonly number[]
  rings: readonly CinemaNormalizedVectorRing[]
}

const DEFAULT_EPSILON = 1e-9
const FRONT_Z = 0.5
const BACK_Z = -0.5

const earcutTriangulator: CinemaPolygonTriangulator = {
  triangulate(vertices, holeIndices, dimensions) {
    return earcut(vertices, holeIndices, dimensions)
  },
}

export function cinemaSignedRingArea(points: readonly CinemaVectorPoint[]): number {
  let doubledArea = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    doubledArea += current[0] * next[1] - next[0] * current[1]
  }
  return doubledArea * 0.5
}

export function normalizeCinemaVectorShape(
  input: CinemaVectorShapeInput,
  options: CinemaVectorGeometryOptions = {},
): CinemaVectorGeometryResult<CinemaNormalizedVectorShape> {
  const epsilonResult = resolveEpsilon(options.epsilon)
  if (!epsilonResult.ok) return epsilonResult
  const epsilon = epsilonResult.value

  const limitsResult = validateLimits(options.limits)
  if (!limitsResult.ok) return limitsResult
  const limits = options.limits

  if (input.fillRule !== 'nonzero' && input.fillRule !== 'evenodd') {
    return failure('malformed-input', `Unsupported vector fill rule: ${String(input.fillRule)}`)
  }
  const sourceBoundsError = validateOptionalSourceBounds(input.sourceBounds, epsilon)
  if (sourceBoundsError) return sourceBoundsError
  if (input.components.length === 0) {
    return failure('degenerate-input', 'Vector shape must contain at least one component')
  }
  const componentLimit = enforceLimit('components', input.components.length, limits?.maxComponents)
  if (componentLimit) return componentLimit

  const componentIds = new Set<string>()
  const components: CinemaNormalizedVectorComponent[] = []
  let pointCount = 0
  let ringCount = 0
  let regionCount = 0

  for (const componentInput of input.components) {
    if (!isStableId(componentInput.id)) {
      return failure('malformed-input', 'Vector component id must be a non-empty string')
    }
    if (componentIds.has(componentInput.id)) {
      return failure('malformed-input', `Duplicate vector component id: ${componentInput.id}`, componentInput.id)
    }
    componentIds.add(componentInput.id)
    if (componentInput.regions.length === 0) {
      return failure('degenerate-input', 'Vector component must contain at least one filled region', componentInput.id)
    }

    regionCount += componentInput.regions.length
    const regionLimit = enforceLimit('regions', regionCount, limits?.maxRegions, componentInput.id)
    if (regionLimit) return regionLimit

    const regionIds = new Set<string>()
    const regions: CinemaNormalizedVectorRegion[] = []
    for (const regionInput of componentInput.regions) {
      if (!isStableId(regionInput.id)) {
        return failure('malformed-input', 'Vector region id must be a non-empty string', componentInput.id)
      }
      if (regionIds.has(regionInput.id)) {
        return failure(
          'malformed-input',
          `Duplicate vector region id within component: ${regionInput.id}`,
          componentInput.id,
          regionInput.id,
        )
      }
      regionIds.add(regionInput.id)

      const outerResult = normalizeRing(regionInput.outer, 'outer', epsilon, limits, componentInput.id, regionInput.id)
      if (!outerResult.ok) return outerResult
      const outer = outerResult.value
      pointCount += outer.points.length
      ringCount += 1

      const ringLimit = enforceLimit('rings', ringCount, limits?.maxRings, componentInput.id, regionInput.id)
      if (ringLimit) return ringLimit
      const pointLimit = enforceLimit('input points', pointCount, limits?.maxInputPoints, componentInput.id, regionInput.id)
      if (pointLimit) return pointLimit

      const holes: CinemaNormalizedVectorRing[] = []
      const holeIds = new Set<string>()
      for (const holeInput of regionInput.holes ?? []) {
        if (holeIds.has(holeInput.id) || holeInput.id === outer.id) {
          return failure(
            'malformed-input',
            `Duplicate vector ring id within region: ${holeInput.id}`,
            componentInput.id,
            regionInput.id,
            holeInput.id,
          )
        }
        holeIds.add(holeInput.id)

        const holeResult = normalizeRing(holeInput, 'hole', epsilon, limits, componentInput.id, regionInput.id)
        if (!holeResult.ok) return holeResult
        const hole = holeResult.value
        pointCount += hole.points.length
        ringCount += 1

        const nextRingLimit = enforceLimit('rings', ringCount, limits?.maxRings, componentInput.id, regionInput.id, hole.id)
        if (nextRingLimit) return nextRingLimit
        const nextPointLimit = enforceLimit('input points', pointCount, limits?.maxInputPoints, componentInput.id, regionInput.id, hole.id)
        if (nextPointLimit) return nextPointLimit

        const topologyError = validateHoleTopology(outer, hole, holes, epsilon, componentInput.id, regionInput.id)
        if (topologyError) return topologyError
        holes.push(hole)
      }

      regions.push({
        id: regionInput.id,
        outer,
        holes,
        bounds: outer.bounds,
      })
    }

    components.push({
      id: componentInput.id,
      regions,
      bounds: mergeBounds2D(regions.map(region => region.bounds)),
    })
  }

  return success({
    fillRule: input.fillRule,
    components,
    sourceBounds: input.sourceBounds ? cloneBounds2D(input.sourceBounds) : undefined,
    localBounds: mergeBounds2D(components.map(component => component.bounds)),
    pointCount,
    ringCount,
    regionCount,
  })
}

export function triangulateCinemaVectorRegion(
  componentId: string,
  region: CinemaNormalizedVectorRegion,
  triangulator: CinemaPolygonTriangulator = earcutTriangulator,
  epsilon = DEFAULT_EPSILON,
): CinemaVectorGeometryResult<CinemaTriangulatedRegion> {
  const epsilonResult = resolveEpsilon(epsilon)
  if (!epsilonResult.ok) return epsilonResult
  const resolvedEpsilon = epsilonResult.value
  const rings = [region.outer, ...region.holes]
  const points: CinemaVectorPoint[] = []
  const vertices: number[] = []
  const holeIndices: number[] = []

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex]
    if (ringIndex > 0) holeIndices.push(points.length)
    for (const point of ring.points) {
      points.push(point)
      vertices.push(point[0], point[1])
    }
  }

  let rawIndices: readonly number[]
  try {
    rawIndices = triangulator.triangulate(vertices, holeIndices, 2)
  } catch (error) {
    return failure(
      'triangulation-failed',
      `Vector region triangulation threw: ${error instanceof Error ? error.message : String(error)}`,
      componentId,
      region.id,
    )
  }

  if (rawIndices.length === 0 || rawIndices.length % 3 !== 0) {
    return failure('triangulation-failed', 'Vector region triangulation produced no complete triangles', componentId, region.id)
  }

  const indices = Array.from(rawIndices)
  let triangleArea = 0
  for (let index = 0; index < indices.length; index += 3) {
    const aIndex = indices[index]
    const bIndex = indices[index + 1]
    const cIndex = indices[index + 2]
    if (!isValidTriangleIndex(aIndex, points.length) || !isValidTriangleIndex(bIndex, points.length) || !isValidTriangleIndex(cIndex, points.length)) {
      return failure('triangulation-failed', 'Vector region triangulation produced an out-of-range index', componentId, region.id)
    }
    if (aIndex === bIndex || bIndex === cIndex || cIndex === aIndex) {
      return failure('triangulation-failed', 'Vector region triangulation produced a repeated triangle index', componentId, region.id)
    }
    const area = triangleSignedArea(points[aIndex], points[bIndex], points[cIndex])
    if (!Number.isFinite(area) || Math.abs(area) <= resolvedEpsilon) {
      return failure('triangulation-failed', 'Vector region triangulation produced a degenerate triangle', componentId, region.id)
    }
    if (area < 0) {
      indices[index + 1] = cIndex
      indices[index + 2] = bIndex
      triangleArea += -area
    } else {
      triangleArea += area
    }
  }

  const expectedArea = Math.abs(region.outer.signedArea)
    - region.holes.reduce((sum, hole) => sum + Math.abs(hole.signedArea), 0)
  const tolerance = Math.max(resolvedEpsilon * 32, expectedArea * 1e-7)
  if (!Number.isFinite(expectedArea) || expectedArea <= resolvedEpsilon || Math.abs(triangleArea - expectedArea) > tolerance) {
    return failure(
      'triangulation-failed',
      `Vector region triangulation area mismatch: expected ${expectedArea}, received ${triangleArea}`,
      componentId,
      region.id,
    )
  }

  return success({ componentId, region, points, indices, rings })
}

export function extrudeCinemaVectorShape(
  input: CinemaVectorShapeInput | CinemaNormalizedVectorShape,
  options: CinemaVectorGeometryOptions = {},
  triangulator: CinemaPolygonTriangulator = earcutTriangulator,
): CinemaVectorGeometryResult<CinemaVectorCpuMesh> {
  const epsilonResult = resolveEpsilon(options.epsilon)
  if (!epsilonResult.ok) return epsilonResult
  const epsilon = epsilonResult.value

  const limitsResult = validateLimits(options.limits)
  if (!limitsResult.ok) return limitsResult

  const normalizedResult = isNormalizedShape(input)
    ? success(input)
    : normalizeCinemaVectorShape(input, options)
  if (!normalizedResult.ok) return normalizedResult
  const shape = normalizedResult.value
  const normalizedLimitError = enforceNormalizedShapeLimits(shape, options.limits)
  if (normalizedLimitError) return normalizedLimitError

  const triangulated: CinemaTriangulatedRegion[] = []
  for (const component of shape.components) {
    for (const region of component.regions) {
      const triangulatedResult = triangulateCinemaVectorRegion(component.id, region, triangulator, epsilon)
      if (!triangulatedResult.ok) return triangulatedResult
      triangulated.push(triangulatedResult.value)
    }
  }

  const frontVertexCount = triangulated.reduce((sum, region) => sum + region.points.length, 0)
  const backVertexCount = frontVertexCount
  const sideVertexCount = triangulated.reduce(
    (sum, region) => sum + region.rings.reduce((ringSum, ring) => ringSum + ring.points.length * 4, 0),
    0,
  )
  const outputVertexCount = frontVertexCount + backVertexCount + sideVertexCount
  const frontIndexCount = triangulated.reduce((sum, region) => sum + region.indices.length, 0)
  const backIndexCount = frontIndexCount
  const sideIndexCount = triangulated.reduce(
    (sum, region) => sum + region.rings.reduce((ringSum, ring) => ringSum + ring.points.length * 6, 0),
    0,
  )
  const outputIndexCount = frontIndexCount + backIndexCount + sideIndexCount

  const vertexLimit = enforceLimit('output vertices', outputVertexCount, options.limits?.maxOutputVertices)
  if (vertexLimit) return vertexLimit
  const indexLimit = enforceLimit('output indices', outputIndexCount, options.limits?.maxOutputIndices)
  if (indexLimit) return indexLimit

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const componentRanges = new Map<string, MutableComponentRanges>()
  const regionRanges = new Map<string, MutableRegionRanges>()

  const frontStart = indices.length
  for (const triangulatedRegion of triangulated) {
    const rangeStart = indices.length
    const vertexStart = positions.length / 3
    appendFaceVertices(positions, normals, triangulatedRegion.points, FRONT_Z, 1)
    for (const index of triangulatedRegion.indices) indices.push(vertexStart + index)
    recordRange(componentRanges, regionRanges, triangulatedRegion, 'front', rangeStart, indices.length - rangeStart)
  }
  const frontRange = range(frontStart, indices.length - frontStart)

  const backStart = indices.length
  for (const triangulatedRegion of triangulated) {
    const rangeStart = indices.length
    const vertexStart = positions.length / 3
    appendFaceVertices(positions, normals, triangulatedRegion.points, BACK_Z, -1)
    for (let index = 0; index < triangulatedRegion.indices.length; index += 3) {
      const a = triangulatedRegion.indices[index]
      const b = triangulatedRegion.indices[index + 1]
      const c = triangulatedRegion.indices[index + 2]
      indices.push(vertexStart + a, vertexStart + c, vertexStart + b)
    }
    recordRange(componentRanges, regionRanges, triangulatedRegion, 'back', rangeStart, indices.length - rangeStart)
  }
  const backRange = range(backStart, indices.length - backStart)

  const sidesStart = indices.length
  for (const triangulatedRegion of triangulated) {
    const rangeStart = indices.length
    for (const ring of triangulatedRegion.rings) {
      appendSideWall(positions, normals, indices, ring.points, epsilon)
    }
    recordRange(componentRanges, regionRanges, triangulatedRegion, 'sides', rangeStart, indices.length - rangeStart)
  }
  const sidesRange = range(sidesStart, indices.length - sidesStart)

  const bounds = bounds3DFrom2D(shape.localBounds)
  const halfX = bounds.size[0] * 0.5
  const halfY = bounds.size[1] * 0.5
  const halfZ = bounds.size[2] * 0.5

  return success({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    surfaces: { front: frontRange, back: backRange, sides: sidesRange },
    components: shape.components.map(component => finalizeComponentRange(componentRanges.get(component.id), component.id)),
    regions: triangulated.map(region => finalizeRegionRange(regionRanges.get(regionKey(region.componentId, region.region.id)), region.componentId, region.region.id)),
    bounds,
    pivot: [bounds.center[0], bounds.center[1], 0],
    boundingRadius: Math.hypot(halfX, halfY, halfZ),
  })
}

function normalizeRing(
  input: CinemaVectorRingInput,
  role: CinemaVectorRingRole,
  epsilon: number,
  limits: CinemaVectorGeometryLimits | undefined,
  componentId: string,
  regionId: string,
): CinemaVectorGeometryResult<CinemaNormalizedVectorRing> {
  if (!isStableId(input.id)) {
    return failure('malformed-input', 'Vector ring id must be a non-empty string', componentId, regionId)
  }
  if (!Array.isArray(input.points)) {
    return failure('malformed-input', 'Vector ring points must be an array', componentId, regionId, input.id)
  }

  const points: CinemaVectorPoint[] = []
  for (const point of input.points) {
    if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      return failure('malformed-input', 'Vector ring contains a non-finite or malformed point', componentId, regionId, input.id)
    }
    const normalizedPoint: CinemaVectorPoint = [canonicalZero(point[0]), canonicalZero(point[1])]
    if (points.length === 0 || !pointsNear(points[points.length - 1], normalizedPoint, epsilon)) {
      points.push(normalizedPoint)
    }
  }
  if (points.length > 1 && pointsNear(points[0], points[points.length - 1], epsilon)) points.pop()

  const perRingLimit = enforceLimit('points per ring', points.length, limits?.maxPointsPerRing, componentId, regionId, input.id)
  if (perRingLimit) return perRingLimit
  if (points.length < 3) {
    return failure('degenerate-input', 'Vector ring must contain at least three distinct points', componentId, regionId, input.id)
  }
  if (ringSelfIntersects(points, epsilon)) {
    return failure('invalid-topology', 'Vector ring self-intersects or touches itself', componentId, regionId, input.id)
  }

  const area = cinemaSignedRingArea(points)
  if (!Number.isFinite(area) || Math.abs(area) <= epsilon) {
    return failure('degenerate-input', 'Vector ring has zero or near-zero signed area', componentId, regionId, input.id)
  }

  const wantsCounterClockwise = role === 'outer'
  const isCounterClockwise = area > 0
  const normalizedPoints = wantsCounterClockwise === isCounterClockwise ? points : reverseRingPreservingAnchor(points)
  const signedArea = wantsCounterClockwise ? Math.abs(area) : -Math.abs(area)

  return success({
    id: input.id,
    role,
    points: normalizedPoints,
    signedArea,
    winding: wantsCounterClockwise ? 'counter-clockwise' : 'clockwise',
    bounds: bounds2DFromPoints(normalizedPoints),
  })
}

function validateHoleTopology(
  outer: CinemaNormalizedVectorRing,
  hole: CinemaNormalizedVectorRing,
  previousHoles: readonly CinemaNormalizedVectorRing[],
  epsilon: number,
  componentId: string,
  regionId: string,
): CinemaVectorGeometryResult<never> | null {
  if (ringsIntersect(outer.points, hole.points, epsilon) || pointInRing(hole.points[0], outer.points, epsilon) !== 'inside') {
    return failure('invalid-topology', 'Hole ring must be strictly contained by its outer ring', componentId, regionId, hole.id)
  }
  for (const previous of previousHoles) {
    const intersects = ringsIntersect(previous.points, hole.points, epsilon)
    const nested = pointInRing(hole.points[0], previous.points, epsilon) !== 'outside'
      || pointInRing(previous.points[0], hole.points, epsilon) !== 'outside'
    if (intersects || nested) {
      return failure('invalid-topology', 'Hole rings must not overlap, touch, or contain one another', componentId, regionId, hole.id)
    }
  }
  return null
}

function appendFaceVertices(
  positions: number[],
  normals: number[],
  points: readonly CinemaVectorPoint[],
  z: number,
  normalZ: number,
): void {
  for (const point of points) {
    positions.push(point[0], point[1], z)
    normals.push(0, 0, normalZ)
  }
}

function appendSideWall(
  positions: number[],
  normals: number[],
  indices: number[],
  points: readonly CinemaVectorPoint[],
  epsilon: number,
): void {
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const current = points[pointIndex]
    const next = points[(pointIndex + 1) % points.length]
    const dx = next[0] - current[0]
    const dy = next[1] - current[1]
    const length = Math.hypot(dx, dy)
    if (length <= epsilon) continue

    const nx = canonicalZero(dy / length)
    const ny = canonicalZero(-dx / length)
    const vertexStart = positions.length / 3
    positions.push(
      current[0], current[1], FRONT_Z,
      current[0], current[1], BACK_Z,
      next[0], next[1], BACK_Z,
      next[0], next[1], FRONT_Z,
    )
    for (let vertex = 0; vertex < 4; vertex += 1) normals.push(nx, ny, 0)
    indices.push(
      vertexStart, vertexStart + 1, vertexStart + 2,
      vertexStart, vertexStart + 2, vertexStart + 3,
    )
  }
}

type SurfaceName = 'front' | 'back' | 'sides'
interface MutableSurfaceRanges {
  front?: CinemaMeshIndexRange
  back?: CinemaMeshIndexRange
  sides?: CinemaMeshIndexRange
}
type MutableComponentRanges = MutableSurfaceRanges
type MutableRegionRanges = MutableSurfaceRanges

function recordRange(
  componentRanges: Map<string, MutableComponentRanges>,
  regionRanges: Map<string, MutableRegionRanges>,
  region: CinemaTriangulatedRegion,
  surface: SurfaceName,
  indexStart: number,
  indexCount: number,
): void {
  const component = componentRanges.get(region.componentId) ?? {}
  component[surface] = extendRange(component[surface], indexStart, indexCount)
  componentRanges.set(region.componentId, component)

  const key = regionKey(region.componentId, region.region.id)
  const regionRange = regionRanges.get(key) ?? {}
  regionRange[surface] = extendRange(regionRange[surface], indexStart, indexCount)
  regionRanges.set(key, regionRange)
}

function extendRange(current: CinemaMeshIndexRange | undefined, indexStart: number, indexCount: number): CinemaMeshIndexRange {
  if (!current) return range(indexStart, indexCount)
  return range(current.indexStart, indexStart + indexCount - current.indexStart)
}

function finalizeComponentRange(value: MutableComponentRanges | undefined, componentId: string): CinemaVectorMeshComponentRanges {
  return {
    componentId,
    front: value?.front ?? range(0, 0),
    back: value?.back ?? range(0, 0),
    sides: value?.sides ?? range(0, 0),
  }
}

function finalizeRegionRange(
  value: MutableRegionRanges | undefined,
  componentId: string,
  regionId: string,
): CinemaVectorMeshRegionRanges {
  return {
    componentId,
    regionId,
    front: value?.front ?? range(0, 0),
    back: value?.back ?? range(0, 0),
    sides: value?.sides ?? range(0, 0),
  }
}

function regionKey(componentId: string, regionId: string): string {
  return `${componentId}\u0000${regionId}`
}

function isNormalizedShape(input: CinemaVectorShapeInput | CinemaNormalizedVectorShape): input is CinemaNormalizedVectorShape {
  return 'localBounds' in input && 'pointCount' in input && 'ringCount' in input
}

function reverseRingPreservingAnchor(points: readonly CinemaVectorPoint[]): CinemaVectorPoint[] {
  return [points[0], ...points.slice(1).reverse()]
}

function triangleSignedArea(a: CinemaVectorPoint, b: CinemaVectorPoint, c: CinemaVectorPoint): number {
  return ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) * 0.5
}

function pointsNear(a: CinemaVectorPoint, b: CinemaVectorPoint, epsilon: number): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon
}

function canonicalZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function ringSelfIntersects(points: readonly CinemaVectorPoint[], epsilon: number): boolean {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length
      const adjacent = first === second || firstNext === second || secondNext === first
      if (adjacent) continue
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext], epsilon)) return true
    }
  }
  return false
}

function ringsIntersect(a: readonly CinemaVectorPoint[], b: readonly CinemaVectorPoint[], epsilon: number): boolean {
  for (let first = 0; first < a.length; first += 1) {
    for (let second = 0; second < b.length; second += 1) {
      if (segmentsIntersect(a[first], a[(first + 1) % a.length], b[second], b[(second + 1) % b.length], epsilon)) {
        return true
      }
    }
  }
  return false
}

function segmentsIntersect(
  a: CinemaVectorPoint,
  b: CinemaVectorPoint,
  c: CinemaVectorPoint,
  d: CinemaVectorPoint,
  epsilon: number,
): boolean {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)

  if (((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon))
    && ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))) {
    return true
  }
  if (Math.abs(abC) <= epsilon && pointOnSegment(c, a, b, epsilon)) return true
  if (Math.abs(abD) <= epsilon && pointOnSegment(d, a, b, epsilon)) return true
  if (Math.abs(cdA) <= epsilon && pointOnSegment(a, c, d, epsilon)) return true
  return Math.abs(cdB) <= epsilon && pointOnSegment(b, c, d, epsilon)
}

function orientation(a: CinemaVectorPoint, b: CinemaVectorPoint, c: CinemaVectorPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function pointOnSegment(point: CinemaVectorPoint, a: CinemaVectorPoint, b: CinemaVectorPoint, epsilon: number): boolean {
  return point[0] >= Math.min(a[0], b[0]) - epsilon
    && point[0] <= Math.max(a[0], b[0]) + epsilon
    && point[1] >= Math.min(a[1], b[1]) - epsilon
    && point[1] <= Math.max(a[1], b[1]) + epsilon
}

type PointInRing = 'inside' | 'outside' | 'boundary'
function pointInRing(point: CinemaVectorPoint, ring: readonly CinemaVectorPoint[], epsilon: number): PointInRing {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const a = ring[previous]
    const b = ring[index]
    if (Math.abs(orientation(a, b, point)) <= epsilon && pointOnSegment(point, a, b, epsilon)) return 'boundary'
    const crosses = (a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    if (crosses) inside = !inside
  }
  return inside ? 'inside' : 'outside'
}

function bounds2DFromPoints(points: readonly CinemaVectorPoint[]): CinemaBounds2D {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point[0])
    minY = Math.min(minY, point[1])
    maxX = Math.max(maxX, point[0])
    maxY = Math.max(maxY, point[1])
  }
  return bounds2D(minX, minY, maxX, maxY)
}

function mergeBounds2D(bounds: readonly CinemaBounds2D[]): CinemaBounds2D {
  return bounds2D(
    Math.min(...bounds.map(value => value.min[0])),
    Math.min(...bounds.map(value => value.min[1])),
    Math.max(...bounds.map(value => value.max[0])),
    Math.max(...bounds.map(value => value.max[1])),
  )
}

function bounds2D(minX: number, minY: number, maxX: number, maxY: number): CinemaBounds2D {
  return {
    min: [minX, minY],
    max: [maxX, maxY],
    size: [maxX - minX, maxY - minY],
    center: [(minX + maxX) * 0.5, (minY + maxY) * 0.5],
  }
}

function cloneBounds2D(value: CinemaBounds2D): CinemaBounds2D {
  return {
    min: [value.min[0], value.min[1]],
    max: [value.max[0], value.max[1]],
    size: [value.size[0], value.size[1]],
    center: [value.center[0], value.center[1]],
  }
}

function bounds3DFrom2D(value: CinemaBounds2D): CinemaBounds3D {
  return {
    min: [value.min[0], value.min[1], BACK_Z],
    max: [value.max[0], value.max[1], FRONT_Z],
    size: [value.size[0], value.size[1], 1],
    center: [value.center[0], value.center[1], 0],
  }
}

function range(indexStart: number, indexCount: number): CinemaMeshIndexRange {
  return { indexStart, indexCount }
}

function isStableId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidTriangleIndex(value: number, pointCount: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < pointCount
}


function validateOptionalSourceBounds(
  value: CinemaBounds2D | undefined,
  epsilon: number,
): CinemaVectorGeometryResult<never> | null {
  if (!value) return null
  const values = [...value.min, ...value.max, ...value.size, ...value.center]
  if (values.some(coordinate => !Number.isFinite(coordinate))) {
    return failure('malformed-input', 'Vector source bounds must contain only finite coordinates')
  }
  if (value.min[0] > value.max[0] || value.min[1] > value.max[1]) {
    return failure('malformed-input', 'Vector source bounds min values must not exceed max values')
  }
  const expected = bounds2D(value.min[0], value.min[1], value.max[0], value.max[1])
  if (!pointsNear(value.size, expected.size, epsilon) || !pointsNear(value.center, expected.center, epsilon)) {
    return failure('malformed-input', 'Vector source bounds size and center must match min/max')
  }
  return null
}

function enforceNormalizedShapeLimits(
  shape: CinemaNormalizedVectorShape,
  limits: CinemaVectorGeometryLimits | undefined,
): CinemaVectorGeometryResult<never> | null {
  if (!limits) return null
  const checks: Array<[string, number, number | undefined]> = [
    ['components', shape.components.length, limits.maxComponents],
    ['regions', shape.regionCount, limits.maxRegions],
    ['rings', shape.ringCount, limits.maxRings],
    ['input points', shape.pointCount, limits.maxInputPoints],
  ]
  for (const [subject, actual, maximum] of checks) {
    const error = enforceLimit(subject, actual, maximum)
    if (error) return error
  }
  if (limits.maxPointsPerRing !== undefined) {
    for (const component of shape.components) {
      for (const region of component.regions) {
        for (const ring of [region.outer, ...region.holes]) {
          const error = enforceLimit(
            'points per ring',
            ring.points.length,
            limits.maxPointsPerRing,
            component.id,
            region.id,
            ring.id,
          )
          if (error) return error
        }
      }
    }
  }
  return null
}

function resolveEpsilon(value: number | undefined): CinemaVectorGeometryResult<number> {
  const epsilon = value ?? DEFAULT_EPSILON
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    return failure('malformed-input', 'Geometry epsilon must be a finite positive number')
  }
  return success(epsilon)
}

function validateLimits(limits: CinemaVectorGeometryLimits | undefined): CinemaVectorGeometryResult<true> {
  if (!limits) return success(true)
  for (const [name, value] of Object.entries(limits)) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      return failure('malformed-input', `Geometry limit ${name} must be a positive safe integer`)
    }
  }
  return success(true)
}

function enforceLimit(
  subject: string,
  actual: number,
  maximum: number | undefined,
  componentId?: string,
  regionId?: string,
  ringId?: string,
): CinemaVectorGeometryResult<never> | null {
  if (maximum === undefined || actual <= maximum) return null
  return failure('limit-exceeded', `Vector geometry ${subject} exceeded configured limit ${maximum}`, componentId, regionId, ringId)
}

function success<T>(value: T): CinemaVectorGeometryResult<T> {
  return { ok: true, value }
}

function failure(
  code: CinemaVectorGeometryErrorCode,
  message: string,
  componentId?: string,
  regionId?: string,
  ringId?: string,
): CinemaVectorGeometryResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(componentId ? { componentId } : {}),
      ...(regionId ? { regionId } : {}),
      ...(ringId ? { ringId } : {}),
    },
  }
}
