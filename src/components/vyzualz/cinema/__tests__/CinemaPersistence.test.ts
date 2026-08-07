import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PACKAGE_SCHEMA_ID,
  CINEMA_PACKAGE_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  CINEMA_PERSISTED_STORE_SCHEMA_ID,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_CAMERA_PARAMETER_IDS,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  CINEMA_STAGE15_REFERENCE_COMPOSITION,
  CINEMA_STAGE16_REFERENCE_COMPOSITION,
  CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS,
  CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS,
  CINEMA_SHADER_SCENE_ADAPTER_BUNDLE,
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaPackageFromPersistedState,
  createCinemaParameterPath,
  createCinemaStore,
  getCinemaCompositionLibraryStatus,
  decodeCinemaPackage,
  encodeCinemaPackage,
  normalizeCinemaPersistedState,
  parseCinemaParameterPath,
  preflightCinemaPackage,
  snapshotCinemaPersistedState,
  CINEMA_PROJECT_STATE_KEYS,
  type CinemaActionId,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaCameraId,
  type CinemaCollectionDefinition,
  type CinemaCollectionId,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaCompositionInstance,
  type CinemaCompositionInstanceId,
  type CinemaConnectionId,
  type CinemaEventId,
  type CinemaModulationRouteId,
  type CinemaModulationSourceId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPerformanceRuleId,
  type CinemaPersistedDefinition,
  type CinemaPersistedState,
  type CinemaPortId,
  type CinemaRendererPluginId,
  type CinemaStableId,
} from '../index'
import { createSplitPersistStorage, splitStorageValue } from '../../../../lib/splitPersistStorage'

function stable<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

function namespaced<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaNamespacedId<T>(value, kind)
}

const sourceTypeId = namespaced<CinemaNodeTypeId>('drmvyz.test.source', 'node type')
const outputTypeId = namespaced<CinemaNodeTypeId>('drmvyz.test.output', 'node type')
const sourceNodeId = stable<CinemaNodeId>('source-node', 'node')
const outputNodeId = stable<CinemaNodeId>('output-node', 'node')
const colorOutPortId = stable<CinemaPortId>('color-out', 'port')
const colorInPortId = stable<CinemaPortId>('color-in', 'port')
const gainId = stable<CinemaParameterId>('gain', 'parameter')
const intensityId = stable<CinemaParameterId>('intensity', 'parameter')
const compositionId = stable<CinemaCompositionId>('composition-one', 'composition')
const instanceId = stable<CinemaCompositionInstanceId>('instance-one', 'composition instance')
const collectionId = stable<CinemaCollectionId>('collection-one', 'collection')
const bindingId = stable<CinemaAssetBindingId>('binding-one', 'asset binding')
const assetId = stable<CinemaAssetId>('asset-one', 'asset')
const cameraId = stable<CinemaCameraId>('shared-camera', 'camera')

function definition(
  id: CinemaNodeTypeId,
  family: 'procedural' | 'output',
): CinemaPersistedDefinition {
  const isOutput = family === 'output'
  return {
    id,
    definition: {
      typeId: id,
      version: 1,
      label: isOutput ? 'Output' : 'Source',
      family,
      inputPorts: isOutput
        ? [{ id: colorInPortId, label: 'Color', direction: 'input', dataType: 'color-texture', required: true }]
        : [],
      outputPorts: isOutput
        ? []
        : [{ id: colorOutPortId, label: 'Color', direction: 'output', dataType: 'color-texture' }],
      parameters: isOutput
        ? []
        : [{ id: gainId, label: 'Gain', type: 'float', default: 1, min: 0, max: 2, step: 0.01 }],
      capabilities: {
        backends: ['webgl2'],
        canvas2d: { compatibility: 'unsupported', preservesPremultipliedAlpha: true },
        camera: { mode: 'none', controls: [], autoDirector: false },
        requires: {},
        fallbacks: [],
      },
      cost: {
        cpu: 'low',
        gpu: 'low',
        estimatedPassCount: 1,
        persistentTargetCount: 0,
        pingPongPairCount: 0,
      },
      seekPolicy: { mode: 'stateless' },
      output: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
    },
    rendererPluginId: namespaced<CinemaRendererPluginId>(
      isOutput ? 'drmvyz.renderer.test-output' : 'drmvyz.renderer.test-source',
      'renderer plugin',
    ),
    source: { kind: 'built-in', id: 'stage-4-test' },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: 1,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  }
}

