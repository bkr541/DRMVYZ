import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  curveSharedPerformanceProgress,
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceProgram,
  type SharedPerformanceContext,
  type SharedPerformanceProgramResolution,
} from '../../../../features/performanceCore'
import type { OscillatorSettings } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import { SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID } from './SoundDrawingPerformanceShows'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES,
  MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  type SoundDrawingEventBinding,
  type SoundDrawingEventKind,
  type SoundDrawingGeneratorFamily,
  type SoundDrawingModulationRoute,
  type SoundDrawingModulationTarget,
  type SoundDrawingPerformanceAction,
  type SoundDrawingPerformanceEnvelope,
  type SoundDrawingPerformanceGlobalBlueprint,
  type SoundDrawingPerformanceLayerBlueprint,
  type SoundDrawingPerformanceLockKey,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingResolvedPerformanceFrame,
  type SoundDrawingResolvedPerformanceLayer,
} from './SoundDrawingPerformanceTypes'

export interface ResolveSoundDrawingPerformanceInput {
  frame: ReactFrameContext
  settings?: SoundDrawingPerformanceSettings
  manualOscillator: OscillatorSettings
  previousContext?: SharedPerformanceContext | null
}

interface MutablePerformanceState {
  layers: SoundDrawingResolvedPerformanceLayer[]
  global: Required<SoundDrawingPerformanceGlobalBlueprint>
}

const DEFAULT_GLOBAL: Required<SoundDrawingPerformanceGlobalBlueprint> = {
  trailPersistence: 0.55,
  feedbackAmount: 0.12,
  cameraScale: 1,
  cameraRotation: 0,
  cameraX: 0,
  cameraY: 0,
  backgroundFade: 1,
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value, min)))
}

function clamp01(value: unknown): number {
  return clamp(finite(value), 0, 1)
}

function normalizeSettings(value: SoundDrawingPerformanceSettings | undefined): SoundDrawingPerformanceSettings {
  const source = value ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
  const selectedShowId = source.selectedShowId in SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID
    ? source.selectedShowId
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId
  return {
    selectedShowId,
    autoPerformance: source.autoPerformance === true,
    complexity: clamp01(source.complexity),
    motionIntensity: clamp01(source.motionIntensity),
    reactionIntensity: clamp01(source.reactionIntensity),
    trailIntensity: clamp01(source.trailIntensity),
    generatorPreference: source.generatorPreference ?? 'authored',
    locks: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
      ...(source.locks ?? {}),
    },
  }
}

function buildFallbackMusicFrame(frame: ReactFrameContext): MusicIntelligenceFrame {
  const absoluteBeat = frame.bpm > 0 ? frame.audioTime * frame.bpm / 60 : frame.t / 60
  const beatIndex = Math.max(0, Math.floor(absoluteBeat))
  const beatInBar = beatIndex % 4
  const bass = clamp01(frame.audio.bass)
  const mid = clamp01(frame.audio.mid)
  const high = clamp01(frame.audio.high)
  const volume = clamp01(frame.audio.volume)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: frame.audioTime,
    frameId: Math.max(0, Math.floor(frame.t)),
    trackId: frame.trackKey ?? null,
    sourceId: frame.trackKey ?? null,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: bass,
      bass,
      lowMid: mid,
      mid,
      high,
      air: high,
      volume,
      normalizedSub: bass,
      normalizedBass: bass,
      normalizedLowMid: mid,
      normalizedMid: mid,
      normalizedHigh: high,
      normalizedAir: high,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: Math.max(0, finite(frame.bpm)),
      bpmConfidence: frame.bpm > 0 ? 0.45 : 0,
      beatPhase: clamp01(frame.beatPhase),
      beatHit: frame.beatHit,
      beatIndex,
      beatInBar,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: frame.beatHit && beatInBar === 0,
      kickHit: frame.beatHit && beatInBar % 2 === 0,
      kickStrength: frame.beatHit && beatInBar % 2 === 0 ? Math.max(0.35, bass) : 0,
      snareHit: frame.beatHit && beatInBar % 2 === 1,
      snareStrength: frame.beatHit && beatInBar % 2 === 1 ? Math.max(0.3, mid) : 0,
      hatHit: high > 0.35 && frame.beatPhase < 0.12,
      hatStrength: high,
      transient: frame.beatHit ? Math.max(bass, mid, high) : 0,
      transientConfidence: 0.35,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: volume,
      shortTerm: volume,
      longTerm: volume,
      peak: Math.max(volume, bass, mid, high),
      rms: volume,
      percentile: volume,
      spectralFlux: Math.max(0, high - mid * 0.25),
      tension: Math.max(mid, high) * 0.5,
      complexity: (bass + mid + high) / 3,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: frame.bpm > 0,
      sections: Boolean(frame.trackSections?.length || frame.resolvedSection),
      trackEnergyCurve: DEFAULT_MI_FRAME.capabilities?.trackEnergyCurve ?? false,
      stemCurves: DEFAULT_MI_FRAME.capabilities?.stemCurves ?? false,
      lyrics: DEFAULT_MI_FRAME.capabilities?.lyrics ?? false,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.4,
      rhythm: frame.bpm > 0 ? 0.45 : 0.2,
      section: frame.resolvedSection?.confidence ?? 0.25,
    },
  }
}

