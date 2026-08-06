import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PACKAGE_SCHEMA_ID,
  CINEMA_PACKAGE_SCHEMA_VERSION,
  CINEMA_PERSISTED_STORE_SCHEMA_ID,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  CINEMA_SHADER_SCENE_ADAPTER_BUNDLE,
  cinemaNamespacedId,
  cinemaStableId,
  createCinemaPackageFromPersistedState,
  createCinemaParameterPath,
  createCinemaStore,
  decodeCinemaPackage,
  encodeCinemaPackage,
  normalizeCinemaPersistedState,
  preflightCinemaPackage,
  snapshotCinemaPersistedState,
  type CinemaAssetBindingId,
  type CinemaAssetId,
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
  type CinemaPortId,
  type CinemaRendererPluginId,
  type CinemaStableId,
} from '../index'

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
      id: stable<CinemaPerformanceRuleId>('drop-rule', 'performance rule'),
      label: 'Drop Rule',
      priority: 10,
      enabled: true,
      condition: { event: namespaced<CinemaEventId>('music.drop-start', 'event') },
      actions: [{
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
  it('initializes and reloads a valid schema-v1 canonical state', () => {
    const fresh = createCinemaStore()
    expect(fresh.getState().schemaId).toBe(CINEMA_PERSISTED_STORE_SCHEMA_ID)
    expect(fresh.getState().schemaVersion).toBe(1)
    expect(fresh.getState().activeCompositionId).toBe(CINEMA_SHADER_REFERENCE_COMPOSITION.id)
    expect(fresh.getState().compositions).toHaveLength(3)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_SHADER_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().compositions.some(candidate => candidate.id === CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(fresh.getState().definitions).toHaveLength(
      2 + CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.length + CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.length,
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

  it('accepts schema-v1 packages that rely on external runtime definitions', () => {
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
