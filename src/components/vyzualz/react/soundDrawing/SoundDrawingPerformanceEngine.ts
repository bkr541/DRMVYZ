import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceProgram,
  type SharedPerformanceActionIntent,
  type SharedPerformanceContext,
  type SharedPerformanceProgramResolution,
} from '../../../../features/performanceCore'
import type { OscillatorSettings } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'
import { resolveProfessionalScopeLayerSettings } from './SoundDrawingProfessionalScopeLayer'
import { SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID } from './SoundDrawingPerformanceShows'
import { resolveSoundDrawingPerformanceSources } from './SoundDrawingSourceResolver'
import {
  applySoundDrawingBehaviorRouting,
  synchronizeSoundDrawingBehaviorRuntime,
  type SoundDrawingBehaviorEventDefinition,
  type SoundDrawingBehaviorRouteDefinition,
  type SoundDrawingBehaviorTarget,
} from './SoundDrawingBehaviorRuntime'
import {
  DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS,
  DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS,
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES,
  MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES,
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  SOUND_DRAWING_GENERATOR_FAMILIES,
  type SoundDrawingEventBinding,
  type SoundDrawingEventKind,
  type SoundDrawingGeneratorFamily,
  type SoundDrawingLivingRibbonPhysicalControls,
  type SoundDrawingLivingRibbonPhysicalImpulse,
  type SoundDrawingModulationRoute,
  type SoundDrawingModulationTarget,
  type SoundDrawingPerformanceAction,
  type SoundDrawingPerformanceEnvelope,
  type SoundDrawingPerformanceGlobalBlueprint,
  type SoundDrawingPerformanceLayerBlueprint,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingPerformanceShowDefinition,
  type SoundDrawingPerformanceTemporalState,
  type SoundDrawingResolvedPerformanceFrame,
  type SoundDrawingResolvedPerformanceLayer,
} from './SoundDrawingPerformanceTypes'

export interface ResolveSoundDrawingPerformanceInput {
  frame: ReactFrameContext
  settings?: SoundDrawingPerformanceSettings
  manualOscillator: OscillatorSettings
  previousContext?: SharedPerformanceContext | null
  temporalState?: SoundDrawingPerformanceTemporalState
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
  const selectedShowId =
    typeof source.selectedShowId === 'string' && source.selectedShowId in SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID
      ? source.selectedShowId
      : null
  const performanceSource = source.performanceSource === 'generatedVisual'
    ? 'generatedVisual'
    : source.performanceSource === 'activeUserSource' || source.performanceSource === 'activeText' || source.performanceSource === 'activeSvg'
      ? 'activeUserSource'
      : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.performanceSource
  const sourceTreatment = ['preserveIdentity', 'controlledReactive', 'liquidContour', 'abstractDeformation'].includes(
    source.sourceTreatment,
  )
    ? source.sourceTreatment
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTreatment
  const useSourceAs = ['primaryMotif', 'supportingLayer', 'both'].includes(source.useSourceAs)
    ? source.useSourceAs
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.useSourceAs
  const generatorPreference =
    source.generatorPreference === 'authored' ||
    SOUND_DRAWING_GENERATOR_FAMILIES.includes(source.generatorPreference as SoundDrawingGeneratorFamily)
    ? source.generatorPreference
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.generatorPreference
  const autoPerformance = source.autoPerformance === true && selectedShowId !== null
  const showSelected = selectedShowId !== null
  return {
    selectedShowId,
    autoPerformance,
    complexity: clamp01(source.complexity),
    motionIntensity: clamp01(source.motionIntensity),
    reactionIntensity: clamp01(source.reactionIntensity),
    trailIntensity: clamp01(source.trailIntensity),
    generatorPreference: showSelected ? 'authored' : generatorPreference,
    quality: ['auto', 'low', 'medium', 'high'].includes(source.quality)
      ? source.quality
      : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.quality,
    livingRibbon: {
      quality: ['auto', 'low', 'medium', 'high'].includes(source.livingRibbon?.quality)
        ? source.livingRibbon.quality
        : ['auto', 'low', 'medium', 'high'].includes(source.quality)
          ? source.quality
          : DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.quality,
      pointDensity: clamp01(
        source.livingRibbon?.pointDensity ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.pointDensity,
      ),
      tension: clamp01(source.livingRibbon?.tension ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.tension),
      turbulence: clamp01(source.livingRibbon?.turbulence ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.turbulence),
      bodyWidth: clamp01(source.livingRibbon?.bodyWidth ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.bodyWidth),
      trailPersistence: clamp01(
        source.livingRibbon?.trailPersistence ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.trailPersistence,
      ),
      bloom: clamp01(source.livingRibbon?.bloom ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.bloom),
      sparkAmount: clamp01(
        source.livingRibbon?.sparkAmount ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.sparkAmount,
      ),
      centerAttraction: clamp01(
        source.livingRibbon?.centerAttraction ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.centerAttraction,
      ),
      audioReactionDepth: clamp01(
        source.livingRibbon?.audioReactionDepth ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_SETTINGS.audioReactionDepth,
      ),
    },
    performanceSource: showSelected ? 'generatedVisual' : performanceSource,
    sourceTreatment,
    useSourceAs,
    preserveIdentity: source.preserveIdentity !== false,
    contourReactivity: clamp01(
      source.contourReactivity ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.contourReactivity,
    ),
    wholeObjectMotion: clamp01(
      source.wholeObjectMotion ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.wholeObjectMotion,
    ),
    echoStrength: clamp01(source.echoStrength ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.echoStrength),
    sourceTrailStrength: clamp01(
      source.sourceTrailStrength ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTrailStrength,
    ),
    supportingVisualReactivity: clamp01(
      source.supportingVisualReactivity ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.supportingVisualReactivity,
    ),
    locks: showSelected
      ? { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks }
      : {
          ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
          ...(source.locks ?? {}),
        },
    trailLockContract: showSelected
      ? { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.trailLockContract }
      : source.trailLockContract ?? DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.trailLockContract,
  }
}

