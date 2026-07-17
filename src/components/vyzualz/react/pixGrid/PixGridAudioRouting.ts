import {
  resolveSharedPerformanceEventEnvelope,
  smoothSharedPerformanceModulation,
  type SharedPerformanceContext,
  type SharedPerformanceSmoothingState,
} from '../../../../features/performanceCore'
import {
  PIX_GRID_AUDIO_INTELLIGENCE_SOURCES,
  getPixGridAudioIntelligenceSource,
  isPixGridContinuousSourceDefinition,
  resolvePixGridAudioIntelligenceInventory,
} from './PixGridAudioIntelligenceRegistry'
import {
  PixGridAssignmentCompiler,
  evaluatePixGridCompiledConditions,
  evaluatePixGridReactionCurve,
  type PixGridAssignmentEvaluationContext,
  type PixGridCompiledAssignment,
} from './PixGridAssignmentCompiler'
import type {
  PixGridAudioFrame,
  PixGridContinuousAudioSource,
  PixGridDiscreteAudioSource,
  PixGridPhraseSegment,
  PixGridReactionAssignment,
  PixGridReactionSource,
} from './PixGridTypes'

const CONTINUOUS_SOURCES = new Set<PixGridReactionSource>(
  PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.filter(isPixGridContinuousSourceDefinition).map(definition => definition.id),
)

export function isPixGridContinuousReactionSource(source: PixGridReactionSource): source is PixGridContinuousAudioSource {
  return CONTINUOUS_SOURCES.has(source)
}

interface PixGridEventTriggerState {
  timeSec: number
  strength: number
}

interface PixGridAssignmentRuntimeState {
  triggerTimeSec: number | null
  triggerIdentity: string | null
  triggers: PixGridEventTriggerState[]
  gateActive: boolean
  quantizedValue: number
  quantizedInitialized: boolean
  smoothing: SharedPerformanceSmoothingState
  lastValue: number
}

export interface PixGridResolvedReactionValue {
  value: number
  active: boolean
  supported: boolean
  confidence: number
  usingFallback: boolean
  blockedByCondition: boolean
  blockedByConfidence: boolean
  compiled: PixGridCompiledAssignment
}

export interface PixGridAudioIntelligenceRuntimeDiagnostics {
  availableSources: readonly PixGridReactionSource[]
  unavailableSources: readonly PixGridReactionSource[]
  degradedSources: readonly PixGridReactionSource[]
  activeCompiledAssignments: readonly string[]
  disabledAssignments: readonly string[]
  assignmentsBlockedByConditions: readonly string[]
  assignmentsBlockedByConfidence: readonly string[]
  assignmentsUsingFallback: readonly string[]
  continuousSourceValues: Readonly<Partial<Record<PixGridContinuousAudioSource, number>>>
  recentDiscreteTriggers: readonly PixGridDiscreteAudioSource[]
  activeEnvelopes: readonly string[]
  compilationWarnings: readonly string[]
  compilerGeneration: number
  cachedAssignmentCount: number
}

interface MutableRuntimeDiagnostics {
  availableSources: PixGridReactionSource[]
  unavailableSources: PixGridReactionSource[]
  degradedSources: PixGridReactionSource[]
  activeCompiledAssignments: string[]
  disabledAssignments: string[]
  assignmentsBlockedByConditions: string[]
  assignmentsBlockedByConfidence: string[]
  assignmentsUsingFallback: string[]
  continuousSourceValues: Partial<Record<PixGridContinuousAudioSource, number>>
  recentDiscreteTriggers: PixGridDiscreteAudioSource[]
  activeEnvelopes: string[]
  compilationWarnings: string[]
}

function emptyDiagnostics(): MutableRuntimeDiagnostics {
  return {
    availableSources: [], unavailableSources: [], degradedSources: [], activeCompiledAssignments: [], disabledAssignments: [],
    assignmentsBlockedByConditions: [], assignmentsBlockedByConfidence: [], assignmentsUsingFallback: [],
    continuousSourceValues: {}, recentDiscreteTriggers: [], activeEnvelopes: [], compilationWarnings: [],
  }
}

