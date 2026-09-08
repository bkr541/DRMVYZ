import { AFTERHOURS_PATTERNS, type AfterhoursPattern } from '../../../CinematicWorldSettings'
import { getAfterhoursSceneDefinition } from './AfterhoursSceneCatalog'
import {
  AFTERHOURS_VIRTUAL_STAGE_RIG,
  allocateAfterhoursRigFixtures,
  type AfterhoursRigBank,
  type AfterhoursRigFixture,
  type AfterhoursRigRole,
} from './AfterhoursVirtualStageRig'

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

export type AfterhoursBank = AfterhoursRigBank
export type AfterhoursBeamRole = 'fan' | 'splitWing' | 'crossCanopy' | 'diamondStar' | 'chevronRoof' | 'radialCrown' | 'sparseHero' | 'fullRig'
export type AfterhoursSymmetrySide = 'left' | 'right' | 'center'

export interface AfterhoursBeamSymmetry {
  readonly axis: 'vertical'
  readonly pairId: string
  readonly side: AfterhoursSymmetrySide
}

/**
 * Compatibility position views retained for existing renderer/tests. Physical
 * identity and placement are owned by AFTERHOURS_VIRTUAL_STAGE_RIG.
 */
export const AFTERHOURS_BOTTOM_EMITTERS = Object.freeze(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.lower.map(fixture => fixture.position))
export const AFTERHOURS_LEFT_EMITTERS = Object.freeze(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.leftWing.map(fixture => fixture.position))
export const AFTERHOURS_RIGHT_EMITTERS = Object.freeze(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.rightWing.map(fixture => fixture.position))
export const AFTERHOURS_TOP_EMITTERS = Object.freeze(AFTERHOURS_VIRTUAL_STAGE_RIG.banks.overhead.map(fixture => fixture.position))

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
  /** Explicit Stage 3 rig identity; sourceId remains an exact compatibility alias. */
  readonly fixtureId: string
  readonly fixtureRole: AfterhoursRigRole
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
  readonly fixture: AfterhoursRigFixture
  readonly bank: AfterhoursBank
  readonly emitterIndex: number
  readonly emitter: AfterhoursEmitter
}

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
  const legacy: Readonly<Record<string, AfterhoursPattern>> = {
    random: 'radialCrown', xWall: 'chevronRoof', cross: 'crossCanopy', fan: 'wideFan', split: 'splitWings',
  }
  const candidate = legacy[String(pattern)] ?? pattern
  return AFTERHOURS_PATTERN_IDS.includes(candidate as AfterhoursPattern) ? candidate as AfterhoursPattern : 'wideFan'
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

function originRef(fixture: AfterhoursRigFixture): OriginRef {
  return {
    fixture,
    bank: fixture.bank,
    emitterIndex: fixture.emitterIndex,
    emitter: fixture.position,
  }
}

/**
 * Stage 3 allocation delegates to the virtual rig. Geometry never chooses the
 * "first N" fixtures or authors source coordinates independently.
 */
function activeOrigins(settings: AfterhoursBeamGenerationSettings, count: number): OriginRef[] {
  return allocateAfterhoursRigFixtures({
    beamCount: count,
    sideLasers: settings.sideLasers,
    topLasers: settings.topLasers,
  }).map(originRef)
}

function sourceId(origin: OriginRef): string {
  return origin.fixture.id
}

