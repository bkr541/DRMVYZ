/**
 * SHIFTGRID's durable authoring contract.
 *
 * This document contains preferences only. Tile positions, decoded sources,
 * pattern cursors, transition progress, and audio envelopes are runtime state
 * and deliberately live outside the React store.
 */

export type CanvasShiftgridSourceMode = 'auto' | 'single' | 'pool'
export type CanvasShiftgridMosaicType = 'reconstruction' | 'patchwork' | 'strips'
export type CanvasShiftgridGridMode = 'auto' | 'fixed'
export type CanvasShiftgridTileShape = 'square' | 'rectangular'
export type CanvasShiftgridGridPreset = 'auto' | 'custom' | '3x3' | '4x4' | '5x5' | '6x6' | '8x8' | '10x6' | '16x9'
export type CanvasShiftgridFitMode = 'contain' | 'cover'
export type CanvasShiftgridPattern = 'rowSlide' | 'columnSlide' | 'cascade' | 'spiral' | 'randomWalk' | 'reconstruct'
export type CanvasShiftgridTrigger = 'beat' | 'beat2' | 'beat4' | 'bar' | 'bar4' | 'bar8' | 'phrase' | 'section' | 'drop'
export type CanvasShiftgridEasing = 'linear' | 'easeOut' | 'spring'
export type CanvasShiftgridReconstructionMode = 'continuous' | 'onTrigger' | 'holdThenReturn'
export type CanvasShiftgridPoolSelectionMode = 'sequential' | 'shuffle' | 'random'
export type CanvasShiftgridQuality = 'auto' | 'low' | 'balanced' | 'high'

export const CANVAS_SHIFTGRID_SETTINGS_VERSION = 2 as const

export interface CanvasShiftgridSettings {
  version: typeof CANVAS_SHIFTGRID_SETTINGS_VERSION
  sourceMode: CanvasShiftgridSourceMode
  mosaicType: CanvasShiftgridMosaicType
  gridMode: CanvasShiftgridGridMode
  gridColumns: number
  gridRows: number
  gridPreset: CanvasShiftgridGridPreset
  tileShape: CanvasShiftgridTileShape
  fitMode: CanvasShiftgridFitMode
  choreographyPattern: CanvasShiftgridPattern
  patternChange: boolean
  trigger: CanvasShiftgridTrigger
  autoPerformance: boolean
  bpmSync: boolean
  movementAmount: number
  movementSpeed: number
  travelDistance: number
  stagger: number
  easing: CanvasShiftgridEasing
  reconstructionMode: CanvasShiftgridReconstructionMode
  reconstructionStrength: number
  reconstructionRate: number
  holdBeats: number
  poolSelectionMode: CanvasShiftgridPoolSelectionMode
  avoidImmediateRepeat: boolean
  poolSourceLimit: number
  enhancedEffects: boolean
  depthAmount: number
  edgeGlow: number
  chromaticSplit: number
  motionBlur: number
  edgeFeather: number
  quality: CanvasShiftgridQuality
  renderScale: number
  tileBudget: number
  deterministicSeed: number
}

export const DEFAULT_CANVAS_SHIFTGRID_SETTINGS: CanvasShiftgridSettings = {
  version: CANVAS_SHIFTGRID_SETTINGS_VERSION,
  sourceMode: 'single',
  mosaicType: 'reconstruction',
  gridMode: 'auto',
  gridColumns: 6,
  gridRows: 6,
  gridPreset: 'auto',
  tileShape: 'square',
  fitMode: 'contain',
  choreographyPattern: 'rowSlide',
  patternChange: true,
  trigger: 'bar4',
  autoPerformance: true,
  bpmSync: true,
  movementAmount: 0.65,
  movementSpeed: 0.5,
  travelDistance: 0.8,
  stagger: 0.35,
  easing: 'easeOut',
  reconstructionMode: 'holdThenReturn',
  reconstructionStrength: 0.85,
  reconstructionRate: 0.55,
  holdBeats: 2,
  poolSelectionMode: 'shuffle',
  avoidImmediateRepeat: true,
  poolSourceLimit: 24,
  enhancedEffects: false,
  depthAmount: 0,
  edgeGlow: 0,
  chromaticSplit: 0,
  motionBlur: 0,
  edgeFeather: 0,
  quality: 'auto',
  renderScale: 1,
  tileBudget: 256,
  deterministicSeed: 73421,
}

