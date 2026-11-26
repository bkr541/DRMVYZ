import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'

/** World units. Flat-top hexagons face +Z, and all cell centres lie on XY. */
export const HONEY_PITCH = 1.8
export const HONEY_GRID_RADIUS = 12
export const HONEY_CAP_RADIUS = .97
export const HONEY_CAP_THICKNESS = .18
export const HONEY_BEVEL = .065
export const HONEY_SLEEVE_INNER = .985
export const HONEY_SLEEVE_OUTER = 1.027
export const HONEY_SLEEVE_LIP = .42
export const HONEY_FLOOR = -.10
export const HONEY_MIN_ELEVATION = .12
// Keep the authored home heights and stationary sleeves. The travel slider
// now spans 3.08 world units instead of .93; +Z is toward the camera.
export const HONEY_MAX_ELEVATION = 3.2
export const HONEY_STEM_RADIUS = .91
export const HONEY_STEM_BASE = HONEY_FLOOR - .005
export const HONEY_STEM_OVERLAP = .018
export const HONEY_STEM_MAX_TOP = 1.47
export const HONEY_FLOAT_START = 1.8
export const HONEY_FLOAT_FULL = 2.35
export const HONEY_STEM_RELEASE = HONEY_STEM_MAX_TOP + HONEY_CAP_THICKNESS - HONEY_STEM_OVERLAP

/** Anchored piston: follows the cap underside, then retracts into the sleeve
 * as the cap floats. The world and shadow shaders use the same constants. */
export function honeyStemTop(elevation: number): number {
  const t = Math.max(0, Math.min(1, (elevation - HONEY_STEM_RELEASE) / (HONEY_FLOAT_FULL - HONEY_STEM_RELEASE)))
  const attached = Math.min(elevation - HONEY_CAP_THICKNESS + HONEY_STEM_OVERLAP, HONEY_STEM_MAX_TOP)
  return attached + (HONEY_SLEEVE_LIP - .025 - attached) * t * t * (3 - 2 * t)
}
/** Rotation/lateral travel is reserved for fully released caps. */
export function honeyFloatingAuthority(elevation: number): number {
  const t = Math.max(0, Math.min(1, (elevation - HONEY_FLOAT_START) / (HONEY_FLOAT_FULL - HONEY_FLOAT_START)))
  return t * t * (3 - 2 * t)
}
export const HONEY_MAX_ROTATION = 6 * Math.PI / 180
export const HONEY_MAX_TILT = 6 * Math.PI / 180
export const HONEY_MAX_SEPARATION = .025
export const HONEY_FINISHES = ['graphite', 'brushed-steel', 'carbon-fiber', 'satin-ceramic'] as const
export const HONEY_PATTERN_IDS = ['cascade', 'shockwave', 'fracture', 'alternating', 'convergence', 'current', 'submerge', 'overdrive'] as const
export const HONEY_PALETTE = {
  face: [.125, .173, .212, 1], edge: [.208, .275, .314, 1], cavity: [.031, .051, .075, 1],
  substrate: [.055, .075, .095, 1], outer: [1, .475, .106, 1], inner: [1, .765, .451, 1], under: [.89, .365, .055, 1],
} as const satisfies Record<string, Cinema2Color>
export type HoneyPalette = { -readonly [K in keyof typeof HONEY_PALETTE]: Cinema2Color }
export const HONEY_PALETTE_KEYS = ['face', 'edge', 'cavity', 'substrate', 'outer', 'inner', 'under'] as const
export const HONEY_NEIGHBORS = [[1,0], [0,1], [-1,1], [-1,0], [0,-1], [1,-1]] as const
// Off-axis home exposes the sides of the raised caps without revealing the finite wall edges.
// The front clearance includes the maximum cap height, cap radius and both tilt axes.
export const HONEY_CAMERA = {
  position: [3.1, 1.65, 13.6] as const, target: [0, 0, .85] as const, fov: 40,
  near: .25, far: 85,
  safety: { minPosition: [.65, -.1, 9.5] as const, maxPosition: [5.6, 3.4, 16.4] as const,
    maxPositionOffset: [2.5, 1.75, 4.1] as const, maxTargetOffset: [.85, .45, .4] as const,
    minFovDegrees: 39, maxFovDegrees: 41, minNear: .25, maxFar: 85 },
} as const
export interface HoneyPose { elevation: number; rotation: number; tiltX: number; tiltY: number; x: number; y: number }

/** Stable integer hash, independent of iteration order, frame time and viewport. */
export function honeySeed(q: number, r: number, salt: number): number {
  let n = Math.imul(q, 374761393) ^ Math.imul(r, 668265263) ^ Math.imul(salt, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
