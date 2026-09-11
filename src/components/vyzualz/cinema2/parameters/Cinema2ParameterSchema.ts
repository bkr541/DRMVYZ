import {
  CINEMA2_CAPABILITY_IDS,
  isCinema2StableId,
  type Cinema2CapabilityId,
  type Cinema2JsonValue,
  type Cinema2MediaSlotId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterConditionManifest,
  type Cinema2ParameterExposure,
  type Cinema2ParameterId,
  type Cinema2ParameterManifest,
  type Cinema2ParameterPersistenceScope,
  type Cinema2ParameterResetMode,
  type Cinema2ParameterType,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'

export interface Cinema2ParameterSchemaDiagnostic {
  code: string
  message: string
  path: string
}

export interface Cinema2CompiledParameterDefinition extends Cinema2ParameterManifest {
  exposure: Cinema2ParameterExposure
  persistence: Cinema2ParameterPersistenceScope
  reset: Cinema2ParameterResetMode
  modulatable: boolean
  choreographable: boolean
  automatable: boolean
  readOnly: boolean
}

export interface Cinema2CompiledParameterPlan {
  presetId: Cinema2PresetId
  presetRevision: number
  definitions: readonly Readonly<Cinema2CompiledParameterDefinition>[]
  authoredDefaults: Readonly<Record<string, Cinema2JsonValue>>
  persistentParameterIds: readonly Cinema2ParameterId[]
  runtimeOnlyParameterIds: readonly Cinema2ParameterId[]
}

export interface Cinema2ParameterValueNormalizationResult {
  ok: boolean
  value: Cinema2JsonValue | undefined
  diagnostics: readonly Cinema2ParameterSchemaDiagnostic[]
}

const PARAMETER_TYPES = new Set<Cinema2ParameterType>([
  'float',
  'integer',
  'boolean',
  'enum',
  'color',
  'trigger',
  'string',
  'text',
  'vec2',
  'vec3',
  'media',
  'status',
  'meter',
])
const CAPABILITIES = new Set<string>(CINEMA2_CAPABILITY_IDS)
const EXPOSURES = new Set<Cinema2ParameterExposure>(['primary', 'advanced', 'hidden', 'diagnostic'])
const PERSISTENCE = new Set<Cinema2ParameterPersistenceScope>(['preset', 'user', 'runtime-only'])
const RESET_MODES = new Set<Cinema2ParameterResetMode>(['authored-default', 'none'])
const READ_ONLY_TYPES = new Set<Cinema2ParameterType>(['status', 'meter'])
const RUNTIME_ONLY_TYPES = new Set<Cinema2ParameterType>(['trigger', 'status', 'meter'])

export function validateCinema2ParameterDefinitions(
  manifest: Cinema2NativePresetManifest,
): readonly Cinema2ParameterSchemaDiagnostic[] {
  const diagnostics: Cinema2ParameterSchemaDiagnostic[] = []
  const parameters = Array.isArray(manifest.parameters) ? manifest.parameters : []
  const parameterIds = new Set(parameters.map(parameter => String(parameter.id)))
  const mediaSlotIds = new Set((Array.isArray(manifest.mediaSlots) ? manifest.mediaSlots : []).map(slot => String(slot.id)))
  const defaults = isPlainObject(manifest.defaults?.parameterValues)
    ? manifest.defaults?.parameterValues as Readonly<Record<string, Cinema2JsonValue>>
    : undefined

  for (const [index, definition] of parameters.entries()) {
    const path = `$.parameters[${index}]`
    validateDefinition(definition, path, parameterIds, mediaSlotIds, diagnostics)

    const hasPresetDefault = defaults != null && Object.prototype.hasOwnProperty.call(defaults, definition.id)
    const authoredDefault = hasPresetDefault ? defaults?.[definition.id] : definition.defaultValue
    if (definition.type === 'trigger') {
      if (authoredDefault !== undefined) {
        diagnostics.push(issue(
          'CINEMA2_PARAMETER_TRIGGER_DEFAULT_INVALID',
          'Trigger parameters are momentary actions and cannot declare a persistent authored default.',
          hasPresetDefault ? `$.defaults.parameterValues.${definition.id}` : `${path}.defaultValue`,
        ))
      }
    } else if (authoredDefault === undefined) {
      diagnostics.push(issue(
        'CINEMA2_PARAMETER_DEFAULT_REQUIRED',
        'Cinema 2.0 value-bearing parameters must declare an authored default.',
        `${path}.defaultValue`,
      ))
    } else {
      diagnostics.push(...normalizeCinema2ParameterValue(definition, authoredDefault, {
        mode: 'authored',
        path: hasPresetDefault ? `$.defaults.parameterValues.${definition.id}` : `${path}.defaultValue`,
      }).diagnostics)
    }
  }

  return deepFreeze(diagnostics)
}

export function compileCinema2ParameterPlan(
  manifest: Readonly<Cinema2NativePresetManifest>,
): Readonly<Cinema2CompiledParameterPlan> {
  const definitions = (manifest.parameters ?? []).map(definition => compileDefinition(definition))
  const presetDefaults = manifest.defaults?.parameterValues ?? {}
  const authoredDefaults: Record<string, Cinema2JsonValue> = {}
  const persistentParameterIds: Cinema2ParameterId[] = []
  const runtimeOnlyParameterIds: Cinema2ParameterId[] = []

  for (const definition of definitions) {
    if (definition.persistence === 'runtime-only') runtimeOnlyParameterIds.push(definition.id)
    else persistentParameterIds.push(definition.id)
    if (definition.type === 'trigger') continue

    const candidate = Object.prototype.hasOwnProperty.call(presetDefaults, definition.id)
      ? presetDefaults[definition.id]
      : definition.defaultValue
    if (candidate !== undefined) authoredDefaults[definition.id] = cloneJson(candidate)
  }

  return deepFreeze({
    presetId: manifest.id,
    presetRevision: manifest.revision,
    definitions,
    authoredDefaults,
    persistentParameterIds,
    runtimeOnlyParameterIds,
  })
}

export function normalizeCinema2ParameterValue(
  definition: Pick<Cinema2ParameterManifest, 'id' | 'type' | 'min' | 'max' | 'step' | 'options'>,
  candidate: unknown,
  options: { mode: 'authored' | 'runtime'; path?: string },
): Cinema2ParameterValueNormalizationResult {
  const path = options.path ?? `parameter.${definition.id}`
  const diagnostics: Cinema2ParameterSchemaDiagnostic[] = []
  let value: Cinema2JsonValue | undefined

  switch (definition.type) {
    case 'float':
    case 'integer':
    case 'meter': {
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', `${definition.type} parameters require a finite number.`, path))
        break
      }
      if (definition.type === 'integer' && !Number.isInteger(candidate) && options.mode === 'authored') {
        diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'Integer authored defaults must be integers.', path))
        break
      }
      let normalized = definition.type === 'integer' ? Math.round(candidate) : candidate
      if (typeof definition.min === 'number' && normalized < definition.min) {
        if (options.mode === 'authored') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_RANGE_INVALID', `Authored default is below minimum ${definition.min}.`, path))
        normalized = Math.max(normalized, definition.min)
      }
      if (typeof definition.max === 'number' && normalized > definition.max) {
        if (options.mode === 'authored') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_RANGE_INVALID', `Authored default exceeds maximum ${definition.max}.`, path))
        normalized = Math.min(normalized, definition.max)
      }
      if (typeof definition.step === 'number' && definition.step > 0 && options.mode === 'runtime') {
        const origin = typeof definition.min === 'number' ? definition.min : 0
        normalized = origin + Math.round((normalized - origin) / definition.step) * definition.step
        if (definition.type === 'integer') normalized = Math.round(normalized)
        if (typeof definition.min === 'number') normalized = Math.max(normalized, definition.min)
        if (typeof definition.max === 'number') normalized = Math.min(normalized, definition.max)
      }
      value = normalized
      break
    }
    case 'boolean':
      if (typeof candidate !== 'boolean') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'Boolean parameters require true or false.', path))
      else value = candidate
      break
    case 'enum': {
      if (typeof candidate !== 'string') {
        diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'Enum parameters require a string option value.', path))
        break
      }
      const values = new Set((definition.options ?? []).map(option => option.value))
      if (!values.has(candidate)) diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_OPTION_INVALID', `Enum value "${candidate}" is not an authored option.`, path))
      else value = candidate
      break
    }
    case 'color':
      value = normalizeVector(definition, candidate, 4, path, options.mode, diagnostics)
      break
    case 'vec2':
      value = normalizeVector(definition, candidate, 2, path, options.mode, diagnostics)
      break
    case 'vec3':
      value = normalizeVector(definition, candidate, 3, path, options.mode, diagnostics)
      break
    case 'string':
    case 'text':
      if (typeof candidate !== 'string') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'String parameters require a string value.', path))
      else value = candidate
      break
    case 'media':
      if (candidate !== null && typeof candidate !== 'string') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'Media parameters require a media reference string or null.', path))
      else value = candidate as string | null
      break
    case 'status':
      if (candidate !== null && !['string', 'number', 'boolean'].includes(typeof candidate)) {
        diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', 'Status parameters require a scalar JSON value or null.', path))
      } else value = candidate as string | number | boolean | null
      break
    case 'trigger':
      if (candidate !== undefined) diagnostics.push(issue('CINEMA2_PARAMETER_TRIGGER_VALUE_INVALID', 'Trigger parameters carry actions, not stored values.', path))
      break
    default:
      diagnostics.push(issue('CINEMA2_PARAMETER_TYPE_INVALID', `Unsupported Cinema 2.0 parameter type "${String(definition.type)}".`, path))
  }

  return deepFreeze({ ok: diagnostics.length === 0, value: diagnostics.length === 0 ? value : undefined, diagnostics })
}

