import type { SharedPerformanceContext } from './context'
import {
  curveSharedPerformanceProgress,
  resolveSharedPerformanceEventEnvelope,
  smoothSharedPerformanceModulation,
  type SharedPerformanceEnvelopeCurve,
  type SharedPerformanceEventEnvelope,
  type SharedPerformanceSmoothingState,
} from './envelopes'

export interface SharedBehaviorRange {
  min: number
  max: number
}

export interface SharedBehaviorConfidenceRequirement<TConfidenceKey = string> {
  key: TConfidenceKey
  min: number
}

export interface SharedBehaviorCapabilityRequirement<TCapabilityKey = string> {
  key: TCapabilityKey
  required?: boolean
}

export interface SharedBehaviorContinuousRoute<
  TSource = string,
  TTarget = string,
  TCapabilityKey = string,
  TConfidenceKey = string,
> {
  id: string
  source: TSource
  target: TTarget
  enabled?: boolean
  inputRange: SharedBehaviorRange
  outputRange: SharedBehaviorRange
  amount: number
  responseCurve?: SharedPerformanceEnvelopeCurve
  attackSec: number
  releaseSec: number
  sectionFilters?: readonly string[]
  confidenceRequirement?: SharedBehaviorConfidenceRequirement<TConfidenceKey>
  capabilityRequirement?: SharedBehaviorCapabilityRequirement<TCapabilityKey>
  outputClamp?: SharedBehaviorRange
}

export interface SharedBehaviorEventBinding<
  TEventSource = string,
  TTarget = string,
  TCapabilityKey = string,
  TConfidenceKey = string,
> {
  id: string
  source: TEventSource
  target: TTarget
  enabled?: boolean
  amount: number
  attackSec: number
  holdSec: number
  releaseSec: number
  curve?: SharedPerformanceEnvelopeCurve
  sectionFilters?: readonly string[]
  confidenceRequirement?: SharedBehaviorConfidenceRequirement<TConfidenceKey>
  capabilityRequirement?: SharedBehaviorCapabilityRequirement<TCapabilityKey>
  outputClamp?: SharedBehaviorRange
}

export interface SharedBehaviorEventSample {
  active: boolean
  strength: number
  /** Stable identity for this exact musical event. Active samples without an identity are ignored. */
  identity: string | number | null
  /** Optional authoritative onset time used when an event is first observed after its exact boundary. */
  startedAtSec?: number
}

export type SharedBehaviorSynchronizationReason =
  | 'manual'
  | 'seek'
  | 'backwardSeek'
  | 'loopWrap'
  | 'trackReplacement'
  | 'sourceReplacement'
  | 'timingDiscontinuity'

export interface SharedBehaviorTransportState {
  seekDetected?: boolean
  backwardSeekDetected?: boolean
  loopWrapDetected?: boolean
  trackReplacementDetected?: boolean
  timingDiscontinuity?: boolean
  /** Changes only when the adapter's timing authority changes, not on ordinary frames. */
  synchronizationIdentity?: string | number | null
}

export interface SharedBehaviorRoutingAdapter<
  TContext,
  TContinuousSource = string,
  TEventSource = string,
  TCapabilityKey = string,
  TConfidenceKey = string,
> {
  timeSec(context: TContext): number
  resolveContinuous(context: TContext, source: TContinuousSource): number
  resolveEvent(context: TContext, source: TEventSource): SharedBehaviorEventSample
  section?(context: TContext): string | null
  capability?(context: TContext, key: TCapabilityKey): boolean
  confidence?(context: TContext, key: TConfidenceKey): number
  transport?(context: TContext, output: SharedBehaviorTransportState): SharedBehaviorTransportState | null
}

export interface SharedBehaviorRoutingSink<TTarget = string> {
  applyContinuous(target: TTarget, value: number, routeId: string): void
  applyEvent(target: TTarget, value: number, bindingId: string, eventIdentity: string): void
}

export interface SharedBehaviorRoutingOptions {
  maxRouteStates?: number
  maxEventBindings?: number
  maxActiveEventStates?: number
  maxRememberedEventIdentities?: number
}

export interface SharedBehaviorRoutingUpdateInput<TContext> {
  context: TContext
  deltaSec: number
}

