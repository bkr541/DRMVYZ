export const PIX_GRID_STATE_VERSION = 8 as const

export type PixGridQualityTier = 'draft' | 'low' | 'high' | 'ultra'
export type PixGridBackgroundMode = 'preset' | 'black' | 'custom'
export type PixGridEditorTool = 'select' | 'pan' | 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'rectangle' | 'line' | 'marquee' | 'move'
export type PixGridPatternId = 'bassBeacon' | 'geometricReactor' | 'pixelParade'
export type PixGridPerformanceProgramId =
  | 'pix-grid-bass-beacon-performance'
  | 'pix-grid-geometric-reactor-performance'
  | 'pix-grid-pixel-parade-performance'
export type PixGridBlendMode = 'normal' | 'add' | 'multiply'
export type PixGridStoppedBehavior = 'baseline' | 'blackout'
export type PixGridRendererPath = 'webgl2' | 'canvas2d-fallback'
export type PixGridContextState = 'ready' | 'lost' | 'restoring' | 'unavailable'
export type PixGridAssetCategory = 'typography' | 'symbol' | 'pattern' | 'geometry' | 'character' | 'motion'
export type PixGridAssetKind = 'static' | 'procedural' | 'frameBased'
export type PixGridPaletteRole = 'primary' | 'secondary' | 'accent' | 'highlight' | 'background'
export type PixGridClipMode = 'clip' | 'wrap'
export type PixGridAnimationBoundary = 'wrap' | 'clamp' | 'bounce'
export type PixGridContinuousAudioSource =
  | 'sub' | 'bass' | 'lowMid' | 'mid' | 'high' | 'air' | 'volume'
  | 'energy' | 'trackRelativeEnergy' | 'spectralFlux' | 'tension' | 'complexity'
  | 'buildProgress' | 'sectionProgress' | 'phraseProgress' | 'vocalEnergy'
export type PixGridDiscreteAudioSource =
  | 'beat' | 'downbeat' | 'kick' | 'snare' | 'hat' | 'transient'
  | 'barEntry' | 'fourBarBoundary' | 'eightBarBoundary' | 'sixteenBarBoundary'
  | 'sectionEntry' | 'sectionExit' | 'dropImpact' | 'semanticMoment'
export type PixGridReactionSource = PixGridContinuousAudioSource | PixGridDiscreteAudioSource
/** Backward-compatible layer animation source union. */
export type PixGridAudioSource = PixGridReactionSource
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

export type PixGridPixelOverrideMode = 0 | 1
/** Compact sparse tuple. Mode 0 forces the cell off; mode 1 paints color at opacity. Legacy v4 tuples are accepted by normalization. */
export type PixGridPixelOverride = readonly [x: number, y: number, mode: PixGridPixelOverrideMode, color: string, opacity: number] | readonly [x: number, y: number, color: string, opacity: number]

export interface PixGridCellRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PixGridScene {
  id: string
  name: string
  layerIds: string[]
  pixelOverrides: PixGridPixelOverride[]
}

export interface PixGridEditorSettings {
  guidesVisible: boolean
  zoom: number
  panX: number
  panY: number
  paintColor: string
  paintOpacity: number
  eraserMode: 'off' | 'restore'
  selectedLayerId: string | null
  selectedGroupId: string | null
  previewReactionAssignmentId: string | null
  selection: PixGridCellRect | null
}

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
  /** Selects the authoritative musical clock used by frame sequences and motion. */
  clock?: 'time' | 'beat' | 'bar' | 'cue'
  speed: number
  amount: number
  phase: number
  boundary: PixGridAnimationBoundary
  axis?: 'x' | 'y'
  revealFrom?: 'start' | 'end' | 'center'
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
  /** Media layers keep their library reference without embedding blobs. */
  mediaId?: string | null
  locked?: boolean
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

export type PixGridCellRun = readonly [row: number, startColumn: number, length: number]
export type PixGridGroupSource =
  | 'manualSelection' | 'layerAlpha' | 'foregroundBackground' | 'colorRange' | 'luminanceRange'
  | 'connectedRegion' | 'border' | 'center' | 'leftRight' | 'topBottom' | 'quadrant'
  | 'horizontalBands' | 'verticalBands' | 'alternatingRows' | 'alternatingColumns'
  | 'checkerboard' | 'diagonalBands' | 'radialRings' | 'deterministicClusters' | 'svgMetadata'
export type PixGridGeometricGroupPattern =
  | 'border' | 'center' | 'left' | 'right' | 'top' | 'bottom'
  | 'quadrantTopLeft' | 'quadrantTopRight' | 'quadrantBottomLeft' | 'quadrantBottomRight'
  | 'horizontalBands' | 'verticalBands' | 'alternatingRowsA' | 'alternatingRowsB'
  | 'alternatingColumnsA' | 'alternatingColumnsB' | 'checkerboardA' | 'checkerboardB'
  | 'diagonalBands' | 'radialRings' | 'deterministicClusters'
