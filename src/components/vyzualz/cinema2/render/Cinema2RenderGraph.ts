import {
  CINEMA2_CAPABILITY_IDS,
  cinema2StableId,
  isCinema2StableId,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterConditionManifest,
  type Cinema2RenderAttachment,
  type Cinema2RenderPassId,
  type Cinema2RenderPassKind,
  type Cinema2RenderQualityGateManifest,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  validateCinema2RenderTargetDescriptor,
  type Cinema2RenderTargetDescriptor,
  type Cinema2RenderTargetOwnershipClass,
} from '../contracts/Cinema2RenderTargets'

export const CINEMA2_RENDER_GRAPH_PLAN_VERSION = 1 as const

export type Cinema2CompiledRenderIntent = 'safe-clear' | 'scene-output' | 'authored-render-graph'

export interface Cinema2CompiledEntityHandle<Id extends string> {
  id: Id
  index: number
}

export interface Cinema2CompiledRenderTargetHandle extends Cinema2CompiledEntityHandle<Cinema2RenderTargetId> {
  descriptor: Readonly<Cinema2RenderTargetDescriptor>
  ownership: Cinema2RenderTargetOwnershipClass
}

export interface Cinema2CompiledRenderInput {
  id: Cinema2RenderSlotId
  sourcePass: Readonly<Cinema2CompiledEntityHandle<Cinema2RenderPassId>>
  sourceOutputId: Cinema2RenderSlotId
  attachment: Cinema2RenderAttachment
  optional: boolean
}

export interface Cinema2CompiledRenderOutput {
  id: Cinema2RenderSlotId
  attachment: Cinema2RenderAttachment
  target: Readonly<Cinema2CompiledRenderTargetHandle> | null
}

export interface Cinema2CompiledRenderPass {
  id: Cinema2RenderPassId
  index: number
  kind: Cinema2RenderPassKind
  dependencyIds: readonly Cinema2RenderPassId[]
  inputs: readonly Readonly<Cinema2CompiledRenderInput>[]
  outputs: readonly Readonly<Cinema2CompiledRenderOutput>[]
  module: Readonly<Cinema2CompiledEntityHandle<Cinema2ModuleId>> | null
  sceneNode: Readonly<Cinema2CompiledEntityHandle<Cinema2SceneNodeId>> | null
  layers: readonly Readonly<Cinema2CompiledEntityHandle<Cinema2LayerId>>[]
  effect: Readonly<Cinema2CompiledEntityHandle<Cinema2EffectId>> | null
  enabledWhen: readonly Readonly<Cinema2ParameterConditionManifest>[]
  quality: Readonly<Cinema2RenderQualityGateManifest> | null
}

export interface Cinema2CompiledRenderPlan {
  version: typeof CINEMA2_RENDER_GRAPH_PLAN_VERSION
  intent: Cinema2CompiledRenderIntent
  synthesized: boolean
  passes: readonly Readonly<Cinema2CompiledRenderPass>[]
  passOrder: readonly Cinema2RenderPassId[]
  outputPassId: Cinema2RenderPassId
  targets: readonly Readonly<Cinema2CompiledRenderTargetHandle>[]
}

export interface Cinema2RenderGraphDiagnostic {
  code: string
  message: string
  path: string
}

export type Cinema2RenderGraphCompilationResult =
  | { ok: true; plan: Readonly<Cinema2CompiledRenderPlan>; diagnostics: readonly [] }
  | { ok: false; plan: null; diagnostics: readonly Cinema2RenderGraphDiagnostic[] }

interface IndexedPass {
  pass: NonNullable<Cinema2NativePresetManifest['render']>['passes'][number]
  index: number
}

interface CompiledIndexes {
  modules: ReadonlyMap<Cinema2ModuleId, number>
  sceneNodes: ReadonlyMap<Cinema2SceneNodeId, number>
  layers: ReadonlyMap<Cinema2LayerId, number>
  effects: ReadonlyMap<Cinema2EffectId, number>
  parameters: ReadonlySet<string>
}

