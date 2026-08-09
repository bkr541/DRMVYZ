import type { ReactSectionType } from '../react/ReactTypes'

export const CANVAS_SHOW_MANAGER_SCHEMA_VERSION = 2 as const
export const CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC = 8
export const CANVAS_SHOW_MANAGER_MIN_SECTION_DURATION_SEC = 0.001
export const CANVAS_SHOW_MANAGER_MIN_ELEMENT_DURATION_SEC = 0.001
export const CANVAS_SHOW_MANAGER_LAYER_COUNT = 4

export const CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE = [
  ['intro', 'Intro'],
  ['verse', 'Verse'],
  ['build', 'Build'],
  ['preDrop', 'Pre-Drop'],
  ['drop', 'Drop'],
  ['breakdown', 'Breakdown'],
  ['outro', 'Outro'],
] as const satisfies readonly (readonly [ReactSectionType, string])[]

export type CanvasShowManagerLayer = 0 | 1 | 2 | 3

export interface CanvasShowManagerSection {
  id: string
  type: ReactSectionType
  label: string
  /** Canonical persisted timing. Cumulative boundaries are always derived. */
  durationSec: number
}

export interface CanvasShowManagerMediaElement {
  id: string
  /** Reference to the canonical shared media library. */
  mediaId: string
  /** Zero-based stacking order: 0 is back/bottom; 3 is front/top. */
  layer: CanvasShowManagerLayer
  showStartSec: number
  showEndSec: number
  /** Video-only trim. sourceOutSec remains null until duration metadata resolves. */
  sourceInSec: number | null
  sourceOutSec: number | null
}