function validateDefinition(
  definition: Cinema2ParameterManifest,
  path: string,
  parameterIds: ReadonlySet<string>,
  mediaSlotIds: ReadonlySet<string>,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (!PARAMETER_TYPES.has(definition.type)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_TYPE_INVALID', `Unsupported Cinema 2.0 parameter type "${String(definition.type)}".`, `${path}.type`))
    return
  }
  if (typeof definition.label !== 'string' || definition.label.trim().length === 0) {
    diagnostics.push(issue('CINEMA2_PARAMETER_LABEL_INVALID', 'Parameter label must be a non-empty string.', `${path}.label`))
  }
  if (definition.description != null && typeof definition.description !== 'string') {
    diagnostics.push(issue('CINEMA2_PARAMETER_DESCRIPTION_INVALID', 'Parameter description must be a string.', `${path}.description`))
  }
  validateOptionalText(definition.section, `${path}.section`, 'section', diagnostics)
  validateOptionalText(definition.group, `${path}.group`, 'group', diagnostics)
  validateOptionalBoolean(definition.modulatable, `${path}.modulatable`, diagnostics)
  validateOptionalBoolean(definition.choreographable, `${path}.choreographable`, diagnostics)
  validateOptionalBoolean(definition.automatable, `${path}.automatable`, diagnostics)
  if (definition.metadata != null && !isPlainObject(definition.metadata)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_METADATA_INVALID', 'Parameter metadata must be a JSON object.', `${path}.metadata`))
  }
  validateFiniteOptional(definition.min, `${path}.min`, diagnostics)
  validateFiniteOptional(definition.max, `${path}.max`, diagnostics)
  validateFiniteOptional(definition.step, `${path}.step`, diagnostics)
  if (typeof definition.min === 'number' && typeof definition.max === 'number' && definition.min > definition.max) {
    diagnostics.push(issue('CINEMA2_PARAMETER_RANGE_INVALID', 'Parameter min cannot exceed max.', path))
  }
  if (definition.step != null && (!(definition.step > 0) || !Number.isFinite(definition.step))) {
    diagnostics.push(issue('CINEMA2_PARAMETER_STEP_INVALID', 'Parameter step must be a finite number greater than zero.', `${path}.step`))
  }
  const ranged = definition.type === 'float' || definition.type === 'integer' || definition.type === 'meter' || definition.type === 'vec2' || definition.type === 'vec3'
  if (!ranged && (definition.min != null || definition.max != null || definition.step != null)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_RANGE_UNSUPPORTED', `${definition.type} parameters cannot declare scalar min/max/step metadata.`, path))
  }
  if (definition.unit != null && typeof definition.unit !== 'string') {
    diagnostics.push(issue('CINEMA2_PARAMETER_UNIT_INVALID', 'Parameter unit must be a string.', `${path}.unit`))
  }

  if (definition.type === 'enum') validateOptions(definition, path, diagnostics)
  else if (definition.options != null) diagnostics.push(issue('CINEMA2_PARAMETER_OPTIONS_UNSUPPORTED', 'Only enum parameters may declare options.', `${path}.options`))

  if (definition.order != null && (!Number.isInteger(definition.order) || definition.order < 0)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_ORDER_INVALID', 'Parameter order must be a non-negative integer.', `${path}.order`))
  }
  if (definition.exposure != null && !EXPOSURES.has(definition.exposure)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_EXPOSURE_INVALID', `Unsupported exposure "${String(definition.exposure)}".`, `${path}.exposure`))
  }
  if (definition.persistence != null && !PERSISTENCE.has(definition.persistence)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_PERSISTENCE_INVALID', `Unsupported persistence scope "${String(definition.persistence)}".`, `${path}.persistence`))
  }
  if (definition.reset != null && !RESET_MODES.has(definition.reset)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_RESET_INVALID', `Unsupported reset mode "${String(definition.reset)}".`, `${path}.reset`))
  }

  const effectivePersistence = definition.persistence ?? (RUNTIME_ONLY_TYPES.has(definition.type) ? 'runtime-only' : 'preset')
  if (RUNTIME_ONLY_TYPES.has(definition.type) && effectivePersistence !== 'runtime-only') {
    diagnostics.push(issue('CINEMA2_PARAMETER_RUNTIME_ONLY_REQUIRED', `${definition.type} parameters must use runtime-only persistence.`, `${path}.persistence`))
  }
  if (READ_ONLY_TYPES.has(definition.type) && (definition.modulatable || definition.choreographable || definition.automatable)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_READ_ONLY_ELIGIBILITY_INVALID', `${definition.type} parameters are read-only and cannot be modulatable, choreographable, or automatable.`, path))
  }
  if (definition.type === 'trigger' && (definition.modulatable || definition.automatable)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_TRIGGER_ELIGIBILITY_INVALID', 'Trigger parameters cannot be modulatable or automatable.', path))
  }

  validateConditions(definition.visibleWhen, `${path}.visibleWhen`, parameterIds, diagnostics)
  validateConditions(definition.enabledWhen, `${path}.enabledWhen`, parameterIds, diagnostics)
  validateCapabilities(definition, path, diagnostics)

  if (definition.mediaSlot != null) {
    if (definition.type !== 'media') {
      diagnostics.push(issue('CINEMA2_PARAMETER_MEDIA_SLOT_UNSUPPORTED', 'Only media parameters may bind a media slot.', `${path}.mediaSlot`))
    } else if (!isPlainObject(definition.mediaSlot) || !isCinema2StableId(definition.mediaSlot.$ref) || !mediaSlotIds.has(definition.mediaSlot.$ref)) {
      diagnostics.push(issue('CINEMA2_PARAMETER_MEDIA_SLOT_INVALID', 'Media parameter must reference an authored media slot.', `${path}.mediaSlot`))
    }
  }
}

