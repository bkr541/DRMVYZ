import {
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceSignals,
  smoothSharedPerformanceModulation,
  type SharedPerformanceContext,
  type SharedPerformanceSmoothingState,
} from '../../../../features/performanceCore'
import type {
  PixGridAudioFrame,
  PixGridContinuousAudioSource,
  PixGridDiscreteAudioSource,
  PixGridReactionAssignment,
  PixGridReactionSource,
} from './PixGridTypes'

const CONTINUOUS_SOURCES = new Set<PixGridReactionSource>([
  'sub', 'bass', 'lowMid', 'mid', 'high', 'air', 'volume', 'energy', 'trackRelativeEnergy',
  'spectralFlux', 'tension', 'complexity', 'buildProgress', 'sectionProgress', 'phraseProgress', 'vocalEnergy',
])

interface PixGridAssignmentRuntimeState {
  triggerTimeSec: number | null
  triggerIdentity: string | null
  quantizedValue: number
  quantizedInitialized: boolean
  smoothing: SharedPerformanceSmoothingState
  lastValue: number
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function continuousCapability(context: SharedPerformanceContext, source: PixGridContinuousAudioSource): boolean {
  switch (source) {
    case 'trackRelativeEnergy': return context.capabilities.trackEnergyCurve
    case 'sectionProgress': return context.capabilities.sections
    case 'phraseProgress': return context.capabilities.beatGrid
    case 'vocalEnergy': return context.capabilities.stemCurves || context.capabilities.lyrics
    case 'sub': case 'bass': case 'lowMid': case 'mid': case 'high': case 'air': case 'volume':
      return context.capabilities.liveBands
    default: return true
  }
}

function discreteCapability(context: SharedPerformanceContext, source: PixGridDiscreteAudioSource): boolean {
  switch (source) {
    case 'kick': case 'snare': case 'hat': case 'transient': return context.capabilities.rhythmEvents
    case 'sectionEntry': case 'sectionExit': return context.capabilities.sections
    case 'semanticMoment': return context.analysisCapabilities?.semanticMoments === true
    default: return context.capabilities.beatGrid || context.capabilities.rhythmEvents
  }
}

function continuousConfidence(context: SharedPerformanceContext, source: PixGridContinuousAudioSource): number {
  switch (source) {
    case 'sectionProgress': return context.confidence.section
    case 'phraseProgress': return context.confidence.phrase
    case 'trackRelativeEnergy': return context.capabilities.trackEnergyCurve ? context.confidence.overall : 0
    case 'vocalEnergy': return context.capabilities.stemCurves || context.capabilities.lyrics ? context.confidence.overall : 0
    case 'sub': case 'bass': case 'lowMid': case 'mid': case 'high': case 'air': case 'volume':
      return context.capabilities.liveBands ? context.confidence.overall : 0
    default: return context.confidence.overall
  }
}

function discreteConfidence(context: SharedPerformanceContext, source: PixGridDiscreteAudioSource): number {
  switch (source) {
    case 'kick': case 'snare': case 'hat': case 'transient': return context.intelligence.rhythm.transientConfidence
    case 'sectionEntry': case 'sectionExit': return context.confidence.section
    case 'semanticMoment': return context.confidence.semantics
    case 'downbeat': return context.confidence.downbeat
    case 'fourBarBoundary': case 'eightBarBoundary': case 'sixteenBarBoundary': case 'barEntry': return context.confidence.grid
    default: return context.confidence.rhythm
  }
}

export function createPixGridAudioFrame(
  context: SharedPerformanceContext,
  options: { isPlaying: boolean; deltaTimeSec: number },
): PixGridAudioFrame {
  const signals = resolveSharedPerformanceSignals(context)
  const continuous: Record<PixGridContinuousAudioSource, number> = {
    sub: context.intelligence.bands.raw.sub,
    bass: context.bass,
    lowMid: context.intelligence.bands.raw.lowMid,
    mid: context.mid,
    high: context.high,
    air: context.intelligence.bands.raw.air,
    volume: context.intelligence.bands.raw.volume,
    energy: signals.continuous.energy,
    trackRelativeEnergy: signals.continuous.trackRelativeEnergy,
    spectralFlux: signals.continuous.spectralFlux,
    tension: signals.continuous.tension,
    complexity: signals.continuous.complexity,
    buildProgress: signals.continuous.buildProgress,
    sectionProgress: signals.continuous.sectionProgress,
    phraseProgress: signals.continuous.phraseProgress,
    vocalEnergy: signals.continuous.vocalEnergy,
  }
  const triggerEnabled = options.isPlaying
  const discrete: Record<PixGridDiscreteAudioSource, boolean> = {
    beat: triggerEnabled && signals.discrete.beat.active,
    downbeat: triggerEnabled && signals.discrete.downbeat.active,
    kick: triggerEnabled && signals.discrete.kick.active,
    snare: triggerEnabled && signals.discrete.snare.active,
    hat: triggerEnabled && signals.discrete.hat.active,
    transient: triggerEnabled && signals.discrete.transient.active,
    barEntry: triggerEnabled && signals.discrete.barEntry.active,
    fourBarBoundary: triggerEnabled && signals.discrete.fourBarBoundary.active,
    eightBarBoundary: triggerEnabled && signals.discrete.eightBarBoundary.active,
    sixteenBarBoundary: triggerEnabled && signals.discrete.sixteenBarBoundary.active,
    sectionEntry: triggerEnabled && signals.discrete.sectionEntry.active,
    sectionExit: triggerEnabled && signals.discrete.sectionExit.active,
    dropImpact: triggerEnabled && signals.discrete.dropImpact.active,
    semanticMoment: triggerEnabled && signals.discrete.semanticMoment.active,
  }
  const capabilities: Partial<Record<PixGridReactionSource, boolean>> = {}
  const confidence: Partial<Record<PixGridReactionSource, number>> = {}
  for (const source of Object.keys(continuous) as PixGridContinuousAudioSource[]) {
    capabilities[source] = continuousCapability(context, source)
    confidence[source] = clamp(continuousConfidence(context, source))
  }
  for (const source of Object.keys(discrete) as PixGridDiscreteAudioSource[]) {
    capabilities[source] = discreteCapability(context, source)
    confidence[source] = clamp(discreteConfidence(context, source))
  }
  return {
    audioTime: context.audioTimeSec,
    ...continuous,
    beatHit: discrete.beat,
    downbeatHit: discrete.downbeat,
    kickHit: discrete.kick,
    snareHit: discrete.snare,
    hatHit: discrete.hat,
    transientHit: discrete.transient,
    barEntry: discrete.barEntry,
    fourBarBoundary: discrete.fourBarBoundary,
    eightBarBoundary: discrete.eightBarBoundary,
    sixteenBarBoundary: discrete.sixteenBarBoundary,
    sectionEntry: discrete.sectionEntry,
    sectionExit: discrete.sectionExit,
    dropImpactHit: discrete.dropImpact,
    semanticMomentHit: discrete.semanticMoment,
    beatPhase: context.beatPhase,
    beatIndex: context.beatIndex,
    barIndex: context.barIndex,
    sectionOccurrence: context.sectionOccurrence,
    deltaTimeSec: Math.max(0, options.deltaTimeSec),
    timingDiscontinuity: context.boundaries.timingDiscontinuity,
    trackIdentity: context.trackIdentity,
    capabilities,
    confidence,
    isPlaying: options.isPlaying,
  }
}

export function createSilentPixGridAudioFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return {
    audioTime: 0,
    sub: 0, bass: 0, lowMid: 0, mid: 0, high: 0, air: 0, volume: 0,
    energy: 0, trackRelativeEnergy: 0, spectralFlux: 0, tension: 0, complexity: 0,
    buildProgress: 0, sectionProgress: 0, phraseProgress: 0, vocalEnergy: 0,
    beatHit: false, downbeatHit: false, kickHit: false, snareHit: false, hatHit: false, transientHit: false,
    barEntry: false, fourBarBoundary: false, eightBarBoundary: false, sixteenBarBoundary: false,
    sectionEntry: false, sectionExit: false, dropImpactHit: false, semanticMomentHit: false,
    beatPhase: 0, beatIndex: 0, barIndex: 0, sectionOccurrence: 0,
    deltaTimeSec: 1 / 60, timingDiscontinuity: false, trackIdentity: null,
    capabilities: {}, confidence: {}, isPlaying: false,
    ...overrides,
  }
}

