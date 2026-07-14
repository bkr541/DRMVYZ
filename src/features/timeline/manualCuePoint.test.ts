import { describe, expect, it } from 'vitest'
import type { VzCueMarker } from '../../types/cue'
import { buildManualCueMarker } from './manualCuePoint'
import { buildWaveformCueRequest } from './waveformCuePoint'
import type { BeatMarkerMI } from '../musicIntelligence/types'

const GRID: BeatMarkerMI[] = Array.from({ length: 8 }, (_, index) => ({
  timeSec: index * 0.5,
  confidence: 1,
  isDownbeat: index % 4 === 0,
}))

describe('buildManualCueMarker', () => {
  it('uses the next open cue number for the active track only', () => {
    const existing: VzCueMarker[] = [
      { id: 'one', label: 'CUE 1', time: 1, type: 'custom', source: 'manual', trackId: 'track-a' },
      { id: 'three', label: 'CUE 3', time: 3, type: 'custom', source: 'manual', trackId: 'track-a' },
      { id: 'other', label: 'CUE 2', time: 2, type: 'custom', source: 'manual', trackId: 'track-b' },
      { id: 'imported', label: 'CUE 2', time: 2, type: 'custom', source: 'rekordbox', trackId: 'track-a' },
    ]

    const marker = buildManualCueMarker(buildWaveformCueRequest(2.2, GRID, false), existing, 'track-a')

    expect(marker.label).toBe('CUE 2')
    expect(marker.trackId).toBe('track-a')
    expect(marker.source).toBe('manual')
  })

  it('preserves authored time and stores snapped beat metadata', () => {
    const marker = buildManualCueMarker(buildWaveformCueRequest(2.08, GRID, true), [], 'track-a')

    expect(marker).toMatchObject({
      time: 2,
      authoredTime: 2.08,
      beatIndex: 4,
      barIndex: 1,
      beatInBar: 0,
      beatTime: 2,
      beatOffsetSec: 0,
      snappedToBeat: true,
      kind: 'memory_cue',
    })
  })
})
