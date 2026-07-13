// Pure, side-effect-free functions for rebuilding BPM-dependent analysis.
// No audio decoding, no FFT, no network calls.
// Both modes reuse stored feature curves and the same shared structural
// segmentation implementation used by the initial offline analysis.

import { analyzeStructuralRegions } from './sectionAnalysis'
import { detectSemanticMoments } from './semanticAnalysis'
import type { TrackIntelligenceAnalysis, TrackSectionMI } from './types'
import { rebuildBpmDependentData } from '../../features/trackIntelligence/beatGridUtils'

function isProtected(section: TrackSectionMI): boolean {
  return section.source === 'manual' || section.locked === true
}

function overlapDuration(a: TrackSectionMI, b: TrackSectionMI): number {
  return Math.max(0, Math.min(a.endSec, b.endSec) - Math.max(a.startSec, b.startSec))
}

function mergeProtectedSections(protectedSections: TrackSectionMI[], automaticSections: TrackSectionMI[]): TrackSectionMI[] {
  const overlapsProtected = (section: TrackSectionMI) => protectedSections.some(protectedSection => (
    section.startSec < protectedSection.endSec && section.endSec > protectedSection.startSec
  ))
  return [
    ...protectedSections,
    ...automaticSections.filter(section => !overlapsProtected(section)),
  ].sort((a, b) => a.startSec - b.startSec)
}

/**
 * Grid-only mode still rebuilds neutral structural regions. It then transfers
 * existing analyzer labels to the new regions by maximum temporal overlap so
 * current engine semantics remain stable until Patch 3 replaces the classifier.
 */
function preserveCompatibilityLabels(
  previousSections: TrackSectionMI[],
  freshSections: TrackSectionMI[],
): TrackSectionMI[] {
  const previousAutomatic = previousSections.filter(section => !isProtected(section))
  return freshSections.map((fresh, index) => {
    let best: TrackSectionMI | null = null
    let bestOverlap = 0
    for (const previous of previousAutomatic) {
      const overlap = overlapDuration(previous, fresh)
      if (overlap > bestOverlap) {
        best = previous
        bestOverlap = overlap
      }
    }
    if (!best) return fresh
    return {
      ...fresh,
      label: best.label,
      type: best.type,
      intensity: best.intensity,
      confidence: Math.max(fresh.confidence, Math.min(0.9, best.confidence)),
      id: `auto-sec-${index}`,
      source: 'analysis',
    }
  })
}

function rebuildStructuralAnalysis(
  analysis: TrackIntelligenceAnalysis,
  gridData: ReturnType<typeof rebuildBpmDependentData>,
  durationSec: number,
) {
  return analyzeStructuralRegions(
    {
      instant: analysis.energyCurves.instant,
      bass: analysis.energyCurves.bass,
      mid: analysis.energyCurves.mid,
      high: analysis.energyCurves.high,
    },
    analysis.spectralCurves,
    durationSec,
    {
      barFeatures: gridData.barFeatures,
      musicalGrid: gridData.musicalGrid,
    },
  )
}

function assembleReanalysis(
  analysis: TrackIntelligenceAnalysis,
  bpm: number,
  gridData: ReturnType<typeof rebuildBpmDependentData>,
  sections: TrackSectionMI[],
  structuralSegmentation: TrackIntelligenceAnalysis['structuralSegmentation'],
): TrackIntelligenceAnalysis {
  const partial: TrackIntelligenceAnalysis = {
    ...analysis,
    beatGrid: gridData.beatGrid,
    downbeats: gridData.downbeats,
    phrases: gridData.phrases,
    barMarkers: gridData.barMarkers,
    barFeatures: gridData.barFeatures,
    musicalGrid: gridData.musicalGrid,
    beatPhaseConfidence: gridData.musicalGrid.confidence.beatPhase,
    downbeatPhaseConfidence: gridData.musicalGrid.confidence.downbeatPhase,
    barGridConfidence: gridData.musicalGrid.confidence.barGrid,
    sections,
    structuralSegmentation,
    detectedBpm: analysis.detectedBpm ?? analysis.bpm,
    bpmUsedForGrid: bpm,
    lastGridRebuiltAt: gridData.lastGridRebuiltAt,
    lastReanalysisMode: 'grid_only',
    gridStale: false,
    analysisDiagnostics: analysis.analysisDiagnostics
      ? {
          ...analysis.analysisDiagnostics,
          beatCount: gridData.beatGrid.length,
          downbeatCount: gridData.downbeats.length,
          barCount: gridData.barMarkers.length,
          barFeatureCount: gridData.barFeatures.length,
          sectionCount: sections.length,
          usedFallback: structuralSegmentation?.diagnostics.usedFallback ?? true,
          gridSource: gridData.musicalGrid.source,
          fallbackReason: gridData.musicalGrid.fallbackReason,
          structuralSource: structuralSegmentation?.source,
          structuralCandidateCount: structuralSegmentation?.diagnostics.candidateCount,
          selectedStructuralBoundaryCount: structuralSegmentation?.diagnostics.selectedBoundaryCount,
          similarityMatrixDimension: structuralSegmentation?.diagnostics.matrixDimension,
          similarityMatrixBytes: structuralSegmentation?.diagnostics.matrixBytes,
        }
      : analysis.analysisDiagnostics,
  }
  return {
    ...partial,
    semanticMoments: detectSemanticMoments(partial),
  }
}

/**
 * Rebuilds beats, downbeats, bars, bar features, neutral structural regions,
 * and section boundaries from a new BPM. Existing compatibility labels are
 * retained where possible. Manual and locked sections remain authoritative.
 */
export function applyResnap(
  analysis: TrackIntelligenceAnalysis,
  bpm: number,
  beatsPerBar: number = analysis.timeSignature ?? 4,
): TrackIntelligenceAnalysis {
  const durationSec = analysis.durationMs / 1000
  const gridData = rebuildBpmDependentData(analysis, bpm, beatsPerBar)
  const structural = rebuildStructuralAnalysis(analysis, gridData, durationSec)
  const relabeled = preserveCompatibilityLabels(analysis.sections, structural.sections)
  const preserved = analysis.sections.filter(isProtected)
  return assembleReanalysis(
    analysis,
    bpm,
    gridData,
    mergeProtectedSections(preserved, relabeled),
    structural.structuralSegmentation,
  )
}

/**
 * Rebuilds all BPM-dependent data and reruns the shared structural segmentation
 * compatibility labeling. Manual and locked sections remain authoritative.
 */
export function applyReanalyze(
  analysis: TrackIntelligenceAnalysis,
  bpm: number,
  beatsPerBar: number = analysis.timeSignature ?? 4,
): TrackIntelligenceAnalysis {
  const durationSec = analysis.durationMs / 1000
  const gridData = rebuildBpmDependentData(analysis, bpm, beatsPerBar)
  const structural = rebuildStructuralAnalysis(analysis, gridData, durationSec)
  const preserved = analysis.sections.filter(isProtected)
  return assembleReanalysis(
    analysis,
    bpm,
    gridData,
    mergeProtectedSections(preserved, structural.sections),
    structural.structuralSegmentation,
  )
}