function pushUnique<T>(target: T[], value: T): void {
  if (!target.includes(value)) target.push(value)
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function phraseSegment(progress: number): PixGridPhraseSegment {
  const value = clamp(progress)
  if (value < 0.08) return 'entry'
  if (value < 0.32) return 'early'
  if (value < 0.68) return 'middle'
  if (value < 0.92) return 'late'
  return 'exit'
}

function eventIdentity(context: SharedPerformanceContext, source: PixGridDiscreteAudioSource): string {
  switch (source) {
    case 'sectionEntry':
    case 'sectionExit':
    case 'dropOccurrenceChange':
      return `${source}:${context.sectionIdentity}:${context.sectionOccurrence}:${context.dropOccurrence}`
    case 'semanticMoment': {
      const moment = context.upcomingSemanticMoments[0]
      return `${source}:${moment?.id ?? moment?.type ?? 'none'}:${moment?.timeSec ?? context.audioTimeSec}`
    }
    case 'phraseEntry': return `${source}:${context.phraseIndex}`
    case 'barEntry': return `${source}:${context.absoluteBar}`
    case 'fourBarBoundary': return `${source}:${context.performanceFourBarBlockIndex}`
    case 'eightBarBoundary': return `${source}:${context.performanceEightBarBlockIndex}`
    case 'sixteenBarBoundary': return `${source}:${context.performanceSixteenBarBlockIndex}`
    default: return `${source}:${context.beatIndex}`
  }
}

export function createPixGridAudioFrame(
  context: SharedPerformanceContext,
  options: { isPlaying: boolean; deltaTimeSec: number; autoPerformanceEnabled?: boolean },
): PixGridAudioFrame {
  const inventory = resolvePixGridAudioIntelligenceInventory(context)
  const triggerEnabled = options.isPlaying
  const sourceValues = { ...inventory.values }
  for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
    if (!isPixGridContinuousSourceDefinition(definition) && !triggerEnabled) sourceValues[definition.id] = 0
  }
  const eventIdentities: Partial<Record<PixGridDiscreteAudioSource, string>> = {}
  for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
    if (isPixGridContinuousSourceDefinition(definition)) continue
    const source = definition.id as PixGridDiscreteAudioSource
    eventIdentities[source] = eventIdentity(context, source)
  }
  return {
    audioTime: context.audioTimeSec,
    sub: sourceValues.sub,
    bass: sourceValues.bass,
    lowMid: sourceValues.lowMid,
    mid: sourceValues.mid,
    high: sourceValues.high,
    air: sourceValues.air,
    volume: sourceValues.volume,
    energy: sourceValues.energy,
    trackRelativeEnergy: sourceValues.trackRelativeEnergy,
    spectralFlux: sourceValues.spectralFlux,
    spectralBrightness: sourceValues.spectralBrightness,
    tension: sourceValues.tension,
    complexity: sourceValues.complexity,
    buildProgress: sourceValues.buildProgress,
    sectionProgress: sourceValues.sectionProgress,
    phraseProgress: sourceValues.phraseProgress,
    barProgress: sourceValues.barProgress,
    beatPhase: sourceValues.beatPhase,
    sectionRelativeEnergy: sourceValues.sectionRelativeEnergy,
    sectionConfidence: sourceValues.sectionConfidence,
    phraseConfidence: sourceValues.phraseConfidence,
    vocalEnergy: sourceValues.vocalEnergy,
    vocalActivity: sourceValues.vocalActivity,
    drumActivity: sourceValues.drumActivity,
    bassStemActivity: sourceValues.bassStemActivity,
    melodyActivity: sourceValues.melodyActivity,
    semanticMomentStrength: sourceValues.semanticMomentStrength,
    beatHit: sourceValues.beat > 0,
    downbeatHit: sourceValues.downbeat > 0,
    kickHit: sourceValues.kick > 0,
    snareHit: sourceValues.snare > 0,
    hatHit: sourceValues.hat > 0,
    transientHit: sourceValues.transient > 0,
    barEntry: sourceValues.barEntry > 0,
    fourBarBoundary: sourceValues.fourBarBoundary > 0,
    eightBarBoundary: sourceValues.eightBarBoundary > 0,
    sixteenBarBoundary: sourceValues.sixteenBarBoundary > 0,
    phraseEntry: sourceValues.phraseEntry > 0,
    sectionEntry: sourceValues.sectionEntry > 0,
    sectionExit: sourceValues.sectionExit > 0,
    dropImpactHit: sourceValues.dropImpact > 0,
    dropOccurrenceChange: sourceValues.dropOccurrenceChange > 0,
    semanticMomentHit: sourceValues.semanticMoment > 0,
    trackMapCueEvent: false,
    trackMapCueIdentity: null,
    beatIndex: context.beatIndex,
    barIndex: context.barIndex,
    phraseIndex: context.phraseIndex,
    sectionOccurrence: context.sectionOccurrence,
    dropOccurrence: context.dropOccurrence,
    sectionType: context.sectionType,
    sectionPhase: context.sectionPhase,
    phraseSegment: phraseSegment(context.phraseProgress),
    autoPerformanceEnabled: options.autoPerformanceEnabled === true,
    deltaTimeSec: Math.max(0, options.deltaTimeSec),
    timingDiscontinuity: context.boundaries.timingDiscontinuity,
    trackIdentity: context.trackIdentity,
    sourceValues,
    capabilities: inventory.capabilities,
    confidence: inventory.confidence,
    eventIdentities,
    isPlaying: options.isPlaying,
  }
}

