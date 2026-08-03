import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PERFORMANCE_PADS, type ReactPreset } from '../components/vyzualz/react/ReactTypes'
import { PIX_GRID_PRESET_BY_ID, PIX_GRID_PRESET_IDS } from '../components/vyzualz/react/pixGrid/PixGridPresets'
import { createDefaultPixGridState, DEFAULT_PIX_GRID_PRESET_ID } from '../components/vyzualz/react/pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings } from '../components/vyzualz/react/pixGrid/PixGridState'
import { PIX_GRID_STATE_VERSION, type PixGridLayer, type PixGridState } from '../components/vyzualz/react/pixGrid/PixGridTypes'
import type { PixGridActionCue, PixGridActionCueAction } from '../components/vyzualz/react/pixGrid/PixGridActionCues'
import {
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

const RETIRED_MARQUEE_PRESET_ID = 'pix-grid-neon-marquee-cycle'

function retiredMarqueePresetFixture(): ReactPreset {
  const fallback = PIX_GRID_PRESET_BY_ID.get(DEFAULT_PIX_GRID_PRESET_ID)!
  const sourceLayer = fallback.pixGridSettings!.layers![0]!
  const legacyLayer = {
    ...sourceLayer,
    id: 'marquee-structure',
    name: 'Retired Marquee Structure',
    assetId: 'pix-neon-marquee-cycle',
    animations: [],
  } as unknown as PixGridLayer
  return {
    ...fallback,
    id: RETIRED_MARQUEE_PRESET_ID,
    name: 'Retired Marquee Fixture',
    pixGridSettings: {
      ...fallback.pixGridSettings!,
      selectedSceneId: `${RETIRED_MARQUEE_PRESET_ID}-intro`,
      layers: [legacyLayer],
      groups: [],
      audioAssignments: [],
      performanceProgramId: null,
    },
    scenes: fallback.scenes.map(scene => ({
      ...scene,
      id: `${RETIRED_MARQUEE_PRESET_ID}-${scene.sectionType}`,
    })),
    sectionMappings: fallback.sectionMappings.map(mapping => ({
      ...mapping,
      sceneId: `${RETIRED_MARQUEE_PRESET_ID}-${mapping.sectionType}`,
    })),
  }
}

function makePixGridCue(id: string, action: PixGridActionCueAction): PixGridActionCue {
  return {
    version: 1,
    id,
    timeSec: 8,
    label: id,
    enabled: true,
    engineId: 'pixGrid',
    action,
    quantization: 'beat',
    transition: 'cut',
    transitionDurationSec: 0,
    oneShotDurationSec: 0.5,
    loopBehavior: 'retrigger',
    order: 0,
  }
}

describe('PixGrid persistence and selection invariants', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('migrates pre-PixGrid snapshots to safe defaults', () => {
    const migrated = migrateReactStore({ activeReactEngineId: 'cinematicPortal' }, 47)
    expect(migrated.pixGridState).toEqual(createDefaultPixGridState())
  })

  it('merges live PixGrid presets without reviving the retired Marquee definition', () => {
    const current = useReactStore.getState()
    const retiredDefinition = retiredMarqueePresetFixture()
    const merged = mergeReactStoreState({ reactPresets: [retiredDefinition] }, current)
    const pixGridPresetIds = merged.reactPresets
      .filter(preset => preset.engine === 'pixGrid')
      .map(preset => preset.id)
    expect(pixGridPresetIds).toEqual(
      PIX_GRID_PRESET_IDS,
    )
    expect(merged.reactPresets.some(preset => preset.id === 'pix-grid-neon-marquee-cycle')).toBe(false)
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

  it('retires the persisted Marquee graph before generic canonical migration can rebuild it', () => {
    const current = useReactStore.getState()
    const presetId = RETIRED_MARQUEE_PRESET_ID
    const canonicalPreset = retiredMarqueePresetFixture()
    const structure = canonicalPreset.pixGridSettings!.layers!.find(layer => layer.id === 'marquee-structure')!
    const legacyLayer = {
      ...structure,
      id: 'neon-marquee-frame',
      name: 'Neon Marquee Frame',
      assetId: 'pix-neon-marquee-cycle',
      animations: [],
    } as unknown as PixGridLayer
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
      editorTool: 'marquee',
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
      scenes: legacyBase.scenes.map(scene => ({
        ...scene,
        layerIds: [legacyLayer.id, overlay.id],
        pixelOverrides: [[2, 3, 1, '#ffffff', 1]],
      })),
      pixelOverrides: [[2, 3, 1, '#ffffff', 1]],
      groups: [],
      audioAssignments: [],
      performance: {
        ...legacyBase.performance,
        enabled: true,
        sharedPerformanceProgramId: null,
        lockedRoutes: ['layer:marquee-orphan-layer'],
        programOverrides: {
          routes: { orphan: { targetScope: 'layer', targetId: 'marquee-orphan-layer' } },
          sections: { 'marquee-orphan-section': { density: 0.5 } },
        },
      },
      editor: {
        ...legacyBase.editor,
        selectedLayerId: legacyLayer.id,
        selectedGroupId: 'marquee-orphan-group',
        previewReactionAssignmentId: 'marquee-orphan-reaction',
        selection: { x: 1, y: 1, width: 4, height: 4 },
        scenePreviewMode: 'selectedScene',
      },
    }

    const merged = mergeReactStoreState({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: presetId,
      reactPresets: [stalePreset],
      pixGridState: legacyState,
      reactMotion: 0.73,
    }, current)

    expect(merged.activeReactEngineId).toBe('pixGrid')
    expect(merged.activeReactPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(merged.reactPresets.some(preset => preset.id === presetId)).toBe(false)
    expect(merged.pixGridState.selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(merged.pixGridState.configuration.sourcePresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(merged.pixGridState.performance.sharedPerformanceProgramId).toBe('pix-grid-bass-beacon-performance')
    expect(merged.pixGridState.layers.every(layer => !layer.id.startsWith('marquee-'))).toBe(true)
    expect(merged.pixGridState.groups.every(group => !group.id.startsWith('marquee-'))).toBe(true)
    expect(merged.pixGridState.scenes.every(scene => !scene.id.startsWith('pix-grid-neon-marquee-cycle-'))).toBe(true)
    expect(merged.pixGridState.layers.some(layer => layer.id === overlay.id)).toBe(false)
    expect(merged.pixGridState.pixelOverrides).toEqual([])
    expect(merged.pixGridState.scenes.every(scene => scene.pixelOverrides.length === 0)).toBe(true)
    expect(merged.pixGridState.performance.lockedRoutes).toEqual([])
    expect(merged.pixGridState.performance.programOverrides).toEqual({ routes: {}, sections: {} })
    expect(merged.pixGridState.editor.selection).toBeNull()
    expect(merged.pixGridState.layers.some(layer => String(layer.assetId).startsWith('pix-neon-marquee-'))).toBe(false)
    expect(merged.pixGridState.layers.some(layer => layer.id === merged.pixGridState.editor.selectedLayerId)).toBe(true)
    expect(merged.pixGridState.groups.some(group => group.id === merged.pixGridState.editor.selectedGroupId)).toBe(true)
    expect(merged.pixGridState.scenes.some(scene => scene.id === merged.pixGridState.selectedSceneId)).toBe(true)
    expect(merged.pixGridState.editor.previewReactionAssignmentId).toBeNull()
    expect(merged.pixGridState.editorTool).toBe('marquee')
    expect(merged.reactMotion).toBe(0.73)
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


  it('repairs an active Marquee selection to the default PixGrid preset', () => {
    const marqueePreset = retiredMarqueePresetFixture()
    const migrated = migrateReactStore({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: RETIRED_MARQUEE_PRESET_ID,
      pixGridState: applyPixGridPresetSettings(
        createDefaultPixGridState(),
        RETIRED_MARQUEE_PRESET_ID,
        marqueePreset.pixGridSettings,
      ),
    }, 63)

    expect(migrated.activeReactEngineId).toBe('pixGrid')
    expect(migrated.activeReactPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect((migrated.pixGridState as PixGridState).selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
  })

  it('detects a malformed graph from descendant IDs alone', () => {
    const base = createDefaultPixGridState()
    const malformed = {
      ...base,
      selectedPresetId: null,
      selectedSceneId: 'pix-grid-neon-marquee-cycle-orphan',
      configuration: { ...base.configuration, origin: 'custom', sourcePresetId: null },
      scenes: [{
        id: 'pix-grid-neon-marquee-cycle-orphan',
        name: 'Orphan Scene',
        layerIds: ['marquee-orphan-layer'],
        pixelOverrides: [],
      }],
      layers: [{
        ...base.layers[0]!,
        id: 'orphan-layer',
        assetId: 'pix-neon-marquee-orphan',
      }],
      groups: [{
        ...base.groups[0]!,
        id: 'orphan-group',
        layerId: 'marquee-orphan-layer',
        layerScope: ['marquee-orphan-layer'],
      }],
      performance: { ...base.performance, sharedPerformanceProgramId: null },
    }

    const migrated = migrateReactStore({ pixGridState: malformed }, 63)
    const state = migrated.pixGridState as PixGridState
    expect(state.selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(state.scenes.some(scene => scene.id.includes('neon-marquee'))).toBe(false)
    expect(state.layers.some(layer => String(layer.assetId).startsWith('pix-neon-marquee-'))).toBe(false)
  })

  it('removes only action cues that explicitly target retired Marquee descendants', () => {
    const retiredScene = makePixGridCue('retired-scene', {
      type: 'selectScene',
      sceneId: 'pix-grid-neon-marquee-cycle-drop',
    })
    const retiredLayer = makePixGridCue('retired-layer', {
      type: 'startAnimation',
      target: { layerId: 'marquee-structure' },
      animation: 'pulse',
      speed: 1,
      amount: 0.5,
      boundary: 'wrap',
      clock: 'beat',
    })
    const retiredGroup = makePixGridCue('retired-group', {
      type: 'setGroupVisible',
      groupId: 'marquee-perimeter-group',
      visible: false,
    })
    const retiredNestedAsset = {
      ...makePixGridCue('retired-nested-asset', { type: 'clearScreen' }),
      action: {
        type: 'futureNestedTarget',
        payload: { targets: [{ assetId: 'pix-neon-marquee-bulbs-a' }] },
      },
    }
    const safeCues = [
      makePixGridCue('clear', { type: 'clearScreen' }),
      makePixGridCue('background', { type: 'setBackground', mode: 'black', brightness: 0 }),
      makePixGridCue('freeze', { type: 'freeze', active: true }),
      makePixGridCue('palette', { type: 'setPaletteMode', mode: 'preset' }),
      makePixGridCue('all-layers', {
        type: 'startAnimation',
        target: 'all',
        animation: 'pulse',
        speed: 1,
        amount: 0.25,
        boundary: 'wrap',
        clock: 'time',
      }),
      makePixGridCue('other-layer', { type: 'setLayerVisible', layerId: 'bass-word', visible: true }),
      makePixGridCue('auto-performance', { type: 'setAutoPerformance', enabled: true }),
      { ...makePixGridCue('power-transition', { type: 'clearScreen' }), transition: 'powerOn' as const },
    ]
    const labelOnlyTarget = {
      ...makePixGridCue('label-only-target', { type: 'clearScreen' }),
      action: { type: 'futureTargetMetadata', target: { label: 'marquee-user-label' } },
    }

    const migrated = migrateReactStore({
      pixGridActionCuesByTrackId: {
        track: [retiredScene, retiredLayer, retiredGroup, retiredNestedAsset, ...safeCues, labelOnlyTarget],
      },
    }, 64)
    const cues = (migrated.pixGridActionCuesByTrackId as Record<string, PixGridActionCue[]>).track

    expect(cues).toHaveLength(safeCues.length + 1)
    expect(cues.map(cue => cue.id)).toEqual(expect.arrayContaining([
      ...safeCues.map(cue => cue.id),
      labelOnlyTarget.id,
    ]))
  })

  it('repairs Marquee pad and preset automation references to Bass Beacon', () => {
    const migrated = migrateReactStore({
      performancePads: [{
        ...DEFAULT_PERFORMANCE_PADS[0],
        presetId: RETIRED_MARQUEE_PRESET_ID,
        label: 'Custom Pad Label',
        color: '#123456',
      }],
      presetAutomationCuesByTrackId: {
        track: [{
          id: 'marquee-preset-cue',
          timeSec: 12,
          presetId: RETIRED_MARQUEE_PRESET_ID,
          label: 'Custom Cue Label',
          enabled: true,
          transitionMs: 250,
        }],
      },
    }, 64)

    expect((migrated.performancePads as typeof DEFAULT_PERFORMANCE_PADS)[0]).toMatchObject({
      presetId: DEFAULT_PIX_GRID_PRESET_ID,
      label: 'Custom Pad Label',
      color: '#123456',
    })
    expect((migrated.presetAutomationCuesByTrackId as Record<string, Array<{ presetId: string; label: string }>>).track[0]).toEqual(
      expect.objectContaining({ presetId: DEFAULT_PIX_GRID_PRESET_ID, label: 'Custom Cue Label' }),
    )
  })

  it('removes Marquee-keyed preset configuration records without disturbing other keys', () => {
    const keepConfig = { safe: true }
    const migrated = migrateReactStore({
      cinematicConfigsByPresetId: {
        [RETIRED_MARQUEE_PRESET_ID]: { stale: true },
        keep: keepConfig,
      },
      cinematicSeedLocksByPresetId: {
        [RETIRED_MARQUEE_PRESET_ID]: true,
        keep: false,
      },
    }, 64)

    expect(migrated.cinematicConfigsByPresetId).toEqual({ keep: keepConfig })
    expect(migrated.cinematicSeedLocksByPresetId).toEqual({ keep: false })
  })

  it('sanitizes current-version project imports and remains idempotent', () => {
    const marqueePreset = retiredMarqueePresetFixture()
    const imported = {
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: RETIRED_MARQUEE_PRESET_ID,
      reactPresets: [marqueePreset],
      pixGridState: applyPixGridPresetSettings(
        createDefaultPixGridState(),
        RETIRED_MARQUEE_PRESET_ID,
        marqueePreset.pixGridSettings,
      ),
      performancePads: [{ ...DEFAULT_PERFORMANCE_PADS[0], presetId: RETIRED_MARQUEE_PRESET_ID }],
      presetAutomationCuesByTrackId: {
        track: [{ id: 'cue', timeSec: 1, presetId: RETIRED_MARQUEE_PRESET_ID, label: 'Cue', enabled: true, transitionMs: 0 }],
      },
    }

    const once = migrateReactStore(imported, 64)
    const twice = migrateReactStore(once, 64)

    expect(once.activeReactPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect((once.reactPresets as Array<{ id: string }>).some(preset => preset.id === RETIRED_MARQUEE_PRESET_ID)).toBe(false)
    expect(twice).toEqual(once)
  })

  it('shields normal persistence writes as well as hydration and imports', () => {
    const marqueePreset = retiredMarqueePresetFixture()
    useReactStore.setState({
      activeReactEngineId: 'pixGrid',
      activeReactPresetId: RETIRED_MARQUEE_PRESET_ID,
      pixGridState: applyPixGridPresetSettings(
        createDefaultPixGridState(),
        RETIRED_MARQUEE_PRESET_ID,
        marqueePreset.pixGridSettings,
      ),
    })

    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.activeReactPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(persisted.pixGridState.selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(persisted.reactPresets.some(preset => preset.id === RETIRED_MARQUEE_PRESET_ID)).toBe(false)
  })

  it('leaves the rectangular Marquee Selection editor tool untouched', () => {
    const base = createDefaultPixGridState()
    const migrated = migrateReactStore({
      pixGridState: { ...base, editorTool: 'marquee' },
    }, 64)
    const state = migrated.pixGridState as PixGridState

    expect(state.editorTool).toBe('marquee')
    expect(state.selectedPresetId).toBe(DEFAULT_PIX_GRID_PRESET_ID)
    expect(state.layers.some(layer => layer.id.startsWith('marquee-'))).toBe(false)
  })

  it('does not mistake a Deck frame source compatibility alias for Marquee lineage', () => {
    const base = createDefaultPixGridState()
    const deckLayer = {
      ...base.layers[0]!,
      id: 'deck-generated-layer',
      assetId: 'pix-neon-marquee-cycle',
      frameSource: { kind: 'deck' as const, deckId: 'deck-1' },
    } as unknown as PixGridLayer
    const deckState: PixGridState = {
      ...base,
      selectedPresetId: null,
      selectedSceneId: 'deck-generated-scene',
      configuration: { ...base.configuration, origin: 'custom', sourcePresetId: null },
      scenes: [{ id: 'deck-generated-scene', name: 'Deck', layerIds: [deckLayer.id], pixelOverrides: [] }],
      layers: [deckLayer],
      groups: [],
      audioAssignments: [],
      performance: { ...base.performance, sharedPerformanceProgramId: 'pix-grid-media-deck-performance' },
    }

    const migrated = migrateReactStore({ pixGridState: deckState }, 64)
    const state = migrated.pixGridState as PixGridState
    expect(state.selectedPresetId).toBeNull()
    expect(state.layers[0]).toMatchObject({
      id: deckLayer.id,
      frameSource: { kind: 'deck', deckId: 'deck-1' },
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
