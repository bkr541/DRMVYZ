/**
 * Pure beam geometry for the LaserDMX Beam Matrix renderer.
 * No Canvas2D imports. All functions are stateless and safe for unit testing.
 *
 * Simplified depth model (Z in [-1, 1]):
 *   Z = +1: "closer to audience" → wider beam, slightly brighter
 *   Z =  0: neutral
 *   Z = -1: "further from audience" → narrower beam, slightly dimmer
 *
 * This model does not implement a full camera projection. It adds visible
 * perspective cues (width/brightness) without a 3-D engine.
 */

import type { LaserDmxMatrixTarget } from '../ReactTypes'

const COLS = 15
const ROWS = 10

// ── Coordinate compilation ────────────────────────────────────────────────────

export interface CompiledOrigin {
  x: number
  y: number
  z: number
}

export interface CompiledTarget {
  x: number
  y: number
  z: number
  /** True when the target pixel lies outside [0,W] × [0,H]. */
  offscreen: boolean
}

/**
 * Grid anchor (1-indexed column/row) to canvas pixels.
 *   column 1, row 1 → (0.5/15 × W, 0.5/10 × H)  — upper-left cell centre
 *   column 15, row 10 → (14.5/15 × W, 9.5/10 × H) — lower-right cell centre
 */
export function gridAnchorToCanvas(
  column: number,
  row: number,
  z: number,
  W: number,
  H: number,
): CompiledOrigin {
  return {
    x: (column - 0.5) / COLS * W,
    y: (row    - 0.5) / ROWS * H,
    z,
  }
}

/**
 * Target (grid or stage kind) to canvas pixels.
 * Stage targets use x * W, y * H and may legitimately be offscreen.
 */
export function targetToCanvas(
  target: LaserDmxMatrixTarget,
  W: number,
  H: number,
): CompiledTarget {
  let x: number, y: number, z: number
  if (target.kind === 'grid') {
    x = (target.column - 0.5) / COLS * W
    y = (target.row    - 0.5) / ROWS * H
    z = target.z
  } else {
    x = target.x * W
    y = target.y * H
    z = target.z
  }
  return { x, y, z, offscreen: x < 0 || x > W || y < 0 || y > H }
}

/**
 * Z-depth scale factors.
 * widthScale:     applied to beam pixel width
 * intensityScale: applied to beam brightness (subtle ±15%)
 */
export function zDepthFactors(z: number): { widthScale: number; intensityScale: number } {
  const cz = Math.max(-1, Math.min(1, Number.isFinite(z) ? z : 0))
  return {
    widthScale:     1 + cz * 0.30,
    intensityScale: 1 + cz * 0.15,
  }
}

// ── Line geometry ─────────────────────────────────────────────────────────────

export interface BeamLineGeometry {
  x1: number; y1: number
  x2: number; y2: number
  /** Unit direction vector from origin toward target. */
  dx: number; dy: number
  /** Pixel distance origin → target. */
  len: number
}

/**
 * Compute line geometry for a beam.
 * When origin equals target (len < 0.001) the geometry degenerates safely:
 * a tiny 0.001-px segment is returned with dx=1, dy=0.
 */
export function computeLineGeometry(
  ox: number, oy: number,
  tx: number, ty: number,
): BeamLineGeometry {
  const ddx = tx - ox
  const ddy = ty - oy
  const len = Math.sqrt(ddx * ddx + ddy * ddy)
  if (len < 0.001) {
    return { x1: ox, y1: oy, x2: ox + 0.001, y2: oy, dx: 1, dy: 0, len: 0.001 }
  }
  return { x1: ox, y1: oy, x2: tx, y2: ty, dx: ddx / len, dy: ddy / len, len }
}

// ── Volumetric cone geometry ───────────────────────────────────────────────────

export interface ConeVertex { x: number; y: number }

export interface BeamConeGeometry {
  /**
   * Trapezoid polygon in winding order:
   *   [ originLeft, originRight, targetRight, targetLeft ]
   * Use as a filled path to draw the cone body.
   */
  quad: [ConeVertex, ConeVertex, ConeVertex, ConeVertex]
  /** Perpendicular normal (left of origin → target direction). */
  nx: number; ny: number
  originHalfWidth: number
  targetHalfWidth: number
  len: number
}

/**
 * Compute the tapered cone polygon for a volumetric cone beam.
 *
 * The cone starts very narrow at the origin (laser emitter aperture) and
 * expands toward the target based on divergence and travel distance.
 * Offscreen targets are supported — the polygon may extend past canvas edges.
 *
 * @param baseWidth   Effective pixel width (already includes globalBeamWidth).
 * @param divergence  0–1 expansion factor; 0 = almost parallel, 1 = wide fan.
 */
export function computeConeGeometry(
  ox: number, oy: number, originZ: number,
  tx: number, ty: number, targetZ: number,
  baseWidth: number,
  divergence: number,
): BeamConeGeometry {
  const ddx = tx - ox
  const ddy = ty - oy
  const len = Math.sqrt(ddx * ddx + ddy * ddy)

  // Perpendicular normal: rotate direction vector 90° CCW
  const [nx, ny] = len < 0.001 ? [0, 1] : [-ddy / len, ddx / len]

  const { widthScale: wO } = zDepthFactors(originZ)
  const { widthScale: wT } = zDepthFactors(targetZ)

  const clampedDiv = Math.max(0, Math.min(1, Number.isFinite(divergence) ? divergence : 0))
  const clampedWidth = Math.max(0.2, Number.isFinite(baseWidth) ? baseWidth : 1)

  // Emitter aperture: narrow entry point
  const originHW = Math.max(0.5, clampedWidth * 0.25 * wO)
  // Target expands with divergence × distance (capped to avoid huge triangles)
  const expandFactor = clampedDiv * Math.min(len / 150, 4)
  const targetHW = Math.max(originHW * 1.5, clampedWidth * (0.6 + expandFactor) * wT)

  return {
    quad: [
      { x: ox - nx * originHW, y: oy - ny * originHW },
      { x: ox + nx * originHW, y: oy + ny * originHW },
      { x: tx + nx * targetHW, y: ty + ny * targetHW },
      { x: tx - nx * targetHW, y: ty - ny * targetHW },
    ],
    nx, ny,
    originHalfWidth: originHW,
    targetHalfWidth: targetHW,
    len,
  }
}
