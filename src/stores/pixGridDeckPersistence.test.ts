import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { splitStorageValue, mergeStorageValues } from '../lib/splitPersistStorage'
import { PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import type { PixGridDeckItemDefinition } from '../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import { usePixGridDeckCompilerStore } from '../components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { createPixGridDeckMediaDeletionGuard } from '../components/vyzualz/react/pixGrid/PixGridDeckMediaDeletion'
import {
  REACT_PROJECT_STATE_KEYS,
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  reconcilePixGridDeckReferenceState,
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

function createDeckPreset(deckId: string) {
  const deck = useReactStore.getState().pixGridDecks.find(candidate => candidate.id === deckId)!
  return useReactStore.getState().createPixGridDeckPreset(deck.id, {
    deckId: deck.id,
    deckRevision: deck.revision,
    enabledItemCount: deck.items.filter(item => item.enabled).length,
    frameProgress: 1,
    transitionProgress: 1,
    ready: true,
    errorCount: 0,
    message: 'Ready to create Preset.',
  })
}

function installFavoriteStorage() {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size },
  } satisfies Storage)
  return storage
}

function deckGraphState() {
  const state = useReactStore.getState()
  return {
    pixGridDecks: state.pixGridDecks,
    generatedPresets: state.reactPresets.filter(preset => preset.pixGridDeck),
    performancePads: state.performancePads,
    presetAutomationCuesByTrackId: state.presetAutomationCuesByTrackId,
    activeReactPresetId: state.activeReactPresetId,
    activeReactEngineId: state.activeReactEngineId,
    pixGridState: state.pixGridState,
    reactControls: {
      intensity: state.reactIntensity,
      motion: state.reactMotion,
      glow: state.reactGlow,
      bass: state.reactBassReactivity,
      trail: state.reactTrailDecay,
      fog: state.reactFogDensity,
      particles: state.reactParticleDensity,
    },
    favorites: JSON.parse(localStorage.getItem('drmvyz.reactPresetFavorites.v1') ?? '[]'),
  }
}

