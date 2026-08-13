import type { ReactEngineId, ReactSectionType, ReactTrackSection } from '../react/ReactTypes'
import { resolveAuthoritativeTimeline, resolveSectionAtTime, timelineRevision } from '../../../features/trackIntelligence/authoritativeTimeline'
import { clampEdgeAgainstTimeline, computeMinDuration, findSharedBoundaryNeighbor } from '../../../features/trackIntelligence/sectionBoundaryDrag'

export const SHOW_MANAGER_SHOW_SCHEMA_VERSION = 2 as const
export const SHOW_MANAGER_TRACK_MAP_SCHEMA_VERSION = 1 as const

export type ShowManagerEngineId = Extract<ReactEngineId, 'pixGrid' | 'laserDmx' | 'canvas'>

export interface ShowManagerTrackMap {
  schemaVersion: typeof SHOW_MANAGER_TRACK_MAP_SCHEMA_VERSION
  linkedAudioTrackId: string
  /** Music Intelligence analysis implementation version that seeded the current base snapshot. */
  baseAnalysisVersion: string | null
  /** Content revision of the canonical resolved section timeline at initialization/reconciliation time. */
  baseTimelineRevision: string
  durationSec: number
  /** Full Show-owned snapshot. Editing this array must never mutate canonical track analysis. */
  sections: ReactTrackSection[]
  /** Once true, later canonical analysis revisions preserve this authored snapshot. */
  edited: boolean
}

export interface ShowManagerShowRecord {
  schemaVersion: typeof SHOW_MANAGER_SHOW_SCHEMA_VERSION
  id: string
  name: string
  /** Raw canonical audio_tracks UUID. Null is reserved for migrated legacy Shows only. */
  linkedAudioTrackId: string | null
  tags: string[]
  /** Reuses the Media Library collection identity as optional Show grouping metadata. */
  groupId: string | null
  /** Extension point for engine-owned payloads. New Shows seed the engine chosen at creation time. */
  engineIds: ShowManagerEngineId[]
  /** Null until canonical linked-track analysis is available or a legacy authored timeline is adopted. */
  trackMap: ShowManagerTrackMap | null
}

export interface CreateShowManagerShowInput {
  name: string
  linkedAudioTrackId: string
  tags?: readonly string[]
  groupId?: string | null
  initialEngineId?: ShowManagerEngineId | null
}

export interface DuplicateShowManagerShowInput {
  name: string
  tags?: readonly string[]
  groupId?: string | null
}


const SHOW_MANAGER_SECTION_TYPES = new Set<ReactSectionType>([
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
])

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeTrackSection(raw: unknown, index: number, durationSec: number): ReactTrackSection | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `show-track-section-${index + 1}`
  const type = typeof raw.type === 'string' && SHOW_MANAGER_SECTION_TYPES.has(raw.type as ReactSectionType)
    ? raw.type as ReactSectionType
    : 'unknown'
  const start = finiteNumber(raw.startSec)
  const end = finiteNumber(raw.endSec)
  if (start == null || end == null || end <= start) return null
  const boundedStart = Math.max(0, Math.min(durationSec, start))
  const boundedEnd = Math.max(boundedStart, Math.min(durationSec, end))
  if (boundedEnd - boundedStart <= 1e-6) return null
  const intensity = finiteNumber(raw.intensity)
  const source = raw.source === 'auto' || raw.source === 'manual' || raw.source === 'mock' || raw.source === 'user-edited-auto'
    || raw.source === 'user-created' || raw.source === 'imported' || raw.source === 'fallback'
    ? raw.source
    : undefined
  const engineId = isShowManagerEngineId(raw.engineId) ? raw.engineId : undefined
  return {
    id,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : (type === 'preDrop' ? 'Pre-Drop' : type.charAt(0).toUpperCase() + type.slice(1)),
    type,
    startSec: boundedStart,
    endSec: boundedEnd,
    intensity: intensity == null ? 0.5 : Math.max(0, Math.min(1, intensity)),
    ...(engineId ? { engineId } : {}),
    ...(source ? { source } : {}),
    ...(typeof raw.locked === 'boolean' ? { locked: raw.locked } : {}),
    ...(isRecord(raw.provenance) ? { provenance: { ...raw.provenance } as unknown as ReactTrackSection['provenance'] } : {}),
    ...(finiteNumber(raw.confidence) != null ? { confidence: finiteNumber(raw.confidence)! } : {}),
    ...(finiteNumber(raw.boundaryConfidence) != null ? { boundaryConfidence: finiteNumber(raw.boundaryConfidence)! } : {}),
    ...(finiteNumber(raw.labelConfidence) != null ? { labelConfidence: finiteNumber(raw.labelConfidence)! } : {}),
    ...(finiteNumber(raw.gridConfidence) != null ? { gridConfidence: finiteNumber(raw.gridConfidence)! } : {}),
    ...(finiteNumber(raw.analysisConfidence) != null ? { analysisConfidence: finiteNumber(raw.analysisConfidence)! } : {}),
    ...(finiteNumber(raw.dropConfidence) != null ? { dropConfidence: finiteNumber(raw.dropConfidence)! } : {}),
    ...(isRecord(raw.interpretation) ? { interpretation: raw.interpretation as ReactTrackSection['interpretation'] } : {}),
  }
}