const PASS_KINDS = new Set<Cinema2RenderPassKind>(['module', 'scene', 'fullscreen', 'composite', 'output'])
const ATTACHMENTS = new Set<Cinema2RenderAttachment>(['color', 'depth'])
const QUALITY_ORDER = Object.freeze({ low: 0, medium: 1, high: 2 } as const)
const CAPABILITIES = new Set<string>(CINEMA2_CAPABILITY_IDS)
const SYNTHETIC_SAFE_CLEAR_ID = cinema2StableId<Cinema2RenderPassId>('auto-safe-clear')
const SYNTHETIC_SCENE_OUTPUT_ID = cinema2StableId<Cinema2RenderPassId>('auto-scene-output')

/**
 * Pure render-graph compiler. It validates authored frame-production topology
 * and produces immutable handles/order only. No WebGL work or resource leases
 * are created here.
 */
export function compileCinema2RenderGraph(manifest: Cinema2NativePresetManifest): Cinema2RenderGraphCompilationResult {
  const authoredRender = manifest.render
  if (authoredRender == null) return synthesizeTrivialPlan(manifest)
  const diagnostics: Cinema2RenderGraphDiagnostic[] = []
  if (!Array.isArray(authoredRender.passes)) {
    diagnostics.push(error('CINEMA2_RENDER_PASSES_INVALID', 'Render graph passes must be an array.', '$.render.passes'))
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }
  if (authoredRender.targets != null && !Array.isArray(authoredRender.targets)) {
    diagnostics.push(error('CINEMA2_RENDER_TARGETS_INVALID', 'Render graph targets must be an array when present.', '$.render.targets'))
  }
  const passes = authoredRender.passes
  if (passes.length === 0 && diagnostics.length === 0) return synthesizeTrivialPlan(manifest)
  if (diagnostics.length > 0) return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }

  const indexes = buildEntityIndexes(manifest)
  const targets = compileTargets(manifest, diagnostics)
  const targetById = new Map(targets.map(target => [target.id, target] as const))
  const passById = new Map<Cinema2RenderPassId, IndexedPass>()

  for (const [index, pass] of passes.entries()) {
    const path = `$.render.passes[${index}]`
    if (!isPlainObject(pass)) {
      diagnostics.push(error('CINEMA2_RENDER_PASS_INVALID', 'Render pass must be an object.', path))
      continue
    }
    if (!isCinema2StableId(pass.id)) {
      diagnostics.push(error('CINEMA2_RENDER_PASS_ID_INVALID', 'Render pass id must be a stable ID.', `${path}.id`))
      continue
    }
    const passId = pass.id as Cinema2RenderPassId
    if (passById.has(passId)) {
      diagnostics.push(error('CINEMA2_RENDER_PASS_ID_DUPLICATE', `Duplicate render pass id "${pass.id}".`, `${path}.id`))
      continue
    }
    passById.set(passId, { pass: pass as unknown as IndexedPass['pass'], index })
  }

  const outputByPassAndId = new Map<string, { attachment: Cinema2RenderAttachment; target: Readonly<Cinema2CompiledRenderTargetHandle> | null }>()
  for (const [passId, indexed] of passById) {
    validatePassShape(indexed.pass, indexed.index, indexes, diagnostics)
    const ids = new Set<Cinema2RenderSlotId>()
    for (const [outputIndex, output] of readArray(indexed.pass.outputs).entries()) {
      const path = `$.render.passes[${indexed.index}].outputs[${outputIndex}]`
      if (!isPlainObject(output) || !isCinema2StableId(output.id)) {
        diagnostics.push(error('CINEMA2_RENDER_OUTPUT_ID_INVALID', 'Render output id must be a stable ID.', `${path}.id`))
        continue
      }
      if (ids.has(output.id)) {
        diagnostics.push(error('CINEMA2_RENDER_OUTPUT_ID_DUPLICATE', `Duplicate render output id "${output.id}" in pass "${passId}".`, `${path}.id`))
        continue
      }
      ids.add(output.id)
      const attachment = normalizeAttachment(output.attachment, `${path}.attachment`, diagnostics)
      const target = resolveTarget(output.target, targetById, `${path}.target`, diagnostics)
      if (attachment === 'depth' && !target) {
        diagnostics.push(error('CINEMA2_RENDER_ATTACHMENT_TARGET_REQUIRED', `Depth output "${output.id}" requires a render target with a depth attachment.`, `${path}.target`))
      } else if (attachment === 'depth' && target && (target.descriptor.depthFormat ?? 'none') === 'none') {
        diagnostics.push(error('CINEMA2_RENDER_ATTACHMENT_UNAVAILABLE', `Depth output "${output.id}" targets "${target.id}", which has no depth attachment.`, `${path}.attachment`))
      }
      outputByPassAndId.set(outputKey(passId, output.id), { attachment, target })
    }
  }

  const dependencies = new Map<Cinema2RenderPassId, Set<Cinema2RenderPassId>>()
  const dependents = new Map<Cinema2RenderPassId, Set<Cinema2RenderPassId>>()
  for (const id of passById.keys()) {
    dependencies.set(id, new Set())
    dependents.set(id, new Set())
  }

  for (const [passId, indexed] of passById) {
    const base = `$.render.passes[${indexed.index}]`
    for (const [depIndex, ref] of readArray(indexed.pass.dependsOn).entries()) {
      const dependency = readRef(ref, `${base}.dependsOn[${depIndex}]`, 'render pass', diagnostics)
      if (!dependency) continue
      if (!passById.has(dependency as Cinema2RenderPassId)) {
        diagnostics.push(error('CINEMA2_RENDER_DEPENDENCY_MISSING', `Unknown render pass dependency "${dependency}".`, `${base}.dependsOn[${depIndex}]`))
        continue
      }
      addDependency(passId, dependency as Cinema2RenderPassId, dependencies, dependents)
    }

    const inputIds = new Set<Cinema2RenderSlotId>()
    for (const [inputIndex, input] of readArray(indexed.pass.inputs).entries()) {
      const path = `${base}.inputs[${inputIndex}]`
      if (!isPlainObject(input) || !isCinema2StableId(input.id)) {
        diagnostics.push(error('CINEMA2_RENDER_INPUT_ID_INVALID', 'Render input id must be a stable ID.', `${path}.id`))
        continue
      }
      if (inputIds.has(input.id)) {
        diagnostics.push(error('CINEMA2_RENDER_INPUT_ID_DUPLICATE', `Duplicate render input id "${input.id}" in pass "${passId}".`, `${path}.id`))
        continue
      }
      inputIds.add(input.id)
      if (!isPlainObject(input.source)) {
        diagnostics.push(error('CINEMA2_RENDER_INPUT_SOURCE_INVALID', 'Render input requires a source object.', `${path}.source`))
        continue
      }
      const sourcePassId = readRef(input.source.pass, `${path}.source.pass`, 'render pass', diagnostics)
      if (!sourcePassId || !passById.has(sourcePassId as Cinema2RenderPassId)) {
        if (sourcePassId) diagnostics.push(error('CINEMA2_RENDER_INPUT_SOURCE_MISSING', `Unknown render input source pass "${sourcePassId}".`, `${path}.source.pass`))
        continue
      }
      if (!isCinema2StableId(input.source.output)) {
        diagnostics.push(error('CINEMA2_RENDER_INPUT_OUTPUT_INVALID', 'Render input source output must be a stable ID.', `${path}.source.output`))
        continue
      }
      const sourceOutput = outputByPassAndId.get(outputKey(sourcePassId as Cinema2RenderPassId, input.source.output))
      if (!sourceOutput) {
        diagnostics.push(error('CINEMA2_RENDER_INPUT_OUTPUT_MISSING', `Render pass "${sourcePassId}" does not declare output "${input.source.output}".`, `${path}.source.output`))
        continue
      }
      const requestedAttachment = input.attachment == null
        ? sourceOutput.attachment
        : normalizeAttachment(input.attachment, `${path}.attachment`, diagnostics)
      if (requestedAttachment !== sourceOutput.attachment) {
        diagnostics.push(error('CINEMA2_RENDER_ATTACHMENT_MISMATCH', `Input attachment "${requestedAttachment}" does not match source output attachment "${sourceOutput.attachment}".`, `${path}.attachment`))
      }
      addDependency(passId, sourcePassId as Cinema2RenderPassId, dependencies, dependents)
    }
  }

  const order = topologicalOrder(passById, dependencies, dependents)
  if (order.length !== passById.size) {
    diagnostics.push(error('CINEMA2_RENDER_GRAPH_CYCLE', 'Render pass dependency graph contains a cycle.', '$.render.passes'))
  }

  const outputPassId = resolveOutputPassId(manifest, passById, diagnostics)
  if (diagnostics.length > 0 || outputPassId == null) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }

  const orderIndex = new Map(order.map((id, index) => [id, index] as const))
  const compiledPasses = order.map(id => {
    const indexed = passById.get(id)!
    const pass = indexed.pass
    const base = `$.render.passes[${indexed.index}]`
    const inputs: Cinema2CompiledRenderInput[] = []
    for (const [inputIndex, input] of readArray(pass.inputs).entries()) {
      if (!isPlainObject(input) || !isCinema2StableId(input.id) || !isPlainObject(input.source) || !isCinema2StableId(input.source.output)) continue
      const sourcePassId = readValidRef(input.source.pass)
      if (!sourcePassId || !passById.has(sourcePassId as Cinema2RenderPassId)) continue
      const sourceOutput = outputByPassAndId.get(outputKey(sourcePassId as Cinema2RenderPassId, input.source.output))
      if (!sourceOutput) continue
      inputs.push(deepFreeze({
        id: input.id,
        sourcePass: { id: sourcePassId as Cinema2RenderPassId, index: orderIndex.get(sourcePassId as Cinema2RenderPassId) ?? -1 },
        sourceOutputId: input.source.output,
        attachment: input.attachment == null ? sourceOutput.attachment : normalizeAttachmentWithoutDiagnostics(input.attachment),
        optional: input.optional === true,
      }))
    }
    const outputs: Cinema2CompiledRenderOutput[] = []
    for (const output of readArray(pass.outputs)) {
      if (!isPlainObject(output) || !isCinema2StableId(output.id)) continue
      const compiled = outputByPassAndId.get(outputKey(id, output.id))
      if (!compiled) continue
      outputs.push(deepFreeze({ id: output.id, attachment: compiled.attachment, target: compiled.target }))
    }
    return deepFreeze({
      id,
      index: orderIndex.get(id) ?? -1,
      kind: pass.kind,
      dependencyIds: Object.freeze([...(dependencies.get(id) ?? [])].sort(compareStrings)),
      inputs: Object.freeze(inputs),
      outputs: Object.freeze(outputs),
      module: resolveHandle(pass.module, indexes.modules),
      sceneNode: resolveHandle(pass.scene, indexes.sceneNodes),
      layers: Object.freeze(readArray(pass.layers).map(ref => resolveHandle(ref, indexes.layers)).filter(isPresent)),
      effect: resolveHandle(pass.effect, indexes.effects),
      enabledWhen: Object.freeze(readArray(pass.enabledWhen).map(condition => deepFreeze(cloneSerializable(condition)))),
      quality: pass.quality == null ? null : deepFreeze(cloneSerializable(pass.quality)),
    } satisfies Cinema2CompiledRenderPass)
  })

  const plan = deepFreeze({
    version: CINEMA2_RENDER_GRAPH_PLAN_VERSION,
    intent: 'authored-render-graph' as const,
    synthesized: false,
    passes: Object.freeze(compiledPasses),
    passOrder: Object.freeze(order),
    outputPassId,
    targets: Object.freeze(targets),
  } satisfies Cinema2CompiledRenderPlan)
  return { ok: true, plan, diagnostics: [] }
}

