import {
  DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
  DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS,
  DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS,
  createDefaultPixGridState,
  resolvePixGridMatrixDimensions,
} from './PixGridDefaults'
import {
  PIX_GRID_STATE_VERSION,
  type PixGridBackgroundMode,
  type PixGridBlendMode,
  type PixGridEditorTool,
  type PixGridGroup,
  type PixGridLayer,
  type PixGridPixelOverride,
  type PixGridPresetSettings,
  type PixGridQualityTier,
  type PixGridState,
} from './PixGridTypes'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const QUALITY_TIERS = new Set<PixGridQualityTier>(['draft', 'low', 'high', 'ultra'])
const BACKGROUND_MODES = new Set<PixGridBackgroundMode>(['preset', 'black', 'custom'])
const EDITOR_TOOLS = new Set<PixGridEditorTool>(['select', 'pencil', 'eraser', 'fill', 'group'])
const BLEND_MODES = new Set<PixGridBlendMode>(['normal', 'add', 'multiply'])
const MAX_LAYERS = 64
const MAX_GROUPS = 256
const MAX_CELL_RUNS_PER_GROUP = 4096
const MAX_PIXEL_OVERRIDES = 50_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function text(value: unknown, fallback: string, maxLength = 96): string {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback
}

function nullableId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 128) : null
}

export function normalizePixGridColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

export function normalizePixGridQuality(value: unknown, fallback: PixGridQualityTier = 'high'): PixGridQualityTier {
  return QUALITY_TIERS.has(value as PixGridQualityTier) ? value as PixGridQualityTier : fallback
}

export function normalizePixGridPresetSettings(value: unknown): PixGridPresetSettings | undefined {
  if (!isRecord(value)) return undefined
  const pattern = value.pattern === 'bassBeacon' || value.pattern === 'geometricReactor' || value.pattern === 'pixelParade'
    ? value.pattern
    : 'bassBeacon'
  const quality = value.quality == null ? undefined : normalizePixGridQuality(value.quality)
  const backgroundMode = value.backgroundMode == null || !BACKGROUND_MODES.has(value.backgroundMode as PixGridBackgroundMode)
    ? undefined
    : value.backgroundMode as PixGridBackgroundMode
  return {
    pattern,
    ...(quality ? { quality } : {}),
    ...(backgroundMode ? { backgroundMode } : {}),
    ...(value.backgroundColor != null ? { backgroundColor: normalizePixGridColor(value.backgroundColor, '#030608') } : {}),
    ...(value.cellGap != null ? { cellGap: clamp(value.cellGap, 0, 0.45, 0.16) } : {}),
    ...(value.cellRoundness != null ? { cellRoundness: clamp(value.cellRoundness, 0, 0.5, 0.18) } : {}),
    ...(value.cellBrightness != null ? { cellBrightness: clamp(value.cellBrightness, 0, 1, 0.82) } : {}),
    ...(value.globalIntensity != null ? { globalIntensity: clamp(value.globalIntensity, 0, 1, 0.88) } : {}),
    ...(value.glowAmount != null ? { glowAmount: clamp(value.glowAmount, 0, 1, 0.34) } : {}),
    ...(value.selectedSceneId !== undefined ? { selectedSceneId: nullableId(value.selectedSceneId) } : {}),
  }
}

function normalizeLayers(value: unknown, fallback: PixGridLayer[]): PixGridLayer[] {
  if (!Array.isArray(value)) return fallback
  const seen = new Set<string>()
  return value.slice(0, MAX_LAYERS).flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const baseId = text(raw.id, `pix-grid-layer-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const blendMode = BLEND_MODES.has(raw.blendMode as PixGridBlendMode)
      ? raw.blendMode as PixGridBlendMode
      : 'normal'
    return [{
      id,
      name: text(raw.name, `Layer ${index + 1}`),
      visible: raw.visible !== false,
      opacity: clamp(raw.opacity, 0, 1, 1),
      blendMode,
    }]
  })
}

function normalizeGroups(value: unknown, width: number, height: number): PixGridGroup[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, MAX_GROUPS).flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const baseId = text(raw.id, `pix-grid-group-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const runs = Array.isArray(raw.cellRuns)
      ? raw.cellRuns.slice(0, MAX_CELL_RUNS_PER_GROUP).flatMap(run => {
          if (!Array.isArray(run) || run.length < 3) return []
          const row = Math.max(0, Math.min(height - 1, Math.round(finite(run[0], 0))))
          const start = Math.max(0, Math.min(width - 1, Math.round(finite(run[1], 0))))
          const length = Math.max(1, Math.min(width - start, Math.round(finite(run[2], 1))))
          return [[row, start, length] as const]
        })
      : []
    return [{
      id,
      name: text(raw.name, `Group ${index + 1}`),
      layerId: nullableId(raw.layerId),
      cellRuns: runs,
      smartRuleId: nullableId(raw.smartRuleId),
    }]
  })
}

