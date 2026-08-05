import type { TrackAnalysisStatus, TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { RgbWaveformEntry } from '../../../../features/waveform/rgbWaveformStorage'

export type TrackTimelineAvailabilityState = 'empty' | 'analyzing' | 'ready' | 'error'

export interface TrackTimelineAvailability {
  state: TrackTimelineAvailabilityState
  enabled: boolean
  title: string
}

export function resolveTrackTimelineAvailability(input: {
  hasTrack: boolean
  analysisStatus: TrackAnalysisStatus
  analysis: TrackIntelligenceAnalysis | null
  waveformEntry: RgbWaveformEntry | undefined
  progress?: number | null
}): TrackTimelineAvailability {
  if (!input.hasTrack) {
    return {
      state: 'empty',
      enabled: false,
      title: 'Track Timeline · Load an audio track',
    }
  }

  if (input.analysisStatus === 'failed' || input.waveformEntry?.status === 'error') {
    return {
      state: 'error',
      enabled: false,
      title: 'Track Timeline · Audio analysis is unavailable',
    }
  }

  const ready = input.analysisStatus === 'complete'
    && input.analysis != null
    && input.waveformEntry?.status === 'complete'
    && input.waveformEntry.analysis != null
    && input.waveformEntry.analysis.binCount > 0

  if (ready) {
    return {
      state: 'ready',
      enabled: true,
      title: 'Open Track Timeline Visualizer',
    }
  }

  const progress = Math.round(Math.max(0, Math.min(1, input.progress ?? 0)) * 100)
  return {
    state: 'analyzing',
    enabled: false,
    title: progress > 0
      ? `Track Timeline · Analyzing ${progress}%`
      : 'Track Timeline · Analyzing audio intelligence',
  }
}
