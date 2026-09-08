import { AFTERHOURS_PATTERNS, type AfterhoursPattern } from '../../../CinematicWorldSettings'

/**
 * Afterhours visual-DNA / ray-geometry foundation.
 *
 * The canonical render contract is a stage-mounted source plus an intentional
 * ray direction. `endpoint` is derived by intersecting that ray with the
 * viewport boundary; it is never an independently-authored floating target.
 * The module is pure and deterministic: stable settings + seed + variation +
 * motion phase reconstruct the same logical rig and geometry.
 */

export interface AfterhoursEmitter {
  readonly x: number
  readonly y: number
}

/** Unit direction in the shader's aspect-corrected field space. */
export interface AfterhoursRayDirection {
  readonly x: number
  readonly y: number
}

export type AfterhoursBank = 'bottom' | 'left' | 'right' | 'top'
export type AfterhoursBeamRole = 'fan' | 'splitWing' | 'xWall' | 'crossCanopy' | 'randomLane'
export type AfterhoursSymmetrySide = 'left' | 'right' | 'center'

export interface AfterhoursBeamSymmetry {
  readonly axis: 'vertical'
  readonly pairId: string
  readonly side: AfterhoursSymmetrySide
}

/** Bottom bank: exactly 10 fixed origins, paired about the stage centre. */
export const AFTERHOURS_BOTTOM_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.07, y: 0.025 }),
  Object.freeze({ x: 0.165, y: 0.025 }),
  Object.freeze({ x: 0.26, y: 0.025 }),
  Object.freeze({ x: 0.355, y: 0.025 }),
  Object.freeze({ x: 0.45, y: 0.025 }),
  Object.freeze({ x: 0.55, y: 0.025 }),
  Object.freeze({ x: 0.645, y: 0.025 }),
  Object.freeze({ x: 0.74, y: 0.025 }),
  Object.freeze({ x: 0.835, y: 0.025 }),
  Object.freeze({ x: 0.93, y: 0.025 }),
] as const)

/** Left / right side banks — one user toggle enables both together. */
export const AFTERHOURS_LEFT_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.02, y: 0.30 }),
  Object.freeze({ x: 0.02, y: 0.52 }),
  Object.freeze({ x: 0.02, y: 0.74 }),
] as const)

export const AFTERHOURS_RIGHT_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.98, y: 0.30 }),
  Object.freeze({ x: 0.98, y: 0.52 }),
  Object.freeze({ x: 0.98, y: 0.74 }),
] as const)

/** Top bank: six origins, numerically mirrored around x=0.5. */
export const AFTERHOURS_TOP_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.12, y: 0.975 }),
  Object.freeze({ x: 0.264, y: 0.975 }),
  Object.freeze({ x: 0.408, y: 0.975 }),
  Object.freeze({ x: 0.592, y: 0.975 }),
  Object.freeze({ x: 0.736, y: 0.975 }),
  Object.freeze({ x: 0.88, y: 0.975 }),
] as const)

export const AFTERHOURS_MAX_BEAMS = 16
export const AFTERHOURS_MIN_BEAMS = 2

/** Alias of the persisted-settings pattern union — single source of truth. */
export const AFTERHOURS_PATTERN_IDS: readonly AfterhoursPattern[] = AFTERHOURS_PATTERNS

export interface AfterhoursBeamDescriptor {
  readonly active: boolean
  /** Stable render-slot identity; independent of variation and frame order. */
  readonly id: string
  /** Stable physical/source identity for the selected fixed fixture. */
  readonly sourceId: string
  readonly bank: AfterhoursBank
  /** Index into that bank's fixed origin list. */
  readonly emitterIndex: number
  readonly origin: AfterhoursEmitter
  /** Canonical ray direction in aspect-corrected field space. */
  readonly direction: AfterhoursRayDirection
  /** Deterministic intersection of origin + direction with the viewport edge. */
  readonly endpoint: AfterhoursEmitter
  /**
   * Compatibility alias for older internal consumers/tests. It is always the
   * exact same derived viewport-exit point as `endpoint`, never authored state.
   */
  readonly target: AfterhoursEmitter
  readonly projection: 'viewportExit'
  readonly role: AfterhoursBeamRole
  readonly symmetry: AfterhoursBeamSymmetry | null
  readonly accent: boolean
  /** Bounded 0..1 per-beam variation metadata for later reactive motion. */
  readonly phase: number
}

