import type {
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorOpticalPrimitiveType,
  LaserDmxShowDirectorWebGLQuality,
} from '../../ReactTypes'

export const LASER_DMX_SCANNER_DOMAIN_VERSION = 1

export interface LaserDmxScannerVec3 {
  x: number
  y: number
  z: number
}

export interface LaserDmxScannerColorChannels {
  r: number
  g: number
  b: number
  a: number
}

export type LaserDmxScanInterpolation = 'linear' | 'arc' | 'bezier'
export type LaserDmxScanRepeatMode = 'loop' | 'pingPong' | 'once'
export type LaserDmxScanDirection = 'forward' | 'reverse' | 'alternating'
export type LaserDmxScanCornerBehavior = 'continuous' | 'dwell' | 'blank'
export type LaserDmxScannerCompatibilityMode = 'native' | 'legacy-converted' | 'mixed' | 'inactive'
export type LaserDmxLegacyScannerConversionKind =
  | 'held'
  | 'fan'
  | 'polygon'
  | 'circle'
  | 'wave'
  | 'lattice'
  | 'cross'
  | 'corridor'
  | 'burst-scan'
  | 'burst-diffraction'
  | 'ordered-targets'

export interface LaserDmxScannerHead {
  schemaVersion: typeof LASER_DMX_SCANNER_DOMAIN_VERSION
  id: string
  fixtureId: string
  apertureIndex: number
  scanRatePps: number
  maximumAngularVelocity: number
  maximumAngularAcceleration: number
  pointDwellMicros: number
  cornerDwellMicros: number
  blankingDelayMicros: number
  retraceBlanking: boolean
  shutterExposureSeconds: number
  scanPhase: number
}

export interface LaserDmxScanPoint {
  id: string
  position: LaserDmxScannerVec3
  blanked: boolean
  dwellMicros: number
  intensity: number
  color: LaserDmxScannerColorChannels
  cornerBehavior?: LaserDmxScanCornerBehavior
  sourceTargetId?: string
}

export interface LaserDmxScanPath {
  schemaVersion: typeof LASER_DMX_SCANNER_DOMAIN_VERSION
  id: string
  fixtureId: string
  scannerHeadId: string
  points: LaserDmxScanPoint[]
  closed: boolean
  interpolation: LaserDmxScanInterpolation
  repeatMode: LaserDmxScanRepeatMode
  scanDirection: LaserDmxScanDirection
  durationBeats?: number
  conversionKind: LaserDmxLegacyScannerConversionKind | 'native'
  compatibilityMode: Exclude<LaserDmxScannerCompatibilityMode, 'inactive'>
  validationErrors: string[]
  migrationWarnings: string[]
}

export interface LaserDmxScannerOpticalCopy {
  id: string
  fixtureId: string
  scannerHeadId: string
  opticalCopyIndex: number
  kind: 'prism' | 'diffraction' | 'beamSplitter' | 'multiEmitter'
  rotationDeg: number
  intensityScale: number
}

export interface LaserDmxScannerInstantaneousRay {
  scannerHeadId: string
  fixtureId: string
  origin: LaserDmxScannerVec3
  targetOrDirection: LaserDmxScannerVec3
  sampleTime: number
  intensity: number
  color: LaserDmxScannerColorChannels
  blanked: boolean
  opticalCopyIndex: number
  pathId: string
  pointIndex: number
  velocityRatio: number
}

export interface LaserDmxExposureSample extends LaserDmxScannerInstantaneousRay {
  exposureWeight: number
}

export interface LaserDmxScannerDiagnostics {
  scannerHeadCount: number
  orderedPathCount: number
  exposureSampleCount: number
  legacyConvertedPathCount: number
  explicitOpticalCopyCount: number
  currentScanRatePps: number
  blankedSampleCount: number
  pathValidationErrorCount: number
  compatibilityMode: LaserDmxScannerCompatibilityMode
  migrationWarnings: string[]
}

export interface LaserDmxLegacyScannerTarget {
  id: string
  position: LaserDmxScannerVec3
}

export interface CreateLaserDmxLegacyScannerPlanInput {
  fixture: LaserDmxShowDirectorFixture
  origin: LaserDmxScannerVec3
  targets: readonly LaserDmxLegacyScannerTarget[]
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>
  color: LaserDmxScannerColorChannels
  shutterExposureSeconds: number
  occurrenceSeed: number
}

export interface LaserDmxLegacyScannerPlan {
  heads: LaserDmxScannerHead[]
  paths: LaserDmxScanPath[]
  opticalCopies: LaserDmxScannerOpticalCopy[]
}

export interface SolveLaserDmxScannerExposureInput {
  heads: readonly LaserDmxScannerHead[]
  paths: readonly LaserDmxScanPath[]
  opticalCopies: readonly LaserDmxScannerOpticalCopy[]
  originByFixtureId: ReadonlyMap<string, LaserDmxScannerVec3>
  audioTimeSec: number
  bpm: number
  quality: LaserDmxShowDirectorWebGLQuality
}

