import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'

export interface BeatMarker {
  timeMs: number
  confidence: number
}

export interface TrackSection {
  id: string
  label: string
  type: ReactSectionType
  startMs: number
  endMs: number
  intensity: number
}

export interface TrackAnalysis {
  durationMs: number
  bpm: number
  timeSignature: number
  sections: TrackSection[]
  beatMarkers: BeatMarker[]
  analysisVersion: string
}
