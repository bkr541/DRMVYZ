export const PIX_GRID_STATE_VERSION = 4 as const

export type PixGridQualityTier = 'draft' | 'low' | 'high' | 'ultra'
export type PixGridBackgroundMode = 'preset' | 'black' | 'custom'
export type PixGridEditorTool = 'select' | 'pencil' | 'eraser' | 'fill' | 'group'
export type PixGridPatternId = 'bassBeacon' | 'geometricReactor' | 'pixelParade'
export type PixGridBlendMode = 'normal' | 'add' | 'multiply'
export type PixGridStoppedBehavior = 'baseline' | 'blackout'
export type PixGridRendererPath = 'webgl2' | 'canvas2d-fallback'
export type PixGridContextState = 'ready' | 'lost' | 'restoring' | 'unavailable'
export type PixGridAssetCategory = 'typography' | 'symbol' | 'pattern' | 'geometry' | 'character' | 'motion'
export type PixGridAssetKind = 'static' | 'procedural' | 'frameBased'
export type PixGridPaletteRole = 'primary' | 'secondary' | 'accent' | 'highlight' | 'background'
export type PixGridClipMode = 'clip' | 'wrap'
export type PixGridAnimationBoundary = 'wrap' | 'clamp' | 'bounce'
export type PixGridAudioSource = 'bass' | 'mid' | 'high' | 'volume' | 'kick' | 'snare' | 'hat'
export type PixGridAnimationMode =
  | 'static'
  | 'pulse'
  | 'bounce'
  | 'horizontalScroll'
  | 'verticalScroll'
  | 'pingPong'
  | 'rotate'
  | 'paletteCycle'
  | 'blink'
  | 'revealRow'
  | 'revealColumn'
  | 'checkerAlternate'
  | 'frameCycle'
  | 'audioAmplitudeScale'
  | 'beatStepMovement'

export type PixGridBuiltInAssetId =
  | 'pix-bass-word'
  | 'pix-five-point-star'
  | 'pix-multi-star-field'
  | 'pix-equalizer-bars'
  | 'pix-concentric-rings'
  | 'pix-checkerboard'
  | 'pix-diagonal-chevrons'
  | 'pix-cross'
  | 'pix-diamond'
  | 'pix-spiral'
  | 'pix-wave-line'
  | 'pix-mascot-face'
  | 'pix-orbiting-dots'
  | 'pix-pixel-burst'
  | 'pix-geometric-tunnel'

export type PixGridPixelOverride = readonly [x: number, y: number, color: string, brightness: number]

export interface PixGridBuiltInAssetManifestEntry {
  id: PixGridBuiltInAssetId
  name: string
  category: PixGridAssetCategory
  nativeSize: Readonly<{ width: number; height: number }>
  aspectRatio: number
  kind: PixGridAssetKind
  defaultPaletteRoles: readonly PixGridPaletteRole[]
  defaultGroups?: readonly string[]
  animationCapabilities: readonly PixGridAnimationMode[]
  frameCount?: number
}

export interface PixGridLayerAnimation {
  mode: PixGridAnimationMode
  speed: number
  amount: number
  phase: number
  boundary: PixGridAnimationBoundary
  axis?: 'x' | 'y'
  stepped?: boolean
  audioSource?: PixGridAudioSource
}

export interface PixGridLayerAudioReactivity {
  brightnessSource?: PixGridAudioSource
  brightnessAmount?: number
  scaleSource?: PixGridAudioSource
  scaleAmount?: number
  beatImpact?: number
}

export interface PixGridLayer {
  id: string
  name: string
  assetId: PixGridBuiltInAssetId
  visible: boolean
  opacity: number
  position: { x: number; y: number }
  scale: { x: number; y: number }
  rotation: number
  flipX: boolean
  flipY: boolean
  blendMode: PixGridBlendMode
  paletteMap: Partial<Record<PixGridPaletteRole, PixGridPaletteRole>>
  zIndex: number
  clipMode: PixGridClipMode
  maskAssetId: PixGridBuiltInAssetId | null
  animations: PixGridLayerAnimation[]
  audioReactivity?: PixGridLayerAudioReactivity
  densityRank: number
  seed: number
}

