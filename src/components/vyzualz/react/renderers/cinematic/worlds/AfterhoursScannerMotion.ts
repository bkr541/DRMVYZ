import type { AfterhoursPattern } from '../../../CinematicWorldSettings'
import {
  evaluateLaserDmxScannerAtTime,
  type LaserDmxScanPath,
  type LaserDmxScanPoint,
  type LaserDmxScanRepeatMode,
  type LaserDmxScannerHead,
} from '../../laserDmx/LaserDmxScannerDomain'
import { getAfterhoursSceneDefinition } from './AfterhoursSceneCatalog'

/**
 * Stage 5 scanner-motion adapter.
 *
 * Afterhours keeps its own 2D ray/topology vocabulary, but delegates temporal
 * traversal to the production Laser/DMX scanner domain. That gives this world
 * the same acceleration-bounded interpolation, dwell, loop/ping-pong behavior,
 * and retrace blanking semantics without creating a second scanner clock.
 */

export type AfterhoursScannerMotionMode =
  | 'largeSweep'
  | 'fanOpenClose'
  | 'opposingSweep'
  | 'centerOut'
  | 'topologyRotation'
  | 'bankChase'
  | 'geometricTraversal'
  | 'boundedHold'

export interface AfterhoursScannerVec2 {
  readonly x: number
  readonly y: number
}

export interface AfterhoursScannerMotionInput {
  readonly pattern: AfterhoursPattern
  readonly origin: AfterhoursScannerVec2
  readonly baseDirection: AfterhoursScannerVec2
  readonly aspect: number
  readonly motionPhase: number
  readonly motionAuthority: number
  readonly symmetrySide: 'left' | 'right' | 'center' | null
  readonly bank: 'bottom' | 'left' | 'right' | 'top'
  readonly slot: number
}

export interface AfterhoursScannerMotionResult {
  readonly direction: AfterhoursScannerVec2
  readonly blanked: boolean
  readonly retrace: boolean
  readonly velocityRatio: number
  readonly accelerationRatio: number
  readonly mode: AfterhoursScannerMotionMode
}

const WHITE = Object.freeze({ r: 1, g: 1, b: 1, a: 1 })
const SCANNER_BPM = 60
const PATH_DURATION_BEATS = 1
const MAX_SWEEP_DEG = 54
const EPSILON = 1e-8

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function normalize(value: AfterhoursScannerVec2, fallback: AfterhoursScannerVec2): AfterhoursScannerVec2 {
  const length = Math.hypot(value.x, value.y)
  if (length <= EPSILON) return fallback
  return { x: value.x / length, y: value.y / length }
}

function fieldOrigin(origin: AfterhoursScannerVec2, aspect: number): AfterhoursScannerVec2 {
  return { x: (origin.x - 0.5) * aspect, y: origin.y - 0.5 }
}

function rotate(direction: AfterhoursScannerVec2, angleDeg: number): AfterhoursScannerVec2 {
  const angle = angleDeg * Math.PI / 180
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return normalize({
    x: direction.x * c - direction.y * s,
    y: direction.x * s + direction.y * c,
  }, direction)
}

function aimPoint(
  origin: AfterhoursScannerVec2,
  direction: AfterhoursScannerVec2,
  angleDeg: number,
  distance = 1.6,
): AfterhoursScannerVec2 {
  const rotated = rotate(direction, angleDeg)
  return { x: origin.x + rotated.x * distance, y: origin.y + rotated.y * distance }
}

function scanPoint(id: string, position: AfterhoursScannerVec2, dwellMicros: number): LaserDmxScanPoint {
  return {
    id,
    position: { x: position.x, y: position.y, z: 0 },
    blanked: false,
    dwellMicros,
    cornerDwellMicros: dwellMicros,
    intensity: 1,
    color: WHITE,
    cornerBehavior: dwellMicros > 0 ? 'dwell' : 'continuous',
  }
}

function authoritySweepDegrees(authority: number): number {
  // Literal authority with an intentionally useful midpoint:
  // .25 ~= 8.7°, .50 ~= 21.7°, .75 ~= 36.9°, 1.0 = 54°.
  const a = clamp01(authority)
  return MAX_SWEEP_DEG * Math.pow(a, 1.32)
}

