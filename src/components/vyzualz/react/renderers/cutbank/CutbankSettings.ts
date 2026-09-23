/**
 * CUTBANK — persisted preset settings.
 *
 * Kept free of ReactTypes imports so ReactTypes can embed `CanvasCutbankSettings`
 * inside `CanvasPresetSettings` without an import cycle. Only durable user
 * authoring lives here; runtime state (selection index, transitions, media
 * handles, buffers) never enters persisted settings.
 *
 * Media Pool selection is intentionally absent: CUTBANK uses the canonical
 * CANVAS `activeMediaPoolId`, not a second pool pointer.
 */

export type CanvasCutbankMediaMode = 'mixed' | 'images' | 'text' | 'svg' | 'video'
export type CanvasCutbankSelectionMode = 'random' | 'shuffle'
export type CanvasCutbankLayoutMode =
  | 'auto' | 'hero' | 'microtype' | 'overscan' | 'edgeCrop' | 'verticalType' | 'poster'
  | 'stack' | 'split' | 'tunnel' | 'fragment' | 'logoHit' | 'void'
export type CanvasCutbankTreatmentMode = 'auto' | 'manual' | 'none'
export type CanvasCutbankTransitionStyle =
  | 'auto' | 'hardCut' | 'blackCut' | 'whiteFlash' | 'thresholdDissolve' | 'signalTear'
  | 'frameShred' | 'verticalWipe' | 'horizontalSlice' | 'zoomCollapse' | 'zoomBurst'
  | 'rgbCut' | 'feedbackSmear' | 'noiseDissolve' | 'exposureBurn'
export type CanvasCutbankPaletteMode = 'source' | 'monochrome' | 'auto' | 'custom'

export const CANVAS_CUTBANK_SETTINGS_VERSION = 1 as const
export const CANVAS_CUTBANK_MAX_LAYERS = 4

export interface CanvasCutbankSettings {
  version: typeof CANVAS_CUTBANK_SETTINGS_VERSION
  // Master Controls
  masterIntensity: number
  bpmSync: boolean
  autoPerformance: boolean
  chaos: number
  motionAmount: number
  transitionIntensity: number
  // Design
  mediaMode: CanvasCutbankMediaMode
  selectionMode: CanvasCutbankSelectionMode
  layoutMode: CanvasCutbankLayoutMode
  layoutComplexity: number
  cutRate: number
  minimumHold: number
  maximumHold: number
  compositionFreedom: number
  layerCount: number
  // Effects
  effectsEnabled: boolean
  treatmentMode: CanvasCutbankTreatmentMode
  effectAmount: number
  treatmentVariety: number
  grain: number
  threshold: number
  distortion: number
  signalDamage: number
  rgbSplit: number
  feedback: number
  lensWarp: number
  smear: number
  flashAmount: number
  transitionStyle: CanvasCutbankTransitionStyle
  transitionDuration: number
  transitionVariety: number
  // Palette
  paletteMode: CanvasCutbankPaletteMode
  sourceColorAmount: number
  saturation: number
  contrast: number
  exposure: number
  blackLevel: number
  whiteLevel: number
  tintColor: string
  tintAmount: number
  accentColor1: string
  accentColor2: string
  colorizeAmount: number
  invertColors: boolean
  colorChangeRate: number
}

