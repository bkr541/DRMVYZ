import {
  CINEMA2_CAPABILITY_IDS,
  validateCinema2NativePresetManifestIdentity,
  isCinema2StableId,
  type Cinema2CameraId,
  type Cinema2CapabilityId,
  type Cinema2CapabilityRequirement,
  type Cinema2ChoreographySignal,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2SceneNodeId,
  type Cinema2VariationId,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_COMPILED_PRESET_PLAN_VERSION = 1 as const

export type Cinema2PresetDiagnosticSeverity = 'warning' | 'error'

export interface Cinema2PresetDiagnostic {
  code: string
  severity: Cinema2PresetDiagnosticSeverity
  message: string
  path: string
}

export interface Cinema2PresetCompileOptions {
  /**
   * Omit when service/hardware availability is intentionally unresolved.
   * Supplying an iterable makes required capabilities a compile boundary and
   * records unavailable optional capabilities without fabricating substitutes.
   */
  availableCapabilities?: Iterable<Cinema2CapabilityId>
}

export interface Cinema2CompiledCapabilityPlan {
  required: readonly Cinema2CapabilityId[]
  optional: readonly Cinema2CapabilityId[]
  available: readonly Cinema2CapabilityId[]
  unavailableOptional: readonly Cinema2CapabilityId[]
  availabilityResolved: boolean
}

export type Cinema2CompiledRenderIntent = 'safe-clear' | 'scene-output' | 'authored-render-graph'

export interface Cinema2CompiledRenderPlan {
  intent: Cinema2CompiledRenderIntent
  synthesized: boolean
  passOrder: readonly Cinema2RenderPassId[]
  outputPassId: Cinema2RenderPassId | null
}

export interface Cinema2CompiledScenePlan {
  rootNodeIds: readonly Cinema2SceneNodeId[]
  nodeIds: readonly Cinema2SceneNodeId[]
  layerOrder: readonly Cinema2LayerId[]
}

export interface Cinema2CompiledPresetPlan {
  version: typeof CINEMA2_COMPILED_PRESET_PLAN_VERSION
  presetId: Cinema2PresetId
  revision: number
  manifest: Readonly<Cinema2NativePresetManifest>
  capabilities: Readonly<Cinema2CompiledCapabilityPlan>
  scene: Readonly<Cinema2CompiledScenePlan>
  render: Readonly<Cinema2CompiledRenderPlan>
}

export type Cinema2PresetCompilationResult =
  | {
      ok: true
      plan: Readonly<Cinema2CompiledPresetPlan>
      diagnostics: readonly Cinema2PresetDiagnostic[]
    }
  | {
      ok: false
      plan: null
      diagnostics: readonly Cinema2PresetDiagnostic[]
    }

interface IdCollection<T extends string = string> {
  readonly ids: Set<string>
  readonly values: readonly T[]
}

interface ManifestIndex {
  parameters: IdCollection<Cinema2ParameterId>
  mediaSlots: IdCollection<Cinema2MediaSlotId>
  modules: IdCollection<Cinema2ModuleId>
  sceneNodes: IdCollection<Cinema2SceneNodeId>
  layers: IdCollection<Cinema2LayerId>
  cameras: IdCollection<Cinema2CameraId>
  lights: IdCollection<Cinema2LightId>
  renderPasses: IdCollection<Cinema2RenderPassId>
  effects: IdCollection<Cinema2EffectId>
  variations: IdCollection<Cinema2VariationId>
}

const CAPABILITY_IDS = new Set<string>(CINEMA2_CAPABILITY_IDS)

const SIGNAL_CAPABILITY: Partial<Record<Cinema2ChoreographySignal, Cinema2CapabilityId>> = {
  beat: 'music.beat',
  downbeat: 'music.downbeat',
  bar: 'music.bar',
  phrase: 'music.phrase',
  'section-change': 'music.section',
  build: 'music.build',
  drop: 'music.drop',
  'vocal-presence': 'music.vocal-presence',
}

/**
 * Pure Cinema 2.0 compiler. It owns authored-contract validation and immutable
 * planning only; it allocates no WebGL, media, history, listener, RAF or
 * simulation resources.
 */
export function compileCinema2NativePreset(
  value: unknown,
  options: Cinema2PresetCompileOptions = {},
): Cinema2PresetCompilationResult {
  const diagnostics: Cinema2PresetDiagnostic[] = []
  const identity = validateCinema2NativePresetManifestIdentity(value)
  if (!identity.ok) {
    return {
      ok: false,
      plan: null,
      diagnostics: identity.diagnostics.map(diagnostic => ({
        ...diagnostic,
        severity: 'error' as const,
      })),
    }
  }

  const manifest = identity.manifest
  validateOptionalContainers(manifest, diagnostics)
  const index = buildManifestIndex(manifest, diagnostics)
  validateCapabilities(manifest, options, diagnostics)
  validateReferencesAndCombinations(manifest, index, diagnostics)
  validateSceneParentCycles(manifest, index, diagnostics)

  if (hasErrors(diagnostics)) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }

  const renderPlan = compileRenderPlan(manifest, index, diagnostics)
  if (hasErrors(diagnostics)) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }

  const clonedManifest = deepFreeze(cloneSerializable(manifest)) as Readonly<Cinema2NativePresetManifest>
  const plan = deepFreeze({
    version: CINEMA2_COMPILED_PRESET_PLAN_VERSION,
    presetId: clonedManifest.id,
    revision: clonedManifest.revision,
    manifest: clonedManifest,
    capabilities: compileCapabilityPlan(clonedManifest, options),
    scene: compileScenePlan(clonedManifest),
    render: renderPlan,
  }) as Readonly<Cinema2CompiledPresetPlan>

  return {
    ok: true,
    plan,
    diagnostics: freezeDiagnostics(diagnostics),
  }
}


