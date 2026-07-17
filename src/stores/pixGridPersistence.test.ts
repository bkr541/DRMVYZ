import { beforeEach, describe, expect, it } from 'vitest'
import { PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import { createDefaultPixGridState } from '../components/vyzualz/react/pixGrid/PixGridDefaults'
import type { PixGridState } from '../components/vyzualz/react/pixGrid/PixGridTypes'
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
      pixelOverrides: [[2, 3, 1, '#abcdef', 0.7]],
    })
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.pixGridState).toMatchObject({
      quality: 'low', matrixWidth: 96, matrixHeight: 54, globalIntensity: 0.61,
      pixelOverrides: [[2, 3, 1, '#abcdef', 0.7]],
    })
    expect(persisted.pixGridState).not.toHaveProperty('framebuffer')
    expect(persisted.pixGridState).not.toHaveProperty('canvas')
  })


  it('persists bounded program overrides and keeps performance resets undoable', () => {
    const base = useReactStore.getState().pixGridState
    const edited: PixGridState = {
      ...base,
      performance: {
        ...base.performance,
        programOverrides: {
          routes: {
            'bass-foundation': {
              enabled: true,
              source: 'tension' as const,
              operation: 'contrast' as const,
              amount: 1.25,
              targetScope: 'group' as const,
              targetId: base.groups[0]!.id,
              sectionTypes: ['drop'],
              dropOccurrences: [2],
            },
          },
          sections: {
            'bass-drop-one': {
              density: 0.72,
              fourBarEnabled: false,
              transitionIn: 'pixelDissolve',
            },
          },
        },
      },
    }
    useReactStore.getState().applyPixGridAuthoringState(edited)
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.pixGridState.performance.programOverrides).toEqual(edited.performance.programOverrides)

    useReactStore.getState().applyPixGridAuthoringState({
      ...useReactStore.getState().pixGridState,
      performance: {
        ...useReactStore.getState().pixGridState.performance,
        programOverrides: { routes: {}, sections: {} },
      },
    })
    expect(useReactStore.getState().pixGridState.performance.programOverrides).toEqual({ routes: {}, sections: {} })
    useReactStore.getState().undoPixGridEdit()
    expect(useReactStore.getState().pixGridState.performance.programOverrides.routes['bass-foundation']).toMatchObject({ source: 'tension', operation: 'contrast', amount: 1.25, targetScope: 'group', targetId: base.groups[0]!.id })
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

describe('PixGrid bounded authoring history', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('coalesces a pixel stroke into one undo entry and restores it with redo', async () => {
    const { applyPixGridOverride } = await import('../components/vyzualz/react/pixGrid/PixGridAuthoring')
    const store = useReactStore.getState()
    store.beginPixGridHistoryTransaction()
    useReactStore.getState().applyPixGridAuthoringState(
      applyPixGridOverride(useReactStore.getState().pixGridState, 1, 1, { kind: 'paint', color: '#ffffff', opacity: 1 }),
    )
    useReactStore.getState().applyPixGridAuthoringState(
      applyPixGridOverride(useReactStore.getState().pixGridState, 2, 1, { kind: 'paint', color: '#ffffff', opacity: 1 }),
    )
    useReactStore.getState().commitPixGridHistoryTransaction()

    expect(useReactStore.getState().pixGridUndoStack).toHaveLength(1)
    expect(useReactStore.getState().pixGridState.pixelOverrides).toHaveLength(2)
    useReactStore.getState().undoPixGridEdit()
    expect(useReactStore.getState().pixGridState.pixelOverrides).toEqual([])
    expect(useReactStore.getState().pixGridRedoStack).toHaveLength(1)
    useReactStore.getState().redoPixGridEdit()
    expect(useReactStore.getState().pixGridState.pixelOverrides).toHaveLength(2)
  })

  it('clears redo after a new edit and closes the overlay on engine switching', async () => {
    const { applyPixGridOverride } = await import('../components/vyzualz/react/pixGrid/PixGridAuthoring')
    useReactStore.getState().setPixGridAuthoringOverlayVisible(true)
    useReactStore.getState().applyPixGridAuthoringState(
      applyPixGridOverride(useReactStore.getState().pixGridState, 3, 3, { kind: 'off' }),
    )
    useReactStore.getState().undoPixGridEdit()
    expect(useReactStore.getState().pixGridRedoStack).toHaveLength(1)

    useReactStore.getState().applyPixGridAuthoringState(
      applyPixGridOverride(useReactStore.getState().pixGridState, 4, 4, { kind: 'off' }),
    )
    expect(useReactStore.getState().pixGridRedoStack).toEqual([])

    useReactStore.getState().selectReactEngine('canvas')
    expect(useReactStore.getState().pixGridState.authoringOverlayVisible).toBe(false)
    expect(useReactStore.getState().pixGridHistoryTransaction).toBeNull()

    useReactStore.getState().selectReactEngine('pixGrid')
    useReactStore.getState().setPixGridAuthoringOverlayVisible(true)
    const nonPixGridPreset = useReactStore.getState().reactPresets.find(preset => preset.engine !== 'pixGrid')
    expect(nonPixGridPreset).toBeDefined()
    useReactStore.getState().selectReactPreset(nonPixGridPreset!.id)
    expect(useReactStore.getState().pixGridState.authoringOverlayVisible).toBe(false)
    expect(useReactStore.getState().pixGridHistoryTransaction).toBeNull()
  })
})
