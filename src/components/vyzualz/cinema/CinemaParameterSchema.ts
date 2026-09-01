import {
  createCinemaDiagnostic,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
} from './CinemaDiagnostics'
import {
  parseCinemaStableId,
  type CinemaParameterId,
} from './CinemaIdentifiers'
import type {
  CinemaAssetReference,
  CinemaAssetRole,
  CinemaColor,
  CinemaCurvePoint,
  CinemaGradientStop,
  CinemaMasterParameterBinding,
  CinemaParameterControlHint,
  CinemaParameterDefinition,
  CinemaParameterValue,
  CinemaVector2,
  CinemaVector3,
} from './CinemaDomain'

export interface CinemaParameterSchemaValidationOptions {
  owner?: 'master' | 'node' | 'camera'
}

export interface CinemaParameterNormalizationOptions {
  parameterPath?: string
  /** Resolution stages use unclamped values until the final safety-clamp stage. */
  clamp?: boolean
}

export interface CinemaParameterNormalizationResult {
  valid: boolean
  value: CinemaParameterValue
  diagnostics: readonly CinemaDiagnostic[]
  usedFallback: boolean
  changed: boolean
}

const PARAMETER_TYPES = new Set([
  'float',
  'integer',
  'boolean',
  'string',
  'enum',
  'trigger',
  'color',
  'gradient',
  'vector2',
  'vector3',
  'curve',
  'texture',
  'asset',
  'asset-reference',
])

const ASSET_ROLES = new Set<CinemaAssetRole>([
  'logo',
  'image',
  'video',
  'album-artwork',
  'mask',
  'material',
  'displacement',
  'environment',
  'lyric-background',
  'node-output',
  'font',
  'audio',
])

const CONTROL_HINTS_BY_TYPE: Readonly<Record<string, readonly CinemaParameterControlHint[]>> = {
  float: ['slider', 'number'],
  integer: ['slider', 'number'],
  boolean: ['toggle'],
  string: ['text'],
  enum: ['select'],
  trigger: ['button'],
  color: ['color'],
  gradient: ['gradient'],
  vector2: ['vector'],
  vector3: ['vector'],
  curve: ['curve'],
  texture: ['texture', 'asset-picker'],
  asset: ['asset-picker'],
  'asset-reference': ['asset-picker'],
}

export function validateCinemaParameterSchemas(
  schemas: readonly unknown[],
  options: CinemaParameterSchemaValidationOptions = {},
): readonly CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  const ids = new Set<string>()
  for (const schema of schemas) {
    const schemaDiagnostics = validateCinemaParameterSchema(schema, options)
    diagnostics.push(...schemaDiagnostics)
    if (!isRecord(schema) || typeof schema.id !== 'string') continue
    if (ids.has(schema.id)) {
      diagnostics.push(schemaDiagnostic(schema.id, `Duplicate Cinema parameter schema ID "${schema.id}".`))
    }
    ids.add(schema.id)
  }
  return deduplicateCinemaDiagnostics(diagnostics)
}

