import {
  CINEMA_PACKAGE_SCHEMA_ID,
  CINEMA_PACKAGE_SCHEMA_VERSION,
  isCinemaJsonValue,
  type CinemaCollectionDefinition,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
  type CinemaJsonObject,
} from './CinemaDomain'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
} from './CinemaDiagnostics'
import {
  parseCinemaStableId,
  type CinemaAssetId,
  type CinemaCompositionId,
  type CinemaCompositionInstanceId,
} from './CinemaIdentifiers'
import {
  normalizeCinemaPersistedState,
  persistedStateFromCinemaPackage,
  type CinemaMigrationProvenance,
  type CinemaPersistedDefinition,
  type CinemaPersistencePackageDefinition,
  type CinemaPersistenceResult,
} from './CinemaPersistence'

export interface CinemaPackageEncodeOptions {
  pretty?: boolean
}

export type CinemaPackageDecodeResult = CinemaPersistenceResult<CinemaPersistencePackageDefinition>

const PACKAGE_KEYS = new Set([
  'schemaId',
  'schemaVersion',
  'exportedAt',
  'definitions',
  'compositions',
  'instances',
  'collections',
  'assetIds',
  'activeCompositionId',
  'activeInstanceId',
  'editorMetadata',
  'migrationProvenance',
])

export function preflightCinemaPackage(input: unknown): CinemaPackageDecodeResult {
  try {
    if (!isPlainRecord(input)) {
      return failure([importDiagnostic('Cinema package must be a plain object.')])
    }
    if (!isCinemaJsonValue(input)) {
      return failure([importDiagnostic('Cinema package contains a runtime resource or non-JSON value.')])
    }
    if (input.schemaId !== CINEMA_PACKAGE_SCHEMA_ID) {
      return failure([importDiagnostic(
        `Cinema package schema must be "${CINEMA_PACKAGE_SCHEMA_ID}".`,
        { schemaId: String(input.schemaId ?? '<missing>') },
      )])
    }
    if (input.schemaVersion !== CINEMA_PACKAGE_SCHEMA_VERSION) {
      return failure([createCinemaDiagnostic({
        code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
        severity: 'error',
        message: `Cinema package schema version "${String(input.schemaVersion)}" is unsupported.`,
        details: {
          receivedVersion: typeof input.schemaVersion === 'number' ? input.schemaVersion : -1,
          supportedVersion: CINEMA_PACKAGE_SCHEMA_VERSION,
        },
      })])
    }

    const diagnostics: CinemaDiagnostic[] = []
    const unknownKeys = Object.keys(input).filter(key => !PACKAGE_KEYS.has(key)).sort(compareStrings)
    if (unknownKeys.length > 0) {
      diagnostics.push(importDiagnostic('Cinema package contains unknown root fields.', {
        fields: unknownKeys.join(','),
      }))
    }
    const exportedAt = typeof input.exportedAt === 'string' && Number.isFinite(Date.parse(input.exportedAt))
      ? input.exportedAt
      : ''
    if (!exportedAt) diagnostics.push(importDiagnostic('Cinema package exportedAt must be a valid ISO date string.'))

    const definitions = readArray<CinemaPersistedDefinition>(input, 'definitions', diagnostics, true)
    const compositions = readArray<CinemaCompositionDefinition>(input, 'compositions', diagnostics)
    const instances = readArray<CinemaCompositionInstance>(input, 'instances', diagnostics)
    const collections = readArray<CinemaCollectionDefinition>(input, 'collections', diagnostics)
    const assetIds = readArray<CinemaAssetId>(input, 'assetIds', diagnostics)
    const migrationProvenance = readArray<CinemaMigrationProvenance>(input, 'migrationProvenance', diagnostics, true)

    const assetIdSet = new Set<string>()
    for (const assetId of assetIds) {
      diagnostics.push(...parseCinemaStableId(assetId, 'asset').diagnostics)
      const normalizedAssetId = String(assetId)
      if (assetIdSet.has(normalizedAssetId)) {
        diagnostics.push(importDiagnostic('Cinema package contains a duplicate asset ID.', {
          assetId: normalizedAssetId,
        }))
      }
      assetIdSet.add(normalizedAssetId)
    }
    for (const composition of compositions) {
      if (!isPlainRecord(composition) || !Array.isArray(composition.assetBindings)) continue
      for (const binding of composition.assetBindings) {
        if (!isPlainRecord(binding)) continue
        const referencedAssetId = String(binding.assetId ?? '')
        if (!assetIdSet.has(referencedAssetId)) {
          diagnostics.push(importDiagnostic('Cinema package asset manifest is missing a referenced asset ID.', {
            assetId: referencedAssetId,
            compositionId: String(composition.id ?? '<missing>'),
          }))
        }
      }
    }

    const candidate: CinemaPersistencePackageDefinition = {
      schemaId: CINEMA_PACKAGE_SCHEMA_ID,
      schemaVersion: CINEMA_PACKAGE_SCHEMA_VERSION,
      exportedAt,
      definitions,
      compositions,
      instances,
      collections,
      assetIds,
      ...(input.activeCompositionId === undefined
        ? {}
        : { activeCompositionId: input.activeCompositionId as CinemaCompositionId | null }),
      ...(input.activeInstanceId === undefined
        ? {}
        : { activeInstanceId: input.activeInstanceId as CinemaCompositionInstanceId | null }),
      ...(isPlainRecord(input.editorMetadata)
        ? { editorMetadata: input.editorMetadata as CinemaJsonObject }
        : {}),
      ...(input.migrationProvenance === undefined ? {} : { migrationProvenance }),
    }

    if (input.editorMetadata !== undefined && !isPlainRecord(input.editorMetadata)) {
      diagnostics.push(importDiagnostic('Cinema package editorMetadata must be a plain JSON object.'))
    }

    const persistedResult = normalizeCinemaPersistedState(persistedStateFromCinemaPackage(candidate))
    diagnostics.push(...persistedResult.diagnostics.diagnostics)
    if (hasErrors(diagnostics)) return failure(diagnostics)
    return success(candidate, diagnostics)
  } catch (error) {
    return failure([importDiagnostic('Cinema package could not be preflighted safely.', {
      reason: error instanceof Error ? error.message : String(error),
    })])
  }
}