export interface CanvasShowManagerShow {
  schemaVersion: typeof CANVAS_SHOW_MANAGER_SCHEMA_VERSION
  id: string
  name: string
  sections: CanvasShowManagerSection[]
  mediaElements: CanvasShowManagerMediaElement[]
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

export interface CanvasShowManagerMediaElementPatch {
  layer?: number
  showStartSec?: number
  showEndSec?: number
  sourceInSec?: number | null
  sourceOutSec?: number | null
}

export type CanvasShowManagerMediaElementMutationResult =
  | { ok: true; show: CanvasShowManagerShow; element: CanvasShowManagerMediaElement }
  | { ok: false; code: 'show-not-found' | 'section-not-found' | 'invalid-media' | 'invalid-range' | 'invalid-trim' | 'overlap'; message: string }

export interface CanvasShowManagerMediaReference {
  showId: string
  showName: string
  elementIds: string[]
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

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeCanvasShowManagerName(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized || fallback
}

export function normalizeCanvasShowManagerDuration(value: unknown): number {
  const parsed = finiteNumber(value)
  return parsed != null && parsed > 0
    ? Math.max(CANVAS_SHOW_MANAGER_MIN_SECTION_DURATION_SEC, parsed)
    : CANVAS_SHOW_MANAGER_DEFAULT_SECTION_DURATION_SEC
}

export function normalizeCanvasShowManagerLayer(value: unknown): CanvasShowManagerLayer {
  const parsed = finiteNumber(value)
  return Math.min(CANVAS_SHOW_MANAGER_LAYER_COUNT - 1, Math.max(0, Math.round(parsed ?? 0))) as CanvasShowManagerLayer
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
    mediaElements: [],
  }
}

function normalizeCanvasShowManagerSection(raw: unknown, showId: string, index: number): CanvasShowManagerSection {
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

function getSectionRangesFromSections(sections: readonly CanvasShowManagerSection[]): CanvasShowManagerSectionRange[] {
  let cursor = 0
  return sections.map((section, index) => {
    const startSec = cursor
    const durationSec = normalizeCanvasShowManagerDuration(section.durationSec)
    cursor += durationSec
    return { sectionId: section.id, index, startSec, endSec: cursor, durationSec }
  })
}

function normalizeCanvasShowManagerMediaElement(
  raw: unknown,
  totalDurationSec: number,
): CanvasShowManagerMediaElement | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const mediaId = typeof raw.mediaId === 'string' ? raw.mediaId.trim() : ''
  const rawStart = finiteNumber(raw.showStartSec)
  const rawEnd = finiteNumber(raw.showEndSec)
  if (!id || !mediaId || rawStart == null || rawEnd == null || rawEnd <= rawStart || totalDurationSec <= 0) return null
  const showStartSec = Math.min(Math.max(0, rawStart), Math.max(0, totalDurationSec - CANVAS_SHOW_MANAGER_MIN_ELEMENT_DURATION_SEC))
  const showEndSec = Math.min(totalDurationSec, Math.max(showStartSec + CANVAS_SHOW_MANAGER_MIN_ELEMENT_DURATION_SEC, rawEnd))
  if (showEndSec <= showStartSec) return null

  const rawSourceIn = raw.sourceInSec == null ? null : finiteNumber(raw.sourceInSec)
  const rawSourceOut = raw.sourceOutSec == null ? null : finiteNumber(raw.sourceOutSec)
  let sourceInSec: number | null = null
  let sourceOutSec: number | null = null
  if (rawSourceIn != null && rawSourceIn >= 0) {
    sourceInSec = rawSourceIn
    if (rawSourceOut != null && rawSourceOut > rawSourceIn) sourceOutSec = rawSourceOut
  }
  return {
    id,
    mediaId,
    layer: normalizeCanvasShowManagerLayer(raw.layer),
    showStartSec,
    showEndSec,
    sourceInSec,
    sourceOutSec,
  }
}

function normalizeCanvasShowManagerMediaElements(raw: unknown, totalDurationSec: number): CanvasShowManagerMediaElement[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set<string>()
  const accepted: CanvasShowManagerMediaElement[] = []
  for (const candidate of raw) {
    const element = normalizeCanvasShowManagerMediaElement(candidate, totalDurationSec)
    if (!element || ids.has(element.id) || canvasShowManagerRangeOverlaps(accepted, element.layer, element.showStartSec, element.showEndSec)) continue
    ids.add(element.id)
    accepted.push(element)
  }
  return accepted.sort(compareCanvasShowManagerMediaElements)
}

export function normalizeCanvasShowManagerShow(raw: unknown, fallbackIndex = 0): CanvasShowManagerShow {
  const value = isRecord(raw) ? raw : {}
  const id = safeId(value.id, `canvas-show-recovered-${fallbackIndex + 1}`)
  const rawSections = Array.isArray(value.sections) ? value.sections : []
  const sections = normalizeCanvasShowManagerSectionIds(
    CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.map((_, index) => normalizeCanvasShowManagerSection(rawSections[index], id, index)),
    id,
  )
  const ranges = getSectionRangesFromSections(sections)
  return {
    schemaVersion: CANVAS_SHOW_MANAGER_SCHEMA_VERSION,
    id,
    name: normalizeCanvasShowManagerName(value.name, `Show ${fallbackIndex + 1}`),
    sections,
    mediaElements: normalizeCanvasShowManagerMediaElements(value.mediaElements, ranges[ranges.length - 1]?.endSec ?? 0),
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
  return {
    ...show,
    sections: show.sections.map(section => ({ ...section })),
    mediaElements: show.mediaElements.map(element => ({ ...element })),
  }
}

export function getCanvasShowManagerSectionRanges(show: CanvasShowManagerShow): CanvasShowManagerSectionRange[] {
  return getSectionRangesFromSections(show.sections)
}

export function getCanvasShowManagerTotalDuration(show: CanvasShowManagerShow): number {
  const ranges = getCanvasShowManagerSectionRanges(show)
  return ranges[ranges.length - 1]?.endSec ?? 0
}

export function compareCanvasShowManagerMediaElements(
  left: CanvasShowManagerMediaElement,
  right: CanvasShowManagerMediaElement,
): number {
  return left.layer - right.layer || left.showStartSec - right.showStartSec || left.id.localeCompare(right.id)
}

export function canvasShowManagerRangesOverlap(
  leftStartSec: number,
  leftEndSec: number,
  rightStartSec: number,
  rightEndSec: number,
): boolean {
  return leftStartSec < rightEndSec && leftEndSec > rightStartSec
}

export function canvasShowManagerRangeOverlaps(
  elements: readonly CanvasShowManagerMediaElement[],
  layer: CanvasShowManagerLayer,
  showStartSec: number,
  showEndSec: number,
  excludingElementId: string | null = null,
): boolean {
  return elements.some(element => element.id !== excludingElementId
    && element.layer === layer
    && canvasShowManagerRangesOverlap(showStartSec, showEndSec, element.showStartSec, element.showEndSec))
}

export function createCanvasShowManagerMediaElement(
  show: CanvasShowManagerShow,
  input: {
    mediaId: string
    layer: number
    showStartSec: number
    showEndSec: number
    timedVideo: boolean
    sourceDurationSec?: number | null
  },
): CanvasShowManagerMediaElementMutationResult {
  const mediaId = input.mediaId.trim()
  if (!mediaId) return { ok: false, code: 'invalid-media', message: 'Choose compatible media from the shared library.' }
  const totalDurationSec = getCanvasShowManagerTotalDuration(show)
  const start = finiteNumber(input.showStartSec)
  const end = finiteNumber(input.showEndSec)
  if (start == null || end == null || start < 0 || end <= start || end > totalDurationSec) {
    return { ok: false, code: 'invalid-range', message: 'Show cues must be a valid range inside the Show.' }
  }
  const layer = normalizeCanvasShowManagerLayer(input.layer)
  if (canvasShowManagerRangeOverlaps(show.mediaElements, layer, start, end)) {
    return { ok: false, code: 'overlap', message: `Layer ${layer + 1} already contains media in that Show cue range.` }
  }
  const sourceDuration = finiteNumber(input.sourceDurationSec)
  const element: CanvasShowManagerMediaElement = {
    id: createId('canvas-element'),
    mediaId,
    layer,
    showStartSec: start,
    showEndSec: end,
    sourceInSec: input.timedVideo ? 0 : null,
    sourceOutSec: input.timedVideo && sourceDuration != null && sourceDuration > 0 ? sourceDuration : null,
  }
  return {
    ok: true,
    element,
    show: { ...show, mediaElements: [...show.mediaElements, element].sort(compareCanvasShowManagerMediaElements) },
  }
}

export function updateCanvasShowManagerMediaElement(
  show: CanvasShowManagerShow,
  elementId: string,
  patch: CanvasShowManagerMediaElementPatch,
  sourceDurationSec?: number | null,
): CanvasShowManagerMediaElementMutationResult {
  const current = show.mediaElements.find(element => element.id === elementId)
  if (!current) return { ok: false, code: 'invalid-media', message: 'That media element is no longer available.' }
  const totalDurationSec = getCanvasShowManagerTotalDuration(show)
  const showStartSec = patch.showStartSec === undefined ? current.showStartSec : finiteNumber(patch.showStartSec)
  const showEndSec = patch.showEndSec === undefined ? current.showEndSec : finiteNumber(patch.showEndSec)
  if (showStartSec == null || showEndSec == null || showStartSec < 0 || showEndSec <= showStartSec || showEndSec > totalDurationSec) {
    return { ok: false, code: 'invalid-range', message: 'Show cues must be a valid range inside the Show.' }
  }
  const layer = patch.layer === undefined ? current.layer : normalizeCanvasShowManagerLayer(patch.layer)
  if (canvasShowManagerRangeOverlaps(show.mediaElements, layer, showStartSec, showEndSec, current.id)) {
    return { ok: false, code: 'overlap', message: `Layer ${layer + 1} already contains media in that Show cue range.` }
  }

  const sourceInSec = patch.sourceInSec === undefined ? current.sourceInSec : patch.sourceInSec
  const sourceOutSec = patch.sourceOutSec === undefined ? current.sourceOutSec : patch.sourceOutSec
  if ((sourceInSec == null) !== (sourceOutSec == null)) {
    if (!(sourceInSec != null && sourceInSec >= 0 && sourceOutSec == null)) {
      return { ok: false, code: 'invalid-trim', message: 'Video source in/out must define a valid range.' }
    }
  }
  if (sourceInSec != null && sourceOutSec != null) {
    const knownDuration = finiteNumber(sourceDurationSec)
    if (!Number.isFinite(sourceInSec) || !Number.isFinite(sourceOutSec) || sourceInSec < 0 || sourceOutSec <= sourceInSec
      || (knownDuration != null && knownDuration > 0 && sourceOutSec > knownDuration)) {
      return { ok: false, code: 'invalid-trim', message: 'Video source in/out must define a valid range inside the source.' }
    }
  }

  const element: CanvasShowManagerMediaElement = {
    ...current,
    layer,
    showStartSec,
    showEndSec,
    sourceInSec,
    sourceOutSec,
  }
  return {
    ok: true,
    element,
    show: {
      ...show,
      mediaElements: show.mediaElements.map(candidate => candidate.id === elementId ? element : candidate)
        .sort(compareCanvasShowManagerMediaElements),
    },
  }
}

export function removeCanvasShowManagerMediaElement(show: CanvasShowManagerShow, elementId: string): CanvasShowManagerShow {
  if (!show.mediaElements.some(element => element.id === elementId)) return show
  return { ...show, mediaElements: show.mediaElements.filter(element => element.id !== elementId) }
}

export function getActiveCanvasShowManagerMediaElements(
  show: CanvasShowManagerShow,
  showTimeSec: number,
): CanvasShowManagerMediaElement[] {
  if (!Number.isFinite(showTimeSec)) return []
  return show.mediaElements
    .filter(element => showTimeSec >= element.showStartSec && showTimeSec < element.showEndSec)
    .sort(compareCanvasShowManagerMediaElements)
}

export function resolveCanvasShowManagerElementSourceTime(
  element: CanvasShowManagerMediaElement,
  showTimeSec: number,
): number | null {
  if (element.sourceInSec == null || element.sourceOutSec == null || element.sourceOutSec <= element.sourceInSec) return null
  const trimDuration = element.sourceOutSec - element.sourceInSec
  const elapsed = Math.max(0, showTimeSec - element.showStartSec)
  return element.sourceInSec + (elapsed % trimDuration)
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
  const downstreamShiftSec = newDurationSec - previousRange.durationSec
  const nextShow = newDurationSec === previousRange.durationSec
    ? show
    : {
        ...show,
        sections: show.sections.map(section => section.id === sectionId ? { ...section, durationSec: newDurationSec } : section),
        mediaElements: show.mediaElements.map(element => element.showStartSec >= previousRange.endSec
          ? {
              ...element,
              showStartSec: element.showStartSec + downstreamShiftSec,
              showEndSec: element.showEndSec + downstreamShiftSec,
            }
          : element),
      }
  if (nextShow !== show) {
    const nextTotalDurationSec = getCanvasShowManagerTotalDuration(nextShow)
    const invalidRipple = nextShow.mediaElements.some(element => (
      element.showStartSec < 0
      || element.showEndSec > nextTotalDurationSec
      || canvasShowManagerRangeOverlaps(
        nextShow.mediaElements,
        element.layer,
        element.showStartSec,
        element.showEndSec,
        element.id,
      )
    ))
    if (invalidRipple) return null
  }
  const newRange = getCanvasShowManagerSectionRanges(nextShow)[index]!
  return {
    show: nextShow,
    sectionId,
    previousDurationSec: previousRange.durationSec,
    newDurationSec,
    previousRange,
    newRange,
    downstreamShiftSec,
  }
}

export function renameCanvasShowManagerShow(show: CanvasShowManagerShow, name: string): CanvasShowManagerShow {
  const normalized = normalizeCanvasShowManagerName(name, show.name)
  return normalized === show.name ? show : { ...show, name: normalized }
}

export function findCanvasShowManagerMediaReferences(
  shows: readonly CanvasShowManagerShow[],
  mediaId: string,
): CanvasShowManagerMediaReference[] {
  return shows.flatMap(show => {
    const elementIds = show.mediaElements.filter(element => element.mediaId === mediaId).map(element => element.id)
    return elementIds.length > 0 ? [{ showId: show.id, showName: show.name, elementIds }] : []
  })
}

export function validateCanvasShowManagerShow(show: CanvasShowManagerShow): CanvasShowManagerValidationResult {
  const issues: string[] = []
  if (!normalizeCanvasShowManagerName(show.name)) issues.push('Show name is required.')
  if (show.sections.length !== CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.length) {
    issues.push('Canvas Shows require the canonical seven sections.')
  }
  const sectionIds = new Set<string>()
  show.sections.forEach((section, index) => {
    const expected = CANVAS_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE[index]
    if (!expected || section.type !== expected[0] || section.label !== expected[1]) {
      issues.push(`Section ${index + 1} does not match the canonical template.`)
    }
    if (!section.id || sectionIds.has(section.id)) issues.push(`Section ${index + 1} has an invalid or duplicate ID.`)
    sectionIds.add(section.id)
    if (!Number.isFinite(section.durationSec) || section.durationSec <= 0) {
      issues.push(`Section ${index + 1} requires a finite positive duration.`)
    }
  })
  const totalDurationSec = getCanvasShowManagerTotalDuration(show)
  const elementIds = new Set<string>()
  show.mediaElements.forEach((element, index) => {
    if (!element.id || !element.mediaId || elementIds.has(element.id)) issues.push(`Media element ${index + 1} has invalid identity.`)
    elementIds.add(element.id)
    if (!Number.isInteger(element.layer) || element.layer < 0 || element.layer >= CANVAS_SHOW_MANAGER_LAYER_COUNT) {
      issues.push(`Media element ${index + 1} has an invalid layer.`)
    }
    if (!Number.isFinite(element.showStartSec) || !Number.isFinite(element.showEndSec)
      || element.showStartSec < 0 || element.showEndSec <= element.showStartSec || element.showEndSec > totalDurationSec) {
      issues.push(`Media element ${index + 1} has invalid Show cues.`)
    }
    if (element.sourceInSec != null || element.sourceOutSec != null) {
      if (element.sourceInSec == null || !Number.isFinite(element.sourceInSec) || element.sourceInSec < 0
        || (element.sourceOutSec != null && (!Number.isFinite(element.sourceOutSec) || element.sourceOutSec <= element.sourceInSec))) {
        issues.push(`Media element ${index + 1} has invalid source trim.`)
      }
    }
    if (canvasShowManagerRangeOverlaps(show.mediaElements, element.layer, element.showStartSec, element.showEndSec, element.id)) {
      issues.push(`Media element ${index + 1} overlaps another element on Layer ${element.layer + 1}.`)
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
