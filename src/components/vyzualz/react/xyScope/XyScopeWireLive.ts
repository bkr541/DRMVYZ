import { useSyncExternalStore } from 'react'
import type { WireState } from './XyScopeWireDirector'
import type { WireValues } from './XyScopeWireSettings'

/** What the runtime shares with the WIREFRAME inspector: what the director is doing, how readable the cubes are, and where the sound comes from. */
export interface WireLiveSnapshot {
  state: WireState
  sceneId: string
  /** 1 is the cubes exactly as placed. */
  readability: number
  /** The share of the recent bars the figure has been undisturbed. */
  readableFraction: number
  /** How much of the music's deformation the readability guard let through (1 = all of it). */
  weight: number
  abstract: number
  lastEvent: string
  /** True when an analysed track backs the director with section evidence. A live microphone never does. */
  structure: boolean
  source: 'stereo' | 'mono' | 'shared' | 'none'
  values: WireValues
}

let current: WireLiveSnapshot | null = null
const listeners = new Set<() => void>()
export function publishWireLive(next: WireLiveSnapshot | null): void {
  current = next
  for (const listener of listeners) listener()
}
export function useWireLive(): WireLiveSnapshot | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => current, () => null)
}
