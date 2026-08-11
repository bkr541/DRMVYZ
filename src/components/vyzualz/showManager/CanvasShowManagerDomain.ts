import type { ReactSectionType } from '../react/ReactTypes'

export const CANVAS_SHOW_MANAGER_SCHEMA_VERSION = 3 as const
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
export type CanvasShowManagerTransitionType = 'hardCut' | 'fade' | 'slide' | 'zoom'
export type CanvasShowManagerTransitionDirection = 'left' | 'right' | 'up' | 'down'

export interface CanvasShowManagerDisplayParameters {
  scale: number
  x: number
  y: number
  brightness: number
  opacity: number
  rotation: number
}

export interface CanvasShowManagerTransitionParameters {
  type: CanvasShowManagerTransitionType
  durationSec: number
  direction: CanvasShowManagerTransitionDirection
}

export interface CanvasShowManagerTransitions {
  in: CanvasShowManagerTransitionParameters
  out: CanvasShowManagerTransitionParameters
}

export interface CanvasShowManagerFxParameters {
  blur: number
  contrast: number
  saturation: number
  hue: number
  glow: number
}

export const CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY: Readonly<CanvasShowManagerDisplayParameters> = {
  scale: 1,
  x: 0,
  y: 0,
  brightness: 1,
  opacity: 1,
  rotation: 0,
}

export const CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION: Readonly<CanvasShowManagerTransitionParameters> = {
  type: 'hardCut',
  durationSec: 0.5,
  direction: 'left',
}

export const CANVAS_SHOW_MANAGER_DEFAULT_FX: Readonly<CanvasShowManagerFxParameters> = {
  blur: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  glow: 0,
}

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
  display: CanvasShowManagerDisplayParameters
  transitions: CanvasShowManagerTransitions
  fx: CanvasShowManagerFxParameters
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
  display?: Partial<CanvasShowManagerDisplayParameters>
  transitions?: {
    in?: Partial<CanvasShowManagerTransitionParameters>
    out?: Partial<CanvasShowManagerTransitionParameters>
  }
  fx?: Partial<CanvasShowManagerFxParameters>
}

export interface CanvasShowManagerResolvedElementVisual {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  brightness: number
  fx: CanvasShowManagerFxParameters
  transition: {
    inProgress: number
    outProgress: number
    alpha: number
    offsetX: number
    offsetY: number
    scale: number
  }
}

export type CanvasShowManagerMediaElementMutationResult =
  | { ok: true; show: CanvasShowManagerShow; element: CanvasShowManagerMediaElement }
  | { ok: false; code: 'show-not-found' | 'section-not-found' | 'invalid-media' | 'invalid-layer' | 'invalid-range' | 'invalid-trim' | 'overlap'; message: string }

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

function clampFinite(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = finiteNumber(value)
  return Math.min(max, Math.max(min, parsed ?? fallback))
}

function normalizeTransitionType(value: unknown): CanvasShowManagerTransitionType {
  return value === 'fade' || value === 'slide' || value === 'zoom' || value === 'hardCut' ? value : 'hardCut'
}

function normalizeTransitionDirection(value: unknown): CanvasShowManagerTransitionDirection {
  return value === 'right' || value === 'up' || value === 'down' || value === 'left' ? value : 'left'
}

export function normalizeCanvasShowManagerDisplay(value: unknown): CanvasShowManagerDisplayParameters {
  const raw = isRecord(value) ? value : {}
  return {
    scale: clampFinite(raw.scale, 0.1, 4, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.scale),
    x: clampFinite(raw.x, -2, 2, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.x),
    y: clampFinite(raw.y, -2, 2, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.y),
    brightness: clampFinite(raw.brightness, 0, 2, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.brightness),
    opacity: clampFinite(raw.opacity, 0, 1, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.opacity),
    rotation: clampFinite(raw.rotation, -180, 180, CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY.rotation),
  }
}

function normalizeTransition(value: unknown): CanvasShowManagerTransitionParameters {
  const raw = isRecord(value) ? value : {}
  return {
    type: normalizeTransitionType(raw.type),
    durationSec: clampFinite(raw.durationSec, 0, Number.MAX_SAFE_INTEGER, CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION.durationSec),
    direction: normalizeTransitionDirection(raw.direction),
  }
}

