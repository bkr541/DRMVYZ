import type { Cinema2Vector2 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_INTERLOCK_SAFE_INSET_CSS_PX,
  type Cinema2InterlockFixture,
  type Cinema2InterlockPatternId,
  type Cinema2InterlockPatternTarget,
  type Cinema2InterlockPivotId,
  type Cinema2InterlockResolvedFixtureGeometry,
  type Cinema2InterlockResolvedLayout,
  type Cinema2InterlockResolvedViewport,
  type Cinema2InterlockRotationMode,
  type Cinema2InterlockTransitionState,
  type Cinema2InterlockViewport,
} from './Cinema2InterlockDomain'
import { getCinema2InterlockPatternDefinition, getCinema2InterlockPatternTarget } from './Cinema2InterlockPatternCatalog'
import { CINEMA2_INTERLOCK_RIG } from './Cinema2InterlockRig'

const TWO_PI = Math.PI * 2
const EPSILON = 1e-9

function point(x: number, y: number): Cinema2Vector2 {
  return Object.freeze([x, y]) as Cinema2Vector2
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function pointForPivot(
  geometry: Cinema2InterlockResolvedFixtureGeometry,
  pivot: Cinema2InterlockPivotId,
): Cinema2Vector2 {
  if (pivot === 'top') return geometry.top
  if (pivot === 'bottom') return geometry.bottom
  return geometry.middle
}

export function resolveCinema2InterlockViewport(viewport: Cinema2InterlockViewport): Cinema2InterlockResolvedViewport {
  const width = finitePositive(viewport.width, 1)
  const height = finitePositive(viewport.height, 1)
  const dpr = finitePositive(viewport.dpr, 1)
  const desiredInsetPx = CINEMA2_INTERLOCK_SAFE_INSET_CSS_PX * dpr
  const maxInsetPx = Math.max(0, Math.min((width - EPSILON) / 2, (height - EPSILON) / 2))
  const safeInsetPx = Math.min(desiredInsetPx, maxInsetPx)
  const safeInsetCssPx = safeInsetPx / dpr
  return Object.freeze({
    width,
    height,
    dpr,
    cssWidth: width / dpr,
    cssHeight: height / dpr,
    safeInsetPx,
    safeInsetCssPx,
    safeMinX: safeInsetPx,
    safeMaxX: width - safeInsetPx,
    safeMinY: safeInsetPx,
    safeMaxY: height - safeInsetPx,
    degradedInset: safeInsetPx + EPSILON < desiredInsetPx,
  })
}

function fixtureDimensions(
  fixture: Cinema2InterlockFixture,
  viewport: Cinema2InterlockResolvedViewport,
): Readonly<{ lengthPx: number; thicknessPx: number }> {
  const safeWidth = Math.max(EPSILON, viewport.safeMaxX - viewport.safeMinX)
  const safeHeight = Math.max(EPSILON, viewport.safeMaxY - viewport.safeMinY)
  const safeMinDimension = Math.min(safeWidth, safeHeight)
  const lengthPx = Math.max(EPSILON, Math.min(safeMinDimension * fixture.lengthFactor, safeMinDimension * 0.88))
  const preferredThickness = safeMinDimension * fixture.thicknessFactor
  const readableFloor = Math.min(viewport.dpr * 0.75, lengthPx * 0.18)
  const thicknessPx = Math.max(EPSILON, Math.min(lengthPx * 0.18, Math.max(preferredThickness, readableFloor)))
  return Object.freeze({ lengthPx, thicknessPx })
}

function baseMidpoint(
  fixture: Cinema2InterlockFixture,
  viewport: Cinema2InterlockResolvedViewport,
  lengthPx: number,
): Cinema2Vector2 {
  const safeWidth = Math.max(EPSILON, viewport.safeMaxX - viewport.safeMinX)
  const safeHeight = Math.max(EPSILON, viewport.safeMaxY - viewport.safeMinY)
  const xTravel = Math.max(0, safeWidth - lengthPx)
  const yTravel = Math.max(0, safeHeight - lengthPx)
  const halfLength = lengthPx / 2
  return point(
    viewport.safeMinX + halfLength + xTravel * clamp01(fixture.basePose.midpointNormalized[0]),
    viewport.safeMinY + halfLength + yTravel * clamp01(fixture.basePose.midpointNormalized[1]),
  )
}

/**
 * Resolve a rigid segment from one legal physical pivot. No translation or
 * dimension interpolation occurs here: changing the pose can only rotate the
 * fixture around top, middle, or bottom.
 */
export function resolveCinema2InterlockGeometryFromPivot(input: Readonly<{
  fixtureId: string
  patternId?: Cinema2InterlockPatternId | null
  pivot: Cinema2InterlockPivotId
  pivotPoint: Cinema2Vector2
  angleRad: number
  lengthPx: number
  thicknessPx: number
}>): Cinema2InterlockResolvedFixtureGeometry {
  const angleRad = Number.isFinite(input.angleRad) ? input.angleRad : 0
  const lengthPx = Math.max(EPSILON, finitePositive(input.lengthPx, EPSILON))
  const thicknessPx = Math.max(EPSILON, Math.min(lengthPx, finitePositive(input.thicknessPx, EPSILON)))
  const unitX = Math.cos(angleRad)
  const unitY = Math.sin(angleRad)
  const halfLength = lengthPx / 2
  let top: Cinema2Vector2
  let middle: Cinema2Vector2
  let bottom: Cinema2Vector2

  if (input.pivot === 'top') {
    top = point(input.pivotPoint[0], input.pivotPoint[1])
    middle = point(top[0] + unitX * halfLength, top[1] + unitY * halfLength)
    bottom = point(top[0] + unitX * lengthPx, top[1] + unitY * lengthPx)
  } else if (input.pivot === 'bottom') {
    bottom = point(input.pivotPoint[0], input.pivotPoint[1])
    middle = point(bottom[0] - unitX * halfLength, bottom[1] - unitY * halfLength)
    top = point(bottom[0] - unitX * lengthPx, bottom[1] - unitY * lengthPx)
  } else {
    middle = point(input.pivotPoint[0], input.pivotPoint[1])
    top = point(middle[0] - unitX * halfLength, middle[1] - unitY * halfLength)
    bottom = point(middle[0] + unitX * halfLength, middle[1] + unitY * halfLength)
  }

  return Object.freeze({
    fixtureId: input.fixtureId,
    patternId: input.patternId ?? null,
    pivot: input.pivot,
    top,
    middle,
    bottom,
    angleRad,
    lengthPx,
    thicknessPx,
  })
}

function resolveFixtureForTarget(
  fixture: Cinema2InterlockFixture,
  target: Cinema2InterlockPatternTarget,
  patternId: Cinema2InterlockPatternId,
  viewport: Cinema2InterlockResolvedViewport,
): Cinema2InterlockResolvedFixtureGeometry {
  const dimensions = fixtureDimensions(fixture, viewport)
  const midpoint = baseMidpoint(fixture, viewport, dimensions.lengthPx)
  const baseGeometry = resolveCinema2InterlockGeometryFromPivot({
    fixtureId: fixture.id,
    patternId: null,
    pivot: 'middle',
    pivotPoint: midpoint,
    angleRad: fixture.basePose.angleRad,
    ...dimensions,
  })
  return resolveCinema2InterlockGeometryFromPivot({
    fixtureId: fixture.id,
    patternId,
    pivot: target.pivot,
    pivotPoint: pointForPivot(baseGeometry, target.pivot),
    angleRad: target.targetAngleRad,
    ...dimensions,
  })
}

export function resolveCinema2InterlockLayout(
  patternId: unknown,
  viewportInput: Cinema2InterlockViewport,
): Cinema2InterlockResolvedLayout {
  const definition = getCinema2InterlockPatternDefinition(patternId)
  const viewport = resolveCinema2InterlockViewport(viewportInput)
  const fixtures = Object.freeze(CINEMA2_INTERLOCK_RIG.fixtures.map(fixture => resolveFixtureForTarget(
    fixture,
    getCinema2InterlockPatternTarget(definition.id, fixture.id),
    definition.id,
    viewport,
  )))
  return Object.freeze({ patternId: definition.id, viewport, fixtures })
}

/** Screen coordinates are safe when the fixture centerline remains inside the authored inset. */
export function isCinema2InterlockGeometryViewportSafe(
  geometry: Cinema2InterlockResolvedFixtureGeometry,
  viewport: Cinema2InterlockResolvedViewport,
  tolerancePx = 1e-6,
): boolean {
  return [geometry.top, geometry.middle, geometry.bottom].every(candidate => (
    candidate[0] >= viewport.safeMinX - tolerancePx
    && candidate[0] <= viewport.safeMaxX + tolerancePx
    && candidate[1] >= viewport.safeMinY - tolerancePx
    && candidate[1] <= viewport.safeMaxY + tolerancePx
  ))
}

export function resolveCinema2InterlockAngleDelta(
  startAngleRad: number,
  targetAngleRad: number,
  mode: Cinema2InterlockRotationMode,
): number {
  const start = Number.isFinite(startAngleRad) ? startAngleRad : 0
  const target = Number.isFinite(targetAngleRad) ? targetAngleRad : 0
  const direct = target - start
  const clockwise = positiveModulo(direct, TWO_PI)
  const counterclockwise = clockwise === 0 ? 0 : clockwise - TWO_PI
  let shortest = positiveModulo(direct + Math.PI, TWO_PI) - Math.PI
  if (Math.abs(shortest + Math.PI) < EPSILON && direct > 0) shortest = Math.PI

  if (mode === 'clockwise') return clockwise
  if (mode === 'counterclockwise') return counterclockwise
  if (mode === 'longest') {
    if (Math.abs(shortest) < EPSILON) return TWO_PI
    return shortest > 0 ? shortest - TWO_PI : shortest + TWO_PI
  }
  return shortest
}

/**
 * Pivot handoff reconstructs the new pivot from current visible geometry. The
 * first resolved transition frame is therefore exactly the handoff frame.
 */
export function createCinema2InterlockTransitionState(
  current: Cinema2InterlockResolvedFixtureGeometry,
  target: Pick<Cinema2InterlockPatternTarget, 'pivot' | 'targetAngleRad' | 'rotationMode'> & Partial<Pick<Cinema2InterlockPatternTarget, 'bankDelayBeats'>>,
  targetPatternId: Cinema2InterlockPatternId | null = null,
  rotationMode: Cinema2InterlockRotationMode = target.rotationMode,
): Cinema2InterlockTransitionState {
  return Object.freeze({
    fixtureId: current.fixtureId,
    targetPatternId,
    bankDelayBeats: finiteNonNegative(target.bankDelayBeats ?? 0),
    pivot: target.pivot,
    pivotPoint: pointForPivot(current, target.pivot),
    startAngleRad: current.angleRad,
    targetAngleRad: target.targetAngleRad,
    deltaAngleRad: resolveCinema2InterlockAngleDelta(current.angleRad, target.targetAngleRad, rotationMode),
    rotationMode,
    lengthPx: current.lengthPx,
    thicknessPx: current.thicknessPx,
  })
}

/**
 * Derives one fixture bank's morph progress from the canonical transition
 * timeline. The runtime expresses elapsed time in beat-equivalent units:
 * synchronized playback advances with the Interlock musical clock, while
 * Sync Off advances those units from the deterministic free-running seconds
 * clock. That keeps the catalog-owned bank delay independent from frame rate,
 * wall-clock timers, and renderer/shader state.
 */
export function resolveCinema2InterlockBankTransitionProgress(
  elapsedTransitionBeats: number,
  durationBeats: number,
  bankDelayBeats: number,
  bankStagger: number,
): number {
  const elapsed = finiteNonNegative(elapsedTransitionBeats)
  const duration = Math.max(EPSILON, finiteNonNegative(durationBeats))
  const delay = finiteNonNegative(bankDelayBeats) * clamp01(bankStagger)
  return clamp01((elapsed - delay) / duration)
}

export function resolveCinema2InterlockTransition(
  state: Cinema2InterlockTransitionState,
  progress: number,
): Cinema2InterlockResolvedFixtureGeometry {
  const t = clamp01(progress)
  return resolveCinema2InterlockGeometryFromPivot({
    fixtureId: state.fixtureId,
    patternId: t >= 1 ? state.targetPatternId : null,
    pivot: state.pivot,
    pivotPoint: state.pivotPoint,
    angleRad: state.startAngleRad + state.deltaAngleRad * t,
    lengthPx: state.lengthPx,
    thicknessPx: state.thicknessPx,
  })
}

/**
 * Canonical final-pose resolver. Layout/transition geometry remains the authored
 * base pose; runtime mechanical reactivity is a non-accumulating angular offset
 * applied around that pose's legal fixed pivot immediately before rendering.
 */
export function resolveCinema2InterlockFinalPose(
  base: Readonly<Cinema2InterlockResolvedFixtureGeometry>,
  angularOffsetRad: number,
): Cinema2InterlockResolvedFixtureGeometry {
  const offset = Number.isFinite(angularOffsetRad) ? angularOffsetRad : 0
  if (Math.abs(offset) < EPSILON) return base

  return resolveCinema2InterlockGeometryFromPivot({
    fixtureId: base.fixtureId,
    patternId: base.patternId,
    pivot: base.pivot,
    pivotPoint: pointForPivot(base, base.pivot),
    angleRad: base.angleRad + offset,
    lengthPx: base.lengthPx,
    thicknessPx: base.thicknessPx,
  })
}
