import {
  createCinemaDiagnostic,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
} from './CinemaDiagnostics'
import {
  parseCinemaNamespacedId,
  parseCinemaStableId,
  type CinemaNodeTypeId,
  type CinemaPortId,
  type CinemaRendererPluginId,
} from './CinemaIdentifiers'
import type { CinemaNodeTypeDefinition } from './CinemaRendererContracts'
import { validateCinemaParameterSchemas } from './CinemaParameterSchema'

export type CinemaQualityTier = 'low' | 'medium' | 'high' | 'ultra'

export interface CinemaFeedbackPortContract {
  /** Current-frame data written into history after downstream consumers have rendered. */
  inputPortId: CinemaPortId
  /** Previous-frame history exposed to current-frame consumers. */
  outputPortId: CinemaPortId
  historyFrames: number
}

export interface CinemaNodeQualityLimits {
  minimumTier: CinemaQualityTier
  maximumTier: CinemaQualityTier
  adaptive: boolean
  maximumEstimatedPassCount: number
  maximumPersistentTargetCount: number
  maximumPingPongPairCount: number
}

export interface CinemaRendererPluginReference {
  id: CinemaRendererPluginId
  available: boolean
}

export interface CinemaNodeRegistrationSource {
  kind: 'built-in' | 'adapter'
  id: string
}

/** Pure metadata only. It never contains a renderer instance, DOM object, or GPU resource. */
export interface CinemaNodeRegistryEntry {
  definition: CinemaNodeTypeDefinition
  rendererPlugin: CinemaRendererPluginReference
  source: CinemaNodeRegistrationSource
  feedback?: CinemaFeedbackPortContract
  quality: CinemaNodeQualityLimits
}

export interface CinemaNodeRegistryCreateResult {
  registry: CinemaNodeDefinitionRegistry
  diagnostics: readonly CinemaDiagnostic[]
}

const QUALITY_RANK: Readonly<Record<CinemaQualityTier, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  ultra: 3,
}

const CAMERA_CAPABILITY_MODES = new Set([
  'none',
  'uniformCamera',
  'worldCamera',
  'nativeCamera',
  'uniform',
  'world',
  'native',
])
const PARAMETER_SUPPORT_MODES = new Set(['live', 'structural', 'conditional', 'unsupported'])
const CAMERA_CONTROLS = new Set([
  'position',
  'rotation',
  'target',
  'fov',
  'roll',
  'orbit',
  'dolly',
  'speed',
  'look-ahead',
  'banking',
  'handheld',
  'beat-punch',
  'shake',
  'depth-of-field',
])

const CINEMA_REGISTRY_CONSTRUCTION_TOKEN = Symbol('CinemaNodeDefinitionRegistry')

export class CinemaNodeDefinitionRegistry {
  readonly diagnostics: readonly CinemaDiagnostic[]
  readonly fingerprint: string
  readonly #entries: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaNodeRegistryEntry>>

  constructor()
  constructor(
    token: typeof CINEMA_REGISTRY_CONSTRUCTION_TOKEN,
    entries: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaNodeRegistryEntry>>,
    diagnostics: readonly CinemaDiagnostic[],
  )
  constructor(
    token?: typeof CINEMA_REGISTRY_CONSTRUCTION_TOKEN,
    entries: ReadonlyMap<CinemaNodeTypeId, Readonly<CinemaNodeRegistryEntry>> = new Map(),
    diagnostics: readonly CinemaDiagnostic[] = [],
  ) {
    const validatedEntries = token === CINEMA_REGISTRY_CONSTRUCTION_TOKEN ? entries : new Map()
    const validatedDiagnostics = token === CINEMA_REGISTRY_CONSTRUCTION_TOKEN ? diagnostics : []
    this.#entries = validatedEntries
    this.diagnostics = deduplicateCinemaDiagnostics(validatedDiagnostics)
    this.fingerprint = createRegistryFingerprint([...validatedEntries.values()])
  }

  get(typeId: CinemaNodeTypeId): Readonly<CinemaNodeRegistryEntry> | undefined {
    return this.#entries.get(typeId)
  }

  has(typeId: CinemaNodeTypeId): boolean {
    return this.#entries.has(typeId)
  }

