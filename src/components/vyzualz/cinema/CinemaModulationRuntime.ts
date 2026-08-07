import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  deduplicateCinemaDiagnostics,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from './CinemaDiagnostics'
import type {
  CinemaCompositionDefinition,
  CinemaCurvePoint,
  CinemaModulationCondition,
  CinemaModulationRouteDefinition,
  CinemaMusicalQuantization,
  CinemaParameterDefinition,
  CinemaParameterValue,
} from './CinemaDomain'
import type {
  CinemaEventId,
  CinemaModulationRouteId,
} from './CinemaIdentifiers'
import {
  resolveCinemaParameterDestination,
  type CinemaParameterDestinationContext,
  type CinemaTransientParameterSnapshot,
} from './CinemaParameterResolver'
import type { CinemaFrameContext, CinemaMusicalClockId } from './CinemaRendererContracts'
import {
  getCinemaModulationSourceDescriptor,
  resolveCinemaModulationSourceSample,
  type CinemaModulationSourceDescriptor,
  type CinemaModulationSourceSample,
} from './CinemaModulationSources'

export const CINEMA_MODULATION_SNAPSHOT_VERSION = 1 as const

export interface CinemaModulationRuntimeOptions extends CinemaParameterDestinationContext {}

export interface CinemaModulationSnapshot {
  readonly version: typeof CINEMA_MODULATION_SNAPSHOT_VERSION
  readonly compositionId: string
  readonly trackIdentity: string | null
  readonly routeCount: number
  readonly activeRouteCount: number
  readonly values: CinemaTransientParameterSnapshot
  readonly diagnostics: CinemaDiagnosticSnapshot
}

interface CompiledRoute {
  readonly definition: Readonly<CinemaModulationRouteDefinition>
  readonly source: Readonly<CinemaModulationSourceDescriptor>
  readonly schema: Readonly<CinemaParameterDefinition>
}

interface RouteRuntimeState {
  trackIdentity: string | null
  envelope: number
  envelopeStart: number
  envelopeTarget: number
  envelopeElapsedSec: number
  smoothed: number
  hasSignal: boolean
  heldSignal: number | null
  pendingImpulse: boolean
  lastSourceEventId: string | null
  lastQuantizationEventId: string | null
}

interface RouteSignal {
  readonly apply: boolean
  readonly signal: number
  readonly triggered: boolean
}

/**
 * Runtime-only deterministic route evaluator.
 *
 * Authored routes and parameter baselines remain immutable. The evaluator owns
 * only transient envelopes, event identities, and quantized held samples.
 */
export class CinemaModulationRuntime {
  private readonly composition: Readonly<CinemaCompositionDefinition>
  private readonly compiledRoutes: readonly CompiledRoute[]
  private readonly validationDiagnostics: readonly CinemaDiagnostic[]
  private readonly routeStates = new Map<CinemaModulationRouteId, RouteRuntimeState>()
  private trackIdentity: string | null = null

  constructor(options: CinemaModulationRuntimeOptions) {
    this.composition = options.composition
    const compilation = compileRoutes(options)
    this.compiledRoutes = compilation.routes
    this.validationDiagnostics = compilation.diagnostics
  }

  get routeCount(): number {
    return this.composition.modulationRoutes.length
  }

  get diagnostics(): CinemaDiagnosticSnapshot {
    return createCinemaDiagnosticSnapshot(this.validationDiagnostics)
  }

  reset(): void {
    this.routeStates.clear()
    this.trackIdentity = null
  }

