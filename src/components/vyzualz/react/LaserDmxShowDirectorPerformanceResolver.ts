import {
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxBeamMotion,
  type LaserDmxMatrixBeamAppearance,
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
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceFallbackBehavior,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceMutationMode,
  LaserDmxShowDirectorPerformanceMutationPayload,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceProgramTuning,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSceneTransition,
  LaserDmxShowDirectorPerformanceSceneVariation,
  LaserDmxShowDirectorPerformanceSectionType,
  LaserDmxShowDirectorPerformanceTransitionCurve,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'

const EPSILON = 1e-6
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
  fallbackReason: string | null
  suppressionReason: string | null
  beamBudgetWarning: string | null
}

export interface LaserDmxShowDirectorPerformanceResolution {
  showDirector: LaserDmxShowDirectorState
  activeSceneId: string | null
  activeSceneLabel: string | null
  activeVariation: string | null
  fourBarVariation: string | null
  eightBarRecruitmentStage: number
  currentSection: LaserDmxShowDirectorPerformanceSectionType
  currentSectionOccurrence: number
  activeFixtureKeys: string[]
  activeGroupKeys: string[]
  estimatedBeamDemand: number
  boundedBeamDemand: number
  requestedGlobalOutputOverrides: LaserDmxShowDirectorGlobalOutputOverrides
  fixturePriorityById: Record<string, number>
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

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function deterministicUnit(...parts: Array<string | number | null | undefined>): number {
  return hashString(parts.map(part => part ?? '').join('|')) / 0xffffffff
}

function semanticFixtureKey(fixture: LaserDmxShowDirectorFixture): string {
  return fixture.semanticKey?.trim() || fixture.id
}

function semanticGroupKey(group: LaserDmxShowDirectorState['groups'][number]): string {
  return group.semanticKey?.trim() || group.id
}

function occurrenceMatches(value: number, match: LaserDmxShowDirectorPerformanceScene['section']['occurrence']): boolean {
  if (!match) return true
  if (match.occurrences?.length && !match.occurrences.includes(value)) return false
  if (match.minOccurrence != null && value < match.minOccurrence) return false
  if (match.maxOccurrence != null && value > match.maxOccurrence) return false
  if (match.every != null && match.every > 0 && value > 0 && (value - 1) % match.every !== 0) return false
  return true
}

function sceneBarMatches(scene: LaserDmxShowDirectorPerformanceScene, context: LaserDmxShowDirectorPerformanceTimingContext): boolean {
  const match = scene.barMatch
  if (!match) return true
  const bar = Math.max(0, context.barWithinSection)
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
  const direct = input.context.resolvedSection?.type ?? input.context.intelligence.section.type ?? 'unknown'
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
  const highestPriority = Math.max(...pool.map(scene => finite(scene.priority, 0)))
  const tied = pool.filter(scene => finite(scene.priority, 0) === highestPriority)
  const identity = [
    work.input.programSeed,
    program.id,
    work.input.context.sectionIdentity,
    effectiveSectionOccurrence(sectionType, work.input.context),
    effectiveDropOccurrence(sectionType, work.input.context),
    work.input.context.barWithinSection,
    Math.round(work.input.context.energy * 10),
  ].join('|')
  const scene = [...tied].sort((a, b) => {
    const scoreA = deterministicUnit(identity, a.id)
    const scoreB = deterministicUnit(identity, b.id)
    return scoreB - scoreA || a.id.localeCompare(b.id)
  })[0] ?? null
  return { scene, fallbackReason, sectionType }
}

function addressMatchesFixture(
  fixture: LaserDmxShowDirectorFixture,
  address: LaserDmxShowDirectorPerformanceAddress | undefined,
  work: ResolverWork,
): boolean {
  if (!address) return true
  const checks: boolean[] = []
  const fixtureKey = semanticFixtureKey(fixture)
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
    const group = work.runtime.groups.find(item => item.id === fixture.groupId)
    const groupKey = group ? semanticGroupKey(group) : ''
    const matched = address.groupSemanticKeys.includes(groupKey)
    checks.push(matched)
    if (!matched && !work.runtime.groups.some(item => address.groupSemanticKeys?.includes(semanticGroupKey(item)))) {
      address.groupSemanticKeys.forEach(key => work.missingGroupKeys.add(key))
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
    runtimeBeamAppearance: fixture.runtimeBeamAppearance ? { ...fixture.runtimeBeamAppearance } : undefined,
    runtimeBeamTravel: fixture.runtimeBeamTravel ? { ...fixture.runtimeBeamTravel } : undefined,
  }
  if (overrides.enabled != null) next.enabled = overrides.enabled
  if (overrides.brightness != null) next.brightness = clamp01(mixNumber(next.brightness, overrides.brightness * scalar, mode))
  if (overrides.color) next.color = overrides.color
  if (overrides.beamAngle != null) beam.beamAngle = clamp(mixNumber(beam.beamAngle, overrides.beamAngle * scalar, mode), -360, 360)
  if (overrides.fanSpread != null) beam.beamSpread = clamp(mixNumber(beam.beamSpread, overrides.fanSpread * scalar, mode), 0, 180)
  if (overrides.focus != null) beam.focus = clamp01(mixNumber(beam.focus, overrides.focus * scalar, mode))
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
  if (overrides.rotation != null) next.rotation = clamp(mixNumber(next.rotation, overrides.rotation * scalar, mode), -720, 720)
  if (overrides.mirrorAxis !== undefined) next.mirrorAxis = overrides.mirrorAxis
  if (overrides.trigger) next.trigger = { ...next.trigger, ...overrides.trigger }
  if (overrides.component) next.component = { ...component, ...overrides.component }
  if (overrides.beamAppearance) next.runtimeBeamAppearance = { ...next.runtimeBeamAppearance, ...overrides.beamAppearance }
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
    const patch: LaserDmxShowDirectorFixtureRuntimeOverrides = {}
    if (target === 'brightness') patch.brightness = value
    else if (target === 'rotation') patch.rotation = value
    else if (target === 'beamAngle') patch.beamAngle = value
    else if (target === 'fanSpread' || target === 'beamSpread') patch.fanSpread = value
    else if (target === 'focus') patch.focus = value
    else if (target === 'beamWidth') patch.beamAppearance = { width: value } as Partial<LaserDmxMatrixBeamAppearance>
    else if (target === 'travelSpeed') patch.beamTravel = { beatsPerTravel: Math.max(0.25, value) } as Partial<LaserDmxBeamMotion>
    else continue
    fixtures[index] = applyFixtureOverrides(fixture, patch, mode, work.input.tuning.audioIntelligenceResponse, work)
  }
}

