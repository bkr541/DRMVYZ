import {
  performanceDeterministicUnit,
  resolveSharedPerformanceCadence,
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceSignals,
  selectSharedPerformanceScene,
  selectSharedPerformanceWeightedVariation,
  sharedPerformanceOccurrenceMatches,
} from '../../../features/performanceCore'
import {
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxBeamMotion,
  type LaserDmxMatrixBeamAppearance,
  type LaserDmxMatrixBeamVisualRole,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import {
  createLaserDmxShowDirectorBeamBudgetReport,
  type LaserDmxShowDirectorBeamBudgetReport,
} from './LaserDmxShowDirectorBeamBudget'
import type {
  LaserDmxShowDirectorBeamPriorityRole,
  LaserDmxShowDirectorFixtureRuntimeOverrides,
  LaserDmxShowDirectorGlobalOutputOverrides,
  LaserDmxShowDirectorGroupRuntimeOverrides,
  LaserDmxShowDirectorMusicIntelligenceCondition,
  LaserDmxShowDirectorMusicIntelligenceModulationReference,
  LaserDmxShowDirectorMixedFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceBlackoutPolicy,
  LaserDmxShowDirectorPerformanceBeatMutation,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceFallbackBehavior,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceMutationMode,
  LaserDmxShowDirectorPerformanceMutationPayload,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceProgramTuning,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSceneTransition,
  LaserDmxShowDirectorPerformanceSceneVariation,
  LaserDmxShowDirectorProgrammedBlackoutKind,
  LaserDmxShowDirectorProgrammedBlackoutWindow,
  LaserDmxShowDirectorSectionEnergyEnvelope,
  LaserDmxShowDirectorPerformanceSectionType,
  LaserDmxShowDirectorPerformanceTransitionCurve,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'
import {
  createLegacyLaserProgrammingAdapter,
  resolveLaserShowProgramming,
  sanitizeTransientLaserProgrammingPayload,
  type LaserProgrammingRuntimeDiagnostics,
  type LaserStablePatternFrame,
} from './LaserDmxShowDirectorProgramming'

const EPSILON = 1e-6
const DEFAULT_BLACKOUT_POLICY: LaserDmxShowDirectorPerformanceBlackoutPolicy = Object.freeze({
  maxPreDropBeats: 1,
  maxImpactCutBeats: 0.5,
  maxFakeoutBeats: 1,
  maximumProgrammedBlackoutRatio: 0.04,
  retriggerGuardBeats: 0.25,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.34,
})
const normalizedAuthoredRigCache = new WeakMap<object, LaserDmxShowDirectorState>()

function normalizedAuthoredRig(state: LaserDmxShowDirectorState): LaserDmxShowDirectorState {
  const cached = normalizedAuthoredRigCache.get(state as object)
  if (cached) return cached
  const normalized = normalizeLaserDmxShowDirectorState(state)
  normalizedAuthoredRigCache.set(state as object, normalized)
  return normalized
}

export interface ResolveLaserDmxShowDirectorPerformanceInput {
  authoredShowDirector: LaserDmxShowDirectorState
  program: LaserDmxShowDirectorPerformanceProgram | null
  context: LaserDmxShowDirectorPerformanceTimingContext
  tuning: LaserDmxShowDirectorPerformanceProgramTuning
  programSeed: number
  enabled: boolean
  audioIntelligenceEnabled: boolean
  fallbackBehavior: LaserDmxShowDirectorPerformanceFallbackBehavior
  runtimeInvalidationId: string
  transportDiscontinuityIdentity?: string | null
}

export type LaserDmxShowDirectorPerformanceAnalysisStatus = 'ready' | 'partial' | 'fallback'

export interface LaserDmxShowDirectorPerformanceCapabilityDiagnostics {
  analysisReady: boolean
  analysisStatus: LaserDmxShowDirectorPerformanceAnalysisStatus
  missingCapabilities: string[]
  missingFixtureKeys: string[]
  missingGroupKeys: string[]
  malformedMutationIds: string[]
  unsupportedFixtureActionIds?: string[]
  suppressedAudioGeometryMappings?: string[]
  fallbackReason: string | null
  suppressionReason: string | null
  beamBudgetWarning: string | null
  programmedBlackoutKind?: LaserDmxShowDirectorProgrammedBlackoutKind | null
  programmedBlackoutWindowId?: string | null
  programmedBlackoutRemainingBeats?: number
  visibleOutputRecovered?: boolean
}

export interface LaserDmxShowDirectorResolvedEnergyMetrics {
  activeFixtureGroups: number
  estimatedBeamCount: number
  brightness: number
  fanSpread: number
  movementStrength: number
  glow: number
  density: number
  negativeSpace: number
}

export interface LaserDmxShowDirectorPerformanceResolution {
  showDirector: LaserDmxShowDirectorState
  activeSceneId: string | null
  activeSceneLabel: string | null
  activeVariation: string | null
  activeMotifFamily?: string | null
  fourBarVariation: string | null
  eightBarRecruitmentStage: number
  currentSection: LaserDmxShowDirectorPerformanceSectionType
  currentSectionOccurrence: number
  activeFixtureKeys: string[]
  activeGroupKeys: string[]
  estimatedBeamDemand: number
  boundedBeamDemand: number
  requestedGlobalOutputOverrides: LaserDmxShowDirectorGlobalOutputOverrides
  energyEnvelopeKey?: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey | null
  energyEnvelope?: LaserDmxShowDirectorSectionEnergyEnvelope | null
  energyMetrics?: LaserDmxShowDirectorResolvedEnergyMetrics
  fixturePriorityById: Record<string, number>
  fixturePriorityRoleById?: Record<string, LaserDmxShowDirectorBeamPriorityRole>
  activePrimaryCueId?: string | null
  activeAccentCueIds?: string[]
  activeMacroId?: string | null
  activeMacroName?: string | null
  stablePatternFrame?: LaserStablePatternFrame | null
  programmingDiagnostics?: LaserProgrammingRuntimeDiagnostics | null
  diagnostics: LaserDmxShowDirectorPerformanceCapabilityDiagnostics
  deterministicIdentity: string
}

interface ResolverWork {
  authored: LaserDmxShowDirectorState
  runtime: LaserDmxShowDirectorState
  input: ResolveLaserDmxShowDirectorPerformanceInput
  fixtureRoles: Record<string, LaserDmxShowDirectorBeamPriorityRole>
  global: LaserDmxShowDirectorGlobalOutputOverrides
  missingCapabilities: Set<string>
  missingFixtureKeys: Set<string>
  missingGroupKeys: Set<string>
  malformedMutationIds: Set<string>
  unsupportedFixtureActionIds: Set<string>
  suppressedAudioGeometryMappings: Set<string>
  deferredTransientLayers: Array<{
    payload: LaserDmxShowDirectorPerformanceMutationPayload
    mode: LaserDmxShowDirectorPerformanceMutationMode
    responseStrength: number
  }>
  programmedBlackout: {
    kind: LaserDmxShowDirectorProgrammedBlackoutKind
    windowId: string
    remainingBeats: number
  } | null
  visibleOutputRecovered: boolean
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function positiveInt(value: unknown, fallback = 0): number {
  return Math.max(0, Math.round(finite(value, fallback)))
}

function blackoutPolicy(work: ResolverWork): LaserDmxShowDirectorPerformanceBlackoutPolicy {
  return work.input.program?.blackoutPolicy ?? DEFAULT_BLACKOUT_POLICY
}

function beatsSinceMacroSectionStart(context: LaserDmxShowDirectorPerformanceTimingContext): number {
  return Math.max(0, context.barsSinceMacroSectionStart * Math.max(1, context.timeSignature))
}

function beatsUntilMacroSectionEnd(context: LaserDmxShowDirectorPerformanceTimingContext): number {
  return Math.max(0, context.barsUntilMacroSectionEnd * Math.max(1, context.timeSignature))
}

function semanticFixtureKey(fixture: LaserDmxShowDirectorFixture): string {
  return fixture.semanticKey?.trim() || fixture.id
}

function semanticGroupKey(group: LaserDmxShowDirectorState['groups'][number]): string {
  return group.semanticKey?.trim() || group.id
}

function occurrenceMatches(value: number, match: LaserDmxShowDirectorPerformanceScene['section']['occurrence']): boolean {
  return sharedPerformanceOccurrenceMatches(value, match)
}

function sceneBarMatches(scene: LaserDmxShowDirectorPerformanceScene, context: LaserDmxShowDirectorPerformanceTimingContext): boolean {
  const match = scene.barMatch
  if (!match) return true
  const bar = Math.max(0, context.barWithinMacroSection)
  if (match.startBar != null && bar < match.startBar) return false
  if (match.endBar != null && bar > match.endBar) return false
  if (match.everyBars != null && match.everyBars > 0) {
    const offsets = match.barOffsets?.length ? match.barOffsets : [0]
    if (!offsets.some(offset => (bar - positiveInt(offset)) % positiveInt(match.everyBars, 1) === 0)) return false
  }
  return true
}

function conditionValue(
  condition: LaserDmxShowDirectorMusicIntelligenceCondition,
  context: LaserDmxShowDirectorPerformanceTimingContext,
): number | boolean | string | null {
  return context.intelligence.value(condition.source)
}

function conditionPasses(
  condition: LaserDmxShowDirectorMusicIntelligenceCondition,
  work: ResolverWork,
): boolean {
  const { context, audioIntelligenceEnabled } = work.input
  if (!audioIntelligenceEnabled) return false
  const capability = condition.requiredCapability
  if (capability && !context.intelligence.supports(capability)) {
    work.missingCapabilities.add(capability)
    return false
  }
  if (condition.minConfidence != null && context.intelligence.sourceConfidence(condition.source) < condition.minConfidence) return false
  const actual = conditionValue(condition, context)
  const expected = condition.value
  const numeric = typeof actual === 'number' ? actual : actual ? 1 : 0
  let result: boolean
  switch (condition.operator) {
    case 'gt': result = numeric > finite(expected, 0); break
    case 'gte': result = numeric >= finite(expected, 0); break
    case 'lt': result = numeric < finite(expected, 0); break
    case 'lte': result = numeric <= finite(expected, 0); break
    case 'eq': result = actual === expected || numeric === finite(expected, Number.NaN); break
    case 'notEq': result = actual !== expected && numeric !== finite(expected, Number.NaN); break
    case 'between': result = numeric >= finite(expected, 0) && numeric <= finite(condition.maxValue, 1); break
    case 'truthy': result = Boolean(actual); break
    case 'falsy': result = !actual; break
    default: result = false
  }
  return condition.invert ? !result : result
}

function conditionsPass(
  conditions: readonly LaserDmxShowDirectorMusicIntelligenceCondition[] | undefined,
  work: ResolverWork,
): boolean {
  return !conditions?.length || conditions.every(condition => conditionPasses(condition, work))
}

function sectionTypeForFallback(input: ResolveLaserDmxShowDirectorPerformanceInput): LaserDmxShowDirectorPerformanceSectionType {
  const direct = input.context.resolvedMacroSection?.type ?? input.context.resolvedSection?.type ?? input.context.intelligence.section.type ?? 'unknown'
  if (direct !== 'unknown') return direct
  if (input.fallbackBehavior !== 'basicTiming') return 'unknown'
  const energy = clamp01(input.context.energy)
  const progress = clamp01(input.context.sectionProgress)
  if (energy >= 0.78) return 'drop'
  if (energy >= 0.55 && progress >= 0.45) return 'build'
  if (energy <= 0.2 && input.context.audioTimeSec > 0) return 'breakdown'
  return 'verse'
}

function effectiveSectionOccurrence(
  type: LaserDmxShowDirectorPerformanceSectionType,
  context: LaserDmxShowDirectorPerformanceTimingContext,
): number {
  if (context.sectionOccurrence > 0) return context.sectionOccurrence
  return type === 'unknown' ? 0 : 1
}

function effectiveDropOccurrence(
  type: LaserDmxShowDirectorPerformanceSectionType,
  context: LaserDmxShowDirectorPerformanceTimingContext,
): number {
  if (context.dropOccurrence > 0) return context.dropOccurrence
  // Energy/semantic fallback can identify a drop even when no authoritative section map
  // exists. Treat that inferred section as Drop 1 without mutating Track Map authority.
  return type === 'drop' && context.resolvedSection == null ? 1 : 0
}

function sceneMatches(
  scene: LaserDmxShowDirectorPerformanceScene,
  type: LaserDmxShowDirectorPerformanceSectionType,
  work: ResolverWork,
): boolean {
  const context = work.input.context
  if (!scene.enabled || !scene.section.types.includes(type)) return false
  if (scene.section.sectionIds?.length && !scene.section.sectionIds.includes(context.resolvedSection?.id ?? '')) return false
  if (!occurrenceMatches(effectiveSectionOccurrence(type, context), scene.section.occurrence)) return false
  if (!occurrenceMatches(effectiveDropOccurrence(type, context), scene.section.dropOccurrence)) return false
  if (scene.section.minConfidence != null && context.sectionConfidence < scene.section.minConfidence) return false
  if (!sceneBarMatches(scene, context)) return false
  return conditionsPass(scene.conditions, work)
}

function selectScene(work: ResolverWork): { scene: LaserDmxShowDirectorPerformanceScene | null; fallbackReason: string | null; sectionType: LaserDmxShowDirectorPerformanceSectionType } {
  const program = work.input.program
  if (!program) return { scene: null, fallbackReason: null, sectionType: 'unknown' }
  const sectionType = sectionTypeForFallback(work.input)
  const candidates = program.scenes.filter(scene => sceneMatches(scene, sectionType, work))
  let fallbackReason: string | null = null
  let pool = candidates
  if (pool.length === 0 && work.input.fallbackBehavior !== 'authoredRig') {
    for (const fallbackType of program.fallbackOrder ?? []) {
      const fallback = program.scenes.filter(scene => sceneMatches(scene, fallbackType, work))
      if (fallback.length) {
        pool = fallback
        fallbackReason = `No ${sectionType} scene; using ${fallbackType} fallback.`
        break
      }
    }
    if (pool.length === 0 && work.input.fallbackBehavior === 'programDefault') {
      pool = program.scenes.filter(scene => scene.enabled && conditionsPass(scene.conditions, work))
      if (pool.length) fallbackReason = `No ${sectionType} scene; using program default.`
    }
  }
  if (pool.length === 0) return { scene: null, fallbackReason, sectionType }
  const identity = [
    work.input.programSeed,
    program.id,
    work.input.context.sectionIdentity,
    work.input.context.resolvedMacroSection?.id ?? 'macro:none',
    effectiveSectionOccurrence(sectionType, work.input.context),
    effectiveDropOccurrence(sectionType, work.input.context),
  ].join('|')
  const scene = selectSharedPerformanceScene(pool, work.input.context, {
    id: candidate => candidate.id,
    matches: () => true,
    priority: candidate => finite(candidate.priority, 0),
    deterministicScore: candidate => performanceDeterministicUnit(identity, candidate.id),
  })
  return { scene, fallbackReason, sectionType }
}

function addressMatchesFixture(
  fixture: LaserDmxShowDirectorFixture,
  address: LaserDmxShowDirectorPerformanceAddress | undefined,
  work: ResolverWork,
  allowBankRoles = true,
): boolean {
  if (!address) return true
  const checks: boolean[] = []
  const fixtureKey = semanticFixtureKey(fixture)
  const group = work.runtime.groups.find(item => item.id === fixture.groupId)
  const groupKey = group ? semanticGroupKey(group) : ''
  if (address.fixtureSemanticKeys?.length) {
    const matched = address.fixtureSemanticKeys.includes(fixtureKey)
    checks.push(matched)
    if (!matched && !work.runtime.fixtures.some(item => address.fixtureSemanticKeys?.includes(semanticFixtureKey(item)))) {
      address.fixtureSemanticKeys.forEach(key => work.missingFixtureKeys.add(key))
    }
  }
  if (address.fixtureIds?.length) checks.push(address.fixtureIds.includes(fixture.id))
  if (address.fixtureKinds?.length) checks.push(address.fixtureKinds.includes(fixture.kind))
  if (address.groupSemanticKeys?.length) {
    const matched = address.groupSemanticKeys.includes(groupKey)
    checks.push(matched)
    if (!matched && !work.runtime.groups.some(item => address.groupSemanticKeys?.includes(semanticGroupKey(item)))) {
      address.groupSemanticKeys.forEach(key => work.missingGroupKeys.add(key))
    }
  }
  if (address.mirroredGroupKeys?.length) {
    const linkedPairId = fixture.linkedPairId?.trim() ?? ''
    const matched = address.mirroredGroupKeys.some(key => key === groupKey || key === linkedPairId)
    checks.push(matched)
    if (!matched) {
      for (const key of address.mirroredGroupKeys) {
        if (!work.runtime.fixtures.some(item => item.linkedPairId === key)
          && !work.runtime.groups.some(item => semanticGroupKey(item) === key)) work.missingGroupKeys.add(key)
      }
    }
  }
  if (allowBankRoles && address.bankRoles?.length) {
    for (const role of address.bankRoles) {
      const roleAddress = work.input.program?.fixtureBanks?.[role]?.address ?? work.input.program?.bankRoles?.[role]
      if (!roleAddress) {
        work.missingGroupKeys.add(`bank-role:${role}`)
        checks.push(false)
        continue
      }
      checks.push(addressMatchesFixture(fixture, roleAddress, work, false))
    }
  }
  if (checks.length === 0) return true
  return address.match === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}

function mixNumber(current: number, incoming: number, mode: LaserDmxShowDirectorPerformanceMutationMode = 'set'): number {
  if (!Number.isFinite(incoming)) return current
  switch (mode) {
    case 'add': return current + incoming
    case 'multiply': return current * incoming
    case 'toggle': return incoming >= 0.5 ? (current ? 0 : 1) : current
    default: return incoming
  }
}

function mixIntensityDelta(
  current: number,
  incoming: number,
  mode: LaserDmxShowDirectorPerformanceMutationMode,
  intensity: number,
  geometry = false,
): number {
  const pressure = clamp(intensity, 0, 2)
  const influence = geometry ? clamp(pressure, 0, 1.25) : pressure
  if (!Number.isFinite(incoming)) return current
  switch (mode) {
    case 'add': return current + incoming * (geometry ? clamp(pressure, 0, 1.5) : pressure)
    case 'multiply': return current * (1 + (incoming - 1) * influence)
    case 'toggle': return incoming >= 0.5 ? (current ? 0 : 1) : current
    default: return current + (incoming - current) * influence
  }
}

function applyBeamAppearanceOverrides(
  current: Partial<LaserDmxMatrixBeamAppearance> | undefined,
  incoming: Partial<LaserDmxMatrixBeamAppearance>,
  mode: LaserDmxShowDirectorPerformanceMutationMode,
  intensity: number,
): Partial<LaserDmxMatrixBeamAppearance> {
  const next = { ...current }
  const defaults: Pick<LaserDmxMatrixBeamAppearance, 'dimmer' | 'width' | 'focus' | 'strobeRate' | 'flickerAmount' | 'divergence' | 'glow'> = {
    dimmer: 1,
    width: 1,
    focus: 0.8,
    strobeRate: 0,
    flickerAmount: 0,
    divergence: 0.2,
    glow: 0.72,
  }
  for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
    const value = incoming[key]
    if (typeof value !== 'number') continue
    const mixed = mixIntensityDelta(typeof next[key] === 'number' ? next[key] as number : defaults[key], value, mode, intensity, key === 'focus' || key === 'divergence')
    next[key] = key === 'width' ? clamp(mixed, 0.1, 8) : clamp01(mixed)
  }
  if (typeof incoming.shutterOpen === 'boolean') next.shutterOpen = incoming.shutterOpen
  if (incoming.geometry) next.geometry = incoming.geometry
  return next
}

function applyFixtureOverrides(
  fixture: LaserDmxShowDirectorFixture,
  overrides: LaserDmxShowDirectorFixtureRuntimeOverrides,
  mode: LaserDmxShowDirectorPerformanceMutationMode,
  intensity: number,
  work: ResolverWork,
): LaserDmxShowDirectorFixture {
  const scalar = clamp(intensity, 0, 2)
  const beam = { ...fixture.beam }
  const component = { ...fixture.component }
  const next: LaserDmxShowDirectorFixture = {
    ...fixture,
    beam,
    trigger: { ...fixture.trigger },
    component,
    runtimeScanner: fixture.runtimeScanner ? { ...fixture.runtimeScanner } : undefined,
    runtimeBeamAppearance: fixture.runtimeBeamAppearance ? { ...fixture.runtimeBeamAppearance } : undefined,
    runtimeBeamVisualRole: fixture.runtimeBeamVisualRole,
    runtimeBeamTravel: fixture.runtimeBeamTravel ? { ...fixture.runtimeBeamTravel } : undefined,
  }
  if (overrides.enabled != null) next.enabled = overrides.enabled
  if (overrides.brightness != null) next.brightness = clamp01(mixIntensityDelta(next.brightness, overrides.brightness, mode, scalar, false))
  if (overrides.color) next.color = overrides.color
  if (overrides.beamAngle != null) beam.beamAngle = clamp(mixIntensityDelta(beam.beamAngle, overrides.beamAngle, mode, scalar, true), -360, 360)
  if (overrides.fanSpread != null) beam.beamSpread = clamp(mixIntensityDelta(beam.beamSpread, overrides.fanSpread, mode, scalar, true), 0, 180)
  if (overrides.focus != null) beam.focus = clamp01(mixIntensityDelta(beam.focus, overrides.focus, mode, scalar, true))
  if (overrides.targetMode) beam.targetMode = overrides.targetMode
  const targetPoints = overrides.targetPointsByFixtureSemanticKey?.[semanticFixtureKey(fixture)] ?? overrides.targetPoints
  if (targetPoints) {
    beam.targets = targetPoints.slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map(target => ({ ...target }))
    const first = beam.targets[0]
    if (first) {
      beam.targetX = first.x
      beam.targetY = first.y
    }
  }
  if (overrides.targetPosition) {
    beam.targetX = finite(overrides.targetPosition.x, beam.targetX ?? fixture.x)
    beam.targetY = finite(overrides.targetPosition.y, beam.targetY ?? fixture.y)
    if (overrides.targetPosition.z != null) beam.targetZ = clamp(finite(overrides.targetPosition.z), -1, 1)
  }
  if (overrides.rotation != null) next.rotation = clamp(mixIntensityDelta(next.rotation, overrides.rotation, mode, scalar, true), -720, 720)
  if (overrides.mirrorAxis !== undefined) next.mirrorAxis = overrides.mirrorAxis
  if (overrides.trigger) next.trigger = { ...next.trigger, ...overrides.trigger }
  if (overrides.component) next.component = { ...component, ...overrides.component }
  if (overrides.scanner) next.runtimeScanner = { ...next.runtimeScanner, ...overrides.scanner }
  if (overrides.beamAppearance) next.runtimeBeamAppearance = applyBeamAppearanceOverrides(next.runtimeBeamAppearance, overrides.beamAppearance, mode, scalar)
  if (overrides.beamVisualRole) next.runtimeBeamVisualRole = overrides.beamVisualRole as LaserDmxMatrixBeamVisualRole
  if (overrides.beamTravel) next.runtimeBeamTravel = { ...next.runtimeBeamTravel, ...overrides.beamTravel }
  if (overrides.participatingGroupSemanticKeys?.length) {
    const requestedKeys = overrides.participatingGroupSemanticKeys
    const matchedGroup = requestedKeys
      .map(key => work.runtime.groups.find(group => semanticGroupKey(group) === key))
      .find((group): group is LaserDmxShowDirectorState['groups'][number] => Boolean(group))
    if (matchedGroup) next.groupId = matchedGroup.id
    for (const key of requestedKeys) {
      if (!work.runtime.groups.some(group => semanticGroupKey(group) === key)) work.missingGroupKeys.add(key)
    }
  }
  if (overrides.beamPriorityRole) work.fixtureRoles[fixture.id] = overrides.beamPriorityRole
  return next
}

function applyGroupOverrides(
  fixture: LaserDmxShowDirectorFixture,
  overrides: LaserDmxShowDirectorGroupRuntimeOverrides,
  addressedGroupIds: Set<string>,
): LaserDmxShowDirectorFixture {
  if (!fixture.groupId || !addressedGroupIds.has(fixture.groupId)) {
    return overrides.soloed ? { ...fixture, enabled: false } : fixture
  }
  const next = { ...fixture }
  if (overrides.enabled != null) next.enabled = overrides.enabled
  if (overrides.participating != null) next.enabled = overrides.participating
  if (overrides.muted === true) next.enabled = false
  if (overrides.dimmer != null) next.brightness = clamp01(next.brightness * clamp01(overrides.dimmer))
  if (overrides.color) next.color = overrides.color
  return next
}

function mergeGlobal(
  current: LaserDmxShowDirectorGlobalOutputOverrides,
  patch: LaserDmxShowDirectorGlobalOutputOverrides,
  mode: LaserDmxShowDirectorPerformanceMutationMode,
): LaserDmxShowDirectorGlobalOutputOverrides {
  const next = { ...current }
  for (const [key, raw] of Object.entries(patch)) {
    if (key === 'blackout') {
      next.blackout = Boolean(raw)
      continue
    }
    if (typeof raw !== 'number') continue
    const typedKey = key as Exclude<keyof LaserDmxShowDirectorGlobalOutputOverrides, 'blackout'>
    const previous = typeof next[typedKey] === 'number' ? next[typedKey] as number : (typedKey === 'dimmer' ? 1 : 0)
    const mixed = mixNumber(previous, raw, mode)
    next[typedKey] = typedKey === 'globalBeamWidth'
      ? clamp(mixed, 0.1, 6)
      : clamp01(mixed)
  }
  return next
}

function modulationValue(
  reference: LaserDmxShowDirectorMusicIntelligenceModulationReference,
  work: ResolverWork,
): number | null {
  if (!work.input.audioIntelligenceEnabled) return null
  if (reference.requiredCapability && !work.input.context.intelligence.supports(reference.requiredCapability)) {
    work.missingCapabilities.add(reference.requiredCapability)
    return null
  }
  if (reference.minConfidence != null && work.input.context.intelligence.sourceConfidence(reference.source) < reference.minConfidence) return null
  const raw = work.input.context.intelligence.modulation(reference.source)
  const curved = curveProgress(clamp01(raw), reference.curve ?? 'linear')
  return clamp(curved * finite(reference.amount, 0), reference.min ?? -2, reference.max ?? 2)
}

function applyModulation(
  reference: LaserDmxShowDirectorMusicIntelligenceModulationReference,
  work: ResolverWork,
  fixtures: LaserDmxShowDirectorFixture[],
  address?: LaserDmxShowDirectorPerformanceAddress,
  responseStrength = 1,
): void {
  const value = modulationValue(reference, work)
  if (value == null) return
  const mode = reference.mode ?? 'add'
  const target = reference.target.replace(/^fixture\./, '')
  if (reference.target.startsWith('global.')) {
    const key = reference.target.slice('global.'.length) as keyof LaserDmxShowDirectorGlobalOutputOverrides
    work.global = mergeGlobal(work.global, { [key]: value }, mode)
    return
  }
  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index]
    if (!addressMatchesFixture(fixture, address, work)) continue
    const patch: LaserDmxShowDirectorFixtureRuntimeOverrides = {}
    if (target === 'brightness') patch.brightness = value
    else if (target === 'rotation') patch.rotation = value
    else if (target === 'beamAngle') patch.beamAngle = value
    else if (target === 'fanSpread' || target === 'beamSpread') patch.fanSpread = value
    else if (target === 'focus') patch.focus = value
    else if (target === 'beamWidth') patch.beamAppearance = { width: value } as Partial<LaserDmxMatrixBeamAppearance>
    else if (target === 'travelSpeed') patch.beamTravel = { beatsPerTravel: Math.max(0.25, value) } as Partial<LaserDmxBeamMotion>
    else continue
    fixtures[index] = applyFixtureOverrides(
      fixture,
      patch,
      mode,
      work.input.tuning.audioIntelligenceResponse * responseStrength,
      work,
    )
  }
}