export interface SolveLaserDmxScannerExposureResult {
  instantaneousRays: LaserDmxScannerInstantaneousRay[]
  exposureSamples: LaserDmxExposureSample[]
  blankedSampleCount: number
}

interface LaserDmxScanTimelineEvent {
  kind: 'dwell' | 'travel'
  startSec: number
  endSec: number
  from: LaserDmxScanPoint
  to: LaserDmxScanPoint
  fromIndex: number
  toIndex: number
  blanked: boolean
  velocityRatio: number
}

export interface LaserDmxScannerTimelineEventDiagnostic {
  kind: 'dwell' | 'travel'
  startSec: number
  endSec: number
  fromIndex: number
  toIndex: number
  blanked: boolean
  velocityRatio: number
}

interface LaserDmxScanTimeline {
  events: LaserDmxScanTimelineEvent[]
  durationSec: number
  terminalPointIndex: number
}

interface LaserDmxScannerEvaluation {
  target: LaserDmxScannerVec3
  color: LaserDmxScannerColorChannels
  intensity: number
  blanked: boolean
  pathId: string
  pointIndex: number
  velocityRatio: number
}

const QUALITY_EXPOSURE_SAMPLES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, number>> = Object.freeze({
  low: 4,
  medium: 8,
  high: 16,
  ultra: 28,
  auto: 12,
})

const DEFAULT_SCANNER_RATE_PPS = 24_000
const DEFAULT_MAXIMUM_ANGULAR_VELOCITY = 18_000
const DEFAULT_MAXIMUM_ANGULAR_ACCELERATION = 1_200_000
const DEFAULT_POINT_DWELL_MICROS = 24
const DEFAULT_CORNER_DWELL_MICROS = 64
const DEFAULT_BLANKING_DELAY_MICROS = 18

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function stablePhase(value: string): number {
  return (stableHash(value) % 1_000_003) / 1_000_003
}

function distance(a: LaserDmxScannerVec3, b: LaserDmxScannerVec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z - a.z) * 0.7)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolate(
  a: LaserDmxScannerVec3,
  b: LaserDmxScannerVec3,
  t: number,
  mode: LaserDmxScanInterpolation,
): LaserDmxScannerVec3 {
  const progress = mode === 'linear'
    ? clamp01(t)
    : mode === 'arc'
      ? (1 - Math.cos(clamp01(t) * Math.PI)) * 0.5
      : clamp01(t) * clamp01(t) * (3 - 2 * clamp01(t))
  return {
    x: lerp(a.x, b.x, progress),
    y: lerp(a.y, b.y, progress),
    z: lerp(a.z, b.z, progress),
  }
}

function interpolateColor(
  a: LaserDmxScannerColorChannels,
  b: LaserDmxScannerColorChannels,
  t: number,
): LaserDmxScannerColorChannels {
  const progress = clamp01(t)
  return {
    r: lerp(a.r, b.r, progress),
    g: lerp(a.g, b.g, progress),
    b: lerp(a.b, b.b, progress),
    a: lerp(a.a, b.a, progress),
  }
}

function semanticText(fixture: LaserDmxShowDirectorFixture): string {
  return `${fixture.semanticKey ?? ''} ${fixture.label}`.trim().toLowerCase()
}

function centroid(targets: readonly LaserDmxLegacyScannerTarget[]): LaserDmxScannerVec3 {
  if (targets.length === 0) return { x: 0.5, y: 0.5, z: 0 }
  const total = targets.reduce((sum, target) => ({
    x: sum.x + target.position.x,
    y: sum.y + target.position.y,
    z: sum.z + target.position.z,
  }), { x: 0, y: 0, z: 0 })
  return {
    x: total.x / targets.length,
    y: total.y / targets.length,
    z: total.z / targets.length,
  }
}

function stablePerimeterOrder(targets: readonly LaserDmxLegacyScannerTarget[]): LaserDmxLegacyScannerTarget[] {
  const center = centroid(targets)
  return [...targets].sort((a, b) => {
    const angleA = Math.atan2(a.position.y - center.y, a.position.x - center.x)
    const angleB = Math.atan2(b.position.y - center.y, b.position.x - center.x)
    return angleA - angleB || distance(center, a.position) - distance(center, b.position) || a.id.localeCompare(b.id)
  })
}

function stableFanOrder(
  targets: readonly LaserDmxLegacyScannerTarget[],
  origin: LaserDmxScannerVec3,
): LaserDmxLegacyScannerTarget[] {
  return [...targets].sort((a, b) => {
    const angleA = Math.atan2(a.position.y - origin.y, a.position.x - origin.x)
    const angleB = Math.atan2(b.position.y - origin.y, b.position.x - origin.x)
    return angleA - angleB || a.id.localeCompare(b.id)
  })
}

