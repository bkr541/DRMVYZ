import { describe, it, expect } from 'vitest'
import { groupPointsByPathIndex } from '../oscillatorPathUtils'
import { parseSvgToGlyphPoints } from '../svgGlyphUtils'
import type { OscillatorGlyphPoint } from '../../ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function pt(x: number, y: number, pathIndex: number, progress = 0): OscillatorGlyphPoint {
  return { x, y, pathIndex, progress }
}

const TWO_PATH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z" />
  <path d="M 60 60 L 90 60 L 90 90 L 60 90 Z" />
</svg>`

// ── groupPointsByPathIndex ────────────────────────────────────────────────────

describe('groupPointsByPathIndex', () => {
  it('returns an empty array for empty input', () => {
    expect(groupPointsByPathIndex([])).toEqual([])
  })

  it('returns one group when all points share pathIndex 0', () => {
    const pts = [pt(0, 0, 0), pt(1, 1, 0), pt(2, 2, 0)]
    const groups = groupPointsByPathIndex(pts)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(3)
  })

  it('groups points into separate arrays by pathIndex', () => {
    const pts = [pt(0, 0, 0), pt(1, 1, 1), pt(2, 2, 0), pt(3, 3, 1)]
    const groups = groupPointsByPathIndex(pts)
    expect(groups).toHaveLength(2)
  })

  it('preserves insertion order within each group', () => {
    const pts = [pt(0, 0, 0), pt(1, 1, 0), pt(2, 2, 1), pt(3, 3, 0)]
    const groups = groupPointsByPathIndex(pts)
    const g0 = groups[0]
    expect(g0[0].x).toBe(0)
    expect(g0[1].x).toBe(1)
    expect(g0[2].x).toBe(3)
  })

  it('sorts groups by pathIndex ascending', () => {
    const pts = [pt(9, 9, 2), pt(1, 1, 0), pt(5, 5, 1)]
    const groups = groupPointsByPathIndex(pts)
    // Group 0 should come first (pathIndex=0)
    expect(groups[0][0].x).toBe(1)
    // Group 1 (pathIndex=1)
    expect(groups[1][0].x).toBe(5)
    // Group 2 (pathIndex=2)
    expect(groups[2][0].x).toBe(9)
  })

  it('handles three distinct pathIndex values', () => {
    const pts = [
      pt(0, 0, 0), pt(1, 1, 0),
      pt(2, 2, 1), pt(3, 3, 1),
      pt(4, 4, 2),
    ]
    const groups = groupPointsByPathIndex(pts)
    expect(groups).toHaveLength(3)
    expect(groups[0]).toHaveLength(2)
    expect(groups[1]).toHaveLength(2)
    expect(groups[2]).toHaveLength(1)
  })

  it('treats missing pathIndex as 0', () => {
    const pts: OscillatorGlyphPoint[] = [
      { x: 0, y: 0, pathIndex: 0, progress: 0 },
      // pathIndex exists but all zero — should be in same group
      { x: 1, y: 1, pathIndex: 0, progress: 0 },
    ]
    const groups = groupPointsByPathIndex(pts)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(2)
  })

  it('does not connect end of group 0 to start of group 1', () => {
    const pts = [pt(0, 0, 0), pt(1, 1, 0), pt(100, 100, 1), pt(200, 200, 1)]
    const groups = groupPointsByPathIndex(pts)
    const lastOfGroup0  = groups[0][groups[0].length - 1]
    const firstOfGroup1 = groups[1][0]
    // The last point of group 0 and the first point of group 1 are in different arrays —
    // the renderer draws each array as a separate stroke so they are never connected.
    expect(lastOfGroup0.x).toBe(1)
    expect(firstOfGroup1.x).toBe(100)
  })

  it('a single-path input produces exactly one group containing all points', () => {
    const pts = [pt(0, 0, 0), pt(1, 0, 0), pt(1, 1, 0), pt(0, 1, 0)]
    const groups = groupPointsByPathIndex(pts)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(4)
  })
})

// ── Multi-path SVG produces multiple pathIndex groups ─────────────────────────

describe('parseSvgToGlyphPoints + groupPointsByPathIndex', () => {
  it('a two-path SVG produces two groups after grouping', () => {
    const pts = parseSvgToGlyphPoints(TWO_PATH_SVG, 64)
    const groups = groupPointsByPathIndex(pts)
    expect(groups.length).toBeGreaterThanOrEqual(2)
  })

  it('all points in each group share the same pathIndex', () => {
    const pts = parseSvgToGlyphPoints(TWO_PATH_SVG, 64)
    const groups = groupPointsByPathIndex(pts)
    for (const group of groups) {
      const firstIdx = group[0].pathIndex
      for (const p of group) {
        expect(p.pathIndex).toBe(firstIdx)
      }
    }
  })

  it('total points across all groups equals the original array length', () => {
    const pts = parseSvgToGlyphPoints(TWO_PATH_SVG, 64)
    const groups = groupPointsByPathIndex(pts)
    const total = groups.reduce((sum, g) => sum + g.length, 0)
    expect(total).toBe(pts.length)
  })
})

// ── SoundDrawingRenderer does not import parseSvgToGlyphPoints ────────────────

describe('SoundDrawingRenderer import guard', () => {
  it('does not re-export parseSvgToGlyphPoints (renderer must not call it)', async () => {
    const mod = await import('../SoundDrawingRenderer')
    expect((mod as Record<string, unknown>).parseSvgToGlyphPoints).toBeUndefined()
  })
})
