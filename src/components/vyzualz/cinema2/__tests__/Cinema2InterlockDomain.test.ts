import { describe, expect, it } from 'vitest'
import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  CINEMA2_INTERLOCK_HERO_PATTERN_ID,
  CINEMA2_INTERLOCK_PATTERN_CATALOG,
  CINEMA2_INTERLOCK_PATTERN_IDS,
  CINEMA2_INTERLOCK_PIVOT_IDS,
  CINEMA2_INTERLOCK_RIG,
  CINEMA2_INTERLOCK_SAFE_INSET_CSS_PX,
  createCinema2InterlockTransitionState,
  getCinema2InterlockMirrorFixture,
  getCinema2InterlockPatternTarget,
  isCinema2InterlockGeometryBodySafe,
  isCinema2InterlockGeometryViewportSafe,
  normalizeCinema2InterlockPatternId,
  resolveCinema2InterlockAngleDelta,
  resolveCinema2InterlockBankTransitionProgress,
  resolveCinema2InterlockFinalPose,
  resolveCinema2InterlockGeometryFromPivot,
  resolveCinema2InterlockLayout,
  resolveCinema2InterlockVisibleEnvelope,
  resolveCinema2InterlockTransition,
  validateCinema2InterlockPatternDefinition,
  type Cinema2InterlockPatternId,
  type Cinema2InterlockPivotId,
  type Cinema2InterlockResolvedFixtureGeometry,
  type Cinema2InterlockViewport,
} from '../modules/interlock'

const VIEWPORTS: readonly Cinema2InterlockViewport[] = Object.freeze([
  Object.freeze({ width: 1920, height: 1080, dpr: 1 }),
  Object.freeze({ width: 1920, height: 1200, dpr: 1 }),
  Object.freeze({ width: 900, height: 900, dpr: 1 }),
  Object.freeze({ width: 2560, height: 1080, dpr: 1 }),
  Object.freeze({ width: 2560, height: 1440, dpr: 1 }),
  Object.freeze({ width: 3840, height: 2160, dpr: 1 }),
  Object.freeze({ width: 5120, height: 1440, dpr: 1 }),
  Object.freeze({ width: 20, height: 20, dpr: 1 }),
  Object.freeze({ width: 2560, height: 1440, dpr: 2 }),
])

function distance(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!)
}

function expectSameGeometry(
  actual: Cinema2InterlockResolvedFixtureGeometry,
  expected: Cinema2InterlockResolvedFixtureGeometry,
  precision = 8,
) {
  expect(actual.top[0]).toBeCloseTo(expected.top[0], precision)
  expect(actual.top[1]).toBeCloseTo(expected.top[1], precision)
  expect(actual.middle[0]).toBeCloseTo(expected.middle[0], precision)
  expect(actual.middle[1]).toBeCloseTo(expected.middle[1], precision)
  expect(actual.bottom[0]).toBeCloseTo(expected.bottom[0], precision)
  expect(actual.bottom[1]).toBeCloseTo(expected.bottom[1], precision)
  expect(actual.lengthPx).toBeCloseTo(expected.lengthPx, precision)
  expect(actual.thicknessPx).toBeCloseTo(expected.thicknessPx, precision)
}

function fixtureMap(patternId: Cinema2InterlockPatternId, viewport: Cinema2InterlockViewport) {
  return new Map(resolveCinema2InterlockLayout(patternId, viewport).fixtures.map(candidate => [candidate.fixtureId, candidate]))
}

