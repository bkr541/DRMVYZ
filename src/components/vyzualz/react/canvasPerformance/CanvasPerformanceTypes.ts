import type {
  SharedPerformanceContext,
  SharedPerformanceEnvelopeCurve,
} from '../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../ReactTypes'

export const CANVAS_PERFORMANCE_PROGRAM_ID = 'canvas-cinematic-bass-editor'

export const CANVAS_PERFORMANCE_SHOW_IDS = [
  'canvas-cinematic-bass-editor',
  'canvas-glitch-collage-reactor',
  'canvas-dreamstate-media-tunnel',
  'canvas-impact-cut-system',
  'canvas-layered-luma-journey',
] as const

export type CanvasPerformanceShowId = typeof CANVAS_PERFORMANCE_SHOW_IDS[number]
export const MAX_CANVAS_PERFORMANCE_LAYERS = 7
export const MAX_CANVAS_ACTIVE_VIDEO_DECODERS = 3
export const MAX_CANVAS_MEDIA_HANDLES = 10
export const MAX_CANVAS_PRELOAD_QUEUE = 5
export const MAX_CANVAS_EFFECT_CHAIN_DEPTH = 5
export const MAX_CANVAS_CONCURRENT_TRANSITIONS = 1
export const MAX_CANVAS_FEEDBACK_PASSES = 1

export type CanvasMediaRole =
  | 'hero'
  | 'alternateHero'
  | 'background'
  | 'texture'
  | 'foregroundAccent'
  | 'mask'
  | 'transition'
  | 'dropAsset'
  | 'breakdownAsset'
  | 'buildAsset'
  | 'introAsset'
  | 'outroAsset'

export const CANVAS_MEDIA_ROLES: readonly CanvasMediaRole[] = [
  'hero',
  'alternateHero',
  'background',
  'texture',
  'foregroundAccent',
  'mask',
  'transition',
  'dropAsset',
  'breakdownAsset',
  'buildAsset',
  'introAsset',
  'outroAsset',
]

export const CANVAS_MEDIA_ROLE_LABELS: Readonly<Record<CanvasMediaRole, string>> = {
  hero: 'Hero',
  alternateHero: 'Alternate Hero',
  background: 'Background',
  texture: 'Texture',
  foregroundAccent: 'Foreground Accent',
  mask: 'Mask',
  transition: 'Transition',
  dropAsset: 'Drop Asset',
  breakdownAsset: 'Breakdown Asset',
  buildAsset: 'Build Asset',
  introAsset: 'Intro Asset',
  outroAsset: 'Outro Asset',
}

export type CanvasLayerRole =
  | 'background'
  | 'hero'
  | 'texture'
  | 'foregroundAccent'
  | 'mask'
  | 'transition'
  | 'feedback'

export type CanvasBlendMode =
  | 'source-over'
  | 'screen'
  | 'lighter'
  | 'multiply'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
  | 'exclusion'

export type CanvasMaskMode = 'alpha' | 'luma' | 'invertedAlpha' | 'invertedLuma'
export type CanvasAspectBehavior = CanvasFitMode | 'native'

export type CanvasCompositionTemplateId =
  | 'fullScreenHero'
  | 'heroPlusTexture'
  | 'mirroredDualClip'
  | 'splitScreen'
  | 'fourPanelGrid'
  | 'centerHeroAtmosphericBorder'
  | 'maskedHeroReveal'
  | 'foregroundAccentOverBackground'
  | 'videoWall'
  | 'echoTunnel'
  | 'layeredLumaCollage'
  | 'pictureInPictureAccent'

export type CanvasCompositionPreference = CanvasCompositionTemplateId | 'auto'

export type CanvasTransitionCategory = 'clean' | 'spatial' | 'bass'
export type CanvasTransitionId =
  | 'hardCut'
  | 'crossfade'
  | 'dipToBlack'
  | 'dipToWhite'
  | 'additiveDissolve'
  | 'lumaDissolve'
  | 'alphaDissolve'
  | 'push'
  | 'slide'
  | 'zoomThrough'
  | 'spin'
  | 'radialWipe'
  | 'tunnelWipe'
  | 'maskExpansion'
  | 'shapeReveal'
  | 'displacementBurst'
  | 'feedbackSmear'
  | 'rgbSplit'
  | 'frameTear'
  | 'sliceDisplacement'
  | 'frameHoldRelease'
  | 'strobeCut'

