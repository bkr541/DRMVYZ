import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaAssetReference,
  type CinemaCompositionDefinition,
  type CinemaConnectionDefinition,
  type CinemaNodeDefinition,
  type CinemaParameterValue,
  type CinemaPortDefinition,
} from './CinemaDomain'
import {
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  type CinemaOutputDescriptor,
} from './CinemaRendererContracts'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  createCinemaParameterPath,
  parseCinemaNamespacedId,
  parseCinemaParameterPath,
  parseCinemaStableId,
  type CinemaAssetId,
  type CinemaConnectionId,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaPortId,
} from './CinemaIdentifiers'
import {
  CinemaNodeDefinitionRegistry,
  type CinemaNodeRegistryEntry,
} from './CinemaNodeRegistry'
import {
  normalizeCinemaParameterValue,
  validateCinemaMasterParameterBinding,
  validateCinemaParameterSchemas,
} from './CinemaParameterSchema'
import { validateCinemaPerformanceRules } from './CinemaPerformanceRuntime'

export const CINEMA_COMPILED_GRAPH_VERSION = 1 as const

export interface CinemaGraphValidationOptions {
  /** Omit when asset availability is unknown. Pass an empty iterable to prove assets are unavailable. */
  availableAssetIds?: Iterable<CinemaAssetId>
}

export interface CinemaGraphValidationResult {
  valid: boolean
  diagnostics: CinemaDiagnosticSnapshot
  activeOutputNodeId: CinemaNodeId | null
  reachableNodeIds: readonly CinemaNodeId[]
  feedbackConnectionIds: readonly CinemaConnectionId[]
}

export interface CinemaCompiledExecutionPhase {
  index: number
  nodeIds: readonly CinemaNodeId[]
}

export interface CinemaCompiledInputSource {
  connectionId: CinemaConnectionId
  sourceNodeId: CinemaNodeId
  sourcePortId: CinemaPortId
  timing: 'current-frame' | 'feedback-write'
}

export interface CinemaCompiledInputBinding {
  nodeId: CinemaNodeId
  portId: CinemaPortId
  cardinality: 'one' | 'many'
  sources: readonly CinemaCompiledInputSource[]
}

export interface CinemaCompiledFeedbackEdge {
  connectionId: CinemaConnectionId
  feedbackNodeId: CinemaNodeId
  inputPortId: CinemaPortId
  outputPortId: CinemaPortId
  sourceNodeId: CinemaNodeId
  sourcePortId: CinemaPortId
  historyFrames: number
}

export interface CinemaCompiledResourceLifetimeHint {
  nodeId: CinemaNodeId
  estimatedPassCount: number
  persistentTargetCount: number
  pingPongPairCount: number
  currentFrameConsumerCount: number
  retainAcrossFrames: boolean
}

export interface CinemaCompiledOutputOwnership {
  nodeId: CinemaNodeId
  descriptor: Readonly<CinemaOutputDescriptor>
}

export interface CinemaCompiledGraphPlan {
  version: typeof CINEMA_COMPILED_GRAPH_VERSION
  compositionId: CinemaCompositionDefinition['id']
  compositionRevision: number
  registryFingerprint: string
  phases: readonly CinemaCompiledExecutionPhase[]
  nodeOrder: readonly CinemaNodeId[]
  inputBindings: readonly CinemaCompiledInputBinding[]
  feedbackEdges: readonly CinemaCompiledFeedbackEdge[]
  output: CinemaCompiledOutputOwnership
  resourceLifetimeHints: readonly CinemaCompiledResourceLifetimeHint[]
}

export type CinemaGraphCompilationResult =
  | {
      ok: true
      plan: CinemaCompiledGraphPlan
      diagnostics: CinemaDiagnosticSnapshot
      safeOutput: Readonly<CinemaOutputDescriptor>
    }
  | {
      ok: false
      plan: null
      diagnostics: CinemaDiagnosticSnapshot
      safeOutput: Readonly<CinemaOutputDescriptor>
    }

interface ResolvedConnection {
  connection: CinemaConnectionDefinition
  fromNode: CinemaNodeDefinition
  toNode: CinemaNodeDefinition
  fromPort: CinemaPortDefinition
  toPort: CinemaPortDefinition
  temporalFeedbackWrite: boolean
}

interface GraphAnalysis {
  composition: CinemaCompositionDefinition | null
  diagnostics: readonly CinemaDiagnostic[]
  activeNodes: readonly CinemaNodeDefinition[]
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>
  resolvedConnections: readonly ResolvedConnection[]
  activeOutputNodeId: CinemaNodeId | null
  reachableNodeIds: readonly CinemaNodeId[]
  phases: readonly CinemaCompiledExecutionPhase[]
}

export function validateCinemaCompositionGraph(
  value: unknown,
  registry: CinemaNodeDefinitionRegistry,
  options: CinemaGraphValidationOptions = {},
): CinemaGraphValidationResult {
  try {
    const analysis = analyzeGraph(value, registry, options)
    const diagnostics = createCinemaDiagnosticSnapshot(analysis.diagnostics)
    return {
      valid: diagnostics.counts.error === 0 && diagnostics.counts.fatal === 0,
      diagnostics,
      activeOutputNodeId: analysis.activeOutputNodeId,
      reachableNodeIds: analysis.reachableNodeIds,
      feedbackConnectionIds: analysis.resolvedConnections
        .filter(connection => connection.temporalFeedbackWrite)
        .map(connection => connection.connection.id)
        .sort(compareStrings),
    }
  } catch (error) {
    return {
      valid: false,
      diagnostics: createCinemaDiagnosticSnapshot([validationFailure(error)]),
      activeOutputNodeId: null,
      reachableNodeIds: [],
      feedbackConnectionIds: [],
    }
  }
}

