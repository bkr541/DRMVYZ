import { useSyncExternalStore } from 'react'
import type { Osc2Settings } from './XyScopeOsc2Engine'

/** Effective OSC 2 values shared from the runtime with the inspector, so Auto Performance can display them. */
export interface Osc2LiveSnapshot {
  state: string
  confidence: number
  mapped: boolean
  settings: Osc2Settings
  source: 'stereo' | 'mono' | 'shared' | 'none'
}

let current: Osc2LiveSnapshot | null = null
const listeners = new Set<() => void>()
export function publishOsc2Live(next: Osc2LiveSnapshot | null): void {
  current = next
  for (const listener of listeners) listener()
}
export function useOsc2Live(): Osc2LiveSnapshot | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => current, () => null)
}
