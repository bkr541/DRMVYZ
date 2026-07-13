import {
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  type LaserDmxShowDirectorBeamTarget,
} from './ReactTypes'

export interface LaserDmxLocalGeometryPoint {
  x: number
  y: number
}

export interface LaserDmxLocalGeometryBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type LaserDmxNegativeSpaceZone =
  | {
      id: string
      kind: 'rect'
      minX: number
      maxX: number
      minY: number
      maxY: number
    }
  | {
      id: string
      kind: 'ellipse'
      center: LaserDmxLocalGeometryPoint
      radiusX: number
      radiusY: number
    }
  | {
      id: string
      kind: 'diamond'
      center: LaserDmxLocalGeometryPoint
      halfWidth: number
      halfHeight: number
    }

export type LaserDmxNegativeSpacePolicy = 'clip' | 'redirect' | 'omit' | 'replace'

export interface LaserDmxLocalTargetGeneratorOptions {
  idPrefix: string
  semanticRole: string
  origin: LaserDmxLocalGeometryPoint
  localTargetCenter: LaserDmxLocalGeometryPoint
  bounds: LaserDmxLocalGeometryBounds
  fanSpreadDegrees?: number
  rayCount?: number
  rotationDegrees?: number
  mirror?: boolean
  targetDistance?: number
  exclusionZones?: readonly LaserDmxNegativeSpaceZone[]
  negativeSpacePolicy?: LaserDmxNegativeSpacePolicy
  replacementTarget?: LaserDmxLocalGeometryPoint
  allowZoneCrossing?: boolean
}

export interface LaserDmxCardinalApertureOptions extends LaserDmxLocalTargetGeneratorOptions {
  bank: 'top' | 'bottom' | 'left' | 'right' | 'upperLeft' | 'upperRight' | 'lowerLeft' | 'lowerRight'
  apertureCenter: LaserDmxLocalGeometryPoint
  radiusX: number
  radiusY: number
}

export interface LaserDmxCathedralWingOptions extends LaserDmxLocalTargetGeneratorOptions {
  orientation: 'upper' | 'lower'
}

const EPSILON = 1e-6

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function point(x: number, y: number): LaserDmxLocalGeometryPoint {
  return { x, y }
}

function centerOf(bounds: LaserDmxLocalGeometryBounds): LaserDmxLocalGeometryPoint {
  return {
    x: (bounds.minX + bounds.maxX) * 0.5,
    y: (bounds.minY + bounds.maxY) * 0.5,
  }
}

function normalizeBounds(bounds: LaserDmxLocalGeometryBounds): LaserDmxLocalGeometryBounds {
  const minX = Math.min(finite(bounds.minX), finite(bounds.maxX))
  const maxX = Math.max(finite(bounds.minX), finite(bounds.maxX))
  const minY = Math.min(finite(bounds.minY), finite(bounds.maxY))
  const maxY = Math.max(finite(bounds.minY), finite(bounds.maxY))
  return { minX, maxX, minY, maxY }
}

function clampPoint(value: LaserDmxLocalGeometryPoint, bounds: LaserDmxLocalGeometryBounds): LaserDmxLocalGeometryPoint {
  const normalized = normalizeBounds(bounds)
  return {
    x: clamp(finite(value.x), normalized.minX, normalized.maxX),
    y: clamp(finite(value.y), normalized.minY, normalized.maxY),
  }
}

function vectorLength(value: LaserDmxLocalGeometryPoint): number {
  return Math.hypot(value.x, value.y)
}

function unitVector(value: LaserDmxLocalGeometryPoint): LaserDmxLocalGeometryPoint {
  const length = vectorLength(value)
  if (length <= EPSILON) return { x: 1, y: 0 }
  return { x: value.x / length, y: value.y / length }
}

function rotateVector(value: LaserDmxLocalGeometryPoint, angleDegrees: number): LaserDmxLocalGeometryPoint {
  const radians = finite(angleDegrees) * Math.PI / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return {
    x: value.x * cosine - value.y * sine,
    y: value.x * sine + value.y * cosine,
  }
}

