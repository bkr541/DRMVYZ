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

export interface SubmergePerformanceFrame {
  readonly build: number
  readonly release: number
  readonly dropAge: number
  readonly kickAges: readonly number[]
}

const REST_PERFORMANCE: SubmergePerformanceFrame = Object.freeze({ build: 0, release: 0, dropAge: -1, kickAges: [] })

/** Retain short, overlapping pressure fronts on the shared beat clock. */
export class SubmergePerformance {
  private lastKick: string | null = null
  private lastDrop: string | null = null
  private kicks: number[] = []
  private dropBeat: number | null = null

  reset(): void {
    this.lastKick = this.lastDrop = null
    this.kicks = []
    this.dropBeat = null
  }

  update(beat: number, build: number, kick: string | null, drop: string | null): SubmergePerformanceFrame {
    if (kick && kick !== this.lastKick) {
      this.lastKick = kick
      this.kicks.unshift(beat)
      this.kicks.length = Math.min(3, this.kicks.length)
    }
    if (drop && drop !== this.lastDrop) {
      this.lastDrop = drop
      this.dropBeat = beat
    }
    const age = this.dropBeat == null ? -1 : beat - this.dropBeat
    const dropAge = age >= 0 && age < 4 ? age : -1
    const release = dropAge < 0 ? 0 : (1 - dropAge / 4) ** 2
    return {
      build: Math.max(0, Math.min(1, (build - 0.16) / 0.66)) ** 1.25 * (1 - release),
      release,
      dropAge,
      kickAges: this.kicks.map(start => beat - start).filter(elapsed => elapsed >= 0 && elapsed < 2),
    }
  }
}

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
  waves: number
  sunlight: number
  sun: readonly [number, number, number]
  foam: readonly [number, number, number]
  depth: number
  material: 'ceramic' | 'metal' | 'glass'
  water: readonly [number, number, number]
  performance: Readonly<SubmergePerformanceFrame>
}
export const DEFAULT_SUBMERGE_STATE: Readonly<Cinema2SubmergeState> = Object.freeze({
  beats: 0, amount: 0.65, safety: 'full', reach: 1, period: 8, buoyancy: 0.6,
  bass: 0, mids: 0, highs: 0, energy: 0, caustics: 0.75, haze: 0.055,
  waves: 0.85, sunlight: 1, sun: [0.57, 0.85, 0.94] as const, foam: [0.72, 0.84, 0.86] as const,
  particles: 0.65, bubbles: 0.5, architecture: 1, depth: 1, material: 'ceramic', water: [0.012, 0.11, 0.16] as const,
  performance: REST_PERFORMANCE,
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
  const { build, release, kickAges } = state.performance
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
    const pressure = kickAges.reduce((peak, age) => Math.max(peak,
      Math.exp(-(((age - (0.06 + Math.abs(x) * 0.13)) * 7) ** 2)),
    ), 0)
    const converge = Math.max(-0.42, Math.min(0.42, x * 0.16)) * build
    const fan = Math.max(-0.24, Math.min(0.24, x * 0.085)) * release
    const depth = (0.24 + 0.38 * Math.min(1, Math.abs(x) * 0.33)) * release
      + pressure * (pattern === 'pressure-wave' ? 0.34 : 0.13)
    const drift = drive * (1 - build * 0.66)
    return {
      ...pose,
      position: [x + dx * drift + (fan - converge) * amount, y + dy * drift, z + dz * drift - depth * amount],
      rotation: [rx * drift, ry * drift, rz * drift],
    }
  })
}
