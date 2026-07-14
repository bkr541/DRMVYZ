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

const MAX_STORED_PHRASES = 192
const MAX_STORED_SEMANTIC_MOMENTS = 128
const MAX_STORED_BOUNDARY_ALTERNATIVES = 24
const MAX_STORED_BOUNDARY_CANDIDATES = 256
const MAX_STORED_HIERARCHY_UNITS = 1536

export function boundTrackAnalysisForStorage(analysis: TrackIntelligenceAnalysis): TrackIntelligenceAnalysis {
  const structural = analysis.structuralSegmentation
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
    ...analysis,
    phrases: analysis.phrases.slice(0, MAX_STORED_PHRASES),
    semanticMoments: analysis.semanticMoments.slice(0, MAX_STORED_SEMANTIC_MOMENTS),
    boundaryAlternatives: analysis.boundaryAlternatives?.slice(0, MAX_STORED_BOUNDARY_ALTERNATIVES),
    phraseHierarchy: analysis.phraseHierarchy
      ? {
          ...analysis.phraseHierarchy,
          units: analysis.phraseHierarchy.units.slice(0, MAX_STORED_HIERARCHY_UNITS),
        }
      : undefined,
    structuralSegmentation: compactStructural,
  }
}

function migrateAnalysisRecord(analysis: TrackIntelligenceAnalysis): TrackIntelligenceAnalysis {
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
  const analyses = Object.fromEntries(
    Object.entries(state.analyses ?? {}).map(([trackId, analysis]) => [trackId, migrateAnalysisRecord(analysis)]),
  )
  const statuses = { ...(state.statuses ?? {}) }
  for (const [trackId, analysis] of Object.entries(analyses)) {
    if (!isCurrentAnalysisVersion(analysis.analysisVersion)) statuses[trackId] = 'stale'
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
        return get().analyses[trackId] ?? null
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
      version: 5,
      migrate: migrateTrackAnalysisStorageState,
      // Only persist the data — actions are recreated each hydration.
      partialize: s => ({ analyses: s.analyses, statuses: s.statuses }),
    },
  ),
)
