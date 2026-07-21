import type { SharedPerformanceContext, SharedPerformanceEnvelopeCurve } from '../../../../features/performanceCore'
import type { BuiltinOscillatorShape, ClassicScopeMode, OscillatorRenderMode } from '../ReactTypes'

export const MAX_SOUND_DRAWING_PERFORMANCE_LAYERS = 6
export const MAX_SOUND_DRAWING_PERFORMANCE_TRACES = 6
export const MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES = 384
export const MAX_SOUND_DRAWING_PERFORMANCE_FEEDBACK_PASSES = 1
export const MAX_SOUND_DRAWING_PERFORMANCE_ENVELOPES = 12
export const MAX_SOUND_DRAWING_TEXT_DUPLICATES = 3
export const MAX_SOUND_DRAWING_SVG_DUPLICATES = 3

export type SoundDrawingPerformanceShowId =
  | 'radialPressureSystem'
  | 'harmonicRibbonReactor'
  | 'phaseKnotCathedral'
  | 'livingRibbonSystem'

export type SoundDrawingLayerRole =
  | 'primaryMotif'
  | 'harmonicLayer'
  | 'rhythmAccent'
  | 'echoLayer'
  | 'atmosphereLayer'
  | 'transitionLayer'

export type SoundDrawingGeneratorFamily =
  | 'horizontalOscilloscope'
  | 'mirroredOscilloscope'
  | 'radialOscilloscope'
  | 'polarWaveform'
  | 'lissajousFigure'
  | 'phaseScopeKnot'
  | 'harmonicRibbon'
  | 'livingRibbon'
  | 'spectralContour'
  | 'circularBassMembrane'
  | 'kaleidoscopicTrace'
  | 'particleSpline'
  | 'vectorFieldStreamlines'
  | 'audioReactiveAttractor'
  | 'tunnelTrace'
  | 'stackedWaveformBands'

export type SoundDrawingBlendMode = 'screen' | 'lighter' | 'source-over'
export type SoundDrawingColorRole = 'primary' | 'secondary' | 'accent' | 'inverted'
export type SoundDrawingGeneratorPreference = 'authored' | SoundDrawingGeneratorFamily
export type SoundDrawingVisualQuality = 'auto' | 'low' | 'medium' | 'high'

export type SoundDrawingPerformanceSourceSelection =
  | 'generatedVisual'
  | 'activeText'
  | 'activeSvg'
  | 'activeUserSource'

export type SoundDrawingSourceTreatment =
  | 'preserveIdentity'
  | 'controlledReactive'
  | 'liquidContour'
  | 'abstractDeformation'

export type SoundDrawingSourceUsePolicy = 'primaryMotif' | 'supportingLayer' | 'both'

export type SoundDrawingIdentityProfile =
  | 'abstract'
  | 'readableText'
  | 'logo'
  | 'illustration'
  | 'originalArtwork'

export type SoundDrawingPerformanceSource =
  | { kind: 'generated'; generator: SoundDrawingGeneratorFamily }
  | { kind: 'text'; textId?: string; preserveReadability: boolean }
  | { kind: 'svg'; svgId?: string; renderMode: 'original-artwork' | 'traced-path'; preserveIdentity: boolean }
  | { kind: 'active-user-source' }

export type SoundDrawingResolvedPerformanceSource =
  | { kind: 'generated'; identity: string; generator: SoundDrawingGeneratorFamily }
  | { kind: 'text'; identity: string; textId?: string; preserveReadability: boolean }
  | { kind: 'svg'; identity: string; svgId: string; renderMode: 'original-artwork' | 'traced-path'; preserveIdentity: boolean }
  | { kind: 'active-user-source'; identity: string }

export const SOUND_DRAWING_GENERATOR_FAMILIES: readonly SoundDrawingGeneratorFamily[] = [
  'horizontalOscilloscope',
  'mirroredOscilloscope',
  'radialOscilloscope',
  'polarWaveform',
  'lissajousFigure',
  'phaseScopeKnot',
  'harmonicRibbon',
  'livingRibbon',
  'spectralContour',
  'circularBassMembrane',
  'kaleidoscopicTrace',
  'particleSpline',
  'vectorFieldStreamlines',
  'audioReactiveAttractor',
  'tunnelTrace',
  'stackedWaveformBands',
]

export type SoundDrawingPerformanceLockKey =
  | 'generator'
  | 'layerRecruitment'
  | 'topology'
  | 'trail'
  | 'feedback'
  | 'transform'
  | 'camera'
  | 'color'
  | 'reaction'
  | 'sourceSelection'
  | 'sourceTreatment'
  | 'preserveIdentity'
  | 'wholeObjectMotion'
  | 'contourReactivity'
  | 'rotation'
  | 'scale'
  | 'glow'
  | 'echoBehavior'
  | 'trailBehavior'

