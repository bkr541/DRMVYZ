import type { Cinema2SayItLayoutGlyph } from './Cinema2SayItTextLayout'

export const CINEMA2_SAY_IT_PROOF_TEXT = 'SAY IT'

export const CINEMA2_SAY_IT_MOTION_PROGRAMS = Object.freeze(['flip', 'tumble', 'wave', 'scatter', 'hinge'] as const)
export type Cinema2SayItMotionProgram = typeof CINEMA2_SAY_IT_MOTION_PROGRAMS[number]
export const CINEMA2_SAY_IT_MOTION_DIRECTIONS = Object.freeze(['alternate', 'forward', 'reverse', 'center-out', 'random'] as const)
export type Cinema2SayItMotionDirection = typeof CINEMA2_SAY_IT_MOTION_DIRECTIONS[number]
export const CINEMA2_SAY_IT_MOTION_SAFETY_MODES = Object.freeze(['full', 'reduced', 'lockoff'] as const)
export type Cinema2SayItMotionSafety = typeof CINEMA2_SAY_IT_MOTION_SAFETY_MODES[number]

export interface Cinema2SayItMotionOptions {
  cycleSeconds: number
  motionAmount: number
  spread: number
  program?: Cinema2SayItMotionProgram
  glyphDelay?: number
  direction?: Cinema2SayItMotionDirection
  axisWeights?: readonly [number, number, number]
  randomSeed?: number
  safety?: Cinema2SayItMotionSafety
}

export interface Cinema2SayItGlyphPose {
  id: string
  character: string
  mesh: string
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
  scale: number
}

const PROOF_GLYPHS: readonly Readonly<Cinema2SayItLayoutGlyph>[] = Object.freeze([
  proofGlyph('S', 0, -2.15),
  proofGlyph('A', 1, -1.02),
  proofGlyph('Y', 2, 0.08),
  proofGlyph('I', 3, 1.23),
  proofGlyph('T', 4, 1.92),
])

/**
 * Deterministic kinetic-type motion: hold the exact layout, stagger the glyphs apart,
 * turn every glyph through at least one full revolution, then land on the exact
 * authored transforms again. Every cycle begins and ends with an assembled hold.
 */
export function resolveCinema2SayItGlyphPoses(
  timeSeconds: number,
  options: Readonly<Cinema2SayItMotionOptions>,
  glyphs: readonly Readonly<Cinema2SayItLayoutGlyph>[] = PROOF_GLYPHS,
): readonly Readonly<Cinema2SayItGlyphPose>[] {
  const cycleSeconds = clamp(options.cycleSeconds, 2, 120)
  const safety = options.safety ?? 'full'
  const safetyAmount = safety === 'lockoff' ? 0 : safety === 'reduced' ? 0.28 : 1
  const amount = clamp(options.motionAmount, 0, 1) * safetyAmount
  const spread = clamp(options.spread, 0, 3) * amount * (safety === 'reduced' ? 0.5 : 1)
  const program = options.program ?? 'tumble'
  const directionMode = options.direction ?? 'alternate'
  const axisWeights = options.axisWeights ?? [1, 1, 1]
  const axisX = clamp(axisWeights[0], 0, 1)
  const axisY = clamp(axisWeights[1], 0, 1)
  const axisZ = clamp(axisWeights[2], 0, 1)
  const randomSeed = Number.isFinite(options.randomSeed) ? Math.round(options.randomSeed ?? 0) : 0
  const glyphDelay = clamp(options.glyphDelay ?? 0.004, 0, 0.02)
  const phase = positiveModulo(Number.isFinite(timeSeconds) ? timeSeconds / cycleSeconds : 0, 1)
  const delayOrder = resolveDelayOrder(glyphs.length, directionMode, randomSeed)

  return Object.freeze(glyphs.map((glyph, index) => {
    const stagger = Math.min(0.12, (delayOrder[index] ?? index) * glyphDelay)
    const release = smoothRange(0.16 + stagger, 0.32 + stagger, phase)
    const returnProgress = smoothRange(0.62 + stagger, 0.78 + stagger, phase)
    const excursion = release * (1 - returnProgress)
    const orbit = clamp((phase - (0.3 + stagger)) / 0.32, 0, 1) * (1 - returnProgress)
    const seed = poseSeed(glyph.codePoint, index, randomSeed)
    const direction = resolveDirection(index, glyphs.length, directionMode, seed)
    const lift = Math.sin(seed * 11.7) * 0.42
    const depth = 0.68 + seed * 0.62
    const fullTurn = Math.PI * 2
    const turn = (fullTurn * (1 + seed * 0.7) * release + fullTurn * 0.5 * orbit) * (1 - returnProgress)
    const wave = Math.sin(phase * Math.PI * 4 - index * 0.72) * excursion
    let x = glyph.position[0]
    let y = glyph.position[1]
    let z = glyph.position[2]
    let rotationX = 0
    let rotationY = 0
    let rotationZ = 0

    switch (program) {
      case 'flip':
        x += direction * spread * 0.18 * excursion
        z += depth * spread * 0.34 * excursion
        rotationX = direction * turn * 0.12
        rotationY = direction * turn
        rotationZ = direction * turn * 0.08
        break
      case 'wave':
        y += wave * spread * 0.62
        z += (0.18 + seed * 0.16) * spread * excursion
        rotationX = direction * turn * 0.72
        rotationY = turn * 0.16
        rotationZ = direction * wave * Math.PI * 0.45
        break
      case 'scatter':
        x += direction * spread * (0.58 + seed * 0.74) * excursion
        y += lift * spread * 1.35 * excursion
        z += depth * spread * 1.1 * excursion
        rotationX = direction * turn * (0.76 + seed * 0.34)
        rotationY = turn * (0.82 + seed * 0.4)
        rotationZ = -direction * turn * (0.48 + seed * 0.46)
        break
      case 'hinge': {
        const hingeAngle = direction * turn
        const hingeRadius = glyph.scale * 0.42 * Math.min(1, spread)
        x += direction * hingeRadius * (1 - Math.cos(hingeAngle)) * excursion
        z += hingeRadius * Math.sin(hingeAngle) * excursion
        rotationY = hingeAngle
        break
      }
      case 'tumble':
      default:
        x += direction * spread * (0.42 + seed * 0.58) * excursion
        y += lift * spread * excursion
        z += depth * spread * excursion
        rotationX = direction * turn
        rotationY = turn * (0.82 + seed * 0.38)
        rotationZ = direction * turn * (0.38 + seed * 0.28)
        break
    }

    const rotation: readonly [number, number, number] = Object.freeze([
      rotationX * amount * axisX,
      rotationY * amount * axisY,
      rotationZ * amount * axisZ,
    ])
    const position: readonly [number, number, number] = Object.freeze([x, y, z])
    return Object.freeze({ id: glyph.id, character: glyph.character, mesh: glyph.mesh, position, rotation, scale: glyph.scale })
  }))
}