  list(): readonly Readonly<CinemaNodeRegistryEntry>[] {
    return [...this.#entries.values()].sort((left, right) => compareStrings(left.definition.typeId, right.definition.typeId))
  }

  get size(): number {
    return this.#entries.size
  }
}

export function createCinemaNodeDefinitionRegistry(
  registrations: readonly CinemaNodeRegistryEntry[],
): CinemaNodeRegistryCreateResult {
  const diagnostics: CinemaDiagnostic[] = []
  const entries = new Map<CinemaNodeTypeId, Readonly<CinemaNodeRegistryEntry>>()
  const groups = new Map<string, CinemaNodeRegistryEntry[]>()

  for (const registration of registrations) {
    const typeId = registration?.definition?.typeId
    const key = typeof typeId === 'string' ? typeId : '<invalid-node-type>'
    const group = groups.get(key) ?? []
    group.push(registration)
    groups.set(key, group)
  }

  for (const [key, group] of [...groups.entries()].sort(([left], [right]) => compareStrings(left, right))) {
    if (group.length > 1) {
      const fingerprints = new Set(group.map(createEntryFingerprint))
      diagnostics.push(createCinemaDiagnostic({
        code: fingerprints.size === 1
          ? 'CINEMA_NODE_REGISTRY_DUPLICATE'
          : 'CINEMA_NODE_REGISTRY_INCOMPATIBLE',
        severity: 'error',
        message: fingerprints.size === 1
          ? `Cinema node type "${key}" was registered more than once.`
          : `Cinema node type "${key}" has incompatible registry entries.`,
        details: { typeId: key, registrationCount: group.length },
      }))
      continue
    }

    const entry = group[0]
    const entryDiagnostics = validateCinemaNodeRegistryEntry(entry)
    diagnostics.push(...entryDiagnostics)
    if (entryDiagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')) continue
    entries.set(entry.definition.typeId, deepFreezeEntry(entry))
  }

  const normalizedDiagnostics = deduplicateCinemaDiagnostics(diagnostics)
  return {
    registry: new CinemaNodeDefinitionRegistry(CINEMA_REGISTRY_CONSTRUCTION_TOKEN, entries, normalizedDiagnostics),
    diagnostics: normalizedDiagnostics,
  }
}

export function validateCinemaNodeRegistryEntry(entry: CinemaNodeRegistryEntry): readonly CinemaDiagnostic[] {
  try {
    return validateCinemaNodeRegistryEntryInternal(entry)
  } catch (error) {
    return [createCinemaDiagnostic({
      code: 'CINEMA_NODE_REGISTRY_INVALID',
      severity: 'error',
      message: 'Cinema node registry entry could not be validated safely.',
      details: { reason: error instanceof Error ? error.message : String(error) },
    })]
  }
}

function validateCinemaNodeRegistryEntryInternal(entry: CinemaNodeRegistryEntry): readonly CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  if (!entry || typeof entry !== 'object' || !entry.definition || typeof entry.definition !== 'object') {
    return [createCinemaDiagnostic({
      code: 'CINEMA_NODE_REGISTRY_INVALID',
      severity: 'error',
      message: 'Cinema node registry entry must include a node definition.',
    })]
  }

  if (!isRuntimeNeutralValue(entry)) {
    return [createCinemaDiagnostic({
      code: 'CINEMA_NODE_REGISTRY_INVALID',
      severity: 'error',
      message: 'Cinema node registry entries must contain plain serializable metadata only.',
    })]
  }

  const definition = entry.definition
  const typeId = String(definition.typeId ?? '<missing>')
  diagnostics.push(...parseCinemaNamespacedId(definition.typeId, 'node type').diagnostics)
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    diagnostics.push(registryDiagnostic(typeId, 'Cinema node type version must be a positive integer.'))
  }
  if (!entry.rendererPlugin || typeof entry.rendererPlugin.id !== 'string' || entry.rendererPlugin.id.length === 0) {
    diagnostics.push(registryDiagnostic(typeId, 'Cinema node registry entry must declare a renderer plugin ID.'))
  } else {
    diagnostics.push(...parseCinemaNamespacedId(entry.rendererPlugin.id, 'renderer plugin').diagnostics)
  }
  if (!entry.source || (entry.source.kind !== 'built-in' && entry.source.kind !== 'adapter') || !entry.source.id) {
    diagnostics.push(registryDiagnostic(typeId, 'Cinema node registry entry must declare a built-in or adapter source.'))
  }