function validateOptionalContainers(
  manifest: Cinema2NativePresetManifest,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  const arrays: Array<[unknown, string]> = [
    [manifest.capabilities, '$.capabilities'],
    [manifest.parameters, '$.parameters'],
    [manifest.mediaSlots, '$.mediaSlots'],
    [manifest.modules, '$.modules'],
    [manifest.layers, '$.layers'],
    [manifest.cameras, '$.cameras'],
    [manifest.effects, '$.effects'],
    [manifest.variations, '$.variations'],
  ]
  for (const [value, path] of arrays) {
    if (value != null && !Array.isArray(value)) {
      diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', `${path} must be an array when present.`, path))
    }
  }

  const objects: Array<[unknown, string]> = [
    [manifest.scene, '$.scene'],
    [manifest.lighting, '$.lighting'],
    [manifest.environment, '$.environment'],
    [manifest.render, '$.render'],
    [manifest.choreography, '$.choreography'],
    [manifest.defaults, '$.defaults'],
    [manifest.output, '$.output'],
  ]
  for (const [value, path] of objects) {
    if (value != null && !isPlainObject(value)) {
      diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', `${path} must be an object when present.`, path))
    }
  }

  if (isPlainObject(manifest.scene) && !Array.isArray(manifest.scene.nodes)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', '$.scene.nodes must be an array.', '$.scene.nodes'))
  }
  if (isPlainObject(manifest.scene) && manifest.scene.roots != null && !Array.isArray(manifest.scene.roots)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', '$.scene.roots must be an array when present.', '$.scene.roots'))
  }
  if (isPlainObject(manifest.lighting) && !Array.isArray(manifest.lighting.lights)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', '$.lighting.lights must be an array.', '$.lighting.lights'))
  }
  if (isPlainObject(manifest.render) && !Array.isArray(manifest.render.passes)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', '$.render.passes must be an array.', '$.render.passes'))
  }
  if (isPlainObject(manifest.choreography) && !Array.isArray(manifest.choreography.rules)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', '$.choreography.rules must be an array.', '$.choreography.rules'))
  }
}

