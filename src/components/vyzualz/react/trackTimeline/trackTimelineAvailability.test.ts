import { describe, expect, it } from 'vitest'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformEntry } from '../../../../features/waveform/rgbWaveformStorage'
import { resolveTrackTimelineAvailability } from './trackTimelineAvailability'

const analysis = {} as TrackIntelligenceAnalysis
const waveformEntry: RgbWaveformEntry = {
  status: 'complete',
  analysis: {
    version: 1,
    durationSec: 1,
    sampleRate: 48_000,
    binCount: 1,
    positivePeaks: new Float32Array([0.5]),
    negativePeaks: new Float32Array([-0.5]),
    rms: new Float32Array([0.4]),
    lowEnergy: new Float32Array([0.3]),
    midEnergy: new Float32Array([0.2]),
    highEnergy: new Float32Array([0.1]),
  },
  error: null,
}

describe('resolveTrackTimelineAvailability', () => {
  it('is disabled when there is no loaded track', () => {
    expect(resolveTrackTimelineAvailability({
      hasTrack: false,
      analysisStatus: 'not_analyzed',
      analysis: null,
      waveformEntry: undefined,
    })).toMatchObject({ state: 'empty', enabled: false })
  })

  it('remains disabled and reports progress while analysis is running', () => {
    expect(resolveTrackTimelineAvailability({
      hasTrack: true,
      analysisStatus: 'analyzing',
      analysis: null,
      waveformEntry: { status: 'queued', analysis: null, error: null },
      progress: 0.42,
    })).toEqual({
      state: 'analyzing',
      enabled: false,
      title: 'Track Timeline · Analyzing 42%',
    })
  })

  it('waits for the RGB waveform after track intelligence completes', () => {
    expect(resolveTrackTimelineAvailability({
      hasTrack: true,
      analysisStatus: 'complete',
      analysis,
      waveformEntry: { status: 'analyzing', analysis: null, error: null },
    })).toMatchObject({ state: 'analyzing', enabled: false })
  })

  it('enables the timeline only when both analyses are complete', () => {
    expect(resolveTrackTimelineAvailability({
      hasTrack: true,
      analysisStatus: 'complete',
      analysis,
      waveformEntry,
    })).toEqual({
      state: 'ready',
      enabled: true,
      title: 'Open Track Timeline Visualizer',
    })
  })

  it('surfaces either analysis failure as a disabled error state', () => {
    expect(resolveTrackTimelineAvailability({
      hasTrack: true,
      analysisStatus: 'complete',
      analysis,
      waveformEntry: { status: 'error', analysis: null, error: 'waveform failed' },
    })).toMatchObject({ state: 'error', enabled: false })
  })
})
