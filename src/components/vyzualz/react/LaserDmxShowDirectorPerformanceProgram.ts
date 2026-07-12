import type {
  LaserDmxBeamMotion,
  LaserDmxMatrixBeamAppearance,
  LaserDmxShowDirectorBeamConfig,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorFixtureSpecificConfig,
  LaserDmxShowDirectorMirrorAxis,
  LaserDmxShowDirectorTriggerConfig,
  ReactSectionType,
} from './ReactTypes'

export const LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION = 1
export const LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION = 1

export type LaserDmxShowDirectorPerformanceSectionType = ReactSectionType
export type LaserDmxShowDirectorPerformanceMutationMode = 'set' | 'add' | 'multiply' | 'toggle'
export type LaserDmxShowDirectorPerformanceTransitionCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'
export type LaserDmxShowDirectorPerformanceConditionOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'notEq'
  | 'between'
  | 'truthy'
  | 'falsy'

export interface LaserDmxShowDirectorPerformanceOccurrenceMatch {
  /** One-based occurrence indexes. */
  occurrences?: number[]
  minOccurrence?: number
  maxOccurrence?: number
  every?: number
}

export interface LaserDmxShowDirectorPerformanceSectionMatch {
  types: LaserDmxShowDirectorPerformanceSectionType[]
  sectionIds?: string[]
  occurrence?: LaserDmxShowDirectorPerformanceOccurrenceMatch
  dropOccurrence?: LaserDmxShowDirectorPerformanceOccurrenceMatch
  minConfidence?: number
}

export interface LaserDmxShowDirectorPerformanceAddress {
  fixtureSemanticKeys?: string[]
  groupSemanticKeys?: string[]
  fixtureKinds?: LaserDmxShowDirectorFixtureKind[]
  fixtureIds?: string[]
  match?: 'any' | 'all'
}

export interface LaserDmxShowDirectorMusicIntelligenceCondition {
  source: string
  operator: LaserDmxShowDirectorPerformanceConditionOperator
  value?: number | boolean | string
  maxValue?: number
  minConfidence?: number
  requiredCapability?: string
  invert?: boolean
}

export interface LaserDmxShowDirectorMusicIntelligenceModulationReference {
  source: string
  target: string
  amount: number
  min?: number
  max?: number
  mode?: LaserDmxShowDirectorPerformanceMutationMode
  curve?: LaserDmxShowDirectorPerformanceTransitionCurve
  requiredCapability?: string
  minConfidence?: number
}

export interface LaserDmxShowDirectorFixtureRuntimeOverrides {
  enabled?: boolean
  brightness?: number
  color?: string
  beamAngle?: number
  fanSpread?: number
  focus?: number
  targetMode?: LaserDmxShowDirectorBeamConfig['targetMode']
  targetPoints?: LaserDmxShowDirectorBeamConfig['targets']
  targetPosition?: { x: number; y: number; z?: number }
  rotation?: number
  mirrorAxis?: LaserDmxShowDirectorMirrorAxis | null
  trigger?: Partial<LaserDmxShowDirectorTriggerConfig>
  beamAppearance?: Partial<LaserDmxMatrixBeamAppearance>
  beamTravel?: Partial<LaserDmxBeamMotion>
  component?: Partial<LaserDmxShowDirectorFixtureSpecificConfig>
  participatingGroupSemanticKeys?: string[]
}

export interface LaserDmxShowDirectorGroupRuntimeOverrides {
  enabled?: boolean
  participating?: boolean
  dimmer?: number
  color?: string
  muted?: boolean
  soloed?: boolean
}

export interface LaserDmxShowDirectorGlobalOutputOverrides {
  blackout?: boolean
  dimmer?: number
  haze?: number
  backgroundFade?: number
  beamPersistence?: number
  globalBeamWidth?: number
  globalGlow?: number
  globalStrobeRate?: number
}

export interface LaserDmxShowDirectorPerformanceMutationPayload {
  address?: LaserDmxShowDirectorPerformanceAddress
  fixture?: LaserDmxShowDirectorFixtureRuntimeOverrides
  group?: LaserDmxShowDirectorGroupRuntimeOverrides
  global?: LaserDmxShowDirectorGlobalOutputOverrides
  conditions?: LaserDmxShowDirectorMusicIntelligenceCondition[]
  modulations?: LaserDmxShowDirectorMusicIntelligenceModulationReference[]
}

interface LaserDmxShowDirectorPerformanceMutationBase extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  enabled?: boolean
  probability?: number
  seedOffset?: number
}

export interface LaserDmxShowDirectorPerformanceBeatMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  beatDivision?: number
  beatOffsets?: number[]
}

export interface LaserDmxShowDirectorPerformanceKickMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceSnareMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  threshold?: number
}

