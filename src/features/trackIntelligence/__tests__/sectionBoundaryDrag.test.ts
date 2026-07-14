import { describe, it, expect } from 'vitest'
import {
  computeMinDuration,
  pointerXToTime,
  snapToNearestBeat,
  snapBoundaryTime,
  navigateBoundaryAlternative,
  clampEdgeAgainstTimeline,
  findSharedBoundaryNeighbor,
  clampEdge,
  computeKeyStep,
  ADJACENCY_TOLERANCE_SEC,
} from '../sectionBoundaryDrag'
import type { ReactTrackSection } from '../../../components/vyzualz/react/ReactTypes'
import type { BeatMarkerMI, BoundaryAlternative } from '../../musicIntelligence/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<ReactTrackSection> = {}): ReactTrackSection {
  return {
    id:        'sec-1',
    label:     'Intro',
    type:      'intro',
    startSec:  0,
    endSec:    30,
    intensity: 0.4,
    source:    'auto',
    ...overrides,
  }
}

function makeBeats(...times: number[]): BeatMarkerMI[] {
  return times.map(t => ({ timeSec: t, confidence: 1, isDownbeat: false }))
}

// ── 1: computeMinDuration ─────────────────────────────────────────────────────

describe('computeMinDuration', () => {
  it('returns 0.1 s when no BPM', () => {
    expect(computeMinDuration(null)).toBe(0.1)
    expect(computeMinDuration(undefined)).toBe(0.1)
  })

  it('returns 0.1 s when BPM is 0', () => {
    expect(computeMinDuration(0)).toBe(0.1)
  })

  it('returns one beat duration for a valid BPM (120 BPM → 0.5 s)', () => {
    expect(computeMinDuration(120)).toBeCloseTo(0.5, 5)
  })

  it('returns one beat duration for 60 BPM → 1.0 s', () => {
    expect(computeMinDuration(60)).toBeCloseTo(1.0, 5)
  })

  it('clamps to at least 0.1 s even for very fast BPM (600 BPM → 0.1 s)', () => {
    expect(computeMinDuration(600)).toBe(0.1)
  })

  it('returns 0.1 for Infinity BPM', () => {
    expect(computeMinDuration(Infinity)).toBe(0.1)
  })
})

// ── 2: pointerXToTime ─────────────────────────────────────────────────────────

describe('pointerXToTime', () => {
  it('maps pointer at left edge to viewportStart', () => {
    expect(pointerXToTime(100, 100, 400, 0, 120)).toBeCloseTo(0)
  })

  it('maps pointer at right edge to viewportEnd', () => {
    expect(pointerXToTime(500, 100, 400, 0, 120)).toBeCloseTo(120)
  })

  it('maps pointer at centre to midpoint of viewport', () => {
    expect(pointerXToTime(300, 100, 400, 0, 120)).toBeCloseTo(60)
  })

  it('clamps pointer before left edge to viewportStart', () => {
    expect(pointerXToTime(50, 100, 400, 0, 120)).toBeCloseTo(0)
  })

  it('clamps pointer beyond right edge to viewportEnd', () => {
    expect(pointerXToTime(600, 100, 400, 0, 120)).toBeCloseTo(120)
  })

  it('works with a zoomed viewport (viewportStart = 30, viewportEnd = 90)', () => {
    // Container left=0, width=600, pointer at x=300 (50%) → 30 + 0.5 * (90-30) = 60
    expect(pointerXToTime(300, 0, 600, 30, 90)).toBeCloseTo(60)
  })

  it('returns viewportStart when containerWidth is 0', () => {
    expect(pointerXToTime(100, 100, 0, 0, 120)).toBe(0)
  })
})

// ── 3: snapToNearestBeat ──────────────────────────────────────────────────────

describe('snapToNearestBeat', () => {
  const grid = makeBeats(0, 0.5, 1.0, 1.5, 2.0)

  it('snaps to the nearest beat when alt is not held', () => {
    expect(snapToNearestBeat(0.6, grid, false)).toBeCloseTo(0.5)
    expect(snapToNearestBeat(0.9, grid, false)).toBeCloseTo(1.0)
  })

  it('returns the raw time when alt is held (free movement)', () => {
    expect(snapToNearestBeat(0.6, grid, true)).toBeCloseTo(0.6)
  })

  it('returns the raw time when beat grid is empty', () => {
    expect(snapToNearestBeat(0.6, [], false)).toBeCloseTo(0.6)
  })

  it('snaps exactly to a beat when the time matches', () => {
    expect(snapToNearestBeat(1.0, grid, false)).toBeCloseTo(1.0)
  })

  it('snaps to first beat for times before it', () => {
    expect(snapToNearestBeat(-0.1, grid, false)).toBeCloseTo(0)
  })

  it('snaps to last beat for times after it', () => {
    expect(snapToNearestBeat(2.4, grid, false)).toBeCloseTo(2.0)
  })
})

// ── 4: findSharedBoundaryNeighbor ─────────────────────────────────────────────

