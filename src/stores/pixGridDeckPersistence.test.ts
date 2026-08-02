import { beforeEach, describe, expect, it } from 'vitest'
import { splitStorageValue, mergeStorageValues } from '../lib/splitPersistStorage'
import { PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import type { PixGridDeckItemDefinition } from '../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import {
  REACT_PROJECT_STATE_KEYS,
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

function itemDefinitions(prefix: string, count = 2): PixGridDeckItemDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-item-${index + 1}`,
    mediaId: `${prefix}-media-${index + 1}`,
    enabled: true,
    order: index,
    revision: 1,
    timingOverrideBeats: null,
  }))
}

function createDeck(id: string, name: string, count = 2) {
  return useReactStore.getState().createPixGridDeck({
    id,
    name,
    items: itemDefinitions(id, count),
  })
}

describe('PixGrid Deck project persistence and history', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('rejects case-folded duplicate names with a deterministic validation error', () => {
    expect(createDeck('deck-a', 'Deck A')).toEqual({ ok: true, deckId: 'deck-a' })
    expect(createDeck('deck-b', ' deck a ')).toEqual({
      ok: false,
      error: {
        code: 'duplicate-name',
        message: 'A PixGrid Deck named "deck a" already exists.',
        path: 'name',
      },
    })
  })

  it('preserves stable IDs across rename and isolates Deck undo/redo from PixGrid document edits', () => {
    expect(createDeck('deck-stable', 'Original')).toEqual({ ok: true, deckId: 'deck-stable' })
    const original = useReactStore.getState().pixGridDecks[0]!
    useReactStore.getState().setPixGridState({ globalIntensity: 0.37 })

    expect(useReactStore.getState().renamePixGridDeck('deck-stable', 'Renamed')).toEqual({
      ok: true,
      deckId: 'deck-stable',
    })
    const renamed = useReactStore.getState().pixGridDecks[0]!
    expect(renamed).toMatchObject({
      id: original.id,
      name: 'Renamed',
      generatedPresetId: original.generatedPresetId,
      revision: original.revision + 1,
    })

    useReactStore.getState().undoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toEqual(original)
    expect(useReactStore.getState().pixGridState.globalIntensity).toBe(0.37)

    useReactStore.getState().redoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toEqual(renamed)
    expect(useReactStore.getState().pixGridState.globalIntensity).toBe(0.37)
  })

  it('coalesces a Deck edit transaction into one exact undo snapshot', () => {
    createDeck('deck-transaction', 'Transaction')
    const before = useReactStore.getState().pixGridDecks
    useReactStore.getState().beginPixGridDeckHistoryTransaction()
    useReactStore.getState().renamePixGridDeck('deck-transaction', 'Transaction A')
    useReactStore.getState().updatePixGridDeck('deck-transaction', {
      configuration: {
        ...useReactStore.getState().pixGridDecks[0]!.configuration,
        playbackOrder: 'pingPong',
      },
    })
    useReactStore.getState().commitPixGridDeckHistoryTransaction()

    expect(useReactStore.getState().pixGridDeckUndoStack).toHaveLength(2)
    useReactStore.getState().undoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks).toEqual(before)
    useReactStore.getState().redoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toMatchObject({
      name: 'Transaction A',
      configuration: { playbackOrder: 'pingPong' },
    })
  })

  it('prevents invalid item bounds from entering canonical store state', () => {
    expect(createDeck('one-item', 'One item', 1)).toMatchObject({
      ok: false,
      error: { code: 'invalid-item-count' },
    })
    expect(createDeck('thirteen-items', 'Thirteen items', 13)).toMatchObject({
      ok: false,
      error: { code: 'invalid-item-count' },
    })
    expect(createDeck('valid-first', 'Valid First')).toEqual({ ok: true, deckId: 'valid-first' })
    expect(useReactStore.getState().updatePixGridDeck('valid-first', {
      items: itemDefinitions('valid-first', 1),
    })).toMatchObject({
      ok: false,
      error: { code: 'invalid-item-count' },
    })
    expect(useReactStore.getState().pixGridDecks[0]?.items).toHaveLength(2)
  })

  it('round-trips the actual partialized and split production store shape through migration and merge', () => {
    createDeck('deck-round-trip', 'Round Trip', 3)
    useReactStore.getState().updatePixGridDeck('deck-round-trip', {
      configuration: {
        ...useReactStore.getState().pixGridDecks[0]!.configuration,
        playbackOrder: 'sectionAssigned',
        reactionProfileId: 'react-profile-1',
        sectionTimingBeats: { intro: 8, drop: 2 },
        sectionItemAssignments: {
          intro: ['deck-round-trip-item-2', 'deck-round-trip-item-1'],
        },
      },
    })
    const expected = useReactStore.getState().pixGridDecks
    const partialized = reactStorePartialize(useReactStore.getState())
    const split = splitStorageValue(
      { state: partialized, version: 62 },
      REACT_PROJECT_STATE_KEYS,
    )
    const reconstructedEnvelope = mergeStorageValues(split.local, split.project)!
    const migrated = migrateReactStore(reconstructedEnvelope.state, 61)
    const reloaded = mergeReactStoreState(migrated, useReactStore.getState())

    expect(split.project.state.pixGridDecks).toEqual(expected)
    expect(split.local.state).not.toHaveProperty('pixGridDecks')
    expect(reloaded.pixGridDecks).toEqual(expected)
    expect(reloaded.pixGridDeckUndoStack).toEqual([])
    expect(reloaded.pixGridDeckRedoStack).toEqual([])
    expect(reloaded.pixGridDeckHistoryTransaction).toBeNull()
  })

  it('strips runtime-only fields and quarantines malformed imported Decks without damaging unrelated state', () => {
    const current = useReactStore.getState()
    const customPixGridPreset = {
      ...current.reactPresets.find(preset => preset.engine === 'pixGrid')!,
      id: 'custom-pix-grid-preset',
      name: 'Custom PixGrid Preset',
    }
    const imported = migrateReactStore({
      activeReactEngineId: 'canvas',
      reactIntensity: 0.42,
      reactPresets: [customPixGridPreset],
      pixGridDecks: [
        {
          id: 'valid-import',
          name: ' Imported ',
          items: itemDefinitions('valid-import'),
          compiledFrames: new Uint8Array([1, 2, 3]),
          objectUrl: 'blob:not-persistable',
          worker: { postMessage() {} },
        },
        { id: 'invalid-import', name: 'Broken', items: itemDefinitions('invalid-import', 1) },
        { id: 'future-import', schemaVersion: 8, name: 'Future', items: itemDefinitions('future-import') },
      ],
    }, 61)
    const merged = mergeReactStoreState(imported, current)
    const persisted = reactStorePartialize(merged) as Record<string, unknown>

    expect(merged.activeReactEngineId).toBe('canvas')
    expect(merged.reactIntensity).toBe(0.42)
    expect(merged.pixGridDecks).toHaveLength(1)
    expect(merged.pixGridDecks[0]).toMatchObject({ id: 'valid-import', name: 'Imported' })
    expect(merged.pixGridDecks[0]).not.toHaveProperty('compiledFrames')
    expect(merged.pixGridDecks[0]).not.toHaveProperty('objectUrl')
    expect(merged.pixGridDecks[0]).not.toHaveProperty('worker')
    expect(persisted).not.toHaveProperty('pixGridDeckUndoStack')
    expect(persisted).not.toHaveProperty('pixGridDeckRedoStack')
    expect(persisted).not.toHaveProperty('pixGridDeckHistoryTransaction')

    const pixGridPresetIds = merged.reactPresets
      .filter(preset => preset.engine === 'pixGrid')
      .map(preset => preset.id)
    expect(pixGridPresetIds).toEqual([...PIX_GRID_PRESET_IDS, 'custom-pix-grid-preset'])
    expect(merged.reactPresets.find(preset => preset.id === 'custom-pix-grid-preset')).toEqual(customPixGridPreset)
  })

  it('loads old projects with no Deck field as empty and persists deletion across reload', () => {
    const current = useReactStore.getState()
    expect(mergeReactStoreState(migrateReactStore({}, 61), current).pixGridDecks).toEqual([])

    createDeck('delete-me', 'Delete Me')
    expect(useReactStore.getState().deletePixGridDeck('delete-me')).toEqual({ ok: true, deckId: 'delete-me' })
    const savedAfterDelete = reactStorePartialize(useReactStore.getState())
    const reloaded = mergeReactStoreState(migrateReactStore(savedAfterDelete, 62), current)
    expect(reloaded.pixGridDecks).toEqual([])
  })
})
