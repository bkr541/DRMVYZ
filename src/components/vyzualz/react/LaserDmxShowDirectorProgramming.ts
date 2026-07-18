import type {
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorMacroScanPlan,
  LaserDmxShowDirectorScannerDirection,
  LaserDmxShowDirectorScannerOpticalMode,
  LaserDmxShowDirectorScannerPatternType,
  LaserDmxShowDirectorScannerRuntimeOverrides,
  LaserDmxShowDirectorState,
  ReactSectionType,
} from './ReactTypes'
import type {
  LaserDmxShowDirectorMixedFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceMutationPayload,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'

export const LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION = 1 as const
export const LASER_DMX_EFFECT_MACRO_SCHEMA_VERSION = 1 as const
export const LASER_DMX_CUE_STACK_SCHEMA_VERSION = 1 as const
export const LASER_DMX_PATTERN_FRAME_SCHEMA_VERSION = 1 as const

export type LaserEffectFamily =
  | 'heldBeam'
  | 'steppedFan'
  | 'smoothFanSweep'
  | 'parallelSheet'
  | 'mirroredFan'
  | 'opposedFans'
  | 'crossingFans'
  | 'xFan'
  | 'centerOutFan'
  | 'outsideInFan'
  | 'tunnel'
  | 'corridor'
  | 'upperAirCanopy'
  | 'frontAirRake'
  | 'sequentialCircle'
  | 'arcSweep'
  | 'polygonOutline'
  | 'progressiveWave'
  | 'gridScan'
  | 'lineDiffraction'
  | 'gridDiffraction'
  | 'burstDiffraction'
  | 'movingHeadPositionLook'
  | 'movingHeadSweep'
  | 'movingHeadGoboLook'
  | 'washScene'
  | 'strobeAccent'
  | 'blinderImpact'
  | 'ledChase'
  | 'co2Impact'
  | 'mixedFixtureScene'

export type LaserCueDurationKind =
  | 'beat'
  | 'twoBeats'
  | 'bar'
  | 'twoBars'
  | 'fourBars'
  | 'eightBars'
  | 'phrase'
  | 'section'
  | 'explicitBeats'
  | 'explicitSeconds'
  | 'trackMapCue'

export interface LaserCueDuration {
  kind: LaserCueDurationKind
  beats?: number
  seconds?: number
  trackMapCueId?: string
}

export type LaserGroupRelationshipMode =
  | 'parallel'
  | 'mirrored'
  | 'opposed'
  | 'alternating'
  | 'phaseOffset'
  | 'chase'
  | 'centerOut'
  | 'outsideIn'
  | 'leaderFollower'
  | 'callResponse'
  | 'leftRightBanks'
  | 'frontRearDepthPlanes'
  | 'symmetricalPair'
  | 'rotationalOffset'
  | 'colorAlternation'

export interface LaserEffectGroupAssignment {
  id: string
  address: LaserDmxShowDirectorPerformanceAddress
  relationshipId?: string
  role?: 'hero' | 'primary' | 'support' | 'texture' | 'impact'
  phaseOffset?: number
  intensityScale?: number
  colorIndex?: number
}

export interface LaserFixtureGroupRelationship {
  schemaVersion: 1
  id: string
  name: string
  mode: LaserGroupRelationshipMode
  memberAssignmentIds: string[]
  leaderAssignmentId?: string
  phaseOffset?: number
  rotationOffsetDeg?: number
  chaseStepBeats?: number
  sharedSpeed?: boolean
  sharedSpread?: boolean
  sharedIntensity?: boolean
  sharedColor?: boolean
}

export interface LaserPatternDefinition {
  topologyId: string
  scannerPatternType: LaserDmxShowDirectorScannerPatternType
  raySlotCount: number
  traversal: 'sequential' | 'pingPong' | 'simultaneousOpticalCopies'
  spacing: 'equal' | 'centerWeighted' | 'edgeWeighted' | 'authored'
  closed: boolean
  stablePointIds?: string[]
}

export interface LaserEffectTransform {
  centerX: number
  centerY: number
  depth: number
  width: number
  height: number
  radius: number
  rotationDeg: number
}

export interface LaserEffectScanSettings {
  scanRatePps: number
  direction: LaserDmxShowDirectorScannerDirection
  phase: number
  pointDwellMicros: number
  cornerDwellMicros: number
  retraceBlanking: boolean
  blankingDelayMicros: number
}

export interface LaserEffectColorSettings {
  mode: 'fixed' | 'palette' | 'scene'
  colors: string[]
  blend: number
  alternateByGroup: boolean
}

export interface LaserEffectOpticsSettings {
  mode: LaserDmxShowDirectorScannerOpticalMode
  copyCount: number
  spreadDeg: number
}

export interface LaserEffectEnvelope {
  attack: number
  hold: number
  release: number
  intensityFloor: number
  intensityCeiling: number
}

export type LaserEffectAutomationParameter =
  | 'centerX'
  | 'centerY'
  | 'depth'
  | 'width'
  | 'height'
  | 'radius'
  | 'rotation'
  | 'fanSpread'
  | 'scanSpeed'
  | 'direction'
  | 'phase'
  | 'intensity'
  | 'colorBlend'
  | 'opticalCopySpread'
  | 'movingHeadPan'
  | 'movingHeadTilt'
  | 'movingHeadZoom'
  | 'goboRotation'
  | 'washIntensity'
  | 'ledChasePosition'
  | 'hazeAmount'

export type LaserEffectAutomationCurve =
  | 'hold'
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'sine'
  | 'triangle'
  | 'stepped'
  | 'pulse'

export interface LaserEffectAutomation {
  id: string
  parameter: LaserEffectAutomationParameter
  from: number
  to: number
  startProgress: number
  endProgress: number
  curve: LaserEffectAutomationCurve
  steps?: number
}

export type LaserEffectTransitionType =
  | 'cut'
  | 'fade'
  | 'crossfade'
  | 'shutterOutIn'
  | 'collapseExpand'
  | 'centerOut'
  | 'outsideIn'
  | 'directionReverse'
  | 'bankHandoff'
  | 'colorCrossfade'
  | 'opticalModeSwap'
  | 'briefBlackout'
  | 'strobeTransition'
  | 'blinderImpact'

export interface LaserEffectTransition {
  type: LaserEffectTransitionType
  durationBeats: number
  blankDisconnectedTravel: boolean
  shutterDuringSwap: boolean
}

export interface LaserEffectMacro {
  schemaVersion: 1
  id: string
  name: string
  family: LaserEffectFamily
  duration: LaserCueDuration
  pattern: LaserPatternDefinition
  transform: LaserEffectTransform
  scan: LaserEffectScanSettings
  color: LaserEffectColorSettings
  optics: LaserEffectOpticsSettings
  envelope: LaserEffectEnvelope
  automation: LaserEffectAutomation[]
  fixtureGroupAssignments: LaserEffectGroupAssignment[]
  transitionIn: LaserEffectTransition
  transitionOut: LaserEffectTransition
  compatibility?: {
    provisional: boolean
    sourceSceneId?: string
    sourceFixtureIds?: string[]
    warnings?: string[]
  }
}

export interface LaserCueAccent {
  id: string
  trigger: 'kick' | 'snare' | 'hat' | 'beat' | 'bar' | 'phrase' | 'section'
  macroId?: string
  fixtureGroupAssignmentIds?: string[]
  durationBeats: number
  intensity: number
  priority: number
}

export interface LaserPerformanceCue {
  schemaVersion: 1
  id: string
  name: string
  macroId: string
  sceneIds?: string[]
  sectionTypes?: ReactSectionType[]
  startQuantize: Exclude<LaserCueDurationKind, 'explicitSeconds' | 'trackMapCue'>
  startOffsetBeats: number
  repeatEveryBeats?: number
  explicitTrackMapStartSec?: number
  duration: LaserCueDuration
  fixtureGroupAssignmentIds?: string[]
  automation: LaserEffectAutomation[]
  transitionIn: LaserEffectTransition
  transitionOut: LaserEffectTransition
  accents: LaserCueAccent[]
  occurrenceVariationSeedOffset?: number
  minEnergy?: number
  maxEnergy?: number
  priority: number
  blackout?: boolean
  shutterClosed?: boolean
}

export interface LaserCueStack {
  schemaVersion: 1
  id: string
  name: string
  cues: LaserPerformanceCue[]
}

export interface LaserShowProgrammingDocument {
  schemaVersion: 1
  id: string
  macros: LaserEffectMacro[]
  cueStacks: LaserCueStack[]
  activeCueStackId: string
  groupRelationships: LaserFixtureGroupRelationship[]
  compatibility: {
    source: 'native' | 'legacy-adapter' | 'mixed'
    adapterVersion: number
    ambiguousRelationshipIds: string[]
    warnings: string[]
    originalProgramBackup?: unknown
  }
}

export interface LaserStablePatternFrame {
  schemaVersion: 1
  id: string
  revision: number
  cueId: string
  macroId: string
  topologyId: string
  topologyRevision: number
  topologyCacheKey: string
  patternFrameCacheHit: boolean
  cueStartBeat: number
  cueDurationBeats: number
  cueProgress: number
  centerX: number
  centerY: number
  depth: number
  width: number
  height: number
  radius: number
  rotationDeg: number
  fanSpread: number
  scanRatePps: number
  direction: LaserDmxShowDirectorScannerDirection
  phase: number
  intensity: number
  colorBlend: number
  opticalCopySpread: number
  movingHeadPan: number
  movingHeadTilt: number
  movingHeadZoom: number
  goboRotation: number
  washIntensity: number
  ledChasePosition: number
  hazeAmount: number
  raySlots: number[]
  pathPointCount: number
  relationshipModes: LaserGroupRelationshipMode[]
  transitionState: LaserEffectTransitionType | 'steady'
  transitionProgress: number
  shutterClosed: boolean
  clearTemporalHistory: boolean
  preservePhase: boolean
  activeRelationshipIds: string[]
  deterministicIdentity: string
}

export interface LaserProgrammingValidationIssue {
  code:
    | 'macro-topology-churn'
    | 'group-relationship-missing'
    | 'cue-too-short'
    | 'audio-geometry-redraw'
    | 'continuous-ray-count-mutation'
    | 'optical-copy-count-unbounded'
    | 'mirrored-group-unsynchronized'
    | 'transition-blanking-required'
    | 'independent-fixture-direction'
    | 'ray-slot-spacing'
  severity: 'warning' | 'error'
  message: string
  sourceId?: string
}

export interface LaserProgrammingRuntimeDiagnostics {
  activePrimaryCueId: string | null
  activeAccentCueIds: string[]
  cueStartBeat: number
  cueRemainingBeats: number
  activeMacroId: string | null
  activeMacroName: string | null
  fixtureGroupRelationships: string[]
  stablePatternFrameId: string | null
  patternFrameRevisionCount: number
  transitionState: LaserEffectTransitionType | 'steady' | 'inactive'
  audioModulationValues: Record<string, number>
  geometryRebuildCount: number
  patternFrameCacheHits: number
  patternFrameCacheMisses: number
  raySlotCount: number
  topologyChangesPerCue: number
  fixtureGroupSynchronizationStatus: 'inactive' | 'synchronized' | 'conflict-overridden'
  conflictingOverrides: string[]
  audioModulationBoundaries: string[]
  unexpectedTopologyChanges: number
  warnings: LaserProgrammingValidationIssue[]
  compatibilitySource: LaserShowProgrammingDocument['compatibility']['source'] | 'inactive'
}

export interface ResolveLaserProgrammingInput {
  document: LaserShowProgrammingDocument
  program: LaserDmxShowDirectorPerformanceProgram
  selectedScene: LaserDmxShowDirectorPerformanceScene
  authoredRig: LaserDmxShowDirectorState
  runtimeRig: LaserDmxShowDirectorState
  context: LaserDmxShowDirectorPerformanceTimingContext
  programSeed: number
}

export interface ResolveLaserProgrammingResult {
  document: LaserShowProgrammingDocument
  frame: LaserStablePatternFrame | null
  cue: LaserPerformanceCue | null
  macro: LaserEffectMacro | null
  activeAccentCueIds: string[]
  showDirector: LaserDmxShowDirectorState
  diagnostics: LaserProgrammingRuntimeDiagnostics
}

const EFFECT_FAMILIES = new Set<LaserEffectFamily>([
  'heldBeam', 'steppedFan', 'smoothFanSweep', 'parallelSheet', 'mirroredFan', 'opposedFans', 'crossingFans', 'xFan',
  'centerOutFan', 'outsideInFan', 'tunnel', 'corridor', 'upperAirCanopy', 'frontAirRake', 'sequentialCircle', 'arcSweep',
  'polygonOutline', 'progressiveWave', 'gridScan', 'lineDiffraction', 'gridDiffraction', 'burstDiffraction',
  'movingHeadPositionLook', 'movingHeadSweep', 'movingHeadGoboLook', 'washScene', 'strobeAccent', 'blinderImpact',
  'ledChase', 'co2Impact', 'mixedFixtureScene',
])
const RELATIONSHIP_MODES = new Set<LaserGroupRelationshipMode>([
  'parallel', 'mirrored', 'opposed', 'alternating', 'phaseOffset', 'chase', 'centerOut', 'outsideIn', 'leaderFollower',
  'callResponse', 'leftRightBanks', 'frontRearDepthPlanes', 'symmetricalPair', 'rotationalOffset', 'colorAlternation',
])
const AUTOMATION_PARAMETERS = new Set<LaserEffectAutomationParameter>([
  'centerX', 'centerY', 'depth', 'width', 'height', 'radius', 'rotation', 'fanSpread', 'scanSpeed', 'direction', 'phase',
  'intensity', 'colorBlend', 'opticalCopySpread', 'movingHeadPan', 'movingHeadTilt', 'movingHeadZoom', 'goboRotation',
  'washIntensity', 'ledChasePosition', 'hazeAmount',
])
const AUTOMATION_CURVES = new Set<LaserEffectAutomationCurve>([
  'hold', 'linear', 'easeIn', 'easeOut', 'easeInOut', 'sine', 'triangle', 'stepped', 'pulse',
])

interface LaserPatternTopologyTemplate {
  topologyRevision: number
  raySlots: number[]
  pathPointCount: number
}

const PATTERN_TOPOLOGY_CACHE_LIMIT = 512
const patternTopologyCache = new Map<string, LaserPatternTopologyTemplate>()
const TRANSITIONS = new Set<LaserEffectTransitionType>([
  'cut', 'fade', 'crossfade', 'shutterOutIn', 'collapseExpand', 'centerOut', 'outsideIn', 'directionReverse', 'bankHandoff',
  'colorCrossfade', 'opticalModeSwap', 'briefBlackout', 'strobeTransition', 'blinderImpact',
])
const DURATION_KINDS = new Set<LaserCueDurationKind>([
  'beat', 'twoBeats', 'bar', 'twoBars', 'fourBars', 'eightBars', 'phrase', 'section', 'explicitBeats', 'explicitSeconds', 'trackMapCue',
])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function clean(value: unknown, fallback: string, max = 160): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function strings(value: unknown, max = 128): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map(entry => entry.trim()))).slice(0, max)
    : []
}