export function cloneShowManagerTrackSections(sections: readonly ReactTrackSection[]): ReactTrackSection[] {
  return sections.map(section => ({
    ...section,
    provenance: section.provenance ? { ...section.provenance } : undefined,
    interpretation: section.interpretation ? { ...section.interpretation } : undefined,
  }))
}

export function normalizeShowManagerTrackMap(raw: unknown, linkedAudioTrackId: string | null): ShowManagerTrackMap | null {
  if (!linkedAudioTrackId || !isRecord(raw)) return null
  const rawDuration = finiteNumber(raw.durationSec)
  const rawSections = Array.isArray(raw.sections) ? raw.sections : []
  const inferredDuration = rawSections.reduce((maximum, section) => {
    if (!isRecord(section)) return maximum
    return Math.max(maximum, finiteNumber(section.endSec) ?? 0)
  }, 0)
  const durationSec = Math.max(0, rawDuration ?? inferredDuration)
  if (durationSec <= 0) return null
  const sections = rawSections
    .map((section, index) => normalizeTrackSection(section, index, durationSec))
    .filter((section): section is ReactTrackSection => section !== null)
    .sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec || left.id.localeCompare(right.id))
  if (sections.length === 0) return null
  return {
    schemaVersion: SHOW_MANAGER_TRACK_MAP_SCHEMA_VERSION,
    linkedAudioTrackId,
    baseAnalysisVersion: typeof raw.baseAnalysisVersion === 'string' && raw.baseAnalysisVersion.trim() ? raw.baseAnalysisVersion.trim() : null,
    baseTimelineRevision: typeof raw.baseTimelineRevision === 'string' && raw.baseTimelineRevision.trim()
      ? raw.baseTimelineRevision.trim()
      : timelineRevision(sections),
    durationSec,
    sections,
    edited: raw.edited === true,
  }
}

export function buildShowManagerCanonicalTrackMap(input: {
  linkedAudioTrackId: string
  analysisVersion?: string | null
  durationSec: number
  canonicalSections: readonly ReactTrackSection[]
}): ShowManagerTrackMap | null {
  const linkedAudioTrackId = normalizeShowManagerLinkedAudioTrackId(input.linkedAudioTrackId)
  const durationSec = Number.isFinite(input.durationSec) && input.durationSec > 0 ? input.durationSec : 0
  if (!linkedAudioTrackId || durationSec <= 0 || input.canonicalSections.length === 0) return null
  const sections = resolveAuthoritativeTimeline({
    analyzedSections: cloneShowManagerTrackSections(input.canonicalSections),
    durationSec,
  })
  if (sections.length === 0) return null
  return {
    schemaVersion: SHOW_MANAGER_TRACK_MAP_SCHEMA_VERSION,
    linkedAudioTrackId,
    baseAnalysisVersion: typeof input.analysisVersion === 'string' && input.analysisVersion.trim() ? input.analysisVersion.trim() : null,
    baseTimelineRevision: timelineRevision(sections),
    durationSec,
    sections: cloneShowManagerTrackSections(sections),
    edited: false,
  }
}

