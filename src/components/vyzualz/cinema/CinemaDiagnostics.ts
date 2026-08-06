/**
 * Serialization-safe diagnostics shared by Cinema domain, compiler, and runtime layers.
 * Diagnostic identity is deterministic so repeated frame failures can be bounded and deduplicated.
 */

export const CINEMA_DIAGNOSTIC_SNAPSHOT_VERSION = 1 as const
export const CINEMA_DEFAULT_DIAGNOSTIC_LIMIT = 100 as const

export type CinemaDiagnosticSeverity = 'info' | 'warning' | 'error' | 'fatal'

export type CinemaDiagnosticCode =
  | 'CINEMA_SCHEMA_INVALID'
  | 'CINEMA_SCHEMA_VERSION_UNSUPPORTED'
  | 'CINEMA_ID_EMPTY'
  | 'CINEMA_ID_INVALID'
  | 'CINEMA_ID_LOOKS_LIKE_LABEL'
  | 'CINEMA_ID_DUPLICATE'
  | 'CINEMA_PARAMETER_PATH_INVALID'
  | 'CINEMA_OUTPUT_MISSING'
  | 'CINEMA_OUTPUT_MULTIPLE'
  | 'CINEMA_NODE_TYPE_MISSING'
  | 'CINEMA_NODE_VERSION_UNSUPPORTED'
  | 'CINEMA_NODE_FAMILY_MISMATCH'
  | 'CINEMA_NODE_REGISTRY_DUPLICATE'
  | 'CINEMA_NODE_REGISTRY_INCOMPATIBLE'
  | 'CINEMA_NODE_REGISTRY_INVALID'
  | 'CINEMA_NODE_INITIALIZE_FAILED'
  | 'CINEMA_NODE_RENDER_FAILED'
  | 'CINEMA_NODE_RESET_FAILED'
  | 'CINEMA_NODE_DISPOSE_FAILED'
  | 'CINEMA_PORT_MISSING'
  | 'CINEMA_PORT_DIRECTION_INVALID'
  | 'CINEMA_PORT_CARDINALITY_EXCEEDED'
  | 'CINEMA_REQUIRED_INPUT_MISSING'
  | 'CINEMA_PORT_TYPE_MISMATCH'
  | 'CINEMA_CONNECTION_INVALID'
  | 'CINEMA_GRAPH_CYCLE'
  | 'CINEMA_NODE_UNREACHABLE'
  | 'CINEMA_FEEDBACK_CONTRACT_INVALID'
  | 'CINEMA_PARAMETER_MISSING'
  | 'CINEMA_ASSET_BINDING_MISSING'
  | 'CINEMA_QUALITY_DECLARATION_INVALID'
  | 'CINEMA_VALIDATION_FAILED'
  | 'CINEMA_COMPILE_FAILED'
  | 'CINEMA_CAPABILITY_UNAVAILABLE'
  | 'CINEMA_PLUGIN_UNAVAILABLE'
  | 'CINEMA_ASSET_MISSING'
  | 'CINEMA_LYRICS_UNAVAILABLE'
  | 'CINEMA_ANALYSER_UNAVAILABLE'
  | 'CINEMA_MUSIC_INTELLIGENCE_UNAVAILABLE'
  | 'CINEMA_SHADER_COMPILE_FAILED'
  | 'CINEMA_MEDIA_DECODE_FAILED'
  | 'CINEMA_CONTEXT_LOST'
  | 'CINEMA_CONTEXT_RESTORED'
  | 'CINEMA_IMPORT_INVALID'
  | 'CINEMA_IMPORT_CANCELLED'
  | 'CINEMA_TRANSACTION_ROLLED_BACK'
  | 'CINEMA_SAFE_OUTPUT_ACTIVE'

export interface CinemaDiagnosticAttribution {
  compositionId?: string
  instanceId?: string
  nodeId?: string
  connectionId?: string
  portId?: string
  parameterPath?: string
  assetId?: string
  stage?: string
}

export interface CinemaDiagnostic {
  /** Deterministic fingerprint-derived identifier, not a random runtime ID. */
  id: string
  code: CinemaDiagnosticCode
  severity: CinemaDiagnosticSeverity
  message: string
  attribution?: CinemaDiagnosticAttribution
  details?: Readonly<Record<string, string | number | boolean | null>>
  recoverable: boolean
}

export interface CinemaDiagnosticSnapshot {
  version: typeof CINEMA_DIAGNOSTIC_SNAPSHOT_VERSION
  diagnostics: readonly CinemaDiagnostic[]
  counts: Readonly<Record<CinemaDiagnosticSeverity, number>>
  highestSeverity: CinemaDiagnosticSeverity | null
  totalUniqueCount: number
  truncated: boolean
}

