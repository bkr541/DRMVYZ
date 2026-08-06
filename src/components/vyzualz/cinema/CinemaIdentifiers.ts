import { createCinemaDiagnostic, type CinemaDiagnostic } from './CinemaDiagnostics'

declare const CINEMA_STABLE_ID: unique symbol
declare const CINEMA_PARAMETER_PATH: unique symbol

export type CinemaStableId<Kind extends string = string> = string & {
  readonly [CINEMA_STABLE_ID]: Kind
}

export type CinemaCompositionId = CinemaStableId<'composition'>
export type CinemaCompositionInstanceId = CinemaStableId<'composition-instance'>
export type CinemaCollectionId = CinemaStableId<'collection'>
export type CinemaNodeId = CinemaStableId<'node'>
export type CinemaNodeTypeId = CinemaStableId<'node-type'>
export type CinemaRendererPluginId = CinemaStableId<'renderer-plugin'>
export type CinemaPortId = CinemaStableId<'port'>
export type CinemaConnectionId = CinemaStableId<'connection'>
export type CinemaParameterId = CinemaStableId<'parameter'>
export type CinemaShaderPassId = CinemaStableId<'shader-pass'>
export type CinemaShaderResourceId = CinemaStableId<'shader-resource'>
export type CinemaShaderAttributeId = CinemaStableId<'shader-attribute'>
export type CinemaControlPointId = CinemaStableId<'control-point'>
export type CinemaEnumOptionId = CinemaStableId<'enum-option'>
export type CinemaAssetId = CinemaStableId<'asset'>
export type CinemaAssetBindingId = CinemaStableId<'asset-binding'>
export type CinemaCameraId = CinemaStableId<'camera'>
export type CinemaModulationRouteId = CinemaStableId<'modulation-route'>
export type CinemaPerformanceRuleId = CinemaStableId<'performance-rule'>
export type CinemaActionId = CinemaStableId<'action'>
export type CinemaEventId = CinemaStableId<'event'>
export type CinemaModulationSourceId = CinemaStableId<'modulation-source'>

export type CinemaParameterNamespace = 'master' | 'nodes' | 'cameras' | 'effects'
export type CinemaParameterPath = string & { readonly [CINEMA_PARAMETER_PATH]: true }

export type CinemaIdParseResult<Id extends CinemaStableId> =
  | { ok: true; value: Id; diagnostics: readonly [] }
  | { ok: false; value: null; diagnostics: readonly CinemaDiagnostic[] }

const ENTITY_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(?:[.:/][a-z][a-z0-9-]*)+$/

export function parseCinemaStableId<Id extends CinemaStableId>(
  value: unknown,
  kind: string,
): CinemaIdParseResult<Id> {
  return parseId(value, kind, false)
}

export function parseCinemaNamespacedId<Id extends CinemaStableId>(
  value: unknown,
  kind: string,
): CinemaIdParseResult<Id> {
  return parseId(value, kind, true)
}

