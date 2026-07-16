import type {
  PixGridConversionSettings,
  PixGridPerformanceSettings,
  PixGridQualityTier,
  PixGridRuntimeDiagnosticsSettings,
  PixGridState,
  PixGridScene,
} from './PixGridTypes'
import { PIX_GRID_STATE_VERSION, type PixGridLayer } from './PixGridTypes'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'

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
  selectedMediaId: null,
  fitMode: 'contain',
  positionX: 0.5,
  positionY: 0.5,
  scale: 1,
  sampling: 'crisp',
  colorMode: 'original',
  paletteSize: 16,
  ditherMode: 'none',
  alphaThreshold: 0.04,
  preserveAlpha: true,
  contrast: 1,
  brightness: 1,
  saturation: 1,
  edgeEnhancement: 0,
  backgroundHandling: 'transparent',
  backgroundColor: '#000000',
  brandStrength: 0.8,
  preserveBlack: true,
  preserveWhite: true,
}

export const DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS: PixGridRuntimeDiagnosticsSettings = {
  showFps: false,
  showMatrixBounds: false,
  logLifecycle: false,
}

export function resolvePixGridMatrixDimensions(quality: PixGridQualityTier): Readonly<{ width: number; height: number }> {
  return PIX_GRID_MATRIX_DIMENSIONS[quality]
}

export function clonePixGridLayer(layer: PixGridLayer): PixGridLayer {
  return {
    ...layer,
    mediaId: layer.mediaId ?? null,
    locked: layer.locked === true,
    position: { ...layer.position },
    scale: { ...layer.scale },
    paletteMap: { ...layer.paletteMap },
    animations: layer.animations.map(animation => ({ ...animation })),
    ...(layer.audioReactivity ? { audioReactivity: { ...layer.audioReactivity } } : {}),
  }
}

function pixGridSceneNameFromId(id: string, index: number): string {
  const parts = id.split('-')
  const suffix = parts[parts.length - 1]
  return suffix ? suffix.replace(/^./, value => value.toUpperCase()) : `Scene ${index + 1}`
}

export function createDefaultPixGridState(): PixGridState {
  const dimensions = resolvePixGridMatrixDimensions(DEFAULT_PIX_GRID_QUALITY)
  const defaultSettings = PIX_GRID_PRESET_BY_ID.get(DEFAULT_PIX_GRID_PRESET_ID)?.pixGridSettings
  const defaultLayers = defaultSettings?.layers?.map(clonePixGridLayer) ?? []
  const sceneIds = Object.keys(defaultSettings?.sceneSettings ?? {})
  const defaultScenes: PixGridScene[] = (sceneIds.length > 0 ? sceneIds : [DEFAULT_PIX_GRID_SCENE_ID]).map((id, index) => ({
    id,
    name: pixGridSceneNameFromId(id, index),
    layerIds: defaultLayers.map(layer => layer.id),
    pixelOverrides: [],
  }))
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
    editor: {
      guidesVisible: true,
      zoom: 1,
      panX: 0,
      panY: 0,
      paintColor: '#ffffff',
      paintOpacity: 1,
      eraserMode: 'off',
      selectedLayerId: defaultLayers[0]?.id ?? null,
      selectedGroupId: null,
      previewReactionAssignmentId: null,
      selection: null,
    },
    scenes: defaultScenes,
    layers: defaultLayers,
    groups: [],
    pixelOverrides: [],
    performance: { ...DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS },
    conversion: { ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS },
    diagnostics: { ...DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS },
  }
}