function applyPayload(
  payload: LaserDmxShowDirectorPerformanceMutationPayload,
  work: ResolverWork,
  mode: LaserDmxShowDirectorPerformanceMutationMode = 'set',
): void {
  if (!conditionsPass(payload.conditions, work)) return
  const address = payload.address
  let fixtures = work.runtime.fixtures.map(fixture => addressMatchesFixture(fixture, address, work)
    ? payload.fixture
      ? applyFixtureOverrides(fixture, payload.fixture, mode, work.input.tuning.intensity, work)
      : fixture
    : fixture)

  if (payload.group) {
    const addressedGroupIds = new Set(work.runtime.groups
      .filter(group => !address?.groupSemanticKeys?.length || address.groupSemanticKeys.includes(semanticGroupKey(group)))
      .map(group => group.id))
    fixtures = fixtures.map(fixture => applyGroupOverrides(fixture, payload.group as LaserDmxShowDirectorGroupRuntimeOverrides, addressedGroupIds))
  }
  work.runtime = { ...work.runtime, fixtures }
  if (payload.global) work.global = mergeGlobal(work.global, payload.global, mode)
  for (const modulation of payload.modulations ?? []) applyModulation(modulation, work, work.runtime.fixtures)
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
  return deterministicUnit(work.input.programSeed, mutation.seedOffset ?? 0, identity, mutation.id) <= probability
}

function applyMutation(
  mutation: LaserDmxShowDirectorPerformanceMutationBase,
  work: ResolverWork,
  identity: string,
): void {
  if (!mutationActive(mutation, work, identity)) return
  applyPayload(mutation, work)
}

function selectVariation(
  variations: readonly LaserDmxShowDirectorPerformanceSceneVariation[] | undefined,
  scene: LaserDmxShowDirectorPerformanceScene,
  work: ResolverWork,
): LaserDmxShowDirectorPerformanceSceneVariation | null {
  if (!variations?.length || work.input.tuning.variation <= EPSILON) return null
  const bar = work.input.context.barWithinSection
  const eligible = variations.filter(variation => {
    if (!conditionsPass(variation.conditions, work)) return false
    if (variation.everyBars != null && variation.everyBars > 0) {
      const offsets = variation.barOffsets?.length ? variation.barOffsets : [0]
      if (!offsets.some(offset => (bar - positiveInt(offset)) % positiveInt(variation.everyBars, 1) === 0)) return false
    }
    return true
  })
  if (!eligible.length) return null
  const totalWeight = eligible.reduce((sum, variation) => sum + Math.max(EPSILON, finite(variation.weight, 1)), 0)
  let cursor = deterministicUnit(
    work.input.programSeed,
    scene.id,
    work.input.context.sectionIdentity,
    work.input.context.sectionOccurrence,
    work.input.context.fourBarBlockIndex,
  ) * totalWeight
  for (const variation of eligible) {
    cursor -= Math.max(EPSILON, finite(variation.weight, 1))
    if (cursor <= EPSILON) return variation
  }
  return eligible[eligible.length - 1]
}