export interface PixGridSceneSettings {
  density: number
  motionMultiplier: number
  paletteOffset: number
  hiddenLayerIds?: string[]
  layerOpacity?: Record<string, number>
}

export interface PixGridGroup {
  id: string
  name: string
  layerId: string | null
  cellRuns: Array<readonly [row: number, startColumn: number, length: number]>
  smartRuleId: string | null
}

export interface PixGridPerformanceSettings {
  enabled: boolean
  sharedPerformanceProgramId: string | null
  seed: number
  lockedRoutes: string[]
}

export type PixGridFitMode = 'contain' | 'cover' | 'stretch'
export type PixGridSamplingMode = 'crisp' | 'smooth'
export type PixGridColorMode = 'original' | 'hybrid' | 'brand' | 'preset'
export type PixGridDitherMode = 'none' | 'ordered-bayer' | 'atkinson'
export type PixGridBackgroundHandling = 'transparent' | 'solid' | 'remove-dark'

export interface PixGridConversionSettings {
  selectedMediaId: string | null
  fitMode: PixGridFitMode
  positionX: number
  positionY: number
  scale: number
  sampling: PixGridSamplingMode
  colorMode: PixGridColorMode
  paletteSize: number
  ditherMode: PixGridDitherMode
  alphaThreshold: number
  preserveAlpha: boolean
  contrast: number
  brightness: number
  saturation: number
  edgeEnhancement: number
  backgroundHandling: PixGridBackgroundHandling
  backgroundColor: string
  brandStrength: number
  preserveBlack: boolean
  preserveWhite: boolean
}

export interface PixGridRuntimeDiagnosticsSettings {
  showFps: boolean
  showMatrixBounds: boolean
  logLifecycle: boolean
}

export interface PixGridPresetSettings {
  pattern: PixGridPatternId
  quality?: PixGridQualityTier
  backgroundMode?: PixGridBackgroundMode
  backgroundColor?: string
  backgroundBrightness?: number
  cellGap?: number
  cellRoundness?: number
  cellBrightness?: number
  globalIntensity?: number
  glowAmount?: number
  diffusion?: number
  rgbSubpixelMode?: boolean
  selectedSceneId?: string | null
  layers?: PixGridLayer[]
  sceneSettings?: Record<string, PixGridSceneSettings>
}

export interface PixGridState {
  version: typeof PIX_GRID_STATE_VERSION
  quality: PixGridQualityTier
  matrixWidth: number
  matrixHeight: number
  backgroundMode: PixGridBackgroundMode
  backgroundColor: string
  backgroundBrightness: number
  cellGap: number
  cellRoundness: number
  cellBrightness: number
  globalIntensity: number
  glowAmount: number
  diffusion: number
  rgbSubpixelMode: boolean
  stoppedBehavior: PixGridStoppedBehavior
  selectedPresetId: string | null
  selectedSceneId: string | null
  authoringOverlayVisible: boolean
  editorTool: PixGridEditorTool
  layers: PixGridLayer[]
  groups: PixGridGroup[]
  pixelOverrides: PixGridPixelOverride[]
  performance: PixGridPerformanceSettings
  conversion: PixGridConversionSettings
  diagnostics: PixGridRuntimeDiagnosticsSettings
}

export interface PixGridAudioFrame {
  audioTime: number
  bass: number
  mid: number
  high: number
  volume: number
  beatHit: boolean
  kickHit?: boolean
  snareHit?: boolean
  hatHit?: boolean
  beatPhase: number
  beatIndex?: number
  isPlaying: boolean
}

export interface PixGridRendererDiagnostics {
  path: PixGridRendererPath
  logicalWidth: number
  logicalHeight: number
  presentationWidth: number
  presentationHeight: number
  fps: number
  logicalFramebufferAllocated: boolean
  logicalAllocationCount: number
  contextState: PixGridContextState
  fallbackReason: string | null
  approximateGpuResourceCount: number
}