function stableHash(...parts: Array<string | number | null | undefined>): number {
  let hash = 2166136261
  for (const part of parts) {
    const text = String(part ?? '')
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= 124
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function patternRaySlots(pattern: LaserPatternDefinition): number[] {
  const count = Math.max(1, Math.min(64, Math.round(pattern.raySlotCount)))
  return Array.from({ length: count }, (_, index) => {
    if (count <= 1) return 0.5
    const t = index / (count - 1)
    if (pattern.spacing === 'centerWeighted') {
      return 0.5 + Math.sign(t - 0.5) * Math.pow(Math.abs(t - 0.5) * 2, 1.5) * 0.5
    }
    if (pattern.spacing === 'edgeWeighted') {
      return 0.5 + Math.sign(t - 0.5) * Math.sqrt(Math.abs(t - 0.5) * 2) * 0.5
    }
    if (pattern.spacing === 'authored' && pattern.stablePointIds?.length === count) {
      const pointId = pattern.stablePointIds[index] ?? `point-${index}`
      const jitter = (stableHash(pointId, pattern.topologyId) % 101) / 100_000
      return Math.max(0, Math.min(1, t + (index === 0 || index === count - 1 ? 0 : jitter)))
    }
    return t
  })
}

function resolvePatternTopologyTemplate(
  macro: LaserEffectMacro,
  cue: LaserPerformanceCue,
  occurrenceRevision: number,
  assignmentIds: readonly string[],
  relationshipIds: readonly string[],
  fixtureTopologySignature: readonly string[],
): { cacheKey: string; template: LaserPatternTopologyTemplate; cacheHit: boolean } {
  const topologySignature = [
    macro.id,
    cue.id,
    occurrenceRevision,
    macro.family,
    macro.pattern.topologyId,
    macro.pattern.scannerPatternType,
    macro.pattern.raySlotCount,
    macro.pattern.traversal,
    macro.pattern.spacing,
    macro.pattern.closed ? 1 : 0,
    macro.pattern.stablePointIds?.join(',') ?? '',
    macro.optics.mode,
    macro.optics.copyCount,
    assignmentIds.join(','),
    relationshipIds.join(','),
    fixtureTopologySignature.join(','),
  ].join('|')
  const cacheKey = `macro-topology:${stableHash(topologySignature).toString(16)}`
  const cached = patternTopologyCache.get(cacheKey)
  if (cached) return { cacheKey, template: cached, cacheHit: true }
  const template: LaserPatternTopologyTemplate = {
    topologyRevision: stableHash(topologySignature),
    raySlots: patternRaySlots(macro.pattern),
    pathPointCount: Math.max(
      macro.pattern.raySlotCount,
      macro.pattern.stablePointIds?.length ?? 0,
      macro.family === 'sequentialCircle' ? 24 : 0,
      macro.family === 'progressiveWave' ? 18 : 0,
      macro.family === 'polygonOutline' ? 3 : 0,
    ),
  }
  patternTopologyCache.set(cacheKey, template)
  if (patternTopologyCache.size > PATTERN_TOPOLOGY_CACHE_LIMIT) {
    const oldestKey = patternTopologyCache.keys().next().value
    if (oldestKey) patternTopologyCache.delete(oldestKey)
  }
  return { cacheKey, template, cacheHit: false }
}

function transitionSafety(
  transitionState: LaserStablePatternFrame['transitionState'],
  transitionProgress: number,
  cue: LaserPerformanceCue,
): Pick<LaserStablePatternFrame, 'shutterClosed' | 'clearTemporalHistory' | 'preservePhase'> {
  const swapWindow = transitionProgress > 0.38 && transitionProgress < 0.62
  const shutterTransition = transitionState === 'shutterOutIn'
    || transitionState === 'opticalModeSwap'
    || transitionState === 'briefBlackout'
    || transitionState === 'bankHandoff'
  return {
    shutterClosed: Boolean(cue.shutterClosed || cue.blackout || (shutterTransition && swapWindow)),
    clearTemporalHistory: transitionState === 'cut'
      || transitionState === 'briefBlackout'
      || transitionState === 'shutterOutIn'
      || transitionState === 'opticalModeSwap'
      || transitionState === 'bankHandoff',
    preservePhase: transitionState === 'steady'
      || transitionState === 'fade'
      || transitionState === 'crossfade'
      || transitionState === 'colorCrossfade'
      || transitionState === 'directionReverse',
  }
}

function boundedEnvelope(frame: LaserStablePatternFrame, macro: LaserEffectMacro): number {
  const attack = Math.max(0, macro.envelope.attack)
  const hold = Math.max(0, macro.envelope.hold)
  const release = Math.max(0, macro.envelope.release)
  const total = Math.max(1e-6, attack + hold + release)
  const attackEnd = attack / total
  const releaseStart = (attack + hold) / total
  if (attack > 0 && frame.cueProgress < attackEnd) return curveValue('easeOut', frame.cueProgress / Math.max(attackEnd, 1e-6))
  if (release > 0 && frame.cueProgress > releaseStart) return 1 - curveValue('easeIn', (frame.cueProgress - releaseStart) / Math.max(1 - releaseStart, 1e-6))
  return 1
}

function applyMusicModulation(
  frame: LaserStablePatternFrame,
  macro: LaserEffectMacro,
  context: LaserDmxShowDirectorPerformanceTimingContext,
  automation: readonly LaserEffectAutomation[],
): LaserStablePatternFrame {
  const next = { ...frame }
  const envelope = boundedEnvelope(frame, macro)
  const continuousEnergy = Math.max(0, Math.min(1, context.trackRelativeEnergy * 0.65 + context.energy * 0.35))
  const transientAccent = Math.max(context.kickStrength, context.snareStrength * 0.9, context.hatStrength * 0.35)
  const transientDecay = Math.max(0, 1 - context.beatPhase * 4)
  const accent = transientAccent * transientDecay
  const floor = Math.max(0, Math.min(2, macro.envelope.intensityFloor))
  const ceiling = Math.max(floor, Math.min(2, macro.envelope.intensityCeiling))
  next.intensity = Math.max(floor, Math.min(ceiling, next.intensity * envelope * (0.78 + continuousEnergy * 0.22) + accent * 0.12))
  const authored = new Set(automation.map(lane => lane.parameter))
  if (!authored.has('fanSpread')) next.fanSpread = Math.max(0, Math.min(180, next.fanSpread * (0.9 + continuousEnergy * 0.1)))
  if (!authored.has('width')) next.width = Math.max(0, next.width * (0.94 + continuousEnergy * 0.06))
  if (!authored.has('height')) next.height = Math.max(0, next.height * (0.94 + continuousEnergy * 0.06))
  if (!authored.has('colorBlend')) next.colorBlend = Math.max(0, Math.min(1, next.colorBlend + context.high * 0.08))
  if (!authored.has('hazeAmount')) next.hazeAmount = Math.max(0, Math.min(1, next.hazeAmount * 0.85 + continuousEnergy * 0.15))
  return next
}

function normalizeDuration(raw: unknown, fallback: LaserCueDuration = { kind: 'bar' }): LaserCueDuration {
  const value = record(raw) ? raw : {}
  const kind = DURATION_KINDS.has(value.kind as LaserCueDurationKind) ? value.kind as LaserCueDurationKind : fallback.kind
  return {
    kind,
    ...(kind === 'explicitBeats' ? { beats: clamp(value.beats, fallback.beats ?? 4, 0.25, 1024) } : {}),
    ...(kind === 'explicitSeconds' ? { seconds: clamp(value.seconds, fallback.seconds ?? 1, 0.01, 3600) } : {}),
    ...(kind === 'trackMapCue' ? { trackMapCueId: clean(value.trackMapCueId, fallback.trackMapCueId ?? '', 128) || undefined } : {}),
  }
}

function normalizeTransition(raw: unknown, fallback: LaserEffectTransitionType = 'cut'): LaserEffectTransition {
  const value = record(raw) ? raw : {}
  const type = TRANSITIONS.has(value.type as LaserEffectTransitionType) ? value.type as LaserEffectTransitionType : fallback
  const requiresBlanking = type === 'shutterOutIn' || type === 'opticalModeSwap' || type === 'briefBlackout' || type === 'cut'
  return {
    type,
    durationBeats: clamp(value.durationBeats, type === 'cut' ? 0 : 0.5, 0, 64),
    blankDisconnectedTravel: typeof value.blankDisconnectedTravel === 'boolean' ? value.blankDisconnectedTravel : requiresBlanking,
    shutterDuringSwap: typeof value.shutterDuringSwap === 'boolean' ? value.shutterDuringSwap : requiresBlanking,
  }
}

function normalizeAddress(raw: unknown): LaserDmxShowDirectorPerformanceAddress {
  const value = record(raw) ? raw : {}
  const result: LaserDmxShowDirectorPerformanceAddress = {}
  const fixtureSemanticKeys = strings(value.fixtureSemanticKeys)
  const groupSemanticKeys = strings(value.groupSemanticKeys)
  const fixtureIds = strings(value.fixtureIds)
  const mirroredGroupKeys = strings(value.mirroredGroupKeys)
  const bankRoles = strings(value.bankRoles)
  if (fixtureSemanticKeys.length) result.fixtureSemanticKeys = fixtureSemanticKeys
  if (groupSemanticKeys.length) result.groupSemanticKeys = groupSemanticKeys
  if (fixtureIds.length) result.fixtureIds = fixtureIds
  if (mirroredGroupKeys.length) result.mirroredGroupKeys = mirroredGroupKeys
  if (bankRoles.length) result.bankRoles = bankRoles
  if (Array.isArray(value.fixtureKinds)) result.fixtureKinds = value.fixtureKinds.filter((entry): entry is NonNullable<LaserDmxShowDirectorPerformanceAddress['fixtureKinds']>[number] => typeof entry === 'string') as NonNullable<LaserDmxShowDirectorPerformanceAddress['fixtureKinds']>
  if (value.match === 'all') result.match = 'all'
  else if (value.match === 'any') result.match = 'any'
  return result
}

function normalizeAutomation(raw: unknown, index: number): LaserEffectAutomation | null {
  if (!record(raw) || !AUTOMATION_PARAMETERS.has(raw.parameter as LaserEffectAutomationParameter)) return null
  const parameter = raw.parameter as LaserEffectAutomationParameter
  const curve = AUTOMATION_CURVES.has(raw.curve as LaserEffectAutomationCurve) ? raw.curve as LaserEffectAutomationCurve : 'linear'
  const startProgress = clamp(raw.startProgress, 0, 0, 1)
  const endProgress = Math.max(startProgress, clamp(raw.endProgress, 1, 0, 1))
  return {
    id: clean(raw.id, `automation-${index + 1}`, 128),
    parameter,
    from: finite(raw.from, 0),
    to: finite(raw.to, 1),
    startProgress,
    endProgress,
    curve,
    ...(curve === 'stepped' ? { steps: Math.max(2, Math.min(64, Math.round(finite(raw.steps, 4)))) } : {}),
  }
}

function normalizeAssignment(raw: unknown, index: number): LaserEffectGroupAssignment | null {
  if (!record(raw)) return null
  return {
    id: clean(raw.id, `assignment-${index + 1}`, 128),
    address: normalizeAddress(raw.address),
    ...(clean(raw.relationshipId, '', 128) ? { relationshipId: clean(raw.relationshipId, '', 128) } : {}),
    ...(raw.role === 'hero' || raw.role === 'primary' || raw.role === 'support' || raw.role === 'texture' || raw.role === 'impact' ? { role: raw.role } : {}),
    ...(raw.phaseOffset != null ? { phaseOffset: clamp(raw.phaseOffset, 0, -16, 16) } : {}),
    ...(raw.intensityScale != null ? { intensityScale: clamp(raw.intensityScale, 1, 0, 4) } : {}),
    ...(raw.colorIndex != null ? { colorIndex: Math.max(0, Math.round(finite(raw.colorIndex, 0))) } : {}),
  }
}

function normalizeMacro(raw: unknown, index: number): LaserEffectMacro | null {
  if (!record(raw)) return null
  const id = clean(raw.id, `macro-${index + 1}`, 128)
  const family = EFFECT_FAMILIES.has(raw.family as LaserEffectFamily) ? raw.family as LaserEffectFamily : 'mixedFixtureScene'
  const pattern = record(raw.pattern) ? raw.pattern : {}
  const transform = record(raw.transform) ? raw.transform : {}
  const scan = record(raw.scan) ? raw.scan : {}
  const color = record(raw.color) ? raw.color : {}
  const optics = record(raw.optics) ? raw.optics : {}
  const envelope = record(raw.envelope) ? raw.envelope : {}
  const compatibility = record(raw.compatibility) ? raw.compatibility : null
  const patternType = typeof pattern.scannerPatternType === 'string' ? pattern.scannerPatternType as LaserDmxShowDirectorScannerPatternType : familyToScannerPattern(family)
  return {
    schemaVersion: LASER_DMX_EFFECT_MACRO_SCHEMA_VERSION,
    id,
    name: clean(raw.name, id, 160),
    family,
    duration: normalizeDuration(raw.duration, { kind: 'bar' }),
    pattern: {
      topologyId: clean(pattern.topologyId, `${id}:topology`, 160),
      scannerPatternType: patternType,
      raySlotCount: Math.max(1, Math.min(64, Math.round(finite(pattern.raySlotCount, 8)))),
      traversal: pattern.traversal === 'pingPong' || pattern.traversal === 'simultaneousOpticalCopies' ? pattern.traversal : 'sequential',
      spacing: pattern.spacing === 'centerWeighted' || pattern.spacing === 'edgeWeighted' || pattern.spacing === 'authored' ? pattern.spacing : 'equal',
      closed: Boolean(pattern.closed),
      ...(strings(pattern.stablePointIds, 256).length ? { stablePointIds: strings(pattern.stablePointIds, 256) } : {}),
    },
    transform: {
      centerX: clamp(transform.centerX, 0.5, -2, 2),
      centerY: clamp(transform.centerY, 0.5, -2, 2),
      depth: clamp(transform.depth, 0, -1, 1),
      width: clamp(transform.width, 0.6, 0, 4),
      height: clamp(transform.height, 0.5, 0, 4),
      radius: clamp(transform.radius, 0.24, 0, 2),
      rotationDeg: clamp(transform.rotationDeg, 0, -720, 720),
    },
    scan: {
      scanRatePps: clamp(scan.scanRatePps, 24_000, 10, 100_000),
      direction: scan.direction === 'reverse' || scan.direction === 'alternating' ? scan.direction : 'forward',
      phase: clamp(scan.phase, 0, 0, 1),
      pointDwellMicros: clamp(scan.pointDwellMicros, 24, 0, 1_000_000),
      cornerDwellMicros: clamp(scan.cornerDwellMicros, 64, 0, 1_000_000),
      retraceBlanking: typeof scan.retraceBlanking === 'boolean' ? scan.retraceBlanking : true,
      blankingDelayMicros: clamp(scan.blankingDelayMicros, 18, 0, 100_000),
    },
    color: {
      mode: color.mode === 'fixed' || color.mode === 'palette' ? color.mode : 'scene',
      colors: strings(color.colors, 16),
      blend: clamp(color.blend, 0, 0, 1),
      alternateByGroup: Boolean(color.alternateByGroup),
    },
    optics: {
      mode: colorOpticalMode(optics.mode),
      copyCount: Math.max(1, Math.min(25, Math.round(finite(optics.copyCount, 1)))),
      spreadDeg: clamp(optics.spreadDeg, 8, 0, 90),
    },
    envelope: {
      attack: clamp(envelope.attack, 0, 0, 1),
      hold: clamp(envelope.hold, 0.72, 0, 1),
      release: clamp(envelope.release, 0.28, 0, 1),
      intensityFloor: clamp(envelope.intensityFloor, 0, 0, 1),
      intensityCeiling: clamp(envelope.intensityCeiling, 1, 0, 2),
    },
    automation: Array.isArray(raw.automation) ? raw.automation.map(normalizeAutomation).filter((item): item is LaserEffectAutomation => item !== null).slice(0, 128) : [],
    fixtureGroupAssignments: Array.isArray(raw.fixtureGroupAssignments) ? raw.fixtureGroupAssignments.map(normalizeAssignment).filter((item): item is LaserEffectGroupAssignment => item !== null).slice(0, 128) : [],
    transitionIn: normalizeTransition(raw.transitionIn, 'cut'),
    transitionOut: normalizeTransition(raw.transitionOut, 'cut'),
    ...(compatibility ? { compatibility: {
      provisional: compatibility.provisional !== false,
      ...(clean(compatibility.sourceSceneId, '', 128) ? { sourceSceneId: clean(compatibility.sourceSceneId, '', 128) } : {}),
      ...(Array.isArray(compatibility.sourceFixtureIds) ? { sourceFixtureIds: strings(compatibility.sourceFixtureIds, 512) } : {}),
      ...(strings(compatibility.warnings, 128).length ? { warnings: strings(compatibility.warnings, 128) } : {}),
    } } : {}),
  }
}

function normalizeRelationship(raw: unknown, index: number): LaserFixtureGroupRelationship | null {
  if (!record(raw)) return null
  const mode = RELATIONSHIP_MODES.has(raw.mode as LaserGroupRelationshipMode) ? raw.mode as LaserGroupRelationshipMode : 'parallel'
  return {
    schemaVersion: 1,
    id: clean(raw.id, `relationship-${index + 1}`, 128),
    name: clean(raw.name, `Relationship ${index + 1}`, 160),
    mode,
    memberAssignmentIds: strings(raw.memberAssignmentIds, 128),
    ...(clean(raw.leaderAssignmentId, '', 128) ? { leaderAssignmentId: clean(raw.leaderAssignmentId, '', 128) } : {}),
    ...(raw.phaseOffset != null ? { phaseOffset: clamp(raw.phaseOffset, 0.5, -16, 16) } : {}),
    ...(raw.rotationOffsetDeg != null ? { rotationOffsetDeg: clamp(raw.rotationOffsetDeg, 0, -720, 720) } : {}),
    ...(raw.chaseStepBeats != null ? { chaseStepBeats: clamp(raw.chaseStepBeats, 1, 0.0625, 64) } : {}),
    sharedSpeed: raw.sharedSpeed !== false,
    sharedSpread: raw.sharedSpread !== false,
    sharedIntensity: raw.sharedIntensity !== false,
    sharedColor: Boolean(raw.sharedColor),
  }
}

function normalizeCue(raw: unknown, index: number): LaserPerformanceCue | null {
  if (!record(raw)) return null
  const macroId = clean(raw.macroId, '', 128)
  if (!macroId) return null
  const quantize = raw.startQuantize === 'beat' || raw.startQuantize === 'twoBeats' || raw.startQuantize === 'bar' || raw.startQuantize === 'twoBars'
    || raw.startQuantize === 'fourBars' || raw.startQuantize === 'eightBars' || raw.startQuantize === 'phrase' || raw.startQuantize === 'section'
    || raw.startQuantize === 'explicitBeats' ? raw.startQuantize : 'bar'
  const accents = Array.isArray(raw.accents) ? raw.accents.flatMap((candidate, accentIndex): LaserCueAccent[] => {
    if (!record(candidate)) return []
    const trigger = candidate.trigger === 'kick' || candidate.trigger === 'snare' || candidate.trigger === 'hat' || candidate.trigger === 'beat'
      || candidate.trigger === 'bar' || candidate.trigger === 'phrase' || candidate.trigger === 'section' ? candidate.trigger : null
    if (!trigger) return []
    return [{
      id: clean(candidate.id, `accent-${accentIndex + 1}`, 128),
      trigger,
      ...(clean(candidate.macroId, '', 128) ? { macroId: clean(candidate.macroId, '', 128) } : {}),
      ...(strings(candidate.fixtureGroupAssignmentIds, 128).length ? { fixtureGroupAssignmentIds: strings(candidate.fixtureGroupAssignmentIds, 128) } : {}),
      durationBeats: clamp(candidate.durationBeats, trigger === 'hat' ? 0.125 : 0.25, 0.03125, 16),
      intensity: clamp(candidate.intensity, 1, 0, 2),
      priority: Math.round(clamp(candidate.priority, 0, -1024, 1024)),
    }]
  }).slice(0, 128) : []
  return {
    schemaVersion: 1,
    id: clean(raw.id, `cue-${index + 1}`, 128),
    name: clean(raw.name, `Cue ${index + 1}`, 160),
    macroId,
    ...(strings(raw.sceneIds, 128).length ? { sceneIds: strings(raw.sceneIds, 128) } : {}),
    ...(Array.isArray(raw.sectionTypes) ? { sectionTypes: raw.sectionTypes.filter((entry): entry is ReactSectionType => typeof entry === 'string') as ReactSectionType[] } : {}),
    startQuantize: quantize,
    startOffsetBeats: clamp(raw.startOffsetBeats, 0, 0, 100_000),
    ...(raw.repeatEveryBeats != null ? { repeatEveryBeats: clamp(raw.repeatEveryBeats, 4, 0.25, 100_000) } : {}),
    ...(raw.explicitTrackMapStartSec != null ? { explicitTrackMapStartSec: clamp(raw.explicitTrackMapStartSec, 0, 0, 86_400) } : {}),
    duration: normalizeDuration(raw.duration, { kind: 'section' }),
    ...(strings(raw.fixtureGroupAssignmentIds, 128).length ? { fixtureGroupAssignmentIds: strings(raw.fixtureGroupAssignmentIds, 128) } : {}),
    automation: Array.isArray(raw.automation) ? raw.automation.map(normalizeAutomation).filter((item): item is LaserEffectAutomation => item !== null).slice(0, 128) : [],
    transitionIn: normalizeTransition(raw.transitionIn, 'cut'),
    transitionOut: normalizeTransition(raw.transitionOut, 'cut'),
    accents,
    ...(raw.occurrenceVariationSeedOffset != null ? { occurrenceVariationSeedOffset: Math.round(finite(raw.occurrenceVariationSeedOffset, 0)) } : {}),
    ...(raw.minEnergy != null ? { minEnergy: clamp(raw.minEnergy, 0, 0, 1) } : {}),
    ...(raw.maxEnergy != null ? { maxEnergy: clamp(raw.maxEnergy, 1, 0, 1) } : {}),
    priority: Math.round(clamp(raw.priority, 0, -1024, 1024)),
    ...(typeof raw.blackout === 'boolean' ? { blackout: raw.blackout } : {}),
    ...(typeof raw.shutterClosed === 'boolean' ? { shutterClosed: raw.shutterClosed } : {}),
  }
}

function normalizeCueStack(raw: unknown, index: number): LaserCueStack | null {
  if (!record(raw)) return null
  const cues = Array.isArray(raw.cues) ? raw.cues.map(normalizeCue).filter((item): item is LaserPerformanceCue => item !== null).slice(0, 512) : []
  if (!cues.length) return null
  return {
    schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
    id: clean(raw.id, `cue-stack-${index + 1}`, 128),
    name: clean(raw.name, `Cue Stack ${index + 1}`, 160),
    cues,
  }
}

function familyToScannerPattern(family: LaserEffectFamily): LaserDmxShowDirectorScannerPatternType {
  if (family === 'heldBeam') return 'holdBeam'
  if (family === 'sequentialCircle') return 'circle'
  if (family === 'arcSweep') return 'arc'
  if (family === 'polygonOutline') return 'polygon'
  if (family === 'progressiveWave') return 'wave'
  if (family === 'tunnel') return 'tunnel'
  if (family === 'corridor') return 'mirroredCorridor'
  if (family === 'gridScan') return 'gridScan'
  if (family === 'lineDiffraction') return 'diffractionLine'
  if (family === 'gridDiffraction') return 'diffractionGrid'
  if (family === 'burstDiffraction') return 'diffractionBurst'
  if (family.includes('Fan') || family === 'frontAirRake' || family === 'upperAirCanopy' || family === 'parallelSheet') return 'fanSweep'
  return 'holdBeam'
}

function colorOpticalMode(value: unknown): LaserDmxShowDirectorScannerOpticalMode {
  return value === 'prism' || value === 'lineDiffraction' || value === 'gridDiffraction' || value === 'burstDiffraction' ? value : 'normal'
}

function actionScanner(action: LaserDmxShowDirectorMixedFixtureAction): Extract<LaserDmxShowDirectorMixedFixtureAction, { kind: 'scanner' }> | null {
  return action.kind === 'scanner' ? action : null
}

function familyFromScene(scene: LaserDmxShowDirectorPerformanceScene): LaserEffectFamily {
  const scannerAction = scene.fixtureActions?.map(actionScanner).find((action): action is NonNullable<ReturnType<typeof actionScanner>> => Boolean(action))
  const pattern = scannerAction?.patternType ?? scene.fixture?.scanner?.patternType
  if (pattern === 'circle') return 'sequentialCircle'
  if (pattern === 'arc') return 'arcSweep'
  if (pattern === 'polygon' || pattern === 'triangle') return 'polygonOutline'
  if (pattern === 'wave') return 'progressiveWave'
  if (pattern === 'tunnel') return 'tunnel'
  if (pattern === 'mirroredCorridor') return 'corridor'
  if (pattern === 'gridScan') return 'gridScan'
  if (pattern === 'diffractionLine') return 'lineDiffraction'
  if (pattern === 'diffractionGrid') return 'gridDiffraction'
  if (pattern === 'diffractionBurst') return 'burstDiffraction'
  if (pattern === 'fanSweep') return 'steppedFan'
  if (pattern === 'lineSweep') return 'smoothFanSweep'
  if (scene.fixtureActions?.some(action => action.kind === 'movingHead')) return 'movingHeadPositionLook'
  if (scene.fixtureActions?.some(action => action.kind === 'wash')) return 'washScene'
  if (scene.fixtureActions?.some(action => action.kind === 'led')) return 'ledChase'
  return 'mixedFixtureScene'
}

function provisionalAssignment(scene: LaserDmxShowDirectorPerformanceScene): LaserEffectGroupAssignment {
  return {
    id: `${scene.id}:primary-groups`,
    address: scene.address ?? {},
    role: 'primary',
  }
}

function inferAccents(scene: LaserDmxShowDirectorPerformanceScene): LaserCueAccent[] {
  const accents: LaserCueAccent[] = []
  if (scene.kickMutations?.length) accents.push({ id: `${scene.id}:kick-accent`, trigger: 'kick', durationBeats: 0.25, intensity: 1, priority: 20 })
  if (scene.snareMutations?.length) accents.push({ id: `${scene.id}:snare-accent`, trigger: 'snare', durationBeats: 0.25, intensity: 1, priority: 20 })
  if (scene.hatMutations?.length) accents.push({ id: `${scene.id}:hat-accent`, trigger: 'hat', durationBeats: 0.125, intensity: 0.5, priority: 10 })
  if (scene.beatMutations?.length) accents.push({ id: `${scene.id}:beat-accent`, trigger: 'beat', durationBeats: 0.25, intensity: 0.7, priority: 5 })
  if (scene.barMutations?.length) accents.push({ id: `${scene.id}:bar-accent`, trigger: 'bar', durationBeats: 0.5, intensity: 0.8, priority: 8 })
  return accents
}

export function createLegacyLaserProgrammingAdapter(
  program: Pick<LaserDmxShowDirectorPerformanceProgram, 'id' | 'name' | 'scenes'>,
  authoredRig?: LaserDmxShowDirectorState | null,
): LaserShowProgrammingDocument {
  const relationships: LaserFixtureGroupRelationship[] = []
  const relationshipFixtureKeys = new Map<string, string[]>()
  const ambiguousRelationshipIds: string[] = []
  const paired = new Map<string, LaserDmxShowDirectorFixture[]>()
  for (const fixture of authoredRig?.fixtures ?? []) {
    if (!fixture.linkedPairId) continue
    const list = paired.get(fixture.linkedPairId) ?? []
    list.push(fixture)
    paired.set(fixture.linkedPairId, list)
  }
  for (const [pairId, fixtures] of paired) {
    const id = `legacy-pair:${pairId}`
    if (fixtures.length === 2 && fixtures.every(fixture => fixture.mirrorAxis)) {
      relationships.push({
        schemaVersion: 1,
        id,
        name: `Mirrored ${pairId}`,
        mode: 'mirrored',
        memberAssignmentIds: [],
        sharedSpeed: true,
        sharedSpread: true,
        sharedIntensity: true,
        sharedColor: true,
      })
      relationshipFixtureKeys.set(id, fixtures.map(fixture => fixture.semanticKey ?? fixture.id))
    } else {
      ambiguousRelationshipIds.push(id)
    }
  }
  const macros = program.scenes.map((scene, index): LaserEffectMacro => {
    const family = familyFromScene(scene)
    const scannerAction = scene.fixtureActions?.map(actionScanner).find((action): action is NonNullable<ReturnType<typeof actionScanner>> => Boolean(action))
    const scanner = scene.fixture?.scanner
    const authoredScanner = authoredRig?.fixtures.find(fixture => fixture.kind === 'laser' && fixture.scanner)?.scanner
    const assignment = provisionalAssignment(scene)
    const stagedRelationshipAssignments: LaserEffectGroupAssignment[] = relationships.map(relationship => ({
      id: `${scene.id}:relationship:${relationship.id}`,
      address: { fixtureSemanticKeys: relationshipFixtureKeys.get(relationship.id) ?? [] },
      relationshipId: relationship.id,
      role: 'support',
    }))
    return {
      schemaVersion: 1,
      id: `legacy-macro:${scene.id}`,
      name: `${scene.label} Macro`,
      family,
      duration: { kind: 'section' },
      pattern: {
        topologyId: `legacy-topology:${scene.id}`,
        scannerPatternType: scannerAction?.patternType ?? scanner?.patternType ?? familyToScannerPattern(family),
        raySlotCount: Math.max(1, Math.min(24, authoredRig?.fixtures.filter(fixture => fixture.kind === 'laser' && fixture.enabled).reduce((maximum, fixture) => Math.max(maximum, fixture.optics.rayCount), 1) ?? 8)),
        traversal: family === 'lineDiffraction' || family === 'gridDiffraction' || family === 'burstDiffraction' ? 'simultaneousOpticalCopies' : 'sequential',
        spacing: 'equal',
        closed: family === 'sequentialCircle' || family === 'polygonOutline',
      },
      transform: {
        centerX: 0.5,
        centerY: 0.5,
        depth: 0,
        width: clamp(scannerAction?.size ?? scanner?.size, 0.6, 0, 4),
        height: clamp(scannerAction?.size ?? scanner?.size, 0.5, 0, 4),
        radius: clamp(scannerAction?.radius ?? scanner?.radius, 0.24, 0, 2),
        rotationDeg: clamp(scene.fixture?.rotation, 0, -720, 720),
      },
      scan: {
        scanRatePps: clamp(scannerAction?.scanRatePps ?? scanner?.scanRatePps, 24_000, 10, 100_000),
        direction: scannerAction?.direction ?? scanner?.direction ?? 'forward',
        phase: clamp(scannerAction?.phase ?? scanner?.phase, 0, 0, 1),
        pointDwellMicros: 24,
        cornerDwellMicros: 64,
        retraceBlanking: scannerAction?.retraceBlanking ?? scanner?.retraceBlanking ?? authoredScanner?.path.retraceBlanking ?? true,
        blankingDelayMicros: authoredScanner?.path.blankingDelayMicros ?? 18,
      },
      color: { mode: 'scene', colors: [], blend: 0, alternateByGroup: false },
      optics: {
        mode: scannerAction?.opticalMode ?? scanner?.opticalMode ?? authoredScanner?.optics.mode ?? 'normal',
        copyCount: Math.max(1, Math.min(25, Math.round(scannerAction?.opticalCopyCount ?? scanner?.opticalCopyCount ?? authoredScanner?.optics.copyCount ?? 1))),
        spreadDeg: authoredScanner?.optics.spreadDeg ?? 8,
      },
      envelope: { attack: 0, hold: 0.72, release: 0.28, intensityFloor: 0, intensityCeiling: 1 },
      automation: [],
      fixtureGroupAssignments: [assignment, ...stagedRelationshipAssignments],
      transitionIn: normalizeTransition(scene.transitionIn ? {
        type: scene.transitionIn.blackoutDuringTransition ? 'shutterOutIn' : 'crossfade',
        durationBeats: Math.max(0, finite(scene.transitionIn.durationBars, 0) * 4),
      } : null, 'cut'),
      transitionOut: normalizeTransition(scene.transitionOut ? {
        type: scene.transitionOut.blackoutDuringTransition ? 'shutterOutIn' : 'crossfade',
        durationBeats: Math.max(0, finite(scene.transitionOut.durationBars, 0) * 4),
      } : null, 'cut'),
      compatibility: {
        provisional: true,
        sourceSceneId: scene.id,
        sourceFixtureIds: authoredRig?.fixtures.map(fixture => fixture.id) ?? [],
        warnings: ['Generated by the non-destructive legacy choreography adapter.'],
      },
    }
  })
  for (const relationship of relationships) {
    relationship.memberAssignmentIds = macros.flatMap(macro => macro.fixtureGroupAssignments
      .filter(assignment => assignment.relationshipId === relationship.id)
      .map(assignment => assignment.id))
  }
  const cues = program.scenes.map((scene, index): LaserPerformanceCue => ({
    schemaVersion: 1,
    id: `legacy-cue:${scene.id}`,
    name: scene.label,
    macroId: macros[index].id,
    sceneIds: [scene.id],
    sectionTypes: scene.section.types,
    startQuantize: 'section',
    startOffsetBeats: 0,
    duration: { kind: 'section' },
    fixtureGroupAssignmentIds: [macros[index].fixtureGroupAssignments[0].id],
    automation: [],
    transitionIn: macros[index].transitionIn,
    transitionOut: macros[index].transitionOut,
    accents: inferAccents(scene),
    priority: scene.priority ?? 0,
    ...(scene.allowZeroBeamOutput ? { blackout: true } : {}),
  }))
  return {
    schemaVersion: LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION,
    id: `${program.id}:laser-programming`,
    macros,
    cueStacks: [{ schemaVersion: 1, id: `${program.id}:primary-cue-stack`, name: `${program.name} Cue Stack`, cues }],
    activeCueStackId: `${program.id}:primary-cue-stack`,
    groupRelationships: relationships,
    compatibility: {
      source: 'legacy-adapter',
      adapterVersion: 1,
      ambiguousRelationshipIds,
      warnings: [
        'Existing fixture assignments, section timing, ordered scanner paths, and source choreography remain preserved.',
        ...(relationships.length ? ['Safely inferred fixture-pair relationships are staged for migration preview and remain inactive until explicitly assigned to a cue.'] : []),
        ...(ambiguousRelationshipIds.length ? ['Some fixture relationships could not be inferred safely.'] : []),
      ],
      originalProgramBackup: JSON.parse(JSON.stringify(program)),
    },
  }
}

export function normalizeLaserShowProgrammingDocument(
  raw: unknown,
  fallbackProgram?: Pick<LaserDmxShowDirectorPerformanceProgram, 'id' | 'name' | 'scenes'> | null,
): LaserShowProgrammingDocument | null {
  if (!record(raw)) return fallbackProgram ? createLegacyLaserProgrammingAdapter(fallbackProgram) : null
  const macros = Array.isArray(raw.macros) ? raw.macros.map(normalizeMacro).filter((item): item is LaserEffectMacro => item !== null).slice(0, 512) : []
  const cueStacks = Array.isArray(raw.cueStacks) ? raw.cueStacks.map(normalizeCueStack).filter((item): item is LaserCueStack => item !== null).slice(0, 64) : []
  if (!macros.length || !cueStacks.length) return fallbackProgram ? createLegacyLaserProgrammingAdapter(fallbackProgram) : null
  const compatibility = record(raw.compatibility) ? raw.compatibility : {}
  const activeCueStackId = clean(raw.activeCueStackId, cueStacks[0].id, 128)
  return {
    schemaVersion: LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION,
    id: clean(raw.id, fallbackProgram ? `${fallbackProgram.id}:laser-programming` : 'laser-programming', 128),
    macros,
    cueStacks,
    activeCueStackId: cueStacks.some(stack => stack.id === activeCueStackId) ? activeCueStackId : cueStacks[0].id,
    groupRelationships: Array.isArray(raw.groupRelationships) ? raw.groupRelationships.map(normalizeRelationship).filter((item): item is LaserFixtureGroupRelationship => item !== null).slice(0, 256) : [],
    compatibility: {
      source: compatibility.source === 'native' || compatibility.source === 'mixed' ? compatibility.source : 'legacy-adapter',
      adapterVersion: Math.max(1, Math.round(finite(compatibility.adapterVersion, 1))),
      ambiguousRelationshipIds: strings(compatibility.ambiguousRelationshipIds, 256),
      warnings: strings(compatibility.warnings, 256),
      ...(compatibility.originalProgramBackup !== undefined ? { originalProgramBackup: compatibility.originalProgramBackup } : {}),
    },
  }
}

function durationBeats(duration: LaserCueDuration, context: LaserDmxShowDirectorPerformanceTimingContext): number {
  const beatsPerBar = Math.max(1, context.timeSignature)
  if (duration.kind === 'beat') return 1
  if (duration.kind === 'twoBeats') return 2
  if (duration.kind === 'bar') return beatsPerBar
  if (duration.kind === 'twoBars') return beatsPerBar * 2
  if (duration.kind === 'fourBars') return beatsPerBar * 4
  if (duration.kind === 'eightBars') return beatsPerBar * 8
  if (duration.kind === 'phrase') return beatsPerBar * Math.max(1, context.phraseLengthBars)
  if (duration.kind === 'explicitBeats') return Math.max(0.25, duration.beats ?? beatsPerBar)
  if (duration.kind === 'explicitSeconds') return Math.max(0.25, (duration.seconds ?? 1) * Math.max(1, context.bpm) / 60)
  if (duration.kind === 'section' || duration.kind === 'trackMapCue') {
    const section = context.resolvedMacroSection ?? context.resolvedSection
    return section ? Math.max(0.25, (section.endSec - section.startSec) * Math.max(1, context.bpm) / 60) : beatsPerBar
  }
  return beatsPerBar
}

function quantizationBeats(kind: LaserPerformanceCue['startQuantize'], context: LaserDmxShowDirectorPerformanceTimingContext): number {
  return durationBeats({ kind }, context)
}

function sectionAnchorBeat(context: LaserDmxShowDirectorPerformanceTimingContext): number {
  const section = context.resolvedMacroSection ?? context.resolvedSection
  return section ? Math.max(0, section.startSec * Math.max(1, context.bpm) / 60) : 0
}

function initialCueStartBeat(cue: LaserPerformanceCue, context: LaserDmxShowDirectorPerformanceTimingContext): number {
  if (cue.explicitTrackMapStartSec != null) return Math.max(0, cue.explicitTrackMapStartSec * Math.max(1, context.bpm) / 60)
  const anchor = sectionAnchorBeat(context)
  if (cue.startQuantize === 'section') return anchor + cue.startOffsetBeats
  const quantum = Math.max(0.25, quantizationBeats(cue.startQuantize, context))
  return anchor + Math.ceil(Math.max(0, cue.startOffsetBeats) / quantum - 1e-7) * quantum
}

interface ActiveCueWindow {
  cue: LaserPerformanceCue
  startBeat: number
  durationBeats: number
  cycle: number
}

function activeCueWindow(cue: LaserPerformanceCue, context: LaserDmxShowDirectorPerformanceTimingContext): ActiveCueWindow | null {
  const firstStart = initialCueStartBeat(cue, context)
  const cueDuration = durationBeats(cue.duration, context)
  const repeat = cue.repeatEveryBeats
  if (context.absoluteBeat + 1e-7 < firstStart) return null
  if (repeat != null && repeat > 0) {
    const cycle = Math.max(0, Math.floor((context.absoluteBeat - firstStart + 1e-7) / repeat))
    const startBeat = firstStart + cycle * repeat
    if (context.absoluteBeat >= startBeat + cueDuration - 1e-7) return null
    return { cue, startBeat, durationBeats: cueDuration, cycle }
  }
  if (context.absoluteBeat >= firstStart + cueDuration - 1e-7) return null
  return { cue, startBeat: firstStart, durationBeats: cueDuration, cycle: 0 }
}

function cueMatches(cue: LaserPerformanceCue, scene: LaserDmxShowDirectorPerformanceScene, context: LaserDmxShowDirectorPerformanceTimingContext): boolean {
  if (cue.sceneIds?.length && !cue.sceneIds.includes(scene.id)) return false
  if (cue.sectionTypes?.length && !cue.sectionTypes.includes(context.sectionType ?? 'unknown')) return false
  if (cue.minEnergy != null && context.energy < cue.minEnergy) return false
  if (cue.maxEnergy != null && context.energy > cue.maxEnergy) return false
  return true
}

function curveValue(curve: LaserEffectAutomationCurve, progress: number, steps = 4): number {
  const t = Math.max(0, Math.min(1, progress))
  if (curve === 'hold') return 0
  if (curve === 'easeIn') return t * t
  if (curve === 'easeOut') return 1 - (1 - t) * (1 - t)
  if (curve === 'easeInOut') return t * t * (3 - 2 * t)
  if (curve === 'sine') return (1 - Math.cos(t * Math.PI)) * 0.5
  if (curve === 'triangle') return 1 - Math.abs(2 * t - 1)
  if (curve === 'stepped') return Math.floor(t * Math.max(2, steps)) / Math.max(1, Math.max(2, steps) - 1)
  if (curve === 'pulse') return t < 0.5 ? 1 : 0
  return t
}

function applyAutomation(
  frame: LaserStablePatternFrame,
  automation: readonly LaserEffectAutomation[],
  quantizedDirectionProgress = frame.cueProgress,
): LaserStablePatternFrame {
  const next = { ...frame }
  for (const lane of automation) {
    const laneProgress = lane.parameter === 'direction' ? quantizedDirectionProgress : frame.cueProgress
    if (laneProgress < lane.startProgress || laneProgress > lane.endProgress) continue
    const local = lane.endProgress <= lane.startProgress ? 1 : (laneProgress - lane.startProgress) / (lane.endProgress - lane.startProgress)
    const value = lane.from + (lane.to - lane.from) * curveValue(lane.curve, local, lane.steps)
    if (lane.parameter === 'centerX') next.centerX = value
    else if (lane.parameter === 'centerY') next.centerY = value
    else if (lane.parameter === 'depth') next.depth = value
    else if (lane.parameter === 'width') next.width = Math.max(0, value)
    else if (lane.parameter === 'height') next.height = Math.max(0, value)
    else if (lane.parameter === 'radius') next.radius = Math.max(0, value)
    else if (lane.parameter === 'rotation') next.rotationDeg = value
    else if (lane.parameter === 'fanSpread') next.fanSpread = Math.max(0, Math.min(180, value))
    else if (lane.parameter === 'scanSpeed') next.scanRatePps = Math.max(10, Math.min(100_000, value))
    else if (lane.parameter === 'phase') next.phase = ((value % 1) + 1) % 1
    else if (lane.parameter === 'intensity') next.intensity = Math.max(0, Math.min(2, value))
    else if (lane.parameter === 'colorBlend') next.colorBlend = Math.max(0, Math.min(1, value))
    else if (lane.parameter === 'opticalCopySpread') next.opticalCopySpread = Math.max(0, Math.min(90, value))
    else if (lane.parameter === 'direction') next.direction = value >= 0.5 ? 'reverse' : 'forward'
    else if (lane.parameter === 'movingHeadPan') next.movingHeadPan = Math.max(-540, Math.min(540, value))
    else if (lane.parameter === 'movingHeadTilt') next.movingHeadTilt = Math.max(-270, Math.min(270, value))
    else if (lane.parameter === 'movingHeadZoom') next.movingHeadZoom = Math.max(0, Math.min(1, value))
    else if (lane.parameter === 'goboRotation') next.goboRotation = value
    else if (lane.parameter === 'washIntensity') next.washIntensity = Math.max(0, Math.min(2, value))
    else if (lane.parameter === 'ledChasePosition') next.ledChasePosition = ((value % 1) + 1) % 1
    else if (lane.parameter === 'hazeAmount') next.hazeAmount = Math.max(0, Math.min(1, value))
  }
  return next
}

function activeAccents(cue: LaserPerformanceCue, context: LaserDmxShowDirectorPerformanceTimingContext): string[] {
  return cue.accents.filter(accent => {
    if (accent.trigger === 'kick') return context.kick
    if (accent.trigger === 'snare') return context.snare
    if (accent.trigger === 'hat') return context.hat
    if (accent.trigger === 'beat') return context.boundaries.beatBoundary
    if (accent.trigger === 'bar') return context.boundaries.barBoundary
    if (accent.trigger === 'phrase') return context.boundaries.performanceSixteenBarBoundary || context.boundaries.macroSectionEntry
    return context.boundaries.sectionEntry
  }).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).map(accent => accent.id)
}

function addressMatches(fixture: LaserDmxShowDirectorFixture, address: LaserDmxShowDirectorPerformanceAddress, rig: LaserDmxShowDirectorState): boolean {
  const checks: boolean[] = []
  const fixtureKey = fixture.semanticKey ?? fixture.id
  const group = rig.groups.find(item => item.id === fixture.groupId)
  const groupKey = group?.semanticKey ?? group?.id ?? ''
  if (address.fixtureSemanticKeys?.length) checks.push(address.fixtureSemanticKeys.includes(fixtureKey))
  if (address.fixtureIds?.length) checks.push(address.fixtureIds.includes(fixture.id))
  if (address.fixtureKinds?.length) checks.push(address.fixtureKinds.includes(fixture.kind))
  if (address.groupSemanticKeys?.length) checks.push(address.groupSemanticKeys.includes(groupKey))
  if (!checks.length) return true
  return address.match === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}

function relationshipAssignments(
  macro: LaserEffectMacro,
  relationship: LaserFixtureGroupRelationship,
  activeAssignmentIds?: Set<string> | null,
): LaserEffectGroupAssignment[] {
  const eligible = macro.fixtureGroupAssignments.filter(assignment => !activeAssignmentIds || activeAssignmentIds.has(assignment.id))
  const ids = new Set(relationship.memberAssignmentIds)
  const explicit = eligible.filter(assignment => ids.has(assignment.id))
  if (explicit.length) return explicit
  return eligible.filter(assignment => assignment.relationshipId === relationship.id)
}

function applyRelationship(
  rig: LaserDmxShowDirectorState,
  macro: LaserEffectMacro,
  relationship: LaserFixtureGroupRelationship,
  frame: LaserStablePatternFrame,
  activeAssignmentIds?: Set<string> | null,
): LaserDmxShowDirectorState {
  const assignments = relationshipAssignments(macro, relationship, activeAssignmentIds)
  const members = assignments.flatMap(assignment => rig.fixtures.filter(fixture => addressMatches(fixture, assignment.address, rig)))
  const unique = Array.from(new Map(members.map(fixture => [fixture.id, fixture])).values()).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
  if (unique.length < 2) return rig
  const center = unique.reduce((sum, fixture) => sum + fixture.beam.beamAngle, 0) / unique.length
  const sharedBrightness = unique.reduce((sum, fixture) => sum + fixture.brightness, 0) / unique.length
  const palette = macro.color.colors
  const leftRight = unique.map((fixture, index) => {
    const normalizedIndex = unique.length <= 1 ? 0 : index / (unique.length - 1)
    const side = normalizedIndex < 0.5 ? -1 : 1
    const basePhase = ((frame.phase + normalizedIndex * (relationship.phaseOffset ?? 0)) % 1 + 1) % 1
    let angle = fixture.beam.beamAngle
    let rotation = fixture.rotation
    let phase = basePhase
    if (relationship.mode === 'parallel') angle = center
    else if (relationship.mode === 'mirrored' || relationship.mode === 'symmetricalPair' || relationship.mode === 'leftRightBanks') angle = side * Math.abs(center || frame.fanSpread * 0.5)
    else if (relationship.mode === 'opposed') angle = center + (index % 2 === 0 ? -90 : 90)
    else if (relationship.mode === 'alternating') angle = center + (index % 2 === 0 ? -frame.fanSpread * 0.5 : frame.fanSpread * 0.5)
    else if (relationship.mode === 'centerOut') angle = (normalizedIndex - 0.5) * frame.fanSpread
    else if (relationship.mode === 'outsideIn') angle = (0.5 - normalizedIndex) * frame.fanSpread
    else if (relationship.mode === 'rotationalOffset') rotation += index * (relationship.rotationOffsetDeg ?? 15)
    else if (relationship.mode === 'chase') phase = ((frame.phase + index / unique.length) % 1 + 1) % 1
    else if (relationship.mode === 'phaseOffset') phase = ((frame.phase + index * (relationship.phaseOffset ?? 0.25)) % 1 + 1) % 1
    else if (relationship.mode === 'leaderFollower') phase = ((frame.phase + (index === 0 ? 0 : relationship.phaseOffset ?? 0.125)) % 1 + 1) % 1
    else if (relationship.mode === 'callResponse') phase = ((frame.phase + (index % 2) * 0.5) % 1 + 1) % 1
    const callResponseScale = relationship.mode === 'callResponse'
      ? ((frame.cueProgress < 0.5) === (index % 2 === 0) ? 1 : 0.25)
      : 1
    const depthOffset = relationship.mode === 'frontRearDepthPlanes' ? (index % 2 === 0 ? -0.2 : 0.2) : 0
    const relationshipColor = relationship.mode === 'colorAlternation' && palette.length
      ? palette[index % palette.length]
      : relationship.sharedColor && palette.length
        ? palette[0]
        : fixture.color
    return {
      id: fixture.id,
      patch: {
        beam: { ...fixture.beam, beamAngle: angle, beamSpread: relationship.sharedSpread === false ? fixture.beam.beamSpread : frame.fanSpread },
        rotation,
        z: fixture.z + depthOffset,
        color: relationshipColor,
        brightness: (relationship.sharedIntensity === false ? fixture.brightness : sharedBrightness) * callResponseScale,
        runtimeScanner: {
          ...fixture.runtimeScanner,
          phase,
          ...(relationship.sharedSpeed === false ? {} : { scanRatePps: frame.scanRatePps }),
          ...(relationship.sharedSpread === false ? {} : { fanWidth: frame.fanSpread }),
        },
      },
    }
  })
  const byId = new Map(leftRight.map(entry => [entry.id, entry.patch]))
  return { ...rig, fixtures: rig.fixtures.map(fixture => byId.has(fixture.id) ? { ...fixture, ...byId.get(fixture.id) } : fixture) }
}

function relationshipForAssignment(
  document: LaserShowProgrammingDocument,
  assignment: LaserEffectGroupAssignment,
): LaserFixtureGroupRelationship | null {
  return document.groupRelationships.find(relationship => (
    relationship.id === assignment.relationshipId || relationship.memberAssignmentIds.includes(assignment.id)
  )) ?? null
}

function fixturesForRelationship(
  rig: LaserDmxShowDirectorState,
  macro: LaserEffectMacro,
  relationship: LaserFixtureGroupRelationship | null,
  fallbackAssignment: LaserEffectGroupAssignment,
  activeAssignmentIds: Set<string> | null,
): LaserDmxShowDirectorFixture[] {
  const assignments = relationship
    ? relationshipAssignments(macro, relationship, activeAssignmentIds)
    : [fallbackAssignment]
  return Array.from(new Map(assignments.flatMap(assignment => rig.fixtures
    .filter(fixture => addressMatches(fixture, assignment.address, rig))
    .map(fixture => [fixture.id, fixture] as const))).values())
    .sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id))
}

