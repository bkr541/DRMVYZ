import {
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  createCinemaParameterPath,
  type CinemaCameraId,
  type CinemaNodeId,
  type CinemaParameterNamespace,
  type CinemaParameterPath,
} from './CinemaIdentifiers'
import type {
  CinemaAssetRole,
  CinemaParameterControlHint,
  CinemaParameterDefinition,
  CinemaParameterValue,
} from './CinemaDomain'
import {
  getCinemaParameterDefaultValue,
  normalizeCinemaParameterValue,
  validateCinemaParameterSchemas,
} from './CinemaParameterSchema'

export interface CinemaControlDescriptorOption {
  id: string
  label: string
}

export interface CinemaControlDescriptorHelp {
  description?: string
  helpText?: string
}

export interface CinemaControlDescriptor {
  id: string
  path: CinemaParameterPath
  type: CinemaParameterDefinition['type']
  control: CinemaParameterControlHint
  label: string
  group: string
  order: number
  advanced: boolean
  modulatable: boolean
  value: CinemaParameterValue
  defaultValue: CinemaParameterValue
  min?: number | readonly number[]
  max?: number | readonly number[]
  step?: number | readonly number[]
  unit?: string
  logarithmic?: boolean
  options?: readonly CinemaControlDescriptorOption[]
  acceptedRoles?: readonly CinemaAssetRole[]
  placeholder?: string
  compact: boolean
  precision?: number
  help: CinemaControlDescriptorHelp
  disabled: boolean
  disabledReason?: string
}

export interface CinemaControlDescriptorGenerationInput {
  namespace: CinemaParameterNamespace
  ownerId?: CinemaNodeId | CinemaCameraId
  schemas: readonly CinemaParameterDefinition[]
  values?: Readonly<Record<string, unknown>>
  disabledReasons?: Readonly<Record<string, string>>
}

export interface CinemaControlDescriptorGenerationResult {
  descriptors: readonly CinemaControlDescriptor[]
  diagnostics: CinemaDiagnosticSnapshot
}

const DEFAULT_CONTROL_BY_TYPE: Readonly<Record<CinemaParameterDefinition['type'], CinemaParameterControlHint>> = {
  float: 'slider',
  integer: 'number',
  boolean: 'toggle',
  enum: 'select',
  trigger: 'button',
  color: 'color',
  gradient: 'gradient',
  vector2: 'vector',
  vector3: 'vector',
  curve: 'curve',
  texture: 'texture',
  asset: 'asset-picker',
  'asset-reference': 'asset-picker',
}

export function createCinemaControlDescriptors(
  input: CinemaControlDescriptorGenerationInput,
): CinemaControlDescriptorGenerationResult {
  const diagnostics = [...validateCinemaParameterSchemas(input.schemas, {
    owner: input.namespace === 'master' ? 'master' : input.namespace === 'cameras' ? 'camera' : 'node',
  })]
  const descriptors = input.schemas.map(schema => {
    const path = createCinemaParameterPath(input.namespace, schema.id, input.ownerId)
    const candidate = input.values && Object.prototype.hasOwnProperty.call(input.values, schema.id)
      ? input.values[schema.id]
      : getCinemaParameterDefaultValue(schema)
    const normalized = normalizeCinemaParameterValue(schema, candidate, { parameterPath: path })
    diagnostics.push(...normalized.diagnostics)
    const disabledReason = input.disabledReasons?.[path] ?? input.disabledReasons?.[schema.id]
    return createDescriptor(schema, path, normalized.value, disabledReason)
  })
  descriptors.sort((left, right) => (
    left.order - right.order
    || compareStrings(left.group, right.group)
    || compareStrings(left.id, right.id)
  ))
  return {
    descriptors: deepFreeze(descriptors),
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

function createDescriptor(
  schema: CinemaParameterDefinition,
  path: CinemaParameterPath,
  value: CinemaParameterValue,
  disabledReason?: string,
): CinemaControlDescriptor {
  const descriptor: CinemaControlDescriptor = {
    id: schema.id,
    path,
    type: schema.type,
    control: schema.ui?.control ?? DEFAULT_CONTROL_BY_TYPE[schema.type],
    label: schema.label,
    group: schema.group ?? 'General',
    order: schema.ui?.order ?? 0,
    advanced: schema.advanced ?? false,
    modulatable: schema.type !== 'trigger' && (schema.modulatable ?? false),
    value: cloneValue(value),
    defaultValue: cloneValue(getCinemaParameterDefaultValue(schema)),
    compact: schema.ui?.compact ?? false,
    help: {
      ...(schema.description ? { description: schema.description } : {}),
      ...(schema.ui?.helpText ? { helpText: schema.ui.helpText } : {}),
    },
    disabled: disabledReason != null,
    ...(disabledReason ? { disabledReason } : {}),
    ...(schema.ui?.placeholder ? { placeholder: schema.ui.placeholder } : {}),
    ...(schema.ui?.precision != null ? { precision: schema.ui.precision } : {}),
  }
  if (schema.type === 'float' || schema.type === 'integer') {
    descriptor.min = schema.min
    descriptor.max = schema.max
    descriptor.step = schema.step
    descriptor.unit = schema.unit
    if (schema.type === 'float') descriptor.logarithmic = schema.logarithmic
  } else if (schema.type === 'vector2' || schema.type === 'vector3') {
    descriptor.min = schema.min
    descriptor.max = schema.max
    descriptor.step = schema.step
  } else if (schema.type === 'enum') {
    descriptor.options = schema.options.map(option => ({ id: option.id, label: option.label }))
  } else if (schema.type === 'texture' || schema.type === 'asset' || schema.type === 'asset-reference') {
    descriptor.acceptedRoles = [...schema.acceptedRoles]
  }
  return deepFreeze(descriptor)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function cloneValue<T>(value: T): T {
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