export function buildSoundDrawingPerformanceContext(
  frame: ReactFrameContext,
  previousContext: SharedPerformanceContext | null = null,
): SharedPerformanceContext {
  const miFrame = frame.musicIntelligence ?? buildFallbackMusicFrame(frame)
  const discontinuityIdentity = frame.timingDiscontinuity
    ? `timing:${frame.trackKey ?? 'none'}:${frame.audioTime.toFixed(4)}`
    : previousContext?.timingDiscontinuityIdentity ?? 'timing:0'
  return buildSharedPerformanceContext({
    audioTimeSec: frame.audioTime,
    frame: miFrame,
    analysis: frame.trackAnalysis ?? null,
    resolvedSections: frame.trackSections ?? miFrame.resolvedSections,
    trackIdentity: frame.trackKey ?? miFrame.trackId ?? miFrame.sourceId,
    trackChangeIdentity: `track:${frame.trackKey ?? miFrame.trackId ?? 'none'}`,
    timingDiscontinuityIdentity: discontinuityIdentity,
    previous: previousContext,
  })
}

function generatorDefaults(generator: SoundDrawingGeneratorFamily): Pick<SoundDrawingResolvedPerformanceLayer, 'classicMode' | 'shape' | 'renderMode'> {
  switch (generator) {
    case 'horizontalOscilloscope': return { classicMode: 'waveform', shape: 'line', renderMode: 'outline' }
    case 'mirroredOscilloscope': return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
    case 'radialOscilloscope': return { classicMode: 'radialScope', shape: 'circle', renderMode: 'outline' }
    case 'polarWaveform': return { classicMode: 'spiralScope', shape: 'spiral', renderMode: 'outline' }
    case 'lissajousFigure': return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'outline' }
    case 'phaseScopeKnot': return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'multiTrace' }
    case 'harmonicRibbon': return { classicMode: 'waveform', shape: 'line', renderMode: 'ribbon' }
    case 'spectralContour': return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
    case 'circularBassMembrane': return { classicMode: 'radialScope', shape: 'circle', renderMode: 'outline' }
    case 'kaleidoscopicTrace': return { classicMode: 'radialScope', shape: 'star', renderMode: 'multiTrace' }
    case 'particleSpline': return { classicMode: 'waveform', shape: 'spiral', renderMode: 'dots' }
    case 'vectorFieldStreamlines': return { classicMode: 'spiralScope', shape: 'spiral', renderMode: 'multiTrace' }
    case 'audioReactiveAttractor': return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'multiTrace' }
    case 'tunnelTrace': return { classicMode: 'radialScope', shape: 'hexagon', renderMode: 'multiTrace' }
    case 'stackedWaveformBands': return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
  }
}