function synthesizeTrivialPlan(manifest: Cinema2NativePresetManifest): Cinema2RenderGraphCompilationResult {
  const layers = readArray(manifest.layers).filter(layer => isPlainObject(layer) && isCinema2StableId(layer.id))
  const layerIds = layers.map(layer => layer.id as Cinema2LayerId)
  const sceneNodes = readArray(manifest.scene?.nodes).filter(node => isPlainObject(node) && isCinema2StableId(node.id))
  const modules = readArray(manifest.modules).filter(module => isPlainObject(module) && isCinema2StableId(module.id))
  const hasVisualIntent = sceneNodes.length > 0 || layerIds.length > 0 || modules.length > 0
  const id = hasVisualIntent ? SYNTHETIC_SCENE_OUTPUT_ID : SYNTHETIC_SAFE_CLEAR_ID
  const layerIndexes = new Map(layers.map((layer, index) => [layer.id as Cinema2LayerId, index] as const))
  const sceneNodeIndexes = new Map(sceneNodes.map((node, index) => [node.id, index] as const))
  const moduleIndexes = new Map(modules.map((module, index) => [module.id, index] as const))
  const firstSceneNode = sceneNodes[0]
  const firstModule = modules.find(module => module.enabled !== false) ?? modules[0]
  const kind: Cinema2RenderPassKind = sceneNodes.length > 0 || layerIds.length > 0 ? 'scene' : modules.length > 0 ? 'module' : 'output'
  const pass = deepFreeze({
    id,
    index: 0,
    kind,
    dependencyIds: Object.freeze([]),
    inputs: Object.freeze([]),
    outputs: Object.freeze([]),
    module: kind === 'module' && firstModule ? deepFreeze({ id: firstModule.id, index: moduleIndexes.get(firstModule.id) ?? -1 }) : null,
    sceneNode: kind === 'scene' && layerIds.length === 0 && firstSceneNode ? deepFreeze({ id: firstSceneNode.id, index: sceneNodeIndexes.get(firstSceneNode.id) ?? -1 }) : null,
    layers: Object.freeze(layerIds.map(layerId => deepFreeze({ id: layerId, index: layerIndexes.get(layerId) ?? -1 }))),
    effect: null,
    enabledWhen: Object.freeze([]),
    quality: null,
  } satisfies Cinema2CompiledRenderPass)
  const plan = deepFreeze({
    version: CINEMA2_RENDER_GRAPH_PLAN_VERSION,
    intent: hasVisualIntent ? 'scene-output' as const : 'safe-clear' as const,
    synthesized: true,
    passes: Object.freeze([pass]),
    passOrder: Object.freeze([id]),
    outputPassId: id,
    targets: Object.freeze([]),
  } satisfies Cinema2CompiledRenderPlan)
  return { ok: true, plan, diagnostics: [] }
}

