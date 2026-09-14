import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2RandomNamespace } from '../../runtime/Cinema2RandomService'

export const CINEMA2_AFTERHOURS_MIN_BEAMS = 2 as const
export const CINEMA2_AFTERHOURS_MAX_BEAMS = 16 as const
export const CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT = 32 as const
export const CINEMA2_AFTERHOURS_RANDOM_MODULE_ID = 'afterhours-native-render' as const

export const CINEMA2_AFTERHOURS_TOPOLOGY_IDS = Object.freeze([
  'wideFan',
  'splitWings',
  'crossCanopy',
  'diamondStar',
  'chevronRoof',
  'radialCrown',
  'sparseArchitecture',
  'fullRig',
] as const)

export type Cinema2AfterhoursTopologyId = typeof CINEMA2_AFTERHOURS_TOPOLOGY_IDS[number]
export type Cinema2AfterhoursRigBank = 'bottom' | 'left' | 'right' | 'overhead'
export type Cinema2AfterhoursFixtureRole = 'floor' | 'leftWing' | 'rightWing' | 'roof'
export type Cinema2AfterhoursMirrorSide = 'left' | 'right'
export type Cinema2AfterhoursAllocationFamily = 'bottom' | 'side' | 'overhead'
export type Cinema2AfterhoursTopologyRole =
  | 'fan'
  | 'wing'
  | 'cross'
  | 'diamond'
  | 'roof'
  | 'crown'
  | 'architecture'
  | 'fullRig'

/**
 * Afterhours 2.0 world coordinates, in renderer-independent Cinema 2.0 units.
 *
 * - +X points stage-right from the audience point of view.
 * - +Y points upward.
 * - +Z points from the stage toward the audience/camera volume.
 * - The authored stage/scanner plane sits near Z=0 and the useful haze/beam
 *   volume extends toward +Z. A future camera may move independently, but a
 *   conventional audience camera conceptually looks back toward the stage from
 *   positive Z.
 */
export const CINEMA2_AFTERHOURS_STAGE_VOLUME = Object.freeze({
  min: Object.freeze([-8, 0, -1]) as Cinema2Vector3,
  max: Object.freeze([8, 7, 12]) as Cinema2Vector3,
  audienceDirection: Object.freeze([0, 0, 1]) as Cinema2Vector3,
  centerAperture: Object.freeze({ minX: -0.9, maxX: 0.9 }),
})

export interface Cinema2AfterhoursFixture {
  readonly id: string
  readonly bank: Cinema2AfterhoursRigBank
  readonly role: Cinema2AfterhoursFixtureRole
  readonly emitterIndex: number
  readonly positionWorld: Cinema2Vector3
  readonly mountDirectionWorld: Cinema2Vector3
  readonly mirrorSide: Cinema2AfterhoursMirrorSide
  readonly mirrorFixtureId: string
  readonly pairId: string
}

export interface Cinema2AfterhoursFixturePair {
  readonly id: string
  readonly family: Cinema2AfterhoursAllocationFamily
  /** Stable logical ordering: left fixture, then right fixture. */
  readonly fixtures: readonly [Cinema2AfterhoursFixture, Cinema2AfterhoursFixture]
}

export interface Cinema2AfterhoursRig {
  readonly id: 'afterhours2-world-rig-v1'
  readonly fixtures: readonly Cinema2AfterhoursFixture[]
  readonly banks: Readonly<{
    bottom: readonly Cinema2AfterhoursFixture[]
    left: readonly Cinema2AfterhoursFixture[]
    right: readonly Cinema2AfterhoursFixture[]
    overhead: readonly Cinema2AfterhoursFixture[]
  }>
  readonly pairs: Readonly<{
    bottom: readonly Cinema2AfterhoursFixturePair[]
    side: readonly Cinema2AfterhoursFixturePair[]
    overhead: readonly Cinema2AfterhoursFixturePair[]
  }>
  readonly stageVolume: typeof CINEMA2_AFTERHOURS_STAGE_VOLUME
}

export interface Cinema2AfterhoursTopologyDefinition {
  readonly id: Cinema2AfterhoursTopologyId
  readonly label: string
  readonly role: Cinema2AfterhoursTopologyRole
  readonly allocationCycle: readonly Cinema2AfterhoursAllocationFamily[]
  readonly maxActiveBeams: number
  readonly protectsCenterAperture: boolean
  readonly scanner: Readonly<{
    yawAuthorityDeg: number
    pitchAuthorityDeg: number
  }>
}

export interface Cinema2AfterhoursAllocationInput {
  readonly topologyId: Cinema2AfterhoursTopologyId
  readonly beamCount: number
  readonly symmetry: boolean
  readonly sideLasers: boolean
  readonly topLasers: boolean
}

export interface Cinema2AfterhoursAllocationResult {
  readonly requestedBeamCount: number
  readonly activeBeamCount: number
  readonly symmetry: boolean
  readonly fixtures: readonly Cinema2AfterhoursFixture[]
}

/** Structural adapter implemented by Cinema2RandomService. */
export interface Cinema2AfterhoursRandomSource {
  sample(namespace: Readonly<Cinema2RandomNamespace>, index?: number): number
}

export interface Cinema2AfterhoursBeamGenerationInput extends Cinema2AfterhoursAllocationInput {
  readonly random: Cinema2AfterhoursRandomSource
  /** User-authored 0..1 topology width. Omitted callers retain full authored spread. */
  readonly spread?: number
  /** Stable event/variation identity, not frame time. */
  readonly variationKey?: string
}

export interface Cinema2AfterhoursBeamSymmetry {
  readonly pairId: string
  readonly side: Cinema2AfterhoursMirrorSide
}

export interface Cinema2AfterhoursScannerSeed {
  readonly homeDirectionWorld: Cinema2Vector3
  readonly yawAuthorityDeg: number
  readonly pitchAuthorityDeg: number
  readonly phase: number
}

/** Pure, renderer-agnostic handoff consumed by the future native renderer. */
export interface Cinema2AfterhoursBeamDescriptor {
  readonly id: string
  readonly slot: number
  readonly fixtureId: string
  readonly bank: Cinema2AfterhoursRigBank
  readonly fixtureRole: Cinema2AfterhoursFixtureRole
  readonly originWorld: Cinema2Vector3
  readonly targetWorld: Cinema2Vector3
  readonly directionWorld: Cinema2Vector3
  readonly lengthWorld: number
  readonly topologyId: Cinema2AfterhoursTopologyId
  readonly topologyRole: Cinema2AfterhoursTopologyRole
  readonly symmetry: Readonly<Cinema2AfterhoursBeamSymmetry> | null
  readonly intensityWeight: number
  readonly scanner: Readonly<Cinema2AfterhoursScannerSeed>
}
