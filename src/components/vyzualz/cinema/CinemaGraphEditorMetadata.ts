import type { CinemaJsonObject, CinemaJsonValue } from './CinemaDomain'
import {
  createCinemaDiagnostic,
  type CinemaDiagnostic,
} from './CinemaDiagnostics'
import type {
  CinemaCompositionId,
  CinemaConnectionId,
  CinemaNodeId,
} from './CinemaIdentifiers'

export const CINEMA_GRAPH_EDITOR_METADATA_KEY = 'advancedGraphEditor' as const
export const CINEMA_GRAPH_EDITOR_METADATA_VERSION = 1 as const
export const CINEMA_GRAPH_EDITOR_DEFAULT_ZOOM = 0.8 as const
export const CINEMA_GRAPH_EDITOR_MIN_ZOOM = 0.35 as const
export const CINEMA_GRAPH_EDITOR_MAX_ZOOM = 1.8 as const

const LEGACY_SELECTION_KEY = 'composerSelectionByComposition'

export type CinemaEditorMode = 'structured' | 'graph'

export interface CinemaGraphEditorPoint {
  x: number
  y: number
}

export interface CinemaGraphEditorViewport extends CinemaGraphEditorPoint {
  zoom: number
}

export interface CinemaGraphEditorCompositionMetadata {
  mode: CinemaEditorMode
  viewport: CinemaGraphEditorViewport
  nodePositions: Readonly<Record<string, CinemaGraphEditorPoint>>
  selectedNodeIds: readonly CinemaNodeId[]
  selectedConnectionId: CinemaConnectionId | null
}

export interface CinemaGraphEditorMetadataRoot {
  schemaVersion: typeof CINEMA_GRAPH_EDITOR_METADATA_VERSION
  compositions: Readonly<Record<string, CinemaGraphEditorCompositionMetadata>>
}

export interface CinemaGraphEditorMetadataNormalizationResult {
  metadata: CinemaJsonObject
  diagnostics: readonly CinemaDiagnostic[]
}

const DEFAULT_VIEWPORT: Readonly<CinemaGraphEditorViewport> = Object.freeze({
  x: 20,
  y: 20,
  zoom: CINEMA_GRAPH_EDITOR_DEFAULT_ZOOM,
})

const DEFAULT_COMPOSITION_METADATA: Readonly<CinemaGraphEditorCompositionMetadata> = Object.freeze({
  mode: 'structured',
  viewport: DEFAULT_VIEWPORT,
  nodePositions: Object.freeze({}),
  selectedNodeIds: Object.freeze([]),
  selectedConnectionId: null,
})

export function createCinemaGraphEditorMetadataRoot(): CinemaGraphEditorMetadataRoot {
  return {
    schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION,
    compositions: {},
  }
}

export function normalizeCinemaGraphEditorMetadata(
  metadata: Readonly<CinemaJsonObject>,
): CinemaGraphEditorMetadataNormalizationResult {
  const diagnostics: CinemaDiagnostic[] = []
  const rawRoot = metadata[CINEMA_GRAPH_EDITOR_METADATA_KEY]
  const root = normalizeRoot(rawRoot, diagnostics)
  return {
    metadata: {
      ...metadata,
      [CINEMA_GRAPH_EDITOR_METADATA_KEY]: root as unknown as CinemaJsonValue,
    },
    diagnostics,
  }
}

