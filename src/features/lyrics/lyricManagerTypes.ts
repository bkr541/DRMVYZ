import type { SavedAudioTrack } from '../../stores/audioStore'
import type { LyricDocument } from '../../types/lyrics'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'

export interface LyricDocumentVersion extends LyricDocument {
  cueCount: number
  language: string | null
  documentReviewStatus: string | null
}

export interface LyricManagerTrack extends SavedAudioTrack {
  lyricVersionCount: number
  activeLyricDocumentId: string | null
  activeLyricDocumentName: string | null
  needsReview?: boolean
  /** Hydrated full MI analysis, when available from track_analyses.analysis_payload. */
  analysisPayload?: TrackIntelligenceAnalysis | null
  /** Stored waveform peaks (track_analyses.waveform_peaks) so the timeline can draw an unloaded track. */
  waveformPeaks?: number[] | null
}

export interface LyricManagerTrackPage {
  tracks: LyricManagerTrack[]
  total: number
}
