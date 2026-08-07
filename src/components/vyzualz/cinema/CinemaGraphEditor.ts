import type {
  CinemaCompositionDefinition,
  CinemaConnectionDefinition,
  CinemaNodeDefinition,
  CinemaParameterValue,
  CinemaPerformanceAction,
  CinemaPortDefinition,
} from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  cinemaStableId,
  parseCinemaParameterPath,
  type CinemaConnectionId,
  type CinemaNodeId,
  type CinemaPortId,
} from './CinemaIdentifiers'
import type { CinemaNodeDefinitionRegistry } from './CinemaNodeRegistry'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import { getCinemaParameterDefaultValue } from './CinemaParameterSchema'
import { validateCinemaCompositionGraph } from './CinemaGraphCompiler'

export const CINEMA_GRAPH_EDITOR_MAX_VISIBLE_NODES = 120 as const

export interface CinemaGraphNodePorts {
  definition: Readonly<CinemaPersistedDefinition> | null
  inputs: readonly Readonly<CinemaPortDefinition>[]
  outputs: readonly Readonly<CinemaPortDefinition>[]
}

export interface CinemaGraphNodeCreateResult {
  composition: CinemaCompositionDefinition
  selectedNodeId: CinemaNodeId
}

export interface CinemaGraphDeleteResult {
  composition: CinemaCompositionDefinition
  selectedNodeId: CinemaNodeId | null
  removedNodeIds: readonly CinemaNodeId[]
}

export interface CinemaGraphConnectionCandidate {
  fromNodeId: CinemaNodeId
  fromPortId: CinemaPortId
  toNodeId: CinemaNodeId
  toPortId: CinemaPortId
}

