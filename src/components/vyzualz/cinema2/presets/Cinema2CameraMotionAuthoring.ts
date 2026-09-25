import type { Cinema2CameraMotionManifest } from '../contracts/Cinema2NativePresetManifest'

/**
 * Named starting points for cinematic camera motion. They are ordinary `camera.motion` blocks, so a
 * preset can spread one and override any field. Amplitudes are world units / degrees for a scene
 * roughly 10 units across; scale `drift` to the scene, or let a `motionAmount` control do it.
 *
 * - `steady`: locked-off with a breath of life, for calm or precise scenes.
 * - `gentle`: slow handheld wander and soft banking; the default for stage/atmosphere looks.
 * - `dynamic`: livelier wander and stronger banking for high-energy sections.
 */
export type Cinema2CinematicMotionLevel = 'steady' | 'gentle' | 'dynamic'

const LEVELS: Readonly<Record<Cinema2CinematicMotionLevel, Readonly<Cinema2CameraMotionManifest>>> = Object.freeze({
  steady: Object.freeze({
    drift: Object.freeze({ position: 0.04, target: 0.02, rollDegrees: 0.15, fovDegrees: 0.3, speed: 0.06 }),
    bank: Object.freeze({ maxDegrees: 1.5, gain: 0.4, smoothingMs: 700 }),
    fovRateLimitDegreesPerSecond: 6,
  }),
  gentle: Object.freeze({
    drift: Object.freeze({ position: 0.12, target: 0.05, rollDegrees: 0.4, fovDegrees: 0.6, speed: 0.08 }),
    bank: Object.freeze({ maxDegrees: 3, gain: 0.5, smoothingMs: 600 }),
    fovRateLimitDegreesPerSecond: 10,
  }),
  dynamic: Object.freeze({
    drift: Object.freeze({ position: 0.25, target: 0.1, rollDegrees: 0.8, fovDegrees: 1, speed: 0.12 }),
    bank: Object.freeze({ maxDegrees: 6, gain: 0.8, smoothingMs: 400 }),
    fovRateLimitDegreesPerSecond: 18,
  }),
})

export interface Cinema2CinematicMotionOptions {
  /** Path/fly rigs: interpolate the points with a smooth constant-speed spline instead of straight segments. */
  splinePath?: boolean
  overrides?: Readonly<Cinema2CameraMotionManifest>
}

export function cinema2CinematicMotion(
  level: Cinema2CinematicMotionLevel,
  options: Cinema2CinematicMotionOptions = {},
): Readonly<Cinema2CameraMotionManifest> {
  return Object.freeze({
    ...LEVELS[level],
    ...(options.splinePath ? { interpolation: 'spline' as const, constantSpeed: true } : {}),
    ...options.overrides,
  })
}