function buildEntityIndexes(manifest: Cinema2NativePresetManifest): CompiledIndexes {
  return {
    modules: indexIds(manifest.modules),
    sceneNodes: indexIds(manifest.scene?.nodes),
    layers: indexIds(manifest.layers),
    effects: indexIds(manifest.effects),
    parameters: new Set(readArray(manifest.parameters).filter(parameter => isPlainObject(parameter) && isCinema2StableId(parameter.id)).map(parameter => parameter.id)),
  }
}

function compileTargets(
  manifest: Cinema2NativePresetManifest,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): readonly Readonly<Cinema2CompiledRenderTargetHandle>[] {
  const compiled: Cinema2CompiledRenderTargetHandle[] = []
  const ids = new Set<Cinema2RenderTargetId>()
  for (const [index, target] of readArray(manifest.render?.targets).entries()) {
    const path = `$.render.targets[${index}]`
    if (!isPlainObject(target) || !isCinema2StableId(target.id)) {
      diagnostics.push(error('CINEMA2_RENDER_TARGET_ID_INVALID', 'Render target id must be a stable ID.', `${path}.id`))
      continue
    }
    if (ids.has(target.id)) {
      diagnostics.push(error('CINEMA2_RENDER_TARGET_ID_DUPLICATE', `Duplicate render target id "${target.id}".`, `${path}.id`))
      continue
    }
    ids.add(target.id)
    const descriptorDiagnostics = validateCinema2RenderTargetDescriptor(target.descriptor, `${path}.descriptor`)
    diagnostics.push(...descriptorDiagnostics)
    if (target.ownership != null && target.ownership !== 'transient' && target.ownership !== 'persistent') {
      diagnostics.push(error('CINEMA2_RENDER_TARGET_OWNERSHIP_INVALID', `Unsupported render target ownership "${String(target.ownership)}".`, `${path}.ownership`))
    }
    if (descriptorDiagnostics.length > 0) continue
    compiled.push(deepFreeze({
      id: target.id,
      index,
      descriptor: cloneSerializable(target.descriptor),
      ownership: target.ownership === 'persistent' ? 'persistent' : 'transient',
    }))
  }
  return Object.freeze(compiled)
}