export function createSilentPixGridAudioFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const sourceValues = {} as Record<PixGridReactionSource, number>
  const capabilities = {} as Record<PixGridReactionSource, boolean>
  const confidence = {} as Record<PixGridReactionSource, number>
  for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
    sourceValues[definition.id] = 0
    // Silent/manual frames are an explicit caller-authored capability surface.
    // Defaulting them to available preserves deterministic unit tests, editor
    // preview, and legacy callers that supply values without capability maps.
    capabilities[definition.id] = true
    confidence[definition.id] = 1
  }
  const base: PixGridAudioFrame = {
    audioTime: 0,
    sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
    energy: 0, trackRelativeEnergy: 0, spectralFlux: 0, spectralBrightness: 0, tension: 0, complexity: 0,
    buildProgress: 0, sectionProgress: 0, phraseProgress: 0, barProgress: 0, sectionRelativeEnergy: 0,
    sectionConfidence: 0, phraseConfidence: 0, vocalEnergy: 0, vocalActivity: 0, drumActivity: 0,
    bassStemActivity: 0, melodyActivity: 0, semanticMomentStrength: 0,
    beatHit: false, downbeatHit: false, kickHit: false, snareHit: false, hatHit: false, transientHit: false,
    barEntry: false, fourBarBoundary: false, eightBarBoundary: false, sixteenBarBoundary: false, phraseEntry: false,
    sectionEntry: false, sectionExit: false, dropImpactHit: false, dropOccurrenceChange: false, semanticMomentHit: false,
    trackMapCueEvent: false, trackMapCueIdentity: null,
    beatPhase: 0, beatIndex: 0, barIndex: 0, phraseIndex: 0, sectionOccurrence: 0, dropOccurrence: 0,
    sectionType: null, sectionPhase: 'none', phraseSegment: 'entry', autoPerformanceEnabled: false,
    deltaTimeSec: 1 / 60, timingDiscontinuity: false, trackIdentity: null,
    sourceValues, capabilities, confidence, eventIdentities: {}, isPlaying: false,
  }
  const merged = { ...base, ...overrides }
  merged.sourceValues = { ...sourceValues, ...overrides.sourceValues }
  for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
    const explicit = pixGridLegacyFrameValue(overrides, definition.id)
    if (explicit != null) merged.sourceValues[definition.id] = explicit
  }
  merged.capabilities = { ...capabilities, ...overrides.capabilities }
  merged.confidence = { ...confidence, ...overrides.confidence }
  return merged
}

