import { describe, expect, it } from 'vitest'
import {
  buildWaveformCueRequest,
  formatCueBeatReference,
  resolveNearestCueBeat,
  waveformClientXToTime,
} from './waveformCuePoint'
import type { BeatMarkerMI } from '../musicIntelligence/types'

const GRID: BeatMarkerMI[] = Array.from({ length: 12 }, (_, index) => ({
  timeSec: index * 0.5,
  confidence: 1,
  isDownbeat: index % 4 === 0,
}))

describe('waveform cue point helpers', () => {
  it('maps client X through the visible waveform viewport', () => {
    expect(waveformClientXToTime(
      300,
      { left: 100, width: 400 },
      { startSec: 30, endSec: 90 },
      120,
    )).toBe(60)
  })

  it('clamps pointer positions to the track duration', () => {
    expect(waveformClientXToTime(
      900,
      { left: 100, width: 400 },
      { startSec: 80, endSec: 120 },
      120,
    )).toBe(120)
  })

  it('resolves the nearest beat with zero-based beat and bar metadata', () => {
    const beat = resolveNearestCueBeat(GRID, 2.08)
    expect(beat).toMatchObject({
      beatIndex: 4,
      barIndex: 1,
      beatInBar: 0,
      beatTimeSec: 2,
      isDownbeat: true,
    })
    expect(beat?.offsetSec).toBeCloseTo(0.08)
    expect(formatCueBeatReference(beat)).toBe('Bar 2 · Beat 1')
  })

  it('preserves the exact authored timestamp when snap is off', () => {
    const request = buildWaveformCueRequest(2.08, GRID, false)
    expect(request.timeSec).toBe(2.08)
    expect(request.authoredTimeSec).toBe(2.08)
    expect(request.snappedToBeat).toBe(false)
    expect(request.beat?.beatTimeSec).toBe(2)
    expect(request.beat?.offsetSec).toBeCloseTo(0.08)
  })

  it('moves the cue onto the nearest beat and zeroes the stored offset when snap is on', () => {
    const request = buildWaveformCueRequest(2.08, GRID, true)
    expect(request.timeSec).toBe(2)
    expect(request.authoredTimeSec).toBe(2.08)
    expect(request.snappedToBeat).toBe(true)
    expect(request.beat?.offsetSec).toBe(0)
  })

  it('falls back to 4/4 indexing when a partial grid has no downbeats', () => {
    const beat = resolveNearestCueBeat(
      GRID.slice(0, 7).map(marker => ({ ...marker, isDownbeat: false })),
      2.45,
    )
    expect(beat).toMatchObject({ beatIndex: 5, barIndex: 1, beatInBar: 1 })
  })
})