export function reconcileShowManagerTrackMap(
  current: ShowManagerTrackMap | null,
  canonical: ShowManagerTrackMap,
): ShowManagerTrackMap {
  if (!current || current.linkedAudioTrackId !== canonical.linkedAudioTrackId) return canonical
  // The Show owns a full initialized snapshot. Canonical analysis may be revised
  // later, but silently rebasing an existing Show could move authored fixtures,
  // media timing, or section edits. A future explicit rebase can use the stored
  // base revision/version metadata; ordinary hydration always preserves the Show.
  return current
}

export function createLegacyAuthoredShowManagerTrackMap(input: {
  linkedAudioTrackId: string
  sections: readonly ReactTrackSection[]
  durationSec: number
}): ShowManagerTrackMap | null {
  const linkedAudioTrackId = normalizeShowManagerLinkedAudioTrackId(input.linkedAudioTrackId)
  if (!linkedAudioTrackId || input.sections.length === 0 || input.durationSec <= 0) return null
  const sections = input.sections
    .map((section, index) => normalizeTrackSection(section, index, input.durationSec))
    .filter((section): section is ReactTrackSection => section !== null)
    .sort((left, right) => left.startSec - right.startSec || left.endSec - right.endSec)
  if (sections.length === 0) return null
  return {
    schemaVersion: SHOW_MANAGER_TRACK_MAP_SCHEMA_VERSION,
    linkedAudioTrackId,
    baseAnalysisVersion: null,
    baseTimelineRevision: `legacy-authored:${timelineRevision(sections)}`,
    durationSec: input.durationSec,
    sections,
    edited: true,
  }
}

export function setShowManagerTrackMapSectionEngine(
  map: ShowManagerTrackMap,
  sectionId: string,
  engineId: ShowManagerEngineId,
): ShowManagerTrackMap {
  const section = map.sections.find(candidate => candidate.id === sectionId)
  if (!section || section.engineId === engineId) return map
  return {
    ...map,
    sections: map.sections.map(candidate => candidate.id === sectionId
      ? { ...candidate, engineId }
      : candidate),
  }
}

export function updateShowManagerTrackMapSection(
  map: ShowManagerTrackMap,
  sectionId: string,
  patch: Partial<ReactTrackSection>,
): ShowManagerTrackMap {
  const index = map.sections.findIndex(section => section.id === sectionId)
  if (index < 0) return map
  const current = map.sections[index]!
  const originalId = current.provenance?.originalId ?? current.id
  const markAnalyzedSectionEdited = current.source === 'auto' || current.source === 'user-edited-auto'
  const nextSection = normalizeTrackSection({
    ...current,
    ...patch,
    id: current.id,
    ...(markAnalyzedSectionEdited ? {
      source: 'user-edited-auto',
      provenance: {
        ...current.provenance,
        authority: 'manual_replacement',
        originalId,
      },
    } : {}),
  }, index, map.durationSec)
  if (!nextSection || JSON.stringify(nextSection) === JSON.stringify(current)) return map
  const sections = map.sections.map((section, sectionIndex) => sectionIndex === index ? nextSection : section)
  return { ...map, sections, edited: true }
}