  evaluate(
    frame: Readonly<CinemaFrameContext>,
    baseValues: Readonly<Record<string, CinemaParameterValue>>,
    previewRouteId: CinemaModulationRouteId | null = null,
  ): Readonly<CinemaModulationSnapshot> {
    const frameTrackIdentity = frame.transport.trackId
    if (frame.transport.reset.required || frameTrackIdentity !== this.trackIdentity) {
      this.routeStates.clear()
      this.trackIdentity = frameTrackIdentity
    }

    const diagnostics: CinemaDiagnostic[] = [...this.validationDiagnostics]
    const values: Record<string, CinemaParameterValue> = {}
    let activeRouteCount = 0

    for (const route of this.compiledRoutes) {
      const previewing = previewRouteId === route.definition.id
      const sample = resolveCinemaModulationSourceSample(route.definition.sourceId, frame)
      if (!sample) continue
      if (!previewing && !sample.available) {
        diagnostics.push(sourceUnavailableDiagnostic(route, sample))
        this.routeStates.delete(route.definition.id)
        continue
      }

      const state = this.getRouteState(route.definition.id, frameTrackIdentity)
      const routeSignal = previewing
        ? { apply: true, signal: 1, triggered: route.source.kind === 'impulse' }
        : evaluateRouteSignal(route.definition, sample, frame, state)
      if (!routeSignal.apply) continue

      const path = route.definition.destination
      const current = Object.prototype.hasOwnProperty.call(values, path)
        ? values[path]
        : baseValues[path]
      if (current === undefined) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_MODULATION_ROUTE_INVALID',
          severity: 'error',
          message: `Cinema modulation route "${route.definition.id}" has no resolved destination baseline.`,
          attribution: { compositionId: this.composition.id, parameterPath: path, stage: 'modulation-runtime' },
          details: { routeId: String(route.definition.id) },
        }))
        continue
      }

      const applied = applyRouteOperation(current, route.schema, route.definition, routeSignal)
      if (!applied.ok) {
        diagnostics.push(createCinemaDiagnostic({
          code: 'CINEMA_MODULATION_ROUTE_INCOMPATIBLE',
          severity: 'error',
          message: applied.message,
          attribution: { compositionId: this.composition.id, parameterPath: path, stage: 'modulation-runtime' },
          details: { routeId: String(route.definition.id), sourceId: String(route.definition.sourceId) },
        }))
        continue
      }
      values[path] = applied.value
      activeRouteCount += 1
    }

    return deepFreeze({
      version: CINEMA_MODULATION_SNAPSHOT_VERSION,
      compositionId: this.composition.id,
      trackIdentity: frameTrackIdentity,
      routeCount: this.composition.modulationRoutes.length,
      activeRouteCount,
      values,
      diagnostics: createCinemaDiagnosticSnapshot(diagnostics),
    })
  }

  private getRouteState(routeId: CinemaModulationRouteId, trackIdentity: string | null): RouteRuntimeState {
    let state = this.routeStates.get(routeId)
    if (!state || state.trackIdentity !== trackIdentity) {
      state = {
        trackIdentity,
        envelope: 0,
        envelopeStart: 0,
        envelopeTarget: 0,
        envelopeElapsedSec: 0,
        smoothed: 0,
        hasSignal: false,
        heldSignal: null,
        pendingImpulse: false,
        lastSourceEventId: null,
        lastQuantizationEventId: null,
      }
      this.routeStates.set(routeId, state)
    }
    return state
  }
}

export function validateCinemaModulationRoutes(
  options: CinemaModulationRuntimeOptions,
): CinemaDiagnosticSnapshot {
  return createCinemaDiagnosticSnapshot(compileRoutes(options).diagnostics)
}

