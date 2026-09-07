import type { AfterhoursPattern } from '../../../CinematicWorldSettings'

/**
 * Afterhours Stage 2 — canonical procedural beam domain.
 *
 * One source of truth for the fixed emitter banks and the deterministic
 * emitter -> target geometry the WebGL renderer consumes. No music reactivity,
 * pattern-change scheduling, auto-color, or blackout logic lives here — those
 * are later stages. Every result is a pure function of the persisted settings
 * plus an explicit `variation` ordinal, never of frame time or `Math.random()`.
 */

export interface AfterhoursEmitter {
  readonly x: number
  readonly y: number
}

export type AfterhoursBank = 'bottom' | 'left' | 'right' | 'top'

/** Bottom bank: exactly 10 fixed origins, the always-on visual foundation. */
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

/** Top bank — six origins, chosen for horizontal balance against the bottom. */
export const AFTERHOURS_TOP_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.12, y: 0.975 }),
  Object.freeze({ x: 0.264, y: 0.975 }),
  Object.freeze({ x: 0.408, y: 0.975 }),
  Object.freeze({ x: 0.552, y: 0.975 }),
  Object.freeze({ x: 0.696, y: 0.975 }),
  Object.freeze({ x: 0.88, y: 0.975 }),
] as const)

export const AFTERHOURS_MAX_BEAMS = 16
export const AFTERHOURS_MIN_BEAMS = 2

export const AFTERHOURS_PATTERN_IDS: readonly AfterhoursPattern[] = Object.freeze(['random', 'xWall', 'cross', 'fan', 'split'])

export interface AfterhoursBeamDescriptor {
  readonly active: boolean
  readonly bank: AfterhoursBank
  /** Index into that bank's fixed origin list. */
  readonly emitterIndex: number
  readonly origin: AfterhoursEmitter
  readonly target: AfterhoursEmitter
  readonly accent: boolean
  /** Bounded 0..1 per-beam variation metadata for later stages. */
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
  /**
   * Deterministic ordinal, independent of frame time. Stage 5 cycles it among
   * variations of the selected pattern family; here it just seeds the RNG.
   */
  variation?: number
}

const SAFE_MARGIN = 0.06
const MIN_BEAM_LENGTH = 0.24
const MIN_TARGET_SEPARATION = 0.045
const MAX_RANDOM_ATTEMPTS = 12

const ZERO_TARGET: AfterhoursEmitter = Object.freeze({ x: 0, y: 0 })

interface OriginRef {
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
  return AFTERHOURS_PATTERN_IDS.includes(pattern) ? pattern : 'fan'
}

export function resolveAfterhoursBeamCount(raw: number): number {
  const rounded = Math.round(Number.isFinite(raw) ? raw : AFTERHOURS_MIN_BEAMS)
  return clamp(rounded, AFTERHOURS_MIN_BEAMS, AFTERHOURS_MAX_BEAMS)
}

function safeX(x: number): number {
  return clamp(x, SAFE_MARGIN, 1 - SAFE_MARGIN)
}

function safeY(y: number): number {
  return clamp(y, SAFE_MARGIN, 1 - SAFE_MARGIN)
}

function bankRefs(bank: AfterhoursBank, emitters: readonly AfterhoursEmitter[]): OriginRef[] {
  return emitters.map((emitter, emitterIndex) => ({ bank, emitterIndex, emitter }))
}

/**
 * Which fixed banks a pattern family is allowed to draw from. Enabled Side/Top
 * banks are still ignored by families whose composition does not use them — a
 * disabled bank is never used, but an enabled optional bank is only consumed
 * where the pattern design calls for it.
 */
