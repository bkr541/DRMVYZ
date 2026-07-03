import { beforeEach, describe, expect, it } from 'vitest'
import {
  reactStorePartialize,
  resolveCinematicConfigForPreset,
  useReactStore,
} from './reactStore'
import { DEFAULT_REACT_PRESETS } from '../components/vyzualz/react/ReactTypes'

const constellationPreset = DEFAULT_REACT_PRESETS.find(preset => (
  resolveCinematicConfigForPreset(preset, {})?.worldMode === 'reactiveConstellation'
))!
const otherCinematicPreset = DEFAULT_REACT_PRESETS.find(preset => (
  preset.engine === 'cinematicPortal'
  && resolveCinematicConfigForPreset(preset, {})?.worldMode !== 'reactiveConstellation'
))!

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactPreset(constellationPreset.id)
})

describe('React performance action transient bus', () => {
  it('increments a monotonic sequence and includes target identity and timestamp', () => {
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.collapse')
    const first = useReactStore.getState().performanceActionEvent!
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.burst')
    const second = useReactStore.getState().performanceActionEvent!

    expect(first.sequence).toBe(before + 1)
    expect(second.sequence).toBe(first.sequence + 1)
    expect(first.target).toEqual({ engineId: 'cinematicPortal', worldId: 'reactiveConstellation' })
    expect(Number.isFinite(first.triggeredAtMs)).toBe(true)
    expect(useReactStore.getState().performanceActionEvents.map(event => event.sequence)).toEqual([first.sequence, second.sequence])
  })

  it('keeps action events, sequence counters, and toggle state out of persistence', () => {
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.freeze')
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(persisted).not.toHaveProperty('performanceActionEvent')
    expect(persisted).not.toHaveProperty('performanceActionEvents')
    expect(persisted).not.toHaveProperty('performanceActionSeq')
    expect(persisted).not.toHaveProperty('performanceActionToggleStates')
    expect(persisted).not.toHaveProperty('neonLatticeTrigger')
    expect(persisted).not.toHaveProperty('neonLatticeTriggerSeq')
  })

  it('toggles transient actions and enforces exclusive temporary render modes', () => {
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.freeze')
    expect(useReactStore.getState().performanceActionEvent?.toggleState).toBe(true)
    expect(useReactStore.getState().performanceActionToggleStates['reactiveConstellation.freeze']).toBe(true)

    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.freeze')
    expect(useReactStore.getState().performanceActionEvent?.toggleState).toBe(false)

    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.crystalOnly')
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.edgesOnly')
    const toggles = useReactStore.getState().performanceActionToggleStates
    expect(toggles['reactiveConstellation.crystalOnly']).toBe(false)
    expect(toggles['reactiveConstellation.edgesOnly']).toBe(true)
  })

  it('cleans transient actions on preset, engine, and world changes without resetting the counter', () => {
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.blackout')
    const sequence = useReactStore.getState().performanceActionSeq
    useReactStore.getState().selectReactPreset(otherCinematicPreset.id)
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
    expect(useReactStore.getState().performanceActionEvents).toEqual([])
    expect(useReactStore.getState().performanceActionToggleStates).toEqual({})
    expect(useReactStore.getState().performanceActionSeq).toBe(sequence)

    useReactStore.getState().selectReactPreset(constellationPreset.id)
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.freeze')
    const config = resolveCinematicConfigForPreset(constellationPreset, {})!
    useReactStore.getState().setCinematicConfigForPreset(constellationPreset.id, {
      ...config,
      environment: { ...config.environment, fog: 0.37 },
    })
    expect(useReactStore.getState().performanceActionToggleStates['reactiveConstellation.freeze']).toBe(true)

    useReactStore.getState().setCinematicConfigForPreset(constellationPreset.id, {
      ...config,
      worldMode: 'legacyPortal',
    })
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
    expect(useReactStore.getState().performanceActionEvents).toEqual([])
    expect(useReactStore.getState().performanceActionToggleStates).toEqual({})

    useReactStore.getState().selectReactEngine('laserDmx')
    useReactStore.getState().triggerPerformanceAction('laserDmx.whiteHit')
    expect(useReactStore.getState().performanceActionEvent?.actionId).toBe('laserDmx.whiteHit')
    useReactStore.getState().selectReactEngine('oscilloscope')
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
    expect(useReactStore.getState().neonLatticeTrigger).toBeNull()
  })

  it('rejects actions that are unavailable for the active engine or world', () => {
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('neonLattice.railBurst')
    expect(useReactStore.getState().performanceActionSeq).toBe(before)
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
  })
})
