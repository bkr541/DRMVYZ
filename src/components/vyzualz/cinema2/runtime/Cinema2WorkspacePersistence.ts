import type {
  Cinema2JsonValue,
  Cinema2MediaSlotId,
  Cinema2ParameterId,
  Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MediaPresentation, Cinema2MediaSource } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  cinema2NativePresetRegistry,
  type Cinema2PresetRegistry,
} from '../presets/Cinema2PresetRegistry'
import type {
  Cinema2WorkspaceMediaSlotState,
  Cinema2WorkspacePresetState,
} from './Cinema2WorkspaceSession'

export const CINEMA2_WORKSPACE_SCHEMA_ID = 'drmvyz.cinema2.workspace' as const
export const CINEMA2_WORKSPACE_SCHEMA_VERSION = 1 as const
export const CINEMA2_LEGACY_ARCHIVE_SCHEMA_ID = 'drmvyz.cinema2.legacy-archive' as const
export const CINEMA2_LEGACY_ARCHIVE_SCHEMA_VERSION = 1 as const
export const CINEMA2_LEGACY_MIGRATION_VERSION = 1 as const

export interface Cinema2LegacyArchive {
  schemaId: typeof CINEMA2_LEGACY_ARCHIVE_SCHEMA_ID
  schemaVersion: typeof CINEMA2_LEGACY_ARCHIVE_SCHEMA_VERSION
  source: 'legacy-cinema-store'
  sourceSchemaId: string | null
  sourceSchemaVersion: number | null
  archivedAt: string
  payload: Cinema2JsonValue
}

export interface Cinema2PersistedPresetState extends Cinema2WorkspacePresetState {
  /** Stable semantic look/variant identity for cue and migration callers. */
  lookId: string | null
}

export interface Cinema2WorkspaceDocument {
  schemaId: typeof CINEMA2_WORKSPACE_SCHEMA_ID
  schemaVersion: typeof CINEMA2_WORKSPACE_SCHEMA_VERSION
  /** Increments only for explicit activations, not runtime-retirement snapshots. */
  activationRevision: number
  activePresetId: Cinema2PresetId | null
  presets: readonly Readonly<Cinema2PersistedPresetState>[]
  legacyArchive: Readonly<Cinema2LegacyArchive> | null
  /** Idempotency marker for the raw legacy Cinema document copied into this workspace. */
  legacyMigrationVersion: number
  legacyMigrationFingerprint: string | null
}

export interface Cinema2WorkspaceDiagnostic {
  code: string
  message: string
  path: string
}

export type Cinema2WorkspaceParseResult =
  | { ok: true; value: Readonly<Cinema2WorkspaceDocument>; diagnostics: readonly Cinema2WorkspaceDiagnostic[] }
  | { ok: false; value: Readonly<Cinema2WorkspaceDocument>; diagnostics: readonly Cinema2WorkspaceDiagnostic[] }

export interface Cinema2WorkspaceLookSelection {
  id: string
  parameterId?: Cinema2ParameterId
  value?: Cinema2JsonValue
}

export interface Cinema2WorkspaceActivationRequest {
  presetId: Cinema2PresetId
  look?: Readonly<Cinema2WorkspaceLookSelection> | null
  parameterPatch?: Readonly<Record<string, Cinema2JsonValue>>
  mediaPatch?: readonly Readonly<Cinema2WorkspaceMediaSlotState>[]
}

export type Cinema2WorkspaceActivationResult =
  | {
      ok: true
      document: Readonly<Cinema2WorkspaceDocument>
      state: Readonly<Cinema2PersistedPresetState>
      diagnostics: readonly Cinema2WorkspaceDiagnostic[]
    }
  | {
      ok: false
      document: Readonly<Cinema2WorkspaceDocument>
      state: null
      diagnostics: readonly Cinema2WorkspaceDiagnostic[]
    }

export function createEmptyCinema2WorkspaceDocument(): Readonly<Cinema2WorkspaceDocument> {
  return deepFreeze({
    schemaId: CINEMA2_WORKSPACE_SCHEMA_ID,
    schemaVersion: CINEMA2_WORKSPACE_SCHEMA_VERSION,
    activationRevision: 0,
    activePresetId: null,
    presets: [],
    legacyArchive: null,
    legacyMigrationVersion: 0,
    legacyMigrationFingerprint: null,
  })
}