function reflectPointAcrossVerticalAxis(
  value: LaserDmxLocalGeometryPoint,
  bounds: LaserDmxLocalGeometryBounds,
): LaserDmxLocalGeometryPoint {
  const normalized = normalizeBounds(bounds)
  return {
    x: normalized.minX + normalized.maxX - value.x,
    y: value.y,
  }
}

function segmentOrientation(
  a: LaserDmxLocalGeometryPoint,
  b: LaserDmxLocalGeometryPoint,
  c: LaserDmxLocalGeometryPoint,
): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
}

function pointOnSegment(
  a: LaserDmxLocalGeometryPoint,
  b: LaserDmxLocalGeometryPoint,
  value: LaserDmxLocalGeometryPoint,
): boolean {
  return value.x <= Math.max(a.x, b.x) + EPSILON
    && value.x >= Math.min(a.x, b.x) - EPSILON
    && value.y <= Math.max(a.y, b.y) + EPSILON
    && value.y >= Math.min(a.y, b.y) - EPSILON
}

function segmentsIntersect(
  a1: LaserDmxLocalGeometryPoint,
  a2: LaserDmxLocalGeometryPoint,
  b1: LaserDmxLocalGeometryPoint,
  b2: LaserDmxLocalGeometryPoint,
): boolean {
  const o1 = segmentOrientation(a1, a2, b1)
  const o2 = segmentOrientation(a1, a2, b2)
  const o3 = segmentOrientation(b1, b2, a1)
  const o4 = segmentOrientation(b1, b2, a2)
  if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON)
    && (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) return true
  if (Math.abs(o1) <= EPSILON && pointOnSegment(a1, a2, b1)) return true
  if (Math.abs(o2) <= EPSILON && pointOnSegment(a1, a2, b2)) return true
  if (Math.abs(o3) <= EPSILON && pointOnSegment(b1, b2, a1)) return true
  return Math.abs(o4) <= EPSILON && pointOnSegment(b1, b2, a2)
}

function diamondVertices(zone: Extract<LaserDmxNegativeSpaceZone, { kind: 'diamond' }>): LaserDmxLocalGeometryPoint[] {
  return [
    point(zone.center.x, zone.center.y - zone.halfHeight),
    point(zone.center.x + zone.halfWidth, zone.center.y),
    point(zone.center.x, zone.center.y + zone.halfHeight),
    point(zone.center.x - zone.halfWidth, zone.center.y),
  ]
}

export function createCentralVerticalCorridor(
  id: string,
  bounds: LaserDmxLocalGeometryBounds,
  width: number,
  verticalInset = 0,
): LaserDmxNegativeSpaceZone {
  const normalized = normalizeBounds(bounds)
  const center = centerOf(normalized)
  const halfWidth = Math.max(0, finite(width)) * 0.5
  const inset = clamp(Math.max(0, finite(verticalInset)), 0, (normalized.maxY - normalized.minY) * 0.5)
  return {
    id,
    kind: 'rect',
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: normalized.minY + inset,
    maxY: normalized.maxY - inset,
  }
}

export function createCentralDiamondVoid(
  id: string,
  bounds: LaserDmxLocalGeometryBounds,
  halfWidth: number,
  halfHeight: number,
): LaserDmxNegativeSpaceZone {
  return {
    id,
    kind: 'diamond',
    center: centerOf(normalizeBounds(bounds)),
    halfWidth: Math.max(EPSILON, finite(halfWidth, 1)),
    halfHeight: Math.max(EPSILON, finite(halfHeight, 1)),
  }
}

export function createEllipticalAperture(
  id: string,
  center: LaserDmxLocalGeometryPoint,
  radiusX: number,
  radiusY: number,
): LaserDmxNegativeSpaceZone {
  return {
    id,
    kind: 'ellipse',
    center: { x: finite(center.x), y: finite(center.y) },
    radiusX: Math.max(EPSILON, finite(radiusX, 1)),
    radiusY: Math.max(EPSILON, finite(radiusY, 1)),
  }
}

