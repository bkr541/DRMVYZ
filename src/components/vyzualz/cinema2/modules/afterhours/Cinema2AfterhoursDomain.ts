import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2RandomNamespace } from '../../runtime/Cinema2RandomService'

export const CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT = 46 as const
/** Laser Count ceiling: how many lasers may be lit at once. The top of the range is the whole rig. */
export const CINEMA2_AFTERHOURS_MIN_LASERS = 2 as const
export const CINEMA2_AFTERHOURS_MAX_LASERS = CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT
export const CINEMA2_AFTERHOURS_RANDOM_MODULE_ID = 'afterhours-native-render' as const

/**
 * Physical banks of the installed rig.
 *
 * - bottom: the floor row across the front of the stage (10).
 * - overhead: the top truss row (10).
 * - mid: a mid-height truss row across the back of the stage (8).
 * - left / right: the side towers (8 each).
 * - center: one laser at floor centre and one at top centre. Each is its own mirror image.
 */
export type Cinema2AfterhoursRigBank = 'bottom' | 'left' | 'right' | 'overhead' | 'mid' | 'center'
export type Cinema2AfterhoursFixtureRole = 'floor' | 'leftWing' | 'rightWing' | 'roof' | 'midTruss' | 'floorCenter' | 'topCenter'
export type Cinema2AfterhoursMirrorSide = 'left' | 'right' | 'center'

/**
 * Afterhours 2.0 world coordinates, in renderer-independent Cinema 2.0 units.
 *
 * - +X points stage-right from the audience point of view.
 * - +Y points upward.
 * - +Z points from the stage toward the audience/camera volume.
 * - The stage/scanner plane sits near Z=0 and the useful haze/beam volume extends toward +Z. The audience camera looks back toward the stage
 *   from positive Z.
 */
export const CINEMA2_AFTERHOURS_STAGE_VOLUME = Object.freeze({
  min: Object.freeze([-12, 0, -1]) as Cinema2Vector3,
  max: Object.freeze([12, 8.5, 12]) as Cinema2Vector3,
  audienceDirection: Object.freeze([0, 0, 1]) as Cinema2Vector3,
})

export interface Cinema2AfterhoursFixture {
  readonly id: string
  readonly bank: Cinema2AfterhoursRigBank
  readonly role: Cinema2AfterhoursFixtureRole
  readonly emitterIndex: number
  readonly positionWorld: Cinema2Vector3
  readonly mountDirectionWorld: Cinema2Vector3
  readonly mirrorSide: Cinema2AfterhoursMirrorSide
  /** The fixture mirrored across the stage centre. A centre fixture is its own mirror. */
  readonly mirrorFixtureId: string
  readonly pairId: string
  /** 0 for the pair nearest the centre of its row (or lowest on a side tower), counting outward (or upward). */
  readonly pairIndex: number
}

export interface Cinema2AfterhoursFixturePair {
  readonly id: string
  readonly bank: Cinema2AfterhoursRigBank
  /** Stable logical ordering: left fixture, then right fixture. A centre "pair" holds the same fixture twice. */
  readonly fixtures: readonly [Cinema2AfterhoursFixture, Cinema2AfterhoursFixture]
}

export interface Cinema2AfterhoursRig {
  readonly id: 'afterhours2-world-rig-v2'
  readonly fixtures: readonly Cinema2AfterhoursFixture[]
  readonly banks: Readonly<Record<Cinema2AfterhoursRigBank, readonly Cinema2AfterhoursFixture[]>>
  readonly pairs: Readonly<Record<'bottom' | 'overhead' | 'mid' | 'side' | 'center', readonly Cinema2AfterhoursFixturePair[]>>
  readonly stageVolume: typeof CINEMA2_AFTERHOURS_STAGE_VOLUME
}

/** Structural adapter implemented by Cinema2RandomService. */
export interface Cinema2AfterhoursRandomSource {
  sample(namespace: Readonly<Cinema2RandomNamespace>, index?: number): number
}