export interface CinemaGraphConnectionCheckResult {
  ok: boolean
  connection: CinemaConnectionDefinition | null
  replacedConnectionIds: readonly CinemaConnectionId[]
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaGraphConnectionOptions {
  replaceExistingInput?: boolean
}

export function getCinemaGraphNodePorts(
  node: Readonly<CinemaNodeDefinition>,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
): CinemaGraphNodePorts {
  const definition = definitions.find(candidate => candidate.id === node.typeId) ?? null
  return {
    definition,
    inputs: definition?.definition.inputPorts ?? [],
    outputs: definition?.definition.outputPorts ?? [],
  }
}

export function createCinemaGraphNode(
  composition: Readonly<CinemaCompositionDefinition>,
  persisted: Readonly<CinemaPersistedDefinition>,
): CinemaGraphNodeCreateResult {
  if (persisted.definition.family === 'output') {
    throw new Error('Cinema graph editing keeps exactly one active output node; replace the existing output through an explicit migration instead.')
  }
  const nodeId = nextStableNodeId(
    composition.nodes.map(node => String(node.id)),
    slugify(persisted.definition.label || String(persisted.definition.typeId)),
  )
  const node: CinemaNodeDefinition = {
    id: nodeId,
    typeId: persisted.definition.typeId,
    typeVersion: persisted.definition.version,
    family: persisted.definition.family,
    label: persisted.definition.label,
    enabled: false,
    opacity: 1,
    parameterValues: Object.fromEntries(
      persisted.definition.parameters
        .filter(parameter => parameter.type !== 'trigger')
        .map(parameter => [parameter.id, cloneValue(getCinemaParameterDefaultValue(parameter))]),
    ) as CinemaNodeDefinition['parameterValues'],
  }
  return {
    composition: cloneComposition({
      ...composition,
      revision: composition.revision + 1,
      nodes: [...composition.nodes, node],
    }),
    selectedNodeId: nodeId,
  }
}

export function removeCinemaGraphNodes(
  composition: Readonly<CinemaCompositionDefinition>,
  nodeIds: readonly CinemaNodeId[],
): CinemaGraphDeleteResult {
  const requested = new Set(nodeIds.map(String))
  if (requested.size === 0) return { composition: cloneComposition(composition), selectedNodeId: null, removedNodeIds: [] }
  if (requested.has(String(composition.outputNodeId))) {
    throw new Error('The active Cinema output node cannot be deleted. Connect a replacement graph into the existing output instead.')
  }
  const existing = composition.nodes.filter(node => requested.has(String(node.id)))
  if (existing.length === 0) throw new Error('The selected Cinema graph nodes no longer exist.')
  const removed = new Set(existing.map(node => String(node.id)))
  const remainingNodes = composition.nodes.filter(node => !removed.has(String(node.id)))
  const removedBindingIds = new Set(existing.flatMap(node => node.assetBindingIds ?? []).map(String))
  const retainedBindingIds = new Set(remainingNodes.flatMap(node => node.assetBindingIds ?? []).map(String))
  const bypassConnectionIds = findRestorableBypassConnections(composition, removed)
  const next = reconcileRemovedNodeReferences({
    ...composition,
    revision: composition.revision + 1,
    nodes: remainingNodes,
    connections: composition.connections.map(connection => (
      bypassConnectionIds.has(String(connection.id)) ? { ...connection, enabled: true } : connection
    )),
    assetBindings: composition.assetBindings.filter(binding => (
      !removedBindingIds.has(String(binding.id)) || retainedBindingIds.has(String(binding.id))
    )),
  }, removed)
  return {
    composition: cloneComposition(next),
    selectedNodeId: next.nodes.find(node => node.id !== next.outputNodeId)?.id ?? next.outputNodeId ?? null,
    removedNodeIds: existing.map(node => node.id),
  }
}

export function setCinemaGraphNodesEnabled(
  composition: Readonly<CinemaCompositionDefinition>,
  nodeIds: readonly CinemaNodeId[],
  enabled: boolean,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
): CinemaCompositionDefinition {
  const selected = new Set(nodeIds.map(String))
  if (selected.has(String(composition.outputNodeId)) && !enabled) {
    throw new Error('The active Cinema output node cannot be disabled.')
  }
  const changedNodes = composition.nodes.map(node => selected.has(String(node.id)) ? { ...node, enabled } : node)
  const enabledById = new Map(changedNodes.map(node => [String(node.id), node.enabled]))
  let changedConnections = composition.connections.map(connection => {
    const incident = selected.has(String(connection.from.nodeId)) || selected.has(String(connection.to.nodeId))
    if (!incident) return connection
    const endpointsEnabled = enabledById.get(String(connection.from.nodeId)) === true
      && enabledById.get(String(connection.to.nodeId)) === true
    return { ...connection, enabled: endpointsEnabled ? enabled : false }
  })
  if (enabled) {
    const newlyEnabled = changedConnections.filter(connection => (
      connection.enabled
      && (selected.has(String(connection.from.nodeId)) || selected.has(String(connection.to.nodeId)))
    ))
    const singleInputTargets = new Map<string, CinemaConnectionDefinition[]>()
    for (const connection of newlyEnabled) {
      const toNode = changedNodes.find(node => node.id === connection.to.nodeId)
      const toDefinition = toNode ? definitions.find(definition => definition.id === toNode.typeId) : null
      const toPort = toDefinition?.definition.inputPorts.find(port => port.id === connection.to.portId)
      if ((toPort?.cardinality ?? 'one') !== 'one') continue
      const key = `${connection.to.nodeId}\u0000${connection.to.portId}`
      const list = singleInputTargets.get(key) ?? []
      list.push(connection)
      singleInputTargets.set(key, list)
    }
    for (const connections of singleInputTargets.values()) {
      if (connections.length > 1) throw new Error('Multiple pending Cinema connections target the same single-cardinality input.')
      const replacement = connections[0]
      changedConnections = changedConnections.map(connection => (
        connection.id !== replacement.id
        && connection.enabled
        && connection.to.nodeId === replacement.to.nodeId
        && connection.to.portId === replacement.to.portId
          ? { ...connection, enabled: false }
          : connection
      ))
    }
  }
  return cloneComposition({
    ...composition,
    revision: composition.revision + 1,
    nodes: changedNodes,
    connections: changedConnections,
  })
}

export function removeCinemaGraphConnection(
  composition: Readonly<CinemaCompositionDefinition>,
  connectionId: CinemaConnectionId,
): CinemaCompositionDefinition {
  const exists = composition.connections.some(connection => connection.id === connectionId)
  if (!exists) throw new Error(`Cinema connection "${connectionId}" no longer exists.`)
  return cloneComposition({
    ...composition,
    revision: composition.revision + 1,
    connections: composition.connections.filter(connection => connection.id !== connectionId),
  })
}

export function checkCinemaGraphConnection(
  composition: Readonly<CinemaCompositionDefinition>,
  candidate: CinemaGraphConnectionCandidate,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
  registry: CinemaNodeDefinitionRegistry,
  options: CinemaGraphConnectionOptions = {},
): CinemaGraphConnectionCheckResult {
  const diagnostics: CinemaDiagnostic[] = []
  const fromNode = composition.nodes.find(node => node.id === candidate.fromNodeId)
  const toNode = composition.nodes.find(node => node.id === candidate.toNodeId)
  if (!fromNode || !toNode) {
    diagnostics.push(connectionDiagnostic('Cinema graph connection references a node that no longer exists.'))
    return failedConnection(diagnostics)
  }
  const fromPorts = getCinemaGraphNodePorts(fromNode, definitions)
  const toPorts = getCinemaGraphNodePorts(toNode, definitions)
  if (!fromPorts.definition || !toPorts.definition) {
    diagnostics.push(connectionDiagnostic('Cinema graph connection cannot be authored while a node definition is unavailable.'))
    return failedConnection(diagnostics)
  }
  const fromPort = fromPorts.outputs.find(port => port.id === candidate.fromPortId)
  const toPort = toPorts.inputs.find(port => port.id === candidate.toPortId)
  if (!fromPort || !toPort) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_PORT_DIRECTION_INVALID',
      severity: 'error',
      message: 'Cinema graph connections must run from an output port to an input port.',
      attribution: { nodeId: toNode.id, portId: String(candidate.toPortId), stage: 'graph-editor' },
    }))
    return failedConnection(diagnostics)
  }
  if (!portsCompatible(fromPort, toPort)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_PORT_TYPE_MISMATCH',
      severity: 'error',
      message: `Cinema graph cannot connect ${fromPort.dataType} to ${toPort.dataType}.`,
      attribution: { nodeId: toNode.id, portId: toPort.id, stage: 'graph-editor' },
      details: { fromDataType: fromPort.dataType, toDataType: toPort.dataType },
    }))
    return failedConnection(diagnostics)
  }
  const candidateEnabled = fromNode.enabled && toNode.enabled
  const existingAtInput = composition.connections.filter(connection => (
    connection.to.nodeId === toNode.id && connection.to.portId === toPort.id
  ))
  let replacedConnectionIds: readonly CinemaConnectionId[] = []
  if ((toPort.cardinality ?? 'one') === 'one') {
    if (candidateEnabled) {
      const activeExisting = existingAtInput.filter(connection => connection.enabled)
      if (activeExisting.length > 0 && !options.replaceExistingInput) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_PORT_CARDINALITY_EXCEEDED',
          severity: 'error',
          message: `Cinema input "${toPort.label}" already has its single allowed connection.`,
          attribution: { nodeId: toNode.id, portId: toPort.id, stage: 'graph-editor' },
        }))
        return failedConnection(diagnostics)
      }
      if (options.replaceExistingInput) replacedConnectionIds = activeExisting.map(connection => connection.id)
    } else if (existingAtInput.some(connection => !connection.enabled)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_PORT_CARDINALITY_EXCEEDED',
        severity: 'error',
        message: `Cinema input "${toPort.label}" already has a pending draft connection.`,
        attribution: { nodeId: toNode.id, portId: toPort.id, stage: 'graph-editor' },
      }))
      return failedConnection(diagnostics)
    }
  }
  if (composition.connections.some(connection => (
    connection.from.nodeId === fromNode.id
    && connection.from.portId === fromPort.id
    && connection.to.nodeId === toNode.id
    && connection.to.portId === toPort.id
  ))) {
    diagnostics.push(connectionDiagnostic('That Cinema graph connection already exists.'))
    return failedConnection(diagnostics)
  }

  const connection: CinemaConnectionDefinition = {
    id: nextConnectionId(composition.connections.map(existing => String(existing.id)), fromNode.id, toNode.id),
    from: { nodeId: fromNode.id, portId: fromPort.id },
    to: { nodeId: toNode.id, portId: toPort.id },
    enabled: candidateEnabled,
  }
  const before = validateCinemaCompositionGraph(composition, registry)
  const after = validateCinemaCompositionGraph({
    ...composition,
    connections: [
      ...composition.connections.map(existing => (
        replacedConnectionIds.includes(existing.id) ? { ...existing, enabled: false } : existing
      )),
      connection,
    ],
  }, registry)
  const beforeDiagnosticIds = new Set(before.diagnostics.diagnostics.map(diagnostic => diagnostic.id))
  const newlyIntroducedErrors = after.diagnostics.diagnostics.filter(diagnostic => (
    (diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
    && !beforeDiagnosticIds.has(diagnostic.id)
    && (diagnostic.code === 'CINEMA_GRAPH_CYCLE'
      || diagnostic.code === 'CINEMA_PORT_CARDINALITY_EXCEEDED'
      || diagnostic.code === 'CINEMA_PORT_TYPE_MISMATCH'
      || diagnostic.code === 'CINEMA_PORT_DIRECTION_INVALID'
      || diagnostic.code === 'CINEMA_CONNECTION_INVALID')
  ))
  if (newlyIntroducedErrors.length > 0) return failedConnection(newlyIntroducedErrors)
  return { ok: true, connection, replacedConnectionIds, diagnostics: createCinemaDiagnosticSnapshot([]) }
}