export function validateCinemaParameterSchema(
  value: unknown,
  options: CinemaParameterSchemaValidationOptions = {},
): readonly CinemaDiagnostic[] {
  try {
    if (!isRecord(value)) return [schemaDiagnostic('<missing>', 'Cinema parameter schema must be an object.')]
    const diagnostics: CinemaDiagnostic[] = []
    const parameterId = typeof value.id === 'string' ? value.id : '<missing>'
    diagnostics.push(...parseCinemaStableId(value.id, 'parameter').diagnostics)
    if (typeof value.label !== 'string' || value.label.trim().length === 0) {
      diagnostics.push(schemaDiagnostic(parameterId, 'Cinema parameter label must be a non-empty string.'))
    }
    validateOptionalText(value.description, 'description', parameterId, diagnostics)
    validateOptionalText(value.group, 'group', parameterId, diagnostics)
    validateOptionalBoolean(value.advanced, 'advanced', parameterId, diagnostics)
    validateOptionalBoolean(value.modulatable, 'modulatable', parameterId, diagnostics)

    const type = typeof value.type === 'string' ? value.type : '<missing>'
    if (!PARAMETER_TYPES.has(type)) {
      diagnostics.push(schemaDiagnostic(parameterId, `Unsupported Cinema parameter type "${type}".`))
      return deduplicateCinemaDiagnostics(diagnostics)
    }

    validateUiHints(value.ui, type, parameterId, diagnostics)
    validateMasterBindingShape(value.masterBinding, parameterId, options, diagnostics)

    switch (type) {
      case 'float':
      case 'integer':
        validateNumericSchema(value, type, parameterId, diagnostics)
        break
      case 'boolean':
        if (typeof value.default !== 'boolean') diagnostics.push(schemaDiagnostic(parameterId, 'Boolean parameter default must be boolean.'))
        break
      case 'string':
        validateStringSchema(value, parameterId, diagnostics)
        break
      case 'enum':
        validateEnumSchema(value, parameterId, diagnostics)
        break
      case 'trigger':
        if (value.modulatable != null && value.modulatable !== false) {
          diagnostics.push(schemaDiagnostic(parameterId, 'Trigger parameters cannot be modulatable.'))
        }
        break
      case 'color':
        if (!isColor(value.default, true)) diagnostics.push(schemaDiagnostic(parameterId, 'Color parameter default must be a normalized RGBA tuple.'))
        if (value.brandRole !== undefined && !['primary', 'secondary', 'accent', 'background', 'foreground', 'highlight', 'shadow'].includes(String(value.brandRole))) {
          diagnostics.push(schemaDiagnostic(parameterId, 'Color parameter Brand Kit role is invalid.'))
        }
        if (value.brandPolicy !== undefined && !['exact', 'derived', 'free'].includes(String(value.brandPolicy))) {
          diagnostics.push(schemaDiagnostic(parameterId, 'Color parameter Brand Kit policy is invalid.'))
        }
        if (value.brandPolicy !== undefined && value.brandRole === undefined) {
          diagnostics.push(schemaDiagnostic(parameterId, 'Color parameter Brand Kit policy requires a semantic Brand Kit role.'))
        }
        break
      case 'gradient':
        if (!isGradient(value.default, true)) diagnostics.push(schemaDiagnostic(parameterId, 'Gradient parameter default must contain valid, unique, normalized stops.'))
        break
      case 'vector2':
      case 'vector3':
        validateVectorSchema(value, type === 'vector2' ? 2 : 3, parameterId, diagnostics)
        break
      case 'curve':
        if (!isCurve(value.default, true)) diagnostics.push(schemaDiagnostic(parameterId, 'Curve parameter default must contain valid, unique control points.'))
        break
      case 'texture':
      case 'asset':
      case 'asset-reference':
        validateAssetSchema(value, parameterId, diagnostics)
        break
      default:
        break
    }
    return deduplicateCinemaDiagnostics(diagnostics)
  } catch (error) {
    return [schemaDiagnostic('<unknown>', 'Cinema parameter schema validation failed safely.', {
      reason: error instanceof Error ? error.message : String(error),
    })]
  }
}

export function normalizeCinemaParameterValue(
  schema: CinemaParameterDefinition,
  input: unknown,
  options: CinemaParameterNormalizationOptions = {},
): CinemaParameterNormalizationResult {
  try {
    const clamp = options.clamp ?? true
    const normalized = normalizeByType(schema, input, clamp)
    if (!normalized.valid) {
      const fallback = cloneValue(getCinemaParameterDefaultValue(schema))
      return {
        valid: false,
        value: fallback,
        diagnostics: [valueDiagnostic(schema, 'reason' in normalized ? normalized.reason : 'Normalization failed.', options.parameterPath)],
        usedFallback: true,
        changed: !valuesEqual(input, fallback),
      }
    }
    return {
      valid: true,
      value: normalized.value,
      diagnostics: [],
      usedFallback: false,
      changed: !valuesEqual(input, normalized.value),
    }
  } catch (error) {
    const fallback = cloneValue(getCinemaParameterDefaultValue(schema))
    return {
      valid: false,
      value: fallback,
      diagnostics: [valueDiagnostic(
        schema,
        `Normalization failed safely: ${error instanceof Error ? error.message : String(error)}`,
        options.parameterPath,
      )],
      usedFallback: true,
      changed: true,
    }
  }
}

