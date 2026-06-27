import { describe, it, expect } from 'vitest'
import {
  computeWaveformViewport,
  normalizeViewport,
  timeToViewportRatio,
  viewportRatioToTime,
  zoomViewportAroundTime,
  panViewport,
  intersectTimeRange,
  computeViewportRangeLayout,
  isFinitePositiveDuration,
  resolvePositiveDuration,
  DEFAULT_TIMELINE_DURATION_SEC,
  MIN_VIEWPORT_SEC,
  type TimelineViewport,
} from '../timelineViewport'


// ── duration validation ───────────────────────────────────────────────────────

describe('duration validation', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid duration %s',
    value => {
      expect(isFinitePositiveDuration(value)).toBe(false)
      expect(resolvePositiveDuration(value)).toBe(DEFAULT_TIMELINE_DURATION_SEC)
    },
  )

  it('accepts finite positive durations and validates the fallback too', () => {
    expect(isFinitePositiveDuration(0.001)).toBe(true)
    expect(resolvePositiveDuration(245.5)).toBe(245.5)
    expect(resolvePositiveDuration(Number.NaN, -10)).toBe(MIN_VIEWPORT_SEC)
  })

  it.each([0, -12, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'keeps viewport output finite and positive for duration %s',
    duration => {
      const vp = computeWaveformViewport(duration, 30, 4)
      expect(Number.isFinite(vp.startSec)).toBe(true)
      expect(Number.isFinite(vp.endSec)).toBe(true)
      expect(vp.endSec).toBeGreaterThan(vp.startSec)
    },
  )
})

// ── computeWaveformViewport ───────────────────────────────────────────────────

describe('computeWaveformViewport', () => {
  it('returns full range when zoom is 1', () => {
    const vp = computeWaveformViewport(180, 90, 1)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBe(180)
  })

  it('centers the window on the playhead at 2x zoom', () => {
    const vp = computeWaveformViewport(180, 90, 2)
    expect(vp.startSec).toBeCloseTo(45)
    expect(vp.endSec).toBeCloseTo(135)
  })

  it('clamps to track start when playhead is near the beginning', () => {
    const vp = computeWaveformViewport(180, 5, 4)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBeCloseTo(45)
  })

  it('clamps to track end when playhead is near the end', () => {
    const vp = computeWaveformViewport(180, 175, 4)
    expect(vp.endSec).toBeCloseTo(180)
    expect(vp.startSec).toBeCloseTo(135)
  })

  it('returns safe default when duration is 0', () => {
    const vp = computeWaveformViewport(0, 0, 2)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBeGreaterThan(0)
  })

  it('treats zoom < 1 as zoom = 1 (full range)', () => {
    const vp = computeWaveformViewport(180, 90, 0.5)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBe(180)
  })

  it('treats non-finite zoom as zoom = 1', () => {
    const vp = computeWaveformViewport(180, 90, NaN)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBe(180)
  })

  it('window width equals duration / zoom', () => {
    const vp = computeWaveformViewport(160, 80, 4)
    expect(vp.endSec - vp.startSec).toBeCloseTo(40)
  })

  it('handles playhead exactly at track start', () => {
    const vp = computeWaveformViewport(120, 0, 2)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBeCloseTo(60)
  })

  it('handles playhead exactly at track end', () => {
    const vp = computeWaveformViewport(120, 120, 2)
    expect(vp.endSec).toBeCloseTo(120)
    expect(vp.startSec).toBeCloseTo(60)
  })
})

// ── normalizeViewport ─────────────────────────────────────────────────────────

describe('normalizeViewport', () => {
  const dur = 180

  it('leaves a valid viewport unchanged', () => {
    const vp = normalizeViewport({ startSec: 10, endSec: 50 }, dur)
    expect(vp.startSec).toBe(10)
    expect(vp.endSec).toBe(50)
  })

  it('clamps start below 0 to 0', () => {
    const vp = normalizeViewport({ startSec: -10, endSec: 30 }, dur)
    expect(vp.startSec).toBe(0)
    expect(vp.endSec).toBe(30)
  })

  it('clamps end above duration to duration', () => {
    const vp = normalizeViewport({ startSec: 150, endSec: 200 }, dur)
    expect(vp.endSec).toBe(180)
  })

  it('enforces minimum window size when range is too small', () => {
    const vp = normalizeViewport({ startSec: 10, endSec: 10.1 }, dur)
    expect(vp.endSec - vp.startSec).toBeGreaterThanOrEqual(MIN_VIEWPORT_SEC)
  })

  it('centers the enforced minimum around the original center', () => {
    const vp = normalizeViewport({ startSec: 90, endSec: 90.1 }, dur)
    expect((vp.startSec + vp.endSec) / 2).toBeCloseTo(90.05, 1)
  })
})

