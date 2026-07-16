export const PIX_GRID_STATE_VERSION = 1 as const

export type PixGridQualityTier = 'draft' | 'low' | 'high' | 'ultra'
export type PixGridBackgroundMode = 'preset' | 'black' | 'custom'
export type PixGridEditorTool = 'select' | 'pencil' | 'eraser' | 'fill' | 'group'
export type PixGridPatternId = 'bassBeacon' | 'geometricReactor' | 'pixelParade'
export type PixGridBlendMode = 'normal' | 'add' | 'multiply'

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
  cellGap?: number
  cellRoundness?: number
  cellBrightness?: number
  globalIntensity?: number
  glowAmount?: number
  selectedSceneId?: string | null
}

export interface PixGridState {
  version: typeof PIX_GRID_STATE_VERSION
  quality: PixGridQualityTier
  matrixWidth: number
  matrixHeight: number
  backgroundMode: PixGridBackgroundMode
  backgroundColor: string
  cellGap: number
  cellRoundness: number
  cellBrightness: number
  globalIntensity: number
  glowAmount: number
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
