import type { Cinema2SayItGlyphPose } from '../sayIt/Cinema2SayItMotion'
import { CINEMA2_SAY_IT_PATTERN_IDS, type Cinema2SayItPatternId } from '../sayIt/Cinema2SayItPatternController'
import { CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE } from '../sayIt/Cinema2SayItTextLayout'

export const CINEMA2_ORBITAL_PATTERNS = [
  { value: 'gyroscopic-drift', label: 'Gyroscopic Drift' },
  { value: 'apsis-pulse', label: 'Apsis Pulse' },
  { value: 'counter-orbit', label: 'Counter Orbit' },
  { value: 'meridian-sweep', label: 'Meridian Sweep' },
  { value: 'resonant-lock', label: 'Resonant Lock' },
  { value: 'eclipse-rise', label: 'Eclipse Rise' },
] as const
export type OrbitalPattern = typeof CINEMA2_ORBITAL_PATTERNS[number]['value']

export function orbitalControllerPattern(value: unknown): Cinema2SayItPatternId {
  const index = CINEMA2_ORBITAL_PATTERNS.findIndex(pattern => pattern.value === value)
  return CINEMA2_SAY_IT_PATTERN_IDS[Math.max(0, index)]!
}
export function orbitalPattern(value: Cinema2SayItPatternId): OrbitalPattern {
  return CINEMA2_ORBITAL_PATTERNS[CINEMA2_SAY_IT_PATTERN_IDS.indexOf(value)]!.value
}

export interface OrbitalMotionInput {
  phaseBeats: number
  period: number
  amount: number
  ringTravel: number
  bass: number
  mids: number
  highs: number
  beat: number
}

type Vec3 = readonly [number, number, number]
export interface OrbitalPose {
  tilt: Vec3
  rings: Vec3
  lift: number
  expansion: number
  armPhase: number
}

/** All movement stays within the framed title volume and the rig's supported articulation. */
export function resolveOrbitalPose(pattern: OrbitalPattern, input: Readonly<OrbitalMotionInput>): OrbitalPose {
  const { bass, mids, highs, beat } = input
  const t = input.phaseBeats * Math.PI / input.period
  const s = Math.sin(t), c = Math.cos(t)
  const drive = input.amount * input.ringTravel
  let tilt: Vec3, rings: Vec3, lift: number, expansion: number, armPhase: number
  switch (pattern) {
    case 'gyroscopic-drift':
      tilt = [s * .10, c * .14, s * .05]
      rings = [s * .22, Math.sin(t + 1.2) * .34, c * .44]
      lift = s * .12; expansion = s * .025; armPhase = s * .12
      break
    case 'apsis-pulse': {
      const pulse = Math.max(bass, beat * .8, Math.pow(.5 + .5 * Math.cos(t * 3), 4) * .35)
      tilt = [-pulse * .20, s * .06, 0]
      rings = [pulse * .28, -pulse * .36, pulse * .50]
      lift = pulse * .09; expansion = pulse * .13; armPhase = pulse * .20
      break
    }
    case 'counter-orbit':
      tilt = [s * .12, -s * .24, c * .08]
      rings = [s * .58, -s * .67, Math.sin(t * 1.5) * .72]
      lift = c * .08; expansion = bass * .035; armPhase = -s * .38
      break
    case 'meridian-sweep': {
      const sweep = Math.sin(t * 1.4)
      tilt = [sweep * .24, c * .19, sweep * .12]
      rings = [sweep * .38, Math.sin(t - .7) * .43, Math.sin(t - 1.4) * .54]
      lift = sweep * .15; expansion = mids * .045; armPhase = sweep * .34
      break
    }
    case 'resonant-lock': {
      const resonant = Math.sin(t * 2.2) * (.25 + mids * .40) * (1 - beat * .6)
      tilt = [resonant * .13, resonant * .22, -resonant * .16]
      rings = [resonant * .36, -resonant * .47, resonant * .82]
      lift = resonant * .08; expansion = bass * .08; armPhase = resonant * .25
      break
    }
    case 'eclipse-rise': {
      const rise = .5 + .5 * s
      tilt = [rise * .26, -rise * .31, c * .07]
      rings = [rise * .43, c * .43, -rise * .72]
      lift = rise * (.34 + highs * .07); expansion = rise * .06; armPhase = rise * .41
      break
    }
  }
  const scale = (vector: Vec3): Vec3 => [vector[0] * drive, vector[1] * drive, vector[2] * drive]
  return { tilt: scale(tilt), rings: scale(rings), lift: lift * drive, expansion: expansion * drive, armPhase: armPhase * drive }
}

