import type { SavedAudioTrack } from '../../stores/audioStore'
import type { LyricDocument } from '../../types/lyrics'

export interface LyricDocumentVersion extends LyricDocument {
  cueCount: number
  language: string | null
  documentReviewStatus: string | null
}

export interface LyricManagerTrack extends SavedAudioTrack {
  lyricVersionCount: number
  activeLyricDocumentId: string | null
  activeLyricDocumentName: string | null
}

export interface LyricManagerTrackPage {
  tracks: LyricManagerTrack[]
  total: number
}