function mixedFixtureActionSupportsFixture(
  action: LaserDmxShowDirectorMixedFixtureAction,
  fixture: LaserDmxShowDirectorFixture,
): boolean {
  switch (action.kind) {
    case 'scanner': return fixture.kind === 'laser'
    case 'beam': return fixture.kind === 'laser' || fixture.kind === 'movingHead'
    case 'movingHead': return fixture.kind === 'movingHead'
    case 'led': return fixture.kind === 'ledBar' || fixture.kind === 'ledTube'
    case 'strobe': return fixture.kind === 'strobe'
    case 'blinder': return fixture.kind === 'blinder'
    case 'wash': return fixture.kind === 'parWash'
    case 'haze': return fixture.kind === 'haze'
    case 'co2': return fixture.kind === 'co2Jet'
  }
}

function mixedFixtureActionOverrides(
  action: LaserDmxShowDirectorMixedFixtureAction,
): LaserDmxShowDirectorFixtureRuntimeOverrides {
  const common: LaserDmxShowDirectorFixtureRuntimeOverrides = {
    ...(action.enabled != null ? { enabled: action.enabled } : {}),
    ...(action.brightness != null ? { brightness: action.brightness } : {}),
    ...(action.color ? { color: action.color } : {}),
  }
  switch (action.kind) {
    case 'scanner': return { ...common, scanner: {
      patternType: action.patternType, scanRatePps: action.scanRatePps, durationBeats: action.durationBeats, direction: action.direction,
      reversePath: action.reversePath, phase: action.phase, fanWidth: action.fanWidth, radius: action.radius, size: action.size,
      depthLayer: action.depthLayer, retraceBlanking: action.retraceBlanking, opticalMode: action.opticalMode, opticalCopyCount: action.opticalCopyCount,
      shutterClosed: action.shutterClosed, heldBeam: action.heldBeam, pathResetToken: action.pathResetToken, switchBoundary: action.switchBoundary,
    } }
    case 'beam': return { ...common, targetMode: action.targetMode, targetPoints: action.targetPoints, targetPosition: action.targetPosition, fanSpread: action.fanSpread, focus: action.focus, beamVisualRole: action.beamVisualRole, beamPriorityRole: action.beamPriorityRole, beamAppearance: action.beamAppearance, beamTravel: action.beamTravel }
    case 'movingHead': return { ...common, targetMode: action.targetMode, targetPoints: action.targetPoints, fanSpread: action.fanSpread, focus: action.focus, rotation: action.rotation, component: action.movementStyle ? { movingHeadPanTiltStyle: action.movementStyle } : undefined }
    case 'led': return { ...common, component: action.direction ? { ledDirection: action.direction } : undefined }
    case 'strobe': return { ...common, ...(action.active != null ? { enabled: action.active } : {}), trigger: action.durationMs != null ? { fadeOutMs: action.durationMs } : undefined, component: action.rateHz != null ? { strobeRate: action.rateHz } : undefined, beamAppearance: action.rateHz != null ? { strobeRate: clamp(action.rateHz / 30, 0, 1) } : undefined }
    case 'blinder': return { ...common, ...(action.active != null ? { enabled: action.active } : {}), trigger: action.durationMs != null ? { fadeOutMs: action.durationMs } : undefined }
    case 'wash': return { ...common, fanSpread: action.fanSpread, focus: action.focus }
    case 'haze': return { ...common, component: action.amount != null ? { hazeIntensity: action.amount } : undefined }
    case 'co2': return { ...common, ...(action.active != null ? { enabled: action.active } : {}), ...(action.burstStrength != null ? { brightness: action.burstStrength } : {}), trigger: action.durationMs != null ? { fadeOutMs: action.durationMs } : undefined, component: action.durationMs != null ? { co2BurstDurationMs: action.durationMs } : undefined }
  }
}

