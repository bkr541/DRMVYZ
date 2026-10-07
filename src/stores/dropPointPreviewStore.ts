// Session-only Drop Point preview state for Media Manager (preview of the workflow — nothing is saved, linked to an audio
// track, or applied to playback). Kept per media item so markers survive switching between items, and lost on reload.

import { create } from 'zustand'

export type DropPointStartMode = 'cut' | 'preroll'
/** Bars between repeats of the marked frame; `0` means no repeat. */
export type DropPointRepeatBars = 0 | 1 | 2 | 4 | 8 | 16
export type DropPointRepeatUntil = 'next-trigger' | 'count'

export interface DropPointRule {
  startMode: DropPointStartMode
  /** Bars of video that play before the marked frame in Pre-roll mode. */
  leadInBars: number
  repeatEveryBars: DropPointRepeatBars
  repeatUntil: DropPointRepeatUntil
  repeatCount: number
}

export interface DropPoint {
  id: string
  name: string
  timeSec: number
  rule: DropPointRule
}

export const DEFAULT_DROP_POINT_RULE: DropPointRule = {
  startMode: 'cut',
  leadInBars: 1,
  repeatEveryBars: 0,
  repeatUntil: 'next-trigger',
  repeatCount: 4,
}

interface DropPointPreviewState {
  byMedia: Record<string, DropPoint[]>
  selectedId: string | null
  add: (mediaId: string, timeSec: number) => string
  update: (mediaId: string, id: string, patch: Partial<Pick<DropPoint, 'name' | 'timeSec'>>) => void
  updateRule: (mediaId: string, id: string, patch: Partial<DropPointRule>) => void
  remove: (mediaId: string, id: string) => void
  select: (id: string | null) => void
}

let counter = 0

export const useDropPointPreviewStore = create<DropPointPreviewState>((set, get) => ({
  byMedia: {},
  selectedId: null,
  add: (mediaId, timeSec) => {
    const existing = get().byMedia[mediaId] ?? []
    counter += 1
    const point: DropPoint = {
      id: `drop-point-${counter}`,
      name: `Drop Point ${existing.length + 1}`,
      timeSec,
      rule: { ...DEFAULT_DROP_POINT_RULE },
    }
    set(state => ({
      byMedia: { ...state.byMedia, [mediaId]: [...existing, point].sort((a, b) => a.timeSec - b.timeSec) },
      selectedId: point.id,
    }))
    return point.id
  },
  update: (mediaId, id, patch) => set(state => ({
    byMedia: {
      ...state.byMedia,
      [mediaId]: (state.byMedia[mediaId] ?? [])
        .map(point => point.id === id ? { ...point, ...patch } : point)
        .sort((a, b) => a.timeSec - b.timeSec),
    },
  })),
  updateRule: (mediaId, id, patch) => set(state => ({
    byMedia: {
      ...state.byMedia,
      [mediaId]: (state.byMedia[mediaId] ?? []).map(point => point.id === id ? { ...point, rule: { ...point.rule, ...patch } } : point),
    },
  })),
  remove: (mediaId, id) => set(state => ({
    byMedia: { ...state.byMedia, [mediaId]: (state.byMedia[mediaId] ?? []).filter(point => point.id !== id) },
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),
  select: id => set({ selectedId: id }),
}))
