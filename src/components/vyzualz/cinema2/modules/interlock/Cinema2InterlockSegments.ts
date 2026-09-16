import type { Cinema2InterlockFixture, Cinema2InterlockFixtureBank } from './Cinema2InterlockDomain'

export const CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS = Object.freeze([
  'solid',
  'forwardChase',
  'reverseChase',
  'centerOut',
  'edgeIn',
  'alternating',
  'audioMeterFill',
  'bankRipple',
  'impactBurst',
] as const)

export type Cinema2InterlockSegmentProgramId = typeof CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS[number]

export const CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID: Cinema2InterlockSegmentProgramId = 'centerOut'
export const CINEMA2_INTERLOCK_DEFAULT_LIT_DENSITY = 0.65
export const CINEMA2_INTERLOCK_DEFAULT_SEGMENT_SPEED = 0.5
export const CINEMA2_INTERLOCK_DEFAULT_SEGMENT_FADE = 0.32
export const CINEMA2_INTERLOCK_DEFAULT_SEGMENT_AFTERGLOW = 0.18
export const CINEMA2_INTERLOCK_DEFAULT_UNLIT_VISIBILITY = 0.045
export const CINEMA2_INTERLOCK_DEFAULT_MIRROR_SEGMENT_DIRECTION = true

export const CINEMA2_INTERLOCK_SEGMENT_CELL_COUNTS: Readonly<Record<Cinema2InterlockFixtureBank, number>> = Object.freeze({
  inner: 24,
  middle: 32,
  outer: 48,
  edge: 48,
})

export const CINEMA2_INTERLOCK_SEGMENT_BANK_INDEX: Readonly<Record<Cinema2InterlockFixtureBank, number>> = Object.freeze({
  inner: 0,
  middle: 1,
  outer: 2,
  edge: 3,
})

export interface Cinema2InterlockSegmentIntensityInput {
  readonly program: Cinema2InterlockSegmentProgramId
  readonly cellIndex: number
  readonly cellCount: number
  readonly phase: number
  readonly litDensity: number
  readonly segmentFade: number
  readonly segmentAfterglow: number
  readonly segmentEnergy: number
  readonly segmentImpact: number
  readonly segmentDirectionBias: number
  readonly segmentBankPhase: number
  readonly direction: 1 | -1
  readonly bankIndex: number
  readonly fixtureOrder: number
}

export function normalizeCinema2InterlockSegmentProgramId(value: unknown): Cinema2InterlockSegmentProgramId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS as readonly string[]).includes(value)
    ? value as Cinema2InterlockSegmentProgramId
    : CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID
}


export function getCinema2InterlockSegmentProgramIndex(program: Cinema2InterlockSegmentProgramId): number {
  return CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS.indexOf(program)
}

export function resolveCinema2InterlockCellCount(
  fixture: Pick<Cinema2InterlockFixture, 'bank'>,
): number {
  return CINEMA2_INTERLOCK_SEGMENT_CELL_COUNTS[fixture.bank]
}

export function resolveCinema2InterlockCellCenters(cellCount: number): readonly number[] {
  const count = clampInteger(cellCount, 1, 256)
  return Object.freeze(Array.from({ length: count }, (_, index) => (index + 0.5) / count))
}

export function resolveCinema2InterlockSegmentPhase(timeSec: number, speed: number): number {
  const safeTime = Number.isFinite(timeSec) ? Math.max(0, timeSec) : 0
  const normalizedSpeed = clamp01(speed)
  if (normalizedSpeed <= 1e-6) return 0
  const cyclesPerSecond = 0.18 + normalizedSpeed * 1.82
  return fract(safeTime * cyclesPerSecond)
}

/**
 * Pure reference implementation of the shader's illumination policy. Tests use
 * this function to falsify boundary phases without creating per-cell runtime
 * objects. The renderer computes the same family of masks analytically on GPU.
 */
