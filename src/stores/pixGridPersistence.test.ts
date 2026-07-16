import { beforeEach, describe, expect, it } from 'vitest'
import { PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import { createDefaultPixGridState } from '../components/vyzualz/react/pixGrid/PixGridDefaults'
import {
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

describe('PixGrid persistence and selection invariants', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('migrates pre-PixGrid snapshots to safe defaults', () => {
    const migrated = migrateReactStore({ activeReactEngineId: 'cinematicPortal' }, 47)
    expect(migrated.pixGridState).toEqual(createDefaultPixGridState())
  })

  it('merges all built-in PixGrid presets into older persisted collections', () => {
    const current = useReactStore.getState()
    const merged = mergeReactStoreState({ reactPresets: [] }, current)
    const pixGridPresetIds = merged.reactPresets
      .filter(preset => preset.engine === 'pixGrid')
      .map(preset => preset.id)
    expect(pixGridPresetIds).toEqual([...PIX_GRID_PRESET_IDS])
  })

  it('persists normalized PixGrid state without transient frame data', () => {
    useReactStore.getState().setPixGridState({
      quality: 'low',
      globalIntensity: 0.61,
      pixelOverrides: [[2, 3, '#abcdef', 0.7]],
    })
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.pixGridState).toMatchObject({
      quality: 'low', matrixWidth: 96, matrixHeight: 54, globalIntensity: 0.61,
      pixelOverrides: [[2, 3, '#abcdef', 0.7]],
    })
    expect(persisted.pixGridState).not.toHaveProperty('framebuffer')
    expect(persisted.pixGridState).not.toHaveProperty('canvas')
  })

  it('selecting PixGrid and its presets keeps engine, preset, and state synchronized', () => {
    useReactStore.getState().selectReactEngine('pixGrid')
    let state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('pixGrid')
    expect(PIX_GRID_PRESET_IDS).toContain(state.activeReactPresetId as never)
    expect(state.pixGridState.selectedPresetId).toBe(state.activeReactPresetId)

    useReactStore.getState().selectReactPreset('pix-grid-pixel-parade')
    state = useReactStore.getState()
    expect(state.activeReactEngineId).toBe('pixGrid')
    expect(state.activeReactPresetId).toBe('pix-grid-pixel-parade')
    expect(state.pixGridState).toMatchObject({
      selectedPresetId: 'pix-grid-pixel-parade',
      quality: 'high',
      matrixWidth: 160,
      matrixHeight: 90,
    })
  })
})
