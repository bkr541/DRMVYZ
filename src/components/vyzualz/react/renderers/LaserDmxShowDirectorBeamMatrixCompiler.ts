import {
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_MATRIX_ROWS,
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
} from '../ReactTypes'
import type {
  LaserDmxBeamMatrixCue,
  LaserDmxBeamMatrixSettings,
  LaserDmxLaunchSettings,
  LaserDmxMatrixBeam,
  LaserDmxMatrixBeamAppearance,
  LaserDmxMatrixBeamColor,
  LaserDmxMatrixBeamVisualRole,
  LaserDmxMatrixGridAnchor,
  LaserDmxMatrixTarget,
  LaserDmxModulationRoute,
  LaserDmxReactionGroup,
  LaserDmxShowDirectorAudioBand,
  LaserDmxShowDirectorBeamTarget,
  LaserDmxShowDirectorBeatDivision,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorSectionType,
  LaserDmxShowDirectorLedDirection,
  LaserDmxShowDirectorState,
  LaserDmxShowDirectorTriggerConfig,
  ReactTrackSection,
} from '../ReactTypes'
import type { LaserDmxShowDirectorBeamPriorityRole } from '../LaserDmxShowDirectorPerformanceProgram'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { VzCueMarker } from '../../../../types/cue'

export interface CompileLaserDmxShowDirectorToBeamMatrixInput {
  showDirector: LaserDmxShowDirectorState
  /** Manual Beam Matrix program supplies output/fog/editor/global modulation defaults only. */
  beamMatrix: LaserDmxBeamMatrixSettings
  /** Existing offline analysis / Music Intelligence timing data, when a track is loaded. */
  analysis?: TrackIntelligenceAnalysis | null
  /** Manual-section-aware React track sections. Preferred over analysis sections when present. */
  sections?: readonly ReactTrackSection[] | null
  /** Manual or imported cue markers from the visual timeline. */
  cueMarkers?: readonly VzCueMarker[] | null
  /** Optional deterministic runtime priority. Omitted for authored/static compilation to preserve legacy ordering exactly. */
  fixturePriorityById?: Readonly<Record<string, number>> | null
  /** Optional role map used only for transient Show Director visual hierarchy. */
  fixturePriorityRoleById?: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>> | null
}

interface StagePoint01 {
  x: number
  y: number
  z: number
}

interface FixtureCompileContext {
  gridColumns: number
  gridRows: number
  matrixBeams: LaserDmxMatrixBeam[]
  groups: LaserDmxReactionGroup[]
  globalRoutes: LaserDmxModulationRoute[]
  cues: LaserDmxBeamMatrixCue[]
  analysis: TrackIntelligenceAnalysis | null
  sections: readonly ReactTrackSection[]
  cueMarkers: readonly VzCueMarker[]
  outputBeamCount: number
  hazeIntensity: number
  groupLabels: Map<string, string>
  hasRenderableFixture: boolean
  fixturePriorityRoleById: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>>
}

const KIND_DEFAULT_COLORS: Record<LaserDmxShowDirectorFixtureKind, string> = {
  laser:      '#4ac7db',
  movingHead: '#67f7ff',
  ledBar:     '#61d6aa',
  ledTube:    '#8be9ff',
  strobe:     '#ffffff',
  blinder:    '#ffd68a',
  parWash:    '#8a7dff',
  videoWall:  '#4ac7db',
  haze:       '#9cc9d8',
  co2Jet:     '#dff8ff',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function finite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(finite(value, fallback))))
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96) || 'fixture'
}

function groupIdForFixture(fixture: LaserDmxShowDirectorFixture): string {
  return `sd-group-${safeIdPart(fixture.id)}`
}

function beamIdForFixture(fixture: LaserDmxShowDirectorFixture, suffix: string): string {
  return `sd-${safeIdPart(fixture.id)}-${suffix}`
}

function parseHexColor(value: string, fallback: string): LaserDmxMatrixBeamColor {
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(value.trim())?.[1]
    ?? /^#?([0-9a-fA-F]{3})$/.exec(value.trim())?.[1]?.replace(/(.)/g, '$1$1')
    ?? /^#?([0-9a-fA-F]{6})$/.exec(fallback)?.[1]
    ?? '4ac7db'
  return {
    red:   parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue:  parseInt(hex.slice(4, 6), 16),
    white: 0,
    alpha: 1,
  }
}

function isSupportedFixtureKind(kind: unknown): kind is LaserDmxShowDirectorFixtureKind {
  return typeof kind === 'string' && kind in KIND_DEFAULT_COLORS
}

function hasFixtureShape(fixture: LaserDmxShowDirectorFixture): boolean {
  const candidate = fixture as Partial<LaserDmxShowDirectorFixture>
  return typeof candidate.id === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.color === 'string'
    && typeof candidate.beam === 'object'
    && candidate.beam !== null
    && typeof candidate.trigger === 'object'
    && candidate.trigger !== null
    && typeof candidate.component === 'object'
    && candidate.component !== null
}

function colorForFixture(fixture: LaserDmxShowDirectorFixture): LaserDmxMatrixBeamColor {
  const fallback = isSupportedFixtureKind(fixture.kind) ? KIND_DEFAULT_COLORS[fixture.kind] : KIND_DEFAULT_COLORS.laser
  const color = fixture.colorMode === 'fixtureDefault' ? fallback : fixture.color
  return parseHexColor(color, fallback)
}

function warmWhiteColor(): LaserDmxMatrixBeamColor {
  return { red: 255, green: 215, blue: 142, white: 64, alpha: 1 }
}

function stagePointForFixture(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): StagePoint01 {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  return {
    x: clamp(finite(fixture.x, 0), 0, maxX) / maxX,
    y: clamp(finite(fixture.y, 0), 0, maxY) / maxY,
    z: clamp(finite(fixture.z, 0), -1, 1),
  }
}

