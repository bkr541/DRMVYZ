import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_SAFE_OUTPUT_DESCRIPTOR,
  cinemaNamespacedId,
  cinemaStableId,
  compileCinemaCompositionGraph,
  createCinemaNodeDefinitionRegistry,
  getCinemaSupportedParameterSchemas,
  validateCinemaCompositionGraph,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaCompositionDefinition,
  type CinemaCompositionId,
  type CinemaConnectionDefinition,
  type CinemaConnectionId,
  type CinemaNodeDefinition,
  type CinemaNodeFamily,
  type CinemaNodeId,
  type CinemaNodeRegistryEntry,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortDataType,
  type CinemaPortDefinition,
  type CinemaPortId,
  type CinemaRendererPluginId,
  type CinemaStableId,
} from '../index'

function stableId<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

function namespacedId<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaNamespacedId<T>(value, kind)
}

function port(
  value: string,
  direction: 'input' | 'output',
  dataType: CinemaPortDataType = 'color-texture',
  options: Partial<Pick<CinemaPortDefinition, 'required' | 'cardinality' | 'accepts'>> = {},
): CinemaPortDefinition {
  return {
    id: stableId<CinemaPortId>(value, 'port'),
    label: value,
    direction,
    dataType,
    ...options,
  }
}

function entry(
  value: string,
  family: CinemaNodeFamily,
  inputPorts: readonly CinemaPortDefinition[],
  outputPorts: readonly CinemaPortDefinition[],
  options: {
    pluginAvailable?: boolean
    feedback?: CinemaNodeRegistryEntry['feedback']
    parameters?: CinemaNodeRegistryEntry['definition']['parameters']
    sourceKind?: 'built-in' | 'adapter'
  } = {},
): CinemaNodeRegistryEntry {
  const typeId = namespacedId<CinemaNodeTypeId>(`drmvyz.${value}`, 'node type')
  const pluginId = namespacedId<CinemaRendererPluginId>(`drmvyz.renderer.${value}`, 'renderer plugin')
  return {
    definition: {
      typeId,
      version: 1,
      label: value,
      family,
      inputPorts,
      outputPorts,
      parameters: options.parameters ?? [],
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
        estimatedPassCount: family === 'output' ? 0 : 1,
        persistentTargetCount: options.feedback ? 1 : 0,
        pingPongPairCount: options.feedback ? 1 : 0,
      },
      seekPolicy: { mode: 'stateless' },
      output: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
    },
    rendererPlugin: { id: pluginId, available: options.pluginAvailable ?? true },
    source: { kind: options.sourceKind ?? 'built-in', id: `stage-2:${value}` },
    ...(options.feedback ? { feedback: options.feedback } : {}),
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: family === 'output' ? 0 : 1,
      maximumPersistentTargetCount: options.feedback ? 1 : 0,
      maximumPingPongPairCount: options.feedback ? 1 : 0,
    },
  }
}

function node(value: string, registryEntry: CinemaNodeRegistryEntry, parameterValues: CinemaNodeDefinition['parameterValues'] = {}): CinemaNodeDefinition {
  return {
    id: stableId<CinemaNodeId>(value, 'node'),
    typeId: registryEntry.definition.typeId,
    typeVersion: registryEntry.definition.version,
    family: registryEntry.definition.family,
    enabled: true,
    opacity: 1,
    parameterValues,
  }
}

function connection(
  value: string,
  fromNode: CinemaNodeDefinition,
  fromPortId: CinemaPortId,
  toNode: CinemaNodeDefinition,
  toPortId: CinemaPortId,
): CinemaConnectionDefinition {
  return {
    id: stableId<CinemaConnectionId>(value, 'connection'),
    from: { nodeId: fromNode.id, portId: fromPortId },
    to: { nodeId: toNode.id, portId: toPortId },
    enabled: true,
  }
}