export function getCinemaParameterDefaultValue(schema: CinemaParameterDefinition): CinemaParameterValue {
  if (schema.type === 'trigger') return false
  return cloneValue(schema.default)
}

function normalizeByType(
  schema: CinemaParameterDefinition,
  input: unknown,
  clamp: boolean,
): { valid: true; value: CinemaParameterValue } | { valid: false; reason: string } {
  switch (schema.type) {
    case 'float': {
      if (!isFiniteNumber(input)) return invalid('Expected a finite number.')
      const value = clamp ? quantizeAndClamp(input, schema.min, schema.max, schema.step) : input
      return valid(value)
    }
    case 'integer': {
      if (!isFiniteNumber(input)) return invalid('Expected a finite integer.')
      const value = clamp
        ? Math.round(quantizeAndClamp(input, schema.min, schema.max, schema.step ?? 1))
        : Math.round(input)
      return valid(value)
    }
    case 'boolean':
      return typeof input === 'boolean' ? valid(input) : invalid('Expected a boolean.')
    case 'string': {
      if (typeof input !== 'string') return invalid('Expected a string.')
      const minimum = schema.minLength ?? 0
      const maximum = schema.maxLength ?? 100000
      if (input.length < minimum) return invalid(`Expected at least ${minimum} characters.`)
      return valid(input.slice(0, maximum))
    }
    case 'enum':
      return typeof input === 'string' && schema.options.some(option => option.id === input)
        ? valid(input)
        : invalid('Expected a declared enum option ID.')
    case 'trigger':
      return typeof input === 'boolean' ? valid(input) : invalid('Expected a trigger boolean.')
    case 'color': {
      if (!isColor(input, false)) return invalid('Expected a finite RGBA tuple.')
      const color = input.map(component => clamp ? clampNumber(component, 0, 1) : component) as unknown as CinemaColor
      return valid(color)
    }
    case 'gradient': {
      const gradient = normalizeGradient(input, clamp)
      return gradient ? valid(gradient) : invalid('Expected valid gradient stops with unique stable IDs.')
    }
    case 'vector2':
    case 'vector3': {
      const length = schema.type === 'vector2' ? 2 : 3
      if (!isNumberTuple(input, length)) return invalid(`Expected a finite vector${length} tuple.`)
      const min = schema.min
      const max = schema.max
      const step = schema.step
      const result = input.map((component, index) => {
        if (!clamp) return component
        const minimum = min?.[index] ?? Number.NEGATIVE_INFINITY
        const maximum = max?.[index] ?? Number.POSITIVE_INFINITY
        return quantizeAndClamp(component, minimum, maximum, step?.[index])
      })
      return valid(result as unknown as CinemaVector2 | CinemaVector3)
    }
    case 'curve': {
      const curve = normalizeCurve(input, clamp)
      return curve ? valid(curve) : invalid('Expected valid curve control points with unique stable IDs.')
    }
    case 'texture':
    case 'asset':
    case 'asset-reference': {
      if (input === null) return valid(null)
      const reference = normalizeAssetReference(input, schema.acceptedRoles)
      return reference ? valid(reference) : invalid('Expected a stable asset reference with an accepted role.')
    }
    default:
      return invalid('Unsupported Cinema parameter type.')
  }
}