export function createHorizontalGap(
  id: string,
  bounds: LaserDmxLocalGeometryBounds,
  height: number,
  horizontalInset = 0,
): LaserDmxNegativeSpaceZone {
  const normalized = normalizeBounds(bounds)
  const center = centerOf(normalized)
  const halfHeight = Math.max(0, finite(height)) * 0.5
  const inset = clamp(Math.max(0, finite(horizontalInset)), 0, (normalized.maxX - normalized.minX) * 0.5)
  return {
    id,
    kind: 'rect',
    minX: normalized.minX + inset,
    maxX: normalized.maxX - inset,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight,
  }
}

export function createRectangularExclusionRegion(
  id: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): LaserDmxNegativeSpaceZone {
  return {
    id,
    kind: 'rect',
    minX: Math.min(finite(minX), finite(maxX)),
    maxX: Math.max(finite(minX), finite(maxX)),
    minY: Math.min(finite(minY), finite(maxY)),
    maxY: Math.max(finite(minY), finite(maxY)),
  }
}

export function isPointInsideNegativeSpace(
  value: LaserDmxLocalGeometryPoint,
  zone: LaserDmxNegativeSpaceZone,
): boolean {
  if (zone.kind === 'rect') {
    return value.x >= zone.minX - EPSILON
      && value.x <= zone.maxX + EPSILON
      && value.y >= zone.minY - EPSILON
      && value.y <= zone.maxY + EPSILON
  }
  if (zone.kind === 'ellipse') {
    const dx = (value.x - zone.center.x) / zone.radiusX
    const dy = (value.y - zone.center.y) / zone.radiusY
    return dx * dx + dy * dy <= 1 + EPSILON
  }
  const dx = Math.abs(value.x - zone.center.x) / zone.halfWidth
  const dy = Math.abs(value.y - zone.center.y) / zone.halfHeight
  return dx + dy <= 1 + EPSILON
}

function segmentIntersectsRect(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zone: Extract<LaserDmxNegativeSpaceZone, { kind: 'rect' }>,
): boolean {
  if (isPointInsideNegativeSpace(origin, zone) || isPointInsideNegativeSpace(target, zone)) return true
  const corners = [
    point(zone.minX, zone.minY),
    point(zone.maxX, zone.minY),
    point(zone.maxX, zone.maxY),
    point(zone.minX, zone.maxY),
  ]
  return corners.some((corner, index) => segmentsIntersect(origin, target, corner, corners[(index + 1) % corners.length]))
}

function segmentIntersectsEllipse(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zone: Extract<LaserDmxNegativeSpaceZone, { kind: 'ellipse' }>,
): boolean {
  if (isPointInsideNegativeSpace(origin, zone) || isPointInsideNegativeSpace(target, zone)) return true
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const ox = origin.x - zone.center.x
  const oy = origin.y - zone.center.y
  const radiusXSquared = zone.radiusX * zone.radiusX
  const radiusYSquared = zone.radiusY * zone.radiusY
  const a = dx * dx / radiusXSquared + dy * dy / radiusYSquared
  const b = 2 * (ox * dx / radiusXSquared + oy * dy / radiusYSquared)
  const c = ox * ox / radiusXSquared + oy * oy / radiusYSquared - 1
  const discriminant = b * b - 4 * a * c
  if (a <= EPSILON || discriminant < 0) return false
  const root = Math.sqrt(discriminant)
  const first = (-b - root) / (2 * a)
  const second = (-b + root) / (2 * a)
  return first >= -EPSILON && first <= 1 + EPSILON || second >= -EPSILON && second <= 1 + EPSILON
}

export function segmentIntersectsNegativeSpace(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zone: LaserDmxNegativeSpaceZone,
): boolean {
  if (zone.kind === 'rect') return segmentIntersectsRect(origin, target, zone)
  if (zone.kind === 'ellipse') return segmentIntersectsEllipse(origin, target, zone)
  if (isPointInsideNegativeSpace(origin, zone) || isPointInsideNegativeSpace(target, zone)) return true
  const vertices = diamondVertices(zone)
  return vertices.some((vertex, index) => segmentsIntersect(origin, target, vertex, vertices[(index + 1) % vertices.length]))
}

export function rayViolatesNegativeSpace(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zones: readonly LaserDmxNegativeSpaceZone[],
): boolean {
  return zones.some(zone => segmentIntersectsNegativeSpace(origin, target, zone))
}