function normalizeLayer(layer: SoundDrawingPerformanceLayerBlueprint): SoundDrawingResolvedPerformanceLayer {
  const generator = layer.generator
  const defaults = generatorDefaults(generator)
  return {
    id: layer.id,
    role: layer.role,
    enabled: layer.enabled !== false,
    generator,
    blendMode: layer.blendMode ?? 'screen',
    opacity: clamp01(layer.opacity ?? 0.8),
    strokeWidth: clamp(layer.strokeWidth ?? 1, 0.25, 3),
    traceCount: Math.round(clamp(layer.traceCount ?? 1, 1, MAX_SOUND_DRAWING_PERFORMANCE_TRACES)),
    symmetry: Math.round(clamp(layer.symmetry ?? 1, 1, 8)),
    scale: clamp(layer.scale ?? 1, 0.1, 2),
    x: clamp(layer.x ?? 0, -1, 1),
    y: clamp(layer.y ?? 0, -1, 1),
    rotation: clamp(layer.rotation ?? 0, -360, 360),
    phaseOffset: clamp(layer.phaseOffset ?? 0, -1, 1),
    trailPersistence: clamp01(layer.trailPersistence ?? 0.55),
    feedbackAmount: clamp01(layer.feedbackAmount ?? 0.12),
    glow: clamp01(layer.glow ?? 0.55),
    colorRole: layer.colorRole ?? 'primary',
    topologyVariant: Math.round(clamp(layer.topologyVariant ?? 0, 0, 7)),
    renderMode: layer.renderMode ?? defaults.renderMode,
    classicMode: layer.classicMode ?? defaults.classicMode,
    shape: layer.shape ?? defaults.shape,
    audioDisplacement: clamp(layer.audioDisplacement ?? 0.14, 0, 0.25),
    jitter: clamp(layer.jitter ?? 0.04, 0, 0.25),
    particleCount: Math.round(clamp(layer.particleCount ?? 0, 0, MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES)),
    modulationRoutes: (layer.modulationRoutes ?? []).slice(0, 8),
    eventBindings: (layer.eventBindings ?? []).slice(0, 8),
  }
}

function actionLockKey(action: SoundDrawingPerformanceAction): SoundDrawingPerformanceLockKey | null {
  if ('lockKey' in action && action.lockKey) return action.lockKey
  switch (action.type) {
    // A scene always establishes the authored baseline. Recruitment locks are
    // restored after authored/event/modulation work so they never suppress the
    // primary layer or leave the renderer without a valid scene.
    case 'scene': return null
    case 'recruitLayer':
    case 'retireRole': return 'layerRecruitment'
    case 'patchRole': return action.lockKey ?? 'topology'
    case 'pulse': return action.lockKey ?? 'reaction'
    case 'global': return action.lockKey ?? 'camera'
  }
}

function findLayer(state: MutablePerformanceState, role: SoundDrawingResolvedPerformanceLayer['role']): SoundDrawingResolvedPerformanceLayer | null {
  return state.layers.find(layer => layer.role === role) ?? null
}

function patchLayer(layer: SoundDrawingResolvedPerformanceLayer, patch: Partial<SoundDrawingPerformanceLayerBlueprint>): SoundDrawingResolvedPerformanceLayer {
  return normalizeLayer({ ...layer, ...patch, id: layer.id, role: layer.role, generator: patch.generator ?? layer.generator })
}