function validateOptions(
  definition: Cinema2ParameterManifest,
  path: string,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (!Array.isArray(definition.options) || definition.options.length === 0) {
    diagnostics.push(issue('CINEMA2_PARAMETER_OPTIONS_REQUIRED', 'Enum parameters must declare at least one option.', `${path}.options`))
    return
  }
  const seen = new Set<string>()
  for (const [index, option] of definition.options.entries()) {
    if (!isPlainObject(option) || typeof option.value !== 'string' || option.value.length === 0 || typeof option.label !== 'string' || option.label.length === 0) {
      diagnostics.push(issue('CINEMA2_PARAMETER_OPTION_INVALID', 'Enum options require non-empty string value and label fields.', `${path}.options[${index}]`))
      continue
    }
    if (seen.has(option.value)) diagnostics.push(issue('CINEMA2_PARAMETER_OPTION_DUPLICATE', `Duplicate enum option value "${option.value}".`, `${path}.options[${index}].value`))
    seen.add(option.value)
  }
}

function validateConditions(
  conditions: readonly Cinema2ParameterConditionManifest[] | undefined,
  path: string,
  parameterIds: ReadonlySet<string>,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (conditions == null) return
  if (!Array.isArray(conditions)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_CONDITION_LIST_INVALID', 'Parameter conditions must be an array.', path))
    return
  }
  for (const [index, condition] of conditions.entries()) {
    const itemPath = `${path}[${index}]`
    if (!isPlainObject(condition)) {
      diagnostics.push(issue('CINEMA2_PARAMETER_CONDITION_INVALID', 'Parameter condition must be an object.', itemPath))
      continue
    }
    if (condition.kind === 'capability-available') {
      if (!CAPABILITIES.has(String(condition.capability))) diagnostics.push(issue('CINEMA2_PARAMETER_CONDITION_CAPABILITY_INVALID', `Unsupported capability "${String(condition.capability)}".`, `${itemPath}.capability`))
      continue
    }
    if (condition.kind === 'parameter-equals' || condition.kind === 'parameter-not-equals') {
      if (!isCinema2StableId(condition.parameterId) || !parameterIds.has(condition.parameterId)) {
        diagnostics.push(issue('CINEMA2_PARAMETER_CONDITION_REFERENCE_MISSING', `Parameter condition references unknown parameter "${String(condition.parameterId)}".`, `${itemPath}.parameterId`))
      }
      continue
    }
    diagnostics.push(issue('CINEMA2_PARAMETER_CONDITION_INVALID', `Unsupported parameter condition kind "${String(condition.kind)}".`, `${itemPath}.kind`))
  }
}