export interface CinemaDiagnosticSnapshotOptions {
  maximumDiagnostics?: number
}

export interface CreateCinemaDiagnosticInput {
  code: CinemaDiagnosticCode
  severity: CinemaDiagnosticSeverity
  message: string
  attribution?: CinemaDiagnosticAttribution
  details?: Readonly<Record<string, string | number | boolean | null>>
  recoverable?: boolean
}

const SEVERITY_RANK: Readonly<Record<CinemaDiagnosticSeverity, number>> = {
  info: 0,
  warning: 1,
  error: 2,
  fatal: 3,
}

export function createCinemaDiagnostic(input: CreateCinemaDiagnosticInput): CinemaDiagnostic {
  const normalized: Omit<CinemaDiagnostic, 'id'> = {
    code: input.code,
    severity: input.severity,
    message: input.message.trim() || input.code,
    ...(input.attribution ? { attribution: compactAttribution(input.attribution) } : {}),
    ...(input.details ? { details: sortSerializableObject(input.details) } : {}),
    recoverable: input.recoverable ?? input.severity !== 'fatal',
  }
  return {
    id: `cinema-diagnostic-${fnv1a32(createCinemaDiagnosticFingerprint(normalized)).toString(16).padStart(8, '0')}`,
    ...normalized,
  }
}

export function createCinemaDiagnosticFingerprint(
  diagnostic: Pick<CinemaDiagnostic, 'code' | 'severity' | 'message' | 'attribution' | 'details' | 'recoverable'>,
): string {
  return JSON.stringify({
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    attribution: diagnostic.attribution ? sortSerializableObject(diagnostic.attribution) : null,
    details: diagnostic.details ? sortSerializableObject(diagnostic.details) : null,
    recoverable: diagnostic.recoverable,
  })
}

export function sortCinemaDiagnostics(diagnostics: readonly CinemaDiagnostic[]): CinemaDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    const severity = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
    if (severity !== 0) return severity
    return compareStrings(createCinemaDiagnosticFingerprint(left), createCinemaDiagnosticFingerprint(right))
  })
}

export function deduplicateCinemaDiagnostics(diagnostics: readonly CinemaDiagnostic[]): CinemaDiagnostic[] {
  const byFingerprint = new Map<string, CinemaDiagnostic>()
  for (const diagnostic of diagnostics) {
    const fingerprint = createCinemaDiagnosticFingerprint(diagnostic)
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, diagnostic)
  }
  return sortCinemaDiagnostics([...byFingerprint.values()])
}

export function createCinemaDiagnosticSnapshot(
  diagnostics: readonly CinemaDiagnostic[],
  options: CinemaDiagnosticSnapshotOptions = {},
): CinemaDiagnosticSnapshot {
  const normalized = deduplicateCinemaDiagnostics(diagnostics)
  const maximumDiagnostics = normalizeDiagnosticLimit(options.maximumDiagnostics)
  const included = normalized.slice(0, maximumDiagnostics)
  const counts: Record<CinemaDiagnosticSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
    fatal: 0,
  }
  let highestSeverity: CinemaDiagnosticSeverity | null = null
  for (const diagnostic of normalized) {
    counts[diagnostic.severity] += 1
    if (highestSeverity == null || SEVERITY_RANK[diagnostic.severity] > SEVERITY_RANK[highestSeverity]) {
      highestSeverity = diagnostic.severity
    }
  }
  return {
    version: CINEMA_DIAGNOSTIC_SNAPSHOT_VERSION,
    diagnostics: included,
    counts,
    highestSeverity,
    totalUniqueCount: normalized.length,
    truncated: included.length < normalized.length,
  }
}

export function formatCinemaDiagnostic(diagnostic: CinemaDiagnostic): string {
  const attribution = diagnostic.attribution
    ? Object.entries(diagnostic.attribution)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')
    : ''
  return `[${diagnostic.severity.toUpperCase()}] ${diagnostic.code}: ${diagnostic.message}${attribution ? ` (${attribution})` : ''}`
}

function compactAttribution(attribution: CinemaDiagnosticAttribution): CinemaDiagnosticAttribution {
  return Object.fromEntries(
    Object.entries(attribution).filter((entry): entry is [string, string] => (
      typeof entry[1] === 'string' && entry[1].trim().length > 0
    )),
  )
}

function sortSerializableObject(
  value: object,
): Readonly<Record<string, string | number | boolean | null>> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareStrings(left, right)),
  ) as Readonly<Record<string, string | number | boolean | null>>
}

function normalizeDiagnosticLimit(value: number | undefined): number {
  if (value == null) return CINEMA_DEFAULT_DIAGNOSTIC_LIMIT
  if (!Number.isFinite(value)) return CINEMA_DEFAULT_DIAGNOSTIC_LIMIT
  return Math.max(0, Math.floor(value))
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