export interface LaserDmxShowDirectorPerformanceBarMutation extends LaserDmxShowDirectorPerformanceMutationBase {
  intervalBars?: number
  anchorBar?: number
}

export interface LaserDmxShowDirectorPerformanceFourBarVariation extends LaserDmxShowDirectorPerformanceMutationBase {
  blockOffsets?: number[]
}

export interface LaserDmxShowDirectorPerformanceEightBarFixtureRecruitmentStage extends LaserDmxShowDirectorPerformanceMutationBase {
  stage: number
  cumulative?: boolean
}

export interface LaserDmxShowDirectorPerformanceSixteenBarEvolution extends LaserDmxShowDirectorPerformanceMutationBase {
  phase?: number
  phraseLengthBars?: number
}

export interface LaserDmxShowDirectorPerformanceSceneVariation extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  label?: string
  weight?: number
  everyBars?: number
  barOffsets?: number[]
  conditions?: LaserDmxShowDirectorMusicIntelligenceCondition[]
}

export interface LaserDmxShowDirectorPerformanceSceneTransition {
  durationBars?: number
  durationMs?: number
  curve?: LaserDmxShowDirectorPerformanceTransitionCurve
  blackoutDuringTransition?: boolean
}

export interface LaserDmxShowDirectorPerformanceScene extends LaserDmxShowDirectorPerformanceMutationPayload {
  id: string
  label: string
  enabled: boolean
  section: LaserDmxShowDirectorPerformanceSectionMatch
  priority?: number
  transitionIn?: LaserDmxShowDirectorPerformanceSceneTransition
  transitionOut?: LaserDmxShowDirectorPerformanceSceneTransition
  variations?: LaserDmxShowDirectorPerformanceSceneVariation[]
  beatMutations?: LaserDmxShowDirectorPerformanceBeatMutation[]
  kickMutations?: LaserDmxShowDirectorPerformanceKickMutation[]
  snareMutations?: LaserDmxShowDirectorPerformanceSnareMutation[]
  barMutations?: LaserDmxShowDirectorPerformanceBarMutation[]
  fourBarVariations?: LaserDmxShowDirectorPerformanceFourBarVariation[]
  eightBarRecruitment?: LaserDmxShowDirectorPerformanceEightBarFixtureRecruitmentStage[]
  sixteenBarEvolution?: LaserDmxShowDirectorPerformanceSixteenBarEvolution[]
}

export interface LaserDmxShowDirectorPerformanceProgramTuning {
  intensity: number
  variation: number
  audioIntelligenceResponse: number
  transitionScale: number
}

export interface LaserDmxShowDirectorPerformanceRuntimeDiagnosticsMetadata {
  authoringVersion?: string
  createdAt?: string
  updatedAt?: string
  notes?: string[]
  expectedFixtureSemanticKeys?: string[]
  expectedGroupSemanticKeys?: string[]
}

export interface LaserDmxShowDirectorPerformanceProgram {
  schemaVersion: number
  id: string
  name: string
  description?: string
  deterministicSeed: number
  scenes: LaserDmxShowDirectorPerformanceScene[]
  tuning: LaserDmxShowDirectorPerformanceProgramTuning
  diagnostics?: LaserDmxShowDirectorPerformanceRuntimeDiagnosticsMetadata
}

export type LaserDmxShowDirectorBuiltInPerformanceProgramId =
  | 'prism-cathedral'
  | 'cardinal-fan-reactor'
  | 'cyan-mirror-cage'

export interface LaserDmxShowDirectorBuiltInPerformanceRegistryEntry {
  id: LaserDmxShowDirectorBuiltInPerformanceProgramId
  name: string
  status: 'foundation' | 'available'
  program: LaserDmxShowDirectorPerformanceProgram | null
}

export const LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY: Readonly<Record<
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  LaserDmxShowDirectorBuiltInPerformanceRegistryEntry
>> = Object.freeze({
  'prism-cathedral': Object.freeze({ id: 'prism-cathedral', name: 'Prism Cathedral', status: 'foundation', program: null }),
  'cardinal-fan-reactor': Object.freeze({ id: 'cardinal-fan-reactor', name: 'Cardinal Fan Reactor', status: 'foundation', program: null }),
  'cyan-mirror-cage': Object.freeze({ id: 'cyan-mirror-cage', name: 'Cyan Mirror Cage', status: 'foundation', program: null }),
})

export interface LaserDmxShowDirectorPerformanceState {
  schemaVersion: number
  activeProgramId: string | null
  activeBuiltInProgramId: LaserDmxShowDirectorBuiltInPerformanceProgramId | null
  activeProgramDefinition: LaserDmxShowDirectorPerformanceProgram | null
  enabled: boolean
  tuning: LaserDmxShowDirectorPerformanceProgramTuning
  audioIntelligenceEnabled: boolean
  deterministicSeed: number
  runtimeInvalidationId: string
}

