import {
  DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
  DEFAULT_PIX_GRID_DIAGNOSTICS_SETTINGS,
  DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS,
  createDefaultPixGridState,
  resolvePixGridMatrixDimensions,
} from './PixGridDefaults'
import { hasPixGridBuiltInAsset } from './PixGridArtwork'
import { PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID } from './PixGridPerformancePrograms'
import { PIX_GRID_AUDIO_INTELLIGENCE_SOURCES, getPixGridAudioIntelligenceSource } from './PixGridAudioIntelligenceRegistry'
import { PIX_GRID_ASSIGNMENT_TARGET_BY_ID, PIX_GRID_ASSIGNMENT_TARGETS } from './PixGridAssignmentCompiler'
import {
  MAX_PIX_GRID_ANIMATIONS_PER_LAYER,
  MAX_PIX_GRID_LAYERS,
  MAX_PIX_GRID_VISIBLE_LAYERS,
  MAX_PIX_GRID_SCENES,
  MAX_PIX_GRID_PIXEL_OVERRIDES,
  MAX_PIX_GRID_GROUPS,
  MAX_PIX_GRID_CELL_RUNS_PER_GROUP,
  MAX_PIX_GRID_REACTIONS_PER_GROUP,
  MAX_PIX_GRID_AUDIO_ASSIGNMENTS,
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
  type PixGridCellRun,
  type PixGridGroupMaskDefinition,
  type PixGridGroupSource,
  type PixGridGeometricGroupPattern,
  type PixGridGroupOverlapBehavior,
  type PixGridReactionAssignment,
  type PixGridReactionSource,
  type PixGridReactionTarget,
  type PixGridReactionQuantization,
  type PixGridReactionRetrigger,
  type PixGridReactionBlend,
  type PixGridReactionCapabilityFallback,
  type PixGridReactionDecayCurve,
  type PixGridReactionCurve,
  type PixGridReactionPolarity,
  type PixGridReactionTargetScope,
  type PixGridReactionConditions,
  type PixGridPhraseSegment,
  type PixGridLayer,
  type PixGridLayerAnimation,
  type PixGridPaletteRole,
  type PixGridPerformanceProgramId,
  type PixGridPerformanceProgramOverrides,
  type PixGridProgramTransitionOverride,
  type PixGridPixelOverride,
  type PixGridPresetSettings,
  type PixGridQualityMode,
  type PixGridQualityTier,
  type PixGridSceneSettings,
  type PixGridScene,
  type PixGridCellRect,
  type PixGridState,
} from './PixGridTypes'

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const QUALITY_TIERS = new Set<PixGridQualityTier>(['draft', 'low', 'high', 'ultra'])
const QUALITY_MODES = new Set<PixGridQualityMode>(['adaptive', 'fixed'])
const BACKGROUND_MODES = new Set<PixGridBackgroundMode>(['preset', 'black', 'custom'])
const EDITOR_TOOLS = new Set<PixGridEditorTool>([
  'select',
  'pan',
  'pencil',
  'eraser',
  'fill',
  'eyedropper',
  'rectangle',
  'line',
  'marquee',
  'move',
])
const BLEND_MODES = new Set<PixGridBlendMode>(['normal', 'add', 'multiply'])
const CLIP_MODES = new Set<PixGridClipMode>(['clip', 'wrap'])
const PALETTE_ROLES = new Set<PixGridPaletteRole>(['primary', 'secondary', 'accent', 'highlight', 'background'])
const ANIMATION_MODES = new Set<PixGridAnimationMode>([
  'static',
  'pulse',
  'bounce',
  'horizontalScroll',
  'verticalScroll',
  'pingPong',
  'rotate',
  'paletteCycle',
  'blink',
  'revealRow',
  'revealColumn',
  'checkerAlternate',
  'frameCycle',
  'audioAmplitudeScale',
  'beatStepMovement',
])
const ANIMATION_BOUNDARIES = new Set<PixGridAnimationBoundary>(['wrap', 'clamp', 'bounce'])
const ANIMATION_CLOCKS = new Set(['time', 'beat', 'bar', 'cue'] as const)
const AUDIO_SOURCES = new Set<PixGridAudioSource>(PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.map(source => source.id))
const STOPPED_BEHAVIORS = new Set(['baseline', 'blackout'])
const GROUP_SOURCES = new Set<PixGridGroupSource>([
  'manualSelection',
  'layerAlpha',
  'foregroundBackground',
  'colorRange',
  'luminanceRange',
  'connectedRegion',
  'border',
  'center',
  'leftRight',
  'topBottom',
  'quadrant',
  'horizontalBands',
  'verticalBands',
  'alternatingRows',
  'alternatingColumns',
  'checkerboard',
  'diagonalBands',
  'radialRings',
  'deterministicClusters',
  'svgMetadata',
])
const GROUP_OVERLAP = new Set<PixGridGroupOverlapBehavior>(['stack', 'exclusive', 'replace'])
const GEOMETRIC_PATTERNS = new Set<PixGridGeometricGroupPattern>([
  'border',
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'quadrantTopLeft',
  'quadrantTopRight',
  'quadrantBottomLeft',
  'quadrantBottomRight',
  'horizontalBands',
  'verticalBands',
  'alternatingRowsA',
  'alternatingRowsB',
  'alternatingColumnsA',
  'alternatingColumnsB',
  'checkerboardA',
  'checkerboardB',
  'diagonalBands',
  'radialRings',
  'deterministicClusters',
])
const REACTION_SOURCES = new Set<PixGridReactionSource>(PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.map(source => source.id))
const REACTION_TARGETS = new Set<PixGridReactionTarget>(PIX_GRID_ASSIGNMENT_TARGETS.map(target => target.id))
const REACTION_QUANTIZATION = new Set<PixGridReactionQuantization>(['none', 'beat', 'bar', 'fourBars', 'eightBars', 'sixteenBars'])
const REACTION_RETRIGGER = new Set<PixGridReactionRetrigger>(['restart', 'extend', 'ignoreWhileActive'])
const REACTION_BLEND = new Set<PixGridReactionBlend>(['add', 'multiply', 'replace', 'max'])
const REACTION_FALLBACK = new Set<PixGridReactionCapabilityFallback>(['disable', 'zero', 'energy', 'beat', 'midHighActivity', 'transient'])
const REACTION_DECAY_CURVES = new Set<PixGridReactionDecayCurve>([
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'exponential',
  'overshoot',
  'step',
  'stepped',
])
const REACTION_CURVES = new Set<PixGridReactionCurve>([
  'linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential', 'logarithmic', 'smoothstep', 'stepped', 'gate', 'inverse',
])
const REACTION_POLARITIES = new Set<PixGridReactionPolarity>(['positive', 'negative', 'bipolar'])
const REACTION_TARGET_SCOPES = new Set<PixGridReactionTargetScope>(['output', 'scene', 'layer', 'group', 'pixels', 'background', 'transition', 'animation', 'palette'])
const PHRASE_SEGMENTS = new Set<PixGridPhraseSegment>(['entry', 'early', 'middle', 'late', 'exit'])
const SECTION_TYPES = new Set(['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown'] as const)
const SECTION_PHASES = new Set(['entry', 'body', 'exit'] as const)
const PERFORMANCE_PROGRAM_IDS = new Set<PixGridPerformanceProgramId>([
  'pix-grid-bass-beacon-performance',
  'pix-grid-geometric-reactor-performance',
  'pix-grid-pixel-parade-performance',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const PROGRAM_TRANSITIONS = new Set<PixGridProgramTransitionOverride>([
  'cut', 'crossfade', 'rowWipe', 'columnWipe', 'checkerWipe',
  'pixelDissolve', 'radialReveal', 'paletteFade', 'powerOn', 'powerOff',
])

function normalizeProgramOverrides(value: unknown): PixGridPerformanceProgramOverrides {
  if (!isRecord(value)) return { routes: {}, sections: {} }
  const routes: PixGridPerformanceProgramOverrides['routes'] = {}
  if (isRecord(value.routes)) {
    for (const [routeId, raw] of Object.entries(value.routes).slice(0, 256)) {
      if (!routeId.trim() || !isRecord(raw)) continue
      routes[routeId.trim().slice(0, 128)] = {
        ...(typeof raw.enabled === 'boolean' ? { enabled: raw.enabled } : {}),
        ...(REACTION_SOURCES.has(raw.source as PixGridReactionSource) ? { source: raw.source as PixGridReactionSource } : {}),
        ...(REACTION_TARGETS.has(raw.operation as PixGridReactionTarget) ? { operation: raw.operation as PixGridReactionTarget } : {}),
        ...(raw.amount != null ? { amount: clamp(raw.amount, -4, 4, 0) } : {}),
        ...(raw.priority != null ? { priority: Math.round(clamp(raw.priority, -1000, 1000, 0)) } : {}),
        ...(REACTION_TARGET_SCOPES.has(raw.targetScope as PixGridReactionTargetScope) ? { targetScope: raw.targetScope as PixGridReactionTargetScope } : {}),
        ...('targetId' in raw ? { targetId: nullableId(raw.targetId) } : {}),
        ...(Array.isArray(raw.inputRange) ? { inputRange: normalizeRange(raw.inputRange, [0, 1], -4, 4) } : {}),
        ...(Array.isArray(raw.outputRange) ? { outputRange: normalizeRange(raw.outputRange, [0, 1], -8, 8) } : {}),
        ...(REACTION_POLARITIES.has(raw.polarity as PixGridReactionPolarity) ? { polarity: raw.polarity as PixGridReactionPolarity } : {}),
        ...(REACTION_CURVES.has(raw.curve as PixGridReactionCurve) ? { curve: raw.curve as PixGridReactionCurve } : {}),
        ...(raw.smoothing != null ? { smoothing: clamp(raw.smoothing, 0, 10, 0) } : {}),
        ...(raw.threshold != null ? { threshold: clamp(raw.threshold, 0, 1, 0) } : {}),
        ...(raw.hysteresis != null ? { hysteresis: clamp(raw.hysteresis, 0, 0.5, 0) } : {}),
        ...(raw.attack != null ? { attack: clamp(raw.attack, 0, 10, 0) } : {}),
        ...(raw.hold != null ? { hold: clamp(raw.hold, 0, 10, 0) } : {}),
        ...(raw.release != null ? { release: clamp(raw.release, 0, 20, 0) } : {}),
        ...(REACTION_DECAY_CURVES.has(raw.decayCurve as PixGridReactionDecayCurve) ? { decayCurve: raw.decayCurve as PixGridReactionDecayCurve } : {}),
        ...(REACTION_QUANTIZATION.has(raw.quantization as PixGridReactionQuantization) ? { quantization: raw.quantization as PixGridReactionQuantization } : {}),
        ...(REACTION_RETRIGGER.has(raw.retrigger as PixGridReactionRetrigger) ? { retrigger: raw.retrigger as PixGridReactionRetrigger } : {}),
        ...(raw.minimumConfidence != null ? { minimumConfidence: clamp(raw.minimumConfidence, 0, 1, 0) } : {}),
        ...(REACTION_FALLBACK.has(raw.capabilityFallback as PixGridReactionCapabilityFallback) ? { capabilityFallback: raw.capabilityFallback as PixGridReactionCapabilityFallback } : {}),
        ...(REACTION_BLEND.has(raw.blend as PixGridReactionBlend) ? { blend: raw.blend as PixGridReactionBlend } : {}),
        ...(Array.isArray(raw.sectionTypes) ? { sectionTypes: raw.sectionTypes.filter(value => SECTION_TYPES.has(value as never)).slice(0, 16) as PixGridPerformanceProgramOverrides['routes'][string]['sectionTypes'] } : {}),
        ...(Array.isArray(raw.sectionOccurrences) ? { sectionOccurrences: raw.sectionOccurrences.map(value => Math.max(1, Math.round(finite(value, 1)))).slice(0, 32) } : {}),
        ...(Array.isArray(raw.dropOccurrences) ? { dropOccurrences: raw.dropOccurrences.map(value => Math.max(1, Math.round(finite(value, 1)))).slice(0, 32) } : {}),
      }
    }
  }
  const sections: PixGridPerformanceProgramOverrides['sections'] = {}
  if (isRecord(value.sections)) {
    for (const [sectionId, raw] of Object.entries(value.sections).slice(0, 128)) {
      if (!sectionId.trim() || !isRecord(raw)) continue
      sections[sectionId.trim().slice(0, 128)] = {
        ...(typeof raw.enabled === 'boolean' ? { enabled: raw.enabled } : {}),
        ...(raw.density != null ? { density: clamp(raw.density, 0, 1, 0.6) } : {}),
        ...(raw.motion != null ? { motion: clamp(raw.motion, 0, 2, 0.8) } : {}),
        ...(raw.paletteIntensity != null ? { paletteIntensity: clamp(raw.paletteIntensity, 0, 1, 0.7) } : {}),
        ...(raw.negativeSpace != null ? { negativeSpace: clamp(raw.negativeSpace, 0, 1, 0.35) } : {}),
        ...(typeof raw.fourBarEnabled === 'boolean' ? { fourBarEnabled: raw.fourBarEnabled } : {}),
        ...(typeof raw.eightBarEnabled === 'boolean' ? { eightBarEnabled: raw.eightBarEnabled } : {}),
        ...(typeof raw.sixteenBarEnabled === 'boolean' ? { sixteenBarEnabled: raw.sixteenBarEnabled } : {}),
        ...(PROGRAM_TRANSITIONS.has(raw.transitionIn as PixGridProgramTransitionOverride) ? { transitionIn: raw.transitionIn as PixGridProgramTransitionOverride } : {}),
        ...(PROGRAM_TRANSITIONS.has(raw.transitionOut as PixGridProgramTransitionOverride) ? { transitionOut: raw.transitionOut as PixGridProgramTransitionOverride } : {}),
      }
    }
  }
  return { routes, sections }
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
  return QUALITY_TIERS.has(value as PixGridQualityTier) ? (value as PixGridQualityTier) : fallback
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
    speed: clamp(value.speed, -20, 20, 1),
    ...(ANIMATION_CLOCKS.has(value.clock as 'time' | 'beat' | 'bar' | 'cue')
      ? { clock: value.clock as 'time' | 'beat' | 'bar' | 'cue' }
      : {}),
    amount: clamp(value.amount, -4, 4, 0),
    phase: clamp(value.phase, -1000, 1000, 0),
    boundary: ANIMATION_BOUNDARIES.has(value.boundary as PixGridAnimationBoundary) ? (value.boundary as PixGridAnimationBoundary) : 'wrap',
    ...(value.axis === 'x' || value.axis === 'y' ? { axis: value.axis } : {}),
    ...(value.stepped != null ? { stepped: value.stepped === true } : {}),
    ...(AUDIO_SOURCES.has(value.audioSource as PixGridAudioSource) ? { audioSource: value.audioSource as PixGridAudioSource } : {}),
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
    const candidateAssetId =
      typeof raw.assetId === 'string' && hasPixGridBuiltInAsset(raw.assetId) ? raw.assetId : (template?.assetId ?? 'pix-bass-word')
    const baseId = text(raw.id, template?.id ?? `pix-grid-layer-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const requestedVisible = raw.visible == null ? template?.visible !== false : raw.visible !== false
    const visible = requestedVisible && visibleCount < MAX_PIX_GRID_VISIBLE_LAYERS
    if (visible) visibleCount += 1
    const position = isRecord(raw.position) ? raw.position : (template?.position ?? {})
    const scale = isRecord(raw.scale) ? raw.scale : (template?.scale ?? {})
    const reactive = isRecord(raw.audioReactivity) ? raw.audioReactivity : template?.audioReactivity
    const animations = Array.isArray(raw.animations)
      ? raw.animations.slice(0, MAX_PIX_GRID_ANIMATIONS_PER_LAYER).flatMap((item) => {
          const normalized = normalizeAnimation(item)
          return normalized ? [normalized] : []
        })
      : (template?.animations.map((item) => ({ ...item })) ?? [])
    const blendMode = BLEND_MODES.has(raw.blendMode as PixGridBlendMode)
      ? (raw.blendMode as PixGridBlendMode)
      : raw.blendMode == null
        ? (template?.blendMode ?? 'normal')
        : 'normal'
    const clipMode = CLIP_MODES.has(raw.clipMode as PixGridClipMode) ? (raw.clipMode as PixGridClipMode) : (template?.clipMode ?? 'clip')
    const maskAssetId =
      typeof raw.maskAssetId === 'string' && hasPixGridBuiltInAsset(raw.maskAssetId)
        ? raw.maskAssetId
        : raw.maskAssetId == null
          ? (template?.maskAssetId ?? null)
          : null
    return [
      {
        id,
        name: text(raw.name, template?.name ?? `Layer ${index + 1}`),
        assetId: candidateAssetId,
        mediaId: nullableId(raw.mediaId),
        locked: raw.locked === true,
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
        flipX: raw.flipX == null ? (template?.flipX ?? false) : raw.flipX === true,
        flipY: raw.flipY == null ? (template?.flipY ?? false) : raw.flipY === true,
        blendMode,
        paletteMap: normalizePaletteMap(raw.paletteMap ?? template?.paletteMap),
        zIndex: Math.round(clamp(raw.zIndex, -100, 100, template?.zIndex ?? index)),
        clipMode,
        maskAssetId,
        animations,
        ...(reactive
          ? {
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
            }
          : {}),
        densityRank: clamp(raw.densityRank, 0, 1, template?.densityRank ?? 0),
        seed: Math.max(0, Math.min(2_147_483_647, Math.round(finite(raw.seed, template?.seed ?? index + 1)))),
      },
    ]
  })
}

function normalizeSceneSettings(value: unknown): Record<string, PixGridSceneSettings> | undefined {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value)
    .slice(0, 64)
    .flatMap(([sceneId, raw]) => {
      if (!isRecord(raw)) return []
      const hiddenLayerIds = Array.isArray(raw.hiddenLayerIds)
        ? [
            ...new Set(
              raw.hiddenLayerIds
                .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
                .map((item) => item.trim().slice(0, 128)),
            ),
          ].slice(0, MAX_PIX_GRID_LAYERS)
        : undefined
      const layerOpacity = isRecord(raw.layerOpacity)
        ? Object.fromEntries(
            Object.entries(raw.layerOpacity)
              .slice(0, MAX_PIX_GRID_LAYERS)
              .map(([id, opacity]) => [id.slice(0, 128), clamp(opacity, 0, 1, 1)]),
          )
        : undefined
      return [
        [
          sceneId.slice(0, 128),
          {
            density: clamp(raw.density, 0, 1, 1),
            motionMultiplier: clamp(raw.motionMultiplier, 0, 4, 1),
            paletteOffset: Math.round(clamp(raw.paletteOffset, -20, 20, 0)),
            ...(hiddenLayerIds ? { hiddenLayerIds } : {}),
            ...(layerOpacity ? { layerOpacity } : {}),
          } satisfies PixGridSceneSettings,
        ] as const,
      ]
    })
  return Object.fromEntries(entries)
}

export function normalizePixGridPresetSettings(value: unknown): PixGridPresetSettings | undefined {
  if (!isRecord(value)) return undefined
  const pattern = value.pattern === 'geometricReactor' || value.pattern === 'pixelParade' ? value.pattern : 'bassBeacon'
  const quality = value.quality == null ? undefined : normalizePixGridQuality(value.quality)
  const backgroundMode =
    value.backgroundMode == null || !BACKGROUND_MODES.has(value.backgroundMode as PixGridBackgroundMode)
      ? undefined
      : (value.backgroundMode as PixGridBackgroundMode)
  const layers = value.layers == null ? undefined : normalizePixGridLayers(value.layers, [])
  const groups = value.groups == null ? undefined : normalizeGroups(value.groups, 160, 90)
  const audioAssignments = Array.isArray(value.audioAssignments)
    ? value.audioAssignments.slice(0, MAX_PIX_GRID_AUDIO_ASSIGNMENTS).flatMap((assignment, assignmentIndex) => {
        const normalized = normalizePixGridReactionAssignment(assignment, assignmentIndex, 'output')
        return normalized ? [normalized] : []
      })
    : undefined
  const performanceProgramId = PERFORMANCE_PROGRAM_IDS.has(value.performanceProgramId as PixGridPerformanceProgramId)
    ? (value.performanceProgramId as PixGridPerformanceProgramId)
    : undefined
  const sceneSettings = normalizeSceneSettings(value.sceneSettings)
  return {
    ...(value.authoredConfigurationVersion != null
      ? { authoredConfigurationVersion: Math.max(1, Math.min(1_000, Math.round(finite(value.authoredConfigurationVersion, 1)))) }
      : {}),
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
    ...(groups ? { groups } : {}),
    ...(audioAssignments ? { audioAssignments } : {}),
    ...(performanceProgramId ? { performanceProgramId } : {}),
    ...(sceneSettings ? { sceneSettings } : {}),
  }
}

function normalizeCellRuns(value: unknown, width: number, height: number): PixGridCellRun[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_PIX_GRID_CELL_RUNS_PER_GROUP).flatMap((run) => {
    if (!Array.isArray(run) || run.length < 3) return []
    const row = Math.max(0, Math.min(height - 1, Math.round(finite(run[0], 0))))
    const start = Math.max(0, Math.min(width - 1, Math.round(finite(run[1], 0))))
    const length = Math.max(1, Math.min(width - start, Math.round(finite(run[2], 1))))
    return [[row, start, length] as const]
  })
}

function normalizeGroupMask(value: unknown, runs: PixGridCellRun[], width: number, height: number): PixGridGroupMaskDefinition {
  if (!isRecord(value)) return { kind: 'runs', runs }
  if (value.kind === 'geometric' && GEOMETRIC_PATTERNS.has(value.pattern as PixGridGeometricGroupPattern)) {
    return {
      kind: 'geometric',
      pattern: value.pattern as PixGridGeometricGroupPattern,
      ...(value.count != null ? { count: Math.max(1, Math.min(32, Math.round(finite(value.count, 4)))) } : {}),
      ...(value.index != null ? { index: Math.max(-128, Math.min(128, Math.round(finite(value.index, 0)))) } : {}),
      ...(value.thickness != null ? { thickness: clamp(value.thickness, 0.01, 0.49, 0.12) } : {}),
      ...(value.seed != null ? { seed: Math.max(0, Math.min(2_147_483_647, Math.round(finite(value.seed, 1)))) } : {}),
    }
  }
  if (value.kind === 'layerAlpha')
    return { kind: 'layerAlpha', threshold: clamp(value.threshold, 0, 1, 0.05), foreground: value.foreground !== false }
  if (value.kind === 'colorRange')
    return { kind: 'colorRange', color: normalizePixGridColor(value.color, '#ffffff'), tolerance: clamp(value.tolerance, 0, 1, 0.12) }
  if (value.kind === 'luminanceRange') {
    const min = clamp(value.min, 0, 1, 0)
    return { kind: 'luminanceRange', min, max: Math.max(min, clamp(value.max, 0, 1, 1)) }
  }
  if (value.kind === 'connectedRegion')
    return {
      kind: 'connectedRegion',
      seedX: Math.max(0, Math.min(width - 1, Math.round(finite(value.seedX, 0)))),
      seedY: Math.max(0, Math.min(height - 1, Math.round(finite(value.seedY, 0)))),
      tolerance: clamp(value.tolerance, 0, 1, 0.18),
      alphaThreshold: clamp(value.alphaThreshold, 0, 1, 0.05),
      maxCells: Math.max(1, Math.min(width * height, Math.round(finite(value.maxCells, width * height)))),
    }
  if (value.kind === 'svgMetadata')
    return {
      kind: 'svgMetadata',
      ...(nullableId(value.elementId) ? { elementId: nullableId(value.elementId)! } : {}),
      ...(typeof value.fillColor === 'string' ? { fillColor: normalizePixGridColor(value.fillColor, '#ffffff') } : {}),
    }
  const maskRuns = value.kind === 'runs' ? normalizeCellRuns(value.runs, width, height) : runs
  return { kind: 'runs', runs: maskRuns.length > 0 ? maskRuns : runs }
}

function normalizeRange(value: unknown, fallback: readonly [number, number], min: number, max: number): readonly [number, number] {
  const raw = Array.isArray(value) ? value : fallback
  const first = clamp(raw[0], min, max, fallback[0])
  const second = clamp(raw[1], min, max, fallback[1])
  return [Math.min(first, second), Math.max(first, second)]
}

function normalizeStringList<T extends string>(value: unknown, allowed: ReadonlySet<T>, max = 32): T[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result = [...new Set(value.filter((item): item is T => allowed.has(item as T)))].slice(0, max)
  return result.length ? result : undefined
}

function normalizeOccurrenceList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result = [...new Set(value.map(item => Math.max(0, Math.min(999, Math.round(finite(item, 0))))))].sort((a, b) => a - b).slice(0, 64)
  return result.length ? result : undefined
}

function normalizeReactionConditions(value: unknown): PixGridReactionConditions | undefined {
  if (!isRecord(value)) return undefined
  const includeSectionTypes = normalizeStringList(value.includeSectionTypes, SECTION_TYPES)
  const excludeSectionTypes = normalizeStringList(value.excludeSectionTypes, SECTION_TYPES)
  const sectionPhases = normalizeStringList(value.sectionPhases, SECTION_PHASES)
  const sectionOccurrences = normalizeOccurrenceList(value.sectionOccurrences)
  const dropOccurrences = normalizeOccurrenceList(value.dropOccurrences)
  const phraseSegments = normalizeStringList(value.phraseSegments, PHRASE_SEGMENTS)
  const activeLayerId = nullableId(value.activeLayerId)
  const activeGroupId = nullableId(value.activeGroupId)
  const result: PixGridReactionConditions = {
    ...(includeSectionTypes ? { includeSectionTypes } : {}),
    ...(excludeSectionTypes ? { excludeSectionTypes } : {}),
    ...(sectionPhases ? { sectionPhases } : {}),
    ...(sectionOccurrences ? { sectionOccurrences } : {}),
    ...(dropOccurrences ? { dropOccurrences } : {}),
    ...(phraseSegments ? { phraseSegments } : {}),
    ...(value.minimumEnergy != null ? { minimumEnergy: clamp(value.minimumEnergy, 0, 1, 0) } : {}),
    ...(value.maximumEnergy != null ? { maximumEnergy: clamp(value.maximumEnergy, 0, 1, 1) } : {}),
    ...(value.autoPerformanceOnly === true ? { autoPerformanceOnly: true } : {}),
    ...(activeLayerId ? { activeLayerId } : {}),
    ...(activeGroupId ? { activeGroupId } : {}),
  }
  return Object.keys(result).length ? result : undefined
}

export function normalizePixGridReactionAssignment(
  value: unknown,
  index: number,
  defaultScope: PixGridReactionTargetScope = 'group',
): PixGridReactionAssignment | null {
  if (!isRecord(value)) return null
  const source = REACTION_SOURCES.has(value.source as PixGridReactionSource) ? (value.source as PixGridReactionSource) : 'bass'
  const sourceDefinition = getPixGridAudioIntelligenceSource(source)
  const target = REACTION_TARGETS.has(value.target as PixGridReactionTarget) ? (value.target as PixGridReactionTarget) : 'brightness'
  const targetDefinition = PIX_GRID_ASSIGNMENT_TARGET_BY_ID.get(target)!
  const requestedScope = REACTION_TARGET_SCOPES.has(value.targetScope as PixGridReactionTargetScope)
    ? (value.targetScope as PixGridReactionTargetScope)
    : defaultScope
  const targetScope = targetDefinition.scopes.includes(requestedScope) ? requestedScope : targetDefinition.scopes[0]
  const rawClamp = normalizeRange(value.clamp, targetDefinition.boundedRange, -16, 16)
  const polarity = REACTION_POLARITIES.has(value.polarity as PixGridReactionPolarity)
    ? (value.polarity as PixGridReactionPolarity)
    : value.invert === true ? 'negative' : 'positive'
  const conditions = normalizeReactionConditions(value.conditions)
  return {
    id: text(value.id, `pix-grid-reaction-${index + 1}`, 128),
    name: text(value.name, `Reaction ${index + 1}`),
    enabled: value.enabled !== false,
    source,
    target,
    targetScope,
    targetId: nullableId(value.targetId),
    amount: clamp(value.amount, -4, 4, 0.75),
    polarity,
    invert: polarity === 'negative',
    inputRange: normalizeRange(value.inputRange, sourceDefinition.valueRange, -4, 4),
    outputRange: normalizeRange(value.outputRange, [0, 1], -8, 8),
    // Missing curves are v1-v9 assignments. Keep their linear response instead
    // of silently changing saved-project output during v10 migration.
    curve: REACTION_CURVES.has(value.curve as PixGridReactionCurve) ? (value.curve as PixGridReactionCurve) : 'linear',
    threshold: clamp(value.threshold, 0, 1, 0),
    ...(value.hysteresis != null ? { hysteresis: clamp(value.hysteresis, 0, 0.5, 0) } : {}),
    attack: clamp(value.attack, 0, 10, sourceDefinition.recommendedSmoothing.attack),
    hold: clamp(value.hold, 0, 10, sourceDefinition.recommendedSmoothing.hold),
    release: clamp(value.release, 0, 20, sourceDefinition.recommendedSmoothing.release),
    decayCurve: REACTION_DECAY_CURVES.has(value.decayCurve as PixGridReactionDecayCurve)
      ? (value.decayCurve as PixGridReactionDecayCurve)
      : 'easeOut',
    smoothing: clamp(value.smoothing, 0, 10, sourceDefinition.recommendedSmoothing.smoothing),
    quantization: REACTION_QUANTIZATION.has(value.quantization as PixGridReactionQuantization)
      ? (value.quantization as PixGridReactionQuantization)
      : 'none',
    retrigger: REACTION_RETRIGGER.has(value.retrigger as PixGridReactionRetrigger)
      ? (value.retrigger as PixGridReactionRetrigger)
      : 'restart',
    maximumStacking: Math.max(1, Math.min(8, Math.round(finite(value.maximumStacking, 1)))),
    eventPriority: Math.max(-1000, Math.min(1000, Math.round(finite(value.eventPriority, 0)))),
    minimumConfidence: clamp(value.minimumConfidence, 0, 1, 0),
    capabilityFallback: REACTION_FALLBACK.has(value.capabilityFallback as PixGridReactionCapabilityFallback)
      ? (value.capabilityFallback as PixGridReactionCapabilityFallback)
      : sourceDefinition.capabilityFallback,
    ...(conditions ? { conditions } : {}),
    priority: Math.max(-1000, Math.min(1000, Math.round(finite(value.priority, 0)))),
    clamp: rawClamp,
    blend: REACTION_BLEND.has(value.blend as PixGridReactionBlend) ? (value.blend as PixGridReactionBlend) : 'add',
    ...(PALETTE_ROLES.has(value.paletteRole as PixGridPaletteRole) ? { paletteRole: value.paletteRole as PixGridPaletteRole } : {}),
    ...(typeof value.color === 'string' ? { color: normalizePixGridColor(value.color, '#ffffff') } : {}),
    ...(value.seedOffset != null ? { seedOffset: Math.max(-1_000_000, Math.min(1_000_000, Math.round(finite(value.seedOffset, 0)))) } : {}),
  }
}

function normalizeGroups(value: unknown, width: number, height: number): PixGridGroup[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.slice(0, MAX_PIX_GRID_GROUPS).flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const baseId = text(raw.id, `pix-grid-group-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const legacyRuns = normalizeCellRuns(raw.cellRuns, width, height)
    const mask = normalizeGroupMask(raw.mask, legacyRuns, width, height)
    const cellRuns = mask.kind === 'runs' ? mask.runs : legacyRuns
    const layerId = nullableId(raw.layerId)
    const layerScope = Array.isArray(raw.layerScope)
      ? [...new Set(raw.layerScope.map(nullableId).filter((item): item is string => item != null))].slice(0, MAX_PIX_GRID_LAYERS)
      : layerId
        ? [layerId]
        : null
    const source = GROUP_SOURCES.has(raw.source as PixGridGroupSource)
      ? (raw.source as PixGridGroupSource)
      : raw.smartRuleId
        ? 'manualSelection'
        : 'manualSelection'
    const reactions = Array.isArray(raw.reactions)
      ? raw.reactions.slice(0, MAX_PIX_GRID_REACTIONS_PER_GROUP).flatMap((reaction, reactionIndex) => {
          const normalized = normalizePixGridReactionAssignment(reaction, reactionIndex, 'group')
          return normalized ? [normalized] : []
        })
      : []
    return [
      {
        id,
        name: text(raw.name, `Group ${index + 1}`),
        source,
        mask,
        layerId,
        layerScope,
        cellRuns,
        smartRuleId: nullableId(raw.smartRuleId),
        enabled: raw.enabled !== false,
        visible: raw.visible !== false,
        contentVisible: raw.contentVisible !== false,
        priority: Math.max(-100, Math.min(100, Math.round(finite(raw.priority, index)))),
        overlapBehavior: GROUP_OVERLAP.has(raw.overlapBehavior as PixGridGroupOverlapBehavior)
          ? (raw.overlapBehavior as PixGridGroupOverlapBehavior)
          : 'stack',
        reactions,
        displayColor: raw.displayColor == null ? null : normalizePixGridColor(raw.displayColor, '#4ac7db'),
      },
    ]
  })
}

export function normalizePixGridPixelOverrides(value: unknown, width: number, height: number): PixGridPixelOverride[] {
  if (!Array.isArray(value)) return []
  const deduped = new Map<string, PixGridPixelOverride>()
  for (const raw of value.slice(0, MAX_PIX_GRID_PIXEL_OVERRIDES)) {
    if (!Array.isArray(raw) || raw.length < 4) continue
    const x = Math.max(0, Math.min(width - 1, Math.round(finite(raw[0], 0))))
    const y = Math.max(0, Math.min(height - 1, Math.round(finite(raw[1], 0))))
    const legacy = typeof raw[2] === 'string'
    const mode = legacy ? 1 : raw[2] === 0 ? 0 : 1
    const color = normalizePixGridColor(legacy ? raw[2] : raw[3], '#ffffff')
    const opacity = clamp(legacy ? raw[3] : raw[4], 0, 1, 1)
    deduped.set(`${x}:${y}`, [x, y, mode, color, opacity])
  }
  return [...deduped.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

function normalizeSelection(value: unknown, width: number, height: number): PixGridCellRect | null {
  if (!isRecord(value)) return null
  const x = Math.max(0, Math.min(width - 1, Math.round(finite(value.x, 0))))
  const y = Math.max(0, Math.min(height - 1, Math.round(finite(value.y, 0))))
  const selectionWidth = Math.max(1, Math.min(width - x, Math.round(finite(value.width, 1))))
  const selectionHeight = Math.max(1, Math.min(height - y, Math.round(finite(value.height, 1))))
  return { x, y, width: selectionWidth, height: selectionHeight }
}

function normalizeScenes(
  value: unknown,
  layers: PixGridLayer[],
  width: number,
  height: number,
  fallbackSceneId: string,
  legacyOverrides: unknown,
): PixGridScene[] {
  const layerIds = new Set(layers.map((layer) => layer.id))
  const input = Array.isArray(value) ? value : []
  const seen = new Set<string>()
  const scenes = input.slice(0, MAX_PIX_GRID_SCENES).flatMap((raw, index) => {
    if (!isRecord(raw)) return []
    const baseId = text(raw.id, index === 0 ? fallbackSceneId : `pix-grid-scene-${index + 1}`, 128)
    const id = seen.has(baseId) ? `${baseId}-${index + 1}` : baseId
    seen.add(id)
    const validLayerIds = Array.isArray(raw.layerIds)
      ? raw.layerIds.filter((item): item is string => typeof item === 'string' && layerIds.has(item))
      : layers.map((layer) => layer.id)
    const requestedLayerIds =
      Array.isArray(raw.layerIds) && raw.layerIds.length > 0 && validLayerIds.length === 0 ? layers.map((layer) => layer.id) : validLayerIds
    return [
      {
        id,
        name: text(raw.name, `Scene ${index + 1}`),
        layerIds: [...new Set(requestedLayerIds)].slice(0, MAX_PIX_GRID_LAYERS),
        pixelOverrides: normalizePixGridPixelOverrides(raw.pixelOverrides, width, height),
      },
    ]
  })
  if (scenes.length > 0) return scenes
  return [
    {
      id: fallbackSceneId,
      name: 'Scene 1',
      layerIds: layers.map((layer) => layer.id),
      pixelOverrides: normalizePixGridPixelOverrides(legacyOverrides, width, height),
    },
  ]
}

export function normalizePixGridState(value: unknown): PixGridState {
  const defaults = createDefaultPixGridState()
  const input = isRecord(value) ? value : {}
  const quality = normalizePixGridQuality(input.quality, defaults.quality)
  const dimensions = resolvePixGridMatrixDimensions(quality)
  const backgroundMode = BACKGROUND_MODES.has(input.backgroundMode as PixGridBackgroundMode)
    ? (input.backgroundMode as PixGridBackgroundMode)
    : defaults.backgroundMode
  const editorTool = EDITOR_TOOLS.has(input.editorTool as PixGridEditorTool) ? (input.editorTool as PixGridEditorTool) : defaults.editorTool
  const layers = normalizePixGridLayers(input.layers, defaults.layers)
  const performance = isRecord(input.performance) ? input.performance : {}
  const conversion = isRecord(input.conversion) ? input.conversion : {}
  const diagnostics = isRecord(input.diagnostics) ? input.diagnostics : {}
  const editor = isRecord(input.editor) ? input.editor : {}
  const fallbackSceneId = nullableId(input.selectedSceneId) ?? defaults.selectedSceneId ?? 'pix-grid-scene-1'
  const selectedPresetId = nullableId(input.selectedPresetId) ?? defaults.selectedPresetId
  const defaultPerformanceProgramId = selectedPresetId
    ? (PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID[selectedPresetId] ?? DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS.sharedPerformanceProgramId)
    : DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS.sharedPerformanceProgramId
  const sceneSource = Array.isArray(input.scenes) ? input.scenes : input.pixelOverrides === undefined ? defaults.scenes : undefined
  const scenes = normalizeScenes(sceneSource, layers, dimensions.width, dimensions.height, fallbackSceneId, input.pixelOverrides)
  const selectedSceneId = scenes.some((scene) => scene.id === fallbackSceneId) ? fallbackSceneId : scenes[0].id
  const activeScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0]
  const selectedLayerId = nullableId(editor.selectedLayerId)
  const selectedLayerWasExplicitlyCleared =
    Object.prototype.hasOwnProperty.call(editor, 'selectedLayerId') && editor.selectedLayerId === null
  const safeSelectedLayerId = selectedLayerWasExplicitlyCleared
    ? null
    : selectedLayerId && activeScene.layerIds.includes(selectedLayerId)
      ? selectedLayerId
      : (activeScene.layerIds[0] ?? null)
  const groups = normalizeGroups(input.groups === undefined ? defaults.groups : input.groups, dimensions.width, dimensions.height)
  const selectedGroupId = nullableId(editor.selectedGroupId)
  const safeSelectedGroupId =
    selectedGroupId && groups.some((group) => group.id === selectedGroupId) ? selectedGroupId : (groups[0]?.id ?? null)
  const previewReactionAssignmentId = nullableId(editor.previewReactionAssignmentId)
  const safePreviewReactionAssignmentId =
    previewReactionAssignmentId && groups.some((group) => group.reactions.some((reaction) => reaction.id === previewReactionAssignmentId))
      ? previewReactionAssignmentId
      : null
  const audioAssignments = (Array.isArray(input.audioAssignments) ? input.audioAssignments : defaults.audioAssignments)
    .slice(0, MAX_PIX_GRID_AUDIO_ASSIGNMENTS)
    .flatMap((assignment, assignmentIndex) => {
      const normalized = normalizePixGridReactionAssignment(assignment, assignmentIndex, 'output')
      return normalized ? [normalized] : []
    })

  return {
    version: PIX_GRID_STATE_VERSION,
    quality,
    qualityMode: QUALITY_MODES.has(input.qualityMode as PixGridQualityMode)
      ? (input.qualityMode as PixGridQualityMode)
      : defaults.qualityMode,
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
      ? (input.stoppedBehavior as PixGridState['stoppedBehavior'])
      : defaults.stoppedBehavior,
    selectedPresetId,
    selectedSceneId,
    authoringOverlayVisible: input.authoringOverlayVisible === true,
    editorTool,
    editor: {
      hasEnteredAuthoring: editor.hasEnteredAuthoring === true,
      guidesVisible: editor.guidesVisible !== false,
      zoom: clamp(editor.zoom, 0.25, 16, 1),
      panX: clamp(editor.panX, -4, 4, 0),
      panY: clamp(editor.panY, -4, 4, 0),
      paintColor: normalizePixGridColor(editor.paintColor, '#ffffff'),
      paintOpacity: clamp(editor.paintOpacity, 0, 1, 1),
      eraserMode: editor.eraserMode === 'restore' ? 'restore' : 'off',
      selectedLayerId: safeSelectedLayerId,
      selectedGroupId: safeSelectedGroupId,
      previewReactionAssignmentId: safePreviewReactionAssignmentId,
      selection: normalizeSelection(editor.selection, dimensions.width, dimensions.height),
    },
    scenes,
    layers,
    groups,
    audioAssignments,
    pixelOverrides: activeScene.pixelOverrides,
    performance: {
      enabled: performance.enabled !== false,
      intensity: clamp(performance.intensity, 0, 1, DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS.intensity),
      sharedPerformanceProgramId: PERFORMANCE_PROGRAM_IDS.has(performance.sharedPerformanceProgramId as PixGridPerformanceProgramId)
        ? (performance.sharedPerformanceProgramId as PixGridPerformanceProgramId)
        : defaultPerformanceProgramId,
      seed: Math.max(0, Math.min(2_147_483_647, Math.round(finite(performance.seed, DEFAULT_PIX_GRID_PERFORMANCE_SETTINGS.seed)))),
      lockedRoutes: Array.isArray(performance.lockedRoutes)
        ? [
            ...new Set(
              performance.lockedRoutes
                .filter((route): route is string => typeof route === 'string' && Boolean(route.trim()))
                .map((route) => route.trim().slice(0, 128)),
            ),
          ].slice(0, 128)
        : [],
      programOverrides: normalizeProgramOverrides(performance.programOverrides),
    },
    conversion: {
      selectedMediaId: nullableId(conversion.selectedMediaId),
      fitMode:
        conversion.fitMode === 'cover' || conversion.fitMode === 'stretch'
          ? conversion.fitMode
          : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.fitMode,
      positionX: clamp(conversion.positionX, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.positionX),
      positionY: clamp(conversion.positionY, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.positionY),
      scale: clamp(conversion.scale, 0.1, 4, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.scale),
      sampling: conversion.sampling === 'smooth' ? 'smooth' : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.sampling,
      colorMode:
        conversion.colorMode === 'hybrid' || conversion.colorMode === 'brand' || conversion.colorMode === 'preset'
          ? conversion.colorMode
          : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.colorMode,
      paletteSize: Math.max(
        2,
        Math.min(
          64,
          Math.round(finite(conversion.paletteSize ?? conversion.quantizationColors, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.paletteSize)),
        ),
      ),
      ditherMode:
        conversion.ditherMode === 'ordered-bayer' || conversion.ditherMode === 'atkinson'
          ? conversion.ditherMode
          : DEFAULT_PIX_GRID_CONVERSION_SETTINGS.ditherMode,
      alphaThreshold: clamp(conversion.alphaThreshold, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.alphaThreshold),
      preserveAlpha: conversion.preserveAlpha !== false,
      contrast: clamp(conversion.contrast, 0.25, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.contrast),
      brightness: clamp(conversion.brightness, 0.25, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.brightness),
      saturation: clamp(conversion.saturation, 0, 2, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.saturation),
      edgeEnhancement: clamp(conversion.edgeEnhancement, 0, 1, DEFAULT_PIX_GRID_CONVERSION_SETTINGS.edgeEnhancement),
      backgroundHandling:
        conversion.backgroundHandling === 'solid' || conversion.backgroundHandling === 'remove-dark'
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
