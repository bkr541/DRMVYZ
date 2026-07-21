import {
  SharedBehaviorRoutingRuntime,
  type SharedBehaviorContinuousRoute,
  type SharedBehaviorEventBinding as SharedEventBinding,
  type SharedBehaviorEventSample,
  type SharedBehaviorRoutingSink,
  type SharedBehaviorTransportState,
} from '../../../../features/performanceCore'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import {
  MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES,
  type SoundDrawingEventBinding,
  type SoundDrawingEventKind,
  type SoundDrawingEventTarget,
  type SoundDrawingModulationCapability,
  type SoundDrawingModulationConfidence,
  type SoundDrawingModulationRoute,
  type SoundDrawingModulationSource,
  type SoundDrawingModulationTarget,
  type SoundDrawingPerformanceLockKey,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingPerformanceTemporalState,
} from './SoundDrawingPerformanceTypes'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'

export type SoundDrawingBehaviorTargetName = SoundDrawingModulationTarget | SoundDrawingEventTarget

export interface SoundDrawingBehaviorTarget {
  layerId: string
  target: SoundDrawingBehaviorTargetName
  clamp?: readonly [number, number]
  lockKey?: SoundDrawingPerformanceLockKey
  direction?: readonly [number, number, number]
  alternateDirection?: boolean
  location?: number
  radius?: number
}

export interface SoundDrawingBehaviorRouteDefinition {
  layerId: string
  route: SoundDrawingModulationRoute
}

export interface SoundDrawingBehaviorEventDefinition {
  id: string
  layerId: string
  binding: SoundDrawingEventBinding
}

export interface ApplySoundDrawingBehaviorInput {
  temporalState: SoundDrawingPerformanceTemporalState
  context: SharedPerformanceContext
  frame: ReactFrameContext
  settings: SoundDrawingPerformanceSettings
  routes: readonly SoundDrawingBehaviorRouteDefinition[]
  events: readonly SoundDrawingBehaviorEventDefinition[]
  applyContinuous(target: SoundDrawingBehaviorTarget, value: number, routeId: string): void
  applyEvent(target: SoundDrawingBehaviorTarget, value: number, bindingId: string, eventIdentity: string): void
}

interface SoundDrawingBehaviorContext {
  context: SharedPerformanceContext
  frame: ReactFrameContext
}

type Runtime = SharedBehaviorRoutingRuntime<
  SoundDrawingBehaviorContext,
  SoundDrawingModulationSource,
  SoundDrawingEventKind,
  SoundDrawingBehaviorTarget,
  SoundDrawingModulationCapability,
  SoundDrawingModulationConfidence
>

const runtimeByTemporalState = new WeakMap<SoundDrawingPerformanceTemporalState, Runtime>()

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finite(value)))
}

function eventIdentity(context: SharedPerformanceContext, event: SoundDrawingEventKind): string {
  switch (event) {
    case 'hat':
      return `${event}:${Math.max(0, Math.floor(context.absoluteBeat * 4))}`
    case 'fourBarBoundary':
      return `${event}:${context.sectionIdentity}:${context.sectionOccurrence}:${context.performanceFourBarBlockIndex}`
    case 'eightBarBoundary':
      return `${event}:${context.sectionIdentity}:${context.sectionOccurrence}:${context.performanceEightBarBlockIndex}`
    case 'sixteenBarBoundary':
      return `${event}:${context.sectionIdentity}:${context.sectionOccurrence}:${context.performanceSixteenBarBlockIndex}`
    case 'sectionEntry':
      return `${event}:${context.sectionIdentity}:${context.sectionOccurrence}`
    case 'sectionExit':
      return `${event}:${context.boundaries.previousSectionId ?? context.sectionIdentity}`
    case 'dropImpact':
      return `${event}:${context.dropOccurrence}:${context.beatIndex}`
    default:
      return `${event}:${Math.max(0, context.beatIndex)}`
  }
}