/**
 * Production-intended pure compiler entry point. It allocates no renderer, target, canvas, or GPU resource.
 */
export function compileCinemaCompositionGraph(
  value: unknown,
  registry: CinemaNodeDefinitionRegistry,
  options: CinemaGraphValidationOptions = {},
): CinemaGraphCompilationResult {
  try {
    const analysis = analyzeGraph(value, registry, options)
    const diagnostics = createCinemaDiagnosticSnapshot(analysis.diagnostics)
    const invalid = diagnostics.counts.error > 0 || diagnostics.counts.fatal > 0
    if (invalid || !analysis.composition || !analysis.activeOutputNodeId) {
      return { ok: false, plan: null, diagnostics, safeOutput: CINEMA_SAFE_OUTPUT_DESCRIPTOR }
    }

    const outputEntry = analysis.entriesByNodeId.get(analysis.activeOutputNodeId)
    if (!outputEntry) {
      const failedDiagnostics = createCinemaDiagnosticSnapshot([
        ...analysis.diagnostics,
        compileFailure('The active Cinema output node has no registry entry.', analysis.composition.id),
      ])
      return { ok: false, plan: null, diagnostics: failedDiagnostics, safeOutput: CINEMA_SAFE_OUTPUT_DESCRIPTOR }
    }

    const nodeOrder = analysis.phases.flatMap(phase => phase.nodeIds)
    const plan: CinemaCompiledGraphPlan = {
      version: CINEMA_COMPILED_GRAPH_VERSION,
      compositionId: analysis.composition.id,
      compositionRevision: analysis.composition.revision,
      registryFingerprint: registry.fingerprint,
      phases: analysis.phases,
      nodeOrder,
      inputBindings: createInputBindings(analysis.activeNodes, analysis.entriesByNodeId, analysis.resolvedConnections),
      feedbackEdges: createFeedbackEdges(analysis.entriesByNodeId, analysis.resolvedConnections),
      output: {
        nodeId: analysis.activeOutputNodeId,
        descriptor: outputEntry.definition.output,
      },
      resourceLifetimeHints: createResourceHints(analysis.activeNodes, analysis.entriesByNodeId, analysis.resolvedConnections),
    }
    return { ok: true, plan, diagnostics, safeOutput: CINEMA_SAFE_OUTPUT_DESCRIPTOR }
  } catch (error) {
    const diagnostic = createCinemaDiagnostic({
      code: 'CINEMA_COMPILE_FAILED',
      severity: 'error',
      message: 'Cinema graph compilation failed safely.',
      details: { reason: error instanceof Error ? error.message : String(error) },
    })
    return {
      ok: false,
      plan: null,
      diagnostics: createCinemaDiagnosticSnapshot([diagnostic]),
      safeOutput: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
    }
  }
}

function analyzeGraph(
  value: unknown,
  registry: CinemaNodeDefinitionRegistry,
  options: CinemaGraphValidationOptions,
): GraphAnalysis {
  const diagnostics: CinemaDiagnostic[] = [...registry.diagnostics]
  const composition = readComposition(value, diagnostics)
  if (!composition) return emptyAnalysis(diagnostics)

  validateCompositionSchema(composition, diagnostics)
  const nodeRecords = readRecordArray<CinemaNodeDefinition>(composition.nodes, 'nodes', composition.id, diagnostics)
  const connectionRecords = readRecordArray<CinemaConnectionDefinition>(composition.connections, 'connections', composition.id, diagnostics)
  const allNodes = validateNodeRecords(nodeRecords, composition, diagnostics)
  const allConnections = validateConnectionRecords(connectionRecords, composition, diagnostics)
  validateStableIdentifiers(composition, allNodes, allConnections, diagnostics)
  validateDuplicateIds(allNodes, allConnections, diagnostics)

  const activeNodes = allNodes
    .filter(node => node.enabled === true)
    .sort((left, right) => compareStrings(left.id, right.id))
  const nodeById = new Map(activeNodes.map(node => [node.id, node]))
  const entriesByNodeId = resolveNodeEntries(activeNodes, registry, composition, diagnostics)
  validateNodeParameters(composition, allNodes, entriesByNodeId, diagnostics)
  validateAssets(composition, allNodes, options.availableAssetIds, diagnostics)
  validateParameterDestinations(composition, allNodes, entriesByNodeId, diagnostics)
  diagnostics.push(...validateCinemaPerformanceRules(composition))

  const activeOutputNodeId = validateOutput(composition, activeNodes, entriesByNodeId, diagnostics)
  const resolvedConnections = resolveConnections(
    allConnections.filter(connection => connection.enabled === true),
    nodeById,
    entriesByNodeId,
    diagnostics,
  )
  validateInputs(activeNodes, entriesByNodeId, resolvedConnections, diagnostics)

  const reachableNodeIds = activeOutputNodeId
    ? findReachableNodeIds(activeOutputNodeId, resolvedConnections)
    : []
  if (activeOutputNodeId) validateReachability(activeNodes, reachableNodeIds, composition, diagnostics)

  const phases = createExecutionPhases(activeNodes, resolvedConnections, composition, diagnostics)
  return {
    composition,
    diagnostics: deduplicateCinemaDiagnostics(diagnostics),
    activeNodes,
    entriesByNodeId,
    resolvedConnections,
    activeOutputNodeId,
    reachableNodeIds,
    phases,
  }
}

