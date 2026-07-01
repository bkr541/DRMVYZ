import type {
  CinematicCameraPose,
  CinematicWorldSafeCameraRange,
  CinematicWorldShot,
} from '../../CinematicWorldDirection'
import type { ReactiveConstellationChoreographyProfile } from '../../../../CinematicWorldSettings'

export const REACTIVE_CONSTELLATION_SAFE_CAMERA_RANGE: CinematicWorldSafeCameraRange = {
  minDistance: 2.2,
  maxDistance: 7.2,
  maxLateral: 2.15,
  minElevation: -1.35,
  maxElevation: 1.85,
  minFieldOfView: 42,
  maxFieldOfView: 76,
}

export const REACTIVE_CONSTELLATION_SHOTS: readonly CinematicWorldShot[] = [
  { id: 'constellation-establish', rig: 'locked', sections: ['intro', 'breakdown'], action: 'establish', pose: { position: { z: 4.8 }, fieldOfView: 64 }, minimumDurationSec: 3.5 },
  { id: 'constellation-drift', rig: 'orbit', sections: ['verse', 'bridge'], action: 'orbit', weight: 1.35, pose: { position: { z: 4.1 }, fieldOfView: 58 } },
  { id: 'constellation-approach', rig: 'dolly', sections: ['build'], action: 'approach', pose: { position: { z: 3.35 }, fieldOfView: 54 } },
  { id: 'constellation-focus', rig: 'locked', sections: ['preDrop'], action: 'focus', pose: { position: { z: 2.75 }, fieldOfView: 48 } },
  { id: 'constellation-impact', rig: 'handheld', sections: ['drop'], action: 'impact', pose: { position: { z: 3.1 }, fieldOfView: 62 }, weight: 1.15, minimumDurationSec: 2.5 },
  { id: 'constellation-reveal', rig: 'orbit', sections: ['drop'], action: 'reveal', pose: { position: { z: 4.0 }, fieldOfView: 68 }, weight: 1.45, minimumDurationSec: 4 },
  { id: 'constellation-retreat', rig: 'dolly', sections: ['outro'], action: 'retreat', pose: { position: { z: 5.7 }, fieldOfView: 66 }, minimumDurationSec: 3.5 },
  { id: 'constellation-fallback', rig: 'locked', sections: ['unknown'], action: 'hold', pose: { position: { z: 4.0 }, fieldOfView: 60 } },
]

export function isConstellationCameraPoseSafe(
  pose: {
    position: { x: number; y: number; z: number }
    rotation?: { x: number; y: number; z: number }
    fieldOfView: number
  },
): boolean {
  const range = REACTIVE_CONSTELLATION_SAFE_CAMERA_RANGE
  return Number.isFinite(pose.position.x)
    && Number.isFinite(pose.position.y)
    && Number.isFinite(pose.position.z)
    && (!pose.rotation || (
      Number.isFinite(pose.rotation.x)
      && Number.isFinite(pose.rotation.y)
      && Number.isFinite(pose.rotation.z)
    ))
    && Number.isFinite(pose.fieldOfView)
    && Math.abs(pose.position.x) <= range.maxLateral
    && pose.position.y >= range.minElevation
    && pose.position.y <= range.maxElevation
    && pose.position.z >= range.minDistance
    && pose.position.z <= range.maxDistance
    && pose.fieldOfView >= range.minFieldOfView
    && pose.fieldOfView <= range.maxFieldOfView
}

export interface ReactiveConstellationCameraConstraintInput {
  profile: ReactiveConstellationChoreographyProfile
  requestedPose: CinematicCameraPose
  previousPose: CinematicCameraPose | null
  expansionProgress: number
  expansionVelocity: number
  deltaTimeSec: number
}

export interface ReactiveConstellationCameraConstraintResult {
  active: boolean
  pose: CinematicCameraPose
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function smooth(previous: number, target: number, alpha: number): number {
  return previous + (target - previous) * alpha
}

/**
 * Crimson Collapse uses a centered presentation rig so its radial launch remains
 * legible even when Auto Director requests a tighter impact shot. Other presets
 * receive the requested camera unchanged.
 */
export function resolveReactiveConstellationCameraConstraint(
  input: ReactiveConstellationCameraConstraintInput,
): ReactiveConstellationCameraConstraintResult {
  if (input.profile !== 'crimsonLaunch') {
    return { active: false, pose: input.requestedPose }
  }

  const expansion = clamp(input.expansionProgress, 0, 1.58)
  const outwardVelocity = Math.max(0, clamp(input.expansionVelocity, -5, 8))
  const requested = input.requestedPose
  const targetZ = clamp(
    Math.max(requested.position.z, 4.45 + expansion * 0.9 + outwardVelocity * 0.12),
    4.45,
    6.45,
  )
  const target: CinematicCameraPose = {
    position: {
      x: clamp(requested.position.x * 0.34, -0.58, 0.58),
      y: clamp(requested.position.y * 0.38, -0.48, 0.68),
      z: targetZ,
    },
    rotation: {
      x: clamp(requested.rotation.x * 0.4, -0.16, 0.16),
      y: clamp(requested.rotation.y * 0.4, -0.2, 0.2),
      z: clamp(requested.rotation.z * 0.3, -0.1, 0.1),
    },
    fieldOfView: clamp(Math.max(requested.fieldOfView, 59 + expansion * 4.4), 58, 70),
  }

  if (!input.previousPose) return { active: true, pose: target }

  const delta = clamp(input.deltaTimeSec, 0, 0.1)
  const response = outwardVelocity > 0.08 ? 3.4 : 1.85
  const alpha = 1 - Math.exp(-delta * response)
  return {
    active: true,
    pose: {
      position: {
        x: smooth(input.previousPose.position.x, target.position.x, alpha),
        y: smooth(input.previousPose.position.y, target.position.y, alpha),
        z: smooth(input.previousPose.position.z, target.position.z, alpha),
      },
      rotation: {
        x: smooth(input.previousPose.rotation.x, target.rotation.x, alpha),
        y: smooth(input.previousPose.rotation.y, target.rotation.y, alpha),
        z: smooth(input.previousPose.rotation.z, target.rotation.z, alpha),
      },
      fieldOfView: smooth(input.previousPose.fieldOfView, target.fieldOfView, alpha),
    },
  }
}
