import type { TrackAnalysis, TrackSection } from './types'
import type { TrackIntelligenceAnalysis } from '../musicIntelligence/types'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'

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
  return analysis.sections.map(sec => ({
    id:         sec.id,
    label:      sec.label,
    type:       sec.type,
    startSec:   sec.startSec,
    endSec:     sec.endSec,
    intensity:  sec.intensity,
    confidence: sec.confidence,
    source:     'auto' as const,
  }))
}

/**
 * Returns the BPM from a TrackAnalysis, or null if unavailable.
 * Never returns 120 as a synthetic fallback.
 */
export function extractBpm(analysis: TrackAnalysis): number | null {
  return analysis.bpm > 0 ? analysis.bpm : null
}

/**
 * Merges analyzed sections with per-track manual sections into a single
 * resolved timeline.
 *
 * Precedence:
 *  1. `user-edited-auto` manual sections replace the analyzed section with the same ID.
 *  2. `user-created` / `manual` sections are appended after any analyzed sections.
 *  3. Unchanged analyzed sections remain as-is.
 *  4. Sections whose IDs appear in `suppressedIds` are omitted entirely.
 *  5. All sections are sorted by startSec and clipped to durationSec.
 *
 * The original analysis is never mutated.
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
  // Build a lookup of user-edited-auto overrides by the original auto section ID
  const editedById = new Map<string, ReactTrackSection>()
  for (const s of manualSections) {
    if (s.source === 'user-edited-auto') editedById.set(s.id, s)
  }

  const suppressedSet = new Set(suppressedIds)

  // Apply overrides to analyzed sections, skipping suppressed IDs
  const resolved: ReactTrackSection[] = [
    ...analyzedSections
      .filter(s => !suppressedSet.has(s.id))
      .map(s => editedById.get(s.id) ?? s),
    // Append user-created/manual sections (not overrides of existing auto sections)
    ...manualSections.filter(s => s.source !== 'user-edited-auto'),
  ]

  resolved.sort((a, b) => a.startSec - b.startSec)

  if (durationSec > 0) {
    return resolved
      .filter(s => s.startSec < durationSec)
      .map(s => s.endSec > durationSec ? { ...s, endSec: durationSec } : s)
  }
  return resolved
}