function compileRoutes(options: CinemaModulationRuntimeOptions): {
  routes: readonly CompiledRoute[]
  diagnostics: readonly CinemaDiagnostic[]
} {
  const routes: CompiledRoute[] = []
  const diagnostics: CinemaDiagnostic[] = []
  const seenRouteIds = new Set<string>()

  for (const route of options.composition.modulationRoutes) {
    if (seenRouteIds.has(route.id)) {
      diagnostics.push(routeDiagnostic(options.composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Duplicate modulation route ID.'))
      continue
    }
    seenRouteIds.add(route.id)
    const shapeDiagnostics = validateRouteShape(options.composition, route)
    diagnostics.push(...shapeDiagnostics)
    if (shapeDiagnostics.some(diagnostic => diagnostic.severity === 'error')) continue
    if (!route.enabled) continue

    const source = getCinemaModulationSourceDescriptor(route.sourceId)
    if (!source) {
      diagnostics.push(routeDiagnostic(
        options.composition,
        route,
        'CINEMA_MODULATION_SOURCE_UNKNOWN',
        `Cinema modulation source "${route.sourceId}" is not registered.`,
      ))
      continue
    }

    const destination = resolveCinemaParameterDestination(route.destination, options)
    if (!destination.ok) {
      diagnostics.push(...destination.diagnostics.map(diagnostic => ({
        ...diagnostic,
        attribution: {
          ...diagnostic.attribution,
          compositionId: options.composition.id,
          stage: 'modulation-validation',
        },
        details: { ...diagnostic.details, routeId: String(route.id), sourceId: String(route.sourceId) },
      })))
      continue
    }

    const compatibility = validateCompatibility(route, destination.destination.schema)
    if (compatibility) {
      diagnostics.push(routeDiagnostic(
        options.composition,
        route,
        'CINEMA_MODULATION_ROUTE_INCOMPATIBLE',
        compatibility,
      ))
      continue
    }

    routes.push(Object.freeze({ definition: route, source, schema: destination.destination.schema }))
  }

  return {
    routes: Object.freeze(routes),
    diagnostics: Object.freeze(deduplicateCinemaDiagnostics(diagnostics)),
  }
}

function validateRouteShape(
  composition: Readonly<CinemaCompositionDefinition>,
  route: Readonly<CinemaModulationRouteDefinition>,
): readonly CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = []
  if (!['add', 'multiply', 'replace', 'trigger'].includes(route.mode)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', `Unknown modulation operation "${String(route.mode)}".`))
  }
  if (!['none', 'beat', '2-beats', 'bar', '4-bars', '8-bars', 'phrase', 'section'].includes(route.quantization ?? 'none')) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', `Unknown musical quantization "${String(route.quantization)}".`))
  }
  if (typeof route.enabled !== 'boolean') {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Enabled must be a boolean.'))
  }
  if (!Number.isFinite(route.amount)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Amount must be finite.'))
  }
  const finiteFields: readonly [string, number | undefined][] = [
    ['offset', route.offset],
    ['attackMs', route.attackMs],
    ['releaseMs', route.releaseMs],
    ['smoothing', route.smoothing],
  ]
  for (const [name, value] of finiteFields) {
    if (value != null && !Number.isFinite(value)) {
      diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', `${name} must be finite.`))
    }
  }
  if ((route.attackMs ?? 0) < 0 || (route.releaseMs ?? 0) < 0) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Attack and release must be non-negative.'))
  }
  if (route.smoothing != null && (route.smoothing < 0 || route.smoothing > 1)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Smoothing must be in the inclusive 0..1 range.'))
  }
  if (route.inputRange && (!validFiniteRange(route.inputRange) || route.inputRange[0] === route.inputRange[1])) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'inputRange must contain two distinct finite values.'))
  }
  if (route.outputRange && !validFiniteRange(route.outputRange)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'outputRange must contain two finite values.'))
  }
  if (route.clamp && (!validFiniteRange(route.clamp) || route.clamp[0] > route.clamp[1])) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'clamp must contain two finite values in minimum-to-maximum order.'))
  }
  if (route.curve && !validCurve(route.curve)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Response curve positions must be finite, strictly increasing, and within 0..1; values must be finite.'))
  }
  if (route.condition?.sectionTypes && route.condition.sectionTypes.some(section => typeof section !== 'string' || section.trim().length === 0)) {
    diagnostics.push(routeDiagnostic(composition, route, 'CINEMA_MODULATION_ROUTE_INVALID', 'Section conditions must contain non-empty section type IDs.'))
  }
  return diagnostics
}