export type CanvasTransitionInterruptionPolicy = 'finish' | 'replaceAtQuantize' | 'resolveImmediately'
export type CanvasMusicalDuration = '1/8beat' | '1/4beat' | '1/2beat' | '1beat' | '2beats' | '1bar' | '2bars'

export type CanvasEffectId =
  | 'exposure'
  | 'contrast'
  | 'saturation'
  | 'hueRotate'
  | 'blur'
  | 'sharpen'
  | 'glow'
  | 'rgbSplit'
  | 'posterize'
  | 'scanlines'
  | 'grain'
  | 'displacement'
  | 'slice'
  | 'feedback'
  | 'vignette'

export type CanvasEffectRecipeId = 'none' | 'bassImpact' | 'dreamBreakdown' | 'preDropVacuum' | 'dropFracture' | 'phraseEcho'
export type CanvasEventKind = 'beat' | 'kick' | 'snare' | 'hat' | 'downbeat'
export type CanvasModulationSource =
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

export type CanvasEffectParameter =
  | 'amount'
  | 'exposure'
  | 'contrast'
  | 'saturation'
  | 'blurPx'
  | 'scale'
  | 'rotation'
  | 'opacity'
  | 'offsetX'
  | 'offsetY'
  | 'frequency'
  | 'threshold'

export type CanvasOrchestrationLockKey =
  | 'media'
  | 'composition'
  | 'layerRecruitment'
  | 'transition'
  | 'effectChain'
  | 'motion'
  | 'playback'

export interface CanvasCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasLoopRange {
  startSec: number
  endSec: number
  bars: 1 | 2 | 4 | 8 | 16 | null
}

export interface CanvasModulationRoute {
  id: string
  source: CanvasModulationSource
  target: CanvasEffectParameter
  min: number
  max: number
  amount: number
  curve?: SharedPerformanceEnvelopeCurve
  smoothing?: number
  sectionFilter?: readonly string[]
  safetyClamp?: readonly [number, number]
  lockKey?: CanvasOrchestrationLockKey
}

export interface CanvasEventEnvelope {
  attackBeats: number
  holdBeats: number
  releaseBeats: number
  curve: SharedPerformanceEnvelopeCurve
}

export interface CanvasEventBinding {
  id: string
  event: CanvasEventKind
  target: CanvasEffectParameter
  amount: number
  envelope: CanvasEventEnvelope
  lockKey?: CanvasOrchestrationLockKey
}

export interface CanvasEffectNode {
  id: string
  effect: CanvasEffectId
  enabled: boolean
  amount: number
  params: Readonly<Record<string, number>>
  safetyClamp?: readonly [number, number]
  modulationRoutes: readonly CanvasModulationRoute[]
  eventBindings: readonly CanvasEventBinding[]
}

export interface CanvasEffectRecipe {
  id: CanvasEffectRecipeId
  label: string
  effects: readonly CanvasEffectNode[]
  sectionFilters: readonly string[]
  intensityScale: number
}

export interface CanvasCompositionSlot {
  id: string
  role: CanvasLayerRole
  requiredMediaRoles: readonly CanvasMediaRole[]
  fallbackMediaRoles: readonly CanvasMediaRole[]
  enabled: boolean
  opacity: number
  blendMode: CanvasBlendMode
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  crop: CanvasCropRect
  aspectBehavior: CanvasAspectBehavior
  maskMode: CanvasMaskMode | null
  zIndex: number
  mirrorX?: boolean
  mirrorY?: boolean
}

export interface CanvasCompositionTemplate {
  id: CanvasCompositionTemplateId
  label: string
  slots: readonly CanvasCompositionSlot[]
  maxLayers: number
  maxVideoDecoders: number
  feedbackPasses: 0 | 1
}

export interface CanvasResolvedPlayback {
  playbackRate: number
  inPointSec: number
  phaseSec: number
  loopRange: CanvasLoopRange
  quantizeBars: 1 | 2 | 4 | 8 | 16 | null
  startOnDownbeat: boolean
  phraseAlignedReset: boolean
  sectionAligned: boolean
  frameHold: boolean
  releaseOnDropImpact: boolean
}

export interface CanvasResolvedLayer {
  id: string
  role: CanvasLayerRole
  sourceMediaId: string | null
  source: CanvasMediaItem | null
  enabled: boolean
  opacity: number
  blendMode: CanvasBlendMode
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  crop: CanvasCropRect
  aspectBehavior: CanvasAspectBehavior
  zIndex: number
  mirrorX: boolean
  mirrorY: boolean
  maskSourceMediaId: string | null
  maskMode: CanvasMaskMode | null
  playback: CanvasResolvedPlayback
  effectChain: readonly CanvasEffectNode[]
  modulationRoutes: readonly CanvasModulationRoute[]
  userLocked: boolean
}