export interface AfterhoursBeamGenerationSettings {
  pattern: AfterhoursPattern
  symmetry: boolean
  sideLasers: boolean
  topLasers: boolean
  beamCount: number
  spread: number
  accentMix: number
}

export interface AfterhoursBeamGenerationOptions {
  /** Deterministic pattern-variation ordinal, independent of frame time. */
  variation?: number
  /** Cinematic World's deterministic config seed. */
  seed?: number
  /** Deterministic musical/transport phase used by the existing motion layer. */
  motionPhase?: number
  /** 0..1 bounded angular sweep authority. Zero is an exact static no-op. */
  motionAuthority?: number
  /**
   * Viewport width / height. The ray direction lives in aspect-corrected field
   * space, so this keeps stage angles visually coherent on wide/tall outputs.
   */
  viewportAspectRatio?: number
}

const DEFAULT_VIEWPORT_ASPECT = 16 / 9
const MIN_VIEWPORT_ASPECT = 0.25
const MAX_VIEWPORT_ASPECT = 4
const MIN_VISIBLE_FIELD_LENGTH = 0.30
const DIRECTION_EPSILON = 1e-8
const EDGE_EPSILON = 1e-9
const SWEEP_TAU = Math.PI * 2

const ZERO_POINT: AfterhoursEmitter = Object.freeze({ x: 0, y: 0 })
const ZERO_DIRECTION: AfterhoursRayDirection = Object.freeze({ x: 0, y: 0 })

interface OriginRef {
  readonly bank: AfterhoursBank
  readonly emitterIndex: number
  readonly emitter: AfterhoursEmitter
}