function validateCapabilities(
  definition: Cinema2ParameterManifest,
  path: string,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (definition.capabilities == null) return
  if (!Array.isArray(definition.capabilities)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_CAPABILITIES_INVALID', 'Parameter capabilities must be an array.', `${path}.capabilities`))
    return
  }
  const seen = new Set<string>()
  for (const [index, capability] of definition.capabilities.entries()) {
    const itemPath = `${path}.capabilities[${index}]`
    if (!isPlainObject(capability) || !CAPABILITIES.has(String(capability.id))) {
      const capabilityId = isPlainObject(capability) ? capability.id : undefined
      diagnostics.push(issue('CINEMA2_PARAMETER_CAPABILITY_INVALID', `Unsupported parameter capability "${String(capabilityId)}".`, `${itemPath}.id`))
      continue
    }
    if (capability.requirement !== 'required' && capability.requirement !== 'optional') {
      diagnostics.push(issue('CINEMA2_PARAMETER_CAPABILITY_REQUIREMENT_INVALID', 'Capability requirement must be required or optional.', `${itemPath}.requirement`))
    }
    if (seen.has(capability.id as string)) diagnostics.push(issue('CINEMA2_PARAMETER_CAPABILITY_DUPLICATE', `Capability "${capability.id}" is declared more than once.`, `${itemPath}.id`))
    seen.add(capability.id as string)
  }
}

