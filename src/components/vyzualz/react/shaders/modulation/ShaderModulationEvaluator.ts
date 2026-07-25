import type {
  ShaderDefinition,
  ShaderParamDef,
  ShaderParamValues,
  FloatParamDef,
  IntegerParamDef,
  Vec2ParamDef,
  RGBA,
  Vec2,
} from '../registry/shaderRegistryTypes'
import type {
  ShaderAudioUniformFrame,
} from '../audio/shaderAudioTypes'
import type {
  ShaderTimingUniformFrame,
} from '../audio/shaderAudioTypes'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore/context'
import { getConditionSourceValue, getModulationSourceValue, getTriggerSourceValue } from '../../../../../features/musicIntelligence/selectors'
import { getMISourceDef } from '../../../../../lib/miSourceRegistry'
import { AudioSmoother }                 from '../audio/ShaderAudioSmoothing'
import type {
  ShaderModulationRoute,
  ModulationCurve,
  ModulationEvaluationFrame,
  ModulationParamResult,
  ModulationSourceId,
} from './shaderModulationTypes'
import { ShaderModulationEnvelope }      from './ShaderModulationEnvelope'
import type { ShaderModulationMatrix }   from './ShaderModulationMatrix'

// ── Curve library ─────────────────────────────────────────────────────────────

export function applyCurve(x: number, curve: ModulationCurve): number {
  // x is guaranteed 0..1 before entering; output is 0..1
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  switch (curve) {
    case 'linear':
      return t
    case 'easeIn':
      return t * t
    case 'easeOut':
      return 1 - (1 - t) * (1 - t)
    case 'easeInOut':
      return t < 0.5
        ? 2 * t * t
        : 1 - 2 * (1 - t) * (1 - t)
    case 'exponential':
      return t * t * t
    case 'logarithmic':
      // Maps 0→0, 1→1 with a concave (fast start, slow end) curve using natural log.
      // log1p(x * (e-1)) / log(e) = log1p(x * (e-1))
      return Math.log1p(t * (Math.E - 1))
    case 'stepped':
      // 8 discrete steps
      return Math.floor(t * 8) / 8
  }
}

// ── Source lookup ─────────────────────────────────────────────────────────────

const SHADER_AUDIO_ALIAS_KEYS = new Set<string>([
  'highMid',
  'kickHit', 'snareHit', 'hatHit', 'beatHit', 'downbeatHit',
])

function getSourceValue(
  source: ModulationSourceId,
  audio: ShaderAudioUniformFrame,
  timing: ShaderTimingUniformFrame,
  miFrame: MusicIntelligenceFrame | null | undefined,
): number {
  // Shader-only aliases preserve the historical route vocabulary without
  // shadowing canonical registry IDs such as bass, kick, or energy.
  if (SHADER_AUDIO_ALIAS_KEYS.has(source)) {
    const value = (audio as unknown as Record<string, number>)[source]
    if (Number.isFinite(value)) return value
  }
  switch (source) {
    case 'barPhase': return timing.barPhase
    case 'phrasePhase': return timing.phrasePhase
    case 'sectionPhase': return timing.sectionPhase
    case 'playbackProgress': return timing.playbackProgress
  }

  // Canonical source IDs resolve through the shared MI registry and selectors.
  // This removes the Shader ENGINE's parallel, drifting source vocabulary.
  if (miFrame) {
    const sourceDef = getMISourceDef(source)
    if (sourceDef?.isTrigger) return getTriggerSourceValue(miFrame, source) ? 1 : 0
    if (sourceDef?.isCondition) return getConditionSourceValue(miFrame, source) ? 1 : 0
    const value = getModulationSourceValue(miFrame, source)
    return Number.isFinite(value) ? value : 0
  }

  // Graceful no-MI fallback for legacy routes and renderer boot frames.
  const audioFallback: Readonly<Record<string, number>> = {
    sub: audio.sub,
    bass: audio.bass,
    lowMid: audio.lowMid,
    mid: audio.mid,
    high: audio.high,
    air: audio.air,
    nSub: audio.sub,
    nBass: audio.bass,
    nLowMid: audio.lowMid,
    nMid: audio.mid,
    nHigh: audio.high,
    nAir: audio.air,
    kick: audio.kick,
    snare: audio.snare,
    hat: audio.hat,
    energy: audio.energy,
    tension: audio.tension,
    buildProgress: audio.buildProgress,
    dropImpact: audio.dropImpact,
    spectralCentroid: audio.spectralCentroid,
    spectralFlux: audio.spectralFlux,
    spectralSpread: audio.spectralSpread,
    spectralFlatness: audio.spectralFlatness,
  }
  const fallback = audioFallback[source]
  if (Number.isFinite(fallback)) return fallback

  switch (source) {
    case 'beat': return audio.beatHit
    case 'downbeat': return audio.downbeatHit
    case 'beatPhase': return timing.beatPhase
    case 'phrase4': return timing.phrase4Progress
    case 'phrase8': return timing.phrase8Progress
    case 'phrase16': return timing.phrase16Progress
    case 'phrase32': return timing.phrase32Progress
    case 'phrase4Hit': return timing.phrase4Hit
    case 'phrase8Hit': return timing.phrase8Hit
    case 'phrase16Hit': return timing.phrase16Hit
    case 'phrase32Hit': return timing.phrase32Hit
    case 'sectionProgress': return timing.sectionPhase
  }
  return 0
}