/**
 * Parses persisted/project data without trusting object identity or mutable input.
 * Unsupported root versions fall back to an empty document. Invalid preset records
 * are skipped with diagnostics so one bad preset cannot prevent project recovery.
 */
export function parseCinema2WorkspaceDocument(
  input: unknown,
  registry: Cinema2PresetRegistry = cinema2NativePresetRegistry,
): Cinema2WorkspaceParseResult {
  const fallback = createEmptyCinema2WorkspaceDocument()
  if (!isRecord(input)) return parseFailure(fallback, 'CINEMA2_WORKSPACE_INVALID', 'Workspace state must be an object.', '$')
  if (input.schemaId !== CINEMA2_WORKSPACE_SCHEMA_ID) {
    return parseFailure(fallback, 'CINEMA2_WORKSPACE_SCHEMA_UNSUPPORTED', `Unsupported workspace schema "${String(input.schemaId)}".`, '$.schemaId')
  }
  if (input.schemaVersion !== CINEMA2_WORKSPACE_SCHEMA_VERSION) {
    return parseFailure(fallback, 'CINEMA2_WORKSPACE_VERSION_UNSUPPORTED', `Unsupported workspace schema version "${String(input.schemaVersion)}".`, '$.schemaVersion')
  }

  const diagnostics: Cinema2WorkspaceDiagnostic[] = []
  const presets: Cinema2PersistedPresetState[] = []
  const seen = new Set<string>()
  for (const [index, candidate] of (Array.isArray(input.presets) ? input.presets : []).entries()) {
    const parsed = parsePresetState(candidate, registry, `$.presets[${index}]`)
    diagnostics.push(...parsed.diagnostics)
    if (!parsed.value || seen.has(parsed.value.presetId)) continue
    seen.add(parsed.value.presetId)
    presets.push(parsed.value)
  }
  if (!Array.isArray(input.presets)) diagnostics.push(diagnostic('CINEMA2_WORKSPACE_PRESETS_INVALID', 'Workspace presets must be an array.', '$.presets'))

  const activePresetId = typeof input.activePresetId === 'string' && registry.has(input.activePresetId as Cinema2PresetId)
    ? input.activePresetId as Cinema2PresetId
    : null
  if (input.activePresetId != null && activePresetId == null) {
    diagnostics.push(diagnostic('CINEMA2_WORKSPACE_ACTIVE_PRESET_INVALID', 'The active Cinema 2.0 preset is not registered.', '$.activePresetId'))
  }
  const archive = parseLegacyArchive(input.legacyArchive, diagnostics)
  const value = deepFreeze({
    schemaId: CINEMA2_WORKSPACE_SCHEMA_ID,
    schemaVersion: CINEMA2_WORKSPACE_SCHEMA_VERSION,
    activationRevision: nonNegativeInteger(input.activationRevision),
    activePresetId,
    presets: presets.sort((left, right) => left.presetId.localeCompare(right.presetId)),
    legacyArchive: archive,
    legacyMigrationVersion: nonNegativeInteger(input.legacyMigrationVersion),
    legacyMigrationFingerprint: typeof input.legacyMigrationFingerprint === 'string'
      ? input.legacyMigrationFingerprint
      : null,
  })
  return { ok: diagnostics.length === 0, value, diagnostics: deepFreeze(diagnostics) }
}

export interface Cinema2LegacyWorkspaceMigrationRequest {
  legacyDocument: unknown
  activation?: Readonly<Cinema2WorkspaceActivationRequest>
  archivedAt?: string
}

export interface Cinema2LegacyWorkspaceMigrationResult {
  ok: boolean
  document: Readonly<Cinema2WorkspaceDocument>
  diagnostics: readonly Cinema2WorkspaceDiagnostic[]
}