export function normalizeCanvasShowManagerTransitions(
  value: unknown,
  elementDurationSec: number,
): CanvasShowManagerTransitions {
  const raw = isRecord(value) ? value : {}
  const input = normalizeTransition(raw.in)
  const output = normalizeTransition(raw.out)
  const duration = Math.max(CANVAS_SHOW_MANAGER_MIN_ELEMENT_DURATION_SEC, finiteNumber(elementDurationSec) ?? 0)
  input.durationSec = Math.min(duration, input.durationSec)
  output.durationSec = Math.min(duration, output.durationSec)
  const requested = (input.type === 'hardCut' ? 0 : input.durationSec)
    + (output.type === 'hardCut' ? 0 : output.durationSec)
  if (requested > duration && requested > 0) {
    const scale = duration / requested
    if (input.type !== 'hardCut') input.durationSec *= scale
    if (output.type !== 'hardCut') output.durationSec *= scale
  }
  return { in: input, out: output }
}

export function normalizeCanvasShowManagerFx(value: unknown): CanvasShowManagerFxParameters {
  const raw = isRecord(value) ? value : {}
  return {
    blur: clampFinite(raw.blur, 0, 20, CANVAS_SHOW_MANAGER_DEFAULT_FX.blur),
    contrast: clampFinite(raw.contrast, 0, 2, CANVAS_SHOW_MANAGER_DEFAULT_FX.contrast),
    saturation: clampFinite(raw.saturation, 0, 2, CANVAS_SHOW_MANAGER_DEFAULT_FX.saturation),
    hue: clampFinite(raw.hue, -180, 180, CANVAS_SHOW_MANAGER_DEFAULT_FX.hue),
    glow: clampFinite(raw.glow, 0, 1, CANVAS_SHOW_MANAGER_DEFAULT_FX.glow),
  }
}

