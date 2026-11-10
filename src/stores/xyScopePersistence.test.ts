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
      parameters: { intensity: 50, beamColor: 'nope', phraseLength: 'bar9' },
    })
    const settings = useReactStore.getState().xyScopeSettings
    expect(settings.text).toHaveLength(16)
    expect(settings.fontId).toBeNull()
    expect(settings.parameters.intensity).toBe(2)
    expect(settings.parameters.beamColor).toBe('#96fff0')
    expect(settings.parameters.phraseLength).toBe('bar4')
  })

  it('persists the word, font and every value as project data and restores them', () => {
    useReactStore.getState().setXyScopeSettings({ text: 'WILDFLY', fontId: 'font-9', presetId: 'storm', parameters: { ...DEFAULT_XY_SCOPE_SETTINGS.parameters, trail: 200 } })
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(REACT_PROJECT_STATE_KEYS).toContain('xyScopeSettings')
    expect(persisted.xyScopeSettings).toMatchObject({ text: 'WILDFLY', fontId: 'font-9', presetId: 'storm' })
    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.xyScopeSettings.text).toBe('WILDFLY')
    expect(restored.xyScopeSettings.parameters.trail).toBe(200)
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