export function connectCinemaGraphNodes(
  composition: Readonly<CinemaCompositionDefinition>,
  candidate: CinemaGraphConnectionCandidate,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
  registry: CinemaNodeDefinitionRegistry,
  options: CinemaGraphConnectionOptions = {},
): CinemaCompositionDefinition {
  const check = checkCinemaGraphConnection(composition, candidate, definitions, registry, options)
  if (!check.ok || !check.connection) {
    throw new Error(check.diagnostics.diagnostics[0]?.message ?? 'Cinema graph connection is invalid.')
  }
  return cloneComposition({
    ...composition,
    revision: composition.revision + 1,
    connections: [
      ...composition.connections.map(connection => (
        check.replacedConnectionIds.includes(connection.id) ? { ...connection, enabled: false } : connection
      )),
      check.connection,
    ],
  })
}

function findRestorableBypassConnections(
  composition: Readonly<CinemaCompositionDefinition>,
  removedNodeIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const restored = new Set<string>()
  for (const nodeId of removedNodeIds) {
    const incoming = composition.connections.filter(connection => (
      connection.enabled
      && String(connection.to.nodeId) === nodeId
      && !removedNodeIds.has(String(connection.from.nodeId))
    ))
    const outgoing = composition.connections.filter(connection => (
      connection.enabled
      && String(connection.from.nodeId) === nodeId
      && !removedNodeIds.has(String(connection.to.nodeId))
    ))
    if (incoming.length !== 1 || outgoing.length !== 1) continue
    const upstream = incoming[0].from
    const downstream = outgoing[0].to
    const bypass = composition.connections.find(connection => (
      !connection.enabled
      && !removedNodeIds.has(String(connection.from.nodeId))
      && !removedNodeIds.has(String(connection.to.nodeId))
      && connection.from.nodeId === upstream.nodeId
      && connection.from.portId === upstream.portId
      && connection.to.nodeId === downstream.nodeId
      && connection.to.portId === downstream.portId
    ))
    if (bypass) restored.add(String(bypass.id))
  }
  return restored
}