export interface SharedBehaviorRoutingStats {
  routeStateCount: number
  activeEventStateCount: number
  rememberedEventIdentityCount: number
  synchronizationCount: number
}

interface RouteState<TSource> extends SharedPerformanceSmoothingState {
  source: TSource
}

interface ActiveEventState<TTarget> {
  bindingId: string
  target: TTarget
  identity: string
  startedAtSec: number
  strength: number
  amount: number
  envelope: SharedPerformanceEventEnvelope
  durationSec: number
  outputClamp?: SharedBehaviorRange
  insertionSequence: number
}

const DEFAULT_MAX_ROUTE_STATES = 128
const DEFAULT_MAX_EVENT_BINDINGS = 128
const DEFAULT_MAX_ACTIVE_EVENT_STATES = 64
const DEFAULT_MAX_REMEMBERED_EVENT_IDENTITIES = 256

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, range: SharedBehaviorRange | undefined): number {
  if (!range) return value
  const minimum = Math.min(finite(range.min), finite(range.max))
  const maximum = Math.max(finite(range.min), finite(range.max))
  return Math.max(minimum, Math.min(maximum, value))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, finite(value)))
}

function boundedInteger(value: unknown, fallback: number, minimum = 1): number {
  const candidate = Math.floor(finite(value, fallback))
  return Math.max(minimum, candidate)
}

function mapRouteValue<TSource, TTarget, TCapabilityKey, TConfidenceKey>(
  route: SharedBehaviorContinuousRoute<TSource, TTarget, TCapabilityKey, TConfidenceKey>,
  sourceValue: number,
): number {
  const inputStart = finite(route.inputRange.min)
  const inputEnd = finite(route.inputRange.max, 1)
  const inputSpan = inputEnd - inputStart
  const normalized = Math.abs(inputSpan) <= Number.EPSILON
    ? (sourceValue >= inputEnd ? 1 : 0)
    : clamp01((sourceValue - inputStart) / inputSpan)
  const curved = curveSharedPerformanceProgress(normalized, route.responseCurve ?? 'linear')
  const outputStart = finite(route.outputRange.min)
  const outputEnd = finite(route.outputRange.max, 1)
  const mapped = outputStart + (outputEnd - outputStart) * curved
  return clamp(mapped * finite(route.amount, 1), route.outputClamp)
}

function eventKey(bindingId: string, identity: string | number): string {
  return `${bindingId}|${String(identity)}`
}

function identityString(identity: string | number): string {
  return typeof identity === 'number' ? String(identity) : identity
}

/**
 * Engine-neutral smoothing and event-envelope runtime. It never reads the
 * AudioFeatureBus and never interprets engine target names. Engine adapters
 * resolve sources and sinks apply the normalized values to engine-owned state.
 */
export class SharedBehaviorRoutingRuntime<
  TContext,
  TContinuousSource = string,
  TEventSource = string,
  TTarget = string,
  TCapabilityKey = string,
  TConfidenceKey = string,
