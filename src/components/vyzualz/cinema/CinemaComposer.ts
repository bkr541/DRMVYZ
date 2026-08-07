import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaAssetBindingDefinition,
  type CinemaAssetRole,
  type CinemaBlendMode,
  type CinemaCompositionDefinition,
  type CinemaConnectionDefinition,
  type CinemaJsonObject,
  type CinemaNodeDefinition,
  type CinemaNodeFamily,
  type CinemaParameterValue,
  type CinemaPerformanceAction,
} from './CinemaDomain'
import {
  cinemaStableId,
  parseCinemaParameterPath,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaCameraId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
} from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import { createCinemaCameraParameterSchemas } from './CinemaCameraRuntime'
import { CINEMA_LIBRARY_PROVENANCE_VERSION } from './CinemaLibrary'
import { CINEMA_GENERATED_MASK_NODE_TYPE_ID } from './CinemaMediaTextNodes'
import type { CinemaRuntimeNodeRegistry } from './CinemaRuntimeNodeRegistry'
import { getCinemaParameterDefaultValue, normalizeCinemaParameterValue } from './CinemaParameterSchema'
import {
  CINEMA_BLEND_NODE_TYPE_IDS,
  CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
  CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID,
  CINEMA_EFFECT_NODE_TYPE_IDS,
  CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID,
} from './CinemaCompositorNodes'
import {
  CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
  CINEMA_FOUNDATION_GRADIENT_TYPE_ID,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_OPACITY_PARAMETER_ID,
  CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
} from './CinemaFoundation'

export const CINEMA_COMPOSER_VERSION = 1 as const
export const CINEMA_COMPOSER_METADATA_KEY = 'cinemaComposer' as const

export type CinemaComposerNodeKind = 'layer' | 'effect' | 'blend' | 'mask' | 'background'
export type CinemaComposerBlendMode = Exclude<CinemaBlendMode, 'masked'> | 'masked'

interface CinemaComposerNodeMetadata {
  kind: CinemaComposerNodeKind
  layerId?: string
  order?: number
  blendMode?: CinemaComposerBlendMode
  unmaskedBlendMode?: Exclude<CinemaComposerBlendMode, 'masked'>
  blendNodeId?: string
  maskNodeId?: string
  effectOrder?: number
}

export interface CinemaComposerLayer {
  node: Readonly<CinemaNodeDefinition>
  order: number
  blendMode: CinemaComposerBlendMode
  blendNodeId: CinemaNodeId
  maskNodeId: CinemaNodeId | null
  effects: readonly Readonly<CinemaNodeDefinition>[]
}

export interface CinemaComposerLibraryItem {
  id: string
  typeId: CinemaNodeTypeId
  label: string
  description: string
  family: CinemaNodeFamily
  category: 'Visuals' | 'Masks' | 'Effects' | 'Utilities'
  sourceKind: 'built-in' | 'adapter' | 'user'
  sourceId: string
  available: boolean
  disabledReason?: string
}

export interface CinemaComposerCreateOptions {
  id: CinemaCompositionId
  name?: string
}

export interface CinemaComposerEditResult {
  composition: CinemaCompositionDefinition
  selectedNodeId?: CinemaNodeId | null
}

const BLEND_MODE_BY_TYPE_ID = new Map<string, CinemaComposerBlendMode>([
  ...Object.entries(CINEMA_BLEND_NODE_TYPE_IDS).map(([mode, typeId]) => [String(typeId), mode as CinemaComposerBlendMode] as const),
  [String(CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID), 'masked'],
])
const BLEND_TYPE_ID_BY_MODE = new Map<CinemaComposerBlendMode, CinemaNodeTypeId>([
  ...Object.entries(CINEMA_BLEND_NODE_TYPE_IDS).map(([mode, typeId]) => [mode as CinemaComposerBlendMode, typeId] as const),
  ['masked', CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID],
])
const EFFECT_TYPE_IDS = new Set(Object.values(CINEMA_EFFECT_NODE_TYPE_IDS).map(String))
const PRODUCTION_LIBRARY_TYPE_IDS = new Set(CINEMA_PRODUCTION_PERSISTED_DEFINITIONS.map(candidate => String(candidate.id)))

export function isCinemaComposerComposition(composition: Readonly<CinemaCompositionDefinition> | null | undefined): boolean {
  return readObject(composition?.metadata.provenance)?.composerStructured === true
}