function composition(id: CinemaCompositionId = compositionId): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id,
    revision: 1,
    metadata: { name: 'Stage 4 Composition' },
    nodes: [
      {
        id: sourceNodeId,
        typeId: sourceTypeId,
        typeVersion: 1,
        family: 'procedural',
        enabled: true,
        opacity: 1,
        parameterValues: { [gainId]: 1.25 },
        assetBindingIds: [bindingId],
      },
      {
        id: outputNodeId,
        typeId: outputTypeId,
        typeVersion: 1,
        family: 'output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [{
      id: stable<CinemaConnectionId>('source-to-output', 'connection'),
      from: { nodeId: sourceNodeId, portId: colorOutPortId },
      to: { nodeId: outputNodeId, portId: colorInPortId },
      enabled: true,
    }],
    outputNodeId,
    masterParameters: [{
      id: intensityId,
      label: 'Intensity',
      type: 'float',
      default: 1,
      min: 0,
      max: 2,
      step: 0.01,
    }],
    masterValues: { [intensityId]: 0.8 },
    cameras: [],
    assetBindings: [{
      id: bindingId,
      assetId,
      role: 'image',
      fit: 'cover',
      preserveOriginalColors: true,
      opacity: 1,
      blendMode: 'normal',
    }],
    modulationRoutes: [{
      id: stable<CinemaModulationRouteId>('bass-route', 'modulation route'),
      sourceId: namespaced<CinemaModulationSourceId>('audio.bass', 'modulation source'),
      destination: createCinemaParameterPath('nodes', gainId, sourceNodeId),
      mode: 'multiply',
      amount: 0.5,
      enabled: true,
    }],
    performanceRules: [{
      schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
      id: stable<CinemaPerformanceRuleId>('drop-rule', 'performance rule'),
      label: 'Drop Rule',
      priority: 10,
      enabled: true,
      condition: {
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        event: namespaced<CinemaEventId>('music.drop-start', 'event'),
      },
      actions: [{
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: stable<CinemaActionId>('drop-intensity-action', 'performance action'),
        type: 'set-parameter',
        destination: createCinemaParameterPath('master', intensityId),
        value: 1.5,
      }],
    }],
  }
}

function instance(): CinemaCompositionInstance {
  return {
    id: instanceId,
    compositionId,
    label: 'Performance Instance',
    revision: 1,
    masterOverrides: { [intensityId]: 1.1 },
    nodeOverrides: [{ nodeId: sourceNodeId, values: { [gainId]: 1.4 } }],
    cameraOverrides: [],
    assetBindingOverrides: [{ bindingId, values: { opacity: 0.75 } }],
  }
}

function collection(): CinemaCollectionDefinition {
  return {
    id: collectionId,
    label: 'Favorites',
    compositionIds: [compositionId],
  }
}

function populatedState() {
  return {
    schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
    schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
    definitions: [definition(sourceTypeId, 'procedural'), definition(outputTypeId, 'output')],
    compositions: [composition()],
    instances: [instance()],
    collections: [collection()],
    activeCompositionId: compositionId,
    activeInstanceId: instanceId,
    editorMetadata: { selectedNodeId: sourceNodeId },
    migrationProvenance: [],
  } as const
}