  const inputPorts = Array.isArray(definition.inputPorts) ? definition.inputPorts : []
  const outputPorts = Array.isArray(definition.outputPorts) ? definition.outputPorts : []
  const seenPorts = new Set<string>()
  for (const port of [...inputPorts, ...outputPorts]) {
    const portId = String(port?.id ?? '<missing>')
    diagnostics.push(...parseCinemaStableId(port?.id, 'port').diagnostics)
    if (seenPorts.has(portId)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_ID_DUPLICATE',
        severity: 'error',
        message: `Cinema node type "${typeId}" declares duplicate port ID "${portId}".`,
        attribution: { portId },
        details: { typeId, portId },
      }))
    }
    seenPorts.add(portId)
  }
  for (const port of inputPorts) {
    if (port.direction !== 'input') diagnostics.push(portDirectionDiagnostic(typeId, String(port.id), 'input', port.direction))
  }
  for (const port of outputPorts) {
    if (port.direction !== 'output') diagnostics.push(portDirectionDiagnostic(typeId, String(port.id), 'output', port.direction))
  }

  const parameters = Array.isArray(definition.parameters) ? definition.parameters : []
  diagnostics.push(...validateCinemaParameterSchemas(parameters, { owner: 'node' }))
  const parameterIds = new Set<string>()
  for (const parameter of parameters) {
    const parameterId = String(parameter?.id ?? '<missing>')
    diagnostics.push(...parseCinemaStableId(parameter?.id, 'parameter').diagnostics)
    if (parameterIds.has(parameterId)) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_ID_DUPLICATE',
        severity: 'error',
        message: `Cinema node type "${typeId}" declares duplicate parameter ID "${parameterId}".`,
        details: { typeId, parameterId },
      }))
    }
    parameterIds.add(parameterId)
  }

  if (definition.parameterCapabilities !== undefined) {
    if (!Array.isArray(definition.parameterCapabilities)) {
      diagnostics.push(registryDiagnostic(typeId, 'Cinema node parameter capabilities must be an array when declared.'))
    } else {
      const capabilityIds = new Set<string>()
      for (const capability of definition.parameterCapabilities) {
        const parameterId = String(capability?.parameterId ?? '<missing>')
        diagnostics.push(...parseCinemaStableId(capability?.parameterId, 'parameter capability').diagnostics)
        if (!parameterIds.has(parameterId)) {
          diagnostics.push(registryWarning(typeId, `Cinema parameter capability "${parameterId}" does not match a declared parameter and will be ignored.`))
        }
        if (capabilityIds.has(parameterId)) {
          diagnostics.push(registryDiagnostic(typeId, `Cinema parameter capability "${parameterId}" is declared more than once.`))
        }
        capabilityIds.add(parameterId)
        if (!PARAMETER_SUPPORT_MODES.has(String(capability?.support))) {
          diagnostics.push(registryDiagnostic(typeId, `Cinema parameter capability "${parameterId}" has an unsupported support mode.`))
        }
      }
    }
  }

  diagnostics.push(...validateCameraCapability(typeId, definition.capabilities?.camera))

  if (entry.feedback) {
    const input = inputPorts.find(port => port.id === entry.feedback?.inputPortId)
    const output = outputPorts.find(port => port.id === entry.feedback?.outputPortId)
    const compatibleTypes = input != null && output != null && (
      input.dataType === 'any'
      || output.dataType === 'any'
      || input.dataType === output.dataType
      || input.accepts?.includes(output.dataType) === true
      || input.accepts?.includes('any') === true
    )
    if (
      !input
      || !output
      || (input.cardinality ?? 'one') !== 'one'
      || !compatibleTypes
      || !Number.isInteger(entry.feedback.historyFrames)
      || entry.feedback.historyFrames < 1
    ) {
      diagnostics.push(createCinemaDiagnostic({
        code: 'CINEMA_FEEDBACK_CONTRACT_INVALID',
        severity: 'error',
        message: `Cinema node type "${typeId}" has an invalid feedback port contract.`,
        details: {
          typeId,
          inputPortId: String(entry.feedback.inputPortId),
          outputPortId: String(entry.feedback.outputPortId),
          historyFrames: Number.isFinite(entry.feedback.historyFrames) ? entry.feedback.historyFrames : null,
        },
      }))
    }
  }

  diagnostics.push(...validateQualityLimits(entry))
  return deduplicateCinemaDiagnostics(diagnostics)
}

function validateCameraCapability(typeId: string, value: unknown): CinemaDiagnostic[] {
  if (!value || typeof value !== 'object') {
    return [cameraCapabilityDiagnostic(typeId, 'Cinema node definitions must declare a camera capability descriptor.')]
  }
  const camera = value as Record<string, unknown>
  const diagnostics: CinemaDiagnostic[] = []
  const mode = typeof camera.mode === 'string' ? camera.mode : '<missing>'
  const controls = Array.isArray(camera.controls) ? camera.controls : null
  if (!CAMERA_CAPABILITY_MODES.has(mode)) {
    diagnostics.push(cameraCapabilityDiagnostic(typeId, `Cinema node camera capability mode "${mode}" is unsupported.`))
  }
  if (!controls || controls.some(control => typeof control !== 'string' || !CAMERA_CONTROLS.has(control))) {
    diagnostics.push(cameraCapabilityDiagnostic(typeId, 'Cinema node camera controls contain an unsupported value.'))
  }
  if (typeof camera.autoDirector !== 'boolean') {
    diagnostics.push(cameraCapabilityDiagnostic(typeId, 'Cinema node camera Auto Director support must be boolean.'))
  }
  const ownsNativeCamera = mode === 'none' || mode === 'nativeCamera' || mode === 'native'
  if (ownsNativeCamera && ((controls?.length ?? 0) > 0 || camera.autoDirector === true)) {
    diagnostics.push(cameraCapabilityDiagnostic(
      typeId,
      `Cinema node camera capability "${mode}" cannot advertise shared controls or Auto Director support.`,
    ))
  }
  return diagnostics
}