function eventSignal(context: SharedPerformanceContext, event: SoundDrawingEventKind): { ageBeats: number; strength: number } {
  const beatPhase = clamp(context.beatPhase, 0, 0.999999)
  const rhythm = context.intelligence.rhythm
  const useGridFallback = !context.capabilities.rhythmEvents || context.confidence.rhythm < 0.25
  switch (event) {
    case 'beat':
      return rhythm.beatHit || (useGridFallback && context.boundaries.beatBoundary)
        ? { ageBeats: beatPhase, strength: Math.max(0.35, context.transient, context.energy * 0.5) }
        : { ageBeats: Number.POSITIVE_INFINITY, strength: 0 }
    case 'downbeat':
      return rhythm.downbeatHit || (useGridFallback && context.downbeat && context.boundaries.beatBoundary)
        ? { ageBeats: beatPhase, strength: Math.max(0.65, context.energy) }
        : { ageBeats: Number.POSITIVE_INFINITY, strength: 0 }
    case 'kick': {
      const fallback = useGridFallback && context.beatWithinBar % 2 === 0
        ? Math.max(0.25, context.bass * 0.8)
        : 0
      return context.kick || fallback > 0
        ? { ageBeats: beatPhase, strength: Math.max(context.kickStrength, fallback) }
        : { ageBeats: Number.POSITIVE_INFINITY, strength: 0 }
    }
    case 'snare': {
      const fallback = useGridFallback && context.beatWithinBar % 2 === 1
        ? Math.max(0.22, context.mid * 0.65, context.spectralFlux * 0.5)
        : 0
      return context.snare || fallback > 0
        ? { ageBeats: beatPhase, strength: Math.max(context.snareStrength, fallback) }
        : { ageBeats: Number.POSITIVE_INFINITY, strength: 0 }
    }
    case 'hat': {
      if (!context.hat && !useGridFallback) return { ageBeats: Number.POSITIVE_INFINITY, strength: 0 }
      const subdivision = context.absoluteBeat * 4
      const ageBeats = (subdivision - Math.floor(subdivision)) / 4
      return { ageBeats, strength: Math.max(context.hatStrength, context.high * 0.65) }
    }
  }
}

export function soundDrawingTimingUnitToBeats(unit: SoundDrawingPerformanceEnvelope['attack'], timeSignature = 4): number {
  switch (unit) {
    case '1/32beat': return 1 / 32
    case '1/16beat': return 1 / 16
    case '1/8beat': return 1 / 8
    case '1/4beat': return 1 / 4
    case '1/2beat': return 1 / 2
    case '1beat': return 1
    case '2beats': return 2
    case '1bar': return Math.max(1, timeSignature)
    case '2bars': return Math.max(1, timeSignature) * 2
    case '4bars': return Math.max(1, timeSignature) * 4
  }
}

export function resolveSoundDrawingMusicalEnvelope(
  elapsedBeats: number,
  envelope: SoundDrawingPerformanceEnvelope,
  timeSignature = 4,
): number {
  return resolveSharedPerformanceEventEnvelope(elapsedBeats, {
    attack: soundDrawingTimingUnitToBeats(envelope.attack, timeSignature),
    hold: soundDrawingTimingUnitToBeats(envelope.hold, timeSignature),
    release: soundDrawingTimingUnitToBeats(envelope.release, timeSignature),
    curve: envelope.curve,
  })
}

type SoundDrawingNumericTarget = SoundDrawingEventBinding['target'] | SoundDrawingModulationTarget

function targetValue(layer: SoundDrawingResolvedPerformanceLayer, target: SoundDrawingNumericTarget): number {
  switch (target) {
    case 'opacity': return layer.opacity
    case 'strokeWidth': return layer.strokeWidth
    case 'scale': return layer.scale
    case 'rotation': return layer.rotation
    case 'symmetry': return layer.symmetry
    case 'traceCount': return layer.traceCount
    case 'trailPersistence': return layer.trailPersistence
    case 'feedbackAmount': return layer.feedbackAmount
    case 'glow': return layer.glow
    case 'audioDisplacement': return layer.audioDisplacement
    case 'jitter': return layer.jitter
    case 'topologyVariant': return layer.topologyVariant
  }
}

function setTargetValue(
  layer: SoundDrawingResolvedPerformanceLayer,
  target: SoundDrawingNumericTarget,
  value: number,
): SoundDrawingResolvedPerformanceLayer {
  return patchLayer(layer, { [target]: value })
}

function applyPulse(
  state: MutablePerformanceState,
  role: SoundDrawingResolvedPerformanceLayer['role'],
  event: SoundDrawingEventKind,
  target: SoundDrawingEventBinding['target'],
  amount: number,
  envelope: SoundDrawingPerformanceEnvelope,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): void {
  const layer = findLayer(state, role)
  if (!layer) return
  const signal = eventSignal(context, event)
  if (!Number.isFinite(signal.ageBeats) || signal.strength <= 0) return
  const envelopeValue = resolveSoundDrawingMusicalEnvelope(signal.ageBeats, envelope, context.timeSignature)
  const value = targetValue(layer, target) + amount * envelopeValue * signal.strength * settings.reactionIntensity
  const index = state.layers.indexOf(layer)
  state.layers[index] = setTargetValue(layer, target, value)
}