describe('Cinema persisted state and migrations', () => {
  it('initializes and reloads the current canonical state', () => {
    const fresh = createCinemaStore()
    expect(fresh.getState().schemaId).toBe(CINEMA_PERSISTED_STORE_SCHEMA_ID)
    expect(fresh.getState().schemaVersion).toBe(CINEMA_PERSISTED_STORE_SCHEMA_VERSION)
    expect(fresh.getState().activeCompositionId).toBe(CINEMA_SHADER_REFERENCE_COMPOSITION.id)
    expect(fresh.getState().compositions).toHaveLength(5)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_SHADER_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_STAGE15_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_STAGE16_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().definitions).toHaveLength(
      2
        + CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.length
        + CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.length
        + CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS.length
        + CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS.length,
    )

    const first = createCinemaStore({ initialState: populatedState() })
    const saved = snapshotCinemaPersistedState(first.getState())
    const reloaded = createCinemaStore()
    expect(reloaded.getState().hydrateCinemaState(JSON.parse(JSON.stringify(saved))).ok).toBe(true)
    expect(snapshotCinemaPersistedState(reloaded.getState())).toEqual(saved)
  })

  it('rejects malformed and unknown future state without mutating the valid store', () => {
    const store = createCinemaStore({ initialState: populatedState() })
    const before = snapshotCinemaPersistedState(store.getState())

    expect(store.getState().hydrateCinemaState({ ...before, schemaVersion: 999 }).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)

    const hostile = { ...before, runtime: new Uint8Array([1, 2, 3]) }
    expect(store.getState().replaceCinemaState(hostile).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
  })

  it('adds explicit missing-field defaults without changing valid authored values', () => {
    const candidate = populatedState()
    const { editorMetadata: _editorMetadata, migrationProvenance: _migrationProvenance, ...missingOptionalFields } = candidate
    const result = normalizeCinemaPersistedState(missingOptionalFields)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.editorMetadata).toEqual({})
    expect(result.value.migrationProvenance).toEqual([])
    expect(result.value.compositions).toEqual(candidate.compositions)
  })

  it('round-trips Stage 13 camera resources and instance overrides through canonical hydration', () => {
    const candidate = JSON.parse(JSON.stringify(populatedState()))
    candidate.compositions[0].cameras = [{
      id: cameraId,
      label: 'Shared Camera',
      mode: 'path',
      parameterValues: {
        [CINEMA_CAMERA_PARAMETER_IDS.position]: [0, 0, 2],
        [CINEMA_CAMERA_PARAMETER_IDS.rotation]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.target]: [0, 0, 0],
        [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 58,
      },
      path: [{ position: [0, 0, 2] }, { position: [1, 0.25, 1] }],
      safeRange: {
        minPosition: [-2, -1, 0.25],
        maxPosition: [2, 2, 5],
        minFovDegrees: 30,
        maxFovDegrees: 90,
        minNear: 0.01,
        maxFar: 250,
      },
      invalidRegions: [{
        id: 'world-core',
        shape: 'sphere',
        center: [0, 0, 0],
        radius: 0.2,
        fallbackPosition: [0, 0, 0.5],
      }],
      authoredShots: [{
        id: 'verse-orbit',
        mode: 'orbit',
        sections: ['verse'],
        weight: 1,
        minimumDurationSec: 4,
        position: [0, 0.5, 2],
      }],
    }]
    candidate.instances[0].cameraOverrides = [{
      cameraId,
      values: { [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 64 },
    }]

    const result = normalizeCinemaPersistedState(candidate)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.compositions[0].cameras[0]).toEqual(candidate.compositions[0].cameras[0])
    expect(result.value.instances[0].cameraOverrides[0]).toEqual(candidate.instances[0].cameraOverrides[0])
  })

  it('rejects malformed Stage 13 camera safety and authored-shot metadata atomically', () => {
    const candidate = JSON.parse(JSON.stringify(populatedState()))
    candidate.compositions[0].cameras = [{
      id: cameraId,
      label: 'Unsafe Camera',
      mode: 'auto-director',
      parameterValues: {},
      safeRange: {
        minPosition: [2, 0, 1],
        maxPosition: [-2, 1, 4],
        minFovDegrees: 90,
        maxFovDegrees: 30,
        minNear: 1,
        maxFar: 0.5,
      },
      invalidRegions: [{ id: 'empty-region', shape: 'sphere', center: [0, 0, 0], radius: 0 }],
      authoredShots: [
        { id: 'duplicate-shot', mode: 'orbit', weight: -1 },
        { id: 'duplicate-shot', mode: 'locked' },
      ],
    }]

    const result = normalizeCinemaPersistedState(candidate)
    expect(result.ok).toBe(false)
    expect(result.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_CAMERA_INVALID')).toBe(true)
  })

  it('migrates Stage 4 schema-v1 rules and actions to the Stage 12 contract', () => {
    const legacy = JSON.parse(JSON.stringify(populatedState())) as {
      schemaVersion: number
      compositions: Array<{
        schemaVersion: number
        performanceRules: Array<{
          schemaVersion?: number
          condition: { schemaVersion?: number }
          actions: Array<{ schemaVersion?: number; id?: string }>
        }>
      }>
    }
    legacy.schemaVersion = 1
    legacy.compositions[0].schemaVersion = 1
    delete legacy.compositions[0].performanceRules[0].schemaVersion
    delete legacy.compositions[0].performanceRules[0].condition.schemaVersion
    delete legacy.compositions[0].performanceRules[0].actions[0].schemaVersion
    delete legacy.compositions[0].performanceRules[0].actions[0].id

    const result = normalizeCinemaPersistedState(legacy)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const migratedRule = result.value.compositions[0].performanceRules[0]
    expect(result.value.schemaVersion).toBe(CINEMA_PERSISTED_STORE_SCHEMA_VERSION)
    expect(result.value.compositions[0].schemaVersion).toBe(CINEMA_COMPOSITION_SCHEMA_VERSION)
    expect(migratedRule.schemaVersion).toBe(CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION)
    expect(migratedRule.condition.schemaVersion).toBe(CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION)
    expect(migratedRule.actions[0]).toMatchObject({
      schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
      id: 'drop-rule-action-1',
    })
    expect(result.value.migrationProvenance).toEqual(expect.arrayContaining([
      { fromSchemaVersion: 1, toSchemaVersion: 2, migratedAt: '2026-08-06T00:00:00.000Z' },
      { fromSchemaVersion: 2, toSchemaVersion: 3, migratedAt: '2026-08-06T20:41:00.000Z' },
      { fromSchemaVersion: 3, toSchemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION, migratedAt: '2026-08-07T03:38:00.000Z' },
    ]))
  })
})