function firstSafePointBeforeZone(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zones: readonly LaserDmxNegativeSpaceZone[],
  bounds: LaserDmxLocalGeometryBounds,
): LaserDmxLocalGeometryPoint | null {
  if (zones.some(zone => isPointInsideNegativeSpace(origin, zone))) return null
  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 28; iteration++) {
    const mid = (low + high) * 0.5
    const candidate = point(
      origin.x + (target.x - origin.x) * mid,
      origin.y + (target.y - origin.y) * mid,
    )
    if (rayViolatesNegativeSpace(origin, candidate, zones)) high = mid
    else low = mid
  }
  if (low <= 0.02) return null
  return clampPoint(point(
    origin.x + (target.x - origin.x) * Math.max(0, low - 0.012),
    origin.y + (target.y - origin.y) * Math.max(0, low - 0.012),
  ), bounds)
}

function redirectAroundZones(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  zones: readonly LaserDmxNegativeSpaceZone[],
  bounds: LaserDmxLocalGeometryBounds,
): LaserDmxLocalGeometryPoint | null {
  const base = { x: target.x - origin.x, y: target.y - origin.y }
  const attempts = [8, -8, 16, -16, 28, -28, 42, -42, 58, -58, 76, -76, 94, -94]
  for (const angle of attempts) {
    const redirected = rotateVector(base, angle)
    const candidate = clampPoint(point(origin.x + redirected.x, origin.y + redirected.y), bounds)
    if (!rayViolatesNegativeSpace(origin, candidate, zones)) return candidate
  }
  return null
}

function resolveTargetAgainstZones(
  origin: LaserDmxLocalGeometryPoint,
  target: LaserDmxLocalGeometryPoint,
  options: LaserDmxLocalTargetGeneratorOptions,
): LaserDmxLocalGeometryPoint | null {
  const bounded = clampPoint(target, options.bounds)
  const zones = options.exclusionZones ?? []
  if (options.allowZoneCrossing || zones.length === 0 || !rayViolatesNegativeSpace(origin, bounded, zones)) return bounded
  const policy = options.negativeSpacePolicy ?? 'redirect'
  if (policy === 'omit') return null
  if (policy === 'replace') {
    const replacement = options.replacementTarget ? clampPoint(options.replacementTarget, options.bounds) : null
    return replacement && !rayViolatesNegativeSpace(origin, replacement, zones) ? replacement : null
  }
  if (policy === 'clip') return firstSafePointBeforeZone(origin, bounded, zones, options.bounds)
  return redirectAroundZones(origin, bounded, zones, options.bounds)
    ?? firstSafePointBeforeZone(origin, bounded, zones, options.bounds)
}

function targetId(options: LaserDmxLocalTargetGeneratorOptions, index: number): string {
  const safeRole = options.semanticRole.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'local'
  return `${options.idPrefix}-${safeRole}-${index + 1}`
}

function finalizeTargets(
  candidates: readonly LaserDmxLocalGeometryPoint[],
  options: LaserDmxLocalTargetGeneratorOptions,
): LaserDmxShowDirectorBeamTarget[] {
  const origin = clampPoint(options.origin, options.bounds)
  const unique = new Set<string>()
  const output: LaserDmxShowDirectorBeamTarget[] = []
  for (const rawCandidate of candidates) {
    const mirrored = options.mirror ? reflectPointAcrossVerticalAxis(rawCandidate, options.bounds) : rawCandidate
    const resolved = resolveTargetAgainstZones(origin, mirrored, options)
    if (!resolved) continue
    const key = `${resolved.x.toFixed(5)}:${resolved.y.toFixed(5)}`
    if (unique.has(key)) continue
    unique.add(key)
    output.push({ id: targetId(options, output.length), x: resolved.x, y: resolved.y })
    if (output.length >= LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS) break
  }
  return output
}

function rayCount(options: LaserDmxLocalTargetGeneratorOptions, fallback: number): number {
  return Math.round(clamp(finite(options.rayCount ?? fallback, fallback), 1, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS))
}

