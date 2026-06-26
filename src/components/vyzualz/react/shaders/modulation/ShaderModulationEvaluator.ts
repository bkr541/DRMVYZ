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

// Sources that live in ShaderAudioUniformFrame
const AUDIO_SOURCE_KEYS = new Set<string>([
  'sub','bass','lowMid','mid','highMid','high','air',
  'kick','snare','hat',
  'kickHit','snareHit','hatHit','beatHit','downbeatHit',
  'energy','tension','buildProgress','dropImpact',
  'spectralCentroid','spectralFlux','spectralSpread','spectralFlatness',
])

function getSourceValue(
  source: ModulationSourceId,
  audio:  ShaderAudioUniformFrame,
  timing: ShaderTimingUniformFrame,
): number {
  if (AUDIO_SOURCE_KEYS.has(source)) {
    const v = (audio as unknown as Record<string, number>)[source]
    return isFinite(v) ? v : 0
  }
  switch (source) {
    case 'beatPhase':        return timing.beatPhase
    case 'barPhase':         return timing.barPhase
    case 'phrasePhase':      return timing.phrasePhase
    case 'sectionPhase':     return timing.sectionPhase
    case 'playbackProgress': return timing.playbackProgress
  }
  return 0
}

// ── Per-route internal state ──────────────────────────────────────────────────

interface RouteState {
  // Continuous mode — attack/release smoother
  smoother: AudioSmoother | null
  // Trigger / envelope mode
  envelope: ShaderModulationEnvelope | null
  // Edge detection for trigger mode
  prevAboveThreshold: boolean
}

// ── ShaderModulationEvaluator ─────────────────────────────────────────────────
//
// Computes effective parameter values for one frame by applying all active
// modulation routes to a set of base parameter values.
//
// Stateful (owns per-route smoothers and envelopes).
// Not re-entrant — call once per render frame.
//
// Evaluation data flow per route:
//   1. rawSource  ← getSourceValue(route.source, audio, timing)
//   2. curved     ← applyCurve(rawSource, route.curve)
//   3. flipped    ← route.invert ? (1 - curved) : curved
//   4. mapped     ← outputMin + flipped * (outputMax - outputMin)
//   5. scaledSignal ← mapped * route.amount
//   6. effectiveValue ← combineMode(baseValue, scaledSignal, param)
//
// After all routes for a param, the value is clamped to [param.min, param.max].

export class ShaderModulationEvaluator {
  private readonly _stateMap = new Map<string, RouteState>()
  private _lastSceneId: string | null = null

  // ── Main evaluation entry point ───────────────────────────────────────────

  /**
   * Compute effective param values for the current frame.
   *
   * @param matrix      The modulation matrix for the active scene.
   * @param def         The active ShaderDefinition.
   * @param audio       Current ShaderAudioUniformFrame from ShaderAudioBridge.
   * @param timing      Current ShaderTimingUniformFrame from ShaderAudioBridge.
   * @param baseValues  The preset's unmodulated parameter values.
   * @param dt          Seconds since the last frame.
   * @param sceneId     ID of the active shader scene; change triggers state reset.
   */
  evaluate(
    matrix:     ShaderModulationMatrix,
    def:        ShaderDefinition,
    audio:      ShaderAudioUniformFrame,
    timing:     ShaderTimingUniformFrame,
    baseValues: ShaderParamValues,
    dt:         number,
    sceneId:    string,
  ): ModulationEvaluationFrame {
    if (sceneId !== this._lastSceneId) {
      this._resetAll()
      this._lastSceneId = sceneId
    }

    const safeDt = Math.max(0, dt)
    const routes = matrix.getActiveRoutes()

    // Build result map starting from base values
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

    for (const route of routes) {
      const param = def.params.find(p => p.id === route.targetParamId)
      if (!param) continue

      const rawSource  = clamp01(getSourceValue(route.source, audio, timing))
      const routeSignal = this._processRouteSignal(route, rawSource, safeDt)

      if (routeSignal === null) continue  // phase/mode produced no output this frame

      const result = params[param.id]
      if (!result) continue

      result.effectiveValue = applyRouteToParam(
        param,
        result.effectiveValue,
        routeSignal,
        route,
      )
      result.modulationActive = true
      activeRouteCount++
    }

    return { params, activeRouteCount }
  }

  // ── Per-route signal processing ───────────────────────────────────────────

  private _processRouteSignal(
    route:     ShaderModulationRoute,
    rawSource: number,
    dt:        number,
  ): number | null {
    let state = this._stateMap.get(route.id)
    if (!state) {
      state = { smoother: null, envelope: null, prevAboveThreshold: false }
      this._stateMap.set(route.id, state)
    }

    let processedSource: number

    switch (route.mode) {
      case 'continuous': {
        if (!state.smoother) {
          state.smoother = new AudioSmoother(
            Math.max(0.001, route.attackMs  / 1000),
            Math.max(0.001, route.releaseMs / 1000),
          )
        }
        state.smoother = ensureSmootherTiming(
          state.smoother, route.attackMs, route.releaseMs,
        )
        processedSource = state.smoother.update(rawSource, dt)
        break
      }

      case 'trigger': {
        const env = this._getOrCreateEnvelope(state, route)
        const aboveThreshold = rawSource >= 0.5
        if (aboveThreshold && !state.prevAboveThreshold) {
          env.trigger()
        }
        state.prevAboveThreshold = aboveThreshold
        env.update(dt)
        processedSource = env.value
        break
      }

      case 'envelope': {
        const env = this._getOrCreateEnvelope(state, route)
        env.gate(rawSource >= 0.5)
        env.update(dt)
        processedSource = env.value
        break
      }

      case 'phase': {
        // Pass-through: no smoothing, no envelope. Ideal for phase sources.
        processedSource = rawSource
        break
      }
    }

    // Shape the signal
    const curved  = applyCurve(processedSource!, route.curve)
    const flipped = route.invert ? (1 - curved) : curved
    const mapped  = route.outputMin + flipped * (route.outputMax - route.outputMin)
    const signal  = mapped * route.amount

    return isFinite(signal) ? signal : null
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

  // ── Reset ─────────────────────────────────────────────────────────────────

  private _resetAll(): void {
    for (const state of this._stateMap.values()) {
      state.smoother?.reset()
      state.envelope?.reset()
      state.prevAboveThreshold = false
    }
    this._stateMap.clear()
  }

  /** Expose for testing: force a scene reset without changing the scene ID. */
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