function gridAnchorFromStagePoint(point: StagePoint01): LaserDmxMatrixGridAnchor {
  return {
    column: clamp(Math.round(point.x * (LASER_DMX_MATRIX_COLUMNS - 1)) + 1, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(Math.round(point.y * (LASER_DMX_MATRIX_ROWS - 1)) + 1, 1, LASER_DMX_MATRIX_ROWS),
    z:      clamp(point.z, -1, 1),
  }
}

function offsetGridAnchor(anchor: LaserDmxMatrixGridAnchor, columnOffset: number, rowOffset: number): LaserDmxMatrixGridAnchor {
  return {
    column: clamp(anchor.column + columnOffset, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(anchor.row + rowOffset, 1, LASER_DMX_MATRIX_ROWS),
    z:      anchor.z,
  }
}

function stageTargetFromAngle(point: StagePoint01, angleDeg: number, length = 0.55): LaserDmxMatrixTarget {
  const radians = angleDeg * Math.PI / 180
  return {
    kind: 'stage',
    x: point.x + Math.cos(radians) * length,
    y: point.y + Math.sin(radians) * length,
    z: point.z,
  }
}

function defaultGridEndpointForFixture(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): { x: number; y: number } {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  const distance = Math.max(2, Math.min(gridColumns, gridRows) * 0.32)
  const radians = (finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)) * Math.PI / 180
  return {
    x: clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, maxX),
    y: clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, maxY),
  }
}

function gridTargetFromFixtureTarget(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): LaserDmxMatrixTarget {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  const defaultEndpoint = defaultGridEndpointForFixture(fixture, gridColumns, gridRows)
  const targetX = clamp(finite(fixture.beam.targetX, defaultEndpoint.x), 0, maxX) / maxX
  const targetY = clamp(finite(fixture.beam.targetY, defaultEndpoint.y), 0, maxY) / maxY
  return {
    kind: 'grid',
    column: clamp(Math.round(targetX * (LASER_DMX_MATRIX_COLUMNS - 1)) + 1, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(Math.round(targetY * (LASER_DMX_MATRIX_ROWS - 1)) + 1, 1, LASER_DMX_MATRIX_ROWS),
    z:      clamp(finite(fixture.beam.targetZ, 0), -1, 1),
  }
}

function editableTargetsForFixture(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): LaserDmxShowDirectorBeamTarget[] {
  const defaultEndpoint = defaultGridEndpointForFixture(fixture, gridColumns, gridRows)
  const primary = {
    x: clamp(finite(fixture.beam.targetX, defaultEndpoint.x), 0, Math.max(1, gridColumns - 1)),
    y: clamp(finite(fixture.beam.targetY, defaultEndpoint.y), 0, Math.max(1, gridRows - 1)),
  }
  const rawTargets = Array.isArray(fixture.beam.targets) ? fixture.beam.targets : []
  const targets = rawTargets
    .filter((target): target is LaserDmxShowDirectorBeamTarget => target != null && typeof target === 'object')
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index) => ({
      id: typeof target.id === 'string' && target.id.trim().length > 0 ? target.id : `${fixture.id}-target-${index + 1}`,
      x:  clamp(finite(target.x, primary.x), 0, Math.max(1, gridColumns - 1)),
      y:  clamp(finite(target.y, primary.y), 0, Math.max(1, gridRows - 1)),
    }))
  if (targets.length === 0) return [{ id: `${fixture.id}-target-1`, ...primary }]
  return [{ ...targets[0], ...primary }, ...targets.slice(1)]
}