export type SoundDrawingModulationSource =
  | 'bass'
  | 'mid'
  | 'high'
  | 'energy'
  | 'trackRelativeEnergy'
  | 'spectralFlux'
  | 'tension'
  | 'complexity'
  | 'buildProgress'
  | 'sectionProgress'
  | 'phraseProgress'
  | 'vocalEnergy'

export type SoundDrawingModulationCapability = keyof SharedPerformanceContext['capabilities']

export type SoundDrawingModulationTarget =
  | 'opacity'
  | 'strokeWidth'
  | 'traceCount'
  | 'symmetry'
  | 'scale'
  | 'rotation'
  | 'trailPersistence'
  | 'feedbackAmount'
  | 'glow'
  | 'audioDisplacement'
  | 'jitter'

export type SoundDrawingEventKind = 'beat' | 'kick' | 'snare' | 'hat' | 'downbeat'
export type SoundDrawingEventTarget =
  | 'opacity'
  | 'strokeWidth'
  | 'scale'
  | 'rotation'
  | 'symmetry'
  | 'traceCount'
  | 'feedbackAmount'
  | 'glow'
  | 'jitter'
  | 'topologyVariant'

export type SoundDrawingEnvelopeTimingUnit =
  | '1/32beat'
  | '1/16beat'
  | '1/8beat'
  | '1/4beat'
  | '1/2beat'
  | '1beat'
  | '2beats'
  | '1bar'
  | '2bars'
  | '4bars'

export interface SoundDrawingPerformanceEnvelope {
  attack: SoundDrawingEnvelopeTimingUnit
  hold: SoundDrawingEnvelopeTimingUnit
  release: SoundDrawingEnvelopeTimingUnit
  curve: SharedPerformanceEnvelopeCurve
}

export interface SoundDrawingModulationRoute {
  id: string
  source: SoundDrawingModulationSource
  target: SoundDrawingModulationTarget
  min: number
  max: number
  amount: number
  curve?: SharedPerformanceEnvelopeCurve
  smoothing?: number
  attack?: number
  release?: number
  sectionFilter?: readonly string[]
  minConfidence?: number
  capability?: SoundDrawingModulationCapability
  clamp?: readonly [number, number]
  lockKey?: SoundDrawingPerformanceLockKey
}

export interface SoundDrawingEventBinding {
  id: string
  event: SoundDrawingEventKind
  target: SoundDrawingEventTarget
  amount: number
  envelope: SoundDrawingPerformanceEnvelope
  lockKey?: SoundDrawingPerformanceLockKey
}

export interface SoundDrawingPerformanceLayerBlueprint {
  id: string
  role: SoundDrawingLayerRole
  enabled?: boolean
  generator: SoundDrawingGeneratorFamily
  source?: SoundDrawingPerformanceSource
  identityProfile?: SoundDrawingIdentityProfile
  treatment?: SoundDrawingSourceTreatment
  preserveIdentity?: boolean
  blendMode?: SoundDrawingBlendMode
  opacity?: number
  strokeWidth?: number
  traceCount?: number
  symmetry?: number
  scale?: number
  x?: number
  y?: number
  rotation?: number
  phaseOffset?: number
  trailPersistence?: number
  feedbackAmount?: number
  glow?: number
  colorRole?: SoundDrawingColorRole
  topologyVariant?: number
  renderMode?: OscillatorRenderMode
  classicMode?: ClassicScopeMode
  shape?: BuiltinOscillatorShape
  audioDisplacement?: number
  jitter?: number
  particleCount?: number
  contourBudget?: number
  requestedContourDeformation?: number
  appliedContourDeformation?: number
  readabilityClamped?: boolean
  contourScale?: number
  allowCharacterDeformation?: boolean
  allowTextWaveform?: boolean
  wholeObjectMotion?: number
  contourReactivity?: number
  echoStrength?: number
  sourceTrailStrength?: number
  supportingVisualReactivity?: number
  sourceFailure?: string | null
  modulationRoutes?: readonly SoundDrawingModulationRoute[]
  eventBindings?: readonly SoundDrawingEventBinding[]
}

export interface SoundDrawingPerformanceGlobalBlueprint {
  trailPersistence?: number
  feedbackAmount?: number
  cameraScale?: number
  cameraRotation?: number
  cameraX?: number
  cameraY?: number
  backgroundFade?: number
}