describe('findSharedBoundaryNeighbor', () => {
  const sections: ReactTrackSection[] = [
    makeSection({ id: 'a', startSec: 0,  endSec: 30,  source: 'auto' }),
    makeSection({ id: 'b', startSec: 30, endSec: 60,  source: 'auto' }),
    makeSection({ id: 'c', startSec: 60, endSec: 120, source: 'auto' }),
  ]

  it('finds the next section when dragging the end of section a', () => {
    const neighbor = findSharedBoundaryNeighbor(sections, 'a', 'end')
    expect(neighbor?.id).toBe('b')
  })

  it('finds the prev section when dragging the start of section b', () => {
    const neighbor = findSharedBoundaryNeighbor(sections, 'b', 'start')
    expect(neighbor?.id).toBe('a')
  })

  it('returns null when the end of the last section is dragged (no next)', () => {
    expect(findSharedBoundaryNeighbor(sections, 'c', 'end')).toBeNull()
  })

  it('returns null when the start of the first section is dragged (no prev)', () => {
    expect(findSharedBoundaryNeighbor(sections, 'a', 'start')).toBeNull()
  })

  it('returns null when adjacent section boundary does not match within tolerance', () => {
    const gapped: ReactTrackSection[] = [
      makeSection({ id: 'x', startSec: 0,  endSec: 30 }),
      makeSection({ id: 'y', startSec: 35, endSec: 60 }),  // 5s gap
    ]
    expect(findSharedBoundaryNeighbor(gapped, 'x', 'end')).toBeNull()
  })

  it('finds neighbor when gap is within tolerance (default 50 ms)', () => {
    const nearlyAdjacent: ReactTrackSection[] = [
      makeSection({ id: 'p', startSec: 0,    endSec: 30 }),
      makeSection({ id: 'q', startSec: 30.03, endSec: 60 }),  // 30ms gap, within 50ms tolerance
    ]
    expect(findSharedBoundaryNeighbor(nearlyAdjacent, 'p', 'end')?.id).toBe('q')
  })

  it('returns null for unknown section id', () => {
    expect(findSharedBoundaryNeighbor(sections, 'zzz', 'end')).toBeNull()
  })

  it('non-adjacent user-created overlay sections are not treated as neighbors', () => {
    const withOverlay: ReactTrackSection[] = [
      makeSection({ id: 'a', startSec: 0, endSec: 30 }),
      makeSection({ id: 'overlay', startSec: 10, endSec: 20, source: 'user-created' }),
    ]
    // Section 'a' end = 30, overlay start = 10: not adjacent → null
    expect(findSharedBoundaryNeighbor(withOverlay, 'a', 'end')).toBeNull()
  })
})

// ── 5: clampEdge ─────────────────────────────────────────────────────────────

describe('clampEdge — start', () => {
  const original = { startSec: 10, endSec: 50 }

  it('start cannot exceed end minus minDuration', () => {
    const result = clampEdge('start', 49, original, 1, 120)
    expect(result).toBeCloseTo(49)
    // At exactly endSec - minDuration
    const atBoundary = clampEdge('start', 50, original, 1, 120)
    expect(atBoundary).toBeCloseTo(49)  // clamped to endSec - minDuration
  })

  it('start cannot go below 0', () => {
    expect(clampEdge('start', -5, original, 1, 120)).toBe(0)
  })

  it('allows start to move freely within valid range', () => {
    expect(clampEdge('start', 25, original, 1, 120)).toBeCloseTo(25)
  })
})

describe('clampEdge — end', () => {
  const original = { startSec: 10, endSec: 50 }

  it('end cannot be less than start plus minDuration', () => {
    const result = clampEdge('end', 10, original, 1, 120)
    expect(result).toBeCloseTo(11)  // clamped to startSec + minDuration
  })

  it('end cannot exceed trackDuration', () => {
    expect(clampEdge('end', 200, original, 1, 120)).toBe(120)
  })

  it('allows end to move freely within valid range', () => {
    expect(clampEdge('end', 80, original, 1, 120)).toBeCloseTo(80)
  })
})

// ── 6: computeKeyStep ─────────────────────────────────────────────────────────

describe('computeKeyStep', () => {
  it('returns 0.1 s when no BPM', () => {
    expect(computeKeyStep(null, false)).toBeCloseTo(0.1)
    expect(computeKeyStep(undefined, false)).toBeCloseTo(0.1)
  })

  it('returns one beat at 120 BPM (0.5 s)', () => {
    expect(computeKeyStep(120, false)).toBeCloseTo(0.5)
  })

  it('multiplies by 4 when shift is held', () => {
    expect(computeKeyStep(120, true)).toBeCloseTo(2.0)
    expect(computeKeyStep(null, true)).toBeCloseTo(0.4)
  })
})

// ── 7: minimum section duration invariants ────────────────────────────────────

