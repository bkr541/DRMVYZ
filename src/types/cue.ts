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
  /** Track that owns a manually-authored cue. Omitted legacy cues remain session-global. */
  trackId?: string
  /** Zero-based index in the effective beat grid nearest to this cue. */
  beatIndex?: number
  /** Zero-based bar index derived from the effective beat grid. */
  barIndex?: number
  /** Zero-based beat position inside the bar. */
  beatInBar?: number
  /** Exact pointer-derived timestamp before optional beat snapping. */
  authoredTime?: number
  /** Exact timestamp of the associated beat marker. */
  beatTime?: number
  /** Signed cue offset from beatTime in seconds. */
  beatOffsetSec?: number
  /** Whether the authored cue was explicitly snapped onto beatTime. */
  snappedToBeat?: boolean
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


/** Legacy markers without trackId remain visible; authored markers stay with their track. */
export function cueMarkerBelongsToTrack(
  marker: Pick<VzCueMarker, 'trackId'>,
  trackId: string | null | undefined,
): boolean {
  return marker.trackId == null || marker.trackId === trackId
}
