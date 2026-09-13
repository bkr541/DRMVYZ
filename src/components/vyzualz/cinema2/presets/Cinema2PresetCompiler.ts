import {
  CINEMA2_CAPABILITY_IDS,
  validateCinema2NativePresetManifestIdentity,
  isCinema2StableId,
  type Cinema2CameraId,
  type Cinema2CapabilityId,
  type Cinema2CapabilityRequirement,
  type Cinema2ChoreographyActionManifest,
  type Cinema2ChoreographySignal,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2JsonValue,
  type Cinema2ParameterId,
  type Cinema2ParameterType,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2SceneNodeId,
  type Cinema2VariationId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  compileCinema2ParameterPlan,
  validateCinema2ParameterDefinitions,
  type Cinema2CompiledParameterPlan,
} from '../parameters/Cinema2ParameterSchema'
import {
  compileCinema2TargetPlan,
  type Cinema2CompiledTargetPlan,
} from '../parameters/Cinema2TargetRuntime'
import {
  compileCinema2SceneGraph,
  type Cinema2CompiledSceneGraph,
} from '../scene/Cinema2SceneGraph'
import {
  compileCinema2RenderGraph,
  type Cinema2CompiledRenderPlan,
} from '../render/Cinema2RenderGraph'

export type {
  Cinema2CompiledRenderIntent,
  Cinema2CompiledRenderPlan,
} from '../render/Cinema2RenderGraph'

export const CINEMA2_COMPILED_PRESET_PLAN_VERSION = 5 as const

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

/** Backward-facing name for the native Stage 05 compiled scene view. */
export type Cinema2CompiledScenePlan = Cinema2CompiledSceneGraph

export interface Cinema2CompiledPresetPlan {
  version: typeof CINEMA2_COMPILED_PRESET_PLAN_VERSION
  presetId: Cinema2PresetId
  revision: number
  manifest: Readonly<Cinema2NativePresetManifest>
  capabilities: Readonly<Cinema2CompiledCapabilityPlan>
  parameters: Readonly<Cinema2CompiledParameterPlan>
  targets: Readonly<Cinema2CompiledTargetPlan>
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
  kick: 'music.rhythm-events',
  snare: 'music.rhythm-events',
  transient: 'music.rhythm-events',
  bar: 'music.bar',
  phrase: 'music.phrase',
  'section-change': 'music.section',
  build: 'music.build',
  drop: 'music.drop',
  'vocal-presence': 'music.vocal-presence',
  'lyric-line': 'music.lyrics',
  'lyric-word': 'music.lyrics',
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
  // Capability inputs can be generators. Materialize once so validation, the
  // target registry and the compiled capability plan observe identical truth.
  const compileOptions: Cinema2PresetCompileOptions = options.availableCapabilities == null
    ? options
    : { ...options, availableCapabilities: Object.freeze([...options.availableCapabilities]) }
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
  validateCapabilities(manifest, compileOptions, diagnostics)
  diagnostics.push(...validateCinema2ParameterDefinitions(manifest).map(diagnostic => ({ ...diagnostic, severity: 'error' as const })))
  validateReferencesAndCombinations(manifest, index, diagnostics)
  const sceneCompilation = compileCinema2SceneGraph(manifest)
  diagnostics.push(...sceneCompilation.diagnostics.map(diagnostic => ({ ...diagnostic, severity: 'error' as const })))
  const renderCompilation = compileCinema2RenderGraph(manifest)
  diagnostics.push(...renderCompilation.diagnostics.map(diagnostic => ({ ...diagnostic, severity: 'error' as const })))