export function pixGridReactionSourceValue(frame: PixGridAudioFrame, source: PixGridReactionSource): number {
  switch (source) {
    case 'sub': return frame.sub ?? 0
    case 'bass': return frame.bass
    case 'lowMid': return frame.lowMid ?? 0
    case 'mid': return frame.mid
    case 'high': return frame.high
    case 'air': return frame.air ?? 0
    case 'volume': return frame.volume
    case 'energy': return frame.energy ?? frame.volume
    case 'trackRelativeEnergy': return frame.trackRelativeEnergy ?? frame.volume
    case 'spectralFlux': return frame.spectralFlux ?? 0
    case 'tension': return frame.tension ?? 0
    case 'complexity': return frame.complexity ?? 0
    case 'buildProgress': return frame.buildProgress ?? 0
    case 'sectionProgress': return frame.sectionProgress ?? 0
    case 'phraseProgress': return frame.phraseProgress ?? 0
    case 'vocalEnergy': return frame.vocalEnergy ?? 0
    case 'beat': return frame.beatHit ? 1 : 0
    case 'downbeat': return frame.downbeatHit ? 1 : 0
    case 'kick': return frame.kickHit ? 1 : 0
    case 'snare': return frame.snareHit ? 1 : 0
    case 'hat': return frame.hatHit ? 1 : 0
    case 'transient': return frame.transientHit ? 1 : 0
    case 'barEntry': return frame.barEntry ? 1 : 0
    case 'fourBarBoundary': return frame.fourBarBoundary ? 1 : 0
    case 'eightBarBoundary': return frame.eightBarBoundary ? 1 : 0
    case 'sixteenBarBoundary': return frame.sixteenBarBoundary ? 1 : 0
    case 'sectionEntry': return frame.sectionEntry ? 1 : 0
    case 'sectionExit': return frame.sectionExit ? 1 : 0
    case 'dropImpact': return frame.dropImpactHit ? 1 : 0
    case 'semanticMoment': return frame.semanticMomentHit ? 1 : 0
    default: return 0
  }
}