function gridTargetFromEditableTarget(
  fixture: LaserDmxShowDirectorFixture,
  target: LaserDmxShowDirectorBeamTarget,
  gridColumns: number,
  gridRows: number,
): LaserDmxMatrixTarget {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  const targetX = clamp(finite(target.x, 0), 0, maxX) / maxX
  const targetY = clamp(finite(target.y, 0), 0, maxY) / maxY
  return {
    kind: 'grid',
    column: clamp(Math.round(targetX * (LASER_DMX_MATRIX_COLUMNS - 1)) + 1, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(Math.round(targetY * (LASER_DMX_MATRIX_ROWS - 1)) + 1, 1, LASER_DMX_MATRIX_ROWS),
    z:      clamp(finite(fixture.beam.targetZ, 0), -1, 1),
  }
}

function defaultAppearance(fixture: LaserDmxShowDirectorFixture, patch: Partial<LaserDmxMatrixBeamAppearance> = {}): LaserDmxMatrixBeamAppearance {
  const brightness = clamp01(finite(fixture.brightness, 0.85))
  const spread = clamp(finite(fixture.beam.beamSpread, 0), 0, 180)
  return {
    dimmer:        brightness,
    shutterOpen:   fixture.enabled,
    width:         1,
    focus:         clamp01(finite(fixture.beam.focus, 0.8)),
    strobeRate:    0,
    flickerAmount: 0,
    divergence:    clamp01(spread / 180),
    glow:          0.72,
    geometry:      'line',
    ...patch,
    ...(fixture.runtimeBeamAppearance ?? {}),
  }
}

function makeRoute(
  id: string,
  source: string,
  target: LaserDmxModulationRoute['target'],
  options: Partial<LaserDmxModulationRoute> = {},
): LaserDmxModulationRoute {
  return {
    id,
    enabled: true,
    source,
    target,
    amount: 1,
    min: 0,
    max: 1,
    curve: 'linear',
    mode: 'set',
    smoothing: 0.1,
    attack: 0,
    release: 0.16,
    invert: false,
    ...options,
  }
}

function sourceForAudioBand(audioBand: LaserDmxShowDirectorAudioBand): string {
  switch (audioBand) {
    case 'sub': return 'nSub'
    case 'bass': return 'nBass'
    case 'lowMid': return 'nLowMid'
    case 'mid': return 'nMid'
    case 'highMid':
    case 'high': return 'nHigh'
    default: return 'nBass'
  }
}

function beatDivisionSource(trigger: LaserDmxShowDirectorTriggerConfig): string {
  const division = finite(trigger.beatDivision, 1)
  const supported: LaserDmxShowDirectorBeatDivision = division === 0.25 || division === 0.5 || division === 2 || division === 4 || division === 8
    ? division
    : 1
  return `beatDivision:${supported}`
}

function sectionTypesForTrigger(trigger: LaserDmxShowDirectorTriggerConfig): LaserDmxShowDirectorSectionType[] {
  const allowed = Array.isArray(trigger.sectionTypes)
    ? trigger.sectionTypes.filter((section): section is LaserDmxShowDirectorSectionType => (
        section === 'intro'
        || section === 'verse'
        || section === 'build'
        || section === 'preDrop'
        || section === 'drop'
        || section === 'breakdown'
        || section === 'bridge'
        || section === 'outro'
        || section === 'unknown'
      ))
    : []
  return allowed.length > 0 ? allowed : ['drop']
}

function sectionSource(trigger: LaserDmxShowDirectorTriggerConfig): string {
  return `section:${sectionTypesForTrigger(trigger).join(',')}`
}

function triggerSource(trigger: LaserDmxShowDirectorTriggerConfig): string | null {
  switch (trigger.mode) {
    case 'beat': return beatDivisionSource(trigger)
    case 'bar': return 'downbeat'
    // Legacy phrase4/8/16/32 sources are beat-counted. Show Director phrases are musical bars.
    case 'phrase': return 'downbeat'
    case 'section': return sectionSource(trigger)
    case 'bassHit': return 'kick'
    case 'snareTransient': return 'snare'
    case 'energy': return 'dropImpact'
    case 'audioBand': return `audioBand:${sourceForAudioBand(trigger.audioBand)}`
    default: return null
  }
}

function launchForTrigger(trigger: LaserDmxShowDirectorTriggerConfig): LaserDmxLaunchSettings {
  switch (trigger.mode) {
    case 'beat':
      return { trigger: 'beat', threshold: 0.2, cooldownBeats: Math.max(0, finite(trigger.beatDivision, 1) - 0.1), minimumEnergy: 0 }
    case 'bar':
      return { trigger: 'downbeat', threshold: 0.2, cooldownBeats: 0, cooldownBars: positiveInt(trigger.barInterval, 1, 1, 64), minimumEnergy: 0 }
    case 'phrase':
      return { trigger: 'downbeat', threshold: 0.2, cooldownBeats: 0, cooldownBars: positiveInt(trigger.phraseLengthBars, 8, 1, 128), minimumEnergy: 0 }
    case 'bassHit':
      return { trigger: 'kick', threshold: clamp01(finite(trigger.audioThreshold, 0.65)), cooldownBeats: 0.25, minimumEnergy: 0 }
    case 'snareTransient':
      return { trigger: 'snare', threshold: clamp01(finite(trigger.audioThreshold, 0.65)), cooldownBeats: 0.25, minimumEnergy: 0 }
    case 'audioBand':
      return trigger.audioBand === 'sub' || trigger.audioBand === 'bass'
        ? { trigger: 'kick', threshold: clamp01(finite(trigger.audioThreshold, 0.65)), cooldownBeats: 0.25, minimumEnergy: 0 }
        : { ...DEFAULT_LAUNCH_SETTINGS, trigger: 'none', threshold: 0, cooldownBeats: 0, minimumEnergy: 0 }
    case 'energy':
      return { trigger: 'dropImpact', threshold: clamp01(finite(trigger.energyThreshold, 0.7)), cooldownBeats: 2, minimumEnergy: clamp01(finite(trigger.energyThreshold, 0.7)) * 0.5 }
    default:
      return DEFAULT_LAUNCH_SETTINGS
  }
}

function triggerDimmerRoutes(
  fixture: LaserDmxShowDirectorFixture,
  suffix = 'trigger',
): LaserDmxModulationRoute[] {
  const trigger = fixture.trigger
  const brightness = clamp01(finite(fixture.brightness, 0.85))
  const attack = Math.max(0, finite(trigger.fadeInMs, 0) / 1000)
  const release = Math.max(0.03, finite(trigger.fadeOutMs, 120) / 1000)

  if (trigger.mode === 'alwaysOn' || trigger.mode === 'cuePoint') return []

  if (trigger.mode === 'section') {
    return [makeRoute(
      `sd-${safeIdPart(fixture.id)}-${suffix}-section`,
      sectionSource(trigger),
      'dimmer',
      {
        min: 0,
        max: brightness,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.22,
        attack,
        release,
        threshold: 0.04,
      },
    )]
  }

  const source = trigger.mode === 'energy' ? 'energy' : triggerSource(trigger)
  if (!source) return []

  if (trigger.mode === 'energy') {
    return [makeRoute(
      `sd-${safeIdPart(fixture.id)}-${suffix}-energy`,
      source,
      'dimmer',
      {
        min: 0,
        max: brightness,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.18,
        attack,
        release,
        threshold: clamp01(finite(trigger.energyThreshold, 0.7)),
      },
    )]
  }

  return [makeRoute(
    `sd-${safeIdPart(fixture.id)}-${suffix}-hit`,
    source,
    'dimmer',
    {
      min: 0,
      max: brightness,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: trigger.mode === 'bar' || trigger.mode === 'phrase' ? 0.05 : 0.025,
      release,
      threshold: trigger.mode === 'audioBand' || trigger.mode === 'bassHit' || trigger.mode === 'snareTransient'
        ? clamp01(finite(trigger.audioThreshold, 0.65))
        : undefined,
      timingFilter: trigger.mode === 'bar'
        ? { mode: 'barInterval', intervalBars: positiveInt(trigger.barInterval, 1, 1, 64), intervalAnchorBar: 1 }
        : trigger.mode === 'phrase'
          ? { mode: 'barInterval', intervalBars: positiveInt(trigger.phraseLengthBars, 8, 1, 128), intervalAnchorBar: 1 }
          : undefined,
    },
  )]
}

interface ShowDirectorTimingSection {
  id: string
  label: string
  type: LaserDmxShowDirectorSectionType | null
  startSec: number
  endSec: number
  intensity: number
  confidence: number
}

const IDLE_CUE_START_MS = Number.MAX_SAFE_INTEGER - 1000

function normalizeToken(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
    : ''
}

function canonicalShowDirectorSectionType(value: unknown): LaserDmxShowDirectorSectionType | null {
  switch (value) {
    case 'intro': return 'intro'
    case 'verse': return 'verse'
    case 'build': return 'build'
    case 'preDrop': return 'preDrop'
    case 'drop': return 'drop'
    case 'break':
    case 'breakdown': return 'breakdown'
    case 'bridge': return 'bridge'
    case 'outro': return 'outro'
    case 'unknown': return 'unknown'
    default: return null
  }
}

function timingSectionFromReact(section: ReactTrackSection): ShowDirectorTimingSection | null {
  const startSec = finite(section.startSec, Number.NaN)
  const endSec = finite(section.endSec, Number.NaN)
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
  return {
    id: section.id,
    label: section.label,
    type: canonicalShowDirectorSectionType(section.type),
    startSec,
    endSec,
    intensity: clamp01(finite(section.intensity, 1)),
    confidence: clamp01(finite(section.confidence, 1)),
  }
}

function timingSectionFromAnalysis(section: TrackIntelligenceAnalysis['sections'][number]): ShowDirectorTimingSection | null {
  const startSec = finite(section.startSec, Number.NaN)
  const endSec = finite(section.endSec, Number.NaN)
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return null
  return {
    id: section.id,
    label: section.label,
    type: canonicalShowDirectorSectionType(section.type),
    startSec,
    endSec,
    intensity: clamp01(finite(section.intensity, 1)),
    confidence: clamp01(finite(section.confidence, 1)),
  }
}

function collectTimingSections(ctx: FixtureCompileContext): ShowDirectorTimingSection[] {
  const manualSections = ctx.sections.map(timingSectionFromReact).filter((section): section is ShowDirectorTimingSection => section != null)
  if (manualSections.length > 0) return manualSections
  return (ctx.analysis?.sections ?? [])
    .map(timingSectionFromAnalysis)
    .filter((section): section is ShowDirectorTimingSection => section != null)
}

function sectionMatchesTrigger(section: ShowDirectorTimingSection, trigger: LaserDmxShowDirectorTriggerConfig): boolean {
  if (!section.type) return false
  return sectionTypesForTrigger(trigger).includes(section.type)
}

function cueNeedles(trigger: LaserDmxShowDirectorTriggerConfig): string[] {
  return trigger.cuePointIds.map(normalizeToken).filter(Boolean)
}

function cueCandidateMatches(needles: string[], ...candidates: unknown[]): boolean {
  if (needles.length === 0) return true
  const haystack = candidates
    .map(normalizeToken)
    .filter(Boolean)
  return needles.some(needle => haystack.some(candidate => (
    candidate === needle
    || candidate.includes(needle)
    || needle.includes(candidate)
  )))
}

function cueMarkerMatchesTrigger(marker: VzCueMarker, trigger: LaserDmxShowDirectorTriggerConfig): boolean {
  const markerType = canonicalShowDirectorSectionType(marker.type)
  return cueCandidateMatches(
    cueNeedles(trigger),
    marker.id,
    marker.label,
    marker.type,
    markerType,
    marker.kind,
    marker.externalId,
    marker.source,
  )
}

function semanticMomentMatchesTrigger(moment: TrackIntelligenceAnalysis['semanticMoments'][number], trigger: LaserDmxShowDirectorTriggerConfig): boolean {
  const canonicalType = moment.type === 'high_impact' ? 'drop' : canonicalShowDirectorSectionType(moment.type)
  return cueCandidateMatches(cueNeedles(trigger), moment.type, canonicalType, moment.label, moment.source)
}

function cueGateDurationSec(fixture: LaserDmxShowDirectorFixture): number {
  const trigger = fixture.trigger
  const fadeSec = (Math.max(0, finite(trigger.fadeInMs, 0)) + Math.max(0, finite(trigger.fadeOutMs, 0))) / 1000
  const burstSec = fixture.kind === 'co2Jet' ? Math.max(0.05, finite(fixture.component.co2BurstDurationMs, 350) / 1000) : 0.35
  return clamp(Math.max(0.25, fadeSec + burstSec), 0.25, 12)
}

function pushGroupGateCue(
  ctx: FixtureCompileContext,
  fixture: LaserDmxShowDirectorFixture,
  startSec: number,
  endSec: number,
  name: string,
): void {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) return
  const idPart = safeIdPart(fixture.id)
  ctx.cues.push({
    id: `sd-cue-${idPart}-${safeIdPart(name)}-${Math.round(startSec * 1000)}`,
    name,
    enabled: true,
    targetType: 'group',
    targetId: groupIdForFixture(fixture),
    timingMode: 'absolute',
    action: 'gate',
    startMs: Math.max(0, Math.round(startSec * 1000)),
    endMs: Math.max(0, Math.round(endSec * 1000)),
    fadeInMs: Math.max(0, Math.round(finite(fixture.trigger.fadeInMs, 0))),
    fadeOutMs: Math.max(0, Math.round(finite(fixture.trigger.fadeOutMs, 0))),
  })
}

