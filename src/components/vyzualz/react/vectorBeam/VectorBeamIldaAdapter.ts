// ILDA-addressability adapter: wraps a renderer-agnostic vector-beam segment
// array (e.g. everything Sound Drawing produced for one frame) into the laser
// module's own segment shape, so a Sound Drawing frame is directly consumable
// by the same scanner-plan/output path the laser Canvas2D renderer consumes —
// no reinterpretation of the beam geometry itself. Every shared field (origin,
// target, color, density, dwellWeight, velocityRatio, historyWeight) passes
// through unchanged; only the laser-specific identity fields the shared type
// deliberately excludes (id, fixtureId, geometry, stable, animated) are filled
// in mechanically.
import type { VectorBeamSegment } from './VectorBeamTypes'
import type { LaserDmxCanvas2DScannerSegment } from '../renderers/laserDmx/LaserDmxCanvas2DScannerRenderer'
import type { LaserDmxScannerExposureGeometry } from '../renderers/laserDmx/LaserDmxScannerWebGLPlan'

export interface VectorBeamIldaAdapterOptions {
  /** Synthetic fixture identity to stamp onto every segment. Default 'soundDrawing'. */
  fixtureId?: string
  /** Exposure geometry classification to stamp onto every segment. Default 'scanStroke' (a connected scan line, matching how Sound Drawing traces are drawn). */
  geometry?: LaserDmxScannerExposureGeometry
  /** Prefix used to build each segment's synthetic `id` (`${idPrefix}-${index}`). Default 'sound-drawing'. */
  idPrefix?: string
}

/**
 * Round-trips an array of shared vector-beam segments into
 * `LaserDmxCanvas2DScannerSegment[]` — the exact shape
 * `renderLaserDmxCanvas2DScannerPlan` consumes — with zero change to any
 * shared field's value.
 */
export function adaptVectorBeamSegmentsToLaserDmxScannerSegments(
  segments: readonly VectorBeamSegment[],
  options: VectorBeamIldaAdapterOptions = {},
): LaserDmxCanvas2DScannerSegment[] {
  const fixtureId = options.fixtureId ?? 'soundDrawing'
  const geometry = options.geometry ?? 'scanStroke'
  const idPrefix = options.idPrefix ?? 'sound-drawing'
  return segments.map((segment, index) => ({
    ...segment,
    id: `${idPrefix}-${index}`,
    fixtureId,
    geometry,
    stable: true,
    animated: true,
  }))
}