function applyAction(
  state: MutablePerformanceState,
  action: SoundDrawingPerformanceAction,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): void {
  const lockKey = actionLockKey(action)
  if (lockKey && settings.locks[lockKey]) return
  switch (action.type) {
    case 'scene':
      state.layers = action.layers.slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS).map(normalizeLayer)
      state.global = { ...DEFAULT_GLOBAL, ...(action.global ?? {}) }
      break
    case 'patchRole': {
      const layer = findLayer(state, action.role)
      if (!layer) return
      const index = state.layers.indexOf(layer)
      state.layers[index] = patchLayer(layer, action.patch)
      break
    }
    case 'recruitLayer':
      if (state.layers.length < MAX_SOUND_DRAWING_PERFORMANCE_LAYERS && !state.layers.some(layer => layer.id === action.layer.id)) {
        state.layers.push(normalizeLayer(action.layer))
      }
      break
    case 'retireRole':
      state.layers = state.layers.filter(layer => layer.role !== action.role)
      break
    case 'pulse':
      applyPulse(state, action.role, action.event, action.target, action.amount, action.envelope, context, settings)
      break
    case 'global':
      state.global = { ...state.global, ...action.patch }
      break
  }
}

function modulationSourceValue(context: SharedPerformanceContext, route: SoundDrawingModulationRoute): number {
  const value = context[route.source]
  const normalized = clamp01(typeof value === 'number' ? value : 0)
  const smoothed = route.smoothing && route.smoothing > 0
    ? normalized * (1 - clamp01(route.smoothing)) + context.trackRelativeEnergy * clamp01(route.smoothing)
    : normalized
  // Attack/release are deterministic response-shape controls rather than
  // frame-history filters. This keeps route output identical after seek/loop.
  const attack = Math.max(0, finite(route.attack))
  const release = Math.max(0, finite(route.release))
  const attacked = attack > 0 ? 1 - Math.exp(-smoothed / Math.max(0.001, attack)) : smoothed
  const released = release > 0 ? Math.pow(clamp01(attacked), 1 + release * 2) : attacked
  const shaped = curveSharedPerformanceProgress(released, route.curve ?? 'linear')
  return route.min + (route.max - route.min) * shaped * finite(route.amount, 1)
}

