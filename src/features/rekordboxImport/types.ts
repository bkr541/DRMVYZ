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


export type RekordboxPhraseMood = 'high_energy' | 'mid_energy' | 'low_energy'
export type RekordboxPhraseBank = 'default' | 'cool' | 'natural' | 'hot' | 'subtle' | 'warm' | 'vivid' | 'club_1' | 'club_2'

/** Native Rekordbox PSSI song-structure record. Kept separate from DRMVYZ-native phrases/sections. */
export interface RekordboxPhrase {
  /** Zero-based phrase position after parsing. */
  phraseIndex: number
  /** Rekordbox's one-based source phrase index, when present. */
  sourceIndex?: number | null
  /** Raw Rekordbox track mood code. */
  sourceMood: number
  mood: RekordboxPhraseMood | null
  /** Raw Rekordbox phrase-kind code. */
  sourceKind: number
  /** Rekordbox phrase-kind enum label (for example verse_2 or chorus). */
  rekordboxKind: string | null
  /** Raw Rekordbox lighting-bank code. */
  sourceBank: number
  bank: RekordboxPhraseBank | null
  /** Human-readable label derived from Rekordbox's phrase-kind enum. */
  sourceLabel: string | null
  /** Coarser normalized label for future DRMVYZ mapping; not authoritative in Stage 1. */
  normalizedLabel: string | null
  /** One-based Rekordbox beat numbers. endBeat is an exclusive boundary. */
  startBeat: number
  endBeat: number | null
  /** Timestamps derived from PQTZ beat timings when available. */
  startTimeSec: number | null
  endTimeSec: number | null
  fillStartBeat: number | null
  fillStartTimeSec: number | null
  /** Raw/diagnostic PSSI flags retained so future stages do not need to reparse ANLZ. */
  sourceFlags: Record<string, boolean | number | string | null>
  sourcePayload: Record<string, unknown>
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
  /** Native Rekordbox PSSI phrases, deliberately not mapped into DRMVYZ analysisSeed yet. */
  rekordboxPhrases: RekordboxPhrase[]
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
