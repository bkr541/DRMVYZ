import type { ReactEngineId } from '../react/ReactTypes'

export const SHOW_MANAGER_SHOW_SCHEMA_VERSION = 1 as const

export type ShowManagerEngineId = Extract<ReactEngineId, 'pixGrid' | 'laserDmx' | 'canvas'>

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
