// Pure BPM resolution logic for the canonical active-track model.
// Separated from the React hook so it can be unit-tested without DOM.

import type { TrackAnalysisRuntime, BpmSource } from '../types'

export interface BpmResolution {
  effectiveBpm:  number | null
  analyzedBpm:   number | null
  bpmSource:     BpmSource | null
  bpmConfidence: number | null
}

/**
 * Resolve the effective BPM and its provenance for a file/remote track.
 *
 * Priority:
 *   1. bpmOverride (manual or live-detected) — original analyzed BPM is preserved alongside
 *   2. offline analysis BPM
 *   3. null — never fall back to 120 as a track-derived value
 *
 * Microphone and demo sources are handled by the caller (not here).
 */
export function resolveTrackBpm(runtime: TrackAnalysisRuntime): BpmResolution {
  const { analysis, bpmOverride, bpmOverrideSource } = runtime
  const analyzedBpm     = analysis?.bpm ?? null
  const bpmConfidence   = analysis?.bpmConfidence ?? null

  if (bpmOverride !== null && bpmOverrideSource !== null) {
    return {
      effectiveBpm:  bpmOverride,
      analyzedBpm,
      bpmSource:     bpmOverrideSource,
      bpmConfidence,
    }
  }

  if (analyzedBpm !== null) {
    return {
      effectiveBpm:  analyzedBpm,
      analyzedBpm,
      bpmSource:     'offline_analysis',
      bpmConfidence,
    }
  }

  return { effectiveBpm: null, analyzedBpm: null, bpmSource: null, bpmConfidence: null }
}
