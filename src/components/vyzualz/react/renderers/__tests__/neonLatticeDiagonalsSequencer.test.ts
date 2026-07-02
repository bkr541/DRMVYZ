import { describe, expect, it } from 'vitest'
import { DEFAULT_NEON_LATTICE_SETTINGS, type NeonLatticeLanePattern } from '../../ReactTypes'
import { normalizeNeonLatticeSettings } from '../../NeonLatticeConfig'
import {
  advanceRailMorph,
  beginSegmentMorph,
  buildSegmentIntersections,
  clampDiagonalAngleDegrees,
  intersectSegments,
  makeDiagonalRail,
  makeHorizontalRail,
  makePulseOnRail,
  makeVerticalRail,
  pulsePointAt,
  selectPulseIntersectionCandidate,
  selectWeightedOrientation,
  routePulseAtIntersection,
  type NeonPaletteRgb,
  type NeonSegment,
} from '../neonLatticeUtils'
import {
  buildStableLaneGeometry,
  createNeonLatticeSequencerState,
  createSequencedLaneSegment,
  laneGeometryFor,
  reseedNeonLatticePattern,
  resetNeonLatticeSequencerState,
  resolvePatternStepLanes,
  resolveSequenceTrigger,
  retriggerSequencedLane,
  sequencedEnvelopeAlpha,
} from '../neonLatticeSequencer'

const palette: NeonPaletteRgb = {
  primary: '255,0,128',
  secondary: '0,255,255',
  accent: '255,128,0',
  highlight: '255,255,255',
}

const settings = normalizeNeonLatticeSettings({
  ...DEFAULT_NEON_LATTICE_SETTINGS,
  compositionMode: 'hybrid',
  orientationWeights: { vertical: 0.25, horizontal: 0.25, diagonalUp: 0.25, diagonalDown: 0.25 },
})

function segment(id: string, startX: number, startY: number, endX: number, endY: number): NeonSegment {
  const base = makeVerticalRail(1, settings, 0, [], palette, 1)
  return {
    ...base,
    id,
    startX, startY, endX, endY,
    orientation: Math.abs(startX - endX) < 1e-8 ? 'vertical'
      : Math.abs(startY - endY) < 1e-8 ? 'horizontal'
        : (endX - startX) * (endY - startY) < 0 ? 'diagonalUp' : 'diagonalDown',
  }
}

const pattern: NeonLatticeLanePattern = {
  id: 'test-pattern',
  name: 'Test Pattern',
  laneCount: 4,
  sequenceLength: 4,
  orientations: ['vertical', 'horizontal', 'diagonalUp', 'diagonalDown'],
  mirrored: false,
  seed: 7,
  steps: [
    { lanes: [0], orientation: 'vertical' },
    { lanes: [], rest: true },
    { lanes: [1], chordSize: 3, orientation: 'diagonalUp' },
    { lanes: [0], mirrored: true, orientation: 'horizontal', triggerStrength: 0.6 },
  ],
}