  if (hasErrors(diagnostics) || !sceneCompilation.ok || !renderCompilation.ok) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }

  const clonedManifest = deepFreeze(cloneSerializable(manifest)) as Readonly<Cinema2NativePresetManifest>
  const parameterPlan = compileCinema2ParameterPlan(clonedManifest)
  const targetCompilation = compileCinema2TargetPlan(clonedManifest, parameterPlan, {
    availableCapabilities: compileOptions.availableCapabilities,
  })
  diagnostics.push(...targetCompilation.diagnostics.map(diagnostic => ({ ...diagnostic, severity: 'error' as const })))
  if (hasErrors(diagnostics)) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }
  const plan = deepFreeze({
    version: CINEMA2_COMPILED_PRESET_PLAN_VERSION,
    presetId: clonedManifest.id,
    revision: clonedManifest.revision,
    manifest: clonedManifest,
    capabilities: compileCapabilityPlan(clonedManifest, compileOptions),
    parameters: parameterPlan,
    targets: targetCompilation.plan,
    scene: sceneCompilation.plan,
    render: renderCompilation.plan,
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
  for (const [index, parameter] of readArray(manifest.parameters, '$.parameters', diagnostics).entries()) {
    groups.push({ path: `$.parameters[${index}].capabilities`, values: parameter.capabilities })
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
  if (Array.isArray(manifest.parameters)) {
    for (const [parameterIndex, parameter] of manifest.parameters.entries()) {
      if (!isPlainObject(parameter) || !Array.isArray(parameter.capabilities)) continue
      for (const [capabilityIndex, capability] of parameter.capabilities.entries()) {
        if (isPlainObject(capability)) values.push({ ...(capability as unknown as Cinema2CapabilityRequirement), path: `$.parameters[${parameterIndex}].capabilities[${capabilityIndex}]` })
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
  // Parameter definitions/defaults are validated by the Cinema 2.0 parameter schema boundary.

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

  for (const [cameraIndex, camera] of readArray(manifest.cameras, '$.cameras', diagnostics).entries()) {
    if (camera.projection !== 'perspective' && camera.projection !== 'orthographic') {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported camera projection "${String(camera.projection)}".`, `$.cameras[${cameraIndex}].projection`))
    }
  }


  const lightTypes = new Set(['ambient', 'directional', 'point', 'spot'])
  for (const [lightIndex, light] of readArray(manifest.lighting?.lights, '$.lighting.lights', diagnostics).entries()) {
    if (!lightTypes.has(String(light.type))) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported light type "${String(light.type)}".`, `$.lighting.lights[${lightIndex}].type`))
    }
  }

  for (const [effectIndex, effect] of readArray(manifest.effects, '$.effects', diagnostics).entries()) {
    const base = `$.effects[${effectIndex}]`
    if (!isCinema2StableId(effect.typeId)) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_TYPE_INVALID', 'Effect typeId must be a stable ID.', `${base}.typeId`))
    }
    if (!Number.isInteger(effect.version) || effect.version < 1) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_VERSION_INVALID', 'Effect version must be a positive integer.', `${base}.version`))
    }
    if (effect.order != null && (!Number.isInteger(effect.order) || effect.order < 0)) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_ORDER_INVALID', 'Effect order must be a non-negative integer.', `${base}.order`))
    }
    if (effect.scope != null && effect.scope !== 'output' && effect.scope !== 'layer') {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_SCOPE_INVALID', `Unsupported effect scope "${String(effect.scope)}".`, `${base}.scope`))
    }
    if ((effect.scope ?? 'output') === 'layer') {
      validateRef(effect.layer, index.layers.ids, `${base}.layer`, 'layer', diagnostics)
    } else if (effect.layer != null) {
      diagnostics.push(error('CINEMA2_PRESET_EFFECT_SCOPE_INVALID', 'Output-scoped effects cannot declare a layer reference.', `${base}.layer`))
    }
    validateEffectQuality(effect.quality, `${base}.quality`, diagnostics)
    if (effect.parameterBindings != null) {
      if (!isPlainObject(effect.parameterBindings)) {
        diagnostics.push(error('CINEMA2_PRESET_EFFECT_BINDINGS_INVALID', 'Effect parameterBindings must be an object.', `${base}.parameterBindings`))
      } else {
        const allowedProperties = new Set(['enabled', ...Object.keys(isPlainObject(effect.parameters) ? effect.parameters : {})])
        for (const [property, ref] of Object.entries(effect.parameterBindings)) {
          const bindingPath = `${base}.parameterBindings.${property}`
          if (!allowedProperties.has(property)) {
            diagnostics.push(error('CINEMA2_PRESET_EFFECT_BINDING_PROPERTY_INVALID', `Effect binding references unknown property "${property}".`, bindingPath))
          }
          const parameterId = validateRef(ref, index.parameters.ids, bindingPath, 'parameter', diagnostics)
          if (!parameterId || !allowedProperties.has(property)) continue
          const parameter = manifest.parameters?.find(candidate => candidate.id === parameterId)
          const authoredValue = property === 'enabled' ? (effect.enabled ?? true) : effect.parameters?.[property]
          if (!parameter || authoredValue === undefined) continue
          const compatibleTypes = effectBindingParameterTypes(authoredValue)
          if (compatibleTypes.length === 0) {
            diagnostics.push(error('CINEMA2_PRESET_EFFECT_BINDING_VALUE_UNSUPPORTED', `Effect property "${property}" is not representable by the shared target runtime and cannot be parameter-bound.`, bindingPath))
          } else if (!compatibleTypes.includes(parameter.type)) {
            diagnostics.push(error(
              'CINEMA2_PRESET_EFFECT_BINDING_TYPE_MISMATCH',
              `Effect property "${property}" requires parameter type ${compatibleTypes.join(' or ')}, not "${parameter.type}".`,
              bindingPath,
            ))
          }
        }
      }
    }
    if (effect.actionBindings != null) {
      if (!isPlainObject(effect.actionBindings)) {
        diagnostics.push(error('CINEMA2_PRESET_EFFECT_ACTION_BINDINGS_INVALID', 'Effect actionBindings must be an object.', `${base}.actionBindings`))
      } else {
        for (const [action, ref] of Object.entries(effect.actionBindings)) {
          const bindingPath = `${base}.actionBindings.${action}`
          if (!action.trim()) {
            diagnostics.push(error('CINEMA2_PRESET_EFFECT_ACTION_BINDING_NAME_INVALID', 'Effect action binding names must be non-empty.', bindingPath))
            continue
          }
          const parameterId = validateRef(ref, index.parameters.ids, bindingPath, 'parameter', diagnostics)
          if (!parameterId) continue
          const parameter = manifest.parameters?.find(candidate => candidate.id === parameterId)
          if (parameter && parameter.type !== 'trigger') {
            diagnostics.push(error(
              'CINEMA2_PRESET_EFFECT_ACTION_BINDING_TYPE_MISMATCH',
              `Effect action "${action}" requires a trigger parameter, not "${parameter.type}".`,
              bindingPath,
            ))
          }
        }
      }
    }
  }

  for (const [ruleIndex, rule] of readArray(manifest.choreography?.rules, '$.choreography.rules', diagnostics).entries()) {
    const base = `$.choreography.rules[${ruleIndex}]`
    if (!isPlainObject(rule.source)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_SOURCE_INVALID', 'Choreography source must be an object.', `${base}.source`))
      continue
    }
    const expectedCapability = SIGNAL_CAPABILITY[rule.source.signal]
    if (expectedCapability && rule.source.capability !== expectedCapability) {
      diagnostics.push(error(
        'CINEMA2_PRESET_CAPABILITY_COMBINATION_INVALID',
        `Choreography signal "${String(rule.source.signal)}" requires capability "${expectedCapability}", not "${String(rule.source.capability)}".`,
        `${base}.source.capability`,
      ))
    } else if (rule.source.capability != null && !CAPABILITY_IDS.has(String(rule.source.capability))) {
      diagnostics.push(error('CINEMA2_PRESET_CAPABILITY_UNSUPPORTED', `Unsupported choreography capability "${String(rule.source.capability)}".`, `${base}.source.capability`))
    }
    if (rule.source.signal === 'continuous' && typeof rule.source.path !== 'string') {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_SOURCE_INVALID', 'Continuous choreography sources require a typed path.', `${base}.source.path`))
    }
    if (rule.source.signal === 'parameter') {
      validateRef(rule.source.parameter, index.parameters.ids, `${base}.source.parameter`, 'parameter', diagnostics)
    }
    if (rule.source.smoothingMs != null && !isFiniteNonNegative(rule.source.smoothingMs)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_TIMING_INVALID', 'Source smoothingMs must be a finite non-negative number.', `${base}.source.smoothingMs`))
    }
    validateOptionalFinite(rule.source.threshold, `${base}.source.threshold`, 'source threshold', diagnostics)
    validateOptionalFinite(rule.source.scale, `${base}.source.scale`, 'source scale', diagnostics)
    validateOptionalFinite(rule.source.offset, `${base}.source.offset`, 'source offset', diagnostics)
    if (rule.source.clamp != null && (!Array.isArray(rule.source.clamp) || rule.source.clamp.length !== 2 || !rule.source.clamp.every(Number.isFinite) || rule.source.clamp[0] > rule.source.clamp[1])) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_SOURCE_INVALID', 'Source clamp must be [min, max] with finite ascending values.', `${base}.source.clamp`))
    }

    if (rule.enabledParameter != null) {
      const enabledParameterId = validateRef(rule.enabledParameter, index.parameters.ids, `${base}.enabledParameter`, 'parameter', diagnostics)
      const parameter = enabledParameterId ? manifest.parameters?.find(candidate => candidate.id === enabledParameterId) : null
      if (parameter && parameter.type !== 'boolean') {
        diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_ROUTE_CONTROL_INVALID', 'enabledParameter must reference a boolean parameter.', `${base}.enabledParameter`))
      }
    }
    if (rule.strengthParameter != null) {
      const strengthParameterId = validateRef(rule.strengthParameter, index.parameters.ids, `${base}.strengthParameter`, 'parameter', diagnostics)
      const parameter = strengthParameterId ? manifest.parameters?.find(candidate => candidate.id === strengthParameterId) : null
      if (parameter && parameter.type !== 'float' && parameter.type !== 'integer' && parameter.type !== 'meter') {
        diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_ROUTE_CONTROL_INVALID', 'strengthParameter must reference a numeric parameter.', `${base}.strengthParameter`))
      }
    }
    validateChoreographyConditions(rule.conditions, `${base}.conditions`, diagnostics)

    for (const [actionIndex, action] of readArray(rule.actions, `${base}.actions`, diagnostics).entries()) {
      const actionBase = `${base}.actions[${actionIndex}]`
      validateWritableTarget(action.target, index, `${actionBase}.target`, diagnostics)
      validateChoreographyAction(action, actionBase, diagnostics)
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


function effectBindingParameterTypes(value: Cinema2JsonValue): readonly Cinema2ParameterType[] {
  if (typeof value === 'boolean') return ['boolean']
  if (typeof value === 'number' && Number.isFinite(value)) return ['float', 'integer', 'meter']
  if (typeof value === 'string') return ['enum', 'string', 'text', 'status']
  if (Array.isArray(value) && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    if (value.length === 2) return ['vec2']
    if (value.length === 3) return ['vec3']
    if (value.length === 4) return ['color']
  }
  return []
}

function validateEffectQuality(
  value: unknown,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  if (value == null) return
  if (!isPlainObject(value)) {
    diagnostics.push(error('CINEMA2_PRESET_EFFECT_QUALITY_INVALID', 'Effect quality gate must be an object.', path))
    return
  }
  const levels = { low: 0, medium: 1, high: 2 } as const
  const min = value.min
  const max = value.max
  if (min != null && !(String(min) in levels)) diagnostics.push(error('CINEMA2_PRESET_EFFECT_QUALITY_INVALID', `Unsupported minimum quality "${String(min)}".`, `${path}.min`))
  if (max != null && !(String(max) in levels)) diagnostics.push(error('CINEMA2_PRESET_EFFECT_QUALITY_INVALID', `Unsupported maximum quality "${String(max)}".`, `${path}.max`))
  if (typeof min === 'string' && typeof max === 'string' && min in levels && max in levels && levels[min as keyof typeof levels] > levels[max as keyof typeof levels]) {
    diagnostics.push(error('CINEMA2_PRESET_EFFECT_QUALITY_INVALID', 'Effect quality minimum cannot exceed the maximum.', path))
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
    case 'layer':
      validateRef(target.ref, index.layers.ids, `${path}.ref`, 'layer', diagnostics)
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
    case 'environment':
      validateTargetProperty(target.property, `${path}.property`, diagnostics)
      break
    case 'media':
      validateRef(target.ref, index.mediaSlots.ids, `${path}.ref`, 'media slot', diagnostics)
      break
    case 'variation':
      validateRef(target.ref, index.variations.ids, `${path}.ref`, 'variation', diagnostics)
      break
    default:
      diagnostics.push(error('CINEMA2_PRESET_TARGET_INVALID', `Unsupported writable target kind "${String(target.kind)}".`, `${path}.kind`))
  }
}

function validateChoreographyAction(
  action: Readonly<Cinema2ChoreographyActionManifest>,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  const operations = new Set([
    'map', 'set', 'replace', 'add', 'multiply', 'pulse', 'envelope', 'toggle',
    'trigger', 'spawn', 'set-for-duration', 'variation-switch',
  ])
  if (!operations.has(String(action.operation))) {
    diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_OPERATION_INVALID', `Unsupported choreography operation "${String(action.operation)}".`, `${path}.operation`))
  }
  if (action.composition != null && !['replace', 'add', 'multiply'].includes(String(action.composition))) {
    diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_COMPOSITION_INVALID', 'Envelope/pulse composition must be replace, add or multiply.', `${path}.composition`))
  }
  for (const key of ['durationBeats', 'durationSeconds', 'delayBeats', 'quantizeBeats', 'cooldownBeats'] as const) {
    const value = action[key]
    if (value != null && !isFiniteNonNegative(value)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_TIMING_INVALID', `${key} must be a finite non-negative number.`, `${path}.${key}`))
    }
  }
  if (typeof action.quantizeBeats === 'number' && action.quantizeBeats === 0) {
    diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_TIMING_INVALID', 'quantizeBeats must be greater than zero when present.', `${path}.quantizeBeats`))
  }
  if (action.retrigger != null && !['ignore', 'restart', 'extend'].includes(String(action.retrigger))) {
    diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_RETRIGGER_INVALID', 'retrigger must be ignore, restart or extend.', `${path}.retrigger`))
  }
  if (action.map != null) {
    if (!isPlainObject(action.map)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_MAP_INVALID', 'map must be an object.', `${path}.map`))
    } else {
      for (const key of ['inputMin', 'inputMax', 'outputMin', 'outputMax'] as const) validateOptionalFinite(action.map[key], `${path}.map.${key}`, key, diagnostics)
      if (typeof action.map.inputMin === 'number' && typeof action.map.inputMax === 'number' && action.map.inputMin === action.map.inputMax) {
        diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_MAP_INVALID', 'map inputMin and inputMax must differ.', `${path}.map`))
      }
    }
  }
  if (action.envelope != null) {
    if (!isPlainObject(action.envelope)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_ENVELOPE_INVALID', 'envelope must be an object.', `${path}.envelope`))
    } else {
      for (const key of ['attack', 'hold', 'release'] as const) {
        const value = action.envelope[key]
        if (value != null && !isFiniteNonNegative(value)) {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_ENVELOPE_INVALID', `${key} must be a finite non-negative number.`, `${path}.envelope.${key}`))
        }
      }
      if (action.envelope.unit != null && action.envelope.unit !== 'seconds' && action.envelope.unit !== 'beats') {
        diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_ENVELOPE_INVALID', 'Envelope unit must be seconds or beats.', `${path}.envelope.unit`))
      }
    }
  }
}

function validateChoreographyConditions(
  conditions: unknown,
  path: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  if (conditions == null) return
  if (!Array.isArray(conditions)) {
    diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'conditions must be an array.', path))
    return
  }
  for (const [index, condition] of conditions.entries()) {
    const conditionPath = `${path}[${index}]`
    if (!isPlainObject(condition)) {
      diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'Condition must be an object.', conditionPath))
      continue
    }
    switch (condition.kind) {
      case 'source-threshold':
        validateOptionalFinite(condition.min, `${conditionPath}.min`, 'minimum threshold', diagnostics)
        validateOptionalFinite(condition.max, `${conditionPath}.max`, 'maximum threshold', diagnostics)
        break
      case 'source-range':
        if (!Number.isFinite(condition.min) || !Number.isFinite(condition.max) || Number(condition.min) > Number(condition.max)) {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'source-range requires finite min <= max.', conditionPath))
        }
        break
      case 'director-phase':
        if (!Array.isArray(condition.phases) || condition.phases.length === 0 || condition.phases.some(phase => !['low', 'steady', 'rising', 'building', 'peak', 'release'].includes(String(phase)))) {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'director-phase requires one or more supported phases.', `${conditionPath}.phases`))
        }
        break
      case 'section-type':
        if (!Array.isArray(condition.values) || condition.values.length === 0 || condition.values.some(value => typeof value !== 'string' || value.length === 0)) {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'section-type requires one or more non-empty values.', `${conditionPath}.values`))
        }
        break
      case 'build':
      case 'drop':
      case 'confidence':
        if (!Number.isFinite(condition.min) || Number(condition.min) < 0 || Number(condition.min) > 1) {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', `${String(condition.kind)} min must be between 0 and 1.`, `${conditionPath}.min`))
        }
        break
      case 'capability':
        if (!CAPABILITY_IDS.has(String(condition.capability))) {
          diagnostics.push(error('CINEMA2_PRESET_CAPABILITY_UNSUPPORTED', `Unsupported choreography capability "${String(condition.capability)}".`, `${conditionPath}.capability`))
        }
        if (condition.available != null && typeof condition.available !== 'boolean') {
          diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', 'Capability condition available must be boolean.', `${conditionPath}.available`))
        }
        break
      case 'once-per-event':
        break
      default:
        diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_CONDITION_INVALID', `Unsupported choreography condition "${String(condition.kind)}".`, `${conditionPath}.kind`))
    }
  }
}

function validateOptionalFinite(
  value: unknown,
  path: string,
  label: string,
  diagnostics: Cinema2PresetDiagnostic[],
): void {
  if (value != null && !Number.isFinite(value)) diagnostics.push(error('CINEMA2_PRESET_CHOREOGRAPHY_VALUE_INVALID', `${label} must be finite.`, path))
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
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
