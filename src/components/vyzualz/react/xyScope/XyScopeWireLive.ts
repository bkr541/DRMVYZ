import { useSyncExternalStore } from 'react'
import type { WireState } from './XyScopeWireDirector'
import type { WireValues } from './XyScopeWireSettings'
import type { WireMood } from './XyScopeWireConductor'
import type { WireFigureId } from './XyScopeWireShape'

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
  /** The user's own values. */
  values: WireValues
  /** What is actually drawn: the user's values moved by the music while Auto Performance is on (the same object otherwise). */
  effective: WireValues
  mood: WireMood
  feel: 'CALM' | 'DRIVING' | 'TENSE' | 'PEAK'
  figure: WireFigureId
  auto: boolean
  /** How much the figure is moving (0 when the music has stopped). */
  motion: number
  /** True when the motion is locked to the track's beat grid. */
  beatLocked: boolean
  /** The build pulse, 0..1. */
  pulse: number
  /** The impact of the last drop, 0..1, falling. */
  shock: number
  /** The transition running now (null when none), the latest reaction that fired and how many have fired. */
  transition: string | null
  lastReaction: string
  reactionsFired: number
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
