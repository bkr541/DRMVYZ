import {
  DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
  DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS,
  DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS,
  createDefaultPixGridState,
  resolvePixGridMatrixDimensions,
} from './PixGridDefaults'
import { hasPixGridBuiltInAsset } from './PixGridArtwork'
import {
  MAX_PIX_GRID_ANIMATIONS_PER_LAYER,
  MAX_PIX_GRID_LAYERS,
  MAX_PIX_GRID_VISIBLE_LAYERS,
} from './PixGridLimits'
import {
  PIX_GRID_STATE_VERSION,
  type PixGridAnimationBoundary,
  type PixGridAnimationMode,
  type PixGridAudioSource,
  type PixGridBackgroundMode,
  type PixGridBlendMode,
  type PixGridClipMode,
  type PixGridEditorTool,
  type PixGridGroup,
  type PixGridLayer,
  type PixGridLayerAnimation,
  type PixGridPaletteRole,
  type PixGridPixelOverride,
  type PixGridPresetSettings,
  type PixGridQualityTier,
  type PixGridSceneSettings,
  type PixGridState,
} from './PixGridTypes'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const QUALITY_TIERS = new Set<PixGridQualityTier>(['draft', 'low', 'high', 'ultra'])
const BACKGROUND_MODES = new Set<PixGridBackgroundMode>(['preset', 'black', 'custom'])
const EDITOR_TOOLS = new Set<PixGridEditorTool>(['select', 'pencil', 'eraser', 'fill', 'group'])
const BLEND_MODES = new Set<PixGridBlendMode>(['normal', 'add', 'multiply'])
const CLIP_MODES = new Set<PixGridClipMode>(['clip', 'wrap'])
const PALETTE_ROLES = new Set<PixGridPaletteRole>(['primary', 'secondary', 'accent', 'highlight', 'background'])
const ANIMATION_MODES = new Set<PixGridAnimationMode>([
  'static', 'pulse', 'bounce', 'horizontalScroll', 'verticalScroll', 'pingPong', 'rotate',
  'paletteCycle', 'blink', 'revealRow', 'revealColumn', 'checkerAlternate', 'frameCycle',
  'audioAmplitudeScale', 'beatStepMovement',
])
const ANIMATION_BOUNDARIES = new Set<PixGridAnimationBoundary>(['wrap', 'clamp', 'bounce'])
const AUDIO_SOURCES = new Set<PixGridAudioSource>(['bass', 'mid', 'high', 'volume', 'kick', 'snare', 'hat'])
const STOPPED_BEHAVIORS = new Set(['baseline', 'blackout'])
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
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback
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

function normalizePaletteMap(value: unknown): PixGridLayer['paletteMap'] {
  if (!isRecord(value)) return {}
  const result: PixGridLayer['paletteMap'] = {}
  for (const role of PALETTE_ROLES) {
    if (PALETTE_ROLES.has(value[role] as PixGridPaletteRole)) result[role] = value[role] as PixGridPaletteRole
  }
  return result
}

function normalizeAnimation(value: unknown): PixGridLayerAnimation | null {
  if (!isRecord(value) || !ANIMATION_MODES.has(value.mode as PixGridAnimationMode)) return null
  return {
    mode: value.mode as PixGridAnimationMode,
    speed: clamp(value.speed, 0, 20, 1),
    amount: clamp(value.amount, -4, 4, 0),
    phase: clamp(value.phase, -1000, 1000, 0),
    boundary: ANIMATION_BOUNDARIES.has(value.boundary as PixGridAnimationBoundary)
      ? value.boundary as PixGridAnimationBoundary
      : 'wrap',
    ...(value.axis === 'x' || value.axis === 'y' ? { axis: value.axis } : {}),
    ...(value.stepped != null ? { stepped: value.stepped === true } : {}),
    ...(AUDIO_SOURCES.has(value.audioSource as PixGridAudioSource)
      ? { audioSource: value.audioSource as PixGridAudioSource }
      : {}),
  }
}

function fallbackLayer(index: number, fallback: PixGridLayer[]): PixGridLayer | undefined {
  return fallback[index] ?? fallback[0]
}

