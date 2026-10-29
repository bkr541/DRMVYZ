import { cinema2StableId, type Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'

export const TRIPPY_BRO_PATTERNS = ['prismLattice', 'goldenFold', 'quadBloom', 'neonCross', 'liquidWeave', 'orbitalLace', 'prismEcho', 'chromaticKnot'] as const
export type TrippyBroPattern = typeof TRIPPY_BRO_PATTERNS[number]
export const TRIPPY_BRO_PATTERN_LABELS = ['Prism Lattice', 'Golden Fold', 'Quad Bloom', 'Neon Cross', 'Liquid Weave', 'Orbital Lace', 'Prism Echo', 'Chromatic Knot'] as const
export const trippyBroParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`trippy-bro-${name}`)
export const TRIPPY_BRO_COLORS = {
  background: [0, 0, 0, 1], cyan: [0.10, 0.83, 0.94, 1], blue: [0.16, 0.28, 0.97, 1],
  magenta: [0.96, 0.16, 0.64, 1], amber: [1, 0.63, 0.06, 1], highlight: [1, 0.94, 0.78, 1],
} as const
export const TRIPPY_BRO_NUMBERS = {
  intensity: [0, 1, 1], reactivity: [0, 0.65, 1], scale: [0.55, 1, 1.25],
  density: [5, 13, 21], width: [0.6, 1, 2], speed: [0, 1, 2], amount: [0, 0.45, 1],
  detail: [0, 0.3, 1], bloom: [0, 0.22, 0.7], trails: [0, 0, 0.65], split: [0, 0, 1], echo: [0, 0, 1],
} as const