function stableNearestNeighborOrder(targets: readonly LaserDmxLegacyScannerTarget[]): LaserDmxLegacyScannerTarget[] {
  if (targets.length <= 2) return [...targets]
  const remaining = [...targets].sort((a, b) => a.id.localeCompare(b.id))
  const result = [remaining.shift()!]
  while (remaining.length > 0) {
    const previous = result[result.length - 1]!
    remaining.sort((a, b) => distance(previous.position, a.position) - distance(previous.position, b.position) || a.id.localeCompare(b.id))
    result.push(remaining.shift()!)
  }
  return result
}

function createCircleTargets(
  fixture: LaserDmxShowDirectorFixture,
  targets: readonly LaserDmxLegacyScannerTarget[],
): LaserDmxLegacyScannerTarget[] {
  const center = targets.length > 1 ? centroid(targets) : { x: 0.5, y: 0.5, z: targets[0]?.position.z ?? 0 }
  const measuredRadius = targets.reduce((maximum, target) => Math.max(maximum, distance(center, target.position)), 0)
  const radius = clamp(measuredRadius || fixture.optics.fanWidth / 360 || 0.24, 0.08, 0.46)
  const count = Math.max(12, Math.min(24, Math.max(targets.length, fixture.optics.rayCount)))
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2
    return {
      id: `${fixture.id}-scanner-circle-${index + 1}`,
      position: {
        x: clamp01(center.x + Math.cos(angle) * radius),
        y: clamp01(center.y + Math.sin(angle) * radius * 0.76),
        z: center.z,
      },
    }
  })
}

function classifyLegacyConversion(
  fixture: LaserDmxShowDirectorFixture,
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>,
  targetCount: number,
): LaserDmxLegacyScannerConversionKind {
  const semantic = semanticText(fixture)
  if (semantic.includes('circle') || semantic.includes('ring')) return 'circle'
  if (semantic.includes('disconnected') || semantic.includes('island') || semantic.includes('multi shape')) return 'ordered-targets'
  if (targetCount <= 1) return 'held'
  if (primitiveType === 'scannerWave' || semantic.includes('wave')) return 'wave'
  if (primitiveType === 'rotatingLattice' || semantic.includes('lattice')) return 'lattice'
  if (primitiveType === 'apertureBurst' || semantic.includes('burst')) {
    return fixture.optics.prismFacets > 1 ? 'burst-diffraction' : 'burst-scan'
  }
  if (primitiveType === 'crossBank' || fixture.beam.targetMode === 'cross') return 'cross'
  if (primitiveType === 'tunnel' || primitiveType === 'mirroredCorridor' || semantic.includes('corridor') || semantic.includes('cage')) return 'corridor'
  if (primitiveType === 'fan' || primitiveType === 'layeredFan' || fixture.beam.targetMode === 'fan' || fixture.beam.targetMode === 'sweep') return 'fan'
  if (semantic.includes('triangle') || semantic.includes('polygon') || primitiveType === 'diamondPlane' || (fixture.beam.targetMode === 'fixed' && targetCount >= 3)) return 'polygon'
  return 'ordered-targets'
}

function orderedTargetsForConversion(
  conversionKind: LaserDmxLegacyScannerConversionKind,
  fixture: LaserDmxShowDirectorFixture,
  origin: LaserDmxScannerVec3,
  targets: readonly LaserDmxLegacyScannerTarget[],
): LaserDmxLegacyScannerTarget[] {
  switch (conversionKind) {
    case 'circle':
      return createCircleTargets(fixture, targets)
    case 'polygon':
    case 'lattice':
    case 'burst-scan':
    case 'burst-diffraction':
      return stablePerimeterOrder(targets)
    case 'fan':
    case 'cross':
      return stableFanOrder(targets, origin)
    case 'wave':
      return [...targets].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id))
    case 'corridor':
      return stableNearestNeighborOrder(targets)
    case 'held':
    case 'ordered-targets':
    default:
      return [...targets]
  }
}

function defaultPathBehavior(conversionKind: LaserDmxLegacyScannerConversionKind): Pick<LaserDmxScanPath, 'closed' | 'interpolation' | 'repeatMode' | 'scanDirection'> {
  switch (conversionKind) {
    case 'polygon':
    case 'circle':
    case 'lattice':
    case 'burst-scan':
    case 'burst-diffraction':
      return { closed: true, interpolation: conversionKind === 'circle' ? 'arc' : 'linear', repeatMode: 'loop', scanDirection: 'forward' }
    case 'wave':
      return { closed: false, interpolation: 'bezier', repeatMode: 'pingPong', scanDirection: 'alternating' }
    case 'fan':
    case 'cross':
      return { closed: false, interpolation: 'arc', repeatMode: 'pingPong', scanDirection: 'alternating' }
    case 'held':
      return { closed: false, interpolation: 'linear', repeatMode: 'loop', scanDirection: 'forward' }
    case 'corridor':
    case 'ordered-targets':
    default:
      return { closed: false, interpolation: 'linear', repeatMode: 'loop', scanDirection: 'forward' }
  }
}

