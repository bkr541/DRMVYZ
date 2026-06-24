// Pure, side-effect-free functions for rebuilding BPM-dependent analysis.
// No audio decoding, no FFT, no network calls.
// Both modes reuse stored feature curves — the expensive FFT pass is not repeated.

import { detectSections } from './sectionAnalysis'
import { detectSemanticMoments } from './semanticAnalysis'
import type { TrackIntelligenceAnalysis, TrackSectionMI, BeatMarkerMI } from './types'
import {
  rebuildBpmDependentData,
  snapToGrid,
} from '../../features/trackIntelligence/beatGridUtils'

// ── Section boundary helpers ──────────────────────────────────────────────────

/** Predicate: a section must not be overwritten by grid rebuilds or reanalysis. */
function isProtected(s: TrackSectionMI): boolean {
  return s.source === 'manual' || s.locked === true
}

/**
 * Re-snap the start of each unlocked analyzer-created section to the nearest
 * beat in the new grid.  The end of each section is derived from the next
 * section's snapped start so there are no gaps.  The last section always ends
 * at durationSec.  Manual and locked sections are left untouched and merged
 * back at their original positions.
 */
function resnapSectionBoundaries(
  sections:    TrackSectionMI[],
  beatGrid:    BeatMarkerMI[],
  durationSec: number,
): TrackSectionMI[] {
  const protected_ = sections.filter(isProtected)
  const moveable   = sections
    .filter(s => !isProtected(s))
    .sort((a, b) => a.startSec - b.startSec)

  if (moveable.length === 0) return sections

  // Snap the start of each moveable section to the nearest beat.
  // The first section keeps its start at 0 so the track is fully covered.
  const snappedStarts = moveable.map((s, i) => {
    if (i === 0) return 0
    return snapToGrid(s.startSec, beatGrid, 'beat')
  })

  // Deduplicate: if two sections would share a start, push the second forward one beat.
  const beatPeriod = beatGrid.length >= 2
    ? (beatGrid[1]!.timeSec - beatGrid[0]!.timeSec)
    : 0.5
  for (let i = 1; i < snappedStarts.length; i++) {
    if (snappedStarts[i]! <= snappedStarts[i - 1]!) {
      snappedStarts[i] = snappedStarts[i - 1]! + beatPeriod
    }
  }

  const resnapped: TrackSectionMI[] = moveable.map((s, i) => ({
    ...s,
    startSec: snappedStarts[i]!,
    endSec:   i < moveable.length - 1 ? snappedStarts[i + 1]! : durationSec,
  }))

  return [...protected_, ...resnapped].sort((a, b) => a.startSec - b.startSec)
}

// ── Resnap mode ───────────────────────────────────────────────────────────────

/**
 * Rebuilds beats, downbeats, bars, phrases, and section boundaries from a new
 * BPM.  Section boundaries are re-snapped to the new grid; section labels and
 * types are kept.  Manual and locked sections are preserved unchanged.
 *
 * Does NOT re-run section detection, key detection, lyric processing, or any
 * FFT-based feature extraction.  Safe to call with only a stored analysis.
 *
 * Pure — no side effects, no async.
 */
export function applyResnap(
  analysis:    TrackIntelligenceAnalysis,
  bpm:         number,
  beatsPerBar: number = analysis.timeSignature ?? 4,
): TrackIntelligenceAnalysis {
  const durationSec = analysis.durationMs / 1000
  const gridData    = rebuildBpmDependentData(analysis, bpm, beatsPerBar)

  const resnappedSections = resnapSectionBoundaries(
    analysis.sections, gridData.beatGrid, durationSec,
  )

  return {
    ...analysis,
    beatGrid:           gridData.beatGrid,
    downbeats:          gridData.downbeats,
    phrases:            gridData.phrases,
    sections:           resnappedSections,
    detectedBpm:        analysis.detectedBpm ?? analysis.bpm,
    bpmUsedForGrid:     bpm,
    lastGridRebuiltAt:  gridData.lastGridRebuiltAt,
    lastReanalysisMode: 'grid_only',
    gridStale:          false,
  }
}

// ── Reanalyze mode ────────────────────────────────────────────────────────────

/**
 * Rebuilds beats, downbeats, bars, and phrases from a new BPM, then reruns
 * section boundary detection using the stored feature curves (no audio buffer
 * needed).  New section boundaries are snapped to the corrected grid.
 * Semantic moments are rebuilt from the new section layout.
 *
 * Manual and locked sections are preserved; only unlocked analyzer-created
 * sections are replaced.
 *
 * Falls back to `applyResnap` when the stored energy curves are empty, since
 * section detection requires curve data.
 *
 * Pure — no side effects, no async.
 */
export function applyReanalyze(
  analysis:    TrackIntelligenceAnalysis,
  bpm:         number,
  beatsPerBar: number = analysis.timeSignature ?? 4,
): TrackIntelligenceAnalysis {
  const durationSec = analysis.durationMs / 1000
  const gridData    = rebuildBpmDependentData(analysis, bpm, beatsPerBar)

  // Fall back to resnap when there are no stored curves to detect sections from.
  const hasUsableCurves =
    analysis.energyCurves.instant.length > 0 &&
    analysis.energyCurves.bass.length   > 0

  if (!hasUsableCurves) {
    return applyResnap(analysis, bpm, beatsPerBar)
  }

  // Rerun section detection from stored curves — no FFT, no audio buffer.
  const freshSections: TrackSectionMI[] = detectSections(
    {
      instant: analysis.energyCurves.instant,
      bass:    analysis.energyCurves.bass,
      mid:     analysis.energyCurves.mid,
      high:    analysis.energyCurves.high,
    },
    analysis.spectralCurves,
    durationSec,
  ).map(s => ({ ...s, source: 'analysis' as const }))

  // Snap fresh section boundaries to the new beat grid.
  const snappedFresh = resnapSectionBoundaries(freshSections, gridData.beatGrid, durationSec)

  // Preserve manual and locked sections from the original analysis.
  const preserved = analysis.sections.filter(isProtected)

  // Merge: preserved sections take precedence; new analyzer sections fill the rest.
  const merged = [...preserved, ...snappedFresh].sort((a, b) => a.startSec - b.startSec)

  // Assemble the partial analysis needed by detectSemanticMoments.
  const partial: TrackIntelligenceAnalysis = {
    ...analysis,
    beatGrid:           gridData.beatGrid,
    downbeats:          gridData.downbeats,
    phrases:            gridData.phrases,
    sections:           merged,
    detectedBpm:        analysis.detectedBpm ?? analysis.bpm,
    bpmUsedForGrid:     bpm,
    lastGridRebuiltAt:  gridData.lastGridRebuiltAt,
    lastReanalysisMode: 'grid_only',
    gridStale:          false,
  }

  // Rebuild semantic moments from the updated section layout.
  return {
    ...partial,
    semanticMoments: detectSemanticMoments(partial),
  }
}