function validatePassShape(
  pass: NonNullable<Cinema2NativePresetManifest['render']>['passes'][number],
  index: number,
  indexes: CompiledIndexes,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): void {
  const base = `$.render.passes[${index}]`
  if (!PASS_KINDS.has(pass.kind)) diagnostics.push(error('CINEMA2_RENDER_PASS_KIND_INVALID', `Unsupported render pass kind "${String(pass.kind)}".`, `${base}.kind`))
  if (pass.inputs != null && !Array.isArray(pass.inputs)) diagnostics.push(error('CINEMA2_RENDER_INPUTS_INVALID', 'Render pass inputs must be an array when present.', `${base}.inputs`))
  if (pass.outputs != null && !Array.isArray(pass.outputs)) diagnostics.push(error('CINEMA2_RENDER_OUTPUTS_INVALID', 'Render pass outputs must be an array when present.', `${base}.outputs`))
  if (pass.dependsOn != null && !Array.isArray(pass.dependsOn)) diagnostics.push(error('CINEMA2_RENDER_DEPENDENCIES_INVALID', 'Render pass dependsOn must be an array when present.', `${base}.dependsOn`))
  if (pass.layers != null && !Array.isArray(pass.layers)) diagnostics.push(error('CINEMA2_RENDER_LAYERS_INVALID', 'Render pass layers must be an array when present.', `${base}.layers`))
  if (pass.enabledWhen != null && !Array.isArray(pass.enabledWhen)) diagnostics.push(error('CINEMA2_RENDER_CONDITIONS_INVALID', 'Render pass enabledWhen must be an array when present.', `${base}.enabledWhen`))

  if (pass.kind === 'module' && pass.module == null) diagnostics.push(error('CINEMA2_RENDER_MODULE_REQUIRED', 'A module render pass must reference a module.', `${base}.module`))
  if (pass.kind === 'scene' && pass.scene == null && readArray(pass.layers).length === 0) diagnostics.push(error('CINEMA2_RENDER_SCENE_SOURCE_REQUIRED', 'A scene render pass must reference a scene node or at least one layer.', base))
  if (pass.kind === 'fullscreen' && pass.module == null && pass.effect == null) diagnostics.push(error('CINEMA2_RENDER_FULLSCREEN_SOURCE_REQUIRED', 'A fullscreen render pass must reference a module or effect.', base))
  if (pass.kind === 'composite' && readArray(pass.inputs).length === 0) diagnostics.push(error('CINEMA2_RENDER_INPUT_REQUIRED', 'A composite render pass requires at least one input.', `${base}.inputs`))
  if (pass.effect != null && pass.kind !== 'fullscreen') diagnostics.push(error('CINEMA2_RENDER_EFFECT_PASS_INVALID', 'Effect references are only valid on fullscreen passes.', `${base}.effect`))
  if (pass.effect != null && readArray(pass.inputs).filter(input => isPlainObject(input) && (input.attachment ?? 'color') === 'color').length !== 1) {
    diagnostics.push(error('CINEMA2_RENDER_EFFECT_INPUT_INVALID', 'Effect fullscreen passes require exactly one color input.', `${base}.inputs`))
  }

  validateEntityRef(pass.module, indexes.modules, `${base}.module`, 'module', diagnostics)
  validateEntityRef(pass.scene, indexes.sceneNodes, `${base}.scene`, 'scene node', diagnostics)
  validateEntityRef(pass.effect, indexes.effects, `${base}.effect`, 'effect', diagnostics)
  for (const [layerIndex, ref] of readArray(pass.layers).entries()) validateEntityRef(ref, indexes.layers, `${base}.layers[${layerIndex}]`, 'layer', diagnostics)

  for (const [conditionIndex, condition] of readArray(pass.enabledWhen).entries()) {
    validateCondition(condition, indexes, `${base}.enabledWhen[${conditionIndex}]`, diagnostics)
  }
  validateQuality(pass.quality, `${base}.quality`, diagnostics)

}