function normalizePixelOverrides(value: unknown, width: number, height: number): PixGridPixelOverride[] {
  if (!Array.isArray(value)) return []
  const deduped = new Map<string, PixGridPixelOverride>()
  for (const raw of value.slice(0, MAX_PIXEL_OVERRIDES)) {
    if (!Array.isArray(raw) || raw.length < 4) continue
    const x = Math.max(0, Math.min(width - 1, Math.round(finite(raw[0], 0))))
    const y = Math.max(0, Math.min(height - 1, Math.round(finite(raw[1], 0))))
    const color = normalizePixGridColor(raw[2], '#ffffff')
    const brightness = clamp(raw[3], 0, 1, 1)
    deduped.set(`${x}:${y}`, [x, y, color, brightness])
  }
  return [...deduped.values()]
}

export function normalizePixGridState(value: unknown): PixGridState {
  const defaults = createDefaultPixGridState()
  const input = isRecord(value) ? value : {}
  const quality = normalizePixGridQuality(input.quality, defaults.quality)
  const dimensions = resolvePixGridMatrixDimensions(quality)
  const backgroundMode = BACKGROUND_MODES.has(input.backgroundMode as PixGridBackgroundMode)
    ? input.backgroundMode as PixGridBackgroundMode
    : defaults.backgroundMode
  const editorTool = EDITOR_TOOLS.has(input.editorTool as PixGridEditorTool)
    ? input.editorTool as PixGridEditorTool
    : defaults.editorTool
  const layers = normalizeLayers(input.layers, defaults.layers)
  const performance = isRecord(input.performance) ? input.performance : {}
  const conversion = isRecord(input.conversion) ? input.conversion : {}
  const diagnostics = isRecord(input.diagnostics) ? input.diagnostics : {}

  return {
    version: PIX_GRID_STATE_VERSION,
    quality,
    matrixWidth: dimensions.width,
    matrixHeight: dimensions.height,
    backgroundMode,
    backgroundColor: normalizePixGridColor(input.backgroundColor, defaults.backgroundColor),
    cellGap: clamp(input.cellGap, 0, 0.45, defaults.cellGap),
    cellRoundness: clamp(input.cellRoundness, 0, 0.5, defaults.cellRoundness),
    cellBrightness: clamp(input.cellBrightness, 0, 1, defaults.cellBrightness),
    globalIntensity: clamp(input.globalIntensity, 0, 1, defaults.globalIntensity),
    glowAmount: clamp(input.glowAmount, 0, 1, defaults.glowAmount),
    selectedPresetId: nullableId(input.selectedPresetId) ?? defaults.selectedPresetId,
    selectedSceneId: nullableId(input.selectedSceneId) ?? defaults.selectedSceneId,
    authoringOverlayVisible: input.authoringOverlayVisible === true,
    editorTool,
    layers,
    groups: normalizeGroups(input.groups, dimensions.width, dimensions.height),
    pixelOverrides: normalizePixelOverrides(input.pixelOverrides, dimensions.width, dimensions.height),
    performance: {
      enabled: performance.enabled === true,
      sharedPerformanceProgramId: nullableId(performance.sharedPerformanceProgramId),
      seed: Math.max(0, Math.min(2_147_483_647, Math.round(finite(performance.seed, DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS.seed)))),
      lockedRoutes: Array.isArray(performance.lockedRoutes)
        ? [...new Set(performance.lockedRoutes.filter((route): route is string => typeof route === 'string' && Boolean(route.trim())).map(route => route.trim().slice(0, 128)))].slice(0, 128)
        : [],
    },
    conversion: {
      fitMode: conversion.fitMode === 'cover' || conversion.fitMode === 'stretch' ? conversion.fitMode : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.fitMode,
      quantizationColors: Math.max(2, Math.min(256, Math.round(finite(conversion.quantizationColors, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.quantizationColors)))),
      ditherMode: 'none',
      preserveAlpha: conversion.preserveAlpha !== false,
    },
    diagnostics: {
      showFps: diagnostics.showFps === true,
      showMatrixBounds: diagnostics.showMatrixBounds === true,
      logLifecycle: diagnostics.logLifecycle === true,
    },
  }
}
