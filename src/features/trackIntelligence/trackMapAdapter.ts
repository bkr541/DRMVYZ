import type { TrackAnalysis, TrackSection } from './types'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import { resolveAuthoritativeTimeline } from './authoritativeTimeline'

/**
 * Converts a TrackAnalysis (mock/legacy) into the ReactTrackSection[] format
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
    source:    'mock',
  }))
}

/**
 * Converts a real TrackIntelligenceAnalysis (from offlineTrackAnalyzer) into
 * ReactTrackSection[], tagged source: 'auto' for preservation logic.
 */
export function adaptMIAnalysis(analysis: TrackIntelligenceAnalysis): ReactTrackSection[] {
  return analysis.sections.map(sec => {
    const authority = sec.source === 'rekordbox'
      ? 'imported' as const
      : sec.source === 'manual' || sec.locked
        ? 'locked_user' as const
        : 'automatic' as const
    const source = authority === 'locked_user'
      ? 'manual' as const
      : authority === 'imported'
        ? 'imported' as const
        : 'auto' as const
    return {
      id:         sec.id,
      label:      sec.label,
      type:       sec.type,
      startSec:   sec.startSec,
      endSec:     sec.endSec,
      intensity:  sec.intensity,
      confidence: sec.confidence,
      boundaryConfidence: sec.boundaryConfidence,
      labelConfidence: sec.labelConfidence,
      gridConfidence: sec.gridConfidence,
      analysisConfidence: sec.analysisConfidence,
      dropConfidence: sec.dropConfidence,
      interpretation: sec.interpretation,
      source,
      locked: sec.locked,
      provenance: {
        authority,
        originalId: sec.id,
        analysisSource: sec.source,
      },
    }
  })
}

/**
 * Returns the BPM from a TrackAnalysis, or null if unavailable.
 * Never returns 120 as a synthetic fallback.
 */
export function extractBpm(analysis: TrackAnalysis): number | null {
  return analysis.bpm > 0 ? analysis.bpm : null
}

/**
 * Delegates every Track Map merge to the canonical authority resolver.
 * Locked user work wins first, followed by user-created sections, manual
 * replacements, imported authority, automatic analysis, and safe fallbacks.
 * The original analysis and edit arrays are never mutated.
 */
export function resolveTrackSections({
  analyzedSections,
  manualSections,
  durationSec,
  suppressedIds = [],
}: {
  analyzedSections: ReactTrackSection[]
  manualSections:   ReactTrackSection[]
  durationSec:      number
  /** Auto section IDs that have been suppressed/hidden by the user. */
  suppressedIds?:   string[]
}): ReactTrackSection[] {
  return resolveAuthoritativeTimeline({
    analyzedSections,
    manualSections,
    suppressedIds,
    durationSec,
  })
}