function quantizationBoundary(frame: PixGridAudioFrame, assignment: PixGridReactionAssignment): boolean {
  switch (assignment.quantization) {
    case 'beat': return frame.beatHit
    case 'bar': return frame.barEntry ?? false
    case 'fourBars': return frame.fourBarBoundary ?? false
    case 'eightBars': return frame.eightBarBoundary ?? false
    case 'sixteenBars': return frame.sixteenBarBoundary ?? false
    default: return true
  }
}

function triggerIdentity(frame: PixGridAudioFrame, source: PixGridReactionSource): string {
  if (source === 'sectionEntry' || source === 'sectionExit' || source === 'semanticMoment') return `${source}:${frame.sectionOccurrence ?? 0}:${frame.audioTime.toFixed(4)}`
  if (source === 'fourBarBoundary' || source === 'eightBarBoundary' || source === 'sixteenBarBoundary' || source === 'barEntry') return `${source}:${frame.barIndex ?? 0}`
  return `${source}:${frame.beatIndex ?? 0}`
}

export interface PixGridResolvedReactionValue {
  value: number
  active: boolean
  supported: boolean
  confidence: number
}

export class PixGridReactionRuntime {
  private readonly states = new Map<string, PixGridAssignmentRuntimeState>()
  private runtimeIdentity = ''

  reset(): void {
    this.states.clear()
    this.runtimeIdentity = ''
  }