// ── timeToViewportRatio ───────────────────────────────────────────────────────

describe('timeToViewportRatio', () => {
  const vp: TimelineViewport = { startSec: 60, endSec: 120 }

  it('returns 0 at viewport start', () => {
    expect(timeToViewportRatio(60, vp)).toBeCloseTo(0)
  })

  it('returns 1 at viewport end', () => {
    expect(timeToViewportRatio(120, vp)).toBeCloseTo(1)
  })

  it('returns 0.5 at viewport center', () => {
    expect(timeToViewportRatio(90, vp)).toBeCloseTo(0.5)
  })

  it('returns negative value for time before viewport start', () => {
    expect(timeToViewportRatio(30, vp)).toBeLessThan(0)
  })

  it('returns value greater than 1 for time after viewport end', () => {
    expect(timeToViewportRatio(150, vp)).toBeGreaterThan(1)
  })

  it('returns 0 when viewport has zero duration', () => {
    expect(timeToViewportRatio(60, { startSec: 60, endSec: 60 })).toBe(0)
  })
})

// ── viewportRatioToTime ───────────────────────────────────────────────────────

describe('viewportRatioToTime', () => {
  const vp: TimelineViewport = { startSec: 60, endSec: 120 }

  it('maps ratio 0 to viewport start', () => {
    expect(viewportRatioToTime(0, vp)).toBeCloseTo(60)
  })

  it('maps ratio 1 to viewport end', () => {
    expect(viewportRatioToTime(1, vp)).toBeCloseTo(120)
  })

  it('maps ratio 0.5 to viewport center', () => {
    expect(viewportRatioToTime(0.5, vp)).toBeCloseTo(90)
  })

  it('is the inverse of timeToViewportRatio', () => {
    const time = 85
    expect(viewportRatioToTime(timeToViewportRatio(time, vp), vp)).toBeCloseTo(time)
  })
})

// ── zoomViewportAroundTime ────────────────────────────────────────────────────

describe('zoomViewportAroundTime', () => {
  const vp: TimelineViewport = { startSec: 0, endSec: 180 }
  const dur = 180

  it('zooms in 2x from center, preserving anchor position', () => {
    const zoomed = zoomViewportAroundTime(vp, 90, 2, dur)
    expect(zoomed.endSec - zoomed.startSec).toBeCloseTo(90)
    expect(timeToViewportRatio(90, zoomed)).toBeCloseTo(0.5)
  })

  it('zooms in from left edge, clamping result to 0', () => {
    const zoomed = zoomViewportAroundTime(vp, 0, 2, dur)
    expect(zoomed.startSec).toBe(0)
    expect(zoomed.endSec).toBeCloseTo(90)
  })

  it('zooms in from right edge, clamping result to duration', () => {
    const zoomed = zoomViewportAroundTime(vp, 180, 2, dur)
    expect(zoomed.endSec).toBe(180)
    expect(zoomed.startSec).toBeCloseTo(90)
  })

  it('respects the minimum duration floor', () => {
    const small: TimelineViewport = { startSec: 89, endSec: 91 }
    const zoomed = zoomViewportAroundTime(small, 90, 100, dur, 1)
    expect(zoomed.endSec - zoomed.startSec).toBeGreaterThanOrEqual(1)
  })

  it('factor = 1 leaves the viewport unchanged', () => {
    const zoomed = zoomViewportAroundTime({ startSec: 30, endSec: 90 }, 60, 1, dur)
    expect(zoomed.startSec).toBeCloseTo(30)
    expect(zoomed.endSec).toBeCloseTo(90)
  })
})

// ── panViewport ───────────────────────────────────────────────────────────────