function directionFromOrigin(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxLocalGeometryPoint {
  return unitVector({
    x: options.localTargetCenter.x - options.origin.x,
    y: options.localTargetCenter.y - options.origin.y,
  })
}

function defaultDistance(options: LaserDmxLocalTargetGeneratorOptions): number {
  const direct = vectorLength({
    x: options.localTargetCenter.x - options.origin.x,
    y: options.localTargetCenter.y - options.origin.y,
  })
  const bounds = normalizeBounds(options.bounds)
  const canvasDistance = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
  return clamp(finite(options.targetDistance ?? direct, direct || canvasDistance * 0.35), 0.25, canvasDistance)
}

export function localParallelFan(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  const count = rayCount(options, 5)
  const direction = rotateVector(directionFromOrigin(options), options.rotationDegrees ?? 0)
  const perpendicular = { x: -direction.y, y: direction.x }
  const distance = defaultDistance(options)
  const center = point(options.origin.x + direction.x * distance, options.origin.y + direction.y * distance)
  const spreadRadians = clamp(finite(options.fanSpreadDegrees ?? 42), 0, 160) * Math.PI / 180
  const halfSpan = Math.tan(spreadRadians * 0.5) * distance
  const candidates = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1) * 2 - 1
    return point(center.x + perpendicular.x * halfSpan * t, center.y + perpendicular.y * halfSpan * t)
  })
  return finalizeTargets(candidates, options)
}

export function localRadialFan(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  const count = rayCount(options, 5)
  const direction = rotateVector(directionFromOrigin(options), options.rotationDegrees ?? 0)
  const centerAngle = Math.atan2(direction.y, direction.x) * 180 / Math.PI
  const spread = clamp(finite(options.fanSpreadDegrees ?? 54), 0, 170)
  const distance = defaultDistance(options)
  const candidates = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1) - 0.5
    const angle = (centerAngle + t * spread) * Math.PI / 180
    return point(options.origin.x + Math.cos(angle) * distance, options.origin.y + Math.sin(angle) * distance)
  })
  return finalizeTargets(candidates, options)
}

export function inwardFan(options: Omit<LaserDmxLocalTargetGeneratorOptions, 'localTargetCenter'> & {
  localTargetCenter?: LaserDmxLocalGeometryPoint
}): LaserDmxShowDirectorBeamTarget[] {
  return localRadialFan({
    ...options,
    localTargetCenter: options.localTargetCenter ?? centerOf(options.bounds),
  })
}

export function outwardFan(options: Omit<LaserDmxLocalTargetGeneratorOptions, 'localTargetCenter'> & {
  localTargetCenter?: LaserDmxLocalGeometryPoint
}): LaserDmxShowDirectorBeamTarget[] {
  const canvasCenter = centerOf(options.bounds)
  const outward = unitVector({ x: options.origin.x - canvasCenter.x, y: options.origin.y - canvasCenter.y })
  const distance = finite(options.targetDistance ?? Math.hypot(options.bounds.maxX - options.bounds.minX, options.bounds.maxY - options.bounds.minY) * 0.42)
  return localRadialFan({
    ...options,
    localTargetCenter: options.localTargetCenter ?? point(
      options.origin.x + outward.x * distance,
      options.origin.y + outward.y * distance,
    ),
  })
}

export function narrowSpearBank(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  return localRadialFan({
    ...options,
    rayCount: options.rayCount ?? 3,
    fanSpreadDegrees: clamp(finite(options.fanSpreadDegrees ?? 12), 2, 24),
  })
}

export function crossfirePair(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  const direction = rotateVector(directionFromOrigin(options), options.rotationDegrees ?? 0)
  const perpendicular = { x: -direction.y, y: direction.x }
  const distance = defaultDistance(options)
  const center = point(options.origin.x + direction.x * distance, options.origin.y + direction.y * distance)
  const spread = Math.max(0.5, Math.tan(clamp(finite(options.fanSpreadDegrees ?? 18), 2, 90) * Math.PI / 360) * distance)
  return finalizeTargets([
    point(center.x - perpendicular.x * spread, center.y - perpendicular.y * spread),
    point(center.x + perpendicular.x * spread, center.y + perpendicular.y * spread),
  ], { ...options, rayCount: 2 })
}