function buildFallbackMusicFrame(frame: ReactFrameContext): MusicIntelligenceFrame {
  const absoluteBeat = frame.bpm > 0 ? (frame.audioTime * frame.bpm) / 60 : frame.t / 60
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
    : (previousContext?.timingDiscontinuityIdentity ?? 'timing:0')
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

function generatorDefaults(
  generator: SoundDrawingGeneratorFamily,
): Pick<SoundDrawingResolvedPerformanceLayer, 'classicMode' | 'shape' | 'renderMode'> {
  switch (generator) {
    case 'horizontalOscilloscope':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'outline' }
    case 'mirroredOscilloscope':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
    case 'radialOscilloscope':
      return { classicMode: 'radialScope', shape: 'circle', renderMode: 'outline' }
    case 'polarWaveform':
      return { classicMode: 'spiralScope', shape: 'spiral', renderMode: 'outline' }
    case 'lissajousFigure':
      return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'outline' }
    case 'phaseScopeKnot':
      return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'multiTrace' }
    case 'harmonicRibbon':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'ribbon' }
    case 'livingRibbon':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'ribbon' }
    case 'spectralContour':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
    case 'circularBassMembrane':
      return { classicMode: 'radialScope', shape: 'circle', renderMode: 'outline' }
    case 'kaleidoscopicTrace':
      return { classicMode: 'radialScope', shape: 'star', renderMode: 'multiTrace' }
    case 'particleSpline':
      return { classicMode: 'waveform', shape: 'spiral', renderMode: 'dots' }
    case 'vectorFieldStreamlines':
      return { classicMode: 'spiralScope', shape: 'spiral', renderMode: 'multiTrace' }
    case 'audioReactiveAttractor':
      return { classicMode: 'lissajous', shape: 'infinity', renderMode: 'multiTrace' }
    case 'tunnelTrace':
      return { classicMode: 'radialScope', shape: 'hexagon', renderMode: 'multiTrace' }
    case 'stackedWaveformBands':
      return { classicMode: 'waveform', shape: 'line', renderMode: 'multiTrace' }
    case 'professionalScope':
      return { classicMode: 'professionalScope', shape: 'line', renderMode: 'outline' }
  }
}

function normalizeLivingRibbonControls(
  value: Partial<SoundDrawingLivingRibbonPhysicalControls> | undefined,
): SoundDrawingLivingRibbonPhysicalControls {
  const source = value ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS
  return {
    drive: clamp01(source.drive ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.drive),
    turbulence: clamp01(source.turbulence ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.turbulence),
    tension: clamp01(source.tension ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.tension),
    damping: clamp01(source.damping ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.damping),
    spread: clamp01(source.spread ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.spread),
    centerAttraction: clamp01(
      source.centerAttraction ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.centerAttraction,
    ),
    widthTarget: clamp01(source.widthTarget ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.widthTarget),
    twist: clamp(source.twist ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.twist, -1, 1),
    radialPressure: clamp(
      source.radialPressure ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.radialPressure,
      -1,
      1,
    ),
    collapseAmount: clamp01(
      source.collapseAmount ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.collapseAmount,
    ),
    releaseAmount: clamp01(source.releaseAmount ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.releaseAmount),
    directionalDrift: clamp(
      source.directionalDrift ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.directionalDrift,
      -1,
      1,
    ),
    heatDecay: clamp01(source.heatDecay ?? DEFAULT_SOUND_DRAWING_LIVING_RIBBON_PHYSICAL_CONTROLS.heatDecay),
  }
}

function normalizeLivingRibbonImpulse(
  value: SoundDrawingLivingRibbonPhysicalImpulse,
): SoundDrawingLivingRibbonPhysicalImpulse {
  return {
    kind: value.kind,
    identity: value.identity,
    strength: clamp(value.strength, 0, 4),
    direction:
      value.direction == null
        ? undefined
        : [clamp(value.direction[0], -1, 1), clamp(value.direction[1], -1, 1), clamp(value.direction[2], -1, 1)],
    location: value.location == null ? undefined : clamp01(value.location),
    radius: value.radius == null ? undefined : clamp(value.radius, 0.01, 1),
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
    // Matches the authored-show layer default (see SoundDrawingPerformanceShows).
    // Additive accumulation is what produces the core-to-white / halo-to-hue
    // behavior of a real scope beam; 'screen' clamps density at 1.0 and cannot.
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
    source:
      layer.source?.kind === 'generated'
        ? {
            kind: 'generated',
            generator: layer.source.generator,
            identity:
              'identity' in layer.source && typeof layer.source.identity === 'string'
                ? layer.source.identity
                : `generated:${layer.id}:${layer.source.generator}`,
          }
      : layer.source?.kind === 'text'
          ? {
              kind: 'text',
              identity:
                'identity' in layer.source && typeof layer.source.identity === 'string'
                  ? layer.source.identity
                  : `text:${layer.id}`,
              textId: layer.source.textId,
              preserveReadability: layer.source.preserveReadability,
            }
        : layer.source?.kind === 'svg' && layer.source.svgId
            ? {
                kind: 'svg',
                identity:
                  'identity' in layer.source && typeof layer.source.identity === 'string'
                    ? layer.source.identity
                    : `svg:${layer.source.svgId}`,
                svgId: layer.source.svgId,
                renderMode: layer.source.renderMode,
                preserveIdentity: layer.source.preserveIdentity,
              }
          : layer.source?.kind === 'active-user-source'
              ? {
                  kind: 'active-user-source',
                  identity:
                    'identity' in layer.source && typeof layer.source.identity === 'string'
                      ? layer.source.identity
                      : `active:${layer.id}`,
                }
            : { kind: 'generated', generator, identity: `generated:${layer.id}:${generator}` },
    identityProfile: layer.identityProfile ?? 'abstract',
    treatment: layer.treatment ?? 'abstractDeformation',
    preserveIdentity: layer.preserveIdentity === true,
    contourBudget: clamp(layer.contourBudget ?? 0.25, 0, 0.25),
    requestedContourDeformation: clamp(
      layer.requestedContourDeformation ?? (layer.audioDisplacement ?? 0.14) + (layer.jitter ?? 0.04),
      0,
      1,
    ),
    appliedContourDeformation: clamp(
      layer.appliedContourDeformation ?? (layer.audioDisplacement ?? 0.14) + (layer.jitter ?? 0.04),
      0,
      1,
    ),
    readabilityClamped: layer.readabilityClamped === true,
    contourScale: clamp01(layer.contourScale ?? 1),
    allowCharacterDeformation: layer.allowCharacterDeformation !== false,
    allowTextWaveform: layer.allowTextWaveform !== false,
    wholeObjectMotion: clamp01(layer.wholeObjectMotion ?? 1),
    contourReactivity: clamp01(layer.contourReactivity ?? 1),
    echoStrength: clamp01(layer.echoStrength ?? 0),
    sourceTrailStrength: clamp01(layer.sourceTrailStrength ?? 0.5),
    supportingVisualReactivity: clamp01(layer.supportingVisualReactivity ?? 1),
    sourceFailure: layer.sourceFailure ?? null,
    livingRibbonControls: normalizeLivingRibbonControls(layer.livingRibbonControls),
    livingRibbonImpulses: (layer.livingRibbonImpulses ?? []).slice(-16).map(normalizeLivingRibbonImpulse),
    professionalScope:
      generator === 'professionalScope'
        ? resolveProfessionalScopeLayerSettings(layer.professionalScope)
        : null,
    modulationRoutes: (layer.modulationRoutes ?? []).slice(0, 24),
    eventBindings: (layer.eventBindings ?? []).slice(0, 16),
  }
}

