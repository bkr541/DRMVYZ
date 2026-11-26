import { describe, expect, it } from 'vitest'
import { cinema2MediaDeletionGuard, subscribeCinema2MediaDeletion } from './cinema2MediaDeletion'
import { CINEMA2_EVERYWHERE_PRESET_ID } from '../components/vyzualz/cinema2/presets/Cinema2EverywherePreset'
import { CINEMA2_CORRIDOR_PRESET_ID } from '../components/vyzualz/cinema2/presets/Cinema2CorridorPreset'
import { CINEMA2_OVERDRIVE_PRESET_ID } from '../components/vyzualz/cinema2/presets/Cinema2OverdrivePreset'
import {
  CINEMA2_REACTOR_CORE_SIZE_ID,
  CINEMA2_REACTOR_PRESET_ID,
  activateCinema2Workspace,
  archiveLegacyCinemaDocument,
  createEmptyCinema2WorkspaceDocument,
  getCinema2WorkspacePresetState,
} from '../components/vyzualz/cinema2'
import {
  REACT_PROJECT_STATE_KEYS,
  mergeReactStoreState,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

describe('Cinema 2.0 project persistence', () => {
  it('clears a deleted pool from active and inactive presets atomically and on reload', () => {
    const original = useReactStore.getState()
    try {
      useReactStore.setState({ cinema2Workspace: createEmptyCinema2WorkspaceDocument() })
      const store = useReactStore.getState()
      store.setCanvasOrchestrationSettings({ mediaPools: [
        { id: 'deleted-pool', name: 'Deleted', mediaIds: ['a'], textItems: [] },
        { id: 'keep-pool', name: 'Keep', mediaIds: [], textItems: [] },
      ], activeMediaPoolId: 'deleted-pool' })
      for (const presetId of [CINEMA2_EVERYWHERE_PRESET_ID, CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_OVERDRIVE_PRESET_ID]) {
        const activated = store.activateCinema2Workspace({ presetId })
        expect(activated.ok).toBe(true)
        if (activated.ok && activated.state) store.storeCinema2WorkspacePresetState({
          ...activated.state, poolId: presetId === CINEMA2_CORRIDOR_PRESET_ID ? 'keep-pool' : 'deleted-pool',
        })
      }
      const before = reactStorePartialize(useReactStore.getState())
      const observations: (string | null | undefined)[][] = []
      const unsubscribe = useReactStore.subscribe(state => {
        if (!state.canvasOrchestrationSettings.mediaPools.some(pool => pool.id === 'deleted-pool')) {
          observations.push(state.cinema2Workspace.presets.map(preset => preset.poolId))
        }
      })
      try { expect(store.deleteCanvasMediaPool('deleted-pool').ok).toBe(true) } finally { unsubscribe() }
      expect(observations).not.toHaveLength(0)
      expect(observations.every(ids => !ids.includes('deleted-pool'))).toBe(true)
      const after = useReactStore.getState()
      expect(after.canvasOrchestrationSettings.activeMediaPoolId).toBeNull()
      expect(getCinema2WorkspacePresetState(after.cinema2Workspace, CINEMA2_EVERYWHERE_PRESET_ID)?.poolId).toBeNull()
      expect(getCinema2WorkspacePresetState(after.cinema2Workspace, CINEMA2_OVERDRIVE_PRESET_ID)?.poolId).toBeNull()
      expect(getCinema2WorkspacePresetState(after.cinema2Workspace, CINEMA2_CORRIDOR_PRESET_ID)?.poolId).toBe('keep-pool')
      // Older sessions can contain orphaned references even without a deletion event.
      const legacy = JSON.parse(JSON.stringify(before))
      legacy.canvasOrchestrationSettings = after.canvasOrchestrationSettings
      const restored = mergeReactStoreState(legacy, original)
      expect(restored.cinema2Workspace.presets.map(preset => preset.poolId).sort()).toEqual(['keep-pool', null, null].sort())
      const roundTrip = mergeReactStoreState(JSON.parse(JSON.stringify(reactStorePartialize(after))), original)
      expect(roundTrip.cinema2Workspace).toEqual(after.cinema2Workspace)
      store.setCanvasOrchestrationSettings({ mediaPools: [] })
      expect(getCinema2WorkspacePresetState(useReactStore.getState().cinema2Workspace, CINEMA2_CORRIDOR_PRESET_ID)?.poolId).toBeNull()
    } finally {
      useReactStore.setState(original)
    }
  })

  it('notifies live owners only on a committed media deletion', () => {
    const calls: string[] = []
    const unsubscribe = subscribeCinema2MediaDeletion(id => calls.push(id))
    try {
      const guard = cinema2MediaDeletionGuard({ id: 'removed-media' } as Parameters<typeof cinema2MediaDeletionGuard>[0])
      if (!guard.allowed) throw new Error('Deletion should be allowed')
      guard.apply?.()
      guard.rollback?.()
      expect(calls).toEqual([])
      guard.apply?.()
      guard.commit?.()
      expect(calls).toEqual(['removed-media'])
    } finally { unsubscribe() }
  })

  it('includes the versioned workspace in project save/load and save-as copies', () => {
    const activated = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
      presetId: CINEMA2_REACTOR_PRESET_ID,
      look: { id: 'saved-look' },
      parameterPatch: { [CINEMA2_REACTOR_CORE_SIZE_ID]: 1.05 },
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return

    const workspace = archiveLegacyCinemaDocument(
      activated.document,
      { schemaId: 'drmvyz.cinema.store', schemaVersion: 8, compositions: [{ id: 'custom' }] },
      '2026-10-18T12:00:00.000Z',
    )
    const current = useReactStore.getState()
    const persisted = reactStorePartialize({ ...current, cinema2Workspace: workspace })
    expect(REACT_PROJECT_STATE_KEYS).toContain('cinema2Workspace')

    const projectSaveAsCopy = JSON.parse(JSON.stringify(persisted))
    const restored = mergeReactStoreState(projectSaveAsCopy, current)
    const restoredPreset = getCinema2WorkspacePresetState(restored.cinema2Workspace, CINEMA2_REACTOR_PRESET_ID)
    expect(restored.cinema2Workspace.activePresetId).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(restoredPreset?.lookId).toBe('saved-look')
    expect(JSON.parse(restoredPreset!.serializedParameterState).values[CINEMA2_REACTOR_CORE_SIZE_ID]).toBe(1.05)
    expect(restored.cinema2Workspace.legacyArchive?.payload).toMatchObject({ compositions: [{ id: 'custom' }] })
  })

  it('exposes one atomic activation action for future pads, cues, sections, and migrations', () => {
    useReactStore.setState({ cinema2Workspace: createEmptyCinema2WorkspaceDocument() })
    const result = useReactStore.getState().activateCinema2Workspace({
      presetId: CINEMA2_REACTOR_PRESET_ID,
      parameterPatch: { [CINEMA2_REACTOR_CORE_SIZE_ID]: 1.05 },
    })
    expect(result.ok).toBe(true)
    expect(useReactStore.getState().cinema2Workspace.activePresetId).toBe(CINEMA2_REACTOR_PRESET_ID)
  })
})
