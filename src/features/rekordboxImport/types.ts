import type { TrackIntelligenceAnalysis, BeatMarkerMI, PhraseMarker, TrackSectionMI } from '../musicIntelligence/types'
import type { ExternalTrackMetadata } from '../../types'
import type { VzCueMarker, VzCueRegion } from '../../types/cue'

export type RekordboxImportSource = 'rekordbox_xml' | 'rekordbox_usb'

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
  }
}

export interface RekordboxAnalysisSeed {
  source: RekordboxImportSource
  bpm?: number | null
  beatGridOffsetSec?: number | null
  beatGrid?: BeatMarkerMI[]
  downbeats?: BeatMarkerMI[]
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
  analysisSeed: RekordboxAnalysisSeed
  matchConfidence: number
  matchReason: string
  warnings: string[]
}

export type TrackAnalysisSeed = Pick<Partial<TrackIntelligenceAnalysis>, 'bpm' | 'bpmConfidence' | 'beatGridOffsetSec' | 'timeSignature' | 'beatGrid' | 'downbeats' | 'phrases' | 'sections'> & {
  source?: RekordboxImportSource | 'manual' | 'analysis'
  key?: string | null
  keyConfidence?: number | null
}