function activeOrigins(pattern: AfterhoursPattern, settings: AfterhoursBeamGenerationSettings): OriginRef[] {
  const origins = bankRefs('bottom', AFTERHOURS_BOTTOM_EMITTERS)
  switch (pattern) {
    case 'fan':
    case 'split':
      // Bottom-dominant families: intentionally ignore Side/Top even when on.
      return origins
    case 'xWall':
      if (settings.topLasers) origins.push(...bankRefs('top', AFTERHOURS_TOP_EMITTERS))
      return origins
    case 'cross':
      if (settings.sideLasers) {
        origins.push(...bankRefs('left', AFTERHOURS_LEFT_EMITTERS))
        origins.push(...bankRefs('right', AFTERHOURS_RIGHT_EMITTERS))
      }
      return origins
    case 'random':
    default:
      if (settings.sideLasers) {
        origins.push(...bankRefs('left', AFTERHOURS_LEFT_EMITTERS))
        origins.push(...bankRefs('right', AFTERHOURS_RIGHT_EMITTERS))
      }
      if (settings.topLasers) origins.push(...bankRefs('top', AFTERHOURS_TOP_EMITTERS))
      return origins
  }
}

function fanTarget(origin: AfterhoursEmitter, ordinal: number, spread: number, seed: number): AfterhoursEmitter {
  const fanX = mix(0.08, 0.92, ordinal)
  const compactX = 0.5 + (origin.x - 0.5) * 0.12
  return {
    x: safeX(mix(compactX, fanX, spread)),
    y: safeY(mix(0.82, 0.95, unit(seed))),
  }
}

function splitTarget(origin: AfterhoursEmitter, ordinal: number, spread: number, seed: number): AfterhoursEmitter {
  const side = origin.x < 0.5 ? -1 : 1
  const anchor = side < 0 ? mix(0.44, 0.06, spread) : mix(0.56, 0.94, spread)
  const drift = (ordinal - 0.5) * mix(0.04, 0.16, spread)
  return {
    x: safeX(anchor + drift),
    y: safeY(mix(0.72, 0.96, unit(seed))),
  }
}

function xWallTarget(origin: OriginRef, spread: number, seed: number): AfterhoursEmitter {
  const mirroredX = safeX(mix(0.5, 1 - origin.emitter.x, mix(0.45, 1, spread)))
  const y = origin.bank === 'top'
    ? safeY(mix(0.26, 0.02, unit(seed)))
    : safeY(mix(0.72, 0.98, unit(seed)))
  return { x: mirroredX, y }
}

function crossTarget(origin: OriginRef, spread: number, seed: number): AfterhoursEmitter {
  if (origin.bank === 'left') {
    return { x: safeX(mix(0.58, 0.96, spread)), y: safeY(origin.emitter.y + mix(-0.12, 0.12, unit(seed))) }
  }
  if (origin.bank === 'right') {
    return { x: safeX(mix(0.42, 0.04, spread)), y: safeY(origin.emitter.y + mix(-0.12, 0.12, unit(seed))) }
  }
  return {
    x: safeX(mix(0.5, 1 - origin.emitter.x, mix(0.5, 1, spread))),
    y: safeY(mix(0.6, 0.95, unit(seed))),
  }
}

function randomTarget(
  origin: AfterhoursEmitter,
  spread: number,
  seed: number,
  claimed: readonly AfterhoursEmitter[],
  relaxSeparation: boolean,
): AfterhoursEmitter {
  const boxHalf = mix(0.14, 0.5 - SAFE_MARGIN, spread)
  const minLen = origin.y > 0.5 ? MIN_BEAM_LENGTH * 0.8 : MIN_BEAM_LENGTH
  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt += 1) {
    const nx = safeX(0.5 + (unit(seed ^ Math.imul(attempt + 1, 0x1b56c4e9)) * 2 - 1) * boxHalf)
    const lowY = origin.y > 0.5 ? SAFE_MARGIN : Math.min(1 - SAFE_MARGIN, origin.y + minLen)
    const highY = origin.y > 0.5 ? Math.max(SAFE_MARGIN, origin.y - minLen) : 1 - SAFE_MARGIN
    const ny = safeY(mix(Math.min(lowY, highY), Math.max(lowY, highY), unit(seed ^ Math.imul(attempt + 7, 0x7f4a7c15))))
    if (Math.hypot(nx - origin.x, ny - origin.y) < minLen) continue
    const tooClose = !relaxSeparation && claimed.some(c => Math.hypot(nx - c.x, ny - c.y) < MIN_TARGET_SEPARATION)
    if (tooClose) continue
    return { x: nx, y: ny }
  }
  // Deterministic repair: a valid, non-degenerate default arc target.
  const repairX = safeX(mix(origin.x, 0.5, 0.5) + (unit(seed) - 0.5) * 0.12)
  const repairY = origin.y > 0.5
    ? safeY(origin.y - minLen - 0.08)
    : safeY(origin.y + minLen + 0.08)
  return { x: repairX, y: repairY }
}

