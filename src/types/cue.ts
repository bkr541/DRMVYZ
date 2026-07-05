export type VzCueSource = 'manual' | 'rekordbox' | 'analysis'

export type VzCueKind = 'hot_cue' | 'memory_cue' | 'loop' | 'marker' | 'automation'

export interface VzCueMarker {
  id: string
  label: string
  time: number
  type: 'intro' | 'verse' | 'build' | 'drop' | 'break' | 'outro' | 'custom'
  color?: string
  /** Optional source metadata for imported cue points. Omitted on legacy/manual markers. */
  source?: VzCueSource
  /** Rekordbox hot cues, memory cues, loops, etc. */
  kind?: VzCueKind
  /** Stable source-side identifier when available, such as Rekordbox TrackID + hot-cue slot. */
  externalId?: string
  /** Optional end time for loop-like markers. Prefer VzCueRegion for rendered regions. */
  endTime?: number
}

export interface VzCueRegion {
  id: string
  label: string
  startTime: number
  endTime: number
  type: 'loop' | 'phrase' | 'build' | 'drop' | 'break' | 'custom'
  color?: string
  source?: VzCueSource
  externalId?: string
}
