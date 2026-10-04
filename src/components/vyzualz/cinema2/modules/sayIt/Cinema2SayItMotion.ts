import type { Cinema2SayItLayoutGlyph } from './Cinema2SayItTextLayout'

export const CINEMA2_SAY_IT_PROOF_TEXT = 'SAY IT'

export interface Cinema2SayItMotionOptions {
  cycleSeconds: number
  motionAmount: number
  spread: number
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
  const amount = clamp(options.motionAmount, 0, 1)
  const spread = clamp(options.spread, 0, 3) * amount
  const phase = positiveModulo(Number.isFinite(timeSeconds) ? timeSeconds / cycleSeconds : 0, 1)

  return Object.freeze(glyphs.map((glyph, index) => {
    const stagger = Math.min(index, 19) * 0.004
    const release = smoothRange(0.18 + stagger, 0.36 + stagger, phase)
    const returnProgress = smoothRange(0.66 + stagger, 0.84 + stagger, phase)
    const excursion = release * (1 - returnProgress)
    const orbit = clamp((phase - (0.34 + stagger)) / 0.34, 0, 1) * (1 - returnProgress)
    const seed = poseSeed(glyph.codePoint, index)
    const direction = index % 2 === 0 ? -1 : 1
    const lift = Math.sin(seed * 11.7) * 0.42
    const depth = 0.68 + seed * 0.62
    const x = glyph.position[0] + direction * spread * (0.42 + seed * 0.58) * excursion
    const y = glyph.position[1] + lift * spread * excursion
    const z = glyph.position[2] + depth * spread * excursion
    const fullTurn = Math.PI * 2
    const rotation: readonly [number, number, number] = Object.freeze([
      amount * direction * (fullTurn * (1 + seed * 0.7) * release + fullTurn * 0.5 * orbit) * (1 - returnProgress),
      amount * (fullTurn * (0.78 + seed * 0.65) * release + fullTurn * orbit) * (1 - returnProgress),
      amount * direction * (Math.PI * (0.18 + seed * 0.5) * release) * (1 - returnProgress),
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

function poseSeed(codePoint: number, index: number): number {
  let value = Math.imul(codePoint + 1, 2654435761) ^ Math.imul(index + 17, 2246822519)
  value ^= value >>> 15
  return (value >>> 0) / 0xffffffff
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
