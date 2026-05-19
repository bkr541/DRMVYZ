import { create } from 'zustand'
import type { TrackAnalysis } from '../lib/audioAnalysis'

const SLOT_COLORS = ['#4ac7db', '#b84fc9', '#94a3b8', '#d8b95a']

export interface RefTrackRecord {
  id: string
  role: 'main' | 'reference'
  refIndex?: number
  title: string
  fileName: string
  format: string
  sampleRate: string
  bitDepth: string
  accentColor: string
  url: string
  duration: number
  analysis: TrackAnalysis | null
  analyzing: boolean
  analyzeError: string | null
}

function makeRecord(
  file: File,
  role: 'main' | 'reference',
  refIndex?: number
): RefTrackRecord {
  const slotIdx = role === 'main' ? 0 : (refIndex ?? 1)
  return {
    id: `track-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    role, refIndex,
    title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    fileName: file.name,
    format: (file.name.split('.').pop() ?? 'audio').toUpperCase(),
    sampleRate: '—',
    bitDepth: '—',
    accentColor: SLOT_COLORS[slotIdx] ?? '#4ac7db',
    url: URL.createObjectURL(file),
    duration: 0,
    analysis: null,
    analyzing: true,
    analyzeError: null,
  }
}

interface ReferenceState {
  mainTrack: RefTrackRecord | null
  refTracks: [RefTrackRecord | null, RefTrackRecord | null, RefTrackRecord | null]
  selectedId: string | null

  uploadMain(file: File): RefTrackRecord
  uploadRef(file: File, index: 0 | 1 | 2): RefTrackRecord
  setAnalysis(id: string, analysis: TrackAnalysis, sampleRate: string, duration: number): void
  setAnalyzing(id: string, analyzing: boolean): void
  setError(id: string, error: string): void
  setSelectedId(id: string | null): void
  removeMain(): void
  removeRef(index: 0 | 1 | 2): void
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  mainTrack: null,
  refTracks: [null, null, null],
  selectedId: null,

  uploadMain(file) {
    const track = makeRecord(file, 'main')
    const old = get().mainTrack
    if (old) URL.revokeObjectURL(old.url)
    set({ mainTrack: track, selectedId: track.id })
    return track
  },

  uploadRef(file, index) {
    const track = makeRecord(file, 'reference', index + 1)
    const old = get().refTracks[index]
    if (old) URL.revokeObjectURL(old.url)
    set(s => {
      const next = [...s.refTracks] as typeof s.refTracks
      next[index] = track
      return { refTracks: next }
    })
    return track
  },

  setAnalysis(id, analysis, sampleRate, duration) {
    const update = (t: RefTrackRecord | null) =>
      t?.id === id ? { ...t, analysis, analyzing: false, sampleRate, bitDepth: '—', duration } : t
    set(s => ({
      mainTrack: update(s.mainTrack) as RefTrackRecord | null,
      refTracks: s.refTracks.map(update) as typeof s.refTracks,
    }))
  },

  setAnalyzing(id, analyzing) {
    const update = (t: RefTrackRecord | null) => t?.id === id ? { ...t, analyzing } : t
    set(s => ({
      mainTrack: update(s.mainTrack) as RefTrackRecord | null,
      refTracks: s.refTracks.map(update) as typeof s.refTracks,
    }))
  },

  setError(id, error) {
    const update = (t: RefTrackRecord | null) =>
      t?.id === id ? { ...t, analyzing: false, analyzeError: error } : t
    set(s => ({
      mainTrack: update(s.mainTrack) as RefTrackRecord | null,
      refTracks: s.refTracks.map(update) as typeof s.refTracks,
    }))
  },

  setSelectedId(id) { set({ selectedId: id }) },

  removeMain() {
    const t = get().mainTrack
    if (t) URL.revokeObjectURL(t.url)
    set(s => ({ mainTrack: null, selectedId: s.selectedId === t?.id ? null : s.selectedId }))
  },

  removeRef(index) {
    const t = get().refTracks[index]
    if (t) URL.revokeObjectURL(t.url)
    set(s => {
      const next = [...s.refTracks] as typeof s.refTracks
      next[index] = null
      return { refTracks: next, selectedId: s.selectedId === t?.id ? null : s.selectedId }
    })
  },
}))
