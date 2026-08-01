import { beforeEach, describe, expect, it } from 'vitest'
import { PIX_GRID_PRESET_BY_ID, PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import { createDefaultPixGridState } from '../components/vyzualz/react/pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../components/vyzualz/react/pixGrid/PixGridState'
import { inspectPixGridCanonicalPresetIntegrity, migratePixGridState } from '../components/vyzualz/react/pixGrid/PixGridStateMigration'
import { PIX_GRID_STATE_VERSION, type PixGridState } from '../components/vyzualz/react/pixGrid/PixGridTypes'
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

  it('rehydrates legacy nonempty artwork with current built-in routing instead of treating layers as completeness', () => {
    const current = useReactStore.getState()
    const legacy = {
      ...current.pixGridState,
      version: PIX_GRID_STATE_VERSION - 1,
      configuration: undefined,
      groups: [],
      audioAssignments: [],
      performance: {
        ...current.pixGridState.performance,
        sharedPerformanceProgramId: null,
      },
    }
    const migratedPersisted = migrateReactStore({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: current.pixGridState.selectedPresetId,
      pixGridState: legacy,
    }, 54)
    const merged = mergeReactStoreState(migratedPersisted, current)

    expect(merged.pixGridState.layers).toEqual(current.pixGridState.layers)
    expect(merged.pixGridState.groups.length).toBeGreaterThan(0)
    expect(merged.pixGridState.audioAssignments.length).toBeGreaterThan(0)
    expect(merged.pixGridState.performance.sharedPerformanceProgramId).not.toBeNull()
    expect(merged.pixGridState.configuration.lastMigration?.applied).toBe(true)
    const repeated = mergeReactStoreState({ pixGridState: merged.pixGridState }, current)
    expect(repeated.pixGridState).toEqual(merged.pixGridState)
  })

  it('repairs the real persisted one-layer Marquee document after stale preset hydration and remains idempotent', () => {
    const current = useReactStore.getState()
    const presetId = 'pix-grid-neon-marquee-cycle'
    const canonicalPreset = PIX_GRID_PRESET_BY_ID.get(presetId)!
    const structure = canonicalPreset.pixGridSettings!.layers!.find(layer => layer.id === 'marquee-structure')!
    const legacyLayer = {
      ...structure,
      id: 'neon-marquee-frame',
      name: 'Neon Marquee Frame',
      assetId: 'pix-neon-marquee-cycle' as const,
      animations: [],
    }
    const stalePreset = {
      ...canonicalPreset,
      pixGridSettings: {
        ...canonicalPreset.pixGridSettings!,
        authoredConfigurationVersion: 1,
        layers: [legacyLayer],
        groups: [],
        audioAssignments: [],
        performanceProgramId: null,
      },
    }
    const legacyBase = applyPixGridPresetSettings(
      createDefaultPixGridState(),
      presetId,
      stalePreset.pixGridSettings,
    )
    const overlay = {
      ...structure,
      id: 'user-marquee-overlay',
      name: 'User Marquee Overlay',
      mediaId: 'user-media-1',
      animations: [],
    }
    const legacyState: PixGridState = {
      ...legacyBase,
      configuration: {
        ...legacyBase.configuration,
        metadataVersion: 0 as never,
        origin: 'custom',
        sourcePresetId: presetId,
        presetConfigurationVersion: 1,
        layerGraphVersion: 1,
        smartGroupConfigurationVersion: 0,
        audioRouteConfigurationVersion: 0,
        performanceProgramConfigurationVersion: 0,
        musicReactiveConfigurationVersion: 0,
        userCustomized: true,
        legacyOfficialLayerGraph: true,
        genuineUserLayers: true,
        canonicalMigrationCompleted: false,
      },
      layers: [legacyLayer, overlay],
      scenes: legacyBase.scenes.map(scene => ({ ...scene, layerIds: [legacyLayer.id, overlay.id] })),
      groups: [],
      audioAssignments: [],
      performance: {
        ...legacyBase.performance,
        enabled: true,
        sharedPerformanceProgramId: null,
      },
      editor: {
        ...legacyBase.editor,
        selectedLayerId: legacyLayer.id,
        scenePreviewMode: 'selectedScene',
      },
    }

    const directMigration = migratePixGridState(legacyState, stalePreset)
    expect(inspectPixGridCanonicalPresetIntegrity(directMigration, presetId).complete).toBe(true)

    const merged = mergeReactStoreState({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: presetId,
      reactPresets: [stalePreset],
      pixGridState: legacyState,
      reactMotion: 0.73,
    }, current)
    const integrity = inspectPixGridCanonicalPresetIntegrity(merged.pixGridState, presetId)

    expect(integrity).toMatchObject({
      complete: true,
      canonicalLayerCount: 12,
      requiredLayerCount: 12,
      canonicalGroupCount: 14,
      requiredGroupCount: 14,
      obsoleteOfficialLayerIds: [],
      performanceProgramMatches: true,
    })
    expect(merged.reactPresets.find(preset => preset.id === presetId)?.pixGridSettings?.layers).toHaveLength(12)
    expect(merged.pixGridState.layers.some(layer => layer.id === 'neon-marquee-frame')).toBe(false)
    expect(merged.pixGridState.layers.find(layer => layer.id === overlay.id)).toMatchObject({ mediaId: overlay.mediaId })
    expect(merged.pixGridState.scenes).toHaveLength(7)
    expect(merged.pixGridState.scenes.every(scene => scene.layerIds.includes('marquee-structure'))).toBe(true)
    expect(merged.pixGridState.performance.sharedPerformanceProgramId).toBe('pix-grid-neon-marquee-performance')
    expect(merged.pixGridState.editor.selectedLayerId).toBe('marquee-structure')
    expect(merged.pixGridState.layers.map(layer => layer.name)).toEqual(expect.arrayContaining([
      'Stable Sign Structure',
      'Perimeter Bulbs A',
      'Perimeter Bulbs B',
      'Perimeter Bulbs C',
      'Perimeter Bulbs D',
      'Letter Lights A',
      'Letter Lights B',
      'Letter Lights C',
      'Equalizer and Halo Lights',
      'Trim and Underline Lights',
      'Frenchie and Focal Lights',
      'Sparse Accent Bulbs',
    ]))
    expect(merged.reactMotion).toBe(0.73)

    useReactStore.setState(merged)
    useReactStore.getState().selectReactPreset(presetId)
    const selected = useReactStore.getState().pixGridState
    expect(inspectPixGridCanonicalPresetIntegrity(selected, presetId).complete).toBe(true)
    expect(selected.layers.find(layer => layer.id === overlay.id)).toMatchObject({ mediaId: overlay.mediaId })
    expect(useReactStore.getState().reactMotion).toBe(0.73)

    const persistedAgain = reactStorePartialize(useReactStore.getState())
    const reloaded = mergeReactStoreState(persistedAgain, current)
    expect(inspectPixGridCanonicalPresetIntegrity(reloaded.pixGridState, presetId).complete).toBe(true)
    expect(reloaded.pixGridState.layers.filter(layer => layer.id === 'marquee-structure')).toHaveLength(1)
    expect(reloaded.pixGridState.groups.filter(group => group.id === 'marquee-perimeter-group')).toHaveLength(1)
    expect(reloaded.pixGridState.layers.find(layer => layer.id === overlay.id)).toMatchObject({ mediaId: overlay.mediaId })
  })

  it('does not replace an explicitly custom PixGrid scene with the active built-in preset during hydration', () => {
    const current = useReactStore.getState()
    const customLayer = {
      ...current.pixGridState.layers[0]!,
      id: 'custom-hydration-layer',
      name: 'Custom Hydration Artwork',
    }
    const custom: PixGridState = {
      ...current.pixGridState,
      selectedPresetId: null,
      selectedSceneId: 'custom-hydration-scene',
      configuration: {
        ...current.pixGridState.configuration,
        origin: 'custom',
        sourcePresetId: null,
        presetConfigurationVersion: 0,
        userCustomized: true,
      },
      layers: [customLayer],
      scenes: [{
        id: 'custom-hydration-scene',
        name: 'Custom Hydration Scene',
        layerIds: [customLayer.id],
        pixelOverrides: [],
      }],
      groups: [],
      audioAssignments: [],
      performance: {
        ...current.pixGridState.performance,
        enabled: false,
        sharedPerformanceProgramId: null,
      },
    }
    const merged = mergeReactStoreState({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: current.pixGridState.selectedPresetId,
      pixGridState: custom,
    }, current)

    expect(merged.pixGridState.selectedPresetId).toBeNull()
    expect(merged.pixGridState.layers).toEqual([customLayer])
    expect(merged.pixGridState.groups).toEqual([])
    expect(merged.pixGridState.audioAssignments).toEqual([])
    expect(merged.pixGridState.configuration.origin).toBe('custom')
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