describe('Cinema 2.0 Interlock Stage 1 domain', () => {
  it('installs exactly 28 stable, immutable fixtures with reciprocal bilateral mirrors', () => {
    expect(CINEMA2_INTERLOCK_RIG.fixtures).toHaveLength(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(new Set(CINEMA2_INTERLOCK_RIG.fixtures.map(candidate => candidate.id)).size).toBe(CINEMA2_INTERLOCK_FIXTURE_COUNT)
    expect(CINEMA2_INTERLOCK_RIG.banks.inner).toHaveLength(8)
    expect(CINEMA2_INTERLOCK_RIG.banks.middle).toHaveLength(8)
    expect(CINEMA2_INTERLOCK_RIG.banks.outer).toHaveLength(8)
    expect(CINEMA2_INTERLOCK_RIG.banks.edge).toHaveLength(4)
    expect(Object.isFrozen(CINEMA2_INTERLOCK_RIG)).toBe(true)
    expect(Object.isFrozen(CINEMA2_INTERLOCK_RIG.fixtures)).toBe(true)

    for (const fixture of CINEMA2_INTERLOCK_RIG.fixtures) {
      const mirror = getCinema2InterlockMirrorFixture(fixture)
      expect(mirror.mirrorFixtureId).toBe(fixture.id)
      expect(mirror.pairId).toBe(fixture.pairId)
      expect(mirror.bank).toBe(fixture.bank)
      expect(mirror.basePose.midpointNormalized[0]).toBeCloseTo(1 - fixture.basePose.midpointNormalized[0], 10)
      expect(mirror.basePose.midpointNormalized[1]).toBeCloseTo(fixture.basePose.midpointNormalized[1], 10)
    }
  })

  it('exports only the five authored layouts with the required default and hero IDs', () => {
    expect(CINEMA2_INTERLOCK_PATTERN_IDS).toEqual([
      'diamondTunnel', 'mechanicalIris', 'doubleWing', 'bassPortal', 'fourWayVortex',
    ])
    expect(CINEMA2_INTERLOCK_PATTERN_CATALOG.map(candidate => candidate.id)).toEqual(CINEMA2_INTERLOCK_PATTERN_IDS)
    expect(CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID).toBe('diamondTunnel')
    expect(CINEMA2_INTERLOCK_HERO_PATTERN_ID).toBe('fourWayVortex')
    expect(normalizeCinema2InterlockPatternId('not-real')).toBe('diamondTunnel')
    expect(normalizeCinema2InterlockPatternId(null)).toBe('diamondTunnel')
  })

  it('covers every fixture exactly once in every immutable pattern target table', () => {
    const rigIds = new Set(CINEMA2_INTERLOCK_RIG.fixtures.map(candidate => candidate.id))
    for (const pattern of CINEMA2_INTERLOCK_PATTERN_CATALOG) {
      expect(Object.isFrozen(pattern)).toBe(true)
      expect(Object.isFrozen(pattern.targets)).toBe(true)
      expect(pattern.targets).toHaveLength(CINEMA2_INTERLOCK_FIXTURE_COUNT)
      expect(new Set(pattern.targets.map(target => target.fixtureId))).toEqual(rigIds)
      expect(validateCinema2InterlockPatternDefinition(pattern)).toEqual([])
    }
  })

  it('uses one intentional top/middle/bottom hinge topology across all five deterministic layouts', () => {
    const pivotByFixture = new Map<string, Cinema2InterlockPivotId>()
    for (const pattern of CINEMA2_INTERLOCK_PATTERN_CATALOG) {
      const counts: Record<Cinema2InterlockPivotId, number> = { top: 0, middle: 0, bottom: 0 }
      for (const fixture of CINEMA2_INTERLOCK_RIG.fixtures) {
        const target = getCinema2InterlockPatternTarget(pattern.id, fixture.id)
        counts[target.pivot] += 1
        const previous = pivotByFixture.get(fixture.id)
        if (previous) expect(target.pivot).toBe(previous)
        else pivotByFixture.set(fixture.id, target.pivot)

        const mirror = getCinema2InterlockMirrorFixture(fixture)
        expect(getCinema2InterlockPatternTarget(pattern.id, mirror.id).pivot).toBe(target.pivot)
      }
      expect(counts).toEqual({ top: 8, middle: 12, bottom: 8 })
    }
  })

  it('keeps authored bank-delay intent stable for every fixture in all five layouts', () => {
    const expectedDelay = { inner: 0, middle: 0.0625, outer: 0.125, edge: 0.1875 } as const
    for (const pattern of CINEMA2_INTERLOCK_PATTERN_CATALOG) {
      for (const fixture of CINEMA2_INTERLOCK_RIG.fixtures) {
        expect(getCinema2InterlockPatternTarget(pattern.id, fixture.id).bankDelayBeats)
          .toBe(expectedDelay[fixture.bank])
      }
    }
  })

  it('derives monotonic per-bank transition separation and exact delayed completion from Bank Stagger', () => {
    const durationBeats = 2
    const elapsedBeats = 1
    const edgeDelayBeats = 0.1875
    const separations = [0, 0.25, 0.5, 0.75, 1].map(bankStagger => {
      const inner = resolveCinema2InterlockBankTransitionProgress(elapsedBeats, durationBeats, 0, bankStagger)
      const edge = resolveCinema2InterlockBankTransitionProgress(elapsedBeats, durationBeats, edgeDelayBeats, bankStagger)
      if (bankStagger === 0) expect(edge).toBeCloseTo(inner, 12)
      return inner - edge
    })

    expect(separations[0]).toBeCloseTo(0, 12)
    for (let index = 1; index < separations.length; index += 1) {
      expect(separations[index]!).toBeGreaterThan(separations[index - 1]!)
    }

    for (const bankStagger of [0, 0.25, 0.5, 0.75, 1]) {
      const finalElapsed = durationBeats + edgeDelayBeats * bankStagger
      expect(resolveCinema2InterlockBankTransitionProgress(finalElapsed, durationBeats, edgeDelayBeats, bankStagger)).toBe(1)
    }
  })

  it('rejects malformed target tables instead of silently accepting duplicate, missing, or invalid values', () => {
    const valid = CINEMA2_INTERLOCK_PATTERN_CATALOG[0]!
    const duplicated = Object.freeze([...valid.targets.slice(0, -1), valid.targets[0]!])
    const malformed = Object.freeze({
      id: valid.id,
      targets: Object.freeze(duplicated.map((target, index) => index === 0
        ? Object.freeze({ ...target, targetAngleRad: Number.NaN })
        : target)),
    })
    const errors = validateCinema2InterlockPatternDefinition(malformed)
    expect(errors.some(error => error.includes('duplicates fixture'))).toBe(true)
    expect(errors.some(error => error.includes('missing fixture'))).toBe(true)
    expect(errors.some(error => error.includes('non-finite angle'))).toBe(true)
  })

  it('keeps top, middle, and bottom pivots exactly stationary during rigid rotation', () => {
    const pivotPoint = Object.freeze([400, 300] as const)
    for (const pivot of CINEMA2_INTERLOCK_PIVOT_IDS) {
      const first = resolveCinema2InterlockGeometryFromPivot({
        fixtureId: `pivot-${pivot}`,
        pivot,
        pivotPoint,
        angleRad: -0.7,
        lengthPx: 240,
        thicknessPx: 18,
      })
      const target = { pivot, targetAngleRad: 1.1, rotationMode: 'shortest' as const }
      const state = createCinema2InterlockTransitionState(first, target)
      for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
        const frame = resolveCinema2InterlockTransition(state, progress)
        const stationary = pivot === 'top' ? frame.top : pivot === 'bottom' ? frame.bottom : frame.middle
        expect(stationary[0]).toBeCloseTo(pivotPoint[0], 10)
        expect(stationary[1]).toBeCloseTo(pivotPoint[1], 10)
        expect(distance(frame.top, frame.bottom)).toBeCloseTo(240, 10)
        expect(frame.thicknessPx).toBeCloseTo(18, 10)
      }
    }
  })

  it('applies positive and negative final-pose offsets around every legal fixed pivot without changing rigid dimensions', () => {
    const pivotPoint = Object.freeze([440, 320] as const)
    for (const pivot of CINEMA2_INTERLOCK_PIVOT_IDS) {
      const base = resolveCinema2InterlockGeometryFromPivot({
        fixtureId: `final-pose-${pivot}`,
        patternId: 'diamondTunnel',
        pivot,
        pivotPoint,
        angleRad: 0.37,
        lengthPx: 260,
        thicknessPx: 16,
      })

      for (const offset of [-0.42, -0.17, 0.14, 0.39]) {
        const resolved = resolveCinema2InterlockFinalPose(base, offset)
        const stationary = pivot === 'top' ? resolved.top : pivot === 'bottom' ? resolved.bottom : resolved.middle
        expect(stationary[0]).toBeCloseTo(pivotPoint[0], 10)
        expect(stationary[1]).toBeCloseTo(pivotPoint[1], 10)
        expect(resolved.angleRad).toBeCloseTo(base.angleRad + offset, 10)
        expect(distance(resolved.top, resolved.bottom)).toBeCloseTo(base.lengthPx, 10)
        expect(resolved.thicknessPx).toBeCloseTo(base.thicknessPx, 10)
      }
    }
  })

  it('supports clockwise, counterclockwise, shortest-path, and deliberate long-path angle interpolation', () => {
    const start = 170 * Math.PI / 180
    const target = -170 * Math.PI / 180
    expect(resolveCinema2InterlockAngleDelta(start, target, 'shortest')).toBeCloseTo(20 * Math.PI / 180, 10)
    expect(resolveCinema2InterlockAngleDelta(start, target, 'clockwise')).toBeCloseTo(20 * Math.PI / 180, 10)
    expect(resolveCinema2InterlockAngleDelta(start, target, 'counterclockwise')).toBeCloseTo(-340 * Math.PI / 180, 10)
    expect(resolveCinema2InterlockAngleDelta(start, target, 'longest')).toBeCloseTo(-340 * Math.PI / 180, 10)
    expect(resolveCinema2InterlockAngleDelta(0, 0, 'longest')).toBeCloseTo(Math.PI * 2, 10)
  })

  it('performs pivot handoff with identical visible geometry at the handoff frame', () => {
    const current = resolveCinema2InterlockGeometryFromPivot({
      fixtureId: 'handoff',
      pivot: 'middle',
      pivotPoint: Object.freeze([500, 420] as const),
      angleRad: 0.63,
      lengthPx: 300,
      thicknessPx: 22,
    })

    for (const pivot of ['top', 'middle', 'bottom'] as readonly Cinema2InterlockPivotId[]) {
      const state = createCinema2InterlockTransitionState(current, {
        pivot,
        targetAngleRad: -1.4,
        rotationMode: 'counterclockwise',
      })
      const handoff = resolveCinema2InterlockTransition(state, 0)
      expectSameGeometry(handoff, current)
    }
  })

  it('resolves every layout safely for 16:9, 16:10, square, ultrawide, tiny, and high-DPR viewports', () => {
    for (const viewport of VIEWPORTS) {
      for (const patternId of CINEMA2_INTERLOCK_PATTERN_IDS) {
        const layout = resolveCinema2InterlockLayout(patternId, viewport)
        expect(layout.fixtures).toHaveLength(CINEMA2_INTERLOCK_FIXTURE_COUNT)
        expect(layout.fixtures.every(candidate => isCinema2InterlockGeometryBodySafe(candidate, layout.viewport))).toBe(true)
        expect(layout.fixtures.every(candidate => isCinema2InterlockGeometryViewportSafe(candidate, layout.viewport))).toBe(true)
        for (const fixture of layout.fixtures) {
          expect(Number.isFinite(fixture.angleRad)).toBe(true)
          expect(fixture.lengthPx).toBeGreaterThan(0)
          expect(fixture.thicknessPx).toBeGreaterThan(0)
          expect(distance(fixture.top, fixture.bottom)).toBeCloseTo(fixture.lengthPx, 8)
          expect(fixture.middle[0]).toBeCloseTo((fixture.top[0] + fixture.bottom[0]) / 2, 8)
          expect(fixture.middle[1]).toBeCloseTo((fixture.top[1] + fixture.bottom[1]) / 2, 8)
        }
      }
    }
  })

  it('preserves the full 12 CSS-pixel boundary whenever the viewport is large enough and degrades tiny viewports safely', () => {
    for (const viewport of VIEWPORTS.filter(candidate => candidate.width >= 100 && candidate.height >= 100)) {
      const layout = resolveCinema2InterlockLayout('diamondTunnel', viewport)
      expect(layout.viewport.safeInsetCssPx).toBeCloseTo(CINEMA2_INTERLOCK_SAFE_INSET_CSS_PX, 10)
      expect(layout.viewport.degradedInset).toBe(false)
    }
    const tiny = resolveCinema2InterlockLayout('diamondTunnel', { width: 10, height: 8, dpr: 2 })
    expect(tiny.viewport.degradedInset).toBe(true)
    expect(tiny.viewport.safeMinX).toBeLessThan(tiny.viewport.safeMaxX)
    expect(tiny.viewport.safeMinY).toBeLessThan(tiny.viewport.safeMaxY)
    expect(tiny.fixtures.every(candidate => isCinema2InterlockGeometryViewportSafe(candidate, tiny.viewport))).toBe(true)
  })

  it('places wing and portal edge fixtures by the actual rendered envelope instead of centerline endpoints', () => {
    const viewport = { width: 1920, height: 1080, dpr: 1 }
    const edgeIds = new Set(CINEMA2_INTERLOCK_RIG.banks.edge.map(candidate => candidate.id))
    for (const patternId of ['doubleWing', 'bassPortal'] as const) {
      const layout = resolveCinema2InterlockLayout(patternId, viewport)
      const edgeFixtures = layout.fixtures.filter(candidate => edgeIds.has(candidate.fixtureId))
      const boundaryDistances = edgeFixtures.map(candidate => {
        const rendered = resolveCinema2InterlockVisibleEnvelope(candidate).rendered
        return Math.min(
          rendered.minX - layout.viewport.safeMinX,
          layout.viewport.safeMaxX - rendered.maxX,
          rendered.minY - layout.viewport.safeMinY,
          layout.viewport.safeMaxY - rendered.maxY,
        )
      })
      expect(edgeFixtures).toHaveLength(CINEMA2_INTERLOCK_RIG.banks.edge.length)
      expect(Math.max(...boundaryDistances)).toBeLessThanOrEqual(8 * layout.viewport.dpr)
      expect(edgeFixtures.every(candidate => isCinema2InterlockGeometryBodySafe(candidate, layout.viewport))).toBe(true)
      expect(edgeFixtures.every(candidate => isCinema2InterlockGeometryViewportSafe(candidate, layout.viewport))).toBe(true)
    }
  })

  it('keeps the Four-Way Vortex rendered edge envelope close to the intended 12 CSS-pixel composition line', () => {
    const layout = resolveCinema2InterlockLayout(CINEMA2_INTERLOCK_HERO_PATTERN_ID, { width: 1920, height: 1080, dpr: 1 })
    const edgeIds = new Set(CINEMA2_INTERLOCK_RIG.banks.edge.map(candidate => candidate.id))
    const edgeFixtures = layout.fixtures.filter(candidate => edgeIds.has(candidate.fixtureId))
    const boundaryDistances = edgeFixtures.map(candidate => {
      const rendered = resolveCinema2InterlockVisibleEnvelope(candidate).rendered
      return Math.min(
        rendered.minX - layout.viewport.safeMinX,
        layout.viewport.safeMaxX - rendered.maxX,
        rendered.minY - layout.viewport.safeMinY,
        layout.viewport.safeMaxY - rendered.maxY,
      )
    })
    expect(edgeFixtures).toHaveLength(CINEMA2_INTERLOCK_RIG.banks.edge.length)
    expect(Math.max(...boundaryDistances)).toBeLessThanOrEqual(10 * layout.viewport.dpr)
    expect(layout.fixtures.every(candidate => isCinema2InterlockGeometryBodySafe(candidate, layout.viewport))).toBe(true)
    expect(layout.fixtures.every(candidate => isCinema2InterlockGeometryViewportSafe(candidate, layout.viewport))).toBe(true)
  })

  it('measures the same finite body and glow-expanded quad that the native renderer rasterizes', () => {
    const geometry = resolveCinema2InterlockGeometryFromPivot({
      fixtureId: 'envelope-probe',
      pivot: 'middle',
      pivotPoint: Object.freeze([500, 400] as const),
      angleRad: 0,
      lengthPx: 200,
      thicknessPx: 20,
    })
    const envelope = resolveCinema2InterlockVisibleEnvelope(geometry)
    expect(envelope.dimensions.halfThicknessPx).toBe(10)
    expect(envelope.dimensions.glowPaddingPx).toBe(34)
    expect(envelope.body).toEqual({ minX: 400, maxX: 600, minY: 390, maxY: 410 })
    expect(envelope.rendered).toEqual({ minX: 366, maxX: 634, minY: 356, maxY: 444 })
  })

  it('keeps all five layout resting poses mechanically distinct while preserving dimensions by fixture identity', () => {
    const viewport = { width: 1920, height: 1080, dpr: 1 }
    const signatures = new Set<string>()
    const reference = fixtureMap('diamondTunnel', viewport)
    for (const patternId of CINEMA2_INTERLOCK_PATTERN_IDS) {
      const layout = resolveCinema2InterlockLayout(patternId, viewport)
      signatures.add(layout.fixtures.map(candidate => [
        candidate.fixtureId,
        candidate.pivot,
        candidate.middle[0].toFixed(2),
        candidate.middle[1].toFixed(2),
        candidate.angleRad.toFixed(4),
      ].join(':')).join('|'))
      for (const fixture of layout.fixtures) {
        const baseline = reference.get(fixture.fixtureId)!
        expect(fixture.lengthPx).toBeCloseTo(baseline.lengthPx, 10)
        expect(fixture.thicknessPx).toBeCloseTo(baseline.thicknessPx, 10)
      }
    }
    expect(signatures.size).toBe(CINEMA2_INTERLOCK_PATTERN_IDS.length)
  })

  it('keeps the full rendered envelope safe under the strongest Stage 4 continuous reactive rotation', () => {
    const maxReactiveOffset = Math.PI / 12
    for (const viewport of VIEWPORTS.filter(candidate => !resolveCinema2InterlockLayout('diamondTunnel', candidate).viewport.degradedInset)) {
      for (const patternId of CINEMA2_INTERLOCK_PATTERN_IDS) {
        const layout = resolveCinema2InterlockLayout(patternId, viewport)
        for (const fixture of layout.fixtures) {
          for (const offset of [-maxReactiveOffset, maxReactiveOffset]) {
            const reactive = resolveCinema2InterlockFinalPose(fixture, offset)
            expect(isCinema2InterlockGeometryBodySafe(reactive, layout.viewport)).toBe(true)
            expect(isCinema2InterlockGeometryViewportSafe(reactive, layout.viewport)).toBe(true)
          }
        }
      }
    }
  })

  it('keeps CSS-space geometry identical when the same viewport is represented at DPR 1 and DPR 2', () => {
    const one = resolveCinema2InterlockLayout('fourWayVortex', { width: 1280, height: 720, dpr: 1 })
    const two = resolveCinema2InterlockLayout('fourWayVortex', { width: 2560, height: 1440, dpr: 2 })
    for (let index = 0; index < one.fixtures.length; index += 1) {
      const a = one.fixtures[index]!
      const b = two.fixtures[index]!
      expect(a.fixtureId).toBe(b.fixtureId)
      expect(a.top[0]).toBeCloseTo(b.top[0] / 2, 8)
      expect(a.top[1]).toBeCloseTo(b.top[1] / 2, 8)
      expect(a.bottom[0]).toBeCloseTo(b.bottom[0] / 2, 8)
      expect(a.bottom[1]).toBeCloseTo(b.bottom[1] / 2, 8)
      expect(a.lengthPx).toBeCloseTo(b.lengthPx / 2, 8)
      expect(a.thicknessPx).toBeCloseTo(b.thicknessPx / 2, 8)
    }
  })

  it('interpolates every ordered layout pair without stretching, NaN, boundary escape, or endpoint discontinuity', () => {
    const viewport = { width: 1280, height: 720, dpr: 1.5 }
    for (const fromId of CINEMA2_INTERLOCK_PATTERN_IDS) {
      const from = fixtureMap(fromId, viewport)
      for (const toId of CINEMA2_INTERLOCK_PATTERN_IDS) {
        const to = fixtureMap(toId, viewport)
        const resolvedViewport = resolveCinema2InterlockLayout(fromId, viewport).viewport
        for (const fixture of CINEMA2_INTERLOCK_RIG.fixtures) {
          const start = from.get(fixture.id)!
          const expectedEnd = to.get(fixture.id)!
          const target = getCinema2InterlockPatternTarget(toId, fixture.id)
          const state = createCinema2InterlockTransitionState(start, target, toId)
          for (const progress of [-1, 0, 0.15, 0.5, 0.85, 1, 2]) {
            const frame = resolveCinema2InterlockTransition(state, progress)
            expect(distance(frame.top, frame.bottom)).toBeCloseTo(start.lengthPx, 8)
            expect(frame.thicknessPx).toBeCloseTo(start.thicknessPx, 8)
            expect([frame.top, frame.middle, frame.bottom].flat().every(Number.isFinite)).toBe(true)
            expect(isCinema2InterlockGeometryViewportSafe(frame, resolvedViewport)).toBe(true)
          }
          expectSameGeometry(resolveCinema2InterlockTransition(state, 1), expectedEnd, 7)
        }
      }
    }
  })

  it('normalizes malformed viewports to finite bounded geometry', () => {
    for (const viewport of [
      { width: Number.NaN, height: Number.POSITIVE_INFINITY, dpr: 0 },
      { width: -100, height: -50, dpr: -2 },
      { width: 0, height: 0, dpr: Number.NaN },
    ]) {
      const layout = resolveCinema2InterlockLayout('mechanicalIris', viewport)
      expect(layout.viewport.width).toBeGreaterThan(0)
      expect(layout.viewport.height).toBeGreaterThan(0)
      expect(layout.viewport.dpr).toBeGreaterThan(0)
      expect(layout.fixtures.every(candidate => isCinema2InterlockGeometryViewportSafe(candidate, layout.viewport))).toBe(true)
      expect(layout.fixtures.every(candidate => [candidate.top, candidate.middle, candidate.bottom].flat().every(Number.isFinite))).toBe(true)
    }
  })

  it('is deterministic across repeated resolution and resize cycles', () => {
    const viewport = { width: 1536, height: 864, dpr: 1.25 }
    const first = resolveCinema2InterlockLayout('fourWayVortex', viewport)
    const second = resolveCinema2InterlockLayout('fourWayVortex', viewport)
    expect(second).toEqual(first)

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const resized = { width: 700 + cycle * 37, height: 500 + cycle * 19, dpr: 1 + (cycle % 3) * 0.5 }
      const a = resolveCinema2InterlockLayout('mechanicalIris', resized)
      const b = resolveCinema2InterlockLayout('mechanicalIris', resized)
      expect(b).toEqual(a)
    }
  })
})
