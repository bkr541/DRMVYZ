import type {
  SharedPerformanceContext,
  SharedPerformanceEnvelopeCurve,
} from '../../../../features/performanceCore'
import type {
  CanvasFitMode,
  CanvasFractureAnchorMode,
  CanvasFractureEffectRole,
  CanvasFracturePlacementMode,
  CanvasFractureQuantizeInterval,
  CanvasFractureTransitionMode,
  CanvasMediaItem,
} from '../ReactTypes'

export const CANVAS_PERFORMANCE_PROGRAM_ID = 'canvas-cinematic-bass-editor'

export const CANVAS_PERFORMANCE_SHOW_IDS = [
  'canvas-cinematic-bass-editor',
  'canvas-glitch-collage-reactor',
  'canvas-dreamstate-media-tunnel',
  'canvas-impact-cut-system',
  'canvas-layered-luma-journey',
  'canvas-fractures-performance',
] as const

export type CanvasPerformanceShowId = typeof CANVAS_PERFORMANCE_SHOW_IDS[number]
export const MAX_CANVAS_AUTHORED_LAYERS = 4
export const MAX_CANVAS_PERFORMANCE_LAYERS = MAX_CANVAS_AUTHORED_LAYERS
export const MAX_CANVAS_ACTIVE_VIDEO_DECODERS = 3
/** The validated Show Manager path may explicitly opt in to one video per authored lane. */
export const MAX_CANVAS_SHOW_VIDEO_DECODERS = 4
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

export type CanvasCompositionRichnessTier = 0 | 1 | 2 | 3 | 4

