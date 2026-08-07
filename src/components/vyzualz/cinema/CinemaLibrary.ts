import type {
  CinemaCompositionDefinition,
  CinemaJsonObject,
  CinemaPerformanceAction,
} from './CinemaDomain'
import {
  cinemaStableId,
  createCinemaParameterPath,
  parseCinemaParameterPath,
  type CinemaActionId,
  type CinemaAssetBindingId,
  type CinemaCameraId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaModulationRouteId,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaPerformanceRuleId,
  type CinemaStableId,
} from './CinemaIdentifiers'
import { cloneCinemaSerializable } from './CinemaPersistence'

export const CINEMA_LIBRARY_PROVENANCE_VERSION = 1 as const

export interface CinemaCompositionLibraryStatus {
  provenance: 'built-in' | 'user'
  modified: boolean
  savedRevision: number | null
}

export interface DuplicateCinemaCompositionOptions {
  id: CinemaCompositionId
  name?: string
  saved?: boolean
  timestamp?: string
}

export function isCinemaBuiltInComposition(
  composition: Readonly<CinemaCompositionDefinition> | null | undefined,
): boolean {
  return readObject(composition?.metadata.provenance)?.builtIn === true
}

export function getCinemaCompositionLibraryStatus(
  composition: Readonly<CinemaCompositionDefinition>,
): CinemaCompositionLibraryStatus {
  if (isCinemaBuiltInComposition(composition)) {
    return { provenance: 'built-in', modified: false, savedRevision: composition.revision }
  }
  const provenance = readObject(composition.metadata.provenance)
  const savedRevision = typeof provenance?.savedRevision === 'number'
    && Number.isInteger(provenance.savedRevision)
    && provenance.savedRevision >= 0
    ? provenance.savedRevision
    : null
  return {
    provenance: 'user',
    savedRevision,
    modified: savedRevision == null || savedRevision !== composition.revision,
  }
}

export function markCinemaCompositionSaved(
  composition: Readonly<CinemaCompositionDefinition>,
  timestamp?: string,
): CinemaCompositionDefinition {
  const provenance = readObject(composition.metadata.provenance) ?? {}
  return cloneCinemaSerializable({
    ...composition,
    metadata: {
      ...composition.metadata,
      ...(timestamp ? { updatedAt: timestamp } : {}),
      provenance: {
        ...provenance,
        builtIn: false,
        libraryOrigin: 'user',
        libraryVersion: CINEMA_LIBRARY_PROVENANCE_VERSION,
        savedRevision: composition.revision,
      },
    },
  })
}

/**
 * Clones a composition as a genuinely independent user-authored graph.
 * External contracts such as node type IDs, parameter IDs, ports, events, and
 * asset IDs remain stable. Every composition-local identity is regenerated and
 * all graph/action/Composer metadata references are rewritten to those new IDs.
 */