function validFiniteRange(range: readonly number[]): boolean {
  return range.length === 2 && Number.isFinite(range[0]) && Number.isFinite(range[1])
}

function validateCompatibility(
  route: Readonly<CinemaModulationRouteDefinition>,
  schema: Readonly<CinemaParameterDefinition>,
): string | null {
  if (schema.type === 'trigger') {
    return route.mode === 'trigger' ? null : 'Trigger-only destinations require the trigger operation.'
  }
  if (route.mode === 'trigger') {
    return schema.type === 'boolean' ? null : 'The trigger operation requires a boolean or trigger destination.'
  }
  if (schema.modulatable === false) return `Cinema parameter "${schema.id}" is not modulatable.`
  if (schema.type === 'float' || schema.type === 'integer' || schema.type === 'vector2' || schema.type === 'vector3' || schema.type === 'color') {
    return null
  }
  if (schema.type === 'boolean' && route.mode === 'replace') return null
  return `Cinema parameter type "${schema.type}" is incompatible with ${route.mode} modulation.`
}

function evaluateRouteSignal(
  route: Readonly<CinemaModulationRouteDefinition>,
  sample: Readonly<CinemaModulationSourceSample>,
  frame: Readonly<CinemaFrameContext>,
  state: RouteRuntimeState,
): RouteSignal {
  if (frame.transport.paused || !frame.transport.playing || frame.transport.visibilitySuspended) {
    if (route.mode === 'trigger') return { apply: false, signal: 0, triggered: false }
    return { apply: state.hasSignal, signal: state.smoothed, triggered: false }
  }

  const conditionActive = conditionMatches(route.condition, frame)
  const eventSource = sample.source.kind === 'impulse' || sample.source.kind === 'clock'
  const newSourceEvent = eventSource
    && sample.active
    && sample.eventId != null
    && sample.eventId !== state.lastSourceEventId
  if (newSourceEvent) state.lastSourceEventId = sample.eventId

  const quantization = route.quantization ?? 'none'
  const quantizationEventId = resolveQuantizationEventId(quantization, frame)
  const newQuantizationEvent = quantizationEventId != null
    && quantizationEventId !== state.lastQuantizationEventId
  if (newQuantizationEvent) state.lastQuantizationEventId = quantizationEventId

  let rawValue = 0
  let triggered = false
  if (eventSource) {
    if (newSourceEvent && conditionActive) state.pendingImpulse = true
    if (quantization === 'none') {
      triggered = state.pendingImpulse
      state.pendingImpulse = false
      rawValue = triggered ? sample.value : 0
    } else if (newQuantizationEvent && state.pendingImpulse) {
      triggered = true
      state.pendingImpulse = false
      rawValue = sample.value > 0 ? sample.value : 1
    }
  } else if (quantization === 'none') {
    rawValue = conditionActive ? sample.value : 0
  } else if (newQuantizationEvent) {
    state.heldSignal = conditionActive ? mapRouteSignal(route, sample.value) : 0
    triggered = conditionActive && mapRouteSignal(route, sample.value) > 0.5
  }

  if (route.mode === 'trigger') {
    if (!eventSource && quantization === 'none') triggered = conditionActive && mapRouteSignal(route, sample.value) > 0.5
    return { apply: triggered, signal: triggered ? 1 : 0, triggered }
  }

  let target: number
  if (!eventSource && quantization !== 'none') {
    if (state.heldSignal == null) return { apply: false, signal: 0, triggered: false }
    target = state.heldSignal
  } else if (eventSource) {
    target = triggered ? mapRouteSignal(route, rawValue) : 0
  } else {
    target = mapRouteSignal(route, rawValue)
  }

  const deltaTimeSec = Math.max(0, Math.min(0.25, frame.timing.deltaTimeSec))
  const durationMs = target >= state.envelope ? route.attackMs ?? 0 : route.releaseMs ?? 0
  state.envelope = advanceEnvelope(state, target, deltaTimeSec, durationMs)
  const smoothing = clamp01(route.smoothing ?? 0)
  state.smoothed = smooth(state.smoothed, state.envelope, deltaTimeSec, smoothing, state.hasSignal)

  const epsilon = 1e-7
  const apply = eventSource
    ? Math.abs(state.smoothed) > epsilon || Math.abs(target) > epsilon
    : quantization === 'none' || state.heldSignal != null
  state.hasSignal = apply
  return { apply, signal: state.smoothed, triggered }
}