/** Atomically archives the legacy document, optionally activates its mapped preset, and marks completion. */
export function migrateLegacyCinemaWorkspace(
  documentInput: unknown,
  request: Readonly<Cinema2LegacyWorkspaceMigrationRequest>,
): Cinema2LegacyWorkspaceMigrationResult {
  const document = normalizeCinema2WorkspaceDocument(documentInput)
  const fingerprint = fingerprintJson(request.legacyDocument)
  if (
    document.legacyMigrationVersion >= CINEMA2_LEGACY_MIGRATION_VERSION
    && document.legacyMigrationFingerprint === fingerprint
  ) {
    return { ok: true, document, diagnostics: [] }
  }
  let next = document
  if (request.activation) {
    const activated = activateCinema2Workspace(next, request.activation)
    if (!activated.ok) return { ok: false, document, diagnostics: activated.diagnostics }
    next = activated.document
  }
  next = archiveLegacyCinemaDocument(next, request.legacyDocument, request.archivedAt)
  return {
    ok: true,
    document: deepFreeze({
      ...next,
      legacyMigrationVersion: CINEMA2_LEGACY_MIGRATION_VERSION,
      legacyMigrationFingerprint: fingerprint,
    }),
    diagnostics: [],
  }
}

export function normalizeCinema2WorkspaceDocument(input: unknown): Readonly<Cinema2WorkspaceDocument> {
  return parseCinema2WorkspaceDocument(input).value
}

export function getCinema2WorkspacePresetState(
  document: Readonly<Cinema2WorkspaceDocument>,
  presetId: Cinema2PresetId,
): Readonly<Cinema2PersistedPresetState> | null {
  return document.presets.find(state => state.presetId === presetId) ?? null
}

export function storeCinema2WorkspacePresetState(
  document: Readonly<Cinema2WorkspaceDocument>,
  state: Readonly<Cinema2WorkspacePresetState>,
): Readonly<Cinema2WorkspaceDocument> {
  const current = getCinema2WorkspacePresetState(document, state.presetId)
  const parsed = parsePresetState({ ...state, lookId: current?.lookId ?? null }, cinema2NativePresetRegistry, '$.preset')
  if (!parsed.value) return document
  return replacePreset(document, parsed.value, false)
}

/** Stable future-facing entry point for migrations, pads, automation, and sections. */
export function activateCinema2Workspace(
  documentInput: unknown,
  request: Readonly<Cinema2WorkspaceActivationRequest>,
  registry: Cinema2PresetRegistry = cinema2NativePresetRegistry,
): Cinema2WorkspaceActivationResult {
  const document = parseCinema2WorkspaceDocument(documentInput, registry).value
  const compiled = registry.compile(request.presetId)
  if (!compiled.ok) {
    return activationFailure(document, compiled.diagnostics.map(item => diagnostic(item.code, item.message, item.path)))
  }

  const parameterState = new Cinema2ParameterState(compiled.plan.parameters)
  const existing = getCinema2WorkspacePresetState(document, request.presetId)
  if (existing) {
    const restored = parameterState.restore(existing.serializedParameterState)
    if (!restored.ok) {
      return activationFailure(document, restored.diagnostics.map(item => diagnostic(item.code, item.message, item.path)))
    }
  }

  const patch: Record<string, Cinema2JsonValue> = { ...request.parameterPatch }
  if (request.look?.parameterId && request.look.value !== undefined) patch[request.look.parameterId] = request.look.value
  const patchDiagnostics: Cinema2WorkspaceDiagnostic[] = []
  for (const [parameterId, value] of Object.entries(patch)) {
    const mutation = parameterState.setPersistentValue(parameterId as Cinema2ParameterId, value)
    if (!mutation.ok) patchDiagnostics.push(...mutation.diagnostics.map(item => diagnostic(item.code, item.message, item.path)))
  }
  if (patchDiagnostics.length > 0) return activationFailure(document, patchDiagnostics)

  const mediaResult = mergeMediaPatch(compiled.plan.manifest.mediaSlots ?? [], existing?.mediaSlots ?? [], request.mediaPatch)
  if (mediaResult.diagnostics.length > 0) return activationFailure(document, mediaResult.diagnostics)
  const nextState = deepFreeze({
    presetId: request.presetId,
    lookId: request.look === undefined ? existing?.lookId ?? null : request.look?.id ?? null,
    serializedParameterState: parameterState.serialize(),
    mediaSlots: mediaResult.mediaSlots,
  })
  const nextDocument = replacePreset(document, nextState, true)
  return { ok: true, document: nextDocument, state: nextState, diagnostics: [] }
}