> {
  private continuousRoutes: readonly SharedBehaviorContinuousRoute<TContinuousSource, TTarget, TCapabilityKey, TConfidenceKey>[] = []
  private eventBindings: readonly SharedBehaviorEventBinding<TEventSource, TTarget, TCapabilityKey, TConfidenceKey>[] = []
  private readonly routeStates = new Map<string, RouteState<TContinuousSource>>()
  private readonly activeEvents = new Map<string, ActiveEventState<TTarget>>()
  private readonly rememberedEventIdentities = new Set<string>()
  private readonly rememberedEventOrder: string[] = []
  private rememberedEventCursor = 0
  private insertionSequence = 0
  private synchronizationCount = 0
  private readonly transportScratch: SharedBehaviorTransportState = {}
  private lastSynchronizationIdentity: string | number | null | undefined
  private readonly maxRouteStates: number
  private readonly maxEventBindings: number
  private readonly maxActiveEventStates: number
  private readonly maxRememberedEventIdentities: number

  constructor(
    private readonly adapter: SharedBehaviorRoutingAdapter<TContext, TContinuousSource, TEventSource, TCapabilityKey, TConfidenceKey>,
    options: SharedBehaviorRoutingOptions = {},
  ) {
    this.maxRouteStates = boundedInteger(options.maxRouteStates, DEFAULT_MAX_ROUTE_STATES)
    this.maxEventBindings = boundedInteger(options.maxEventBindings, DEFAULT_MAX_EVENT_BINDINGS)
    this.maxActiveEventStates = boundedInteger(options.maxActiveEventStates, DEFAULT_MAX_ACTIVE_EVENT_STATES)
    this.maxRememberedEventIdentities = boundedInteger(
      options.maxRememberedEventIdentities,
      DEFAULT_MAX_REMEMBERED_EVENT_IDENTITIES,
    )
  }

  configure(
    continuousRoutes: readonly SharedBehaviorContinuousRoute<TContinuousSource, TTarget, TCapabilityKey, TConfidenceKey>[],
    eventBindings: readonly SharedBehaviorEventBinding<TEventSource, TTarget, TCapabilityKey, TConfidenceKey>[],
  ): void {
    const previousRouteSources = new Map(this.continuousRoutes.map(route => [route.id, route.source] as const))
    const previousBindingSources = new Map(this.eventBindings.map(binding => [binding.id, binding.source] as const))
    const routeIds = new Set<string>()
    const bindingIds = new Set<string>()
    const nextRoutes: SharedBehaviorContinuousRoute<TContinuousSource, TTarget, TCapabilityKey, TConfidenceKey>[] = []
    const nextBindings: SharedBehaviorEventBinding<TEventSource, TTarget, TCapabilityKey, TConfidenceKey>[] = []

    for (const route of continuousRoutes) {
      if (nextRoutes.length >= this.maxRouteStates || routeIds.has(route.id)) continue
      routeIds.add(route.id)
      nextRoutes.push(route)
    }
    for (const binding of eventBindings) {
      if (nextBindings.length >= this.maxEventBindings || bindingIds.has(binding.id)) continue
      bindingIds.add(binding.id)
      nextBindings.push(binding)
    }

    let sourceReplaced = false
    for (const route of nextRoutes) {
      if (previousRouteSources.has(route.id) && previousRouteSources.get(route.id) !== route.source) sourceReplaced = true
    }
    for (const binding of nextBindings) {
      if (previousBindingSources.has(binding.id) && previousBindingSources.get(binding.id) !== binding.source) sourceReplaced = true
    }

    this.continuousRoutes = nextRoutes
    this.eventBindings = nextBindings
    if (sourceReplaced) {
      this.synchronize('sourceReplacement')
      return
    }

    for (const routeId of this.routeStates.keys()) {
      if (!routeIds.has(routeId)) this.routeStates.delete(routeId)
    }
    let removedActiveBinding = false
    for (const [key, state] of this.activeEvents) {
      if (!bindingIds.has(state.bindingId)) {
        this.activeEvents.delete(key)
        removedActiveBinding = true
      }
    }
    if (removedActiveBinding) this.clearRememberedEvents()
  }

  update(input: SharedBehaviorRoutingUpdateInput<TContext>, sink: SharedBehaviorRoutingSink<TTarget>): void {
    const { context } = input
    this.clearTransportScratch()
    const transport = this.adapter.transport?.(context, this.transportScratch) ?? null
    const synchronizationReason = this.resolveSynchronizationReason(transport)
    if (synchronizationReason) this.synchronize(synchronizationReason)
    if (transport?.synchronizationIdentity !== undefined) {
      this.lastSynchronizationIdentity = transport.synchronizationIdentity
    }

    const nowSec = Math.max(0, finite(this.adapter.timeSec(context)))
    const deltaSec = Math.max(0, finite(input.deltaSec))

    for (let index = 0; index < this.continuousRoutes.length; index += 1) {
      const route = this.continuousRoutes[index]
      if (route.enabled === false || !this.gatesPass(context, route)) continue
      let state = this.routeStates.get(route.id)
      if (!state) {
        if (this.routeStates.size >= this.maxRouteStates) continue
        state = { value: 0, initialized: false, source: route.source }
        this.routeStates.set(route.id, state)
      }
      const target = mapRouteValue(route, finite(this.adapter.resolveContinuous(context, route.source)))
      const smoothed = smoothSharedPerformanceModulation(
        state,
        target,
        deltaSec,
        Math.max(0, finite(route.attackSec)),
        Math.max(0, finite(route.releaseSec)),
      )
      sink.applyContinuous(route.target, smoothed, route.id)
    }

    for (let index = 0; index < this.eventBindings.length; index += 1) {
      const binding = this.eventBindings[index]
      if (binding.enabled === false || !this.gatesPass(context, binding)) continue
      const sample = this.adapter.resolveEvent(context, binding.source)
      if (!sample.active || sample.identity == null) continue
      const key = eventKey(binding.id, sample.identity)
      if (this.activeEvents.has(key) || this.rememberedEventIdentities.has(key)) continue
      this.ensureActiveEventCapacity()
      const identity = identityString(sample.identity)
      const attackSec = Math.max(0, finite(binding.attackSec))
      const holdSec = Math.max(0, finite(binding.holdSec))
      const releaseSec = Math.max(0, finite(binding.releaseSec))
      this.activeEvents.set(key, {
        bindingId: binding.id,
        target: binding.target,
        identity,
        startedAtSec: Math.min(nowSec, Math.max(0, finite(sample.startedAtSec, nowSec))),
        strength: clamp01(sample.strength),
        amount: finite(binding.amount, 1),
        envelope: { attack: attackSec, hold: holdSec, release: releaseSec, curve: binding.curve ?? 'easeOut' },
        durationSec: attackSec + holdSec + releaseSec,
        outputClamp: binding.outputClamp,
        insertionSequence: this.insertionSequence,
      })
      this.insertionSequence += 1
    }

    for (const [key, state] of this.activeEvents) {
      const elapsedSec = Math.max(0, nowSec - state.startedAtSec)
      const envelopeValue = resolveSharedPerformanceEventEnvelope(elapsedSec, state.envelope)
      if (envelopeValue > 0 || elapsedSec <= state.durationSec) {
        sink.applyEvent(
          state.target,
          clamp(state.amount * state.strength * envelopeValue, state.outputClamp),
          state.bindingId,
          state.identity,
        )
      }
      if (elapsedSec >= state.durationSec) {
        this.activeEvents.delete(key)
        this.rememberEventIdentity(key)
      }
    }
  }

  reset(): void {
    this.routeStates.clear()
    this.activeEvents.clear()
    this.clearRememberedEvents()
    this.insertionSequence = 0
    this.lastSynchronizationIdentity = undefined
  }

  synchronize(_reason: SharedBehaviorSynchronizationReason = 'manual'): void {
    this.reset()
    this.synchronizationCount += 1
  }

  getStats(): SharedBehaviorRoutingStats {
    return {
      routeStateCount: this.routeStates.size,
      activeEventStateCount: this.activeEvents.size,
      rememberedEventIdentityCount: this.rememberedEventIdentities.size,
      synchronizationCount: this.synchronizationCount,
    }
  }

  dispose(): void {
    this.continuousRoutes = []
    this.eventBindings = []
    this.reset()
  }

  private clearTransportScratch(): void {
    this.transportScratch.seekDetected = false
    this.transportScratch.backwardSeekDetected = false
    this.transportScratch.loopWrapDetected = false
    this.transportScratch.trackReplacementDetected = false
    this.transportScratch.timingDiscontinuity = false
    this.transportScratch.synchronizationIdentity = undefined
  }

  private gatesPass(
    context: TContext,
    definition: {
      sectionFilters?: readonly string[]
      confidenceRequirement?: SharedBehaviorConfidenceRequirement<TConfidenceKey>
      capabilityRequirement?: SharedBehaviorCapabilityRequirement<TCapabilityKey>
    },
  ): boolean {
    if (definition.sectionFilters?.length) {
      const section = this.adapter.section?.(context) ?? null
      if (section == null || !definition.sectionFilters.includes(section)) return false
    }
    const capability = definition.capabilityRequirement
    if (capability) {
      const available = this.adapter.capability?.(context, capability.key) ?? false
      if ((capability.required ?? true) !== available) return false
    }
    const confidence = definition.confidenceRequirement
    if (confidence) {
      const value = this.adapter.confidence?.(context, confidence.key) ?? 0
      if (finite(value) < Math.max(0, finite(confidence.min))) return false
    }
    return true
  }

  private resolveSynchronizationReason(transport: SharedBehaviorTransportState | null): SharedBehaviorSynchronizationReason | null {
    if (!transport) return null
    const repeatedIdentity = transport.synchronizationIdentity !== undefined
      && this.lastSynchronizationIdentity !== undefined
      && transport.synchronizationIdentity === this.lastSynchronizationIdentity
    if (repeatedIdentity) return null
    if (transport.trackReplacementDetected) return 'trackReplacement'
    if (transport.seekDetected) return 'seek'
    if (transport.backwardSeekDetected) return 'backwardSeek'
    if (transport.loopWrapDetected) return 'loopWrap'
    if (transport.timingDiscontinuity) return 'timingDiscontinuity'
    if (
      transport.synchronizationIdentity !== undefined
      && this.lastSynchronizationIdentity !== undefined
      && transport.synchronizationIdentity !== this.lastSynchronizationIdentity
    ) return 'timingDiscontinuity'
    return null
  }

  private ensureActiveEventCapacity(): void {
    if (this.activeEvents.size < this.maxActiveEventStates) return
    let oldestKey: string | null = null
    let oldestSequence = Number.POSITIVE_INFINITY
    for (const [key, state] of this.activeEvents) {
      if (state.insertionSequence < oldestSequence) {
        oldestKey = key
        oldestSequence = state.insertionSequence
      }
    }
    if (oldestKey != null) {
      this.activeEvents.delete(oldestKey)
      this.rememberEventIdentity(oldestKey)
    }
  }

  private rememberEventIdentity(identity: string): void {
    if (this.rememberedEventIdentities.has(identity)) return
    if (this.rememberedEventOrder.length < this.maxRememberedEventIdentities) {
      this.rememberedEventOrder.push(identity)
    } else {
      const replaced = this.rememberedEventOrder[this.rememberedEventCursor]
      if (replaced != null) this.rememberedEventIdentities.delete(replaced)
      this.rememberedEventOrder[this.rememberedEventCursor] = identity
      this.rememberedEventCursor = (this.rememberedEventCursor + 1) % this.maxRememberedEventIdentities
    }
    this.rememberedEventIdentities.add(identity)
  }

  private clearRememberedEvents(): void {
    this.rememberedEventIdentities.clear()
    this.rememberedEventOrder.length = 0
    this.rememberedEventCursor = 0
  }
}

