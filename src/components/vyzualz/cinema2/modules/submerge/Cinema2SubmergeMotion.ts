import type { Cinema2SayItGlyphPose } from '../sayIt/Cinema2SayItMotion'
import { CINEMA2_SAY_IT_PATTERN_IDS, type Cinema2SayItPatternId } from '../sayIt/Cinema2SayItPatternController'

export const CINEMA2_SUBMERGE_PATTERNS = [
  { value: 'suspension', label: 'Suspension' },
  { value: 'pressure-wave', label: 'Pressure Wave' },
  { value: 'undertow', label: 'Undertow' },
  { value: 'crosscurrent', label: 'Crosscurrent' },
  { value: 'vortex', label: 'Vortex' },
  { value: 'upwelling', label: 'Upwelling' },
] as const
export type Cinema2SubmergePattern = typeof CINEMA2_SUBMERGE_PATTERNS[number]['value']

// Reuse the established six-pattern controller's shuffled-cycle and musical-event authority.
export function submergePatternToController(value: unknown): Cinema2SayItPatternId {
  const index = CINEMA2_SUBMERGE_PATTERNS.findIndex(pattern => pattern.value === value)
  return CINEMA2_SAY_IT_PATTERN_IDS[Math.max(0, index)]!
}
export function submergePatternFromController(value: Cinema2SayItPatternId): Cinema2SubmergePattern {
  return CINEMA2_SUBMERGE_PATTERNS[CINEMA2_SAY_IT_PATTERN_IDS.indexOf(value)]!.value
}
export interface Cinema2SubmergeState {
  beats: number
  amount: number
  safety: 'full' | 'reduced' | 'lockoff'
  reach: number
  period: number
  buoyancy: number
  bass: number
  mids: number
  highs: number
  energy: number
  caustics: number
  haze: number
  particles: number
  bubbles: number
  architecture: number
  depth: number
  material: 'ceramic' | 'metal' | 'glass'
  water: readonly [number, number, number]
}
export const DEFAULT_SUBMERGE_STATE: Readonly<Cinema2SubmergeState> = Object.freeze({
  beats: 0, amount: 0.65, safety: 'full', reach: 1, period: 8, buoyancy: 0.6,
  bass: 0, mids: 0, highs: 0, energy: 0, caustics: 0.75, haze: 0.055,
  particles: 0.65, bubbles: 0.5, architecture: 1, depth: 1, material: 'ceramic', water: [0.012, 0.11, 0.16] as const,
})
export function submergeMotionAmount(state: Readonly<Cinema2SubmergeState>): number {
  return state.amount * (state.safety === 'lockoff' ? 0 : state.safety === 'reduced' ? 0.28 : 1)
}

/** All six vocabularies move actual geometry; no glyph can leave its readable neighborhood. */
export function resolveSubmergeGlyphPoses(
  poses: readonly Readonly<Cinema2SayItGlyphPose>[], pattern: Cinema2SubmergePattern,
  phaseBeats: number, state: Readonly<Cinema2SubmergeState>,
): readonly Readonly<Cinema2SayItGlyphPose>[] {
  const amount = submergeMotionAmount(state)
  if (amount === 0) return poses
  const t = phaseBeats * Math.PI / Math.max(2, state.period)
  const drive = amount * Math.min(1.8, state.reach * (0.7 + state.bass * 0.5 + state.energy * 0.2))
  return poses.map((pose, index) => {
    const [x, y, z] = pose.position
    const phase = t + index * 0.58
    let dx = 0, dy = 0, dz = 0, rx = 0, ry = 0, rz = 0
    switch (pattern) {
      case 'suspension':
        dy = Math.sin(phase * 0.7) * 0.1 * state.buoyancy
        ry = Math.sin(phase * 0.4) * 0.08
        break
      case 'pressure-wave': {
        const wave = Math.sin(t * 2.2 - Math.abs(x) * 0.8)
        dz = wave * (0.18 + state.bass * 0.18)
        dy = wave * 0.055
        rx = wave * 0.1
        break
      }
      case 'undertow':
        dx = Math.sin(phase) * 0.22
        dz = Math.cos(phase) * 0.23
        ry = Math.sin(phase) * 0.17
        break
      case 'crosscurrent': {
        const direction = y > 0 ? 1 : y < 0 ? -1 : index % 2 ? 1 : -1
        dx = Math.sin(t * 1.4) * 0.26 * direction
        dz = Math.cos(phase) * 0.13
        rz = Math.sin(t) * 0.07 * direction
        break
      }
      case 'vortex':
        dx = Math.cos(phase) * 0.13
        dy = Math.sin(phase) * 0.15
        dz = Math.sin(phase * 0.5) * 0.28
        rz = Math.sin(phase) * 0.12
        ry = Math.cos(phase) * 0.16
        break
      case 'upwelling':
        dy = (Math.sin(phase * 1.8) * 0.19 + state.highs * 0.1) * state.buoyancy
        dz = Math.cos(phase * 1.8) * 0.12
        rx = Math.sin(phase * 1.8) * 0.13
        break
    }
    return { ...pose, position: [x + dx * drive, y + dy * drive, z + dz * drive], rotation: [rx * drive, ry * drive, rz * drive] }
  })
}