function roleForPattern(pattern: AfterhoursPattern): AfterhoursBeamRole {
  switch (pattern) {
    case 'splitWings': return 'splitWing'
    case 'crossCanopy': return 'crossCanopy'
    case 'diamondStar': return 'diamondStar'
    case 'chevronRoof': return 'chevronRoof'
    case 'radialCrown': return 'radialCrown'
    case 'sparseArchitecture': return 'sparseHero'
    case 'fullRig': return 'fullRig'
    case 'wideFan':
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

function fallbackDirection(origin: OriginRef, _aspect: number): AfterhoursRayDirection {
  return directionFromAngleDeg(origin.fixture.homeHeadingDeg)
}

function structuredDirection(
  pattern: AfterhoursPattern,
  origin: OriginRef,
  spread: number,
  structureScale: number,
  aspect: number,
): AfterhoursRayDirection {
  const xNorm = clamp((origin.emitter.x - 0.5) / 0.48, -1, 1)
  const yNorm = clamp((origin.emitter.y - 0.5) / 0.48, -1, 1)
  const side = origin.emitter.x < 0.5 ? -1 : 1
  switch (pattern) {
    case 'wideFan': {
      const halfAngle = mix(18, 64, spread) * structureScale
      const roleOffset = origin.fixture.role === 'overhead'
        ? xNorm * halfAngle
        : origin.fixture.role === 'leftWing'
          ? -yNorm * halfAngle
          : origin.fixture.role === 'rightWing'
            ? yNorm * halfAngle
            : -xNorm * halfAngle
      return directionFromAngleDeg(origin.fixture.homeHeadingDeg + roleOffset)
    }
    case 'splitWings': {
      const halfAngle = mix(30, 68, spread) * structureScale
      if (origin.bank === 'top') return directionFromAngleDeg(270 + side * halfAngle)
      if (origin.bank === 'left') return directionFromAngleDeg(-mix(10, 42, spread))
      if (origin.bank === 'right') return directionFromAngleDeg(180 + mix(10, 42, spread))
      return directionFromAngleDeg(90 + (origin.emitter.x < 0.5 ? -1 : 1) * halfAngle)
    }
    case 'crossCanopy': {
      if (origin.bank === 'left') return directionToward(origin.emitter, { x: 1.18, y: 0.72 - yNorm * 0.12 }, aspect)
      if (origin.bank === 'right') return directionToward(origin.emitter, { x: -0.18, y: 0.72 - yNorm * 0.12 }, aspect)
      const oppositeX = mix(0.5, 1 - origin.emitter.x, mix(0.82, 1.08, spread) * structureScale)
      return directionToward(origin.emitter, { x: oppositeX, y: origin.bank === 'top' ? -0.18 : 1.18 }, aspect)
    }
    case 'diamondStar': {
      if (origin.bank === 'left') return directionToward(origin.emitter, { x: 0.72, y: origin.emitter.y < 0.52 ? 0.82 : 0.18 }, aspect)
      if (origin.bank === 'right') return directionToward(origin.emitter, { x: 0.28, y: origin.emitter.y < 0.52 ? 0.82 : 0.18 }, aspect)
      const inner = Math.abs(xNorm) < 0.42
      const aimX = side < 0 ? (inner ? 0.72 : 0.64) : (inner ? 0.28 : 0.36)
      const aimY = origin.bank === 'top' ? 0.16 : 0.84
      return directionToward(origin.emitter, { x: aimX, y: aimY }, aspect)
    }
    case 'chevronRoof': {
      if (origin.bank === 'left') return directionToward(origin.emitter, { x: 0.5, y: 0.9 }, aspect)
      if (origin.bank === 'right') return directionToward(origin.emitter, { x: 0.5, y: 0.9 }, aspect)
      if (origin.bank === 'top') return directionToward(origin.emitter, { x: 0.5 + side * 0.34, y: -0.12 }, aspect)
      return directionToward(origin.emitter, { x: 0.5 + side * mix(0.1, 0.26, spread), y: 1.12 }, aspect)
    }
    case 'radialCrown': {
      const crownCenter = { x: 0.5, y: 0.62 }
      const dx = (origin.emitter.x - crownCenter.x) * aspect
      const dy = origin.emitter.y - crownCenter.y
      const outward = normalizeAfterhoursRayDirection({ x: dx, y: dy }, directionFromAngleDeg(origin.fixture.homeHeadingDeg))
      const radialScale = mix(0.78, 1.18, spread) * structureScale
      return normalizeAfterhoursRayDirection({ x: outward.x * radialScale, y: outward.y * radialScale }, outward)
    }
    case 'sparseArchitecture': {
      if (origin.bank === 'left') return directionToward(origin.emitter, { x: 0.72, y: 0.86 }, aspect)
      if (origin.bank === 'right') return directionToward(origin.emitter, { x: 0.28, y: 0.86 }, aspect)
      if (origin.bank === 'top') return directionToward(origin.emitter, { x: 0.5 + side * 0.22, y: 0.08 }, aspect)
      return directionToward(origin.emitter, { x: 0.5 + side * 0.26, y: 1.16 }, aspect)
    }
    case 'fullRig':
    default: {
      if (origin.bank === 'left') return directionToward(origin.emitter, { x: 1.14, y: 0.58 + yNorm * 0.2 }, aspect)
      if (origin.bank === 'right') return directionToward(origin.emitter, { x: -0.14, y: 0.58 + yNorm * 0.2 }, aspect)
      const angle = origin.bank === 'top'
        ? 270 + xNorm * mix(28, 58, spread)
        : 90 - xNorm * mix(24, 54, spread)
      return directionFromAngleDeg(angle)
    }
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
    fixtureId: 'afterhours-inactive',
    fixtureRole: 'lower',
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
  const baseDirection = structuredDirection(input.pattern, input.origin, input.spread, input.structureScale, input.aspect)
  const sweptDirection = sweepDirection(baseDirection, input.motionPhase, input.motionAuthority, phase, input.symmetry?.side ?? null)
  const projected = projectRay(input.origin, sweptDirection, input.aspect)
  const endpoint = projected.endpoint
  return Object.freeze({
    active: true,
    id: `afterhours-beam-slot-${input.slot}`,
    sourceId: sourceId(input.origin),
    fixtureId: input.origin.fixture.id,
    fixtureRole: input.origin.fixture.role,
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
    fixtureId: origin.fixture.id,
    fixtureRole: origin.fixture.role,
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
  const requestedCount = resolveAfterhoursBeamCount(settings.beamCount)
  const scene = getAfterhoursSceneDefinition(pattern)
  const count = Math.min(requestedCount, scene.density.maxBeams)
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
  const randomSymmetry = false

  const origins = activeOrigins(settings, count)

  if (randomSymmetry) {
    for (let index = 0; index < count; index += 2) {
      const origin = origins[index]
      const mirrorOrigin = origins[index + 1]
      const pairOrdinal = Math.floor(index / 2)
      const pairId = `afterhours-random-pair-${pairOrdinal}`
      const seed = hash32((baseSeed ^ Math.imul(pairOrdinal + 1, 0x27d4eb2d) ^ Math.imul(origin.emitterIndex + 3, 0x165667b1)) >>> 0)

      // Full pair allocations are always left/right mirrors supplied by the rig.
      // Odd literal counts intentionally end with one deterministic lower source.
      const hasMirror = mirrorOrigin?.fixture.id === origin.fixture.mirrorFixtureId
      if (hasMirror) {
        const primaryOrigin = origin.fixture.mirrorSide === 'left' ? origin : mirrorOrigin
        const secondaryOrigin = primaryOrigin === origin ? mirrorOrigin : origin
        const primarySlot = primaryOrigin === origin ? index : index + 1
        const secondarySlot = primaryOrigin === origin ? index + 1 : index
        const primary = createBeam({
          slot: primarySlot,
          pattern,
          origin: primaryOrigin,
          seed,
          spread,
          accentMix,
          structureScale,
          aspect,
          motionPhase,
          motionAuthority,
          symmetry: Object.freeze({ axis: 'vertical', pairId, side: 'left' }),
        })
        const mirrored = mirrorBeam(primary, secondaryOrigin, secondarySlot, pairId)
        if (primarySlot === index) beams.push(primary, mirrored)
        else beams.push(mirrored, primary)
      } else {
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
          symmetry: null,
        }))
      }
    }
  } else {
    for (let index = 0; index < count; index += 1) {
      const origin = origins[index]
      // Structured lists are allocated pairwise by the rig; using the same seed
      // for each adjacent pair keeps variation/motion numerically mirrored.
      const seedOrdinal = Math.floor(index / 2)
      const seed = hash32((baseSeed ^ Math.imul(seedOrdinal + 1, 0x27d4eb2d)) >>> 0)
      const hasMirror = index % 2 === 0
        ? origins[index + 1]?.fixture.id === origin.fixture.mirrorFixtureId
        : origins[index - 1]?.fixture.id === origin.fixture.mirrorFixtureId
      const pairId = !hasMirror ? null : `afterhours-${pattern}-pair-${Math.floor(index / 2)}`
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
        symmetry: pairId == null
          ? null
          : Object.freeze({ axis: 'vertical', pairId, side: sideForOrigin(origin.emitter) }),
      }))
    }
  }

  return Object.freeze(Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => (
    index < beams.length ? beams[index] : inactiveBeam(index)
  )))
}
