import type { TrackAnalysis, TrackSection } from './types'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'

/**
 * Converts a TrackAnalysis into the ReactTrackSection[] format
 * expected by the React store and section automation resolver.
 */
export function adaptTrackSections(analysis: TrackAnalysis): ReactTrackSection[] {
  return analysis.sections.map((sec: TrackSection): ReactTrackSection => ({
    id:        sec.id,
    label:     sec.label,
    type:      sec.type,
    startSec:  sec.startMs / 1000,
    endSec:    sec.endMs   / 1000,
    intensity: sec.intensity,
  }))
}

/**
 * Returns the BPM from a TrackAnalysis, or 120 if not available.
 */
export function extractBpm(analysis: TrackAnalysis): number {
  return analysis.bpm > 0 ? analysis.bpm : 120
}
