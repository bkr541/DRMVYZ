import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import {
  createCinemaParameterPath,
  parseCinemaParameterPath,
  type CinemaCameraId,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaParameterNamespace,
  type CinemaParameterPath,
} from './CinemaIdentifiers'
import type {
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaMasterParameterBinding,
  CinemaParameterDefinition,
  CinemaParameterValue,
} from './CinemaDomain'
import type { CinemaNodeDefinitionRegistry } from './CinemaNodeRegistry'
import {
  getCinemaParameterDefaultValue,
  normalizeCinemaParameterValue,
  validateCinemaMasterParameterBinding,
  validateCinemaParameterSchema,
  validateCinemaParameterSchemas,
} from './CinemaParameterSchema'

export const CINEMA_PARAMETER_RESOLUTION_ORDER = Object.freeze([
  'definition-default',
  'saved-preset',
  'instance-override',
  'master-influence',
  'modulation-snapshot',
  'performance-override',
  'safety-clamp',
  'final-runtime-value',
] as const)

export type CinemaParameterResolutionStage = typeof CINEMA_PARAMETER_RESOLUTION_ORDER[number]
export type CinemaTransientParameterSnapshot = Readonly<Record<string, unknown>>

export interface CinemaParameterResolutionTraceEntry {
  stage: CinemaParameterResolutionStage
  applied: boolean
  value: CinemaParameterValue
}

export interface CinemaResolvedParameterEntry {
  path: CinemaParameterPath
  schema: Readonly<CinemaParameterDefinition>
  value: CinemaParameterValue
  trace: readonly CinemaParameterResolutionTraceEntry[]
}

export interface CinemaParameterValueResolutionInput {
  path: CinemaParameterPath
  schema: CinemaParameterDefinition
  savedValue?: unknown
  instanceOverride?: unknown
  resolvedMasterSchemas?: Readonly<Record<string, CinemaParameterDefinition>>
  resolvedMasterValues?: Readonly<Record<string, CinemaParameterValue>>
  modulationValue?: unknown
  performanceValue?: unknown
}

export interface CinemaParameterValueResolutionResult {
  ok: boolean
  value: CinemaParameterValue
  trace: readonly CinemaParameterResolutionTraceEntry[]
  diagnostics: readonly CinemaDiagnostic[]
}

export interface CinemaParameterDestinationContext {
  composition: CinemaCompositionDefinition
  registry: CinemaNodeDefinitionRegistry
  /** Runtime-neutral schemas supplied by the shared Cinema camera service. */
  cameraParameterSchemas?: Readonly<Record<string, readonly CinemaParameterDefinition[]>>
}

export interface CinemaResolvedParameterDestination {
  path: CinemaParameterPath
  namespace: CinemaParameterNamespace
  ownerId: string | null
  ownerKind: 'master' | 'node' | 'effect' | 'camera'
  schema: Readonly<CinemaParameterDefinition>
  savedValue: unknown
}

export type CinemaParameterDestinationResolutionResult =
  | { ok: true; destination: CinemaResolvedParameterDestination; diagnostics: readonly [] }
  | { ok: false; destination: null; diagnostics: readonly CinemaDiagnostic[] }

export interface CinemaParameterSnapshotResolutionInput extends CinemaParameterDestinationContext {
  instance?: CinemaCompositionInstance | null
  modulationSnapshot?: CinemaTransientParameterSnapshot
  performanceOverrides?: CinemaTransientParameterSnapshot
}

export interface CinemaParameterResolutionSnapshot {
  ok: boolean
  values: Readonly<Record<string, CinemaParameterValue>>
  entries: readonly CinemaResolvedParameterEntry[]
  diagnostics: CinemaDiagnosticSnapshot
}