export function resolveCinema2InterlockSegmentIntensity(
  input: Readonly<Cinema2InterlockSegmentIntensityInput>,
): number {
  const count = clampInteger(input.cellCount, 1, 256)
  const index = clampInteger(input.cellIndex, 0, count - 1)
  const rawPosition = (index + 0.5) / count
  const directionBias = clamp(input.segmentDirectionBias, -1, 1)
  const directedPosition = input.direction < 0 ? 1 - rawPosition : rawPosition
  const position = fract(directedPosition + directionBias * 0.125 + 1)
  const phase = fract(finiteOr(input.phase, 0))
  const density = clamp(input.litDensity, 0.05, 1)
  const fade = clamp01(input.segmentFade)
  const afterglow = clamp01(input.segmentAfterglow)
  const energy = clamp01(input.segmentEnergy)
  const impact = clamp01(input.segmentImpact)
  const bankStagger = clamp01(finiteOr(input.segmentBankPhase, 0))
  const bankIndex = clampInteger(input.bankIndex, 0, 3)
  const fixtureOrder = clamp01(input.fixtureOrder)

  switch (input.program) {
    case 'solid':
      return 1
    case 'forwardChase':
      return chaseMask(position, phase, density, fade, afterglow, 1)
    case 'reverseChase':
      return chaseMask(position, phase, density, fade, afterglow, -1)
    case 'centerOut': {
      const radial = Math.abs(position - 0.5) * 2
      return movingFrontMask(radial, phase, density, fade, afterglow)
    }
    case 'edgeIn': {
      const edgeDistance = Math.min(position, 1 - position) * 2
      return movingFrontMask(edgeDistance, phase, density, fade, afterglow)
    }
    case 'alternating': {
      const parity = index % 2
      const activeParity = phase < 0.5 ? 0 : 1
      const transition = Math.min(Math.abs(phase - 0.5), Math.abs(phase), Math.abs(1 - phase))
      const edge = 0.08 + fade * 0.17
      const parityLevel = parity === activeParity ? 1 : 1 - smoothstep(0, edge, transition)
      return clamp01(parityLevel * (0.45 + density * 0.55))
    }
    case 'audioMeterFill': {
      const threshold = clamp01(energy * (0.35 + density * 0.65))
      return thresholdMask(position, threshold, fade)
    }
    case 'bankRipple': {
      const offset = bankIndex * 0.17 * bankStagger + fixtureOrder * 0.11
      return chaseMask(position, fract(phase - offset + 1), density, fade, afterglow, 1)
    }
    case 'impactBurst': {
      const radial = Math.abs(position - 0.5) * 2
      const burstPhase = fract(phase * 0.72)
      const wave = movingFrontMask(radial, burstPhase, Math.max(0.18, density * 0.72), fade, afterglow)
      const envelope = 0.28 + impact * 0.72
      return clamp01(wave * envelope)
    }
  }
}

function chaseMask(
  position: number,
  phase: number,
  density: number,
  fade: number,
  afterglow: number,
  direction: 1 | -1,
): number {
  const head = direction > 0 ? phase : fract(1 - phase)
  const distanceBehind = direction > 0
    ? fract(head - position + 1)
    : fract(position - head + 1)
  const coreWidth = 0.035 + density * 0.36
  const softness = 0.01 + fade * 0.12
  const core = 1 - smoothstep(coreWidth, coreWidth + softness, distanceBehind)
  const tailWidth = coreWidth + 0.03 + afterglow * 0.5
  const tail = (1 - smoothstep(coreWidth, tailWidth, distanceBehind)) * afterglow * 0.72
  return clamp01(Math.max(core, tail))
}

function movingFrontMask(
  position: number,
  phase: number,
  density: number,
  fade: number,
  afterglow: number,
): number {
  const front = phase
  const distance = Math.abs(position - front)
  const width = 0.025 + density * 0.19
  const softness = 0.01 + fade * 0.11
  const core = 1 - smoothstep(width, width + softness, distance)
  const trailing = position <= front
    ? (1 - smoothstep(width, width + 0.05 + afterglow * 0.45, distance)) * afterglow * 0.65
    : 0
  return clamp01(Math.max(core, trailing))
}

function thresholdMask(position: number, threshold: number, fade: number): number {
  const softness = 0.005 + fade * 0.06
  return 1 - smoothstep(threshold, threshold + softness, position)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) return value < edge0 ? 0 : 1
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? Math.round(value) : minimum
  return Math.max(minimum, Math.min(maximum, finite))
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function fract(value: number): number {
  return value - Math.floor(value)
}