export const DEFAULT_CANVAS_CUTBANK_SETTINGS: CanvasCutbankSettings = {
  version: CANVAS_CUTBANK_SETTINGS_VERSION,
  masterIntensity: 0.65,
  bpmSync: true,
  autoPerformance: true,
  chaos: 0.3,
  motionAmount: 0.35,
  transitionIntensity: 0.5,
  mediaMode: 'mixed',
  selectionMode: 'shuffle',
  layoutMode: 'auto',
  layoutComplexity: 0.35,
  cutRate: 0.4,
  minimumHold: 0.2,
  maximumHold: 0.7,
  compositionFreedom: 0.5,
  layerCount: 2,
  effectsEnabled: true,
  treatmentMode: 'auto',
  effectAmount: 0.5,
  treatmentVariety: 0.4,
  grain: 0.35,
  threshold: 0.4,
  distortion: 0.25,
  signalDamage: 0.25,
  rgbSplit: 0.25,
  feedback: 0.15,
  lensWarp: 0.15,
  smear: 0.2,
  flashAmount: 0.3,
  transitionStyle: 'auto',
  transitionDuration: 0.35,
  transitionVariety: 0.4,
  paletteMode: 'monochrome',
  sourceColorAmount: 0.85,
  saturation: 0.5,
  contrast: 0.7,
  exposure: 0.5,
  blackLevel: 0.3,
  whiteLevel: 0.9,
  tintColor: '#FFFFFF',
  tintAmount: 0,
  accentColor1: '#FF2D2D',
  accentColor2: '#2B6CFF',
  colorizeAmount: 0.6,
  invertColors: false,
  colorChangeRate: 0.3,
}

export const CANVAS_CUTBANK_MEDIA_MODE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankMediaMode; label: string }> = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'images', label: 'Images' },
  { value: 'text', label: 'Text' },
  { value: 'svg', label: 'SVG' },
  { value: 'video', label: 'Video' },
]

export const CANVAS_CUTBANK_SELECTION_MODE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankSelectionMode; label: string }> = [
  { value: 'random', label: 'Random' },
  { value: 'shuffle', label: 'Shuffle' },
]

export const CANVAS_CUTBANK_LAYOUT_MODE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankLayoutMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'hero', label: 'Hero' },
  { value: 'microtype', label: 'Microtype' },
  { value: 'overscan', label: 'Overscan' },
  { value: 'edgeCrop', label: 'Edge Crop' },
  { value: 'verticalType', label: 'Vertical Type' },
  { value: 'poster', label: 'Poster' },
  { value: 'stack', label: 'Stack' },
  { value: 'split', label: 'Split' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'fragment', label: 'Fragment' },
  { value: 'logoHit', label: 'Logo Hit' },
  { value: 'void', label: 'Void' },
]

export const CANVAS_CUTBANK_TREATMENT_MODE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankTreatmentMode; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'manual', label: 'Manual' },
  { value: 'none', label: 'None' },
]

export const CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankTransitionStyle; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'hardCut', label: 'Hard Cut' },
  { value: 'blackCut', label: 'Black Cut' },
  { value: 'whiteFlash', label: 'White Flash' },
  { value: 'thresholdDissolve', label: 'Threshold Dissolve' },
  { value: 'signalTear', label: 'Signal Tear' },
  { value: 'frameShred', label: 'Frame Shred' },
  { value: 'verticalWipe', label: 'Vertical Wipe' },
  { value: 'horizontalSlice', label: 'Horizontal Slice' },
  { value: 'zoomCollapse', label: 'Zoom Collapse' },
  { value: 'zoomBurst', label: 'Zoom Burst' },
  { value: 'rgbCut', label: 'RGB Cut' },
  { value: 'feedbackSmear', label: 'Feedback Smear' },
  { value: 'noiseDissolve', label: 'Noise Dissolve' },
  { value: 'exposureBurn', label: 'Exposure Burn' },
]

export const CANVAS_CUTBANK_PALETTE_MODE_OPTIONS: ReadonlyArray<{ value: CanvasCutbankPaletteMode; label: string }> = [
  { value: 'source', label: 'Source' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'auto', label: 'Auto' },
  { value: 'custom', label: 'Custom' },
]

function clamp01(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(1, Math.max(0, numeric))
}

function pick<T extends string>(value: unknown, options: ReadonlyArray<{ value: T }>, fallback: T): T {
  return options.some(option => option.value === value) ? value as T : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : fallback
}

/**
 * Safe for `undefined` / pre-CUTBANK projects: every field falls back to the
 * authored default, so old saved projects load with a complete settings block.
 */