function readComposition(value: unknown, diagnostics: CinemaDiagnostic[]): CinemaCompositionDefinition | null {
  if (!isRecord(value)) {
    diagnostics.push(schemaDiagnostic('Cinema composition must be an object.'))
    return null
  }
  const requiredArrays = [
    'nodes', 'connections', 'masterParameters', 'cameras', 'assetBindings', 'modulationRoutes', 'performanceRules',
  ]
  for (const property of requiredArrays) {
    if (!Array.isArray(value[property])) {
      diagnostics.push(schemaDiagnostic(`Cinema composition property "${property}" must be an array.`))
    }
  }
  if (!isRecord(value.metadata)) diagnostics.push(schemaDiagnostic('Cinema composition metadata must be an object.'))
  if (!isRecord(value.masterValues)) diagnostics.push(schemaDiagnostic('Cinema composition masterValues must be an object.'))
  if (typeof value.id !== 'string') diagnostics.push(schemaDiagnostic('Cinema composition ID must be a string.'))
  if (typeof value.outputNodeId !== 'string') diagnostics.push(schemaDiagnostic('Cinema composition outputNodeId must be a string.'))
  if (diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_SCHEMA_INVALID')) return null
  return value as unknown as CinemaCompositionDefinition
}

function validateCompositionSchema(composition: CinemaCompositionDefinition, diagnostics: CinemaDiagnostic[]): void {
  if (composition.schemaId !== CINEMA_COMPOSITION_SCHEMA_ID) {
    diagnostics.push(schemaDiagnostic(`Unsupported Cinema composition schema "${String(composition.schemaId)}".`))
  }
  if (composition.schemaVersion !== CINEMA_COMPOSITION_SCHEMA_VERSION) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
      severity: 'fatal',
      message: `Cinema composition schema version "${String(composition.schemaVersion)}" is not supported.`,
      attribution: { compositionId: String(composition.id ?? '') },
      recoverable: false,
    }))
  }
  if (!Number.isInteger(composition.revision) || composition.revision < 1) {
    diagnostics.push(schemaDiagnostic('Cinema composition revision must be a positive integer.', composition.id))
  }
}

function readRecordArray<T>(
  value: readonly T[],
  property: string,
  compositionId: CinemaCompositionDefinition['id'],
  diagnostics: CinemaDiagnostic[],
): T[] {
  const records: T[] = []
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_INVALID',
        severity: 'error',
        message: `Cinema composition ${property}[${index}] must be an object.`,
        attribution: { compositionId },
        details: { property, index },
      }))
      continue
    }
    records.push(entry as T)
  }
  return records
}

const CINEMA_NODE_FAMILIES = new Set<CinemaNodeDefinition['family']>([
  'shader', 'procedural', 'media', 'logo', 'text', 'lyrics', 'effect', 'mixer', 'camera', 'control', 'output',
])

function validateNodeRecords(
  nodes: readonly CinemaNodeDefinition[],
  composition: CinemaCompositionDefinition,
  diagnostics: CinemaDiagnostic[],
): CinemaNodeDefinition[] {
  const valid: CinemaNodeDefinition[] = []
  for (const node of nodes) {
    const nodeId = typeof node.id === 'string' ? node.id : undefined
    const invalid = typeof node.id !== 'string'
      || typeof node.typeId !== 'string'
      || !Number.isInteger(node.typeVersion)
      || node.typeVersion < 1
      || !CINEMA_NODE_FAMILIES.has(node.family)
      || typeof node.enabled !== 'boolean'
      || !Number.isFinite(node.opacity)
      || node.opacity < 0
      || node.opacity > 1
      || !isRecord(node.parameterValues)
      || (node.assetBindingIds != null && !Array.isArray(node.assetBindingIds))
    if (invalid) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_INVALID',
        severity: 'error',
        message: 'Cinema node definition is malformed.',
        attribution: { compositionId: composition.id, ...(nodeId ? { nodeId } : {}) },
      }))
      continue
    }
    valid.push(node)
  }
  return valid
}

function validateConnectionRecords(
  connections: readonly CinemaConnectionDefinition[],
  composition: CinemaCompositionDefinition,
  diagnostics: CinemaDiagnostic[],
): CinemaConnectionDefinition[] {
  const valid: CinemaConnectionDefinition[] = []
  for (const connection of connections) {
    const connectionId = typeof connection.id === 'string' ? connection.id : undefined
    const invalid = typeof connection.id !== 'string'
      || !isRecord(connection.from)
      || !isRecord(connection.to)
      || typeof connection.from.nodeId !== 'string'
      || typeof connection.from.portId !== 'string'
      || typeof connection.to.nodeId !== 'string'
      || typeof connection.to.portId !== 'string'
      || typeof connection.enabled !== 'boolean'
    if (invalid) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_INVALID',
        severity: 'error',
        message: 'Cinema connection definition is malformed.',
        attribution: { compositionId: composition.id, ...(connectionId ? { connectionId } : {}) },
      }))
      continue
    }
    valid.push(connection)
  }
  return valid
}