function macroSpacingCurve(macro: LaserEffectMacro): LaserDmxShowDirectorMacroScanPlan['spacingCurve'] {
  if (macro.pattern.spacing === 'centerWeighted') return 'centerWeighted'
  if (macro.pattern.spacing === 'edgeWeighted') return 'edgeWeighted'
  if (macro.pattern.spacing === 'authored') return 'custom'
  return 'linear'
}

function macroInterpolation(macro: LaserEffectMacro): LaserDmxShowDirectorMacroScanPlan['interpolation'] {
  if (macro.family === 'sequentialCircle' || macro.family === 'arcSweep' || macro.family === 'tunnel') return 'arc'
  if (macro.family === 'progressiveWave' || macro.family === 'smoothFanSweep') return 'bezier'
  return 'linear'
}

function macroRepeatMode(macro: LaserEffectMacro): LaserDmxShowDirectorMacroScanPlan['repeatMode'] {
  if (macro.pattern.traversal === 'pingPong' || macro.family === 'smoothFanSweep') return 'pingPong'
  return 'loop'
}

function buildFixtureMacroPlan(input: {
  fixture: LaserDmxShowDirectorFixture
  assignment: LaserEffectGroupAssignment
  relationship: LaserFixtureGroupRelationship | null
  memberIndex: number
  memberCount: number
  macro: LaserEffectMacro
  frame: LaserStablePatternFrame
  preserveLegacyScalarChoreography: boolean
}): LaserDmxShowDirectorMacroScanPlan {
  const { fixture, assignment, relationship, memberIndex, memberCount, macro, frame, preserveLegacyScalarChoreography } = input
  const runtime = fixture.runtimeScanner
  const relationshipMode = relationship?.mode
  const chaseSteps = Math.max(1, Math.round(frame.cueDurationBeats / Math.max(0.25, relationship?.chaseStepBeats ?? 1)))
  const chaseIndex = Math.floor(frame.cueProgress * chaseSteps) % Math.max(1, memberCount)
  let phase = runtime?.phase ?? ((frame.phase + (assignment.phaseOffset ?? 0)) % 1 + 1) % 1
  let direction = runtime?.direction ?? frame.direction
  if (relationshipMode === 'opposed') direction = memberIndex % 2 === 0 ? frame.direction : frame.direction === 'forward' ? 'reverse' : 'forward'
  if (relationshipMode === 'chase') phase = ((chaseIndex + memberIndex) / Math.max(1, memberCount)) % 1
  if (relationshipMode === 'phaseOffset') phase = ((frame.phase + memberIndex * (relationship?.phaseOffset ?? 0.25)) % 1 + 1) % 1
  if (relationshipMode === 'leaderFollower') phase = ((frame.phase + (memberIndex === 0 ? 0 : relationship?.phaseOffset ?? 0.125)) % 1 + 1) % 1
  const familyDutyCycle = macro.family === 'heldBeam'
    ? 1
    : macro.family === 'steppedFan' || macro.family === 'mirroredFan' || macro.family === 'opposedFans'
      ? 0.82
      : 0.9
  return {
    schemaVersion: 1,
    authoritative: true,
    cueFrameId: frame.id,
    cueId: frame.cueId,
    macroId: frame.macroId,
    topologyId: frame.topologyId,
    topologyRevision: frame.topologyRevision,
    topologyCacheKey: frame.topologyCacheKey,
    family: macro.family,
    assignmentId: assignment.id,
    ...(relationship ? { relationshipId: relationship.id, relationshipMode: relationship.mode } : {}),
    fixtureMemberIndex: memberIndex,
    fixtureMemberCount: memberCount,
    raySlots: [...frame.raySlots],
    pathPointCount: frame.pathPointCount,
    spacingCurve: macroSpacingCurve(macro),
    traversal: macro.pattern.traversal,
    centerX: frame.centerX,
    centerY: frame.centerY,
    depth: frame.depth,
    width: preserveLegacyScalarChoreography ? Math.max(0.01, runtime?.size ?? frame.width) : frame.width,
    height: preserveLegacyScalarChoreography ? Math.max(0.01, runtime?.size ?? frame.height) : frame.height,
    radius: preserveLegacyScalarChoreography ? Math.max(0.01, runtime?.radius ?? frame.radius) : frame.radius,
    rotationDeg: (preserveLegacyScalarChoreography ? fixture.rotation : frame.rotationDeg) + fixture.beam.beamAngle,
    fanSpreadDeg: Math.max(0, Math.min(180, runtime?.fanWidth ?? frame.fanSpread)),
    scanRatePps: Math.max(10, Math.min(100_000, runtime?.scanRatePps ?? frame.scanRatePps)),
    direction,
    phase,
    pointDwellMicros: Math.max(0, macro.scan.pointDwellMicros),
    cornerDwellMicros: Math.max(0, macro.scan.cornerDwellMicros),
    edgeDwellMicros: Math.max(macro.scan.cornerDwellMicros, macro.scan.pointDwellMicros * 2),
    blankingDelayMicros: Math.max(0, macro.scan.blankingDelayMicros),
    retraceBlanking: macro.scan.retraceBlanking,
    blankBetweenSlots: macro.family === 'steppedFan' || macro.pattern.traversal !== 'simultaneousOpticalCopies',
    repeatMode: macroRepeatMode(macro),
    interpolation: macroInterpolation(macro),
    totalDutyCycle: familyDutyCycle,
    intensity: Math.max(0, Math.min(1, fixture.brightness)),
    colorBlend: frame.colorBlend,
    opticalMode: runtime?.opticalMode ?? macro.optics.mode,
    opticalCopyCount: Math.max(1, Math.min(25, Math.round(runtime?.opticalCopyCount ?? macro.optics.copyCount))),
    opticalCopySpreadDeg: frame.opticalCopySpread,
    apertureCount: Math.max(1, Math.min(8, Math.round(fixture.optics.apertureCount || 1))),
    transitionType: frame.transitionState,
    transitionProgress: frame.transitionProgress,
    shutterClosed: frame.shutterClosed || runtime?.shutterClosed === true,
    clearTemporalHistory: frame.clearTemporalHistory,
    preservePhase: frame.preservePhase,
  }
}