export const CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'single', label: 'Single' },
  { value: 'pool', label: 'Pool' },
] as const

export const CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS = [
  { value: 'reconstruction', label: 'Reconstruction' },
  { value: 'patchwork', label: 'Patchwork' },
  { value: 'strips', label: 'Strips' },
] as const

export const CANVAS_SHIFTGRID_GRID_MODE_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'fixed', label: 'Fixed' },
] as const

export const CANVAS_SHIFTGRID_GRID_PRESET_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: '3x3', label: '3 × 3' },
  { value: '4x4', label: '4 × 4' },
  { value: '5x5', label: '5 × 5' },
  { value: '6x6', label: '6 × 6' },
  { value: '8x8', label: '8 × 8' },
  { value: '10x6', label: '10 × 6' },
  { value: '16x9', label: '16 × 9' },
  { value: 'custom', label: 'Custom' },
] as const

export const CANVAS_SHIFTGRID_FIT_MODE_OPTIONS = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
] as const

export const CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'rectangular', label: 'Rectangular' },
] as const

export const CANVAS_SHIFTGRID_PATTERN_OPTIONS = [
  { value: 'rowSlide', label: 'Row Slide' },
  { value: 'columnSlide', label: 'Column Slide' },
  { value: 'cascade', label: 'Cascade' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'randomWalk', label: 'Random Walk' },
  { value: 'reconstruct', label: 'Reconstruct' },
] as const

export const CANVAS_SHIFTGRID_TRIGGER_OPTIONS = [
  { value: 'beat', label: 'Beat' },
  { value: 'beat2', label: 'Every 2 Beats' },
  { value: 'beat4', label: 'Every 4 Beats' },
  { value: 'bar', label: 'Bar' },
  { value: 'bar4', label: 'Every 4 Bars' },
  { value: 'bar8', label: 'Every 8 Bars' },
  { value: 'phrase', label: 'Phrase' },
  { value: 'section', label: 'Section' },
  { value: 'drop', label: 'Drop' },
] as const

export const CANVAS_SHIFTGRID_EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'easeOut', label: 'Ease Out' },
  { value: 'spring', label: 'Spring' },
] as const

export const CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'onTrigger', label: 'On Trigger' },
  { value: 'holdThenReturn', label: 'Hold then Return' },
] as const

export const CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'random', label: 'Random' },
] as const

export const CANVAS_SHIFTGRID_QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
] as const

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finite(value, fallback)))
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(clamp(value, fallback, min, max))
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function pick<T extends string>(value: unknown, options: ReadonlyArray<{ value: T }>, fallback: T): T {
  return options.some(option => option.value === value) ? value as T : fallback
}