function buildManifestIndex(
  manifest: Cinema2NativePresetManifest,
  diagnostics: Cinema2PresetDiagnostic[],
): ManifestIndex {
  const parameters = collectIds(manifest.parameters, '$.parameters', diagnostics)
  const mediaSlots = collectIds(manifest.mediaSlots, '$.mediaSlots', diagnostics)
  const modules = collectIds(manifest.modules, '$.modules', diagnostics)
  const sceneNodes = collectIds(manifest.scene?.nodes, '$.scene.nodes', diagnostics)
  const layers = collectIds(manifest.layers, '$.layers', diagnostics)
  const cameras = collectIds(manifest.cameras, '$.cameras', diagnostics)
  const lights = collectIds(manifest.lighting?.lights, '$.lighting.lights', diagnostics)
  const renderPasses = collectIds(manifest.render?.passes, '$.render.passes', diagnostics)
  const effects = collectIds(manifest.effects, '$.effects', diagnostics)
  const variations = collectIds(manifest.variations, '$.variations', diagnostics)

  if (manifest.choreography != null) {
    collectIds(manifest.choreography.rules, '$.choreography.rules', diagnostics)
    const actionIds = new Set<string>()
    for (const [ruleIndex, rule] of readArray(manifest.choreography.rules, '$.choreography.rules', diagnostics).entries()) {
      for (const [actionIndex, action] of readArray(rule.actions, `$.choreography.rules[${ruleIndex}].actions`, diagnostics).entries()) {
        validateAndAddId(action?.id, `$.choreography.rules[${ruleIndex}].actions[${actionIndex}].id`, actionIds, diagnostics)
      }
    }
  }

  return { parameters, mediaSlots, modules, sceneNodes, layers, cameras, lights, renderPasses, effects, variations }
}

function collectIds<T extends { id: string }>(
  value: readonly T[] | undefined,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): IdCollection<T['id']> {
  const ids = new Set<string>()
  const values: T['id'][] = []
  for (const [index, entry] of readArray(value, path, diagnostics).entries()) {
    const id = entry?.id
    if (validateAndAddId(id, `${path}[${index}].id`, ids, diagnostics)) values.push(id)
  }
  return { ids, values }
}

function validateAndAddId(
  id: unknown,
  path: string,
  ids: Set<string>,
  diagnostics: Cinema2PresetDiagnostic[],
): id is string {
  if (!isCinema2StableId(id)) {
    diagnostics.push(error(
      'CINEMA2_PRESET_ID_INVALID',
      'Cinema 2.0 authored object IDs must be lowercase stable IDs.',
      path,
    ))
    return false
  }
  if (ids.has(id)) {
    diagnostics.push(error(
      'CINEMA2_PRESET_DUPLICATE_ID',
      `Duplicate Cinema 2.0 authored ID "${id}".`,
      path,
    ))
    return false
  }
  ids.add(id)
  return true
}

function validateCapabilities(
  manifest: Cinema2NativePresetManifest,
  options: Cinema2PresetCompileOptions,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  const groups: Array<{ path: string; values: readonly Cinema2CapabilityRequirement[] | undefined }> = [
    { path: '$.capabilities', values: manifest.capabilities },
  ]
  for (const [index, module] of readArray(manifest.modules, '$.modules', diagnostics).entries()) {
    groups.push({ path: `$.modules[${index}].capabilities`, values: module.capabilities })
  }

  for (const group of groups) {
    const seen = new Set<string>()
    for (const [index, capability] of readArray(group.values, group.path, diagnostics).entries()) {
      const path = `${group.path}[${index}]`
      if (!isPlainObject(capability)) {
        diagnostics.push(error('CINEMA2_PRESET_CAPABILITY_INVALID', 'Capability requirement must be an object.', path))
        continue
      }
      if (!CAPABILITY_IDS.has(String(capability.id))) {
        diagnostics.push(error(
          'CINEMA2_PRESET_CAPABILITY_UNSUPPORTED',
          `Unsupported Cinema 2.0 capability "${String(capability.id)}".`,
          `${path}.id`,
        ))
        continue
      }
      if (capability.requirement !== 'required' && capability.requirement !== 'optional') {
        diagnostics.push(error(
          'CINEMA2_PRESET_CAPABILITY_REQUIREMENT_INVALID',
          'Capability requirement must be "required" or "optional".',
          `${path}.requirement`,
        ))
      }
      if (seen.has(capability.id as string)) {
        diagnostics.push(error(
          'CINEMA2_PRESET_CAPABILITY_DUPLICATE',
          `Capability "${String(capability.id)}" is declared more than once in the same capability list.`,
          `${path}.id`,
        ))
      }
      seen.add(capability.id as string)
    }
  }

  if (options.availableCapabilities == null) return
  const available = new Set<string>(options.availableCapabilities)
  for (const capability of collectCapabilityRequirements(manifest)) {
    if (available.has(capability.id)) continue
    if (capability.requirement === 'required') {
      diagnostics.push(error(
        'CINEMA2_PRESET_REQUIRED_CAPABILITY_UNAVAILABLE',
        `Required Cinema 2.0 capability "${capability.id}" is unavailable at this activation boundary.`,
        capability.path,
      ))
    } else {
      diagnostics.push(warning(
        'CINEMA2_PRESET_OPTIONAL_CAPABILITY_UNAVAILABLE',
        `Optional Cinema 2.0 capability "${capability.id}" is unavailable and will remain explicitly unavailable.`,
        capability.path,
      ))
    }
  }
}