export function createCinemaComposerComposition(options: CinemaComposerCreateOptions): CinemaCompositionDefinition {
  const gradientA = cinemaStableId<CinemaNodeId>(`${options.id}-layer-1`, 'node')
  const gradientB = cinemaStableId<CinemaNodeId>(`${options.id}-layer-2`, 'node')
  const blendA = cinemaStableId<CinemaNodeId>(`${options.id}-blend-1`, 'node')
  const blendB = cinemaStableId<CinemaNodeId>(`${options.id}-blend-2`, 'node')
  const background = cinemaStableId<CinemaNodeId>(`${options.id}-transparent-background`, 'node')
  const output = cinemaStableId<CinemaNodeId>(`${options.id}-output`, 'node')
  const composition: CinemaCompositionDefinition = {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: options.id,
    revision: 1,
    metadata: {
      name: options.name ?? 'Untitled Cinema Composition',
      description: 'Structured Cinema Composer composition.',
      tags: ['composer'],
      provenance: {
        composerStructured: true,
        composerVersion: CINEMA_COMPOSER_VERSION,
        builtIn: false,
        libraryOrigin: 'user',
        libraryVersion: CINEMA_LIBRARY_PROVENANCE_VERSION,
        savedRevision: 0,
      },
    },
    nodes: [
      createNodeFromType(CINEMA_FOUNDATION_GRADIENT_TYPE_ID, gradientA, 'procedural', 'Gradient Layer 1', {
        kind: 'layer', order: 0, blendMode: 'normal', blendNodeId: blendA,
      }),
      createNodeFromType(CINEMA_FOUNDATION_GRADIENT_TYPE_ID, gradientB, 'procedural', 'Gradient Layer 2', {
        kind: 'layer', order: 1, blendMode: 'screen', blendNodeId: blendB,
      }),
      createBlendNode(blendA, gradientA, 'normal', false),
      createBlendNode(blendB, gradientB, 'screen', true),
      {
        ...createNodeFromType(CINEMA_FOUNDATION_GRADIENT_TYPE_ID, background, 'procedural', 'Transparent Composer Background', { kind: 'background' }),
        enabled: false,
        parameterValues: { [CINEMA_FOUNDATION_OPACITY_PARAMETER_ID]: 0 },
      },
      {
        id: output,
        typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
        typeVersion: 1,
        family: 'output',
        label: 'Cinema Output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [],
    outputNodeId: output,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  }
  return rebuildCinemaComposerGraph(composition, [])
}

export function buildCinemaComposerLibraryItems(
  definitions: readonly CinemaPersistedDefinition[],
  runtimeRegistry: Pick<CinemaRuntimeNodeRegistry, 'hasPlugin'>,
): readonly CinemaComposerLibraryItem[] {
  return definitions.map(persisted => {
    const definition = persisted.definition
    const category = libraryCategory(definition.family, definition.outputPorts.map(port => port.dataType), definition.typeId)
    const compatible = category !== 'Utilities'
      && (category !== 'Visuals' && category !== 'Masks' || definition.inputPorts.every(port => !port.required))
      && (category !== 'Effects' || definition.inputPorts.some(port => port.id === CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID || port.dataType === 'color-texture'))
    const pluginAvailable = runtimeRegistry.hasPlugin(persisted.rendererPluginId)
    const available = compatible && pluginAvailable
    const sourceKind: CinemaComposerLibraryItem['sourceKind'] = PRODUCTION_LIBRARY_TYPE_IDS.has(String(persisted.id)) ? persisted.source.kind : 'user'
    return {
      id: `${sourceKind}:${persisted.source.id}:${definition.typeId}`,
      typeId: definition.typeId,
      label: definition.label,
      description: definition.description ?? `${definition.family} Cinema node`,
      family: definition.family,
      category,
      sourceKind,
      sourceId: persisted.source.id,
      available,
      ...(!pluginAvailable
        ? { disabledReason: `Renderer plugin ${persisted.rendererPluginId} is unavailable.` }
        : !compatible
          ? { disabledReason: 'This node requires graph wiring that is not supported by the structured Composer.' }
          : {}),
    }
  }).sort((left, right) => (
    compareStrings(left.category, right.category)
    || compareStrings(left.label, right.label)
    || compareStrings(String(left.typeId), String(right.typeId))
  ))
}

export function getCinemaComposerLayers(composition: Readonly<CinemaCompositionDefinition>): readonly CinemaComposerLayer[] {
  const nodesById = new Map(composition.nodes.map(node => [String(node.id), node]))
  const effectsByLayer = new Map<string, CinemaNodeDefinition[]>()
  for (const node of composition.nodes) {
    const metadata = readComposerNodeMetadata(node)
    if (metadata?.kind !== 'effect' || !metadata.layerId) continue
    const list = effectsByLayer.get(metadata.layerId) ?? []
    list.push(node)
    effectsByLayer.set(metadata.layerId, list)
  }
  return composition.nodes
    .filter(node => readComposerNodeMetadata(node)?.kind === 'layer')
    .map((node, index) => {
      const metadata = readComposerNodeMetadata(node) ?? { kind: 'layer' as const }
      const blendNodeIdText = metadata.blendNodeId ?? `${node.id}-blend`
      const blendNode = nodesById.get(blendNodeIdText)
      return {
        node,
        order: Number.isFinite(metadata.order) ? Number(metadata.order) : index,
        blendMode: metadata.blendMode ?? blendModeForNode(blendNode) ?? 'normal',
        blendNodeId: cinemaStableId<CinemaNodeId>(blendNodeIdText, 'node'),
        maskNodeId: metadata.maskNodeId ? cinemaStableId<CinemaNodeId>(metadata.maskNodeId, 'node') : null,
        effects: (effectsByLayer.get(String(node.id)) ?? []).sort((left, right) => (
          (readComposerNodeMetadata(left)?.effectOrder ?? 0) - (readComposerNodeMetadata(right)?.effectOrder ?? 0)
          || compareStrings(String(left.id), String(right.id))
        )),
      }
    })
    .sort((left, right) => left.order - right.order || compareStrings(String(left.node.id), String(right.node.id)))
}

export function getCinemaComposerMaskNodes(composition: Readonly<CinemaCompositionDefinition>): readonly Readonly<CinemaNodeDefinition>[] {
  return composition.nodes
    .filter(node => readComposerNodeMetadata(node)?.kind === 'mask')
    .sort((left, right) => compareStrings(left.label ?? String(left.id), right.label ?? String(right.id)))
}

export function addCinemaComposerNode(
  composition: Readonly<CinemaCompositionDefinition>,
  persistedDefinition: Readonly<CinemaPersistedDefinition>,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const definition = persistedDefinition.definition
  const category = libraryCategory(definition.family, definition.outputPorts.map(port => port.dataType), definition.typeId)
  if (category === 'Utilities') throw new Error(`Node type "${definition.typeId}" cannot be added by the structured Composer.`)
  if (category === 'Effects') throw new Error('Use attachCinemaComposerEffect to add effect nodes.')
  if (definition.inputPorts.some(port => port.required)) throw new Error(`Node type "${definition.typeId}" requires authored inputs.`)

  const nodeId = nextStableId<CinemaNodeId>(composition.nodes.map(node => String(node.id)), `${slug(definition.label)}-layer`, 'node')
  const isMask = category === 'Masks'
  const layers = getCinemaComposerLayers(composition)
  const blendNodeId = nextStableId<CinemaNodeId>(composition.nodes.map(node => String(node.id)), `${slug(definition.label)}-blend`, 'node')
  const node = createNodeFromPersistedDefinition(persistedDefinition, nodeId, definition.label, isMask
    ? { kind: 'mask' }
    : { kind: 'layer', order: layers.length, blendMode: 'normal', blendNodeId })
  const nextNodes = isMask
    ? [...composition.nodes, { ...node, enabled: false }]
    : [...composition.nodes, node, createBlendNode(blendNodeId, nodeId, 'normal', false)]
  const next = rebuildCinemaComposerGraph({
    ...composition,
    revision: composition.revision + 1,
    nodes: nextNodes,
  }, definitions)
  return { composition: next, selectedNodeId: nodeId }
}

export function duplicateCinemaComposerLayer(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const layers = getCinemaComposerLayers(composition)
  const sourceLayer = layers.find(layer => layer.node.id === layerNodeId)
  if (!sourceLayer) throw new Error(`Cinema layer "${layerNodeId}" does not exist.`)
  const existingIds = composition.nodes.map(node => String(node.id))
  const newLayerId = nextStableId<CinemaNodeId>(existingIds, `${slug(sourceLayer.node.label ?? 'layer')}-copy`, 'node')
  existingIds.push(String(newLayerId))
  const newBlendId = nextStableId<CinemaNodeId>(existingIds, `${slug(sourceLayer.node.label ?? 'layer')}-copy-blend`, 'node')
  existingIds.push(String(newBlendId))
  const clonedLayer: CinemaNodeDefinition = {
    ...clone(sourceLayer.node),
    id: newLayerId,
    label: `${sourceLayer.node.label ?? 'Layer'} Copy`,
    metadata: withComposerMetadata(sourceLayer.node.metadata, {
      kind: 'layer',
      order: sourceLayer.order + 1,
      blendMode: sourceLayer.blendMode,
      blendNodeId: newBlendId,
      ...(sourceLayer.maskNodeId ? { maskNodeId: sourceLayer.maskNodeId } : {}),
    }),
  }
  const shiftedNodes = composition.nodes.map(node => {
    const metadata = readComposerNodeMetadata(node)
    if (metadata?.kind !== 'layer' || (metadata.order ?? 0) <= sourceLayer.order) return node
    return { ...node, metadata: withComposerMetadata(node.metadata, { ...metadata, order: (metadata.order ?? 0) + 1 }) }
  })
  const clonedEffects: CinemaNodeDefinition[] = []
  sourceLayer.effects.forEach((effect, effectIndex) => {
    const effectId = nextStableId<CinemaNodeId>(existingIds, `${slug(effect.label ?? 'effect')}-copy`, 'node')
    existingIds.push(String(effectId))
    clonedEffects.push({
      ...clone(effect),
      id: effectId,
      metadata: withComposerMetadata(effect.metadata, {
        kind: 'effect', layerId: newLayerId, effectOrder: effectIndex,
      }),
    })
  })
  const next = rebuildCinemaComposerGraph({
    ...composition,
    revision: composition.revision + 1,
    nodes: [...shiftedNodes, clonedLayer, ...clonedEffects, createBlendNode(newBlendId, newLayerId, sourceLayer.blendMode, false)],
  }, definitions)
  return { composition: next, selectedNodeId: newLayerId }
}

export function removeCinemaComposerLayer(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const layers = getCinemaComposerLayers(composition)
  if (layers.length <= 1) throw new Error('A Cinema Composer composition must keep at least one visual layer.')
  const layer = layers.find(candidate => candidate.node.id === layerNodeId)
  if (!layer) throw new Error(`Cinema layer "${layerNodeId}" does not exist.`)
  const removedNodeIds = new Set<string>([
    String(layer.node.id),
    String(layer.blendNodeId),
    ...layer.effects.map(effect => String(effect.id)),
  ])
  const remainingNodes = composition.nodes
    .filter(node => !removedNodeIds.has(String(node.id)))
    .map(node => {
      const metadata = readComposerNodeMetadata(node)
      if (metadata?.kind !== 'layer') return node
      const nextOrder = (metadata.order ?? 0) > layer.order ? (metadata.order ?? 0) - 1 : (metadata.order ?? 0)
      const maskRemoved = metadata.maskNodeId != null && removedNodeIds.has(metadata.maskNodeId)
      return {
        ...node,
        metadata: withComposerMetadata(node.metadata, {
          ...metadata,
          order: nextOrder,
          ...(maskRemoved ? { maskNodeId: undefined, blendMode: metadata.blendMode === 'masked' ? 'normal' : metadata.blendMode } : {}),
        }),
      }
    })
  const next = rebuildCinemaComposerGraph(reconcileRemovedNodeReferences(removeOrphanedBindings({
    ...composition,
    revision: composition.revision + 1,
    nodes: remainingNodes,
  }, composition, removedNodeIds), removedNodeIds), definitions)
  return { composition: next, selectedNodeId: getCinemaComposerLayers(next)[0]?.node.id ?? null }
}

export function reorderCinemaComposerLayer(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  direction: -1 | 1,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const layers = [...getCinemaComposerLayers(composition)]
  const index = layers.findIndex(layer => layer.node.id === layerNodeId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= layers.length) return { composition: clone(composition), selectedNodeId: layerNodeId }
  const currentOrder = layers[index].order
  const targetOrder = layers[target].order
  const nextNodes = composition.nodes.map(node => {
    const metadata = readComposerNodeMetadata(node)
    if (metadata?.kind !== 'layer') return node
    if (node.id === layerNodeId) return { ...node, metadata: withComposerMetadata(node.metadata, { ...metadata, order: targetOrder }) }
    if (node.id === layers[target].node.id) return { ...node, metadata: withComposerMetadata(node.metadata, { ...metadata, order: currentOrder }) }
    return node
  })
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes: nextNodes }, definitions),
    selectedNodeId: layerNodeId,
  }
}