type OriginPair = readonly [OriginRef, OriginRef]

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : lo))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hash32(value: number): number {
  let x = (value + 1) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

function unit(seed: number): number {
  return hash32(seed >>> 0) / 4294967296
}

function normalizePattern(pattern: AfterhoursPattern): AfterhoursPattern {
  return AFTERHOURS_PATTERN_IDS.includes(pattern) ? pattern : 'fan'
}

function normalizeAspect(value: number | undefined): number {
  return clamp(value ?? DEFAULT_VIEWPORT_ASPECT, MIN_VIEWPORT_ASPECT, MAX_VIEWPORT_ASPECT)
}

export function resolveAfterhoursBeamCount(raw: number): number {
  const rounded = Math.round(Number.isFinite(raw) ? raw : AFTERHOURS_MIN_BEAMS)
  return clamp(rounded, AFTERHOURS_MIN_BEAMS, AFTERHOURS_MAX_BEAMS)
}

export function normalizeAfterhoursRayDirection(
  direction: AfterhoursRayDirection,
  fallback: AfterhoursRayDirection = { x: 0, y: 1 },
): AfterhoursRayDirection {
  const x = Number.isFinite(direction.x) ? direction.x : 0
  const y = Number.isFinite(direction.y) ? direction.y : 0
  const length = Math.hypot(x, y)
  if (length <= DIRECTION_EPSILON) {
    const fx = Number.isFinite(fallback.x) ? fallback.x : 0
    const fy = Number.isFinite(fallback.y) ? fallback.y : 1
    const fl = Math.hypot(fx, fy)
    if (fl <= DIRECTION_EPSILON) return { x: 0, y: 1 }
    return { x: fx / fl, y: fy / fl }
  }
  return { x: x / length, y: y / length }
}

/**
 * Intersect an unbounded ray with the normalized viewport. Direction is in the
 * same aspect-corrected field coordinates used by the Afterhours shader.
 */
export function intersectAfterhoursRayWithViewport(
  origin: AfterhoursEmitter,
  direction: AfterhoursRayDirection,
  viewportAspectRatio = DEFAULT_VIEWPORT_ASPECT,
): AfterhoursEmitter {
  const aspect = normalizeAspect(viewportAspectRatio)
  const o = { x: clamp01(origin.x), y: clamp01(origin.y) }
  const d = normalizeAfterhoursRayDirection(direction)
  const fx = (o.x - 0.5) * aspect
  const fy = o.y - 0.5
  const minX = -0.5 * aspect
  const maxX = 0.5 * aspect
  const minY = -0.5
  const maxY = 0.5

  const candidates: number[] = []
  if (d.x > DIRECTION_EPSILON) candidates.push((maxX - fx) / d.x)
  else if (d.x < -DIRECTION_EPSILON) candidates.push((minX - fx) / d.x)
  if (d.y > DIRECTION_EPSILON) candidates.push((maxY - fy) / d.y)
  else if (d.y < -DIRECTION_EPSILON) candidates.push((minY - fy) / d.y)

  const t = Math.min(...candidates.filter(value => Number.isFinite(value) && value >= 0))
  if (!Number.isFinite(t)) return Object.freeze({ x: o.x, y: o.y >= 0.5 ? 0 : 1 })

  let x = clamp01((fx + d.x * t) / aspect + 0.5)
  let y = clamp01(fy + d.y * t + 0.5)
  // Snap the numerically-selected boundary so downstream regression tests and
  // renderers see an explicit stage/viewport exit, not 0.9999999998.
  if (x < EDGE_EPSILON) x = 0
  else if (1 - x < EDGE_EPSILON) x = 1
  if (y < EDGE_EPSILON) y = 0
  else if (1 - y < EDGE_EPSILON) y = 1
  return Object.freeze({ x, y })
}

export function isAfterhoursViewportExit(point: AfterhoursEmitter, tolerance = 1e-7): boolean {
  return Math.min(point.x, 1 - point.x, point.y, 1 - point.y) <= tolerance
}

export function afterhoursRayFieldLength(
  origin: AfterhoursEmitter,
  endpoint: AfterhoursEmitter,
  viewportAspectRatio = DEFAULT_VIEWPORT_ASPECT,
): number {
  const aspect = normalizeAspect(viewportAspectRatio)
  return Math.hypot((endpoint.x - origin.x) * aspect, endpoint.y - origin.y)
}

function ref(bank: AfterhoursBank, emitterIndex: number): OriginRef {
  const emitters = bank === 'bottom'
    ? AFTERHOURS_BOTTOM_EMITTERS
    : bank === 'top'
      ? AFTERHOURS_TOP_EMITTERS
      : bank === 'left'
        ? AFTERHOURS_LEFT_EMITTERS
        : AFTERHOURS_RIGHT_EMITTERS
  return { bank, emitterIndex, emitter: emitters[emitterIndex] }
}

function pair(left: OriginRef, right: OriginRef): OriginPair {
  return Object.freeze([left, right]) as OriginPair
}

const BOTTOM_PAIRS: readonly OriginPair[] = Object.freeze([
  pair(ref('bottom', 4), ref('bottom', 5)),
  pair(ref('bottom', 3), ref('bottom', 6)),
  pair(ref('bottom', 2), ref('bottom', 7)),
  pair(ref('bottom', 1), ref('bottom', 8)),
  pair(ref('bottom', 0), ref('bottom', 9)),
])

const TOP_PAIRS: readonly OriginPair[] = Object.freeze([
  pair(ref('top', 2), ref('top', 3)),
  pair(ref('top', 1), ref('top', 4)),
  pair(ref('top', 0), ref('top', 5)),
])

const SIDE_PAIRS: readonly OriginPair[] = Object.freeze([
  pair(ref('left', 1), ref('right', 1)),
  pair(ref('left', 0), ref('right', 0)),
  pair(ref('left', 2), ref('right', 2)),
])

function interleavePairs(...groups: readonly (readonly OriginPair[])[]): OriginPair[] {
  const out: OriginPair[] = []
  const max = Math.max(...groups.map(group => group.length))
  for (let index = 0; index < max; index += 1) {
    for (const group of groups) if (group[index]) out.push(group[index])
  }
  return out
}

function flattenPairs(pairs: readonly OriginPair[]): OriginRef[] {
  return pairs.flatMap(pair => [pair[0], pair[1]])
}

/**
 * Stage-2 source allocation contract: Beam Count is literal, and optional banks
 * are interleaved ahead of the budget cutoff so an enabled Side/Top bank can
 * participate at ordinary counts such as 8. This is still the lightweight
 * pre-rig allocator; later stages can replace fixture choreography without
 * changing the user-facing budget semantics.
 */
function activeOrigins(_pattern: AfterhoursPattern, settings: AfterhoursBeamGenerationSettings): OriginRef[] {
  const groups: (readonly OriginPair[])[] = [BOTTOM_PAIRS]
  if (settings.sideLasers) groups.push(SIDE_PAIRS)
  if (settings.topLasers) groups.push(TOP_PAIRS)
  return flattenPairs(interleavePairs(...groups))
}

function interleaveOrigins(...groups: readonly (readonly OriginRef[])[]): OriginRef[] {
  const out: OriginRef[] = []
  const max = Math.max(...groups.map(group => group.length))
  for (let index = 0; index < max; index += 1) {
    for (const group of groups) if (group[index]) out.push(group[index])
  }
  return out
}

function randomSymmetryPrimaryOrigins(settings: AfterhoursBeamGenerationSettings): OriginRef[] {
  const bottom = [ref('bottom', 4), ref('bottom', 3), ref('bottom', 2), ref('bottom', 1), ref('bottom', 0)]
  const groups: OriginRef[][] = [bottom]
  if (settings.sideLasers) groups.push([ref('left', 1), ref('left', 0), ref('left', 2)])
  if (settings.topLasers) groups.push([ref('top', 2), ref('top', 1), ref('top', 0)])
  return interleaveOrigins(...groups)
}

function mirrorRef(origin: OriginRef): OriginRef {
  switch (origin.bank) {
    case 'bottom': return ref('bottom', AFTERHOURS_BOTTOM_EMITTERS.length - 1 - origin.emitterIndex)
    case 'top': return ref('top', AFTERHOURS_TOP_EMITTERS.length - 1 - origin.emitterIndex)
    case 'left': return ref('right', origin.emitterIndex)
    case 'right': return ref('left', origin.emitterIndex)
  }
}

function sourceId(origin: OriginRef): string {
  return `afterhours-${origin.bank}-${origin.emitterIndex}`
}

function roleForPattern(pattern: AfterhoursPattern): AfterhoursBeamRole {
  switch (pattern) {
    case 'split': return 'splitWing'
    case 'xWall': return 'xWall'
    case 'cross': return 'crossCanopy'
    case 'random': return 'randomLane'
    case 'fan':
    default: return 'fan'
  }
}

function sideForOrigin(origin: AfterhoursEmitter): AfterhoursSymmetrySide {
  if (Math.abs(origin.x - 0.5) <= 1e-7) return 'center'
  return origin.x < 0.5 ? 'left' : 'right'
}

function directionFromAngleDeg(angleDeg: number): AfterhoursRayDirection {
  const radians = angleDeg * Math.PI / 180
  return normalizeAfterhoursRayDirection({ x: Math.cos(radians), y: Math.sin(radians) })
}

function directionToward(
  origin: AfterhoursEmitter,
  aim: AfterhoursEmitter,
  aspect: number,
): AfterhoursRayDirection {
  return normalizeAfterhoursRayDirection({
    x: (aim.x - origin.x) * aspect,
    y: aim.y - origin.y,
  })
}

function fallbackDirection(origin: OriginRef, aspect: number): AfterhoursRayDirection {
  switch (origin.bank) {
    case 'top': return directionToward(origin.emitter, { x: 0.5, y: -0.2 }, aspect)
    case 'left': return directionToward(origin.emitter, { x: 1.2, y: 0.5 }, aspect)
    case 'right': return directionToward(origin.emitter, { x: -0.2, y: 0.5 }, aspect)
    case 'bottom':
    default: return directionToward(origin.emitter, { x: 0.5, y: 1.2 }, aspect)
  }
}

function structuredDirection(
  pattern: Exclude<AfterhoursPattern, 'random'>,
  origin: OriginRef,
  spread: number,
  structureScale: number,
  aspect: number,
): AfterhoursRayDirection {
  const xNorm = clamp((origin.emitter.x - 0.5) / 0.48, -1, 1)
  const yNorm = clamp((origin.emitter.y - 0.5) / 0.48, -1, 1)
  switch (pattern) {
    case 'fan': {
      const halfAngle = mix(10, 58, spread) * structureScale
      if (origin.bank === 'top') return directionFromAngleDeg(270 + xNorm * halfAngle)
      if (origin.bank === 'left') return directionFromAngleDeg(-yNorm * halfAngle)
      if (origin.bank === 'right') return directionFromAngleDeg(180 + yNorm * halfAngle)
      return directionFromAngleDeg(90 - xNorm * halfAngle)
    }
    case 'split': {
      const radialX = mix(0.72, 1, Math.abs(xNorm))
      const radialY = mix(0.72, 1, Math.abs(yNorm))
      const halfAngleX = mix(26, 66, spread) * structureScale * radialX
      const halfAngleY = mix(26, 66, spread) * structureScale * radialY
      if (origin.bank === 'top') {
        const side = origin.emitter.x < 0.5 ? -1 : 1
        return directionFromAngleDeg(270 + side * halfAngleX)
      }
      if (origin.bank === 'left') {
        const side = origin.emitter.y < 0.5 ? -1 : 1
        return directionFromAngleDeg(side * halfAngleY)
      }
      if (origin.bank === 'right') {
        const side = origin.emitter.y < 0.5 ? 1 : -1
        return directionFromAngleDeg(180 + side * halfAngleY)
      }
      const side = origin.emitter.x < 0.5 ? 1 : -1
      return directionFromAngleDeg(90 + side * halfAngleX)
    }
    case 'xWall': {
      const oppositeX = mix(0.5, 1 - origin.emitter.x, mix(0.62, 1.1, spread) * structureScale)
      const aim = origin.bank === 'top'
        ? { x: oppositeX, y: -0.22 }
        : { x: oppositeX, y: 1.22 }
      return directionToward(origin.emitter, aim, aspect)
    }
    case 'cross':
    default: {
      if (origin.bank === 'left') {
        return directionToward(origin.emitter, { x: 1.18, y: mix(0.5, 1 - origin.emitter.y, 0.88) }, aspect)
      }
      if (origin.bank === 'right') {
        return directionToward(origin.emitter, { x: -0.18, y: mix(0.5, 1 - origin.emitter.y, 0.88) }, aspect)
      }
      const oppositeX = mix(0.5, 1 - origin.emitter.x, mix(0.72, 1.08, spread) * structureScale)
      return directionToward(origin.emitter, { x: oppositeX, y: 1.18 }, aspect)
    }
  }
}

const RANDOM_LANES = Object.freeze([-1, -0.62, -0.28, 0.28, 0.62, 1] as const)

function randomLaneDirection(origin: OriginRef, spread: number, seed: number): AfterhoursRayDirection {
  const lane = RANDOM_LANES[Math.floor(unit(seed) * RANDOM_LANES.length) % RANDOM_LANES.length]
  const jitter = (unit(seed ^ 0x7f4a7c15) - 0.5) * 0.14
  const lanePosition = clamp(lane + jitter, -1, 1)
  const halfAngle = mix(15, 52, spread)
  switch (origin.bank) {
    case 'top': return directionFromAngleDeg(270 + lanePosition * halfAngle)
    case 'left': return directionFromAngleDeg(lanePosition * halfAngle)
    case 'right': return directionFromAngleDeg(180 + lanePosition * halfAngle)
    case 'bottom':
    default: return directionFromAngleDeg(90 + lanePosition * halfAngle)
  }
}

/** Existing reactive motion now rotates a ray, then re-projects it to the edge. */
function sweepDirection(
  direction: AfterhoursRayDirection,
  motionPhase: number,
  motionAuthority: number,
  beamPhase: number,
  symmetrySide: AfterhoursSymmetrySide | null,
): AfterhoursRayDirection {
  if (motionAuthority <= 0) return direction
  const authority = clamp01(motionAuthority)
  const baseAngle = Math.sin(motionPhase * SWEEP_TAU + beamPhase * SWEEP_TAU) * authority * (7 * Math.PI / 180)
  const angle = symmetrySide === 'right' ? -baseAngle : baseAngle
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return normalizeAfterhoursRayDirection({
    x: direction.x * c - direction.y * s,
    y: direction.x * s + direction.y * c,
  }, direction)
}

function projectRay(
  origin: OriginRef,
  direction: AfterhoursRayDirection,
  aspect: number,
): { direction: AfterhoursRayDirection; endpoint: AfterhoursEmitter } {
  let resolvedDirection = normalizeAfterhoursRayDirection(direction, fallbackDirection(origin, aspect))
  let endpoint = intersectAfterhoursRayWithViewport(origin.emitter, resolvedDirection, aspect)
  if (afterhoursRayFieldLength(origin.emitter, endpoint, aspect) < MIN_VISIBLE_FIELD_LENGTH) {
    resolvedDirection = fallbackDirection(origin, aspect)
    endpoint = intersectAfterhoursRayWithViewport(origin.emitter, resolvedDirection, aspect)
  }
  return { direction: Object.freeze(resolvedDirection), endpoint }
}

function inactiveBeam(index: number): AfterhoursBeamDescriptor {
  return Object.freeze({
    active: false,
    id: `afterhours-beam-slot-${index}`,
    sourceId: 'afterhours-inactive',
    bank: 'bottom',
    emitterIndex: 0,
    origin: AFTERHOURS_BOTTOM_EMITTERS[0],
    direction: ZERO_DIRECTION,
    endpoint: ZERO_POINT,
    target: ZERO_POINT,
    projection: 'viewportExit',
    role: 'fan',
    symmetry: null,
    accent: false,
    phase: 0,
  })
}

interface CreateBeamInput {
  slot: number
  pattern: AfterhoursPattern
  origin: OriginRef
  seed: number
  spread: number
  accentMix: number
  structureScale: number
  aspect: number
  motionPhase: number
  motionAuthority: number
  symmetry: AfterhoursBeamSymmetry | null
}

function createBeam(input: CreateBeamInput): AfterhoursBeamDescriptor {
  const phase = unit(input.seed ^ 0x9e3779b9)
  const baseDirection = input.pattern === 'random'
    ? randomLaneDirection(input.origin, input.spread, input.seed)
    : structuredDirection(input.pattern, input.origin, input.spread, input.structureScale, input.aspect)
  const sweptDirection = sweepDirection(baseDirection, input.motionPhase, input.motionAuthority, phase, input.symmetry?.side ?? null)
  const projected = projectRay(input.origin, sweptDirection, input.aspect)
  const endpoint = projected.endpoint
  return Object.freeze({
    active: true,
    id: `afterhours-beam-slot-${input.slot}`,
    sourceId: sourceId(input.origin),
    bank: input.origin.bank,
    emitterIndex: input.origin.emitterIndex,
    origin: input.origin.emitter,
    direction: projected.direction,
    endpoint,
    target: endpoint,
    projection: 'viewportExit',
    role: roleForPattern(input.pattern),
    symmetry: input.symmetry,
    accent: input.accentMix >= 1 || (input.accentMix > 0 && unit(input.seed ^ 0x63d83595) < input.accentMix),
    phase,
  })
}

function mirrorBeam(
  source: AfterhoursBeamDescriptor,
  origin: OriginRef,
  slot: number,
  pairId: string,
): AfterhoursBeamDescriptor {
  const endpoint = Object.freeze({ x: clamp01(1 - source.endpoint.x), y: source.endpoint.y })
  return Object.freeze({
    ...source,
    id: `afterhours-beam-slot-${slot}`,
    sourceId: sourceId(origin),
    bank: origin.bank,
    emitterIndex: origin.emitterIndex,
    origin: origin.emitter,
    direction: Object.freeze({ x: -source.direction.x, y: source.direction.y }),
    endpoint,
    target: endpoint,
    symmetry: Object.freeze({ axis: 'vertical', pairId, side: 'right' }),
  })
}

/**
 * Deterministic procedural ray allocation. Returns exactly 16 descriptors; the
 * first Beam Count slots are active. Every active slot owns a stable identity,
 * fixed source identity, role, direction, and a viewport-exit endpoint derived
 * from that direction. No active default beam authors a floating in-frame end.
 */
export function generateAfterhoursBeams(
  settings: AfterhoursBeamGenerationSettings,
  options: AfterhoursBeamGenerationOptions = {},
): readonly AfterhoursBeamDescriptor[] {
  const pattern = normalizePattern(settings.pattern)
  const count = resolveAfterhoursBeamCount(settings.beamCount)
  const spread = clamp01(settings.spread)
  const accentMix = clamp01(settings.accentMix)
  const variation = Math.trunc(Number.isFinite(options.variation ?? 0) ? (options.variation ?? 0) : 0)
  const motionPhase = Number.isFinite(options.motionPhase ?? 0) ? (options.motionPhase ?? 0) : 0
  const motionAuthority = clamp01(options.motionAuthority ?? 0)
  const aspect = normalizeAspect(options.viewportAspectRatio)
  const seedInput = Math.trunc(Number.isFinite(options.seed ?? 0) ? (options.seed ?? 0) : 0) >>> 0
  const seedMix = seedInput !== 0 ? hash32(seedInput) : 0
  const baseSeed = hash32((hash32(variation >>> 0) ^ seedMix ^ Math.imul(count, 0x9e3779b1) ^ Math.imul(pattern.length, 0x85ebca77)) >>> 0)
  const structureScale = mix(0.88, 1.12, unit(baseSeed ^ 0xa511e9b3))

  const beams: AfterhoursBeamDescriptor[] = []
  const randomSymmetry = pattern === 'random' && settings.symmetry === true

  if (randomSymmetry) {
    const origins = randomSymmetryPrimaryOrigins(settings)
    const primaryCount = Math.ceil(count / 2)
    for (let index = 0; index < primaryCount; index += 1) {
      const origin = origins[index % origins.length]
      const pairId = `afterhours-random-pair-${index}`
      const seed = hash32((baseSeed ^ Math.imul(index + 1, 0x27d4eb2d) ^ Math.imul(origin.emitterIndex + 3, 0x165667b1)) >>> 0)
      beams.push(createBeam({
        slot: index,
        pattern,
        origin,
        seed,
        spread,
        accentMix,
        structureScale,
        aspect,
        motionPhase,
        motionAuthority,
        symmetry: Object.freeze({ axis: 'vertical', pairId, side: 'left' }),
      }))
    }
    for (let index = primaryCount; index < count; index += 1) {
      const sourceIndex = count - 1 - index
      const source = beams[sourceIndex]
      const origin = mirrorRef({ bank: source.bank, emitterIndex: source.emitterIndex, emitter: source.origin })
      beams.push(mirrorBeam(source, origin, index, `afterhours-random-pair-${sourceIndex}`))
    }
  } else {
    const origins = activeOrigins(pattern, settings)
    for (let index = 0; index < count; index += 1) {
      const origin = origins[index % origins.length]
      // Structured lists are pairwise; using the same seed for each adjacent
      // pair keeps variation/motion numerically mirrored. Random-with-symmetry
      // has its own exact mirror path above.
      const seedOrdinal = pattern === 'random' ? index : Math.floor(index / 2)
      const seed = hash32((baseSeed ^ Math.imul(seedOrdinal + 1, 0x27d4eb2d)) >>> 0)
      const pairId = pattern === 'random' ? null : `afterhours-${pattern}-pair-${Math.floor(index / 2)}`
      beams.push(createBeam({
        slot: index,
        pattern,
        origin,
        seed,
        spread,
        accentMix,
        structureScale,
        aspect,
        motionPhase,
        motionAuthority,
        symmetry: pairId == null ? null : Object.freeze({ axis: 'vertical', pairId, side: sideForOrigin(origin.emitter) }),
      }))
    }
  }

  return Object.freeze(Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => (
    index < beams.length ? beams[index] : inactiveBeam(index)
  )))
}
