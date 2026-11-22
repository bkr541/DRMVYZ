import { useSyncExternalStore } from 'react'

/**
 * What a page can tell the app-level review notes about what it is showing: the visualizer says which preset is on stage and how to read its settings. With nothing
 * registered the notes are about the page and the app only. Development only: a page registers through `ReviewNotesScene`, which a production build never loads.
 */
export interface ReviewNotesSceneInfo {
  engine: string
  presetId: string
  presetName: string
  /** What the screen is showing right now (playing, tempo, the preset's control values), saved with a note. */
  getContext: () => Record<string, unknown>
}

let current: ReviewNotesSceneInfo | null = null
const listeners = new Set<() => void>()

export function setReviewNotesScene(info: ReviewNotesSceneInfo | null): void {
  if (current === info) return
  current = info
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useReviewNotesScene = (): ReviewNotesSceneInfo | null => useSyncExternalStore(subscribe, () => current, () => null)
export const getReviewNotesScene = (): ReviewNotesSceneInfo | null => current
