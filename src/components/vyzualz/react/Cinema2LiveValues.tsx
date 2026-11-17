import { readCinema2MoodPolicy } from '../cinema2/conductor/Cinema2MoodPolicy'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Cinema2JsonValue } from '../cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2FinalValueResolver } from '../cinema2/parameters/Cinema2TargetRuntime'
import type { Cinema2CompiledPresetPlan } from '../cinema2/presets/Cinema2PresetCompiler'

/**
 * The live (effective) value of a Cinema 2.0 control.
 *
 * Auto Performance, the music's choreography and the Mood Conductor never rewrite an authored value: they add transient contributions to the targets
 * a control is bound to, and the renderer reads the resolved result. The inspector's slider therefore shows the value the user saved. This reads
 * what the renderer actually sees (the resolved value of each module or effect target bound to the control) so the inspector can show it next to
 * the saved one. Only controls whose live value differs from the saved one are returned.
 */
export function resolveCinema2LiveValues(
  plan: Readonly<Pick<Cinema2CompiledPresetPlan, 'targets'>>,
  resolver: Pick<Cinema2FinalValueResolver, 'resolve'>,
  saved: Readonly<Record<string, Cinema2JsonValue>>,
  ranges: ReadonlyMap<string, readonly [number, number]>,
): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  const byParameter = new Map<string, Readonly<Cinema2CompiledPresetPlan['targets']['targets'][number]>[]>()
  for (const target of plan.targets.targets) {
    // The parameter's own target is the saved value; the module and effect targets bound to it are where contributions land.
    if (target.channel !== 'value' || target.kind === 'parameter' || target.parameterId == null) continue
    byParameter.set(target.parameterId, [...(byParameter.get(target.parameterId) ?? []), target])
  }
  for (const [id, [lo, hi]] of ranges) {
    const base = saved[id]
    if (typeof base !== 'number') continue
    const epsilon = Math.max(1e-6, (hi - lo) * 0.004)
    for (const target of byParameter.get(id) ?? []) {
      const resolved = resolver.resolve(target.id)
      if (resolved.ok && typeof resolved.value === 'number' && Number.isFinite(resolved.value) && Math.abs(resolved.value - base) > epsilon) {
        out.set(id, resolved.value)
        break
      }
    }
  }
  return out
}

const NO_LIVE_VALUES: ReadonlyMap<string, number> = new Map()
const Cinema2LiveValuesContext = createContext<ReadonlyMap<string, number>>(NO_LIVE_VALUES)
export const Cinema2LiveValuesProvider = Cinema2LiveValuesContext.Provider

/** The live value of a control while the music is moving it, else null. */
export function useCinema2LiveValue(parameterId: string): number | null {
  return useContext(Cinema2LiveValuesContext).get(parameterId) ?? null
}

/** Polls a map about eight times a second (and only re-renders when it changes), while `active`. */
function usePolledMap<V extends number | string>(active: boolean, read: () => ReadonlyMap<string, V>, empty: ReadonlyMap<string, V>, intervalMs: number): ReadonlyMap<string, V> {
  const [values, setValues] = useState<ReadonlyMap<string, V>>(empty)
  // The latest reader and the last published signature live in refs, so a reader whose identity changes on a render (it closes over per-render model
  // objects) never restarts the poll or republishes an unchanged map: only a change in the values themselves re-renders.
  const readRef = useRef(read)
  const lastRef = useRef('')
  useEffect(() => { readRef.current = read })
  useEffect(() => {
    if (!active) { lastRef.current = ''; setValues(empty); return }
    const signature = (map: ReadonlyMap<string, V>) => [...map].map(([id, v]) => `${id}:${typeof v === 'number' ? v.toFixed(3) : v}`).sort().join('|')
    const tick = () => {
      const next = readRef.current()
      const key = signature(next)
      if (key === lastRef.current) return
      lastRef.current = key
      setValues(next.size === 0 ? empty : next)
    }
    tick()
    const handle = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(handle)
  }, [active, empty, intervalMs])
  return values
}

