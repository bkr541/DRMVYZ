import { useSyncExternalStore } from 'react'
import type { InitValues } from './XyScopeInitSettings'
import type { InitSource } from './XyScopeInitEngine'

/** Effective INIT values shared from the runtime with the inspector, so Auto Performance can display them. */
export interface InitLiveSnapshot {
  state: string
  confidence: number
  mapped: boolean
  values: InitValues
  source: InitSource
  /** How many times the line ends have been re-picked. */
  repicks: number
}

let current: InitLiveSnapshot | null = null
const listeners = new Set<() => void>()
export function publishInitLive(next: InitLiveSnapshot | null): void {
  current = next
  for (const listener of listeners) listener()
}
export function useInitLive(): InitLiveSnapshot | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => current, () => null)
}