function insertBlankedRetraces(points: readonly LaserDmxScanPoint[]): LaserDmxScanPoint[] {
  if (points.length < 4) return [...points]
  const spans = points.slice(1).map((point, index) => distance(points[index]!.position, point.position))
  const sorted = [...spans].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  if (median <= 1e-6) return [...points]
  const threshold = Math.max(0.52, median * 3.4)
  const result: LaserDmxScanPoint[] = [points[0]!]
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!
    const previous = points[index - 1]!
    if (distance(previous.position, point.position) > threshold) {
      result.push({
        ...point,
        id: `${point.id}-blanked-retrace`,
        blanked: true,
        intensity: 0,
        dwellMicros: 0,
        cornerBehavior: 'blank',
      })
    }
    result.push(point)
  }
  return result
}

export function validateLaserDmxScanPath(path: LaserDmxScanPath): string[] {
  const errors: string[] = []
  if (!path.id.trim()) errors.push('Path id is required.')
  if (!path.fixtureId.trim()) errors.push('Fixture id is required.')
  if (!path.scannerHeadId.trim()) errors.push('Scanner head id is required.')
  if (path.points.length === 0) errors.push('At least one scan point is required.')
  path.points.forEach((point, index) => {
    if (!point.id.trim()) errors.push(`Point ${index + 1} requires an id.`)
    if (![point.position.x, point.position.y, point.position.z].every(Number.isFinite)) errors.push(`Point ${index + 1} has an invalid position.`)
    if (!Number.isFinite(point.intensity) || point.intensity < 0 || point.intensity > 1) errors.push(`Point ${index + 1} intensity must be between 0 and 1.`)
    if (!Number.isFinite(point.dwellMicros) || point.dwellMicros < 0) errors.push(`Point ${index + 1} dwell must be non-negative.`)
  })
  if (path.closed && path.points.length < 3) errors.push('Closed paths require at least three points.')
  return errors
}

export function createDefaultLaserDmxScannerHead(
  fixtureId: string,
  apertureIndex = 0,
  shutterExposureSeconds = 1 / 60,
  scanPhase = stablePhase(fixtureId),
): LaserDmxScannerHead {
  return {
    schemaVersion: LASER_DMX_SCANNER_DOMAIN_VERSION,
    id: `${fixtureId}-scanner-${apertureIndex + 1}`,
    fixtureId,
    apertureIndex,
    scanRatePps: DEFAULT_SCANNER_RATE_PPS,
    maximumAngularVelocity: DEFAULT_MAXIMUM_ANGULAR_VELOCITY,
    maximumAngularAcceleration: DEFAULT_MAXIMUM_ANGULAR_ACCELERATION,
    pointDwellMicros: DEFAULT_POINT_DWELL_MICROS,
    cornerDwellMicros: DEFAULT_CORNER_DWELL_MICROS,
    blankingDelayMicros: DEFAULT_BLANKING_DELAY_MICROS,
    retraceBlanking: true,
    shutterExposureSeconds: clamp(shutterExposureSeconds, 1 / 240, 1 / 12),
    scanPhase: clamp01(scanPhase),
  }
}