function compileDefinition(definition: Cinema2ParameterManifest): Readonly<Cinema2CompiledParameterDefinition> {
  const readOnly = READ_ONLY_TYPES.has(definition.type)
  const runtimeOnly = RUNTIME_ONLY_TYPES.has(definition.type)
  return deepFreeze({
    ...cloneJson(definition),
    exposure: definition.exposure ?? (readOnly ? 'diagnostic' : 'primary'),
    persistence: definition.persistence ?? (runtimeOnly ? 'runtime-only' : 'preset'),
    reset: definition.reset ?? (runtimeOnly ? 'none' : 'authored-default'),
    modulatable: readOnly || definition.type === 'trigger' ? false : definition.modulatable ?? false,
    choreographable: readOnly ? false : definition.choreographable ?? false,
    automatable: readOnly || definition.type === 'trigger' ? false : definition.automatable ?? false,
    readOnly,
  }) as Readonly<Cinema2CompiledParameterDefinition>
}

function normalizeVector(
  definition: Pick<Cinema2ParameterManifest, 'min' | 'max' | 'step'>,
  candidate: unknown,
  length: number,
  path: string,
  mode: 'authored' | 'runtime',
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): Cinema2JsonValue | undefined {
  if (!Array.isArray(candidate) || candidate.length !== length || candidate.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_TYPE_INVALID', `Expected a ${length}-component finite numeric vector.`, path))
    return undefined
  }
  const values = candidate.map(component => component as number)
  for (let index = 0; index < values.length; index += 1) {
    let component = values[index]
    if (typeof definition.min === 'number' && component < definition.min) {
      if (mode === 'authored') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_RANGE_INVALID', `Vector component ${index} is below minimum ${definition.min}.`, `${path}[${index}]`))
      component = Math.max(component, definition.min)
    }
    if (typeof definition.max === 'number' && component > definition.max) {
      if (mode === 'authored') diagnostics.push(issue('CINEMA2_PARAMETER_VALUE_RANGE_INVALID', `Vector component ${index} exceeds maximum ${definition.max}.`, `${path}[${index}]`))
      component = Math.min(component, definition.max)
    }
    if (typeof definition.step === 'number' && definition.step > 0 && mode === 'runtime') {
      const origin = typeof definition.min === 'number' ? definition.min : 0
      component = origin + Math.round((component - origin) / definition.step) * definition.step
      if (typeof definition.min === 'number') component = Math.max(component, definition.min)
      if (typeof definition.max === 'number') component = Math.min(component, definition.max)
    }
    values[index] = component
  }
  return diagnostics.length === 0 || mode === 'runtime' ? values as Cinema2JsonValue : undefined
}

function validateOptionalText(
  value: unknown,
  path: string,
  label: string,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (value != null && (typeof value !== 'string' || value.trim().length === 0)) {
    diagnostics.push(issue('CINEMA2_PARAMETER_TEXT_METADATA_INVALID', `Parameter ${label} must be a non-empty string when present.`, path))
  }
}

function validateOptionalBoolean(
  value: unknown,
  path: string,
  diagnostics: Cinema2ParameterSchemaDiagnostic[],
): void {
  if (value != null && typeof value !== 'boolean') {
    diagnostics.push(issue('CINEMA2_PARAMETER_BOOLEAN_METADATA_INVALID', 'Parameter eligibility metadata must be boolean when present.', path))
  }
}

function validateFiniteOptional(value: unknown, path: string, diagnostics: Cinema2ParameterSchemaDiagnostic[]): void {
  if (value != null && (typeof value !== 'number' || !Number.isFinite(value))) diagnostics.push(issue('CINEMA2_PARAMETER_NUMBER_INVALID', 'Parameter numeric metadata must be finite.', path))
}

function issue(code: string, message: string, path: string): Cinema2ParameterSchemaDiagnostic {
  return { code, message, path }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