function findLayer(
  state: MutablePerformanceState,
  role: SoundDrawingResolvedPerformanceLayer['role'],
): SoundDrawingResolvedPerformanceLayer | null {
  return state.layers.find((layer) => layer.role === role) ?? null
}

function patchLayer(
  layer: SoundDrawingResolvedPerformanceLayer,
  patch: Partial<SoundDrawingPerformanceLayerBlueprint>,
): SoundDrawingResolvedPerformanceLayer {
  return normalizeLayer({
    ...layer,
    ...patch,
    id: layer.id,
    role: layer.role,
    generator: patch.generator ?? layer.generator,
    livingRibbonControls: patch.livingRibbonControls
      ? { ...layer.livingRibbonControls, ...patch.livingRibbonControls }
      : layer.livingRibbonControls,
    livingRibbonImpulses: patch.livingRibbonImpulses ?? layer.livingRibbonImpulses,
    professionalScope:
      patch.professionalScope ??
      (layer.professionalScope
        ? {
            presetId: layer.professionalScope.state.presetId ?? undefined,
            signalMode: layer.professionalScope.state.signalMode,
            signalConditioner: layer.professionalScope.state.signalConditioner,
            trigger: layer.professionalScope.state.trigger,
            timebase: layer.professionalScope.state.timebase,
            beam: layer.professionalScope.state.beam,
            phosphor: layer.professionalScope.state.phosphor,
            crt: layer.professionalScope.state.crt,
            music: layer.professionalScope.state.music,
            monoDelayMs: layer.professionalScope.state.monoDelayMs,
            exposure: layer.professionalScope.exposure,
            transitionSeconds: layer.professionalScope.transitionSeconds,
          }
        : undefined),
  })
}