export type PixGridGroupOverlapBehavior = 'stack' | 'exclusive' | 'replace'
export type PixGridReactionTarget =
  | 'brightness' | 'paletteRole' | 'color' | 'opacity' | 'scale' | 'positionX' | 'positionY'
  | 'reveal' | 'hide' | 'blink' | 'outlineFlash' | 'sparkle' | 'pixelDisplacement'
  | 'frameAdvance' | 'animationSpeed' | 'directionReverse' | 'dissolveThreshold'
  | 'invert' | 'posterize'
export type PixGridReactionRetrigger = 'restart' | 'extend' | 'ignoreWhileActive'
export type PixGridReactionBlend = 'add' | 'multiply' | 'replace' | 'max'
export type PixGridReactionCapabilityFallback = 'disable' | 'zero' | 'energy' | 'beat'
export type PixGridReactionQuantization = 'none' | 'beat' | 'bar' | 'fourBars' | 'eightBars' | 'sixteenBars'

export interface PixGridReactionAssignment {
  id: string
  name: string
  enabled: boolean
  source: PixGridReactionSource
  target: PixGridReactionTarget
  amount: number
  invert: boolean
  threshold: number
  attack: number
  hold: number
  release: number
  smoothing: number
  quantization: PixGridReactionQuantization
  retrigger: PixGridReactionRetrigger
  minimumConfidence: number
  capabilityFallback: PixGridReactionCapabilityFallback
  clamp: readonly [number, number]
  blend: PixGridReactionBlend
  paletteRole?: PixGridPaletteRole
  color?: string
  seedOffset?: number
}

export type PixGridGroupMaskDefinition =
  | { kind: 'runs'; runs: PixGridCellRun[] }
  | { kind: 'geometric'; pattern: PixGridGeometricGroupPattern; count?: number; index?: number; thickness?: number; seed?: number }
  | { kind: 'layerAlpha'; threshold: number; foreground: boolean }
  | { kind: 'colorRange'; color: string; tolerance: number }
  | { kind: 'luminanceRange'; min: number; max: number }
  | { kind: 'connectedRegion'; seedX: number; seedY: number; tolerance: number; alphaThreshold: number; maxCells: number }
  | { kind: 'svgMetadata'; elementId?: string; fillColor?: string }

export interface PixGridGroup {
  id: string
  name: string
  source: PixGridGroupSource
  mask: PixGridGroupMaskDefinition
  /** Materialized compact row runs retained for manual and prepared smart groups. */
  cellRuns: PixGridCellRun[]
  /** Backward-compatible single-layer scope. */
  layerId: string | null
  layerScope: string[] | null
  smartRuleId: string | null
  enabled: boolean
  visible: boolean
  /** Runtime content visibility. Unlike visible, this affects the rendered group mask. */
  contentVisible?: boolean
  priority: number
  overlapBehavior: PixGridGroupOverlapBehavior
  reactions: PixGridReactionAssignment[]
  displayColor: string | null
}

export interface PixGridPerformanceSettings {
  enabled: boolean
  intensity: number
  sharedPerformanceProgramId: PixGridPerformanceProgramId | null
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
  groups?: PixGridGroup[]
  performanceProgramId?: PixGridPerformanceProgramId
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
  editor: PixGridEditorSettings
  scenes: PixGridScene[]
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
  beatPhase: number
  isPlaying: boolean
  sub?: number
  lowMid?: number
  air?: number
  energy?: number
  trackRelativeEnergy?: number
  spectralFlux?: number
  tension?: number
  complexity?: number
  buildProgress?: number
  sectionProgress?: number
  phraseProgress?: number
  vocalEnergy?: number
  downbeatHit?: boolean
  kickHit?: boolean
  snareHit?: boolean
  hatHit?: boolean
  transientHit?: boolean
  barEntry?: boolean
  fourBarBoundary?: boolean
  eightBarBoundary?: boolean
  sixteenBarBoundary?: boolean
  sectionEntry?: boolean
  sectionExit?: boolean
  dropImpactHit?: boolean
  semanticMomentHit?: boolean
  beatIndex?: number
  barIndex?: number
  sectionOccurrence?: number
  deltaTimeSec?: number
  timingDiscontinuity?: boolean
  trackIdentity?: string | null
  capabilities?: Partial<Record<PixGridReactionSource, boolean>>
  confidence?: Partial<Record<PixGridReactionSource, number>>
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
  activeGroupMaskCount?: number
  groupMaskUploadCount?: number
  groupMaskApproximateBytes?: number
}