export function updateShowManagerTrackMapBoundary(
  map: ShowManagerTrackMap,
  sectionId: string,
  edge: 'start' | 'end',
  newTime: number,
  neighborId: string | null,
  neighborTime: number | null,
): ShowManagerTrackMap {
  const section = map.sections.find(candidate => candidate.id === sectionId)
  if (!section || !Number.isFinite(newTime)) return map
  const clampedTime = clampEdgeAgainstTimeline(
    edge,
    newTime,
    section,
    map.sections,
    computeMinDuration(null),
    map.durationSec,
  )
  const sharedNeighbor = findSharedBoundaryNeighbor([...map.sections], sectionId, edge)
  const shouldMoveNeighbor = sharedNeighbor
    && (!neighborId || neighborId === sharedNeighbor.id)
    && (neighborTime == null || Number.isFinite(neighborTime))
  let next = updateShowManagerTrackMapSection(map, sectionId, {
    [edge === 'start' ? 'startSec' : 'endSec']: clampedTime,
  })
  if (shouldMoveNeighbor && sharedNeighbor) {
    next = updateShowManagerTrackMapSection(next, sharedNeighbor.id, {
      [edge === 'start' ? 'endSec' : 'startSec']: clampedTime,
    })
  }
  return next
}

export function resolveShowManagerActiveSection(
  map: ShowManagerTrackMap | null | undefined,
  timeSec: number,
): ReactTrackSection | null {
  return map ? resolveSectionAtTime(map.sections, timeSec) : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createId(): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `show-manager-show-${uuid}`
}

function safeId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function normalizeShowManagerShowName(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized || fallback
}

export function normalizeShowManagerTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const tag = entry.trim().replace(/\s+/g, ' ')
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

export function normalizeShowManagerGroupId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeShowManagerLinkedAudioTrackId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isSupportedShowManagerAudioLibraryItem(value: {
  dbId?: unknown
  fileName?: unknown
  mimeType?: unknown
  storagePath?: unknown
}): boolean {
  const dbId = normalizeShowManagerLinkedAudioTrackId(value.dbId)
  const storagePath = typeof value.storagePath === 'string' && value.storagePath.trim() ? value.storagePath.trim() : null
  if (!dbId || !storagePath) return false
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType.trim().toLowerCase() : ''
  const fileName = typeof value.fileName === 'string' ? value.fileName.trim() : ''
  return mimeType.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(fileName)
}

export function isShowManagerEngineId(value: unknown): value is ShowManagerEngineId {
  return value === 'pixGrid' || value === 'laserDmx' || value === 'canvas'
}

export function normalizeShowManagerEngineIds(value: unknown): ShowManagerEngineId[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter(isShowManagerEngineId)))
}

export function createShowManagerShow(input: CreateShowManagerShowInput): ShowManagerShowRecord | null {
  const name = normalizeShowManagerShowName(input.name)
  const linkedAudioTrackId = normalizeShowManagerLinkedAudioTrackId(input.linkedAudioTrackId)
  if (!name || !linkedAudioTrackId) return null
  return {
    schemaVersion: SHOW_MANAGER_SHOW_SCHEMA_VERSION,
    id: createId(),
    name,
    linkedAudioTrackId,
    tags: normalizeShowManagerTags(input.tags ?? []),
    groupId: normalizeShowManagerGroupId(input.groupId),
    engineIds: input.initialEngineId ? [input.initialEngineId] : [],
    trackMap: null,
  }
}

export function duplicateShowManagerShowRecord(
  source: ShowManagerShowRecord,
  input: DuplicateShowManagerShowInput,
): ShowManagerShowRecord | null {
  const name = normalizeShowManagerShowName(input.name)
  const linkedAudioTrackId = normalizeShowManagerLinkedAudioTrackId(source.linkedAudioTrackId)
  if (!name || !linkedAudioTrackId) return null
  return {
    schemaVersion: SHOW_MANAGER_SHOW_SCHEMA_VERSION,
    id: createId(),
    name,
    linkedAudioTrackId,
    tags: normalizeShowManagerTags(input.tags ?? source.tags),
    groupId: normalizeShowManagerGroupId(input.groupId ?? source.groupId),
    engineIds: normalizeShowManagerEngineIds(source.engineIds),
    trackMap: source.trackMap ? { ...source.trackMap, sections: cloneShowManagerTrackSections(source.trackMap.sections) } : null,
  }
}

