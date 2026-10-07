// Session-only Trigger Drop Point preview state for Media Manager's audio view (preview of the workflow — nothing is saved,
// and a chosen link to a video Drop Point is not applied to playback). Kept per audio track so markers survive switching
// between items, and lost on reload.

import { create } from 'zustand'

export type TriggerSnap = 'off' | 'beat' | 'bar'

export interface TriggerDropPoint {
  id: string
  name: string
  timeSec: number
  snap: TriggerSnap
  /** The video Drop Point this trigger fires, picked from the in-memory Drop Points (null = not linked). */
  linkedDropPointId: string | null
}

interface TriggerDropPointPreviewState {
  byTrack: Record<string, TriggerDropPoint[]>
  selectedId: string | null
  add: (trackId: string, timeSec: number) => string
  update: (trackId: string, id: string, patch: Partial<Omit<TriggerDropPoint, 'id'>>) => void
  remove: (trackId: string, id: string) => void
  select: (id: string | null) => void
}

let counter = 0
const byTime = (a: TriggerDropPoint, b: TriggerDropPoint) => a.timeSec - b.timeSec

export const useTriggerDropPointPreviewStore = create<TriggerDropPointPreviewState>((set, get) => ({
  byTrack: {},
  selectedId: null,
  add: (trackId, timeSec) => {
    const existing = get().byTrack[trackId] ?? []
    counter += 1
    const trigger: TriggerDropPoint = {
      id: `trigger-drop-point-${counter}`,
      name: `Trigger ${existing.length + 1}`,
      timeSec,
      snap: 'off',
      linkedDropPointId: null,
    }
    set(state => ({ byTrack: { ...state.byTrack, [trackId]: [...existing, trigger].sort(byTime) }, selectedId: trigger.id }))
    return trigger.id
  },
  update: (trackId, id, patch) => set(state => ({
    byTrack: {
      ...state.byTrack,
      [trackId]: (state.byTrack[trackId] ?? []).map(trigger => trigger.id === id ? { ...trigger, ...patch } : trigger).sort(byTime),
    },
  })),
  remove: (trackId, id) => set(state => ({
    byTrack: { ...state.byTrack, [trackId]: (state.byTrack[trackId] ?? []).filter(trigger => trigger.id !== id) },
    selectedId: state.selectedId === id ? null : state.selectedId,
  })),
  select: id => set({ selectedId: id }),
}))
