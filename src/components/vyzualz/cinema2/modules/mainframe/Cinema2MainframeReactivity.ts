/** Typed runtime projection of the owner-authored Pass 3 reactivity map. */
export const CINEMA2_MAINFRAME_SYSTEMS = Object.freeze([
  'board', 'circuits', 'terminals', 'vias', 'radar', 'chip', 'logoOuter', 'logoBody', 'logoStar',
] as const)
export type Cinema2MainframeSystem = typeof CINEMA2_MAINFRAME_SYSTEMS[number]

export const CINEMA2_MAINFRAME_BANKS = Object.freeze(['A', 'B', 'C', 'D'] as const)
export type Cinema2MainframeBank = typeof CINEMA2_MAINFRAME_BANKS[number]

// This order exactly matches the sorted region encoding embedded by generate-mainframe.mjs.
export const CINEMA2_MAINFRAME_REGIONS = Object.freeze([
  'bottom-center', 'left-branch', 'left-major', 'left-minor',
  'right-branch', 'right-major', 'right-minor', 'top-center',
] as const)
export type Cinema2MainframeRegion = typeof CINEMA2_MAINFRAME_REGIONS[number]

export const CINEMA2_MAINFRAME_SIGNAL_IDS = Object.freeze([
  'sub', 'bass', 'mid', 'high', 'flux', 'vocal', 'build',
] as const)
export type Cinema2MainframeSignalId = typeof CINEMA2_MAINFRAME_SIGNAL_IDS[number]

export const CINEMA2_MAINFRAME_IMPULSE_IDS = Object.freeze([
  'kick', 'snare', 'beat', 'downbeat', 'fourBeat', 'eightBeat', 'phrase', 'drop', 'transient', 'section',
] as const)
export type Cinema2MainframeImpulseId = typeof CINEMA2_MAINFRAME_IMPULSE_IDS[number]

export interface Cinema2MainframeImpulseSpec {
  readonly attackMs: number
  readonly holdMs: number
  readonly releaseMs: number
  readonly targets: readonly Cinema2MainframeSystem[]
}

export const CINEMA2_MAINFRAME_IMPULSES: Readonly<Record<Cinema2MainframeImpulseId, Readonly<Cinema2MainframeImpulseSpec>>> = Object.freeze({
  kick: Object.freeze({ attackMs: 12, holdMs: 24, releaseMs: 145, targets: Object.freeze(['circuits', 'terminals'] as const) }),
  snare: Object.freeze({ attackMs: 22, holdMs: 42, releaseMs: 245, targets: Object.freeze(['logoOuter', 'chip'] as const) }),
  beat: Object.freeze({ attackMs: 28, holdMs: 18, releaseMs: 175, targets: Object.freeze(['circuits'] as const) }),
  downbeat: Object.freeze({ attackMs: 16, holdMs: 70, releaseMs: 390, targets: Object.freeze(['logoStar', 'circuits', 'radar'] as const) }),
  fourBeat: Object.freeze({ attackMs: 46, holdMs: 90, releaseMs: 430, targets: Object.freeze(['radar'] as const) }),
  eightBeat: Object.freeze({ attackMs: 58, holdMs: 110, releaseMs: 520, targets: Object.freeze(['logoBody'] as const) }),
  phrase: Object.freeze({ attackMs: 90, holdMs: 160, releaseMs: 820, targets: Object.freeze(['circuits', 'chip', 'radar'] as const) }),
  drop: Object.freeze({ attackMs: 9, holdMs: 140, releaseMs: 1050, targets: Object.freeze(['circuits', 'terminals', 'radar', 'chip', 'logoOuter', 'logoBody', 'logoStar'] as const) }),
  transient: Object.freeze({ attackMs: 8, holdMs: 12, releaseMs: 95, targets: Object.freeze(['vias', 'terminals'] as const) }),
  section: Object.freeze({ attackMs: 70, holdMs: 120, releaseMs: 760, targets: Object.freeze(['circuits', 'radar', 'chip'] as const) }),
})

export type Cinema2MainframeSectionKind = 'verse' | 'buildup' | 'breakdown' | 'drop' | 'other' | 'unknown'

export interface Cinema2MainframeSignals {
  readonly sub: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly flux: number
  readonly vocal: number
  /** Actual normalized musical progress through the current buildup. */
  readonly buildProgress?: number
  /** Classification confidence; deliberately never substituted for progress. */
  readonly buildConfidence?: number
  /** Energy/tension of the buildup, independent of progress and confidence. */
  readonly buildIntensity?: number
  /** Legacy progress alias retained for compatibility with existing pattern consumers. */
  readonly build: number
  /** Shared normalized energy feeding Mainframe’s global lighting bus; not an eighth authored Pass 3 signal. */
  readonly overall: number
  /** Generic Visual Director signals, separate from the seven authored bands/features. */
  readonly significance?: number
  readonly momentum?: number
  readonly impact?: number
  readonly variation?: number
  readonly section?: Cinema2MainframeSectionKind
  readonly sectionProgress?: number
  readonly sectionIntensity?: number
  readonly sectionConfidence?: number
  readonly phraseProgress?: number
}

export type Cinema2MainframeImpulses = Readonly<Record<Cinema2MainframeImpulseId, number>>

export const CINEMA2_MAINFRAME_ZERO_SIGNALS: Readonly<Cinema2MainframeSignals> = Object.freeze({
  sub: 0, bass: 0, mid: 0, high: 0, flux: 0, vocal: 0,
  buildProgress: 0, buildConfidence: 0, buildIntensity: 0, build: 0, overall: 0,
  section: 'unknown', sectionProgress: 0, sectionIntensity: 0, sectionConfidence: 0, phraseProgress: 0,
})

export const CINEMA2_MAINFRAME_ZERO_IMPULSES: Cinema2MainframeImpulses = Object.freeze({
  kick: 0, snare: 0, beat: 0, downbeat: 0, fourBeat: 0, eightBeat: 0, phrase: 0, drop: 0, transient: 0, section: 0,
})
