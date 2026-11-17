import { cinema2StableId, type Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'

export const ifritParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`ifrit-${name}`)
export const IFRIT_PATTERNS = ['infernalPassage', 'twistedDescent', 'counterfire', 'compressionChamber', 'emberRelay', 'riftLock'] as const
export type IfritPattern = typeof IFRIT_PATTERNS[number]
export const IFRIT_PATTERN_LABELS = ['Infernal Passage', 'Twisted Descent', 'Counterfire', 'Compression Chamber', 'Ember Relay', 'Rift Lock'] as const
export const IFRIT_COLORS = {
  background: [0.001, 0, 0, 1], portal: [1, 0.46, 0.004, 1], wall: [0.65, 0.006, 0.002, 1], corner: [1, 0.57, 0.015, 1],
} as const
/** min/default/max; consumed by both authoring and runtime. */
export const IFRIT_NUMBERS = {
  intensity: [0, 1, 1], reactivity: [0, 0.65, 1], count: [3, 5, 12], aperture: [0.8, 1, 1.2],
  spacing: [0.75, 1, 1.4], thickness: [0.5, 1, 2], travel: [0, 0.6, 2], rotation: [-1, 0.15, 1],
  twist: [0, 0.45, 1], detail: [0, 1, 1], bloom: [0, 0.28, 0.65],
} as const
export const IFRIT_BASE_CHANNELS = ['energy', 'bass', 'highs', 'vocal', 'kick', 'snare', 'build', 'buildPhase', 'drop', 'directorIntensity', 'directorMomentum', 'directorBuild', 'directorImpact', 'directorVariation', 'kickNear', 'kickMiddle', 'kickFar', 'snareLeft', 'snareRight', 'dropExpand', 'dropAlign', 'dropRecover', 'downbeatAccent', 'phraseAccent'] as const
/** Transient shared-choreography targets added by the mechanics and shatter systems (revision 5). */
export const IFRIT_EXTRA_CHANNELS = ['spokeKick', 'bladeSnare', 'gearDownbeat', 'satellitePhrase', 'shatterBurst', 'shatterRecall', 'shatterPhrase'] as const
export const IFRIT_CHANNELS = [...IFRIT_BASE_CHANNELS, ...IFRIT_EXTRA_CHANNELS] as const

/** Radial Mechanical Choreography numbers: [min, default, max]. Kept apart from IFRIT_NUMBERS, which the shader uniform loop walks. */
export const IFRIT_MECHANICS_NUMBERS = {
  'mechanics-density': [0, 0.70, 1],
  'spoke-extension': [0, 0.35, 1],
  'spoke-pulse': [0, 0.55, 1],
  'gear-speed': [-2, 0.35, 2],
  'blade-sweep': [0, 0.6, 1],
  'blade-count': [0, 3, 6],
  'satellite-count': [0, 2, 6],
  'satellite-orbit-radius': [0.1, 0.65, 1.5],
  'satellite-orbit-speed': [-2, 0.45, 2],
} as const
/** Geometric Shatter & Reconstruction numbers: [min, default, max]. */
export const IFRIT_SHATTER_NUMBERS = {
  'shatter-strength': [0, 0.72, 1],
  'shatter-hold': [0, 0, 1],
  'fragments-per-edge': [1, 3, 4],
  'fragment-spread': [0, 0.9, 2],
  'fragment-spin': [0, 1.25, 3],
  'reassembly-duration': [0.15, 0.75, 2],
} as const
export const IFRIT_SHATTER_TRIGGERS = ['drop', 'kick', 'phrase', 'manual'] as const
export type IfritShatterTrigger = typeof IFRIT_SHATTER_TRIGGERS[number]
export const IFRIT_SHATTER_TRIGGER_LABELS = ['Drop', 'Kick', 'Phrase', 'Manual'] as const
export const IFRIT_RING_SLOTS = 12
export const IFRIT_SECTORS = 6
export const IFRIT_MAX_BLADES = 6
export const IFRIT_MAX_SATELLITES = 6
export const IFRIT_MAX_FRAGMENTS = 4

export type IfritComponentKind = 'spoke' | 'gear' | 'blade' | 'satellite' | 'shard'
/** Immutable identity of one separately addressable part. Never depends on allocation order. */
export interface IfritComponentDescriptor {
  readonly id: string
  readonly ringSlot: number
  readonly sector: number
  readonly kind: IfritComponentKind
  /** Blade, satellite or fragment index; absent for the single spoke and gear. */
  readonly index?: number
}
const two = (n: number) => String(n).padStart(2, '0')
/** `ring-00/sector-0/spoke`, `.../gear`, `.../blade-0`, `.../satellite-1`, `.../shard-3`. */
export function ifritComponentId(ringSlot: number, sector: number, kind: IfritComponentKind, index?: number): string {
  return `ring-${two(ringSlot)}/sector-${sector}/${kind}${index == null ? '' : `-${index}`}`
}
export function ifritComponentDescriptor(ringSlot: number, sector: number, kind: IfritComponentKind, index?: number): IfritComponentDescriptor {
  return Object.freeze({ id: ifritComponentId(ringSlot, sector, kind, index), ringSlot, sector, kind, ...(index == null ? {} : { index }) })
}
/** Deterministic integer hash to [0, 1): same ring/sector/index/salt always gives the same value, whatever the frame history. */
export function ifritHash(ringSlot: number, sector: number, index: number, salt = 0): number {
  let h = (Math.imul(ringSlot + 1, 0x9e3779b1) ^ Math.imul(sector + 7, 0x85ebca6b) ^ Math.imul(index + 13, 0xc2b2ae35) ^ Math.imul(salt + 101, 0x27d4eb2f)) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