function pairOrdinal(slot: number): number {
  return Math.max(0, Math.floor(slot / 2))
}

function bankPhase(bank: AfterhoursScannerMotionInput['bank']): number {
  if (bank === 'bottom') return 0
  if (bank === 'left' || bank === 'right') return 0.25
  return 0.5
}

function scannerMode(pattern: AfterhoursPattern): AfterhoursScannerMotionMode {
  switch (pattern) {
    case 'wideFan': return 'fanOpenClose'
    case 'splitWings': return 'opposingSweep'
    case 'crossCanopy': return 'centerOut'
    case 'diamondStar': return 'geometricTraversal'
    case 'chevronRoof': return 'topologyRotation'
    case 'radialCrown': return 'topologyRotation'
    case 'sparseArchitecture': return 'boundedHold'
    case 'fullRig': return 'bankChase'
    default: return 'largeSweep'
  }
}

function phaseOffset(input: AfterhoursScannerMotionInput): number {
  const pair = pairOrdinal(input.slot)
  switch (input.pattern) {
    case 'crossCanopy': return (pair % 2) * 0.5
    case 'radialCrown': return (pair % 8) / 8
    case 'sparseArchitecture': return (pair % 2) * 0.5
    case 'fullRig': return bankPhase(input.bank)
    default: return 0
  }
}

function anglePath(
  input: AfterhoursScannerMotionInput,
  angles: readonly number[],
  repeatMode: LaserDmxScanRepeatMode,
  dwellMicros: number,
): { points: LaserDmxScanPoint[]; repeatMode: LaserDmxScanRepeatMode } {
  const origin = fieldOrigin(input.origin, input.aspect)
  const mirror = input.symmetrySide === 'right' ? -1 : 1
  return {
    points: angles.map((angle, index) => scanPoint(
      `afterhours-${input.pattern}-${input.slot}-${index}`,
      aimPoint(origin, input.baseDirection, angle * mirror),
      dwellMicros,
    )),
    repeatMode,
  }
}

function geometricPath(
  input: AfterhoursScannerMotionInput,
): { points: LaserDmxScanPoint[]; repeatMode: LaserDmxScanRepeatMode } | null {
  const authored = getAfterhoursSceneDefinition(input.pattern).scanPath?.points
  if (!authored || authored.length < 2) return null

  // The catalog's diamond path repeats its first point for static readability.
  // The scanner timeline authors the closure itself, so drop that duplicate and
  // let the generic loop retrace be explicitly blanked.
  const points = [...authored]
  if (points.length > 2) {
    const first = points[0]!
    const last = points[points.length - 1]!
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-7) points.pop()
  }
  const mirror = input.symmetrySide === 'right'
  return {
    points: points.map((point, index) => scanPoint(
      `afterhours-${input.pattern}-path-${index}`,
      {
        x: ((mirror ? 1 - point.x : point.x) - 0.5) * input.aspect,
        y: point.y - 0.5,
      },
      18_000,
    )),
    repeatMode: 'loop',
  }
}

function createScannerHead(input: AfterhoursScannerMotionInput): LaserDmxScannerHead {
  return {
    schemaVersion: 1,
    id: `afterhours-scanner-head-${input.slot}`,
    fixtureId: `afterhours-scanner-fixture-${input.slot}`,
    apertureIndex: 0,
    scanRatePps: 30_000,
    maximumAngularVelocity: 720,
    maximumAngularAcceleration: 7_200,
    pointDwellMicros: 0,
    cornerDwellMicros: 0,
    blankingDelayMicros: 250,
    retraceBlanking: true,
    shutterExposureSeconds: 0.065,
    scanPhase: phaseOffset(input),
  }
}

