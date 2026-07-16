import type {
  PixGridConversionSettings,
  PixGridPerformanceSettings,
  PixGridQualityTier,
  PixGridRuntimeDiagnosticsSettings,
  PixGridState,
} from './PixGridTypes'
import { PIX_GRID_STATE_VERSION } from './PixGridTypes'

export const PIX_GRID_MATRIX_DIMENSIONS: Readonly<Record<PixGridQualityTier, Readonly<{ width: number; height: number }>>> = {
  draft: { width: 64, height: 36 },
  low: { width: 96, height: 54 },
  high: { width: 160, height: 90 },
  ultra: { width: 256, height: 144 },
}

export const DEFAULT_PIX_GRID_QUALITY: PixGridQualityTier = 'high'
export const DEFAULT_PIX_GRID_PRESET_ID = 'pix-grid-bass-beacon'
export const DEFAULT_PIX_GRID_SCENE_ID = 'pix-grid-bass-beacon-intro'

export const DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS: PixGridPerformanceSettings = {
  enabled: false,
  sharedPerformanceProgramId: null,
  seed: 1,
  lockedRoutes: [],
}

export const DEFAULT_PIX_GRID_CONVERSION_SETTINGS: PixGridConversionSettings = {
  fitMode: 'contain',
  quantizationColors: 16,
  ditherMode: 'none',
  preserveAlpha: true,
}

export const DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS: PixGridRuntimeDiagnosticsSettings = {
  showFps: false,
  showMatrixBounds: false,
  logLifecycle: false,
}

export function resolvePixGridMatrixDimensions(quality: PixGridQualityTier): Readonly<{ width: number; height: number }> {
  return PIX_GRID_MATRIX_DIMENSIONS[quality]
}

export function createDefaultPixGridState(): PixGridState {
  const dimensions = resolvePixGridMatrixDimensions(DEFAULT_PIX_GRID_QUALITY)
  return {
    version: PIX_GRID_STATE_VERSION,
    quality: DEFAULT_PIX_GRID_QUALITY,
    matrixWidth: dimensions.width,
    matrixHeight: dimensions.height,
    backgroundMode: 'preset',
    backgroundColor: '#030608',
    backgroundBrightness: 0.18,
    cellGap: 0.16,
    cellRoundness: 0.18,
    cellBrightness: 0.82,
    globalIntensity: 0.88,
    glowAmount: 0.34,
    diffusion: 0.12,
    rgbSubpixelMode: false,
    stoppedBehavior: 'baseline',
    selectedPresetId: DEFAULT_PIX_GRID_PRESET_ID,
    selectedSceneId: DEFAULT_PIX_GRID_SCENE_ID,
    authoringOverlayVisible: false,
    editorTool: 'select',
    layers: [
      { id: 'pix-grid-layer-base', name: 'Base Artwork', visible: true, opacity: 1, blendMode: 'normal' },
    ],
    groups: [],
    pixelOverrides: [],
    performance: { ...DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS },
    conversion: { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS },
    diagnostics: { ...DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS },
  }
}