function validateStableIdentifiers(
  composition: CinemaCompositionDefinition,
  nodes: readonly CinemaNodeDefinition[],
  connections: readonly CinemaConnectionDefinition[],
  diagnostics: CinemaDiagnostic[],
): void {
  diagnostics.push(...parseCinemaStableId(composition.id, 'composition').diagnostics)
  diagnostics.push(...parseCinemaStableId(composition.outputNodeId, 'output node').diagnostics)
  for (const node of nodes) {
    diagnostics.push(...parseCinemaStableId(node.id, 'node').diagnostics)
    diagnostics.push(...parseCinemaNamespacedId(node.typeId, 'node type').diagnostics)
    for (const parameterId of Object.keys(node.parameterValues)) {
      diagnostics.push(...parseCinemaStableId(parameterId, 'parameter').diagnostics)
    }
    for (const bindingId of node.assetBindingIds ?? []) {
      diagnostics.push(...parseCinemaStableId(bindingId, 'asset binding').diagnostics)
    }
  }
  for (const connection of connections) {
    diagnostics.push(...parseCinemaStableId(connection.id, 'connection').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.from.nodeId, 'node').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.from.portId, 'port').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.to.nodeId, 'node').diagnostics)
    diagnostics.push(...parseCinemaStableId(connection.to.portId, 'port').diagnostics)
  }
  for (const parameter of composition.masterParameters) diagnostics.push(...parseCinemaStableId(parameter.id, 'parameter').diagnostics)
  for (const parameterId of Object.keys(composition.masterValues)) diagnostics.push(...parseCinemaStableId(parameterId, 'parameter').diagnostics)
  for (const camera of composition.cameras) diagnostics.push(...parseCinemaStableId(camera.id, 'camera').diagnostics)
  for (const binding of composition.assetBindings) {
    diagnostics.push(...parseCinemaStableId(binding.id, 'asset binding').diagnostics)
    diagnostics.push(...parseCinemaStableId(binding.assetId, 'asset').diagnostics)
  }
  for (const route of composition.modulationRoutes) diagnostics.push(...parseCinemaStableId(route.id, 'modulation route').diagnostics)
  for (const rule of composition.performanceRules) diagnostics.push(...parseCinemaStableId(rule.id, 'performance rule').diagnostics)
}

function validateDuplicateIds(
  nodes: readonly CinemaNodeDefinition[],
  connections: readonly CinemaConnectionDefinition[],
  diagnostics: CinemaDiagnostic[],
): void {
  appendDuplicateDiagnostics(nodes.map(node => String(node.id)), 'node', diagnostics)
  appendDuplicateDiagnostics(connections.map(connection => String(connection.id)), 'connection', diagnostics)
}

function appendDuplicateDiagnostics(ids: readonly string[], kind: string, diagnostics: CinemaDiagnostic[]): void {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const [id, count] of [...counts.entries()].filter(([, count]) => count > 1).sort(([left], [right]) => compareStrings(left, right))) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_ID_DUPLICATE',
      severity: 'error',
      message: `Duplicate Cinema ${kind} ID "${id}".`,
      details: { id, kind, count },
    }))
  }
}

function resolveNodeEntries(
  nodes: readonly CinemaNodeDefinition[],
  registry: CinemaNodeDefinitionRegistry,
  composition: CinemaCompositionDefinition,
  diagnostics: CinemaDiagnostic[],
): ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>> {
  const entries = new Map<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>()
  for (const node of nodes) {
    const entry = registry.get(node.typeId)
    if (!entry) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_TYPE_MISSING',
        severity: 'error',
        message: `Cinema node type "${String(node.typeId)}" is not registered.`,
        attribution: { compositionId: composition.id, nodeId: node.id },
        details: { typeId: String(node.typeId) },
      }))
      continue
    }
    entries.set(node.id, entry)
    if (node.typeVersion !== entry.definition.version) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_VERSION_UNSUPPORTED',
        severity: 'error',
        message: `Cinema node "${node.id}" requests unsupported type version ${node.typeVersion}.`,
        attribution: { compositionId: composition.id, nodeId: node.id },
        details: { typeId: String(node.typeId), requestedVersion: node.typeVersion, registeredVersion: entry.definition.version },
      }))
    }
    if (node.family !== entry.definition.family) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_NODE_FAMILY_MISMATCH',
        severity: 'error',
        message: `Cinema node "${node.id}" family does not match its registered node type.`,
        attribution: { compositionId: composition.id, nodeId: node.id },
        details: { authoredFamily: node.family, registeredFamily: entry.definition.family },
      }))
    }
    if (!entry.rendererPlugin.available) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_PLUGIN_UNAVAILABLE',
        severity: 'error',
        message: `Renderer plugin "${entry.rendererPlugin.id}" is unavailable for Cinema node "${node.id}".`,
        attribution: { compositionId: composition.id, nodeId: node.id },
        details: { pluginId: String(entry.rendererPlugin.id), typeId: String(node.typeId) },
      }))
    }
  }
  return entries
}