function validateCondition(
  condition: unknown,
  indexes: CompiledIndexes,
  path: string,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): void {
  if (!isPlainObject(condition)) {
    diagnostics.push(error('CINEMA2_RENDER_CONDITION_INVALID', 'Render pass condition must be an object.', path))
    return
  }
  if (condition.kind === 'parameter-equals' || condition.kind === 'parameter-not-equals') {
    if (!isCinema2StableId(condition.parameterId) || !indexes.parameters.has(condition.parameterId)) {
      diagnostics.push(error('CINEMA2_RENDER_CONDITION_PARAMETER_MISSING', `Unknown render condition parameter "${String(condition.parameterId)}".`, `${path}.parameterId`))
    }
    return
  }
  if (condition.kind === 'capability-available') {
    if (!CAPABILITIES.has(String(condition.capability))) diagnostics.push(error('CINEMA2_RENDER_CONDITION_CAPABILITY_INVALID', `Unsupported render condition capability "${String(condition.capability)}".`, `${path}.capability`))
    return
  }
  diagnostics.push(error('CINEMA2_RENDER_CONDITION_INVALID', `Unsupported render condition kind "${String(condition.kind)}".`, `${path}.kind`))
}

function validateQuality(value: unknown, path: string, diagnostics: Cinema2RenderGraphDiagnostic[]): void {
  if (value == null) return
  if (!isPlainObject(value)) {
    diagnostics.push(error('CINEMA2_RENDER_QUALITY_INVALID', 'Render quality gate must be an object.', path))
    return
  }
  const min = value.min
  const max = value.max
  if (min != null && !(min in QUALITY_ORDER)) diagnostics.push(error('CINEMA2_RENDER_QUALITY_INVALID', `Unsupported minimum quality "${String(min)}".`, `${path}.min`))
  if (max != null && !(max in QUALITY_ORDER)) diagnostics.push(error('CINEMA2_RENDER_QUALITY_INVALID', `Unsupported maximum quality "${String(max)}".`, `${path}.max`))
  if (typeof min === 'string' && typeof max === 'string' && min in QUALITY_ORDER && max in QUALITY_ORDER && QUALITY_ORDER[min as keyof typeof QUALITY_ORDER] > QUALITY_ORDER[max as keyof typeof QUALITY_ORDER]) {
    diagnostics.push(error('CINEMA2_RENDER_QUALITY_RANGE_INVALID', 'Render quality minimum cannot exceed the maximum.', path))
  }
}

