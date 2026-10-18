import { describe, expect, it } from 'vitest'
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