function validateOutput(
  composition: CinemaCompositionDefinition,
  activeNodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  diagnostics: CinemaDiagnostic[],
): CinemaNodeId | null {
  const outputs = activeNodes.filter(node => (
    node.family === 'output' || entriesByNodeId.get(node.id)?.definition.family === 'output'
  ))
  if (outputs.length === 0) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_OUTPUT_MISSING',
      severity: 'error',
      message: 'Cinema composition must contain exactly one active output node.',
      attribution: { compositionId: composition.id },
    }))
    return null
  }
  if (outputs.length > 1) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_OUTPUT_MULTIPLE',
      severity: 'error',
      message: 'Cinema composition contains more than one active output node.',
      attribution: { compositionId: composition.id },
      details: { outputNodeIds: outputs.map(node => node.id).sort(compareStrings).join(',') },
    }))
  }
  const selected = activeNodes.find(node => node.id === composition.outputNodeId)
  if (!selected || !outputs.some(node => node.id === selected.id)) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_OUTPUT_MISSING',
      severity: 'error',
      message: `Cinema output node "${String(composition.outputNodeId)}" is missing, disabled, or not an output node.`,
      attribution: { compositionId: composition.id, nodeId: String(composition.outputNodeId) },
    }))
    return null
  }
  return selected.id
}

function resolveConnections(
  connections: readonly CinemaConnectionDefinition[],
  nodeById: ReadonlyMap<CinemaNodeId, CinemaNodeDefinition>,
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  diagnostics: CinemaDiagnostic[],
): ResolvedConnection[] {
  const resolved: ResolvedConnection[] = []
  for (const connection of [...connections].sort((left, right) => compareStrings(left.id, right.id))) {
    const fromNode = nodeById.get(connection.from?.nodeId)
    const toNode = nodeById.get(connection.to?.nodeId)
    if (!fromNode || !toNode) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_CONNECTION_INVALID',
        severity: 'error',
        message: `Cinema connection "${String(connection.id)}" references a missing or disabled node.`,
        attribution: { connectionId: String(connection.id) },
        details: {
          fromNodeId: String(connection.from?.nodeId),
          toNodeId: String(connection.to?.nodeId),
        },
      }))
      continue
    }
    const fromEntry = entriesByNodeId.get(fromNode.id)
    const toEntry = entriesByNodeId.get(toNode.id)
    if (!fromEntry || !toEntry) continue

    const fromPort = findPort(fromEntry, connection.from.portId, 'output', connection, diagnostics)
    const toPort = findPort(toEntry, connection.to.portId, 'input', connection, diagnostics)
    if (!fromPort || !toPort) continue
    if (!isPortTypeCompatible(fromPort, toPort)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_PORT_TYPE_MISMATCH',
        severity: 'error',
        message: `Cinema connection "${connection.id}" cannot bind ${fromPort.dataType} to ${toPort.dataType}.`,
        attribution: { connectionId: connection.id, nodeId: toNode.id, portId: toPort.id },
        details: { fromDataType: fromPort.dataType, toDataType: toPort.dataType },
      }))
      continue
    }

    resolved.push({
      connection,
      fromNode,
      toNode,
      fromPort,
      toPort,
      temporalFeedbackWrite: toEntry.feedback?.inputPortId === toPort.id,
    })
  }
  return resolved
}

function findPort(
  entry: Readonly<CinemaNodeRegistryEntry>,
  portId: CinemaPortId,
  expectedDirection: 'input' | 'output',
  connection: CinemaConnectionDefinition,
  diagnostics: CinemaDiagnostic[],
): CinemaPortDefinition | null {
  const expected = expectedDirection === 'input' ? entry.definition.inputPorts : entry.definition.outputPorts
  const opposite = expectedDirection === 'input' ? entry.definition.outputPorts : entry.definition.inputPorts
  const port = expected.find(candidate => candidate.id === portId)
  if (port) return port
  const wrongDirection = opposite.find(candidate => candidate.id === portId)
  diagnostics.push(createCinemaDiagnostic({
    code: wrongDirection ? 'CINEMA_PORT_DIRECTION_INVALID' : 'CINEMA_PORT_MISSING',
    severity: 'error',
    message: wrongDirection
      ? `Cinema port "${String(portId)}" is used in the wrong connection direction.`
      : `Cinema port "${String(portId)}" does not exist on node type "${entry.definition.typeId}".`,
    attribution: { connectionId: connection.id, portId: String(portId) },
    details: { typeId: String(entry.definition.typeId), expectedDirection },
  }))
  return null
}

function isPortTypeCompatible(fromPort: CinemaPortDefinition, toPort: CinemaPortDefinition): boolean {
  if (fromPort.dataType === 'any' || toPort.dataType === 'any') return true
  if (fromPort.dataType === toPort.dataType) return true
  return toPort.accepts?.includes(fromPort.dataType) === true || toPort.accepts?.includes('any') === true
}