function resolveOutputPassId(
  manifest: Cinema2NativePresetManifest,
  passes: ReadonlyMap<Cinema2RenderPassId, IndexedPass>,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): Cinema2RenderPassId | null {
  const explicitRenderOutput = manifest.render?.outputPass
  const explicitPresetOutput = manifest.output?.renderPass
  if (explicitRenderOutput != null || explicitPresetOutput != null) {
    const source = explicitRenderOutput != null ? explicitRenderOutput : explicitPresetOutput
    const path = explicitRenderOutput != null ? '$.render.outputPass' : '$.output.renderPass'
    const authored = readValidRef(source)
    if (!authored) {
      diagnostics.push(error('CINEMA2_RENDER_OUTPUT_PASS_INVALID', 'Output render pass must contain a stable $ref ID.', path))
      return null
    }
    if (!passes.has(authored as Cinema2RenderPassId)) {
      diagnostics.push(error('CINEMA2_RENDER_OUTPUT_PASS_MISSING', `Unknown output render pass "${authored}".`, path))
      return null
    }
    return authored as Cinema2RenderPassId
  }
  const outputPasses = [...passes].filter(([, value]) => value.pass.kind === 'output').map(([id]) => id).sort(compareStrings)
  if (outputPasses.length === 1) return outputPasses[0]
  if (passes.size === 1) return [...passes.keys()][0]
  if (outputPasses.length > 1) diagnostics.push(error('CINEMA2_RENDER_OUTPUT_PASS_AMBIGUOUS', 'Multiple output passes exist; author render.outputPass explicitly.', '$.render.outputPass'))
  else diagnostics.push(error('CINEMA2_RENDER_OUTPUT_PASS_REQUIRED', 'Authored render graph requires a deterministic output pass.', '$.render.outputPass'))
  return null
}

function topologicalOrder(
  passes: ReadonlyMap<Cinema2RenderPassId, IndexedPass>,
  dependencies: ReadonlyMap<Cinema2RenderPassId, Set<Cinema2RenderPassId>>,
  dependents: ReadonlyMap<Cinema2RenderPassId, Set<Cinema2RenderPassId>>,
): Cinema2RenderPassId[] {
  const remaining = new Map<Cinema2RenderPassId, Set<Cinema2RenderPassId>>()
  for (const [id, deps] of dependencies) remaining.set(id, new Set(deps))
  const ready = [...passes.keys()].filter(id => (remaining.get(id)?.size ?? 0) === 0).sort(compareStrings)
  const order: Cinema2RenderPassId[] = []
  while (ready.length > 0) {
    const id = ready.shift()!
    order.push(id)
    for (const dependent of [...(dependents.get(id) ?? [])].sort(compareStrings)) {
      const deps = remaining.get(dependent)
      deps?.delete(id)
      if (deps?.size === 0 && !order.includes(dependent) && !ready.includes(dependent)) {
        ready.push(dependent)
        ready.sort(compareStrings)
      }
    }
  }
  return order
}