function createScannerPath(
  input: AfterhoursScannerMotionInput,
  points: LaserDmxScanPoint[],
  repeatMode: LaserDmxScanRepeatMode,
): LaserDmxScanPath {
  return {
    schemaVersion: 1,
    id: `afterhours-scanner-path-${input.pattern}-${input.slot}`,
    fixtureId: `afterhours-scanner-fixture-${input.slot}`,
    scannerHeadId: `afterhours-scanner-head-${input.slot}`,
    points,
    closed: false,
    interpolation: 'linear',
    repeatMode,
    scanDirection: 'forward',
    durationBeats: PATH_DURATION_BEATS,
    conversionKind: 'native',
    compatibilityMode: 'native',
    validationErrors: [],
    migrationWarnings: [],
    presentationMode: 'scannedPath',
    patternAnimationActive: true,
    fixtureMovementActive: false,
  }
}

function motionPath(input: AfterhoursScannerMotionInput): {
  points: LaserDmxScanPoint[]
  repeatMode: LaserDmxScanRepeatMode
} {
  const amplitude = authoritySweepDegrees(input.motionAuthority)
  switch (input.pattern) {
    case 'wideFan':
      return anglePath(input, [-amplitude, amplitude], 'pingPong', 24_000)
    case 'splitWings':
      return anglePath(input, [-amplitude * 0.92, amplitude * 0.92], 'pingPong', 18_000)
    case 'crossCanopy':
      return anglePath(input, [0, amplitude * 0.78, 0, -amplitude * 0.78], 'pingPong', 10_000)
    case 'diamondStar':
      return geometricPath(input) ?? anglePath(input, [-amplitude * 0.75, amplitude * 0.75], 'pingPong', 18_000)
    case 'chevronRoof':
      return anglePath(input, [-amplitude * 0.68, 0, amplitude * 0.68], 'pingPong', 14_000)
    case 'radialCrown':
      return anglePath(input, [-amplitude * 0.8, -amplitude * 0.24, amplitude * 0.24, amplitude * 0.8], 'pingPong', 8_000)
    case 'sparseArchitecture':
      return anglePath(input, [-amplitude * 0.52, amplitude * 0.52], 'pingPong', 145_000)
    case 'fullRig':
      return anglePath(input, [-amplitude, amplitude], 'pingPong', 12_000)
    default:
      return anglePath(input, [-amplitude, amplitude], 'pingPong', 16_000)
  }
}

function blendDirection(
  base: AfterhoursScannerVec2,
  target: AfterhoursScannerVec2,
  amount: number,
): AfterhoursScannerVec2 {
  const t = clamp01(amount)
  return normalize({ x: base.x + (target.x - base.x) * t, y: base.y + (target.y - base.y) * t }, base)
}

export function resolveAfterhoursScannerMotion(
  input: AfterhoursScannerMotionInput,
): AfterhoursScannerMotionResult {
  const base = normalize(input.baseDirection, { x: 0, y: 1 })
  const authority = clamp01(input.motionAuthority)
  const mode = scannerMode(input.pattern)
  if (authority <= 0) {
    return {
      direction: base,
      blanked: false,
      retrace: false,
      velocityRatio: 0,
      accelerationRatio: 0,
      mode,
    }
  }

  const { points, repeatMode } = motionPath({ ...input, baseDirection: base })
  const head = createScannerHead(input)
  const path = createScannerPath(input, points, repeatMode)
  const evaluation = evaluateLaserDmxScannerAtTime(
    head,
    path,
    Math.max(0, Number.isFinite(input.motionPhase) ? input.motionPhase : 0),
    SCANNER_BPM,
  )
  if (!evaluation) {
    return { direction: base, blanked: false, retrace: false, velocityRatio: 0, accelerationRatio: 0, mode }
  }

  const origin = fieldOrigin(input.origin, input.aspect)
  const targetDirection = normalize({
    x: evaluation.target.x - origin.x,
    y: evaluation.target.y - origin.y,
  }, base)

  // Angle-authored paths already scale their aperture with authority. The
  // catalog-authored geometric path needs a separate blend so 25/50/75/100
  // still obey the literal Motion Amount contract instead of jumping straight
  // to a full-screen traversal at any non-zero value.
  const direction = input.pattern === 'diamondStar'
    ? blendDirection(base, targetDirection, authority)
    : targetDirection

  return {
    direction,
    blanked: evaluation.blanked,
    retrace: evaluation.retrace,
    velocityRatio: clamp01(evaluation.velocityRatio),
    accelerationRatio: clamp01(evaluation.accelerationRatio),
    mode,
  }
}