function mirrorBank(bank: AfterhoursBank): AfterhoursBank {
  if (bank === 'left') return 'right'
  if (bank === 'right') return 'left'
  return bank
}

function mirrorEmitter(emitter: AfterhoursEmitter): AfterhoursEmitter {
  return { x: clamp01(1 - emitter.x), y: emitter.y }
}

function inactiveBeam(): AfterhoursBeamDescriptor {
  return Object.freeze({
    active: false,
    bank: 'bottom',
    emitterIndex: 0,
    origin: AFTERHOURS_BOTTOM_EMITTERS[0],
    target: ZERO_TARGET,
    accent: false,
    phase: 0,
  })
}

/**
 * Deterministic, bounded procedural beam allocation. Returns exactly
 * AFTERHOURS_MAX_BEAMS descriptors: the first `beamCount` (clamped 2..16) are
 * active, the rest explicitly inactive/zeroed. Beam Count is a global visible
 * maximum — enabling Side/Top adds candidate origins to cycle through, never
 * additional beams.
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
  const baseSeed = hash32((hash32(variation >>> 0) ^ Math.imul(count, 0x9e3779b1) ^ Math.imul(pattern.length, 0x85ebca77)) >>> 0)

  const origins = activeOrigins(pattern, settings)
  const symmetry = pattern === 'random' && settings.symmetry === true
  const primaryCount = symmetry ? Math.ceil(count / 2) : count

  const beams: AfterhoursBeamDescriptor[] = []
  const claimedTargets: AfterhoursEmitter[] = []

  for (let index = 0; index < primaryCount; index += 1) {
    const ref = origins[index % origins.length]
    const ordinal = count <= 1 ? 0.5 : index / (count - 1)
    const seed = hash32((baseSeed ^ Math.imul(index + 1, 0x27d4eb2d) ^ Math.imul(ref.emitterIndex + 3, 0x165667b1)) >>> 0)

    let target: AfterhoursEmitter
    switch (pattern) {
      case 'split': target = splitTarget(ref.emitter, ordinal, spread, seed); break
      case 'xWall': target = xWallTarget(ref, spread, seed); break
      case 'cross': target = crossTarget(ref, spread, seed); break
      case 'random': target = randomTarget(ref.emitter, spread, seed, claimedTargets, count > origins.length); break
      case 'fan':
      default: target = fanTarget(ref.emitter, ordinal, spread, seed); break
    }
    claimedTargets.push(target)
    beams.push(Object.freeze({
      active: true,
      bank: ref.bank,
      emitterIndex: ref.emitterIndex,
      origin: ref.emitter,
      target: Object.freeze(target),
      accent: accentMix >= 1 || (accentMix > 0 && unit(seed ^ 0x63d83595) < accentMix),
      phase: unit(seed ^ 0x9e3779b9),
    }))
  }

  if (symmetry) {
    for (let index = primaryCount; index < count; index += 1) {
      const source = beams[count - 1 - index] ?? beams[beams.length - 1]
      beams.push(Object.freeze({
        active: true,
        bank: mirrorBank(source.bank),
        emitterIndex: source.emitterIndex,
        origin: Object.freeze(mirrorEmitter(source.origin)),
        target: Object.freeze({ x: clamp01(1 - source.target.x), y: source.target.y }),
        accent: source.accent,
        phase: source.phase,
      }))
    }
  }

  return Object.freeze(Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => (
    index < beams.length ? beams[index] : inactiveBeam()
  )))
}