function validateStringSchema(
  value: Record<string, unknown>,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (typeof value.default !== 'string') {
    diagnostics.push(schemaDiagnostic(parameterId, 'String parameter default must be a string.'))
    return
  }
  const minimum = typeof value.minLength === 'number' ? value.minLength : value.minLength === undefined ? 0 : Number.NaN
  const maximum = typeof value.maxLength === 'number' ? value.maxLength : value.maxLength === undefined ? 100000 : Number.NaN
  if (!Number.isInteger(minimum) || minimum < 0 || !Number.isInteger(maximum) || maximum < minimum) {
    diagnostics.push(schemaDiagnostic(parameterId, 'String parameter minLength/maxLength must be non-negative integers with minLength <= maxLength.'))
  } else if (value.default.length < minimum || value.default.length > maximum) {
    diagnostics.push(schemaDiagnostic(parameterId, 'String parameter default must satisfy its length bounds.'))
  }
  if (value.multiline !== undefined && typeof value.multiline !== 'boolean') {
    diagnostics.push(schemaDiagnostic(parameterId, 'String parameter multiline hint must be boolean.'))
  }
}

function validateNumericSchema(
  value: Record<string, unknown>,
  type: 'float' | 'integer',
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  const minimum = value.min
  const maximum = value.max
  const defaultValue = value.default
  if (!isFiniteNumber(minimum) || !isFiniteNumber(maximum) || minimum > maximum) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Numeric parameter range must contain finite min/max values with min <= max.'))
    return
  }
  if (!isFiniteNumber(defaultValue) || defaultValue < minimum || defaultValue > maximum) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Numeric parameter default must be finite and within its range.'))
  }
  if (type === 'integer' && (!Number.isInteger(defaultValue) || !Number.isInteger(minimum) || !Number.isInteger(maximum))) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Integer parameter default, min, and max must be integers.'))
  }
  if (value.step != null && (!isFiniteNumber(value.step) || value.step <= 0 || (type === 'integer' && !Number.isInteger(value.step)))) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Numeric parameter step must be a positive finite value of the correct numeric kind.'))
  }
  if (value.logarithmic != null && typeof value.logarithmic !== 'boolean') {
    diagnostics.push(schemaDiagnostic(parameterId, 'Numeric parameter logarithmic hint must be boolean.'))
  }
  if (value.logarithmic === true && minimum <= 0) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Logarithmic numeric parameters require min > 0.'))
  }
  validateOptionalText(value.unit, 'unit', parameterId, diagnostics)
}

function validateEnumSchema(
  value: Record<string, unknown>,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (!Array.isArray(value.options) || value.options.length === 0) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Enum parameters require at least one option.'))
    return
  }
  const ids = new Set<string>()
  for (const option of value.options) {
    if (!isRecord(option)) {
      diagnostics.push(schemaDiagnostic(parameterId, 'Enum options must be objects.'))
      continue
    }
    diagnostics.push(...parseCinemaStableId(option.id, 'enum option').diagnostics)
    if (typeof option.label !== 'string' || option.label.trim().length === 0) {
      diagnostics.push(schemaDiagnostic(parameterId, 'Enum option labels must be non-empty strings.'))
    }
    if (typeof option.id === 'string') {
      if (ids.has(option.id)) diagnostics.push(schemaDiagnostic(parameterId, `Duplicate enum option ID "${option.id}".`))
      ids.add(option.id)
    }
  }
  if (typeof value.default !== 'string' || !ids.has(value.default)) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Enum parameter default must reference a declared option ID.'))
  }
}