export function decodeCinemaPackage(serialized: string): CinemaPackageDecodeResult {
  if (typeof serialized !== 'string' || serialized.trim().length === 0) {
    return failure([importDiagnostic('Cinema package text must be a non-empty JSON string.')])
  }
  try {
    return preflightCinemaPackage(JSON.parse(serialized) as unknown)
  } catch (error) {
    return failure([importDiagnostic('Cinema package JSON could not be parsed.', {
      reason: error instanceof Error ? error.message : String(error),
    })])
  }
}

export function encodeCinemaPackage(
  packageDefinition: unknown,
  options: CinemaPackageEncodeOptions = {},
): CinemaPersistenceResult<string> {
  const preflight = preflightCinemaPackage(packageDefinition)
  if (!preflight.ok) {
    return { ok: false, value: null, diagnostics: preflight.diagnostics }
  }
  try {
    return {
      ok: true,
      value: JSON.stringify(preflight.value, null, options.pretty === false ? undefined : 2),
      diagnostics: preflight.diagnostics,
    }
  } catch (error) {
    return failure([importDiagnostic('Cinema package could not be encoded.', {
      reason: error instanceof Error ? error.message : String(error),
    })])
  }
}

function readArray<Value>(
  source: Record<string, unknown>,
  key: string,
  diagnostics: CinemaDiagnostic[],
  optional = false,
): readonly Value[] {
  const value = source[key]
  if (value === undefined && optional) return []
  if (Array.isArray(value)) return value as readonly Value[]
  diagnostics.push(importDiagnostic(`Cinema package field "${key}" must be an array.`))
  return []
}

function importDiagnostic(
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_IMPORT_INVALID',
    severity: 'error',
    message,
    ...(details ? { details } : {}),
  })
}

function success<Value>(value: Value, diagnostics: readonly CinemaDiagnostic[]): CinemaPersistenceResult<Value> {
  return {
    ok: true,
    value,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

function failure<Value>(diagnostics: readonly CinemaDiagnostic[]): CinemaPersistenceResult<Value> {
  return {
    ok: false,
    value: null,
    diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
  }
}

function hasErrors(diagnostics: readonly CinemaDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'error' || diagnostic.severity === 'fatal')
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
