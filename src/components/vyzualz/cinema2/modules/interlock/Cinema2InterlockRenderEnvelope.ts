import type { Cinema2InterlockResolvedFixtureGeometry } from './Cinema2InterlockDomain'

const EPSILON = 1e-9

export interface Cinema2InterlockRendererInstanceDimensions {
  readonly halfLengthPx: number
  readonly halfThicknessPx: number
  readonly glowPaddingPx: number
  readonly renderedHalfLengthPx: number
  readonly renderedHalfThicknessPx: number
  /** Orientation-independent extra midpoint clearance beyond halfLengthPx. */
  readonly radialPaddingPx: number
}

export interface Cinema2InterlockEnvelopeBounds {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

export interface Cinema2InterlockVisibleEnvelope {
  readonly body: Readonly<Cinema2InterlockEnvelopeBounds>
  readonly rendered: Readonly<Cinema2InterlockEnvelopeBounds>
  readonly dimensions: Readonly<Cinema2InterlockRendererInstanceDimensions>
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Canonical CPU-side mirror of the native Interlock vertex expansion. Keep this
 * synchronized with Cinema2InterlockRenderer so layout acceptance measures the
 * same quad that the GPU actually rasterizes.
 */
export function resolveCinema2InterlockRendererInstanceDimensions(
  lengthPx: number,
  thicknessPx: number,
): Readonly<Cinema2InterlockRendererInstanceDimensions> {
  const safeLengthPx = Math.max(EPSILON, finitePositive(lengthPx, EPSILON))
  const safeThicknessPx = Math.max(EPSILON, finitePositive(thicknessPx, EPSILON))
  const halfLengthPx = safeLengthPx / 2
  const halfThicknessPx = Math.max(0.5, safeThicknessPx / 2)
  const glowPaddingPx = Math.max(3, halfThicknessPx * 3.4)
  const renderedHalfLengthPx = halfLengthPx + glowPaddingPx
  const renderedHalfThicknessPx = halfThicknessPx + glowPaddingPx
  const radialPaddingPx = Math.max(
    0,
    Math.hypot(renderedHalfLengthPx, renderedHalfThicknessPx) - halfLengthPx,
  )

  return Object.freeze({
    halfLengthPx,
    halfThicknessPx,
    glowPaddingPx,
    renderedHalfLengthPx,
    renderedHalfThicknessPx,
    radialPaddingPx,
  })
}

function boundsForOrientedHalfExtents(
  geometry: Cinema2InterlockResolvedFixtureGeometry,
  halfLengthPx: number,
  halfThicknessPx: number,
): Readonly<Cinema2InterlockEnvelopeBounds> {
  const dx = geometry.bottom[0] - geometry.top[0]
  const dy = geometry.bottom[1] - geometry.top[1]
  const measuredLength = Math.hypot(dx, dy)
  const axisX = measuredLength > EPSILON ? dx / measuredLength : Math.cos(geometry.angleRad)
  const axisY = measuredLength > EPSILON ? dy / measuredLength : Math.sin(geometry.angleRad)
  const normalX = -axisY
  const normalY = axisX
  const extentX = Math.abs(axisX) * halfLengthPx + Math.abs(normalX) * halfThicknessPx
  const extentY = Math.abs(axisY) * halfLengthPx + Math.abs(normalY) * halfThicknessPx
  const centerX = geometry.middle[0]
  const centerY = geometry.middle[1]

  return Object.freeze({
    minX: centerX - extentX,
    maxX: centerX + extentX,
    minY: centerY - extentY,
    maxY: centerY + extentY,
  })
}

/**
 * Returns both the physical luminous body bounds and the renderer-owned quad
 * bounds including glow padding. The latter is the maximum finite visible
 * envelope because the shader cannot write pixels outside this expanded quad.
 */
export function resolveCinema2InterlockVisibleEnvelope(
  geometry: Cinema2InterlockResolvedFixtureGeometry,
): Readonly<Cinema2InterlockVisibleEnvelope> {
  const dimensions = resolveCinema2InterlockRendererInstanceDimensions(
    geometry.lengthPx,
    geometry.thicknessPx,
  )
  const body = boundsForOrientedHalfExtents(
    geometry,
    dimensions.halfLengthPx,
    dimensions.halfThicknessPx,
  )
  const rendered = boundsForOrientedHalfExtents(
    geometry,
    dimensions.renderedHalfLengthPx,
    dimensions.renderedHalfThicknessPx,
  )
  return Object.freeze({ body, rendered, dimensions })
}