export interface CanvasCompositionSlot {
  id: string
  role: CanvasLayerRole
  requiredMediaRoles: readonly CanvasMediaRole[]
  /** 0 is composition-defining structure; 1-4 are progressively optional richness. */
  richnessTier: CanvasCompositionRichnessTier
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
  /** Stable structural identity that Layer Complexity is never allowed to remove. */
  coreSlotIds: readonly string[]
  maxRichnessTier: CanvasCompositionRichnessTier
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

export type CanvasFracturesNumericOverrideKey =
  | 'fractureIntensity'
  | 'fractureComposition'
  | 'fractureFocusProtection'
  | 'fractureMotionAmount'
  | 'fractureEffectsIntensity'
  | 'fractureAudioResponse'
  | 'fractureBassMotion'
  | 'fractureTransientGlitch'
  | 'fractureStructuralResponse'
  | 'fractureGlowAmount'
  | 'fractureGlitchAmount'
  | 'fractureDuplicationAmount'

export interface CanvasFracturesOverridePatch {
  fractureAnchorMode?: CanvasFractureAnchorMode
  fractureIntensity?: number
  fractureComposition?: number
  fractureFocusProtection?: number
  fracturePlacementMode?: CanvasFracturePlacementMode
  fractureTopologyInterval?: CanvasFractureQuantizeInterval
  fractureLayoutInterval?: CanvasFractureQuantizeInterval
  fractureTransitionMode?: CanvasFractureTransitionMode
  fractureMotionAmount?: number
  fractureEffectsIntensity?: number
  fractureEffectRoleWeights?: Partial<Record<CanvasFractureEffectRole, number>>
  fractureAudioResponse?: number
  fractureBassMotion?: number
  fractureTransientGlitch?: number
  fractureStructuralResponse?: number
  fractureGlowAmount?: number
  fractureGlitchAmount?: number
  fractureDuplicationAmount?: number
  fractureReturnToAnchor?: boolean
}

export interface CanvasFracturesOverrideProfile {
  values: CanvasFracturesOverridePatch
  /** Numeric deltas applied over deterministic section progress. */
  ramp?: Partial<Record<CanvasFracturesNumericOverrideKey, number>>
}

export interface CanvasFracturesLayerProcessor {
  kind: 'fractures'
  presetId: 'canvas-fractures'
  identity: string
  overrides: CanvasFracturesOverridePatch
}

export type CanvasSpecializedLayerProcessor = CanvasFracturesLayerProcessor

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
  /** Fit the source inside scaleX/scaleY bounds before transform scaling. Runtime-only authored layout geometry. */
  fitWithinTransformBounds?: boolean
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
  /** Exact per-element Show treatment. Absent for preset/orchestration layers. */
  showElementTreatment?: {
    brightness: number
    blurPx: number
    contrast: number
    saturation: number
    hueDeg: number
    glow: number
    compositorFilter: string
    glowFilter: string
    transitionInProgress: number
    transitionOutProgress: number
  }
  processor?: CanvasSpecializedLayerProcessor
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

export type CanvasAuthoredLayerOwnership = 'manual' | 'automatic'
export type CanvasRenderMode = 'single' | 'layers' | 'performance'
export type CanvasPoolAutomationTrigger =
  | 'beat'
  | '4bars'
  | '6bars'
  | '8bars'
  | '16bars'
  | 'trackSections'
  | 'kickHit'
  | 'snareHit'

export const CANVAS_POOL_AUTOMATION_TRIGGER_OPTIONS: readonly { value: CanvasPoolAutomationTrigger; label: string }[] = [
  { value: 'beat', label: 'Beat' },
  { value: '4bars', label: '4 Bar' },
  { value: '6bars', label: '6 Bar' },
  { value: '8bars', label: '8 Bar' },
  { value: '16bars', label: '16 Bar' },
  { value: 'trackSections', label: 'Track Sections' },
  { value: 'kickHit', label: 'Kick Hit' },
  { value: 'snareHit', label: 'Snare Hit' },
]

export interface CanvasAuthoredLayer {
  /** Stable instance identity. Multiple instances may reference the same mediaId. */
  id: string
  mediaId: string
  /** Canonical top-to-bottom order. 0 is the visually highest authored layer. */
  order: number
  enabled: boolean
  solo: boolean
  ownership: CanvasAuthoredLayerOwnership
  pinned: boolean
}

export interface CanvasMediaPool {
  id: string
  name: string
  mediaIds: string[]
}

export type CanvasLayerMutationFailureCode =
  | 'invalid-media-id'
  | 'layer-limit-reached'
  | 'layer-not-found'
  | 'invalid-order'

export type CanvasLayerMutationResult =
  | { ok: true; layer: CanvasAuthoredLayer }
  | { ok: false; code: CanvasLayerMutationFailureCode; message: string }

export type CanvasMediaPoolMutationFailureCode =
  | 'invalid-pool-name'
  | 'pool-name-conflict'
  | 'pool-limit-reached'
  | 'pool-not-found'
  | 'invalid-media-id'

export type CanvasMediaPoolMutationResult =
  | { ok: true; pool: CanvasMediaPool }
  | { ok: false; code: CanvasMediaPoolMutationFailureCode; message: string }

export interface CanvasOrchestrationSettings {
  enabled: boolean
  autoRoleEnabled: boolean
  /** Chooses the one primary live CANVAS output path without discarding authored state. */
  renderMode: CanvasRenderMode
  /** Canonical authored layer instances. The array is normalized top-to-bottom. */
  authoredLayers: CanvasAuthoredLayer[]
  /** Canonical named media pools. */
  mediaPools: CanvasMediaPool[]
  /** Exactly zero or one active pool. */
  activeMediaPoolId: string | null
  /** Derived compatibility view of the active named pool. Never mutate as independent truth. */
  mediaPoolIds: string[]
  /** Hybrid layer automation is independent from the legacy full Auto Performance program. */
  poolAutomationEnabled: boolean
  poolAutomationTrigger: CanvasPoolAutomationTrigger
  poolAutomationTransitionId: CanvasTransitionId
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
  /** Optional compact authoring payload. It is applied only by the Fractures show. */
  fracturesShowOverrides: CanvasFracturesOverrideProfile | null
}

export const DEFAULT_CANVAS_ORCHESTRATION_SETTINGS: CanvasOrchestrationSettings = {
  enabled: false,
  autoRoleEnabled: true,
  renderMode: 'single',
  authoredLayers: [],
  mediaPools: [],
  activeMediaPoolId: null,
  mediaPoolIds: [],
  poolAutomationEnabled: false,
  poolAutomationTrigger: 'beat',
  poolAutomationTransitionId: 'crossfade',
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
  fracturesShowOverrides: null,
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
  | { type: 'specializedRenderer'; kind: 'fractures'; profile: CanvasFracturesOverrideProfile }

export interface CanvasResolvedPerformanceFrame {
  programId: string
  frameIdentity: string
  sceneId: string
  showLabel: string
  context: SharedPerformanceContext
  template: CanvasCompositionTemplate
  layers: readonly CanvasResolvedLayer[]
  transition: CanvasResolvedTransition | null
  /** Optional transient scope for transitions that must not disturb fixed layers. */
  transitionLayerIds?: readonly string[]
  effectRecipeId: CanvasEffectRecipeId
  fallbackUsed: boolean
  readyMediaIds: readonly string[]
  pendingMediaIds: readonly string[]
  mediaErrors?: readonly { mediaId: string; message: string }[]
  decoderCount: number
  textureHandleCount: number
  feedbackPasses: number
  orchestrationActive: boolean
  nextSectionType: string | null
  anticipatoryStage: 'none' | 'preload' | 'contraction' | 'finalHold' | 'breakdownMigration' | 'phraseQueue'
  diagnostics: readonly string[]
  /** Authored Shows bypass the global preset/orchestration transform bridge. */
  runtimeMode?: 'orchestration' | 'authored' | 'show'
  selectedElementId?: string | null
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