export function normalizeCanvasCutbankSettings(value: unknown): CanvasCutbankSettings {
  const d = DEFAULT_CANVAS_CUTBANK_SETTINGS
  const s = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const minimumHold = clamp01(s.minimumHold, d.minimumHold)
  const maximumHold = Math.max(minimumHold, clamp01(s.maximumHold, d.maximumHold))
  const requestedLayers = typeof s.layerCount === 'number' && Number.isFinite(s.layerCount) ? Math.round(s.layerCount) : d.layerCount
  return {
    version: CANVAS_CUTBANK_SETTINGS_VERSION,
    masterIntensity: clamp01(s.masterIntensity, d.masterIntensity),
    bpmSync: bool(s.bpmSync, d.bpmSync),
    autoPerformance: bool(s.autoPerformance, d.autoPerformance),
    chaos: clamp01(s.chaos, d.chaos),
    motionAmount: clamp01(s.motionAmount, d.motionAmount),
    transitionIntensity: clamp01(s.transitionIntensity, d.transitionIntensity),
    mediaMode: pick(s.mediaMode, CANVAS_CUTBANK_MEDIA_MODE_OPTIONS, d.mediaMode),
    selectionMode: pick(s.selectionMode, CANVAS_CUTBANK_SELECTION_MODE_OPTIONS, d.selectionMode),
    layoutMode: pick(s.layoutMode, CANVAS_CUTBANK_LAYOUT_MODE_OPTIONS, d.layoutMode),
    layoutComplexity: clamp01(s.layoutComplexity, d.layoutComplexity),
    cutRate: clamp01(s.cutRate, d.cutRate),
    minimumHold,
    maximumHold,
    compositionFreedom: clamp01(s.compositionFreedom, d.compositionFreedom),
    layerCount: Math.min(CANVAS_CUTBANK_MAX_LAYERS, Math.max(1, requestedLayers)),
    effectsEnabled: bool(s.effectsEnabled, d.effectsEnabled),
    treatmentMode: pick(s.treatmentMode, CANVAS_CUTBANK_TREATMENT_MODE_OPTIONS, d.treatmentMode),
    effectAmount: clamp01(s.effectAmount, d.effectAmount),
    treatmentVariety: clamp01(s.treatmentVariety, d.treatmentVariety),
    grain: clamp01(s.grain, d.grain),
    threshold: clamp01(s.threshold, d.threshold),
    distortion: clamp01(s.distortion, d.distortion),
    signalDamage: clamp01(s.signalDamage, d.signalDamage),
    rgbSplit: clamp01(s.rgbSplit, d.rgbSplit),
    feedback: clamp01(s.feedback, d.feedback),
    lensWarp: clamp01(s.lensWarp, d.lensWarp),
    smear: clamp01(s.smear, d.smear),
    flashAmount: clamp01(s.flashAmount, d.flashAmount),
    transitionStyle: pick(s.transitionStyle, CANVAS_CUTBANK_TRANSITION_STYLE_OPTIONS, d.transitionStyle),
    transitionDuration: clamp01(s.transitionDuration, d.transitionDuration),
    transitionVariety: clamp01(s.transitionVariety, d.transitionVariety),
    paletteMode: pick(s.paletteMode, CANVAS_CUTBANK_PALETTE_MODE_OPTIONS, d.paletteMode),
    sourceColorAmount: clamp01(s.sourceColorAmount, d.sourceColorAmount),
    saturation: clamp01(s.saturation, d.saturation),
    contrast: clamp01(s.contrast, d.contrast),
    exposure: clamp01(s.exposure, d.exposure),
    blackLevel: clamp01(s.blackLevel, d.blackLevel),
    whiteLevel: clamp01(s.whiteLevel, d.whiteLevel),
    tintColor: hex(s.tintColor, d.tintColor),
    tintAmount: clamp01(s.tintAmount, d.tintAmount),
    accentColor1: hex(s.accentColor1, d.accentColor1),
    accentColor2: hex(s.accentColor2, d.accentColor2),
    colorizeAmount: clamp01(s.colorizeAmount, d.colorizeAmount),
    invertColors: bool(s.invertColors, d.invertColors),
    colorChangeRate: clamp01(s.colorChangeRate, d.colorChangeRate),
  }
}
