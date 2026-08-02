import { beforeEach, describe, expect, it } from 'vitest'
import { splitStorageValue, mergeStorageValues } from '../lib/splitPersistStorage'
import { PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import type { PixGridDeckItemDefinition } from '../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import { usePixGridDeckCompilerStore } from '../components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
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
    source: {
      mediaRevision: 1,
      fingerprint: `sha256:${String(index + 1).padStart(64, '0')}`,
      fileName: `${prefix}-${index + 1}.png`,
      mimeType: 'image/png',
      width: 640,
      height: 360,
      hasAlpha: false,
      transparentBackground: '#000000',
    },
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


  it('requires committed source links to enter through the validated ingestion contract', () => {
    const result = useReactStore.getState().createPixGridDeck({
      id: 'unvalidated-source',
      name: 'Unvalidated Source',
      items: [
        { mediaId: 'media-a' },
        { mediaId: 'media-b' },
      ],
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'invalid-deck',
        message: 'PixGrid Deck images must be linked through the validated media-ingestion service.',
        path: 'items',
      },
    })
    expect(useReactStore.getState().pixGridDecks).toEqual([])
  })

  it('keeps committed media identity and source snapshots immutable during normal Deck edits', () => {
    expect(createDeck('immutable-source', 'Immutable Source')).toEqual({ ok: true, deckId: 'immutable-source' })
    const current = useReactStore.getState().pixGridDecks[0]
    const editedItems = current.items.map((item, index) => index === 0
      ? { ...item, mediaId: 'media-replacement', source: { ...item.source, fileName: 'replacement.png' } }
      : item)

    expect(useReactStore.getState().updatePixGridDeck(current.id, { items: editedItems })).toMatchObject({
      ok: false,
      error: { code: 'invalid-deck', path: 'items' },
    })
    expect(useReactStore.getState().updatePixGridDeck(current.id, {
      items: current.items.map(item => ({ ...item, enabled: !item.enabled })),
    })).toEqual({ ok: true, deckId: current.id })
    expect(useReactStore.getState().pixGridDecks[0].items[0].mediaId).toBe(current.items[0].mediaId)
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
        reactionProfileId: 'highEnergy',
        sectionTimingBeats: { intro: 8, drop: 2 },
        sectionItemAssignments: {
          intro: ['deck-round-trip-item-2', 'deck-round-trip-item-1'],
        },
      },
    })
    const expected = useReactStore.getState().pixGridDecks
    const partialized = reactStorePartialize(useReactStore.getState())
    const split = splitStorageValue(
      { state: partialized, version: 63 },
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

  it('keeps compile progress and prepared buffers outside project persistence', () => {
    createDeck('runtime-only', 'Runtime Only')
    usePixGridDeckCompilerStore.getState().setStatuses({
      'runtime-only': {
        deckId: 'runtime-only',
        deckRevision: 1,
        width: 160,
        height: 90,
        phase: 'compiling',
        progress: 0.5,
        ready: false,
        enabledItemCount: 2,
        readyItemCount: 1,
        failedItemCount: 0,
        items: [],
      },
    })
    const persisted = reactStorePartialize(useReactStore.getState()) as Record<string, unknown>
    const serialized = JSON.stringify(persisted)
    expect(persisted).not.toHaveProperty('pixGridDeckCompiler')
    expect(serialized).not.toContain('runtime-only":{"deckId"')
    expect(serialized).not.toContain('Uint8Array')
    usePixGridDeckCompilerStore.getState().clear()
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


  it('migrates Stage 1 Deck items to deterministic source snapshots without persisting runtime URLs', () => {
    const legacyItems = itemDefinitions('legacy').map(({ source: _source, ...item }) => ({
      ...item,
      signedUrl: 'https://signed.example/temporary',
      objectUrl: 'blob:temporary',
    }))
    const migrated = migrateReactStore({
      pixGridDecks: [{ id: 'legacy-deck', name: 'Legacy Deck', items: legacyItems }],
    }, 62)
    const merged = mergeReactStoreState(migrated, useReactStore.getState())

    expect(merged.pixGridDecks[0].items).toHaveLength(2)
    expect(merged.pixGridDecks[0].items[0].source).toMatchObject({
      mediaRevision: 1,
      fingerprint: expect.stringMatching(/^legacy:/),
      fileName: null,
      mimeType: null,
      transparentBackground: '#000000',
    })
    expect(merged.pixGridDecks[0].items[0]).not.toHaveProperty('signedUrl')
    expect(merged.pixGridDecks[0].items[0]).not.toHaveProperty('objectUrl')
  })

  it('loads old projects with no Deck field as empty and persists deletion across reload', () => {
    const current = useReactStore.getState()
    expect(mergeReactStoreState(migrateReactStore({}, 61), current).pixGridDecks).toEqual([])

    createDeck('delete-me', 'Delete Me')
    expect(useReactStore.getState().deletePixGridDeck('delete-me')).toEqual({ ok: true, deckId: 'delete-me' })
    const savedAfterDelete = reactStorePartialize(useReactStore.getState())
    const reloaded = mergeReactStoreState(migrateReactStore(savedAfterDelete, 63), current)
    expect(reloaded.pixGridDecks).toEqual([])
  })

  it('gates explicit Preset creation, preserves custom provenance, and synchronizes rename/delete through undo', () => {
    expect(createDeck('preset-lifecycle', 'Preset Lifecycle')).toEqual({ ok: true, deckId: 'preset-lifecycle' })
    const initial = useReactStore.getState().pixGridDecks[0]!
    const staleReadiness = {
      deckId: initial.id,
      deckRevision: initial.revision - 1,
      enabledItemCount: 2,
      frameProgress: 1,
      transitionProgress: 1,
      ready: true,
      errorCount: 0,
      message: 'Ready to create Preset.',
    }
    expect(useReactStore.getState().createPixGridDeckPreset(initial.id, staleReadiness)).toMatchObject({
      ok: false,
      error: { code: 'deck-not-ready', path: 'readiness' },
    })
    expect(useReactStore.getState().reactPresets.some(preset => preset.id === initial.generatedPresetId)).toBe(false)

    const readiness = { ...staleReadiness, deckRevision: initial.revision }
    expect(useReactStore.getState().createPixGridDeckPreset(initial.id, readiness)).toEqual({
      ok: true,
      deckId: initial.id,
    })
    const createdDeck = useReactStore.getState().pixGridDecks[0]!
    expect(createdDeck).toMatchObject({ presetCreated: true, revision: initial.revision })
    expect(useReactStore.getState().reactPresets.find(preset => preset.id === initial.generatedPresetId)).toMatchObject({
      id: initial.generatedPresetId,
      name: 'Preset Lifecycle',
      pixGridDeck: { deckId: initial.id, deckRevision: initial.revision },
    })

    useReactStore.getState().selectReactPreset(initial.generatedPresetId)
    expect(useReactStore.getState().pixGridState.configuration).toMatchObject({
      origin: 'custom',
      sourcePresetId: initial.generatedPresetId,
    })

    const selectedState = useReactStore.getState().pixGridState
    useReactStore.setState({
      pixGridState: {
        ...selectedState,
        layers: selectedState.layers.map((layer, index) => index === 0 ? { ...layer, opacity: 0.17 } : layer),
      },
    })
    useReactStore.getState().selectReactPreset(initial.generatedPresetId)
    expect(useReactStore.getState().pixGridState.layers[0]?.opacity).toBe(1)

    expect(useReactStore.getState().renamePixGridDeck(initial.id, 'Renamed Lifecycle')).toEqual({
      ok: true,
      deckId: initial.id,
    })
    expect(useReactStore.getState().reactPresets.find(preset => preset.id === initial.generatedPresetId)).toMatchObject({
      id: initial.generatedPresetId,
      name: 'Renamed Lifecycle',
    })

    expect(useReactStore.getState().deletePixGridDeck(initial.id)).toEqual({ ok: true, deckId: initial.id })
    expect(useReactStore.getState().pixGridDecks).toEqual([])
    expect(useReactStore.getState().reactPresets.some(preset => preset.id === initial.generatedPresetId)).toBe(false)
    expect(useReactStore.getState().activeReactPresetId).not.toBe(initial.generatedPresetId)

    useReactStore.getState().undoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toMatchObject({ id: initial.id, name: 'Renamed Lifecycle' })
    expect(useReactStore.getState().reactPresets.find(preset => preset.id === initial.generatedPresetId)).toMatchObject({
      id: initial.generatedPresetId,
      name: 'Renamed Lifecycle',
    })
  })

  it('reconstructs explicit generated Preset linkage from persisted project state', () => {
    createDeck('reload-preset', 'Reload Preset')
    const deck = useReactStore.getState().pixGridDecks[0]!
    const readiness = {
      deckId: deck.id,
      deckRevision: deck.revision,
      enabledItemCount: 2,
      frameProgress: 1,
      transitionProgress: 1,
      ready: true,
      errorCount: 0,
      message: 'Ready to create Preset.',
    }
    useReactStore.getState().createPixGridDeckPreset(deck.id, readiness)
    const partialized = reactStorePartialize(useReactStore.getState())
    const reloaded = mergeReactStoreState(migrateReactStore(partialized, 63), useReactStore.getState())

    expect(reloaded.pixGridDecks[0]).toMatchObject({ id: deck.id, presetCreated: true })
    expect(reloaded.reactPresets.find(preset => preset.id === deck.generatedPresetId)).toMatchObject({
      id: deck.generatedPresetId,
      pixGridDeck: { deckId: deck.id },
    })
  })

})
