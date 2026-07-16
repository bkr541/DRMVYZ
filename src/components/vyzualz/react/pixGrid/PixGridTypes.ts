export const PIX_GRID_STATE_VERSION = 2 as const

export type PixGridQualityTier = 'draft' | 'low' | 'high' | 'ultra'
export type PixGridBackgroundMode = 'preset' | 'black' | 'custom'
export type PixGridEditorTool = 'select' | 'pencil' | 'eraser' | 'fill' | 'group'
export type PixGridPatternId = 'bassBeacon' | 'geometricReactor' | 'pixelParade'
export type PixGridBlendMode = 'normal' | 'add' | 'multiply'
export type PixGridStoppedBehavior = 'baseline' | 'blackout'
export type PixGridRendererPath = 'webgl2' | 'canvas2d-fallback'
export type PixGridContextState = 'ready' | 'lost' | 'restoring' | 'unavailable'

export type PixGridPixelOverride = readonly [
  x: number,
  y: number,
  color: string,
  brightness: number,
]

export interface PixGridLayer {
  id: string
  name: string
  visible: boolean
  opacity: number
  blendMode: PixGridBlendMode
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

export interface PixGridConversionSettings {
  fitMode: 'contain' | 'cover' | 'stretch'
  quantizationColors: number
  ditherMode: 'none'
  preserveAlpha: boolean
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
  beatPhase: number
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