function pushIdleGateCue(ctx: FixtureCompileContext, fixture: LaserDmxShowDirectorFixture): void {
  ctx.cues.push({
    id: `sd-cue-${safeIdPart(fixture.id)}-idle`,
    name: `${fixture.label || fixture.kind} idle until matching cue`,
    enabled: true,
    targetType: 'group',
    targetId: groupIdForFixture(fixture),
    timingMode: 'absolute',
    action: 'gate',
    startMs: IDLE_CUE_START_MS,
    endMs: Number.MAX_SAFE_INTEGER,
  })
}

function compileSectionGateCues(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (fixture.trigger.mode !== 'section') return
  const sections = collectTimingSections(ctx).filter(section => sectionMatchesTrigger(section, fixture.trigger))
  for (const section of sections) {
    pushGroupGateCue(ctx, fixture, section.startSec, section.endSec, `${fixture.label || fixture.kind} ${section.label || section.type || 'section'}`)
  }
}

function compileCuePointGateCues(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (fixture.trigger.mode !== 'cuePoint') return
  const durationSec = cueGateDurationSec(fixture)
  let count = 0

  for (const marker of ctx.cueMarkers) {
    if (!cueMarkerMatchesTrigger(marker, fixture.trigger)) continue
    const startSec = finite(marker.time, Number.NaN)
    const endSec = Number.isFinite(finite(marker.endTime, Number.NaN))
      ? Math.max(startSec + 0.05, finite(marker.endTime, startSec + durationSec))
      : startSec + durationSec
    const before = ctx.cues.length
    pushGroupGateCue(ctx, fixture, startSec, endSec, `${fixture.label || fixture.kind} cue ${marker.label || marker.id}`)
    if (ctx.cues.length > before) count++
  }

  for (const moment of ctx.analysis?.semanticMoments ?? []) {
    if (!semanticMomentMatchesTrigger(moment, fixture.trigger)) continue
    const startSec = finite(moment.timeSec, Number.NaN)
    const endSec = startSec + clamp(finite(moment.durationSec, durationSec), 0.1, 12)
    const before = ctx.cues.length
    pushGroupGateCue(ctx, fixture, startSec, endSec, `${fixture.label || fixture.kind} ${moment.label || moment.type}`)
    if (ctx.cues.length > before) count++
  }

  // Useful fallback for cue/drop-friendly fixtures when tracks have sections but no explicit cue markers.
  for (const section of collectTimingSections(ctx)) {
    if (!sectionMatchesTrigger(section, fixture.trigger)) continue
    const before = ctx.cues.length
    pushGroupGateCue(ctx, fixture, section.startSec, Math.min(section.endSec, section.startSec + durationSec), `${fixture.label || fixture.kind} ${section.label || section.type || 'section'} entry`)
    if (ctx.cues.length > before) count++
  }

  if (count === 0) pushIdleGateCue(ctx, fixture)
}