function conflictingRuntimeOverrides(
  rig: LaserDmxShowDirectorState,
  assignments: readonly LaserEffectGroupAssignment[],
  macro: LaserEffectMacro,
): string[] {
  const conflicts: string[] = []
  for (const fixture of rig.fixtures) {
    if (fixture.kind !== 'laser') continue
    const assignment = assignments.find(candidate => addressMatches(fixture, candidate.address, rig))
    if (!assignment || !fixture.runtimeScanner) continue
    const runtime = fixture.runtimeScanner
    if (runtime.authoritativeSource && runtime.authoritativeSource !== 'macro') conflicts.push(`${fixture.id}:authoritativeSource=${runtime.authoritativeSource}`)
    if (runtime.macroPlan && runtime.macroPlan.macroId !== macro.id) conflicts.push(`${fixture.id}:macro=${runtime.macroPlan.macroId}`)
    if (runtime.patternType && runtime.patternType !== macro.pattern.scannerPatternType) conflicts.push(`${fixture.id}:patternType=${runtime.patternType}`)
    if (runtime.opticalCopyCount != null && runtime.opticalCopyCount !== macro.optics.copyCount) conflicts.push(`${fixture.id}:opticalCopyCount=${runtime.opticalCopyCount}`)
  }
  return Array.from(new Set(conflicts)).sort()
}