describe('true diagonal segment geometry', () => {
  it('creates diagonal-up and diagonal-down lines with real endpoints', () => {
    const up = makeDiagonalRail(11, 'diagonalUp', settings, 0, [], palette, 1, { spanMode: 'fullCanvas' })
    const down = makeDiagonalRail(12, 'diagonalDown', settings, 0, [], palette, 1, { spanMode: 'fullCanvas' })
    expect(up.orientation).toBe('diagonalUp')
    expect(down.orientation).toBe('diagonalDown')
    expect((up.endX - up.startX) * (up.endY - up.startY)).toBeLessThan(0)
    expect((down.endX - down.startX) * (down.endY - down.startY)).toBeGreaterThan(0)
    for (const value of [up.startX, up.startY, up.endX, up.endY, down.startX, down.startY, down.endX, down.endY]) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('clamps configurable angles and uses the normalized setting', () => {
    expect(clampDiagonalAngleDegrees(2)).toBe(10)
    expect(clampDiagonalAngleDegrees(110)).toBe(80)
    expect(clampDiagonalAngleDegrees(-2)).toBe(-10)
    const normalized = normalizeNeonLatticeSettings({ diagonalAngleDegrees: Number.POSITIVE_INFINITY })
    expect(normalized.diagonalAngleDegrees).toBe(DEFAULT_NEON_LATTICE_SETTINGS.diagonalAngleDegrees)
  })

  it('keeps legacy orientation selection isolated when diagonal weights are zero', () => {
    const legacy = normalizeNeonLatticeSettings({ verticalBias: 0.75 })
    expect(legacy.compositionMode).toBe('legacyLattice')
    expect(legacy.orientationWeights.diagonalUp).toBe(0)
    expect(legacy.orientationWeights.diagonalDown).toBe(0)
    for (let seed = 1; seed < 40; seed++) {
      expect(['vertical', 'horizontal']).toContain(selectWeightedOrientation(legacy.orientationWeights, seed))
    }
  })
})

describe('general intersections', () => {
  const vertical = segment('v', 0.5, 0, 0.5, 1)
  const horizontal = segment('h', 0, 0.5, 1, 0.5)
  const up = segment('u', 0, 1, 1, 0)
  const down = segment('d', 0, 0, 1, 1)

  it.each([
    [vertical, horizontal],
    [vertical, up],
    [horizontal, down],
    [up, down],
  ])('resolves every orientation combination', (a: NeonSegment, b: NeonSegment) => {
    const hit = intersectSegments(a, b)
    expect(hit).not.toBeNull()
    expect(hit?.x).toBeCloseTo(0.5, 6)
    expect(hit?.y).toBeCloseTo(0.5, 6)
  })

  it('supports endpoints and rejects intersections outside bounds', () => {
    const endpoint = intersectSegments(segment('a', 0, 0, 0.5, 0.5), segment('b', 0.5, 0.5, 1, 0))
    expect(endpoint?.x).toBeCloseTo(0.5)
    expect(endpoint?.progressA).toBeCloseTo(1)
    expect(intersectSegments(segment('c', 0, 0, 0.2, 0), segment('d2', 0.8, -1, 0.8, 1))).toBeNull()
  })

  it('handles parallel, nearly parallel, and collinear overlap deterministically', () => {
    expect(intersectSegments(segment('p1', 0, 0.1, 1, 0.1), segment('p2', 0, 0.2, 1, 0.2))).toBeNull()
    expect(intersectSegments(segment('np1', 0, 0, 1, 0.000001), segment('np2', 0, 0.1, 1, 0.100002), 1e-8)).toBeNull()
    const overlap = intersectSegments(segment('o1', 0, 0.5, 0.8, 0.5), segment('o2', 0.4, 0.5, 1, 0.5))
    expect(overlap?.kind).toBe('overlap')
    expect(overlap?.id).toContain('o1|o2')
  })

  it('deduplicates stable pair IDs', () => {
    const first = buildSegmentIntersections([vertical, horizontal])
    const second = buildSegmentIntersections([horizontal, vertical])
    expect(first.intersections).toHaveLength(1)
    expect(second.intersections[0].id).toBe(first.intersections[0].id)
  })


  it('accepts near-endpoint tolerance and suppresses duplicate pair identities', () => {
    const near = intersectSegments(
      segment('near-a', 0, 0, 0.5, 0.5),
      segment('near-b', 0.5000004, 0.5000004, 1, 0),
      1e-5,
    )
    expect(near).not.toBeNull()
    const duplicate = buildSegmentIntersections([
      segment('same-v', 0.5, 0, 0.5, 1),
      segment('same-h', 0, 0.5, 1, 0.5),
      segment('same-v', 0.5, 0, 0.5, 1),
    ])
    expect(duplicate.duplicatesSuppressed).toBeGreaterThan(0)
  })
})

describe('orientation-independent pulse routing and morphing', () => {
  it('interpolates a pulse along a diagonal', () => {
    const diagonal = segment('diag', 0, 1, 1, 0)
    const pulse = makePulseOnRail(diagonal, 1, settings, 0, palette, 1, 1, 1)
    pulse.progress = 0.25
    expect(pulsePointAt(pulse)).toEqual({ x: 0.25, y: 0.75 })
  })

  it('selects the nearest crossed turn and blocks immediate ping-pong', () => {
    const source = segment('source', 0, 0.5, 1, 0.5)
    const first = segment('first', 0.25, 0, 0.25, 1)
    const second = segment('second', 0.75, 0, 0.75, 1)
    const intersections = buildSegmentIntersections([source, first, second]).intersections
    const nearest = selectPulseIntersectionCandidate('source', 0.1, 0.9, 1, intersections, ['source'])
    expect(nearest?.otherSegmentId).toBe('first')
    const blocked = selectPulseIntersectionCandidate('source', 0.1, 0.9, 1, intersections, ['source', 'first'])
    expect(blocked?.otherSegmentId).toBe('second')
  })

  it('morphs safe orientation changes and retires unsafe reversals', () => {
    const rail = segment('morph', 0.2, 0, 0.2, 1)
    expect(beginSegmentMorph(rail, { startX: 0, startY: 0, endX: 1, endY: 1 }, 1)).toBe('morph')
    advanceRailMorph(rail, 0.5)
    for (const value of [rail.startX, rail.startY, rail.endX, rail.endY]) expect(Number.isFinite(value)).toBe(true)
    advanceRailMorph(rail, 0.5)
    expect(rail.orientation).toBe('diagonalDown')

    const unsafe = segment('unsafe', 0.2, 0, 0.2, 1)
    expect(beginSegmentMorph(unsafe, { startX: 0, startY: 1, endX: 1, endY: 0 }, 1)).toBe('replace')
  })

  it('bounds split routing after the first branch', () => {
    const splitSeed = 11264
    expect(routePulseAtIntersection(0, splitSeed)).toBe('split')
    expect(routePulseAtIntersection(1, splitSeed)).not.toBe('split')
  })
})

describe('stable authored lane sequencing', () => {
  it('builds stable, resize-safe lanes for all orientations', () => {
    const lanesA = buildStableLaneGeometry(pattern)
    const lanesB = buildStableLaneGeometry(pattern)
    expect(lanesB).toEqual(lanesA)
    expect(new Set(lanesA.map(lane => lane.orientation))).toEqual(new Set(pattern.orientations))
    for (const lane of lanesA) {
      for (const value of [lane.startX, lane.startY, lane.endX, lane.endY]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    }
  })

  it('mirrors lane positions deterministically', () => {
    const normal = laneGeometryFor('vertical', 0, 4, false)
    const mirrored = laneGeometryFor('vertical', 0, 4, true)
    expect(normal.startX + mirrored.startX).toBeCloseTo(1)
    expect(normal.id).not.toBe(mirrored.id)
  })

  it('supports rests, chord expansion, mirrored steps, and current-step tracking', () => {
    const state = createNeonLatticeSequencerState(pattern)
    expect(resolveSequenceTrigger(pattern, state, 1)?.lanes).toHaveLength(0)
    const chord = resolveSequenceTrigger(pattern, state, 2)
    expect(chord?.lanes).toHaveLength(3)
    const mirrored = resolveSequenceTrigger(pattern, state, 3)
    expect(mirrored?.lanes.map(lane => lane.laneIndex)).toEqual([0, 3])
    expect(state.currentStep).toBe(3)
    expect(resolveSequenceTrigger(pattern, state, 3)).toBeNull()
  })

  it('routes preset-defined custom segments through authored steps', () => {
    const customPattern: NeonLatticeLanePattern = {
      ...pattern,
      sequenceLength: 1,
      steps: [{ lanes: [0], orientation: 'custom' }],
    }
    const state = createNeonLatticeSequencerState(customPattern)
    const trigger = resolveSequenceTrigger(customPattern, state, 0, [{
      id: 'custom-a', startX: 0.1, startY: 0.2, endX: 0.9, endY: 0.7,
    }])
    expect(trigger?.lanes[0]).toMatchObject({
      id: 'lane-custom-custom-a', startX: 0.1, startY: 0.2, endX: 0.9, endY: 0.7,
    })
  })

  it('reseeds deterministic variation and resets sequence identity', () => {
    const first = createNeonLatticeSequencerState(pattern)
    const second = createNeonLatticeSequencerState(pattern)
    reseedNeonLatticePattern(first, pattern, 99)
    reseedNeonLatticePattern(second, pattern, 99)
    expect(resolvePatternStepLanes(pattern, first, 2, pattern.steps[2])).toEqual(resolvePatternStepLanes(pattern, second, 2, pattern.steps[2]))
    resetNeonLatticeSequencerState(first, pattern)
    expect(first.currentStep).toBe(-1)
    expect(first.lastTriggerIndex).toBe(-1)
  })
})

describe('visual note envelopes and retrigger policies', () => {
  const lane = laneGeometryFor('vertical', 1, 4)

  it('progresses through attack, hold, and release', () => {
    const local = normalizeNeonLatticeSettings({
      ...settings,
      lineEnvelope: { attackBeats: 0.5, holdBeats: 0.5, releaseBeats: 0.5, gateLengthBeats: 0.5, triggerStrengthScale: 1 },
    })
    const note = createSequencedLaneSegment(lane, local, palette, 10, 120, 1)
    expect(sequencedEnvelopeAlpha(note, 10, 120)).toBe(0)
    expect(sequencedEnvelopeAlpha(note, 10.125, 120)).toBeCloseTo(0.5)
    expect(sequencedEnvelopeAlpha(note, 10.375, 120)).toBeCloseTo(1)
    expect(sequencedEnvelopeAlpha(note, 10.625, 120)).toBeCloseTo(0.5)
    expect(sequencedEnvelopeAlpha(note, 11, 120)).toBe(0)
  })

  it('restarts, extends, and bounds stacked retriggers', () => {
    const restart = normalizeNeonLatticeSettings({ ...settings, retriggerBehavior: 'restart' })
    const restartSegments: NeonSegment[] = []
    retriggerSequencedLane(restartSegments, lane, restart, palette, 0, 120, 0.5)
    const stableId = restartSegments[0].id
    retriggerSequencedLane(restartSegments, lane, restart, palette, 1, 120, 1)
    expect(restartSegments).toHaveLength(1)
    expect(restartSegments[0].id).toBe(stableId)
    expect(restartSegments[0].birthSec).toBe(1)

    const extend = normalizeNeonLatticeSettings({ ...settings, retriggerBehavior: 'extend' })
    const extendSegments: NeonSegment[] = []
    retriggerSequencedLane(extendSegments, lane, extend, palette, 0, 120, 0.5)
    const oldLifetime = extendSegments[0].lifetime
    retriggerSequencedLane(extendSegments, lane, extend, palette, oldLifetime * 0.5, 120, 1)
    expect(extendSegments).toHaveLength(1)
    expect(extendSegments[0].lifetime).toBeGreaterThan(oldLifetime)

    const stack = normalizeNeonLatticeSettings({ ...settings, retriggerBehavior: 'stack' })
    const stacked: NeonSegment[] = []
    for (let index = 0; index < 6; index++) retriggerSequencedLane(stacked, lane, stack, palette, index, 120, 1)
    expect(stacked.filter(item => item.laneId === lane.id)).toHaveLength(3)
  })
})

describe('composition contracts', () => {
  it('normalizes all modes without enabling diagonals for legacy settings', () => {
    expect(normalizeNeonLatticeSettings({ compositionMode: 'laneSequencer' }).compositionMode).toBe('laneSequencer')
    expect(normalizeNeonLatticeSettings({ compositionMode: 'hybrid' }).compositionMode).toBe('hybrid')
    const legacy = normalizeNeonLatticeSettings({ compositionMode: 'legacyLattice', verticalBias: 0.2 })
    expect(legacy.orientationWeights).toMatchObject({ diagonalUp: 0, diagonalDown: 0 })
  })
})