export interface CanvasResolvedTransition {
  id: CanvasTransitionId
  category: CanvasTransitionCategory
  duration: CanvasMusicalDuration
  startAudioTimeSec: number
  durationSec: number
  progress: number
  quantized: boolean
  deterministicVariation: number
  interruptionPolicy: CanvasTransitionInterruptionPolicy
  fallbackId: CanvasTransitionId
  fromFrameIdentity: string | null
  toFrameIdentity: string
  complete: boolean
}

export interface CanvasOrchestrationSettings {
  enabled: boolean
  autoRoleEnabled: boolean
  mediaPoolIds: string[]
  mediaRolesById: Record<string, CanvasMediaRole[]>
  mediaLocksByLayer: Partial<Record<CanvasLayerRole, string>>
  layerLocks: Partial<Record<CanvasLayerRole, boolean>>
  globalLocks: Partial<Record<CanvasOrchestrationLockKey, boolean>>
  complexity: number
  transitionDensity: number
  effectIntensity: number
  motionIntensity: number
  cutDensity: number
  compositionPreference: CanvasCompositionPreference
  poolRevision: number
  programId: CanvasPerformanceShowId
}

export const DEFAULT_CANVAS_ORCHESTRATION_SETTINGS: CanvasOrchestrationSettings = {
  enabled: false,
  autoRoleEnabled: true,
  mediaPoolIds: [],
  mediaRolesById: {},
  mediaLocksByLayer: {},
  layerLocks: {},
  globalLocks: {},
  complexity: 0.5,
  transitionDensity: 0.45,
  effectIntensity: 0.55,
  motionIntensity: 0.5,
  cutDensity: 0.45,
  compositionPreference: 'auto',
  poolRevision: 0,
  programId: CANVAS_PERFORMANCE_PROGRAM_ID,
}

export interface CanvasLayerTreatment {
  roles: readonly CanvasLayerRole[]
  opacityMultiplier?: number
  scaleMultiplier?: number
  rotationOffset?: number
  offsetX?: number
  offsetY?: number
  cropInset?: number
}

export type CanvasPerformanceAction =
  | { type: 'composition'; templateId: CanvasCompositionTemplateId }
  | { type: 'effectRecipe'; recipeId: CanvasEffectRecipeId }
  | { type: 'transition'; transitionIds: readonly CanvasTransitionId[] }
  | { type: 'recruit'; roles: readonly CanvasLayerRole[] }
  | { type: 'retire'; roles: readonly CanvasLayerRole[] }
  | { type: 'frameHold'; enabled: boolean }
  | { type: 'playbackReset'; phraseAligned?: boolean; sectionAligned?: boolean }
  | { type: 'layerTreatment'; treatment: CanvasLayerTreatment }
  | { type: 'advanceMedia'; roles: readonly CanvasLayerRole[] }
  | { type: 'effectBoost'; amount: number }

export interface CanvasResolvedPerformanceFrame {
  programId: string
  frameIdentity: string
  sceneId: string
  showLabel: string
  context: SharedPerformanceContext
  template: CanvasCompositionTemplate
  layers: readonly CanvasResolvedLayer[]
  transition: CanvasResolvedTransition | null
  effectRecipeId: CanvasEffectRecipeId
  fallbackUsed: boolean
  readyMediaIds: readonly string[]
  pendingMediaIds: readonly string[]
  decoderCount: number
  textureHandleCount: number
  feedbackPasses: number
  orchestrationActive: boolean
  nextSectionType: string | null
  anticipatoryStage: 'none' | 'preload' | 'contraction' | 'finalHold' | 'breakdownMigration' | 'phraseQueue'
  diagnostics: readonly string[]
}

export interface CanvasMediaRoleResolution {
  explicit: readonly CanvasMediaRole[]
  automatic: readonly CanvasMediaRole[]
  effective: readonly CanvasMediaRole[]
}

export interface CanvasMediaReadiness {
  mediaId: string
  status: 'idle' | 'queued' | 'loading' | 'ready' | 'error' | 'cancelled'
  trackIdentity: string | null
  poolRevision: number
  error: string | null
}