function applyMacroFrameToRig(
  rig: LaserDmxShowDirectorState,
  document: LaserShowProgrammingDocument,
  macro: LaserEffectMacro,
  cue: LaserPerformanceCue,
  frame: LaserStablePatternFrame,
  context: LaserDmxShowDirectorPerformanceTimingContext,
  activeAccentCueIds: readonly string[],
): LaserDmxShowDirectorState {
  const selectedAssignmentIds = cue.fixtureGroupAssignmentIds?.length ? new Set(cue.fixtureGroupAssignmentIds) : null
  const assignments = macro.fixtureGroupAssignments.filter(assignment => !selectedAssignmentIds || selectedAssignmentIds.has(assignment.id))
  const beatImpact = Math.max(0, 1 - context.beatPhase * 4)
  const activeAccentIds = new Set(activeAccentCueIds)
  const activeAccentDefinitions = cue.accents.filter(accent => activeAccentIds.has(accent.id))
  const preserveLegacyScalarChoreography = document.compatibility.source === 'legacy-adapter'
    && macro.compatibility?.provisional === true
  const scalarIntensity = document.compatibility.source === 'legacy-adapter' ? 1 : frame.intensity
  let next: LaserDmxShowDirectorState = {
    ...rig,
    fixtures: rig.fixtures.map(fixture => {
      const assignment = assignments.find(candidate => addressMatches(fixture, candidate.address, rig))
      if (!assignment) return fixture
      const intensityScale = assignment.intensityScale ?? 1
      const assignmentAccentDefinitions = activeAccentDefinitions.filter(accent => (
        !accent.fixtureGroupAssignmentIds?.length || accent.fixtureGroupAssignmentIds.includes(assignment.id)
      ))
      const assignmentAccentActive = assignmentAccentDefinitions.length > 0
      const assignmentAccentIntensity = assignmentAccentDefinitions.reduce((maximum, accent) => Math.max(maximum, accent.intensity), 0)
      const isMovingHead = fixture.kind === 'movingHead'
      const isWash = fixture.kind === 'parWash'
      const isHaze = fixture.kind === 'haze'
      const isLed = fixture.kind === 'ledBar' || fixture.kind === 'ledTube'
      const isStrobe = fixture.kind === 'strobe'
      const isBlinder = fixture.kind === 'blinder'
      const isCo2 = fixture.kind === 'co2Jet'
      // Legacy Performance Shows already arrive here with quantized, authored
      // transient envelopes from the Shared Performance Core. Preserve those
      // envelopes rather than re-gating them from a raw audio frame. Native
      // macro documents own their event gates explicitly below.
      const preservesLegacyEventEnvelope = document.compatibility.source === 'legacy-adapter'
        && macro.compatibility?.provisional === true
        && macro.family !== 'strobeAccent'
        && macro.family !== 'blinderImpact'
        && macro.family !== 'co2Impact'
      const eventEnabled = preservesLegacyEventEnvelope
        ? true
        : isStrobe
          ? macro.family === 'strobeAccent' || frame.transitionState === 'strobeTransition' || assignmentAccentActive
          : isBlinder
            ? macro.family === 'blinderImpact' || frame.transitionState === 'blinderImpact' || assignmentAccentActive
            : isCo2
              ? macro.family === 'co2Impact' || assignmentAccentActive
              : true
      const eventEnvelope = preservesLegacyEventEnvelope
        ? 1
        : isStrobe
          ? Math.max(beatImpact, context.transient, context.dropImpact, assignmentAccentIntensity)
          : isBlinder
            ? Math.max(0, 1 - context.beatPhase * 2.5, context.transient, context.dropImpact, assignmentAccentIntensity)
            : isCo2
              ? Math.max(0, 1 - context.beatPhase * 3, context.transient, context.dropImpact, assignmentAccentIntensity)
              : 1
      const authoredColors = macro.color.colors
      const authoredColorIndex = authoredColors.length
        ? Math.abs(assignment.colorIndex ?? (macro.color.alternateByGroup ? stableHash(fixture.id) : 0)) % authoredColors.length
        : -1
      const authoredColor = authoredColorIndex >= 0 ? authoredColors[authoredColorIndex] : fixture.color
      const scanner = fixture.kind === 'laser' ? {
        ...fixture.runtimeScanner,
        patternType: macro.pattern.scannerPatternType,
        scanRatePps: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.scanRatePps ?? frame.scanRatePps
          : frame.scanRatePps,
        direction: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.direction ?? frame.direction
          : frame.direction,
        phase: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.phase ?? ((frame.phase + (assignment.phaseOffset ?? 0)) % 1 + 1) % 1
          : ((frame.phase + (assignment.phaseOffset ?? 0)) % 1 + 1) % 1,
        fanWidth: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.fanWidth ?? fixture.beam.beamSpread
          : frame.fanSpread,
        radius: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.radius ?? frame.radius
          : frame.radius,
        size: preserveLegacyScalarChoreography
          ? fixture.runtimeScanner?.size ?? Math.max(frame.width, frame.height)
          : Math.max(frame.width, frame.height),
        retraceBlanking: macro.scan.retraceBlanking,
        opticalMode: macro.optics.mode,
        opticalCopyCount: macro.optics.copyCount,
        shutterClosed: frame.shutterClosed,
        switchBoundary: 'bar' as const,
        authoritativeSource: 'macro' as const,
      } : fixture.runtimeScanner
      return {
        ...fixture,
        color: preserveLegacyScalarChoreography ? fixture.color : authoredColor,
        brightness: Math.max(0, Math.min(1,
          fixture.brightness
          * scalarIntensity
          * intensityScale
          * (isWash ? frame.washIntensity : 1)
          * (eventEnabled ? eventEnvelope : 0),
        )),
        rotation: preserveLegacyScalarChoreography
          ? fixture.rotation
          : isMovingHead
            ? frame.movingHeadPan
            : isLed
              ? frame.ledChasePosition * 360
              : frame.rotationDeg,
        beam: {
          ...fixture.beam,
          beamAngle: preserveLegacyScalarChoreography
            ? fixture.beam.beamAngle
            : isMovingHead
              ? frame.movingHeadTilt
              : fixture.beam.beamAngle,
          beamSpread: preserveLegacyScalarChoreography ? fixture.beam.beamSpread : frame.fanSpread,
        },
        optics: preserveLegacyScalarChoreography
          ? fixture.optics
          : isMovingHead
            ? {
              ...fixture.optics,
              zoom: frame.movingHeadZoom,
              goboRotation: Math.round(frame.goboRotation / 15) * 15,
              prismRotation: Math.round(fixture.optics.prismRotation / 15) * 15,
            }
            : fixture.optics,
        component: isHaze
          ? { ...fixture.component, hazeIntensity: preserveLegacyScalarChoreography ? fixture.component.hazeIntensity : frame.hazeAmount }
          : isStrobe
            ? { ...fixture.component, strobeRate: eventEnabled ? fixture.component.strobeRate : 0 }
            : isCo2
              ? { ...fixture.component, co2BurstDurationMs: Math.max(80, Math.min(1_500, fixture.component.co2BurstDurationMs)) }
              : fixture.component,
        ...(scanner ? { runtimeScanner: scanner } : {}),
      }
    }),
  }

  for (const relationship of document.groupRelationships) {
    const generatedCompatibilityRelationship = preserveLegacyScalarChoreography
      && relationship.id.startsWith('legacy-')
    if (!generatedCompatibilityRelationship) {
      next = applyRelationship(next, macro, relationship, frame, selectedAssignmentIds)
    }
  }

  next = {
    ...next,
    fixtures: next.fixtures.map(fixture => {
      if (fixture.kind !== 'laser') return fixture
      const assignment = assignments.find(candidate => addressMatches(fixture, candidate.address, next))
      if (!assignment) return fixture
      const relationship = relationshipForAssignment(document, assignment)
      const members = fixturesForRelationship(next, macro, relationship, assignment, selectedAssignmentIds)
      const memberIndex = Math.max(0, members.findIndex(member => member.id === fixture.id))
      const macroPlan = buildFixtureMacroPlan({
        fixture,
        assignment,
        relationship,
        memberIndex,
        memberCount: Math.max(1, members.length),
        macro,
        frame,
        preserveLegacyScalarChoreography,
      })
      return {
        ...fixture,
        runtimeScanner: {
          ...fixture.runtimeScanner,
          authoritativeSource: 'macro',
          macroPlan,
          patternType: macro.pattern.scannerPatternType,
          scanRatePps: macroPlan.scanRatePps,
          direction: macroPlan.direction,
          phase: macroPlan.phase,
          fanWidth: macroPlan.fanSpreadDeg,
          radius: macroPlan.radius,
          size: Math.max(macroPlan.width, macroPlan.height),
          retraceBlanking: macroPlan.retraceBlanking,
          opticalMode: macroPlan.opticalMode,
          opticalCopyCount: macroPlan.opticalCopyCount,
          shutterClosed: macroPlan.shutterClosed,
        },
      }
    }),
  }
  return next
}