describe('Cinema Stage 14 migration', () => {
  it('migrates schema-v2 asset bindings to explicit derived Brand Kit policy', () => {
    const legacy = JSON.parse(JSON.stringify(populatedState())) as {
      schemaVersion: number
      compositions: Array<{ schemaVersion: number; assetBindings: Array<{ colorizeWithBrandRole?: string; brandColorPolicy?: string }> }>
    }
    legacy.schemaVersion = 2
    legacy.compositions[0].schemaVersion = 2
    legacy.compositions[0].assetBindings[0].colorizeWithBrandRole = 'accent'
    delete legacy.compositions[0].assetBindings[0].brandColorPolicy

    const result = normalizeCinemaPersistedState(legacy)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.compositions[0].assetBindings[0].brandColorPolicy).toBe('derived')
    expect(result.value.migrationProvenance).toContainEqual({
      fromSchemaVersion: 2,
      toSchemaVersion: 3,
      migratedAt: '2026-08-06T20:41:00.000Z',
    })
    expect(result.value.migrationProvenance).toContainEqual({
      fromSchemaVersion: 3,
      toSchemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
      migratedAt: '2026-08-07T03:38:00.000Z',
    })
  })
})

describe('Cinema complete-graph history', () => {
  it('restores nodes, connections, bindings, routes, rules, instances, collections, and active selection', () => {
    const store = createCinemaStore({ initialState: populatedState() })
    const before = snapshotCinemaPersistedState(store.getState())

    expect(store.getState().deleteCinemaComposition(compositionId).ok).toBe(true)
    expect(store.getState().compositions).toEqual([])
    expect(store.getState().instances).toEqual([])
    expect(store.getState().collections[0]?.compositionIds).toEqual([])
    expect(store.getState().activeCompositionId).toBeNull()
    expect(store.getState().activeInstanceId).toBeNull()

    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
    expect(store.getState().redoCinemaEdit().ok).toBe(true)
    expect(store.getState().compositions).toEqual([])
    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
  })

  it('coalesces grouped edits into one bounded undo entry and rolls cancellation back', () => {
    const store = createCinemaStore({ initialState: populatedState(), historyLimit: 2 })
    const before = snapshotCinemaPersistedState(store.getState())

    expect(store.getState().beginCinemaHistoryTransaction('Inspector drag').ok).toBe(true)
    expect(store.getState().renameCinemaComposition(compositionId, 'Pass One').ok).toBe(true)
    expect(store.getState().renameCinemaComposition(compositionId, 'Pass Two').ok).toBe(true)
    expect(store.getState().commitCinemaHistoryTransaction().ok).toBe(true)
    expect(store.getState().undoStack).toHaveLength(1)
    expect(store.getState().compositions[0]?.metadata.name).toBe('Pass Two')
    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)

    expect(store.getState().beginCinemaHistoryTransaction('Cancelled edit').ok).toBe(true)
    expect(store.getState().renameCinemaComposition(compositionId, 'Discard Me').ok).toBe(true)
    expect(store.getState().cancelCinemaHistoryTransaction().ok).toBe(true)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
  })

  it('clears redo only after a new committed edit and keeps history bounded', () => {
    const store = createCinemaStore({ initialState: populatedState(), historyLimit: 2 })
    store.getState().renameCinemaComposition(compositionId, 'One')
    store.getState().renameCinemaComposition(compositionId, 'Two')
    store.getState().renameCinemaComposition(compositionId, 'Three')
    expect(store.getState().undoStack).toHaveLength(2)

    store.getState().undoCinemaEdit()
    expect(store.getState().redoStack).toHaveLength(1)
    store.getState().beginCinemaHistoryTransaction('No-op')
    store.getState().commitCinemaHistoryTransaction()
    expect(store.getState().redoStack).toHaveLength(1)
    store.getState().renameCinemaComposition(compositionId, 'New branch')
    expect(store.getState().redoStack).toEqual([])
  })
})