const DEFAULT_TUNING: LaserDmxShowDirectorPerformanceProgramTuning = Object.freeze({
  intensity: 1,
  variation: 1,
  audioIntelligenceResponse: 1,
  transitionScale: 1,
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: unknown, fallback: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function positiveInt(value: unknown, fallback: number, max = 0x7fffffff): number {
  return Math.max(0, Math.min(max, Math.round(finite(value, fallback))))
}

function cleanString(value: unknown, fallback = '', max = 160): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
}

function cleanStringArray(value: unknown, max = 128): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(item => cleanString(item)).filter(Boolean))).slice(0, max)
    : []
}

function isSectionType(value: unknown): value is LaserDmxShowDirectorPerformanceSectionType {
  return value === 'intro'
    || value === 'verse'
    || value === 'build'
    || value === 'preDrop'
    || value === 'drop'
    || value === 'breakdown'
    || value === 'bridge'
    || value === 'outro'
    || value === 'unknown'
}

function isBuiltInId(value: unknown): value is LaserDmxShowDirectorBuiltInPerformanceProgramId {
  return value === 'prism-cathedral' || value === 'cardinal-fan-reactor' || value === 'cyan-mirror-cage'
}

export function normalizeLaserDmxShowDirectorPerformanceTuning(
  raw: unknown,
): LaserDmxShowDirectorPerformanceProgramTuning {
  const value = isRecord(raw) ? raw : {}
  return {
    intensity: clamp(value.intensity, DEFAULT_TUNING.intensity, 0, 2),
    variation: clamp(value.variation, DEFAULT_TUNING.variation, 0, 2),
    audioIntelligenceResponse: clamp(value.audioIntelligenceResponse, DEFAULT_TUNING.audioIntelligenceResponse, 0, 2),
    transitionScale: clamp(value.transitionScale, DEFAULT_TUNING.transitionScale, 0, 4),
  }
}

function normalizeOccurrence(raw: unknown): LaserDmxShowDirectorPerformanceOccurrenceMatch | undefined {
  if (!isRecord(raw)) return undefined
  const occurrences = Array.isArray(raw.occurrences)
    ? Array.from(new Set(raw.occurrences.map(item => positiveInt(item, 0, 1024)).filter(item => item > 0))).sort((a, b) => a - b)
    : undefined
  const minOccurrence = positiveInt(raw.minOccurrence, 0, 1024) || undefined
  const maxOccurrence = positiveInt(raw.maxOccurrence, 0, 1024) || undefined
  const every = positiveInt(raw.every, 0, 1024) || undefined
  if (!occurrences?.length && !minOccurrence && !maxOccurrence && !every) return undefined
  return { occurrences, minOccurrence, maxOccurrence, every }
}

function normalizeSectionMatch(raw: unknown): LaserDmxShowDirectorPerformanceSectionMatch {
  const value = isRecord(raw) ? raw : {}
  const types = Array.isArray(value.types) ? value.types.filter(isSectionType) : []
  return {
    types: types.length > 0 ? Array.from(new Set(types)) : ['unknown'],
    sectionIds: cleanStringArray(value.sectionIds),
    occurrence: normalizeOccurrence(value.occurrence),
    dropOccurrence: normalizeOccurrence(value.dropOccurrence),
    minConfidence: clamp(value.minConfidence, 0, 0, 1),
  }
}

function normalizeScene(raw: unknown, index: number): LaserDmxShowDirectorPerformanceScene | null {
  if (!isRecord(raw) || !isRecord(raw.section) || !Array.isArray(raw.section.types)) return null
  const id = cleanString(raw.id, '', 96)
  const label = cleanString(raw.label, '', 160)
  const section = normalizeSectionMatch(raw.section)
  if (!id || !label || !raw.section.types.some(isSectionType)) return null
  return {
    ...(raw as unknown as LaserDmxShowDirectorPerformanceScene),
    id,
    label,
    enabled: raw.enabled !== false,
    section,
    priority: Math.round(finite(raw.priority, 0)),
    variations: Array.isArray(raw.variations) ? raw.variations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceSceneVariation[] : [],
    beatMutations: Array.isArray(raw.beatMutations) ? raw.beatMutations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceBeatMutation[] : [],
    kickMutations: Array.isArray(raw.kickMutations) ? raw.kickMutations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceKickMutation[] : [],
    snareMutations: Array.isArray(raw.snareMutations) ? raw.snareMutations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceSnareMutation[] : [],
    barMutations: Array.isArray(raw.barMutations) ? raw.barMutations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceBarMutation[] : [],
    fourBarVariations: Array.isArray(raw.fourBarVariations) ? raw.fourBarVariations.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceFourBarVariation[] : [],
    eightBarRecruitment: Array.isArray(raw.eightBarRecruitment) ? raw.eightBarRecruitment.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceEightBarFixtureRecruitmentStage[] : [],
    sixteenBarEvolution: Array.isArray(raw.sixteenBarEvolution) ? raw.sixteenBarEvolution.filter(isRecord) as unknown as LaserDmxShowDirectorPerformanceSixteenBarEvolution[] : [],
  }
}