export function cinema2SayItIsExactlyAssembled(
  poses: readonly Readonly<Cinema2SayItGlyphPose>[],
  glyphs: readonly Readonly<Cinema2SayItLayoutGlyph>[] = PROOF_GLYPHS,
): boolean {
  return poses.every((pose, index) => {
    const glyph = glyphs[index]
    return !!glyph
      && pose.id === glyph.id
      && pose.position[0] === glyph.position[0]
      && pose.position[1] === glyph.position[1]
      && pose.position[2] === glyph.position[2]
      && pose.rotation.every(value => value === 0)
  })
}

function proofGlyph(character: string, characterIndex: number, x: number): Readonly<Cinema2SayItLayoutGlyph> {
  const codePoint = character.codePointAt(0)!
  return Object.freeze({
    id: `glyph-${characterIndex}`,
    character,
    characterIndex,
    codePoint,
    mesh: `glyph-u${codePoint.toString(16).padStart(4, '0').toUpperCase()}`,
    lineIndex: 0,
    position: Object.freeze([x, 0, 0] as const),
    scale: 1,
  })
}

function poseSeed(codePoint: number, index: number, randomSeed = 0): number {
  let value = Math.imul(codePoint + 1, 2654435761) ^ Math.imul(index + 17, 2246822519) ^ Math.imul(randomSeed + 101, 3266489917)
  value ^= value >>> 15
  return (value >>> 0) / 0xffffffff
}

function resolveDirection(index: number, count: number, mode: Cinema2SayItMotionDirection, seed: number): -1 | 1 {
  switch (mode) {
    case 'forward': return 1
    case 'reverse': return -1
    case 'center-out': return index < (count - 1) / 2 ? -1 : 1
    case 'random': return seed < 0.5 ? -1 : 1
    case 'alternate':
    default: return index % 2 === 0 ? -1 : 1
  }
}

function resolveDelayOrder(count: number, mode: Cinema2SayItMotionDirection, randomSeed: number): readonly number[] {
  const indices = Array.from({ length: count }, (_, index) => index)
  if (mode === 'reverse') return indices.map(index => count - 1 - index)
  if (mode === 'center-out') return indices.map(index => Math.round(Math.abs(index - (count - 1) / 2) * 2))
  if (mode === 'random') {
    const ranked = [...indices].sort((a, b) => poseSeed(a + 31, a, randomSeed) - poseSeed(b + 31, b, randomSeed))
    const rankByIndex = new Map(ranked.map((index, rank) => [index, rank]))
    return indices.map(index => rankByIndex.get(index) ?? index)
  }
  return indices
}

function smoothRange(start: number, end: number, value: number): number {
  const t = clamp((value - start) / Math.max(1e-6, end - start), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
