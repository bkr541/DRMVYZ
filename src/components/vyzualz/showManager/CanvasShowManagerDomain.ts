import type { ReactSectionType } from '../react/ReactTypes'

export const CANVAS_SHOW_MANAGER_SCHEMA_VERSION = 1 as const
export const CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC = 8
export const CANVAS_SHOW_MANAGER_MIN_SECTION_DURATION_SEC = 0.001

export const CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE = [
  ['intro', 'Intro'],
  ['verse', 'Verse'],
  ['build', 'Build'],
  ['preDrop', 'Pre-Drop'],
  ['drop', 'Drop'],
  ['breakdown', 'Breakdown'],
  ['outro', 'Outro'],
] as const satisfies readonly (readonly [ReactSectionType, string])[]

export interface CanvasShowManagerSection {
  id: string
  type: ReactSectionType
  label: string
  /** Canonical persisted timing. Cumulative boundaries are always derived. */
  durationSec: number
}

export interface CanvasShowManagerShow {
  schemaVersion: typeof CANVAS_SHOW_MANAGER_SCHEMA_VERSION
  id: string
  name: string
  sections: CanvasShowManagerSection[]
}

export interface CanvasShowManagerSectionRange {
  sectionId: string
  index: number
  startSec: number
  endSec: number
  durationSec: number
}

export interface CanvasShowManagerSectionDurationEdit {
  show: CanvasShowManagerShow
  sectionId: string
  previousDurationSec: number
  newDurationSec: number
  previousRange: CanvasShowManagerSectionRange
  newRange: CanvasShowManagerSectionRange
  downstreamShiftSec: number
}