// ── Route context resolution ──────────────────────────────────────────────────

function routeMatchesContext(
  route: ShaderModulationRoute,
  context: SharedPerformanceContext | null | undefined,
): boolean {
  const conditions = route.conditions
  if (!conditions) return true
  if (!context) return false

  const sectionType = context.macroSectionType ?? context.sectionType ?? 'unknown'
  if (conditions.sectionTypes?.length && !conditions.sectionTypes.includes(sectionType)) return false
  if (conditions.excludeSectionTypes?.includes(sectionType)) return false
  if (conditions.sectionPhases?.length && !conditions.sectionPhases.includes(context.macroSectionPhase)) return false
  if (conditions.sectionOccurrences?.length && !conditions.sectionOccurrences.includes(context.sectionOccurrence)) return false
  if (conditions.dropOccurrences?.length && !conditions.dropOccurrences.includes(context.dropOccurrence)) return false
  if (conditions.minimumEnergy != null && context.energy < conditions.minimumEnergy) return false
  if (conditions.maximumEnergy != null && context.energy > conditions.maximumEnergy) return false
  if (conditions.minimumBuildProgress != null && context.buildProgress < conditions.minimumBuildProgress) return false
  if (conditions.maximumBuildProgress != null && context.buildProgress > conditions.maximumBuildProgress) return false
  if (conditions.requiredCapabilities?.some(capability => !context.capabilities[capability])) return false
  return true
}

function sourceIsAvailable(
  source: ModulationSourceId,
  route: ShaderModulationRoute,
  context: SharedPerformanceContext | null | undefined,
): boolean {
  if (SHADER_AUDIO_ALIAS_KEYS.has(source)
    || source === 'barPhase'
    || source === 'phrasePhase'
    || source === 'sectionPhase'
    || source === 'playbackProgress') return true
  if (!context) return true
  if (!context.intelligence.supports(source)) return false
  return context.intelligence.sourceConfidence(source) >= (route.minimumConfidence ?? 0)
}

function resolveRouteTarget(
  route: ShaderModulationRoute,
  def: ShaderDefinition,
): ShaderParamDef | null {
  for (const targetId of [route.targetParamId, ...(route.fallbackTargetParamIds ?? [])]) {
    const param = def.params.find(candidate => candidate.id === targetId)
    if (param?.modulatable && ShaderModulationMatrixTargetSupport.has(param.type)) return param
  }
  return null
}

