import type { CinematicCameraRig } from '../../CinematicWorldConfig'
import type { ReactSectionType } from '../../ReactTypes'

export interface CinematicVector3 {
  x: number
  y: number
  z: number
}

export interface CinematicCameraPose {
  position: CinematicVector3
  rotation: CinematicVector3
  fieldOfView: number
}

export interface CinematicCameraPosePatch {
  position?: Partial<CinematicVector3>
  rotation?: Partial<CinematicVector3>
  fieldOfView?: number
}

export type CinematicDirectionAction =
  | 'establish'
  | 'approach'
  | 'focus'
  | 'impact'
  | 'open'
  | 'reveal'
  | 'travel'
  | 'orbit'
  | 'retreat'
  | 'close'
  | 'hold'

export interface CinematicWorldShot {
  id: string
  rig: Exclude<CinematicCameraRig, 'autoDirector'>
  sections: readonly ReactSectionType[]
  weight?: number
  pose?: CinematicCameraPosePatch
  action?: CinematicDirectionAction
  /** Optional minimum duration override. The scheduler still applies its global floor. */
  minimumDurationSec?: number
}

export interface CinematicFlyThroughPathPoint {
  position: CinematicVector3
  rotation?: Partial<CinematicVector3>
  fieldOfView?: number
}

export interface CinematicWorldSafeCameraRange {
  minDistance: number
  maxDistance: number
  maxLateral: number
  minElevation: number
  maxElevation: number
  minFieldOfView: number
  maxFieldOfView: number
}

export interface CinematicWorldDirection {
  supportedCameraRigs: readonly CinematicCameraRig[]
  safeCameraRange: CinematicWorldSafeCameraRange
  shots: readonly CinematicWorldShot[]
  dropActions: readonly CinematicDirectionAction[]
  revealActions: readonly CinematicDirectionAction[]
  retreatActions: readonly CinematicDirectionAction[]
  flyThroughPaths?: readonly (readonly CinematicFlyThroughPathPoint[])[]
}

const DEFAULT_SAFE_RANGE: CinematicWorldSafeCameraRange = {
  minDistance: 0.45,
  maxDistance: 4.5,
  maxLateral: 1.25,
  minElevation: -0.85,
  maxElevation: 1.25,
  minFieldOfView: 34,
  maxFieldOfView: 82,
}

export function defineCinematicWorldDirection(
  input: Omit<CinematicWorldDirection, 'safeCameraRange'> & {
    safeCameraRange?: Partial<CinematicWorldSafeCameraRange>
  },
): CinematicWorldDirection {
  return {
    ...input,
    supportedCameraRigs: [...input.supportedCameraRigs],
    safeCameraRange: { ...DEFAULT_SAFE_RANGE, ...input.safeCameraRange },
    shots: input.shots.map(shot => ({
      ...shot,
      sections: [...shot.sections],
      pose: shot.pose
        ? {
            ...shot.pose,
            position: shot.pose.position ? { ...shot.pose.position } : undefined,
            rotation: shot.pose.rotation ? { ...shot.pose.rotation } : undefined,
          }
        : undefined,
    })),
    dropActions: [...input.dropActions],
    revealActions: [...input.revealActions],
    retreatActions: [...input.retreatActions],
    flyThroughPaths: input.flyThroughPaths?.map(path => path.map(point => ({
      ...point,
      position: { ...point.position },
      rotation: point.rotation ? { ...point.rotation } : undefined,
    }))),
  }
}