function applyCadence(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): { fourBarVariation: string | null; eightBarStage: number } {
  const context = work.input.context
  const baseIdentity = `${context.sectionIdentity}|${context.sectionOccurrence}`

  // Cadence precedence runs from broad musical structure to short-lived impacts.
  // A faster layer can intentionally refine or replace a property from a slower layer.
  const isEntry = context.barsSinceSectionStart < 1
  const isExit = context.barsUntilSectionEnd < 1
  if (isEntry) for (const mutation of scene.sectionEntryMutations ?? []) applyMutation(mutation, work, `${baseIdentity}|entry`)
  if (!isEntry && !isExit) for (const mutation of scene.sectionBodyMutations ?? []) applyMutation(mutation, work, `${baseIdentity}|body|${context.barIndex}`)
  if (isExit) for (const mutation of scene.sectionExitMutations ?? []) applyMutation(mutation, work, `${baseIdentity}|exit`)

  for (const mutation of scene.sixteenBarEvolution ?? []) {
    const phraseLength = Math.max(1, positiveInt(mutation.phraseLengthBars, 16))
    const phase = positiveInt(mutation.phase, 0)
    if (Math.floor(context.barWithinSection / phraseLength) % Math.max(1, phase + 1) === phase) {
      applyMutation(mutation, work, `${baseIdentity}|phrase|${Math.floor(context.barWithinSection / phraseLength)}`)
    }
  }

  const eightBarStage = Math.max(1, Math.floor(context.barWithinSection / 8) + 1)
  const beforeRecruitment = new Map(work.runtime.fixtures.filter(fixture => fixture.enabled).map(fixture => [fixture.id, fixture]))
  for (const mutation of [...(scene.eightBarRecruitment ?? [])].sort((a, b) => a.stage - b.stage || a.id.localeCompare(b.id))) {
    const active = mutation.cumulative === false ? mutation.stage === eightBarStage : mutation.stage <= eightBarStage
    if (active) applyMutation(mutation, work, `${baseIdentity}|eight|${eightBarStage}|${mutation.stage}`)
  }
  if ((scene.eightBarRecruitment?.length ?? 0) > 0 && eightBarStage > 0) {
    work.runtime = {
      ...work.runtime,
      fixtures: work.runtime.fixtures.map(fixture => {
        if (!fixture.enabled || !beforeRecruitment.has(fixture.id)) return fixture
        const direction = deterministicUnit(work.input.programSeed, fixture.id, eightBarStage) >= 0.5 ? 1 : -1
        const targetX = finite(fixture.beam.targetX, fixture.x) + direction * Math.min(1.5, 0.25 * eightBarStage)
        return {
          ...fixture,
          rotation: clamp(fixture.rotation + direction * Math.min(28, 4 * eightBarStage) * work.input.tuning.variation, -720, 720),
          beam: {
            ...fixture.beam,
            beamAngle: clamp(fixture.beam.beamAngle - direction * Math.min(20, 3 * eightBarStage), -360, 360),
            beamSpread: clamp(fixture.beam.beamSpread + Math.min(36, 4 * eightBarStage), 0, 180),
            targetX,
          },
        }
      }),
    }
  }

  let fourBarVariation: string | null = null
  const fourBarBlockWithinSection = Math.floor(context.barWithinSection / 4)
  const fourBarMutations = scene.fourBarVariations ?? []
  for (let index = 0; index < fourBarMutations.length; index += 1) {
    const mutation = fourBarMutations[index]
    const offsets = mutation.blockOffsets?.length ? mutation.blockOffsets.map(offset => positiveInt(offset)) : null
    const active = offsets
      ? offsets.includes(fourBarBlockWithinSection)
      : fourBarBlockWithinSection % Math.max(1, fourBarMutations.length) === index
    if (active) {
      applyMutation(mutation, work, `${baseIdentity}|four|${fourBarBlockWithinSection}`)
      fourBarVariation = mutation.id
    }
  }

  for (const mutation of scene.barMutations ?? []) {
    const interval = Math.max(1, positiveInt(mutation.intervalBars, 1))
    const anchor = positiveInt(mutation.anchorBar, 0)
    if ((context.barWithinSection - anchor) % interval === 0) applyMutation(mutation, work, `${baseIdentity}|bar|${context.barIndex}`)
  }

  const beatGate = context.beatPhase < 0.48
  for (const mutation of scene.beatMutations ?? []) {
    const division = Math.max(0.25, finite(mutation.beatDivision, 1))
    const beatStep = Math.floor(context.absoluteBeat / division)
    const offsets = mutation.beatOffsets?.length ? mutation.beatOffsets.map(offset => positiveInt(offset)) : [0]
    const inferredCycle = Math.max(...offsets, 0) + 1
    const cycleLength = Math.max(1, positiveInt(mutation.beatCycleLength, inferredCycle))
    if (beatGate && offsets.some(offset => beatStep % cycleLength === offset % cycleLength)) {
      applyMutation(mutation, work, `${baseIdentity}|beat|${beatStep}`)
    }
  }
  if (context.kick) for (const mutation of scene.kickMutations ?? []) if (context.kickStrength >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|kick|${context.beatIndex}`)
  if (context.snare) for (const mutation of scene.snareMutations ?? []) if (context.snareStrength >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|snare|${context.beatIndex}`)
  for (const mutation of scene.transientMutations ?? []) if (context.transient >= finite(mutation.threshold, 0.45)) applyMutation(mutation, work, `${baseIdentity}|transient|${context.beatIndex}`)

  return { fourBarVariation, eightBarStage }
}