/** Polls the resolved values about eight times a second (and only re-renders when they change), while `active`. */
export function useCinema2LiveValues(active: boolean, read: () => ReadonlyMap<string, number>, intervalMs = 125): ReadonlyMap<string, number> {
  return usePolledMap(active, read, NO_LIVE_VALUES, intervalMs)
}

// ── Pattern Change and Trigger ───────────────────────────────────────────────

const NO_LIVE_POLICY: ReadonlyMap<string, string> = new Map()
const Cinema2LivePolicyContext = createContext<ReadonlyMap<string, string>>(NO_LIVE_POLICY)
export const Cinema2LivePolicyProvider = Cinema2LivePolicyContext.Provider

/** What Auto Performance is choosing for this control (Pattern Change or the Trigger), as a short sentence, or null. */
export function useCinema2LivePolicy(parameterId: string): string | null {
  return useContext(Cinema2LivePolicyContext).get(parameterId) ?? null
}

export function useCinema2LivePolicies(active: boolean, read: () => ReadonlyMap<string, string>, intervalMs = 125): ReadonlyMap<string, string> {
  return usePolledMap(active, read, NO_LIVE_POLICY, intervalMs)
}

export interface Cinema2PolicyControl {
  readonly id: string
  readonly policy: 'patternChange' | 'trigger'
  readonly options?: readonly { readonly value: string; readonly label: string }[]
}

/** Finds the controls a preset tagged for the music's choice (see `moodPolicy`) among an inspector's controls, and its Auto Performance toggle. */
export function findCinema2PolicyControls(
  controls: readonly Readonly<{ definition: Readonly<{ id: string; metadata?: unknown; options?: readonly { value: string; label: string }[] }> }>[],
): Readonly<{ controls: readonly Cinema2PolicyControl[]; autoId: string | null }> {
  const found: Cinema2PolicyControl[] = []
  let autoId: string | null = null
  for (const { definition } of controls) {
    const policy = readCinema2MoodPolicy(definition.metadata)
    if (policy === 'patternChange' || policy === 'trigger') found.push({ id: definition.id, policy, options: definition.options })
    if (policy === 'autoPerformance') autoId = definition.id
  }
  return { controls: found, autoId }
}

/**
 * While Auto Performance is on, the music chooses Pattern Change and the Trigger (the saved values are never rewritten). This words the live choice for
 * the controls that are tagged `moodPolicy`: "Auto Performance is choosing: On, Every 4 Bars" on Pattern Change, and the Trigger it chose on Trigger.
 * Nothing is returned when Auto Performance is off or the music has no choice (no beat grid), so the saved values simply stand.
 */
export function resolveCinema2LivePolicy(
  controls: readonly Cinema2PolicyControl[],
  autoOn: boolean,
  choice: Readonly<{ patternChange: boolean; trigger: string; reason: string }> | null | undefined,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>()
  if (!autoOn || !choice) return out
  const trigger = controls.find(control => control.policy === 'trigger')
  const label = trigger?.options?.find(option => option.value === choice.trigger)?.label ?? choice.trigger
  const reasons: Record<string, string> = { calm: 'a calm passage', driving: 'a driving passage', tense: 'tension building', build: 'a build climbing', impact: 'a drop landing', approach: 'a section about to end', peak: 'a peak', silence: 'a silent stop' }
  const why = reasons[choice.reason] ?? choice.reason
  for (const control of controls) {
    if (control.policy === 'patternChange') out.set(control.id, `Auto Performance is choosing: ${choice.patternChange ? `On, ${label}` : 'Off (holding the pattern)'} for ${why}`)
    else out.set(control.id, `Auto Performance is choosing: ${label}${choice.patternChange ? '' : ' (holding the pattern)'}`)
  }
  return out
}