function composition(
  nodes: readonly CinemaNodeDefinition[],
  connections: readonly CinemaConnectionDefinition[],
  outputNodeId: CinemaNodeId,
  overrides: Partial<CinemaCompositionDefinition> = {},
): CinemaCompositionDefinition {
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: stableId<CinemaCompositionId>('stage-2-composition', 'composition'),
    revision: 1,
    metadata: { name: 'Stage 2 Graph Fixture' },
    nodes,
    connections,
    outputNodeId,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
    ...overrides,
  }
}

const colorOut = port('color-out', 'output')
const colorIn = port('color-in', 'input', 'color-texture', { required: true })
const sourceEntry = entry('world.nebula', 'procedural', [], [colorOut])
const outputEntry = entry('output.main', 'output', [colorIn], [])

describe('Cinema node definition registry', () => {
  it('registers built-in and adapter metadata without runtime objects', () => {
    const adapter = entry('adapter.shader-pad', 'shader', [], [colorOut], { sourceKind: 'adapter' })
    const result = createCinemaNodeDefinitionRegistry([sourceEntry, outputEntry, adapter])

    expect(result.diagnostics).toEqual([])
    expect(result.registry.size).toBe(3)
    expect(result.registry.get(adapter.definition.typeId)?.source.kind).toBe('adapter')
    expect(JSON.stringify(result.registry.list())).not.toMatch(/WebGLRenderingContext|HTMLCanvasElement|requestAnimationFrame/)
  })

  it('rejects duplicate and incompatible node type registrations deterministically', () => {
    const exact = structuredClone(sourceEntry)
    const incompatible = {
      ...structuredClone(sourceEntry),
      definition: { ...structuredClone(sourceEntry.definition), label: 'Different Definition' },
    }

    const duplicate = createCinemaNodeDefinitionRegistry([exact, sourceEntry])
    const reversedDuplicate = createCinemaNodeDefinitionRegistry([sourceEntry, exact])
    const conflict = createCinemaNodeDefinitionRegistry([sourceEntry, incompatible])

    expect(duplicate.registry.size).toBe(0)
    expect(duplicate.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['CINEMA_NODE_REGISTRY_DUPLICATE'])
    expect(reversedDuplicate.diagnostics).toEqual(duplicate.diagnostics)
    expect(conflict.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['CINEMA_NODE_REGISTRY_INCOMPATIBLE'])
  })

  it('rejects runtime objects and cyclic registry metadata without throwing', () => {
    const runtimeEntry = {
      ...structuredClone(sourceEntry),
      rendererInstance: () => undefined,
    } as unknown as CinemaNodeRegistryEntry
    const cyclicEntry = structuredClone(sourceEntry) as CinemaNodeRegistryEntry & { cycle?: unknown }
    cyclicEntry.cycle = cyclicEntry

    expect(() => createCinemaNodeDefinitionRegistry([runtimeEntry, cyclicEntry])).not.toThrow()
    const runtimeResult = createCinemaNodeDefinitionRegistry([runtimeEntry])
    const cyclicResult = createCinemaNodeDefinitionRegistry([cyclicEntry])

    expect(runtimeResult.registry.size).toBe(0)
    expect(runtimeResult.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_NODE_REGISTRY_INVALID')
    expect(cyclicResult.registry.size).toBe(0)
    expect(cyclicResult.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_NODE_REGISTRY_INVALID')
  })

  it('keeps spread-cloned definitions runnable when inherited capability metadata no longer matches replaced parameters', () => {
    const inheritedCapability = {
      ...structuredClone(sourceEntry),
      definition: {
        ...structuredClone(sourceEntry.definition),
        parameterCapabilities: [{
          parameterId: stableId<CinemaParameterId>('inherited-removed-parameter', 'parameter'),
          support: 'live' as const,
        }],
      },
    }

    const result = createCinemaNodeDefinitionRegistry([inheritedCapability])

    expect(result.registry.size).toBe(1)
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      code: 'CINEMA_NODE_REGISTRY_INVALID',
      severity: 'warning',
    })
    expect(getCinemaSupportedParameterSchemas(result.registry.get(inheritedCapability.definition.typeId)!.definition)).toEqual([])
  })

  it('rejects feedback and quality declarations that contradict the node definition', () => {
    const invalid = {
      ...structuredClone(sourceEntry),
      feedback: {
        inputPortId: stableId<CinemaPortId>('missing-write', 'port'),
        outputPortId: colorOut.id,
        historyFrames: 0,
      },
      quality: {
        ...sourceEntry.quality,
        maximumEstimatedPassCount: 0,
      },
    }
    const result = createCinemaNodeDefinitionRegistry([invalid])

    expect(result.registry.size).toBe(0)
    expect(result.diagnostics).toHaveLength(2)
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toEqual(expect.arrayContaining([
      'CINEMA_FEEDBACK_CONTRACT_INVALID',
      'CINEMA_QUALITY_DECLARATION_INVALID',
    ]))
  })
})