function pixGridLegacyFrameValue(frame: Partial<PixGridAudioFrame>, source: PixGridReactionSource): number | null {
  switch (source) {
    case 'sub': return frame.sub ?? null
    case 'bass': return frame.bass ?? null
    case 'lowMid': return frame.lowMid ?? null
    case 'mid': return frame.mid ?? null
    case 'high': return frame.high ?? null
    case 'air': return frame.air ?? null
    case 'volume': return frame.volume ?? null
    case 'energy': return frame.energy ?? null
    case 'trackRelativeEnergy': return frame.trackRelativeEnergy ?? null
    case 'spectralFlux': return frame.spectralFlux ?? null
    case 'spectralBrightness': return frame.spectralBrightness ?? null
    case 'tension': return frame.tension ?? null
    case 'complexity': return frame.complexity ?? null
    case 'buildProgress': return frame.buildProgress ?? null
    case 'sectionProgress': return frame.sectionProgress ?? null
    case 'phraseProgress': return frame.phraseProgress ?? null
    case 'barProgress': return frame.barProgress ?? null
    case 'beatPhase': return frame.beatPhase ?? null
    case 'sectionRelativeEnergy': return frame.sectionRelativeEnergy ?? null
    case 'sectionConfidence': return frame.sectionConfidence ?? null
    case 'phraseConfidence': return frame.phraseConfidence ?? null
    case 'vocalEnergy': return frame.vocalEnergy ?? null
    case 'vocalActivity': return frame.vocalActivity ?? null
    case 'drumActivity': return frame.drumActivity ?? null
    case 'bassStemActivity': return frame.bassStemActivity ?? null
    case 'melodyActivity': return frame.melodyActivity ?? null
    case 'semanticMomentStrength': return frame.semanticMomentStrength ?? null
    case 'beat': return frame.beatHit == null ? null : frame.beatHit ? 1 : 0
    case 'downbeat': return frame.downbeatHit == null ? null : frame.downbeatHit ? 1 : 0
    case 'kick': return frame.kickHit == null ? null : frame.kickHit ? 1 : 0
    case 'snare': return frame.snareHit == null ? null : frame.snareHit ? 1 : 0
    case 'hat': return frame.hatHit == null ? null : frame.hatHit ? 1 : 0
    case 'transient': return frame.transientHit == null ? null : frame.transientHit ? 1 : 0
    case 'barEntry': return frame.barEntry == null ? null : frame.barEntry ? 1 : 0
    case 'fourBarBoundary': return frame.fourBarBoundary == null ? null : frame.fourBarBoundary ? 1 : 0
    case 'eightBarBoundary': return frame.eightBarBoundary == null ? null : frame.eightBarBoundary ? 1 : 0
    case 'sixteenBarBoundary': return frame.sixteenBarBoundary == null ? null : frame.sixteenBarBoundary ? 1 : 0
    case 'phraseEntry': return frame.phraseEntry == null ? null : frame.phraseEntry ? 1 : 0
    case 'sectionEntry': return frame.sectionEntry == null ? null : frame.sectionEntry ? 1 : 0
    case 'sectionExit': return frame.sectionExit == null ? null : frame.sectionExit ? 1 : 0
    case 'dropImpact': return frame.dropImpactHit == null ? null : frame.dropImpactHit ? 1 : 0
    case 'dropOccurrenceChange': return frame.dropOccurrenceChange == null ? null : frame.dropOccurrenceChange ? 1 : 0
    case 'semanticMoment': return frame.semanticMomentHit == null ? null : frame.semanticMomentHit ? 1 : 0
    case 'trackMapCueEvent': return frame.trackMapCueEvent == null ? null : frame.trackMapCueEvent ? 1 : 0
  }
}

export function pixGridReactionSourceValue(frame: PixGridAudioFrame, source: PixGridReactionSource): number {
  const direct = frame.sourceValues?.[source]
  if (direct != null) return Number.isFinite(direct) ? direct : 0
  return pixGridLegacyFrameValue(frame, source) ?? 0
}

function quantizationBoundary(frame: PixGridAudioFrame, assignment: PixGridCompiledAssignment): boolean {
  switch (assignment.quantization) {
    case 'beat': return frame.beatHit
    case 'bar': return frame.barEntry ?? false
    case 'fourBars': return frame.fourBarBoundary ?? false
    case 'eightBars': return frame.eightBarBoundary ?? false
    case 'sixteenBars': return frame.sixteenBarBoundary ?? false
    default: return true
  }
}