/** Safe for absent P0 settings, P0-to-P1 migration, and forward-compatible imports. */
export function normalizeCanvasShiftgridSettings(value: unknown): CanvasShiftgridSettings {
  const source = record(value)
  const defaults = DEFAULT_CANVAS_SHIFTGRID_SETTINGS
  const sourceVersion = integer(source.version, 1, 1, CANVAS_SHIFTGRID_SETTINGS_VERSION)
  const legacyGridMode = pick(source.gridMode, CANVAS_SHIFTGRID_GRID_MODE_OPTIONS, defaults.gridMode)
  const gridPreset = sourceVersion >= 2
    ? pick(source.gridPreset, CANVAS_SHIFTGRID_GRID_PRESET_OPTIONS, defaults.gridPreset)
    : legacyGridMode === 'auto' ? 'auto' : 'custom'
  return {
    version: CANVAS_SHIFTGRID_SETTINGS_VERSION,
    sourceMode: pick(source.sourceMode, CANVAS_SHIFTGRID_SOURCE_MODE_OPTIONS, defaults.sourceMode),
    mosaicType: pick(source.mosaicType, CANVAS_SHIFTGRID_MOSAIC_TYPE_OPTIONS, defaults.mosaicType),
    gridMode: gridPreset === 'auto' ? 'auto' : 'fixed',
    gridColumns: integer(source.gridColumns, defaults.gridColumns, 2, 32),
    gridRows: integer(source.gridRows, defaults.gridRows, 2, 24),
    gridPreset,
    tileShape: pick(source.tileShape, CANVAS_SHIFTGRID_TILE_SHAPE_OPTIONS, defaults.tileShape),
    fitMode: pick(source.fitMode, CANVAS_SHIFTGRID_FIT_MODE_OPTIONS, defaults.fitMode),
    choreographyPattern: pick(source.choreographyPattern, CANVAS_SHIFTGRID_PATTERN_OPTIONS, defaults.choreographyPattern),
    patternChange: boolean(source.patternChange, defaults.patternChange),
    trigger: pick(source.trigger, CANVAS_SHIFTGRID_TRIGGER_OPTIONS, defaults.trigger),
    autoPerformance: boolean(source.autoPerformance, defaults.autoPerformance),
    bpmSync: boolean(source.bpmSync, defaults.bpmSync),
    movementAmount: clamp(source.movementAmount, defaults.movementAmount, 0, 1),
    movementSpeed: clamp(source.movementSpeed, defaults.movementSpeed, 0, 2),
    travelDistance: clamp(source.travelDistance, defaults.travelDistance, 0, 2),
    stagger: clamp(source.stagger, defaults.stagger, 0, 1),
    easing: pick(source.easing, CANVAS_SHIFTGRID_EASING_OPTIONS, defaults.easing),
    reconstructionMode: pick(source.reconstructionMode, CANVAS_SHIFTGRID_RECONSTRUCTION_MODE_OPTIONS, defaults.reconstructionMode),
    reconstructionStrength: clamp(source.reconstructionStrength, defaults.reconstructionStrength, 0, 1),
    reconstructionRate: clamp(source.reconstructionRate, defaults.reconstructionRate, 0, 1),
    holdBeats: integer(source.holdBeats, defaults.holdBeats, 0, 32),
    poolSelectionMode: pick(source.poolSelectionMode, CANVAS_SHIFTGRID_POOL_SELECTION_MODE_OPTIONS, defaults.poolSelectionMode),
    avoidImmediateRepeat: boolean(source.avoidImmediateRepeat, defaults.avoidImmediateRepeat),
    poolSourceLimit: integer(source.poolSourceLimit, defaults.poolSourceLimit, 1, 64),
    enhancedEffects: boolean(source.enhancedEffects, defaults.enhancedEffects),
    depthAmount: clamp(source.depthAmount, defaults.depthAmount, 0, 1),
    edgeGlow: clamp(source.edgeGlow, defaults.edgeGlow, 0, 1),
    chromaticSplit: clamp(source.chromaticSplit, defaults.chromaticSplit, 0, 1),
    motionBlur: clamp(source.motionBlur, defaults.motionBlur, 0, 1),
    edgeFeather: clamp(source.edgeFeather, defaults.edgeFeather, 0, 0.5),
    quality: pick(source.quality, CANVAS_SHIFTGRID_QUALITY_OPTIONS, defaults.quality),
    renderScale: clamp(source.renderScale, defaults.renderScale, 0.5, 1),
    tileBudget: integer(source.tileBudget, defaults.tileBudget, 16, 768),
    deterministicSeed: integer(source.deterministicSeed, defaults.deterministicSeed, 0, 999999999),
  }
}