function eventSample(context: SharedPerformanceContext, event: SoundDrawingEventKind): SharedBehaviorEventSample {
  const beatPhase = Math.max(0, Math.min(0.999999, finite(context.beatPhase)))
  const rhythm = context.intelligence.rhythm
  const useGridFallback = !context.capabilities.rhythmEvents || context.confidence.rhythm < 0.25
  let active = false
  let strength = 0
  let ageBeats = beatPhase

  switch (event) {
    case 'beat':
      active = rhythm.beatHit || (useGridFallback && context.boundaries.beatBoundary)
      strength = active ? Math.max(0.35, context.transient, context.energy * 0.5) : 0
      break
    case 'downbeat':
      active = rhythm.downbeatHit || (useGridFallback && context.downbeat && context.boundaries.beatBoundary)
      strength = active ? Math.max(0.65, context.energy) : 0
      break
    case 'kick': {
      const fallback = useGridFallback && context.beatWithinBar % 2 === 0 ? Math.max(0.25, context.bass * 0.8) : 0
      active = context.kick || fallback > 0
      strength = active ? Math.max(context.kickStrength, fallback) : 0
      break
    }
    case 'snare': {
      const fallback =
        useGridFallback && context.beatWithinBar % 2 === 1
          ? Math.max(0.22, context.mid * 0.65, context.spectralFlux * 0.5)
          : 0
      active = context.snare || fallback > 0
      strength = active ? Math.max(context.snareStrength, fallback) : 0
      break
    }
    case 'hat':
      active = context.hat || useGridFallback
      ageBeats = (context.absoluteBeat * 4 - Math.floor(context.absoluteBeat * 4)) / 4
      strength = active ? Math.max(context.hatStrength, context.high * 0.65) : 0
      break
    case 'fourBarBoundary':
      active = context.boundaries.performanceFourBarBoundary
      strength = active ? 0.48 : 0
      ageBeats = 0
      break
    case 'eightBarBoundary':
      active = context.boundaries.performanceEightBarBoundary
      strength = active ? 0.62 : 0
      ageBeats = 0
      break
    case 'sixteenBarBoundary':
      active = context.boundaries.performanceSixteenBarBoundary
      strength = active ? 0.78 : 0
      ageBeats = 0
      break
    case 'sectionEntry':
      active = context.boundaries.sectionEntry || context.boundaries.macroSectionEntry
      strength = active ? Math.max(0.55, context.sectionConfidence) : 0
      ageBeats = 0
      break
    case 'sectionExit':
      active = context.boundaries.sectionExit || context.boundaries.macroSectionExit
      strength = active ? Math.max(0.45, context.sectionConfidence) : 0
      ageBeats = 0
      break
    case 'dropImpact':
      active = context.dropImpact > 0.05 && (context.boundaries.sectionEntry || context.intelligence.rhythm.downbeatHit)
      strength = active ? Math.max(context.dropImpact, 0.72) : 0
      ageBeats = beatPhase
      break
  }

  const beatsPerSecond = Math.max(1 / 60, finite(context.bpm, 120) / 60)
  return {
    active,
    strength: clamp01(strength),
    identity: active ? eventIdentity(context, event) : null,
    startedAtSec: Math.max(0, context.audioTimeSec - ageBeats / beatsPerSecond),
  }
}

function transportState(
  value: SoundDrawingBehaviorContext,
  output: SharedBehaviorTransportState,
): SharedBehaviorTransportState {
  const context = value.context
  output.trackReplacementDetected = context.trackReplacementDetected
  output.seekDetected = context.seekDetected
  output.backwardSeekDetected = false
  output.loopWrapDetected = context.loopWrapDetected
  output.timingDiscontinuity = Boolean(value.frame.timingDiscontinuity || context.boundaries.timingDiscontinuity)
  output.synchronizationIdentity = context.trackReplacementDetected
    ? context.trackChangeIdentity
    : context.loopWrapDetected
      ? context.loopIdentity
      : context.seekDetected
        ? context.seekIdentity
        : output.timingDiscontinuity
          ? context.timingDiscontinuityIdentity
          : undefined
  return output
}

function createRuntime(): Runtime {
  return new SharedBehaviorRoutingRuntime<
    SoundDrawingBehaviorContext,
    SoundDrawingModulationSource,
    SoundDrawingEventKind,
    SoundDrawingBehaviorTarget,
    SoundDrawingModulationCapability,
    SoundDrawingModulationConfidence
  >(
    {
      timeSec: (value) => value.context.audioTimeSec,
      resolveContinuous: (value, source) => clamp01(value.context[source]),
      resolveEvent: (value, source) => eventSample(value.context, source),
      section: (value) => value.context.macroSectionType ?? value.context.sectionType ?? 'unknown',
      capability: (value, key) => Boolean(value.context.capabilities[key]),
      confidence: (value, key) => value.context.confidence[key],
      transport: transportState,
    },
    {
      maxRouteStates: 64,
      maxEventBindings: MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES * 2,
      maxActiveEventStates: MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES * 2,
      maxRememberedEventIdentities: 128,
    },
  )
}

function runtimeFor(temporalState: SoundDrawingPerformanceTemporalState): Runtime {
  let runtime = runtimeByTemporalState.get(temporalState)
  if (!runtime) {
    runtime = createRuntime()
    runtimeByTemporalState.set(temporalState, runtime)
  }
  return runtime
}

function secondsPerBeat(context: SharedPerformanceContext): number {
  return 60 / Math.max(1, finite(context.bpm, 120))
}