function cameraCapabilityDiagnostic(typeId: string, message: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_CAMERA_CAPABILITY_MISMATCH',
    severity: 'error',
    message,
    details: { typeId },
  })
}

function validateQualityLimits(entry: CinemaNodeRegistryEntry): CinemaDiagnostic[] {
  const typeId = String(entry.definition.typeId)
  const quality = entry.quality
  const cost = entry.definition.cost
  const invalid = !quality
    || typeof quality.adaptive !== 'boolean'
    || !(quality.minimumTier in QUALITY_RANK)
    || !(quality.maximumTier in QUALITY_RANK)
    || QUALITY_RANK[quality.minimumTier] > QUALITY_RANK[quality.maximumTier]
    || !isNonNegativeInteger(quality.maximumEstimatedPassCount)
    || !isNonNegativeInteger(quality.maximumPersistentTargetCount)
    || !isNonNegativeInteger(quality.maximumPingPongPairCount)
    || cost.estimatedPassCount > quality.maximumEstimatedPassCount
    || cost.persistentTargetCount > quality.maximumPersistentTargetCount
    || cost.pingPongPairCount > quality.maximumPingPongPairCount

  return invalid ? [createCinemaDiagnostic({
    code: 'CINEMA_QUALITY_DECLARATION_INVALID',
    severity: 'error',
    message: `Cinema node type "${typeId}" has missing or inconsistent quality limits.`,
    details: { typeId },
  })] : []
}

function registryDiagnostic(typeId: string, message: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_NODE_REGISTRY_INVALID',
    severity: 'error',
    message,
    details: { typeId },
  })
}

function registryWarning(typeId: string, message: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_NODE_REGISTRY_INVALID',
    severity: 'warning',
    message,
    details: { typeId },
  })
}

function portDirectionDiagnostic(
  typeId: string,
  portId: string,
  expectedDirection: 'input' | 'output',
  actualDirection: string,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_PORT_DIRECTION_INVALID',
    severity: 'error',
    message: `Cinema port "${portId}" on node type "${typeId}" must be declared as ${expectedDirection}.`,
    attribution: { portId },
    details: { typeId, expectedDirection, actualDirection: String(actualDirection) },
  })
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0
}

function deepFreezeEntry(entry: CinemaNodeRegistryEntry): Readonly<CinemaNodeRegistryEntry> {
  return deepFreeze(cloneSerializable(entry)) as Readonly<CinemaNodeRegistryEntry>
}

function cloneSerializable<T>(value: T): T {
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

function isRuntimeNeutralValue(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (ancestors.has(value)) return false

  if (Array.isArray(value)) {
    ancestors.add(value)
    const ownKeys = Reflect.ownKeys(value)
    const validKeys = Object.keys(value).length === value.length
      && ownKeys.every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)))
    const valid = validKeys && value.every(entry => isRuntimeNeutralValue(entry, ancestors))
    ancestors.delete(value)
    return valid
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  ancestors.add(value)
  const valid = Reflect.ownKeys(value).every(key => (
    typeof key === 'string'
    && Object.prototype.propertyIsEnumerable.call(value, key)
    && isRuntimeNeutralValue((value as Record<string, unknown>)[key], ancestors)
  ))
  ancestors.delete(value)
  return valid
}

function createEntryFingerprint(entry: CinemaNodeRegistryEntry): string {
  try {
    return stableStringify(entry)
  } catch (error) {
    return `invalid-entry:${error instanceof Error ? error.message : String(error)}`
  }
}

function createRegistryFingerprint(entries: readonly Readonly<CinemaNodeRegistryEntry>[]): string {
  const serialized = stableStringify([...entries].sort((left, right) => (
    compareStrings(left.definition.typeId, right.definition.typeId)
  )))
  return `cinema-registry-${fnv1a32(serialized).toString(16).padStart(8, '0')}`
}

function stableStringify(value: unknown, ancestors: Set<object> = new Set()): string {
  if (value && typeof value === 'object') {
    if (ancestors.has(value)) return '"[Circular]"'
    ancestors.add(value)
    const serialized = Array.isArray(value)
      ? `[${value.map(entry => stableStringify(entry, ancestors)).join(',')}]`
      : `{${Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => compareStrings(left, right))
          .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested, ancestors)}`)
          .join(',')}}`
    ancestors.delete(value)
    return serialized
  }
  return JSON.stringify(value) ?? 'undefined'
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