export function normalizePixGridLayers(value: unknown, fallback: PixGridLayer[]): PixGridLayer[] {
  if (!Array.isArray(value)) return normalizePixGridLayers(fallback, [])
  const seen = new Set<string>()
  let visibleCount = 0
  return value.slice(0, MAX_PIX_GRID_LAYERS).flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const template = fallbackLayer(index, fallback)
    const candidateAssetId = typeof raw.assetId === 'string' && hasPixGridBuiltInAsset(raw.assetId)
      ? raw.assetId
      : template?.assetId ?? 'pix-bass-word'
    const baseId = text(raw.id, template?.id ?? `pix-grid-layer-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const requestedVisible = raw.visible == null ? template?.visible !== false : raw.visible !== false
    const visible = requestedVisible && visibleCount < MAX_PIX_GRID_VISIBLE_LAYERS
    if (visible) visibleCount += 1
    const position = isRecord(raw.position) ? raw.position : template?.position ?? {}
    const scale = isRecord(raw.scale) ? raw.scale : template?.scale ?? {}
    const reactive = isRecord(raw.audioReactivity) ? raw.audioReactivity : template?.audioReactivity
    const animations = Array.isArray(raw.animations)
      ? raw.animations.slice(0, MAX_PIX_GRID_ANIMATIONS_PER_LAYER).flatMap(item => {
          const normalized = normalizeAnimation(item)
          return normalized ? [normalized] : []
        })
      : template?.animations.map(item => ({ ...item })) ?? []
    const blendMode = BLEND_MODES.has(raw.blendMode as PixGridBlendMode)
      ? raw.blendMode as PixGridBlendMode
      : raw.blendMode == null
        ? template?.blendMode ?? 'normal'
        : 'normal'
    const clipMode = CLIP_MODES.has(raw.clipMode as PixGridClipMode)
      ? raw.clipMode as PixGridClipMode
      : template?.clipMode ?? 'clip'
    const maskAssetId = typeof raw.maskAssetId === 'string' && hasPixGridBuiltInAsset(raw.maskAssetId)
      ? raw.maskAssetId
      : raw.maskAssetId == null
        ? template?.maskAssetId ?? null
        : null
    return [{
      id,
      name: text(raw.name, template?.name ?? `Layer ${index + 1}`),
      assetId: candidateAssetId,
      visible,
      opacity: clamp(raw.opacity, 0, 1, template?.opacity ?? 1),
      position: {
        x: clamp(position.x, 0, 1, template?.position.x ?? 0.5),
        y: clamp(position.y, 0, 1, template?.position.y ?? 0.5),
      },
      scale: {
        x: clamp(scale.x, 0.01, 2, template?.scale.x ?? 0.5),
        y: clamp(scale.y, 0.01, 2, template?.scale.y ?? 0.5),
      },
      rotation: clamp(raw.rotation, -3600, 3600, template?.rotation ?? 0),
      flipX: raw.flipX == null ? template?.flipX ?? false : raw.flipX === true,
      flipY: raw.flipY == null ? template?.flipY ?? false : raw.flipY === true,
      blendMode,
      paletteMap: normalizePaletteMap(raw.paletteMap ?? template?.paletteMap),
      zIndex: Math.round(clamp(raw.zIndex, -100, 100, template?.zIndex ?? index)),
      clipMode,
      maskAssetId,
      animations,
      ...(reactive ? {
        audioReactivity: {
          ...(AUDIO_SOURCES.has(reactive.brightnessSource as PixGridAudioSource)
            ? { brightnessSource: reactive.brightnessSource as PixGridAudioSource }
            : {}),
          ...(reactive.brightnessAmount != null ? { brightnessAmount: clamp(reactive.brightnessAmount, 0, 2, 0) } : {}),
          ...(AUDIO_SOURCES.has(reactive.scaleSource as PixGridAudioSource)
            ? { scaleSource: reactive.scaleSource as PixGridAudioSource }
            : {}),
          ...(reactive.scaleAmount != null ? { scaleAmount: clamp(reactive.scaleAmount, -0.9, 2, 0) } : {}),
          ...(reactive.beatImpact != null ? { beatImpact: clamp(reactive.beatImpact, 0, 2, 0) } : {}),
        },
      } : {}),
      densityRank: clamp(raw.densityRank, 0, 1, template?.densityRank ?? 0),
      seed: Math.max(0, Math.min(2_147_483_647, Math.round(finite(raw.seed, template?.seed ?? index + 1)))),
    }]
  })
}

function normalizeSceneSettings(value: unknown): Record<string, PixGridSceneSettings> | undefined {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value).slice(0, 64).flatMap(([sceneId, raw]) => {
    if (!isRecord(raw)) return []
    const hiddenLayerIds = Array.isArray(raw.hiddenLayerIds)
      ? [...new Set(raw.hiddenLayerIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim().slice(0, 128)))].slice(0, MAX_PIX_GRID_LAYERS)
      : undefined
    const layerOpacity = isRecord(raw.layerOpacity)
      ? Object.fromEntries(Object.entries(raw.layerOpacity).slice(0, MAX_PIX_GRID_LAYERS).map(([id, opacity]) => [id.slice(0, 128), clamp(opacity, 0, 1, 1)]))
      : undefined
    return [[sceneId.slice(0, 128), {
      density: clamp(raw.density, 0, 1, 1),
      motionMultiplier: clamp(raw.motionMultiplier, 0, 4, 1),
      paletteOffset: Math.round(clamp(raw.paletteOffset, -20, 20, 0)),
      ...(hiddenLayerIds ? { hiddenLayerIds } : {}),
      ...(layerOpacity ? { layerOpacity } : {}),
    } satisfies PixGridSceneSettings] as const]
  })
  return Object.fromEntries(entries)
}

export function normalizePixGridPresetSettings(value: unknown): PixGridPresetSettings | undefined {
  if (!isRecord(value)) return undefined
  const pattern = value.pattern === 'geometricReactor' || value.pattern === 'pixelParade' ? value.pattern : 'bassBeacon'
  const quality = value.quality == null ? undefined : normalizePixGridQuality(value.quality)
  const backgroundMode = value.backgroundMode == null || !BACKGROUND_MODES.has(value.backgroundMode as PixGridBackgroundMode)
    ? undefined
    : value.backgroundMode as PixGridBackgroundMode
  const layers = value.layers == null ? undefined : normalizePixGridLayers(value.layers, [])
  const sceneSettings = normalizeSceneSettings(value.sceneSettings)
  return {
    pattern,
    ...(quality ? { quality } : {}),
    ...(backgroundMode ? { backgroundMode } : {}),
    ...(value.backgroundColor != null ? { backgroundColor: normalizePixGridColor(value.backgroundColor, '#030608') } : {}),
    ...(value.backgroundBrightness != null ? { backgroundBrightness: clamp(value.backgroundBrightness, 0, 1, 0.18) } : {}),
    ...(value.cellGap != null ? { cellGap: clamp(value.cellGap, 0, 0.45, 0.16) } : {}),
    ...(value.cellRoundness != null ? { cellRoundness: clamp(value.cellRoundness, 0, 0.5, 0.18) } : {}),
    ...(value.cellBrightness != null ? { cellBrightness: clamp(value.cellBrightness, 0, 1, 0.82) } : {}),
    ...(value.globalIntensity != null ? { globalIntensity: clamp(value.globalIntensity, 0, 1, 0.88) } : {}),
    ...(value.glowAmount != null ? { glowAmount: clamp(value.glowAmount, 0, 1, 0.34) } : {}),
    ...(value.diffusion != null ? { diffusion: clamp(value.diffusion, 0, 1, 0.12) } : {}),
    ...(value.rgbSubpixelMode != null ? { rgbSubpixelMode: value.rgbSubpixelMode === true } : {}),
    ...(value.selectedSceneId !== undefined ? { selectedSceneId: nullableId(value.selectedSceneId) } : {}),
    ...(layers ? { layers } : {}),
    ...(sceneSettings ? { sceneSettings } : {}),
  }
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
    return [{ id, name: text(raw.name, `Group ${index + 1}`), layerId: nullableId(raw.layerId), cellRuns: runs, smartRuleId: nullableId(raw.smartRuleId) }]
  })
}

function normalizePixelOverrides(value: unknown, width: number, height: number): PixGridPixelOverride[] {
  if (!Array.isArray(value)) return []
  const deduped = new Map<string, PixGridPixelOverride>()
  for (const raw of value.slice(0, MAX_PIXEL_OVERRIDES)) {
    if (!Array.isArray(raw) || raw.length < 4) continue
    const x = Math.max(0, Math.min(width - 1, Math.round(finite(raw[0], 0))))
    const y = Math.max(0, Math.min(height - 1, Math.round(finite(raw[1], 0))))
    deduped.set(`${x}:${y}`, [x, y, normalizePixGridColor(raw[2], '#ffffff'), clamp(raw[3], 0, 1, 1)])
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
  const layers = normalizePixGridLayers(input.layers, defaults.layers)
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
    backgroundBrightness: clamp(input.backgroundBrightness, 0, 1, defaults.backgroundBrightness),
    cellGap: clamp(input.cellGap, 0, 0.45, defaults.cellGap),
    cellRoundness: clamp(input.cellRoundness, 0, 0.5, defaults.cellRoundness),
    cellBrightness: clamp(input.cellBrightness, 0, 1, defaults.cellBrightness),
    globalIntensity: clamp(input.globalIntensity, 0, 1, defaults.globalIntensity),
    glowAmount: clamp(input.glowAmount, 0, 1, defaults.glowAmount),
    diffusion: clamp(input.diffusion, 0, 1, defaults.diffusion),
    rgbSubpixelMode: input.rgbSubpixelMode === true,
    stoppedBehavior: STOPPED_BEHAVIORS.has(input.stoppedBehavior as string)
      ? input.stoppedBehavior as PixGridState['stoppedBehavior']
      : defaults.stoppedBehavior,
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
      selectedMediaId: nullableId(conversion.selectedMediaId),
      fitMode: conversion.fitMode === 'cover' || conversion.fitMode === 'stretch'
        ? conversion.fitMode
        : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.fitMode,
      positionX: clamp(conversion.positionX, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.positionX),
      positionY: clamp(conversion.positionY, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.positionY),
      scale: clamp(conversion.scale, 0.1, 4, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.scale),
      sampling: conversion.sampling === 'smooth' ? 'smooth' : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.sampling,
      colorMode: conversion.colorMode === 'hybrid' || conversion.colorMode === 'brand' || conversion.colorMode === 'preset'
        ? conversion.colorMode
        : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.colorMode,
      paletteSize: Math.max(2, Math.min(64, Math.round(finite(
        conversion.paletteSize ?? conversion.quantizationColors,
        DEFAULT_PIX_GRID_CONVERSION_SETTINGS.paletteSize,
      )))),
      ditherMode: conversion.ditherMode === 'ordered-bayer' || conversion.ditherMode === 'atkinson'
        ? conversion.ditherMode
        : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.ditherMode,
      alphaThreshold: clamp(conversion.alphaThreshold, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.alphaThreshold),
      preserveAlpha: conversion.preserveAlpha !== false,
      contrast: clamp(conversion.contrast, 0.25, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.contrast),
      brightness: clamp(conversion.brightness, 0.25, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.brightness),
      saturation: clamp(conversion.saturation, 0, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.saturation),
      edgeEnhancement: clamp(conversion.edgeEnhancement, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.edgeEnhancement),
      backgroundHandling: conversion.backgroundHandling === 'solid' || conversion.backgroundHandling === 'remove-dark'
        ? conversion.backgroundHandling
        : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.backgroundHandling,
      backgroundColor: normalizePixGridColor(conversion.backgroundColor, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.backgroundColor),
      brandStrength: clamp(conversion.brandStrength, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.brandStrength),
      preserveBlack: conversion.preserveBlack !== false,
      preserveWhite: conversion.preserveWhite !== false,
    },
    diagnostics: {
      showFps: diagnostics.showFps === true,
      showMatrixBounds: diagnostics.showMatrixBounds === true,
      logLifecycle: diagnostics.logLifecycle === true,
    },
  }
}