export function duplicateCinemaCompositionGraph(
  source: Readonly<CinemaCompositionDefinition>,
  options: DuplicateCinemaCompositionOptions,
): CinemaCompositionDefinition {
  const nodeIds = createIdMap<CinemaNodeId>(source.nodes.map(node => String(node.id)), options.id, 'node')
  const connectionIds = createIdMap<CinemaConnectionId>(source.connections.map(connection => String(connection.id)), options.id, 'connection')
  const cameraIds = createIdMap<CinemaCameraId>(source.cameras.map(camera => String(camera.id)), options.id, 'camera')
  const bindingIds = createIdMap<CinemaAssetBindingId>(source.assetBindings.map(binding => String(binding.id)), options.id, 'binding')
  const routeIds = createIdMap<CinemaModulationRouteId>(source.modulationRoutes.map(route => String(route.id)), options.id, 'route')
  const ruleIds = createIdMap<CinemaPerformanceRuleId>(source.performanceRules.map(rule => String(rule.id)), options.id, 'rule')
  const actionSourceIds = source.performanceRules.flatMap(rule => rule.actions.map(action => String(action.id)))
  const actionIds = createIdMap<CinemaActionId>(actionSourceIds, options.id, 'action')

  const auxiliaryIds = new Map<string, string>()
  source.cameras.forEach(camera => {
    const nextCameraId = cameraIds.get(String(camera.id))!
    camera.authoredShots?.forEach((shot, shotIndex) => auxiliaryIds.set(shot.id, `${nextCameraId}-shot-${shotIndex + 1}`))
    camera.invalidRegions?.forEach((region, regionIndex) => auxiliaryIds.set(region.id, `${nextCameraId}-region-${regionIndex + 1}`))
  })

  const allIds = new Map<string, string>([
    ...nodeIds,
    ...connectionIds,
    ...cameraIds,
    ...bindingIds,
    ...routeIds,
    ...ruleIds,
    ...actionIds,
    ...auxiliaryIds,
  ])
  const remapJson = (value: CinemaJsonObject | undefined): CinemaJsonObject | undefined => (
    value == null ? undefined : remapJsonObject(value, allIds, nodeIds, cameraIds)
  )

  const sourceProvenance = readObject(source.metadata.provenance) ?? {}
  const { builtIn: _builtIn, savedRevision: _savedRevision, ...portableProvenance } = sourceProvenance
  const duplicateRevision = 1
  const provenance: CinemaJsonObject = {
    ...remapJsonObject(portableProvenance, allIds, nodeIds, cameraIds),
    builtIn: false,
    libraryOrigin: 'user',
    libraryVersion: CINEMA_LIBRARY_PROVENANCE_VERSION,
    sourceCompositionId: String(source.id),
    savedRevision: options.saved === false ? 0 : duplicateRevision,
  }

  return cloneCinemaSerializable({
    ...source,
    id: options.id,
    revision: duplicateRevision,
    metadata: {
      ...source.metadata,
      name: options.name ?? `${source.metadata.name} Copy`,
      ...(options.timestamp ? { createdAt: options.timestamp, updatedAt: options.timestamp } : {}),
      provenance,
    },
    nodes: source.nodes.map(node => ({
      ...node,
      id: nodeIds.get(String(node.id))!,
      assetBindingIds: node.assetBindingIds?.map(id => bindingIds.get(String(id)) ?? id),
      metadata: remapJson(node.metadata),
    })),
    connections: source.connections.map(connection => ({
      ...connection,
      id: connectionIds.get(String(connection.id))!,
      from: { ...connection.from, nodeId: nodeIds.get(String(connection.from.nodeId))! },
      to: { ...connection.to, nodeId: nodeIds.get(String(connection.to.nodeId))! },
      metadata: remapJson(connection.metadata),
    })),
    outputNodeId: nodeIds.get(String(source.outputNodeId))!,
    cameras: source.cameras.map(camera => ({
      ...camera,
      id: cameraIds.get(String(camera.id))!,
      invalidRegions: camera.invalidRegions?.map(region => ({
        ...region,
        id: auxiliaryIds.get(region.id) ?? region.id,
      })),
      authoredShots: camera.authoredShots?.map(shot => ({
        ...shot,
        id: auxiliaryIds.get(shot.id) ?? shot.id,
        metadata: remapJson(shot.metadata),
      })),
      metadata: remapJson(camera.metadata),
    })),
    assetBindings: source.assetBindings.map(binding => ({
      ...binding,
      id: bindingIds.get(String(binding.id))!,
    })),
    modulationRoutes: source.modulationRoutes.map(route => ({
      ...route,
      id: routeIds.get(String(route.id))!,
      destination: remapParameterPath(route.destination, nodeIds, cameraIds),
    })),
    performanceRules: source.performanceRules.map(rule => ({
      ...rule,
      id: ruleIds.get(String(rule.id))!,
      condition: {
        ...rule.condition,
        manualActionIds: rule.condition.manualActionIds?.map(id => actionIds.get(String(id)) ?? id),
        toggleActionId: rule.condition.toggleActionId == null
          ? undefined
          : actionIds.get(String(rule.condition.toggleActionId)) ?? rule.condition.toggleActionId,
      },
      actions: rule.actions.map(action => remapAction(action, actionIds, nodeIds, cameraIds)),
    })),
  })
}

