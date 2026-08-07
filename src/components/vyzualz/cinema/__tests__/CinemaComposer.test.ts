import { describe, expect, it } from 'vitest'
import {
  CINEMA_EFFECT_NODE_TYPE_IDS,
  CINEMA_FOUNDATION_OPACITY_PARAMETER_ID,
  CINEMA_MODULATION_SOURCE_IDS,
  CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  addCinemaComposerNode,
  assignCinemaComposerNodeAsset,
  assignCinemaComposerMask,
  attachCinemaComposerEffect,
  buildCinemaComposerLibraryItems,
  cinemaStableId,
  createCinemaParameterPath,
  createCinemaComposerComposition,
  getCinemaComposerLayers,
  removeCinemaComposerLayer,
  removeCinemaComposerMask,
  reorderCinemaComposerLayer,
  setCinemaComposerBlendMode,
  setCinemaComposerLayerOpacity,
  type CinemaAssetId,
  type CinemaCompositionId,
  type CinemaModulationRouteId,
} from '..'
import { createCinemaDefinitionRegistryFromPersistedDefinitions } from '../CinemaDefinitionRegistry'
import { validateCinemaCompositionGraph } from '../CinemaGraphCompiler'
import { createCinemaFoundationPersistedState } from '../CinemaFoundation'
import { createCinemaStore, getCinemaEditorSelection } from '../CinemaStore'

const definitions = CINEMA_PRODUCTION_PERSISTED_DEFINITIONS
const registry = createCinemaDefinitionRegistryFromPersistedDefinitions(definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY).registry

function expectValid(composition: ReturnType<typeof createCinemaComposerComposition>) {
  const validation = validateCinemaCompositionGraph(composition, registry)
  expect(validation.valid, validation.diagnostics.diagnostics.map(diagnostic => diagnostic.message).join('\n')).toBe(true)
}