function triggerIdentity(frame: PixGridAudioFrame, source: PixGridDiscreteAudioSource): string {
  const explicit = frame.eventIdentities?.[source]
  if (explicit) return explicit
  if (source === 'trackMapCueEvent') return frame.trackMapCueIdentity ?? `${source}:${frame.audioTime.toFixed(4)}`
  if (source === 'sectionEntry' || source === 'sectionExit' || source === 'dropOccurrenceChange' || source === 'semanticMoment')
    return `${source}:${frame.sectionOccurrence ?? 0}:${frame.dropOccurrence ?? 0}:${frame.audioTime.toFixed(4)}`
  if (source === 'phraseEntry') return `${source}:${frame.phraseIndex ?? 0}`
  if (source === 'fourBarBoundary' || source === 'eightBarBoundary' || source === 'sixteenBarBoundary' || source === 'barEntry')
    return `${source}:${frame.barIndex ?? 0}`
  return `${source}:${frame.beatIndex ?? 0}`
}

function normalizeInput(raw: number, range: readonly [number, number]): number {
  const span = Math.max(0.000001, range[1] - range[0])
  return clamp((raw - range[0]) / span)
}

function mapOutput(value: number, compiled: PixGridCompiledAssignment): number {
  let normalized = evaluatePixGridReactionCurve(compiled.curve, value)
  if (compiled.polarity === 'negative') normalized = 1 - normalized
  else if (compiled.polarity === 'bipolar') normalized = normalized * 2 - 1
  const unit = compiled.polarity === 'bipolar' ? (normalized + 1) * 0.5 : normalized
  return compiled.outputRange[0] + clamp(unit) * (compiled.outputRange[1] - compiled.outputRange[0])
}

function fallbackValue(frame: PixGridAudioFrame, fallback: PixGridReactionAssignment['capabilityFallback']): number | null {
  switch (fallback) {
    case 'zero': return 0
    case 'energy': return frame.energy ?? frame.volume
    case 'beat': return frame.beatHit ? 1 : 0
    case 'midHighActivity': return Math.max(frame.mid, frame.high, frame.vocalActivity ?? 0)
    case 'transient': return frame.transientHit ? Math.max(0.5, frame.spectralFlux ?? 0) : (frame.spectralFlux ?? 0)
    default: return null
  }
}

export class PixGridReactionRuntime {
  private readonly states = new Map<string, PixGridAssignmentRuntimeState>()
  private readonly compiler = new PixGridAssignmentCompiler()
  private trackIdentity: string | null = null
  private lastAudioTime = 0
  private diagnostics = emptyDiagnostics()

  get compilationCount(): number { return this.compiler.compilationCount }
  get cachedAssignmentCount(): number { return this.compiler.cachedAssignmentCount }

  reset(): void {
    this.states.clear()
    this.compiler.clear()
    this.trackIdentity = null
    this.lastAudioTime = 0
    this.diagnostics = emptyDiagnostics()
  }