export interface CanvasShowManagerValidationResult {
  valid: boolean
  issues: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${uuid}`
}

function safeId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

export function normalizeCanvasShowManagerName(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized || fallback
}

export function normalizeCanvasShowManagerDuration(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.max(CANVAS_SHOW_MANAGER_MIN_SECTION_DURATION_SEC, parsed)
    : CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC
}

export function createDefaultCanvasShowManagerSections(showId: string): CanvasShowManagerSection[] {
  return CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.map(([type, label], index) => ({
    id: `${showId}:section:${type}:${index + 1}`,
    type,
    label,
    durationSec: CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC,
  }))
}

export function createCanvasShowManagerShow(name: string): CanvasShowManagerShow {
  const id = createId('canvas-show')
  return {
    schemaVersion: CANVAS_SHOW_MANAGER_SCHEMA_VERSION,
    id,
    name: normalizeCanvasShowManagerName(name, 'Untitled Show'),
    sections: createDefaultCanvasShowManagerSections(id),
  }
}

function normalizeCanvasShowManagerSection(
  raw: unknown,
  showId: string,
  index: number,
): CanvasShowManagerSection {
  const [type, label] = CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE[index]!
  const value = isRecord(raw) ? raw : {}
  return {
    id: safeId(value.id, `${showId}:section:${type}:${index + 1}`),
    type,
    label,
    durationSec: normalizeCanvasShowManagerDuration(value.durationSec),
  }
}

function normalizeCanvasShowManagerSectionIds(
  sections: readonly CanvasShowManagerSection[],
  showId: string,
): CanvasShowManagerSection[] {
  const seen = new Set<string>()
  return sections.map((section, index) => {
    if (!seen.has(section.id)) {
      seen.add(section.id)
      return section
    }
    const id = `${showId}:section:${section.type}:${index + 1}`
    let candidate = id
    let suffix = 2
    while (seen.has(candidate)) candidate = `${id}:${suffix++}`
    seen.add(candidate)
    return { ...section, id: candidate }
  })
}

export function normalizeCanvasShowManagerShow(
  raw: unknown,
  fallbackIndex = 0,
): CanvasShowManagerShow {
  const value = isRecord(raw) ? raw : {}
  const id = safeId(value.id, `canvas-show-recovered-${fallbackIndex + 1}`)
  const rawSections = Array.isArray(value.sections) ? value.sections : []
  const sections = CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.map((_, index) => (
    normalizeCanvasShowManagerSection(rawSections[index], id, index)
  ))
  return {
    schemaVersion: CANVAS_SHOW_MANAGER_SCHEMA_VERSION,
    id,
    name: normalizeCanvasShowManagerName(value.name, `Show ${fallbackIndex + 1}`),
    sections: normalizeCanvasShowManagerSectionIds(sections, id),
  }
}

function allocateRecoveredName(name: string, usedNames: Set<string>): string {
  if (!usedNames.has(name.toLocaleLowerCase())) return name
  let suffix = 2
  let candidate = `${name} (${suffix})`
  while (usedNames.has(candidate.toLocaleLowerCase())) candidate = `${name} (${++suffix})`
  return candidate
}

export function normalizeCanvasShowManagerShows(raw: unknown): CanvasShowManagerShow[] {
  if (!Array.isArray(raw)) return []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  return raw.filter(isRecord).map((item, index) => {
    let show = normalizeCanvasShowManagerShow(item, index)
    if (seenIds.has(show.id)) {
      let candidate = `${show.id}-${index + 1}`
      let suffix = 2
      while (seenIds.has(candidate)) candidate = `${show.id}-${index + 1}-${suffix++}`
      show = {
        ...show,
        id: candidate,
        sections: show.sections.map((section, sectionIndex) => ({
          ...section,
          id: `${candidate}:section:${section.type}:${sectionIndex + 1}`,
        })),
      }
    }
    const name = allocateRecoveredName(show.name, seenNames)
    show = name === show.name ? show : { ...show, name }
    seenIds.add(show.id)
    seenNames.add(show.name.toLocaleLowerCase())
    return show
  })
}

export function cloneCanvasShowManagerShow(show: CanvasShowManagerShow): CanvasShowManagerShow {
  return { ...show, sections: show.sections.map(section => ({ ...section })) }
}

export function getCanvasShowManagerSectionRanges(
  show: CanvasShowManagerShow,
): CanvasShowManagerSectionRange[] {
  let cursor = 0
  return show.sections.map((section, index) => {
    const startSec = cursor
    const durationSec = normalizeCanvasShowManagerDuration(section.durationSec)
    cursor += durationSec
    return { sectionId: section.id, index, startSec, endSec: cursor, durationSec }
  })
}

export function getCanvasShowManagerTotalDuration(show: CanvasShowManagerShow): number {
  const ranges = getCanvasShowManagerSectionRanges(show)
  return ranges[ranges.length - 1]?.endSec ?? 0
}

export function updateCanvasShowManagerSectionDuration(
  show: CanvasShowManagerShow,
  sectionId: string,
  durationSec: unknown,
): CanvasShowManagerSectionDurationEdit | null {
  const index = show.sections.findIndex(section => section.id === sectionId)
  if (index < 0) return null
  const previousRanges = getCanvasShowManagerSectionRanges(show)
  const previousRange = previousRanges[index]!
  const newDurationSec = normalizeCanvasShowManagerDuration(durationSec)
  const nextShow = newDurationSec === previousRange.durationSec
    ? show
    : {
        ...show,
        sections: show.sections.map(section => section.id === sectionId
          ? { ...section, durationSec: newDurationSec }
          : section),
      }
  const newRange = getCanvasShowManagerSectionRanges(nextShow)[index]!
  return {
    show: nextShow,
    sectionId,
    previousDurationSec: previousRange.durationSec,
    newDurationSec,
    previousRange,
    newRange,
    downstreamShiftSec: newDurationSec - previousRange.durationSec,
  }
}

export function renameCanvasShowManagerShow(
  show: CanvasShowManagerShow,
  name: string,
): CanvasShowManagerShow {
  const normalized = normalizeCanvasShowManagerName(name, show.name)
  return normalized === show.name ? show : { ...show, name: normalized }
}

export function validateCanvasShowManagerShow(show: CanvasShowManagerShow): CanvasShowManagerValidationResult {
  const issues: string[] = []
  if (!normalizeCanvasShowManagerName(show.name)) issues.push('Show name is required.')
  if (show.sections.length !== CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.length) {
    issues.push('Canvas Shows require the canonical seven sections.')
  }
  const ids = new Set<string>()
  show.sections.forEach((section, index) => {
    const expected = CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE[index]
    if (!expected || section.type !== expected[0] || section.label !== expected[1]) {
      issues.push(`Section ${index + 1} does not match the canonical template.`)
    }
    if (!section.id || ids.has(section.id)) issues.push(`Section ${index + 1} has an invalid or duplicate ID.`)
    ids.add(section.id)
    if (!Number.isFinite(section.durationSec) || section.durationSec <= 0) {
      issues.push(`Section ${index + 1} requires a finite positive duration.`)
    }
  })
  return { valid: issues.length === 0, issues }
}

export function isCanvasShowManagerNameAvailable(
  shows: readonly CanvasShowManagerShow[],
  name: string,
  excludingShowId: string | null = null,
): boolean {
  const normalized = normalizeCanvasShowManagerName(name)
  if (!normalized) return false
  const candidate = normalized.toLocaleLowerCase()
  return !shows.some(show => show.id !== excludingShowId && show.name.toLocaleLowerCase() === candidate)
}