export function createLaserDmxLegacyScannerPlan(input: CreateLaserDmxLegacyScannerPlanInput): LaserDmxLegacyScannerPlan {
  if (input.fixture.kind !== 'laser' || !input.fixture.beam.beamEnabled || input.targets.length === 0) {
    return { heads: [], paths: [], opticalCopies: [] }
  }
  const head = createDefaultLaserDmxScannerHead(
    input.fixture.id,
    0,
    input.shutterExposureSeconds,
    stablePhase(`${input.fixture.semanticKey ?? input.fixture.id}:${input.occurrenceSeed}`),
  )
  const conversionKind = classifyLegacyConversion(input.fixture, input.primitiveType, input.targets.length)
  const orderedTargets = orderedTargetsForConversion(conversionKind, input.fixture, input.origin, input.targets)
  const behavior = defaultPathBehavior(conversionKind)
  const basePoints = orderedTargets.map((target, index): LaserDmxScanPoint => ({
    id: `${head.id}-point-${index + 1}`,
    position: { ...target.position },
    blanked: false,
    dwellMicros: conversionKind === 'held' ? Math.max(head.pointDwellMicros, 1_000) : head.pointDwellMicros,
    intensity: clamp01(input.fixture.brightness),
    color: { ...input.color },
    cornerBehavior: conversionKind === 'polygon' || conversionKind === 'lattice' ? 'dwell' : 'continuous',
    sourceTargetId: target.id,
  }))
  const points = behavior.closed ? basePoints : insertBlankedRetraces(basePoints)
  const migrationWarnings: string[] = []
  if (conversionKind === 'cross' && input.targets.length > 2) migrationWarnings.push('Legacy cross targets were converted into one ordered sweep for this physical fixture.')
  if (conversionKind === 'corridor') migrationWarnings.push('Legacy corridor targets remain fixture-local; phase coordination across distinct fixtures is preserved by deterministic scanner phase.')
  if (conversionKind === 'burst-scan') migrationWarnings.push('Legacy burst rays were converted into a rapid ordered radial scan because no explicit prism or diffraction mode is active.')
  if (conversionKind === 'burst-diffraction') migrationWarnings.push('Legacy burst uses explicit prism copies; the base scanner still emits one instantaneous beam.')
  const path: LaserDmxScanPath = {
    schemaVersion: LASER_DMX_SCANNER_DOMAIN_VERSION,
    id: `${input.fixture.id}-legacy-scan-path`,
    fixtureId: input.fixture.id,
    scannerHeadId: head.id,
    points,
    ...behavior,
    conversionKind,
    compatibilityMode: 'legacy-converted',
    validationErrors: [],
    migrationWarnings,
  }
  path.validationErrors = validateLaserDmxScanPath(path)

  const prismFacets = Math.max(1, Math.round(input.fixture.optics.prismFacets))
  const copyCount = prismFacets > 1 ? prismFacets - 1 : 0
  const opticalCopies = Array.from({ length: copyCount }, (_, index): LaserDmxScannerOpticalCopy => {
    const centered = index - (copyCount - 1) / 2
    const nonZeroCentered = centered >= 0 ? centered + 0.5 : centered - 0.5
    return {
      id: `${head.id}-prism-copy-${index + 1}`,
      fixtureId: input.fixture.id,
      scannerHeadId: head.id,
      opticalCopyIndex: index + 1,
      kind: 'prism',
      rotationDeg: input.fixture.optics.prismRotation + nonZeroCentered * 5.5,
      intensityScale: clamp(0.78 / Math.max(1, Math.sqrt(prismFacets)), 0.24, 0.62),
    }
  })

  return { heads: [head], paths: [path], opticalCopies }
}

function cornerAngleDegrees(points: readonly LaserDmxScanPoint[], index: number, closed: boolean): number {
  if (points.length < 3) return 0
  const previous = points[index - 1] ?? (closed ? points[points.length - 1] : null)
  const current = points[index]
  const next = points[index + 1] ?? (closed ? points[0] : null)
  if (!previous || !current || !next) return 0
  const ax = previous.position.x - current.position.x
  const ay = previous.position.y - current.position.y
  const az = (previous.position.z - current.position.z) * 0.7
  const bx = next.position.x - current.position.x
  const by = next.position.y - current.position.y
  const bz = (next.position.z - current.position.z) * 0.7
  const denominator = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz)
  if (denominator <= 1e-8) return 0
  return Math.acos(clamp((ax * bx + ay * by + az * bz) / denominator, -1, 1)) * 180 / Math.PI
}

function pointDwellSeconds(
  head: LaserDmxScannerHead,
  path: LaserDmxScanPath,
  pointIndex: number,
): number {
  const point = path.points[pointIndex]
  if (!point) return 0
  const base = Math.max(0, point.dwellMicros || head.pointDwellMicros)
  const cornerAngle = cornerAngleDegrees(path.points, pointIndex, path.closed)
  const cornerDwell = point.cornerBehavior === 'dwell' || cornerAngle < 145
    ? head.cornerDwellMicros * clamp01((145 - cornerAngle) / 120)
    : 0
  return (base + cornerDwell) / 1_000_000
}

function travelDurationSeconds(
  head: LaserDmxScannerHead,
  from: LaserDmxScanPoint,
  to: LaserDmxScanPoint,
): { durationSec: number; velocityRatio: number } {
  const angularDistance = Math.max(0, distance(from.position, to.position) * 90)
  if (angularDistance <= 1e-7) return { durationSec: 1 / Math.max(1, head.scanRatePps), velocityRatio: 0 }
  const pointRateBound = 1 / Math.max(1, head.scanRatePps)
  const velocityBound = angularDistance / Math.max(1, head.maximumAngularVelocity)
  const accelerationBound = 2 * Math.sqrt(angularDistance / Math.max(1, head.maximumAngularAcceleration))
  const durationSec = Math.max(pointRateBound, velocityBound, accelerationBound)
  const achievedVelocity = angularDistance / Math.max(durationSec, 1e-9)
  return {
    durationSec,
    velocityRatio: clamp01(achievedVelocity / Math.max(1, head.maximumAngularVelocity)),
  }
}

export function resolveLaserDmxScannerTravelDurationSeconds(
  head: LaserDmxScannerHead,
  from: LaserDmxScanPoint,
  to: LaserDmxScanPoint,
): { durationSec: number; velocityRatio: number } {
  return travelDurationSeconds(head, from, to)
}