export function resolveOrbitalGlyphs(poses: readonly Readonly<Cinema2SayItGlyphPose>[], pattern: OrbitalPattern, input: Readonly<OrbitalMotionInput>): readonly Readonly<Cinema2SayItGlyphPose>[] {
  if (input.amount === 0) return poses
  const t = input.phaseBeats * Math.PI / input.period
  const drive = input.amount * (.65 + input.bass * .35)
  return poses.map((glyph, index) => {
    const [x, y, z] = glyph.position
    const wave = Math.sin(t * 1.3 - index * .5)
    const side = y > 0 ? 1 : y < 0 ? -1 : index % 2 ? 1 : -1
    let dx = 0, dy = 0, dz = 0, pitch = 0, yaw = 0
    switch (pattern) {
      case 'gyroscopic-drift': dy = wave * .075; yaw = wave * .09; break
      case 'apsis-pulse': dz = (.10 + .22 * Math.max(input.bass, input.beat)) * (1 + wave * .35); pitch = wave * .08; break
      case 'counter-orbit': dx = Math.sin(t) * .16 * side; dz = wave * .10; yaw = wave * .15 * side; break
      case 'meridian-sweep': dy = wave * .13; dz = wave * .14; pitch = wave * .13; break
      case 'resonant-lock': dx = x * .05 * wave * (1 - input.beat); dz = .17 * input.beat; yaw = wave * .06; break
      case 'eclipse-rise': dy = (.5 + .5 * wave) * (.13 + input.highs * .06); dz = -wave * .10; pitch = -wave * .10; break
    }
    return { ...glyph, position: [x + dx * drive, y + dy * drive, z + dz * drive], rotation: [pitch * drive, yaw * drive, 0] }
  })
}

/** How two lines sit on the orbit: Stacked keeps them one above the other (the layout as authored); Linear puts both on one row, opposite each other. */
export const CINEMA2_ORBITAL_POSITIONS = [
  { value: 'stacked', label: 'Stacked' },
  { value: 'linear', label: 'Linear' },
] as const
export type OrbitalPosition = typeof CINEMA2_ORBITAL_POSITIONS[number]['value']
export const orbitalPosition = (value: unknown): OrbitalPosition => value === 'linear' ? 'linear' : 'stacked'

/** The line a glyph belongs to. The text layout numbers characters twelve to a line (`glyph-<line * 12 + index>`). */
export function orbitalGlyphLine(id: string): number {
  const number = Number(/(\d+)$/.exec(id)?.[1])
  return Number.isFinite(number) ? Math.floor(number / CINEMA2_SAY_IT_MAX_CHARACTERS_PER_LINE) : 0
}

export interface OrbitalRingInput {
  /** Radius of the ring the lettering travels on, measured from the sphere's centre. */
  radius: number
  /** How far the lettering has travelled round the ring, in radians. 0 puts the first line facing the camera. */
  angle: number
  position: OrbitalPosition
}

/**
 * Wraps the laid-out lettering onto a horizontal ring about the sphere's centre, so it orbits the sphere. Positions are relative to that centre and each
 * letter faces outward from the ring. Stacked keeps both lines on the same arc, one above the other. Linear gives each line its own arc on one row, the
 * second line half a turn from the first, so one is in front of the sphere while the other is behind it.
 */
export function resolveOrbitalRing(glyphs: readonly Readonly<Cinema2SayItGlyphPose>[], input: Readonly<OrbitalRingInput>): readonly Readonly<Cinema2SayItGlyphPose>[] {
  const lines = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>()
  for (const glyph of glyphs) {
    const line = orbitalGlyphLine(glyph.id), [x, y] = glyph.position, extent = lines.get(line)
    if (extent) { extent.minX = Math.min(extent.minX, x); extent.maxX = Math.max(extent.maxX, x); extent.minY = Math.min(extent.minY, y); extent.maxY = Math.max(extent.maxY, y) }
    else lines.set(line, { minX: x, maxX: x, minY: y, maxY: y })
  }
  const linear = input.position === 'linear' && lines.size > 1
  return glyphs.map(glyph => {
    const line = orbitalGlyphLine(glyph.id), extent = lines.get(line)!
    let [x, y] = glyph.position
    const z = glyph.position[2]
    let phase = 0
    if (linear) { x -= (extent.minX + extent.maxX) / 2; y -= (extent.minY + extent.maxY) / 2; phase = line % 2 === 0 ? 0 : Math.PI }
    const angle = x / input.radius + input.angle + phase, reach = input.radius + z
    return { ...glyph, position: [Math.sin(angle) * reach, y, Math.cos(angle) * reach] as const, rotation: [glyph.rotation[0], glyph.rotation[1] + angle, glyph.rotation[2]] as const }
  })
}