const ShaderModulationMatrixTargetSupport = new Set(['float', 'integer', 'boolean', 'color', 'vec2'])

function resolveRouteSource(
  route: ShaderModulationRoute,
  audio: ShaderAudioUniformFrame,
  timing: ShaderTimingUniformFrame,
  miFrame: MusicIntelligenceFrame | null | undefined,
  context: SharedPerformanceContext | null | undefined,
): { source: ModulationSourceId; value: number } | null {
  const candidates = [route.source, ...(route.fallbackSources ?? [])]
  for (const source of candidates) {
    if (!sourceIsAvailable(source, route, context)) continue
    return { source, value: clamp01(getSourceValue(source, audio, timing, miFrame)) }
  }
  return null
}

// ── Per-route internal state ──────────────────────────────────────────────────

interface RouteState {
  smoother: AudioSmoother | null
  envelope: ShaderModulationEnvelope | null
  prevAboveThreshold: boolean
}

// ── ShaderModulationEvaluator ─────────────────────────────────────────────────

export class ShaderModulationEvaluator {
  private readonly _stateMap = new Map<string, RouteState>()
  private _lastSceneId: string | null = null

  evaluate(
    matrix:     ShaderModulationMatrix,
    def:        ShaderDefinition,
    audio:      ShaderAudioUniformFrame,
    timing:     ShaderTimingUniformFrame,
    baseValues: ShaderParamValues,
    dt:         number,
    sceneId:    string,
    miFrame?:   MusicIntelligenceFrame | null,
    context?:   SharedPerformanceContext | null,
  ): ModulationEvaluationFrame {
    const transportReconstructed = Boolean(context && (
      context.seekDetected
      || context.loopWrapDetected
      || context.trackReplacementDetected
      || context.boundaries.timingDiscontinuity
    ))
    const sceneChanged = sceneId !== this._lastSceneId
    const reconstruct = sceneChanged || transportReconstructed
    if (reconstruct) {
      this._resetAll()
      this._lastSceneId = sceneId
    }

    const safeDt = Math.max(0, dt)
    const routes = matrix.getActiveRoutes()
    const params: Record<string, ModulationParamResult> = {}
    for (const param of def.params) {
      const base = baseValues[param.id] ?? getParamDefault(param)
      params[param.id] = {
        paramId: param.id,
        baseValue: base,
        effectiveValue: base,
        modulationActive: false,
      }
    }

    let activeRouteCount = 0
    const activeRouteIds: string[] = []
    const suppressedRouteIds: string[] = []
    const resolvedSourceByRouteId: Record<string, ModulationSourceId> = {}
    const resolvedTargetByRouteId: Record<string, string> = {}

    for (const route of routes) {
      const param = resolveRouteTarget(route, def)
      if (!param || !routeMatchesContext(route, context)) {
        suppressedRouteIds.push(route.id)
        continue
      }

      const resolved = resolveRouteSource(route, audio, timing, miFrame, context)
      if (!resolved) {
        suppressedRouteIds.push(route.id)
        continue
      }
      resolvedSourceByRouteId[route.id] = resolved.source
      resolvedTargetByRouteId[route.id] = param.id

      const threshold = clamp01(route.threshold ?? (route.mode === 'continuous' || route.mode === 'phase' ? 0 : 0.5))
      const gatedSource = (route.mode === 'continuous' || route.mode === 'phase') && resolved.value < threshold
        ? 0
        : resolved.value
      const routeSignal = this._processRouteSignal(route, gatedSource, safeDt, reconstruct)
      if (routeSignal === null) {
        suppressedRouteIds.push(route.id)
        continue
      }

      const result = params[param.id]
      if (!result) continue
      result.effectiveValue = applyRouteToParam(param, result.effectiveValue, routeSignal, route)
      result.modulationActive = true
      activeRouteCount += 1
      activeRouteIds.push(route.id)
    }

    return {
      params,
      activeRouteCount,
      activeRouteIds,
      suppressedRouteIds,
      resolvedSourceByRouteId,
      resolvedTargetByRouteId,
    }
  }