function compileTriggerGateCues(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  compileSectionGateCues(fixture, ctx)
  compileCuePointGateCues(fixture, ctx)
}

function musicColorRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  if (fixture.colorMode !== 'music') return []
  const id = safeIdPart(fixture.id)
  return [
    makeRoute(`sd-${id}-music-red`, 'nBass', 'red', { min: 0.2, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.18 }),
    makeRoute(`sd-${id}-music-green`, 'nMid', 'green', { min: 0.15, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.22 }),
    makeRoute(`sd-${id}-music-blue`, 'nHigh', 'blue', { min: 0.25, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.2 }),
  ]
}

function targetMotionRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  const id = safeIdPart(fixture.id)
  const routes: LaserDmxModulationRoute[] = []
  const isMovingHead = fixture.kind === 'movingHead'
  const movingHeadPanTiltStyle = isMovingHead ? fixture.component.movingHeadPanTiltStyle : null

  if (fixture.beam.targetMode === 'sweep' || movingHeadPanTiltStyle === 'smoothSweep') {
    routes.push(makeRoute(`sd-${id}-sweep-x`, 'beatPhase', 'targetOffsetX', {
      min: -0.16,
      max: 0.16,
      mode: 'set',
      curve: 'pulse',
      smoothing: 0.05,
    }))
  }

  if (fixture.beam.targetMode === 'audioReactive' || movingHeadPanTiltStyle === 'audioReactive') {
    routes.push(
      makeRoute(`sd-${id}-audio-x`, sourceForAudioBand(fixture.trigger.audioBand), 'targetOffsetX', {
        min: -0.1,
        max: 0.1,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.12,
      }),
      makeRoute(`sd-${id}-audio-y`, 'nHigh', 'targetOffsetY', {
        min: -0.08,
        max: 0.08,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.16,
      }),
      makeRoute(`sd-${id}-audio-width`, 'energy', 'beamWidth', {
        min: 0.85,
        max: 2.35,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.16,
      }),
    )
  }

  if (movingHeadPanTiltStyle === 'figureEight') {
    routes.push(
      makeRoute(`sd-${id}-figure-x`, 'phrase4', 'targetOffsetX', { min: -0.14, max: 0.14, mode: 'set', curve: 'pulse', smoothing: 0.05 }),
      makeRoute(`sd-${id}-figure-y`, 'beatPhase', 'targetOffsetY', { min: -0.12, max: 0.12, mode: 'set', curve: 'pulse', smoothing: 0.05 }),
    )
  }

  return routes
}

function sequenceModeForLed(direction: LaserDmxShowDirectorLedDirection): LaserDmxReactionGroup['sequence']['mode'] {
  switch (direction) {
    case 'rightToLeft': return 'reverse'
    case 'centerOut': return 'centerOut'
    case 'edgesIn': return 'outsideIn'
    case 'chase': return 'forward'
    default: return 'forward'
  }
}

function stepsPerBeat(division: LaserDmxShowDirectorBeatDivision): number {
  return clamp(1 / Math.max(0.25, finite(division, 1)), 0.25, 4)
}

function makeGroup(fixture: LaserDmxShowDirectorFixture, groupLabels: Map<string, string>): LaserDmxReactionGroup {
  const color = fixture.kind === 'blinder' ? warmWhiteColor() : colorForFixture(fixture)
  const isLed = fixture.kind === 'ledBar' || fixture.kind === 'ledTube'
  const shouldSequence = isLed || fixture.beam.targetMode === 'sweep'
  return {
    id: groupIdForFixture(fixture),
    name: ((fixture.groupId ? groupLabels.get(fixture.groupId) : null) ?? fixture.groupId?.trim()) || fixture.label || `Show Director ${fixture.kind}`,
    enabled: fixture.enabled,
    muted: false,
    soloed: false,
    colorOverrideEnabled: true,
    color,
    sequence: shouldSequence
      ? {
          ...DEFAULT_BEAM_SEQUENCE,
          enabled: true,
          mode: isLed ? sequenceModeForLed(fixture.component.ledDirection) : 'forward',
          stepsPerBeat: stepsPerBeat(fixture.trigger.beatDivision),
          stepGate: fixture.kind === 'ledTube' ? 0.82 : 0.68,
          phaseSpread: fixture.kind === 'ledTube' ? 0.15 : 0.08,
          resetOnDownbeat: fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase',
        }
      : DEFAULT_BEAM_SEQUENCE,
    launch: launchForTrigger(fixture.trigger),
    maxActiveBeams: 0,
    modulationRoutes: [
      ...triggerDimmerRoutes(fixture),
      ...musicColorRoutes(fixture),
      ...targetMotionRoutes(fixture),
    ],
  }
}


function visualRoleForFixture(
  fixture: LaserDmxShowDirectorFixture,
  priorityRole?: LaserDmxShowDirectorBeamPriorityRole,
): LaserDmxMatrixBeamVisualRole {
  if (fixture.runtimeBeamVisualRole) return fixture.runtimeBeamVisualRole
  switch (priorityRole) {
    case 'heroImpact': return 'hero'
    case 'secondaryFan': return 'secondary'
    case 'detailLattice':
    case 'decorativeAccent': return 'texture'
    case 'primaryArchitecture':
    default: return 'primary'
  }
}

