import type {
  Cinema2JsonValue,
  Cinema2ParameterId,
  Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  normalizeCinema2ParameterValue,
  type Cinema2CompiledParameterDefinition,
  type Cinema2CompiledParameterPlan,
  type Cinema2ParameterSchemaDiagnostic,
} from './Cinema2ParameterSchema'

export const CINEMA2_PARAMETER_STATE_SCHEMA_ID = 'drmvyz.cinema2.parameter-state' as const
export const CINEMA2_PARAMETER_STATE_SCHEMA_VERSION = 1 as const

export interface Cinema2SerializedParameterState {
  schemaId: typeof CINEMA2_PARAMETER_STATE_SCHEMA_ID
  schemaVersion: typeof CINEMA2_PARAMETER_STATE_SCHEMA_VERSION
  presetId: Cinema2PresetId
  presetRevision: number
  values: Readonly<Record<string, Cinema2JsonValue>>
}

export interface Cinema2ParameterStateMutationResult {
  ok: boolean
  diagnostics: readonly Cinema2ParameterSchemaDiagnostic[]
}

export interface Cinema2ParameterStateSnapshot {
  presetId: Cinema2PresetId
  presetRevision: number
  persistentValues: Readonly<Record<string, Cinema2JsonValue>>
  runtimeOnlyValues: Readonly<Record<string, Cinema2JsonValue>>
}

/**
 * Canonical authored/user parameter state for one compiled Cinema 2.0 preset.
 * Runtime-only status/action channels live beside persistent values but are
 * intentionally excluded from serialization. Modulation/final target
 * resolution is a later stage and is not represented here.
 */
export class Cinema2ParameterState {
  private readonly definitions = new Map<Cinema2ParameterId, Readonly<Cinema2CompiledParameterDefinition>>()
  private persistentValues: Record<string, Cinema2JsonValue> = {}
  private runtimeOnlyValues: Record<string, Cinema2JsonValue> = {}

  constructor(private readonly plan: Readonly<Cinema2CompiledParameterPlan>) {
    for (const definition of plan.definitions) this.definitions.set(definition.id, definition)
    this.resetAll()
  }

  getDefinition(parameterId: Cinema2ParameterId): Readonly<Cinema2CompiledParameterDefinition> | null {
    return this.definitions.get(parameterId) ?? null
  }

  getValue(parameterId: Cinema2ParameterId): Cinema2JsonValue | undefined {
    const definition = this.definitions.get(parameterId)
    if (!definition) return undefined
    const source = definition.persistence === 'runtime-only' ? this.runtimeOnlyValues : this.persistentValues
    return Object.prototype.hasOwnProperty.call(source, parameterId) ? cloneJson(source[parameterId]) : undefined
  }

  setPersistentValue(parameterId: Cinema2ParameterId, candidate: unknown): Cinema2ParameterStateMutationResult {
    const definition = this.definitions.get(parameterId)
    if (!definition) return failure('CINEMA2_PARAMETER_STATE_UNKNOWN_ID', `Unknown Cinema 2.0 parameter "${parameterId}".`, `values.${parameterId}`)
    if (definition.persistence === 'runtime-only' || definition.readOnly || definition.type === 'trigger') {
      return failure('CINEMA2_PARAMETER_STATE_NOT_PERSISTENT', `Parameter "${parameterId}" does not accept persistent authored/user values.`, `values.${parameterId}`)
    }
    const normalized = normalizeCinema2ParameterValue(definition, candidate, { mode: 'runtime', path: `values.${parameterId}` })
    if (!normalized.ok || normalized.value === undefined) return { ok: false, diagnostics: normalized.diagnostics }
    this.persistentValues = { ...this.persistentValues, [parameterId]: cloneJson(normalized.value) }
    return success()
  }

  setRuntimeOnlyValue(parameterId: Cinema2ParameterId, candidate: unknown): Cinema2ParameterStateMutationResult {
    const definition = this.definitions.get(parameterId)
    if (!definition) return failure('CINEMA2_PARAMETER_STATE_UNKNOWN_ID', `Unknown Cinema 2.0 parameter "${parameterId}".`, `runtimeValues.${parameterId}`)
    if (definition.persistence !== 'runtime-only' || definition.type === 'trigger') {
      return failure('CINEMA2_PARAMETER_STATE_NOT_RUNTIME_ONLY', `Parameter "${parameterId}" is not a runtime-only value channel.`, `runtimeValues.${parameterId}`)
    }
    const normalized = normalizeCinema2ParameterValue(definition, candidate, { mode: 'runtime', path: `runtimeValues.${parameterId}` })
    if (!normalized.ok || normalized.value === undefined) return { ok: false, diagnostics: normalized.diagnostics }
    this.runtimeOnlyValues = { ...this.runtimeOnlyValues, [parameterId]: cloneJson(normalized.value) }
    return success()
  }

  reset(parameterId: Cinema2ParameterId): Cinema2ParameterStateMutationResult {
    const definition = this.definitions.get(parameterId)
    if (!definition) return failure('CINEMA2_PARAMETER_STATE_UNKNOWN_ID', `Unknown Cinema 2.0 parameter "${parameterId}".`, `values.${parameterId}`)
    if (definition.reset === 'none' || definition.type === 'trigger') return success()
    const authoredDefault = this.plan.authoredDefaults[parameterId]
    if (authoredDefault === undefined) {
      return failure('CINEMA2_PARAMETER_STATE_DEFAULT_MISSING', `Parameter "${parameterId}" has no compiled authored default.`, `values.${parameterId}`)
    }
    if (definition.persistence === 'runtime-only') {
      this.runtimeOnlyValues = { ...this.runtimeOnlyValues, [parameterId]: cloneJson(authoredDefault) }
    } else {
      this.persistentValues = { ...this.persistentValues, [parameterId]: cloneJson(authoredDefault) }
    }
    return success()
  }