function applyPayload(
  payload: LaserDmxShowDirectorPerformanceMutationPayload,
  work: ResolverWork,
  mode: LaserDmxShowDirectorPerformanceMutationMode = 'set',
  responseStrength = 1,
  programmingLayer: 'primary' | 'structural' | 'transient' | 'accent' = 'structural',
): void {
  const sanitized = sanitizeTransientLaserProgrammingPayload(payload, programmingLayer)
  sanitized.suppressed.forEach(item => work.suppressedAudioGeometryMappings.add(item))
  const safePayload = sanitized.payload
  if (!conditionsPass(safePayload.conditions, work)) return
  if (programmingLayer === 'transient') {
    // Keep compatibility choreography in its original authored order so scene
    // transitions blend the accent instead of letting it jump around the cue.
    // Native macro documents replay the bounded scalar layer after the stable
    // frame is established; provisional legacy macros preserve it directly.
    const programmingSource = work.input.program?.laserProgramming?.compatibility.source ?? 'legacy-adapter'
    if (programmingSource !== 'legacy-adapter') {
      work.deferredTransientLayers.push({ payload: safePayload, mode, responseStrength })
    }
  }
  const address = safePayload.address
  let fixtures = work.runtime.fixtures.map(fixture => addressMatchesFixture(fixture, address, work)
    ? safePayload.fixture
      ? applyFixtureOverrides(fixture, safePayload.fixture, mode, work.input.tuning.intensity * responseStrength, work)
      : fixture
    : fixture)

  for (const action of safePayload.fixtureActions ?? []) {
    let applied = false
    fixtures = fixtures.map(fixture => {
      if (!addressMatchesFixture(fixture, address, work) || !mixedFixtureActionSupportsFixture(action, fixture)) return fixture
      applied = true
      return applyFixtureOverrides(fixture, mixedFixtureActionOverrides(action), mode, work.input.tuning.intensity * responseStrength, work)
    })
    if (!applied) work.unsupportedFixtureActionIds.add(action.id)
  }

  if (safePayload.group) {
    const addressedGroupIds = new Set(work.runtime.fixtures
      .filter(fixture => addressMatchesFixture(fixture, address, work))
      .flatMap(fixture => fixture.groupId ? [fixture.groupId] : []))
    fixtures = fixtures.map(fixture => applyGroupOverrides(fixture, safePayload.group as LaserDmxShowDirectorGroupRuntimeOverrides, addressedGroupIds))
  }
  work.runtime = { ...work.runtime, fixtures }
  if (safePayload.global) work.global = mergeGlobal(work.global, safePayload.global, mode)
  for (const modulation of safePayload.modulations ?? []) {
    applyModulation(modulation, work, work.runtime.fixtures, address, responseStrength)
  }
}

