import { describe, expect, it } from 'vitest'
import { createCinemaComposerComposition } from '../CinemaComposer'
import {
  CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
  CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
  CINEMA_EFFECT_NODE_TYPE_IDS,
} from '../CinemaCompositorNodes'
import {
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  createCinemaFoundationPersistedState,
} from '../CinemaFoundation'
import { createCinemaDefinitionRegistryFromPersistedDefinitions } from '../CinemaDefinitionRegistry'
import { compileCinemaCompositionGraph } from '../CinemaGraphCompiler'
import {
  checkCinemaGraphConnection,
  connectCinemaGraphNodes,
  createCinemaGraphNode,
  removeCinemaGraphNodes,
  setCinemaGraphNodesEnabled,
} from '../CinemaGraphEditor'
import {
  CINEMA_GRAPH_EDITOR_METADATA_KEY,
  CINEMA_GRAPH_EDITOR_METADATA_VERSION,
  getCinemaGraphEditorCompositionMetadata,
  normalizeCinemaGraphEditorMetadata,
} from '../CinemaGraphEditorMetadata'
import { cinemaStableId, type CinemaCompositionId } from '../CinemaIdentifiers'
import { CINEMA_PERSISTED_STORE_SCHEMA_VERSION, normalizeCinemaPersistedState } from '../CinemaPersistence'
import { createCinemaStore, getCinemaEditorSelection } from '../CinemaStore'

function createUserComposition(idValue = 'stage22-graph-editor') {
  const id = cinemaStableId<CinemaCompositionId>(idValue, 'composition')
  return createCinemaComposerComposition({ id, name: 'Stage 22 Graph Editor' })
}