export function resolveCinemaParameterValue(
  input: CinemaParameterValueResolutionInput,
): CinemaParameterValueResolutionResult {
  try {
    const diagnostics: CinemaDiagnostic[] = [...validateCinemaParameterSchema(input.schema)]
    let current = cloneValue(getCinemaParameterDefaultValue(input.schema))
    const trace: CinemaParameterResolutionTraceEntry[] = [traceEntry('definition-default', true, current)]

    current = applyReplacementStage(
      'saved-preset',
      input.savedValue,
      current,
      input.schema,
      input.path,
      diagnostics,
      trace,
    )
    current = applyReplacementStage(
      'instance-override',
      input.instanceOverride,
      current,
      input.schema,
      input.path,
      diagnostics,
      trace,
    )

    const masterResult = applyMasterInfluence(
      current,
      input.schema,
      input.resolvedMasterSchemas ?? {},
      input.resolvedMasterValues ?? {},
      input.path,
    )
    diagnostics.push(...masterResult.diagnostics)
    current = masterResult.value
    trace.push(traceEntry('master-influence', masterResult.applied, current))

    current = applyReplacementStage(
      'modulation-snapshot',
      input.modulationValue,
      current,
      input.schema,
      input.path,
      diagnostics,
      trace,
    )
    current = applyReplacementStage(
      'performance-override',
      input.performanceValue,
      current,
      input.schema,
      input.path,
      diagnostics,
      trace,
    )

    const clamped = normalizeCinemaParameterValue(input.schema, current, {
      parameterPath: input.path,
      clamp: true,
    })
    diagnostics.push(...clamped.diagnostics)
    current = clamped.valid ? clamped.value : cloneValue(getCinemaParameterDefaultValue(input.schema))
    trace.push(traceEntry('safety-clamp', true, current))
    trace.push(traceEntry('final-runtime-value', true, current))

    const normalizedDiagnostics = deduplicateCinemaDiagnostics(diagnostics)
    return deepFreeze({
      ok: !normalizedDiagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal'),
      value: cloneValue(current),
      trace,
      diagnostics: normalizedDiagnostics,
    })
  } catch (error) {
    const fallback = cloneValue(getCinemaParameterDefaultValue(input.schema))
    const diagnostic = createCinemaDiagnostic({
      code: 'CINEMA_PARAMETER_RESOLUTION_FAILED',
      severity: 'error',
      message: `Cinema parameter "${input.schema.id}" resolution failed safely.`,
      attribution: { parameterPath: input.path },
      details: { reason: error instanceof Error ? error.message : String(error) },
    })
    return deepFreeze({
      ok: false,
      value: fallback,
      trace: [
        traceEntry('definition-default', true, fallback),
        traceEntry('final-runtime-value', true, fallback),
      ],
      diagnostics: [diagnostic],
    })
  }
}

export function resolveCinemaParameterDestination(
  value: unknown,
  context: CinemaParameterDestinationContext,
): CinemaParameterDestinationResolutionResult {
  const parsed = parseCinemaParameterPath(value)
  if (!parsed.ok) return { ok: false, destination: null, diagnostics: parsed.diagnostics }
  const path = parsed.value

  if (parsed.namespace === 'master') {
    const schema = context.composition.masterParameters.find(candidate => candidate.id === parsed.parameterId)
    return schema
      ? destinationSuccess(path, parsed.namespace, null, 'master', schema, context.composition.masterValues[parsed.parameterId as CinemaParameterId])
      : destinationFailure(path, `Master parameter "${parsed.parameterId}" is unavailable.`)
  }

  if (parsed.namespace === 'cameras') {
    const camera = context.composition.cameras.find(candidate => candidate.id === parsed.ownerId)
    const schemas = parsed.ownerId ? context.cameraParameterSchemas?.[parsed.ownerId] : undefined
    const schema = schemas?.find(candidate => candidate.id === parsed.parameterId)
    return camera && schema
      ? destinationSuccess(path, parsed.namespace, parsed.ownerId, 'camera', schema, camera.parameterValues[parsed.parameterId as CinemaParameterId])
      : destinationFailure(path, `Camera parameter destination "${path}" is unavailable.`)
  }

  const node = context.composition.nodes.find(candidate => candidate.id === parsed.ownerId)
  if (!node) return destinationFailure(path, `Cinema node destination owner "${parsed.ownerId}" is unavailable.`)
  if (parsed.namespace === 'effects' && node.family !== 'effect') {
    return destinationFailure(path, `Cinema effects destination "${path}" does not reference an effect node.`)
  }
  const entry = context.registry.get(node.typeId)
  const schema = entry?.definition.parameters.find(candidate => candidate.id === parsed.parameterId)
  if (!schema) return destinationFailure(path, `Cinema parameter destination "${path}" is unavailable.`)
  return destinationSuccess(
    path,
    parsed.namespace,
    parsed.ownerId,
    parsed.namespace === 'effects' ? 'effect' : 'node',
    schema,
    node.parameterValues[parsed.parameterId as CinemaParameterId],
  )
}