export function normalizeLaserDmxShowDirectorPerformanceProgram(
  raw: unknown,
): LaserDmxShowDirectorPerformanceProgram | null {
  if (!isRecord(raw)) return null
  const id = cleanString(raw.id, '', 96)
  const name = cleanString(raw.name, '', 160)
  if (!id || !name || !Array.isArray(raw.scenes)) return null
  const scenes = raw.scenes.map(normalizeScene).filter((scene): scene is LaserDmxShowDirectorPerformanceScene => scene !== null)
  if (scenes.length === 0) return null
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id,
    name,
    description: cleanString(raw.description, '', 1000) || undefined,
    deterministicSeed: positiveInt(raw.deterministicSeed, 0),
    scenes,
    tuning: normalizeLaserDmxShowDirectorPerformanceTuning(raw.tuning),
    diagnostics: isRecord(raw.diagnostics) ? raw.diagnostics as LaserDmxShowDirectorPerformanceRuntimeDiagnosticsMetadata : undefined,
  }
}

export function cloneLaserDmxShowDirectorPerformanceProgram(
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceProgram {
  return normalizeLaserDmxShowDirectorPerformanceProgram(JSON.parse(JSON.stringify(program))) as LaserDmxShowDirectorPerformanceProgram
}

export function createDefaultLaserDmxShowDirectorPerformanceState(): LaserDmxShowDirectorPerformanceState {
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId: null,
    activeBuiltInProgramId: null,
    activeProgramDefinition: null,
    enabled: false,
    tuning: { ...DEFAULT_TUNING },
    audioIntelligenceEnabled: true,
    deterministicSeed: 0,
    runtimeInvalidationId: 'show-director-performance:none:0',
  }
}

export function normalizeLaserDmxShowDirectorPerformanceState(
  raw: unknown,
): LaserDmxShowDirectorPerformanceState {
  const fallback = createDefaultLaserDmxShowDirectorPerformanceState()
  if (!isRecord(raw)) return fallback
  const definition = normalizeLaserDmxShowDirectorPerformanceProgram(raw.activeProgramDefinition)
  const builtInId = isBuiltInId(raw.activeBuiltInProgramId) ? raw.activeBuiltInProgramId : null
  const activeProgramId = definition?.id ?? builtInId ?? null
  const enabled = raw.enabled === true && activeProgramId !== null && (definition !== null || LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY[builtInId!]?.program !== null)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId,
    activeBuiltInProgramId: builtInId,
    activeProgramDefinition: definition,
    enabled,
    tuning: normalizeLaserDmxShowDirectorPerformanceTuning(raw.tuning),
    audioIntelligenceEnabled: raw.audioIntelligenceEnabled !== false,
    deterministicSeed: positiveInt(raw.deterministicSeed, definition?.deterministicSeed ?? 0),
    runtimeInvalidationId: cleanString(
      raw.runtimeInvalidationId,
      `show-director-performance:${activeProgramId ?? 'none'}:0`,
      192,
    ),
  }
}

export function nextLaserDmxShowDirectorPerformanceInvalidationId(
  current: string,
  programId: string | null,
): string {
  const match = /:(\d+)$/.exec(current)
  const revision = Math.max(0, Number(match?.[1] ?? 0)) + 1
  return `show-director-performance:${programId ?? 'none'}:${revision}`
}

export function applyLaserDmxShowDirectorPerformanceProgramState(
  current: LaserDmxShowDirectorPerformanceState,
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceState {
  const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(program)
  if (!normalized) return normalizeLaserDmxShowDirectorPerformanceState(current)
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_STATE_SCHEMA_VERSION,
    activeProgramId: normalized.id,
    activeBuiltInProgramId: isBuiltInId(normalized.id) ? normalized.id : null,
    activeProgramDefinition: cloneLaserDmxShowDirectorPerformanceProgram(normalized),
    enabled: true,
    tuning: { ...normalized.tuning },
    audioIntelligenceEnabled: current.audioIntelligenceEnabled,
    deterministicSeed: normalized.deterministicSeed,
    runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(current.runtimeInvalidationId, normalized.id),
  }
}

export function clearLaserDmxShowDirectorPerformanceProgramState(
  current: LaserDmxShowDirectorPerformanceState,
): LaserDmxShowDirectorPerformanceState {
  return {
    ...createDefaultLaserDmxShowDirectorPerformanceState(),
    audioIntelligenceEnabled: current.audioIntelligenceEnabled,
    runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(current.runtimeInvalidationId, null),
  }
}