function collectCapabilityRequirements(
  manifest: Cinema2NativePresetManifest,
): Array<Cinema2CapabilityRequirement & { path: string }> {
  const values: Array<Cinema2CapabilityRequirement & { path: string }> = []
  if (Array.isArray(manifest.capabilities)) {
    for (const [index, capability] of manifest.capabilities.entries()) {
      if (isPlainObject(capability)) values.push({ ...(capability as unknown as Cinema2CapabilityRequirement), path: `$.capabilities[${index}]` })
    }
  }
  if (Array.isArray(manifest.modules)) {
    for (const [moduleIndex, module] of manifest.modules.entries()) {
      if (!isPlainObject(module) || !Array.isArray(module.capabilities)) continue
      for (const [capabilityIndex, capability] of module.capabilities.entries()) {
        if (isPlainObject(capability)) values.push({ ...(capability as unknown as Cinema2CapabilityRequirement), path: `$.modules[${moduleIndex}].capabilities[${capabilityIndex}]` })
      }
    }
  }
  return values
}

function compileCapabilityPlan(
  manifest: Cinema2NativePresetManifest,
  options: Cinema2PresetCompileOptions,
): Cinema2CompiledCapabilityPlan {
  const strongest = new Map<Cinema2CapabilityId, 'required' | 'optional'>()
  for (const capability of collectCapabilityRequirements(manifest)) {
    if (!CAPABILITY_IDS.has(capability.id)) continue
    const previous = strongest.get(capability.id)
    if (previous !== 'required') strongest.set(capability.id, capability.requirement)
  }
  const required = [...strongest.entries()]
    .filter(([, requirement]) => requirement === 'required')
    .map(([id]) => id)
    .sort(compareStrings)
  const optional = [...strongest.entries()]
    .filter(([, requirement]) => requirement === 'optional')
    .map(([id]) => id)
    .sort(compareStrings)
  const resolved = options.availableCapabilities != null
  const availableSet = new Set<Cinema2CapabilityId>(options.availableCapabilities ?? [])
  return {
    required,
    optional,
    available: resolved ? [...availableSet].sort(compareStrings) : [],
    unavailableOptional: resolved ? optional.filter(id => !availableSet.has(id)) : [],
    availabilityResolved: resolved,
  }
}