describe('Cinema Stage 22 graph editor metadata', () => {
  it('migrates schema-v3 state into versioned editor layout metadata while preserving legacy selection', () => {
    const foundation = createCinemaFoundationPersistedState()
    const active = foundation.compositions[0]
    const legacy = {
      ...foundation,
      schemaVersion: 3,
      editorMetadata: {
        ...foundation.editorMetadata,
        [CINEMA_GRAPH_EDITOR_METADATA_KEY]: undefined,
        composerSelectionByComposition: { [active.id]: active.nodes[0].id },
      },
      migrationProvenance: [],
    }
    delete (legacy.editorMetadata as Record<string, unknown>)[CINEMA_GRAPH_EDITOR_METADATA_KEY]

    const normalized = normalizeCinemaPersistedState(legacy)
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    expect(normalized.value.schemaVersion).toBe(CINEMA_PERSISTED_STORE_SCHEMA_VERSION)
    expect(normalized.value.migrationProvenance).toContainEqual({
      fromSchemaVersion: 3,
      toSchemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
      migratedAt: '2026-08-07T03:38:00.000Z',
    })
    expect((normalized.value.editorMetadata[CINEMA_GRAPH_EDITOR_METADATA_KEY] as { schemaVersion: number }).schemaVersion).toBe(CINEMA_GRAPH_EDITOR_METADATA_VERSION)
    expect(getCinemaEditorSelection(normalized.value.editorMetadata, active.id)).toBe(active.nodes[0].id)
  })

  it('rejects unknown future graph-layout metadata versions instead of silently reinterpreting them', () => {
    const result = normalizeCinemaGraphEditorMetadata({
      [CINEMA_GRAPH_EDITOR_METADATA_KEY]: { schemaVersion: 99, compositions: {} },
    })
    expect(result.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_SCHEMA_VERSION_UNSUPPORTED')).toBe(true)
  })
})

describe('Cinema Stage 22 canonical graph/store integration', () => {
  it('keeps layout outside compilation and restores layout plus selection through undo/redo', () => {
    const foundation = createCinemaFoundationPersistedState()
    const store = createCinemaStore({ initialState: foundation })
    const composition = createUserComposition()
    expect(store.getState().upsertCinemaComposition(composition).ok).toBe(true)
    expect(store.getState().setActiveCinemaComposition(composition.id).ok).toBe(true)

    const registry = createCinemaDefinitionRegistryFromPersistedDefinitions(store.getState().definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY).registry
    const beforeCompile = compileCinemaCompositionGraph(composition, registry)
    expect(beforeCompile.ok).toBe(true)
    if (!beforeCompile.ok) return

    const firstNode = composition.nodes[0].id
    const secondNode = composition.nodes[1].id
    store.getState().setCinemaEditorSelection(composition.id, firstNode)
    store.getState().setCinemaGraphEditorMode(composition.id, 'graph')
    expect(store.getState().beginCinemaHistoryTransaction('Move graph selection').ok).toBe(true)
    expect(store.getState().setCinemaGraphEditorSelection(composition.id, [secondNode], null).ok).toBe(true)
    expect(store.getState().setCinemaGraphNodePositions(composition.id, {
      [firstNode]: { x: 17, y: 29 },
      [secondNode]: { x: 411, y: 173 },
    }).ok).toBe(true)
    expect(store.getState().commitCinemaHistoryTransaction().ok).toBe(true)

    const afterComposition = store.getState().compositions.find(candidate => candidate.id === composition.id)
    expect(afterComposition).toEqual(composition)
    const afterCompile = compileCinemaCompositionGraph(afterComposition, registry)
    expect(afterCompile.ok).toBe(true)
    if (!afterCompile.ok) return
    expect(afterCompile.plan.nodeOrder).toEqual(beforeCompile.plan.nodeOrder)

    let graphMetadata = getCinemaGraphEditorCompositionMetadata(store.getState().editorMetadata, composition.id)
    expect(graphMetadata.mode).toBe('graph')
    expect(graphMetadata.selectedNodeIds).toEqual([secondNode])
    expect(graphMetadata.nodePositions[String(firstNode)]).toEqual({ x: 17, y: 29 })

    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    graphMetadata = getCinemaGraphEditorCompositionMetadata(store.getState().editorMetadata, composition.id)
    expect(graphMetadata.selectedNodeIds).toEqual([firstNode])
    expect(graphMetadata.nodePositions[String(firstNode)]).toBeUndefined()

    expect(store.getState().redoCinemaEdit().ok).toBe(true)
    graphMetadata = getCinemaGraphEditorCompositionMetadata(store.getState().editorMetadata, composition.id)
    expect(graphMetadata.selectedNodeIds).toEqual([secondNode])
    expect(graphMetadata.nodePositions[String(secondNode)]).toEqual({ x: 411, y: 173 })
  })

  it('authors disabled draft nodes and pending typed edges without corrupting the live graph, then activates with single-input replacement', () => {
    const foundation = createCinemaFoundationPersistedState()
    const composition = createUserComposition('stage22-draft-authoring')
    const effectDefinition = foundation.definitions.find(definition => definition.id === CINEMA_EFFECT_NODE_TYPE_IDS.bloom)
    expect(effectDefinition).toBeDefined()
    if (!effectDefinition) return
    const registry = createCinemaDefinitionRegistryFromPersistedDefinitions(
      foundation.definitions,
      CINEMA_PRODUCTION_RUNTIME_REGISTRY,
    ).registry

    const draft = createCinemaGraphNode(composition, effectDefinition)
    const draftNode = draft.composition.nodes.find(node => node.id === draft.selectedNodeId)
    expect(draftNode?.enabled).toBe(false)
    if (!draftNode) return

    const wrongDirection = checkCinemaGraphConnection(draft.composition, {
      fromNodeId: draftNode.id,
      fromPortId: CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
      toNodeId: draft.composition.outputNodeId,
      toPortId: CINEMA_FOUNDATION_INPUT_PORT_ID,
    }, foundation.definitions, registry)
    expect(wrongDirection.ok).toBe(false)
    expect(wrongDirection.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_PORT_DIRECTION_INVALID')

    const existingOutputConnection = draft.composition.connections.find(connection => (
      connection.enabled
      && connection.to.nodeId === draft.composition.outputNodeId
      && connection.to.portId === CINEMA_FOUNDATION_INPUT_PORT_ID
    ))
    expect(existingOutputConnection).toBeDefined()
    if (!existingOutputConnection) return

    const withPendingInput = connectCinemaGraphNodes(draft.composition, {
      fromNodeId: existingOutputConnection.from.nodeId,
      fromPortId: existingOutputConnection.from.portId,
      toNodeId: draftNode.id,
      toPortId: CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
    }, foundation.definitions, registry)
    const withPendingConnection = connectCinemaGraphNodes(withPendingInput, {
      fromNodeId: draftNode.id,
      fromPortId: CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
      toNodeId: draft.composition.outputNodeId,
      toPortId: CINEMA_FOUNDATION_INPUT_PORT_ID,
    }, foundation.definitions, registry, { replaceExistingInput: true })
    const pending = withPendingConnection.connections.find(connection => connection.from.nodeId === draftNode.id)
    expect(pending?.enabled).toBe(false)

    const activated = setCinemaGraphNodesEnabled(
      withPendingConnection,
      [draftNode.id],
      true,
      foundation.definitions,
    )
    expect(activated.nodes.find(node => node.id === draftNode.id)?.enabled).toBe(true)
    expect(activated.connections.find(connection => connection.id === pending?.id)?.enabled).toBe(true)
    const outputConnections = activated.connections.filter(connection => (
      connection.to.nodeId === activated.outputNodeId
      && connection.to.portId === CINEMA_FOUNDATION_INPUT_PORT_ID
      && connection.enabled
    ))
    expect(outputConnections).toHaveLength(1)
    expect(outputConnections[0]?.from.nodeId).toBe(draftNode.id)
    expect(compileCinemaCompositionGraph(activated, registry).ok).toBe(true)

    const removed = removeCinemaGraphNodes(activated, [draftNode.id]).composition
    const restoredOutputConnections = removed.connections.filter(connection => (
      connection.enabled
      && connection.to.nodeId === removed.outputNodeId
      && connection.to.portId === CINEMA_FOUNDATION_INPUT_PORT_ID
    ))
    expect(restoredOutputConnections).toHaveLength(1)
    expect(restoredOutputConnections[0]?.from).toEqual(existingOutputConnection.from)
    expect(compileCinemaCompositionGraph(removed, registry).ok).toBe(true)
  })

  it('round-trips graph mode, viewport, positions, and selection through scoped package export/import', () => {
    const store = createCinemaStore({ initialState: createCinemaFoundationPersistedState() })
    const composition = createUserComposition('stage22-package')
    store.getState().upsertCinemaComposition(composition)
    store.getState().setCinemaGraphEditorMode(composition.id, 'graph')
    store.getState().setCinemaGraphEditorViewport(composition.id, { x: 55, y: -18, zoom: 1.2 })
    store.getState().setCinemaGraphEditorSelection(composition.id, [composition.nodes[1].id], null)
    store.getState().setCinemaGraphNodePositions(composition.id, { [composition.nodes[1].id]: { x: 320, y: 140 } })

    const packageDefinition = store.getState().exportCinemaCompositionPackage(composition.id, { exportedAt: '2026-08-07T03:38:00.000Z' })
    const target = createCinemaStore({ initialState: createCinemaFoundationPersistedState() })
    expect(target.getState().importCinemaPackage(packageDefinition, { mode: 'merge', conflictPolicy: 'reject' }).ok).toBe(true)
    const restored = getCinemaGraphEditorCompositionMetadata(target.getState().editorMetadata, composition.id)
    expect(restored).toMatchObject({
      mode: 'graph',
      viewport: { x: 55, y: -18, zoom: 1.2 },
      selectedNodeIds: [composition.nodes[1].id],
    })
    expect(restored.nodePositions[String(composition.nodes[1].id)]).toEqual({ x: 320, y: 140 })
  })
})
