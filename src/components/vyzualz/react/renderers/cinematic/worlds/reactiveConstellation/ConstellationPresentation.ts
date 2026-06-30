import type {
  CinematicWorldSafeCameraRange,
  CinematicWorldShot,
} from '../../CinematicWorldDirection'

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