export function setCinemaComposerLayerEnabled(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  enabled: boolean,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const layers = getCinemaComposerLayers(composition)
  const layer = layers.find(candidate => candidate.node.id === layerNodeId)
  if (!layer) throw new Error(`Cinema layer "${layerNodeId}" does not exist.`)
  if (!enabled && layers.filter(candidate => candidate.node.enabled).length <= 1) {
    throw new Error('A Cinema Composer composition must keep at least one enabled visual layer.')
  }
  const nodes = composition.nodes.map(node => {
    if (node.id === layerNodeId) return { ...node, enabled }
    const metadata = readComposerNodeMetadata(node)
    if (metadata?.kind === 'effect' && metadata.layerId === String(layerNodeId)) return { ...node, enabled }
    return node
  })
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes }, definitions),
    selectedNodeId: layerNodeId,
  }
}

export function setCinemaComposerLayerOpacity(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  opacity: number,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  const clamped = clamp(opacity, 0, 1)
  const nodes = composition.nodes.map(node => node.id === layerNodeId ? { ...node, opacity: clamped } : node)
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes }, definitions),
    selectedNodeId: layerNodeId,
  }
}

export function setCinemaComposerBlendMode(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  blendMode: CinemaComposerBlendMode,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  if (blendMode === 'masked') {
    const layer = getCinemaComposerLayers(composition).find(candidate => candidate.node.id === layerNodeId)
    if (!layer?.maskNodeId) throw new Error('Assign a mask before choosing Masked blend mode.')
  }
  const nodes = composition.nodes.map(node => {
    if (node.id !== layerNodeId) return node
    const metadata = readComposerNodeMetadata(node)
    if (metadata?.kind !== 'layer') return node
    return {
      ...node,
      metadata: withComposerMetadata(node.metadata, {
        ...metadata,
        blendMode,
        ...(blendMode === 'masked'
          ? { unmaskedBlendMode: metadata.blendMode !== 'masked' ? metadata.blendMode ?? 'normal' : metadata.unmaskedBlendMode ?? 'normal' }
          : { unmaskedBlendMode: undefined }),
      }),
    }
  })
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes }, definitions),
    selectedNodeId: layerNodeId,
  }
}