describe('Cinema graph validation and compilation', () => {
  it('compiles World → Output through the public Cinema package entry point', () => {
    const world = node('world', sourceEntry)
    const output = node('output', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([sourceEntry, outputEntry]).registry
    const graph = composition([
      output,
      world,
    ], [connection('world-output', world, colorOut.id, output, colorIn.id)], output.id)

    const result = compileCinemaCompositionGraph(graph, registry)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.nodeOrder).toEqual([world.id, output.id])
    expect(result.plan.phases).toEqual([
      { index: 0, nodeIds: [world.id] },
      { index: 1, nodeIds: [output.id] },
    ])
    expect(result.plan.output).toEqual({ nodeId: output.id, descriptor: CINEMA_SAFE_OUTPUT_DESCRIPTOR })
  })

  it('compiles multi-source mixer and effect graphs identically regardless of array order', () => {
    const inputA = port('input-a', 'input', 'color-texture', { required: true })
    const inputB = port('input-b', 'input', 'color-texture', { required: true })
    const mixerEntry = entry('mixer.layer', 'mixer', [inputB, inputA], [colorOut])
    const effectEntry = entry('effect.bloom', 'effect', [colorIn], [colorOut])
    const sourceA = node('source-a', sourceEntry)
    const sourceB = node('source-b', sourceEntry)
    const mixer = node('mixer', mixerEntry)
    const effect = node('effect', effectEntry)
    const output = node('output', outputEntry)
    const edges = [
      connection('source-b-mixer', sourceB, colorOut.id, mixer, inputB.id),
      connection('effect-output', effect, colorOut.id, output, colorIn.id),
      connection('source-a-mixer', sourceA, colorOut.id, mixer, inputA.id),
      connection('mixer-effect', mixer, colorOut.id, effect, colorIn.id),
    ]
    const registry = createCinemaNodeDefinitionRegistry([outputEntry, effectEntry, sourceEntry, mixerEntry]).registry
    const first = compileCinemaCompositionGraph(composition(
      [output, sourceB, mixer, effect, sourceA],
      edges,
      output.id,
    ), registry)
    const second = compileCinemaCompositionGraph(composition(
      [sourceA, effect, mixer, sourceB, output],
      [...edges].reverse(),
      output.id,
    ), registry)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.plan).toEqual(first.plan)
    expect(first.plan.phases.map(phase => phase.nodeIds)).toEqual([
      [sourceA.id, sourceB.id],
      [mixer.id],
      [effect.id],
      [output.id],
    ])
  })

  it('compiles typed mask bindings', () => {
    const maskOut = port('mask-out', 'output', 'mask-texture')
    const maskIn = port('mask-in', 'input', 'mask-texture', { required: true })
    const maskEntry = entry('procedural.mask', 'procedural', [], [maskOut])
    const mixerEntry = entry('mixer.masked', 'mixer', [colorIn, maskIn], [colorOut])
    const world = node('world', sourceEntry)
    const mask = node('mask', maskEntry)
    const mixer = node('mixer', mixerEntry)
    const output = node('output', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([sourceEntry, maskEntry, mixerEntry, outputEntry]).registry
    const result = compileCinemaCompositionGraph(composition([world, mask, mixer, output], [
      connection('world-mixer', world, colorOut.id, mixer, colorIn.id),
      connection('mask-mixer', mask, maskOut.id, mixer, maskIn.id),
      connection('mixer-output', mixer, colorOut.id, output, colorIn.id),
    ], output.id), registry)

    expect(result.ok).toBe(true)
  })

  it('rejects a direct cycle', () => {
    const effectEntry = entry('effect.loop', 'effect', [colorIn], [colorOut])
    const first = node('effect-a', effectEntry)
    const second = node('effect-b', effectEntry)
    const output = node('output', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([effectEntry, outputEntry]).registry
    const result = compileCinemaCompositionGraph(composition([first, second, output], [
      connection('a-b', first, colorOut.id, second, colorIn.id),
      connection('b-a', second, colorOut.id, first, colorIn.id),
      connection('b-output', second, colorOut.id, output, colorIn.id),
    ], output.id), registry)

    expect(result.ok).toBe(false)
    expect(result.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_GRAPH_CYCLE')
  })

  it('accepts a cycle only when it crosses an explicit feedback write boundary', () => {
    const writePort = port('history-write', 'input', 'color-texture', { required: true })
    const historyPort = port('history-read', 'output')
    const feedbackEntry = entry('control.feedback', 'control', [writePort], [historyPort], {
      feedback: { inputPortId: writePort.id, outputPortId: historyPort.id, historyFrames: 1 },
    })
    const effectEntry = entry('effect.feedback-color', 'effect', [colorIn], [colorOut])
    const feedback = node('feedback', feedbackEntry)
    const effect = node('effect', effectEntry)
    const output = node('output', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([feedbackEntry, effectEntry, outputEntry]).registry
    const result = compileCinemaCompositionGraph(composition([output, effect, feedback], [
      connection('feedback-effect', feedback, historyPort.id, effect, colorIn.id),
      connection('effect-feedback', effect, colorOut.id, feedback, writePort.id),
      connection('effect-output', effect, colorOut.id, output, colorIn.id),
    ], output.id), registry)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.phases.map(phase => phase.nodeIds)).toEqual([
      [feedback.id],
      [effect.id],
      [output.id],
    ])
    expect(result.plan.feedbackEdges).toEqual([{
      connectionId: stableId<CinemaConnectionId>('effect-feedback', 'connection'),
      feedbackNodeId: feedback.id,
      inputPortId: writePort.id,
      outputPortId: historyPort.id,
      sourceNodeId: effect.id,
      sourcePortId: colorOut.id,
      historyFrames: 1,
    }])
    expect(result.plan.resourceLifetimeHints.find(hint => hint.nodeId === feedback.id)?.retainAcrossFrames).toBe(true)
  })

  it('isolates missing plugin, asset, parameter, port, and unreachable-node failures', () => {
    const strengthId = stableId<CinemaParameterId>('strength', 'parameter')
    const unknownParameterId = stableId<CinemaParameterId>('unknown', 'parameter')
    const missingPluginEntry = entry('world.missing-plugin', 'procedural', [], [colorOut], {
      pluginAvailable: false,
      parameters: [{ id: strengthId, label: 'Strength', type: 'float', default: 1, min: 0, max: 1 }],
    })
    const world = {
      ...node('world', missingPluginEntry, { [unknownParameterId]: 1 }),
      assetBindingIds: [stableId<CinemaAssetBindingId>('missing-binding', 'asset binding')],
    }
    const disconnected = node('disconnected', sourceEntry)
    const output = node('output', outputEntry)
    const missingPortId = stableId<CinemaPortId>('missing-port', 'port')
    const missingAssetId = stableId<CinemaAssetId>('missing-asset', 'asset')
    const registry = createCinemaNodeDefinitionRegistry([missingPluginEntry, sourceEntry, outputEntry]).registry
    const graph = composition([world, disconnected, output], [
      connection('world-output', world, missingPortId, output, colorIn.id),
    ], output.id, {
      assetBindings: [{
        id: stableId<CinemaAssetBindingId>('available-binding', 'asset binding'),
        assetId: missingAssetId,
        role: 'image',
        fit: 'contain',
        preserveOriginalColors: true,
        opacity: 1,
        blendMode: 'normal',
      }],
    })
    const validation = validateCinemaCompositionGraph(graph, registry, { availableAssetIds: [] })
    const codes = validation.diagnostics.diagnostics.map(diagnostic => diagnostic.code)

    expect(validation.valid).toBe(false)
    expect(codes).toEqual(expect.arrayContaining([
      'CINEMA_PLUGIN_UNAVAILABLE',
      'CINEMA_ASSET_MISSING',
      'CINEMA_ASSET_BINDING_MISSING',
      'CINEMA_PARAMETER_MISSING',
      'CINEMA_PORT_MISSING',
      'CINEMA_REQUIRED_INPUT_MISSING',
      'CINEMA_NODE_UNREACHABLE',
    ]))
  })

  it('reports type mismatches, one-port cardinality, missing required inputs, and multiple outputs', () => {
    const scalarOut = port('scalar-out', 'output', 'scalar')
    const scalarEntry = entry('control.scalar', 'control', [], [scalarOut])
    const sourceA = node('source-a', sourceEntry)
    const sourceB = node('source-b', sourceEntry)
    const scalar = node('scalar', scalarEntry)
    const outputA = node('output-a', outputEntry)
    const outputB = node('output-b', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([sourceEntry, scalarEntry, outputEntry]).registry
    const result = compileCinemaCompositionGraph(composition([sourceA, sourceB, scalar, outputA, outputB], [
      connection('source-a-output', sourceA, colorOut.id, outputA, colorIn.id),
      connection('source-b-output', sourceB, colorOut.id, outputA, colorIn.id),
      connection('scalar-output-b', scalar, scalarOut.id, outputB, colorIn.id),
    ], outputA.id), registry)
    const codes = result.diagnostics.diagnostics.map(diagnostic => diagnostic.code)

    expect(result.ok).toBe(false)
    expect(codes).toEqual(expect.arrayContaining([
      'CINEMA_OUTPUT_MULTIPLE',
      'CINEMA_PORT_CARDINALITY_EXCEEDED',
      'CINEMA_PORT_TYPE_MISMATCH',
      'CINEMA_REQUIRED_INPUT_MISSING',
    ]))
  })

  it('rejects unknown schema versions, malformed graph records, and hostile objects safely', () => {
    const world = node('world', sourceEntry)
    const output = node('output', outputEntry)
    const registry = createCinemaNodeDefinitionRegistry([sourceEntry, outputEntry]).registry
    const valid = composition([world, output], [
      connection('world-output', world, colorOut.id, output, colorIn.id),
    ], output.id)
    const future = { ...valid, schemaVersion: 99 } as unknown as CinemaCompositionDefinition
    const malformed = { ...valid, nodes: [{ enabled: true }] } as unknown as CinemaCompositionDefinition
    const hostile = new Proxy({}, { get: () => { throw new Error('hostile composition') } })

    const futureResult = compileCinemaCompositionGraph(future, registry)
    const malformedResult = compileCinemaCompositionGraph(malformed, registry)
    const hostileValidation = validateCinemaCompositionGraph(hostile, registry)

    expect(futureResult.ok).toBe(false)
    expect(futureResult.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_SCHEMA_VERSION_UNSUPPORTED')
    expect(malformedResult.ok).toBe(false)
    expect(malformedResult.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_SCHEMA_INVALID')
    expect(hostileValidation.valid).toBe(false)
    expect(hostileValidation.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toContain('CINEMA_VALIDATION_FAILED')
  })

  it('returns bounded structured diagnostics and safe output for malformed input instead of throwing', () => {
    const registry = createCinemaNodeDefinitionRegistry([]).registry

    expect(() => compileCinemaCompositionGraph(null, registry)).not.toThrow()
    expect(compileCinemaCompositionGraph(null, registry)).toMatchObject({
      ok: false,
      plan: null,
      safeOutput: CINEMA_SAFE_OUTPUT_DESCRIPTOR,
      diagnostics: {
        counts: { error: 1 },
      },
    })
  })
})
