import { useSyncExternalStore } from 'react'
import type { OctaState } from './XyScopeOctaEngine'
import type { OctaValues } from './XyScopeOctaSettings'

/** What the runtime shares with the OCTA inspector: the distortion state and energy the music is driving, and Auto Performance's evidence. */
export interface OctaLiveSnapshot {
  state: OctaState
  /** 0..1 smoothed energy after Audio Reactivity and Distortion Amount. */
  energy: number
  conductor: string
  confidence: number
  mapped: boolean
  values: OctaValues
  source: 'stereo' | 'mono' | 'shared' | 'none'
}

let current: OctaLiveSnapshot | null = null
const listeners = new Set<() => void>()
export function publishOctaLive(next: OctaLiveSnapshot | null): void {
  current = next
  for (const listener of listeners) listener()
}
export function useOctaLive(): OctaLiveSnapshot | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => current, () => null)
}
