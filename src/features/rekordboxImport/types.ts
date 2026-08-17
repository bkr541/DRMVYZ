import type { TrackIntelligenceAnalysis, BeatMarkerMI, PhraseMarker, TrackSectionMI } from '../musicIntelligence/types'
import type { RekordboxFeatureAvailability, RekordboxImportSource, RekordboxPhrase } from './sourceTypes'
export type { RekordboxFeatureAvailability, RekordboxImportSource, RekordboxPhrase, RekordboxPhraseBank, RekordboxPhraseMood } from './sourceTypes'
import type { ExternalTrackMetadata } from '../../types'
import type { VzCueMarker, VzCueRegion } from '../../types/cue'

export interface RekordboxCuePoint {
  id: string
  trackId: string
  name: string | null
  startSec: number
  endSec?: number | null
  kind: 'hot_cue' | 'memory_cue' | 'loop' | 'marker'
  slot?: string | null
  color?: string | null
}

export interface RekordboxTrackMetadata {
  trackId: string
  name: string
  artist?: string | null
  album?: string | null
  genre?: string | null
  label?: string | null
  comments?: string | null
  rating?: number | null
  color?: string | null
  bpm?: number | null
  key?: string | null
  durationSec?: number | null
  location?: string | null
  filename?: string | null
  cues: RekordboxCuePoint[]
  phrases?: RekordboxPhrase[]
  beatGrid?: BeatMarkerMI[]
  downbeats?: BeatMarkerMI[]
  beatGridOffsetSec?: number | null
  analysisFilePaths?: string[]
}

export interface RekordboxLibrary {
  id: string
  source: RekordboxImportSource
  importedAt: string
  tracks: RekordboxTrackMetadata[]
  warnings: string[]
  stats: {
    totalTracks: number
    tracksWithCues: number
    cues: number
    loops: number
    detectedPdbFiles: number
    detectedAnlzFiles: number
    tracksWithBeatGrids?: number
    beatGridBeats?: number
  }
}

export interface RekordboxAnalysisSeed {
  /** Explicitly records that this seed came through the Rekordbox workflow. */
  source: RekordboxImportSource
  /** Source-feature availability stays independent from the values DRMVYZ may later derive natively. */
  featureAvailability?: RekordboxFeatureAvailability
  bpm?: number | null
  beatGridOffsetSec?: number | null
  beatGrid?: BeatMarkerMI[]
  downbeats?: BeatMarkerMI[]
  /** Native Rekordbox PSSI source data. Never treated as DRMVYZ phrase/section output in Stage 2. */
  rekordboxPhrases?: RekordboxPhrase[]
  phrases?: PhraseMarker[]
  sections?: TrackSectionMI[]
  key?: string | null
  keyConfidence?: number | null
}

export interface ImportedTrackIntelligence {
  source: RekordboxImportSource
  metadata: ExternalTrackMetadata
  cueMarkers: VzCueMarker[]
  cueRegions: VzCueRegion[]
  /** Native Rekordbox PSSI phrases retained for direct runtime diagnostics/backward compatibility. */
  rekordboxPhrases: RekordboxPhrase[]
  analysisSeed: RekordboxAnalysisSeed
  matchConfidence: number
  matchReason: string
  warnings: string[]
}

export type TrackAnalysisSeed = Pick<Partial<TrackIntelligenceAnalysis>, 'bpm' | 'bpmConfidence' | 'beatGridOffsetSec' | 'timeSignature' | 'beatGrid' | 'downbeats' | 'phrases' | 'sections'> & {
  source?: RekordboxImportSource | 'manual' | 'analysis'
  featureAvailability?: RekordboxFeatureAvailability
  rekordboxPhrases?: RekordboxPhrase[]
  key?: string | null
  keyConfidence?: number | null
}