export function cinemaStableId<Id extends CinemaStableId>(value: string, kind: string): Id {
  const parsed = parseCinemaStableId<Id>(value, kind)
  if (!parsed.ok) throw new TypeError(parsed.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return parsed.value
}

export function cinemaNamespacedId<Id extends CinemaStableId>(value: string, kind: string): Id {
  const parsed = parseCinemaNamespacedId<Id>(value, kind)
  if (!parsed.ok) throw new TypeError(parsed.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return parsed.value
}

export function findDuplicateCinemaIds<Id extends CinemaStableId>(
  ids: readonly Id[],
  kind: string,
): CinemaDiagnostic[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    else seen.add(id)
  }
  return [...duplicates]
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    .map(id => createCinemaDiagnostic({
      code: 'CINEMA_ID_DUPLICATE',
      severity: 'error',
      message: `Duplicate Cinema ${kind} ID "${id}".`,
      details: { id, kind },
    }))
}

export function createCinemaParameterPath(
  namespace: CinemaParameterNamespace,
  parameterId: CinemaParameterId,
  ownerId?: CinemaNodeId | CinemaCameraId,
): CinemaParameterPath {
  if (namespace === 'master') {
    if (ownerId != null) throw new TypeError('Master parameter paths must not include an owner ID.')
    return `master.${parameterId}` as CinemaParameterPath
  }
  if (ownerId == null) throw new TypeError(`${namespace} parameter paths require an owner ID.`)
  return `${namespace}.${ownerId}.${parameterId}` as CinemaParameterPath
}

export function parseCinemaParameterPath(value: unknown):
  | {
      ok: true
      value: CinemaParameterPath
      namespace: CinemaParameterNamespace
      ownerId: string | null
      parameterId: string
      diagnostics: readonly []
    }
  | { ok: false; value: null; diagnostics: readonly CinemaDiagnostic[] } {
  const text = typeof value === 'string' ? value.trim() : ''
  const parts = text.split('.')
  const namespace = parts[0] as CinemaParameterNamespace
  const expectedLength = namespace === 'master' ? 2 : 3
  const namespaceValid = namespace === 'master' || namespace === 'nodes' || namespace === 'cameras' || namespace === 'effects'
  const ownerId = expectedLength === 3 ? parts[1] : null
  const parameterId = parts[expectedLength - 1]
  const ownerValid = ownerId == null || ENTITY_ID_PATTERN.test(ownerId)
  const parameterValid = typeof parameterId === 'string' && ENTITY_ID_PATTERN.test(parameterId)

  if (!namespaceValid || parts.length !== expectedLength || !ownerValid || !parameterValid || text !== value) {
    return {
      ok: false,
      value: null,
      diagnostics: [createCinemaDiagnostic({
        code: 'CINEMA_PARAMETER_PATH_INVALID',
        severity: 'error',
        message: `Invalid Cinema parameter path "${String(value)}".`,
        details: { value: typeof value === 'string' ? value : String(value) },
      })],
    }
  }

  return {
    ok: true,
    value: text as CinemaParameterPath,
    namespace,
    ownerId,
    parameterId,
    diagnostics: [],
  }
}

function parseId<Id extends CinemaStableId>(
  value: unknown,
  kind: string,
  namespaced: boolean,
): CinemaIdParseResult<Id> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure('CINEMA_ID_EMPTY', `Cinema ${kind} ID must be a non-empty string.`, value, kind)
  }
  if (value !== value.trim() || /\s/.test(value) || value !== value.toLowerCase()) {
    return failure(
      'CINEMA_ID_LOOKS_LIKE_LABEL',
      `Cinema ${kind} ID "${value}" looks like a display label; use a stable lowercase ID.`,
      value,
      kind,
    )
  }
  const pattern = namespaced ? NAMESPACED_ID_PATTERN : ENTITY_ID_PATTERN
  if (!pattern.test(value)) {
    return failure(
      'CINEMA_ID_INVALID',
      namespaced
        ? `Cinema ${kind} ID "${value}" must be a lowercase namespaced identifier.`
        : `Cinema ${kind} ID "${value}" must use lowercase letters, numbers, hyphens, or underscores.`,
      value,
      kind,
    )
  }
  return { ok: true, value: value as Id, diagnostics: [] }
}

function failure<Id extends CinemaStableId>(
  code: 'CINEMA_ID_EMPTY' | 'CINEMA_ID_INVALID' | 'CINEMA_ID_LOOKS_LIKE_LABEL',
  message: string,
  value: unknown,
  kind: string,
): CinemaIdParseResult<Id> {
  return {
    ok: false,
    value: null,
    diagnostics: [createCinemaDiagnostic({
      code,
      severity: 'error',
      message,
      details: { kind, value: typeof value === 'string' ? value : String(value) },
    })],
  }
}