function addDependency(
  passId: Cinema2RenderPassId,
  dependencyId: Cinema2RenderPassId,
  dependencies: Map<Cinema2RenderPassId, Set<Cinema2RenderPassId>>,
  dependents: Map<Cinema2RenderPassId, Set<Cinema2RenderPassId>>,
): void {
  dependencies.get(passId)?.add(dependencyId)
  dependents.get(dependencyId)?.add(passId)
}

function resolveTarget(
  value: unknown,
  targets: ReadonlyMap<Cinema2RenderTargetId, Readonly<Cinema2CompiledRenderTargetHandle>>,
  path: string,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): Readonly<Cinema2CompiledRenderTargetHandle> | null {
  if (value == null) return null
  const id = readRef(value, path, 'render target', diagnostics)
  if (!id) return null
  const target = targets.get(id as Cinema2RenderTargetId)
  if (!target) diagnostics.push(error('CINEMA2_RENDER_TARGET_MISSING', `Unknown render target "${id}".`, path))
  return target ?? null
}

function resolveHandle<Id extends string>(value: unknown, index: ReadonlyMap<Id, number>): Readonly<Cinema2CompiledEntityHandle<Id>> | null {
  const id = readValidRef(value)
  if (!id || !index.has(id as Id)) return null
  return deepFreeze({ id: id as Id, index: index.get(id as Id)! })
}

function validateEntityRef<Id extends string>(
  value: unknown,
  index: ReadonlyMap<Id, number>,
  path: string,
  label: string,
  diagnostics: Cinema2RenderGraphDiagnostic[],
): void {
  if (value == null) return
  const id = readRef(value, path, label, diagnostics)
  if (id && !index.has(id as Id)) diagnostics.push(error('CINEMA2_RENDER_REFERENCE_MISSING', `Unknown ${label} reference "${id}".`, path))
}

function readRef(value: unknown, path: string, label: string, diagnostics: Cinema2RenderGraphDiagnostic[]): string | null {
  const id = readValidRef(value)
  if (!id) diagnostics.push(error('CINEMA2_RENDER_REFERENCE_INVALID', `${label} reference must contain a stable $ref ID.`, path))
  return id
}

function readValidRef(value: unknown): string | null {
  return isPlainObject(value) && isCinema2StableId(value.$ref) ? value.$ref : null
}

function normalizeAttachment(value: unknown, path: string, diagnostics: Cinema2RenderGraphDiagnostic[]): Cinema2RenderAttachment {
  if (value == null) return 'color'
  if (ATTACHMENTS.has(value as Cinema2RenderAttachment)) return value as Cinema2RenderAttachment
  diagnostics.push(error('CINEMA2_RENDER_ATTACHMENT_INVALID', `Unsupported render attachment "${String(value)}".`, path))
  return 'color'
}

function normalizeAttachmentWithoutDiagnostics(value: unknown): Cinema2RenderAttachment {
  return ATTACHMENTS.has(value as Cinema2RenderAttachment) ? value as Cinema2RenderAttachment : 'color'
}

function outputKey(passId: Cinema2RenderPassId, outputId: Cinema2RenderSlotId): string {
  return `${passId}\u0000${outputId}`
}

function indexIds<T extends { id: Id }, Id extends string>(values: readonly T[] | undefined): ReadonlyMap<Id, number> {
  const map = new Map<Id, number>()
  for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
    if (isPlainObject(value) && isCinema2StableId(value.id) && !map.has(value.id as unknown as Id)) map.set(value.id as unknown as Id, index)
  }
  return map
}

function readArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : []
}

function isPresent<T>(value: T | null): value is T {
  return value != null
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function cloneSerializable<T>(value: T): T {
  if (Array.isArray(value)) return value.map(entry => cloneSerializable(entry)) as T
  if (isPlainObject(value)) {
    const clone: Record<string, unknown> = {}
    for (const key of Object.keys(value)) clone[key] = cloneSerializable(value[key])
    return clone as T
  }
  return value
}

function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return value
}

function error(code: string, message: string, path: string): Cinema2RenderGraphDiagnostic {
  return { code, message, path }
}

function freezeDiagnostics(diagnostics: readonly Cinema2RenderGraphDiagnostic[]): readonly Cinema2RenderGraphDiagnostic[] {
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze({ ...diagnostic })))
}