export function mirroredChevron(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  const direction = rotateVector(directionFromOrigin(options), options.rotationDegrees ?? 0)
  const perpendicular = { x: -direction.y, y: direction.x }
  const distance = defaultDistance(options)
  const tip = point(options.origin.x + direction.x * distance, options.origin.y + direction.y * distance)
  const shoulderDistance = distance * 0.72
  const halfWidth = Math.max(0.7, Math.tan(clamp(finite(options.fanSpreadDegrees ?? 34), 4, 110) * Math.PI / 360) * shoulderDistance)
  const shoulderCenter = point(
    options.origin.x + direction.x * shoulderDistance,
    options.origin.y + direction.y * shoulderDistance,
  )
  return finalizeTargets([
    point(shoulderCenter.x - perpendicular.x * halfWidth, shoulderCenter.y - perpendicular.y * halfWidth),
    tip,
    point(shoulderCenter.x + perpendicular.x * halfWidth, shoulderCenter.y + perpendicular.y * halfWidth),
  ], { ...options, rayCount: 3 })
}

export function localDiamondEdge(
  options: LaserDmxLocalTargetGeneratorOptions,
  halfWidth = 3,
  halfHeight = 2.5,
): LaserDmxShowDirectorBeamTarget[] {
  const center = options.localTargetCenter
  const vertices = {
    top: point(center.x, center.y - halfHeight),
    right: point(center.x + halfWidth, center.y),
    bottom: point(center.x, center.y + halfHeight),
    left: point(center.x - halfWidth, center.y),
  }
  const dx = options.origin.x - center.x
  const dy = options.origin.y - center.y
  const candidates = Math.abs(dx) >= Math.abs(dy)
    ? dx <= 0
      ? [vertices.top, vertices.left, vertices.bottom]
      : [vertices.top, vertices.right, vertices.bottom]
    : dy <= 0
      ? [vertices.left, vertices.top, vertices.right]
      : [vertices.left, vertices.bottom, vertices.right]
  return finalizeTargets(candidates, { ...options, rayCount: Math.min(3, rayCount(options, 3)) })
}

export function nestedDiamondLayer(
  options: LaserDmxLocalTargetGeneratorOptions,
  layers = 2,
): LaserDmxShowDirectorBeamTarget[] {
  const count = Math.round(clamp(finite(layers, 2), 1, 3))
  const canvasWidth = options.bounds.maxX - options.bounds.minX
  const canvasHeight = options.bounds.maxY - options.bounds.minY
  const candidates: LaserDmxLocalGeometryPoint[] = []
  for (let layer = 0; layer < count; layer++) {
    const scale = 1 - layer * 0.24
    const halfWidth = canvasWidth * 0.2 * scale
    const halfHeight = canvasHeight * 0.28 * scale
    const edge = localDiamondEdge({
      ...options,
      idPrefix: `${options.idPrefix}-layer-${layer + 1}`,
      exclusionZones: [],
      allowZoneCrossing: true,
    }, halfWidth, halfHeight)
    candidates.push(...edge.map(target => point(target.x, target.y)))
  }
  return finalizeTargets(candidates, options)
}

export function cathedralWing(options: LaserDmxCathedralWingOptions): LaserDmxShowDirectorBeamTarget[] {
  const canvasCenter = centerOf(options.bounds)
  const left = options.origin.x <= canvasCenter.x
  const side = left ? -1 : 1
  const width = options.bounds.maxX - options.bounds.minX
  const height = options.bounds.maxY - options.bounds.minY
  const apexY = options.orientation === 'upper'
    ? options.bounds.minY + height * 0.22
    : options.bounds.maxY - height * 0.22
  const shoulderY = options.orientation === 'upper'
    ? options.bounds.minY + height * 0.48
    : options.bounds.maxY - height * 0.48
  const footY = options.orientation === 'upper'
    ? options.bounds.minY + height * 0.74
    : options.bounds.maxY - height * 0.74
  const candidates = [
    point(canvasCenter.x + side * width * 0.08, apexY),
    point(canvasCenter.x + side * width * 0.2, shoulderY),
    point(canvasCenter.x + side * width * 0.34, footY),
  ]
  return finalizeTargets(candidates, { ...options, rayCount: 3 })
}