function applyModulationRoute(
  layer: SoundDrawingResolvedPerformanceLayer,
  route: SoundDrawingModulationRoute,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): SoundDrawingResolvedPerformanceLayer {
  if (route.lockKey && settings.locks[route.lockKey]) return layer
  if (route.sectionFilter?.length && !route.sectionFilter.includes(context.macroSectionType ?? context.sectionType ?? 'unknown')) return layer
  if (route.minConfidence != null && context.confidence.overall < route.minConfidence) return layer
  const value = modulationSourceValue(context, route)
  const current = targetValue(layer, route.target)
  const unclamped = current + value * settings.reactionIntensity
  const [min, max] = route.clamp ?? [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  return setTargetValue(layer, route.target, clamp(unclamped, min, max))
}

function applyContinuousModulation(
  state: MutablePerformanceState,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): void {
  state.layers = state.layers.map(layer => {
    let next = layer
    for (const route of layer.modulationRoutes) next = applyModulationRoute(next, route, context, settings)
    return next
  })
}

function applyLayerEventBindings(
  state: MutablePerformanceState,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): void {
  let applied = 0
  for (const layer of state.layers) {
    for (const binding of layer.eventBindings) {
      if (applied >= MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES) return
      if (binding.lockKey && settings.locks[binding.lockKey]) continue
      applyPulse(state, layer.role, binding.event, binding.target, binding.amount, binding.envelope, context, settings)
      applied += 1
    }
  }
}

function manualGenerator(oscillator: OscillatorSettings): SoundDrawingGeneratorFamily {
  if (oscillator.sourceType !== 'classic') {
    if (oscillator.builtinShape === 'circle') return 'circularBassMembrane'
    if (oscillator.builtinShape === 'infinity') return 'phaseScopeKnot'
    if (oscillator.builtinShape === 'spiral') return 'polarWaveform'
    return 'kaleidoscopicTrace'
  }
  switch (oscillator.classicMode) {
    case 'lissajous': return 'lissajousFigure'
    case 'radialScope': return 'radialOscilloscope'
    case 'spiralScope': return 'polarWaveform'
    default: return 'horizontalOscilloscope'
  }
}

function applyUserLocks(
  state: MutablePerformanceState,
  settings: SoundDrawingPerformanceSettings,
  oscillator: OscillatorSettings,
): void {
  let primary = state.layers.find(layer => layer.role === 'primaryMotif') ?? state.layers[0]
  if (!primary) return
  if (settings.locks.layerRecruitment) {
    state.layers = [primary]
    primary = state.layers[0]
  }
  const index = state.layers.indexOf(primary)
  let next = primary
  if (settings.locks.generator) next = patchLayer(next, { generator: manualGenerator(oscillator) })
  if (settings.locks.topology) {
    next = patchLayer(next, {
      symmetry: oscillator.mirrorX || oscillator.mirrorY ? 2 : 1,
      traceCount: oscillator.duplicateTraces,
      renderMode: oscillator.renderMode,
    })
  }
  if (settings.locks.transform) {
    next = patchLayer(next, {
      scale: oscillator.pathScale,
      rotation: 0,
      audioDisplacement: oscillator.audioDisplacement,
    })
  }
  if (settings.locks.reaction) {
    next = patchLayer(next, {
      jitter: oscillator.highJitter,
      glow: clamp01(oscillator.beatBloom),
      audioDisplacement: oscillator.audioDisplacement,
    })
  }
  state.layers[index] = next
  if (settings.locks.trail) state.global.trailPersistence = 1 - clamp01(oscillator.autoSectionMode ? 0.08 : 0.2)
  if (settings.locks.feedback) state.global.feedbackAmount = 0
  if (settings.locks.color) {
    state.layers = state.layers.map(layer => patchLayer(layer, { colorRole: 'primary' }))
  }
  if (settings.locks.camera) {
    state.global.cameraScale = 1
    state.global.cameraRotation = 0
    state.global.cameraX = 0
    state.global.cameraY = 0
  }
}

function applyUserIntensityControls(state: MutablePerformanceState, settings: SoundDrawingPerformanceSettings): void {
  const maximumLayers = Math.max(1, Math.min(MAX_SOUND_DRAWING_PERFORMANCE_LAYERS, 1 + Math.floor(settings.complexity * (MAX_SOUND_DRAWING_PERFORMANCE_LAYERS - 1) + 1e-6)))
  const enabledLayers = state.layers.filter(layer => layer.enabled)
  const disabledLayers = state.layers.filter(layer => !layer.enabled)
  state.layers = [...enabledLayers.slice(0, maximumLayers), ...disabledLayers].slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
  state.layers = state.layers.map(layer => patchLayer(layer, {
    rotation: layer.rotation * settings.motionIntensity,
    phaseOffset: layer.phaseOffset * settings.motionIntensity,
    traceCount: 1 + (layer.traceCount - 1) * settings.complexity,
    trailPersistence: layer.trailPersistence * (0.35 + settings.trailIntensity * 0.65),
    feedbackAmount: layer.feedbackAmount * settings.trailIntensity,
    particleCount: layer.particleCount * settings.complexity,
  }))
  state.global.trailPersistence = state.global.trailPersistence * (0.25 + settings.trailIntensity * 0.75)
  state.global.feedbackAmount *= settings.trailIntensity
  state.global.cameraRotation *= settings.motionIntensity
  state.global.cameraX *= settings.motionIntensity
  state.global.cameraY *= settings.motionIntensity
}

function applyGeneratorPreference(state: MutablePerformanceState, settings: SoundDrawingPerformanceSettings): void {
  if (settings.generatorPreference === 'authored' || settings.locks.generator) return
  const primary = state.layers.find(layer => layer.role === 'primaryMotif')
  if (!primary) return
  const index = state.layers.indexOf(primary)
  state.layers[index] = patchLayer(primary, { generator: settings.generatorPreference })
}

function enforceSafetyBounds(state: MutablePerformanceState): void {
  const expensiveGenerators = new Set<SoundDrawingGeneratorFamily>([
    'particleSpline',
    'vectorFieldStreamlines',
    'audioReactiveAttractor',
    'tunnelTrace',
  ])
  let expensiveCount = 0
  state.layers = state.layers
    .slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    .map(layer => {
      const expensive = expensiveGenerators.has(layer.generator)
      expensiveCount += expensive ? 1 : 0
      const generator = expensive && expensiveCount > 2
        ? (layer.role === 'atmosphereLayer' ? 'spectralContour' : 'horizontalOscilloscope')
        : layer.generator
      return normalizeLayer({
        ...layer,
        generator,
        traceCount: Math.min(layer.traceCount, MAX_SOUND_DRAWING_PERFORMANCE_TRACES),
        particleCount: Math.min(layer.particleCount, MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES),
        feedbackAmount: MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES > 0 ? layer.feedbackAmount : 0,
      })
    })
  state.global = {
    trailPersistence: clamp01(state.global.trailPersistence),
    feedbackAmount: MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES > 0 ? clamp01(state.global.feedbackAmount) : 0,
    cameraScale: clamp(state.global.cameraScale, 0.55, 1.45),
    cameraRotation: clamp(state.global.cameraRotation, -45, 45),
    cameraX: clamp(state.global.cameraX, -0.2, 0.2),
    cameraY: clamp(state.global.cameraY, -0.2, 0.2),
    backgroundFade: clamp01(state.global.backgroundFade),
  }
}

function resolveState(
  resolution: SharedPerformanceProgramResolution<SoundDrawingPerformanceAction>,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
  manualOscillator: OscillatorSettings,
): MutablePerformanceState {
  const state: MutablePerformanceState = { layers: [], global: { ...DEFAULT_GLOBAL } }
  // Establish the authored scene/cadence first, then continuous routes, then
  // all transient event envelopes. This preserves the documented precedence.
  for (const intent of resolution.intents) {
    if (intent.action.type !== 'pulse') applyAction(state, intent.action, context, settings)
  }
  applyContinuousModulation(state, context, settings)
  for (const intent of resolution.intents) {
    if (intent.action.type === 'pulse') applyAction(state, intent.action, context, settings)
  }
  applyLayerEventBindings(state, context, settings)
  applyGeneratorPreference(state, settings)
  applyUserIntensityControls(state, settings)
  applyUserLocks(state, settings, manualOscillator)
  enforceSafetyBounds(state)
  return state
}

/**
 * Actual Sound Drawing precedence is: engine defaults → authored scene/cadence →
 * continuous routes → event envelopes → user intensity controls → explicit locks
 * → hard safety clamps. Locks therefore restore the user's manual values after
 * every authored or reactive mutation, while clamps remain absolute.
 */
export function resolveSoundDrawingPerformanceFrame(
  input: ResolveSoundDrawingPerformanceInput,
): SoundDrawingResolvedPerformanceFrame | null {
  const settings = normalizeSettings(input.settings)
  if (!settings.autoPerformance) return null
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[settings.selectedShowId]
  const context = buildSoundDrawingPerformanceContext(input.frame, input.previousContext ?? null)
  const resolution = resolveSharedPerformanceProgram(show.program, context)
  const state = resolveState(resolution, context, settings, input.manualOscillator)
  const sceneId = resolution.scene?.id ?? `${show.id}-none`
  return {
    showId: show.id,
    showName: show.name,
    sceneId,
    context,
    layers: state.layers,
    global: state.global,
    fallbackUsed: resolution.scene == null || sceneId.includes('fallback') || context.sectionConfidence < 0.3,
    deterministicIdentity: resolution.deterministicIdentity,
    appliedActionReasons: resolution.intents.map(intent => intent.reason),
  }
}