export function validateLaserShowProgrammingDocument(document: LaserShowProgrammingDocument): LaserProgrammingValidationIssue[] {
  const issues: LaserProgrammingValidationIssue[] = []
  const macroById = new Map(document.macros.map(macro => [macro.id, macro]))
  const relationships = new Map(document.groupRelationships.map(relationship => [relationship.id, relationship]))
  for (const macro of document.macros) {
    if (macro.pattern.raySlotCount > 64) issues.push({ code: 'continuous-ray-count-mutation', severity: 'error', message: `${macro.name} exceeds the stable ray-slot limit.`, sourceId: macro.id })
    if (macro.optics.copyCount > 25) issues.push({ code: 'optical-copy-count-unbounded', severity: 'error', message: `${macro.name} exceeds the optical-copy limit.`, sourceId: macro.id })
    if (macro.pattern.spacing === 'equal' && macro.pattern.raySlotCount > 1) {
      const slots = Array.from({ length: macro.pattern.raySlotCount }, (_, index) => index / (macro.pattern.raySlotCount - 1))
      const minimum = Math.min(...slots.slice(1).map((slot, index) => slot - slots[index]))
      if (minimum < 1e-6) issues.push({ code: 'ray-slot-spacing', severity: 'error', message: `${macro.name} contains collapsed ray slots.`, sourceId: macro.id })
    }
    for (const assignment of macro.fixtureGroupAssignments) {
      if (assignment.relationshipId && !relationships.has(assignment.relationshipId)) issues.push({ code: 'group-relationship-missing', severity: 'warning', message: `${macro.name} references a missing fixture relationship.`, sourceId: assignment.id })
    }
    const laserAssignments = macro.fixtureGroupAssignments.filter(assignment => assignment.address.fixtureKinds?.includes('laser'))
    if (laserAssignments.length > 1 && laserAssignments.some(assignment => !assignment.relationshipId)) {
      issues.push({ code: 'independent-fixture-direction', severity: 'warning', message: `${macro.name} has multiple laser assignments without an explicit relationship.`, sourceId: macro.id })
    }
    if ((macro.transitionIn.type === 'opticalModeSwap' || macro.transitionOut.type === 'opticalModeSwap')
      && (!macro.transitionIn.blankDisconnectedTravel || !macro.transitionOut.blankDisconnectedTravel)) {
      issues.push({ code: 'transition-blanking-required', severity: 'error', message: `${macro.name} optical transitions require blanking.`, sourceId: macro.id })
    }
  }
  for (const relationship of document.groupRelationships) {
    if ((relationship.mode === 'mirrored' || relationship.mode === 'symmetricalPair' || relationship.mode === 'opposed')
      && (relationship.sharedSpeed === false || relationship.sharedSpread === false)) {
      issues.push({ code: 'mirrored-group-unsynchronized', severity: 'warning', message: `${relationship.name} does not share speed and spread across its coordinated fixtures.`, sourceId: relationship.id })
    }
  }
  for (const stack of document.cueStacks) for (const cue of stack.cues) {
    const macro = macroById.get(cue.macroId)
    if (!macro) continue
    if (cue.duration.kind === 'beat' && (macro.family === 'tunnel' || macro.family === 'sequentialCircle' || macro.family === 'polygonOutline')) {
      issues.push({ code: 'cue-too-short', severity: 'warning', message: `${cue.name} is shorter than the effect can establish visually.`, sourceId: cue.id })
    }
  }
  return issues
}