function validateReferencesAndCombinations(
  manifest: Cinema2NativePresetManifest,
  index: ManifestIndex,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  const parameterTypes = new Set(['float', 'integer', 'boolean', 'enum', 'color', 'vec2', 'vec3', 'text'])
  for (const [parameterIndex, parameter] of readArray(manifest.parameters, '$.parameters', diagnostics).entries()) {
    const base = `$.parameters[${parameterIndex}]`
    if (!parameterTypes.has(String(parameter.type))) {
      diagnostics.push(error('CINEMA2_PRESET_PARAMETER_TYPE_INVALID', `Unsupported parameter type "${String(parameter.type)}".`, `${base}.type`))
    }
    if (parameter.type === 'enum') {
      if (!Array.isArray(parameter.options) || parameter.options.length === 0) {
        diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'Enum parameters must declare at least one option.', `${base}.options`))
      } else {
        const values = new Set<string>()
        for (const [optionIndex, option] of parameter.options.entries()) {
          if (!isPlainObject(option) || typeof option.value !== 'string' || typeof option.label !== 'string') {
            diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', 'Enum parameter options must contain string value and label fields.', `${base}.options[${optionIndex}]`))
            continue
          }
          if (values.has(option.value)) {
            diagnostics.push(error('CINEMA2_PRESET_DUPLICATE_ID', `Duplicate enum option value "${option.value}".`, `${base}.options[${optionIndex}].value`))
          }
          values.add(option.value)
        }
      }
    }
    if (typeof parameter.min === 'number' && typeof parameter.max === 'number' && parameter.min > parameter.max) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'Parameter min cannot exceed max.', base))
    }
  }

  const mediaKinds = new Set(['image', 'video', 'svg'])
  for (const [slotIndex, slot] of readArray(manifest.mediaSlots, '$.mediaSlots', diagnostics).entries()) {
    const base = `$.mediaSlots[${slotIndex}].accepts`
    if (!Array.isArray(slot.accepts) || slot.accepts.length === 0) {
      diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', 'Media slots must declare at least one accepted media kind.', base))
      continue
    }
    const seenKinds = new Set<string>()
    for (const [kindIndex, kind] of slot.accepts.entries()) {
      if (!mediaKinds.has(String(kind))) {
        diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported media kind "${String(kind)}".`, `${base}[${kindIndex}]`))
      }
      if (seenKinds.has(String(kind))) {
        diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Media kind "${String(kind)}" is declared more than once.`, `${base}[${kindIndex}]`))
      }
      seenKinds.add(String(kind))
    }
  }

  for (const [moduleIndex, module] of readArray(manifest.modules, '$.modules', diagnostics).entries()) {
    if (!isCinema2StableId(module.typeId)) {
      diagnostics.push(error('CINEMA2_PRESET_MODULE_TYPE_INVALID', 'Module typeId must be a stable ID.', `$.modules[${moduleIndex}].typeId`))
    }
    if (!Number.isInteger(module.version) || module.version < 1) {
      diagnostics.push(error('CINEMA2_PRESET_MODULE_VERSION_INVALID', 'Module version must be a positive integer.', `$.modules[${moduleIndex}].version`))
    }
    if (module.media != null) {
      if (!isPlainObject(module.media)) {
        diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', 'Module media bindings must be an object.', `$.modules[${moduleIndex}].media`))
      } else {
        for (const [key, ref] of Object.entries(module.media)) {
          validateRef(ref, index.mediaSlots.ids, `$.modules[${moduleIndex}].media.${key}`, 'media slot', diagnostics)
        }
      }
    }
  }

  for (const [nodeIndex, node] of readArray(manifest.scene?.nodes, '$.scene.nodes', diagnostics).entries()) {
    const base = `$.scene.nodes[${nodeIndex}]`
    if (node.parent != null) validateRef(node.parent, index.sceneNodes.ids, `${base}.parent`, 'scene node', diagnostics)
    if (node.module != null) validateRef(node.module, index.modules.ids, `${base}.module`, 'module', diagnostics)
    if (node.media != null) validateRef(node.media, index.mediaSlots.ids, `${base}.media`, 'media slot', diagnostics)

    if (node.kind === 'module') {
      if (node.module == null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A module scene node must reference a module.', `${base}.module`))
      if (node.media != null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A module scene node cannot also reference media.', `${base}.media`))
    } else if (node.kind === 'media') {
      if (node.media == null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A media scene node must reference a media slot.', `${base}.media`))
      if (node.module != null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A media scene node cannot also reference a module.', `${base}.module`))
    } else if (node.kind === 'group' || node.kind === 'primitive') {
      if (node.module != null || node.media != null) {
        diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `${node.kind} scene nodes cannot reference modules or media slots.`, base))
      }
    } else {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported scene node kind "${String(node.kind)}".`, `${base}.kind`))
    }
  }

  for (const [rootIndex, ref] of readArray(manifest.scene?.roots, '$.scene.roots', diagnostics).entries()) {
    validateRef(ref, index.sceneNodes.ids, `$.scene.roots[${rootIndex}]`, 'scene node', diagnostics)
  }

  for (const [layerIndex, layer] of readArray(manifest.layers, '$.layers', diagnostics).entries()) {
    validateRef(layer.source, index.sceneNodes.ids, `$.layers[${layerIndex}].source`, 'scene node', diagnostics)
  }

  for (const [cameraIndex, camera] of readArray(manifest.cameras, '$.cameras', diagnostics).entries()) {
    if (camera.projection !== 'perspective' && camera.projection !== 'orthographic') {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported camera projection "${String(camera.projection)}".`, `$.cameras[${cameraIndex}].projection`))
    }
  }

  for (const [passIndex, pass] of readArray(manifest.render?.passes, '$.render.passes', diagnostics).entries()) {
    const base = `$.render.passes[${passIndex}]`
    for (const [depIndex, ref] of readArray(pass.dependsOn, `${base}.dependsOn`, diagnostics).entries()) {
      validateRef(ref, index.renderPasses.ids, `${base}.dependsOn[${depIndex}]`, 'render pass', diagnostics)
    }
    if (pass.scene != null) validateRef(pass.scene, index.sceneNodes.ids, `${base}.scene`, 'scene node', diagnostics)
    for (const [layerIndex, ref] of readArray(pass.layers, `${base}.layers`, diagnostics).entries()) {
      validateRef(ref, index.layers.ids, `${base}.layers[${layerIndex}]`, 'layer', diagnostics)
    }
    if (pass.effect != null) validateRef(pass.effect, index.effects.ids, `${base}.effect`, 'effect', diagnostics)
    if (pass.kind === 'effect' && pass.effect == null) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'An effect render pass must reference an effect.', `${base}.effect`))
    }
    if (!['scene', 'effect', 'composite', 'output'].includes(String(pass.kind))) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported render pass kind "${String(pass.kind)}".`, `${base}.kind`))
    }
  }
  if (manifest.render?.outputPass != null) {
    validateRef(manifest.render.outputPass, index.renderPasses.ids, '$.render.outputPass', 'render pass', diagnostics)
  }

  const lightTypes = new Set(['ambient', 'directional', 'point', 'spot'])
  for (const [lightIndex, light] of readArray(manifest.lighting?.lights, '$.lighting.lights', diagnostics).entries()) {
    if (!lightTypes.has(String(light.type))) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported light type "${String(light.type)}".`, `$.lighting.lights[${lightIndex}].type`))
    }
  }

  for (const [effectIndex, effect] of readArray(manifest.effects, '$.effects', diagnostics).entries()) {
    if (!isCinema2StableId(effect.typeId)) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_TYPE_INVALID', 'Effect typeId must be a stable ID.', `$.effects[${effectIndex}].typeId`))
    }
    if (!Number.isInteger(effect.version) || effect.version < 1) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_VERSION_INVALID', 'Effect version must be a positive integer.', `$.effects[${effectIndex}].version`))
    }
  }

  for (const [ruleIndex, rule] of readArray(manifest.choreography?.rules, '$.choreography.rules', diagnostics).entries()) {
    const base = `$.choreography.rules[${ruleIndex}]`
    const expectedCapability = SIGNAL_CAPABILITY[rule.source?.signal]
    if (expectedCapability && rule.source?.capability !== expectedCapability) {
      diagnostics.push(error(
        'CINEMA2_PRESET_CAPABILITY_COMBINATION_INVALID',
        `Choreography signal "${String(rule.source?.signal)}" requires capability "${expectedCapability}", not "${String(rule.source?.capability)}".`,
        `${base}.source.capability`,
      ))
    } else if (!CAPABILITY_IDS.has(String(rule.source?.capability))) {
      diagnostics.push(error('CINEMA2_PRESET_CAPABILITY_UNSUPPORTED', `Unsupported choreography capability "${String(rule.source?.capability)}".`, `${base}.source.capability`))
    }

    for (const [actionIndex, action] of readArray(rule.actions, `${base}.actions`, diagnostics).entries()) {
      validateWritableTarget(action.target, index, `${base}.actions[${actionIndex}].target`, diagnostics)
    }
  }

  for (const [variationIndex, variation] of readArray(manifest.variations, '$.variations', diagnostics).entries()) {
    validateRecordKeys(variation.parameterValues, index.parameters.ids, `$.variations[${variationIndex}].parameterValues`, 'parameter', diagnostics)
    validateRecordKeys(variation.moduleOverrides, index.modules.ids, `$.variations[${variationIndex}].moduleOverrides`, 'module', diagnostics)
  }

  if (manifest.defaults != null) {
    if (manifest.defaults.variation != null) validateRef(manifest.defaults.variation, index.variations.ids, '$.defaults.variation', 'variation', diagnostics)
    if (manifest.defaults.camera != null) validateRef(manifest.defaults.camera, index.cameras.ids, '$.defaults.camera', 'camera', diagnostics)
    validateRecordKeys(manifest.defaults.parameterValues, index.parameters.ids, '$.defaults.parameterValues', 'parameter', diagnostics)
  }

  if (manifest.output?.renderPass != null) {
    validateRef(manifest.output.renderPass, index.renderPasses.ids, '$.output.renderPass', 'render pass', diagnostics)
  }
}