export function resolveCinemaParameterSnapshot(
  input: CinemaParameterSnapshotResolutionInput,
): CinemaParameterResolutionSnapshot {
  try {
    const diagnostics: CinemaDiagnostic[] = []
    const entries: CinemaResolvedParameterEntry[] = []
    const values: Record<string, CinemaParameterValue> = {}
    const masterSchemas: Record<string, CinemaParameterDefinition> = {}
    const masterValues: Record<string, CinemaParameterValue> = {}

    diagnostics.push(...validateCinemaParameterSchemas(input.composition.masterParameters, { owner: 'master' }))
    const masterInstanceValues = input.instance?.compositionId === input.composition.id
      ? input.instance.masterOverrides
      : {}
    if (input.instance && input.instance.compositionId !== input.composition.id) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_PARAMETER_RESOLUTION_FAILED',
        severity: 'error',
        message: 'Cinema composition instance does not belong to the composition being resolved.',
        attribution: { compositionId: input.composition.id, instanceId: input.instance.id },
      }))
    }

    for (const schema of [...input.composition.masterParameters].sort(compareSchemas)) {
      const path = createCinemaParameterPath('master', schema.id)
      const result = resolveCinemaParameterValue({
        path,
        schema,
        savedValue: ownValue(input.composition.masterValues, schema.id),
        instanceOverride: ownValue(masterInstanceValues, schema.id),
        modulationValue: input.modulationSnapshot?.[path],
        performanceValue: input.performanceOverrides?.[path],
      })
      diagnostics.push(...result.diagnostics)
      masterSchemas[schema.id] = schema
      masterValues[schema.id] = result.value
      values[path] = result.value
      entries.push({ path, schema: cloneValue(schema), value: result.value, trace: result.trace })
    }

    const nodeOverrides = new Map(
      (input.instance?.compositionId === input.composition.id ? input.instance.nodeOverrides : [])
        .map(override => [override.nodeId, override.values]),
    )
    for (const node of [...input.composition.nodes].sort((left, right) => compareStrings(left.id, right.id))) {
      const entry = input.registry.get(node.typeId)
      if (!entry) {
        diagnostics.push(destinationUnavailableDiagnostic(
          `nodes.${node.id}`,
          `Cinema node type "${node.typeId}" is unavailable during parameter resolution.`,
          node.id,
        ))
        continue
      }
      diagnostics.push(...validateCinemaParameterSchemas(entry.definition.parameters, { owner: 'node' }))
      const namespace: CinemaParameterNamespace = node.family === 'effect' ? 'effects' : 'nodes'
      for (const schema of [...entry.definition.parameters].sort(compareSchemas)) {
        const path = createCinemaParameterPath(namespace, schema.id, node.id)
        const result = resolveCinemaParameterValue({
          path,
          schema,
          savedValue: ownValue(node.parameterValues, schema.id),
          instanceOverride: ownValue(nodeOverrides.get(node.id) ?? {}, schema.id),
          resolvedMasterSchemas: masterSchemas,
          resolvedMasterValues: masterValues,
          modulationValue: input.modulationSnapshot?.[path],
          performanceValue: input.performanceOverrides?.[path],
        })
        diagnostics.push(...result.diagnostics)
        values[path] = result.value
        entries.push({ path, schema: cloneValue(schema), value: result.value, trace: result.trace })
      }
    }

    const cameraOverrides = new Map(
      (input.instance?.compositionId === input.composition.id ? input.instance.cameraOverrides : [])
        .map(override => [override.cameraId, override.values]),
    )
    for (const camera of [...input.composition.cameras].sort((left, right) => compareStrings(left.id, right.id))) {
      const schemas = input.cameraParameterSchemas?.[camera.id]
      if (!schemas) {
        for (const parameterId of Object.keys(camera.parameterValues).sort(compareStrings)) {
          const path = `cameras.${camera.id}.${parameterId}`
          diagnostics.push(destinationUnavailableDiagnostic(
            path,
            `Camera parameter "${parameterId}" has no registered schema.`,
            undefined,
            camera.id,
          ))
        }
        continue
      }
      diagnostics.push(...validateCinemaParameterSchemas(schemas, { owner: 'camera' }))
      for (const schema of [...schemas].sort(compareSchemas)) {
        const path = createCinemaParameterPath('cameras', schema.id, camera.id)
        const result = resolveCinemaParameterValue({
          path,
          schema,
          savedValue: ownValue(camera.parameterValues, schema.id),
          instanceOverride: ownValue(cameraOverrides.get(camera.id) ?? {}, schema.id),
          resolvedMasterSchemas: masterSchemas,
          resolvedMasterValues: masterValues,
          modulationValue: input.modulationSnapshot?.[path],
          performanceValue: input.performanceOverrides?.[path],
        })
        diagnostics.push(...result.diagnostics)
        values[path] = result.value
        entries.push({ path, schema: cloneValue(schema), value: result.value, trace: result.trace })
      }
    }

    entries.sort((left, right) => compareStrings(left.path, right.path))
    const snapshot = createCinemaDiagnosticSnapshot(diagnostics)
    return deepFreeze({
      ok: snapshot.counts.error === 0 && snapshot.counts.fatal === 0,
      values,
      entries,
      diagnostics: snapshot,
    })
  } catch (error) {
    const diagnostic = createCinemaDiagnostic({
      code: 'CINEMA_PARAMETER_RESOLUTION_FAILED',
      severity: 'error',
      message: 'Cinema parameter snapshot resolution failed safely.',
      attribution: { compositionId: String(input.composition?.id ?? '') },
      details: { reason: error instanceof Error ? error.message : String(error) },
    })
    return deepFreeze({
      ok: false,
      values: {},
      entries: [],
      diagnostics: createCinemaDiagnosticSnapshot([diagnostic]),
    })
  }
}

