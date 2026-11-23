import { create } from 'zustand'

/**
 * What the header's HEALTH readout and the red alert frame show. Detectors elsewhere (the cast, the audio engine, the graphics stage) report here through
 * src/lib/selfHealing.ts; nothing else writes it.
 *
 *   idle      nothing to watch (no cast running)          ok        working normally
 *   degraded  working, but at reduced quality             healing   failed a moment ago; STAGELESS is fixing it
 *   failed    could not be fixed automatically
 */
export type HealthSystem = 'cast' | 'audio' | 'graphics'
export type HealthState = 'idle' | 'ok' | 'degraded' | 'healing' | 'failed'

export interface SystemHealth {
  state: HealthState
  /** One short sentence for the chip's tooltip. */
  detail: string | null
  since: number
}

export const HEALTH_SYSTEMS: readonly HealthSystem[] = Object.freeze(['cast', 'audio', 'graphics'] as const)
export const HEALTH_LABELS: Readonly<Record<HealthSystem, string>> = Object.freeze({ cast: 'Output cast', audio: 'Audio', graphics: 'Graphics' })

type Systems = Readonly<Record<HealthSystem, SystemHealth>>

const initial = (): Systems => ({
  cast: { state: 'idle', detail: null, since: 0 },
  audio: { state: 'ok', detail: null, since: 0 },
  graphics: { state: 'ok', detail: null, since: 0 },
})

/** The red frame shows while anything is being repaired or could not be. A system running at reduced quality is not an alert. */
export function isCriticalHealth(systems: Systems): boolean {
  return HEALTH_SYSTEMS.some(system => systems[system].state === 'healing' || systems[system].state === 'failed')
}

interface HealthStoreState {
  systems: Systems
  setHealth: (system: HealthSystem, state: HealthState, detail?: string | null) => void
  reset: () => void
}

export const useHealthStore = create<HealthStoreState>(set => ({
  systems: initial(),
  setHealth: (system, state, detail = null) => set(current => {
    const previous = current.systems[system]
    if (previous.state === state && previous.detail === detail) return current
    return { systems: { ...current.systems, [system]: { state, detail, since: previous.state === state ? previous.since : Date.now() } } }
  }),
  reset: () => set({ systems: initial() }),
}))