function validateInputs(
  activeNodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  connections: readonly ResolvedConnection[],
  diagnostics: CinemaDiagnostic[],
): void {
  const byInput = new Map<string, ResolvedConnection[]>()
  for (const connection of connections) {
    const key = `${connection.toNode.id}\u0000${connection.toPort.id}`
    const list = byInput.get(key) ?? []
    list.push(connection)
    byInput.set(key, list)
  }
  for (const node of activeNodes) {
    const entry = entriesByNodeId.get(node.id)
    if (!entry) continue
    for (const port of entry.definition.inputPorts) {
      const connectionsForPort = byInput.get(`${node.id}\u0000${port.id}`) ?? []
      if (port.required && connectionsForPort.length === 0) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_REQUIRED_INPUT_MISSING',
          severity: 'error',
          message: `Required Cinema input "${port.id}" is not connected.`,
          attribution: { nodeId: node.id, portId: port.id },
        }))
      }
      if ((port.cardinality ?? 'one') === 'one' && connectionsForPort.length > 1) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_PORT_CARDINALITY_EXCEEDED',
          severity: 'error',
          message: `Cinema input "${port.id}" accepts only one connection.`,
          attribution: { nodeId: node.id, portId: port.id },
          details: { connectionCount: connectionsForPort.length },
        }))
      }
    }
  }
}

function validateNodeParameters(
  composition: CinemaCompositionDefinition,
  nodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  diagnostics: CinemaDiagnostic[],
): void {
  appendDuplicateDiagnostics(composition.masterParameters.map(parameter => String(parameter.id)), 'master parameter', diagnostics)
  diagnostics.push(...validateCinemaParameterSchemas(composition.masterParameters, { owner: 'master' }))
  const masterById = new Map(composition.masterParameters.map(parameter => [String(parameter.id), parameter]))
  for (const parameterId of Object.keys(composition.masterValues ?? {})) {
    const schema = masterById.get(parameterId)
    if (!schema) {
      diagnostics.push(parameterMissingDiagnostic(parameterId, 'master', composition.id))
      continue
    }
    diagnostics.push(...normalizeCinemaParameterValue(
      schema,
      composition.masterValues[parameterId as CinemaParameterId],
      { parameterPath: createCinemaParameterPath('master', schema.id) },
    ).diagnostics)
  }
  for (const node of nodes) {
    const entry = entriesByNodeId.get(node.id)
    if (!entry) continue
    const parameterById = new Map(entry.definition.parameters.map(parameter => [String(parameter.id), parameter]))
    for (const parameter of entry.definition.parameters) {
      diagnostics.push(...validateCinemaMasterParameterBinding(parameter, masterById.get(String(parameter.masterBinding?.masterParameterId))))
    }
    for (const parameterId of Object.keys(node.parameterValues ?? {})) {
      const schema = parameterById.get(parameterId)
      if (!schema) {
        diagnostics.push(parameterMissingDiagnostic(parameterId, node.id, composition.id, node.id))
        continue
      }
      const namespace = node.family === 'effect' ? 'effects' : 'nodes'
      diagnostics.push(...normalizeCinemaParameterValue(
        schema,
        node.parameterValues[parameterId as CinemaParameterId],
        { parameterPath: createCinemaParameterPath(namespace, schema.id, node.id) },
      ).diagnostics)
    }
  }
}

function validateParameterDestinations(
  composition: CinemaCompositionDefinition,
  nodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  diagnostics: CinemaDiagnostic[],
): void {
  const nodeById = new Map(nodes.map(node => [String(node.id), node]))
  const masterIds = new Set(composition.masterParameters.map(parameter => String(parameter.id)))
  const cameraIds = new Set(composition.cameras.map(camera => String(camera.id)))
  const paths = [
    ...composition.modulationRoutes.map(route => route.destination),
    ...composition.performanceRules.flatMap(rule => rule.actions.flatMap(action => (
      action.type === 'set-parameter' || action.type === 'trigger-parameter' ? [action.destination] : []
    ))),
  ]
  for (const path of paths) {
    const parsed = parseCinemaParameterPath(path)
    if (!parsed.ok) {
      diagnostics.push(...parsed.diagnostics)
      continue
    }
    if (parsed.namespace === 'master') {
      if (!masterIds.has(parsed.parameterId)) diagnostics.push(parameterMissingDiagnostic(parsed.parameterId, 'master', composition.id))
      continue
    }
    if (parsed.namespace === 'cameras') {
      if (!parsed.ownerId || !cameraIds.has(parsed.ownerId)) diagnostics.push(parameterMissingDiagnostic(parsed.parameterId, parsed.ownerId ?? 'camera', composition.id))
      continue
    }
    const node = parsed.ownerId ? nodeById.get(parsed.ownerId) : undefined
    const entry = node ? entriesByNodeId.get(node.id) : undefined
    const namespaceMatches = parsed.namespace !== 'effects' || node?.family === 'effect'
    const parameterExists = entry?.definition.parameters.some(parameter => String(parameter.id) === parsed.parameterId) === true
    if (!node || !namespaceMatches || !parameterExists) {
      diagnostics.push(parameterMissingDiagnostic(parsed.parameterId, parsed.ownerId ?? parsed.namespace, composition.id, node?.id, path))
    }
  }
}