export interface SharedPerformanceBehaviorAdapterOptions<TContinuousSource = string, TEventSource = string> {
  resolveContinuous(context: SharedPerformanceContext, source: TContinuousSource): number
  resolveEvent(context: SharedPerformanceContext, source: TEventSource): SharedBehaviorEventSample
}

/** Convenience adapter for engines already consuming SharedPerformanceContext. */
export function createSharedPerformanceBehaviorAdapter<TContinuousSource = string, TEventSource = string>(
  options: SharedPerformanceBehaviorAdapterOptions<TContinuousSource, TEventSource>,
): SharedBehaviorRoutingAdapter<
  SharedPerformanceContext,
  TContinuousSource,
  TEventSource,
  keyof SharedPerformanceContext['capabilities'],
  keyof SharedPerformanceContext['confidence']
> {
  return {
    timeSec: context => context.audioTimeSec,
    resolveContinuous: options.resolveContinuous,
    resolveEvent: options.resolveEvent,
    section: context => context.macroSectionType ?? context.sectionType,
    capability: (context, key) => context.capabilities[key],
    confidence: (context, key) => context.confidence[key],
    transport: (context, output) => {
      output.seekDetected = context.seekDetected
      output.loopWrapDetected = context.loopWrapDetected
      output.trackReplacementDetected = context.trackReplacementDetected
      output.timingDiscontinuity = context.boundaries.timingDiscontinuity && (
        context.seekDetected || context.loopWrapDetected || context.trackReplacementDetected
      )
      output.synchronizationIdentity = context.timingDiscontinuityIdentity
      return output
    },
  }
}
