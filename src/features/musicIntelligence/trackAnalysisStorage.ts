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
  bpmUsedForGrid:     number
  lastGridRebuiltAt:  string
  lastReanalysisMode: 'grid_only'
  gridStale:          false
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
   * lyrics, durationMs, bpm (detected), bpmConfidence, semanticMoments,
   * or sections that are manual/locked.
   * No-op when the track has no stored analysis.
   */
  patchAnalysisGrid: (trackId: string, patch: AnalysisGridPatch) => void
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
        set(s => ({
          analyses: { ...s.analyses, [trackId]: analysis },
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
          return { analyses: { ...s.analyses, [trackId]: updatedAnalysis } }
        })
      },
    }),
    {
      name: 'drmvyz:track-analyses',
      version: 4,
      migrate: persisted => {
        const state = (persisted ?? {}) as Partial<TrackAnalysisStorageState>
        const analyses = state.analyses ?? {}
        const statuses = { ...(state.statuses ?? {}) }
        // Retain legacy records so protected/manual data is never deleted by a
        // schema bump, but mark them stale so the coordinator cannot silently
        // treat an older automatic-analysis schema as current output.
        for (const [key, analysis] of Object.entries(analyses)) {
          if (!isCurrentAnalysisVersion(analysis.analysisVersion)) statuses[key] = 'stale'
        }
        return { ...state, analyses, statuses }
      },
      // Only persist the data — actions are recreated each hydration.
      partialize: s => ({ analyses: s.analyses, statuses: s.statuses }),
    },
  ),
)