export function assignCinemaComposerMask(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  maskNodeId: CinemaNodeId | null,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  if (maskNodeId != null && !getCinemaComposerMaskNodes(composition).some(node => node.id === maskNodeId)) {
    throw new Error(`Cinema mask "${maskNodeId}" does not exist.`)
  }
  const nodes = composition.nodes.map(node => {
    const metadata = readComposerNodeMetadata(node)
    if (node.id === layerNodeId && metadata?.kind === 'layer') {
      return {
        ...node,
        metadata: withComposerMetadata(node.metadata, {
          ...metadata,
          ...(maskNodeId
            ? {
                maskNodeId,
                blendMode: 'masked',
                unmaskedBlendMode: metadata.blendMode !== 'masked' ? metadata.blendMode ?? 'normal' : metadata.unmaskedBlendMode ?? 'normal',
              }
            : {
                maskNodeId: undefined,
                blendMode: metadata.blendMode === 'masked' ? metadata.unmaskedBlendMode ?? 'normal' : metadata.blendMode,
                unmaskedBlendMode: undefined,
              }),
        }),
      }
    }
    if (metadata?.kind === 'mask') {
      const used = maskNodeId === node.id || getCinemaComposerLayers(composition).some(layer => layer.node.id !== layerNodeId && layer.maskNodeId === node.id)
      return { ...node, enabled: used }
    }
    return node
  })
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes }, definitions),
    selectedNodeId: layerNodeId,
  }
}

export function removeCinemaComposerMask(
  composition: Readonly<CinemaCompositionDefinition>,
  maskNodeId: CinemaNodeId,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const mask = getCinemaComposerMaskNodes(composition).find(candidate => candidate.id === maskNodeId)
  if (!mask) throw new Error(`Cinema mask "${maskNodeId}" does not exist.`)
  const removed = new Set<string>([String(maskNodeId)])
  const nodes = composition.nodes
    .filter(node => node.id !== maskNodeId)
    .map(node => {
      const metadata = readComposerNodeMetadata(node)
      if (metadata?.kind !== 'layer' || metadata.maskNodeId !== String(maskNodeId)) return node
      return {
        ...node,
        metadata: withComposerMetadata(node.metadata, {
          ...metadata,
          maskNodeId: undefined,
          blendMode: metadata.blendMode === 'masked' ? metadata.unmaskedBlendMode ?? 'normal' : metadata.blendMode,
          unmaskedBlendMode: undefined,
        }),
      }
    })
  const next = rebuildCinemaComposerGraph(reconcileRemovedNodeReferences(removeOrphanedBindings({
    ...composition,
    revision: composition.revision + 1,
    nodes,
  }, composition, removed), removed), definitions)
  return { composition: next, selectedNodeId: getCinemaComposerLayers(next)[0]?.node.id ?? null }
}

export function attachCinemaComposerEffect(
  composition: Readonly<CinemaCompositionDefinition>,
  layerNodeId: CinemaNodeId,
  persistedDefinition: Readonly<CinemaPersistedDefinition>,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  assertStructured(composition)
  const layer = getCinemaComposerLayers(composition).find(candidate => candidate.node.id === layerNodeId)
  if (!layer) throw new Error(`Cinema layer "${layerNodeId}" does not exist.`)
  if (persistedDefinition.definition.family !== 'effect' && !EFFECT_TYPE_IDS.has(String(persistedDefinition.id))) {
    throw new Error(`Cinema node type "${persistedDefinition.id}" is not an effect.`)
  }
  const effectId = nextStableId<CinemaNodeId>(composition.nodes.map(node => String(node.id)), `${slug(persistedDefinition.definition.label)}-effect`, 'node')
  const effect = createNodeFromPersistedDefinition(persistedDefinition, effectId, persistedDefinition.definition.label, {
    kind: 'effect', layerId: layerNodeId, effectOrder: layer.effects.length,
  })
  return {
    composition: rebuildCinemaComposerGraph({
      ...composition,
      revision: composition.revision + 1,
      nodes: [...composition.nodes, effect],
    }, definitions),
    selectedNodeId: effectId,
  }
}

export function removeCinemaComposerEffect(
  composition: Readonly<CinemaCompositionDefinition>,
  effectNodeId: CinemaNodeId,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  const effect = composition.nodes.find(node => node.id === effectNodeId)
  const metadata = effect ? readComposerNodeMetadata(effect) : null
  if (!effect || metadata?.kind !== 'effect' || !metadata.layerId) throw new Error(`Cinema effect "${effectNodeId}" does not exist.`)
  const removed = new Set<string>([String(effectNodeId)])
  const nodes = composition.nodes
    .filter(node => node.id !== effectNodeId)
    .map(node => {
      const nodeMetadata = readComposerNodeMetadata(node)
      if (nodeMetadata?.kind !== 'effect' || nodeMetadata.layerId !== metadata.layerId) return node
      const currentOrder = nodeMetadata.effectOrder ?? 0
      const removedOrder = metadata.effectOrder ?? 0
      return currentOrder > removedOrder
        ? { ...node, metadata: withComposerMetadata(node.metadata, { ...nodeMetadata, effectOrder: currentOrder - 1 }) }
        : node
    })
  return {
    composition: rebuildCinemaComposerGraph(reconcileRemovedNodeReferences(removeOrphanedBindings({
      ...composition,
      revision: composition.revision + 1,
      nodes,
    }, composition, removed), removed), definitions),
    selectedNodeId: cinemaStableId<CinemaNodeId>(metadata.layerId, 'node'),
  }
}

