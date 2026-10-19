import { beforeEach, describe, expect, it } from 'vitest'
import {
  reactStorePartialize,
  useReactStore,
} from './reactStore'

beforeEach(() => {
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('laserDmx')
})

describe('React performance action transient bus', () => {
  it('increments a monotonic sequence and includes target identity and timestamp', () => {
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('laserDmx.whiteHit')
    const first = useReactStore.getState().performanceActionEvent!
    useReactStore.getState().triggerPerformanceAction('laserDmx.fogBurst')
    const second = useReactStore.getState().performanceActionEvent!

    expect(first.sequence).toBe(before + 1)
    expect(second.sequence).toBe(first.sequence + 1)
    expect(first.target).toEqual({ engineId: 'laserDmx' })
    expect(Number.isFinite(first.triggeredAtMs)).toBe(true)
    expect(useReactStore.getState().performanceActionEvents.map(event => event.sequence)).toEqual([first.sequence, second.sequence])
  })

  it('keeps action events, sequence counters, and toggle state out of persistence', () => {
    useReactStore.getState().triggerPerformanceAction('laserDmx.whiteHit')
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(persisted).not.toHaveProperty('performanceActionEvent')
    expect(persisted).not.toHaveProperty('performanceActionEvents')
    expect(persisted).not.toHaveProperty('performanceActionSeq')
    expect(persisted).not.toHaveProperty('performanceActionToggleStates')
  })

  it('does not dispatch compatibility-only actions through a live engine', () => {
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('reactiveConstellation.freeze')
    expect(useReactStore.getState().performanceActionSeq).toBe(before)
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
  })

  it('cleans transient actions on live engine changes without resetting the counter', () => {
    useReactStore.getState().triggerPerformanceAction('laserDmx.whiteHit')
    const sequence = useReactStore.getState().performanceActionSeq
    useReactStore.getState().selectReactEngine('canvas')
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
    expect(useReactStore.getState().performanceActionEvents).toEqual([])
    expect(useReactStore.getState().performanceActionToggleStates).toEqual({})
    expect(useReactStore.getState().performanceActionSeq).toBe(sequence)

    useReactStore.getState().triggerPerformanceAction('canvas.bassBloom')
    expect(useReactStore.getState().performanceActionEvent?.actionId).toBe('canvas.bassBloom')
    useReactStore.getState().selectReactEngine('oscilloscope')
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
  })


  it('routes CANVAS performance pad actions through manual preset override and clip restart state', () => {
    useReactStore.getState().resetReactView()
    useReactStore.getState().selectReactEngine('canvas')

    useReactStore.getState().triggerPerformanceAction('canvas.bassBloom')
    expect(useReactStore.getState().activeReactEngineId).toBe('canvas')
    expect(useReactStore.getState().selectedCanvasPresetId).toBe('canvas-bass-bloom')
    expect(useReactStore.getState().canvasPresetOverride).toMatchObject({
      source: 'manual',
      presetId: 'canvas-bass-bloom',
      label: 'Performance pad preset',
    })
    expect(useReactStore.getState().performanceActionEvent?.actionId).toBe('canvas.bassBloom')

    const beforeRestart = useReactStore.getState().canvasVideoRestartRevision
    useReactStore.getState().triggerPerformanceAction('canvas.restartClip')
    expect(useReactStore.getState().canvasVideoRestartRevision).toBe(beforeRestart + 1)
    expect(useReactStore.getState().performanceActionEvent?.actionId).toBe('canvas.restartClip')
  })

  it('rejects actions that are unavailable for the active engine or world', () => {
    const before = useReactStore.getState().performanceActionSeq
    useReactStore.getState().triggerPerformanceAction('neonLattice.railBurst')
    expect(useReactStore.getState().performanceActionSeq).toBe(before)
    expect(useReactStore.getState().performanceActionEvent).toBeNull()
  })
})