function applyReplacementStage(
  stage: Extract<CinemaParameterResolutionStage,
    'saved-preset' | 'instance-override' | 'modulation-snapshot' | 'performance-override'>,
  input: unknown,
  current: CinemaParameterValue,
  schema: CinemaParameterDefinition,
  path: CinemaParameterPath,
  diagnostics: CinemaDiagnostic[],
  trace: CinemaParameterResolutionTraceEntry[],
): CinemaParameterValue {
  if (input === undefined) {
    trace.push(traceEntry(stage, false, current))
    return current
  }
  const normalized = normalizeCinemaParameterValue(schema, input, { parameterPath: path, clamp: false })
  diagnostics.push(...normalized.diagnostics)
  const next = normalized.valid ? normalized.value : current
  trace.push(traceEntry(stage, normalized.valid, next))
  return next
}

function applyMasterInfluence(
  current: CinemaParameterValue,
  schema: CinemaParameterDefinition,
  masterSchemas: Readonly<Record<string, CinemaParameterDefinition>>,
  masterValues: Readonly<Record<string, CinemaParameterValue>>,
  path: CinemaParameterPath,
): { value: CinemaParameterValue; applied: boolean; diagnostics: readonly CinemaDiagnostic[] } {
  const binding = schema.masterBinding
  if (!binding) return { value: current, applied: false, diagnostics: [] }
  const masterSchema = masterSchemas[binding.masterParameterId]
  const diagnostics = validateCinemaMasterParameterBinding(schema, masterSchema)
  const masterValue = masterValues[binding.masterParameterId]
  if (diagnostics.length > 0 || masterValue === undefined) {
    const missing = masterValue === undefined && diagnostics.length === 0
      ? [createCinemaDiagnostic({
          code: 'CINEMA_MASTER_BINDING_INVALID',
          severity: 'error',
          message: `Master value "${binding.masterParameterId}" is unavailable.`,
          attribution: { parameterPath: path },
          details: { parameterId: String(schema.id), masterParameterId: String(binding.masterParameterId) },
        })]
      : []
    return { value: current, applied: false, diagnostics: [...diagnostics, ...missing] }
  }
  const influenced = calculateMasterInfluence(current, masterValue, binding)
  if (influenced == null) {
    return {
      value: current,
      applied: false,
      diagnostics: [createCinemaDiagnostic({
        code: 'CINEMA_MASTER_BINDING_INVALID',
        severity: 'error',
        message: `Master binding for Cinema parameter "${schema.id}" could not be applied safely.`,
        attribution: { parameterPath: path },
      })],
    }
  }
  return { value: influenced, applied: true, diagnostics: [] }
}

