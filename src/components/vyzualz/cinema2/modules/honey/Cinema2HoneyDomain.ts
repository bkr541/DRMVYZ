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
export const HONEY_MAX_ELEVATION = 1.05
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
export const HONEY_CAMERA = { position: [.32, .85, 13] as const, target: [0, 0, .25] as const, fov: 40 } as const
export interface HoneyPose { elevation: number; rotation: number; tiltX: number; tiltY: number; x: number; y: number }

/** Stable integer hash, independent of iteration order, frame time and viewport. */
export function honeySeed(q: number, r: number, salt: number): number {
  let n = Math.imul(q, 374761393) ^ Math.imul(r, 668265263) ^ Math.imul(salt, 1274126177)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