function validateAssets(
  composition: CinemaCompositionDefinition,
  nodes: readonly CinemaNodeDefinition[],
  availableAssetIds: Iterable<CinemaAssetId> | undefined,
  diagnostics: CinemaDiagnostic[],
): void {
  appendDuplicateDiagnostics(composition.assetBindings.map(binding => String(binding.id)), 'asset binding', diagnostics)
  const bindingIds = new Set(composition.assetBindings.map(binding => String(binding.id)))
  for (const node of nodes) {
    for (const bindingId of node.assetBindingIds ?? []) {
      if (!bindingIds.has(String(bindingId))) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_ASSET_BINDING_MISSING',
          severity: 'error',
          message: `Cinema asset binding "${String(bindingId)}" referenced by node "${node.id}" is missing.`,
          attribution: { compositionId: composition.id, nodeId: node.id },
          details: { bindingId: String(bindingId) },
        }))
      }
    }
  }
  if (availableAssetIds == null) return
  const available = new Set([...availableAssetIds].map(String))
  const references: { assetId: string; nodeId?: CinemaNodeId }[] = composition.assetBindings.map(binding => ({ assetId: String(binding.assetId) }))
  for (const value of Object.values(composition.masterValues ?? {})) {
    if (value === undefined) continue
    const asset = asAssetReference(value)
    if (asset) references.push({ assetId: String(asset.assetId) })
  }
  for (const camera of composition.cameras) {
    for (const value of Object.values(camera.parameterValues ?? {})) {
      if (value === undefined) continue
      const asset = asAssetReference(value)
      if (asset) references.push({ assetId: String(asset.assetId) })
    }
  }
  for (const node of nodes) {
    for (const value of Object.values(node.parameterValues ?? {})) {
      if (value === undefined) continue
      const asset = asAssetReference(value)
      if (asset) references.push({ assetId: String(asset.assetId), nodeId: node.id })
    }
  }
  for (const reference of references) {
    if (available.has(reference.assetId)) continue
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_ASSET_MISSING',
      severity: 'error',
      message: `Cinema asset "${reference.assetId}" is unavailable.`,
      attribution: { compositionId: composition.id, ...(reference.nodeId ? { nodeId: reference.nodeId } : {}), assetId: reference.assetId },
    }))
  }
}

function asAssetReference(value: CinemaParameterValue): CinemaAssetReference | null {
  return isRecord(value) && typeof value.assetId === 'string' && typeof value.role === 'string'
    ? value as unknown as CinemaAssetReference
    : null
}

function findReachableNodeIds(
  outputNodeId: CinemaNodeId,
  connections: readonly ResolvedConnection[],
): CinemaNodeId[] {
  const incoming = new Map<CinemaNodeId, CinemaNodeId[]>()
  for (const connection of connections) {
    const sources = incoming.get(connection.toNode.id) ?? []
    sources.push(connection.fromNode.id)
    incoming.set(connection.toNode.id, sources)
  }
  const reachable = new Set<CinemaNodeId>([outputNodeId])
  const pending: CinemaNodeId[] = [outputNodeId]
  while (pending.length > 0) {
    const nodeId = pending.pop()!
    for (const sourceId of (incoming.get(nodeId) ?? []).sort(compareStrings)) {
      if (reachable.has(sourceId)) continue
      reachable.add(sourceId)
      pending.push(sourceId)
    }
  }
  return [...reachable].sort(compareStrings)
}

function validateReachability(
  activeNodes: readonly CinemaNodeDefinition[],
  reachableNodeIds: readonly CinemaNodeId[],
  composition: CinemaCompositionDefinition,
  diagnostics: CinemaDiagnostic[],
): void {
  const reachable = new Set(reachableNodeIds)
  for (const node of activeNodes) {
    if (reachable.has(node.id)) continue
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_NODE_UNREACHABLE',
      severity: 'error',
      message: `Cinema node "${node.id}" cannot reach the active output.`,
      attribution: { compositionId: composition.id, nodeId: node.id },
    }))
  }
}

function createExecutionPhases(
  activeNodes: readonly CinemaNodeDefinition[],
  connections: readonly ResolvedConnection[],
  composition: CinemaCompositionDefinition,
  diagnostics: CinemaDiagnostic[],
): CinemaCompiledExecutionPhase[] {
  const nodeIds = activeNodes.map(node => node.id).sort(compareStrings)
  const indegree = new Map<CinemaNodeId, number>(nodeIds.map(nodeId => [nodeId, 0]))
  const outgoing = new Map<CinemaNodeId, CinemaNodeId[]>()
  for (const resolved of connections) {
    if (resolved.temporalFeedbackWrite) continue
    indegree.set(resolved.toNode.id, (indegree.get(resolved.toNode.id) ?? 0) + 1)
    const targets = outgoing.get(resolved.fromNode.id) ?? []
    targets.push(resolved.toNode.id)
    outgoing.set(resolved.fromNode.id, targets)
  }

  let ready = nodeIds.filter(nodeId => (indegree.get(nodeId) ?? 0) === 0)
  const phases: CinemaCompiledExecutionPhase[] = []
  const consumed = new Set<CinemaNodeId>()
  while (ready.length > 0) {
    const phaseNodeIds = [...new Set(ready)].filter(nodeId => !consumed.has(nodeId)).sort(compareStrings)
    if (phaseNodeIds.length === 0) break
    phases.push({ index: phases.length, nodeIds: phaseNodeIds })
    const next: CinemaNodeId[] = []
    for (const nodeId of phaseNodeIds) {
      consumed.add(nodeId)
      for (const targetId of (outgoing.get(nodeId) ?? []).sort(compareStrings)) {
        const nextDegree = (indegree.get(targetId) ?? 0) - 1
        indegree.set(targetId, nextDegree)
        if (nextDegree === 0) next.push(targetId)
      }
    }
    ready = next
  }

  if (consumed.size !== nodeIds.length) {
    const cycleNodeIds = nodeIds.filter(nodeId => !consumed.has(nodeId))
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_GRAPH_CYCLE',
      severity: 'error',
      message: 'Cinema graph contains a cycle without an explicit feedback boundary.',
      attribution: { compositionId: composition.id },
      details: { nodeIds: cycleNodeIds.join(',') },
    }))
  }
  return phases
}