describe('PixGrid Deck project persistence and history', () => {
  beforeEach(() => useReactStore.getState().resetReactView())
  afterEach(() => vi.unstubAllGlobals())

  it('reconciles only invalid Deck-generated references in the pure state-graph helper', () => {
    const pads = useReactStore.getState().performancePads.map((pad, index) => index === 0
      ? { ...pad, presetId: 'pix-grid-deck:removed', label: 'Removed', color: '#111111' }
      : index === 1
        ? { ...pad, presetId: 'preset-unrelated', label: 'Unrelated', color: '#222222' }
        : pad)
    const result = reconcilePixGridDeckReferenceState(new Set(['pix-grid-deck:survivor']), {
      performancePads: pads,
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'removed-1', label: 'Removed 1', timeSec: 1, presetId: 'pix-grid-deck:removed', enabled: true, transitionMs: 0 },
          { id: 'unrelated', label: 'Unrelated', timeSec: 2, presetId: 'preset-unrelated', enabled: true, transitionMs: 0 },
          { id: 'removed-2', label: 'Removed 2', timeSec: 3, presetId: 'pix-grid-deck:removed', enabled: true, transitionMs: 0 },
        ],
      },
      favoritePresetIds: ['pix-grid-deck:removed', 'preset-unrelated'],
      activePresetId: 'pix-grid-deck:removed',
    }, ['pix-grid-deck:removed'])

    expect([...result.removedPresetIds]).toEqual(['pix-grid-deck:removed'])
    expect(result.activePresetRemoved).toBe(true)
    expect(result.performancePads[0]).toMatchObject({ presetId: null, label: 'Empty', color: '#3a4650' })
    expect(result.performancePads[1]).toMatchObject({ presetId: 'preset-unrelated', label: 'Unrelated' })
    expect(result.presetAutomationCuesByTrackId.track.map(cue => cue.id)).toEqual(['unrelated'])
    expect(result.favoritePresetIds).toEqual(['preset-unrelated'])
  })

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
    const historyBeforeRejectedEdit = {
      undo: useReactStore.getState().pixGridDeckUndoStack,
      redo: useReactStore.getState().pixGridDeckRedoStack,
    }
    expect(useReactStore.getState().updatePixGridDeck('valid-first', {
      items: itemDefinitions('valid-first', 1),
    })).toMatchObject({
      ok: false,
      error: { code: 'invalid-item-count' },
    })
    expect(useReactStore.getState().pixGridDecks[0]?.items).toHaveLength(2)
    expect({
      undo: useReactStore.getState().pixGridDeckUndoStack,
      redo: useReactStore.getState().pixGridDeckRedoStack,
    }).toEqual(historyBeforeRejectedEdit)

    const historyBeforeNoOp = {
      undo: useReactStore.getState().pixGridDeckUndoStack,
      redo: useReactStore.getState().pixGridDeckRedoStack,
    }
    expect(useReactStore.getState().renamePixGridDeck('valid-first', 'Valid First')).toEqual({
      ok: true,
      deckId: 'valid-first',
    })
    expect({
      undo: useReactStore.getState().pixGridDeckUndoStack,
      redo: useReactStore.getState().pixGridDeckRedoStack,
    }).toEqual(historyBeforeNoOp)
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

  it('atomically clears generated Preset references on delete and project replacement', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size },
    } satisfies Storage)

    createDeck('referenced-deck', 'Referenced Deck')
    const deck = useReactStore.getState().pixGridDecks[0]!
    useReactStore.getState().createPixGridDeckPreset(deck.id, {
      deckId: deck.id,
      deckRevision: deck.revision,
      enabledItemCount: 2,
      frameProgress: 1,
      transitionProgress: 1,
      ready: true,
      errorCount: 0,
      message: 'Ready to create Preset.',
    })
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index === 0
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : pad),
      presetAutomationCuesByTrackId: {
        'track-1': [{
          id: 'deck-cue',
          timeSec: 4,
          presetId: deck.generatedPresetId,
          label: deck.name,
          enabled: true,
          transitionMs: 0,
        }],
      },
    }))

    expect(useReactStore.getState().deletePixGridDeck(deck.id)).toEqual({ ok: true, deckId: deck.id })
    expect(useReactStore.getState().performancePads[0]).toMatchObject({
      presetId: null,
      label: 'Empty',
      color: '#3a4650',
    })
    expect(useReactStore.getState().presetAutomationCuesByTrackId['track-1']).toEqual([])
    expect(JSON.parse(localStorage.getItem('drmvyz.reactPresetFavorites.v1') ?? '[]')).toEqual([])

    createDeck('old-project-deck', 'Old Project Deck')
    const replacement = {
      ...useReactStore.getState().pixGridDecks[0]!,
      id: 'imported-project-deck',
      name: 'Imported Project Deck',
      generatedPresetId: 'pix-grid-deck:imported-project-deck',
      presetCreated: true,
      items: itemDefinitions('imported-project-deck'),
    }
    const projectEpochBeforeReplacement = useReactStore.getState().pixGridDeckProjectEpoch
    useReactStore.getState().replacePixGridDeckProject([replacement])
    expect(useReactStore.getState().pixGridDeckProjectEpoch).toBe(projectEpochBeforeReplacement + 1)
    expect(useReactStore.getState().pixGridDecks).toEqual([replacement])
    expect(useReactStore.getState().reactPresets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: replacement.generatedPresetId,
        pixGridDeck: { deckId: replacement.id, deckRevision: replacement.revision },
      }),
    ]))
    expect(useReactStore.getState().pixGridDeckUndoStack).toEqual([])
    expect(useReactStore.getState().pixGridDeckRedoStack).toEqual([])
  })

  it('undoes and redoes Deck creation plus generated Preset state without losing dependent references', () => {
    installFavoriteStorage()
    createDeck('creation-graph', 'Creation Graph')
    createDeckPreset('creation-graph')
    const deck = useReactStore.getState().pixGridDecks[0]!
    useReactStore.getState().selectReactPreset(deck.generatedPresetId)
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index < 2
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'creation-cue-1', label: 'Creation Cue 1', timeSec: 1, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
          { id: 'creation-cue-2', label: 'Creation Cue 2', timeSec: 2, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
        ],
      },
    }))
    const afterPresetCreation = deckGraphState()

    useReactStore.getState().undoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toMatchObject({ id: deck.id, presetCreated: false })
    expect(useReactStore.getState().reactPresets.some(preset => preset.id === deck.generatedPresetId)).toBe(false)
    expect(useReactStore.getState().performancePads.slice(0, 2).every(pad => pad.presetId == null)).toBe(true)
    expect(useReactStore.getState().presetAutomationCuesByTrackId.track).toEqual([])
    expect(JSON.parse(localStorage.getItem('drmvyz.reactPresetFavorites.v1') ?? '[]')).toEqual([])

    useReactStore.getState().undoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks).toEqual([])
    useReactStore.getState().redoPixGridDeckEdit()
    expect(useReactStore.getState().pixGridDecks[0]).toMatchObject({ id: deck.id, presetCreated: false })
    useReactStore.getState().redoPixGridDeckEdit()
    expect(deckGraphState()).toEqual(afterPresetCreation)
  })

  it('restores the complete dependent graph through delete, undo, redo, and repeated cycles', () => {
    installFavoriteStorage()
    createDeck('graph-deck', 'Graph Deck')
    expect(createDeckPreset('graph-deck')).toEqual({ ok: true, deckId: 'graph-deck' })
    const deck = useReactStore.getState().pixGridDecks[0]!
    const unrelatedPreset = useReactStore.getState().reactPresets.find(preset => preset.engine === 'pixGrid' && !preset.pixGridDeck)!
    useReactStore.getState().selectReactPreset(deck.generatedPresetId)
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId, unrelatedPreset.id]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index < 2
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : index === 2
          ? { ...pad, presetId: unrelatedPreset.id, label: unrelatedPreset.name, color: '#fedcba' }
          : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'deck-cue-1', label: 'Deck Cue 1', timeSec: 1, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
          { id: 'unrelated-cue', label: 'Unrelated Cue', timeSec: 2, presetId: unrelatedPreset.id, enabled: true, transitionMs: 0 },
          { id: 'deck-cue-2', label: 'Deck Cue 2', timeSec: 3, presetId: deck.generatedPresetId, enabled: true, transitionMs: 100 },
        ],
      },
    }))
    const beforeDelete = deckGraphState()

    expect(useReactStore.getState().deletePixGridDeck(deck.id)).toEqual({ ok: true, deckId: deck.id })
    const afterDelete = deckGraphState()
    expect(afterDelete.generatedPresets).toEqual([])
    expect(afterDelete.performancePads.slice(0, 2).every(pad => pad.presetId == null)).toBe(true)
    expect(afterDelete.performancePads[2]?.presetId).toBe(unrelatedPreset.id)
    expect(afterDelete.presetAutomationCuesByTrackId.track.map(cue => cue.id)).toEqual(['unrelated-cue'])
    expect(afterDelete.favorites).toEqual([unrelatedPreset.id])
    expect(afterDelete.activeReactPresetId).not.toBe(deck.generatedPresetId)

    useReactStore.getState().undoPixGridDeckEdit()
    expect(deckGraphState()).toEqual(beforeDelete)
    useReactStore.getState().redoPixGridDeckEdit()
    expect(deckGraphState()).toEqual(afterDelete)
    useReactStore.getState().undoPixGridDeckEdit()
    expect(deckGraphState()).toEqual(beforeDelete)
  })

  it('deletes one Deck without damaging another Deck generated Preset or its references', () => {
    installFavoriteStorage()
    createDeck('deck-one', 'Deck One')
    createDeckPreset('deck-one')
    createDeck('deck-two', 'Deck Two')
    createDeckPreset('deck-two')
    const [deckOne, deckTwo] = useReactStore.getState().pixGridDecks
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([
      deckOne!.generatedPresetId,
      deckTwo!.generatedPresetId,
    ]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index === 0
        ? { ...pad, presetId: deckOne!.generatedPresetId, label: deckOne!.name, color: '#111111' }
        : index === 1
          ? { ...pad, presetId: deckTwo!.generatedPresetId, label: deckTwo!.name, color: '#222222' }
          : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'deck-one-cue', label: 'Deck One Cue', timeSec: 1, presetId: deckOne!.generatedPresetId, enabled: true, transitionMs: 0 },
          { id: 'deck-two-cue', label: 'Deck Two Cue', timeSec: 2, presetId: deckTwo!.generatedPresetId, enabled: true, transitionMs: 0 },
        ],
      },
    }))

    useReactStore.getState().deletePixGridDeck(deckOne!.id)

    expect(useReactStore.getState().reactPresets.some(preset => preset.id === deckTwo!.generatedPresetId)).toBe(true)
    expect(useReactStore.getState().performancePads[1]?.presetId).toBe(deckTwo!.generatedPresetId)
    expect(useReactStore.getState().presetAutomationCuesByTrackId.track.map(cue => cue.id)).toEqual(['deck-two-cue'])
    expect(JSON.parse(localStorage.getItem('drmvyz.reactPresetFavorites.v1') ?? '[]')).toEqual([deckTwo!.generatedPresetId])
  })

  it('restores the complete pre-transaction graph when a Deck history transaction is cancelled', () => {
    installFavoriteStorage()
    createDeck('cancel-deck', 'Cancel Deck')
    createDeckPreset('cancel-deck')
    const deck = useReactStore.getState().pixGridDecks[0]!
    useReactStore.getState().selectReactPreset(deck.generatedPresetId)
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index === 0
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : pad),
      presetAutomationCuesByTrackId: {
        track: [{ id: 'cancel-cue', label: 'Cancel Cue', timeSec: 4, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 }],
      },
    }))
    const before = deckGraphState()

    useReactStore.getState().beginPixGridDeckHistoryTransaction()
    useReactStore.getState().deletePixGridDeck(deck.id)
    expect(useReactStore.getState().pixGridDecks).toEqual([])
    useReactStore.getState().cancelPixGridDeckHistoryTransaction()

    expect(deckGraphState()).toEqual(before)
  })

  it('restores the exact pre-deletion graph when downstream media deletion rolls back', () => {
    installFavoriteStorage()
    const mediaId = 'db-media-rollback'
    const items = itemDefinitions('media-rollback')
    items[0] = { ...items[0]!, mediaId }
    expect(useReactStore.getState().createPixGridDeck({
      id: 'media-rollback-deck',
      name: 'Media Rollback Deck',
      items,
    })).toEqual({ ok: true, deckId: 'media-rollback-deck' })
    createDeckPreset('media-rollback-deck')
    const deck = useReactStore.getState().pixGridDecks[0]!
    useReactStore.getState().selectReactPreset(deck.generatedPresetId)
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index < 2
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'rollback-cue-1', label: 'Rollback Cue 1', timeSec: 1, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
          { id: 'rollback-cue-2', label: 'Rollback Cue 2', timeSec: 2, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
        ],
      },
    }))
    const before = deckGraphState()
    const guard = createPixGridDeckMediaDeletionGuard(() => useReactStore.getState())
    const decision = guard({ id: mediaId, name: 'rollback.png' } as never, 'delete-affected-decks')
    expect(decision.allowed).toBe(true)
    if (!decision.allowed) throw new Error('Expected confirmed media deletion to be allowed.')

    expect(decision.apply?.()).toBe(true)
    expect(useReactStore.getState().pixGridDecks).toEqual([])
    decision.rollback?.()

    expect(deckGraphState()).toEqual(before)
  })

  it('sanitizes dangling generated Deck references during serialization and project replacement', () => {
    installFavoriteStorage()
    const danglingId = 'pix-grid-deck:missing'
    const unrelatedPreset = useReactStore.getState().reactPresets.find(preset => preset.engine === 'pixGrid')!
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index === 0
        ? { ...pad, presetId: danglingId, label: 'Missing', color: '#111111' }
        : index === 1
          ? { ...pad, presetId: unrelatedPreset.id, label: unrelatedPreset.name, color: '#222222' }
          : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'dangling', label: 'Dangling', timeSec: 1, presetId: danglingId, enabled: true, transitionMs: 0 },
          { id: 'unrelated', label: 'Unrelated', timeSec: 2, presetId: unrelatedPreset.id, enabled: true, transitionMs: 0 },
        ],
      },
    }))

    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.performancePads[0]).toMatchObject({ presetId: null, label: 'Empty' })
    expect(persisted.performancePads[1]?.presetId).toBe(unrelatedPreset.id)
    expect(persisted.presetAutomationCuesByTrackId.track.map(cue => cue.id)).toEqual(['unrelated'])

    useReactStore.getState().replacePixGridDeckProject([])
    expect(useReactStore.getState().performancePads[0]).toMatchObject({ presetId: null, label: 'Empty' })
    expect(useReactStore.getState().performancePads[1]?.presetId).toBe(unrelatedPreset.id)
    expect(useReactStore.getState().presetAutomationCuesByTrackId.track.map(cue => cue.id)).toEqual(['unrelated'])
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
    expect(partialized).not.toHaveProperty('pixGridDeckProjectEpoch')
    const epochBeforeReload = useReactStore.getState().pixGridDeckProjectEpoch
    const reloaded = mergeReactStoreState(migrateReactStore(partialized, 63), useReactStore.getState())
    expect(reloaded.pixGridDeckProjectEpoch).toBe(epochBeforeReload + 1)

    expect(reloaded.pixGridDecks[0]).toMatchObject({ id: deck.id, presetCreated: true })
    expect(reloaded.reactPresets.find(preset => preset.id === deck.generatedPresetId)).toMatchObject({
      id: deck.generatedPresetId,
      pixGridDeck: { deckId: deck.id },
    })
  })

})