  beginFrame(frame: PixGridAudioFrame): void {
    this.diagnostics = emptyDiagnostics()
    for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
      const available = frame.capabilities?.[definition.id] !== false
      const confidence = clamp(frame.confidence?.[definition.id] ?? (available ? 1 : 0))
      if (available) this.diagnostics.availableSources.push(definition.id)
      else this.diagnostics.unavailableSources.push(definition.id)
      if (!available || confidence < 0.35) this.diagnostics.degradedSources.push(definition.id)
      const value = pixGridReactionSourceValue(frame, definition.id)
      if (isPixGridContinuousSourceDefinition(definition)) this.diagnostics.continuousSourceValues[definition.id] = value
      else if (value > 0) this.diagnostics.recentDiscreteTriggers.push(definition.id as PixGridDiscreteAudioSource)
    }
  }

  getDiagnostics(): PixGridAudioIntelligenceRuntimeDiagnostics {
    return {
      ...this.diagnostics,
      compilerGeneration: this.compiler.compilationCount,
      cachedAssignmentCount: this.compiler.cachedAssignmentCount,
    }
  }

  compile(
    assignment: PixGridReactionAssignment,
    frame: PixGridAudioFrame,
    defaultScope: PixGridCompiledAssignment['targetScope'] = 'group',
    routeId: string = assignment.id,
  ): PixGridCompiledAssignment {
    return this.compiler.compile(assignment, frame.capabilities, defaultScope, routeId)
  }

  resolve(
    assignment: PixGridReactionAssignment,
    frame: PixGridAudioFrame,
    preview = false,
    evaluationContext: PixGridAssignmentEvaluationContext = {},
    defaultScope: PixGridCompiledAssignment['targetScope'] = 'group',
    routeId: string = assignment.id,
  ): PixGridResolvedReactionValue {
    return this.resolveCompiled(this.compile(assignment, frame, defaultScope, routeId), frame, preview, evaluationContext)
  }

  resolveCompiled(
    compiled: PixGridCompiledAssignment,
    frame: PixGridAudioFrame,
    preview = false,
    evaluationContext: PixGridAssignmentEvaluationContext = {},
  ): PixGridResolvedReactionValue {
    const route = compiled.id
    for (const warning of compiled.warnings) pushUnique(this.diagnostics.compilationWarnings, `${route}: ${warning}`)
    if (!compiled.enabled) {
      pushUnique(this.diagnostics.disabledAssignments, route)
      return { value: 0, active: false, supported: compiled.compatible, confidence: 1, usingFallback: false, blockedByCondition: false, blockedByConfidence: false, compiled }
    }
    if (!evaluatePixGridCompiledConditions(compiled, frame, evaluationContext) && !preview) {
      pushUnique(this.diagnostics.assignmentsBlockedByConditions, route)
      return { value: 0, active: false, supported: true, confidence: 1, usingFallback: false, blockedByCondition: true, blockedByConfidence: false, compiled }
    }

    const trackChanged = this.trackIdentity !== null && this.trackIdentity !== frame.trackIdentity
    if (trackChanged) this.states.clear()
    if (frame.timingDiscontinuity || frame.audioTime + 0.001 < this.lastAudioTime) {
      for (const runtimeState of this.states.values()) {
        runtimeState.triggers = runtimeState.triggers.filter(trigger => trigger.timeSec <= frame.audioTime + 0.001)
        runtimeState.triggerTimeSec = runtimeState.triggers[runtimeState.triggers.length - 1]?.timeSec ?? null
        runtimeState.triggerIdentity = null
        runtimeState.smoothing.initialized = false
        runtimeState.quantizedInitialized = false
        runtimeState.lastValue = 0
      }
    }
    this.trackIdentity = frame.trackIdentity ?? null
    this.lastAudioTime = frame.audioTime
    let state = this.states.get(route)
    if (!state) {
      state = {
        triggerTimeSec: null, triggerIdentity: null, triggers: [], gateActive: false,
        quantizedValue: 0, quantizedInitialized: false, smoothing: { value: 0, initialized: false }, lastValue: 0,
      }
      this.states.set(route, state)
    }

    const sourceConfidence = clamp(frame.confidence?.[compiled.source.id] ?? 1)
    let supported = frame.capabilities?.[compiled.source.id] !== false
    let usingFallback = false
    let blockedByConfidence = sourceConfidence < compiled.minimumConfidence
    let raw = preview ? 1 : pixGridReactionSourceValue(frame, compiled.source.id)
    if ((!supported || blockedByConfidence) && !preview) {
      const fallback = fallbackValue(frame, compiled.capabilityFallback)
      if (fallback == null) {
        pushUnique(this.diagnostics.assignmentsBlockedByConfidence, route)
        return { value: 0, active: false, supported: false, confidence: sourceConfidence, usingFallback: false, blockedByCondition: false, blockedByConfidence: true, compiled }
      }
      raw = fallback
      supported = true
      usingFallback = true
      blockedByConfidence = false
      pushUnique(this.diagnostics.assignmentsUsingFallback, route)
    }

    const discrete = !isPixGridContinuousSourceDefinition(compiled.source)
    let normalized = normalizeInput(raw, compiled.inputRange)
    if (discrete) {
      const fired = normalized > 0
      const source = compiled.source.id as PixGridDiscreteAudioSource
      const nextIdentity = fired ? triggerIdentity(frame, source) : null
      const envelopeDuration = compiled.attack + compiled.hold + compiled.release
      const activeEnvelope = state.triggerTimeSec != null && frame.audioTime - state.triggerTimeSec <= envelopeDuration + 1e-4
      const mayRetrigger = compiled.retrigger === 'restart'
        || (compiled.retrigger === 'extend' && fired)
        || (compiled.retrigger === 'ignoreWhileActive' && !activeEnvelope)
      if (fired && nextIdentity !== state.triggerIdentity && mayRetrigger) {
        if (compiled.retrigger === 'restart') state.triggers = []
        state.triggers.push({ timeSec: frame.audioTime, strength: normalized })
        if (state.triggers.length > compiled.maximumStacking) state.triggers.splice(0, state.triggers.length - compiled.maximumStacking)
        state.triggerTimeSec = frame.audioTime
        state.triggerIdentity = nextIdentity
      }
      let envelopeValue = 0
      state.triggers = state.triggers.filter(trigger => {
        if (trigger.timeSec > frame.audioTime + 0.001) return true
        const elapsed = Math.max(0, frame.audioTime - trigger.timeSec)
        const value = resolveSharedPerformanceEventEnvelope(
          elapsed,
          { attack: compiled.attack, hold: compiled.hold, release: compiled.release, curve: compiled.decayCurve },
        ) * trigger.strength
        envelopeValue = compiled.blend === 'add' ? envelopeValue + value : Math.max(envelopeValue, value)
        return elapsed <= envelopeDuration + 1e-4
      })
      state.triggerTimeSec = state.triggers[state.triggers.length - 1]?.timeSec ?? null
      normalized = clamp(envelopeValue)
      if (state.triggers.length > 0) pushUnique(this.diagnostics.activeEnvelopes, route)
    } else {
      const hysteresis = compiled.hysteresis
      if (state.gateActive) state.gateActive = normalized >= Math.max(0, compiled.threshold - hysteresis)
      else state.gateActive = normalized > compiled.threshold
      const activeFloor = state.gateActive ? Math.max(0, compiled.threshold - hysteresis) : compiled.threshold
      normalized = !state.gateActive || activeFloor >= 1 ? 0 : clamp((normalized - activeFloor) / Math.max(0.0001, 1 - activeFloor))
      if (compiled.quantization !== 'none') {
        if (!state.quantizedInitialized || quantizationBoundary(frame, compiled)) {
          state.quantizedValue = normalized
          state.quantizedInitialized = true
        }
        normalized = state.quantizedValue
      }
      if (!frame.isPlaying && !preview) {
        return { value: state.lastValue, active: Math.abs(state.lastValue) > 1e-5, supported, confidence: sourceConfidence, usingFallback, blockedByCondition: false, blockedByConfidence: false, compiled }
      }
      normalized = smoothSharedPerformanceModulation(
        state.smoothing,
        normalized,
        frame.deltaTimeSec ?? 1 / 60,
        Math.max(0, compiled.attack + compiled.smoothing),
        Math.max(0, compiled.release + compiled.smoothing),
      )
    }

    const mapped = mapOutput(normalized, compiled)
    const value = clamp(mapped, Math.min(compiled.clamp[0], compiled.clamp[1]), Math.max(compiled.clamp[0], compiled.clamp[1]))
    state.lastValue = value
    if (Math.abs(value) > 1e-5) pushUnique(this.diagnostics.activeCompiledAssignments, route)
    return { value, active: Math.abs(value) > 1e-5, supported, confidence: sourceConfidence, usingFallback, blockedByCondition: false, blockedByConfidence: false, compiled }
  }
}

/**
 * Compatibility adapter for v1-v9 layer audioReactivity. It preserves the old
 * brightness/scale/beat visual response exactly and is intentionally evaluated
 * instead of, never in addition to, authored v10 assignments.
 */
export function resolveLegacyPixGridLayerAudioReactivity(
  frame: PixGridAudioFrame,
  source: PixGridReactionSource | undefined,
  amount: number | undefined,
): number {
  if (!source || amount == null) return 0
  return clamp(pixGridReactionSourceValue(frame, source)) * amount
}