function adjacentSectionContext(
  work: ResolverWork,
  direction: -1 | 1,
): LaserDmxShowDirectorPerformanceTimingContext | null {
  const current = work.input.context.resolvedSection
  if (!current) return null
  const sections = work.input.context.sections
  const currentIndex = sections.findIndex(section => section.id === current.id)
  const targetIndex = currentIndex + direction
  const target = sections[targetIndex]
  if (currentIndex < 0 || !target) return null

  const secondsPerBar = work.input.context.bpm > 0
    ? 60 / work.input.context.bpm * Math.max(1, work.input.context.timeSignature)
    : 2
  const duration = Math.max(EPSILON, target.endSec - target.startSec)
  const audioTimeSec = direction < 0
    ? Math.max(target.startSec, target.endSec - Math.min(0.001, duration / 2))
    : Math.min(target.endSec, target.startSec + Math.min(0.001, duration / 2))
  const elapsed = Math.max(0, audioTimeSec - target.startSec)
  const remaining = Math.max(0, target.endSec - audioTimeSec)
  const barWithinSection = Math.max(0, Math.floor(elapsed / Math.max(EPSILON, secondsPerBar)))
  const sectionOccurrence = sections.slice(0, targetIndex + 1).filter(section => section.type === target.type).length
  const dropOccurrence = target.type === 'drop'
    ? sections.slice(0, targetIndex + 1).filter(section => section.type === 'drop').length
    : 0

  return {
    ...work.input.context,
    audioTimeSec,
    resolvedSection: target,
    sectionProgress: clamp01(elapsed / duration),
    sectionConfidence: target.confidence,
    sectionOccurrence,
    dropOccurrence,
    barWithinSection,
    barsSinceSectionStart: elapsed / Math.max(EPSILON, secondsPerBar),
    barsUntilSectionEnd: remaining / Math.max(EPSILON, secondsPerBar),
    fourBarBlockIndex: Math.floor(barWithinSection / 4),
    eightBarBlockIndex: Math.floor(barWithinSection / 8),
    sixteenBarBlockIndex: Math.floor(barWithinSection / 16),
    energy: target.intensity,
    runtimeIdentity: `${work.input.context.runtimeIdentity}|transition-neighbor:${target.id}:${direction}`,
    boundaries: {
      ...work.input.context.boundaries,
      beatBoundary: false,
      barBoundary: false,
      fourBarBoundary: false,
      eightBarBoundary: false,
      sixteenBarBoundary: false,
      sectionEntry: direction > 0,
      sectionExit: direction < 0,
      previousSectionId: direction > 0 ? current.id : sections[targetIndex - 1]?.id ?? null,
      currentSectionId: target.id,
      timingDiscontinuity: false,
    },
  }
}