describe('Cinema Stage 20 library workflows', () => {
  it('duplicates every composition-local stable ID and preserves internal graph references', () => {
    const candidate = JSON.parse(JSON.stringify(populatedState()))
    candidate.compositions[0].metadata.provenance = {
      builtIn: false,
      libraryOrigin: 'user',
      libraryVersion: 1,
      savedRevision: 1,
    }
    candidate.compositions[0].cameras = [{
      id: cameraId,
      label: 'Shared Camera',
      mode: 'locked',
      parameterValues: {},
      invalidRegions: [{ id: 'camera-core', shape: 'sphere', center: [0, 0, 0], radius: 0.5 }],
      authoredShots: [{ id: 'hero-shot', mode: 'locked', metadata: { trackedNodeId: sourceNodeId } }],
      metadata: { trackedNodeId: sourceNodeId },
    }]
    candidate.compositions[0].performanceRules[0].actions.push({
      schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
      id: stable<CinemaActionId>('camera-action', 'performance action'),
      type: 'select-camera',
      cameraId,
    })
    candidate.compositions[0].performanceRules[0].actions.push({
      schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
      id: stable<CinemaActionId>('node-action', 'performance action'),
      type: 'set-node-enabled',
      nodeId: sourceNodeId,
      enabled: true,
    })

    const store = createCinemaStore({ initialState: candidate })
    const duplicateId = stable<CinemaCompositionId>('composition-copy', 'composition')
    expect(store.getState().duplicateCinemaComposition(compositionId, duplicateId, 'Independent Copy').ok).toBe(true)

    const source = store.getState().compositions.find(value => value.id === compositionId)!
    const copy = store.getState().compositions.find(value => value.id === duplicateId)!
    expect(copy.metadata.name).toBe('Independent Copy')
    expect(copy.revision).toBe(1)
    expect(getCinemaCompositionLibraryStatus(copy)).toEqual({ provenance: 'user', modified: false, savedRevision: 1 })

    const sourceIds = new Set([
      ...source.nodes.map(value => String(value.id)),
      ...source.connections.map(value => String(value.id)),
      ...source.cameras.map(value => String(value.id)),
      ...source.assetBindings.map(value => String(value.id)),
      ...source.modulationRoutes.map(value => String(value.id)),
      ...source.performanceRules.map(value => String(value.id)),
      ...source.performanceRules.flatMap(rule => rule.actions.map(value => String(value.id))),
    ])
    const copyIds = [
      ...copy.nodes.map(value => String(value.id)),
      ...copy.connections.map(value => String(value.id)),
      ...copy.cameras.map(value => String(value.id)),
      ...copy.assetBindings.map(value => String(value.id)),
      ...copy.modulationRoutes.map(value => String(value.id)),
      ...copy.performanceRules.map(value => String(value.id)),
      ...copy.performanceRules.flatMap(rule => rule.actions.map(value => String(value.id))),
    ]
    expect(copyIds.every(id => !sourceIds.has(id))).toBe(true)

    expect(copy.connections[0].from.nodeId).toBe(copy.nodes[0].id)
    expect(copy.connections[0].to.nodeId).toBe(copy.nodes[1].id)
    expect(copy.outputNodeId).toBe(copy.nodes[1].id)
    expect(copy.nodes[0].assetBindingIds).toEqual([copy.assetBindings[0].id])
    const route = parseCinemaParameterPath(copy.modulationRoutes[0].destination)
    expect(route.ok && route.ownerId).toBe(String(copy.nodes[0].id))
    expect(copy.performanceRules[0].actions.find(action => action.type === 'select-camera')).toMatchObject({
      cameraId: copy.cameras[0].id,
    })
    expect(copy.performanceRules[0].actions.find(action => action.type === 'set-node-enabled')).toMatchObject({
      nodeId: copy.nodes[0].id,
    })
    expect(copy.cameras[0].metadata).toMatchObject({ trackedNodeId: copy.nodes[0].id })
    expect(copy.cameras[0].authoredShots?.[0].id).not.toBe(source.cameras[0].authoredShots?.[0].id)
    expect(copy.cameras[0].invalidRegions?.[0].id).not.toBe(source.cameras[0].invalidRegions?.[0].id)
  })

  it('protects built-ins, supports Save As, tracks modified status, and selects a safe fallback on deletion', () => {
    const foundationStore = createCinemaStore()
    const builtInId = foundationStore.getState().activeCompositionId!
    const beforeBuiltIn = snapshotCinemaPersistedState(foundationStore.getState())
    expect(foundationStore.getState().renameCinemaComposition(builtInId, 'Do not mutate').ok).toBe(false)
    expect(foundationStore.getState().deleteCinemaComposition(builtInId).ok).toBe(false)
    const builtInDefinitionId = foundationStore.getState().definitions[0].id
    expect(foundationStore.getState().deleteCinemaDefinition(builtInDefinitionId).ok).toBe(false)
    expect(snapshotCinemaPersistedState(foundationStore.getState())).toEqual(beforeBuiltIn)

    const savedAsId = stable<CinemaCompositionId>('saved-reference-copy', 'composition')
    expect(foundationStore.getState().saveCinemaCompositionAs(builtInId, savedAsId, 'Reference Copy').ok).toBe(true)
    const savedAs = foundationStore.getState().compositions.find(value => value.id === savedAsId)!
    expect(getCinemaCompositionLibraryStatus(savedAs)).toEqual({ provenance: 'user', modified: false, savedRevision: 1 })
    expect(foundationStore.getState().activeCompositionId).toBe(savedAsId)

    expect(foundationStore.getState().renameCinemaComposition(savedAsId, 'Reference Copy Renamed').ok).toBe(true)
    expect(getCinemaCompositionLibraryStatus(foundationStore.getState().compositions.find(value => value.id === savedAsId)!)).toMatchObject({ modified: true })
    expect(foundationStore.getState().saveCinemaComposition(savedAsId, '2026-08-07T06:00:00.000Z').ok).toBe(true)
    expect(getCinemaCompositionLibraryStatus(foundationStore.getState().compositions.find(value => value.id === savedAsId)!)).toMatchObject({ modified: false })

    expect(foundationStore.getState().deleteCinemaComposition(savedAsId).ok).toBe(true)
    expect(foundationStore.getState().activeCompositionId).not.toBeNull()
    expect(foundationStore.getState().activeCompositionId).not.toBe(savedAsId)
  })

  it('exports one portable user composition and merges it without replacing unrelated project state', () => {
    const source = createCinemaStore({ initialState: populatedState() })
    const packageDefinition = source.getState().exportCinemaCompositionPackage(compositionId, {
      exportedAt: '2026-08-07T06:00:00.000Z',
    })
    expect(packageDefinition.compositions).toHaveLength(1)
    expect(packageDefinition.definitions).toEqual([])
    expect(packageDefinition.instances).toHaveLength(1)
    expect(packageDefinition.collections).toHaveLength(1)
    expect(packageDefinition.assetIds).toEqual([assetId])

    const target = createCinemaStore()
    const builtInsBefore = target.getState().compositions.length
    expect(target.getState().importCinemaPackage(packageDefinition, { mode: 'merge', conflictPolicy: 'reject' }).ok).toBe(true)
    expect(target.getState().compositions).toHaveLength(builtInsBefore + 1)
    expect(target.getState().compositions.some(value => value.id === compositionId)).toBe(true)
  })

  it('routes the canonical Cinema snapshot through project persistence and round-trips without IndexedDB', async () => {
    const snapshot = snapshotCinemaPersistedState(createCinemaStore({ initialState: populatedState() }).getState())
    const split = splitStorageValue({ state: snapshot, version: 3 }, CINEMA_PROJECT_STATE_KEYS)
    expect(split.local.state).toEqual({})
    expect(split.project.state.compositions).toEqual(snapshot.compositions)
    expect(split.project.state.activeCompositionId).toBe(snapshot.activeCompositionId)

    const storage = createSplitPersistStorage<CinemaPersistedState>({
      projectKeys: CINEMA_PROJECT_STATE_KEYS,
      databaseName: 'cinema-stage20-test',
      objectStoreName: 'cinema-state',
    })
    await storage.setItem('cinema-project', { state: snapshot, version: 4 })
    const reloaded = await storage.getItem('cinema-project')
    expect(reloaded?.state.compositions).toEqual(snapshot.compositions)
    expect(reloaded?.state.activeCompositionId).toBe(snapshot.activeCompositionId)

    const reopenedStore = createCinemaStore()
    expect(reopenedStore.getState().hydrateCinemaState(reloaded?.state).ok).toBe(true)
    expect(reopenedStore.getState().activeCompositionId).toBe(snapshot.activeCompositionId)
    expect(reopenedStore.getState().compositions).toEqual(snapshot.compositions)
    expect(reopenedStore.getState().instances).toEqual(snapshot.instances)
    expect(reopenedStore.getState().collections).toEqual(snapshot.collections)
  })
})