function mapRouteSignal(route: Readonly<CinemaModulationRouteDefinition>, sourceValue: number): number {
  const input = route.inputRange ?? [0, 1]
  const output = route.outputRange ?? [0, 1]
  const inputProgress = clamp01((sourceValue - input[0]) / (input[1] - input[0]))
  const curved = evaluateCurve(route.curve, inputProgress)
  const ranged = output[0] + (output[1] - output[0]) * curved
  return ranged * route.amount + (route.offset ?? 0)
}

function applyRouteOperation(
  current: CinemaParameterValue,
  schema: Readonly<CinemaParameterDefinition>,
  route: Readonly<CinemaModulationRouteDefinition>,
  signal: RouteSignal,
): { ok: true; value: CinemaParameterValue } | { ok: false; message: string } {
  if (route.mode === 'trigger') return { ok: true, value: signal.triggered }
  if (schema.type === 'boolean') return { ok: true, value: signal.signal >= 0.5 }

  const components = numericComponents(current)
  if (!components) return { ok: false, message: `Cinema modulation destination "${route.destination}" is not numeric.` }
  const next = components.map(component => {
    let value = component
    if (route.mode === 'add') value = component + signal.signal
    else if (route.mode === 'multiply') value = component * (1 + signal.signal)
    else value = signal.signal
    if (route.clamp) value = clamp(value, Math.min(route.clamp[0], route.clamp[1]), Math.max(route.clamp[0], route.clamp[1]))
    return value
  })
  if (next.some(value => !Number.isFinite(value))) {
    return { ok: false, message: `Cinema modulation route "${route.id}" produced a non-finite value.` }
  }
  return { ok: true, value: Array.isArray(current) ? next as unknown as CinemaParameterValue : next[0] }
}

function conditionMatches(condition: Readonly<CinemaModulationCondition> | undefined, frame: Readonly<CinemaFrameContext>): boolean {
  if (!condition) return true
  if (condition.sectionTypes && !condition.sectionTypes.includes(frame.music.sectionType ?? '')) return false
  if (condition.vocalsActive != null && condition.vocalsActive !== (frame.lyrics.vocalsActive || frame.audio.vocalPresence > 0.05)) return false
  const buildActive = frame.music.sectionType?.toLowerCase().includes('build') === true || frame.audio.buildProgress > 0.05
  const dropActive = frame.music.sectionType?.toLowerCase().includes('drop') === true || frame.audio.dropImpact > 0.05
  if (condition.buildActive != null && condition.buildActive !== buildActive) return false
  if (condition.dropActive != null && condition.dropActive !== dropActive) return false
  if (condition.playing != null && condition.playing !== frame.transport.playing) return false
  return true
}

function resolveQuantizationEventId(
  quantization: CinemaMusicalQuantization,
  frame: Readonly<CinemaFrameContext>,
): CinemaEventId | null {
  if (quantization === 'none') return null
  if (quantization === 'section') return frame.impulses.sectionStart ? frame.impulses.eventIds.sectionStart : null
  const clockId: CinemaMusicalClockId = quantization === 'beat'
    ? 'beat'
    : quantization === '2-beats'
      ? 'beat2'
      : quantization === 'bar'
        ? 'bar'
        : quantization === '4-bars'
          ? 'bar4'
          : quantization === '8-bars'
            ? 'bar8'
            : 'phrase'
  const clock = frame.music.clocks.states[clockId]
  return clock.hit ? clock.eventId : null
}