  private _processRouteSignal(
    route: ShaderModulationRoute,
    rawSource: number,
    dt: number,
    reconstruct: boolean,
  ): number | null {
    let state = this._stateMap.get(route.id)
    if (!state) {
      state = { smoother: null, envelope: null, prevAboveThreshold: false }
      this._stateMap.set(route.id, state)
    }

    const threshold = clamp01(route.threshold ?? (route.mode === 'trigger' || route.mode === 'envelope' ? 0.5 : 0))
    let processedSource: number

    switch (route.mode) {
      case 'continuous': {
        if (!state.smoother) {
          state.smoother = new AudioSmoother(
            Math.max(0.001, route.attackMs / 1000),
            Math.max(0.001, route.releaseMs / 1000),
          )
          if (reconstruct) state.smoother.reset(rawSource)
        }
        state.smoother = ensureSmootherTiming(state.smoother, route.attackMs, route.releaseMs)
        if (reconstruct) state.smoother.reset(rawSource)
        processedSource = state.smoother.update(rawSource, dt)
        break
      }

      case 'trigger': {
        const env = this._getOrCreateEnvelope(state, route)
        const aboveThreshold = rawSource >= threshold
        if (aboveThreshold && (!state.prevAboveThreshold || reconstruct)) env.trigger()
        state.prevAboveThreshold = aboveThreshold
        env.update(dt)
        processedSource = env.value
        break
      }

      case 'envelope': {
        const env = this._getOrCreateEnvelope(state, route)
        env.gate(rawSource >= threshold)
        env.update(dt)
        processedSource = env.value
        break
      }

      case 'phase':
        processedSource = rawSource
        break
    }

    const curved = applyCurve(processedSource, route.curve)
    const flipped = route.invert ? 1 - curved : curved
    const mapped = route.outputMin + flipped * (route.outputMax - route.outputMin)
    const signal = mapped * route.amount
    return Number.isFinite(signal) ? signal : null
  }

  private _getOrCreateEnvelope(
    state: RouteState,
    route: ShaderModulationRoute,
  ): ShaderModulationEnvelope {
    if (!state.envelope) {
      state.envelope = new ShaderModulationEnvelope(
        route.attackMs, route.holdMs, route.releaseMs, route.retrigger,
      )
    } else {
      state.envelope.setTiming(route.attackMs, route.holdMs, route.releaseMs)
      state.envelope.setRetrigger(route.retrigger)
    }
    return state.envelope
  }

  private _resetAll(): void {
    for (const state of this._stateMap.values()) {
      state.smoother?.reset()
      state.envelope?.reset()
      state.prevAboveThreshold = false
    }
    this._stateMap.clear()
  }

  _resetForTest(): void { this._resetAll() }
}

// ── Combine-mode application ──────────────────────────────────────────────────
//
// Combines a modulation signal with the current effective parameter value.
// `signal` is the output of the full route pipeline (shaped and scaled).
//
// For float/integer:
//   add:      eff = base + signal * range          (signal moves base within range)
//   multiply: eff = base * (1 + signal)            (signal scales base)
//   replace:  eff = min + mapped * range            (signal replaces base absolutely)
//     where `mapped` = |signal| (we use abs so negative amounts read as "inverted replace")
//
// For color (RGBA):
//   add:      each rgb channel += signal * 1.0 (treating 0..1 as the full channel range)
//   multiply: each rgb channel *= (1 + signal)
//   replace:  each rgb channel = mapped (0..1 from |signal|)
//   alpha is always preserved from base.
//
// For vec2:
//   applied uniformly to both components using per-axis range.
//
// For boolean:
//   The effective boolean is: signal > 0 ? true : baseBoolean