function timingUnitToBeats(unit: SoundDrawingEventBinding['envelope']['attack'], timeSignature: number): number {
  switch (unit) {
    case '1/32beat':
      return 1 / 32
    case '1/16beat':
      return 1 / 16
    case '1/8beat':
      return 1 / 8
    case '1/4beat':
      return 1 / 4
    case '1/2beat':
      return 1 / 2
    case '1beat':
      return 1
    case '2beats':
      return 2
    case '1bar':
      return Math.max(1, timeSignature)
    case '2bars':
      return Math.max(1, timeSignature) * 2
    case '4bars':
      return Math.max(1, timeSignature) * 4
  }
}

export function applySoundDrawingBehaviorRouting(input: ApplySoundDrawingBehaviorInput): void {
  const runtime = runtimeFor(input.temporalState)
  const continuous: SharedBehaviorContinuousRoute<
    SoundDrawingModulationSource,
    SoundDrawingBehaviorTarget,
    SoundDrawingModulationCapability,
    SoundDrawingModulationConfidence
  >[] = []
  for (const definition of input.routes) {
    const route = definition.route
    const amount = finite(route.amount, 1)
    const usesSmoothing = (route.smoothing ?? 0) > 0 || (route.attack ?? 0) > 0 || (route.release ?? 0) > 0
    continuous.push({
      id: `${definition.layerId}:${route.id}`,
      source: route.source,
      enabled:
        !(route.lockKey && input.settings.locks[route.lockKey]) &&
        (route.capabilityAny == null || route.capabilityAny.some((key) => input.context.capabilities[key])),
      target: { layerId: definition.layerId, target: route.target, clamp: route.clamp, lockKey: route.lockKey },
      inputRange: { min: 0, max: 1 },
      // Sound Drawing amount scales the authored span, not the minimum.
      outputRange: { min: route.min, max: route.min + (route.max - route.min) * amount },
      amount: 1,
      responseCurve: route.curve ?? 'linear',
      attackSec: usesSmoothing ? Math.max(0, finite(route.attack, route.smoothing ?? 0.08)) : 0,
      releaseSec: usesSmoothing ? Math.max(0, finite(route.release, route.smoothing ?? 0.12)) : 0,
      sectionFilters: route.sectionFilter,
      confidenceRequirement:
        route.minConfidence == null ? undefined : { key: route.confidenceKey ?? 'overall', min: route.minConfidence },
      capabilityRequirement: route.capability == null ? undefined : { key: route.capability },
    })
  }

  const secondsForBeat = secondsPerBeat(input.context)
  const events: SharedEventBinding<
    SoundDrawingEventKind,
    SoundDrawingBehaviorTarget,
    SoundDrawingModulationCapability,
    SoundDrawingModulationConfidence
  >[] = []
  for (const definition of input.events) {
    const binding = definition.binding
    events.push({
      id: definition.id,
      source: binding.event,
      enabled: !(binding.lockKey && input.settings.locks[binding.lockKey]),
      target: {
        layerId: definition.layerId,
        target: binding.target,
        lockKey: binding.lockKey,
        direction: binding.direction,
        alternateDirection: binding.alternateDirection,
        location: binding.location,
        radius: binding.radius,
      },
      amount: finite(binding.amount, 1),
      attackSec: timingUnitToBeats(binding.envelope.attack, input.context.timeSignature) * secondsForBeat,
      holdSec: timingUnitToBeats(binding.envelope.hold, input.context.timeSignature) * secondsForBeat,
      releaseSec: timingUnitToBeats(binding.envelope.release, input.context.timeSignature) * secondsForBeat,
      curve: binding.envelope.curve,
      sectionFilters: binding.sectionFilter,
      confidenceRequirement:
        binding.minConfidence == null
          ? undefined
          : { key: binding.confidenceKey ?? 'overall', min: binding.minConfidence },
      capabilityRequirement: binding.capability == null ? undefined : { key: binding.capability },
    })
  }

  runtime.configure(continuous, events)
  const sink: SharedBehaviorRoutingSink<SoundDrawingBehaviorTarget> = {
    applyContinuous: input.applyContinuous,
    applyEvent: input.applyEvent,
  }
  runtime.update(
    {
      context: { context: input.context, frame: input.frame },
      deltaSec: Math.max(1 / 240, Math.min(0.25, finite(input.frame.deltaTimeSec, 1 / 60))),
    },
    sink,
  )
}

export function synchronizeSoundDrawingBehaviorRuntime(
  temporalState: SoundDrawingPerformanceTemporalState,
  reason: 'sourceReplacement' | 'manual' = 'manual',
): void {
  runtimeByTemporalState.get(temporalState)?.synchronize(reason)
}

export function disposeSoundDrawingBehaviorRuntime(temporalState: SoundDrawingPerformanceTemporalState): void {
  const runtime = runtimeByTemporalState.get(temporalState)
  runtime?.dispose()
  runtimeByTemporalState.delete(temporalState)
}

export function getSoundDrawingBehaviorRuntimeStats(temporalState: SoundDrawingPerformanceTemporalState) {
  return runtimeByTemporalState.get(temporalState)?.getStats() ?? null
}