function calculateMasterInfluence(
  target: CinemaParameterValue,
  master: CinemaParameterValue,
  binding: CinemaMasterParameterBinding,
): CinemaParameterValue | null {
  const operation = binding.operation ?? 'scale'
  const influence = binding.influence ?? 1
  if (operation === 'replace' && (!isNumericValue(target) || !isNumericValue(master))) {
    return influence === 1 ? cloneValue(master) : cloneValue(target)
  }
  const targetComponents = numericComponents(target)
  const masterComponents = numericComponents(master)
  if (!targetComponents || !masterComponents) return null
  if (masterComponents.length !== 1 && masterComponents.length !== targetComponents.length) return null
  const result = targetComponents.map((component, index) => {
    const masterComponent = masterComponents.length === 1 ? masterComponents[0] : masterComponents[index]
    if (operation === 'scale') return component * (1 + (masterComponent - 1) * influence)
    if (operation === 'add') return component + masterComponent * influence
    return component + (masterComponent - component) * influence
  })
  if (result.some(component => !Number.isFinite(component))) return null
  return Array.isArray(target) ? result as unknown as CinemaParameterValue : result[0]
}

function destinationSuccess(
  path: CinemaParameterPath,
  namespace: CinemaParameterNamespace,
  ownerId: string | null,
  ownerKind: CinemaResolvedParameterDestination['ownerKind'],
  schema: CinemaParameterDefinition,
  savedValue: unknown,
): CinemaParameterDestinationResolutionResult {
  return {
    ok: true,
    destination: { path, namespace, ownerId, ownerKind, schema, savedValue },
    diagnostics: [],
  }
}

function destinationFailure(path: CinemaParameterPath, message: string): CinemaParameterDestinationResolutionResult {
  return { ok: false, destination: null, diagnostics: [destinationUnavailableDiagnostic(path, message)] }
}

function destinationUnavailableDiagnostic(
  path: string,
  message: string,
  nodeId?: CinemaNodeId,
  cameraId?: CinemaCameraId,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PARAMETER_DESTINATION_UNAVAILABLE',
    severity: 'error',
    message,
    attribution: {
      parameterPath: path,
      ...(nodeId ? { nodeId } : {}),
      ...(cameraId ? { cameraId } : {}),
    },
  })
}

function traceEntry(
  stage: CinemaParameterResolutionStage,
  applied: boolean,
  value: CinemaParameterValue,
): CinemaParameterResolutionTraceEntry {
  return { stage, applied, value: cloneValue(value) }
}

function ownValue(
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  id: CinemaParameterId,
): unknown {
  return Object.prototype.hasOwnProperty.call(values, id) ? values[id] : undefined
}

function numericComponents(value: CinemaParameterValue): readonly number[] | null {
  if (typeof value === 'number' && Number.isFinite(value)) return [value]
  if (Array.isArray(value) && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as readonly number[]
  }
  return null
}

function isNumericValue(value: CinemaParameterValue): boolean {
  return numericComponents(value) != null
}

function compareSchemas(left: CinemaParameterDefinition, right: CinemaParameterDefinition): number {
  const leftOrder = left.ui?.order ?? 0
  const rightOrder = right.ui?.order ?? 0
  return leftOrder - rightOrder || compareStrings(left.id, right.id)
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
