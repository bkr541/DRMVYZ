import { describe, expect, it } from 'vitest'
import {
  CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS,
  CINEMA_LEGACY_PRESET_CATALOG,
  CINEMA_LEGACY_PRESET_CATALOG_VERSION,
  cinemaCinematicWorldParameterId,
  compileCinemaCompositionGraph,
  createCinemaCameraParameterSchemaMap,
  createCinemaComposerComposition,
  createCinemaDefinitionRegistryFromPersisted,
  createCinemaFoundationPersistedState,
  createCinemaStore,
  createEmptyCinemaPersistedState,
  cinemaStableId,
  reconcileCinemaBuiltInState,
  validateCinemaCompositionGraph,
  validateCinemaParameterSchemas,
} from '..'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import { REACT_ENGINE_CATALOG, isSelectableReactEngineId } from '../../react/reactEngineCatalog'
import { PRODUCTION_SCENES, REACTOR_SCENE_ID, SHADER_SCENE_REGISTRY_AUDIT } from '../../react/shaders/scenes'

const cinematicPresets = DEFAULT_REACT_PRESETS.filter(preset => (
  preset.engine === 'cinematicPortal'
  && !(preset.id in CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS)
))

describe('Cinema Stage 21 legacy preset catalog', () => {
  it('discovers a one-to-one stable mapping for every active production Shader scene and Cinematic Worlds preset', () => {
    const shaderEntries = CINEMA_LEGACY_PRESET_CATALOG.manifest.filter(entry => entry.sourceKind === 'shader-scene')
    const cinematicEntries = CINEMA_LEGACY_PRESET_CATALOG.manifest.filter(entry => entry.sourceKind === 'cinematic-preset')

    expect(CINEMA_LEGACY_PRESET_CATALOG.version).toBe(CINEMA_LEGACY_PRESET_CATALOG_VERSION)
    expect(shaderEntries.map(entry => entry.legacySourceId).sort()).toEqual(PRODUCTION_SCENES.map(scene => scene.id).sort())
    expect(cinematicEntries.map(entry => entry.legacySourceId).sort()).toEqual(cinematicPresets.map(preset => preset.id).sort())
    expect(CINEMA_LEGACY_PRESET_CATALOG.compositions).toHaveLength(shaderEntries.length + cinematicEntries.length)
    expect(new Set(CINEMA_LEGACY_PRESET_CATALOG.manifest.map(entry => `${entry.legacyEngineId}:${entry.legacySourceId}`)).size)
      .toBe(CINEMA_LEGACY_PRESET_CATALOG.manifest.length)
    expect(new Set(CINEMA_LEGACY_PRESET_CATALOG.compositions.map(composition => composition.id)).size)
      .toBe(CINEMA_LEGACY_PRESET_CATALOG.compositions.length)
    expect(CINEMA_LEGACY_PRESET_CATALOG.audit.shaderSceneExclusions).toEqual(SHADER_SCENE_REGISTRY_AUDIT)
  })

  it('validates and compiles every catalog composition and exposes every target through the canonical Cinema library state', () => {
    const state = createCinemaFoundationPersistedState()
    const registryResult = createCinemaDefinitionRegistryFromPersisted(state.definitions)
    expect(registryResult.diagnostics.filter(item => item.severity === 'error' || item.severity === 'fatal')).toEqual([])
    const registry = registryResult.registry
    const libraryIds = new Set(state.compositions.map(composition => composition.id))

    for (const entry of CINEMA_LEGACY_PRESET_CATALOG.manifest) {
      const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === entry.compositionId)
      expect(composition, entry.legacySourceId).toBeDefined()
      if (!composition) continue
      expect(libraryIds.has(composition.id), entry.legacySourceId).toBe(true)
      const validation = validateCinemaCompositionGraph(composition, registry)
      expect(validation.valid, `${entry.legacySourceId}: ${validation.diagnostics.diagnostics.map(item => item.message).join('; ')}`).toBe(true)
      const compilation = compileCinemaCompositionGraph(composition, registry)
      expect(compilation.ok, `${entry.legacySourceId}: ${compilation.diagnostics.diagnostics.map(item => item.message).join('; ')}`).toBe(true)
      expect(compilation.plan?.output.nodeId).toBe(composition.outputNodeId)
    }
  })

  it('publishes valid shared-camera parameter schemas for every migrated Cinematic Worlds preset', () => {
    for (const composition of CINEMA_LEGACY_PRESET_CATALOG.compositions) {
      const schemasByCamera = createCinemaCameraParameterSchemaMap(composition)
      for (const camera of composition.cameras) {
        const diagnostics = validateCinemaParameterSchemas(schemasByCamera[camera.id] ?? [], { owner: 'camera' })
        expect(
          diagnostics.filter(item => item.severity === 'error' || item.severity === 'fatal'),
          `${composition.metadata.name} / ${camera.label}: ${diagnostics.map(item => item.message).join('; ')}`,
        ).toEqual([])
      }
    }
  })

  it('reconciles missing built-ins into older valid Cinema state without changing the active user composition', () => {
    const current = createCinemaFoundationPersistedState()
    const catalogIds = new Set(CINEMA_LEGACY_PRESET_CATALOG.compositions.map(composition => composition.id))
    const { legacyPresetCatalogVersion: _catalogVersion, ...priorEditorMetadata } = current.editorMetadata
    const prior = {
      ...current,
      compositions: current.compositions.filter(composition => !catalogIds.has(composition.id)),
      editorMetadata: priorEditorMetadata,
    }
    const activeBefore = prior.activeCompositionId
    const reconciled = reconcileCinemaBuiltInState(prior)

    expect(reconciled.activeCompositionId).toBe(activeBefore)
    expect(reconciled.editorMetadata.legacyPresetCatalogVersion).toBe(CINEMA_LEGACY_PRESET_CATALOG_VERSION)
    expect(CINEMA_LEGACY_PRESET_CATALOG.compositions.every(composition => reconciled.compositions.some(candidate => candidate.id === composition.id))).toBe(true)
  })


  it('hydrates a pre-foundation user-only Cinema document and restores the complete built-in preset catalog', () => {
    const userComposition = createCinemaComposerComposition({
      id: cinemaStableId('composer-composition', 'composition'),
      name: 'Cinema Composition 1',
    })
    const preFoundationState = {
      ...createEmptyCinemaPersistedState(),
      compositions: [userComposition],
      activeCompositionId: userComposition.id,
      editorMetadata: {},
    }

    const store = createCinemaStore()
    const result = store.getState().hydrateCinemaState(preFoundationState)

    expect(result.ok).toBe(true)
    expect(store.getState().activeCompositionId).toBe(userComposition.id)
    expect(store.getState().compositions.some(composition => composition.id === userComposition.id)).toBe(true)
    expect(store.getState().editorMetadata.foundationInitialized).toBe(true)
    expect(store.getState().editorMetadata.legacyPresetCatalogVersion).toBe(CINEMA_LEGACY_PRESET_CATALOG_VERSION)
    expect(CINEMA_LEGACY_PRESET_CATALOG.compositions.every(composition => (
      store.getState().compositions.some(candidate => candidate.id === composition.id)
    ))).toBe(true)
  })

  it('enters the production-intended Cinema store while legacy engine identities remain compatibility-only', () => {
    const store = createCinemaStore()
    const target = CINEMA_LEGACY_PRESET_CATALOG.manifest[0]
    expect(target).toBeDefined()
    if (!target) return

    expect(store.getState().setActiveCinemaComposition(target.compositionId).ok).toBe(true)
    expect(store.getState().activeCompositionId).toBe(target.compositionId)
    expect(isSelectableReactEngineId('shaderPads')).toBe(false)
    expect(isSelectableReactEngineId('cinematicPortal')).toBe(false)
    expect(REACT_ENGINE_CATALOG.shaderPads.label).toBe('Shader Pads')
    expect(REACT_ENGINE_CATALOG.cinematicPortal.label).toBe('Cinematic Worlds')
  })

  it('retains Reactor production provenance and performance metadata on its immutable adapter-backed composition', () => {
    const entry = CINEMA_LEGACY_PRESET_CATALOG.manifest.find(candidate => candidate.legacySourceId === REACTOR_SCENE_ID)
    const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === entry?.compositionId)
    const shaderNode = composition?.nodes.find(node => node.family === 'shader')

    expect(entry?.legacyEngineId).toBe('shaderPads')
    expect(composition?.metadata.provenance).toMatchObject({ stage: 21, sourceEngine: 'shaderPads', sourceId: REACTOR_SCENE_ID })
    expect(shaderNode?.metadata?.legacyCatalog).toMatchObject({ sceneId: REACTOR_SCENE_ID })
    expect((shaderNode?.metadata?.legacyCatalog as Record<string, unknown> | undefined)?.performanceProgram).toBeTruthy()
  })

  it('preserves Reactive Constellation preset config, camera direction, palette, and audio mapping at the adapter boundary', () => {
    const source = cinematicPresets.find(preset => preset.id === 'preset-crimson-collapse')
      ?? cinematicPresets.find(preset => preset.cinematicConfig?.worldMode === 'reactiveConstellation')
    expect(source?.cinematicConfig?.worldMode).toBe('reactiveConstellation')
    if (!source?.cinematicConfig) return

    const entry = CINEMA_LEGACY_PRESET_CATALOG.manifest.find(candidate => candidate.legacySourceId === source.id)
    const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === entry?.compositionId)
    const worldNode = composition?.nodes.find(node => node.family === 'procedural')
    const snapshot = worldNode?.metadata?.legacyCinematicPreset as Record<string, unknown> | undefined
    const storedConfig = snapshot?.cinematicConfig as Record<string, unknown> | undefined

    expect(entry?.worldId).toBe('reactiveConstellation')
    expect(composition?.metadata.name).toBe(source.name)
    expect(snapshot?.palette).toEqual(source.palette)
    expect(storedConfig?.audioMapping).toEqual(source.cinematicConfig.audioMapping)
    expect(storedConfig?.cameraRig).toBe(source.cinematicConfig.cameraRig)
    expect(composition?.cameras[0]?.mode).toBe(source.cinematicConfig.cameraRig === 'autoDirector' ? 'auto-director' : source.cinematicConfig.cameraRig)
    expect(worldNode?.parameterValues[cinemaCinematicWorldParameterId('world-node-count')]).toBe((source.cinematicConfig.worldSettings.settings as Record<string, unknown>).nodeCount)
  })
})
