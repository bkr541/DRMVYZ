import {
  createDefaultLaserDmxShowDirectorFixture,
  DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  normalizeLaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorRendererMode,
  type ReactSectionType,
  type ReactTrackSection,
} from '../react/ReactTypes'

export const LASER_DMX_SHOW_MANAGER_SCHEMA_VERSION = 2 as const

/** Fixed Part 1 authoring grid. Existing Show Director defaults remain untouched. */
export const LASER_DMX_SHOW_MANAGER_GRID_SIZE = Object.freeze({
  columns: 18,
  rows: 12,
})

export const LASER_DMX_SHOW_MANAGER_QUALITY = 'high' as const

export interface LaserDmxShowManagerWorkspaceSettings {
  showGrid: boolean
  showLabels: boolean
  showBeams: boolean
  highlightGrid: boolean
  rendererMode: LaserDmxShowDirectorRendererMode
}

export type LaserDmxShowManagerWorkspaceSettingsPatch = Partial<LaserDmxShowManagerWorkspaceSettings>

export const DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS: Readonly<LaserDmxShowManagerWorkspaceSettings> = Object.freeze({
  showGrid: DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.showGrid,
  showLabels: DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.showLabels,
  showBeams: DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.showBeams,
  highlightGrid: DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.highlightFixtures,
  rendererMode: DEFAULT_LASER_DMX_SHOW_DIRECTOR_SETTINGS.rendererMode,
})

export const LASER_DMX_SHOW_MANAGER_ENABLED_FIXTURE_KINDS = [
  'laser',
  'strobe',
  'movingHead',
  'ledBar',
] as const satisfies readonly LaserDmxShowDirectorFixtureKind[]

const ENABLED_FIXTURE_KIND_SET = new Set<LaserDmxShowDirectorFixtureKind>(
  LASER_DMX_SHOW_MANAGER_ENABLED_FIXTURE_KINDS,
)

const SECTION_TYPES = new Set<ReactSectionType>([
  'intro',
  'verse',
  'build',
  'preDrop',
  'drop',
  'breakdown',
  'bridge',
  'outro',
  'unknown',
])

export const LASER_DMX_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE = [
  ['intro', 'Intro'],
  ['verse', 'Verse'],
  ['build', 'Build'],
  ['preDrop', 'Pre-Drop'],
  ['drop', 'Drop'],
  ['breakdown', 'Breakdown'],
  ['outro', 'Outro'],
] as const satisfies readonly (readonly [ReactSectionType, string])[]

export interface LaserDmxShowManagerSection extends ReactTrackSection {
  /** Canonical section-local fixture collection. Fixtures are never shared across sections. */
  fixtures: LaserDmxShowDirectorFixture[]
}

export interface LaserDmxShowManagerShow {
  schemaVersion: typeof LASER_DMX_SHOW_MANAGER_SCHEMA_VERSION
  id: string
  name: string
  settings: LaserDmxShowManagerWorkspaceSettings
  sections: LaserDmxShowManagerSection[]
}

export type LaserDmxShowManagerSectionPatch = Partial<Omit<LaserDmxShowManagerSection, 'id' | 'fixtures'>> & {
  fixtures?: readonly LaserDmxShowDirectorFixture[]
}

export type LaserDmxShowManagerTriggerOption =
  | 'none'
  | 'beat'
  | 'downbeat'
  | 'bar'
  | '4bars'
  | '8bars'
  | '16bars'
  | '24bars'
  | 'kickHit'
  | 'snareHit'