  resetAll(): void {
    const persistentValues: Record<string, Cinema2JsonValue> = {}
    const runtimeOnlyValues: Record<string, Cinema2JsonValue> = {}
    for (const definition of this.plan.definitions) {
      if (definition.type === 'trigger') continue
      const authoredDefault = this.plan.authoredDefaults[definition.id]
      if (authoredDefault === undefined) continue
      if (definition.persistence === 'runtime-only') runtimeOnlyValues[definition.id] = cloneJson(authoredDefault)
      else persistentValues[definition.id] = cloneJson(authoredDefault)
    }
    this.persistentValues = persistentValues
    this.runtimeOnlyValues = runtimeOnlyValues
  }

  serialize(): string {
    const payload: Cinema2SerializedParameterState = {
      schemaId: CINEMA2_PARAMETER_STATE_SCHEMA_ID,
      schemaVersion: CINEMA2_PARAMETER_STATE_SCHEMA_VERSION,
      presetId: this.plan.presetId,
      presetRevision: this.plan.presetRevision,
      values: sortRecord(this.persistentValues),
    }
    return JSON.stringify(payload)
  }

  restore(serialized: string | Cinema2SerializedParameterState): Cinema2ParameterStateMutationResult {
    let parsed: unknown = serialized
    if (typeof serialized === 'string') {
      try {
        parsed = JSON.parse(serialized)
      } catch (error) {
        return failure('CINEMA2_PARAMETER_STATE_JSON_INVALID', `Parameter state JSON could not be parsed: ${errorMessage(error)}`, '$')
      }
    }
    if (!isPlainObject(parsed)) return failure('CINEMA2_PARAMETER_STATE_SCHEMA_INVALID', 'Parameter state must be an object.', '$')
    if (parsed.schemaId !== CINEMA2_PARAMETER_STATE_SCHEMA_ID) return failure('CINEMA2_PARAMETER_STATE_SCHEMA_INVALID', `Unsupported parameter state schema "${String(parsed.schemaId)}".`, '$.schemaId')
    if (parsed.schemaVersion !== CINEMA2_PARAMETER_STATE_SCHEMA_VERSION) return failure('CINEMA2_PARAMETER_STATE_SCHEMA_INVALID', `Unsupported parameter state schema version "${String(parsed.schemaVersion)}".`, '$.schemaVersion')
    if (parsed.presetId !== this.plan.presetId) return failure('CINEMA2_PARAMETER_STATE_PRESET_MISMATCH', `Parameter state belongs to preset "${String(parsed.presetId)}", not "${this.plan.presetId}".`, '$.presetId')
    if (parsed.presetRevision !== this.plan.presetRevision) return failure('CINEMA2_PARAMETER_STATE_REVISION_MISMATCH', `Parameter state revision "${String(parsed.presetRevision)}" does not match preset revision ${this.plan.presetRevision}.`, '$.presetRevision')
    if (!isPlainObject(parsed.values)) return failure('CINEMA2_PARAMETER_STATE_VALUES_INVALID', 'Parameter state values must be an object.', '$.values')

    const nextValues: Record<string, Cinema2JsonValue> = {}
    for (const definition of this.plan.definitions) {
      if (definition.persistence === 'runtime-only' || definition.type === 'trigger') continue
      const authoredDefault = this.plan.authoredDefaults[definition.id]
      if (authoredDefault !== undefined) nextValues[definition.id] = cloneJson(authoredDefault)
    }
    const diagnostics: Cinema2ParameterSchemaDiagnostic[] = []
    for (const [key, candidate] of Object.entries(parsed.values)) {
      const definition = this.definitions.get(key as Cinema2ParameterId)
      if (!definition) {
        diagnostics.push({ code: 'CINEMA2_PARAMETER_STATE_UNKNOWN_ID', message: `Serialized state contains unknown parameter "${key}".`, path: `$.values.${key}` })
        continue
      }
      if (definition.persistence === 'runtime-only' || definition.readOnly || definition.type === 'trigger') {
        diagnostics.push({ code: 'CINEMA2_PARAMETER_STATE_RUNTIME_ONLY_PERSISTED', message: `Runtime-only parameter "${key}" cannot be restored from persistent state.`, path: `$.values.${key}` })
        continue
      }
      const normalized = normalizeCinema2ParameterValue(definition, candidate, { mode: 'runtime', path: `$.values.${key}` })
      if (!normalized.ok || normalized.value === undefined) diagnostics.push(...normalized.diagnostics)
      else nextValues[key] = cloneJson(normalized.value)
    }
    if (diagnostics.length > 0) return { ok: false, diagnostics: deepFreeze(diagnostics) }

    this.persistentValues = nextValues
    return success()
  }

  getSnapshot(): Readonly<Cinema2ParameterStateSnapshot> {
    return deepFreeze({
      presetId: this.plan.presetId,
      presetRevision: this.plan.presetRevision,
      persistentValues: sortRecord(this.persistentValues),
      runtimeOnlyValues: sortRecord(this.runtimeOnlyValues),
    })
  }
}

function sortRecord(values: Readonly<Record<string, Cinema2JsonValue>>): Readonly<Record<string, Cinema2JsonValue>> {
  const result: Record<string, Cinema2JsonValue> = {}
  for (const key of Object.keys(values).sort()) result[key] = cloneJson(values[key])
  return deepFreeze(result)
}

function success(): Cinema2ParameterStateMutationResult {
  return { ok: true, diagnostics: Object.freeze([]) }
}

function failure(code: string, message: string, path: string): Cinema2ParameterStateMutationResult {
  return { ok: false, diagnostics: Object.freeze([Object.freeze({ code, message, path })]) }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
