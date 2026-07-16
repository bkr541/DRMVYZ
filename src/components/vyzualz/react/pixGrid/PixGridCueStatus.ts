import { useSyncExternalStore } from 'react'
import type { PixGridCueRuntimeSnapshot } from './PixGridActionCues'

const EMPTY: PixGridCueRuntimeSnapshot = Object.freeze({
  trackId: null,
  active: false,
  activeCueIds: Object.freeze([]),
  mostRecentCueId: null,
  mostRecentCueLabel: null,
  activeOneShotCueIds: Object.freeze([]),
  manualOverrideRoutes: Object.freeze([]),
  transition: null,
  deterministicIdentity: 'pix-grid-cues:inactive',
})

let snapshot = EMPTY
const listeners = new Set<() => void>()

export function publishPixGridCueRuntimeStatus(next: PixGridCueRuntimeSnapshot): void {
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return
  snapshot = Object.freeze({
    ...next,
    activeCueIds: Object.freeze([...next.activeCueIds]),
    activeOneShotCueIds: Object.freeze([...next.activeOneShotCueIds]),
    manualOverrideRoutes: Object.freeze([...next.manualOverrideRoutes]),
    transition: next.transition ? Object.freeze({ ...next.transition }) : null,
  })
  listeners.forEach(listener => listener())
}

export function clearPixGridCueRuntimeStatus(): void {
  if (snapshot === EMPTY) return
  snapshot = EMPTY
  listeners.forEach(listener => listener())
}

export function getPixGridCueRuntimeStatus(): PixGridCueRuntimeSnapshot {
  return snapshot
}

export function usePixGridCueRuntimeStatus(): PixGridCueRuntimeSnapshot {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getPixGridCueRuntimeStatus,
    () => EMPTY,
  )
}