/** Stores a lossless JSON snapshot of the legacy document beside Cinema 2.0 project data. */
export function archiveLegacyCinemaDocument(
  documentInput: unknown,
  legacyDocument: unknown,
  archivedAt = new Date().toISOString(),
): Readonly<Cinema2WorkspaceDocument> {
  const document = normalizeCinema2WorkspaceDocument(documentInput)
  const payload = cloneJsonValue(legacyDocument)
  const source = isRecord(payload) ? payload : {}
  const archive = deepFreeze({
    schemaId: CINEMA2_LEGACY_ARCHIVE_SCHEMA_ID,
    schemaVersion: CINEMA2_LEGACY_ARCHIVE_SCHEMA_VERSION,
    source: 'legacy-cinema-store' as const,
    sourceSchemaId: typeof source.schemaId === 'string' ? source.schemaId : null,
    sourceSchemaVersion: typeof source.schemaVersion === 'number' && Number.isFinite(source.schemaVersion) ? source.schemaVersion : null,
    archivedAt,
    payload,
  })
  return deepFreeze({ ...document, legacyArchive: archive })
}

export function exportCinema2LegacyArchive(documentInput: unknown): string | null {
  const archive = normalizeCinema2WorkspaceDocument(documentInput).legacyArchive
  return archive ? JSON.stringify(archive, null, 2) : null
}

function replacePreset(
  document: Readonly<Cinema2WorkspaceDocument>,
  state: Readonly<Cinema2PersistedPresetState>,
  activate: boolean,
): Readonly<Cinema2WorkspaceDocument> {
  const presets = [...document.presets.filter(candidate => candidate.presetId !== state.presetId), state]
    .sort((left, right) => left.presetId.localeCompare(right.presetId))
  return deepFreeze({
    ...document,
    activationRevision: activate ? document.activationRevision + 1 : document.activationRevision,
    activePresetId: activate ? state.presetId : document.activePresetId,
    presets,
  })
}

function parsePresetState(
  input: unknown,
  registry: Cinema2PresetRegistry,
  path: string,
): { value: Cinema2PersistedPresetState | null; diagnostics: Cinema2WorkspaceDiagnostic[] } {
  const diagnostics: Cinema2WorkspaceDiagnostic[] = []
  if (!isRecord(input) || typeof input.presetId !== 'string' || !registry.has(input.presetId as Cinema2PresetId)) {
    return { value: null, diagnostics: [diagnostic('CINEMA2_WORKSPACE_PRESET_INVALID', 'Preset state must reference a registered preset.', `${path}.presetId`)] }
  }
  if (typeof input.serializedParameterState !== 'string') {
    return { value: null, diagnostics: [diagnostic('CINEMA2_WORKSPACE_PARAMETERS_INVALID', 'Preset parameter state must be serialized JSON.', `${path}.serializedParameterState`)] }
  }
  const compiled = registry.compile(input.presetId as Cinema2PresetId)
  if (!compiled.ok) return { value: null, diagnostics: compiled.diagnostics.map(item => diagnostic(item.code, item.message, item.path)) }
  const parameterState = new Cinema2ParameterState(compiled.plan.parameters)
  const restored = parameterState.restore(input.serializedParameterState)
  if (!restored.ok) return { value: null, diagnostics: restored.diagnostics.map(item => diagnostic(item.code, item.message, `${path}.${item.path}`)) }

  const media = mergeMediaPatch(compiled.plan.manifest.mediaSlots ?? [], [], Array.isArray(input.mediaSlots) ? input.mediaSlots as Cinema2WorkspaceMediaSlotState[] : [])
  diagnostics.push(...media.diagnostics)
  return {
    value: deepFreeze({
      presetId: input.presetId as Cinema2PresetId,
      lookId: typeof input.lookId === 'string' && input.lookId.trim() ? input.lookId : null,
      serializedParameterState: parameterState.serialize(),
      mediaSlots: media.mediaSlots,
    }),
    diagnostics,
  }
}

