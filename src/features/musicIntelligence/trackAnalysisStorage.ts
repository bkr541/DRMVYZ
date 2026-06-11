// Persistent storage for offline track analyses.
// Keyed by trackId (arbitrary string — file name hash, Supabase ID, etc.)
// Uses Zustand persist so analyses survive page reloads.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TrackIntelligenceAnalysis, AnalysisStatus } from './types'

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
    }),
    {
      name: 'drmvyz:track-analyses',
      // Only persist the data — actions are recreated each hydration.
      partialize: s => ({ analyses: s.analyses, statuses: s.statuses }),
    },
  ),
)