function createInputBindings(
  activeNodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  connections: readonly ResolvedConnection[],
): CinemaCompiledInputBinding[] {
  const bindings: CinemaCompiledInputBinding[] = []
  for (const node of activeNodes) {
    const entry = entriesByNodeId.get(node.id)
    if (!entry) continue
    for (const port of [...entry.definition.inputPorts].sort((left, right) => compareStrings(left.id, right.id))) {
      const sources = connections
        .filter(connection => connection.toNode.id === node.id && connection.toPort.id === port.id)
        .map(connection => ({
          connectionId: connection.connection.id,
          sourceNodeId: connection.fromNode.id,
          sourcePortId: connection.fromPort.id,
          timing: connection.temporalFeedbackWrite ? 'feedback-write' as const : 'current-frame' as const,
        }))
        .sort((left, right) => compareStrings(left.connectionId, right.connectionId))
      bindings.push({ nodeId: node.id, portId: port.id, cardinality: port.cardinality ?? 'one', sources })
    }
  }
  return bindings
}

function createFeedbackEdges(
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  connections: readonly ResolvedConnection[],
): CinemaCompiledFeedbackEdge[] {
  return connections
    .filter(connection => connection.temporalFeedbackWrite)
    .map(connection => {
      const feedback = entriesByNodeId.get(connection.toNode.id)!.feedback!
      return {
        connectionId: connection.connection.id,
        feedbackNodeId: connection.toNode.id,
        inputPortId: feedback.inputPortId,
        outputPortId: feedback.outputPortId,
        sourceNodeId: connection.fromNode.id,
        sourcePortId: connection.fromPort.id,
        historyFrames: feedback.historyFrames,
      }
    })
    .sort((left, right) => compareStrings(left.connectionId, right.connectionId))
}

function createResourceHints(
  activeNodes: readonly CinemaNodeDefinition[],
  entriesByNodeId: ReadonlyMap<CinemaNodeId, Readonly<CinemaNodeRegistryEntry>>,
  connections: readonly ResolvedConnection[],
): CinemaCompiledResourceLifetimeHint[] {
  return activeNodes.map(node => {
    const entry = entriesByNodeId.get(node.id)!
    return {
      nodeId: node.id,
      estimatedPassCount: entry.definition.cost.estimatedPassCount,
      persistentTargetCount: entry.definition.cost.persistentTargetCount,
      pingPongPairCount: entry.definition.cost.pingPongPairCount,
      currentFrameConsumerCount: connections.filter(connection => (
        connection.fromNode.id === node.id && !connection.temporalFeedbackWrite
      )).length,
      retainAcrossFrames: entry.feedback != null
        || entry.definition.cost.persistentTargetCount > 0
        || entry.definition.cost.pingPongPairCount > 0,
    }
  }).sort((left, right) => compareStrings(left.nodeId, right.nodeId))
}

function parameterMissingDiagnostic(
  parameterId: string,
  owner: string,
  compositionId: CinemaCompositionDefinition['id'],
  nodeId?: CinemaNodeId,
  parameterPath?: string,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PARAMETER_MISSING',
    severity: 'error',
    message: `Cinema parameter "${parameterId}" is not declared for "${owner}".`,
    attribution: {
      compositionId,
      ...(nodeId ? { nodeId } : {}),
      ...(parameterPath ? { parameterPath } : {}),
    },
    details: { parameterId, owner },
  })
}

function schemaDiagnostic(message: string, compositionId?: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_SCHEMA_INVALID',
    severity: 'error',
    message,
    ...(compositionId ? { attribution: { compositionId } } : {}),
  })
}

function validationFailure(error: unknown): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_VALIDATION_FAILED',
    severity: 'error',
    message: 'Cinema graph validation failed safely.',
    details: { reason: error instanceof Error ? error.message : String(error) },
  })
}

function compileFailure(message: string, compositionId: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_COMPILE_FAILED',
    severity: 'error',
    message,
    attribution: { compositionId },
  })
}

function emptyAnalysis(diagnostics: readonly CinemaDiagnostic[]): GraphAnalysis {
  return {
    composition: null,
    diagnostics: deduplicateCinemaDiagnostics(diagnostics),
    activeNodes: [],
    entriesByNodeId: new Map(),
    resolvedConnections: [],
    activeOutputNodeId: null,
    reachableNodeIds: [],
    phases: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
