import type { Cinema2Vector2 } from '../../contracts/Cinema2NativePresetManifest'

export const CINEMA2_INTERLOCK_FUTURE_PRESET_ID = 'drmvyz.cinema2.interlock' as const
export const CINEMA2_INTERLOCK_RIG_ID = 'interlock-screen-rig-v1' as const
export const CINEMA2_INTERLOCK_FIXTURE_COUNT = 28 as const
export const CINEMA2_INTERLOCK_SAFE_INSET_CSS_PX = 12 as const

export const CINEMA2_INTERLOCK_PATTERN_IDS = Object.freeze([
  'diamondTunnel',
  'mechanicalIris',
  'doubleWing',
  'bassPortal',
  'fourWayVortex',
] as const)

export const CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID = 'diamondTunnel' as const
export const CINEMA2_INTERLOCK_HERO_PATTERN_ID = 'fourWayVortex' as const

export const CINEMA2_INTERLOCK_PIVOT_IDS = Object.freeze(['top', 'middle', 'bottom'] as const)
export const CINEMA2_INTERLOCK_ROTATION_MODES = Object.freeze([
  'shortest',
  'clockwise',
  'counterclockwise',
  'longest',
] as const)

export type Cinema2InterlockPatternId = typeof CINEMA2_INTERLOCK_PATTERN_IDS[number]
export type Cinema2InterlockPivotId = typeof CINEMA2_INTERLOCK_PIVOT_IDS[number]
export type Cinema2InterlockRotationMode = typeof CINEMA2_INTERLOCK_ROTATION_MODES[number]
export type Cinema2InterlockFixtureBank = 'inner' | 'middle' | 'outer' | 'edge'
export type Cinema2InterlockQuadrant = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
export type Cinema2InterlockMirrorSide = 'left' | 'right'
export type Cinema2InterlockFixtureId = string

export interface Cinema2InterlockAuthoredPose {
  /** 0..1 intent inside the viewport-safe center corridor, not clip space. */
  readonly midpointNormalized: Cinema2Vector2
  /** Screen-space radians. +X is zero; positive rotation follows +Y downward. */
  readonly angleRad: number
}

export interface Cinema2InterlockFixture {
  readonly id: Cinema2InterlockFixtureId
  readonly pairId: string
  readonly groupId: string
  readonly bank: Cinema2InterlockFixtureBank
  readonly quadrant: Cinema2InterlockQuadrant
  readonly mirrorSide: Cinema2InterlockMirrorSide
  readonly mirrorFixtureId: Cinema2InterlockFixtureId
  /** Fixture length as a fraction of the viewport-safe minimum dimension. */
  readonly lengthFactor: number
  /** Fixture thickness as a fraction of the viewport-safe minimum dimension. */
  readonly thicknessFactor: number
  readonly basePose: Readonly<Cinema2InterlockAuthoredPose>
}

export interface Cinema2InterlockFixturePair {
  readonly id: string
  readonly bank: Cinema2InterlockFixtureBank
  readonly fixtures: readonly [Cinema2InterlockFixture, Cinema2InterlockFixture]
}

export interface Cinema2InterlockRig {
  readonly id: typeof CINEMA2_INTERLOCK_RIG_ID
  readonly fixtures: readonly Cinema2InterlockFixture[]
  readonly pairs: readonly Cinema2InterlockFixturePair[]
  readonly banks: Readonly<Record<Cinema2InterlockFixtureBank, readonly Cinema2InterlockFixture[]>>
}

export interface Cinema2InterlockPatternTarget {
  readonly fixtureId: Cinema2InterlockFixtureId
  readonly pivot: Cinema2InterlockPivotId
  readonly targetAngleRad: number
  readonly rotationMode: Cinema2InterlockRotationMode
  /** Later show-planner stages may use this stable authored stagger. */
  readonly bankDelayBeats: number
}

export interface Cinema2InterlockPatternDefinition {
  readonly id: Cinema2InterlockPatternId
  readonly label: string
  readonly targets: readonly Cinema2InterlockPatternTarget[]
}

/**
 * Cinema 2.0 currently supplies backing-buffer width/height plus effective DPR.
 * Interlock keeps that production shape so a 12 CSS-pixel inset can be converted
 * deterministically to backing pixels without depending on DOM layout state.
 */
export interface Cinema2InterlockViewport {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

export interface Cinema2InterlockResolvedViewport {
  readonly width: number
  readonly height: number
  readonly dpr: number
  readonly cssWidth: number
  readonly cssHeight: number
  readonly safeInsetPx: number
  readonly safeInsetCssPx: number
  readonly safeMinX: number
  readonly safeMaxX: number
  readonly safeMinY: number
  readonly safeMaxY: number
  readonly degradedInset: boolean
}

export interface Cinema2InterlockResolvedFixtureGeometry {
  readonly fixtureId: Cinema2InterlockFixtureId
  readonly patternId: Cinema2InterlockPatternId | null
  readonly pivot: Cinema2InterlockPivotId
  readonly top: Cinema2Vector2
  readonly middle: Cinema2Vector2
  readonly bottom: Cinema2Vector2
  readonly angleRad: number
  readonly lengthPx: number
  readonly thicknessPx: number
}

export interface Cinema2InterlockResolvedLayout {
  readonly patternId: Cinema2InterlockPatternId
  readonly viewport: Readonly<Cinema2InterlockResolvedViewport>
  readonly fixtures: readonly Cinema2InterlockResolvedFixtureGeometry[]
}

export interface Cinema2InterlockTransitionState {
  readonly fixtureId: Cinema2InterlockFixtureId
  readonly targetPatternId: Cinema2InterlockPatternId | null
  readonly pivot: Cinema2InterlockPivotId
  readonly pivotPoint: Cinema2Vector2
  readonly startAngleRad: number
  readonly targetAngleRad: number
  readonly deltaAngleRad: number
  readonly rotationMode: Cinema2InterlockRotationMode
  readonly lengthPx: number
  readonly thicknessPx: number
}