function mergeMediaPatch(
  manifests: readonly { id: Cinema2MediaSlotId; accepts: readonly string[] }[],
  current: readonly Readonly<Cinema2WorkspaceMediaSlotState>[],
  patch: readonly Readonly<Cinema2WorkspaceMediaSlotState>[] | undefined,
): { mediaSlots: readonly Readonly<Cinema2WorkspaceMediaSlotState>[]; diagnostics: Cinema2WorkspaceDiagnostic[] } {
  const slots = new Map(current.map(item => [item.slotId, item]))
  const diagnostics: Cinema2WorkspaceDiagnostic[] = []
  for (const [index, candidate] of (patch ?? []).entries()) {
    const manifest = manifests.find(item => item.id === candidate?.slotId)
    if (!manifest || !validSource(candidate?.source) || !manifest.accepts.includes(candidate.source.kind) || !validPresentation(candidate.presentation)) {
      diagnostics.push(diagnostic('CINEMA2_WORKSPACE_MEDIA_INVALID', 'Media assignment does not match an accepted Cinema 2.0 media slot.', `mediaPatch[${index}]`))
      continue
    }
    slots.set(candidate.slotId, deepFreeze(cloneJsonValue(candidate) as unknown as Cinema2WorkspaceMediaSlotState))
  }
  return {
    mediaSlots: deepFreeze([...slots.values()].sort((left, right) => left.slotId.localeCompare(right.slotId))),
    diagnostics,
  }
}

function validSource(value: unknown): value is Cinema2MediaSource {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.label === 'string'
    && (value.kind === 'image' || value.kind === 'video' || value.kind === 'svg')
    && typeof value.url === 'string' && value.url.trim().length > 0
}

function validPresentation(value: unknown): value is Cinema2MediaPresentation {
  return isRecord(value)
    && (value.fit === 'contain' || value.fit === 'cover' || value.fit === 'fill')
    && numberTuple(value.position)
    && numberTuple(value.scale)
    && finite(value.rotation)
    && finite(value.opacity)
}

function parseLegacyArchive(input: unknown, diagnostics: Cinema2WorkspaceDiagnostic[]): Cinema2LegacyArchive | null {
  if (input == null) return null
  if (!isRecord(input)
    || input.schemaId !== CINEMA2_LEGACY_ARCHIVE_SCHEMA_ID
    || input.schemaVersion !== CINEMA2_LEGACY_ARCHIVE_SCHEMA_VERSION
    || input.source !== 'legacy-cinema-store'
    || typeof input.archivedAt !== 'string') {
    diagnostics.push(diagnostic('CINEMA2_LEGACY_ARCHIVE_INVALID', 'Legacy Cinema archive is invalid and was not loaded.', '$.legacyArchive'))
    return null
  }
  try {
    return deepFreeze(cloneJsonValue(input) as unknown as Cinema2LegacyArchive)
  } catch {
    diagnostics.push(diagnostic('CINEMA2_LEGACY_ARCHIVE_INVALID', 'Legacy Cinema archive is not JSON serializable.', '$.legacyArchive.payload'))
    return null
  }
}

function cloneJsonValue(value: unknown): Cinema2JsonValue {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) return {}
  return JSON.parse(serialized) as Cinema2JsonValue
}

function fingerprintJson(value: unknown): string {
  const serialized = JSON.stringify(cloneJsonValue(value))
  let hash = 0x811c9dc5
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(36)}`
}

function activationFailure(
  document: Readonly<Cinema2WorkspaceDocument>,
  diagnostics: Cinema2WorkspaceDiagnostic[],
): Cinema2WorkspaceActivationResult {
  return { ok: false, document, state: null, diagnostics: deepFreeze(diagnostics) }
}

function parseFailure(
  value: Readonly<Cinema2WorkspaceDocument>,
  code: string,
  message: string,
  path: string,
): Cinema2WorkspaceParseResult {
  return { ok: false, value, diagnostics: deepFreeze([diagnostic(code, message, path)]) }
}

function diagnostic(code: string, message: string, path: string): Cinema2WorkspaceDiagnostic {
  return Object.freeze({ code, message, path })
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function numberTuple(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

/** Safe default for callers that need a valid activation before hydration. */
export const CINEMA2_DEFAULT_WORKSPACE_ACTIVATION = Object.freeze({
  presetId: CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
})
