import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeReactStoreState, migrateReactStore, reactPersistStorage, reactStorePartialize, useReactStore } from './reactStore'

describe('Canvas Show Manager Stage 1 store integration', () => {
  beforeEach(() => {
    useReactStore.setState({
      canvasShowManagerShows: [],
      canvasShowManagerActiveShowId: null,
      canvasShowManagerEditingShowId: null,
      canvasShowManagerEditingSectionId: null,
      canvasShowManagerEditingElementId: null,
      canvasShowManagerUndoStack: [],
      canvasShowManagerRedoStack: [],
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('creates, opens, and rejects blank or duplicate names without touching global Canvas settings', () => {
    const canvasSettings = useReactStore.getState().canvasEngineSettings
    const firstId = useReactStore.getState().createCanvasShowManagerShow('First Show')
    const secondId = useReactStore.getState().createCanvasShowManagerShow('Second Show')

    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()
    expect(useReactStore.getState().createCanvasShowManagerShow('  first   show ')).toBeNull()
    expect(useReactStore.getState().createCanvasShowManagerShow('   ')).toBeNull()
    expect(useReactStore.getState().canvasShowManagerShows).toHaveLength(2)
    expect(useReactStore.getState().canvasEngineSettings).toBe(canvasSettings)

    useReactStore.getState().selectCanvasShowManagerShow(firstId)
    expect(useReactStore.getState().canvasShowManagerEditingShowId).toBe(firstId)
    expect(useReactStore.getState().canvasShowManagerEditingSectionId).toBe(
      useReactStore.getState().canvasShowManagerShows[0]!.sections[0]!.id,
    )
  })

  it('persists only canonical Shows and active identity and reconstructs transient state on reload', () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Persisted')!
    const sectionId = useReactStore.getState().canvasShowManagerShows[0]!.sections[2]!.id
    useReactStore.getState().updateCanvasShowManagerSectionDuration(showId, sectionId, 12)
    useReactStore.setState({ canvasShowManagerActiveShowId: showId })

    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    expect(persisted.canvasShowManagerShows).toHaveLength(1)
    expect(persisted.canvasShowManagerActiveShowId).toBe(showId)
    expect(persisted).not.toHaveProperty('canvasShowManagerEditingShowId')
    expect(persisted).not.toHaveProperty('canvasShowManagerEditingSectionId')
    expect(persisted).not.toHaveProperty('canvasShowManagerEditingElementId')
    expect(persisted).not.toHaveProperty('canvasShowManagerUndoStack')
    expect(persisted).not.toHaveProperty('canvasShowManagerRedoStack')

    const merged = mergeReactStoreState(persisted, useReactStore.getState())
    expect(merged.canvasShowManagerShows[0]!.sections[2]!.durationSec).toBe(12)
    expect(merged.canvasShowManagerActiveShowId).toBe(showId)
    expect(merged.canvasShowManagerEditingShowId).toBeNull()
    expect(merged.canvasShowManagerEditingSectionId).toBeNull()
    expect(merged.canvasShowManagerEditingElementId).toBeNull()
    expect(merged.canvasShowManagerUndoStack).toEqual([])
    expect(merged.canvasShowManagerRedoStack).toEqual([])
  })

  it('normalizes malformed migration data and clears stale active identity without damaging unrelated state', () => {
    const migrated = migrateReactStore({
      canvasShowManagerShows: [{
        id: 'migrated-show',
        name: 'Migrated',
        sections: [{ id: 'intro', durationSec: -1 }],
      }],
      canvasShowManagerActiveShowId: 'missing-show',
      reactIntensity: 0.37,
    }, 69)

    expect(migrated.canvasShowManagerActiveShowId).toBeNull()
    expect((migrated.canvasShowManagerShows as Array<{ sections: unknown[] }>)[0]!.sections).toHaveLength(7)
    expect(migrated.reactIntensity).toBe(0.37)
    expect(migrateReactStore(migrated, 70)).toEqual(migrated)
  })

  it('covers rename, duration ripple edits, and deletion with deterministic undo/redo', () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('History')!
    const sectionId = useReactStore.getState().canvasShowManagerShows[0]!.sections[1]!.id
    useReactStore.getState().clearCanvasShowManagerHistory()

    expect(useReactStore.getState().renameCanvasShowManagerShow(showId, 'Renamed')).toBe(true)
    const edit = useReactStore.getState().updateCanvasShowManagerSectionDuration(showId, sectionId, 10)!
    expect(edit.downstreamShiftSec).toBe(2)
    expect(useReactStore.getState().canvasShowManagerUndoStack).toHaveLength(2)

    useReactStore.getState().undoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.sections[1]!.durationSec).toBe(8)
    useReactStore.getState().undoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.name).toBe('History')
    useReactStore.getState().redoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.name).toBe('Renamed')

    useReactStore.setState({ canvasShowManagerActiveShowId: showId })
    expect(useReactStore.getState().deleteCanvasShowManagerShow(showId)).toBe(true)
    expect(useReactStore.getState().canvasShowManagerShows).toEqual([])
    expect(useReactStore.getState().canvasShowManagerActiveShowId).toBeNull()
    useReactStore.getState().undoCanvasShowManagerEdit()
    expect(useReactStore.getState().canvasShowManagerShows[0]!.id).toBe(showId)
    expect(useReactStore.getState().canvasShowManagerActiveShowId).toBe(showId)
  })

  it('saves and makes a valid Show active atomically without changing Canvas runtime state', async () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Active')!
    const canvasSettings = useReactStore.getState().canvasEngineSettings
    vi.spyOn(reactPersistStorage, 'setItem').mockResolvedValue()

    await expect(useReactStore.getState().saveCanvasShowManagerShow(showId, { makeActive: true })).resolves.toBe(true)
    const state = useReactStore.getState()
    expect(state.canvasShowManagerActiveShowId).toBe(showId)
    expect(state.activeReactEngineId).toBe('canvas')
    expect(state.activeReactPresetId).toBeNull()
    expect(state.canvasEngineSettings).toBe(canvasSettings)
  })

  it('rejects Save + Make Active when authoring changes while persistence is pending', async () => {
    const showId = useReactStore.getState().createCanvasShowManagerShow('Concurrent')!
    const sectionId = useReactStore.getState().canvasShowManagerShows[0]!.sections[0]!.id
    const deferred: { resolve?: () => void } = {}
    let persistenceCall = 0
    vi.spyOn(reactPersistStorage, 'setItem').mockImplementation(() => {
      persistenceCall += 1
      if (persistenceCall > 1) return Promise.resolve()
      return new Promise<void>(resolve => {
        deferred.resolve = resolve
      })
    })

    const save = useReactStore.getState().saveCanvasShowManagerShow(showId, { makeActive: true })
    useReactStore.getState().updateCanvasShowManagerSectionDuration(showId, sectionId, 9)
    deferred.resolve?.()

    await expect(save).resolves.toBe(false)
    expect(useReactStore.getState().canvasShowManagerActiveShowId).toBeNull()

    const persistedCalls = vi.mocked(reactPersistStorage.setItem).mock.calls
    expect(persistedCalls).toHaveLength(2)
    const optimistic = persistedCalls[0]![1] as { state: Record<string, unknown> }
    const rollback = persistedCalls[1]![1] as { state: Record<string, unknown> }
    expect(optimistic.state.canvasShowManagerActiveShowId).toBe(showId)
    expect(rollback.state.canvasShowManagerActiveShowId).toBeNull()
    expect((rollback.state.canvasShowManagerShows as Array<{ sections: Array<{ durationSec: number }> }>)[0]!.sections[0]!.durationSec).toBe(9)

    const reloaded = mergeReactStoreState(rollback.state, useReactStore.getState())
    expect(reloaded.canvasShowManagerActiveShowId).toBeNull()
    expect(reloaded.canvasShowManagerShows[0]!.sections[0]!.durationSec).toBe(9)
  })
})