  resolve(assignment: PixGridReactionAssignment, frame: PixGridAudioFrame, preview = false): PixGridResolvedReactionValue {
    const identity = `${frame.trackIdentity ?? 'none'}:${frame.timingDiscontinuity ? frame.audioTime.toFixed(3) : 'continuous'}`
    if (frame.timingDiscontinuity || (this.runtimeIdentity && frame.trackIdentity && !this.runtimeIdentity.startsWith(frame.trackIdentity))) this.states.clear()
    this.runtimeIdentity = identity
    let state = this.states.get(assignment.id)
    if (!state) {
      state = {
        triggerTimeSec: null,
        triggerIdentity: null,
        quantizedValue: 0,
        quantizedInitialized: false,
        smoothing: { value: 0, initialized: false },
        lastValue: 0,
      }
      this.states.set(assignment.id, state)
    }
    if (!assignment.enabled) return { value: 0, active: false, supported: true, confidence: 1 }
    const sourceConfidence = clamp(frame.confidence?.[assignment.source] ?? 1)
    let supported = frame.capabilities?.[assignment.source] !== false
    let raw = preview ? 1 : pixGridReactionSourceValue(frame, assignment.source)
    if ((!supported || sourceConfidence < assignment.minimumConfidence) && !preview) {
      if (assignment.capabilityFallback === 'energy') { raw = frame.energy ?? frame.volume; supported = true }
      else if (assignment.capabilityFallback === 'beat') { raw = frame.beatHit ? 1 : 0; supported = true }
      else if (assignment.capabilityFallback === 'zero') { raw = 0; supported = true }
      else return { value: 0, active: false, supported: false, confidence: sourceConfidence }
    }

    const discrete = !CONTINUOUS_SOURCES.has(assignment.source)
    if (discrete) {
      const fired = raw > 0
      const nextIdentity = fired ? triggerIdentity(frame, assignment.source) : null
      const envelopeDuration = assignment.attack + assignment.hold + assignment.release
      const activeEnvelope = state.triggerTimeSec != null && frame.audioTime - state.triggerTimeSec <= envelopeDuration + 1e-4
      const mayRetrigger = assignment.retrigger === 'restart'
        || (assignment.retrigger === 'extend' && fired)
        || (assignment.retrigger === 'ignoreWhileActive' && !activeEnvelope)
      if (fired && nextIdentity !== state.triggerIdentity && mayRetrigger) {
        state.triggerTimeSec = frame.audioTime
        state.triggerIdentity = nextIdentity
      }
      raw = state.triggerTimeSec == null ? 0 : resolveSharedPerformanceEventEnvelope(
        Math.max(0, frame.audioTime - state.triggerTimeSec),
        { attack: assignment.attack, hold: assignment.hold, release: assignment.release, curve: 'easeOut' },
      )
    } else {
      raw = clamp(raw)
      raw = assignment.threshold >= 1 ? 0 : clamp((raw - assignment.threshold) / Math.max(0.0001, 1 - assignment.threshold))
      if (assignment.quantization !== 'none') {
        if (!state.quantizedInitialized || quantizationBoundary(frame, assignment)) {
          state.quantizedValue = raw
          state.quantizedInitialized = true
        }
        raw = state.quantizedValue
      }
      if (!frame.isPlaying && !preview) return { value: state.lastValue, active: state.lastValue !== 0, supported, confidence: sourceConfidence }
      raw = smoothSharedPerformanceModulation(
        state.smoothing,
        raw,
        frame.deltaTimeSec ?? 1 / 60,
        Math.max(0, assignment.attack + assignment.smoothing),
        Math.max(0, assignment.release + assignment.smoothing),
      )
    }
    if (assignment.invert) raw = 1 - raw
    const [min, max] = assignment.clamp
    const value = clamp(raw, Math.min(min, max), Math.max(min, max))
    state.lastValue = value
    return { value, active: Math.abs(value) > 1e-5, supported, confidence: sourceConfidence }
  }
}