export function assignCinemaComposerNodeAsset(
  composition: Readonly<CinemaCompositionDefinition>,
  nodeId: CinemaNodeId,
  assetId: CinemaAssetId | null,
  role: CinemaAssetRole,
): CinemaComposerEditResult {
  const node = composition.nodes.find(candidate => candidate.id === nodeId)
  if (!node) throw new Error(`Cinema node "${nodeId}" does not exist.`)
  const existingBindingId = node.assetBindingIds?.[0] ?? null
  const existingBinding = existingBindingId
    ? composition.assetBindings.find(binding => binding.id === existingBindingId) ?? null
    : null

  if (assetId == null) {
    const removedBindingIds = new Set((node.assetBindingIds ?? []).map(String))
    const nodes = composition.nodes.map(candidate => candidate.id === nodeId ? { ...candidate, assetBindingIds: [] } : candidate)
    const stillReferenced = new Set(nodes.flatMap(candidate => candidate.assetBindingIds ?? []).map(String))
    return {
      composition: {
        ...composition,
        revision: composition.revision + 1,
        nodes,
        assetBindings: composition.assetBindings.filter(binding => !removedBindingIds.has(String(binding.id)) || stillReferenced.has(String(binding.id))),
      },
      selectedNodeId: nodeId,
    }
  }

  const bindingId = existingBindingId ?? nextStableId<CinemaAssetBindingId>(
    composition.assetBindings.map(binding => String(binding.id)),
    `${slug(String(nodeId))}-asset`,
    'asset-binding',
  )
  const binding: CinemaAssetBindingDefinition = {
    id: bindingId,
    assetId,
    role,
    fit: existingBinding?.fit ?? 'contain',
    preserveOriginalColors: existingBinding?.preserveOriginalColors ?? true,
    opacity: existingBinding?.opacity ?? 1,
    blendMode: existingBinding?.blendMode ?? 'normal',
    ...(existingBinding?.crop ? { crop: existingBinding.crop } : {}),
    ...(existingBinding?.position ? { position: existingBinding.position } : {}),
    ...(existingBinding?.scale ? { scale: existingBinding.scale } : {}),
    ...(existingBinding?.rotationRadians != null ? { rotationRadians: existingBinding.rotationRadians } : {}),
    ...(existingBinding?.colorizeWithBrandRole ? { colorizeWithBrandRole: existingBinding.colorizeWithBrandRole } : {}),
    ...(existingBinding?.brandColorPolicy ? { brandColorPolicy: existingBinding.brandColorPolicy } : {}),
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      nodes: composition.nodes.map(candidate => candidate.id === nodeId ? { ...candidate, assetBindingIds: [bindingId] } : candidate),
      assetBindings: [...composition.assetBindings.filter(candidate => candidate.id !== bindingId), binding],
    },
    selectedNodeId: nodeId,
  }
}

export function setCinemaComposerNodeParameter(
  composition: Readonly<CinemaCompositionDefinition>,
  nodeId: CinemaNodeId,
  parameterId: CinemaParameterId,
  value: unknown,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  const node = composition.nodes.find(candidate => candidate.id === nodeId)
  if (!node) throw new Error(`Cinema node "${nodeId}" does not exist.`)
  const persistedDefinition = definitions.find(definition => definition.id === node.typeId)
  const schema = persistedDefinition?.definition.parameters.find(parameter => parameter.id === parameterId)
  if (!schema) throw new Error(`Cinema parameter "${parameterId}" is not registered for node "${nodeId}".`)
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (normalized.diagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')) {
    throw new Error(normalized.diagnostics[0]?.message ?? `Cinema parameter "${parameterId}" is invalid.`)
  }
  const nodes = composition.nodes.map(candidate => candidate.id === nodeId
    ? { ...candidate, parameterValues: { ...candidate.parameterValues, [parameterId]: normalized.value } }
    : candidate)
  return { composition: { ...composition, revision: composition.revision + 1, nodes }, selectedNodeId: nodeId }
}

export function setCinemaComposerMasterParameter(
  composition: Readonly<CinemaCompositionDefinition>,
  parameterId: CinemaParameterId,
  value: unknown,
): CinemaComposerEditResult {
  const schema = composition.masterParameters.find(parameter => parameter.id === parameterId)
  if (!schema) throw new Error(`Cinema master parameter "${parameterId}" does not exist.`)
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (normalized.diagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')) {
    throw new Error(`Cinema master parameter "${parameterId}" is invalid.`)
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      masterValues: { ...composition.masterValues, [parameterId]: normalized.value },
    },
  }
}

export function setCinemaComposerCameraParameter(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  parameterId: CinemaParameterId,
  value: unknown,
): CinemaComposerEditResult {
  const camera = composition.cameras.find(candidate => candidate.id === cameraId)
  if (!camera) throw new Error(`Cinema camera "${cameraId}" does not exist.`)
  const schema = createCinemaCameraParameterSchemas(camera).find(parameter => parameter.id === parameterId)
  if (!schema) throw new Error(`Cinema camera parameter "${parameterId}" does not exist.`)
  const normalized = normalizeCinemaParameterValue(schema, value)
  if (normalized.diagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')) {
    throw new Error(normalized.diagnostics[0]?.message ?? `Cinema camera parameter "${parameterId}" is invalid.`)
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      cameras: composition.cameras.map(candidate => candidate.id === cameraId
        ? { ...candidate, parameterValues: { ...candidate.parameterValues, [parameterId]: normalized.value } }
        : candidate),
    },
  }
}