function evaluateCurve(curve: readonly CinemaCurvePoint[] | undefined, progress: number): number {
  if (!curve || curve.length === 0) return progress
  const points = curve
  if (progress <= points[0].position) return points[0].value
  const last = points[points.length - 1]
  if (progress >= last.position) return last.value
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index]
    if (progress > right.position) continue
    const left = points[index - 1]
    const width = right.position - left.position
    const local = width <= 0 ? 0 : clamp01((progress - left.position) / width)
    if (left.interpolation === 'step') return left.value
    const t = left.interpolation === 'smooth' ? local * local * (3 - 2 * local) : local
    return left.value + (right.value - left.value) * t
  }
  return last.value
}

function validCurve(curve: readonly CinemaCurvePoint[]): boolean {
  let previousPosition = -Infinity
  return curve.length > 0 && curve.every(point => {
    const valid = Number.isFinite(point.position)
      && point.position >= 0
      && point.position <= 1
      && point.position > previousPosition
      && Number.isFinite(point.value)
    previousPosition = point.position
    return valid
  })
}

function sourceUnavailableDiagnostic(
  route: CompiledRoute,
  sample: Readonly<CinemaModulationSourceSample>,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code: 'CINEMA_MODULATION_SOURCE_UNAVAILABLE',
    severity: 'warning',
    message: sample.disabledReason ?? `Cinema modulation source "${route.source.id}" is unavailable.`,
    attribution: { parameterPath: route.definition.destination, stage: 'modulation-runtime' },
    details: { routeId: String(route.definition.id), sourceId: String(route.definition.sourceId) },
  })
}

function routeDiagnostic(
  composition: Readonly<CinemaCompositionDefinition>,
  route: Readonly<CinemaModulationRouteDefinition>,
  code: 'CINEMA_MODULATION_SOURCE_UNKNOWN' | 'CINEMA_MODULATION_ROUTE_INVALID' | 'CINEMA_MODULATION_ROUTE_INCOMPATIBLE',
  message: string,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code,
    severity: 'error',
    message,
    attribution: { compositionId: composition.id, parameterPath: route.destination, stage: 'modulation-validation' },
    details: { routeId: String(route.id), sourceId: String(route.sourceId) },
  })
}

function numericComponents(value: CinemaParameterValue): readonly number[] | null {
  if (typeof value === 'number' && Number.isFinite(value)) return [value]
  if (Array.isArray(value) && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as readonly number[]
  }
  return null
}

function advanceEnvelope(
  state: RouteRuntimeState,
  target: number,
  deltaTimeSec: number,
  durationMs: number,
): number {
  if (durationMs <= 0) {
    state.envelopeStart = target
    state.envelopeTarget = target
    state.envelopeElapsedSec = 0
    return target
  }
  if (target !== state.envelopeTarget) {
    state.envelopeStart = state.envelope
    state.envelopeTarget = target
    state.envelopeElapsedSec = 0
  }
  if (deltaTimeSec <= 0) return state.envelope
  state.envelopeElapsedSec = Math.min(durationMs / 1000, state.envelopeElapsedSec + deltaTimeSec)
  const progress = clamp01(state.envelopeElapsedSec / (durationMs / 1000))
  return state.envelopeStart + (state.envelopeTarget - state.envelopeStart) * progress
}

function smooth(current: number, target: number, deltaTimeSec: number, smoothing: number, initialized: boolean): number {
  if (!initialized || smoothing <= 0) return target
  if (deltaTimeSec <= 0) return current
  const frameScale = Math.max(0.0001, deltaTimeSec * 60)
  const alpha = 1 - Math.pow(smoothing, frameScale)
  return current + (target - current) * clamp01(alpha)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function clamp01(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}
