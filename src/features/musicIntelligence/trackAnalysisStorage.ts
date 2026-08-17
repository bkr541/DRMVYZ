// Persistent storage for offline track analyses.
// Keyed by trackId (arbitrary string — file name hash, Supabase ID, etc.)
// Uses Zustand persist so analyses survive page reloads.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  TrackIntelligenceAnalysis,
  AnalysisStatus,
  BeatMarkerMI,
  PhraseMarker,
  BarMarkerMI,
  BarMusicalFeatures,
  MusicalGridInfo,
  MusicalHierarchyAnalysis,
  BoundaryAlternative,
  SemanticMomentMarker,
} from './types'
import { isCurrentAnalysisVersion } from './analysisVersion'
import { ANALYSIS_TUNING } from './analysisTuning'
import { isUsableTrackAnalysis } from './analysisValidation'
import { resolveTrackAnalysisSources, withTrackAnalysisCompatibilityDefaults } from './analysisCompatibility'

/** The subset of TrackIntelligenceAnalysis fields that a grid rebuild may replace. */
export interface AnalysisGridPatch {
  beatGrid:           BeatMarkerMI[]
  downbeats:          BeatMarkerMI[]
  phrases:            PhraseMarker[]
  barMarkers?:        BarMarkerMI[]
  barFeatures?:       BarMusicalFeatures[]
  musicalGrid?:       MusicalGridInfo
  phraseHierarchy?:   MusicalHierarchyAnalysis
  boundaryAlternatives?: BoundaryAlternative[]
  semanticMoments?:   SemanticMomentMarker[]
  bpmUsedForGrid:     number
  lastGridRebuiltAt:  string
  lastReanalysisMode: 'grid_only'
  gridStale:          false
}

const {
  maxStoredPhrases: MAX_STORED_PHRASES,
  maxStoredSemanticMoments: MAX_STORED_SEMANTIC_MOMENTS,
  maxStoredBoundaryAlternatives: MAX_STORED_BOUNDARY_ALTERNATIVES,
  maxStoredBoundaryCandidates: MAX_STORED_BOUNDARY_CANDIDATES,
  maxStoredHierarchyUnits: MAX_STORED_HIERARCHY_UNITS,
} = ANALYSIS_TUNING.persistence

export function boundTrackAnalysisForStorage(analysis: TrackIntelligenceAnalysis): TrackIntelligenceAnalysis {
  const compatible = withTrackAnalysisCompatibilityDefaults(analysis)
  const structural = compatible.structuralSegmentation
  const compactStructural = structural
    ? {
        ...structural,
        boundaryCandidates: structural.boundaryCandidates.slice(0, MAX_STORED_BOUNDARY_CANDIDATES),
        alternativeBoundaryCandidates: structural.alternativeBoundaryCandidates.slice(0, MAX_STORED_BOUNDARY_ALTERNATIVES),
      }
    : undefined

  if (compactStructural) {
    const unsafe = compactStructural as unknown as Record<string, unknown>
    delete unsafe.similarityMatrix
    delete unsafe.selfSimilarityMatrix
    delete unsafe.noveltyMatrix
  }

  return {
    ...compatible,
    phrases: compatible.phrases.slice(0, MAX_STORED_PHRASES),
    semanticMoments: compatible.semanticMoments.slice(0, MAX_STORED_SEMANTIC_MOMENTS),
    boundaryAlternatives: compatible.boundaryAlternatives?.slice(0, MAX_STORED_BOUNDARY_ALTERNATIVES),
    phraseHierarchy: compatible.phraseHierarchy
      ? {
          ...compatible.phraseHierarchy,
          units: compatible.phraseHierarchy.units.slice(0, MAX_STORED_HIERARCHY_UNITS),
        }
      : undefined,
    structuralSegmentation: compactStructural,
  }
}

function migrateAnalysisRecord(analysis: unknown): TrackIntelligenceAnalysis | null {
  if (!isUsableTrackAnalysis(analysis)) return null
  const phrases = (analysis.phrases ?? []).map((phrase, index) => ({
    ...phrase,
    id: phrase.id ?? `phrase-legacy-${index}-${Math.round(phrase.timeSec * 1000)}`,
    barIndex: phrase.barIndex ?? null,
    lengthBars: phrase.lengthBars ?? phrase.phraseLength,
    source: phrase.source ?? 'grid_derived' as const,
    reason: phrase.reason ?? 'Legacy phrase marker retained as grid-derived metadata.',
    relatedSectionId: phrase.relatedSectionId ?? null,
    structurallyDetected: phrase.structurallyDetected ?? false,
    supportingSignals: phrase.supportingSignals ?? ['legacy phrase marker'],
  }))
  const semanticMoments = (analysis.semanticMoments ?? []).map((moment, index) => ({
    ...moment,
    id: moment.id ?? `moment-legacy-${index}-${Math.round(moment.timeSec * 1000)}`,
    barIndex: moment.barIndex ?? null,
    relatedSectionId: moment.relatedSectionId ?? null,
    supportingSignals: moment.supportingSignals ?? ['legacy semantic heuristic'],
  }))
  return boundTrackAnalysisForStorage({
    ...analysis,
    phrases,
    semanticMoments,
    boundaryAlternatives: analysis.boundaryAlternatives ?? [],
  })
}