function reconcileRemovedNodeReferences(
  composition: Readonly<CinemaCompositionDefinition>,
  removedNodeIds: ReadonlySet<string>,
): CinemaCompositionDefinition {
  const destinationRemoved = (destination: string): boolean => {
    const parsed = parseCinemaParameterPath(destination)
    return parsed.ok && parsed.ownerId != null && removedNodeIds.has(parsed.ownerId)
  }
  return {
    ...composition,
    connections: composition.connections.filter(connection => (
      !removedNodeIds.has(String(connection.from.nodeId))
      && !removedNodeIds.has(String(connection.to.nodeId))
    )),
    modulationRoutes: composition.modulationRoutes.filter(route => !destinationRemoved(route.destination)),
    performanceRules: composition.performanceRules.map(rule => ({
      ...rule,
      actions: rule.actions.filter(action => !performanceActionReferencesRemovedNode(action, removedNodeIds, destinationRemoved)),
    })),
  }
}

export function getCinemaGraphDiagnosticsForNode(
  diagnostics: CinemaDiagnosticSnapshot,
  nodeId: CinemaNodeId,
): readonly CinemaDiagnostic[] {
  return diagnostics.diagnostics.filter(diagnostic => diagnostic.attribution?.nodeId === String(nodeId))
}

export function getCinemaGraphDiagnosticsForConnection(
  diagnostics: CinemaDiagnosticSnapshot,
  connectionId: CinemaConnectionId,
): readonly CinemaDiagnostic[] {
  return diagnostics.diagnostics.filter(diagnostic => diagnostic.attribution?.connectionId === String(connectionId))
}