function applyRouteToParam(
  param:       ShaderParamDef,
  currentEff:  import('../registry/shaderRegistryTypes').ShaderParamValue,
  signal:      number,
  route:       ShaderModulationRoute,
): import('../registry/shaderRegistryTypes').ShaderParamValue {
  const absSignal = Math.abs(signal)

  switch (param.type) {
    case 'float':
    case 'integer': {
      const fp    = param as FloatParamDef | IntegerParamDef
      const base  = typeof currentEff === 'number' ? currentEff : fp.default
      const range = fp.max - fp.min
      let eff: number

      switch (route.combineMode) {
        case 'add':
          eff = base + signal * range
          break
        case 'multiply':
          eff = base * (1 + signal)
          break
        case 'replace':
          eff = fp.min + absSignal * range
          break
      }

      eff = clamp(eff!, fp.min, fp.max)
      return param.type === 'integer' ? Math.round(eff) : eff
    }

    case 'boolean': {
      const base = typeof currentEff === 'boolean' ? currentEff : param.default
      return signal > 0 ? true : base
    }

    case 'color': {
      const base = (Array.isArray(currentEff) && currentEff.length === 4
        ? currentEff
        : param.default) as RGBA

      let r = base[0], g = base[1], b = base[2]
      const a = base[3]

      switch (route.combineMode) {
        case 'add':
          r = clamp01(r + signal)
          g = clamp01(g + signal)
          b = clamp01(b + signal)
          break
        case 'multiply':
          r = clamp01(r * (1 + signal))
          g = clamp01(g * (1 + signal))
          b = clamp01(b * (1 + signal))
          break
        case 'replace':
          r = clamp01(absSignal)
          g = clamp01(absSignal)
          b = clamp01(absSignal)
          break
      }

      return [r, g, b, a] as RGBA
    }

    case 'vec2': {
      const vp   = param as Vec2ParamDef
      const base = (Array.isArray(currentEff) && currentEff.length === 2
        ? currentEff
        : vp.default) as Vec2

      let [x, y] = base

      switch (route.combineMode) {
        case 'add':
          x = clamp(x + signal * (vp.max[0] - vp.min[0]), vp.min[0], vp.max[0])
          y = clamp(y + signal * (vp.max[1] - vp.min[1]), vp.min[1], vp.max[1])
          break
        case 'multiply':
          x = clamp(x * (1 + signal), vp.min[0], vp.max[0])
          y = clamp(y * (1 + signal), vp.min[1], vp.max[1])
          break
        case 'replace':
          x = vp.min[0] + absSignal * (vp.max[0] - vp.min[0])
          y = vp.min[1] + absSignal * (vp.max[1] - vp.min[1])
          x = clamp(x, vp.min[0], vp.max[0])
          y = clamp(y, vp.min[1], vp.max[1])
          break
      }

      return [x, y] as Vec2
    }

    default:
      return currentEff
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function getParamDefault(
  param: ShaderParamDef,
): import('../registry/shaderRegistryTypes').ShaderParamValue {
  switch (param.type) {
    case 'float': case 'integer': return param.default
    case 'boolean':  return param.default
    case 'color':    return [...param.default] as RGBA
    case 'vec2':     return [...param.default] as Vec2
    case 'gradient': return param.default.slice()
    case 'enum':     return param.default
    case 'trigger':  return false
    case 'texture':  return null
  }
}

function ensureSmootherTiming(
  smoother:  AudioSmoother,
  attackMs:  number,
  releaseMs: number,
): AudioSmoother {
  // AudioSmoother stores timing at construction. If the route was edited,
  // recreate with new timing. This avoids touching the smoother internals.
  const newAttack  = Math.max(0.001, attackMs  / 1000)
  const newRelease = Math.max(0.001, releaseMs / 1000)
  // @ts-expect-error – reading private fields for change detection only
  if (smoother._attackSec !== newAttack || smoother._releaseSec !== newRelease) {
    const preserved = smoother.value
    const next = new AudioSmoother(newAttack, newRelease)
    // Inject current value so there's no step-change when timing is updated
    // @ts-expect-error – injecting private field for continuity
    next._value = preserved
    return next
  }
  return smoother
}
