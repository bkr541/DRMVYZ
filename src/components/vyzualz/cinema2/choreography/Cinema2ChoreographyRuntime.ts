import type {
  Cinema2CapabilityId,
  Cinema2ChoreographyActionManifest,
  Cinema2ChoreographyConditionManifest,
  Cinema2ChoreographyContinuousSourcePath,
  Cinema2ChoreographyRuleManifest,
  Cinema2ChoreographySourceManifest,
  Cinema2JsonValue,
  Cinema2ParameterId,
  Cinema2VariationId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2AudioEvent, Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import {
  Cinema2FinalValueResolver,
  type Cinema2CompiledChoreographyTargetHandle,
  type Cinema2TargetContribution,
  type Cinema2TargetContributionSubmission,
  type Cinema2TargetHandle,
  type Cinema2TargetId,
  type Cinema2TargetOperation,
} from '../parameters/Cinema2TargetRuntime'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'

export interface Cinema2ChoreographyDiagnostic {
  code: string
  message: string
  path: string
}

export interface Cinema2ChoreographyRuntimeSnapshot {
  frameCount: number
  activeContributionCount: number
  activeEnvelopeCount: number
  activeDurationCount: number
  activeToggleCount: number
  pendingEventCount: number
  seenEventCount: number
  deduplicatedEventCount: number
  dispatchedActionCount: number
  resetCount: number
  activeVariationId: Cinema2VariationId | null
  diagnostics: readonly Readonly<Cinema2ChoreographyDiagnostic>[]
}

interface SourceSample {
  available: boolean
  value: number | null
  confidence: number | null
}

interface ChoreographyEvent {
  id: string
  strength: number
  confidence: number | null
}

interface ActiveEnvelope {
  rule: Readonly<Cinema2ChoreographyRuleManifest>
  action: Readonly<Cinema2ChoreographyActionManifest>
  target: Readonly<Cinema2TargetHandle>
  eventId: string
  eventStrength: number
  startSec: number
  attackSec: number
  holdSec: number
  releaseSec: number
  endSec: number
}

interface ActiveDuration {
  rule: Readonly<Cinema2ChoreographyRuleManifest>
  action: Readonly<Cinema2ChoreographyActionManifest>
  target: Readonly<Cinema2TargetHandle>
  eventId: string
  eventStrength: number
  endSec: number
}

interface ActiveToggle {
  rule: Readonly<Cinema2ChoreographyRuleManifest>
  action: Readonly<Cinema2ChoreographyActionManifest>
  target: Readonly<Cinema2TargetHandle>
  eventId: string
  value: boolean
}

interface PendingEventAction {
  rule: Readonly<Cinema2ChoreographyRuleManifest>
  action: Readonly<Cinema2ChoreographyActionManifest>
  target: Readonly<Cinema2TargetHandle>
  event: Readonly<ChoreographyEvent>
  dueBeat: number
}

interface ActiveVariation {
  id: Cinema2VariationId
  contributorId: string
  priority: number
  eventId: string
}

const MAX_SEEN_EVENTS = 4096
const EPSILON = 1e-6
const DROP_MOMENT_TYPES = new Set(['drop', 'drop_impact', 'major_impact', 'high_impact'])
const NUMERIC_CONTINUOUS_OPERATIONS = new Set(['map', 'set', 'replace', 'add', 'multiply'])
const EVENT_ONLY_OPERATIONS = new Set(['pulse', 'envelope', 'toggle', 'trigger', 'spawn', 'set-for-duration', 'variation-switch'])

/**
 * Engine-owned deterministic preset choreography. It consumes read-only Audio
 * Intelligence and Visual Director frames, owns only transient route state,
 * and publishes every writable value through Cinema2FinalValueResolver.
 */
export class Cinema2ChoreographyRuntime {
  private readonly choreographyTargets = new Map<string, Readonly<Cinema2CompiledChoreographyTargetHandle>>()
  private readonly parameterTargets = new Map<Cinema2ParameterId, Readonly<Cinema2TargetHandle>>()
  private readonly moduleTargets = new Map<string, Readonly<Cinema2TargetHandle>>()
  private readonly ruleSourceValues = new Map<string, number>()
  private readonly smoothedSourceValues = new Map<string, number>()
  private readonly lastActionBeat = new Map<string, number>()
  private readonly seenEventIds = new Set<string>()
  private readonly seenEventOrder: string[] = []
  private readonly envelopes = new Map<string, ActiveEnvelope>()
  private readonly durations = new Map<string, ActiveDuration>()
  private readonly toggles = new Map<string, ActiveToggle>()
  private readonly pending: PendingEventAction[] = []
  private readonly diagnosticKeys = new Set<string>()
  private diagnostics: Cinema2ChoreographyDiagnostic[] = []
  private previousAudioTimeSec: number | null = null
  private activeVariation: ActiveVariation | null = null
  private disposed = false
  private frameCount = 0
  private activeContributionCount = 0
  private deduplicatedEventCount = 0
  private dispatchedActionCount = 0
  private resetCount = 0

  constructor(
    private readonly plan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly parameterState: Cinema2ParameterState,
    private readonly resolver: Cinema2FinalValueResolver,
  ) {
    for (const target of plan.targets.choreographyTargets) this.choreographyTargets.set(target.actionId, target)
    for (const target of plan.targets.targets) {
      if (target.kind === 'parameter' && target.property === 'value') this.parameterTargets.set(target.ownerId as Cinema2ParameterId, target)
      if (target.kind === 'module') this.moduleTargets.set(`${target.ownerId}\u0000${target.property}`, target)
    }
  }

  update(frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    if (this.disposed) return
    const audio = frame.audio
    if (audio?.discontinuity.occurred && audio.discontinuity.reason !== 'activation') {
      this.resetTransientState('audio-discontinuity')
    }

    const submissions: Cinema2TargetContributionSubmission[] = []
    const rules = [...(this.plan.manifest.choreography?.rules ?? [])]
      .filter(rule => rule.enabled !== false)
      .sort((left, right) => finitePriority(right.priority) - finitePriority(left.priority) || compareStrings(left.id, right.id))

    this.processPending(frame)

    for (const rule of rules) {
      if (!this.routeEnabled(rule)) continue
      const source = this.sampleSource(rule, frame)
      if (isContinuousSignal(rule.source.signal)) {
        if (!source.available || source.value == null) continue
        if (!this.conditionsPass(rule, source, null, frame)) continue
        for (const action of rule.actions) {
          const target = this.choreographyTargets.get(action.id)?.target
          if (!target) continue
          if (EVENT_ONLY_OPERATIONS.has(action.operation)) {
            const event = this.edgeEvent(rule, source, audio)
            if (event) this.acceptEventAction(rule, action, target, event, frame)
          } else if (NUMERIC_CONTINUOUS_OPERATIONS.has(action.operation)) {
            const contribution = this.continuousContribution(rule, action, source.value, target)
            if (contribution) submissions.push({ targetId: target.id, contribution })
          }
        }
        continue
      }

      const events = this.eventsForRule(rule, frame, source)
      for (const event of events) {
        const dedupKey = `${rule.id}\u0000${event.id}`
        if (this.seenEventIds.has(dedupKey)) {
          this.deduplicatedEventCount += 1
          continue
        }
        this.rememberEvent(dedupKey)
        if (!this.conditionsPass(rule, source, event, frame)) continue
        for (const action of rule.actions) {
          const target = this.choreographyTargets.get(action.id)?.target
          if (!target) continue
          this.acceptEventAction(rule, action, target, event, frame)
        }
      }
    }

    this.emitActiveState(frame, submissions)
    this.emitActiveVariation(submissions)
    this.resolver.replaceTransientContributions(submissions)
    this.activeContributionCount = submissions.length
    this.previousAudioTimeSec = audio?.upstream.timeSec ?? this.previousAudioTimeSec
    this.frameCount += 1
  }

  reset(reason = 'manual-reset'): void {
    if (this.disposed) return
    this.resetTransientState(reason)
  }

  dispose(): void {
    if (this.disposed) return
    this.resetTransientState('dispose')
    this.disposed = true
  }

  getSnapshot(): Readonly<Cinema2ChoreographyRuntimeSnapshot> {
    return Object.freeze({
      frameCount: this.frameCount,
      activeContributionCount: this.activeContributionCount,
      activeEnvelopeCount: this.envelopes.size,
      activeDurationCount: this.durations.size,
      activeToggleCount: this.toggles.size,
      pendingEventCount: this.pending.length,
      seenEventCount: this.seenEventIds.size,
      deduplicatedEventCount: this.deduplicatedEventCount,
      dispatchedActionCount: this.dispatchedActionCount,
      resetCount: this.resetCount,
      activeVariationId: this.activeVariation?.id ?? null,
      diagnostics: Object.freeze(this.diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
    })
  }

  private resetTransientState(_reason: string): void {
    this.ruleSourceValues.clear()
    this.smoothedSourceValues.clear()
    this.lastActionBeat.clear()
    this.seenEventIds.clear()
    this.seenEventOrder.splice(0)
    this.envelopes.clear()
    this.durations.clear()
    this.toggles.clear()
    this.pending.splice(0)
    this.activeVariation = null
    this.previousAudioTimeSec = null
    this.activeContributionCount = 0
    this.resolver.clearTransientContributions()
    this.resetCount += 1
  }

  private routeEnabled(rule: Readonly<Cinema2ChoreographyRuleManifest>): boolean {
    if (!rule.enabledParameter) return true
    return this.parameterState.getValue(rule.enabledParameter.$ref) === true
  }

  private routeStrength(rule: Readonly<Cinema2ChoreographyRuleManifest>): number {
    if (!rule.strengthParameter) return 1
    const value = this.parameterState.getValue(rule.strengthParameter.$ref)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
  }

  private sampleSource(rule: Readonly<Cinema2ChoreographyRuleManifest>, frame: Readonly<Cinema2ModuleFrameReadContext>): SourceSample {
    const source = rule.source
    if (source.capability && !capabilityAvailable(source.capability, frame)) return unavailableSample()
    let sample: SourceSample
    if (source.signal === 'continuous') sample = sampleContinuousPath(source.path, frame)
    else if (source.signal === 'parameter') sample = sampleParameter(source, this.parameterState)
    else if (source.signal === 'build') sample = sampleSignal(frame.audio?.structure.buildConfidence)
    else if (source.signal === 'vocal-presence') sample = sampleSignal(frame.audio?.features.vocalPresence)
    else sample = eventSignalSample(source.signal, frame)

    if (!sample.available || sample.value == null) return sample
    let value = sample.value
    if (typeof source.scale === 'number' && Number.isFinite(source.scale)) value *= source.scale
    if (typeof source.offset === 'number' && Number.isFinite(source.offset)) value += source.offset
    if (source.clamp) value = Math.min(source.clamp[1], Math.max(source.clamp[0], value))
    if (source.smoothingMs && source.smoothingMs > 0) {
      const prior = this.smoothedSourceValues.get(rule.id)
      if (prior != null) {
        const alpha = 1 - Math.exp(-(Math.max(0, frame.deltaTimeSec) * 1000) / source.smoothingMs)
        value = prior + (value - prior) * alpha
      }
      this.smoothedSourceValues.set(rule.id, value)
    }
    return { ...sample, value }
  }

  private edgeEvent(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    source: SourceSample,
    audio: Readonly<Cinema2AudioIntelligenceFrame> | null,
  ): Readonly<ChoreographyEvent> | null {
    if (!source.available || source.value == null) return null
    const threshold = rule.source.threshold ?? 0.5
    const previous = this.ruleSourceValues.get(rule.id)
    this.ruleSourceValues.set(rule.id, source.value)
    if (previous == null || previous >= threshold || source.value < threshold) return null
    return Object.freeze({
      id: `cinema2-choreography:${rule.id}:edge:${audio?.discontinuity.generation ?? 0}:${audio?.upstream.frameId ?? this.frameCount}`,
      strength: clamp01(source.value),
      confidence: source.confidence,
    })
  }

  private eventsForRule(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    sourceSample?: SourceSample,
  ): readonly Readonly<ChoreographyEvent>[] {
    const audio = frame.audio
    if (!audio) return Object.freeze([])
    const signal = rule.source.signal
    if (signal === 'beat') return fromAudioEvent(audio.rhythm.beat)
    if (signal === 'downbeat') return fromAudioEvent(audio.rhythm.downbeat)
    if (signal === 'kick') return fromAudioEvent(audio.rhythm.kick)
    if (signal === 'snare') return fromAudioEvent(audio.rhythm.snare)
    if (signal === 'transient') return fromAudioEvent(audio.rhythm.transient)
    if (signal === 'bar') return fromAudioEvent(audio.rhythm.fixedClocks[4].boundary)
    if (signal === 'section-change') {
      const transition = frame.director?.context.transition
      return transition?.occurred && transition.kind === 'section-change' && transition.eventId
        ? Object.freeze([Object.freeze({ id: transition.eventId, strength: transition.authority, confidence: transition.confidence })])
        : Object.freeze([])
    }
    if (signal === 'phrase') {
      const crossed = crossedItems(audio.structure.analyzedPhrases, this.previousAudioTimeSec, audio.upstream.timeSec)
      if (crossed.length > 0) {
        return Object.freeze(crossed.map(item => Object.freeze({ id: item.id, strength: clamp01(item.confidence), confidence: item.confidence })))
      }
      return fromAudioEvent(audio.rhythm.fixedClocks[16].boundary)
    }
    if (signal === 'drop') {
      const crossed = crossedItems(audio.structure.semanticMoments, this.previousAudioTimeSec, audio.upstream.timeSec)
        .filter(item => DROP_MOMENT_TYPES.has(item.type))
      if (crossed.length > 0) {
        return Object.freeze(crossed.map(item => Object.freeze({ id: item.id, strength: clamp01(item.confidence), confidence: item.confidence })))
      }
      const transition = frame.director?.context.transition
      const section = frame.director?.context.section
      if (transition?.occurred && transition.eventId && section?.available && section.value?.type === 'drop') {
        return Object.freeze([Object.freeze({ id: transition.eventId, strength: transition.authority, confidence: transition.confidence })])
      }
      return Object.freeze([])
    }
    if (signal === 'lyric-line') {
      const lyrics = audio.lyrics
      if (!lyrics.available || !lyrics.value?.lineEnter || !lyrics.value.lineEventId) return Object.freeze([])
      return Object.freeze([Object.freeze({ id: lyrics.value.lineEventId, strength: 1, confidence: lyrics.confidence })])
    }
    if (signal === 'lyric-word') {
      const lyrics = audio.lyrics
      if (!lyrics.available || !lyrics.value?.wordHit || !lyrics.value.wordEventId) return Object.freeze([])
      return Object.freeze([Object.freeze({ id: lyrics.value.wordEventId, strength: 1, confidence: lyrics.confidence })])
    }
    if (signal === 'build' || signal === 'vocal-presence') {
      const sample = sourceSample ?? this.sampleSource(rule, frame)
      const edge = this.edgeEvent(rule, sample, audio)
      return edge ? Object.freeze([edge]) : Object.freeze([])
    }
    return Object.freeze([])
  }

  private conditionsPass(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    source: SourceSample,
    event: Readonly<ChoreographyEvent> | null,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): boolean {
    if (rule.source.threshold != null && source.available && source.value != null && source.value < rule.source.threshold) return false
    for (const condition of rule.conditions ?? []) {
      if (!conditionPasses(condition, source, event, frame)) return false
    }
    return true
  }

  private continuousContribution(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    action: Readonly<Cinema2ChoreographyActionManifest>,
    sourceValue: number,
    target: Readonly<Cinema2TargetHandle>,
  ): Readonly<Cinema2TargetContribution> | null {
    const operation = targetOperationForAction(action)
    if (operation === 'action') return null
    const strength = this.routeStrength(rule)
    const value = continuousActionValue(action, sourceValue, strength)
    return Object.freeze({
      contributorId: `choreography:${rule.id}:${action.id}`,
      operation,
      value,
      priority: finitePriority(rule.priority),
    })
  }

  private acceptEventAction(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    action: Readonly<Cinema2ChoreographyActionManifest>,
    target: Readonly<Cinema2TargetHandle>,
    event: Readonly<ChoreographyEvent>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    const beat = beatPosition(frame.audio)
    if (action.cooldownBeats && action.cooldownBeats > 0) {
      if (beat == null) {
        this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_TIMING_UNAVAILABLE', 'Beat timing is unavailable for an authored cooldown.', `action.${action.id}.cooldownBeats`)
        return
      }
      const prior = this.lastActionBeat.get(action.id)
      if (prior != null && beat - prior + EPSILON < action.cooldownBeats) return
    }

    const quantize = action.quantizeBeats ?? 0
    const delay = action.delayBeats ?? 0
    if (quantize > 0 || delay > 0) {
      if (beat == null) {
        this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_TIMING_UNAVAILABLE', 'Beat timing is unavailable for authored delay/quantization.', `action.${action.id}`)
        return
      }
      let dueBeat = beat
      if (quantize > 0) dueBeat = Math.ceil((beat - EPSILON) / quantize) * quantize
      dueBeat += delay
      if (dueBeat > beat + EPSILON) {
        if (!this.pending.some(item => item.action.id === action.id && item.event.id === event.id)) {
          this.pending.push({ rule, action, target, event, dueBeat })
          this.pending.sort((left, right) => left.dueBeat - right.dueBeat || compareStrings(left.action.id, right.action.id) || compareStrings(left.event.id, right.event.id))
        }
        return
      }
    }
    this.fireEventAction(rule, action, target, event, frame)
  }

  private processPending(frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    if (this.pending.length === 0) return
    const beat = beatPosition(frame.audio)
    if (beat == null) return
    let index = 0
    while (index < this.pending.length) {
      const item = this.pending[index]
      if (item.dueBeat > beat + EPSILON) {
        index += 1
        continue
      }
      this.pending.splice(index, 1)
      this.fireEventAction(item.rule, item.action, item.target, item.event, frame)
    }
  }

  private fireEventAction(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    action: Readonly<Cinema2ChoreographyActionManifest>,
    target: Readonly<Cinema2TargetHandle>,
    event: Readonly<ChoreographyEvent>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    const beat = beatPosition(frame.audio)
    if (action.cooldownBeats && action.cooldownBeats > 0 && beat != null) {
      const prior = this.lastActionBeat.get(action.id)
      if (prior != null && beat - prior + EPSILON < action.cooldownBeats) return
      this.lastActionBeat.set(action.id, beat)
    } else if (beat != null) {
      this.lastActionBeat.set(action.id, beat)
    }

    if (action.operation === 'trigger' || action.operation === 'spawn') {
      this.dispatchAction(rule, action, target, event)
      return
    }
    if (action.operation === 'variation-switch') {
      if (target.kind !== 'variation') {
        this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_VARIATION_TARGET_INVALID', 'variation-switch requires a variation action target.', `action.${action.id}.target`)
        return
      }
      this.activeVariation = {
        id: target.ownerId as Cinema2VariationId,
        contributorId: `choreography:${rule.id}:${action.id}`,
        priority: finitePriority(rule.priority),
        eventId: event.id,
      }
      this.dispatchAction(rule, action, target, event)
      return
    }
    if (action.operation === 'toggle') {
      const existing = this.toggles.get(action.id)
      let base = existing?.value
      if (base == null) {
        const resolved = this.resolver.resolve(target.id)
        base = typeof resolved.value === 'boolean' ? resolved.value : false
      }
      this.toggles.set(action.id, { rule, action, target, eventId: event.id, value: !base })
      return
    }
    if (action.operation === 'pulse' || action.operation === 'envelope') {
      this.startEnvelope(rule, action, target, event, frame)
      return
    }
    if (action.operation === 'set-for-duration') {
      const durationSec = durationSeconds(action, frame.audio)
      if (durationSec == null) {
        this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_TIMING_UNAVAILABLE', 'Duration could not be resolved because beat timing is unavailable.', `action.${action.id}`)
        return
      }
      this.durations.set(action.id, {
        rule, action, target, eventId: event.id, eventStrength: event.strength,
        endSec: frame.audio?.upstream.timeSec != null ? frame.audio.upstream.timeSec + durationSec : frame.elapsedTimeSec + durationSec,
      })
      return
    }

    // Value operations on event sources are intentionally one-frame pulses.
    const operation = targetOperationForAction(action)
    if (operation === 'action') return
    const strength = this.routeStrength(rule)
    const value = eventActionValue(action, event.strength, strength, operation)
    this.durations.set(`${action.id}:one-frame`, {
      rule, action, target, eventId: event.id, eventStrength: event.strength,
      endSec: currentTimeSec(frame) + Math.max(frame.deltaTimeSec, 1 / 240),
    })
    // Persist the exact one-frame value through a hidden action field in config is undesirable;
    // emitActiveState recomputes deterministically from action/event strength instead.
    void value
  }

  private startEnvelope(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    action: Readonly<Cinema2ChoreographyActionManifest>,
    target: Readonly<Cinema2TargetHandle>,
    event: Readonly<ChoreographyEvent>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    const existing = this.envelopes.get(action.id)
    const retrigger = action.retrigger ?? 'restart'
    if (existing && currentTimeSec(frame) < existing.endSec) {
      if (retrigger === 'ignore') return
      if (retrigger === 'extend') {
        const extension = envelopeDurations(action, frame.audio)
        if (!extension) {
          this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_TIMING_UNAVAILABLE', 'Envelope beat timing is unavailable.', `action.${action.id}.envelope`)
          return
        }
        existing.holdSec += extension.holdSec + extension.attackSec + extension.releaseSec
        existing.endSec += extension.holdSec + extension.attackSec + extension.releaseSec
        existing.eventStrength = Math.max(existing.eventStrength, event.strength)
        existing.eventId = event.id
        return
      }
    }
    const durations = envelopeDurations(action, frame.audio)
    if (!durations) {
      this.diagnosticOnce('CINEMA2_CHOREOGRAPHY_TIMING_UNAVAILABLE', 'Envelope beat timing is unavailable.', `action.${action.id}.envelope`)
      return
    }
    const startSec = currentTimeSec(frame)
    this.envelopes.set(action.id, {
      rule,
      action,
      target,
      eventId: event.id,
      eventStrength: event.strength,
      startSec,
      attackSec: durations.attackSec,
      holdSec: durations.holdSec,
      releaseSec: durations.releaseSec,
      endSec: startSec + durations.attackSec + durations.holdSec + durations.releaseSec,
    })
  }

  private dispatchAction(
    rule: Readonly<Cinema2ChoreographyRuleManifest>,
    action: Readonly<Cinema2ChoreographyActionManifest>,
    target: Readonly<Cinema2TargetHandle>,
    event: Readonly<ChoreographyEvent>,
  ): void {
    const result = this.resolver.dispatch(target.id, [Object.freeze({
      contributorId: `choreography:${rule.id}:${action.id}`,
      operation: 'action' as const,
      value: cloneJson(action.value),
      priority: finitePriority(rule.priority),
      eventId: `${event.id}:${action.id}`,
    })])
    if (result.ok) this.dispatchedActionCount += result.events.length
    else for (const diagnostic of result.diagnostics) this.diagnosticOnce(diagnostic.code, diagnostic.message, diagnostic.path)
  }

  private emitActiveState(frame: Readonly<Cinema2ModuleFrameReadContext>, submissions: Cinema2TargetContributionSubmission[]): void {
    const now = currentTimeSec(frame)
    for (const [actionId, envelope] of [...this.envelopes]) {
      if (now > envelope.endSec + EPSILON) {
        this.envelopes.delete(actionId)
        continue
      }
      const gain = envelopeGain(envelope, now)
      const operation = targetOperationForAction(envelope.action)
      if (operation === 'action') continue
      const strength = this.routeStrength(envelope.rule)
      submissions.push({
        targetId: envelope.target.id,
        contribution: Object.freeze({
          contributorId: `choreography:${envelope.rule.id}:${envelope.action.id}`,
          operation,
          value: envelopeActionValue(envelope.action, gain * envelope.eventStrength, strength, operation),
          priority: finitePriority(envelope.rule.priority),
          eventId: envelope.eventId,
        }),
      })
    }

    for (const [actionId, duration] of [...this.durations]) {
      if (now > duration.endSec + EPSILON) {
        this.durations.delete(actionId)
        continue
      }
      const operation = targetOperationForAction(duration.action)
      if (operation === 'action') continue
      submissions.push({
        targetId: duration.target.id,
        contribution: Object.freeze({
          contributorId: `choreography:${duration.rule.id}:${duration.action.id}`,
          operation,
          value: eventActionValue(duration.action, duration.eventStrength, this.routeStrength(duration.rule), operation),
          priority: finitePriority(duration.rule.priority),
          eventId: duration.eventId,
        }),
      })
    }

    for (const toggle of this.toggles.values()) {
      submissions.push({
        targetId: toggle.target.id,
        contribution: Object.freeze({
          contributorId: `choreography:${toggle.rule.id}:${toggle.action.id}`,
          operation: 'replace',
          value: toggle.value,
          priority: finitePriority(toggle.rule.priority),
          eventId: toggle.eventId,
        }),
      })
    }
  }

  private emitActiveVariation(submissions: Cinema2TargetContributionSubmission[]): void {
    const active = this.activeVariation
    if (!active) return
    const variation = this.plan.manifest.variations?.find(candidate => candidate.id === active.id)
    if (!variation) return
    for (const [parameterId, value] of Object.entries(variation.parameterValues ?? {})) {
      const target = this.parameterTargets.get(parameterId as Cinema2ParameterId)
      if (!target) continue
      submissions.push({
        targetId: target.id,
        contribution: Object.freeze({
          contributorId: `${active.contributorId}:variation:${active.id}`,
          operation: 'replace',
          value: cloneJson(value),
          priority: active.priority,
          eventId: active.eventId,
        }),
      })
    }
    for (const [moduleId, overrides] of Object.entries(variation.moduleOverrides ?? {})) {
      for (const [property, value] of Object.entries(overrides)) {
        const target = this.moduleTargets.get(`${moduleId}\u0000${property}`)
        if (!target) continue
        submissions.push({
          targetId: target.id,
          contribution: Object.freeze({
            contributorId: `${active.contributorId}:variation:${active.id}`,
            operation: 'replace',
            value: cloneJson(value),
            priority: active.priority,
            eventId: active.eventId,
          }),
        })
      }
    }
  }

  private rememberEvent(key: string): void {
    this.seenEventIds.add(key)
    this.seenEventOrder.push(key)
    while (this.seenEventOrder.length > MAX_SEEN_EVENTS) {
      const oldest = this.seenEventOrder.shift()
      if (oldest) this.seenEventIds.delete(oldest)
    }
  }

  private diagnosticOnce(code: string, message: string, path: string): void {
    const key = `${code}\u0000${path}`
    if (this.diagnosticKeys.has(key)) return
    this.diagnosticKeys.add(key)
    this.diagnostics.push({ code, message, path })
  }
}

function isContinuousSignal(signal: Cinema2ChoreographySourceManifest['signal']): boolean {
  return signal === 'continuous' || signal === 'parameter'
}

function sampleContinuousPath(path: Cinema2ChoreographyContinuousSourcePath | undefined, frame: Readonly<Cinema2ModuleFrameReadContext>): SourceSample {
  const audio = frame.audio
  const director = frame.director
  switch (path) {
    case 'audio.bands.sub': return sampleSignal(audio?.bands.sub)
    case 'audio.bands.bass': return sampleSignal(audio?.bands.bass)
    case 'audio.bands.lowMid': return sampleSignal(audio?.bands.lowMid)
    case 'audio.bands.mid': return sampleSignal(audio?.bands.mid)
    case 'audio.bands.high': return sampleSignal(audio?.bands.high)
    case 'audio.bands.air': return sampleSignal(audio?.bands.air)
    case 'audio.features.overallEnergy': return sampleSignal(audio?.features.overallEnergy)
    case 'audio.features.rms': return sampleSignal(audio?.features.rms)
    case 'audio.features.spectralCentroid': return sampleSignal(audio?.features.spectralCentroid)
    case 'audio.features.spectralFlux': return sampleSignal(audio?.features.spectralFlux)
    case 'audio.features.transientEnergy': return sampleSignal(audio?.features.transientEnergy)
    case 'audio.features.vocalPresence': return sampleSignal(audio?.features.vocalPresence)
    case 'audio.features.tension': return sampleSignal(audio?.features.tension)
    case 'audio.features.complexity': return sampleSignal(audio?.features.complexity)
    case 'audio.features.buildProgress': return sampleSignal(audio?.features.buildProgress)
    case 'audio.features.trackEnergy': return sampleSignal(audio?.features.trackEnergy)
    case 'audio.rhythm.bpm': return sampleSignal(audio?.rhythm.bpm)
    case 'audio.rhythm.beatPhase': return sampleSignal(audio?.rhythm.beatPhase)
    case 'audio.rhythm.beatIndex': return sampleSignal(audio?.rhythm.beatIndex)
    case 'audio.rhythm.beatInBar': return sampleSignal(audio?.rhythm.beatInBar)
    case 'audio.rhythm.barIndex': return sampleSignal(audio?.rhythm.barIndex)
    case 'audio.structure.buildConfidence': return sampleSignal(audio?.structure.buildConfidence)
    case 'audio.structure.dropConfidence': return sampleSignal(audio?.structure.dropConfidence)
    case 'audio.stems.vocals': return nestedSignal(audio?.stems, value => value.vocals)
    case 'audio.stems.drums': return nestedSignal(audio?.stems, value => value.drums)
    case 'audio.stems.bass': return nestedSignal(audio?.stems, value => value.bass)
    case 'audio.stems.instruments': return nestedSignal(audio?.stems, value => value.instruments)
    case 'audio.stems.other': return nestedSignal(audio?.stems, value => value.other)
    case 'audio.stems.vocalActivity': return nestedSignal(audio?.stems, value => value.vocalActivity)
    case 'audio.lyrics.vocalActivity': return nestedSignal(audio?.lyrics, value => value.vocalActivity)
    case 'audio.lyrics.phraseConfidence': return nestedSignal(audio?.lyrics, value => value.phraseConfidence)
    case 'audio.lyrics.lineProgress': return nestedSignal(audio?.lyrics, value => value.lineProgress)
    case 'audio.lyrics.wordProgress': return nestedSignal(audio?.lyrics, value => value.wordProgress)
    case 'director.intensity': return directorSignal(director?.continuous.intensity)
    case 'director.momentum': return directorSignal(director?.continuous.momentum)
    case 'director.build': return directorSignal(director?.context.build)
    case 'director.impact': return directorAuthority(director?.authority.impact)
    case 'director.variation': return directorAuthority(director?.authority.variation)
    case 'timing.elapsedTimeSec': return { available: true, value: Math.max(0, frame.elapsedTimeSec), confidence: 1 }
    case 'timing.beatPhase': return sampleSignal(audio?.rhythm.beatPhase)
    case 'timing.barPhase': {
      const beatInBar = sampleSignal(audio?.rhythm.beatInBar)
      const phase = sampleSignal(audio?.rhythm.beatPhase)
      return beatInBar.available && phase.available && beatInBar.value != null && phase.value != null
        ? { available: true, value: ((beatInBar.value % 4) + phase.value) / 4, confidence: minConfidence(beatInBar.confidence, phase.confidence) }
        : unavailableSample()
    }
    case 'timing.clock4': return clockSample(audio, 4)
    case 'timing.clock8': return clockSample(audio, 8)
    case 'timing.clock16': return clockSample(audio, 16)
    case 'timing.clock32': return clockSample(audio, 32)
    case 'runtime.frameId': return { available: true, value: frame.frameId, confidence: 1 }
    default: return unavailableSample()
  }
}

function sampleParameter(source: Readonly<Cinema2ChoreographySourceManifest>, state: Cinema2ParameterState): SourceSample {
  if (!source.parameter) return unavailableSample()
  const value = state.getValue(source.parameter.$ref)
  return typeof value === 'number' && Number.isFinite(value)
    ? { available: true, value, confidence: 1 }
    : unavailableSample()
}

function sampleSignal(signal: Readonly<Cinema2AudioSignal<number>> | null | undefined): SourceSample {
  if (!signal?.available || typeof signal.value !== 'number' || !Number.isFinite(signal.value)) return unavailableSample()
  return { available: true, value: signal.value, confidence: signal.confidence }
}

function nestedSignal<T>(signal: Readonly<Cinema2AudioSignal<Readonly<T>>> | null | undefined, read: (value: Readonly<T>) => number): SourceSample {
  if (!signal?.available || !signal.value) return unavailableSample()
  const value = read(signal.value)
  return Number.isFinite(value) ? { available: true, value, confidence: signal.confidence } : unavailableSample()
}

function directorSignal(signal: Readonly<{ available: boolean; value: number | null; confidence: number | null }> | null | undefined): SourceSample {
  return signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value)
    ? { available: true, value: signal.value, confidence: signal.confidence }
    : unavailableSample()
}

function directorAuthority(authority: Readonly<{ available: boolean; authority: number; confidence: number | null }> | null | undefined): SourceSample {
  return authority?.available && Number.isFinite(authority.authority)
    ? { available: true, value: authority.authority, confidence: authority.confidence }
    : unavailableSample()
}

function clockSample(audio: Readonly<Cinema2AudioIntelligenceFrame> | null, length: 4 | 8 | 16 | 32): SourceSample {
  if (!audio?.capabilities.beatGrid) return unavailableSample()
  return { available: true, value: audio.rhythm.fixedClocks[length].progress, confidence: audio.rhythm.bpm.confidence }
}

function eventSignalSample(signal: Cinema2ChoreographySourceManifest['signal'], frame: Readonly<Cinema2ModuleFrameReadContext>): SourceSample {
  const audio = frame.audio
  if (!audio) return unavailableSample()
  if (signal === 'beat') return eventSample(audio.rhythm.beat, audio.capabilities.beatGrid)
  if (signal === 'downbeat') return eventSample(audio.rhythm.downbeat, audio.capabilities.beatGrid)
  if (signal === 'kick') return eventSample(audio.rhythm.kick, audio.capabilities.rhythmEvents)
  if (signal === 'snare') return eventSample(audio.rhythm.snare, audio.capabilities.rhythmEvents)
  if (signal === 'transient') return eventSample(audio.rhythm.transient, audio.capabilities.rhythmEvents)
  if (signal === 'bar') return eventSample(audio.rhythm.fixedClocks[4].boundary, audio.capabilities.beatGrid)
  if (signal === 'phrase') return { available: audio.capabilities.analyzedPhrases || audio.capabilities.beatGrid, value: 1, confidence: audio.rhythm.bpm.confidence }
  if (signal === 'section-change') return directorAuthority(frame.director?.authority.variation)
  if (signal === 'drop') return sampleSignal(audio.structure.dropConfidence)
  if (signal === 'lyric-line' || signal === 'lyric-word') return { available: audio.capabilities.lyrics, value: 1, confidence: audio.lyrics.confidence }
  return unavailableSample()
}

function eventSample(event: Readonly<Cinema2AudioEvent> | null, capability: boolean): SourceSample {
  if (!capability) return unavailableSample()
  return { available: true, value: event?.strength ?? 0, confidence: event?.confidence ?? null }
}

function fromAudioEvent(event: Readonly<Cinema2AudioEvent> | null): readonly Readonly<ChoreographyEvent>[] {
  return event
    ? Object.freeze([Object.freeze({ id: event.id, strength: clamp01(event.strength), confidence: event.confidence })])
    : Object.freeze([])
}

function crossedItems<T extends { readonly id: string; readonly timeSec: number }>(
  signal: Readonly<Cinema2AudioSignal<readonly Readonly<T>[]>>,
  previousTimeSec: number | null,
  currentTimeSec: number,
): readonly Readonly<T>[] {
  if (!signal.available || !signal.value || previousTimeSec == null || currentTimeSec <= previousTimeSec) return Object.freeze([])
  return Object.freeze(signal.value.filter(item => item.timeSec > previousTimeSec && item.timeSec <= currentTimeSec + EPSILON))
}

function conditionPasses(
  condition: Readonly<Cinema2ChoreographyConditionManifest>,
  source: SourceSample,
  event: Readonly<ChoreographyEvent> | null,
  frame: Readonly<Cinema2ModuleFrameReadContext>,
): boolean {
  switch (condition.kind) {
    case 'source-threshold': {
      if (!source.available || source.value == null) return false
      if (condition.min != null && source.value < condition.min) return false
      if (condition.max != null && source.value > condition.max) return false
      return true
    }
    case 'source-range': return source.available && source.value != null && source.value >= condition.min && source.value <= condition.max
    case 'director-phase': return Boolean(frame.director?.phase.available && frame.director.phase.value && condition.phases.includes(frame.director.phase.value))
    case 'section-type': return Boolean(frame.director?.context.section.available && frame.director.context.section.value?.type && condition.values.includes(frame.director.context.section.value.type))
    case 'build': return Boolean(frame.director?.context.build.available && (frame.director.context.build.value ?? 0) >= condition.min)
    case 'drop': return Boolean(frame.audio?.structure.dropConfidence.available && (frame.audio.structure.dropConfidence.value ?? 0) >= condition.min)
    case 'capability': return capabilityAvailable(condition.capability, frame) === (condition.available ?? true)
    case 'confidence': {
      const confidence = event?.confidence ?? source.confidence
      return confidence != null && confidence >= condition.min
    }
    case 'once-per-event': return event != null
  }
}

function capabilityAvailable(capability: Cinema2CapabilityId, frame: Readonly<Cinema2ModuleFrameReadContext>): boolean {
  const audio = frame.audio
  switch (capability) {
    case 'render.webgl2': return true
    case 'audio.transport': return audio != null
    case 'audio.bands': return audio?.capabilities.bands === true
    case 'audio.features': return audio != null && (
      audio.features.overallEnergy.available || audio.features.rms.available || audio.features.spectralFlux.available
      || audio.features.tension.available || audio.features.buildProgress.available
    )
    case 'music.beat':
    case 'music.downbeat':
    case 'music.bar': return audio?.capabilities.beatGrid === true
    case 'music.rhythm-events': return audio?.capabilities.rhythmEvents === true
    case 'music.phrase': return audio?.capabilities.analyzedPhrases === true || audio?.capabilities.beatGrid === true
    case 'music.section': return audio?.capabilities.sections === true
    case 'music.vocal-presence': return audio?.features.vocalPresence.available === true
    case 'music.build': return audio?.structure.buildConfidence.available === true
    case 'music.drop': return audio?.structure.dropConfidence.available === true || audio?.capabilities.semanticMoments === true
    case 'music.lyrics': return audio?.capabilities.lyrics === true
    case 'visual-director.significance': return frame.director != null
    case 'media.image':
    case 'media.video':
    case 'media.svg': return true
    default: return false
  }
}

function targetOperationForAction(action: Readonly<Cinema2ChoreographyActionManifest>): Cinema2TargetOperation {
  if (action.operation === 'add') return 'add'
  if (action.operation === 'multiply') return 'multiply'
  if (action.operation === 'trigger' || action.operation === 'spawn' || action.operation === 'variation-switch') return 'action'
  if (action.operation === 'pulse' || action.operation === 'envelope' || action.operation === 'set-for-duration') return action.composition ?? 'replace'
  return 'replace'
}

function continuousActionValue(action: Readonly<Cinema2ChoreographyActionManifest>, source: number, routeStrength: number): Cinema2JsonValue {
  if (action.operation === 'map') return mapValue(source, action.map) * routeStrength
  if (action.operation === 'add') return scaleValue(action.value ?? 1, source * routeStrength, 0)
  if (action.operation === 'multiply') return interpolateFromNeutral(action.value ?? 1, source * routeStrength)
  if (action.value == null) return source * routeStrength
  return scaleValue(action.value, source * routeStrength, 0)
}

function eventActionValue(
  action: Readonly<Cinema2ChoreographyActionManifest>,
  eventStrength: number,
  routeStrength: number,
  operation: Cinema2TargetOperation,
): Cinema2JsonValue | undefined {
  if (action.operation === 'map') return mapValue(eventStrength, action.map) * routeStrength
  const weight = clamp01(eventStrength) * routeStrength
  if (operation === 'multiply') return interpolateFromNeutral(action.value ?? 1, weight)
  if (operation === 'add') return scaleValue(action.value ?? 1, weight, 0)
  if (action.value == null) return weight
  if (typeof action.value === 'number' || Array.isArray(action.value)) return scaleValue(action.value, weight, 0)
  return cloneJson(action.value)
}

function envelopeActionValue(
  action: Readonly<Cinema2ChoreographyActionManifest>,
  gain: number,
  routeStrength: number,
  operation: Cinema2TargetOperation,
): Cinema2JsonValue | undefined {
  const weight = clamp01(gain) * routeStrength
  if (operation === 'multiply') return interpolateFromNeutral(action.value ?? 1, weight)
  if (operation === 'add') return scaleValue(action.value ?? 1, weight, 0)
  if (action.value == null) return weight
  if (typeof action.value === 'number' || Array.isArray(action.value)) return scaleValue(action.value, weight, 0)
  return weight > 0 ? cloneJson(action.value) : undefined
}

function scaleValue(value: Cinema2JsonValue, factor: number, fallback: number): Cinema2JsonValue {
  if (typeof value === 'number') return value * factor
  if (Array.isArray(value) && value.every(component => typeof component === 'number')) return value.map(component => (component as number) * factor)
  return factor > 0 ? cloneJson(value) : fallback
}

function interpolateFromNeutral(value: Cinema2JsonValue, weight: number): Cinema2JsonValue {
  if (typeof value === 'number') return 1 + (value - 1) * weight
  if (Array.isArray(value) && value.every(component => typeof component === 'number')) return value.map(component => 1 + ((component as number) - 1) * weight)
  return cloneJson(value)
}

function mapValue(value: number, map: Readonly<Cinema2ChoreographyActionManifest['map']>): number {
  const inputMin = map?.inputMin ?? 0
  const inputMax = map?.inputMax ?? 1
  const outputMin = map?.outputMin ?? 0
  const outputMax = map?.outputMax ?? 1
  if (Math.abs(inputMax - inputMin) <= EPSILON) return outputMin
  let normalized = (value - inputMin) / (inputMax - inputMin)
  if (map?.clamp !== false) normalized = clamp01(normalized)
  return outputMin + (outputMax - outputMin) * normalized
}

function envelopeDurations(
  action: Readonly<Cinema2ChoreographyActionManifest>,
  audio: Readonly<Cinema2AudioIntelligenceFrame> | null,
): { attackSec: number; holdSec: number; releaseSec: number } | null {
  const envelope = action.envelope
  const unit = envelope?.unit ?? 'beats'
  const attack = envelope?.attack ?? 0
  const defaultHold = action.operation === 'pulse' ? (action.durationBeats ?? 0.125) : 0
  const hold = envelope?.hold ?? defaultHold
  const release = envelope?.release ?? (action.operation === 'pulse' ? 0.25 : 0)
  if (unit === 'seconds') return { attackSec: attack, holdSec: hold, releaseSec: release }
  const beatSec = beatDurationSec(audio)
  return beatSec == null ? null : { attackSec: attack * beatSec, holdSec: hold * beatSec, releaseSec: release * beatSec }
}

function durationSeconds(action: Readonly<Cinema2ChoreographyActionManifest>, audio: Readonly<Cinema2AudioIntelligenceFrame> | null): number | null {
  if (action.durationSeconds != null) return Math.max(0, action.durationSeconds)
  const beats = action.durationBeats ?? 1
  const beatSec = beatDurationSec(audio)
  return beatSec == null ? null : beats * beatSec
}

function envelopeGain(envelope: Readonly<ActiveEnvelope>, nowSec: number): number {
  const elapsed = Math.max(0, nowSec - envelope.startSec)
  if (envelope.attackSec > 0 && elapsed < envelope.attackSec) return clamp01(elapsed / envelope.attackSec)
  const afterAttack = elapsed - envelope.attackSec
  if (afterAttack <= envelope.holdSec) return 1
  const releaseElapsed = afterAttack - envelope.holdSec
  if (envelope.releaseSec <= 0) return 0
  return clamp01(1 - releaseElapsed / envelope.releaseSec)
}

function beatDurationSec(audio: Readonly<Cinema2AudioIntelligenceFrame> | null): number | null {
  const bpm = audio?.rhythm.bpm
  return bpm?.available && typeof bpm.value === 'number' && bpm.value > 0 ? 60 / bpm.value : null
}

function beatPosition(audio: Readonly<Cinema2AudioIntelligenceFrame> | null): number | null {
  const index = audio?.rhythm.beatIndex
  const phase = audio?.rhythm.beatPhase
  if (!index?.available || !phase?.available || typeof index.value !== 'number' || typeof phase.value !== 'number') return null
  return index.value + phase.value
}

function currentTimeSec(frame: Readonly<Cinema2ModuleFrameReadContext>): number {
  return frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec
}

function unavailableSample(): SourceSample {
  return { available: false, value: null, confidence: null }
}

function minConfidence(left: number | null, right: number | null): number | null {
  if (left == null) return right
  if (right == null) return left
  return Math.min(left, right)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function finitePriority(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function cloneJson<T>(value: T): T {
  if (value === undefined) return value
  return JSON.parse(JSON.stringify(value)) as T
}