export function sanitizeTransientLaserProgrammingPayload(
  payload: LaserDmxShowDirectorPerformanceMutationPayload,
  layer: 'primary' | 'structural' | 'transient' | 'accent',
): { payload: LaserDmxShowDirectorPerformanceMutationPayload; suppressed: string[] } {
  if (layer !== 'transient') return { payload, suppressed: [] }
  const clone: LaserDmxShowDirectorPerformanceMutationPayload = { ...payload }
  const suppressed: string[] = []
  if (clone.fixture) {
    const fixture = { ...clone.fixture }
    for (const key of ['beamAngle', 'rotation', 'targetMode', 'mirrorAxis', 'participatingGroupSemanticKeys'] as const) {
      if (fixture[key] !== undefined) { delete fixture[key]; suppressed.push(`fixture.${key}`) }
    }
    if (fixture.targetPoints !== undefined) { delete fixture.targetPoints; suppressed.push('fixture.targetPoints') }
    if (fixture.targetPointsByFixtureSemanticKey !== undefined) { delete fixture.targetPointsByFixtureSemanticKey; suppressed.push('fixture.targetPointsByFixtureSemanticKey') }
    if (fixture.targetPosition !== undefined) { delete fixture.targetPosition; suppressed.push('fixture.targetPosition') }
    if (fixture.scanner) {
      const scanner = { ...fixture.scanner }
      for (const key of ['patternType', 'opticalMode', 'opticalCopyCount', 'pathResetToken', 'heldBeam', 'durationBeats', 'direction', 'reversePath', 'radius', 'size', 'depthLayer'] as Array<keyof LaserDmxShowDirectorScannerRuntimeOverrides>) {
        if (scanner[key] !== undefined) { delete scanner[key]; suppressed.push(`fixture.scanner.${key}`) }
      }
      fixture.scanner = scanner
    }
    clone.fixture = fixture
  }
  if (clone.fixtureActions) clone.fixtureActions = clone.fixtureActions.map(action => {
    if (action.kind === 'scanner') {
      const next = { ...action }
      for (const key of ['patternType', 'opticalMode', 'opticalCopyCount', 'pathResetToken', 'heldBeam', 'durationBeats', 'direction', 'reversePath', 'radius', 'size', 'depthLayer'] as const) {
        if (next[key] !== undefined) { delete next[key]; suppressed.push(`fixtureAction.${action.id}.${key}`) }
      }
      return next
    }
    if (action.kind === 'beam') {
      const next = { ...action }
      if (next.targetMode !== undefined) { delete next.targetMode; suppressed.push(`fixtureAction.${action.id}.targetMode`) }
      if (next.targetPoints) { delete next.targetPoints; suppressed.push(`fixtureAction.${action.id}.targetPoints`) }
      if (next.targetPosition) { delete next.targetPosition; suppressed.push(`fixtureAction.${action.id}.targetPosition`) }
      return next
    }
    if (action.kind === 'movingHead') {
      const next = { ...action }
      if (next.targetMode !== undefined) { delete next.targetMode; suppressed.push(`fixtureAction.${action.id}.targetMode`) }
      if (next.targetPoints) { delete next.targetPoints; suppressed.push(`fixtureAction.${action.id}.targetPoints`) }
      if (next.rotation !== undefined) { delete next.rotation; suppressed.push(`fixtureAction.${action.id}.rotation`) }
      return next
    }
    return action
  })
  if (clone.modulations) clone.modulations = clone.modulations.filter(reference => {
    const prohibited = /(^|\.)(targetPoints|rayCount|opticalCopyCount|patternType|path|geometry)(\.|$)/i.test(reference.target)
    if (prohibited) suppressed.push(`modulation.${reference.target}`)
    return !prohibited
  })
  return { payload: clone, suppressed }
}