export function reorderCinemaComposerEffect(
  composition: Readonly<CinemaCompositionDefinition>,
  effectNodeId: CinemaNodeId,
  direction: -1 | 1,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaComposerEditResult {
  const effect = composition.nodes.find(node => node.id === effectNodeId)
  const metadata = effect ? readComposerNodeMetadata(effect) : null
  if (!effect || metadata?.kind !== 'effect' || !metadata.layerId) throw new Error(`Cinema effect "${effectNodeId}" does not exist.`)
  const layer = getCinemaComposerLayers(composition).find(candidate => String(candidate.node.id) === metadata.layerId)
  if (!layer) throw new Error('The effect owner layer is unavailable.')
  const index = layer.effects.findIndex(candidate => candidate.id === effectNodeId)
  const target = index + direction
  if (target < 0 || target >= layer.effects.length) return { composition: clone(composition), selectedNodeId: effectNodeId }
  const targetId = layer.effects[target].id
  const nodes = composition.nodes.map(node => {
    const nodeMetadata = readComposerNodeMetadata(node)
    if (node.id === effectNodeId && nodeMetadata?.kind === 'effect') {
      return { ...node, metadata: withComposerMetadata(node.metadata, { ...nodeMetadata, effectOrder: target }) }
    }
    if (node.id === targetId && nodeMetadata?.kind === 'effect') {
      return { ...node, metadata: withComposerMetadata(node.metadata, { ...nodeMetadata, effectOrder: index }) }
    }
    return node
  })
  return {
    composition: rebuildCinemaComposerGraph({ ...composition, revision: composition.revision + 1, nodes }, definitions),
    selectedNodeId: effectNodeId,
  }
}

export function rebuildCinemaComposerGraph(
  composition: Readonly<CinemaCompositionDefinition>,
  definitions: readonly CinemaPersistedDefinition[],
): CinemaCompositionDefinition {
  if (!isCinemaComposerComposition(composition)) return clone(composition)
  const definitionMap = new Map(definitions.map(definition => [String(definition.id), definition]))
  const nodes = [...composition.nodes]
  const layers = getCinemaComposerLayers(composition)
  const outputNode = nodes.find(node => node.id === composition.outputNodeId)
  if (!outputNode) throw new Error('Cinema Composer output node is unavailable.')

  const existingNodeIds = new Set(nodes.map(node => String(node.id)))
  for (const layer of layers) {
    if (!existingNodeIds.has(String(layer.blendNodeId))) {
      nodes.push(createBlendNode(layer.blendNodeId, layer.node.id, layer.blendMode, false))
      existingNodeIds.add(String(layer.blendNodeId))
    }
  }

  const activeLayers = layers.filter(layer => layer.node.enabled)
  if (activeLayers.length === 0) throw new Error('Cinema Composer requires at least one enabled visual layer.')
  let transparentBackground = nodes.find(node => readComposerNodeMetadata(node)?.kind === 'background') ?? null
  if (!transparentBackground && activeLayers[0]?.blendMode === 'masked') {
    const backgroundId = nextStableId<CinemaNodeId>(nodes.map(node => String(node.id)), `${composition.id}-transparent-background`, 'node')
    transparentBackground = {
      ...createNodeFromType(CINEMA_FOUNDATION_GRADIENT_TYPE_ID, backgroundId, 'procedural', 'Transparent Composer Background', { kind: 'background' }),
      enabled: false,
      parameterValues: { [CINEMA_FOUNDATION_OPACITY_PARAMETER_ID]: 0 },
    }
    nodes.push(transparentBackground)
  }
  const useTransparentBackground = activeLayers[0]?.blendMode === 'masked'
  if (transparentBackground) {
    const index = nodes.findIndex(node => node.id === transparentBackground?.id)
    if (index >= 0) nodes[index] = { ...nodes[index], enabled: useTransparentBackground }
    transparentBackground = nodes[index] ?? transparentBackground
  }
  const connections: CinemaConnectionDefinition[] = []
  let runningNodeId: CinemaNodeId | null = null
  let runningPortId: CinemaPortId | null = null

  const updateNode = (nodeId: CinemaNodeId, updater: (node: CinemaNodeDefinition) => CinemaNodeDefinition) => {
    const index = nodes.findIndex(node => node.id === nodeId)
    if (index >= 0) nodes[index] = updater(nodes[index])
  }

  for (const layer of layers) {
    const active = layer.node.enabled
    const definition = definitionForNode(layer.node, definitionMap)
    const sourcePort = firstOutputPort(definition, ['color-texture']) ?? CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID
    let layerOutputNodeId = layer.node.id
    let layerOutputPortId = sourcePort

    for (const effect of layer.effects) {
      updateNode(effect.id, node => ({ ...node, enabled: active && node.enabled }))
      if (!active || !effect.enabled) continue
      const effectDefinition = definitionForNode(effect, definitionMap)
      const inputPort = firstInputPort(effectDefinition, ['color-texture']) ?? CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID
      const outputPort = firstOutputPort(effectDefinition, ['color-texture']) ?? CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID
      connections.push(connectionFor(layerOutputNodeId, layerOutputPortId, effect.id, inputPort, connections.length))
      layerOutputNodeId = effect.id
      layerOutputPortId = outputPort
    }

    updateNode(layer.blendNodeId, node => {
      const shouldEnableBlend = active && (runningNodeId != null || layer.blendMode === 'masked')
      const desiredTypeId = BLEND_TYPE_ID_BY_MODE.get(layer.blendMode) ?? CINEMA_BLEND_NODE_TYPE_IDS.normal
      const persisted = definitionMap.get(String(desiredTypeId))
      return {
        ...node,
        typeId: desiredTypeId,
        typeVersion: persisted?.definition.version ?? 1,
        family: 'mixer',
        label: layer.blendMode === 'masked' ? 'Masked Composite' : `${capitalize(layer.blendMode)} Blend`,
        enabled: shouldEnableBlend,
        parameterValues: filterParameterValues(node.parameterValues, persisted),
        metadata: withComposerMetadata(node.metadata, { kind: 'blend', layerId: layer.node.id }),
      }
    })

    if (!active) continue
    if (runningNodeId == null || runningPortId == null) {
      if (layer.blendMode !== 'masked') {
        runningNodeId = layerOutputNodeId
        runningPortId = layerOutputPortId
        continue
      }
      if (!transparentBackground || !layer.maskNodeId) throw new Error(`Cinema layer "${layer.node.id}" requires a mask and transparent background.`)
      const maskNode = nodes.find(node => node.id === layer.maskNodeId)
      if (!maskNode) throw new Error(`Cinema mask "${layer.maskNodeId}" is unavailable.`)
      updateNode(maskNode.id, node => ({ ...node, enabled: true }))
      const maskDefinition = definitionForNode(maskNode, definitionMap)
      const maskPort = firstOutputPort(maskDefinition, ['mask-texture', 'color-texture'])
      if (!maskPort) throw new Error(`Cinema mask "${maskNode.id}" has no compatible output.`)
      const backgroundDefinition = definitionForNode(transparentBackground, definitionMap)
      const backgroundPort = firstOutputPort(backgroundDefinition, ['color-texture']) ?? CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID
      const blendNodeId = layer.blendNodeId
      connections.push(connectionFor(transparentBackground.id, backgroundPort, blendNodeId, CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID, connections.length))
      connections.push(connectionFor(layerOutputNodeId, layerOutputPortId, blendNodeId, CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID, connections.length))
      connections.push(connectionFor(maskNode.id, maskPort, blendNodeId, CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID, connections.length))
      runningNodeId = blendNodeId
      runningPortId = CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID
      continue
    }

    const blendNodeId = layer.blendNodeId
    connections.push(connectionFor(runningNodeId, runningPortId, blendNodeId, CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID, connections.length))
    connections.push(connectionFor(layerOutputNodeId, layerOutputPortId, blendNodeId, CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID, connections.length))
    if (layer.blendMode === 'masked') {
      if (!layer.maskNodeId) throw new Error(`Cinema layer "${layer.node.id}" requires a mask.`)
      const maskNode = nodes.find(node => node.id === layer.maskNodeId)
      if (!maskNode) throw new Error(`Cinema mask "${layer.maskNodeId}" is unavailable.`)
      updateNode(maskNode.id, node => ({ ...node, enabled: true }))
      const maskDefinition = definitionForNode(maskNode, definitionMap)
      const maskPort = firstOutputPort(maskDefinition, ['mask-texture', 'color-texture'])
      if (!maskPort) throw new Error(`Cinema mask "${maskNode.id}" has no compatible output.`)
      connections.push(connectionFor(maskNode.id, maskPort, blendNodeId, CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID, connections.length))
    }
    runningNodeId = blendNodeId
    runningPortId = CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID
  }

  for (const mask of getCinemaComposerMaskNodes({ ...composition, nodes })) {
    const used = layers.some(layer => layer.node.enabled && layer.blendMode === 'masked' && layer.maskNodeId === mask.id)
    updateNode(mask.id, node => ({ ...node, enabled: used }))
  }

  if (!runningNodeId || !runningPortId) throw new Error('Cinema Composer could not resolve a visual output.')
  const outputDefinition = definitionForNode(outputNode, definitionMap)
  const outputInputPort = firstInputPort(outputDefinition, ['color-texture']) ?? CINEMA_FOUNDATION_INPUT_PORT_ID
  connections.push(connectionFor(runningNodeId, runningPortId, outputNode.id, outputInputPort, connections.length))

  return clone({ ...composition, nodes, connections })
}

export function reconcileRemovedNodeReferences(
  composition: Readonly<CinemaCompositionDefinition>,
  removedNodeIds: ReadonlySet<string>,
): CinemaCompositionDefinition {
  const parameterDestinationRemoved = (destination: string): boolean => {
    const parsed = parseCinemaParameterPath(destination)
    return parsed.ok && parsed.ownerId != null && removedNodeIds.has(parsed.ownerId)
  }
  return {
    ...composition,
    connections: composition.connections.filter(connection => (
      !removedNodeIds.has(String(connection.from.nodeId)) && !removedNodeIds.has(String(connection.to.nodeId))
    )),
    modulationRoutes: composition.modulationRoutes.filter(route => !parameterDestinationRemoved(route.destination)),
    performanceRules: composition.performanceRules.map(rule => ({
      ...rule,
      actions: rule.actions.filter(action => !performanceActionReferencesRemovedNode(action, removedNodeIds, parameterDestinationRemoved)),
    })),
  }
}

function removeOrphanedBindings(
  next: CinemaCompositionDefinition,
  previous: Readonly<CinemaCompositionDefinition>,
  removedNodeIds: ReadonlySet<string>,
): CinemaCompositionDefinition {
  const removedBindingIds = new Set(previous.nodes
    .filter(node => removedNodeIds.has(String(node.id)))
    .flatMap(node => node.assetBindingIds ?? [])
    .map(String))
  if (removedBindingIds.size === 0) return next
  const stillReferenced = new Set(next.nodes.flatMap(node => node.assetBindingIds ?? []).map(String))
  return {
    ...next,
    assetBindings: next.assetBindings.filter(binding => !removedBindingIds.has(String(binding.id)) || stillReferenced.has(String(binding.id))),
  }
}

function performanceActionReferencesRemovedNode(
  action: CinemaPerformanceAction,
  removedNodeIds: ReadonlySet<string>,
  parameterDestinationRemoved: (destination: string) => boolean,
): boolean {
  if ('nodeId' in action && removedNodeIds.has(String(action.nodeId))) return true
  if ('destination' in action && parameterDestinationRemoved(action.destination)) return true
  return false
}

function createNodeFromPersistedDefinition(
  persisted: Readonly<CinemaPersistedDefinition>,
  id: CinemaNodeId,
  label: string,
  metadata: CinemaComposerNodeMetadata,
): CinemaNodeDefinition {
  return {
    id,
    typeId: persisted.definition.typeId,
    typeVersion: persisted.definition.version,
    family: persisted.definition.family,
    label,
    enabled: true,
    opacity: 1,
    parameterValues: Object.fromEntries(
      persisted.definition.parameters
        .filter(parameter => parameter.type !== 'trigger')
        .map(parameter => [parameter.id, clone(getCinemaParameterDefaultValue(parameter))]),
    ) as CinemaNodeDefinition['parameterValues'],
    metadata: withComposerMetadata(undefined, metadata),
  }
}

function createNodeFromType(
  typeId: CinemaNodeTypeId,
  id: CinemaNodeId,
  family: CinemaNodeFamily,
  label: string,
  metadata: CinemaComposerNodeMetadata,
): CinemaNodeDefinition {
  return {
    id,
    typeId,
    typeVersion: 1,
    family,
    label,
    enabled: true,
    opacity: 1,
    parameterValues: {},
    metadata: withComposerMetadata(undefined, metadata),
  }
}

function createBlendNode(
  id: CinemaNodeId,
  layerId: CinemaNodeId,
  blendMode: CinemaComposerBlendMode,
  enabled: boolean,
): CinemaNodeDefinition {
  return {
    id,
    typeId: BLEND_TYPE_ID_BY_MODE.get(blendMode) ?? CINEMA_BLEND_NODE_TYPE_IDS.normal,
    typeVersion: 1,
    family: 'mixer',
    label: `${capitalize(blendMode)} Blend`,
    enabled,
    opacity: 1,
    parameterValues: {},
    metadata: withComposerMetadata(undefined, { kind: 'blend', layerId }),
  }
}

function filterParameterValues(
  values: CinemaNodeDefinition['parameterValues'],
  persisted: CinemaPersistedDefinition | undefined,
): CinemaNodeDefinition['parameterValues'] {
  if (!persisted) return values
  const allowed = new Set(persisted.definition.parameters.map(parameter => String(parameter.id)))
  const next: Partial<Record<CinemaParameterId, CinemaParameterValue>> = {}
  for (const [key, value] of Object.entries(values)) {
    if (allowed.has(key)) next[key as CinemaParameterId] = clone(value) as CinemaParameterValue
  }
  for (const parameter of persisted.definition.parameters) {
    if (parameter.type === 'trigger' || Object.prototype.hasOwnProperty.call(next, parameter.id)) continue
    next[parameter.id] = clone(getCinemaParameterDefaultValue(parameter)) as CinemaParameterValue
  }
  return next
}

function definitionForNode(
  node: Readonly<CinemaNodeDefinition>,
  definitions: ReadonlyMap<string, CinemaPersistedDefinition>,
): CinemaPersistedDefinition['definition'] | null {
  return definitions.get(String(node.typeId))?.definition ?? null
}

function firstOutputPort(
  definition: CinemaPersistedDefinition['definition'] | null,
  accepted: readonly string[],
): CinemaPortId | null {
  if (!definition) return null
  for (const dataType of accepted) {
    const port = definition.outputPorts.find(candidate => candidate.dataType === dataType)
    if (port) return port.id
  }
  return null
}

function firstInputPort(
  definition: CinemaPersistedDefinition['definition'] | null,
  accepted: readonly string[],
): CinemaPortId | null {
  if (!definition) return null
  for (const dataType of accepted) {
    const port = definition.inputPorts.find(candidate => candidate.dataType === dataType || candidate.accepts?.includes(dataType as never))
    if (port) return port.id
  }
  return null
}

function connectionFor(
  fromNodeId: CinemaNodeId,
  fromPortId: CinemaPortId,
  toNodeId: CinemaNodeId,
  toPortId: CinemaPortId,
  index: number,
): CinemaConnectionDefinition {
  const id = cinemaStableId<CinemaConnectionId>(`composer-${slug(String(fromNodeId))}-${slug(String(toNodeId))}-${index + 1}`, 'connection')
  return { id, from: { nodeId: fromNodeId, portId: fromPortId }, to: { nodeId: toNodeId, portId: toPortId }, enabled: true }
}

function libraryCategory(
  family: CinemaNodeFamily,
  outputTypes: readonly string[],
  typeId: CinemaNodeTypeId,
): CinemaComposerLibraryItem['category'] {
  if (family === 'effect') return 'Effects'
  if (family === 'output' || family === 'mixer' || family === 'control' || family === 'camera') return 'Utilities'
  if (typeId === CINEMA_GENERATED_MASK_NODE_TYPE_ID || (outputTypes.includes('mask-texture') && !outputTypes.includes('color-texture'))) return 'Masks'
  return 'Visuals'
}

function readComposerNodeMetadata(node: Readonly<CinemaNodeDefinition> | null | undefined): CinemaComposerNodeMetadata | null {
  const metadata = readObject(readObject(node?.metadata)?.[CINEMA_COMPOSER_METADATA_KEY])
  if (!metadata) return null
  const kind = metadata.kind
  if (kind !== 'layer' && kind !== 'effect' && kind !== 'blend' && kind !== 'mask' && kind !== 'background') return null
  return {
    kind,
    ...(typeof metadata.layerId === 'string' ? { layerId: metadata.layerId } : {}),
    ...(typeof metadata.order === 'number' && Number.isFinite(metadata.order) ? { order: metadata.order } : {}),
    ...(typeof metadata.blendMode === 'string' && isComposerBlendMode(metadata.blendMode) ? { blendMode: metadata.blendMode } : {}),
    ...(typeof metadata.unmaskedBlendMode === 'string' && isComposerBlendMode(metadata.unmaskedBlendMode) && metadata.unmaskedBlendMode !== 'masked' ? { unmaskedBlendMode: metadata.unmaskedBlendMode } : {}),
    ...(typeof metadata.blendNodeId === 'string' ? { blendNodeId: metadata.blendNodeId } : {}),
    ...(typeof metadata.maskNodeId === 'string' ? { maskNodeId: metadata.maskNodeId } : {}),
    ...(typeof metadata.effectOrder === 'number' && Number.isFinite(metadata.effectOrder) ? { effectOrder: metadata.effectOrder } : {}),
  }
}

function withComposerMetadata(
  metadata: CinemaJsonObject | undefined,
  composer: CinemaComposerNodeMetadata,
): CinemaJsonObject {
  const base = { ...(metadata ?? {}) } as Record<string, unknown>
  const cleanComposer: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(composer)) {
    if (value !== undefined) cleanComposer[key] = value
  }
  base[CINEMA_COMPOSER_METADATA_KEY] = cleanComposer
  return base as CinemaJsonObject
}