function traversalIndices(path: LaserDmxScanPath, reversed: boolean): number[] {
  const indices = path.points.map((_, index) => index)
  return reversed ? indices.reverse() : indices
}

function buildTimeline(
  head: LaserDmxScannerHead,
  path: LaserDmxScanPath,
  reversed: boolean,
  bpm: number,
): LaserDmxScanTimeline {
  const indices = traversalIndices(path, reversed)
  if (indices.length === 0) return { events: [], durationSec: 0, terminalPointIndex: 0 }
  if (indices.length === 1) {
    const point = path.points[indices[0]!]!
    const durationSec = Math.max(1 / Math.max(1, head.scanRatePps), pointDwellSeconds(head, path, indices[0]!))
    return {
      events: [{
        kind: 'dwell',
        startSec: 0,
        endSec: durationSec,
        from: point,
        to: point,
        fromIndex: indices[0]!,
        toIndex: indices[0]!,
        blanked: point.blanked,
        velocityRatio: 0,
      }],
      durationSec,
      terminalPointIndex: indices[0]!,
    }
  }

  const events: LaserDmxScanTimelineEvent[] = []
  let cursor = 0
  const appendDwell = (index: number) => {
    const point = path.points[index]!
    const durationSec = Math.max(1 / Math.max(1, head.scanRatePps), pointDwellSeconds(head, path, index))
    events.push({
      kind: 'dwell', startSec: cursor, endSec: cursor + durationSec,
      from: point, to: point, fromIndex: index, toIndex: index,
      blanked: point.blanked, velocityRatio: 0,
    })
    cursor += durationSec
  }
  const appendTravel = (fromIndex: number, toIndex: number, retrace = false) => {
    const from = path.points[fromIndex]!
    const to = path.points[toIndex]!
    const travel = travelDurationSeconds(head, from, to)
    const blanked = from.blanked || to.blanked || from.cornerBehavior === 'blank' || to.cornerBehavior === 'blank' || (retrace && head.retraceBlanking)
    const blankingPadding = blanked ? head.blankingDelayMicros / 1_000_000 : 0
    const durationSec = travel.durationSec + blankingPadding
    events.push({
      kind: 'travel', startSec: cursor, endSec: cursor + durationSec,
      from, to, fromIndex, toIndex, blanked, velocityRatio: travel.velocityRatio,
    })
    cursor += durationSec
  }

  appendDwell(indices[0]!)
  for (let index = 1; index < indices.length; index += 1) {
    appendTravel(indices[index - 1]!, indices[index]!)
    appendDwell(indices[index]!)
  }
  if (path.closed) {
    appendTravel(indices[indices.length - 1]!, indices[0]!)
  } else if (path.repeatMode === 'loop') {
    appendTravel(indices[indices.length - 1]!, indices[0]!, true)
  } else if (path.repeatMode === 'pingPong') {
    for (let index = indices.length - 2; index >= 0; index -= 1) {
      appendTravel(indices[index + 1]!, indices[index]!)
      appendDwell(indices[index]!)
    }
  }

  const requestedDurationSec = path.durationBeats != null && bpm > 0
    ? path.durationBeats * 60 / bpm
    : null
  if (requestedDurationSec != null && requestedDurationSec > cursor) {
    const scale = requestedDurationSec / Math.max(cursor, 1e-9)
    events.forEach(event => {
      event.startSec *= scale
      event.endSec *= scale
      if (event.kind === 'travel') event.velocityRatio = clamp01(event.velocityRatio / scale)
    })
    cursor = requestedDurationSec
  }

  return { events, durationSec: cursor, terminalPointIndex: indices[indices.length - 1]! }
}

export function buildLaserDmxScannerTimelineDiagnostics(
  head: LaserDmxScannerHead,
  path: LaserDmxScanPath,
  bpm: number,
  reversed = false,
): { durationSec: number; events: LaserDmxScannerTimelineEventDiagnostic[] } {
  const timeline = buildTimeline(head, path, reversed, bpm)
  return {
    durationSec: timeline.durationSec,
    events: timeline.events.map(event => ({
      kind: event.kind,
      startSec: event.startSec,
      endSec: event.endSec,
      fromIndex: event.fromIndex,
      toIndex: event.toIndex,
      blanked: event.blanked,
      velocityRatio: event.velocityRatio,
    })),
  }
}