export function cageWall(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  const count = rayCount(options, 4)
  const canvasCenter = centerOf(options.bounds)
  const left = options.origin.x <= canvasCenter.x
  const wallX = options.localTargetCenter.x
  const height = options.bounds.maxY - options.bounds.minY
  const top = options.bounds.minY + height * 0.14
  const bottom = options.bounds.maxY - height * 0.14
  const candidates = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const xInset = left ? -Math.abs(options.fanSpreadDegrees ?? 0) * 0.012 : Math.abs(options.fanSpreadDegrees ?? 0) * 0.012
    return point(wallX + xInset, top + (bottom - top) * t)
  })
  return finalizeTargets(candidates, options)
}

const CARDINAL_BANK_ANGLES: Readonly<Record<LaserDmxCardinalApertureOptions['bank'], number>> = {
  top: -90,
  bottom: 90,
  left: 180,
  right: 0,
  upperLeft: -135,
  upperRight: -45,
  lowerLeft: 135,
  lowerRight: 45,
}

export function cardinalAperture(options: LaserDmxCardinalApertureOptions): LaserDmxShowDirectorBeamTarget[] {
  const count = rayCount(options, 5)
  const centerAngle = CARDINAL_BANK_ANGLES[options.bank] + finite(options.rotationDegrees)
  const spread = clamp(finite(options.fanSpreadDegrees ?? 52), 8, 110)
  const margin = 0.35
  const candidates = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1) - 0.5
    const angle = (centerAngle + t * spread) * Math.PI / 180
    return point(
      options.apertureCenter.x + Math.cos(angle) * (Math.max(EPSILON, options.radiusX) + margin),
      options.apertureCenter.y + Math.sin(angle) * (Math.max(EPSILON, options.radiusY) + margin),
    )
  })
  return finalizeTargets(candidates, options)
}

export function controlledStarburst(options: LaserDmxLocalTargetGeneratorOptions): LaserDmxShowDirectorBeamTarget[] {
  return localRadialFan({
    ...options,
    rayCount: options.rayCount ?? 6,
    fanSpreadDegrees: clamp(finite(options.fanSpreadDegrees ?? 108), 20, 150),
  })
}

export function corridorPreservingSideFan(
  options: LaserDmxLocalTargetGeneratorOptions,
  corridor: Extract<LaserDmxNegativeSpaceZone, { kind: 'rect' }>,
): LaserDmxShowDirectorBeamTarget[] {
  const count = rayCount(options, 4)
  const left = options.origin.x < (corridor.minX + corridor.maxX) * 0.5
  const safeX = left ? corridor.minX - 0.35 : corridor.maxX + 0.35
  const height = options.bounds.maxY - options.bounds.minY
  const centerY = clamp(options.localTargetCenter.y, options.bounds.minY + height * 0.1, options.bounds.maxY - height * 0.1)
  const span = Math.max(1, Math.tan(clamp(finite(options.fanSpreadDegrees ?? 44), 4, 110) * Math.PI / 360) * Math.abs(safeX - options.origin.x))
  const candidates = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1) * 2 - 1
    return point(safeX, centerY + span * t)
  })
  return finalizeTargets(candidates, {
    ...options,
    exclusionZones: [...(options.exclusionZones ?? []), corridor],
    negativeSpacePolicy: options.negativeSpacePolicy ?? 'redirect',
  })
}

export function targetAnglesFromOrigin(
  origin: LaserDmxLocalGeometryPoint,
  targets: readonly LaserDmxLocalGeometryPoint[],
): number[] {
  return targets.map(target => Math.atan2(target.y - origin.y, target.x - origin.x) * 180 / Math.PI)
}

export function unwrapOrderedAngles(angles: readonly number[]): number[] {
  if (angles.length === 0) return []
  const output = [angles[0]]
  for (let index = 1; index < angles.length; index++) {
    let value = angles[index]
    const previous = output[index - 1]
    while (value < previous - 180) value += 360
    while (value > previous + 180) value -= 360
    output.push(value)
  }
  return output
}