function blendModeForNode(node: Readonly<CinemaNodeDefinition> | undefined): CinemaComposerBlendMode | null {
  return node ? BLEND_MODE_BY_TYPE_ID.get(String(node.typeId)) ?? null : null
}

function isComposerBlendMode(value: string): value is CinemaComposerBlendMode {
  return value === 'normal' || value === 'add' || value === 'screen' || value === 'multiply'
    || value === 'lighten' || value === 'darken' || value === 'difference' || value === 'overlay' || value === 'masked'
}

function assertStructured(composition: Readonly<CinemaCompositionDefinition>): void {
  if (!isCinemaComposerComposition(composition)) {
    throw new Error('This Cinema composition is not owned by the structured Composer. Create or duplicate a Composer composition first.')
  }
}

function nextStableId<Id extends CinemaNodeId | CinemaCompositionId | CinemaAssetBindingId>(
  existing: readonly string[],
  base: string,
  kind: 'node' | 'composition' | 'asset-binding',
): Id {
  const clean = slug(base) || kind
  const used = new Set(existing)
  if (!used.has(clean)) return cinemaStableId<Id>(clean, kind)
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${clean}-${index}`
    if (!used.has(candidate)) return cinemaStableId<Id>(candidate, kind)
  }
  throw new Error(`Unable to allocate a stable Cinema ${kind} ID.`)
}

export function nextCinemaComposerCompositionId(existing: readonly CinemaCompositionDefinition[]): CinemaCompositionId {
  return nextStableId<CinemaCompositionId>(existing.map(composition => String(composition.id)), 'composer-composition', 'composition')
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min
}

function clone<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value
}