export function normalizeShowManagerShowRecord(raw: unknown, fallbackIndex = 0): ShowManagerShowRecord {
  const value = isRecord(raw) ? raw : {}
  return {
    schemaVersion: SHOW_MANAGER_SHOW_SCHEMA_VERSION,
    id: safeId(value.id, `show-manager-show-recovered-${fallbackIndex + 1}`),
    name: normalizeShowManagerShowName(value.name, `Show ${fallbackIndex + 1}`),
    linkedAudioTrackId: normalizeShowManagerLinkedAudioTrackId(value.linkedAudioTrackId),
    tags: normalizeShowManagerTags(value.tags),
    groupId: normalizeShowManagerGroupId(value.groupId),
    engineIds: normalizeShowManagerEngineIds(value.engineIds),
    trackMap: normalizeShowManagerTrackMap(value.trackMap, normalizeShowManagerLinkedAudioTrackId(value.linkedAudioTrackId)),
  }
}

export function normalizeShowManagerShows(raw: unknown): ShowManagerShowRecord[] {
  if (!Array.isArray(raw)) return []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const result: ShowManagerShowRecord[] = []
  raw.filter(isRecord).forEach((entry, index) => {
    let record = normalizeShowManagerShowRecord(entry, index)
    const baseId = record.id
    let id = baseId
    let idSuffix = index + 1
    while (seenIds.has(id)) id = `${baseId}-${idSuffix++}`
    if (id !== record.id) record = { ...record, id }
    const baseName = record.name
    let name = baseName
    let suffix = 2
    while (seenNames.has(name.toLowerCase())) name = `${baseName} (${suffix++})`
    if (name !== record.name) record = { ...record, name }
    seenIds.add(record.id)
    seenNames.add(record.name.toLowerCase())
    result.push(record)
  })
  return result
}

export function mergeLegacyShowManagerRecords(
  raw: unknown,
  legacy: readonly { id: string; name: string; engineId: ShowManagerEngineId }[],
): ShowManagerShowRecord[] {
  const records = normalizeShowManagerShows(raw)
  const byId = new Map(records.map(record => [record.id, record]))
  const usedNames = new Set(records.map(record => record.name.toLowerCase()))

  for (const legacyShow of legacy) {
    const existing = byId.get(legacyShow.id)
    if (existing) {
      if (!existing.engineIds.includes(legacyShow.engineId)) {
        const next = { ...existing, engineIds: [...existing.engineIds, legacyShow.engineId] }
        byId.set(next.id, next)
        const index = records.findIndex(record => record.id === next.id)
        if (index >= 0) records[index] = next
      }
      continue
    }
    const baseName = normalizeShowManagerShowName(legacyShow.name, 'Legacy Show')
    let name = baseName
    let suffix = 2
    while (usedNames.has(name.toLowerCase())) name = `${baseName} (${suffix++})`
    const record: ShowManagerShowRecord = {
      schemaVersion: SHOW_MANAGER_SHOW_SCHEMA_VERSION,
      id: legacyShow.id,
      name,
      linkedAudioTrackId: null,
      tags: [],
      groupId: null,
      engineIds: [legacyShow.engineId],
      trackMap: null,
    }
    records.push(record)
    byId.set(record.id, record)
    usedNames.add(record.name.toLowerCase())
  }
  return records
}

export function isShowManagerShowNameAvailable(
  shows: readonly ShowManagerShowRecord[],
  name: string,
  excludingShowId: string | null = null,
): boolean {
  const normalized = normalizeShowManagerShowName(name)
  if (!normalized) return false
  const key = normalized.toLowerCase()
  return !shows.some(show => show.id !== excludingShowId && normalizeShowManagerShowName(show.name).toLowerCase() === key)
}

export function hasValidShowManagerAudioLink(show: ShowManagerShowRecord | null | undefined): boolean {
  return Boolean(show?.linkedAudioTrackId)
}