export function soundDrawingTimingUnitToBeats(
  unit: SoundDrawingPerformanceEnvelope['attack'],
  timeSignature = 4,
): number {
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

const RIBBON_CONTROL_TARGETS = new Set<SoundDrawingNumericTarget>([
  'ribbonDrive',
  'ribbonTurbulence',
  'ribbonTension',
  'ribbonDamping',
  'ribbonSpread',
  'ribbonCenterAttraction',
  'ribbonWidth',
  'ribbonTwist',
  'ribbonRadialPressure',
  'ribbonCollapse',
  'ribbonRelease',
  'ribbonDirectionalDrift',
  'ribbonHeatDecay',
])
const RIBBON_IMPULSE_TARGETS = new Set<SoundDrawingNumericTarget>([
  'ribbonRadialImpact',
  'ribbonLateralShock',
  'ribbonFineRipple',
  'ribbonCollapseImpulse',
  'ribbonReleaseBurst',
  'ribbonTwistImpulse',
  'ribbonLocalizedImpulse',
])

function ribbonControlKey(target: SoundDrawingNumericTarget): keyof SoundDrawingLivingRibbonPhysicalControls | null {
  switch (target) {
    case 'ribbonDrive':
      return 'drive'
    case 'ribbonTurbulence':
      return 'turbulence'
    case 'ribbonTension':
      return 'tension'
    case 'ribbonDamping':
      return 'damping'
    case 'ribbonSpread':
      return 'spread'
    case 'ribbonCenterAttraction':
      return 'centerAttraction'
    case 'ribbonWidth':
      return 'widthTarget'
    case 'ribbonTwist':
      return 'twist'
    case 'ribbonRadialPressure':
      return 'radialPressure'
    case 'ribbonCollapse':
      return 'collapseAmount'
    case 'ribbonRelease':
      return 'releaseAmount'
    case 'ribbonDirectionalDrift':
      return 'directionalDrift'
    case 'ribbonHeatDecay':
      return 'heatDecay'
    default:
      return null
  }
}

function targetValue(layer: SoundDrawingResolvedPerformanceLayer, target: SoundDrawingNumericTarget): number {
  const ribbonKey = ribbonControlKey(target)
  if (ribbonKey) return layer.livingRibbonControls[ribbonKey]
  switch (target) {
    case 'scopeTimebase':
      return layer.professionalScope?.state.timebase.secondsPerDisplay ?? 0
    case 'scopeGain':
      return layer.professionalScope
        ? (layer.professionalScope.state.signalConditioner.gainX + layer.professionalScope.state.signalConditioner.gainY) / 2
        : 1
    case 'scopeGainX':
      return layer.professionalScope?.state.signalConditioner.gainX ?? 1
    case 'scopeGainY':
      return layer.professionalScope?.state.signalConditioner.gainY ?? 1
    case 'scopeTriggerLevel':
      return layer.professionalScope?.state.trigger.level ?? 0
    case 'scopeTriggerStability':
      return layer.professionalScope?.state.trigger.hysteresis ?? 0
    case 'scopeBeamWidth':
      return layer.professionalScope?.state.beam.coreWidthPx ?? 1
    case 'scopeExposure':
      return layer.professionalScope?.exposure ?? 1
    case 'scopePersistence':
      return layer.professionalScope?.state.phosphor.persistenceSeconds ?? 0.35
    case 'scopeBloom':
      return layer.professionalScope?.state.phosphor.mediumBloom ?? 0.16
    case 'opacity':
      return layer.opacity
    case 'strokeWidth':
      return layer.strokeWidth
    case 'scale':
      return layer.scale
    case 'rotation':
      return layer.rotation
    case 'symmetry':
      return layer.symmetry
    case 'traceCount':
      return layer.traceCount
    case 'trailPersistence':
      return layer.trailPersistence
    case 'feedbackAmount':
      return layer.feedbackAmount
    case 'glow':
      return layer.glow
    case 'audioDisplacement':
      return layer.audioDisplacement
    case 'jitter':
      return layer.jitter
    case 'topologyVariant':
      return layer.topologyVariant
    case 'particleCount':
      return layer.particleCount
    default:
      return 0
  }
}

function setTargetValue(
  layer: SoundDrawingResolvedPerformanceLayer,
  target: SoundDrawingNumericTarget,
  value: number,
): SoundDrawingResolvedPerformanceLayer {
  const ribbonKey = ribbonControlKey(target)
  if (ribbonKey) {
    return patchLayer(layer, {
      livingRibbonControls: { ...layer.livingRibbonControls, [ribbonKey]: value },
    })
  }
  const scope = layer.professionalScope
  if (scope) {
    const base = {
      presetId: scope.state.presetId ?? undefined,
      signalMode: scope.state.signalMode,
      signalConditioner: scope.state.signalConditioner,
      trigger: scope.state.trigger,
      timebase: scope.state.timebase,
      beam: scope.state.beam,
      phosphor: scope.state.phosphor,
      crt: scope.state.crt,
      music: scope.state.music,
      monoDelayMs: scope.state.monoDelayMs,
      exposure: scope.exposure,
      transitionSeconds: scope.transitionSeconds,
    }
    switch (target) {
      case 'scopeTimebase':
        return patchLayer(layer, { professionalScope: { ...base, timebase: { ...base.timebase, secondsPerDisplay: value } } })
      case 'scopeGain':
        return patchLayer(layer, { professionalScope: { ...base, signalConditioner: { ...base.signalConditioner, gainX: value, gainY: value } } })
      case 'scopeGainX':
        return patchLayer(layer, { professionalScope: { ...base, signalConditioner: { ...base.signalConditioner, gainX: value } } })
      case 'scopeGainY':
        return patchLayer(layer, { professionalScope: { ...base, signalConditioner: { ...base.signalConditioner, gainY: value } } })
      case 'scopeTriggerLevel':
        return patchLayer(layer, { professionalScope: { ...base, trigger: { ...base.trigger, level: value } } })
      case 'scopeTriggerStability':
        return patchLayer(layer, { professionalScope: { ...base, trigger: { ...base.trigger, hysteresis: value } } })
      case 'scopeBeamWidth':
        return patchLayer(layer, { professionalScope: { ...base, beam: { ...base.beam, coreWidthPx: value } } })
      case 'scopeExposure':
        return patchLayer(layer, { professionalScope: { ...base, exposure: value } })
      case 'scopePersistence':
        return patchLayer(layer, { professionalScope: { ...base, phosphor: { ...base.phosphor, persistenceSeconds: value } } })
      case 'scopeBloom':
        return patchLayer(layer, { professionalScope: { ...base, phosphor: { ...base.phosphor, mediumBloom: value } } })
    }
  }
  return patchLayer(layer, { [target]: value })
}

function impulseKind(target: SoundDrawingNumericTarget): SoundDrawingLivingRibbonPhysicalImpulse['kind'] | null {
  switch (target) {
    case 'ribbonRadialImpact':
      return 'radialImpact'
    case 'ribbonLateralShock':
      return 'lateralShock'
    case 'ribbonFineRipple':
      return 'fineRipple'
    case 'ribbonCollapseImpulse':
      return 'collapseImpulse'
    case 'ribbonReleaseBurst':
      return 'releaseBurst'
    case 'ribbonTwistImpulse':
      return 'twistImpulse'
    case 'ribbonLocalizedImpulse':
      return 'localizedImpulse'
    default:
      return null
  }
}

function appendRibbonImpulse(
  state: MutablePerformanceState,
  target: SoundDrawingBehaviorTarget,
  strength: number,
  context: SharedPerformanceContext,
  bindingId: string,
  eventIdentity: string,
): void {
  const layer = state.layers.find((candidate) => candidate.id === target.layerId)
  const kind = impulseKind(target.target)
  if (!layer || !kind || strength <= 0.0001) return
  const index = state.layers.indexOf(layer)
  const alternatingSign = Math.floor(Math.max(0, context.beatIndex) / 2) % 2 === 0 ? 1 : -1
  const sourceDirection =
    target.direction ?? (kind === 'lateralShock' ? [1, 0.35, 0.15] : kind === 'fineRipple' ? [0.2, 0.75, 1] : [1, 0, 0])
  const direction = target.alternateDirection
    ? ([sourceDirection[0] * alternatingSign, sourceDirection[1], sourceDirection[2]] as const)
    : sourceDirection
  const impulse = normalizeLivingRibbonImpulse({
    kind,
    identity: `${layer.id}:${bindingId}:${eventIdentity}`,
    strength,
    direction,
    location: target.location,
    radius: target.radius,
  })
  state.layers[index] = patchLayer(layer, {
    livingRibbonImpulses: [...layer.livingRibbonImpulses, impulse].slice(-16),
  })
}

function applyBehaviorTargetDelta(
  state: MutablePerformanceState,
  target: SoundDrawingBehaviorTarget,
  delta: number,
  settings: SoundDrawingPerformanceSettings,
  context: SharedPerformanceContext,
  event?: { bindingId: string; eventIdentity: string },
): void {
  const reactionScale =
    settings.reactionIntensity *
    (RIBBON_CONTROL_TARGETS.has(target.target) || RIBBON_IMPULSE_TARGETS.has(target.target)
      ? settings.livingRibbon.audioReactionDepth
      : 1)
  if (RIBBON_IMPULSE_TARGETS.has(target.target)) {
    if (event) appendRibbonImpulse(state, target, delta * reactionScale, context, event.bindingId, event.eventIdentity)
    return
  }
  const layer = state.layers.find((candidate) => candidate.id === target.layerId)
  if (!layer) return
  const current = targetValue(layer, target.target)
  const [minimum, maximum] = target.clamp ?? [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  const index = state.layers.indexOf(layer)
  state.layers[index] = setTargetValue(layer, target.target, clamp(current + delta * reactionScale, minimum, maximum))
}

function applyAction(
  state: MutablePerformanceState,
  action: SoundDrawingPerformanceAction,
  _context: SharedPerformanceContext,
): void {
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
      if (
        state.layers.length < MAX_SOUND_DRAWING_PERFORMANCE_LAYERS &&
        !state.layers.some((layer) => layer.id === action.layer.id)
      ) {
        state.layers.push(normalizeLayer(action.layer))
      }
      break
    case 'retireRole':
      state.layers = state.layers.filter((layer) => layer.role !== action.role)
      break
    case 'pulse':
      // Pulse actions are resolved by the shared behavior-routing runtime after
      // authored scene/cadence state and continuous modulation are established.
      break
    case 'global':
      state.global = { ...state.global, ...action.patch }
      break
  }
}

function collectBehaviorDefinitions(
  state: MutablePerformanceState,
  resolution: SharedPerformanceProgramResolution<SoundDrawingPerformanceAction>,
): { routes: SoundDrawingBehaviorRouteDefinition[]; events: SoundDrawingBehaviorEventDefinition[] } {
  const routes: SoundDrawingBehaviorRouteDefinition[] = []
  const events: SoundDrawingBehaviorEventDefinition[] = []

  // Program event actions previously resolved before per-layer bindings, so
  // retain that insertion and budget order in the shared runtime.
  const eventActions = resolution.scene?.eventActions ?? {}
  for (const [event, actions] of Object.entries(eventActions)) {
    for (let index = 0; index < (actions?.length ?? 0); index += 1) {
      const action = actions?.[index]
      if (!action || action.type !== 'pulse') continue
      const layer = findLayer(state, action.role)
      if (!layer) continue
      events.push({
        id: `${resolution.scene?.id ?? 'none'}:program:${event}:${index}:${action.role}:${action.target}`,
        layerId: layer.id,
        binding: {
          id: `${resolution.scene?.id ?? 'none'}:${event}:${index}`,
          event: action.event,
          target: action.target,
          amount: action.amount,
          envelope: action.envelope,
          lockKey: action.lockKey,
        },
      })
    }
  }

  let layerBindingCount = 0
  for (const layer of state.layers) {
    for (const route of layer.modulationRoutes) routes.push({ layerId: layer.id, route })
    for (const binding of layer.eventBindings) {
      if (layerBindingCount >= MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES) break
      events.push({ id: `${layer.id}:${binding.id}`, layerId: layer.id, binding })
      layerBindingCount += 1
    }
  }
  return { routes, events }
}

const HIGH_ENERGY_SUPPORTING_SECTIONS = new Set(['build', 'preDrop', 'drop'])
const MAX_HIGH_ENERGY_SUPPORTING_LAYERS = 2

const SUPPORTING_OPACITY_CAP: Record<Exclude<SoundDrawingResolvedPerformanceLayer['role'], 'primaryMotif'>, number> = {
  harmonicLayer: 0.18,
  rhythmAccent: 0.22,
  echoLayer: 0.12,
  atmosphereLayer: 0.1,
  transitionLayer: 0.16,
}

const PERFORMANCE_LAYER_PRESENTATION_ORDER: Record<SoundDrawingResolvedPerformanceLayer['role'], number> = {
  atmosphereLayer: 0,
  echoLayer: 1,
  harmonicLayer: 2,
  rhythmAccent: 3,
  transitionLayer: 4,
  primaryMotif: 5,
}

function isHighEnergySupportingContext(context: SharedPerformanceContext): boolean {
  const section = context.macroSectionType ?? context.sectionType ?? 'unknown'
  if (!HIGH_ENERGY_SUPPORTING_SECTIONS.has(section)) return false
  if (section === 'drop') return true
  if (section === 'preDrop') {
    return context.buildProgress >= 0.72 || context.trackRelativeEnergy >= 0.58
  }
  // A globally energetic track must not make support layers appear during the
  // quiet opening of a build. Recruitment follows the local section ramp.
  return context.buildProgress >= 0.35 && context.trackRelativeEnergy >= 0.55
}

function primaryComplexityLimits(generator: SoundDrawingGeneratorFamily): {
  maxTraceCount: number
  maxSymmetry: number
} {
  switch (generator) {
    case 'circularBassMembrane':
    case 'radialOscilloscope':
    case 'polarWaveform':
      return { maxTraceCount: 3, maxSymmetry: 4 }
    case 'phaseScopeKnot':
    case 'lissajousFigure':
    case 'kaleidoscopicTrace':
      return { maxTraceCount: 3, maxSymmetry: 4 }
    case 'harmonicRibbon':
      return { maxTraceCount: 5, maxSymmetry: 1 }
    case 'livingRibbon':
      return { maxTraceCount: 1, maxSymmetry: 2 }
    case 'professionalScope':
      // A measurement scope already contains its own stereo traces. Duplicating
      // them is density, not detail, so complexity keeps one readable scope.
      return { maxTraceCount: 1, maxSymmetry: 1 }
    default:
      return { maxTraceCount: 2, maxSymmetry: 2 }
  }
}

function complexityInteger(maximum: number, complexity: number): number {
  return Math.max(1, Math.round(1 + Math.max(0, maximum - 1) * clamp01(complexity)))
}

export function resolveSoundDrawingPrimaryTraceCount(
  generator: SoundDrawingGeneratorFamily,
  authoredTraceCount: number,
  maximumTraceCount: number,
  complexity: number,
): number {
  if (generator !== 'harmonicRibbon') return complexityInteger(maximumTraceCount, complexity)

  // Harmonic Ribbon's section program authors the maximum useful density for
  // each scene. Complexity scales within that scene instead of replacing it,
  // preserving the intended intro/build/drop contour progression.
  const authoredMaximum = Math.round(clamp(authoredTraceCount, 1, maximumTraceCount))
  const density = 0.25 + clamp01(complexity) * 0.75
  return Math.round(clamp(authoredMaximum * density, 1, authoredMaximum))
}

function primaryTrailPersistenceCeiling(generator: SoundDrawingGeneratorFamily): number {
  if (generator === 'professionalScope') return 0.16
  if (generator === 'harmonicRibbon') return 0.24
  if (generator === 'livingRibbon') return 0.78
  return 0.68
}

/**
 * Enforces the semantic contract of an authored Performance Show:
 * one stable primary generator, optional restrained support only in high-energy
 * sections, and the primary motif composited last so it remains legible.
 */
function applyPerformanceShowIdentityContract(
  state: MutablePerformanceState,
  show: SoundDrawingPerformanceShowDefinition,
  context: SharedPerformanceContext,
  choreographyActive: boolean,
): void {
  const highEnergy = choreographyActive && isHighEnergySupportingContext(context)
  let supportingLayersEnabled = 0

  state.layers = state.layers.map((layer) => {
    if (layer.role === 'primaryMotif') {
      const generator = show.primaryGenerator
      const defaults = generatorDefaults(generator)
      return patchLayer(layer, {
        enabled: true,
        generator,
        source: { kind: 'generated', generator },
        classicMode: defaults.classicMode,
        shape: defaults.shape,
        renderMode: defaults.renderMode,
        opacity: Math.max(0.82, layer.opacity),
        blendMode: 'source-over',
        // Temporal feedback is not a second trail control. The primary history
        // is driven exclusively by Trail Intensity below.
        feedbackAmount: 0,
      })
    }

    const enabled = highEnergy && layer.enabled && supportingLayersEnabled < MAX_HIGH_ENERGY_SUPPORTING_LAYERS
    if (enabled) supportingLayersEnabled += 1
    return patchLayer(layer, {
      enabled,
      opacity: enabled ? Math.min(layer.opacity * 0.35, SUPPORTING_OPACITY_CAP[layer.role]) : 0,
      blendMode: 'screen',
      // Supporting visuals are current-frame accents only. Trail Intensity
      // belongs exclusively to the primary visual, so support cannot leave a
      // second haze field behind it.
      trailPersistence: 0,
      feedbackAmount: 0,
      glow: Math.min(layer.glow * 0.35, 0.28),
      traceCount: Math.min(layer.traceCount, 2),
      symmetry: Math.min(layer.symmetry, 4),
      particleCount: Math.min(Math.round(layer.particleCount * 0.12), 40),
      audioDisplacement: Math.min(layer.audioDisplacement * 0.35, 0.12),
      jitter: Math.min(layer.jitter * 0.25, 0.06),
    })
  })

  // Global history used to act as a second trail control and affected every
  // layer. Per-layer history is authoritative now; the user Trail Intensity
  // control is applied only to the primary motif below.
  state.global.trailPersistence = 0
  state.global.feedbackAmount = 0

  state.layers.sort(
    (left, right) => PERFORMANCE_LAYER_PRESENTATION_ORDER[left.role] - PERFORMANCE_LAYER_PRESENTATION_ORDER[right.role],
  )
}

function applyUserIntensityControls(state: MutablePerformanceState, settings: SoundDrawingPerformanceSettings): void {
  state.layers = state.layers.map((layer) => {
    const ribbon = layer.livingRibbonControls
    const userRibbon = settings.livingRibbon
    const primary = layer.role === 'primaryMotif'
    const limits = primaryComplexityLimits(layer.generator)
    const traceCount = primary
      ? resolveSoundDrawingPrimaryTraceCount(
          layer.generator,
          layer.traceCount,
          limits.maxTraceCount,
          settings.complexity,
        )
      : layer.traceCount
    const symmetry = primary ? complexityInteger(limits.maxSymmetry, settings.complexity) : layer.symmetry
    const trailPersistence = primary
      ? layer.generator === 'professionalScope'
        // Professional Scope already owns a native phosphor surface. A second
        // Canvas history trail would double-expose the same trace.
        ? 0
        : clamp01(
            Math.min(layer.trailPersistence, primaryTrailPersistenceCeiling(layer.generator)) *
              settings.trailIntensity,
          )
      : 0

    let professionalScope = layer.professionalScope
    if (primary && professionalScope) {
      const authoredPersistence = professionalScope.state.phosphor.persistenceSeconds
      // Professional Scope has its own phosphor history in addition to the
      // layer history canvas. Scale that native tail with the same single Trail
      // Intensity control and cap it before it can turn the scope into a cloud.
      const scopePersistence = clamp(authoredPersistence * settings.trailIntensity, 0.015, 0.22)
      // Professional Scope complexity reveals trace detail by tightening the
      // beam and reducing smoothing. It never creates duplicate scope layers.
      professionalScope = {
        ...professionalScope,
        state: {
          ...professionalScope.state,
          timebase: {
            ...professionalScope.state.timebase,
            smoothing: clamp(0.92 - settings.complexity * 0.24, 0.55, 0.92),
          },
          beam: {
            ...professionalScope.state.beam,
            coreWidthPx: clamp(1 - settings.complexity * 0.28, 0.66, 1),
            haloScale: clamp(2.35 - settings.complexity * 0.35, 1.9, 2.35),
          },
          phosphor: {
            ...professionalScope.state.phosphor,
            persistenceSeconds: scopePersistence,
            mediumBloom: Math.min(professionalScope.state.phosphor.mediumBloom, 0.1),
            wideBloom: Math.min(professionalScope.state.phosphor.wideBloom, 0.02),
          },
        },
      }
    }

    return patchLayer(layer, {
      rotation: layer.rotation * settings.motionIntensity,
      phaseOffset: layer.phaseOffset * settings.motionIntensity,
      traceCount,
      symmetry,
      trailPersistence,
      // Trail Intensity is deliberately not a feedback or brightness control.
      feedbackAmount: layer.feedbackAmount,
      glow: layer.generator === 'livingRibbon' ? clamp01(layer.glow * 0.6 + userRibbon.bloom * 0.4) : layer.glow,
      particleCount: layer.particleCount,
      professionalScope: professionalScope
        ? {
            presetId: professionalScope.state.presetId ?? undefined,
            signalMode: professionalScope.state.signalMode,
            signalConditioner: professionalScope.state.signalConditioner,
            trigger: professionalScope.state.trigger,
            timebase: professionalScope.state.timebase,
            beam: professionalScope.state.beam,
            phosphor: professionalScope.state.phosphor,
            crt: professionalScope.state.crt,
            music: professionalScope.state.music,
            monoDelayMs: professionalScope.state.monoDelayMs,
            exposure: clamp(professionalScope.exposure, 0.65, 1.15),
            transitionSeconds: professionalScope.transitionSeconds,
          }
        : undefined,
      livingRibbonControls:
        layer.generator === 'livingRibbon'
          ? {
              ...ribbon,
              drive: clamp01(ribbon.drive * (0.4 + settings.motionIntensity * 0.6)),
              turbulence: clamp01(
                ribbon.turbulence * (0.45 + userRibbon.turbulence * 0.9) * (0.5 + settings.motionIntensity * 0.5),
              ),
              tension: clamp01(ribbon.tension * 0.62 + userRibbon.tension * 0.38),
              widthTarget: clamp01(ribbon.widthTarget * 0.5 + userRibbon.bodyWidth * 0.5),
              centerAttraction: clamp01(ribbon.centerAttraction * 0.68 + userRibbon.centerAttraction * 0.32),
              twist: clamp(ribbon.twist * settings.motionIntensity, -1, 1),
              directionalDrift: clamp(ribbon.directionalDrift * settings.motionIntensity, -1, 1),
            }
          : ribbon,
    })
  })
  state.global.cameraRotation *= settings.motionIntensity
  state.global.cameraX *= settings.motionIntensity
  state.global.cameraY *= settings.motionIntensity
}

function enforceSafetyBounds(state: MutablePerformanceState): void {
  const expensiveGenerators = new Set<SoundDrawingGeneratorFamily>([
    'particleSpline',
    'livingRibbon',
    'vectorFieldStreamlines',
    'audioReactiveAttractor',
    'tunnelTrace',
  ])
  let enabledExpensiveSupportingLayers = 0
  state.layers = state.layers.slice(0, MAX_SOUND_DRAWING_PERFORMANCE_LAYERS).map((layer) => {
    let enabled = layer.enabled
    if (layer.role !== 'primaryMotif' && enabled && expensiveGenerators.has(layer.generator)) {
      enabledExpensiveSupportingLayers += 1
      if (enabledExpensiveSupportingLayers > 1) enabled = false
    }
    return patchLayer(layer, {
      // Safety may retire an expensive supporting layer, but it must never
      // substitute another generator and change the Performance Show identity.
      enabled,
      opacity: enabled ? layer.opacity : 0,
      traceCount: Math.min(
        layer.traceCount,
        layer.source.kind === 'text' || layer.source.kind === 'svg' ? 3 : MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
      ),
      particleCount: Math.min(layer.particleCount, MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES),
      feedbackAmount: MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES > 0 ? layer.feedbackAmount : 0,
    })
  })
  state.global = {
    trailPersistence: 0,
    feedbackAmount: 0,
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
  frame: ReactFrameContext,
  temporalState: SoundDrawingPerformanceTemporalState,
  choreographyActive: boolean,
): MutablePerformanceState {
  const state: MutablePerformanceState = { layers: [], global: { ...DEFAULT_GLOBAL } }
  // Establish the authored visual design first. Cadence, continuous routes, and
  // transient envelopes are only resolved while Auto Performance is enabled.
  for (const intent of resolution.intents) {
    if (intent.action.type !== 'pulse') applyAction(state, intent.action, context)
  }
  if (!choreographyActive) return state

  const definitions = collectBehaviorDefinitions(state, resolution)
  // State-aware sinks preserve Sound Drawing target semantics while the
  // shared runtime owns only smoothing and transient timing state.
  applySoundDrawingBehaviorRouting({
    temporalState,
    context,
    frame,
    settings,
    routes: definitions.routes,
    events: definitions.events,
    applyContinuous: (target, value) => applyBehaviorTargetDelta(state, target, value, settings, context),
    applyEvent: (target, value, bindingId, eventIdentity) =>
      applyBehaviorTargetDelta(state, target, value, settings, context, { bindingId, eventIdentity }),
  })
  return state
}

function resolveBaseDesignProgram(
  show: SoundDrawingPerformanceShowDefinition,
  context: SharedPerformanceContext,
): SharedPerformanceProgramResolution<SoundDrawingPerformanceAction> {
  // Reuse the shared signal frame, but intentionally select only the fallback
  // scene's static scene action. Entry/exit cadence, four-bar evolution,
  // section routing, and event pulses belong to Auto Performance, not selection.
  const shared = resolveSharedPerformanceProgram(show.program, context)
  const scene =
    (show.program.fallbackSceneId
      ? show.program.scenes.find(candidate => candidate.id === show.program.fallbackSceneId)
      : null) ??
    show.program.scenes.find(candidate => candidate.sectionTypes.includes('unknown')) ??
    show.program.scenes[0] ??
    null
  const intents: SharedPerformanceActionIntent<SoundDrawingPerformanceAction>[] = []
  for (let index = 0; index < (scene?.actions?.length ?? 0); index += 1) {
    intents.push({
      reason: 'scene',
      action: scene!.actions![index],
      identity: `${show.program.id}|${scene!.id}|base|scene|${index}`,
    })
  }
  return {
    scene,
    variation: null,
    sectionPhase: shared.sectionPhase,
    signals: shared.signals,
    intents,
    deterministicIdentity: `${show.program.id}|${scene?.id ?? 'none'}|base|${context.runtimeIdentity}`,
  }
}

function applyBaseDesignContract(state: MutablePerformanceState): void {
  // Selecting a show loads its full-size, full-visibility base visual. Auto
  // Performance may later choreograph that design, but the off state must not
  // fall back to Classic Scope or inherit hidden choreography intensity values.
  state.layers = state.layers.map(layer => patchLayer(layer, {
    modulationRoutes: [],
    eventBindings: [],
    ...(layer.role === 'primaryMotif'
      ? {
          enabled: true,
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          rotation: 0,
          phaseOffset: 0,
          feedbackAmount: 0,
        }
      : {
          trailPersistence: 0,
          feedbackAmount: 0,
        }),
  }))
  state.global = {
    trailPersistence: 0,
    feedbackAmount: 0,
    cameraScale: 1,
    cameraRotation: 0,
    cameraX: 0,
    cameraY: 0,
    backgroundFade: 1,
  }
}

function applyHarmonicRibbonPresentationFloor(
  state: MutablePerformanceState,
  show: SoundDrawingPerformanceShowDefinition,
  choreographyActive: boolean,
): void {
  if (show.id !== 'harmonicRibbonReactor') return
  state.layers = state.layers.map(layer => layer.role === 'primaryMotif'
    ? patchLayer(layer, {
        opacity: 1,
        scale: Math.max(1, layer.scale),
        x: 0,
        y: 0,
        // The selected-show base state must visibly read as a ribbon rather
        // than three isolated oscillator lines. Keep one master plus four
        // symmetric supporting contours until choreography takes ownership.
        traceCount: choreographyActive ? layer.traceCount : Math.max(5, layer.traceCount),
        strokeWidth: Math.max(choreographyActive ? 1 : 1.05, layer.strokeWidth),
        glow: Math.max(choreographyActive ? 0.5 : 0.62, layer.glow),
        trailPersistence: choreographyActive
          ? layer.trailPersistence
          : Math.min(layer.trailPersistence, 0.1),
      })
    : layer)
  state.global.cameraScale = Math.max(1, state.global.cameraScale)
  state.global.cameraRotation = 0
  state.global.cameraX = 0
  state.global.cameraY = 0
  state.global.backgroundFade = 1
}

/**
 * Auto Performance precedence is: engine defaults → authored scene/cadence →
 * continuous routes → event envelopes → global choreography intensity controls
 * → hard safety clamps. Manual source selection and parameter locks are excluded
 * so an authored show cannot silently collapse back into the Classic Scope preset.
 */
export function resolveSoundDrawingPerformanceFrame(
  input: ResolveSoundDrawingPerformanceInput,
): SoundDrawingResolvedPerformanceFrame | null {
  const settings = normalizeSettings(input.settings)
  if (settings.selectedShowId == null) return null
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[settings.selectedShowId]
  const choreographyActive = settings.autoPerformance
  const context = buildSoundDrawingPerformanceContext(input.frame, input.previousContext ?? null)
  const resolution = choreographyActive
    ? resolveSharedPerformanceProgram(show.program, context)
    : resolveBaseDesignProgram(show, context)
  const temporalIdentity = [
    context.trackChangeIdentity,
    context.timingDiscontinuityIdentity,
    show.id,
    choreographyActive ? 'choreography' : 'base',
  ].join(':')
  const temporalState = input.temporalState ?? { identity: temporalIdentity }
  if (temporalState.identity !== temporalIdentity) {
    if (!context.trackReplacementDetected) synchronizeSoundDrawingBehaviorRuntime(temporalState, 'sourceReplacement')
    temporalState.identity = temporalIdentity
  }
  const state = resolveState(resolution, context, settings, input.frame, temporalState, choreographyActive)
  applyPerformanceShowIdentityContract(state, show, context, choreographyActive)
  if (choreographyActive) applyUserIntensityControls(state, settings)
  else applyBaseDesignContract(state)
  applyHarmonicRibbonPresentationFloor(state, show, choreographyActive)
  const sourceResolution = resolveSoundDrawingPerformanceSources({
    showId: show.id,
    layers: state.layers,
    oscillator: input.manualOscillator,
    settings,
    context,
  })
  state.layers = sourceResolution.layers
  enforceSafetyBounds(state)
  const authoredSceneId = resolution.scene?.id ?? `${show.id}-none`
  const sceneId = choreographyActive ? authoredSceneId : `base:${authoredSceneId}`
  const finalSourceLayer = state.layers.find((layer) => layer.source.kind !== 'generated')
  const finalSupportingGeneratedLayers = state.layers
    .filter((layer) => layer.source.kind === 'generated' && layer.role !== 'primaryMotif')
    .map((layer) => layer.id)
  return {
    showId: show.id,
    showName: show.name,
    sceneId,
    choreographyActive,
    context,
    ...sourceResolution,
    activeSourceKind: finalSourceLayer?.source.kind ?? sourceResolution.activeSourceKind,
    activeIdentityProfile: finalSourceLayer?.identityProfile ?? sourceResolution.activeIdentityProfile,
    activeTreatment: finalSourceLayer?.treatment ?? sourceResolution.activeTreatment,
    preserveIdentity: finalSourceLayer?.preserveIdentity ?? sourceResolution.preserveIdentity,
    contourBudget: finalSourceLayer?.contourBudget ?? sourceResolution.contourBudget,
    requestedContourDeformation:
      finalSourceLayer?.requestedContourDeformation ?? sourceResolution.requestedContourDeformation,
    appliedContourDeformation:
      finalSourceLayer?.appliedContourDeformation ?? sourceResolution.appliedContourDeformation,
    readabilityClampApplied: finalSourceLayer?.readabilityClamped ?? sourceResolution.readabilityClampApplied,
    supportingGeneratedLayers: finalSupportingGeneratedLayers,
    layers: state.layers,
    global: state.global,
    fallbackUsed: choreographyActive && (
      resolution.scene == null ||
      authoredSceneId.includes('fallback') ||
      context.sectionConfidence < 0.3 ||
      sourceResolution.sourceFallbackState != null
    ),
    deterministicIdentity: `${resolution.deterministicIdentity}:${choreographyActive ? 'choreography' : 'base'}:${sourceResolution.activeSourceKind}:${sourceResolution.activeTreatment}`,
    appliedActionReasons: [
      ...resolution.intents.map((intent) => intent.reason),
      ...(choreographyActive ? [] : ['baseDesign']),
    ],
  }
}
