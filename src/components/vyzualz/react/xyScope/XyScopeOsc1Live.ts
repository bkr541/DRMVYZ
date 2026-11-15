// Sound Drawing XY › OSC 1: a tiny external store carrying the runtime's live values to the inspector, so Auto
// Performance can show the effective sliders, colour and section evidence without re-rendering the whole surface.

import { useSyncExternalStore } from 'react'
import type { Osc1Settings } from './XyScopeOsc1Engine'

export interface Osc1LiveSnapshot {
  /** Section estimate (DROP, BUILD, …) while Auto Performance is on and playing. */
  state: string
  dominant: string
  mapped: boolean
  confidence: number
  /** The effective control values currently in use. */
  settings: Osc1Settings
  letters: ReadonlyArray<{ gain: number; offset: number; focus: string }>
  /** Stereo samples, labelled mono samples, shared analysis, or nothing. */
  source: 'stereo' | 'mono' | 'shared' | 'none'
}

let current: Osc1LiveSnapshot | null = null
const listeners = new Set<() => void>()

export function publishOsc1Live(next: Osc1LiveSnapshot | null): void {
  current = next
  for (const listener of listeners) listener()
}

export function useOsc1Live(): Osc1LiveSnapshot | null {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => current,
    () => null,
  )
}