function evaluateTimeline(
  head: LaserDmxScannerHead,
  path: LaserDmxScanPath,
  audioTimeSec: number,
  bpm: number,
): LaserDmxScannerEvaluation | null {
  if (path.points.length === 0) return null
  const forwardTimeline = buildTimeline(head, path, path.scanDirection === 'reverse', bpm)
  if (forwardTimeline.durationSec <= 0 || forwardTimeline.events.length === 0) return null
  const phaseOffsetSec = head.scanPhase * forwardTimeline.durationSec
  const absolute = Math.max(0, audioTimeSec) + phaseOffsetSec
  const baseCycleIndex = Math.floor(absolute / forwardTimeline.durationSec)
  const alternatingReverse = path.scanDirection === 'alternating' && baseCycleIndex % 2 === 1
  const timeline = alternatingReverse ? buildTimeline(head, path, true, bpm) : forwardTimeline
  const localTime = path.repeatMode === 'once'
    ? Math.min(absolute, Math.max(0, timeline.durationSec - 1e-9))
    : ((absolute % timeline.durationSec) + timeline.durationSec) % timeline.durationSec
  const event = timeline.events.find(candidate => localTime >= candidate.startSec && localTime < candidate.endSec)
    ?? timeline.events[timeline.events.length - 1]
  if (!event) return null
  const duration = Math.max(1e-9, event.endSec - event.startSec)
  const progress = event.kind === 'dwell' ? 0 : clamp01((localTime - event.startSec) / duration)
  return {
    target: event.kind === 'dwell'
      ? { ...event.to.position }
      : interpolate(event.from.position, event.to.position, progress, path.interpolation),
    color: event.kind === 'dwell'
      ? { ...event.to.color }
      : interpolateColor(event.from.color, event.to.color, progress),
    intensity: event.kind === 'dwell'
      ? event.to.intensity
      : lerp(event.from.intensity, event.to.intensity, progress),
    blanked: event.blanked,
    pathId: path.id,
    pointIndex: event.kind === 'dwell' ? event.toIndex : event.fromIndex,
    velocityRatio: event.velocityRatio,
  }
}

function rotateTargetAroundOrigin(
  origin: LaserDmxScannerVec3,
  target: LaserDmxScannerVec3,
  rotationDeg: number,
): LaserDmxScannerVec3 {
  if (Math.abs(rotationDeg) < 1e-7) return { ...target }
  const radians = rotationDeg * Math.PI / 180
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  return {
    x: origin.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: origin.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    z: target.z,
  }
}

export function evaluateLaserDmxScannerAtTime(
  head: LaserDmxScannerHead,
  path: LaserDmxScanPath,
  audioTimeSec: number,
  bpm: number,
): LaserDmxScannerEvaluation | null {
  return evaluateTimeline(head, path, audioTimeSec, bpm)
}