describe('panViewport', () => {
  const vp: TimelineViewport = { startSec: 60, endSec: 120 }
  const dur = 180

  it('shifts viewport forward by delta', () => {
    const panned = panViewport(vp, 10, dur)
    expect(panned.startSec).toBeCloseTo(70)
    expect(panned.endSec).toBeCloseTo(130)
  })

  it('shifts viewport backward by delta', () => {
    const panned = panViewport(vp, -10, dur)
    expect(panned.startSec).toBeCloseTo(50)
    expect(panned.endSec).toBeCloseTo(110)
  })

  it('preserves window size after panning', () => {
    const dur2 = 60  // window size
    const panned = panViewport(vp, 10, dur)
    expect(panned.endSec - panned.startSec).toBeCloseTo(dur2)
  })

  it('clamps at track start and preserves window size', () => {
    const panned = panViewport(vp, -100, dur)
    expect(panned.startSec).toBe(0)
    expect(panned.endSec).toBeCloseTo(60)
  })

  it('clamps at track end and preserves window size', () => {
    const panned = panViewport(vp, 100, dur)
    expect(panned.endSec).toBe(180)
    expect(panned.startSec).toBeCloseTo(120)
  })
})

// ── intersectTimeRange ────────────────────────────────────────────────────────

describe('intersectTimeRange', () => {
  const vp: TimelineViewport = { startSec: 60, endSec: 120 }

  it('returns the full range when entirely inside viewport', () => {
    const r = intersectTimeRange({ startSec: 70, endSec: 100 }, vp)
    expect(r).not.toBeNull()
    expect(r!.visibleStart).toBeCloseTo(70)
    expect(r!.visibleEnd).toBeCloseTo(100)
  })

  it('clips a range that starts before the viewport', () => {
    const r = intersectTimeRange({ startSec: 30, endSec: 90 }, vp)
    expect(r).not.toBeNull()
    expect(r!.visibleStart).toBeCloseTo(60)
    expect(r!.visibleEnd).toBeCloseTo(90)
  })

  it('clips a range that extends past the viewport end', () => {
    const r = intersectTimeRange({ startSec: 90, endSec: 150 }, vp)
    expect(r).not.toBeNull()
    expect(r!.visibleStart).toBeCloseTo(90)
    expect(r!.visibleEnd).toBeCloseTo(120)
  })

  it('returns null when range ends before viewport start', () => {
    expect(intersectTimeRange({ startSec: 10, endSec: 50 }, vp)).toBeNull()
  })

  it('returns null when range starts after viewport end', () => {
    expect(intersectTimeRange({ startSec: 130, endSec: 160 }, vp)).toBeNull()
  })

  it('clips both edges for a range spanning the entire viewport', () => {
    const r = intersectTimeRange({ startSec: 0, endSec: 180 }, vp)
    expect(r).not.toBeNull()
    expect(r!.visibleStart).toBeCloseTo(60)
    expect(r!.visibleEnd).toBeCloseTo(120)
  })

  it('returns null for a zero-duration range at the viewport boundary', () => {
    expect(intersectTimeRange({ startSec: 60, endSec: 60 }, vp)).toBeNull()
  })
})


// ── computeViewportRangeLayout ────────────────────────────────────────────────

describe('computeViewportRangeLayout', () => {
  const vp: TimelineViewport = { startSec: 60, endSec: 120 }

  it('clips a range to the current viewport without changing authored times', () => {
    const range = { startSec: 30, endSec: 90 }
    const snapshot = { ...range }
    const layout = computeViewportRangeLayout(range, vp)

    expect(layout.visible).toBe(true)
    expect(layout.leftPct).toBeCloseTo(0)
    expect(layout.widthPct).toBeCloseTo(50)
    expect(layout.startEdgeVisible).toBe(false)
    expect(layout.endEdgeVisible).toBe(true)
    expect(range).toEqual(snapshot)
  })

  it('marks off-screen and invalid ranges as hidden with finite geometry', () => {
    for (const range of [
      { startSec: 0, endSec: 30 },
      { startSec: 130, endSec: 160 },
      { startSec: Number.NaN, endSec: 80 },
      { startSec: 80, endSec: Number.POSITIVE_INFINITY },
    ]) {
      const layout = computeViewportRangeLayout(range, vp)
      expect(layout.visible).toBe(false)
      expect(Number.isFinite(layout.leftPct)).toBe(true)
      expect(Number.isFinite(layout.widthPct)).toBe(true)
    }
  })
})