function makeBeam(
  fixture: LaserDmxShowDirectorFixture,
  priorityRole: LaserDmxShowDirectorBeamPriorityRole | undefined,
  suffix: string,
  sequenceIndex: number,
  origin: LaserDmxMatrixGridAnchor,
  target: LaserDmxMatrixTarget,
  appearancePatch: Partial<LaserDmxMatrixBeamAppearance> = {},
  motionPatch: Partial<LaserDmxMatrixBeam['motion']> = {},
  routes: LaserDmxModulationRoute[] = [],
): LaserDmxMatrixBeam {
  const requestedMotion = {
    ...DEFAULT_BEAM_MOTION,
    ...motionPatch,
    ...(fixture.runtimeBeamTravel ?? {}),
  }
  const motion: LaserDmxMatrixBeam['motion'] = {
    ...requestedMotion,
    direction: 'forward',
    mode: (requestedMotion.mode as string) === 'pingPong' ? 'grow' : requestedMotion.mode,
  }
  return {
    id: beamIdForFixture(fixture, suffix),
    name: `${fixture.label || fixture.kind} ${suffix}`,
    enabled: fixture.enabled,
    sequenceIndex,
    origin,
    target,
    groupId: groupIdForFixture(fixture),
    useGroupColor: true,
    color: fixture.kind === 'blinder' ? warmWhiteColor() : colorForFixture(fixture),
    appearance: defaultAppearance(fixture, appearancePatch),
    motion,
    visualRole: visualRoleForFixture(fixture, priorityRole),
    modulationRoutes: routes,
  }
}

function compileBeamFixture(
  fixture: LaserDmxShowDirectorFixture,
  ctx: FixtureCompileContext,
  options: {
    cone?: boolean
    width?: number
    divergence?: number
    glow?: number
    length?: number
  } = {},
): void {
  if (!fixture.beam.beamEnabled) return
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const angle = finite(fixture.rotation, 0) + finite(fixture.beam.beamAngle, 0)
  const spread = clamp(finite(fixture.beam.beamSpread, fixture.kind === 'laser' ? 18 : 0), 0, 180)
  const geometry = options.cone ? 'volumetricCone' : 'line'
  const isMovingHead = fixture.kind === 'movingHead'
  const movingHeadPanTiltStyle = isMovingHead ? fixture.component.movingHeadPanTiltStyle : null
  const editableTargets = editableTargetsForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const useEditableTargets = fixture.beam.targetMode === 'fixed' || editableTargets.length > 1
  const count = useEditableTargets
    ? Math.min(editableTargets.length, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    : fixture.beam.targetMode === 'fan'
      ? clamp(Math.round(spread / 9), 3, 9)
      : fixture.beam.targetMode === 'cross'
        ? 2
        : fixture.beam.targetMode === 'mirror'
          ? 2
          : 1

  for (let i = 0; i < count && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const fanOffset = count === 1 ? 0 : (t - 0.5) * spread
    const mirrorSign = fixture.beam.targetMode === 'mirror' && i === 1 ? -1 : 1
    const crossOffset = fixture.beam.targetMode === 'cross' ? (i === 0 ? -spread * 0.5 : spread * 0.5) : fanOffset
    const target = useEditableTargets
      ? gridTargetFromEditableTarget(fixture, editableTargets[i] ?? editableTargets[0], ctx.gridColumns, ctx.gridRows)
      : fixture.beam.targetMode === 'fixed'
        ? gridTargetFromFixtureTarget(fixture, ctx.gridColumns, ctx.gridRows)
        : stageTargetFromAngle(point, angle + crossOffset * mirrorSign, options.length ?? 0.62)
    const motionMode: LaserDmxMatrixBeam['motion']['mode'] = fixture.beam.targetMode === 'sweep'
      ? 'scanner'
      : movingHeadPanTiltStyle === 'snap'
        ? 'projectile'
        : movingHeadPanTiltStyle === 'locked'
          ? 'static'
          : isMovingHead
            ? 'grow'
            : 'static'
    ctx.matrixBeams.push(makeBeam(
      fixture,
      ctx.fixturePriorityRoleById[fixture.id],
      useEditableTargets ? `${fixture.kind}-target-${i + 1}` : `${fixture.kind}-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: options.width ?? (options.cone ? 2.4 : 1),
        divergence: options.divergence ?? clamp01((spread || 12) / 180),
        glow: options.glow ?? 0.82,
        geometry,
      },
      {
        mode: motionMode,
        beatsPerTravel: Math.max(0.5, finite(fixture.trigger.beatDivision, 1) * 2),
        tailLength: fixture.kind === 'laser' ? 0.22 : 0.38,
        headGlow: fixture.kind === 'laser' ? 0.35 : 0.72,
        direction: 'forward',
      },
    ))
    ctx.outputBeamCount++
  }
}

function compileLedFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext, tube = false): void {
  if (!fixture.beam.beamEnabled) return
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const anchor = gridAnchorFromStagePoint(point)
  const cells = Math.min(positiveInt(fixture.component.ledCellCount, 8, 1, 64), tube ? 12 : 16)
  const span = Math.min(cells - 1, tube ? 7 : 11)
  const horizontal = Math.abs(Math.cos(finite(fixture.rotation, 0) * Math.PI / 180)) >= Math.abs(Math.sin(finite(fixture.rotation, 0) * Math.PI / 180))
  const start = -Math.floor(span / 2)
  for (let i = 0; i < cells && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const offset = start + Math.round((span * i) / Math.max(1, cells - 1))
    const origin = horizontal
      ? offsetGridAnchor(anchor, offset, 0)
      : offsetGridAnchor(anchor, 0, offset)
    const target = stageTargetFromAngle(
      { x: (origin.column - 1) / (LASER_DMX_MATRIX_COLUMNS - 1), y: (origin.row - 1) / (LASER_DMX_MATRIX_ROWS - 1), z: origin.z },
      horizontal ? 0 : 90,
      0.045,
    )
    ctx.matrixBeams.push(makeBeam(
      fixture,
      ctx.fixturePriorityRoleById[fixture.id],
      `${tube ? 'tube' : 'bar'}-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: tube ? 2.4 : 3.1,
        divergence: tube ? 0.12 : 0.06,
        focus: tube ? 0.56 : 0.72,
        glow: tube ? 0.94 : 0.86,
        geometry: 'line',
      },
      { mode: 'static', headGlow: tube ? 0.35 : 0.2 },
    ))
    ctx.outputBeamCount++
  }
}

function compileStrobeFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (!fixture.beam.beamEnabled) return
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const angles = [0, 90, 180, 270]
  for (let i = 0; i < angles.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const target = stageTargetFromAngle(point, angles[i], 0.12)
    ctx.matrixBeams.push(makeBeam(
      fixture,
      ctx.fixturePriorityRoleById[fixture.id],
      `strobe-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: 5,
        divergence: 0.08,
        focus: 0.9,
        strobeRate: clamp01(finite(fixture.component.strobeRate, 8) / 30),
        glow: 1,
        geometry: 'line',
      },
      { mode: 'static', headGlow: 0.8 },
      triggerDimmerRoutes(fixture, `strobe-${i + 1}`),
    ))
    ctx.outputBeamCount++
  }
}

function compileBlinderFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (!fixture.beam.beamEnabled) return
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const anchor = gridAnchorFromStagePoint(point)
  const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const
  for (let i = 0; i < offsets.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const [colOffset, rowOffset] = offsets[i]
    const origin = offsetGridAnchor(anchor, colOffset, rowOffset)
    const target = stageTargetFromAngle(
      { x: (origin.column - 1) / (LASER_DMX_MATRIX_COLUMNS - 1), y: (origin.row - 1) / (LASER_DMX_MATRIX_ROWS - 1), z: origin.z },
      90,
      0.16,
    )
    ctx.matrixBeams.push(makeBeam(
      fixture,
      ctx.fixturePriorityRoleById[fixture.id],
      `blinder-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: 6,
        divergence: 0.22,
        focus: 0.38,
        glow: 1,
        geometry: 'volumetricCone',
      },
      { mode: 'static', headGlow: 0.6 },
    ))
    ctx.outputBeamCount++
  }
}

function compileVideoWallFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const anchor = gridAnchorFromStagePoint(stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows))
  const colorRoutes = fixture.colorMode === 'music' ? musicColorRoutes(fixture) : []
  const edges = [
    { origin: offsetGridAnchor(anchor, -2, -1), target: offsetGridAnchor(anchor, 2, -1) },
    { origin: offsetGridAnchor(anchor, 2, -1), target: offsetGridAnchor(anchor, 2, 1) },
    { origin: offsetGridAnchor(anchor, 2, 1), target: offsetGridAnchor(anchor, -2, 1) },
    { origin: offsetGridAnchor(anchor, -2, 1), target: offsetGridAnchor(anchor, -2, -1) },
  ]
  for (let i = 0; i < edges.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const edge = edges[i]
    ctx.matrixBeams.push(makeBeam(
      fixture,
      ctx.fixturePriorityRoleById[fixture.id],
      `video-wall-${i + 1}`,
      ctx.outputBeamCount,
      edge.origin,
      { kind: 'grid', ...edge.target },
      {
        dimmer: clamp01(finite(fixture.component.videoWallBrightness, 0.85) * finite(fixture.brightness, 0.85)),
        width: 2.4,
        divergence: 0,
        focus: 0.76,
        glow: 0.7,
        geometry: 'line',
      },
      { mode: 'static' },
      colorRoutes,
    ))
    ctx.outputBeamCount++
  }
}

function compileCo2Fixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const target = stageTargetFromAngle(point, -90, 0.36)
  ctx.globalRoutes.push(...co2FogRoutes(fixture))
  if (ctx.outputBeamCount >= LASER_DMX_MATRIX_MAX_BEAMS) return
  ctx.matrixBeams.push(makeBeam(
    fixture,
    ctx.fixturePriorityRoleById[fixture.id],
    'co2-plume',
    ctx.outputBeamCount,
    origin,
    target,
    {
      width: 6,
      divergence: 0.75,
      focus: 0.2,
      glow: 1,
      geometry: 'volumetricCone',
    },
    {
      mode: 'grow',
      beatsPerTravel: Math.max(0.25, finite(fixture.component.co2BurstDurationMs, 350) / 500),
      tailLength: 0.75,
      headGlow: 0.5,
    },
    triggerDimmerRoutes(fixture, 'co2'),
  ))
  ctx.outputBeamCount++
}

function co2FogRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  const source = triggerSource(fixture.trigger) ?? 'dropImpact'
  if (!source) return []
  const attack = Math.max(0, finite(fixture.trigger.fadeInMs, 0) / 1000)
  const release = Math.max(0.1, finite(fixture.component.co2BurstDurationMs, 350) / 1000)
  const threshold = source === 'dropImpact' ? clamp01(finite(fixture.trigger.energyThreshold, 0.45)) : undefined
  return [
    makeRoute(`sd-${safeIdPart(fixture.id)}-co2-fog-density`, source, 'fogDensity', {
      min: 0,
      max: 0.58,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: Math.min(0.4, release * 0.35),
      release,
      threshold,
    }),
    makeRoute(`sd-${safeIdPart(fixture.id)}-co2-fog-opacity`, source, 'fogOpacity', {
      min: 0,
      max: 0.7,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: Math.min(0.4, release * 0.35),
      release,
      threshold,
    }),
  ]
}

function hazeFogRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  const trigger = fixture.trigger
  const source = trigger.mode === 'energy' ? 'energy' : triggerSource(trigger)
  if (!source || trigger.mode === 'cuePoint') return []
  const attack = Math.max(0, finite(trigger.fadeInMs, 0) / 1000)
  const release = Math.max(0.1, finite(trigger.fadeOutMs, 600) / 1000)
  const intensity = clamp01(finite(fixture.component.hazeIntensity, 0.5) * finite(fixture.brightness, 0.85))
  const mode: LaserDmxModulationRoute['mode'] = trigger.mode === 'section' || trigger.mode === 'energy' ? 'set' : 'trigger'
  const threshold = trigger.mode === 'energy'
    ? clamp01(finite(trigger.energyThreshold, 0.7))
    : trigger.mode === 'audioBand' || trigger.mode === 'bassHit' || trigger.mode === 'snareTransient'
      ? clamp01(finite(trigger.audioThreshold, 0.65))
      : undefined
  return [
    makeRoute(`sd-${safeIdPart(fixture.id)}-haze-density`, source, 'fogDensity', {
      min: 0,
      max: intensity * 0.62,
      mode,
      curve: 'easeOut',
      smoothing: mode === 'set' ? 0.22 : 0.05,
      attack,
      hold: mode === 'trigger' ? 0.08 : undefined,
      release,
      threshold,
    }),
    makeRoute(`sd-${safeIdPart(fixture.id)}-haze-opacity`, source, 'fogOpacity', {
      min: 0,
      max: intensity * 0.52,
      mode,
      curve: 'easeOut',
      smoothing: mode === 'set' ? 0.24 : 0.05,
      attack,
      hold: mode === 'trigger' ? 0.08 : undefined,
      release,
      threshold,
    }),
    makeRoute(`sd-${safeIdPart(fixture.id)}-haze-scatter`, source, 'fogBeamScatter', {
      min: 0,
      max: intensity * 0.78,
      mode,
      curve: 'easeOut',
      smoothing: mode === 'set' ? 0.2 : 0.05,
      attack,
      hold: mode === 'trigger' ? 0.08 : undefined,
      release,
      threshold,
    }),
  ]
}

function compileFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (!fixture || fixture.enabled !== true || !hasFixtureShape(fixture) || !isSupportedFixtureKind(fixture.kind)) return
  ctx.groups.push(makeGroup(fixture, ctx.groupLabels))
  compileTriggerGateCues(fixture, ctx)
  ctx.hasRenderableFixture = true

  switch (fixture.kind) {
    case 'laser':
      compileBeamFixture(fixture, ctx, { width: 0.9, divergence: clamp01(finite(fixture.beam.beamSpread, 18) / 240), glow: 0.92, length: 0.78 })
      break
    case 'movingHead':
      compileBeamFixture(fixture, ctx, { cone: true, width: 2.5, divergence: clamp01(Math.max(22, finite(fixture.beam.beamSpread, 32)) / 150), glow: 0.86, length: 0.58 })
      break
    case 'ledBar':
      compileLedFixture(fixture, ctx, false)
      break
    case 'ledTube':
      compileLedFixture(fixture, ctx, true)
      break
    case 'strobe':
      compileStrobeFixture(fixture, ctx)
      break
    case 'blinder':
      compileBlinderFixture(fixture, ctx)
      break
    case 'parWash':
      compileBeamFixture(fixture, ctx, { cone: true, width: 4.6, divergence: clamp01(Math.max(45, finite(fixture.beam.beamSpread, 55)) / 120), glow: 0.82, length: 0.42 })
      break
    case 'videoWall':
      compileVideoWallFixture(fixture, ctx)
      break
    case 'haze':
      if (fixture.trigger.mode === 'alwaysOn') {
        ctx.hazeIntensity = Math.max(ctx.hazeIntensity, clamp01(finite(fixture.component.hazeIntensity, 0.5) * finite(fixture.brightness, 0.85)))
      } else {
        ctx.globalRoutes.push(...hazeFogRoutes(fixture))
      }
      break
    case 'co2Jet':
      compileCo2Fixture(fixture, ctx)
      break
    default:
      break
  }
}

function compileGlobalRoutes(base: LaserDmxBeamMatrixSettings): LaserDmxModulationRoute[] {
  return Array.isArray(base.globalModulationRoutes)
    ? base.globalModulationRoutes.map(route => ({ ...route }))
    : []
}

/**
 * Converts the user-facing Show Director drag/drop layout into a Beam Matrix
 * program. Beam Matrix remains the execution/runtime renderer; this compiler is
 * only an adapter between the fixture-layout authoring model and Beam Matrix data.
 */
export function compileLaserDmxShowDirectorToBeamMatrix(
  input: CompileLaserDmxShowDirectorToBeamMatrixInput,
): LaserDmxBeamMatrixSettings {
  const base = input.beamMatrix
  const showDirector = input.showDirector
  const gridColumns = positiveInt(showDirector?.settings?.gridSize?.columns, 15, 1, 64)
  const gridRows = positiveInt(showDirector?.settings?.gridSize?.rows, 10, 1, 64)
  const authoredFixtures = Array.isArray(showDirector?.fixtures) ? showDirector.fixtures : []
  const fixtures = input.fixturePriorityById
    ? [...authoredFixtures].sort((a, b) => (
        (input.fixturePriorityById?.[a.id] ?? Number.MAX_SAFE_INTEGER)
        - (input.fixturePriorityById?.[b.id] ?? Number.MAX_SAFE_INTEGER)
        || (a.semanticKey ?? '').localeCompare(b.semanticKey ?? '')
        || a.id.localeCompare(b.id)
      ))
    : authoredFixtures
  const ctx: FixtureCompileContext = {
    gridColumns,
    gridRows,
    matrixBeams: [],
    groups: [],
    globalRoutes: compileGlobalRoutes(base),
    cues: [],
    analysis: input.analysis ?? null,
    sections: input.sections ?? [],
    cueMarkers: input.cueMarkers ?? [],
    outputBeamCount: 0,
    hazeIntensity: 0,
    groupLabels: new Map((showDirector?.groups ?? []).map(group => [group.id, group.label])),
    hasRenderableFixture: false,
    fixturePriorityRoleById: input.fixturePriorityRoleById ?? {},
  }

  for (const fixture of fixtures) {
    if (ctx.outputBeamCount >= LASER_DMX_MATRIX_MAX_BEAMS) break
    compileFixture(fixture, ctx)
  }

  const hasFixtures = ctx.hasRenderableFixture
  const hasShowDirectorFogRoutes = ctx.globalRoutes.some(route => route.enabled && typeof route.target === 'string' && route.target.startsWith('fog'))
  const fog = hasFixtures
    ? {
        ...base.fog,
        enabled: base.fog.enabled || ctx.hazeIntensity > 0 || hasShowDirectorFogRoutes,
        density: Math.max(base.fog.enabled ? base.fog.density : 0, ctx.hazeIntensity * 0.62),
        opacity: Math.max(base.fog.enabled ? base.fog.opacity : 0, ctx.hazeIntensity * 0.52),
        beamScatter: Math.max(base.fog.beamScatter, ctx.hazeIntensity * 0.78),
        turbulence: Math.max(base.fog.turbulence, ctx.hazeIntensity * 0.45),
        diffusion: Math.max(base.fog.diffusion, ctx.hazeIntensity * 0.5),
      }
    : {
        ...base.fog,
        enabled: false,
        density: 0,
        opacity: 0,
        beamScatter: 0,
      }

  return {
    schemaVersion: base.schemaVersion,
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: ctx.matrixBeams.slice(0, LASER_DMX_MATRIX_MAX_BEAMS),
    groups: ctx.groups,
    globalModulationRoutes: ctx.globalRoutes,
    output: { ...base.output },
    fog,
    editor: { ...base.editor },
    cues: ctx.cues,
  }
}