describe('Cinema Composer graph editing', () => {
  it('rewires the canonical graph for layer order, blend, opacity, masks, and effects', () => {
    const id = cinemaStableId<CinemaCompositionId>('composer-test', 'composition')
    let composition = createCinemaComposerComposition({ id, name: 'Composer test' })
    expectValid(composition)

    const first = getCinemaComposerLayers(composition)[0]
    const second = getCinemaComposerLayers(composition)[1]
    composition = setCinemaComposerLayerOpacity(composition, first.node.id, 0.42, definitions).composition
    composition = reorderCinemaComposerLayer(composition, first.node.id, 1, definitions).composition
    composition = setCinemaComposerBlendMode(composition, second.node.id, 'multiply', definitions).composition

    const bloom = definitions.find(definition => definition.id === CINEMA_EFFECT_NODE_TYPE_IDS.bloom)
    expect(bloom).toBeTruthy()
    composition = attachCinemaComposerEffect(composition, second.node.id, bloom!, definitions).composition

    const maskLibraryItem = buildCinemaComposerLibraryItems(definitions, CINEMA_PRODUCTION_RUNTIME_REGISTRY)
      .find(item => item.category === 'Masks' && item.available)
    if (maskLibraryItem) {
      const maskDefinition = definitions.find(definition => definition.id === maskLibraryItem.typeId)!
      const addedMask = addCinemaComposerNode(composition, maskDefinition, definitions)
      composition = addedMask.composition
      composition = assignCinemaComposerMask(composition, second.node.id, addedMask.selectedNodeId!, definitions).composition
      expect(getCinemaComposerLayers(composition).find(layer => layer.node.id === second.node.id)?.blendMode).toBe('masked')
      composition = removeCinemaComposerMask(composition, addedMask.selectedNodeId!, definitions).composition
      expect(getCinemaComposerLayers(composition).find(layer => layer.node.id === second.node.id)?.maskNodeId).toBeNull()
    }

    expect(getCinemaComposerLayers(composition)).toHaveLength(2)
    expect(getCinemaComposerLayers(composition).find(layer => layer.node.id === first.node.id)?.node.opacity).toBe(0.42)
    expectValid(composition)
  })

  it('keeps a bottom-layer mask valid and removes dependent routes and bindings with a deleted layer', () => {
    const id = cinemaStableId<CinemaCompositionId>('composer-delete-reconcile', 'composition')
    let composition = createCinemaComposerComposition({ id, name: 'Delete reconciliation' })
    const bottom = getCinemaComposerLayers(composition)[0]
    const maskDefinition = definitions.find(definition => definition.definition.label === 'Generated Mask')
    expect(maskDefinition).toBeTruthy()
    const addedMask = addCinemaComposerNode(composition, maskDefinition!, definitions)
    composition = assignCinemaComposerMask(addedMask.composition, bottom.node.id, addedMask.selectedNodeId!, definitions).composition
    expectValid(composition)
    expect(composition.nodes.find(node => node.label === 'Transparent Composer Background')?.enabled).toBe(true)

    const assetId = cinemaStableId<CinemaAssetId>('composer-test-asset', 'asset')
    composition = assignCinemaComposerNodeAsset(composition, bottom.node.id, assetId, 'image').composition
    composition = {
      ...composition,
      modulationRoutes: [{
        id: cinemaStableId<CinemaModulationRouteId>('composer-layer-opacity-route', 'modulation route'),
        sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
        destination: createCinemaParameterPath('nodes', CINEMA_FOUNDATION_OPACITY_PARAMETER_ID, bottom.node.id),
        mode: 'add',
        amount: 0.2,
        enabled: true,
      }],
    }
    const removed = removeCinemaComposerLayer(composition, bottom.node.id, definitions).composition
    expect(removed.modulationRoutes).toHaveLength(0)
    expect(removed.assetBindings).toHaveLength(0)
    expect(removed.nodes.some(node => node.id === addedMask.selectedNodeId)).toBe(true)
    expect(removed.nodes.find(node => node.id === addedMask.selectedNodeId)?.enabled).toBe(false)
    expectValid(removed)
  })

  it('coalesces canonical edits into full-document undo/redo and reconciles selection on deletion', () => {
    const store = createCinemaStore({ initialState: createCinemaFoundationPersistedState() })
    const id = cinemaStableId<CinemaCompositionId>('composer-history', 'composition')
    const composition = createCinemaComposerComposition({ id, name: 'History test' })
    expect(store.getState().upsertCinemaComposition(composition).ok).toBe(true)
    expect(store.getState().setActiveCinemaComposition(id).ok).toBe(true)
    const first = getCinemaComposerLayers(composition)[0]
    expect(store.getState().setCinemaEditorSelection(id, first.node.id).ok).toBe(true)

    expect(store.getState().beginCinemaHistoryTransaction('Opacity gesture').ok).toBe(true)
    for (const opacity of [0.9, 0.7, 0.5]) {
      expect(store.getState().editCinemaComposition(id, 'Adjust opacity', current => (
        setCinemaComposerLayerOpacity(current, first.node.id, opacity, definitions)
      )).ok).toBe(true)
    }
    expect(store.getState().commitCinemaHistoryTransaction().ok).toBe(true)
    expect(store.getState().undoStack).toHaveLength(3)
    expect(getCinemaComposerLayers(store.getState().compositions.find(candidate => candidate.id === id)!)[0].node.opacity).toBe(0.5)
    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(getCinemaComposerLayers(store.getState().compositions.find(candidate => candidate.id === id)!)[0].node.opacity).toBe(1)
    expect(store.getState().redoCinemaEdit().ok).toBe(true)
    expect(getCinemaComposerLayers(store.getState().compositions.find(candidate => candidate.id === id)!)[0].node.opacity).toBe(0.5)

    expect(store.getState().editCinemaComposition(id, 'Remove layer', current => (
      removeCinemaComposerLayer(current, first.node.id, definitions)
    )).ok).toBe(true)
    expect(getCinemaEditorSelection(store.getState().editorMetadata, id)).not.toBe(first.node.id)
    expectValid(store.getState().compositions.find(candidate => candidate.id === id)!)
  })
})
