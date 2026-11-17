import { afterEach, describe, expect, it } from 'vitest'
import { setAutoPerformanceUserDefault } from '../lib/autoPerformanceDefault'
import { useReactStore } from './reactStore'
import {
  CANVAS_AUTO_PERFORMANCE_ENGINES,
  XY_SCOPE_AUTO_PERFORMANCE_INSTRUMENTS,
  applyAutoPerformanceDefaultToReactState,
  applyAutoPerformanceDefaultToSoundDrawing,
} from './autoPerformanceDefaultReact'

afterEach(() => setAutoPerformanceUserDefault(null))

function toggles(state = useReactStore.getState()) {
  const canvas = state.canvasPresetSettings as unknown as Record<string, { autoPerformance: boolean }>
  const xy = state.xyScopeSettings as unknown as Record<string, { autoPerformance: boolean }> & { parameters: { autoPerformance: boolean } }
  return {
    canvas: CANVAS_AUTO_PERFORMANCE_ENGINES.map(engine => canvas[engine].autoPerformance),
    xy: XY_SCOPE_AUTO_PERFORMANCE_INSTRUMENTS.map(instrument => xy[instrument].autoPerformance),
    xyParameter: xy.parameters.autoPerformance,
  }
}

describe('the Auto Performance default across the React view engines', () => {
  it('knows a toggle on every CANVAS renderer and XY Scope instrument', () => {
    const { canvas, xy, xyParameter } = toggles()
    expect(canvas.every(value => typeof value === 'boolean')).toBe(true)
    expect(xy.every(value => typeof value === 'boolean')).toBe(true)
    expect(typeof xyParameter).toBe('boolean')
  })

  it('returns nothing to change when every toggle already has the value', () => {
    setAutoPerformanceUserDefault(true)
    const state = useReactStore.getState()
    const patch = applyAutoPerformanceDefaultToReactState(state, true)
    const applied = patch ? { ...state, ...patch } : state
    expect(applyAutoPerformanceDefaultToReactState(applied as typeof state, true)).toBeNull()
  })

  it('sets every toggle on or off when the setting changes, and leaves other settings alone', () => {
    const before = useReactStore.getState()
    setAutoPerformanceUserDefault(true)
    const on = toggles()
    expect([...on.canvas, ...on.xy, on.xyParameter].every(value => value === true)).toBe(true)
    setAutoPerformanceUserDefault(false)
    const off = toggles()
    expect([...off.canvas, ...off.xy, off.xyParameter].every(value => value === false)).toBe(true)
    expect(useReactStore.getState().canvasPresetSettings.vhs.seed).toBe(before.canvasPresetSettings.vhs.seed)
  })

  it('applies the default again when a preset or engine is chosen, so a hand-flipped toggle lasts until then', () => {
    setAutoPerformanceUserDefault(false)
    useReactStore.setState({ canvasPresetSettings: { ...useReactStore.getState().canvasPresetSettings, vhs: { ...useReactStore.getState().canvasPresetSettings.vhs, autoPerformance: true } } })
    expect(useReactStore.getState().canvasPresetSettings.vhs.autoPerformance).toBe(true)
    useReactStore.setState({ activeReactEngineId: useReactStore.getState().activeReactEngineId === 'canvas' ? 'sound-drawing' : 'canvas' } as never)
    expect(useReactStore.getState().canvasPresetSettings.vhs.autoPerformance).toBe(false)
  })

  it('applies to Sound Drawing only while a show is selected', () => {
    expect(applyAutoPerformanceDefaultToSoundDrawing({ selectedShowId: null, autoPerformance: false }, true)).toBeNull()
    expect(applyAutoPerformanceDefaultToSoundDrawing({ selectedShowId: 'x', autoPerformance: false }, true)).toEqual({ selectedShowId: 'x', autoPerformance: true })
    expect(applyAutoPerformanceDefaultToSoundDrawing({ selectedShowId: 'x', autoPerformance: true }, true)).toBeNull()
  })
})