function remapAction(
  action: Readonly<CinemaPerformanceAction>,
  actionIds: ReadonlyMap<string, CinemaActionId>,
  nodeIds: ReadonlyMap<string, CinemaNodeId>,
  cameraIds: ReadonlyMap<string, CinemaCameraId>,
): CinemaPerformanceAction {
  const id = actionIds.get(String(action.id)) ?? action.id
  switch (action.type) {
    case 'set-parameter':
    case 'trigger-parameter':
      return { ...action, id, destination: remapParameterPath(action.destination, nodeIds, cameraIds) }
    case 'set-node-enabled':
    case 'set-effect-enabled':
    case 'resetNodeState':
    case 'resetFeedback':
    case 'reseedSimulation':
    case 'clearTrailHistory':
      return { ...action, id, nodeId: nodeIds.get(String(action.nodeId)) ?? action.nodeId }
    case 'select-camera':
      return { ...action, id, cameraId: cameraIds.get(String(action.cameraId)) ?? action.cameraId }
    case 'set-palette':
    case 'emit-event':
      return { ...action, id }
  }
}

function remapParameterPath<Path extends string>(
  path: Path,
  nodeIds: ReadonlyMap<string, CinemaNodeId>,
  cameraIds: ReadonlyMap<string, CinemaCameraId>,
): Path {
  const parsed = parseCinemaParameterPath(path)
  if (!parsed.ok || parsed.namespace === 'master' || parsed.ownerId == null) return path
  const owner = parsed.namespace === 'cameras'
    ? cameraIds.get(parsed.ownerId)
    : nodeIds.get(parsed.ownerId)
  if (!owner) return path
  return createCinemaParameterPath(
    parsed.namespace,
    parsed.parameterId as CinemaParameterId,
    owner,
  ) as unknown as Path
}

function createIdMap<Id extends CinemaStableId>(
  sourceIds: readonly string[],
  compositionId: CinemaCompositionId,
  kind: string,
): Map<string, Id> {
  return new Map(sourceIds.map((sourceId, index) => [
    sourceId,
    cinemaStableId<Id>(`${compositionId}-${kind}-${index + 1}`, kind),
  ]))
}

function remapJsonObject(
  source: Readonly<CinemaJsonObject>,
  allIds: ReadonlyMap<string, string>,
  nodeIds: ReadonlyMap<string, CinemaNodeId>,
  cameraIds: ReadonlyMap<string, CinemaCameraId>,
): CinemaJsonObject {
  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, remapJsonValue(value, allIds, nodeIds, cameraIds)])) as CinemaJsonObject
}

function remapJsonValue(
  value: CinemaJsonObject[string],
  allIds: ReadonlyMap<string, string>,
  nodeIds: ReadonlyMap<string, CinemaNodeId>,
  cameraIds: ReadonlyMap<string, CinemaCameraId>,
): CinemaJsonObject[string] {
  if (typeof value === 'string') {
    const mapped = allIds.get(value)
    if (mapped) return mapped
    return remapParameterPath(value, nodeIds, cameraIds)
  }
  if (Array.isArray(value)) return value.map(entry => remapJsonValue(entry, allIds, nodeIds, cameraIds))
  if (value != null && typeof value === 'object') {
    return remapJsonObject(value as CinemaJsonObject, allIds, nodeIds, cameraIds)
  }
  return value
}

function readObject(value: unknown): Readonly<CinemaJsonObject> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as CinemaJsonObject
    : null
}