function validateWritableTarget(
  target: unknown,
  index: ManifestIndex,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  if (!isPlainObject(target)) {
    diagnostics.push(error('CINEMA2_PRESET_TARGET_INVALID', 'Choreography writable target must be an object.', path))
    return
  }
  switch (target.kind) {
    case 'parameter':
      validateRef(target.ref, index.parameters.ids, `${path}.ref`, 'parameter', diagnostics)
      break
    case 'module':
      validateRef(target.ref, index.modules.ids, `${path}.ref`, 'module', diagnostics)
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    case 'scene-node':
      validateRef(target.ref, index.sceneNodes.ids, `${path}.ref`, 'scene node', diagnostics)
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    case 'camera':
      validateRef(target.ref, index.cameras.ids, `${path}.ref`, 'camera', diagnostics)
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    case 'light':
      validateRef(target.ref, index.lights.ids, `${path}.ref`, 'light', diagnostics)
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    case 'effect':
      validateRef(target.ref, index.effects.ids, `${path}.ref`, 'effect', diagnostics)
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    default:
      diagnostics.push(error('CINEMA2_PRESET_TARGET_INVALID', `Unsupported writable target kind "${String(target.kind)}".`, `${path}.kind`))
  }
}

function validateTargetProperty(value: unknown, path: string, diagnostics: Cinema2PresetDiagnostic[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    diagnostics.push(error('CINEMA2_PRESET_TARGET_INVALID', 'Writable target property must be a non-empty string.', path))
  }
}