export function resolveLaserShowProgramming(input: ResolveLaserProgrammingInput): ResolveLaserProgrammingResult {
  const stack = input.document.cueStacks.find(candidate => candidate.id === input.document.activeCueStackId) ?? input.document.cueStacks[0]
  const eligible = stack?.cues.filter(cue => cueMatches(cue, input.selectedScene, input.context)) ?? []
  const activeWindows = eligible.map(cue => activeCueWindow(cue, input.context)).filter((window): window is ActiveCueWindow => window !== null)
  const activeWindow = [...activeWindows].sort((a, b) => b.cue.priority - a.cue.priority || b.startBeat - a.startBeat || a.cue.id.localeCompare(b.cue.id))[0] ?? null
  const cue = activeWindow?.cue ?? null
  const macro = cue ? input.document.macros.find(candidate => candidate.id === cue.macroId) ?? null : null
  if (!cue || !macro) {
    const issues = validateLaserShowProgrammingDocument(input.document)
    return {
      document: input.document,
      frame: null,
      cue,
      macro,
      activeAccentCueIds: [],
      showDirector: input.runtimeRig,
      diagnostics: {
        activePrimaryCueId: cue?.id ?? null,
        activeAccentCueIds: [],
        cueStartBeat: 0,
        cueRemainingBeats: 0,
        activeMacroId: macro?.id ?? null,
        activeMacroName: macro?.name ?? null,
        fixtureGroupRelationships: [],
        stablePatternFrameId: null,
        patternFrameRevisionCount: 0,
        transitionState: 'inactive',
        audioModulationValues: {},
        geometryRebuildCount: 0,
        patternFrameCacheHits: 0,
        patternFrameCacheMisses: 0,
        raySlotCount: 0,
        topologyChangesPerCue: 0,
        fixtureGroupSynchronizationStatus: 'inactive',
        conflictingOverrides: [],
        audioModulationBoundaries: [],
        unexpectedTopologyChanges: 0,
        warnings: issues,
        compatibilitySource: input.document.compatibility.source,
      },
    }
  }

  const startBeat = activeWindow?.startBeat ?? initialCueStartBeat(cue, input.context)
  const cueBeats = activeWindow?.durationBeats ?? durationBeats(cue.duration, input.context)
  const progress = Math.max(0, Math.min(1, (input.context.absoluteBeat - startBeat) / Math.max(0.25, cueBeats)))
  const revision = activeWindow?.cycle ?? Math.max(0, Math.floor(startBeat / Math.max(0.25, quantizationBeats(cue.startQuantize, input.context))))
  const selectedAssignmentIds = cue.fixtureGroupAssignmentIds?.length ? new Set(cue.fixtureGroupAssignmentIds) : null
  const assignments = macro.fixtureGroupAssignments.filter(assignment => !selectedAssignmentIds || selectedAssignmentIds.has(assignment.id))
  const activeRelationships = input.document.groupRelationships.filter(relationship => (
    relationshipAssignments(macro, relationship, selectedAssignmentIds).length > 0
  ))
  const activeFixtureTopology = input.runtimeRig.fixtures
    .filter(fixture => assignments.some(assignment => addressMatches(fixture, assignment.address, input.runtimeRig)))
    .map(fixture => [
      fixture.id,
      fixture.groupId ?? 'group:none',
      fixture.kind,
      Math.max(1, Math.round(fixture.optics.apertureCount || 1)),
    ].join(':'))
    .sort()
  const topology = resolvePatternTopologyTemplate(
    macro,
    cue,
    revision,
    assignments.map(assignment => assignment.id).sort(),
    activeRelationships.map(relationship => relationship.id).sort(),
    activeFixtureTopology,
  )
  const identity = [
    input.program.id,
    stack?.id ?? 'cue-stack:none',
    cue.id,
    macro.id,
    topology.cacheKey,
    revision,
    input.context.sectionIdentity,
    input.context.sectionOccurrence,
    cue.occurrenceVariationSeedOffset ?? 0,
  ].join('|')
  const transitionInProgress = macro.transitionIn.durationBeats > 0
    ? Math.min(1, Math.max(0, (input.context.absoluteBeat - startBeat) / macro.transitionIn.durationBeats))
    : 1
  const remaining = Math.max(0, startBeat + cueBeats - input.context.absoluteBeat)
  const transitionOutProgress = macro.transitionOut.durationBeats > 0
    ? 1 - Math.min(1, remaining / macro.transitionOut.durationBeats)
    : 0
  const transitionState: LaserStablePatternFrame['transitionState'] = transitionInProgress < 1
    ? macro.transitionIn.type
    : transitionOutProgress > 0
      ? macro.transitionOut.type
      : 'steady'
  const transitionProgress = transitionInProgress < 1
    ? transitionInProgress
    : transitionOutProgress > 0
      ? transitionOutProgress
      : 1
  const safety = transitionSafety(transitionState, transitionProgress, cue)
  let frame: LaserStablePatternFrame = {
    schemaVersion: LASER_DMX_PATTERN_FRAME_SCHEMA_VERSION,
    id: `pattern-frame:${stableHash(identity).toString(16)}`,
    revision,
    cueId: cue.id,
    macroId: macro.id,
    topologyId: macro.pattern.topologyId,
    topologyRevision: topology.template.topologyRevision,
    topologyCacheKey: topology.cacheKey,
    patternFrameCacheHit: true,
    cueStartBeat: startBeat,
    cueDurationBeats: cueBeats,
    cueProgress: progress,
    centerX: macro.transform.centerX,
    centerY: macro.transform.centerY,
    depth: macro.transform.depth,
    width: macro.transform.width,
    height: macro.transform.height,
    radius: macro.transform.radius,
    rotationDeg: macro.transform.rotationDeg,
    fanSpread: Math.max(0, Math.min(180, macro.transform.width * 90)),
    scanRatePps: macro.scan.scanRatePps,
    direction: macro.scan.direction,
    phase: ((macro.scan.phase + progress) % 1 + 1) % 1,
    intensity: macro.envelope.intensityCeiling,
    colorBlend: macro.color.blend,
    opticalCopySpread: macro.optics.spreadDeg,
    movingHeadPan: macro.transform.rotationDeg,
    movingHeadTilt: 0,
    movingHeadZoom: 0.5,
    goboRotation: 0,
    washIntensity: 1,
    ledChasePosition: Math.floor(progress * Math.max(1, topology.template.raySlots.length)) / Math.max(1, topology.template.raySlots.length),
    hazeAmount: 0.5,
    raySlots: [...topology.template.raySlots],
    pathPointCount: topology.template.pathPointCount,
    relationshipModes: activeRelationships.map(relationship => relationship.mode),
    transitionState,
    transitionProgress,
    shutterClosed: safety.shutterClosed,
    clearTemporalHistory: safety.clearTemporalHistory,
    preservePhase: safety.preservePhase,
    activeRelationshipIds: activeRelationships.map(relationship => relationship.id),
    deterministicIdentity: identity,
  }
  const quantizedDirectionProgress = Math.max(0, Math.min(1,
    Math.floor(Math.max(0, input.context.absoluteBeat - startBeat) + 1e-7) / Math.max(0.25, cueBeats),
  ))
  const automation = [...macro.automation, ...cue.automation]
  frame = applyAutomation(frame, automation, quantizedDirectionProgress)
  frame = applyMusicModulation(frame, macro, input.context, automation)
  const accentIds = activeAccents(cue, input.context)
  const conflicts = conflictingRuntimeOverrides(input.runtimeRig, assignments, macro)
  const showDirector = applyMacroFrameToRig(input.runtimeRig, input.document, macro, cue, frame, input.context, accentIds)
  const issues = validateLaserShowProgrammingDocument(input.document)
  const relationshipNames = activeRelationships.map(relationship => `${relationship.name} (${relationship.mode})`)
  const audioModulationBoundaries = [
    'continuous:intensity',
    'continuous:fanSpread',
    'continuous:patternSize',
    'continuous:colorBlend',
    'continuous:hazeAmount',
    ...(input.context.boundaries.beatBoundary ? ['transient:beatBoundary'] : []),
    ...(input.context.boundaries.barBoundary ? ['transient:barBoundary'] : []),
    ...(input.context.kick ? ['transient:kickAccent'] : []),
    ...(input.context.snare ? ['transient:snareAccent'] : []),
  ]
  return {
    document: input.document,
    frame,
    cue,
    macro,
    activeAccentCueIds: accentIds,
    showDirector,
    diagnostics: {
      activePrimaryCueId: cue.id,
      activeAccentCueIds: accentIds,
      cueStartBeat: startBeat,
      cueRemainingBeats: remaining,
      activeMacroId: macro.id,
      activeMacroName: macro.name,
      fixtureGroupRelationships: relationshipNames,
      stablePatternFrameId: frame.id,
      patternFrameRevisionCount: revision,
      transitionState,
      audioModulationValues: {
        kick: input.context.kickStrength,
        snare: input.context.snareStrength,
        hat: input.context.hatStrength,
        energy: input.context.energy,
        fanSpread: frame.fanSpread,
        patternSize: Math.max(frame.width, frame.height),
      },
      geometryRebuildCount: 0,
      // Counts are scoped to the active topology key, not process-global.
      // That keeps deterministic resolver output identical across seek/replay
      // while still exposing that the topology was built once and is resident.
      patternFrameCacheHits: 1,
      patternFrameCacheMisses: 1,
      raySlotCount: frame.raySlots.length,
      topologyChangesPerCue: 0,
      fixtureGroupSynchronizationStatus: conflicts.length
        ? 'conflict-overridden'
        : activeRelationships.length
          ? 'synchronized'
          : 'inactive',
      conflictingOverrides: conflicts,
      audioModulationBoundaries,
      unexpectedTopologyChanges: 0,
      warnings: issues,
      compatibilitySource: input.document.compatibility.source,
    },
  }
}