function mutationActive(
  mutation: LaserDmxShowDirectorPerformanceMutationBase,
  work: ResolverWork,
  identity: string,
): boolean {
  if (!mutation || typeof mutation.id !== 'string' || mutation.id.trim() === '') {
    work.malformedMutationIds.add(mutation?.id ?? 'unknown')
    return false
  }
  if (mutation.enabled === false || !conditionsPass(mutation.conditions, work)) return false
  // Mutations without an explicit probability are structural choreography and must
  // remain active even when Variation Amount is zero. The tuning value only scales
  // optional/probabilistic accents.
  if (mutation.probability == null) return true
  const probability = clamp01(finite(mutation.probability, 1) * clamp(work.input.tuning.variation, 0, 2))
  return performanceDeterministicUnit(work.input.programSeed, mutation.seedOffset ?? 0, identity, mutation.id) <= probability
}

function applyMutation(
  mutation: LaserDmxShowDirectorPerformanceMutationBase,
  work: ResolverWork,
  identity: string,
  responseStrength = 1,
  programmingLayer: 'structural' | 'transient' = 'structural',
): void {
  if (!mutationActive(mutation, work, identity) || responseStrength <= EPSILON) return
  applyPayload(mutation, work, 'set', responseStrength, programmingLayer)
}

function beatResponseStrength(
  mutation: LaserDmxShowDirectorPerformanceBeatMutation,
  beatPhase: number,
): number {
  const envelope = mutation.responseEnvelope
  if (!envelope) return beatPhase < 0.48 ? 1 : 0
  const holdUntil = clamp(finite(envelope.holdUntil, 0.18), 0, 1)
  const releaseUntil = clamp(Math.max(holdUntil, finite(envelope.releaseUntil, 0.82)), holdUntil, 1)
  return resolveSharedPerformanceEventEnvelope(beatPhase, {
    attack: 0,
    hold: holdUntil,
    release: Math.max(0, releaseUntil - holdUntil),
    curve: envelope.curve ?? 'easeOut',
  })
}

function selectVariation(
  variations: readonly LaserDmxShowDirectorPerformanceSceneVariation[] | undefined,
  scene: LaserDmxShowDirectorPerformanceScene,
  work: ResolverWork,
): LaserDmxShowDirectorPerformanceSceneVariation | null {
  if (!variations?.length || work.input.tuning.variation <= EPSILON) return null
  const bar = work.input.context.barWithinMacroSection
  const eligible = variations.filter(variation => {
    if (!conditionsPass(variation.conditions, work)) return false
    if (variation.everyBars != null && variation.everyBars > 0) {
      const offsets = variation.barOffsets?.length ? variation.barOffsets : [0]
      if (!offsets.some(offset => (bar - positiveInt(offset)) % positiveInt(variation.everyBars, 1) === 0)) return false
    }
    return true
  })
  if (!eligible.length) return null
  return selectSharedPerformanceWeightedVariation(eligible, [
    work.input.programSeed,
    scene.id,
    work.input.context.sectionIdentity,
    work.input.context.sectionOccurrence,
    work.input.context.performanceFourBarBlockIndex,
  ])
}

