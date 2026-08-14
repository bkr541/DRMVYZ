import { beforeEach, describe, expect, it } from 'vitest'
import {
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  useReactStore,
} from './reactStore'
import { DEFAULT_HEADLINER_SETTINGS } from '../components/vyzualz/react/headliner/HeadlinerSettings'

describe('Headliner Stage 1 store and persistence contract', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('selects Headliner through the canonical engine action without inventing a preset', () => {
    useReactStore.getState().selectReactEngine('headliner')
    const state = useReactStore.getState()

    expect(state.activeReactEngineId).toBe('headliner')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('normalizes canonical mutations back to Fullscreen/default front camera', () => {
    useReactStore.getState().setHeadlinerSettings({
      mode: 'mirror' as never,
      inputSourceId: 'camera-2' as never,
    })

    expect(useReactStore.getState().headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('persists only stable Headliner authoring preferences and restores the preset-free selection', () => {
    useReactStore.getState().selectReactEngine('headliner')
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>

    expect(persisted.headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)
    expect(persisted.activeReactEngineId).toBe('headliner')
    expect(persisted.activeReactPresetId).toBeNull()
    expect(persisted).not.toHaveProperty('cameraStream')
    expect(persisted).not.toHaveProperty('cameraPermissionState')

    const restored = mergeReactStoreState(persisted, useReactStore.getState())
    expect(restored.activeReactEngineId).toBe('headliner')
    expect(restored.activeReactPresetId).toBeNull()
    expect(restored.headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('migrates missing or unknown pre-Stage-1 settings to safe defaults', () => {
    const missing = migrateReactStore({ activeReactEngineId: 'headliner' }, 75)
    expect(missing.headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)

    const corrupt = migrateReactStore({
      activeReactEngineId: 'headliner',
      headlinerSettings: { mode: 'quad', inputSourceId: 'camera-9' },
    }, 75)
    expect(corrupt.headlinerSettings).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })
})