function validateRecordKeys(
  value: Readonly<Record<string, unknown>> | undefined,
  ids: Set<string>,
  path: string,
  label: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  if (value == null) return
  if (!isPlainObject(value)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', `${label} override values must be an object.`, path))
    return
  }
  for (const key of Object.keys(value)) {
    if (!ids.has(key)) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown ${label} reference "${key}".`, `${path}.${key}`))
    }
  }
}

function validateRef(
  value: unknown,
  ids: Set<string>,
  path: string,
  label: string,
  diagnostics: Cinema2PresetDiagnostic[],
): string | null {
  if (!isPlainObject(value) || !isCinema2StableId(value.$ref)) {
    diagnostics.push(error('CINEMA2_PRESET_REFERENCE_INVALID', `${label} reference must contain a stable $ref ID.`, path))
    return null
  }
  if (!ids.has(value.$ref)) {
    diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown ${label} reference "${value.$ref}".`, path))
    return null
  }
  return value.$ref
}

function validateSceneParentCycles(
  manifest: Cinema2NativePresetManifest,
  index: ManifestIndex,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  const parentById = new Map<string, string>()
  for (const node of readArray(manifest.scene?.nodes, '$.scene.nodes', diagnostics)) {
    const parentId = isPlainObject(node.parent) && typeof node.parent.$ref === 'string' ? node.parent.$ref : null
    if (index.sceneNodes.ids.has(node.id) && parentId && index.sceneNodes.ids.has(parentId)) parentById.set(node.id, parentId)
  }
  for (const nodeId of index.sceneNodes.ids) {
    const visited = new Set<string>()
    let current: string | undefined = nodeId
    while (current != null) {
      if (visited.has(current)) {
        diagnostics.push(error('CINEMA2_PRESET_SCENE_CYCLE', `Scene parent hierarchy contains a cycle involving "${current}".`, '$.scene.nodes'))
        return
      }
      visited.add(current)
      current = parentById.get(current)
    }
  }
}