export function getCinemaGraphEditorCompositionMetadata(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaGraphEditorCompositionMetadata {
  const root = readRoot(metadata[CINEMA_GRAPH_EDITOR_METADATA_KEY])
  const raw = root?.compositions[String(compositionId)]
  const legacySelection = getLegacySelection(metadata, compositionId)
  if (!raw) {
    return {
      ...DEFAULT_COMPOSITION_METADATA,
      viewport: { ...DEFAULT_VIEWPORT },
      nodePositions: {},
      selectedNodeIds: legacySelection ? [legacySelection] : [],
    }
  }
  const selectedNodeIds = raw.selectedNodeIds.length > 0
    ? raw.selectedNodeIds
    : legacySelection ? [legacySelection] : []
  return {
    mode: raw.mode,
    viewport: { ...raw.viewport },
    nodePositions: { ...raw.nodePositions },
    selectedNodeIds: [...selectedNodeIds],
    selectedConnectionId: raw.selectedConnectionId,
  }
}

export function withCinemaGraphEditorCompositionMetadata(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
  update: Partial<CinemaGraphEditorCompositionMetadata>,
): CinemaJsonObject {
  const normalized = normalizeCinemaGraphEditorMetadata(metadata).metadata
  const root = readRoot(normalized[CINEMA_GRAPH_EDITOR_METADATA_KEY]) ?? createCinemaGraphEditorMetadataRoot()
  const current = getCinemaGraphEditorCompositionMetadata(normalized, compositionId)
  const next: CinemaGraphEditorCompositionMetadata = {
    mode: update.mode ?? current.mode,
    viewport: update.viewport ? sanitizeViewport(update.viewport) : current.viewport,
    nodePositions: update.nodePositions ? sanitizeNodePositions(update.nodePositions) : current.nodePositions,
    selectedNodeIds: update.selectedNodeIds ? dedupeNodeIds(update.selectedNodeIds) : current.selectedNodeIds,
    selectedConnectionId: update.selectedConnectionId === undefined ? current.selectedConnectionId : update.selectedConnectionId,
  }
  const compositions = {
    ...root.compositions,
    [String(compositionId)]: next,
  }
  const primarySelection = next.selectedNodeIds[0] ?? null
  return withLegacySelection({
    ...normalized,
    [CINEMA_GRAPH_EDITOR_METADATA_KEY]: {
      schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION,
      compositions,
    } as unknown as CinemaJsonValue,
  }, compositionId, primarySelection)
}

export function withoutCinemaGraphEditorCompositionMetadata(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaJsonObject {
  const normalized = normalizeCinemaGraphEditorMetadata(metadata).metadata
  const root = readRoot(normalized[CINEMA_GRAPH_EDITOR_METADATA_KEY]) ?? createCinemaGraphEditorMetadataRoot()
  const compositions = { ...root.compositions }
  delete compositions[String(compositionId)]
  return withLegacySelection({
    ...normalized,
    [CINEMA_GRAPH_EDITOR_METADATA_KEY]: {
      schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION,
      compositions,
    } as unknown as CinemaJsonValue,
  }, compositionId, null)
}

export function scopeCinemaGraphEditorMetadata(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaJsonObject {
  const compositionMetadata = getCinemaGraphEditorCompositionMetadata(metadata, compositionId)
  return withCinemaGraphEditorCompositionMetadata({}, compositionId, compositionMetadata)
}

export function mergeCinemaGraphEditorMetadata(
  currentMetadata: Readonly<CinemaJsonObject>,
  incomingMetadata: Readonly<CinemaJsonObject>,
): CinemaJsonObject {
  const currentNormalized = normalizeCinemaGraphEditorMetadata(currentMetadata).metadata
  const incomingNormalized = normalizeCinemaGraphEditorMetadata(incomingMetadata).metadata
  const currentRoot = readRoot(currentNormalized[CINEMA_GRAPH_EDITOR_METADATA_KEY]) ?? createCinemaGraphEditorMetadataRoot()
  const incomingRoot = readRoot(incomingNormalized[CINEMA_GRAPH_EDITOR_METADATA_KEY]) ?? createCinemaGraphEditorMetadataRoot()
  const currentLegacy = isRecord(currentNormalized[LEGACY_SELECTION_KEY]) ? currentNormalized[LEGACY_SELECTION_KEY] : {}
  const incomingLegacy = isRecord(incomingNormalized[LEGACY_SELECTION_KEY]) ? incomingNormalized[LEGACY_SELECTION_KEY] : {}
  let merged: CinemaJsonObject = {
    ...currentNormalized,
    ...incomingNormalized,
    [LEGACY_SELECTION_KEY]: { ...currentLegacy, ...incomingLegacy },
    [CINEMA_GRAPH_EDITOR_METADATA_KEY]: {
      schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION,
      compositions: { ...currentRoot.compositions, ...incomingRoot.compositions },
    } as unknown as CinemaJsonValue,
  }
  for (const [compositionId, compositionMetadata] of Object.entries(incomingRoot.compositions)) {
    merged = withCinemaGraphEditorCompositionMetadata(
      merged,
      compositionId as CinemaCompositionId,
      compositionMetadata,
    )
  }
  return merged
}

export function getCinemaGraphEditorPrimarySelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
): CinemaNodeId | null {
  return getCinemaGraphEditorCompositionMetadata(metadata, compositionId).selectedNodeIds[0] ?? null
}

export function defaultCinemaGraphNodePosition(index: number): CinemaGraphEditorPoint {
  const safeIndex = Math.max(0, Math.floor(index))
  const columns = 4
  return {
    x: 40 + (safeIndex % columns) * 240,
    y: 40 + Math.floor(safeIndex / columns) * 190,
  }
}

export function clampCinemaGraphEditorZoom(value: number): number {
  if (!Number.isFinite(value)) return CINEMA_GRAPH_EDITOR_DEFAULT_ZOOM
  return Math.max(CINEMA_GRAPH_EDITOR_MIN_ZOOM, Math.min(CINEMA_GRAPH_EDITOR_MAX_ZOOM, value))
}

function normalizeRoot(rawRoot: CinemaJsonValue | undefined, diagnostics: CinemaDiagnostic[]): CinemaGraphEditorMetadataRoot {
  if (rawRoot === undefined) return createCinemaGraphEditorMetadataRoot()
  if (!isRecord(rawRoot)) {
    diagnostics.push(metadataDiagnostic('Cinema graph editor metadata must be a plain object.'))
    return createCinemaGraphEditorMetadataRoot()
  }
  const rawVersion = rawRoot.schemaVersion
  if (rawVersion !== CINEMA_GRAPH_EDITOR_METADATA_VERSION) {
    diagnostics.push(createCinemaDiagnostic({
      code: 'CINEMA_SCHEMA_VERSION_UNSUPPORTED',
      severity: 'error',
      message: `Cinema graph editor metadata schema version "${String(rawVersion)}" is unsupported.`,
      attribution: { stage: 'graph-editor-metadata' },
      details: {
        receivedVersion: typeof rawVersion === 'number' ? rawVersion : -1,
        supportedVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION,
      },
    }))
    return createCinemaGraphEditorMetadataRoot()
  }
  if (!isRecord(rawRoot.compositions)) {
    diagnostics.push(metadataDiagnostic('Cinema graph editor metadata must contain a compositions object.'))
    return createCinemaGraphEditorMetadataRoot()
  }
  const compositions: Record<string, CinemaGraphEditorCompositionMetadata> = {}
  for (const [compositionId, rawComposition] of Object.entries(rawRoot.compositions)) {
    if (!isRecord(rawComposition)) {
      diagnostics.push(metadataDiagnostic('Cinema graph editor composition metadata must be a plain object.', compositionId))
      continue
    }
    const normalized = normalizeCompositionMetadata(rawComposition, diagnostics, compositionId)
    compositions[compositionId] = normalized
  }
  return { schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION, compositions }
}

function normalizeCompositionMetadata(
  raw: Record<string, CinemaJsonValue>,
  diagnostics: CinemaDiagnostic[],
  compositionId: string,
): CinemaGraphEditorCompositionMetadata {
  const mode: CinemaEditorMode = raw.mode === 'graph' || raw.mode === 'structured' ? raw.mode : 'structured'
  if (raw.mode !== undefined && raw.mode !== 'graph' && raw.mode !== 'structured') {
    diagnostics.push(metadataDiagnostic('Cinema editor mode must be structured or graph.', compositionId))
  }

  const viewport = isRecord(raw.viewport)
    ? sanitizeViewport({ x: Number(raw.viewport.x), y: Number(raw.viewport.y), zoom: Number(raw.viewport.zoom) })
    : { ...DEFAULT_VIEWPORT }
  if (raw.viewport !== undefined && !isRecord(raw.viewport)) {
    diagnostics.push(metadataDiagnostic('Cinema graph editor viewport metadata is malformed.', compositionId))
  }

  const nodePositions = isRecord(raw.nodePositions)
    ? sanitizeNodePositions(raw.nodePositions)
    : {}
  if (raw.nodePositions !== undefined && !isRecord(raw.nodePositions)) {
    diagnostics.push(metadataDiagnostic('Cinema graph editor node positions must be a plain object.', compositionId))
  }

  const selectedNodeIds = Array.isArray(raw.selectedNodeIds)
    ? dedupeNodeIds(raw.selectedNodeIds.filter((value): value is CinemaNodeId => typeof value === 'string'))
    : []
  if (raw.selectedNodeIds !== undefined && !Array.isArray(raw.selectedNodeIds)) {
    diagnostics.push(metadataDiagnostic('Cinema graph editor selected node IDs must be an array.', compositionId))
  }
  const selectedConnectionId = typeof raw.selectedConnectionId === 'string'
    ? raw.selectedConnectionId as CinemaConnectionId
    : null

  return { mode, viewport, nodePositions, selectedNodeIds, selectedConnectionId }
}

function readRoot(rawRoot: CinemaJsonValue | undefined): CinemaGraphEditorMetadataRoot | null {
  if (!isRecord(rawRoot) || rawRoot.schemaVersion !== CINEMA_GRAPH_EDITOR_METADATA_VERSION || !isRecord(rawRoot.compositions)) return null
  const compositions: Record<string, CinemaGraphEditorCompositionMetadata> = {}
  for (const [compositionId, value] of Object.entries(rawRoot.compositions)) {
    if (!isRecord(value)) continue
    compositions[compositionId] = normalizeCompositionMetadata(value, [], compositionId)
  }
  return { schemaVersion: CINEMA_GRAPH_EDITOR_METADATA_VERSION, compositions }
}

function sanitizeViewport(value: CinemaGraphEditorViewport): CinemaGraphEditorViewport {
  return {
    x: finiteOr(value.x, DEFAULT_VIEWPORT.x),
    y: finiteOr(value.y, DEFAULT_VIEWPORT.y),
    zoom: clampCinemaGraphEditorZoom(value.zoom),
  }
}

function sanitizeNodePositions(
  positions: Readonly<Record<string, CinemaGraphEditorPoint>> | Record<string, CinemaJsonValue>,
): Record<string, CinemaGraphEditorPoint> {
  const result: Record<string, CinemaGraphEditorPoint> = {}
  for (const [nodeId, value] of Object.entries(positions)) {
    if (!isRecord(value)) continue
    const x = Number(value.x)
    const y = Number(value.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    result[nodeId] = { x, y }
  }
  return result
}

function dedupeNodeIds(values: readonly CinemaNodeId[]): readonly CinemaNodeId[] {
  const seen = new Set<string>()
  const result: CinemaNodeId[] = []
  for (const value of values) {
    if (typeof value !== 'string' || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function getLegacySelection(metadata: Readonly<CinemaJsonObject>, compositionId: CinemaCompositionId): CinemaNodeId | null {
  const raw = metadata[LEGACY_SELECTION_KEY]
  if (!isRecord(raw)) return null
  const value = raw[String(compositionId)]
  return typeof value === 'string' ? value as CinemaNodeId : null
}

function withLegacySelection(
  metadata: Readonly<CinemaJsonObject>,
  compositionId: CinemaCompositionId,
  nodeId: CinemaNodeId | null,
): CinemaJsonObject {
  const raw = metadata[LEGACY_SELECTION_KEY]
  const current: Record<string, string> = isRecord(raw)
    ? Object.fromEntries(Object.entries(raw).filter(([, value]) => typeof value === 'string')) as Record<string, string>
    : {}
  if (nodeId == null) delete current[String(compositionId)]
  else current[String(compositionId)] = String(nodeId)
  return { ...metadata, [LEGACY_SELECTION_KEY]: current }
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function metadataDiagnostic(message: string, compositionId?: string): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_SCHEMA_INVALID',
    severity: 'warning',
    message,
    attribution: { stage: 'graph-editor-metadata', ...(compositionId ? { compositionId } : {}) },
  })
}

function isRecord(value: unknown): value is Record<string, CinemaJsonValue> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
