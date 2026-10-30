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
export const IFRIT_CHANNELS = ['energy', 'bass', 'highs', 'vocal', 'kick', 'snare', 'build', 'buildPhase', 'drop', 'directorIntensity', 'directorMomentum', 'directorBuild', 'directorImpact', 'directorVariation', 'kickNear', 'kickMiddle', 'kickFar', 'snareLeft', 'snareRight', 'dropExpand', 'dropAlign', 'dropRecover', 'downbeatAccent', 'phraseAccent'] as const