function compileRenderPlan(
  manifest: Cinema2NativePresetManifest,
  index: ManifestIndex,
  diagnostics: Cinema2PresetDiagnostic[],
): Cinema2CompiledRenderPlan {
  const passes = manifest.render?.passes ?? []
  if (manifest.render == null || passes.length === 0) {
    const hasSceneIntent = (manifest.scene?.nodes.length ?? 0) > 0 || (manifest.layers?.length ?? 0) > 0
    return deepFreeze({
      intent: hasSceneIntent ? 'scene-output' : 'safe-clear',
      synthesized: true,
      passOrder: [],
      outputPassId: null,
    })
  }

  const byId = new Map<string, typeof passes[number]>()
  for (const pass of passes) {
    if (index.renderPasses.ids.has(pass.id)) byId.set(pass.id, pass)
  }

  const dependencies = new Map<string, Set<string>>()
  const dependents = new Map<string, Set<string>>()
  for (const id of index.renderPasses.ids) {
    dependencies.set(id, new Set())
    dependents.set(id, new Set())
  }
  for (const pass of passes) {
    if (!index.renderPasses.ids.has(pass.id)) continue
    for (const ref of pass.dependsOn ?? []) {
      const dependency = isPlainObject(ref) && typeof ref.$ref === 'string' ? ref.$ref : null
      if (!dependency || !index.renderPasses.ids.has(dependency)) continue
      dependencies.get(pass.id)?.add(dependency)
      dependents.get(dependency)?.add(pass.id)
    }
  }

  const ready = [...index.renderPasses.ids].filter(id => (dependencies.get(id)?.size ?? 0) === 0).sort(compareStrings)
  const order: Cinema2RenderPassId[] = []
  while (ready.length > 0) {
    const id = ready.shift() as Cinema2RenderPassId
    order.push(id)
    for (const dependent of [...(dependents.get(id) ?? [])].sort(compareStrings)) {
      dependencies.get(dependent)?.delete(id)
      if (dependencies.get(dependent)?.size === 0 && !order.includes(dependent as Cinema2RenderPassId) && !ready.includes(dependent)) {
        ready.push(dependent)
        ready.sort(compareStrings)
      }
    }
  }
  if (order.length !== index.renderPasses.ids.size) {
    diagnostics.push(error('CINEMA2_PRESET_RENDER_CYCLE', 'Render pass dependency graph contains a cycle.', '$.render.passes'))
  }

  let outputPassId: Cinema2RenderPassId | null = null
  const explicit = isPlainObject(manifest.render.outputPass) && typeof manifest.render.outputPass.$ref === 'string'
    ? manifest.render.outputPass.$ref
    : null
  if (explicit && index.renderPasses.ids.has(explicit)) {
    outputPassId = explicit as Cinema2RenderPassId
  } else if (manifest.output?.renderPass && isPlainObject(manifest.output.renderPass) && typeof manifest.output.renderPass.$ref === 'string' && index.renderPasses.ids.has(manifest.output.renderPass.$ref)) {
    outputPassId = manifest.output.renderPass.$ref as Cinema2RenderPassId
  } else {
    const authoredOutputs = passes.filter(pass => pass.kind === 'output' && index.renderPasses.ids.has(pass.id))
    if (authoredOutputs.length === 1) outputPassId = authoredOutputs[0].id
    else if (passes.length === 1 && index.renderPasses.ids.has(passes[0].id)) outputPassId = passes[0].id
    else if (authoredOutputs.length > 1) {
      diagnostics.push(error('CINEMA2_PRESET_RENDER_OUTPUT_AMBIGUOUS', 'Multiple output render passes exist; author render.outputPass explicitly.', '$.render.outputPass'))
    } else {
      diagnostics.push(error('CINEMA2_PRESET_RENDER_OUTPUT_MISSING', 'Authored render graph needs a deterministic output pass.', '$.render.outputPass'))
    }
  }

  return deepFreeze({
    intent: 'authored-render-graph' as const,
    synthesized: false,
    passOrder: order,
    outputPassId,
  })
}

function compileScenePlan(manifest: Readonly<Cinema2NativePresetManifest>): Cinema2CompiledScenePlan {
  const nodeIds = (manifest.scene?.nodes ?? []).map(node => node.id)
  const rootNodeIds = manifest.scene?.roots?.map(ref => ref.$ref)
    ?? (manifest.scene?.nodes ?? []).filter(node => node.parent == null).map(node => node.id)
  const layerOrder = [...(manifest.layers ?? [])]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || compareStrings(left.id, right.id))
    .map(layer => layer.id)
  return { rootNodeIds, nodeIds, layerOrder }
}

function readArray<T>(
  value: readonly T[] | undefined,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): readonly T[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', `${path} must be an array when present.`, path))
    return []
  }
  const entries: T[] = []
  for (const [index, entry] of value.entries()) {
    if (!isPlainObject(entry)) {
      diagnostics.push(error('CINEMA2_PRESET_SCHEMA_INVALID', `${path}[${index}] must be an object.`, `${path}[${index}]`))
      continue
    }
    entries.push(entry as T)
  }
  return entries
}

function error(code: string, message: string, path: string): Cinema2PresetDiagnostic {
  return { code, severity: 'error', message, path }
}

function warning(code: string, message: string, path: string): Cinema2PresetDiagnostic {
  return { code, severity: 'warning', message, path }
}

function hasErrors(diagnostics: readonly Cinema2PresetDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error')
}

function freezeDiagnostics(diagnostics: readonly Cinema2PresetDiagnostic[]): readonly Cinema2PresetDiagnostic[] {
  return deepFreeze(diagnostics.map(diagnostic => ({ ...diagnostic })))
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}