function validateVectorSchema(
  value: Record<string, unknown>,
  length: 2 | 3,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (!isNumberTuple(value.default, length)) {
    diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} parameter default must be a finite tuple.`))
    return
  }
  for (const property of ['min', 'max', 'step'] as const) {
    if (value[property] != null && !isNumberTuple(value[property], length)) {
      diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} parameter ${property} must be a finite tuple.`))
    }
  }
  const min = isNumberTuple(value.min, length) ? value.min : null
  const max = isNumberTuple(value.max, length) ? value.max : null
  const step = isNumberTuple(value.step, length) ? value.step : null
  if (min && max && min.some((entry, index) => entry > max[index])) {
    diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} min components must not exceed max components.`))
  }
  if (step && step.some(entry => entry <= 0)) {
    diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} step components must be positive.`))
  }
  if (min && value.default.some((entry, index) => entry < min[index])) {
    diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} default must not be below min.`))
  }
  if (max && value.default.some((entry, index) => entry > max[index])) {
    diagnostics.push(schemaDiagnostic(parameterId, `Vector${length} default must not exceed max.`))
  }
}

function validateAssetSchema(
  value: Record<string, unknown>,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (!Array.isArray(value.acceptedRoles) || value.acceptedRoles.length === 0) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Asset parameters require at least one accepted role.'))
    return
  }
  const roles = new Set<CinemaAssetRole>()
  for (const role of value.acceptedRoles) {
    if (typeof role !== 'string' || !ASSET_ROLES.has(role as CinemaAssetRole)) {
      diagnostics.push(schemaDiagnostic(parameterId, `Unsupported asset role "${String(role)}".`))
      continue
    }
    if (roles.has(role as CinemaAssetRole)) diagnostics.push(schemaDiagnostic(parameterId, `Duplicate accepted asset role "${role}".`))
    roles.add(role as CinemaAssetRole)
  }
  if (value.default != null && !normalizeAssetReference(value.default, [...roles])) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Asset parameter default must use a stable ID and accepted role.'))
  }
}

function validateUiHints(
  value: unknown,
  type: string,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (value == null) return
  if (!isRecord(value)) {
    diagnostics.push(schemaDiagnostic(parameterId, 'Cinema parameter UI hints must be an object.'))
    return
  }
  if (value.control != null) {
    const accepted = CONTROL_HINTS_BY_TYPE[type] ?? []
    if (typeof value.control !== 'string' || !accepted.includes(value.control as CinemaParameterControlHint)) {
      diagnostics.push(schemaDiagnostic(parameterId, `UI control hint "${String(value.control)}" is incompatible with ${type}.`))
    }
  }
  if (value.order != null && (!isFiniteNumber(value.order) || !Number.isInteger(value.order))) {
    diagnostics.push(schemaDiagnostic(parameterId, 'UI order must be a finite integer.'))
  }
  if (value.precision != null && (!isFiniteNumber(value.precision) || !Number.isInteger(value.precision) || value.precision < 0 || value.precision > 12)) {
    diagnostics.push(schemaDiagnostic(parameterId, 'UI precision must be an integer from 0 through 12.'))
  }
  validateOptionalBoolean(value.compact, 'ui.compact', parameterId, diagnostics)
  validateOptionalText(value.placeholder, 'ui.placeholder', parameterId, diagnostics)
  validateOptionalText(value.helpText, 'ui.helpText', parameterId, diagnostics)
}

function validateMasterBindingShape(
  value: unknown,
  parameterId: string,
  options: CinemaParameterSchemaValidationOptions,
  diagnostics: CinemaDiagnostic[],
): void {
  if (value == null) return
  if (options.owner === 'master') {
    diagnostics.push(masterBindingDiagnostic(parameterId, 'Master parameters cannot bind to another master parameter.'))
    return
  }
  if (!isRecord(value)) {
    diagnostics.push(masterBindingDiagnostic(parameterId, 'Master binding must be an object.'))
    return
  }
  diagnostics.push(...parseCinemaStableId(value.masterParameterId, 'parameter').diagnostics)
  if (value.operation != null && value.operation !== 'scale' && value.operation !== 'add' && value.operation !== 'replace') {
    diagnostics.push(masterBindingDiagnostic(parameterId, `Unsupported master binding operation "${String(value.operation)}".`))
  }
  if (value.influence != null && (!isFiniteNumber(value.influence) || value.influence < 0 || value.influence > 1)) {
    diagnostics.push(masterBindingDiagnostic(parameterId, 'Master binding influence must be within 0..1.'))
  }
}

export function validateCinemaMasterParameterBinding(
  targetSchema: CinemaParameterDefinition,
  masterSchema: CinemaParameterDefinition | undefined,
): readonly CinemaDiagnostic[] {
  const binding = targetSchema.masterBinding
  if (!binding) return []
  if (!masterSchema) {
    return [masterBindingDiagnostic(String(targetSchema.id), `Master parameter "${binding.masterParameterId}" is unavailable.`)]
  }
  const operation = binding.operation ?? 'scale'
  if (operation === 'scale' || operation === 'add') {
    if (!isNumericSchema(targetSchema) || !isNumericSchema(masterSchema)) {
      return [masterBindingDiagnostic(String(targetSchema.id), `${operation} master bindings require numeric or vector schemas.`)]
    }
    const targetLength = schemaVectorLength(targetSchema)
    const masterLength = schemaVectorLength(masterSchema)
    if (masterLength !== 1 && targetLength !== masterLength) {
      return [masterBindingDiagnostic(String(targetSchema.id), `${operation} master bindings require a scalar master or matching vector dimensions.`)]
    }
    return []
  }
  if (targetSchema.type !== masterSchema.type && !(isAssetType(targetSchema.type) && isAssetType(masterSchema.type))) {
    return [masterBindingDiagnostic(String(targetSchema.id), 'Replace master bindings require compatible schema types.')]
  }
  if (!isNumericSchema(targetSchema) && (binding.influence ?? 1) !== 1) {
    return [masterBindingDiagnostic(String(targetSchema.id), 'Non-numeric replace bindings require full influence.')]
  }
  return []
}

function normalizeGradient(value: unknown, clamp: boolean): readonly CinemaGradientStop[] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const ids = new Set<string>()
  const stops: CinemaGradientStop[] = []
  for (const item of value) {
    if (!isRecord(item) || !parseCinemaStableId(item.id, 'control point').ok || !isFiniteNumber(item.position) || !isColor(item.color, false)) return null
    if (ids.has(item.id as string)) return null
    ids.add(item.id as string)
    stops.push({
      id: item.id as CinemaGradientStop['id'],
      position: clamp ? clampNumber(item.position, 0, 1) : item.position,
      color: item.color.map(component => clamp ? clampNumber(component, 0, 1) : component) as unknown as CinemaColor,
    })
  }
  return stops.sort((left, right) => left.position - right.position || compareStrings(left.id, right.id))
}

function normalizeCurve(value: unknown, clamp: boolean): readonly CinemaCurvePoint[] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const ids = new Set<string>()
  const points: CinemaCurvePoint[] = []
  for (const item of value) {
    if (!isRecord(item) || !parseCinemaStableId(item.id, 'control point').ok || !isFiniteNumber(item.position) || !isFiniteNumber(item.value)) return null
    if (item.interpolation != null && item.interpolation !== 'step' && item.interpolation !== 'linear' && item.interpolation !== 'smooth') return null
    if (ids.has(item.id as string)) return null
    ids.add(item.id as string)
    points.push({
      id: item.id as CinemaCurvePoint['id'],
      position: clamp ? clampNumber(item.position, 0, 1) : item.position,
      value: item.value,
      ...(item.interpolation ? { interpolation: item.interpolation } : {}),
    })
  }
  return points.sort((left, right) => left.position - right.position || compareStrings(left.id, right.id))
}

function normalizeAssetReference(value: unknown, acceptedRoles: readonly CinemaAssetRole[]): CinemaAssetReference | null {
  if (!isRecord(value) || !parseCinemaStableId(value.assetId, 'asset').ok) return null
  if (typeof value.role !== 'string' || !acceptedRoles.includes(value.role as CinemaAssetRole)) return null
  return { assetId: value.assetId as CinemaAssetReference['assetId'], role: value.role as CinemaAssetRole }
}

function isGradient(value: unknown, normalized: boolean): boolean {
  const result = normalizeGradient(value, normalized)
  return result != null && valuesEqual(result, value)
}

function isCurve(value: unknown, normalized: boolean): boolean {
  const result = normalizeCurve(value, normalized)
  return result != null && valuesEqual(result, value)
}

function isColor(value: unknown, normalized: boolean): value is CinemaColor {
  return isNumberTuple(value, 4) && (!normalized || value.every(component => component >= 0 && component <= 1))
}

function isNumberTuple(value: unknown, length: number): value is readonly number[] {
  return Array.isArray(value) && value.length === length && value.every(isFiniteNumber)
}

function isNumericSchema(schema: CinemaParameterDefinition): boolean {
  return schema.type === 'float' || schema.type === 'integer' || schema.type === 'vector2' || schema.type === 'vector3' || schema.type === 'color'
}

function schemaVectorLength(schema: CinemaParameterDefinition): number {
  if (schema.type === 'vector2') return 2
  if (schema.type === 'vector3') return 3
  if (schema.type === 'color') return 4
  return 1
}

function isAssetType(type: string): boolean {
  return type === 'asset' || type === 'asset-reference'
}

function quantizeAndClamp(value: number, min: number, max: number, step?: number): number {
  let result = clampNumber(value, min, max)
  if (step != null && Number.isFinite(step) && step > 0) {
    const origin = Number.isFinite(min) ? min : 0
    result = origin + Math.round((result - origin) / step) * step
    result = clampNumber(result, min, max)
  }
  return roundFloating(result)
}

function roundFloating(value: number): number {
  if (!Number.isFinite(value)) return value
  // 14 significant digits left enough of the drift from quantizeAndClamp's
  // origin-relative rounding (e.g. min=-1000, step=0.01) uncleaned that a
  // value like 0.1 could come back as 0.10000000000002. 12 digits is still
  // far more precision than any Cinema parameter needs (picometer-scale for
  // a value near 1) while reliably absorbing that drift.
  return Number(value.toPrecision(12))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function valid(value: CinemaParameterValue): { valid: true; value: CinemaParameterValue } {
  return { valid: true, value }
}

function invalid(reason: string): { valid: false; reason: string } {
  return { valid: false, reason }
}

function schemaDiagnostic(
  parameterId: string,
  message: string,
  details: Readonly<Record<string, string | number | boolean | null>> = {},
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PARAMETER_SCHEMA_INVALID',
    severity: 'error',
    message,
    details: { parameterId, ...details },
  })
}

function masterBindingDiagnostic(parameterId: string, message: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_MASTER_BINDING_INVALID',
    severity: 'error',
    message,
    details: { parameterId },
  })
}

function valueDiagnostic(
  schema: CinemaParameterDefinition,
  reason: string,
  parameterPath?: string,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PARAMETER_VALUE_INVALID',
    severity: 'warning',
    message: `Cinema parameter "${schema.id}" used a safe fallback. ${reason}`,
    attribution: parameterPath ? { parameterPath } : undefined,
    details: { parameterId: String(schema.id), parameterType: schema.type },
  })
}

function validateOptionalText(
  value: unknown,
  property: string,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (value != null && (typeof value !== 'string' || value.trim().length === 0)) {
    diagnostics.push(schemaDiagnostic(parameterId, `Cinema parameter ${property} must be a non-empty string when provided.`))
  }
}

function validateOptionalBoolean(
  value: unknown,
  property: string,
  parameterId: string,
  diagnostics: CinemaDiagnostic[],
): void {
  if (value != null && typeof value !== 'boolean') {
    diagnostics.push(schemaDiagnostic(parameterId, `Cinema parameter ${property} must be boolean when provided.`))
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function valuesEqual(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}
