import type {
  CanvasFitMode,
  CanvasFractureAnchorMode,
  CanvasFractureEffectRole,
  CanvasFractureManualAction,
  CanvasFractureMode,
  CanvasFracturePlacementMode,
  CanvasFractureQualityMode,
  CanvasFractureQuantizeInterval,
  CanvasFractureTransitionMode,
  CanvasMediaItemType,
  CanvasPresetId,
  ReactTrackSection,
} from '../../ReactTypes'
import type { BarMarkerMI } from '../../../../../features/musicIntelligence/types'

export type CanvasFracturesSourceElement = HTMLVideoElement | HTMLImageElement
export type CanvasFractureShapeFamily = Exclude<CanvasFractureMode, 'mixed'>
export type CanvasFractureAnchorRole = 'focus' | 'fragment'
export type CanvasFracturesRendererBackend = 'canvas2d'
export type CanvasFracturesSourcePath = 'video-frame' | 'raster-image' | 'svg-raster-image'
export type CanvasFractureResolvedPlacementMode = Exclude<CanvasFracturePlacementMode, 'randomMix'>

export interface CanvasFracturePoint {
  x: number
  y: number
}

export interface CanvasFractureCrop {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Positions are normalized against the fitted source rectangle. Values outside
 * zero-to-one are allowed for intentional, minimum-visible-area offscreen layouts.
 */
export interface CanvasFractureTransform {
  centerX: number
  centerY: number
  scale: number
  rotationDeg: number
}

export interface CanvasFractureTopologyFragment {
  id: string
  crop: CanvasFractureCrop
  shapeFamily: CanvasFractureShapeFamily
  sourceCorners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
  localCorners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
  homeTransform: CanvasFractureTransform
  anchorRole: CanvasFractureAnchorRole
  effectRole: CanvasFractureEffectRole | null
  repeatedFromFragmentId: string | null
}

export interface CanvasFractureLayoutPlacement {
  fragmentId: string
  targetTransform: CanvasFractureTransform
  mirrorX: boolean
  mirrorY: boolean
  depth: number
  resolvedPlacementMode: CanvasFractureResolvedPlacementMode
  visibleAreaRatio: number
  overlapRatio: number
  compositionZone: string
}

export interface CanvasFractureFragment extends CanvasFractureTopologyFragment {
  currentTransform: CanvasFractureTransform
  targetTransform: CanvasFractureTransform
  opacity: number
  mirrorX: boolean
  mirrorY: boolean
  depth: number
  resolvedPlacementMode: CanvasFractureResolvedPlacementMode
  visibleAreaRatio: number
  overlapRatio: number
  compositionZone: string
}

export interface CanvasFracturesAnchorPresentation {
  mode: CanvasFractureAnchorMode
  visible: boolean
  opacity: number
  scale: number
}

export interface CanvasFracturesTopologyPlan {
  identity: string
  seed: number
  fragments: readonly CanvasFractureTopologyFragment[]
}

export interface CanvasFracturesLayoutPlan {
  identity: string
  topologyIdentity: string
  seed: number
  placementMode: CanvasFracturePlacementMode
  returnToAnchor: boolean
  placements: readonly CanvasFractureLayoutPlacement[]
}

export interface CanvasFracturesTransitionState {
  identity: string
  mode: CanvasFractureTransitionMode
  previousLayoutIdentity: string
  targetLayoutIdentity: string
  startSec: number
  durationSec: number
  progress: number
  zoomDirection: 'in' | 'out'
  source: 'initial' | 'automatic' | 'manual' | 'freezeRelease'
}

export interface CanvasFracturesPlan {
  id: string
  topologyIdentity: string
  layoutIdentity: string
  seed: number
  topologySeed: number
  layoutSeed: number
  sourceIdentity: string
  sourcePath: CanvasFracturesSourcePath
  mediaRevision: number
  anchor: CanvasFracturesAnchorPresentation
  placementMode: CanvasFracturePlacementMode
  returnToAnchor: boolean
  fragments: readonly CanvasFractureFragment[]
  transition: CanvasFracturesTransitionState | null
}

export interface CanvasFracturesPlanInput {
  presetId: CanvasPresetId
  sourceIdentity: string
  mediaType: CanvasMediaItemType
  mediaRevision?: number
  trackIdentity?: string | null
  /** Legacy compatibility fallback. Quantized callers should pass topology/layoutIdentityKey. */
  transportPositionSec?: number
  topologyIdentityKey?: string | number
  layoutIdentityKey?: string | number
  variationSeed: number
  topologyRevision: number
  layoutRevision: number
  mode: CanvasFractureMode
  intensity: number
  focusProtection: number
  focusX: number
  focusY: number
  composition: number
  placementMode: CanvasFracturePlacementMode
  quality: CanvasFractureQualityMode
  anchorMode: CanvasFractureAnchorMode
  returnToAnchor?: boolean
}

export interface CanvasFracturesTimelineInput {
  positionSec: number
  bpm: number | null | undefined
  timeSignature: number | null | undefined
  beatGridOffsetSec?: number | null
  barMarkers?: readonly BarMarkerMI[]
  sections?: readonly ReactTrackSection[]
  topologyInterval: CanvasFractureQuantizeInterval
  layoutInterval: CanvasFractureQuantizeInterval
  freezeLayout: boolean
  freezePositionSec: number
}

export interface CanvasFracturesTimelinePoint {
  positionSec: number
  barIndex: number
  barProgress: number
  barStartSec: number
  barEndSec: number
  sectionIndex: number
  sectionStartSec: number
  sectionEndSec: number
  topologyBucket: number
  topologyBoundarySec: number
  layoutBucket: number
  layoutBoundarySec: number
}

export interface CanvasFracturesRuntimeSettings {
  topologyInterval: CanvasFractureQuantizeInterval
  layoutInterval: CanvasFractureQuantizeInterval
  freezeLayout: boolean
  freezePositionSec: number
  topologyRevision: number
  layoutRevision: number
  returnToAnchor: boolean
  lastManualAction: CanvasFractureManualAction
  manualTransitionPositionSec: number
  transitionMode: CanvasFractureTransitionMode
  transitionSpeed: number
  staggerAmount: number
  zoomAmount: number
}

export interface CanvasFracturesRuntimeFrameInput {
  planInput: Omit<CanvasFracturesPlanInput, 'topologyIdentityKey' | 'layoutIdentityKey' | 'transportPositionSec'>
  timelineInput: CanvasFracturesTimelineInput
  runtimeSettings: CanvasFracturesRuntimeSettings
  isPlaying: boolean
  isPaused: boolean
}

export interface CanvasFracturesSourceTransform {
  scale: number
  positionX: number
  positionY: number
  rotation: number
}

export interface CanvasFracturesRenderParams {
  source: CanvasFracturesSourceElement | null
  fitMode: CanvasFitMode
  sourceTransform: CanvasFracturesSourceTransform
  outputOpacity?: number
}