describe('clampEdge — minimum duration policy', () => {
  it('0.1 s: start cannot reach end', () => {
    const orig = { startSec: 0, endSec: 0.2 }
    const clamped = clampEdge('start', 0.19, orig, 0.1, 10)
    expect(clamped).toBeCloseTo(0.1)
  })

  it('beat-aware: section cannot become shorter than one beat', () => {
    // BPM=120, one beat = 0.5s. Section 0–10. Drag start to 9.8 → clamped to 9.5.
    const orig  = { startSec: 0, endSec: 10 }
    const minDur = computeMinDuration(120)  // 0.5 s
    const clamped = clampEdge('start', 9.8, orig, minDur, 30)
    expect(clamped).toBeCloseTo(9.5)
  })

  it('end stays within track duration', () => {
    const orig = { startSec: 100, endSec: 110 }
    expect(clampEdge('end', 200, orig, 0.1, 120)).toBe(120)
  })
})

// ── 8: ADJACENCY_TOLERANCE_SEC exported constant ──────────────────────────────

describe('ADJACENCY_TOLERANCE_SEC', () => {
  it('is exported and positive', () => {
    expect(ADJACENCY_TOLERANCE_SEC).toBeGreaterThan(0)
  })

  it('custom tolerance can be passed to findSharedBoundaryNeighbor', () => {
    const sections: ReactTrackSection[] = [
      makeSection({ id: 'a', startSec: 0, endSec: 30 }),
      makeSection({ id: 'b', startSec: 30.1, endSec: 60 }),  // 0.1s gap
    ]
    // With 0.05s tolerance: not neighbors
    expect(findSharedBoundaryNeighbor(sections, 'a', 'end', 0.05)).toBeNull()
    // With 0.2s tolerance: neighbors
    expect(findSharedBoundaryNeighbor(sections, 'a', 'end', 0.2)?.id).toBe('b')
  })
})


// ── Patch 4: explicit snap modes and alternatives ─────────────────────────────

describe('snapBoundaryTime', () => {
  const grid: BeatMarkerMI[] = Array.from({ length: 20 }, (_, beatIndex) => ({
    timeSec: beatIndex * 0.5,
    confidence: 1,
    isDownbeat: beatIndex % 4 === 0,
    beatIndex,
    beatWithinBar: beatIndex % 4,
    barIndex: Math.floor(beatIndex / 4),
  }))

  it('snaps to the nearest beat', () => {
    expect(snapBoundaryTime(1.14, grid, 'beat')).toBeCloseTo(1)
  })

  it('snaps to the nearest downbeat', () => {
    expect(snapBoundaryTime(2.31, grid, 'downbeat')).toBeCloseTo(2)
  })

  it('snaps bar mode to the resolved bar grid', () => {
    expect(snapBoundaryTime(3.71, grid, 'bar')).toBeCloseTo(4)
  })

  it('snaps to the nearest four-bar position', () => {
    expect(snapBoundaryTime(6.9, grid, 'four-bar')).toBeCloseTo(8)
  })

  it('preserves the exact value in free mode or while Alt is held', () => {
    expect(snapBoundaryTime(3.713, grid, 'free')).toBeCloseTo(3.713)
    expect(snapBoundaryTime(3.713, grid, 'bar', true)).toBeCloseTo(3.713)
  })
})

describe('navigateBoundaryAlternative', () => {
  const alternatives: BoundaryAlternative[] = [
    { id: 'a', timeSec: 8, barIndex: 4, confidence: 0.6, rank: 2, reason: 'A', supportingSignals: [], source: 'bar_self_similarity' },
    { id: 'b', timeSec: 16, barIndex: 8, confidence: 0.8, rank: 1, reason: 'B', supportingSignals: [], source: 'bar_self_similarity' },
    { id: 'c', timeSec: 24, barIndex: 12, confidence: 0.5, rank: 3, reason: 'C', supportingSignals: [], source: 'bar_self_similarity' },
  ]

  it('moves to the previous or next suggestion in timeline order', () => {
    expect(navigateBoundaryAlternative(16, alternatives, 'previous')?.id).toBe('a')
    expect(navigateBoundaryAlternative(16, alternatives, 'next')?.id).toBe('c')
  })

  it('returns null when no suggestion exists in that direction', () => {
    expect(navigateBoundaryAlternative(8, alternatives, 'previous')).toBeNull()
    expect(navigateBoundaryAlternative(24, alternatives, 'next')).toBeNull()
  })
})

describe('clampEdgeAgainstTimeline', () => {
  const sections = [
    makeSection({ id: 'a', startSec: 0, endSec: 10 }),
    makeSection({ id: 'b', startSec: 10, endSec: 20 }),
    makeSection({ id: 'c', startSec: 20, endSec: 30 }),
  ]

  it('prevents snapped starts and ends from overlapping neighboring sections', () => {
    expect(clampEdgeAgainstTimeline('start', 5, sections[1], sections, 1, 30)).toBe(10)
    expect(clampEdgeAgainstTimeline('end', 25, sections[1], sections, 1, 30)).toBe(20)
  })

  it('still enforces a positive minimum section duration', () => {
    expect(clampEdgeAgainstTimeline('start', 19.8, sections[1], sections, 1, 30)).toBe(19)
    expect(clampEdgeAgainstTimeline('end', 10.2, sections[1], sections, 1, 30)).toBe(11)
  })
})