export function solveLaserDmxScannerExposure(input: SolveLaserDmxScannerExposureInput): SolveLaserDmxScannerExposureResult {
  const pathByHead = new Map(input.paths.map(path => [path.scannerHeadId, path]))
  const copiesByHead = new Map<string, LaserDmxScannerOpticalCopy[]>()
  for (const copy of input.opticalCopies) {
    const copies = copiesByHead.get(copy.scannerHeadId) ?? []
    copies.push(copy)
    copiesByHead.set(copy.scannerHeadId, copies)
  }
  const instantaneousRays: LaserDmxScannerInstantaneousRay[] = []
  const exposureSamples: LaserDmxExposureSample[] = []
  let blankedSampleCount = 0

  for (const head of input.heads) {
    const path = pathByHead.get(head.id)
    const origin = input.originByFixtureId.get(head.fixtureId)
    if (!path || !origin || path.validationErrors.length > 0) continue
    const current = evaluateTimeline(head, path, input.audioTimeSec, input.bpm)
    if (current) {
      instantaneousRays.push({
        scannerHeadId: head.id,
        fixtureId: head.fixtureId,
        origin: { ...origin },
        targetOrDirection: { ...current.target },
        sampleTime: input.audioTimeSec,
        intensity: clamp01(current.intensity),
        color: { ...current.color },
        blanked: current.blanked,
        opticalCopyIndex: 0,
        pathId: current.pathId,
        pointIndex: current.pointIndex,
        velocityRatio: current.velocityRatio,
      })
    }

    const sampleCount = QUALITY_EXPOSURE_SAMPLES[input.quality]
    const exposureSeconds = clamp(head.shutterExposureSeconds, 1 / 240, 1 / 12)
    const directSamples: Array<{ evaluation: LaserDmxScannerEvaluation; sampleTime: number; rawWeight: number }> = []
    const blankedSamples: Array<{ evaluation: LaserDmxScannerEvaluation; sampleTime: number }> = []
    for (let index = 0; index < sampleCount; index += 1) {
      const sampleTime = input.audioTimeSec - exposureSeconds + (index + 0.5) / sampleCount * exposureSeconds
      const evaluation = evaluateTimeline(head, path, Math.max(0, sampleTime), input.bpm)
      if (!evaluation) continue
      if (evaluation.blanked) {
        blankedSampleCount += 1
        blankedSamples.push({ evaluation, sampleTime: Math.max(0, sampleTime) })
        continue
      }
      const velocityWeight = lerp(1.65, 0.52, evaluation.velocityRatio)
      directSamples.push({ evaluation, sampleTime: Math.max(0, sampleTime), rawWeight: velocityWeight })
    }
    const totalRawWeight = directSamples.reduce((sum, sample) => sum + sample.rawWeight, 0) || 1
    const copies = copiesByHead.get(head.id) ?? []
    for (const sample of blankedSamples) {
      exposureSamples.push({
        scannerHeadId: head.id,
        fixtureId: head.fixtureId,
        origin: { ...origin },
        targetOrDirection: { ...sample.evaluation.target },
        sampleTime: sample.sampleTime,
        exposureWeight: 0,
        intensity: 0,
        color: { ...sample.evaluation.color },
        blanked: true,
        opticalCopyIndex: 0,
        pathId: sample.evaluation.pathId,
        pointIndex: sample.evaluation.pointIndex,
        velocityRatio: sample.evaluation.velocityRatio,
      })
      for (const copy of copies) {
        exposureSamples.push({
          scannerHeadId: head.id,
          fixtureId: head.fixtureId,
          origin: { ...origin },
          targetOrDirection: rotateTargetAroundOrigin(origin, sample.evaluation.target, copy.rotationDeg),
          sampleTime: sample.sampleTime,
          exposureWeight: 0,
          intensity: 0,
          color: { ...sample.evaluation.color },
          blanked: true,
          opticalCopyIndex: copy.opticalCopyIndex,
          pathId: sample.evaluation.pathId,
          pointIndex: sample.evaluation.pointIndex,
          velocityRatio: sample.evaluation.velocityRatio,
        })
      }
    }
    for (const sample of directSamples) {
      const directWeight = sample.rawWeight / totalRawWeight
      exposureSamples.push({
        scannerHeadId: head.id,
        fixtureId: head.fixtureId,
        origin: { ...origin },
        targetOrDirection: { ...sample.evaluation.target },
        sampleTime: sample.sampleTime,
        exposureWeight: directWeight,
        intensity: clamp01(sample.evaluation.intensity),
        color: { ...sample.evaluation.color },
        blanked: false,
        opticalCopyIndex: 0,
        pathId: sample.evaluation.pathId,
        pointIndex: sample.evaluation.pointIndex,
        velocityRatio: sample.evaluation.velocityRatio,
      })
      for (const copy of copies) {
        exposureSamples.push({
          scannerHeadId: head.id,
          fixtureId: head.fixtureId,
          origin: { ...origin },
          targetOrDirection: rotateTargetAroundOrigin(origin, sample.evaluation.target, copy.rotationDeg),
          sampleTime: sample.sampleTime,
          exposureWeight: directWeight,
          intensity: clamp01(sample.evaluation.intensity * copy.intensityScale),
          color: { ...sample.evaluation.color },
          blanked: false,
          opticalCopyIndex: copy.opticalCopyIndex,
          pathId: sample.evaluation.pathId,
          pointIndex: sample.evaluation.pointIndex,
          velocityRatio: sample.evaluation.velocityRatio,
        })
      }
    }
  }

  exposureSamples.sort((a, b) => a.sampleTime - b.sampleTime || a.scannerHeadId.localeCompare(b.scannerHeadId) || a.opticalCopyIndex - b.opticalCopyIndex)
  instantaneousRays.sort((a, b) => a.scannerHeadId.localeCompare(b.scannerHeadId))
  return { instantaneousRays, exposureSamples, blankedSampleCount }
}

export function createLaserDmxScannerDiagnostics(input: {
  heads: readonly LaserDmxScannerHead[]
  paths: readonly LaserDmxScanPath[]
  opticalCopies: readonly LaserDmxScannerOpticalCopy[]
  exposureSamples: readonly LaserDmxExposureSample[]
  blankedSampleCount: number
}): LaserDmxScannerDiagnostics {
  const compatibilityModes = new Set(input.paths.map(path => path.compatibilityMode))
  const compatibilityMode: LaserDmxScannerCompatibilityMode = input.heads.length === 0
    ? 'inactive'
    : compatibilityModes.size > 1
      ? 'mixed'
      : compatibilityModes.has('native')
        ? 'native'
        : 'legacy-converted'
  return {
    scannerHeadCount: input.heads.length,
    orderedPathCount: input.paths.length,
    exposureSampleCount: input.exposureSamples.length,
    legacyConvertedPathCount: input.paths.filter(path => path.compatibilityMode === 'legacy-converted').length,
    explicitOpticalCopyCount: input.opticalCopies.length,
    currentScanRatePps: input.heads.length > 0
      ? Math.round(input.heads.reduce((sum, head) => sum + head.scanRatePps, 0) / input.heads.length)
      : 0,
    blankedSampleCount: input.blankedSampleCount,
    pathValidationErrorCount: input.paths.reduce((sum, path) => sum + path.validationErrors.length, 0),
    compatibilityMode,
    migrationWarnings: input.paths.flatMap(path => path.migrationWarnings),
  }
}
