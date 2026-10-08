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
  'kick', 'snare', 'beat', 'downbeat', 'fourBeat', 'eightBeat', 'phrase', 'drop',
] as const)
export type Cinema2MainframeImpulseId = typeof CINEMA2_MAINFRAME_IMPULSE_IDS[number]

export interface Cinema2MainframeImpulseSpec {
  readonly attackMs: number
  readonly releaseMs: number
  readonly targets: readonly Cinema2MainframeSystem[]
}

export const CINEMA2_MAINFRAME_IMPULSES: Readonly<Record<Cinema2MainframeImpulseId, Readonly<Cinema2MainframeImpulseSpec>>> = Object.freeze({
  kick: Object.freeze({ attackMs: 18, releaseMs: 130, targets: Object.freeze(['terminals'] as const) }),
  snare: Object.freeze({ attackMs: 24, releaseMs: 180, targets: Object.freeze(['logoOuter'] as const) }),
  beat: Object.freeze({ attackMs: 20, releaseMs: 160, targets: Object.freeze(['circuits'] as const) }),
  downbeat: Object.freeze({ attackMs: 20, releaseMs: 220, targets: Object.freeze(['logoStar', 'circuits'] as const) }),
  fourBeat: Object.freeze({ attackMs: 40, releaseMs: 320, targets: Object.freeze(['radar'] as const) }),
  eightBeat: Object.freeze({ attackMs: 50, releaseMs: 420, targets: Object.freeze(['logoBody'] as const) }),
  phrase: Object.freeze({ attackMs: 80, releaseMs: 650, targets: Object.freeze(['circuits', 'chip'] as const) }),
  drop: Object.freeze({ attackMs: 10, releaseMs: 850, targets: Object.freeze(['circuits', 'terminals', 'radar', 'chip', 'logoOuter', 'logoBody', 'logoStar'] as const) }),
})

export interface Cinema2MainframeSignals {
  readonly sub: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly flux: number
  readonly vocal: number
  readonly build: number
  /** Derived runtime energy used only to normalize the combined response; not an eighth authored Pass 3 signal. */
  readonly overall: number
}

export type Cinema2MainframeImpulses = Readonly<Record<Cinema2MainframeImpulseId, number>>

export const CINEMA2_MAINFRAME_ZERO_SIGNALS: Readonly<Cinema2MainframeSignals> = Object.freeze({
  sub: 0, bass: 0, mid: 0, high: 0, flux: 0, vocal: 0, build: 0, overall: 0,
})

export const CINEMA2_MAINFRAME_ZERO_IMPULSES: Cinema2MainframeImpulses = Object.freeze({
  kick: 0, snare: 0, beat: 0, downbeat: 0, fourBeat: 0, eightBeat: 0, phrase: 0, drop: 0,
})