function applyCadence(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): { fourBarVariation: string | null; motifFamily: string | null; eightBarStage: number } {
  const context = work.input.context
  const cadence = resolveSharedPerformanceCadence(context)
  const signals = resolveSharedPerformanceSignals(context)
  const macroIdentity = context.resolvedMacroSection?.id ?? 'macro:none'
  const baseIdentity = `${context.sectionIdentity}|${macroIdentity}|${context.sectionOccurrence}`

  // Cadence precedence runs from broad musical structure to short-lived impacts.
  // Fine Track Map boundaries do not restart this clock when they belong to the
  // same macro role. Faster layers only mutate parameters inside the active motif.
  const entryBeats = beatsSinceMacroSectionStart(context)
  const exitBeats = beatsUntilMacroSectionEnd(context)
  const isEntry = context.barsSinceMacroSectionStart < 1
  const isExit = context.barsUntilMacroSectionEnd < 1
  if (isEntry) for (const mutation of scene.sectionEntryMutations ?? []) {
    if (mutation.durationBeats == null || entryBeats < mutation.durationBeats) applyMutation(mutation, work, `${baseIdentity}|entry`)
  }
  if (!isEntry && !isExit) for (const mutation of scene.sectionBodyMutations ?? []) applyMutation(mutation, work, `${baseIdentity}|body|${context.barWithinMacroSection}`)
  if (isExit) for (const mutation of scene.sectionExitMutations ?? []) {
    if (mutation.durationBeats == null || exitBeats < mutation.durationBeats) applyMutation(mutation, work, `${baseIdentity}|exit`)
  }

  for (const mutation of scene.sixteenBarEvolution ?? []) {
    const phraseLength = Math.max(1, positiveInt(mutation.phraseLengthBars, 16))
    const phraseIndex = Math.floor(context.barsSinceMacroSectionStart / phraseLength)
    const phase = positiveInt(mutation.phase, 0)
    if (phraseIndex % Math.max(1, phase + 1) === phase) {
      applyMutation(mutation, work, `${baseIdentity}|phrase|${phraseIndex}`)
    }
  }

  const eightBarStage = cadence.eightBarRecruitmentStage
  const beforeRecruitment = new Map(work.runtime.fixtures.filter(fixture => fixture.enabled).map(fixture => [fixture.id, fixture]))
  for (const mutation of [...(scene.eightBarRecruitment ?? [])].sort((a, b) => a.stage - b.stage || a.id.localeCompare(b.id))) {
    const active = mutation.cumulative === false ? mutation.stage === eightBarStage : mutation.stage <= eightBarStage
    if (active) applyMutation(mutation, work, `${baseIdentity}|eight|${eightBarStage}|${mutation.stage}`)
  }
  if ((scene.eightBarRecruitment?.length ?? 0) > 0) {
    work.runtime = {
      ...work.runtime,
      fixtures: work.runtime.fixtures.map(fixture => {
        if (!fixture.enabled || !beforeRecruitment.has(fixture.id)) return fixture
        const semanticKey = semanticFixtureKey(fixture)
        const direction = performanceDeterministicUnit(work.input.programSeed, macroIdentity, semanticKey, eightBarStage) >= 0.5 ? 1 : -1
        const stagePressure = Math.min(1, eightBarStage / 4)
        return {
          ...fixture,
          rotation: clamp(fixture.rotation + direction * (6 + 12 * stagePressure) * work.input.tuning.variation, -720, 720),
          beam: {
            ...fixture.beam,
            beamAngle: clamp(fixture.beam.beamAngle - direction * (4 + 10 * stagePressure), -360, 360),
            beamSpread: clamp(fixture.beam.beamSpread + 4 + 12 * stagePressure, 0, 180),
          },
          runtimeBeamTravel: fixture.runtimeBeamTravel
            ? { ...fixture.runtimeBeamTravel, direction: 'forward' as const }
            : fixture.runtimeBeamTravel,
        }
      }),
    }
  }

  const currentBar = cadence.barStage
  const progression = [...(scene.barProgression ?? [])].sort((a, b) => a.stageBar - b.stageBar || a.id.localeCompare(b.id))
  if (progression.length) {
    const latestNonCumulative = [...progression].reverse().find(mutation => mutation.cumulative === false && mutation.stageBar <= currentBar)
    if (latestNonCumulative) {
      // Replacement stages are complete authored snapshots. Disable the scene's
      // participating fixture domain first so earlier eight-bar recruitment
      // cannot leave stale outro beams behind.
      work.runtime = {
        ...work.runtime,
        fixtures: work.runtime.fixtures.map(fixture => addressMatchesFixture(fixture, scene.address, work)
          ? { ...fixture, enabled: false }
          : fixture),
      }
      applyMutation(latestNonCumulative, work, `${baseIdentity}|bar-progression|${currentBar}|${latestNonCumulative.stageBar}`)
    } else {
      for (const mutation of progression) {
        if (mutation.cumulative !== false && mutation.stageBar <= currentBar) {
          applyMutation(mutation, work, `${baseIdentity}|bar-progression|${currentBar}|${mutation.stageBar}`)
        }
      }
    }
  }

  let fourBarVariation: string | null = null
  let motifFamily: string | null = null
  const fourBarBlockWithinMacro = cadence.fourBarBlockIndex
  const fourBarMutations = scene.fourBarVariations ?? []
  for (let index = 0; index < fourBarMutations.length; index += 1) {
    const mutation = fourBarMutations[index]
    const offsets = mutation.blockOffsets?.length ? mutation.blockOffsets.map(offset => positiveInt(offset)) : null
    const active = offsets
      ? offsets.includes(fourBarBlockWithinMacro)
      : fourBarBlockWithinMacro % Math.max(1, fourBarMutations.length) === index
    if (active) {
      applyMutation(mutation, work, `${baseIdentity}|four|${fourBarBlockWithinMacro}`)
      fourBarVariation = mutation.id
      motifFamily = mutation.motifFamily ?? mutation.id
    }
  }

  for (const mutation of scene.barMutations ?? []) {
    const interval = Math.max(1, positiveInt(mutation.intervalBars, 1))
    const anchor = positiveInt(mutation.anchorBar, 0)
    if ((context.barWithinMacroSection - anchor) % interval === 0) applyMutation(mutation, work, `${baseIdentity}|bar|${context.barWithinMacroSection}`)
  }

  for (const mutation of scene.beatMutations ?? []) {
    const division = Math.max(0.25, finite(mutation.beatDivision, 1))
    const beatStep = Math.floor(context.absoluteBeat / division)
    const offsets = mutation.beatOffsets?.length ? mutation.beatOffsets.map(offset => positiveInt(offset)) : [0]
    const inferredCycle = Math.max(...offsets, 0) + 1
    const cycleLength = Math.max(1, positiveInt(mutation.beatCycleLength, inferredCycle))
    const responseStrength = beatResponseStrength(mutation, context.beatPhase)
    if (offsets.some(offset => beatStep % cycleLength === offset % cycleLength)) {
      applyMutation(mutation, work, `${baseIdentity}|beat|${beatStep}`, responseStrength, 'transient')
    }
  }
  if (signals.discrete.kick.active) for (const mutation of scene.kickMutations ?? []) if (signals.discrete.kick.strength >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|kick|${context.beatIndex}`, 1, 'transient')
  if (signals.discrete.snare.active) for (const mutation of scene.snareMutations ?? []) if (signals.discrete.snare.strength >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|snare|${context.beatIndex}`, 1, 'transient')
  if (signals.discrete.hat.active) for (const mutation of scene.hatMutations ?? []) if (signals.discrete.hat.strength >= finite(mutation.threshold, 0.35)) applyMutation(mutation, work, `${baseIdentity}|hat|${context.beatIndex}`, 1, 'transient')
  for (const mutation of scene.transientMutations ?? []) if (signals.discrete.transient.strength >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|transient|${context.beatIndex}`, 1, 'transient')

  return { fourBarVariation, motifFamily, eightBarStage }
}

function adjacentSectionContext(
  work: ResolverWork,
  direction: -1 | 1,
): LaserDmxShowDirectorPerformanceTimingContext | null {
  const currentMacro = work.input.context.resolvedMacroSection
  if (!currentMacro) return null
  const macroSections = work.input.context.macroSections
  const currentIndex = macroSections.findIndex(section => section.id === currentMacro.id)
  const targetIndex = currentIndex + direction
  const targetMacro = macroSections[targetIndex]
  if (currentIndex < 0 || !targetMacro) return null

  const secondsPerBar = work.input.context.bpm > 0
    ? 60 / work.input.context.bpm * Math.max(1, work.input.context.timeSignature)
    : 2
  const duration = Math.max(EPSILON, targetMacro.endSec - targetMacro.startSec)
  const audioTimeSec = direction < 0
    ? Math.max(targetMacro.startSec, targetMacro.endSec - Math.min(0.001, duration / 2))
    : Math.min(targetMacro.endSec, targetMacro.startSec + Math.min(0.001, duration / 2))
  const targetSection = work.input.context.sections.find(section => (
    targetMacro.sectionIds.includes(section.id)
    && audioTimeSec + EPSILON >= section.startSec
    && audioTimeSec < section.endSec - EPSILON
  )) ?? work.input.context.sections.find(section => targetMacro.sectionIds.includes(section.id)) ?? null
  const sectionDuration = targetSection ? Math.max(EPSILON, targetSection.endSec - targetSection.startSec) : duration
  const sectionElapsed = targetSection ? Math.max(0, audioTimeSec - targetSection.startSec) : 0
  const sectionRemaining = targetSection ? Math.max(0, targetSection.endSec - audioTimeSec) : 0
  const macroElapsed = Math.max(0, audioTimeSec - targetMacro.startSec)
  const macroRemaining = Math.max(0, targetMacro.endSec - audioTimeSec)
  const barsSinceMacroSectionStart = macroElapsed / Math.max(EPSILON, secondsPerBar)
  const absoluteBar = Math.max(0, work.input.context.absoluteBar + (audioTimeSec - work.input.context.audioTimeSec) / Math.max(EPSILON, secondsPerBar))
  const barIndex = Math.floor(absoluteBar + EPSILON)
  const absoluteBeat = absoluteBar * work.input.context.timeSignature
  const beatIndex = Math.floor(absoluteBeat + EPSILON)
  const macroSectionOccurrence = macroSections.slice(0, targetIndex + 1).filter(section => section.type === targetMacro.type).length
  const macroDropOccurrence = targetMacro.type === 'drop' ? macroSectionOccurrence : 0
  const performanceFourBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 4 + EPSILON)
  const performanceEightBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 8 + EPSILON)
  const performanceSixteenBarBlockIndex = Math.floor(barsSinceMacroSectionStart / 16 + EPSILON)

  return {
    ...work.input.context,
    audioTimeSec,
    absoluteBeat,
    beatIndex,
    beatPhase: Math.max(0, Math.min(0.999999, absoluteBeat - beatIndex)),
    beatWithinBar: ((beatIndex % work.input.context.timeSignature) + work.input.context.timeSignature) % work.input.context.timeSignature,
    downbeat: beatIndex % work.input.context.timeSignature === 0,
    absoluteBar,
    barIndex,
    absoluteTrackBarIndex: barIndex,
    resolvedSection: targetSection,
    resolvedMacroSection: targetMacro,
    sectionProgress: targetSection ? clamp01(sectionElapsed / sectionDuration) : clamp01(macroElapsed / duration),
    sectionConfidence: targetSection?.confidence ?? targetMacro.confidence,
    fineSectionOccurrence: targetSection
      ? work.input.context.sections.filter(section => section.type === targetSection.type && section.startSec <= targetSection.startSec + EPSILON).length
      : 0,
    sectionOccurrence: macroSectionOccurrence,
    dropOccurrence: macroDropOccurrence,
    macroSectionOccurrence,
    macroDropOccurrence,
    boundaryClassification: 'hardReset',
    barWithinSection: Math.max(0, Math.floor(sectionElapsed / Math.max(EPSILON, secondsPerBar))),
    barWithinMacroSection: Math.max(0, Math.floor(barsSinceMacroSectionStart + EPSILON)),
    barsSinceSectionStart: sectionElapsed / Math.max(EPSILON, secondsPerBar),
    barsUntilSectionEnd: sectionRemaining / Math.max(EPSILON, secondsPerBar),
    barsSinceMacroSectionStart,
    barsUntilMacroSectionEnd: macroRemaining / Math.max(EPSILON, secondsPerBar),
    fourBarBlockIndex: Math.floor(barIndex / 4),
    eightBarBlockIndex: Math.floor(barIndex / 8),
    sixteenBarBlockIndex: Math.floor(barIndex / 16),
    performanceFourBarBlockIndex,
    performanceEightBarBlockIndex,
    performanceSixteenBarBlockIndex,
    sceneLocalVariationIndex: performanceFourBarBlockIndex % 4,
    energy: targetMacro.intensity,
    runtimeIdentity: `${work.input.context.runtimeIdentity}|transition-neighbor:${targetMacro.id}:${direction}`,
    boundaries: {
      ...work.input.context.boundaries,
      beatBoundary: false,
      barBoundary: false,
      fourBarBoundary: false,
      eightBarBoundary: false,
      sixteenBarBoundary: false,
      performanceFourBarBoundary: false,
      performanceEightBarBoundary: false,
      performanceSixteenBarBoundary: false,
      sectionEntry: direction > 0,
      sectionExit: direction < 0,
      previousSectionId: direction > 0 ? work.input.context.resolvedSection?.id ?? null : null,
      currentSectionId: targetSection?.id ?? null,
      macroSectionEntry: direction > 0,
      macroSectionExit: direction < 0,
      previousMacroSectionId: direction > 0 ? currentMacro.id : macroSections[targetIndex - 1]?.id ?? null,
      currentMacroSectionId: targetMacro.id,
      boundaryClassification: 'hardReset',
      hardMusicalReset: true,
      microSectionContinuation: false,
      variationBoundary: false,
      timingDiscontinuity: false,
    },
  }
}

function resolveSceneStateWithoutTransitions(
  work: ResolverWork,
  context: LaserDmxShowDirectorPerformanceTimingContext,
): { state: LaserDmxShowDirectorState; global: LaserDmxShowDirectorGlobalOutputOverrides } | null {
  const neighbor: ResolverWork = {
    authored: work.authored,
    runtime: normalizeLaserDmxShowDirectorState(work.authored),
    input: { ...work.input, context },
    fixtureRoles: {},
    global: {},
    missingCapabilities: new Set(),
    missingFixtureKeys: new Set(),
    missingGroupKeys: new Set(),
    malformedMutationIds: new Set(),
    unsupportedFixtureActionIds: new Set(),
    suppressedAudioGeometryMappings: new Set(),
    deferredTransientLayers: [],
    programmedBlackout: null,
    visibleOutputRecovered: false,
  }
  const selected = selectScene(neighbor)
  if (!selected.scene) return null
  applyPayload(selected.scene, neighbor)
  const variation = selectVariation(selected.scene.variations, selected.scene, neighbor)
  if (variation) applyPayload(variation, neighbor)
  applyCadence(selected.scene, neighbor)
  neighbor.missingCapabilities.forEach(value => work.missingCapabilities.add(value))
  neighbor.missingFixtureKeys.forEach(value => work.missingFixtureKeys.add(value))
  neighbor.missingGroupKeys.forEach(value => work.missingGroupKeys.add(value))
  neighbor.unsupportedFixtureActionIds.forEach(value => work.unsupportedFixtureActionIds.add(value))
  neighbor.suppressedAudioGeometryMappings.forEach(value => work.suppressedAudioGeometryMappings.add(value))
  neighbor.malformedMutationIds.forEach(value => work.malformedMutationIds.add(value))
  return { state: neighbor.runtime, global: neighbor.global }
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  return [parseInt(match[1].slice(0, 2), 16), parseInt(match[1].slice(2, 4), 16), parseInt(match[1].slice(4, 6), 16)]
}

function interpolateColor(from: string, to: string, progress: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  if (!a || !b) return progress < 0.5 ? from : to
  return `#${a.map((channel, index) => Math.round(channel + (b[index] - channel) * progress).toString(16).padStart(2, '0')).join('')}`
}

function curveProgress(progress: number, curve: LaserDmxShowDirectorPerformanceTransitionCurve): number {
  const t = clamp01(progress)
  switch (curve) {
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    case 'step': return t >= 1 ? 1 : 0
    default: return t
  }
}

function transitionDurationSec(
  transition: LaserDmxShowDirectorPerformanceSceneTransition | undefined,
  work: ResolverWork,
): number {
  if (!transition) return 0
  const secondsPerBar = work.input.context.bpm > 0
    ? 60 / work.input.context.bpm * work.input.context.timeSignature
    : 2
  const requested = transition.durationMs != null
    ? Math.max(0, transition.durationMs / 1000)
    : Math.max(0, finite(transition.durationBars, 0) * secondsPerBar)
  return Math.min(16, requested * clamp(work.input.tuning.transitionScale, 0, 4))
}

function interpolateFixtures(
  from: LaserDmxShowDirectorState,
  to: LaserDmxShowDirectorState,
  progress: number,
): LaserDmxShowDirectorFixture[] {
  const fromById = new Map(from.fixtures.map(fixture => [fixture.id, fixture]))
  return to.fixtures.map(target => {
    const source = fromById.get(target.id)
    if (!source) return { ...target, enabled: target.enabled && progress > EPSILON, brightness: target.brightness * progress }
    const mix = (a: number, b: number) => a + (b - a) * progress
    const sourceTargets = source.beam.targets ?? []
    const targetTargets = target.beam.targets ?? []
    const targets = targetTargets.map((item, index) => {
      const start = sourceTargets[index] ?? sourceTargets[0] ?? item
      return { ...item, x: mix(start.x, item.x), y: mix(start.y, item.y) }
    })
    return {
      ...target,
      enabled: (source.enabled || target.enabled) && mix(source.enabled ? source.brightness : 0, target.enabled ? target.brightness : 0) > EPSILON,
      brightness: clamp01(mix(source.enabled ? source.brightness : 0, target.enabled ? target.brightness : 0)),
      color: interpolateColor(source.color, target.color, progress),
      rotation: mix(source.rotation, target.rotation),
      beam: {
        ...target.beam,
        beamAngle: mix(source.beam.beamAngle, target.beam.beamAngle),
        beamSpread: mix(source.beam.beamSpread, target.beam.beamSpread),
        focus: clamp01(mix(source.beam.focus, target.beam.focus)),
        targetX: mix(finite(source.beam.targetX, source.x), finite(target.beam.targetX, target.x)),
        targetY: mix(finite(source.beam.targetY, source.y), finite(target.beam.targetY, target.y)),
        targetZ: mix(finite(source.beam.targetZ, source.z), finite(target.beam.targetZ, target.z)),
        targets,
      },
    }
  })
}

function interpolateGlobalOverrides(
  from: LaserDmxShowDirectorGlobalOutputOverrides,
  to: LaserDmxShowDirectorGlobalOutputOverrides,
  progress: number,
): LaserDmxShowDirectorGlobalOutputOverrides {
  const keys: Array<Exclude<keyof LaserDmxShowDirectorGlobalOutputOverrides, 'blackout'>> = [
    'dimmer', 'haze', 'backgroundFade', 'beamPersistence', 'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
  ]
  const result: LaserDmxShowDirectorGlobalOutputOverrides = {}
  for (const key of keys) {
    const fallback = key === 'dimmer' ? 1 : key === 'globalBeamWidth' ? 1 : 0
    const a = finite(from[key], fallback)
    const b = finite(to[key], fallback)
    result[key] = a + (b - a) * progress
  }
  result.blackout = Boolean(from.blackout && to.blackout)
  return result
}

function applyTransitions(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): void {
  const section = work.input.context.resolvedMacroSection
  if (!section) return
  const entryDuration = transitionDurationSec(scene.transitionIn, work)
  const exitDuration = transitionDurationSec(scene.transitionOut, work)
  const elapsed = Math.max(0, work.input.context.audioTimeSec - section.startSec)
  const remaining = Math.max(0, section.endSec - work.input.context.audioTimeSec)
  if (entryDuration > EPSILON && elapsed < entryDuration) {
    const progress = curveProgress(elapsed / entryDuration, scene.transitionIn?.curve ?? 'linear')
    const previousContext = adjacentSectionContext(work, -1)
    const previous = previousContext ? resolveSceneStateWithoutTransitions(work, previousContext) : null
    work.runtime = { ...work.runtime, fixtures: interpolateFixtures(previous?.state ?? work.authored, work.runtime, progress) }
    work.global = interpolateGlobalOverrides(previous?.global ?? {}, work.global, progress)
    if (scene.transitionIn?.blackoutDuringTransition) work.global.blackout = progress < 0.5
  } else if (exitDuration > EPSILON && remaining < exitDuration) {
    const progress = curveProgress(1 - remaining / exitDuration, scene.transitionOut?.curve ?? 'linear')
    const nextContext = adjacentSectionContext(work, 1)
    const next = nextContext ? resolveSceneStateWithoutTransitions(work, nextContext) : null
    work.runtime = { ...work.runtime, fixtures: interpolateFixtures(work.runtime, next?.state ?? work.authored, progress) }
    work.global = interpolateGlobalOverrides(work.global, next?.global ?? {}, progress)
    if (scene.transitionOut?.blackoutDuringTransition) work.global.blackout = progress >= 0.5
  }
}

function maxBlackoutBeats(kind: LaserDmxShowDirectorProgrammedBlackoutKind, policy: LaserDmxShowDirectorPerformanceBlackoutPolicy): number {
  if (kind === 'preDrop') return policy.maxPreDropBeats
  if (kind === 'impactCut') return policy.maxImpactCutBeats
  return policy.maxFakeoutBeats
}

function resolveProgrammedBlackoutWindow(
  scene: LaserDmxShowDirectorPerformanceScene,
  work: ResolverWork,
): void {
  const context = work.input.context
  const policy = blackoutPolicy(work)
  const sinceStart = beatsSinceMacroSectionStart(context)
  const untilEnd = beatsUntilMacroSectionEnd(context)
  const ordered = [...(scene.blackoutWindows ?? [])].sort((a, b) => a.id.localeCompare(b.id))
  for (const window of ordered) {
    const offset = Math.max(0, finite(window.offsetBeats, 0))
    const duration = Math.min(Math.max(0, finite(window.durationBeats, 0)), maxBlackoutBeats(window.kind, policy))
    if (duration <= EPSILON) continue
    const active = window.anchor === 'sectionStart'
      ? sinceStart >= offset && sinceStart < offset + duration
      : untilEnd > offset - EPSILON && untilEnd <= offset + duration + EPSILON
    if (!active) continue
    work.global = { ...work.global, blackout: true, dimmer: 0 }
    work.programmedBlackout = {
      kind: window.kind,
      windowId: window.id,
      remainingBeats: window.anchor === 'sectionStart'
        ? Math.max(0, offset + duration - sinceStart)
        : Math.max(0, untilEnd - offset),
    }
    return
  }
}

function visibleBeamCount(fixtures: readonly LaserDmxShowDirectorFixture[]): number {
  return fixtures.reduce((sum, fixture) => {
    if (!fixture.enabled || fixture.brightness <= 0.04) return sum
    return sum + Math.max(1, Math.min(LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS, fixture.beam.targets?.length ?? 0))
  }, 0)
}

function ensureVisibleOutput(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): void {
  if (scene.allowZeroBeamOutput || visibleBeamCount(work.runtime.fixtures) > 0) return
  const policy = blackoutPolicy(work)
  const envelope = scene.energyEnvelopeKey ? work.input.program?.energyEnvelopes?.[scene.energyEnvelopeKey] : undefined
  const desiredGroups = Math.max(1, Math.min(4, Math.ceil(envelope?.activeFixtureGroups.min ?? 1)))
  const selectedGroupIds = new Set<string>()
  const selectedFixtureIds = new Set<string>()
  for (const fixture of [...work.authored.fixtures].sort((a, b) => semanticFixtureKey(a).localeCompare(semanticFixtureKey(b)))) {
    if (fixture.kind !== 'laser') continue
    const groupId = fixture.groupId || fixture.id
    if (!selectedGroupIds.has(groupId) && selectedGroupIds.size >= desiredGroups) continue
    selectedGroupIds.add(groupId)
    selectedFixtureIds.add(fixture.id)
  }
  work.runtime = {
    ...work.runtime,
    fixtures: work.runtime.fixtures.map(fixture => selectedFixtureIds.has(fixture.id)
      ? { ...fixture, enabled: true, brightness: Math.max(fixture.brightness, policy.minimumVisibleFixtureBrightness) }
      : fixture),
  }
  work.visibleOutputRecovered = visibleBeamCount(work.runtime.fixtures) > 0
}

function movementStrengthForFixture(fixture: LaserDmxShowDirectorFixture): number {
  const beats = fixture.runtimeBeamTravel?.beatsPerTravel
  if (beats == null) return Math.min(1, Math.abs(fixture.rotation) / 180)
  return clamp01(1 - (clamp(beats, 0.25, 16) - 0.25) / 15.75)
}

export function measureLaserDmxShowDirectorEnergyMetrics(
  state: LaserDmxShowDirectorState,
  global: LaserDmxShowDirectorGlobalOutputOverrides = {},
): LaserDmxShowDirectorResolvedEnergyMetrics {
  const active = state.fixtures.filter(fixture => fixture.enabled && fixture.brightness > 0.04)
  const groups = new Set(active.map(fixture => fixture.groupId).filter(Boolean))
  const average = (values: number[], fallback = 0) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback
  const estimatedBeamCount = visibleBeamCount(active)
  const fixtureGlow = average(active.map(fixture => finite(fixture.runtimeBeamAppearance?.glow, 0.6)), finite(global.globalGlow, 0.6))
  return {
    activeFixtureGroups: groups.size,
    estimatedBeamCount,
    brightness: average(active.map(fixture => fixture.brightness * finite(global.dimmer, 1))),
    fanSpread: average(active.map(fixture => fixture.beam.beamSpread)),
    movementStrength: average(active.map(movementStrengthForFixture)),
    glow: clamp01((fixtureGlow + finite(global.globalGlow, fixtureGlow)) / 2),
    density: clamp01(estimatedBeamCount / 300),
    negativeSpace: clamp01(1 - active.length / Math.max(1, state.fixtures.length)),
  }
}

function scaleAverageIntoRange(values: number[], min: number, max: number): number {
  if (!values.length) return 1
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  // Envelopes cap Music Intelligence overshoot but never inflate an authored
  // duck/fakeout. Minimum presence is supplied by scene authoring and the
  // zero-output recovery safeguard, preserving Patch 3's bank contrast.
  void min
  if (average > max) return max / average
  return 1
}

function applyEnergyEnvelope(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): LaserDmxShowDirectorSectionEnergyEnvelope | null {
  const key = scene.energyEnvelopeKey
  const envelope = key ? work.input.program?.energyEnvelopes?.[key] : undefined
  if (!envelope) return null
  const active = work.runtime.fixtures.filter(fixture => fixture.enabled)
  const brightnessScale = scaleAverageIntoRange(active.map(fixture => fixture.brightness), envelope.brightness.min, envelope.brightness.max)
  const spreadScale = scaleAverageIntoRange(active.map(fixture => fixture.beam.beamSpread), envelope.fanSpread.min, envelope.fanSpread.max)
  const glowScale = scaleAverageIntoRange(active.map(fixture => finite(fixture.runtimeBeamAppearance?.glow, finite(work.global.globalGlow, 0.6))), envelope.glow.min, envelope.glow.max)
  work.runtime = {
    ...work.runtime,
    fixtures: work.runtime.fixtures.map(fixture => {
      if (!fixture.enabled) return fixture
      const movement = movementStrengthForFixture(fixture)
      const targetMovement = clamp(movement, envelope.movementStrength.min, envelope.movementStrength.max)
      const beatsPerTravel = fixture.runtimeBeamTravel?.beatsPerTravel
      return {
        ...fixture,
        brightness: clamp01(fixture.brightness * brightnessScale),
        beam: { ...fixture.beam, beamSpread: clamp(fixture.beam.beamSpread * spreadScale, 0, 180) },
        runtimeBeamAppearance: fixture.runtimeBeamAppearance
          ? { ...fixture.runtimeBeamAppearance, glow: clamp01(finite(fixture.runtimeBeamAppearance.glow, 0.6) * glowScale) }
          : fixture.runtimeBeamAppearance,
        runtimeBeamTravel: beatsPerTravel == null
          ? fixture.runtimeBeamTravel
          : { ...fixture.runtimeBeamTravel, beatsPerTravel: clamp(0.25 + (1 - targetMovement) * 15.75, 0.25, 16) },
      }
    }),
  }
  if (work.global.globalGlow != null) work.global.globalGlow = clamp01(work.global.globalGlow * glowScale)
  return envelope
}

function buildDiagnostics(
  work: ResolverWork,
  budget: LaserDmxShowDirectorBeamBudgetReport,
  fallbackReason: string | null,
  suppressionReason: string | null,
): LaserDmxShowDirectorPerformanceCapabilityDiagnostics {
  const capabilities = work.input.context.intelligence.capabilities
  const coreTimingReady = capabilities.beatGrid || work.input.context.bpm > 0
  const sectionsReady = capabilities.sections || work.input.context.resolvedSection !== null
  const missingCapabilities = [...work.missingCapabilities].sort()
  const analysisReady = coreTimingReady && sectionsReady
  const analysisStatus: LaserDmxShowDirectorPerformanceAnalysisStatus = !coreTimingReady
    ? 'fallback'
    : (!sectionsReady || missingCapabilities.length > 0)
      ? 'partial'
      : 'ready'
  return {
    analysisReady,
    analysisStatus,
    missingCapabilities,
    missingFixtureKeys: [...work.missingFixtureKeys].sort(),
    missingGroupKeys: [...work.missingGroupKeys].sort(),
    malformedMutationIds: [...work.malformedMutationIds].sort(),
    unsupportedFixtureActionIds: [...work.unsupportedFixtureActionIds].sort(),
    suppressedAudioGeometryMappings: [...work.suppressedAudioGeometryMappings].sort(),
    fallbackReason,
    suppressionReason,
    beamBudgetWarning: budget.overBudget
      ? `Requested ${budget.estimatedDemand} beams; the deterministic allocator bounded output to ${budget.boundedDemand}.`
      : null,
    programmedBlackoutKind: work.programmedBlackout?.kind ?? null,
    programmedBlackoutWindowId: work.programmedBlackout?.windowId ?? null,
    programmedBlackoutRemainingBeats: work.programmedBlackout?.remainingBeats ?? 0,
    visibleOutputRecovered: work.visibleOutputRecovered,
  }
}

function unchangedResolution(
  input: ResolveLaserDmxShowDirectorPerformanceInput,
  authored: LaserDmxShowDirectorState,
  suppressionReason: string | null,
): LaserDmxShowDirectorPerformanceResolution {
  const budget = createLaserDmxShowDirectorBeamBudgetReport(authored.fixtures)
  return {
    showDirector: authored,
    activeSceneId: null,
    activeSceneLabel: null,
    activeVariation: null,
    activeMotifFamily: null,
    fourBarVariation: null,
    eightBarRecruitmentStage: Math.max(1, input.context.performanceEightBarBlockIndex + 1),
    currentSection: input.context.resolvedSection?.type ?? 'unknown',
    currentSectionOccurrence: input.context.sectionOccurrence,
    activeFixtureKeys: authored.fixtures.filter(fixture => fixture.enabled).map(semanticFixtureKey).sort(),
    activeGroupKeys: Array.from(new Set(authored.fixtures.filter(fixture => fixture.enabled && fixture.groupId).map(fixture => {
      const group = authored.groups.find(item => item.id === fixture.groupId)
      return group ? semanticGroupKey(group) : fixture.groupId as string
    }))).sort(),
    estimatedBeamDemand: budget.estimatedDemand,
    boundedBeamDemand: budget.boundedDemand,
    requestedGlobalOutputOverrides: {},
    energyEnvelopeKey: null,
    energyEnvelope: null,
    energyMetrics: measureLaserDmxShowDirectorEnergyMetrics(authored),
    fixturePriorityById: budget.priorityByFixtureId,
    fixturePriorityRoleById: Object.fromEntries(budget.fixtures.map(item => [item.fixtureId, item.role])),
    activePrimaryCueId: null,
    activeAccentCueIds: [],
    activeMacroId: null,
    activeMacroName: null,
    stablePatternFrame: null,
    programmingDiagnostics: null,
    diagnostics: {
      analysisReady: (input.context.intelligence.capabilities.beatGrid || input.context.bpm > 0)
        && (input.context.intelligence.capabilities.sections || input.context.resolvedSection !== null),
      analysisStatus: !(input.context.intelligence.capabilities.beatGrid || input.context.bpm > 0)
        ? 'fallback'
        : (!(input.context.intelligence.capabilities.sections || input.context.resolvedSection !== null) ? 'partial' : 'ready'),
      missingCapabilities: [],
      missingFixtureKeys: [],
      missingGroupKeys: [],
      malformedMutationIds: [],
      unsupportedFixtureActionIds: [],
      suppressedAudioGeometryMappings: [],
      fallbackReason: null,
      suppressionReason,
      beamBudgetWarning: budget.overBudget ? `Requested ${budget.estimatedDemand} beams; bounded to ${budget.boundedDemand}.` : null,
      programmedBlackoutKind: null,
      programmedBlackoutWindowId: null,
      programmedBlackoutRemainingBeats: 0,
      visibleOutputRecovered: false,
    },
    deterministicIdentity: [input.runtimeInvalidationId, input.context.runtimeIdentity, input.programSeed, 'authored'].join('|'),
  }
}

function isStructurallyValidProgram(program: LaserDmxShowDirectorPerformanceProgram): boolean {
  return program.scenes.every(scene => (
    Boolean(scene)
    && typeof scene.id === 'string'
    && scene.id.trim().length > 0
    && typeof scene.label === 'string'
    && Boolean(scene.section)
    && Array.isArray(scene.section.types)
  ))
}

export function resolveLaserDmxShowDirectorPerformance(
  input: ResolveLaserDmxShowDirectorPerformanceInput,
): LaserDmxShowDirectorPerformanceResolution {
  const authored = normalizedAuthoredRig(input.authoredShowDirector)
  if (!input.enabled) return unchangedResolution(input, authored, 'Performance program disabled.')
  if (!input.program || !Array.isArray(input.program.scenes) || input.program.scenes.length === 0) {
    return unchangedResolution(input, authored, 'No valid performance program is loaded.')
  }
  if (!isStructurallyValidProgram(input.program)) {
    return unchangedResolution(input, authored, 'Malformed performance program was suppressed safely.')
  }

  try {
    const work: ResolverWork = {
      authored,
      runtime: normalizeLaserDmxShowDirectorState(authored),
      input,
      fixtureRoles: {},
      global: {},
      missingCapabilities: new Set(),
      missingFixtureKeys: new Set(),
      missingGroupKeys: new Set(),
      malformedMutationIds: new Set(),
      unsupportedFixtureActionIds: new Set(),
      suppressedAudioGeometryMappings: new Set(),
      deferredTransientLayers: [],
      programmedBlackout: null,
      visibleOutputRecovered: false,
    }
    const selected = selectScene(work)
    if (!selected.scene) return unchangedResolution(input, authored, selected.fallbackReason ?? `No scene matched ${selected.sectionType}.`)

    applyPayload(selected.scene, work, 'set', 1, 'primary')
    const variation = selectVariation(selected.scene.variations, selected.scene, work)
    if (variation) applyPayload(variation, work)
    const cadence = applyCadence(selected.scene, work)
    applyTransitions(selected.scene, work)
    const programmingDocument = input.program.laserProgramming
      ?? createLegacyLaserProgrammingAdapter(input.program, authored)
    const programming = resolveLaserShowProgramming({
      document: programmingDocument,
      program: input.program,
      selectedScene: selected.scene,
      authoredRig: authored,
      runtimeRig: work.runtime,
      context: input.context,
      programSeed: input.programSeed,
    })
    work.runtime = programming.showDirector
    for (const layer of work.deferredTransientLayers) {
      applyPayload(layer.payload, work, layer.mode, layer.responseStrength, 'accent')
    }
    // Apply the authored energy ceiling after safe accent modulation. This
    // preserves the legacy choreography envelope while topology and direction
    // remain owned by the stable macro frame.
    const energyEnvelope = applyEnergyEnvelope(selected.scene, work)
    ensureVisibleOutput(selected.scene, work)
    resolveProgrammedBlackoutWindow(selected.scene, work)

    const budget = createLaserDmxShowDirectorBeamBudgetReport(work.runtime.fixtures, work.fixtureRoles)
    const energyMetrics = measureLaserDmxShowDirectorEnergyMetrics(work.runtime, work.global)
    const activeFixtures = work.runtime.fixtures.filter(fixture => fixture.enabled)
    const activeGroupKeys = Array.from(new Set(activeFixtures.map(fixture => {
      const group = work.runtime.groups.find(item => item.id === fixture.groupId)
      return group ? semanticGroupKey(group) : fixture.groupId
    }).filter((value): value is string => Boolean(value)))).sort()
    const deterministicIdentity = [
      input.runtimeInvalidationId,
      input.transportDiscontinuityIdentity ?? '',
      input.context.runtimeIdentity,
      input.program.id,
      input.programSeed,
      selected.scene.id,
      variation?.id ?? '',
      input.context.beatIndex,
      input.context.performanceFourBarBlockIndex,
      input.context.performanceEightBarBlockIndex,
    ].join('|')
    return {
      showDirector: work.runtime,
      activeSceneId: selected.scene.id,
      activeSceneLabel: selected.scene.label,
      activeVariation: variation?.id ?? null,
      activeMotifFamily: cadence.motifFamily,
      fourBarVariation: cadence.fourBarVariation,
      eightBarRecruitmentStage: cadence.eightBarStage,
      currentSection: selected.sectionType,
      currentSectionOccurrence: effectiveSectionOccurrence(selected.sectionType, input.context),
      activeFixtureKeys: activeFixtures.map(semanticFixtureKey).sort(),
      activeGroupKeys,
      estimatedBeamDemand: budget.estimatedDemand,
      boundedBeamDemand: budget.boundedDemand,
      requestedGlobalOutputOverrides: work.global,
      energyEnvelopeKey: selected.scene.energyEnvelopeKey ?? null,
      energyEnvelope,
      energyMetrics,
      fixturePriorityById: budget.priorityByFixtureId,
      fixturePriorityRoleById: Object.fromEntries(budget.fixtures.map(item => [item.fixtureId, item.role])),
      activePrimaryCueId: programming.cue?.id ?? null,
      activeAccentCueIds: programming.activeAccentCueIds,
      activeMacroId: programming.macro?.id ?? null,
      activeMacroName: programming.macro?.name ?? null,
      stablePatternFrame: programming.frame,
      programmingDiagnostics: programming.diagnostics,
      diagnostics: buildDiagnostics(work, budget, selected.fallbackReason, null),
      deterministicIdentity,
    }
  } catch {
    return unchangedResolution(input, authored, 'Malformed performance program was suppressed safely.')
  }
}
