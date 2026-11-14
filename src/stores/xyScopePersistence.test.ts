import { beforeEach, describe, expect, it } from 'vitest'
import {
  mergeReactStoreState,
  migrateReactStore,
  REACT_PROJECT_STATE_KEYS,
  reactStorePartialize,
  useReactStore,
} from './reactStore'
import { DEFAULT_XY_SCOPE_SETTINGS } from '../components/vyzualz/react/xyScope/XyScopeSettings'

describe('Sound Drawing XY store and persistence contract', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('selects the engine through the canonical action as a preset-free engine with default settings', () => {
    useReactStore.getState().selectReactEngine('xyScope')
    const state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('xyScope')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.xyScopeSettings).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
  })

  it('normalizes every mutation, so a corrupt patch cannot reach the renderer', () => {
    useReactStore.getState().setXyScopeSettings({
      text: 'A'.repeat(99),
      fontId: 12 as never,
      parameters: { intensity: 50, beamColor: 'nope', trigger: 'every-second' },
    })
    const settings = useReactStore.getState().xyScopeSettings
    expect(settings.text).toHaveLength(16)
    expect(settings.fontId).toBeNull()
    expect(settings.parameters.intensity).toBe(2)
    expect(settings.parameters.beamColor).toBe('#96fff0')
    expect(settings.parameters.trigger).toBe('bar')
  })

  it('persists text, SVG selection, processing and every value as project data and restores them', () => {
    useReactStore.getState().setXyScopeSettings({ text: 'WILDFLY', additionalTexts: ['HELLO', 'WORLD', '', 'XY'], fontId: 'font-9', sourceMode: 'svg', svgMediaId: 'uploaded-logo', svgProcessing: 'segments', presetId: 'storm', parameters: { ...DEFAULT_XY_SCOPE_SETTINGS.parameters, trail: 200, bassResponse: .4 } })
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(REACT_PROJECT_STATE_KEYS).toContain('xyScopeSettings')
    expect(persisted.xyScopeSettings).toMatchObject({ text: 'WILDFLY', fontId: 'font-9', presetId: 'storm' })
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.xyScopeSettings).toMatchObject({ text: 'WILDFLY', fontId: 'font-9', sourceMode: 'svg', svgMediaId: 'uploaded-logo', svgProcessing: 'segments' })
    expect(restored.xyScopeSettings.additionalTexts).toEqual(['HELLO', 'WORLD', '', 'XY'])
    expect(restored.xyScopeSettings.parameters.bassResponse).toBe(.4)
    expect(restored.xyScopeSettings.parameters.trail).toBe(200)
  })

  it('persists and restores TEXT V2 with its full text configuration', () => {
    useReactStore.getState().setXyScopeSettings({ sourceMode: 'textV2', text: 'V2', additionalTexts: ['HELLO', 'WORLD'], fontId: 'font-v2' })
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.xyScopeSettings).toMatchObject({ sourceMode: 'textV2', text: 'V2', additionalTexts: ['HELLO', 'WORLD'], fontId: 'font-v2' })
    expect(migrateReactStore(persisted, 80).xyScopeSettings).toMatchObject({ sourceMode: 'textV2' })
  })

  it('persists Text V2 manual settings independently of the original text parameters', () => {
    const state = useReactStore.getState()
    state.setXyScopeSettings({ textV2: { ...state.xyScopeSettings.textV2, grouping: 'letters', autoPerformance: false, abstraction: .7, manualStyle: 'impact' } })
    const saved = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const restored = mergeReactStoreState(saved, useReactStore.getState()).xyScopeSettings
    expect(restored.textV2).toMatchObject({ grouping: 'letters', autoPerformance: false, abstraction: .7, manualStyle: 'impact' })
    expect(restored.parameters).toEqual(state.xyScopeSettings.parameters)
    const old = mergeReactStoreState({ xyScopeSettings: { text: 'OLD' } }, useReactStore.getState()).xyScopeSettings
    expect(old.textV2).toMatchObject({ grouping: 'both', autoPerformance: true })
  })

  it('restores the standalone engine selection without inventing a preset', () => {
    useReactStore.getState().selectReactEngine('xyScope')
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.activeReactEngineId).toBe('xyScope')
    expect(restored.activeReactPresetId).toBeNull()
  })

  it('gives projects saved before this engine existed safe defaults, and repairs corrupt saved values', () => {
    expect(migrateReactStore({ activeReactEngineId: 'oscilloscope' }, 80).xyScopeSettings).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
    const corrupt = migrateReactStore({ xyScopeSettings: { text: 7, parameters: { glow: 'bright' } } }, 80).xyScopeSettings as typeof DEFAULT_XY_SCOPE_SETTINGS
    expect(corrupt.text).toBe('DRMVYZ')
    expect(corrupt.parameters.glow).toBe(1)
  })

  it('resets to defaults with the rest of the React view', () => {
    useReactStore.getState().setXyScopeSettings({ text: 'CHANGED' })
    useReactStore.getState().resetReactView()
    expect(useReactStore.getState().xyScopeSettings).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
  })
})
