import type {
  CanvasFitMode,
  CanvasFractureAnchorMode,
  CanvasFractureEffectRole,
  CanvasFractureMode,
  CanvasFracturePlacementMode,
  CanvasFractureQualityMode,
  CanvasMediaItemType,
  CanvasPresetId,
} from '../../ReactTypes'

export type CanvasFracturesSourceElement = HTMLVideoElement | HTMLImageElement
export type CanvasFractureShapeFamily = Exclude<CanvasFractureMode, 'mixed'>
export type CanvasFractureAnchorRole = 'focus' | 'fragment'
export type CanvasFracturesRendererBackend = 'canvas2d'
export type CanvasFracturesSourcePath = 'video-frame' | 'raster-image' | 'svg-raster-image'

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
 * zero-to-one are allowed for intentionally offscreen chaotic arrangements.
 */
export interface CanvasFractureTransform {
  centerX: number
  centerY: number
  scale: number
  rotationDeg: number
}

export interface CanvasFractureFragment {
  id: string
  crop: CanvasFractureCrop
  shapeFamily: CanvasFractureShapeFamily
  sourceCorners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
  localCorners: readonly [CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint, CanvasFracturePoint]
  homeTransform: CanvasFractureTransform
  currentTransform: CanvasFractureTransform
  targetTransform: CanvasFractureTransform
  opacity: number
  mirrorX: boolean
  mirrorY: boolean
  anchorRole: CanvasFractureAnchorRole
  depth: number
  effectRole: CanvasFractureEffectRole | null
}

export interface CanvasFracturesAnchorPresentation {
  mode: CanvasFractureAnchorMode
  visible: boolean
  opacity: number
  scale: number
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
  fragments: readonly CanvasFractureFragment[]
}

export interface CanvasFracturesPlanInput {
  presetId: CanvasPresetId
  sourceIdentity: string
  mediaType: CanvasMediaItemType
  mediaRevision?: number
  trackIdentity?: string | null
  transportPositionSec?: number
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