// ── Downsampled feature curve (keeps storage size bounded) ───────────────────
// Full-resolution curves are downsampled to ≤300 points in offlineTrackAnalyzer
// before being handed to this store, so no further processing is needed here.

// ── State shape ───────────────────────────────────────────────────────────────

interface TrackAnalysisStorageState {
  analyses: Record<string, TrackIntelligenceAnalysis>
  statuses: Record<string, AnalysisStatus>

  getTrackAnalysis:  (trackId: string) => TrackIntelligenceAnalysis | null
  saveTrackAnalysis: (trackId: string, analysis: TrackIntelligenceAnalysis) => void
  clearTrackAnalysis:(trackId: string) => void
  markAnalysisStale: (trackId: string) => void
  getAnalysisStatus: (trackId: string) => AnalysisStatus
  setAnalysisStatus: (trackId: string, status: AnalysisStatus) => void
  clearAll:          () => void
  /**
   * Patches only the BPM-dependent fields of an existing analysis record.
   * Never overwrites energyCurves, spectralCurves, stemCurves, harmonic,
   * lyrics, durationMs, bpm (detected), or bpmConfidence. Semantic moments
   * are refreshed only when supplied by the grid rebuild. Manual/locked sections remain authoritative.
   * No-op when the track has no stored analysis.
   */
  patchAnalysisGrid: (trackId: string, patch: AnalysisGridPatch) => void
}

export function migrateTrackAnalysisStorageState(persisted: unknown): Partial<TrackAnalysisStorageState> {
  const state = (persisted ?? {}) as Partial<TrackAnalysisStorageState>
  const analyses: Record<string, TrackIntelligenceAnalysis> = {}
  const statuses = { ...(state.statuses ?? {}) }
  for (const [trackId, rawAnalysis] of Object.entries(state.analyses ?? {})) {
    try {
      const analysis = migrateAnalysisRecord(rawAnalysis)
      if (!analysis) {
        statuses[trackId] = 'stale'
        continue
      }
      analyses[trackId] = analysis
      if (!isCurrentAnalysisVersion(analysis.analysisVersion)) statuses[trackId] = 'stale'
    } catch {
      // A corrupt cache entry is quarantined instead of aborting store hydration.
      statuses[trackId] = 'stale'
    }
  }
  return { ...state, analyses, statuses }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTrackAnalysisStore = create<TrackAnalysisStorageState>()(
  persist(
    (set, get) => ({
      analyses: {},
      statuses: {},

      getTrackAnalysis(trackId) {
        const analysis = get().analyses[trackId]
        return isUsableTrackAnalysis(analysis) ? analysis : null
      },

      saveTrackAnalysis(trackId, analysis) {
        const bounded = boundTrackAnalysisForStorage(analysis)
        set(s => ({
          analyses: { ...s.analyses, [trackId]: bounded },
          statuses: { ...s.statuses, [trackId]: 'complete' as AnalysisStatus },
        }))
      },

      clearTrackAnalysis(trackId) {
        set(s => {
          const analyses = { ...s.analyses }
          const statuses = { ...s.statuses }
          delete analyses[trackId]
          delete statuses[trackId]
          return { analyses, statuses }
        })
      },

      markAnalysisStale(trackId) {
        set(s => ({
          statuses: { ...s.statuses, [trackId]: 'stale' as AnalysisStatus },
        }))
      },

      getAnalysisStatus(trackId) {
        return get().statuses[trackId] ?? 'not_analyzed'
      },

      setAnalysisStatus(trackId, status) {
        set(s => ({
          statuses: { ...s.statuses, [trackId]: status },
        }))
      },

      clearAll() {
        set({ analyses: {}, statuses: {} })
      },

      patchAnalysisGrid(trackId, patch) {
        set(s => {
          const existing = s.analyses[trackId]
          if (!existing) return s
          // Preserve manual and locked sections; only replace analyzer-created ones.
          const preservedSections = existing.sections.filter(
            sec => sec.source === 'manual' || sec.source === 'rekordbox' || sec.locked === true,
          )
          const updatedAnalysis: TrackIntelligenceAnalysis = {
            ...existing,
            ...patch,
            analysisSources: {
              ...resolveTrackAnalysisSources(existing),
              beatGrid: 'drmvyz',
            },
            // Re-merge preserved sections so manual/locked entries are not lost.
            sections: preservedSections.length > 0
              ? [
                  ...patch.beatGrid.length > 0
                    ? existing.sections.filter(
                        sec => sec.source !== 'manual' && sec.source !== 'rekordbox' && !sec.locked,
                      )
                    : [],
                  ...preservedSections,
                ].sort((a, b) => a.startSec - b.startSec)
              : existing.sections,
          }
          return { analyses: { ...s.analyses, [trackId]: boundTrackAnalysisForStorage(updatedAnalysis) } }
        })
      },
    }),
    {
      name: 'drmvyz:track-analyses',
      version: 7,
      migrate: migrateTrackAnalysisStorageState,
      // Only persist the data — actions are recreated each hydration.
      partialize: s => ({ analyses: s.analyses, statuses: s.statuses }),
    },
  ),
)
