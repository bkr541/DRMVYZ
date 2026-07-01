import { describe, expect, it } from 'vitest'
import type { CinematicCameraPose } from '../../../CinematicWorldDirection'
import { resolveReactiveConstellationCameraConstraint } from '../ConstellationPresentation'

const requestedPose: CinematicCameraPose = {
  position: { x: 1.4, y: -0.8, z: 2.8 },
  rotation: { x: 0.32, y: -0.42, z: 0.24 },
  fieldOfView: 48,
}

describe('Reactive Constellation target camera constraint', () => {
  it('leaves every standard preset camera request untouched', () => {
    const result = resolveReactiveConstellationCameraConstraint({
      profile: 'standard',
      requestedPose,
      previousPose: null,
      expansionProgress: 1.2,
      expansionVelocity: 3,
      deltaTimeSec: 1 / 60,
    })

    expect(result.active).toBe(false)
    expect(result.pose).toBe(requestedPose)
  })

  it('centers and dollies back only for the crimson radial launch profile', () => {
    const compressed = resolveReactiveConstellationCameraConstraint({
      profile: 'crimsonLaunch',
      requestedPose,
      previousPose: null,
      expansionProgress: 0.12,
      expansionVelocity: 0,
      deltaTimeSec: 1 / 60,
    })
    const expanding = resolveReactiveConstellationCameraConstraint({
      profile: 'crimsonLaunch',
      requestedPose,
      previousPose: compressed.pose,
      expansionProgress: 1.16,
      expansionVelocity: 2.4,
      deltaTimeSec: 1 / 60,
    })

    expect(compressed.active).toBe(true)
    expect(Math.abs(compressed.pose.position.x)).toBeLessThan(Math.abs(requestedPose.position.x))
    expect(Math.abs(compressed.pose.position.y)).toBeLessThan(Math.abs(requestedPose.position.y))
    expect(compressed.pose.position.z).toBeGreaterThan(requestedPose.position.z)
    expect(expanding.pose.position.z).toBeGreaterThan(compressed.pose.position.z)
    expect(expanding.pose.fieldOfView).toBeGreaterThanOrEqual(compressed.pose.fieldOfView)
    expect(expanding.pose.position.z).toBeLessThan(6.45)
  })

  it('returns smoothly after an expansion instead of snapping to the requested shot', () => {
    const previous: CinematicCameraPose = {
      position: { x: 0, y: 0, z: 6.1 },
      rotation: { x: 0, y: 0, z: 0 },
      fieldOfView: 68,
    }
    const result = resolveReactiveConstellationCameraConstraint({
      profile: 'crimsonLaunch',
      requestedPose: {
        position: { x: 0, y: 0, z: 4.5 },
        rotation: { x: 0, y: 0, z: 0 },
        fieldOfView: 60,
      },
      previousPose: previous,
      expansionProgress: 0.32,
      expansionVelocity: -0.4,
      deltaTimeSec: 1 / 60,
    })

    expect(result.pose.position.z).toBeLessThan(previous.position.z)
    expect(result.pose.position.z).toBeGreaterThan(4.5)
    expect(result.pose.fieldOfView).toBeLessThan(previous.fieldOfView)
    expect(result.pose.fieldOfView).toBeGreaterThan(60)
  })
})