describe('Cinema package preflight and atomic import/export', () => {
  it('round-trips serializable definitions and compositions without runtime resources', () => {
    const store = createCinemaStore({ initialState: populatedState() })
    const packageDefinition = store.getState().exportCinemaPackage({ exportedAt: '2026-08-06T11:00:00.000Z' })
    const encoded = encodeCinemaPackage(packageDefinition)
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return

    expect(encoded.value).not.toMatch(/WebGLTexture|WebGLFramebuffer|HTMLCanvasElement|blob:/)
    const decoded = decodeCinemaPackage(encoded.value)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value.schemaId).toBe(CINEMA_PACKAGE_SCHEMA_ID)
    expect(decoded.value.schemaVersion).toBe(CINEMA_PACKAGE_SCHEMA_VERSION)
    expect(decoded.value).toEqual(packageDefinition)

    const target = createCinemaStore()
    expect(target.getState().importCinemaPackage(decoded.value).ok).toBe(true)
    expect(snapshotCinemaPersistedState(target.getState())).toEqual(snapshotCinemaPersistedState(store.getState()))
  })

  it('migrates schema-v1 packages before atomic preflight', () => {
    const current = createCinemaPackageFromPersistedState(populatedState(), {
      exportedAt: '2026-08-06T11:00:00.000Z',
    })
    const legacy = JSON.parse(JSON.stringify(current)) as {
      schemaVersion: number
      migrationProvenance?: Array<{ fromSchemaVersion: number; toSchemaVersion: number; migratedAt: string }>
      compositions: Array<{
        schemaVersion: number
        performanceRules: Array<{
          schemaVersion?: number
          condition: { schemaVersion?: number }
          actions: Array<{ schemaVersion?: number; id?: string }>
        }>
      }>
    }
    legacy.schemaVersion = 1
    legacy.compositions[0].schemaVersion = 1
    delete legacy.compositions[0].performanceRules[0].schemaVersion
    delete legacy.compositions[0].performanceRules[0].condition.schemaVersion
    delete legacy.compositions[0].performanceRules[0].actions[0].schemaVersion
    delete legacy.compositions[0].performanceRules[0].actions[0].id

    const preflight = preflightCinemaPackage(legacy)
    expect(preflight.ok).toBe(true)
    if (!preflight.ok) return
    expect(preflight.value.schemaVersion).toBe(CINEMA_PACKAGE_SCHEMA_VERSION)
    expect(preflight.value.compositions[0].schemaVersion).toBe(CINEMA_COMPOSITION_SCHEMA_VERSION)
    expect(preflight.value.compositions[0].performanceRules[0].actions[0]).toMatchObject({
      schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
      id: 'drop-rule-action-1',
    })
    expect(preflight.value.migrationProvenance).toEqual(expect.arrayContaining([
      { fromSchemaVersion: 1, toSchemaVersion: 2, migratedAt: '2026-08-06T00:00:00.000Z' },
      { fromSchemaVersion: 2, toSchemaVersion: 3, migratedAt: '2026-08-06T20:41:00.000Z' },
      { fromSchemaVersion: 3, toSchemaVersion: CINEMA_PACKAGE_SCHEMA_VERSION, migratedAt: '2026-08-07T03:38:00.000Z' },
    ]))
  })

  it('accepts packages that rely on external runtime definitions', () => {
    const canonical = createCinemaPackageFromPersistedState(populatedState(), {
      exportedAt: '2026-08-06T11:00:00.000Z',
    })
    const { definitions: _definitions, ...stageOnePackageBase } = canonical
    const stageOnePackage = {
      ...stageOnePackageBase,
      activeCompositionId: null,
      activeInstanceId: null,
    }

    const preflight = preflightCinemaPackage(stageOnePackage)
    expect(preflight.ok).toBe(true)
    if (!preflight.ok) return
    expect(preflight.value.definitions).toEqual([])
    expect(preflight.diagnostics.diagnostics.some(diagnostic => (
      diagnostic.code === 'CINEMA_PLUGIN_UNAVAILABLE'
      && diagnostic.severity === 'warning'
    ))).toBe(true)

    const target = createCinemaStore()
    expect(target.getState().importCinemaPackage(stageOnePackage).ok).toBe(true)
    expect(target.getState().definitions).toEqual([])
    expect(target.getState().compositions).toHaveLength(1)
    expect(target.getState().activeCompositionId).toBe(null)
  })

  it('rejects malformed, conflicting, and cancelled imports atomically', () => {
    const store = createCinemaStore({ initialState: populatedState() })
    const before = snapshotCinemaPersistedState(store.getState())

    expect(store.getState().importCinemaPackage({ schemaId: CINEMA_PACKAGE_SCHEMA_ID, schemaVersion: 999 }).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)

    const validPackage = createCinemaPackageFromPersistedState(before, {
      exportedAt: '2026-08-06T11:00:00.000Z',
    })
    expect(store.getState().importCinemaPackage({ ...validPackage, unexpectedRuntimeHint: true }).ok).toBe(false)
    expect(store.getState().importCinemaPackage({ ...validPackage, assetIds: [] }).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)

    const packageDefinition = createCinemaPackageFromPersistedState(before, {
      exportedAt: '2026-08-06T11:00:00.000Z',
    })
    expect(store.getState().importCinemaPackage(packageDefinition, { mode: 'merge' }).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)

    const controller = new AbortController()
    controller.abort()
    expect(store.getState().importCinemaPackage(packageDefinition, { signal: controller.signal }).ok).toBe(false)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
  })
})