export type SoundDrawingPerformanceAction =
  | {
      type: 'scene'
      layers: readonly SoundDrawingPerformanceLayerBlueprint[]
      global?: SoundDrawingPerformanceGlobalBlueprint
    }
  | {
      type: 'patchRole'
      role: SoundDrawingLayerRole
      patch: Partial<SoundDrawingPerformanceLayerBlueprint>
      lockKey?: SoundDrawingPerformanceLockKey
    }
  | {
      type: 'recruitLayer'
      layer: SoundDrawingPerformanceLayerBlueprint
    }
  | {
      type: 'retireRole'
      role: SoundDrawingLayerRole
    }
  | {
      type: 'pulse'
      role: SoundDrawingLayerRole
      event: SoundDrawingEventKind
      target: SoundDrawingEventTarget
      amount: number
      envelope: SoundDrawingPerformanceEnvelope
      lockKey?: SoundDrawingPerformanceLockKey
    }
  | {
      type: 'global'
      patch: SoundDrawingPerformanceGlobalBlueprint
      lockKey?: SoundDrawingPerformanceLockKey
    }

export interface SoundDrawingPerformanceSettings {
  selectedShowId: SoundDrawingPerformanceShowId
  autoPerformance: boolean
  complexity: number
  motionIntensity: number
  reactionIntensity: number
  trailIntensity: number
  generatorPreference: SoundDrawingGeneratorPreference
  quality: SoundDrawingVisualQuality
  performanceSource: SoundDrawingPerformanceSourceSelection
  sourceTreatment: SoundDrawingSourceTreatment
  useSourceAs: SoundDrawingSourceUsePolicy
  preserveIdentity: boolean
  contourReactivity: number
  wholeObjectMotion: number
  echoStrength: number
  sourceTrailStrength: number
  supportingVisualReactivity: number
  locks: Record<SoundDrawingPerformanceLockKey, boolean>
}

export interface SoundDrawingResolvedPerformanceLayer extends Required<Omit<SoundDrawingPerformanceLayerBlueprint,
  'source' | 'modulationRoutes' | 'eventBindings' | 'classicMode' | 'shape' | 'renderMode' | 'sourceFailure'>> {
  source: SoundDrawingResolvedPerformanceSource
  modulationRoutes: readonly SoundDrawingModulationRoute[]
  eventBindings: readonly SoundDrawingEventBinding[]
  classicMode: ClassicScopeMode
  shape: BuiltinOscillatorShape
  renderMode: OscillatorRenderMode
  sourceFailure: string | null
}

export interface SoundDrawingResolvedPerformanceFrame {
  showId: SoundDrawingPerformanceShowId
  showName: string
  sceneId: string
  context: SharedPerformanceContext
  layers: readonly SoundDrawingResolvedPerformanceLayer[]
  global: Required<SoundDrawingPerformanceGlobalBlueprint>
  fallbackUsed: boolean
  deterministicIdentity: string
  appliedActionReasons: readonly string[]
  activeSourceKind: SoundDrawingResolvedPerformanceSource['kind']
  activeIdentityProfile: SoundDrawingIdentityProfile
  activeTreatment: SoundDrawingSourceTreatment
  preserveIdentity: boolean
  sourceRole: SoundDrawingSourceUsePolicy | 'generatedOnly'
  contourBudget: number
  requestedContourDeformation: number
  appliedContourDeformation: number
  readabilityClampApplied: boolean
  supportingGeneratedLayers: readonly string[]
  sourceFallbackState: string | null
}

export interface SoundDrawingPerformanceShowDefinition {
  id: SoundDrawingPerformanceShowId
  name: string
  description: string
  program: import('../../../../features/performanceCore').SharedPerformanceProgram<SoundDrawingPerformanceAction>
}

export interface SoundDrawingPerformanceTemporalState {
  identity: string
}

export const DEFAULT_SOUND_DRAWING_PERFORMANCE_LOCKS: Record<SoundDrawingPerformanceLockKey, boolean> = {
  generator: false,
  layerRecruitment: false,
  topology: false,
  trail: false,
  feedback: false,
  transform: false,
  camera: false,
  color: false,
  reaction: false,
  sourceSelection: false,
  sourceTreatment: false,
  preserveIdentity: false,
  wholeObjectMotion: false,
  contourReactivity: false,
  rotation: false,
  scale: false,
  glow: false,
  echoBehavior: false,
  trailBehavior: false,
}

export const DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS: SoundDrawingPerformanceSettings = {
  selectedShowId: 'radialPressureSystem',
  autoPerformance: false,
  complexity: 0.7,
  motionIntensity: 0.65,
  reactionIntensity: 0.8,
  trailIntensity: 0.55,
  generatorPreference: 'authored',
  quality: 'auto',
  performanceSource: 'activeUserSource',
  sourceTreatment: 'preserveIdentity',
  useSourceAs: 'primaryMotif',
  preserveIdentity: true,
  contourReactivity: 0.35,
  wholeObjectMotion: 0.65,
  echoStrength: 0.28,
  sourceTrailStrength: 0.28,
  supportingVisualReactivity: 0.72,
  locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_LOCKS },
}