function resolveSceneStateWithoutTransitions(
  work: ResolverWork,
  context: LaserDmxShowDirectorPerformanceTimingContext,
): LaserDmxShowDirectorState | null {
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
  neighbor.malformedMutationIds.forEach(value => work.malformedMutationIds.add(value))
  return neighbor.runtime
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
    if (!source) return progress >= 0.5 ? target : { ...target, enabled: false, brightness: 0 }
    const mix = (a: number, b: number) => a + (b - a) * progress
    const sourceTargets = source.beam.targets ?? []
    const targetTargets = target.beam.targets ?? []
    const targets = targetTargets.map((item, index) => {
      const start = sourceTargets[index] ?? sourceTargets[0] ?? item
      return { ...item, x: mix(start.x, item.x), y: mix(start.y, item.y) }
    })
    return {
      ...target,
      enabled: progress >= 0.5 ? target.enabled : source.enabled,
      brightness: clamp01(mix(source.brightness, target.brightness)),
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

function applyTransitions(scene: LaserDmxShowDirectorPerformanceScene, work: ResolverWork): void {
  const section = work.input.context.resolvedSection
  if (!section) return
  const entryDuration = transitionDurationSec(scene.transitionIn, work)
  const exitDuration = transitionDurationSec(scene.transitionOut, work)
  const elapsed = Math.max(0, work.input.context.audioTimeSec - section.startSec)
  const remaining = Math.max(0, section.endSec - work.input.context.audioTimeSec)
  if (entryDuration > EPSILON && elapsed < entryDuration) {
    const progress = curveProgress(elapsed / entryDuration, scene.transitionIn?.curve ?? 'linear')
    const previousContext = adjacentSectionContext(work, -1)
    const previousState = previousContext ? resolveSceneStateWithoutTransitions(work, previousContext) : null
    work.runtime = { ...work.runtime, fixtures: interpolateFixtures(previousState ?? work.authored, work.runtime, progress) }
    if (scene.transitionIn?.blackoutDuringTransition) work.global.blackout = progress < 0.5
  } else if (exitDuration > EPSILON && remaining < exitDuration) {
    const progress = curveProgress(1 - remaining / exitDuration, scene.transitionOut?.curve ?? 'linear')
    const nextContext = adjacentSectionContext(work, 1)
    const nextState = nextContext ? resolveSceneStateWithoutTransitions(work, nextContext) : null
    work.runtime = { ...work.runtime, fixtures: interpolateFixtures(work.runtime, nextState ?? work.authored, progress) }
    if (scene.transitionOut?.blackoutDuringTransition) work.global.blackout = progress >= 0.5
  }
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
    fallbackReason,
    suppressionReason,
    beamBudgetWarning: budget.overBudget
      ? `Requested ${budget.estimatedDemand} beams; the deterministic allocator bounded output to ${budget.boundedDemand}.`
      : null,
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
    fourBarVariation: null,
    eightBarRecruitmentStage: Math.max(1, Math.floor(input.context.barWithinSection / 8) + 1),
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
    fixturePriorityById: budget.priorityByFixtureId,
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
      fallbackReason: null,
      suppressionReason,
      beamBudgetWarning: budget.overBudget ? `Requested ${budget.estimatedDemand} beams; bounded to ${budget.boundedDemand}.` : null,
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
    }
    const selected = selectScene(work)
    if (!selected.scene) return unchangedResolution(input, authored, selected.fallbackReason ?? `No scene matched ${selected.sectionType}.`)

    applyPayload(selected.scene, work)
    const variation = selectVariation(selected.scene.variations, selected.scene, work)
    if (variation) applyPayload(variation, work)
    const cadence = applyCadence(selected.scene, work)
    applyTransitions(selected.scene, work)

    const budget = createLaserDmxShowDirectorBeamBudgetReport(work.runtime.fixtures, work.fixtureRoles)
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
      input.context.fourBarBlockIndex,
      input.context.eightBarBlockIndex,
    ].join('|')
    return {
      showDirector: work.runtime,
      activeSceneId: selected.scene.id,
      activeSceneLabel: selected.scene.label,
      activeVariation: variation?.id ?? null,
      fourBarVariation: cadence.fourBarVariation,
      eightBarRecruitmentStage: cadence.eightBarStage,
      currentSection: selected.sectionType,
      currentSectionOccurrence: effectiveSectionOccurrence(selected.sectionType, input.context),
      activeFixtureKeys: activeFixtures.map(semanticFixtureKey).sort(),
      activeGroupKeys,
      estimatedBeamDemand: budget.estimatedDemand,
      boundedBeamDemand: budget.boundedDemand,
      requestedGlobalOutputOverrides: work.global,
      fixturePriorityById: budget.priorityByFixtureId,
      diagnostics: buildDiagnostics(work, budget, selected.fallbackReason, null),
      deterministicIdentity,
    }
  } catch {
    return unchangedResolution(input, authored, 'Malformed performance program was suppressed safely.')
  }
}