export const LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'beat', label: 'Beat' },
  { value: 'downbeat', label: 'Downbeat' },
  { value: 'bar', label: 'Bar' },
  { value: '4bars', label: '4 Bars' },
  { value: '8bars', label: '8 Bars' },
  { value: '16bars', label: '16 Bars' },
  { value: '24bars', label: '24 Bars' },
  { value: 'kickHit', label: 'Kick Hit' },
  { value: 'snareHit', label: 'Snare Hit' },
] as const satisfies readonly { value: LaserDmxShowManagerTriggerOption; label: string }[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function safeId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function safeName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeSectionLabel(value: unknown, type: ReactSectionType): string {
  const fallback = type === 'preDrop' ? 'Pre-Drop' : type.charAt(0).toUpperCase() + type.slice(1)
  const label = safeName(value, fallback)
  if (type !== 'preDrop') return label
  const canonicalCandidate = label.toLowerCase().replace(/[\s-]+/g, '')
  return canonicalCandidate === 'predrop' ? 'Pre-Drop' : label
}

function createId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${uuid}`
}

function normalizeRendererMode(value: unknown): LaserDmxShowDirectorRendererMode {
  return value === 'canvas2d' || value === 'webgl' || value === 'auto'
    ? value
    : DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS.rendererMode
}

export function normalizeLaserDmxShowManagerWorkspaceSettings(
  raw: unknown,
): LaserDmxShowManagerWorkspaceSettings {
  const value = isRecord(raw) ? raw : {}
  return {
    showGrid: typeof value.showGrid === 'boolean'
      ? value.showGrid
      : DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS.showGrid,
    showLabels: typeof value.showLabels === 'boolean'
      ? value.showLabels
      : DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS.showLabels,
    showBeams: typeof value.showBeams === 'boolean'
      ? value.showBeams
      : DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS.showBeams,
    highlightGrid: typeof value.highlightGrid === 'boolean'
      ? value.highlightGrid
      : DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS.highlightGrid,
    rendererMode: normalizeRendererMode(value.rendererMode),
  }
}

function normalizeSectionType(value: unknown): ReactSectionType {
  return typeof value === 'string' && SECTION_TYPES.has(value as ReactSectionType)
    ? value as ReactSectionType
    : 'unknown'
}

function cloneFixture(fixture: LaserDmxShowDirectorFixture, index: number): LaserDmxShowDirectorFixture {
  return normalizeLaserDmxShowManagerFixture(fixture, index)
}

export function isLaserDmxShowManagerFixtureKindEnabled(
  kind: LaserDmxShowDirectorFixtureKind,
): boolean {
  return ENABLED_FIXTURE_KIND_SET.has(kind)
}

export function parseLaserDmxShowManagerFixtureKind(
  value: unknown,
): LaserDmxShowDirectorFixtureKind | null {
  if (typeof value !== 'string') return null
  return LASER_DMX_SHOW_MANAGER_ENABLED_FIXTURE_KINDS.find(kind => kind === value) ?? null
}

export interface LaserDmxShowManagerGridBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface LaserDmxShowManagerGridCell {
  x: number
  y: number
}

/** Maps a client-space pointer into the fixed Part 1 grid using zero-based integer cells. */
export function resolveLaserDmxShowManagerGridCell(
  clientX: number,
  clientY: number,
  bounds: LaserDmxShowManagerGridBounds,
): LaserDmxShowManagerGridCell | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null
  if (!Number.isFinite(bounds.left) || !Number.isFinite(bounds.top)) return null
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return null
  if (bounds.width <= 0 || bounds.height <= 0) return null

  const normalizedX = clamp((clientX - bounds.left) / bounds.width, 0, 1)
  const normalizedY = clamp((clientY - bounds.top) / bounds.height, 0, 1)
  return {
    x: clamp(Math.floor(normalizedX * LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns), 0, LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1),
    y: clamp(Math.floor(normalizedY * LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows), 0, LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1),
  }
}

export function normalizeLaserDmxShowManagerFixture(
  raw: unknown,
  index = 0,
): LaserDmxShowDirectorFixture {
  const normalized = normalizeLaserDmxShowDirectorFixture(raw, index)
  const maxX = LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1
  const maxY = LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1
  const x = clamp(Math.round(finite(normalized.x, 0)), 0, maxX)
  const y = clamp(Math.round(finite(normalized.y, 0)), 0, maxY)
  const targetX = normalized.beam.targetX == null
    ? normalized.beam.targetX
    : clamp(Math.round(finite(normalized.beam.targetX, x)), 0, maxX)
  const targetY = normalized.beam.targetY == null
    ? normalized.beam.targetY
    : clamp(Math.round(finite(normalized.beam.targetY, y)), 0, maxY)

  return {
    ...normalized,
    x,
    y,
    groupId: null,
    colorMode: 'fixed',
    beam: {
      ...normalized.beam,
      targetX,
      targetY,
      targets: normalized.beam.targets?.map(target => ({
        ...target,
        x: clamp(Math.round(finite(target.x, x)), 0, maxX),
        y: clamp(Math.round(finite(target.y, y)), 0, maxY),
      })),
    },
  }
}

export function createLaserDmxShowManagerFixture(
  kind: LaserDmxShowDirectorFixtureKind,
  index: number,
  patch: LaserDmxShowDirectorFixturePatch = {},
): LaserDmxShowDirectorFixture | null {
  if (!isLaserDmxShowManagerFixtureKindEnabled(kind)) return null
  const id = createId('laser-dmx-fixture')
  const base = createDefaultLaserDmxShowDirectorFixture(kind, id, index)
  return normalizeLaserDmxShowManagerFixture({
    ...base,
    ...patch,
    id,
    kind,
    groupId: null,
    colorMode: 'fixed',
    beam: patch.beam ? { ...base.beam, ...patch.beam } : base.beam,
    trigger: patch.trigger ? { ...base.trigger, ...patch.trigger } : base.trigger,
    component: patch.component ? { ...base.component, ...patch.component } : base.component,
    optics: patch.optics ? { ...base.optics, ...patch.optics } : base.optics,
  }, index)
}

export function triggerPatchForLaserDmxShowManagerOption(
  option: LaserDmxShowManagerTriggerOption,
): NonNullable<LaserDmxShowDirectorFixturePatch['trigger']> {
  switch (option) {
    case 'beat':
      return { mode: 'beat', quantize: 'beat', retrigger: 'oncePerBeat', beatDivision: 1, fadeInMs: 0, fadeOutMs: 140 }
    case 'downbeat':
      // The canonical Show Director runtime represents a downbeat as a one-bar trigger.
      // `quantize: beat` preserves the authoring distinction from the explicit Bar option.
      return { mode: 'bar', quantize: 'beat', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 1, fadeInMs: 0, fadeOutMs: 220 }
    case 'bar':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 1, fadeInMs: 0, fadeOutMs: 220 }
    case '4bars':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 4, fadeInMs: 0, fadeOutMs: 360 }
    case '8bars':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 8, fadeInMs: 0, fadeOutMs: 360 }
    case '16bars':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 16, fadeInMs: 0, fadeOutMs: 360 }
    case '24bars':
      return { mode: 'bar', quantize: 'bar', retrigger: 'oncePerBar', beatDivision: 1, barInterval: 24, fadeInMs: 0, fadeOutMs: 360 }
    case 'kickHit':
      return { mode: 'bassHit', quantize: 'none', retrigger: 'allow', audioBand: 'bass', audioThreshold: 0.65, fadeInMs: 0, fadeOutMs: 160 }
    case 'snareHit':
      return { mode: 'snareTransient', quantize: 'none', retrigger: 'allow', audioBand: 'highMid', audioThreshold: 0.58, fadeInMs: 0, fadeOutMs: 120 }
    case 'none':
    default:
      return { mode: 'alwaysOn', quantize: 'none', retrigger: 'allow', beatDivision: 1, barInterval: 1, fadeInMs: 0, fadeOutMs: 0 }
  }
}

export function resolveLaserDmxShowManagerTriggerOption(
  trigger: LaserDmxShowDirectorFixture['trigger'],
): LaserDmxShowManagerTriggerOption {
  switch (trigger.mode) {
    case 'beat':
      return 'beat'
    case 'bar':
      if (trigger.barInterval === 24) return '24bars'
      if (trigger.barInterval === 16) return '16bars'
      if (trigger.barInterval === 8) return '8bars'
      if (trigger.barInterval === 4) return '4bars'
      return trigger.quantize === 'beat' ? 'downbeat' : 'bar'
    case 'bassHit':
      return 'kickHit'
    case 'snareTransient':
      return 'snareHit'
    case 'alwaysOn':
    default:
      return 'none'
  }
}

export function createDefaultLaserDmxShowManagerSections(
  showId: string,
): LaserDmxShowManagerSection[] {
  return LASER_DMX_SHOW_MANAGER_DEFAULT_SECTION_TEMPLATE.map(([type, label], index) => ({
    id: `${showId}:section:${type}:${index + 1}`,
    label,
    type,
    // React Track Map sections require finite start/end values. Without audio,
    // Part 1 uses compact ordinal windows only to preserve the canonical model;
    // these values are not analysis and may later be replaced by authored timing.
    startSec: index,
    endSec: index + 1,
    intensity: type === 'drop' ? 1 : type === 'build' || type === 'preDrop' ? 0.8 : 0.55,
    engineId: 'laserDmx',
    source: 'user-created',
    fixtures: [],
  }))
}

export function createLaserDmxShowManagerShow(name = 'Untitled Show'): LaserDmxShowManagerShow {
  const id = createId('laser-dmx-show')
  return {
    schemaVersion: LASER_DMX_SHOW_MANAGER_SCHEMA_VERSION,
    id,
    name: safeName(name, 'Untitled Show'),
    settings: normalizeLaserDmxShowManagerWorkspaceSettings(undefined),
    sections: createDefaultLaserDmxShowManagerSections(id),
  }
}

export function normalizeLaserDmxShowManagerSection(
  raw: unknown,
  showId: string,
  index: number,
): LaserDmxShowManagerSection | null {
  if (!isRecord(raw)) return null
  const type = normalizeSectionType(raw.type)
  const id = safeId(raw.id, `${showId}:section:${type}:${index + 1}`)
  const startSec = Math.max(0, finite(raw.startSec, index))
  const endSec = Math.max(startSec + 0.001, finite(raw.endSec, startSec + 1))
  const rawFixtures = Array.isArray(raw.fixtures) ? raw.fixtures : []
  const confidenceFields = {
    ...(typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? { confidence: raw.confidence } : {}),
    ...(typeof raw.boundaryConfidence === 'number' && Number.isFinite(raw.boundaryConfidence) ? { boundaryConfidence: raw.boundaryConfidence } : {}),
    ...(typeof raw.labelConfidence === 'number' && Number.isFinite(raw.labelConfidence) ? { labelConfidence: raw.labelConfidence } : {}),
    ...(typeof raw.gridConfidence === 'number' && Number.isFinite(raw.gridConfidence) ? { gridConfidence: raw.gridConfidence } : {}),
    ...(typeof raw.analysisConfidence === 'number' && Number.isFinite(raw.analysisConfidence) ? { analysisConfidence: raw.analysisConfidence } : {}),
    ...(typeof raw.dropConfidence === 'number' && Number.isFinite(raw.dropConfidence) ? { dropConfidence: raw.dropConfidence } : {}),
  }
  const fixtures = rawFixtures
    .map((fixture, fixtureIndex) => normalizeLaserDmxShowManagerFixture(fixture, fixtureIndex))
    .filter(fixture => isLaserDmxShowManagerFixtureKindEnabled(fixture.kind))
    .map((fixture, fixtureIndex) => cloneFixture(fixture, fixtureIndex))

  return {
    id,
    label: normalizeSectionLabel(raw.label, type),
    type,
    startSec,
    endSec,
    intensity: clamp(finite(raw.intensity, 0.55), 0, 1),
    engineId: 'laserDmx',
    source: raw.source === 'manual' || raw.source === 'user-edited-auto' || raw.source === 'user-created'
      ? raw.source
      : 'user-created',
    ...(typeof raw.locked === 'boolean' ? { locked: raw.locked } : {}),
    ...(isRecord(raw.provenance) ? { provenance: { ...raw.provenance } as unknown as ReactTrackSection['provenance'] } : {}),
    ...confidenceFields,
    ...(isRecord(raw.interpretation) ? { interpretation: raw.interpretation as ReactTrackSection['interpretation'] } : {}),
    fixtures,
  }
}

export function normalizeLaserDmxShowManagerShow(
  raw: unknown,
  fallbackIndex = 0,
): LaserDmxShowManagerShow {
  const value = isRecord(raw) ? raw : {}
  const id = safeId(value.id, `laser-dmx-show-recovered-${fallbackIndex + 1}`)
  const hasExplicitSections = Array.isArray(value.sections)
  const normalizedSections = hasExplicitSections
    ? (value.sections as unknown[])
        .map((section, index) => normalizeLaserDmxShowManagerSection(section, id, index))
        .filter((section): section is LaserDmxShowManagerSection => section !== null)
    : createDefaultLaserDmxShowManagerSections(id)

  return {
    schemaVersion: LASER_DMX_SHOW_MANAGER_SCHEMA_VERSION,
    id,
    name: safeName(value.name, `Show ${fallbackIndex + 1}`),
    settings: normalizeLaserDmxShowManagerWorkspaceSettings(value.settings),
    sections: normalizedSections,
  }
}

export function normalizeLaserDmxShowManagerShows(raw: unknown): LaserDmxShowManagerShow[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw.map((show, index) => normalizeLaserDmxShowManagerShow(show, index)).map((show, index) => {
    if (!seen.has(show.id)) {
      seen.add(show.id)
      return show
    }
    const id = `${show.id}-${index + 1}`
    seen.add(id)
    return {
      ...show,
      id,
      settings: { ...show.settings },
      sections: show.sections.map((section, sectionIndex) => ({
        ...section,
        id: `${id}:section:${section.type}:${sectionIndex + 1}`,
        fixtures: section.fixtures.map((fixture, fixtureIndex) => cloneFixture(fixture, fixtureIndex)),
      })),
    }
  })
}

export function cloneLaserDmxShowManagerShow(show: LaserDmxShowManagerShow): LaserDmxShowManagerShow {
  return {
    ...show,
    settings: { ...show.settings },
    sections: show.sections.map((section, sectionIndex) => ({
      ...section,
      provenance: section.provenance ? { ...section.provenance } : undefined,
      fixtures: section.fixtures.map((fixture, fixtureIndex) => cloneFixture(fixture, fixtureIndex)),
    })),
  }
}

export function updateLaserDmxShowManagerWorkspaceSettings(
  show: LaserDmxShowManagerShow,
  patch: LaserDmxShowManagerWorkspaceSettingsPatch,
): LaserDmxShowManagerShow {
  return {
    ...show,
    settings: normalizeLaserDmxShowManagerWorkspaceSettings({
      ...show.settings,
      ...patch,
    }),
  }
}

export function updateLaserDmxShowManagerSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
  patch: LaserDmxShowManagerSectionPatch,
): LaserDmxShowManagerShow {
  if (!show.sections.some(section => section.id === sectionId)) return show
  return {
    ...show,
    sections: show.sections.map((section, index) => section.id !== sectionId
      ? section
      : normalizeLaserDmxShowManagerSection({
          ...section,
          ...patch,
          id: section.id,
          fixtures: patch.fixtures ?? section.fixtures,
        }, show.id, index) ?? section),
  }
}

export function addLaserDmxShowManagerSection(
  show: LaserDmxShowManagerShow,
  seed: Partial<ReactTrackSection> = {},
): { show: LaserDmxShowManagerShow; sectionId: string } {
  const last = show.sections[show.sections.length - 1]
  const type = normalizeSectionType(seed.type ?? 'unknown')
  const sectionId = createId('laser-dmx-section')
  const startSec = Math.max(0, finite(seed.startSec, last?.endSec ?? 0))
  const candidate: LaserDmxShowManagerSection = {
    id: sectionId,
    label: normalizeSectionLabel(seed.label, type),
    type,
    startSec,
    endSec: Math.max(startSec + 0.001, finite(seed.endSec, startSec + 1)),
    intensity: clamp(finite(seed.intensity, 0.55), 0, 1),
    engineId: 'laserDmx',
    source: 'user-created',
    fixtures: [],
  }
  return { show: { ...show, sections: [...show.sections, candidate] }, sectionId }
}

export function removeLaserDmxShowManagerSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
): LaserDmxShowManagerShow {
  const sections = show.sections.filter(section => section.id !== sectionId)
  return sections.length === show.sections.length ? show : { ...show, sections }
}

export function reorderLaserDmxShowManagerSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
  direction: -1 | 1,
): LaserDmxShowManagerShow {
  const index = show.sections.findIndex(section => section.id === sectionId)
  const target = index + direction
  if (index < 0 || target < 0 || target >= show.sections.length) return show
  const sections = show.sections.map(section => ({ ...section }))
  const sourceSection = sections[index]
  const targetSection = sections[target]
  if (!sourceSection || !targetSection) return show
  const sourceWindow = { startSec: sourceSection.startSec, endSec: sourceSection.endSec }
  const targetWindow = { startSec: targetSection.startSec, endSec: targetSection.endSec }
  sections[target] = { ...sourceSection, ...targetWindow }
  sections[index] = { ...targetSection, ...sourceWindow }
  return { ...show, sections }
}

export function addLaserDmxShowManagerFixtureToSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
  kind: LaserDmxShowDirectorFixtureKind,
  patch: LaserDmxShowDirectorFixturePatch = {},
): { show: LaserDmxShowManagerShow; fixtureId: string | null } {
  const section = show.sections.find(candidate => candidate.id === sectionId)
  if (!section) return { show, fixtureId: null }
  const labelPrefix = `${LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]} `
  const nextKindOrdinal = section.fixtures.reduce((maximum, fixture) => {
    if (fixture.kind !== kind || !fixture.label.startsWith(labelPrefix)) return maximum
    const ordinal = Number.parseInt(fixture.label.slice(labelPrefix.length), 10)
    return Number.isFinite(ordinal) ? Math.max(maximum, ordinal) : maximum
  }, 0) + 1
  const fixture = createLaserDmxShowManagerFixture(kind, nextKindOrdinal - 1, patch)
  if (!fixture) return { show, fixtureId: null }
  return {
    show: updateLaserDmxShowManagerSection(show, sectionId, {
      fixtures: [...section.fixtures.map((item, index) => cloneFixture(item, index)), fixture],
    }),
    fixtureId: fixture.id,
  }
}

export function updateLaserDmxShowManagerFixtureInSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
  fixtureId: string,
  patch: LaserDmxShowDirectorFixturePatch,
): LaserDmxShowManagerShow {
  const section = show.sections.find(candidate => candidate.id === sectionId)
  if (!section) return show
  const fixtureIndex = section.fixtures.findIndex(candidate => candidate.id === fixtureId)
  const fixture = section.fixtures[fixtureIndex]
  if (!fixture) return show

  const normalized = normalizeLaserDmxShowManagerFixture({
    ...fixture,
    ...patch,
    id: fixture.id,
    kind: fixture.kind,
    groupId: null,
    colorMode: 'fixed',
    beam: patch.beam ? { ...fixture.beam, ...patch.beam } : fixture.beam,
    trigger: patch.trigger ? { ...fixture.trigger, ...patch.trigger } : fixture.trigger,
    component: patch.component ? { ...fixture.component, ...patch.component } : fixture.component,
    optics: patch.optics ? { ...fixture.optics, ...patch.optics } : fixture.optics,
  }, fixtureIndex)

  return updateLaserDmxShowManagerSection(show, sectionId, {
    fixtures: section.fixtures.map((candidate, index) => index === fixtureIndex ? normalized : candidate),
  })
}

export function removeLaserDmxShowManagerFixtureFromSection(
  show: LaserDmxShowManagerShow,
  sectionId: string,
  fixtureId: string,
): LaserDmxShowManagerShow {
  const section = show.sections.find(candidate => candidate.id === sectionId)
  if (!section || !section.fixtures.some(candidate => candidate.id === fixtureId)) return show
  return updateLaserDmxShowManagerSection(show, sectionId, {
    fixtures: section.fixtures.filter(candidate => candidate.id !== fixtureId),
  })
}
