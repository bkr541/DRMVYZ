// Renderer-agnostic vector-beam segment model.
//
// A galvo laser scanner and an oscilloscope/Sound Drawing trace are both XY
// vector displays: a beam origin/target pair swept at some velocity, exposed
// for some dwell time, with a color that desaturates toward white under
// overlap/high-energy accumulation. This module is the shared, dependency-free
// leaf both `renderers/laserDmx/` and `SoundDrawingRenderer.ts` build on —
// it must never import from either so no import cycle can form between them.

export interface VectorBeamPoint {
  x: number
  y: number
}

export interface VectorBeamColor {
  r: number
  g: number
  b: number
  a: number
}

/**
 * One exposed beam segment in screen/scene space, carrying everything the
 * shared rasterizer needs to resolve its rendered appearance:
 *  - `density`: overall exposure/brightness driver (0..~1+, pre-optics).
 *  - `dwellWeight`: extra exposure from beam dwell time (0..1) — a physical
 *    galvo (or a hand tracing a shape) lingers longer at cusps/corners and
 *    sweeps faster across straight runs, so this brightens corners.
 *  - `velocityRatio`: inverse-velocity ratio (0..1, low velocity = high value),
 *    the same signal Sound Drawing Phase 1 derives from pre-resample spacing,
 *    or from real galvo slew limits when scanner kinematics are enabled.
 *  - `historyWeight`: contribution this segment should make to persistence/trail
 *    accumulation, independent of its instantaneous brightness.
 */
export interface VectorBeamSegment {
  origin: VectorBeamPoint
  target: VectorBeamPoint
  color: VectorBeamColor
  density: number
  dwellWeight: number
  velocityRatio: number
  historyWeight: number
}