function defaultCanvasShowManagerElementParameters(elementDurationSec: number) {
  return {
    display: normalizeCanvasShowManagerDisplay(CANVAS_SHOW_MANAGER_DEFAULT_DISPLAY),
    transitions: normalizeCanvasShowManagerTransitions({
      in: CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION,
      out: CANVAS_SHOW_MANAGER_DEFAULT_TRANSITION,
    }, elementDurationSec),
    fx: normalizeCanvasShowManagerFx(CANVAS_SHOW_MANAGER_DEFAULT_FX),
  }
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

export function isCanvasShowManagerLayer(value: unknown): value is CanvasShowManagerLayer {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value < CANVAS_SHOW_MANAGER_LAYER_COUNT
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
    display: normalizeCanvasShowManagerDisplay(raw.display),
    transitions: normalizeCanvasShowManagerTransitions(raw.transitions, showEndSec - showStartSec),
    fx: normalizeCanvasShowManagerFx(raw.fx),
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
    mediaElements: show.mediaElements.map(element => {
      const duration = element.showEndSec - element.showStartSec
      const transitions = normalizeCanvasShowManagerTransitions(element.transitions, duration)
      return {
        ...element,
        display: normalizeCanvasShowManagerDisplay(element.display),
        transitions: { in: { ...transitions.in }, out: { ...transitions.out } },
        fx: normalizeCanvasShowManagerFx(element.fx),
      }
    }),
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
  if (!isCanvasShowManagerLayer(input.layer)) {
    return { ok: false, code: 'invalid-layer', message: 'Choose one of the four explicit Canvas layers.' }
  }
  const layer = input.layer
  if (canvasShowManagerRangeOverlaps(show.mediaElements, layer, start, end)) {
    return { ok: false, code: 'overlap', message: `Layer ${layer + 1} already contains media in that Show cue range.` }
  }
  const sourceDuration = finiteNumber(input.sourceDurationSec)
  const parameters = defaultCanvasShowManagerElementParameters(end - start)
  const element: CanvasShowManagerMediaElement = {
    id: createId('canvas-element'),
    mediaId,
    layer,
    showStartSec: start,
    showEndSec: end,
    sourceInSec: input.timedVideo ? 0 : null,
    sourceOutSec: input.timedVideo && sourceDuration != null && sourceDuration > 0 ? sourceDuration : null,
    ...parameters,
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
  if (patch.layer !== undefined && !isCanvasShowManagerLayer(patch.layer)) {
    return { ok: false, code: 'invalid-layer', message: 'Choose one of the four explicit Canvas layers.' }
  }
  const layer = patch.layer ?? current.layer
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

  const currentDisplay = normalizeCanvasShowManagerDisplay(current.display)
  const currentTransitions = normalizeCanvasShowManagerTransitions(current.transitions, current.showEndSec - current.showStartSec)
  const currentFx = normalizeCanvasShowManagerFx(current.fx)
  const element: CanvasShowManagerMediaElement = {
    ...current,
    layer,
    showStartSec,
    showEndSec,
    sourceInSec,
    sourceOutSec,
    display: normalizeCanvasShowManagerDisplay({ ...currentDisplay, ...patch.display }),
    transitions: normalizeCanvasShowManagerTransitions({
      in: { ...currentTransitions.in, ...patch.transitions?.in },
      out: { ...currentTransitions.out, ...patch.transitions?.out },
    }, showEndSec - showStartSec),
    fx: normalizeCanvasShowManagerFx({ ...currentFx, ...patch.fx }),
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

function transitionDirectionVector(direction: CanvasShowManagerTransitionDirection): { x: number; y: number } {
  switch (direction) {
    case 'right': return { x: 2, y: 0 }
    case 'up': return { x: 0, y: -2 }
    case 'down': return { x: 0, y: 2 }
    case 'left': return { x: -2, y: 0 }
  }
}

/**
 * Pure authored-element frame resolver. Operation order is media fit, Display,
 * FX/color treatment, then transition transform/alpha before layer composite.
 */
export function resolveCanvasShowManagerElementVisual(
  element: CanvasShowManagerMediaElement,
  showTimeSec: number,
): CanvasShowManagerResolvedElementVisual {
  const duration = Math.max(CANVAS_SHOW_MANAGER_MIN_ELEMENT_DURATION_SEC, element.showEndSec - element.showStartSec)
  const transitions = normalizeCanvasShowManagerTransitions(element.transitions, duration)
  const display = normalizeCanvasShowManagerDisplay(element.display)
  const fx = normalizeCanvasShowManagerFx(element.fx)
  const elapsed = Math.min(duration, Math.max(0, (finiteNumber(showTimeSec) ?? element.showStartSec) - element.showStartSec))
  const remaining = Math.min(duration, Math.max(0, element.showEndSec - (finiteNumber(showTimeSec) ?? element.showStartSec)))
  const inProgress = transitions.in.type === 'hardCut' || transitions.in.durationSec <= 0
    ? 1
    : Math.min(1, elapsed / transitions.in.durationSec)
  const outProgress = transitions.out.type === 'hardCut' || transitions.out.durationSec <= 0
    ? 1
    : Math.min(1, remaining / transitions.out.durationSec)
  const incomingVector = transitionDirectionVector(transitions.in.direction)
  const outgoingVector = transitionDirectionVector(transitions.out.direction)
  const inOffset = transitions.in.type === 'slide' ? 1 - inProgress : 0
  const outOffset = transitions.out.type === 'slide' ? 1 - outProgress : 0
  const inScale = transitions.in.type === 'zoom' ? 0.01 + inProgress * 0.99 : 1
  const outScale = transitions.out.type === 'zoom' ? 0.01 + outProgress * 0.99 : 1
  const transitionAlpha = (transitions.in.type === 'fade' ? inProgress : 1)
    * (transitions.out.type === 'fade' ? outProgress : 1)
  return {
    x: display.x + incomingVector.x * inOffset + outgoingVector.x * outOffset,
    y: display.y + incomingVector.y * inOffset + outgoingVector.y * outOffset,
    scale: display.scale * inScale * outScale,
    rotation: display.rotation,
    opacity: display.opacity * transitionAlpha,
    brightness: display.brightness,
    fx,
    transition: {
      inProgress,
      outProgress,
      alpha: transitionAlpha,
      offsetX: incomingVector.x * inOffset + outgoingVector.x * outOffset,
      offsetY: incomingVector.y * inOffset + outgoingVector.y * outOffset,
      scale: inScale * outScale,
    },
  }
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
    const normalizedDisplay = normalizeCanvasShowManagerDisplay(element.display)
    const normalizedTransitions = normalizeCanvasShowManagerTransitions(element.transitions, element.showEndSec - element.showStartSec)
    const normalizedFx = normalizeCanvasShowManagerFx(element.fx)
    if (JSON.stringify(element.display) !== JSON.stringify(normalizedDisplay)) issues.push(`Media element ${index + 1} has invalid Display parameters.`)
    if (JSON.stringify(element.transitions) !== JSON.stringify(normalizedTransitions)) issues.push(`Media element ${index + 1} has invalid transition parameters.`)
    if (JSON.stringify(element.fx) !== JSON.stringify(normalizedFx)) issues.push(`Media element ${index + 1} has invalid FX parameters.`)
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