function performanceActionReferencesRemovedNode(
  action: CinemaPerformanceAction,
  removedNodeIds: ReadonlySet<string>,
  destinationRemoved: (destination: string) => boolean,
): boolean {
  if ('nodeId' in action && removedNodeIds.has(String(action.nodeId))) return true
  return 'destination' in action && destinationRemoved(action.destination)
}

function nextStableNodeId(existingIds: readonly string[], base: string): CinemaNodeId {
  const existing = new Set(existingIds)
  let normalizedBase = base || 'graph-node'
  if (!/^[a-z]/.test(normalizedBase)) normalizedBase = `node-${normalizedBase}`
  let candidate = normalizedBase
  let suffix = 2
  while (existing.has(candidate)) candidate = `${normalizedBase}-${suffix++}`
  return cinemaStableId<CinemaNodeId>(candidate, 'node')
}

function nextConnectionId(existingIds: readonly string[], fromNodeId: CinemaNodeId, toNodeId: CinemaNodeId): CinemaConnectionId {
  const existing = new Set(existingIds)
  const base = `graph-${slugify(String(fromNodeId))}-to-${slugify(String(toNodeId))}`.slice(0, 90)
  let candidate = base
  let suffix = 2
  while (existing.has(candidate)) candidate = `${base}-${suffix++}`
  return cinemaStableId<CinemaConnectionId>(candidate, 'connection')
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
  return normalized || 'graph-node'
}

function portsCompatible(fromPort: CinemaPortDefinition, toPort: CinemaPortDefinition): boolean {
  if (fromPort.dataType === 'any' || toPort.dataType === 'any') return true
  if (fromPort.dataType === toPort.dataType) return true
  return toPort.accepts?.includes(fromPort.dataType) === true || toPort.accepts?.includes('any') === true
}

function failedConnection(diagnostics: readonly CinemaDiagnostic[]): CinemaGraphConnectionCheckResult {
  return { ok: false, connection: null, replacedConnectionIds: [], diagnostics: createCinemaDiagnosticSnapshot(diagnostics) }
}

function connectionDiagnostic(message: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_CONNECTION_INVALID',
    severity: 'error',
    message,
    attribution: { stage: 'graph-editor' },
  })
}

function cloneValue(value: CinemaParameterValue): CinemaParameterValue {
  return JSON.parse(JSON.stringify(value)) as CinemaParameterValue
}

function cloneComposition(composition: Readonly<CinemaCompositionDefinition>): CinemaCompositionDefinition {
  return JSON.parse(JSON.stringify(composition)) as CinemaCompositionDefinition
}
