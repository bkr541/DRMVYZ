import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSplitPersistStorage } from '../lib/splitPersistStorage'
import { handleReactPersistenceStatus } from './reactPersistenceStatusStore'
import { createLegacyPortalCinematicConfig, normalizeCinematicWorldConfig } from '../components/vyzualz/react/CinematicWorldConfig'
import type { CinematicWorldConfig } from '../components/vyzualz/react/CinematicWorldConfig'
import {
  getReactPerformanceAction,
  isReactPerformanceActionCompatible,
  REACT_VISUAL_PERFORMANCE_ACTIONS,
  type ReactPerformanceActionEvent,
  type ReactPerformanceActionTarget,
} from '../components/vyzualz/react/ReactPerformanceActions'
import {
  DEFAULT_REACT_PRESETS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_CANVAS_ENGINE_SETTINGS,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
  DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
  CANVAS_PRESET_BY_ID,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
  DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
  createDefaultLaserDmxSettings,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorFixture,
  normalizeLaserDmxShowDirectorSettings,
  normalizeLaserDmxShowDirectorState,
  coerceLaserDmxWorkspaceMode,
  coerceLaserDmxBeamMatrixAuthoringMode,
  resolveReactPresetLaserDmxWorkspace,
  isRetiredLaserDmxPreset,
  LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
  RETIRED_LASER_DMX_PRESET_IDS,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
} from '../components/vyzualz/react/ReactTypes'
import type {
  ReactEngineId,
  ReactPreset,
  ReactPresetParams,
  ReactTrackSection,
  ReactPerformancePad,
  ReactPerformancePadTransition,
  ReactPresetControlValues,
  ReactPresetAutomationCue,
  OscillatorSettings,
  CanvasEngineSettings,
  CanvasFitMode,
  CanvasMediaItem,
  CanvasPresetColorMode,
  CanvasParticleQuality,
  CanvasPresetId,
  CanvasPresetSettings,
  CanvasPresetOverrideState,
  CanvasSectionTriggerType,
  CanvasTriggerOn,
  CanvasVideoTimingSettings,
  OscillatorGlyphAsset,
  OscillatorGlyphPoint,
  OscillatorFontAsset,
  SoundDrawingLayer,
  SoundDrawingClip,
  SoundDrawingTextSource,
  SoundDrawingLyricGapBehavior,
  LaserDmxSettings,
  LaserDmxFixture,
  LaserDmxProfileId,
  LaserDmxModulationRoute,
  LaserDmxWorkspaceMode,
  LaserDmxBeamMatrixAuthoringMode,
  LaserDmxBeamMatrixSettings,
  LaserDmxBeamMatrixEditorSettings,
  LaserDmxBeamMatrixCue,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorGroup,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorFixturePatch,
  LaserDmxShowDirectorSettings,
  LaserDmxShowDirectorSettingsPatch,
  LaserDmxShowDirectorState,
  LaserDmxShowDirectorMirrorAxis,
} from '../components/vyzualz/react/ReactTypes'
import { resolvePerformancePadTransition } from '../components/vyzualz/react/renderers/reactPresetTransition'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from '../components/vyzualz/react/soundDrawing/SoundDrawingPerformanceShows'
import {
  DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
  CANVAS_MEDIA_ROLES,
  CANVAS_PERFORMANCE_SHOW_IDS,
  type CanvasLayerRole,
  type CanvasMediaRole,
  type CanvasOrchestrationLockKey,
  type CanvasOrchestrationSettings,
} from '../components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes'
import { normalizeCanvasMediaRoleMap } from '../components/vyzualz/react/canvasPerformance/CanvasMediaRoles'
import { CANVAS_COMPOSITION_TEMPLATES } from '../components/vyzualz/react/canvasPerformance/CanvasCompositionTemplates'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  SOUND_DRAWING_GENERATOR_FAMILIES,
  type SoundDrawingGeneratorPreference,
  type SoundDrawingPerformanceLockKey,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingPerformanceShowId,
} from '../components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes'
import {
  parseSvgToGlyphPoints,
  makeSvgGlyphAsset,
  isSvgContent,
  getSvgGlyphCacheKey,
} from '../components/vyzualz/react/renderers/svgGlyphUtils'
import {
  getLaserDmxBeamMatrixPreset,
} from '../components/vyzualz/react/laserDmxBeamMatrixPresets'
import { resetBeamMatrixCompilerState } from '../components/vyzualz/react/renderers/LaserDmxBeamMatrixCompiler'
import { resetFogState } from '../components/vyzualz/react/renderers/LaserDmxFogRenderer'
import {
  DEFAULT_PRODUCTION_FIXTURE_COLOR_POLICY,
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  DEFAULT_PRODUCTION_LED_BAR_SETTINGS,
  DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS,
  DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
  DEFAULT_PRODUCTION_WASH_SETTINGS,
  LASER_DMX_FIXTURE_SCHEMA_VERSION,
  applyProductionVenueTemplate,
  getLaserDmxFixtureProfile,
  isMovingHeadFixtureKind,
  isPersistedLaserDmxBeamMatrixDocument,
  isPersistedLaserDmxSettingsDocument,
  normalizeLaserDmxBeamMatrixSettings,
  normalizeLaserDmxSettings,
  normalizeLegacyLaserDmxFixture,
  normalizeProductionFlashPattern,
  normalizeProductionFixtureColorPolicy,
  normalizeProductionLedBarSettings,
  normalizeProductionAtmosphericFixtureSettings,
  normalizeProductionStageModel,
  normalizeProductionWashSettings,
  sanitizeLaserDmxBeamMatrixForPersistence,
  sanitizeLaserDmxSettingsForPersistence,
  type ProductionLook,
  type ProductionLookTransitionSettings,
  type ProductionCompoundCue,
  type ProductionCueAction,
  normalizeProductionCompoundCue,
} from '../components/vyzualz/react/LaserDmxProductionRig'
import {
  beginProductionLookTransition,
  captureProductionLook,
  ensureProductionLookCompatibility,
} from '../components/vyzualz/react/renderers/LaserDmxProductionLookEngine'
import { migrateLegacyBeamMatrixCues } from '../components/vyzualz/react/renderers/LaserDmxShowDirector'
import { createLaserDmxShowDirectorTemplateState } from '../components/vyzualz/react/laserDmxShowDirectorTemplates'
import {
  applyLaserDmxShowDirectorPerformanceProgramState,
  clearLaserDmxShowDirectorPerformanceProgramState,
  createDefaultLaserDmxShowDirectorPerformanceState,
  nextLaserDmxShowDirectorPerformanceInvalidationId,
  normalizeLaserDmxShowDirectorPerformanceState,
  normalizeLaserDmxShowDirectorPerformanceTuning,
  type LaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceFallbackBehavior,
  type LaserDmxShowDirectorPerformanceProgramTuning,
  type LaserDmxShowDirectorPerformanceState,
} from '../components/vyzualz/react/LaserDmxShowDirectorPerformanceProgram'
import {
  createLaserDmxShowDirectorPerformancePresetLoadResult,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from '../components/vyzualz/react/LaserDmxShowDirectorPerformancePresets'
import {
  getSvgVisualEntry,
  clearSvgVisualCache,
  setSvgVisualEntry,
  evictSvgVisual,
  isCurrentSvgVisualGeneration,
} from '../components/vyzualz/react/renderers/svgVisualCache'
import { sanitizeReactPresetFavorites } from '../components/vyzualz/react/reactPresetLibraryState'
import { createDefaultPixGridState } from '../components/vyzualz/react/pixGrid/PixGridDefaults'
import { applyPixGridPresetSettings, resetPixGridStatePreservingSelection } from '../components/vyzualz/react/pixGrid/PixGridState'
import type { PixGridState } from '../components/vyzualz/react/pixGrid/PixGridTypes'
import { normalizePixGridPresetSettings, normalizePixGridState } from '../components/vyzualz/react/pixGrid/PixGridValidation'
import {
  MAX_PIX_GRID_ACTION_CUES_PER_TRACK,
  MAX_PIX_GRID_ACTION_CUE_TRACKS,
  MAX_PIX_GRID_HISTORY,
} from '../components/vyzualz/react/pixGrid/PixGridLimits'
import {
  normalizePixGridActionCue,
  normalizePixGridActionCueMap,
  sortPixGridActionCues,
  type PixGridActionCue,
} from '../components/vyzualz/react/pixGrid/PixGridActionCues'
import { isSelectableReactEngineId, REACT_ENGINE_IDS } from '../components/vyzualz/react/reactEngineCatalog'
import {
  getMediaIdFromSvgGlyphId,
  getSvgGlyphAssetId,
  normalizeUnifiedSvgSettings,
} from '../components/vyzualz/react/svgSourceLifecycle'
import { useMediaStore } from './mediaStore'
import { createSignedMediaUrl } from '../lib/mediaDb'
import * as opentype from 'opentype.js'
import {
  parseOpenTypeFontFromAsset,
  textToOpenTypeGlyphPoints,
  evictFontFromCache,
  inspectFontFile,
  storeFontRuntime,
  hasFontRuntime,
  getBufferFromCache,
} from '../components/vyzualz/react/renderers/fontGlyphUtils'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { uploadFontFile, createFontAsset, removeFontFile, listFontAssets, downloadFontFile, deleteFontAsset } from '../lib/fontDb'

// Maps validated MIME type to a fixed, path-safe Storage object filename.
// file.name is kept only in font_assets.file_name (DB metadata), never in the path.
const SAFE_FONT_FILENAME: Record<string, string> = {
  'font/ttf': 'font.ttf',
  'font/otf': 'font.otf',
}

// ── Point cache helpers ───────────────────────────────────────────────────────
// SVG cache key:  getSvgGlyphCacheKey(assetId, res, hash) → "${assetId}:${res}:v${version}:${hash}"
// Text cache key: "${fontId}:${text}:${fontSize}:${letterSpacing}:${resolution}"
// Resolution is clamped to [64, 2048] matching the renderer's own clamp.

function clampRes(v: number): number {
  return Math.max(64, Math.min(2048, Math.round(v)))
}

function textCacheKey(fontId: string, text: string, spacing: number, lineHeight: number, alignment: string, res: number): string {
  return `${fontId}:${text.trim()}:${spacing}:${lineHeight}:${alignment}:${res}`
}

export const SOUND_DRAWING_TEXT_POINT_CACHE_MAX = 64

function putBoundedTextPoints(
  cache: Record<string, OscillatorGlyphPoint[]>,
  key: string,
  points: OscillatorGlyphPoint[],
): Record<string, OscillatorGlyphPoint[]> {
  if (cache[key]) return cache
  const next = { ...cache, [key]: points }
  const keys = Object.keys(next)
  for (let index = 0; index < keys.length - SOUND_DRAWING_TEXT_POINT_CACHE_MAX; index += 1) {
    delete next[keys[index]]
  }
  return next
}

function normalizeSoundDrawingTextSource(value: unknown): SoundDrawingTextSource {
  return value === 'activeLyricLine' || value === 'activeLyricWord' ? value : 'static'
}

function normalizeSoundDrawingGapBehavior(value: unknown): SoundDrawingLyricGapBehavior {
  return value === 'keepPrevious' || value === 'fallback' ? value : 'hide'
}

function normalizeOscillatorSettings(settings: OscillatorSettings): OscillatorSettings {
  const normalized = normalizeUnifiedSvgSettings(settings)
  return {
    ...normalized,
    textSource: normalizeSoundDrawingTextSource(normalized.textSource),
    lyricGapBehavior: normalizeSoundDrawingGapBehavior(normalized.lyricGapBehavior),
    lyricFallbackText: typeof normalized.lyricFallbackText === 'string'
      ? normalized.lyricFallbackText
      : '',
  }
}

const SOUND_DRAWING_PERFORMANCE_SHOW_IDS = new Set<SoundDrawingPerformanceShowId>(
  SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => show.id),
)
const SOUND_DRAWING_GENERATOR_PREFERENCES = new Set<SoundDrawingGeneratorPreference>([
  'authored',
  ...SOUND_DRAWING_GENERATOR_FAMILIES,
])
const SOUND_DRAWING_PERFORMANCE_SOURCES = new Set(['generatedVisual', 'activeText', 'activeSvg', 'activeUserSource'])
const SOUND_DRAWING_SOURCE_TREATMENTS = new Set(['preserveIdentity', 'controlledReactive', 'liquidContour', 'abstractDeformation'])
const SOUND_DRAWING_SOURCE_POLICIES = new Set(['primaryMotif', 'supportingLayer', 'both'])

export function normalizeSoundDrawingPerformanceSettings(value: unknown): SoundDrawingPerformanceSettings {
  const source = isRecord(value) ? value : {}
  const selectedShowId = typeof source.selectedShowId === 'string'
    && SOUND_DRAWING_PERFORMANCE_SHOW_IDS.has(source.selectedShowId as SoundDrawingPerformanceShowId)
    ? source.selectedShowId as SoundDrawingPerformanceShowId
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId
  const generatorPreference = typeof source.generatorPreference === 'string'
    && SOUND_DRAWING_GENERATOR_PREFERENCES.has(source.generatorPreference as SoundDrawingGeneratorPreference)
    ? source.generatorPreference as SoundDrawingGeneratorPreference
    : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.generatorPreference
  const locksSource = isRecord(source.locks) ? source.locks : {}
  const locks = Object.fromEntries(
    (Object.keys(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks) as SoundDrawingPerformanceLockKey[])
      .map(key => [key, locksSource[key] === true]),
  ) as Record<SoundDrawingPerformanceLockKey, boolean>
  return {
    selectedShowId,
    autoPerformance: source.autoPerformance === true,
    complexity: Math.max(0, Math.min(1, finiteNumber(source.complexity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.complexity))),
    motionIntensity: Math.max(0, Math.min(1, finiteNumber(source.motionIntensity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.motionIntensity))),
    reactionIntensity: Math.max(0, Math.min(1, finiteNumber(source.reactionIntensity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.reactionIntensity))),
    trailIntensity: Math.max(0, Math.min(1, finiteNumber(source.trailIntensity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.trailIntensity))),
    generatorPreference,
    performanceSource: typeof source.performanceSource === 'string' && SOUND_DRAWING_PERFORMANCE_SOURCES.has(source.performanceSource)
      ? source.performanceSource as SoundDrawingPerformanceSettings['performanceSource']
      : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.performanceSource,
    sourceTreatment: typeof source.sourceTreatment === 'string' && SOUND_DRAWING_SOURCE_TREATMENTS.has(source.sourceTreatment)
      ? source.sourceTreatment as SoundDrawingPerformanceSettings['sourceTreatment']
      : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTreatment,
    useSourceAs: typeof source.useSourceAs === 'string' && SOUND_DRAWING_SOURCE_POLICIES.has(source.useSourceAs)
      ? source.useSourceAs as SoundDrawingPerformanceSettings['useSourceAs']
      : DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.useSourceAs,
    preserveIdentity: source.preserveIdentity !== false,
    contourReactivity: Math.max(0, Math.min(1, finiteNumber(source.contourReactivity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.contourReactivity))),
    wholeObjectMotion: Math.max(0, Math.min(1, finiteNumber(source.wholeObjectMotion, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.wholeObjectMotion))),
    echoStrength: Math.max(0, Math.min(1, finiteNumber(source.echoStrength, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.echoStrength))),
    sourceTrailStrength: Math.max(0, Math.min(1, finiteNumber(source.sourceTrailStrength, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTrailStrength))),
    supportingVisualReactivity: Math.max(0, Math.min(1, finiteNumber(source.supportingVisualReactivity, DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.supportingVisualReactivity))),
    locks,
  }
}

function prepareSvgPoints(
  asset: OscillatorGlyphAsset,
  res: number,
  cache: Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  if (!asset.rawSvg) return cache
  const key = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
  if (cache[key]) return cache  // already prepared
  return { ...cache, [key]: parseSvgToGlyphPoints(asset.rawSvg, res) }
}

// ── Unified SVG cache lifecycle ──────────────────────────────────────────────
// Selection lives only in oscillatorSettings.sourceType === 'svg' + selectedSvgId.
// These helpers rebuild serializable glyph data and non-serializable artwork
// caches without changing the active source, selected asset, or render mode.

type SvgMediaItem = ReturnType<typeof useMediaStore.getState>['items'][number]

interface LoadedSvgMedia {
  item: SvgMediaItem
  rawSvg: string
}

let _svgSelectionGeneration = 0
let _svgCacheGeneration = 0
const _svgCacheGenerationByMedia = new Map<string, number>()
const _svgCacheLoads = new Map<string, Promise<void>>()

function svgMediaIdentity(item: SvgMediaItem): string {
  return `${item.id}::${item.url ?? ''}::${item.storagePath ?? ''}`
}

async function fetchSvgText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

async function loadSvgMedia(mediaId: string): Promise<LoadedSvgMedia | null> {
  const item = useMediaStore.getState().items.find(candidate => candidate.id === mediaId)
  if (!item) return null

  let rawSvg = item.url ? await fetchSvgText(item.url) : null
  if (!rawSvg && item.storagePath) {
    const { url: freshUrl } = await createSignedMediaUrl(item.storagePath)
    if (freshUrl) rawSvg = await fetchSvgText(freshUrl)
  }

  if (!rawSvg || !isSvgContent(rawSvg)) return null
  return { item, rawSvg }
}

function visualIdentityMatches(entry: ReturnType<typeof getSvgVisualEntry>, item: SvgMediaItem): boolean {
  if (!entry?.loaded) return false
  const urlChanged = entry.mediaUrl !== undefined && entry.mediaUrl !== (item.url || undefined)
  const pathChanged = entry.storagePath !== undefined && entry.storagePath !== (item.storagePath || undefined)
  return !urlChanged && !pathChanged
}

function cacheUnifiedSvgGlyph(loaded: LoadedSvgMedia, generation: number): void {
  if (_svgCacheGenerationByMedia.get(loaded.item.id) !== generation) return

  const stableId = getSvgGlyphAssetId(loaded.item.id)
  const displayName = (loaded.item.title ?? loaded.item.name).replace(/\.svg$/i, '').trim() || 'SVG'
  const res = clampRes(useReactStore.getState().oscillatorSettings.pathResolution)
  const nextAsset = makeSvgGlyphAsset(displayName, loaded.rawSvg, res, stableId)

  useReactStore.setState(state => {
    if (_svgCacheGenerationByMedia.get(loaded.item.id) !== generation) return {}
    const existingIndex = state.oscillatorGlyphAssets.findIndex(asset => asset.id === stableId)
    const existing = existingIndex >= 0 ? state.oscillatorGlyphAssets[existingIndex] : undefined
    const asset: OscillatorGlyphAsset = existing && existing.contentHash === nextAsset.contentHash
      ? existing
      : nextAsset
    const assets = existingIndex < 0
      ? [...state.oscillatorGlyphAssets, asset]
      : state.oscillatorGlyphAssets.map(candidate => candidate.id === stableId ? asset : candidate)
    const pointCache = prepareSvgPoints(asset, clampRes(state.oscillatorSettings.pathResolution), state.oscillatorGlyphPointCache)
    return {
      oscillatorGlyphAssets: assets,
      oscillatorGlyphPointCache: pointCache,
    }
  })
}

function decodeUnifiedSvgVisual(loaded: LoadedSvgMedia, generation: number): Promise<void> {
  const { item, rawSvg } = loaded
  const objectUrl = URL.createObjectURL(new Blob([rawSvg], { type: 'image/svg+xml' }))
  const image = new Image()

  return new Promise(resolve => {
    image.onload = () => {
      if (!isCurrentSvgVisualGeneration(item.id, generation)) {
        URL.revokeObjectURL(objectUrl)
        resolve()
        return
      }
      setSvgVisualEntry({
        id: item.id,
        loading: false,
        image,
        objectUrl,
        loaded: true,
        error: null,
        width: image.naturalWidth || 512,
        height: image.naturalHeight || 512,
        mediaUrl: item.url || undefined,
        storagePath: item.storagePath || undefined,
        generation,
      })
      resolve()
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      if (isCurrentSvgVisualGeneration(item.id, generation)) {
        setSvgVisualEntry({
          id: item.id,
          loading: false,
          image: null,
          objectUrl: null,
          loaded: false,
          error: 'SVG image failed to render',
          width: 0,
          height: 0,
          generation,
        })
      }
      resolve()
    }
    image.src = objectUrl
  })
}


function isSvgMediaItem(item: SvgMediaItem): boolean {
  return item.mimeType === 'image/svg+xml' || item.mediaRole === 'svg' || /\.svg$/i.test(item.name)
}

async function decodeArtworkMedia(item: SvgMediaItem, generation: number): Promise<void> {
  async function tryUrl(url: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
      const image = new Image()
      image.decoding = 'async'
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = url
    })
  }

  let image = item.url ? await tryUrl(item.url) : null
  if (!image && item.storagePath) {
    const { url } = await createSignedMediaUrl(item.storagePath, 3600)
    if (url) image = await tryUrl(url)
  }
  if (!isCurrentSvgVisualGeneration(item.id, generation)) return
  setSvgVisualEntry({
    id: item.id,
    loading: false,
    image,
    objectUrl: null,
    loaded: Boolean(image),
    error: image ? null : 'Artwork image failed to render',
    width: image?.naturalWidth ?? 0,
    height: image?.naturalHeight ?? 0,
    mediaUrl: item.url || undefined,
    storagePath: item.storagePath || undefined,
    generation,
  })
}

async function ensureUnifiedSvgCaches(mediaId: string): Promise<void> {
  // Persisted glyph assets are available before the asynchronous media library
  // finishes restoring. Rebuild their transient point cache immediately.
  const initialState = useReactStore.getState()
  const stableId = getSvgGlyphAssetId(mediaId)
  const persistedGlyph = initialState.oscillatorGlyphAssets.find(asset => asset.id === stableId)
  if (persistedGlyph) {
    const pointCache = prepareSvgPoints(
      persistedGlyph,
      clampRes(initialState.oscillatorSettings.pathResolution),
      initialState.oscillatorGlyphPointCache,
    )
    if (pointCache !== initialState.oscillatorGlyphPointCache) {
      useReactStore.setState({ oscillatorGlyphPointCache: pointCache })
    }
  }

  const item = useMediaStore.getState().items.find(candidate => candidate.id === mediaId)
  if (!item) {
    const generation = ++_svgCacheGeneration
    _svgCacheGenerationByMedia.set(mediaId, generation)
    setSvgVisualEntry({
      id: mediaId,
      loading: false,
      image: null,
      objectUrl: null,
      loaded: false,
      error: 'Media item not found',
      width: 0,
      height: 0,
      generation,
    })
    return
  }

  const identity = svgMediaIdentity(item)
  const inFlightKey = `${mediaId}::${identity}`
  const existingLoad = _svgCacheLoads.get(inFlightKey)
  if (existingLoad) return existingLoad

  const load = (async () => {
    const existingGlyph = useReactStore.getState().oscillatorGlyphAssets.find(asset => asset.id === stableId)
    const existingVisual = getSvgVisualEntry(mediaId)
    const visualReady = visualIdentityMatches(existingVisual, item)
    if (existingGlyph && visualReady) return

    const generation = ++_svgCacheGeneration
    _svgCacheGenerationByMedia.set(mediaId, generation)

    if (!visualReady) {
      if (existingVisual) evictSvgVisual(mediaId)
      setSvgVisualEntry({
        id: mediaId,
        loading: true,
        image: null,
        objectUrl: null,
        loaded: false,
        error: null,
        width: 0,
        height: 0,
        mediaUrl: item.url || undefined,
        storagePath: item.storagePath || undefined,
        generation,
      })
    }

    if (!isSvgMediaItem(item)) {
      if (!visualReady) await decodeArtworkMedia(item, generation)
      return
    }

    const loaded = await loadSvgMedia(mediaId)
    if (_svgCacheGenerationByMedia.get(mediaId) !== generation) return
    if (!loaded) {
      // A failed glyph refresh must not discard artwork that is already
      // decoded and usable for Original Artwork mode.
      if (!visualReady) {
        setSvgVisualEntry({
          id: mediaId,
          loading: false,
          image: null,
          objectUrl: null,
          loaded: false,
          error: 'Could not load SVG content',
          width: 0,
          height: 0,
          generation,
        })
      }
      return
    }

    cacheUnifiedSvgGlyph(loaded, generation)
    if (!visualReady) await decodeUnifiedSvgVisual(loaded, generation)
  })()

  _svgCacheLoads.set(inFlightKey, load)
  try {
    await load
  } finally {
    if (_svgCacheLoads.get(inFlightKey) === load) _svgCacheLoads.delete(inFlightKey)
  }
}

// ── Debounced SVG glyph recompile (resolution slider) ─────────────────────────
// When the user drags the Resolution slider, setOscillatorSettings fires on every
// tick. Compiling SVG points synchronously would stall the UI. Instead, the
// settings update immediately (slider feels responsive) and the compile fires once
// after the user stops dragging.

let _glyphRecompileTimer: ReturnType<typeof setTimeout> | null = null
const GLYPH_RECOMPILE_DEBOUNCE_MS = 220

function scheduleGlyphRecompile(): void {
  if (_glyphRecompileTimer !== null) clearTimeout(_glyphRecompileTimer)
  _glyphRecompileTimer = setTimeout(() => {
    _glyphRecompileTimer = null
    const s = useReactStore.getState()
    const { oscillatorSettings: osc } = s
    // Determine the active glyph asset ID from the source type
    let activeGlyphId: string | null = null
    if (osc.sourceType === 'svgGlyph') {
      activeGlyphId = osc.selectedGlyphId ?? null
    } else if (osc.sourceType === 'svg' && osc.selectedSvgId) {
      activeGlyphId = getSvgGlyphAssetId(osc.selectedSvgId)
    }
    if (!activeGlyphId) return
    const asset = s.oscillatorGlyphAssets.find(a => a.id === activeGlyphId)
    if (!asset) return
    const res = clampRes(osc.pathResolution)
    const key = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
    if (s.oscillatorGlyphPointCache[key]) return  // already compiled at this resolution
    const newCache = prepareSvgPoints(asset, res, s.oscillatorGlyphPointCache)
    if (newCache !== s.oscillatorGlyphPointCache) {
      useReactStore.setState({ oscillatorGlyphPointCache: newCache })
    }
  }, GLYPH_RECOMPILE_DEBOUNCE_MS)
}

function prepareTextPoints(
  assets: OscillatorFontAsset[],
  settings: OscillatorSettings,
  cache: Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  const { textFontId, text, textLetterSpacing, textLineHeight, textAlignment, pathResolution } = settings
  if (!textFontId || !text.trim()) return cache
  const asset = assets.find(a => a.id === textFontId)
  if (!asset) return cache
  const res = clampRes(pathResolution)
  const lh    = textLineHeight ?? 1.2
  const align = textAlignment  ?? 'center'
  const key = textCacheKey(textFontId, text, textLetterSpacing, lh, align, res)
  if (cache[key]) return cache
  try {
    const font = parseOpenTypeFontFromAsset(asset)
    const pts = textToOpenTypeGlyphPoints(font, text, res, {
      letterSpacing: textLetterSpacing,
      lineHeight:    lh,
      alignment:     align,
    })
    return putBoundedTextPoints(cache, key, pts)
  } catch {
    return cache
  }
}

function prepareLayerTextPoints(
  assets:     OscillatorFontAsset[],
  fontId:     string,
  text:       string,
  spacing:    number,
  lineHeight: number,
  alignment:  string,
  res:        number,
  cache:      Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  if (!text.trim()) return cache
  const asset = assets.find(a => a.id === fontId)
  if (!asset) return cache
  const key = textCacheKey(fontId, text, spacing, lineHeight, alignment, res)
  if (cache[key]) return cache
  try {
    const font = parseOpenTypeFontFromAsset(asset)
    const pts  = textToOpenTypeGlyphPoints(font, text, res, {
      letterSpacing: spacing,
      lineHeight,
      alignment: alignment as 'left' | 'center' | 'right',
    })
    return putBoundedTextPoints(cache, key, pts)
  } catch {
    return cache
  }
}

const TEXT_GEOMETRY_SETTING_KEYS = new Set<keyof OscillatorSettings>([
  'text',
  'textFontId',
  'textLetterSpacing',
  'textLineHeight',
  'textAlignment',
  'pathResolution',
])

function patchChangesTextGeometry(patch: Partial<OscillatorSettings>): boolean {
  return Object.keys(patch).some(key => TEXT_GEOMETRY_SETTING_KEYS.has(key as keyof OscillatorSettings))
}

const SOUND_DRAWING_TRAIL_RESET_SETTING_KEYS = new Set<keyof OscillatorSettings>([
  'sourceType', 'classicMode', 'builtinShape', 'selectedGlyphId', 'selectedSvgVisualId',
  'selectedSvgId', 'svgRenderMode', 'svgUseReactPalette', 'text', 'textSource',
  'lyricGapBehavior', 'lyricFallbackText', 'textFontId', 'textFontSize',
  'textLetterSpacing', 'textLineHeight', 'textAlignment', 'renderMode', 'pathResolution',
])

function patchNeedsSoundDrawingTrailReset(patch: Partial<OscillatorSettings>): boolean {
  return Object.keys(patch).some(key => SOUND_DRAWING_TRAIL_RESET_SETTING_KEYS.has(key as keyof OscillatorSettings))
}

function prepareActiveSoundDrawingTextPoints(
  assets: OscillatorFontAsset[],
  settings: OscillatorSettings,
  cache: Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  return settings.sourceType === 'text'
    ? prepareTextPoints(assets, settings, cache)
    : cache
}

function resolveSoundDrawingLayerTextSettings(
  globalSettings: OscillatorSettings,
  layer: SoundDrawingLayer,
): OscillatorSettings {
  return {
    ...globalSettings,
    sourceType: 'text',
    ...(layer.fontId !== null && { textFontId: layer.fontId }),
    ...(layer.text && { text: layer.text }),
    textSource: normalizeSoundDrawingTextSource(layer.textSource),
    lyricGapBehavior: normalizeSoundDrawingGapBehavior(layer.lyricGapBehavior),
    lyricFallbackText: typeof layer.lyricFallbackText === 'string' ? layer.lyricFallbackText : '',
    textLetterSpacing: layer.letterSpacing,
    textLineHeight: layer.lineHeight,
    textAlignment: layer.alignment,
    ...layer.oscillatorOverride,
  }
}

function prepareSoundDrawingLayerTextPoints(
  assets: OscillatorFontAsset[],
  globalSettings: OscillatorSettings,
  layer: SoundDrawingLayer,
  cache: Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  if (layer.sourceType !== 'text') return cache
  const effective = resolveSoundDrawingLayerTextSettings(globalSettings, layer)
  if (!effective.textFontId || !effective.text.trim()) return cache
  return prepareLayerTextPoints(
    assets,
    effective.textFontId,
    effective.text,
    effective.textLetterSpacing,
    effective.textLineHeight,
    effective.textAlignment,
    clampRes(effective.pathResolution),
    cache,
  )
}

/**
 * Warms every OpenType text cache entry affected by the supplied global
 * oscillator settings. This runs only from semantic store actions, never from
 * the animation loop.
 */
export function prepareAllSoundDrawingTextPoints(
  assets: OscillatorFontAsset[],
  globalSettings: OscillatorSettings,
  layersByTrackId: Record<string, SoundDrawingLayer[]>,
  cache: Record<string, OscillatorGlyphPoint[]>,
): Record<string, OscillatorGlyphPoint[]> {
  let nextCache = globalSettings.sourceType === 'text'
    ? prepareTextPoints(assets, globalSettings, cache)
    : cache

  for (const layers of Object.values(layersByTrackId)) {
    for (const layer of layers) {
      nextCache = prepareSoundDrawingLayerTextPoints(
        assets,
        globalSettings,
        layer,
        nextCache,
      )
    }
  }

  return nextCache
}

// ── LaserDMX local helpers ────────────────────────────────────────────────────

function makeNewLaserFixture(existingFixtures: LaserDmxFixture[], profileId: LaserDmxProfileId = 'genericRgbLaser'): LaserDmxFixture {
  const maxAddr = existingFixtures.reduce((m, f) => Math.max(m, f.dmx.startAddress), 0)
  const nextAddr = Math.min(497, maxAddr + 16)  // keep within 512-channel universe
  const profile = getLaserDmxFixtureProfile(profileId)
  const fixtureKind = profile?.fixtureKind ?? 'laserProjector'
  const isMovingHead = isMovingHeadFixtureKind(fixtureKind)
  const isLaser = fixtureKind === 'laserProjector'
  const capabilities = profile?.capabilities
  const colorSystem = capabilities?.color
  const isFixedWhite = colorSystem?.mode === 'fixedWhite'
  const fixedColor = colorSystem?.mode === 'fixedColor' ? colorSystem.color : null
  const fixedRgb = fixedColor && /^#[0-9a-f]{6}$/i.test(fixedColor)
    ? {
        red: Number.parseInt(fixedColor.slice(1, 3), 16),
        green: Number.parseInt(fixedColor.slice(3, 5), 16),
        blue: Number.parseInt(fixedColor.slice(5, 7), 16),
      }
    : null
  const defaultFlash = normalizeProductionFlashPattern({
    ...DEFAULT_PRODUCTION_FLASH_PATTERN,
    enabled: fixtureKind === 'strobe',
    pattern: fixtureKind === 'strobe' ? 'sustainedStrobe' : 'singleHit',
    durationBeats: fixtureKind === 'strobe' ? 4 : 1,
    repeat: fixtureKind === 'strobe'
      ? { mode: 'loop', count: 1, intervalBeats: 4 }
      : DEFAULT_PRODUCTION_FLASH_PATTERN.repeat,
  })
  return {
    schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
    fixtureKind,
    id:      crypto.randomUUID(),
    name:    `${profile?.label ?? (isMovingHead ? 'Moving Head' : isLaser ? 'Laser' : 'Fixture')} ${existingFixtures.length + 1}`,
    enabled: true,
    dmx: { universe: 1, startAddress: nextAddr, profileId, channelMode: profileId === 'genericRgbLaser' ? 'basic' : 'extended' },
    position: { originX: 0.5, originY: 0.85, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
    color: {
      mode: 'fixed',
      red: fixedRgb?.red ?? (isFixedWhite ? 255 : 0),
      green: fixedRgb?.green ?? (isFixedWhite ? 255 : 255),
      blue: fixedRgb?.blue ?? (isFixedWhite ? 255 : 220),
      white: capabilities?.color?.mode === 'rgbw' || isFixedWhite ? 255 : 0,
      alpha: 1,
      paletteId: '',
      colorCycleSpeed: isLaser || isMovingHead ? 0.5 : 0,
    },
    colorPolicy: normalizeProductionFixtureColorPolicy(DEFAULT_PRODUCTION_FIXTURE_COLOR_POLICY),
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: isLaser ? 'fan' : 'staticBeam', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: isLaser ? 0.45 : 0, phaseOffset: 0, pointCount: isLaser ? 18 : 1, spread: 0.6, radius: 0.4, complexity: 0.4, smoothing: 0, pathProgress: isLaser ? 0 : 1 },
    ...(isMovingHead ? { movingHead: { ...DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS } } : {}),
    ...(capabilities?.strobe ? { flashPattern: defaultFlash } : {}),
    ...(capabilities?.wash ? { wash: normalizeProductionWashSettings(DEFAULT_PRODUCTION_WASH_SETTINGS) } : {}),
    ...(capabilities?.pixels ? { ledBar: normalizeProductionLedBarSettings(DEFAULT_PRODUCTION_LED_BAR_SETTINGS, capabilities.pixels.maxSegments) } : {}),
    ...(capabilities?.atmosphericOutput ? { atmospheric: normalizeProductionAtmosphericFixtureSettings(DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS, capabilities.atmosphericOutput.medium) } : {}),
    modulationRoutes: [],
  }
}

function makeNewModulationRoute(): LaserDmxModulationRoute {
  return {
    id:        crypto.randomUUID(),
    enabled:   false,
    source:    'bass',
    target:    'masterDimmer',
    amount:    0.5,
    min:       0,
    max:       1,
    curve:     'linear',
    mode:      'add',
    smoothing: 0,
    attack:    0,
    release:   0,
    invert:    false,
  }
}

function makeNewGroupRoute(): LaserDmxModulationRoute {
  return { ...makeNewModulationRoute(), target: 'dimmer' }
}

function makeNewBeamRoute(): LaserDmxModulationRoute {
  return { ...makeNewModulationRoute(), target: 'dimmer' }
}

function mergeLaserDmxShowDirectorSettingsPatch(
  current: LaserDmxShowDirectorState,
  patch: LaserDmxShowDirectorSettingsPatch,
): LaserDmxShowDirectorState {
  const settings = normalizeLaserDmxShowDirectorSettings({
    ...current.settings,
    ...patch,
    gridSize: patch.gridSize
      ? { ...current.settings.gridSize, ...patch.gridSize }
      : current.settings.gridSize,
  })
  const gridChanged = settings.gridSize.columns !== current.settings.gridSize.columns
    || settings.gridSize.rows !== current.settings.gridSize.rows
  return normalizeLaserDmxShowDirectorState({
    ...current,
    settings,
    fixtures: gridChanged
      ? current.fixtures.map((fixture, index) => clampLaserDmxShowDirectorFixtureToSettings(fixture, settings, index))
      : current.fixtures,
  })
}

const LASER_DMX_SHOW_DIRECTOR_GLOBAL_SETTING_KEYS = [
  'snapEnabled',
  'showLabels',
  'showBeams',
  'showGrid',
  'highlightFixtures',
  'presentationMode',
  'rendererMode',
  'webglQuality',
  'webglAtmosphereQuality',
  'webglRenderScale',
] as const

type LaserDmxShowDirectorGlobalSettingKey = typeof LASER_DMX_SHOW_DIRECTOR_GLOBAL_SETTING_KEYS[number]

function preserveLaserDmxShowDirectorGlobalSettings(
  next: LaserDmxShowDirectorState,
  currentSettings: LaserDmxShowDirectorSettings,
): LaserDmxShowDirectorState {
  return normalizeLaserDmxShowDirectorState({
    ...next,
    settings: {
      ...next.settings,
      snapEnabled: currentSettings.snapEnabled,
      showLabels: currentSettings.showLabels,
      showBeams: currentSettings.showBeams,
      showGrid: currentSettings.showGrid,
      highlightFixtures: currentSettings.highlightFixtures,
      presentationMode: currentSettings.presentationMode,
      rendererMode: currentSettings.rendererMode,
      webglQuality: currentSettings.webglQuality,
      webglAtmosphereQuality: currentSettings.webglAtmosphereQuality,
      webglRenderScale: currentSettings.webglRenderScale,
    },
  })
}

function isLaserDmxShowDirectorGlobalSettingsPatch(
  patch: LaserDmxShowDirectorSettingsPatch,
): boolean {
  const keys = Object.keys(patch)
  return keys.length > 0 && keys.every(key => (
    LASER_DMX_SHOW_DIRECTOR_GLOBAL_SETTING_KEYS.includes(key as LaserDmxShowDirectorGlobalSettingKey)
  ))
}

function mergeLaserDmxShowDirectorFixturePatch(
  fixture: LaserDmxShowDirectorFixture,
  patch: LaserDmxShowDirectorFixturePatch,
  index: number,
): LaserDmxShowDirectorFixture {
  return normalizeLaserDmxShowDirectorFixture({
    ...fixture,
    ...patch,
    id: patch.id ?? fixture.id,
    beam: patch.beam ? { ...fixture.beam, ...patch.beam } : fixture.beam,
    trigger: patch.trigger ? { ...fixture.trigger, ...patch.trigger } : fixture.trigger,
    component: patch.component ? { ...fixture.component, ...patch.component } : fixture.component,
    optics: patch.optics ? { ...fixture.optics, ...patch.optics } : fixture.optics,
  }, index)
}


function createLaserDmxShowDirectorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `show-director-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

function clampShowDirectorGrid(value: number, max: number): number {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0))
}

function createLaserDmxShowDirectorDefaultEndpoint(
  fixture: Pick<LaserDmxShowDirectorFixture, 'kind' | 'x' | 'y' | 'rotation' | 'beam'>,
  settings: LaserDmxShowDirectorState['settings'],
): { targetX: number; targetY: number } {
  const columns = Math.max(1, Math.round(settings.gridSize.columns || 1))
  const rows = Math.max(1, Math.round(settings.gridSize.rows || 1))
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const distance = Math.max(2, Math.min(columns, rows) * 0.32)
  const rotation = Number.isFinite(fixture.rotation) ? fixture.rotation : 0
  const beamAngle = Number.isFinite(fixture.beam.beamAngle) ? fixture.beam.beamAngle : 0
  const radians = (rotation + beamAngle) * Math.PI / 180
  const targetX = clampShowDirectorGrid(fixture.x + Math.cos(radians) * distance, maxX)
  const targetY = clampShowDirectorGrid(fixture.y + Math.sin(radians) * distance, maxY)
  return {
    targetX: settings.snapEnabled ? Math.round(targetX) : targetX,
    targetY: settings.snapEnabled ? Math.round(targetY) : targetY,
  }
}

function clampLaserDmxShowDirectorBeamTargets(
  fixture: LaserDmxShowDirectorFixture,
  maxX: number,
  maxY: number,
): NonNullable<LaserDmxShowDirectorFixture['beam']['targets']> {
  const fallbackX = fixture.beam.targetX == null ? fixture.x : fixture.beam.targetX
  const fallbackY = fixture.beam.targetY == null ? fixture.y : fixture.beam.targetY
  const sourceTargets = Array.isArray(fixture.beam.targets) && fixture.beam.targets.length > 0
    ? fixture.beam.targets
    : [{ id: `${fixture.id}-target-1`, x: fallbackX, y: fallbackY }]

  return sourceTargets
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index) => ({
      ...target,
      id: typeof target.id === 'string' && target.id.trim().length > 0 ? target.id : `${fixture.id}-target-${index + 1}`,
      x:  clampShowDirectorGrid(target.x, maxX),
      y:  clampShowDirectorGrid(target.y, maxY),
    }))
}

function clampLaserDmxShowDirectorFixtureToSettings(
  fixture: LaserDmxShowDirectorFixture,
  settings: LaserDmxShowDirectorState['settings'],
  index: number,
): LaserDmxShowDirectorFixture {
  const maxX = Math.max(0, Math.round(settings.gridSize.columns) - 1)
  const maxY = Math.max(0, Math.round(settings.gridSize.rows) - 1)
  const targets = clampLaserDmxShowDirectorBeamTargets(fixture, maxX, maxY)
  const primaryTarget = targets[0]
  return normalizeLaserDmxShowDirectorFixture({
    ...fixture,
    x: clampShowDirectorGrid(fixture.x, maxX),
    y: clampShowDirectorGrid(fixture.y, maxY),
    beam: {
      ...fixture.beam,
      targetX: primaryTarget?.x ?? (fixture.beam.targetX == null ? fixture.beam.targetX : clampShowDirectorGrid(fixture.beam.targetX, maxX)),
      targetY: primaryTarget?.y ?? (fixture.beam.targetY == null ? fixture.beam.targetY : clampShowDirectorGrid(fixture.beam.targetY, maxY)),
      targets,
    },
  }, index)
}

function findLaserDmxShowDirectorOpenSlot(state: LaserDmxShowDirectorState): { x: number; y: number } {
  const columns = Math.max(1, Math.round(state.settings.gridSize.columns || 1))
  const rows = Math.max(1, Math.round(state.settings.gridSize.rows || 1))
  const centerX = Math.floor((columns - 1) / 2)
  const centerY = Math.floor((rows - 1) / 2)
  const occupied = new Set(
    state.fixtures.map(fixture => {
      const x = clampShowDirectorGrid(Math.round(fixture.x), columns - 1)
      const y = clampShowDirectorGrid(Math.round(fixture.y), rows - 1)
      return `${x}:${y}`
    }),
  )

  const candidates: Array<{ x: number; y: number; distance: number }> = []
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      candidates.push({
        x,
        y,
        distance: ((x - centerX) ** 2) + ((y - centerY) ** 2),
      })
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x)
  return candidates.find(candidate => !occupied.has(`${candidate.x}:${candidate.y}`)) ?? { x: centerX, y: centerY }
}

function mirrorLaserDmxShowDirectorFixtureAcrossGrid(
  fixture: LaserDmxShowDirectorFixture,
  state: LaserDmxShowDirectorState,
  axis: 'horizontal' | 'vertical',
  index: number,
): LaserDmxShowDirectorFixture {
  const maxX = Math.max(0, Math.round(state.settings.gridSize.columns) - 1)
  const maxY = Math.max(0, Math.round(state.settings.gridSize.rows) - 1)
  const mirroredX = maxX - clampShowDirectorGrid(fixture.x, maxX)
  const mirroredY = maxY - clampShowDirectorGrid(fixture.y, maxY)
  const mirroredTargets = (fixture.beam.targets ?? []).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map(target => ({
    ...target,
    x: axis === 'horizontal' ? maxX - clampShowDirectorGrid(target.x, maxX) : clampShowDirectorGrid(target.x, maxX),
    y: axis === 'vertical' ? maxY - clampShowDirectorGrid(target.y, maxY) : clampShowDirectorGrid(target.y, maxY),
  }))
  const mirroredPrimaryTarget = mirroredTargets[0]
  const mirroredTargetX = mirroredPrimaryTarget?.x ?? (fixture.beam.targetX == null
    ? fixture.beam.targetX
    : axis === 'horizontal'
      ? maxX - clampShowDirectorGrid(fixture.beam.targetX, maxX)
      : clampShowDirectorGrid(fixture.beam.targetX, maxX))
  const mirroredTargetY = mirroredPrimaryTarget?.y ?? (fixture.beam.targetY == null
    ? fixture.beam.targetY
    : axis === 'vertical'
      ? maxY - clampShowDirectorGrid(fixture.beam.targetY, maxY)
      : clampShowDirectorGrid(fixture.beam.targetY, maxY))
  const rotation = Number.isFinite(fixture.rotation) ? fixture.rotation : 0
  const beamAngle = Number.isFinite(fixture.beam.beamAngle) ? fixture.beam.beamAngle : 0
  const mirroredRotation = axis === 'horizontal'
    ? normalizeDegrees(180 - rotation)
    : normalizeDegrees(-rotation)
  const effectiveAngle = normalizeDegrees(rotation + beamAngle)
  const mirroredEffectiveAngle = axis === 'horizontal'
    ? normalizeDegrees(180 - effectiveAngle)
    : normalizeDegrees(-effectiveAngle)
  const mirroredBeamAngle = normalizeDegrees(mirroredEffectiveAngle - mirroredRotation)
  const mirroredScanner = fixture.scanner
    ? {
      ...fixture.scanner,
      direction: fixture.scanner.direction,
      reversePath: !fixture.scanner.reversePath,
      path: {
        ...fixture.scanner.path,
        points: fixture.scanner.path.points.map(point => ({
          ...point,
          x: axis === 'horizontal' ? maxX - clampShowDirectorGrid(point.x, maxX) : clampShowDirectorGrid(point.x, maxX),
          y: axis === 'vertical' ? maxY - clampShowDirectorGrid(point.y, maxY) : clampShowDirectorGrid(point.y, maxY),
        })),
      },
      migration: {
        ...fixture.scanner.migration,
        sourceTargetIds: [...fixture.scanner.migration.sourceTargetIds],
        warnings: [...fixture.scanner.migration.warnings],
      },
    }
    : undefined

  return normalizeLaserDmxShowDirectorFixture({
    ...fixture,
    x: axis === 'horizontal' ? mirroredX : fixture.x,
    y: axis === 'vertical' ? mirroredY : fixture.y,
    rotation: mirroredRotation,
    beam: {
      ...fixture.beam,
      beamAngle: mirroredBeamAngle,
      targetX: mirroredPrimaryTarget ? mirroredPrimaryTarget.x : (axis === 'horizontal' ? mirroredTargetX : fixture.beam.targetX),
      targetY: mirroredPrimaryTarget ? mirroredPrimaryTarget.y : (axis === 'vertical' ? mirroredTargetY : fixture.beam.targetY),
      targets: mirroredTargets,
    },
    ...(mirroredScanner ? { scanner: mirroredScanner } : {}),
  }, index)
}

function normalizeLaserDmxShowDirectorSelectionState(
  current: LaserDmxShowDirectorState,
  selectedFixtureIds: string[],
  primaryFixtureId?: string | null,
): LaserDmxShowDirectorState {
  const fixtureIds = new Set(current.fixtures.map(fixture => fixture.id))
  const uniqueSelectedFixtureIds = Array.from(new Set(selectedFixtureIds.filter(id => fixtureIds.has(id))))
  const selectedFixtureId = primaryFixtureId && fixtureIds.has(primaryFixtureId)
    ? primaryFixtureId
    : uniqueSelectedFixtureIds[0] ?? null
  const normalizedSelectedFixtureIds = selectedFixtureId
    ? [selectedFixtureId, ...uniqueSelectedFixtureIds.filter(id => id !== selectedFixtureId)]
    : uniqueSelectedFixtureIds

  return normalizeLaserDmxShowDirectorState({
    ...current,
    selectedFixtureId,
    selectedFixtureIds: normalizedSelectedFixtureIds,
  })
}

function getLaserDmxShowDirectorSelectedFixtureIds(state: LaserDmxShowDirectorState): string[] {
  if (state.selectedFixtureIds.length > 0) return state.selectedFixtureIds
  return state.selectedFixtureId ? [state.selectedFixtureId] : []
}

function sanitizeLaserDmxShowDirectorGroupLabel(label: string | null | undefined, fallback: string): string {
  const trimmed = typeof label === 'string' ? label.trim() : ''
  return (trimmed || fallback).slice(0, 48)
}

function createLaserDmxShowDirectorGroupLabel(state: LaserDmxShowDirectorState): string {
  const usedLabels = new Set(state.groups.map(group => group.label.trim().toLowerCase()))
  let index = 1
  while (usedLabels.has(`group ${index}`)) index += 1
  return `Group ${index}`
}

function findLaserDmxShowDirectorGroup(state: LaserDmxShowDirectorState, groupId: string | null | undefined): LaserDmxShowDirectorGroup | null {
  if (!groupId) return null
  return state.groups.find(group => group.id === groupId) ?? null
}

function createOffsetLaserDmxShowDirectorFixtureCopy(
  source: LaserDmxShowDirectorFixture,
  state: LaserDmxShowDirectorState,
  id: string,
  index: number,
  offset: number,
): LaserDmxShowDirectorFixture {
  const maxX = Math.max(0, Math.round(state.settings.gridSize.columns) - 1)
  const maxY = Math.max(0, Math.round(state.settings.gridSize.rows) - 1)
  const offsetTargets = (source.beam.targets ?? []).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map((target, targetIndex) => ({
    ...target,
    id: `${id}-target-${targetIndex + 1}`,
    x: Math.max(0, Math.min(maxX, target.x + offset)),
    y: Math.max(0, Math.min(maxY, target.y + offset)),
  }))
  const offsetScanner = source.scanner
    ? {
      ...source.scanner,
      path: {
        ...source.scanner.path,
        points: source.scanner.path.points.map((point, pointIndex) => ({
          ...point,
          id: `${id}-scan-point-${pointIndex + 1}`,
          x: Math.max(0, Math.min(maxX, point.x + offset)),
          y: Math.max(0, Math.min(maxY, point.y + offset)),
        })),
      },
      migration: {
        ...source.scanner.migration,
        sourceTargetIds: [...source.scanner.migration.sourceTargetIds],
        warnings: [...source.scanner.migration.warnings],
      },
    }
    : undefined

  return normalizeLaserDmxShowDirectorFixture({
    ...source,
    id,
    semanticKey: undefined,
    label: `${source.label} Copy`,
    linkedPairId: null,
    mirrorAxis: null,
    x: Math.max(0, Math.min(maxX, source.x + offset)),
    y: Math.max(0, Math.min(maxY, source.y + offset)),
    beam: {
      ...source.beam,
      targetX: offsetTargets[0]?.x ?? (source.beam.targetX == null ? source.beam.targetX : Math.max(0, Math.min(maxX, source.beam.targetX + offset))),
      targetY: offsetTargets[0]?.y ?? (source.beam.targetY == null ? source.beam.targetY : Math.max(0, Math.min(maxY, source.beam.targetY + offset))),
      targets: offsetTargets,
    },
    ...(offsetScanner ? { scanner: offsetScanner } : {}),
  }, index)
}

function clampLaserDmxShowDirectorDelta(
  fixtures: LaserDmxShowDirectorFixture[],
  settings: LaserDmxShowDirectorState['settings'],
  deltaX: number,
  deltaY: number,
): { deltaX: number; deltaY: number } {
  if (fixtures.length === 0) return { deltaX: 0, deltaY: 0 }
  const maxX = Math.max(0, Math.round(settings.gridSize.columns) - 1)
  const maxY = Math.max(0, Math.round(settings.gridSize.rows) - 1)
  const minFixtureX = Math.min(...fixtures.map(fixture => fixture.x))
  const maxFixtureX = Math.max(...fixtures.map(fixture => fixture.x))
  const minFixtureY = Math.min(...fixtures.map(fixture => fixture.y))
  const maxFixtureY = Math.max(...fixtures.map(fixture => fixture.y))

  return {
    deltaX: Math.max(-minFixtureX, Math.min(maxX - maxFixtureX, Number.isFinite(deltaX) ? deltaX : 0)),
    deltaY: Math.max(-minFixtureY, Math.min(maxY - maxFixtureY, Number.isFinite(deltaY) ? deltaY : 0)),
  }
}


function clampLaserDmxShowDirectorOrphanedMirrorLinks(fixtures: LaserDmxShowDirectorFixture[]): LaserDmxShowDirectorFixture[] {
  const counts = fixtures.reduce((map, fixture) => {
    if (fixture.linkedPairId && fixture.mirrorAxis) map.set(fixture.linkedPairId, (map.get(fixture.linkedPairId) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  return fixtures.map(fixture => (
    fixture.linkedPairId && fixture.mirrorAxis && (counts.get(fixture.linkedPairId) ?? 0) >= 2
      ? fixture
      : { ...fixture, linkedPairId: null, mirrorAxis: null }
  ))
}

function createLaserDmxShowDirectorMirrorPairCopy(
  source: LaserDmxShowDirectorFixture,
  state: LaserDmxShowDirectorState,
  id: string,
  pairId: string,
  axis: LaserDmxShowDirectorMirrorAxis,
  index: number,
): LaserDmxShowDirectorFixture {
  const mirrored = mirrorLaserDmxShowDirectorFixtureAcrossGrid(source, state, axis, index)
  const targets = (mirrored.beam.targets ?? []).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map((target, targetIndex) => ({
    ...target,
    id: `${id}-target-${targetIndex + 1}`,
  }))
  return normalizeLaserDmxShowDirectorFixture({
    ...mirrored,
    id,
    semanticKey: undefined,
    label: `${source.label} Mirror`,
    linkedPairId: pairId,
    mirrorAxis: axis,
    beam: {
      ...mirrored.beam,
      targetX: targets[0]?.x ?? mirrored.beam.targetX,
      targetY: targets[0]?.y ?? mirrored.beam.targetY,
      targets,
    },
  }, index)
}

function syncLaserDmxShowDirectorLinkedMirrors(
  fixtures: LaserDmxShowDirectorFixture[],
  state: LaserDmxShowDirectorState,
  changedFixtureIds: string[],
): LaserDmxShowDirectorFixture[] {
  if (changedFixtureIds.length === 0) return fixtures
  const changedSet = new Set(changedFixtureIds)
  const byId = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  let nextFixtures = fixtures

  changedFixtureIds.forEach(sourceId => {
    const source = byId.get(sourceId)
    if (!source?.linkedPairId || !source.mirrorAxis) return
    const follower = nextFixtures.find(fixture => fixture.id !== source.id && fixture.linkedPairId === source.linkedPairId)
    if (!follower || changedSet.has(follower.id)) return
    const followerIndex = nextFixtures.findIndex(fixture => fixture.id === follower.id)
    if (followerIndex < 0) return
    const mirrored = mirrorLaserDmxShowDirectorFixtureAcrossGrid(source, { ...state, fixtures: nextFixtures }, source.mirrorAxis, followerIndex)
    const remappedTargets = (mirrored.beam.targets ?? []).slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS).map((target, targetIndex) => ({
      ...target,
      id: `${follower.id}-target-${targetIndex + 1}`,
    }))
    const primary = remappedTargets[0]
    const nextFollower = normalizeLaserDmxShowDirectorFixture({
      ...mirrored,
      id: follower.id,
      semanticKey: follower.semanticKey,
      label: follower.label,
      groupId: follower.groupId,
      linkedPairId: source.linkedPairId,
      mirrorAxis: source.mirrorAxis,
      beam: {
        ...mirrored.beam,
        targetX: primary?.x ?? mirrored.beam.targetX,
        targetY: primary?.y ?? mirrored.beam.targetY,
        targets: remappedTargets,
      },
    }, followerIndex)
    nextFixtures = nextFixtures.map(fixture => fixture.id === follower.id ? nextFollower : fixture)
    byId.set(follower.id, nextFollower)
  })

  return nextFixtures
}

const SHOW_DIRECTOR_HISTORY_LIMIT = 48

function normalizeShowDirectorSnapshot(state: LaserDmxShowDirectorState): LaserDmxShowDirectorState {
  return normalizeLaserDmxShowDirectorState(state)
}

function showDirectorSnapshotsEqual(a: LaserDmxShowDirectorState, b: LaserDmxShowDirectorState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function trimShowDirectorHistory(stack: LaserDmxShowDirectorState[]): LaserDmxShowDirectorState[] {
  return stack.slice(Math.max(0, stack.length - SHOW_DIRECTOR_HISTORY_LIMIT))
}

function buildLaserDmxShowDirectorHistoryPatch(
  storeState: Pick<ReactStoreState, 'laserDmxShowDirector' | 'laserDmxShowDirectorPerformance' | 'laserDmxShowDirectorUndoStack' | 'laserDmxShowDirectorRedoStack' | 'laserDmxShowDirectorHistoryTransaction'>,
  nextState: LaserDmxShowDirectorState,
) {
  const current = normalizeShowDirectorSnapshot(storeState.laserDmxShowDirector)
  const next = normalizeShowDirectorSnapshot(nextState)
  if (showDirectorSnapshotsEqual(current, next)) return {}
  const performance = normalizeLaserDmxShowDirectorPerformanceState(storeState.laserDmxShowDirectorPerformance)
  const invalidatedPerformance = {
    ...performance,
    presetDirty: performance.activePresetId != null ? true : performance.presetDirty,
    runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
      performance.runtimeInvalidationId,
      performance.activeProgramId,
    ),
  }
  if (storeState.laserDmxShowDirectorHistoryTransaction) {
    return {
      laserDmxBeamMatrixPresetDirty: true,
      laserDmxShowDirector: next,
      laserDmxShowDirectorPerformance: invalidatedPerformance,
    }
  }
  return {
    laserDmxBeamMatrixPresetDirty: true,
    laserDmxShowDirector: next,
    laserDmxShowDirectorPerformance: invalidatedPerformance,
    laserDmxShowDirectorUndoStack: trimShowDirectorHistory([
      ...storeState.laserDmxShowDirectorUndoStack,
      current,
    ]),
    laserDmxShowDirectorRedoStack: [],
  }
}


function pixGridSnapshotsEqual(a: PixGridState, b: PixGridState): boolean {
  return JSON.stringify(normalizePixGridState(a)) === JSON.stringify(normalizePixGridState(b))
}

function trimPixGridHistory(stack: PixGridState[]): PixGridState[] {
  return stack.slice(Math.max(0, stack.length - MAX_PIX_GRID_HISTORY))
}

function buildPixGridHistoryPatch(
  storeState: Pick<ReactStoreState, 'pixGridState' | 'pixGridUndoStack' | 'pixGridRedoStack' | 'pixGridHistoryTransaction'>,
  nextState: PixGridState,
) {
  const current = normalizePixGridState(storeState.pixGridState)
  const next = normalizePixGridState(nextState)
  if (pixGridSnapshotsEqual(current, next)) return {}
  if (storeState.pixGridHistoryTransaction) return { pixGridState: next }
  return {
    pixGridState: next,
    pixGridUndoStack: trimPixGridHistory([...storeState.pixGridUndoStack, current]),
    pixGridRedoStack: [],
  }
}

// ── Beam Matrix local helpers ─────────────────────────────────────────────────

function clampCol(v: number): number { return Math.max(1, Math.min(LASER_DMX_MATRIX_COLUMNS, Math.round(v))) }
function clampRow(v: number): number { return Math.max(1, Math.min(LASER_DMX_MATRIX_ROWS, Math.round(v))) }
function clamp01bm(v: number): number { return Math.max(0, Math.min(1, v)) }
function clampC255(v: number): number { return Math.max(0, Math.min(255, Math.round(v))) }

function makeDefaultMatrixBeam(existing: LaserDmxMatrixBeam[]): LaserDmxMatrixBeam {
  return {
    id:            crypto.randomUUID(),
    name:          `Beam ${existing.length + 1}`,
    enabled:       true,
    sequenceIndex: existing.length,
    origin:  { column: 8, row: 5, z: 0 },
    target:  { kind: 'grid', column: 8, row: 1, z: 0 },
    groupId:       null,
    useGroupColor: false,
    color:      { red: 0, green: 255, blue: 220, white: 0, alpha: 1 },
    appearance: {
      dimmer: 1, shutterOpen: true, width: 1, focus: 1,
      strobeRate: 0, flickerAmount: 0, divergence: 0.15, glow: 0.65,
      geometry: 'line',
    },
    motion:           DEFAULT_BEAM_MOTION,
    modulationRoutes: [],
  }
}

function clampMatrixBeam(beam: LaserDmxMatrixBeam): LaserDmxMatrixBeam {
  const o = beam.origin
  const t = beam.target
  const clampedTarget = t.kind === 'grid'
    ? { ...t, column: clampCol(t.column), row: clampRow(t.row), z: Math.max(-1, Math.min(1, t.z)) }
    : {
        ...t,
        // Stage targets: NOT clamped to 0–1; range is −1 to 2
        x: Math.max(-1, Math.min(2, t.x)),
        y: Math.max(-1, Math.min(2, t.y)),
        z: Math.max(-1, Math.min(2, t.z)),
      }
  return {
    ...beam,
    origin: { column: clampCol(o.column), row: clampRow(o.row), z: Math.max(-1, Math.min(1, o.z)) },
    target: clampedTarget,
    color: {
      red:   clampC255(beam.color.red),
      green: clampC255(beam.color.green),
      blue:  clampC255(beam.color.blue),
      white: clampC255(beam.color.white),
      alpha: clamp01bm(beam.color.alpha),
    },
    appearance: {
      ...beam.appearance,
      dimmer:        clamp01bm(beam.appearance.dimmer),
      width:         Math.max(0.1, Math.min(8, beam.appearance.width)),
      focus:         clamp01bm(beam.appearance.focus),
      strobeRate:    clamp01bm(beam.appearance.strobeRate),
      flickerAmount: clamp01bm(beam.appearance.flickerAmount),
      divergence:    clamp01bm(beam.appearance.divergence),
      glow:          clamp01bm(beam.appearance.glow),
    },
  }
}

// ── Preset oscillator settings resolver ───────────────────────────────────────
// Single source of truth for how oscillatorSettings are resolved when a preset
// is selected (from the preset browser or via a performance pad).
//
// Oscilloscope presets always reset to DEFAULT_OSCILLATOR_SETTINGS and then
// merge any preset-specific overrides on top.  This ensures legacy presets
// that have no oscillatorSettings always land on classic mode rather than
// inheriting whatever sourceType was active before.
//
// Non-oscilloscope presets (shaderPads, cinematicPortal) leave oscillatorSettings
// untouched so engine-specific state is not inadvertently overwritten.
export function resolvePresetOscillatorSettings(
  preset: ReactPreset,
  currentSettings: OscillatorSettings,
): OscillatorSettings {
  if (preset.engine !== 'oscilloscope') return currentSettings
  return normalizeOscillatorSettings({
    ...DEFAULT_OSCILLATOR_SETTINGS,
    ...(preset.oscillatorSettings ?? {}),
  })
}

// ── buildPresetPatch ──────────────────────────────────────────────────────────
// Pure helper — returns the state slice that must change whenever a preset is
// applied.  Shared by selectReactPreset, setActivePadId, and selectReactEngine
// so all three code paths produce identical side-effects.
//
// Invariant enforced by this function:
//   activeReactEngineId === activeReactPresetId's preset.engine
//
export function buildPresetPatch(
  preset: ReactPreset,
  currentOscSettings: OscillatorSettings,
  currentLaserSettings?: LaserDmxSettings,
) {
  if (!isSelectableReactEngineId(preset.engine)) {
    const fallback = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === INITIAL_PRESET_ID)
    if (!fallback) throw new Error(`[DRMVYZ] Missing startup preset ${INITIAL_PRESET_ID}`)
    return buildPresetPatch(fallback, currentOscSettings, currentLaserSettings)
  }

  const laserDmxWorkspaceMode = resolveReactPresetLaserDmxWorkspace(preset)
  const safeLaserDmxWorkspaceMode = preset.engine === 'laserDmx'
    ? coerceLaserDmxWorkspaceMode(laserDmxWorkspaceMode)
    : null
  const shouldApplyLaserDmxSettings = preset.laserDmxSettings != null
    && preset.engine === 'laserDmx'
    && !isRetiredLaserDmxPreset(preset)
  let laserPatch: LaserDmxSettings | undefined
  if (shouldApplyLaserDmxSettings) {
    // Presets are complete looks, not deltas against live authored state.
    const merged = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      ...preset.laserDmxSettings,
    })
    const adapted = merged
    const resolved = currentLaserSettings
      ? (() => {
          const currentStage = normalizeProductionStageModel(currentLaserSettings.productionStage)
          const nextStage = normalizeProductionStageModel(adapted.productionStage)
          return normalizeLaserDmxSettings({
            ...adapted,
            // Presentation controls are workspace preferences rather than part
            // of a fixture look. Keep them stable while DJs audition presets.
            productionStage: {
              ...nextStage,
              previewZoom: currentStage.previewZoom,
              editor: {
                ...nextStage.editor,
                guidesVisible: currentStage.editor.guidesVisible,
              },
            },
            showFixtureOrigins: currentLaserSettings.showFixtureOrigins,
            showPathPoints: currentLaserSettings.showPathPoints,
          })
        })()
      : adapted
    laserPatch = ensureProductionLookCompatibility(normalizeLaserDmxSettings(resolved), preset.name, 'authored')
  }


  const renderSettings = {
    ...DEFAULT_REACT_PRESET_RENDER_SETTINGS,
    ...(preset.renderSettings ?? {}),
  }

  return {
    activeReactPresetId: preset.id,
    activeReactEngineId: preset.engine,
    reactIntensity:      preset.params.intensity,
    reactMotion:         preset.params.motion,
    reactGlow:           preset.params.glow,
    reactBassReactivity: preset.params.bassReactivity,
    reactTrailDecay:      renderSettings.trailDecay,
    reactFogDensity:      renderSettings.fogDensity,
    reactParticleDensity: renderSettings.particleDensity,
    oscillatorSettings:  resolvePresetOscillatorSettings(preset, currentOscSettings),
    ...(safeLaserDmxWorkspaceMode != null ? { laserDmxWorkspaceMode: safeLaserDmxWorkspaceMode } : {}),
    ...(laserPatch        != null ? { laserDmxSettings:   laserPatch        } : {}),
    ...clearPerformanceActionPatch(),
  }
}

function buildPresetPatchForState(
  preset: ReactPreset,
  state: ReactStoreState,
) {
  const patch = buildPresetPatch(
    preset,
    state.oscillatorSettings,
    state.laserDmxSettings,
  )
  const geometryChanged = [...TEXT_GEOMETRY_SETTING_KEYS].some(
    key => patch.oscillatorSettings[key] !== state.oscillatorSettings[key],
  )
  const pixGridPatch = preset.engine === 'pixGrid'
    ? {
        pixGridState: applyPixGridPresetSettings(
          state.pixGridState,
          preset.id,
          preset.pixGridSettings,
        ),
      }
    : {}
  if (!geometryChanged) return { ...patch, ...pixGridPatch }
  return {
    ...patch,
    ...pixGridPatch,
    oscillatorTextPointCache: prepareAllSoundDrawingTextPoints(
      state.oscillatorFontAssets,
      patch.oscillatorSettings,
      state.soundDrawingLayersByTrackId,
      state.oscillatorTextPointCache,
    ),
  }
}

function getReactPresetControlValues(state: Pick<ReactStoreState,
  | 'reactIntensity'
  | 'reactMotion'
  | 'reactGlow'
  | 'reactBassReactivity'
  | 'reactTrailDecay'
  | 'reactFogDensity'
  | 'reactParticleDensity'
>): ReactPresetControlValues {
  return {
    intensity:       state.reactIntensity,
    motion:          state.reactMotion,
    glow:            state.reactGlow,
    bassReactivity:  state.reactBassReactivity,
    trailDecay:      state.reactTrailDecay,
    fogDensity:      state.reactFogDensity,
    particleDensity: state.reactParticleDensity,
  }
}

function getPresetPatchControlValues(
  patch: ReturnType<typeof buildPresetPatch>,
): ReactPresetControlValues {
  return {
    intensity:       patch.reactIntensity,
    motion:          patch.reactMotion,
    glow:            patch.reactGlow,
    bassReactivity:  patch.reactBassReactivity,
    trailDecay:      patch.reactTrailDecay,
    fogDensity:      patch.reactFogDensity,
    particleDensity: patch.reactParticleDensity,
  }
}

export type CinematicWorldsUiMode = 'simple' | 'advanced'

export function resolveCinematicConfigForPreset(
  preset: ReactPreset | null | undefined,
  overrides: Record<string, CinematicWorldConfig>,
): CinematicWorldConfig | null {
  if (!preset || preset.engine !== 'cinematicPortal') return null
  const override = overrides[preset.id]
  if (override) return normalizeCinematicWorldConfig(override)
  return normalizeCinematicWorldConfig(
    preset.cinematicConfig ?? createLegacyPortalCinematicConfig({ ...preset.params, ...preset.renderSettings }),
  )
}

function normalizeCinematicConfigOverrides(
  value: unknown,
  presets: ReactPreset[],
): Record<string, CinematicWorldConfig> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const cinematicPresetIds = new Set(presets.filter(preset => preset.engine === 'cinematicPortal').map(preset => preset.id))
  const normalized: Record<string, CinematicWorldConfig> = {}
  for (const [presetId, config] of Object.entries(value as Record<string, unknown>)) {
    if (cinematicPresetIds.has(presetId)) normalized[presetId] = normalizeCinematicWorldConfig(config)
  }
  return normalized
}

function normalizeCinematicSeedLocks(
  value: unknown,
  presets: ReactPreset[],
): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const cinematicPresetIds = new Set(presets.filter(preset => preset.engine === 'cinematicPortal').map(preset => preset.id))
  const normalized: Record<string, boolean> = {}
  for (const [presetId, locked] of Object.entries(value as Record<string, unknown>)) {
    if (cinematicPresetIds.has(presetId) && typeof locked === 'boolean') normalized[presetId] = locked
  }
  return normalized
}

interface ReactStoreState {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
  reactPresets: ReactPreset[]

  // PixGrid compact, serializable authoring/runtime configuration.
  pixGridState: PixGridState
  setPixGridState: (patch: Partial<PixGridState>) => void
  resetPixGridState: () => void
  setPixGridAuthoringOverlayVisible: (visible: boolean) => void
  pixGridUndoStack: PixGridState[]
  pixGridRedoStack: PixGridState[]
  pixGridHistoryTransaction: PixGridState | null
  applyPixGridAuthoringState: (nextState: PixGridState) => void
  beginPixGridHistoryTransaction: () => void
  commitPixGridHistoryTransaction: () => void
  cancelPixGridHistoryTransaction: () => void
  undoPixGridEdit: () => void
  redoPixGridEdit: () => void

  // Cinematic Worlds live authoring state. Preset definitions remain immutable baselines.
  cinematicConfigsByPresetId: Record<string, CinematicWorldConfig>
  cinematicSeedLocksByPresetId: Record<string, boolean>
  cinematicWorldsUiMode: CinematicWorldsUiMode

  // CANVAS persists safe media-library references. Legacy session blob URLs remain runtime-only.
  canvasEngineSettings: CanvasEngineSettings
  canvasMediaItems: CanvasMediaItem[]
  canvasMediaTimingById: Record<string, CanvasVideoTimingSettings>
  selectedCanvasMediaId: string | null
  activeCanvasMediaId: string | null
  selectedCanvasPresetId: CanvasPresetId
  canvasPresetSettings: CanvasPresetSettings
  canvasPresetOverride: CanvasPresetOverrideState | null
  canvasVideoRestartRevision: number
  canvasOrchestrationSettings: CanvasOrchestrationSettings
  setCanvasOrchestrationSettings: (patch: Partial<CanvasOrchestrationSettings>) => void
  toggleCanvasMediaPoolItem: (mediaId: string, selected?: boolean) => void
  setCanvasMediaRoles: (mediaId: string, roles: CanvasMediaRole[]) => void
  setCanvasLayerLock: (role: CanvasLayerRole, locked: boolean) => void
  setCanvasMediaLock: (role: CanvasLayerRole, mediaId: string | null) => void
  setCanvasOrchestrationLock: (lock: CanvasOrchestrationLockKey, locked: boolean) => void
  resetCanvasOrchestration: () => void
  setCanvasEngineSettings: (patch: Partial<CanvasEngineSettings>) => void
  resetCanvasEngineSettings: () => void
  setCanvasAutoSelectEnabled: (enabled: boolean) => void
  applyCanvasAutoSelection: (selection: { presetId?: CanvasPresetId | null; mediaId?: string | null; label?: string | null }) => void
  clearCanvasPresetOverride: () => void
  clearCanvasMediaOverride: () => void
  selectCanvasPreset: (id: CanvasPresetId) => void
  setCanvasPresetSettings: (patch: Partial<CanvasPresetSettings>) => void
  resetCanvasPresetSettings: () => void
  addCanvasMediaItems: (items: CanvasMediaItem[]) => void
  selectCanvasMediaItem: (id: string, options?: { manual?: boolean }) => void
  restartCanvasVideo: () => void
  setCanvasMediaTiming: (mediaId: string, patch: Partial<CanvasVideoTimingSettings>) => void
  removeCanvasMediaItem: (id: string) => void
  clearCanvasMediaItems: () => void

  setCinematicConfigForPreset: (presetId: string, config: CinematicWorldConfig) => void
  clearCinematicConfigForPreset: (presetId: string) => void
  setCinematicSeedLocked: (presetId: string, locked: boolean) => void
  setCinematicWorldsUiMode: (mode: CinematicWorldsUiMode) => void

  // Manual track sections — stored per stable track ID so edits on Track A
  // never affect Track B.  Key '_legacy' holds sections migrated from the
  // old flat global array whose original track is unknown.
  manualTrackSectionsByTrackId: Record<string, ReactTrackSection[]>
  /** @deprecated Use selectedSectionByTrackId for per-track scoping. */
  selectedSectionId: string | null
  /** Per-track section selection. Key = trackId, value = selected section ID or null. */
  selectedSectionByTrackId: Record<string, string | null>
  /** Per-track suppressed auto section IDs. Suppressed sections are hidden from the timeline. */
  suppressedAutoSectionsByTrackId: Record<string, string[]>

  // React preset automation cues — stored per stable track ID.
  // `presetId` is the authoritative assignment; no Engine ID is stored here.
  presetAutomationCuesByTrackId: Record<string, ReactPresetAutomationCue[]>

  // Engine-scoped PixGrid action cues. Preset changes remain in presetAutomationCuesByTrackId.
  pixGridActionCuesByTrackId: Record<string, PixGridActionCue[]>

  // Global performance controls
  reactIntensity:       number
  reactMotion:          number
  reactGlow:            number
  reactBassReactivity:  number
  reactTrailDecay:      number
  reactFogDensity:      number
  reactParticleDensity: number
  /** Transient and intentionally excluded from persisted state. */
  performancePadTransition: ReactPerformancePadTransition | null

  // Actions
  /**
   * Compatibility setter. Selecting a real preset applies it through the same
   * invariant-preserving path as selectReactPreset. Null is valid only for the
   * standalone Shader engine; preset-backed engines fall back to a compatible
   * preset instead of entering an invalid state.
   */
  setActiveReactPresetId: (id: string | null) => void
  /**
   * Compatibility setter. Delegates to selectReactEngine so engine and preset
   * selection cannot drift apart in memory or in the persisted snapshot.
   */
  setActiveReactEngineId: (id: ReactEngineId) => void
  /**
   * High-level engine selector for UI use.  Finds a compatible preset for the given engine,
   * applies its params/oscillatorSettings, and keeps activeReactEngineId and
   * activeReactPresetId in sync.  Use this wherever the ENGINE tab or any other UI switches
   * the active engine family.
   */
  selectReactEngine: (id: ReactEngineId) => void
  selectReactPreset: (id: string) => void
  updateReactPresetParams: (id: string, patch: Partial<ReactPresetParams>) => void

  setReactIntensity:       (v: number) => void
  setReactMotion:          (v: number) => void
  setReactGlow:            (v: number) => void
  setReactBassReactivity:  (v: number) => void
  setReactTrailDecay:      (v: number) => void
  setReactFogDensity:      (v: number) => void
  setReactParticleDensity: (v: number) => void

  setSelectedSectionId: (id: string | null) => void
  /** Sets the selected section for a specific track. Pass null sectionId to deselect. */
  setSelectedSectionIdForTrack: (trackId: string | null, sectionId: string | null) => void
  /**
   * Adds the given auto section ID to the per-track suppression list so it is
   * filtered from the resolved timeline.  Also clears selection if the suppressed
   * section was the currently-selected one for this track.
   */
  suppressAutoSection: (trackId: string, sectionId: string) => void
  /**
   * Removes a user-edited-auto override AND any suppression for the given section,
   * restoring it to its original analyzed state in the resolved timeline.
   */
  restoreAutoSection: (trackId: string, sectionId: string) => void
  /** Returns the manual sections for a specific track (empty array if none). */
  getManualSectionsForTrack: (trackId: string) => ReactTrackSection[]
  addManualSection: (trackId: string, section: ReactTrackSection) => void
  updateManualSection: (trackId: string, id: string, patch: Partial<ReactTrackSection>) => void
  removeManualSection: (trackId: string, id: string) => void
  clearManualSectionsForTrack: (trackId: string) => void

  /** Returns cues for a track sorted ascending by timeSec. Empty array if none. */
  getPresetAutomationCuesForTrack: (trackId: string) => ReactPresetAutomationCue[]
  /** Adds a cue. No-op if a cue with the same id already exists. Clamps negative timeSec to 0. */
  addPresetAutomationCue: (trackId: string, cue: ReactPresetAutomationCue) => void
  /** Applies a partial patch to a cue. Clamps timeSec to 0 if the patched value is negative. */
  updatePresetAutomationCue: (trackId: string, id: string, patch: Partial<ReactPresetAutomationCue>) => void
  /** Removes a single cue by id. */
  removePresetAutomationCue: (trackId: string, id: string) => void
  /** Removes all cues for the given track. */
  clearPresetAutomationCuesForTrack: (trackId: string) => void

  /** Returns normalized PixGrid action cues in deterministic execution order. */
  getPixGridActionCuesForTrack: (trackId: string) => PixGridActionCue[]
  addPixGridActionCue: (trackId: string, cue: PixGridActionCue) => void
  updatePixGridActionCue: (trackId: string, id: string, patch: Partial<PixGridActionCue>) => void
  duplicatePixGridActionCue: (trackId: string, id: string) => string | null
  removePixGridActionCue: (trackId: string, id: string) => void
  clearPixGridActionCuesForTrack: (trackId: string) => void

  /**
   * Commits a boundary drag edit for an automatically analyzed section.
   * If a `user-edited-auto` override for this section already exists in the
   * manual store, updates it in place.  Otherwise creates a new override
   * entry that `resolveTrackSections` will use to replace the original auto
   * section.  All existing metadata (label, type, intensity, confidence, etc.)
   * is preserved — only the fields in `patch` change.
   */
  commitAutomaticSectionOverride: (
    trackId:         string,
    originalSection: ReactTrackSection,
    patch:           Partial<ReactTrackSection>,
  ) => void

  // Performance pads
  performancePads: ReactPerformancePad[]
  activePadId: string | null
  setActivePadId: (id: string | null) => void
  updatePerformancePad: (id: string, patch: Partial<ReactPerformancePad>) => void

  // Oscillator settings
  oscillatorSettings: OscillatorSettings
  soundDrawingPerformanceSettings: SoundDrawingPerformanceSettings
  setSoundDrawingPerformanceSettings: (patch: Partial<SoundDrawingPerformanceSettings>) => void
  setSoundDrawingPerformanceLock: (key: SoundDrawingPerformanceLockKey, value: boolean) => void
  resetSoundDrawingPerformanceSettings: () => void
  /** Transient revision used to clear the Sound Drawing trail canvas after semantic source changes. */
  soundDrawingTrailResetRevision: number
  requestSoundDrawingTrailReset: () => void
  setOscillatorSettings: (patch: Partial<OscillatorSettings>) => void
  resetOscillatorSettings: () => void

  // Transient notice shown when the active SVG glyph's source media was deleted.
  // Stores the deleted glyph's display name so the UI can show "X was removed".
  glyphLostNotice: string | null
  clearGlyphLostNotice: () => void

  // Uploaded SVG glyph assets (persisted)
  oscillatorGlyphAssets: OscillatorGlyphAsset[]
  addOscillatorGlyphAsset: (asset: OscillatorGlyphAsset) => void
  removeOscillatorGlyphAsset: (id: string) => void
  clearOscillatorGlyphAssets: () => void
  selectOscillatorGlyph: (id: string) => void
  // Media-backed glyph selection: fetches SVG from a media item, caches as a glyph asset,
  // and selects it.  ID is stable: "glyph-media:<mediaId>".
  selectSvgMediaGlyph: (mediaId: string) => Promise<void>
  // Pre-caches a media-backed SVG glyph asset without selecting it (called after upload).
  addAndCacheMediaSvgGlyph: (mediaId: string, rawSvg: string, displayName?: string) => void

  // Pre-parsed glyph points — non-persisted, keyed by "${assetId}:${resolution}"
  oscillatorGlyphPointCache: Record<string, OscillatorGlyphPoint[]>

  // Legacy compatibility selectors. They convert directly to the unified
  // source model instead of activating svgGlyph/svgVisual runtime states.
  selectSvgVisual: (mediaId: string) => Promise<void>
  clearSvgVisualForMedia: (mediaId: string) => void

  // Unified SVG lifecycle. Rehydration only prepares caches and never changes
  // sourceType, selectedSvgId, or svgRenderMode.
  rehydrateSvgAsset: (mediaId: string) => Promise<void>
  selectSvgAsset: (mediaId: string) => Promise<void>

  // Uploaded font assets (persisted — metadata only, binary lives in cloud storage)
  oscillatorFontAssets: OscillatorFontAsset[]
  addOscillatorFontAsset: (asset: OscillatorFontAsset) => void
  removeOscillatorFontAsset: (id: string) => Promise<void>
  fontRemovePending: string | null
  fontRemoveError: string | null
  clearOscillatorFontAssets: () => void
  selectOscillatorFont: (id: string | null) => Promise<void>
  fontSelectPending: string | null
  fontSelectError: string | null
  uploadOscillatorFont: (file: File) => Promise<void>
  fontUploadPending: boolean
  fontUploadError: string | null
  loadOscillatorFonts: () => Promise<void>
  fontsLoadState: 'idle' | 'loading' | 'loaded' | 'error'
  fontLoadError: string | null

  // Pre-sampled OpenType text points — non-persisted
  // keyed by "${fontId}:${text}:${letterSpacing}:${lineHeight}:${alignment}:${resolution}"
  oscillatorTextPointCache: Record<string, OscillatorGlyphPoint[]>

  /** Resets only the active engine's live render settings. Authored project content is preserved. */
  resetCurrentEngineSettings: () => void
  /** Resets React-view navigation/editor preferences without deleting authored project content. */
  resetReactViewPreferences: () => void
  /** Clears authored React project content. UI callers must require explicit confirmation. */
  clearReactProjectContent: () => void
  /** @deprecated Compatibility shim for tests and older callers. Not exposed in the React UI. */
  resetReactView: () => void

  // Generic visual performance actions (transient; excluded from persistence)
  performanceActionEvent: ReactPerformanceActionEvent | null
  performanceActionEvents: ReactPerformanceActionEvent[]
  performanceActionSeq: number
  performanceActionToggleStates: Record<string, boolean>
  triggerPerformanceAction: (actionId: string, toggleState?: boolean) => void
  clearPerformanceActions: () => void

  // LaserDMX compatibility settings retained for old projects and Show Director cues
  laserDmxSettings: LaserDmxSettings
  setLaserDmxSettings: (partial: Partial<LaserDmxSettings>) => void
  resetLaserDmxSettings: () => void
  selectLaserFixture: (fixtureId: string) => void
  addLaserFixture: (profileId?: LaserDmxProfileId) => void
  duplicateLaserFixture: (fixtureId: string) => void
  removeLaserFixture: (fixtureId: string) => void
  updateLaserFixture: (fixtureId: string, patch: Partial<LaserDmxFixture>) => void
  addLaserModulationRoute: (fixtureId: string) => void
  updateLaserModulationRoute: (fixtureId: string, routeId: string, patch: Partial<LaserDmxModulationRoute>) => void
  removeLaserModulationRoute: (fixtureId: string, routeId: string) => void
  applyLaserDmxVenueTemplate: (templateId: string) => void
  triggerLaserAtmosphericFixture: (fixtureId: string) => void
  clearLaserAtmosphericBursts: () => void
  triggerLaserAtmosphericGroup: (groupId: string) => void
  createLaserDmxProductionLook: (name?: string) => string
  duplicateLaserDmxProductionLook: (lookId: string) => string | null
  updateLaserDmxProductionLook: (lookId: string, patch: Partial<ProductionLook>) => void
  updateLaserDmxProductionLookFromCurrent: (lookId: string) => void
  reorderLaserDmxProductionLook: (lookId: string, direction: -1 | 1) => void
  deleteLaserDmxProductionLook: (lookId: string) => void
  activateLaserDmxProductionLook: (lookId: string, transition?: Partial<ProductionLookTransitionSettings>) => void
  setLaserDmxBlackout: (enabled: boolean) => void

  // Generalized Show Director cue stack. Selection and Fire requests are transient.
  selectedLaserDmxProductionCueId: string | null
  selectLaserDmxProductionCue: (cueId: string | null) => void
  addLaserDmxProductionCue: () => string
  duplicateLaserDmxProductionCue: (cueId: string) => string | null
  updateLaserDmxProductionCue: (cueId: string, patch: Partial<ProductionCompoundCue>) => void
  reorderLaserDmxProductionCue: (cueId: string, direction: -1 | 1) => void
  deleteLaserDmxProductionCue: (cueId: string) => void
  fireLaserDmxProductionCue: (cueId?: string) => void

  // LaserDMX workspace mode (persisted, never changed by preset application)
  laserDmxWorkspaceMode: LaserDmxWorkspaceMode
  setLaserDmxWorkspaceMode: (mode: LaserDmxWorkspaceMode) => void
  laserDmxBeamMatrixAuthoringMode: LaserDmxBeamMatrixAuthoringMode
  setLaserDmxBeamMatrixAuthoringMode: (mode: LaserDmxBeamMatrixAuthoringMode) => void

  // LaserDMX Beam Matrix (persisted, never changed by preset application)
  laserDmxBeamMatrix: LaserDmxBeamMatrixSettings
  setLaserDmxBeamMatrixSettings: (partial: Partial<LaserDmxBeamMatrixSettings>) => void
  resetLaserDmxBeamMatrix: () => void

  // Beam Matrix preset tracking
  activeLaserDmxBeamMatrixPresetId: string | null
  /** True when the matrix has been structurally edited since the last preset load. */
  laserDmxBeamMatrixPresetDirty: boolean
  applyLaserDmxBeamMatrixPreset: (presetId: string) => void
  clearActiveLaserDmxBeamMatrixPreset: () => void

  addLaserDmxMatrixBeam: (initial?: Partial<LaserDmxMatrixBeam>) => void
  duplicateLaserDmxMatrixBeam: (beamId: string) => void
  removeLaserDmxMatrixBeam: (beamId: string) => void
  removeSelectedLaserDmxMatrixBeams: () => void
  updateLaserDmxMatrixBeam: (beamId: string, patch: Partial<LaserDmxMatrixBeam>) => void
  selectLaserDmxMatrixBeam: (beamId: string, additive?: boolean) => void
  setSelectedLaserDmxMatrixBeams: (ids: string[]) => void
  clearLaserDmxMatrixSelection: () => void

  addLaserDmxReactionGroup: () => void
  duplicateLaserDmxReactionGroup: (groupId: string) => void
  removeLaserDmxReactionGroup: (groupId: string) => void
  updateLaserDmxReactionGroup: (groupId: string, patch: Partial<LaserDmxReactionGroup>) => void
  selectLaserDmxReactionGroup: (groupId: string | null) => void

  addLaserDmxMatrixGlobalRoute: () => void
  updateLaserDmxMatrixGlobalRoute: (routeId: string, patch: Partial<LaserDmxModulationRoute>) => void
  removeLaserDmxMatrixGlobalRoute: (routeId: string) => void

  addLaserDmxReactionGroupRoute: (groupId: string) => void
  updateLaserDmxReactionGroupRoute: (groupId: string, routeId: string, patch: Partial<LaserDmxModulationRoute>) => void
  removeLaserDmxReactionGroupRoute: (groupId: string, routeId: string) => void

  addLaserDmxMatrixBeamRoute: (beamId: string) => void
  updateLaserDmxMatrixBeamRoute: (beamId: string, routeId: string, patch: Partial<LaserDmxModulationRoute>) => void
  removeLaserDmxMatrixBeamRoute: (beamId: string, routeId: string) => void

  setLaserDmxReactionGroupMuted: (groupId: string, muted: boolean) => void
  setLaserDmxReactionGroupSoloed: (groupId: string, soloed: boolean) => void
  /** Duplicates beamIds with grid col/row offsets. Returns count actually created (may be < beamIds.length at 300-beam limit). */
  duplicateLaserDmxMatrixBeamsWithOffset: (
    beamIds: string[],
    colOffset: number,
    rowOffset: number,
    opts?: { targetColOffset?: number; targetRowOffset?: number; preserveGroups?: boolean }
  ) => number
  /** Restores the 4 starter reaction groups without deleting user-created beams or custom groups. */
  restoreStarterReactionGroups: () => void
  setLaserDmxBeamMatrixEditorSettings: (patch: Partial<LaserDmxBeamMatrixEditorSettings>) => void

  // Beam Matrix cue list
  addLaserDmxBeamMatrixCue: () => void
  duplicateLaserDmxBeamMatrixCue: (cueId: string) => void
  removeLaserDmxBeamMatrixCue: (cueId: string) => void
  updateLaserDmxBeamMatrixCue: (cueId: string, patch: Partial<LaserDmxBeamMatrixCue>) => void

  // LaserDMX Show Director layout model. Compiles into Beam Matrix when Show Director preview is selected.
  laserDmxShowDirector: LaserDmxShowDirectorState
  /** Performance state is independent from the authored fixture rig. */
  laserDmxShowDirectorPerformance: LaserDmxShowDirectorPerformanceState
  applyLaserDmxShowDirectorPerformanceProgram: (program: LaserDmxShowDirectorPerformanceProgram) => boolean
  applyLaserDmxShowDirectorPerformancePreset: (preset: LaserDmxShowDirectorPerformancePresetDefinition) => boolean
  clearLaserDmxShowDirectorPerformanceProgram: () => void
  setLaserDmxShowDirectorPerformanceEnabled: (enabled: boolean) => void
  updateLaserDmxShowDirectorPerformanceTuning: (patch: Partial<LaserDmxShowDirectorPerformanceProgramTuning>) => void
  setLaserDmxShowDirectorPerformanceAudioIntelligenceEnabled: (enabled: boolean) => void
  setLaserDmxShowDirectorPerformanceFallbackBehavior: (fallback: LaserDmxShowDirectorPerformanceFallbackBehavior) => void
  setLaserDmxShowDirectorPerformanceSeed: (seed: number) => void
  laserDmxShowDirectorUndoStack: LaserDmxShowDirectorState[]
  laserDmxShowDirectorRedoStack: LaserDmxShowDirectorState[]
  laserDmxShowDirectorHistoryTransaction: LaserDmxShowDirectorState | null
  addLaserDmxShowDirectorFixture: (kind: LaserDmxShowDirectorFixtureKind, initial?: LaserDmxShowDirectorFixturePatch) => string
  updateLaserDmxShowDirectorFixture: (fixtureId: string, patch: LaserDmxShowDirectorFixturePatch) => void
  deleteLaserDmxShowDirectorFixture: (fixtureId: string) => void
  duplicateLaserDmxShowDirectorFixture: (fixtureId: string) => string | null
  duplicateLaserDmxShowDirectorLayout: () => void
  mirrorLaserDmxShowDirectorFixture: (fixtureId: string, axis: LaserDmxShowDirectorMirrorAxis) => void
  mirrorLaserDmxShowDirectorLayout: (axis: LaserDmxShowDirectorMirrorAxis) => void
  createLinkedLaserDmxShowDirectorMirrorPair: (fixtureId: string, axis?: LaserDmxShowDirectorMirrorAxis) => string | null
  unlinkLaserDmxShowDirectorMirrorPair: (fixtureId: string) => void
  undoLaserDmxShowDirectorEdit: () => void
  redoLaserDmxShowDirectorEdit: () => void
  beginLaserDmxShowDirectorHistoryTransaction: () => void
  commitLaserDmxShowDirectorHistoryTransaction: () => void
  clearLaserDmxShowDirectorHistory: () => void
  selectLaserDmxShowDirectorFixture: (fixtureId: string | null) => void
  toggleLaserDmxShowDirectorFixtureSelection: (fixtureId: string) => void
  selectLaserDmxShowDirectorFixtures: (fixtureIds: string[], primaryFixtureId?: string | null) => void
  clearLaserDmxShowDirectorSelection: () => void
  deleteSelectedLaserDmxShowDirectorFixtures: () => void
  moveSelectedLaserDmxShowDirectorFixtures: (deltaX: number, deltaY: number) => void
  duplicateSelectedLaserDmxShowDirectorFixtures: () => string[]
  groupSelectedLaserDmxShowDirectorFixtures: (label?: string) => string | null
  ungroupSelectedLaserDmxShowDirectorFixtures: () => void
  selectLaserDmxShowDirectorGroup: (groupId: string) => void
  renameLaserDmxShowDirectorGroup: (groupId: string, label: string) => void
  duplicateLaserDmxShowDirectorGroup: (groupId: string) => string[]
  ungroupLaserDmxShowDirectorGroup: (groupId: string) => void
  clearLaserDmxShowDirectorFixtures: () => void
  resetLaserDmxShowDirectorLayout: () => void
  applyLaserDmxShowDirectorTemplate: (templateId: string) => boolean
  updateLaserDmxShowDirectorSettings: (patch: LaserDmxShowDirectorSettingsPatch) => void

  // Sound Drawing layers — stored per track ID.
  // A layer is reusable content (what to draw); clips place it on a timeline.
  soundDrawingLayersByTrackId: Record<string, SoundDrawingLayer[]>
  /** Returns layers for one track. Empty array when the track has none. */
  getSoundDrawingLayersForTrack: (trackId: string) => SoundDrawingLayer[]
  /** Creates a layer and returns its generated ID. */
  addSoundDrawingLayer: (trackId: string, layer: Omit<SoundDrawingLayer, 'id'>) => string
  updateSoundDrawingLayer: (trackId: string, layerId: string, patch: Partial<SoundDrawingLayer>) => void
  /** Clones an existing layer. The copy gets a new ID and name suffixed with " Copy". */
  duplicateSoundDrawingLayer: (trackId: string, layerId: string) => void
  /** Removes the layer and all clips in this track that reference it. */
  removeSoundDrawingLayer: (trackId: string, layerId: string) => void

  // Sound Drawing clips — stored per track ID.
  // Each clip is owned by its parent map key; timing is finite, nonnegative,
  // ordered, and bounded to the track when a duration is supplied.
  soundDrawingClipsByTrackId: Record<string, SoundDrawingClip[]>
  /** Returns clips for one track sorted by startSec ascending, then zIndex ascending. */
  getSoundDrawingClipsForTrack: (trackId: string) => SoundDrawingClip[]
  /** Creates a clip and returns its generated ID. */
  addSoundDrawingClip: (trackId: string, clip: Omit<SoundDrawingClip, 'id'>, trackDurationSec?: number) => string
  updateSoundDrawingClip: (trackId: string, clipId: string, patch: Partial<SoundDrawingClip>, trackDurationSec?: number) => void
  /** Clones an existing clip with a new ID. */
  duplicateSoundDrawingClip: (trackId: string, clipId: string) => void
  removeSoundDrawingClip: (trackId: string, clipId: string) => void
}

export function resolveActivePerformanceActionTarget(
  state: Pick<ReactStoreState, 'activeReactEngineId' | 'activeReactPresetId' | 'reactPresets' | 'cinematicConfigsByPresetId'>,
): ReactPerformanceActionTarget {
  if (state.activeReactEngineId !== 'cinematicPortal') return { engineId: state.activeReactEngineId }
  const preset = state.activeReactPresetId
    ? state.reactPresets.find(candidate => candidate.id === state.activeReactPresetId)
    : null
  const config = resolveCinematicConfigForPreset(preset, state.cinematicConfigsByPresetId)
  return { engineId: 'cinematicPortal', ...(config ? { worldId: config.worldMode } : {}) }
}

function clearPerformanceActionPatch() {
  return {
    performanceActionEvent: null as ReactPerformanceActionEvent | null,
    performanceActionEvents: [] as ReactPerformanceActionEvent[],
    performanceActionToggleStates: {} as Record<string, boolean>,
  }
}

const MAX_PERFORMANCE_ACTION_EVENTS = 64

function sanitizeLiveTrackSection(section: ReactTrackSection): ReactTrackSection {
  if (section.engineId == null || isSelectableReactEngineId(section.engineId)) return section
  const { engineId: _retiredEngineId, ...safeSection } = section
  return safeSection
}

function isLivePresetId(presets: readonly ReactPreset[], presetId: string): boolean {
  return presets.some(preset => preset.id === presetId && isSelectableReactEngineId(preset.engine))
}

const INITIAL_PRESET_ID = 'preset-singularity-crown'
const INITIAL_ENGINE_ID: ReactEngineId = 'cinematicPortal'

// Module-level invariant: verify the explicit startup preset exists and is consistent.
// Catches future preset reorders or deletions that would silently break startup.
;(() => {
  const _startupPreset = DEFAULT_REACT_PRESETS.find(p => p.id === INITIAL_PRESET_ID)
  if (!_startupPreset) {
    throw new Error(
      `[DRMVYZ] reactStore: startup preset "${INITIAL_PRESET_ID}" not found in DEFAULT_REACT_PRESETS. ` +
      'Update INITIAL_PRESET_ID and INITIAL_ENGINE_ID to point at an existing preset.'
    )
  }
  if (_startupPreset.engine !== INITIAL_ENGINE_ID) {
    throw new Error(
      `[DRMVYZ] reactStore: startup preset "${INITIAL_PRESET_ID}" has engine "${_startupPreset.engine}" ` +
      `but INITIAL_ENGINE_ID is "${INITIAL_ENGINE_ID}". They must match.`
    )
  }
})()

const LEGACY_SHADER_PRESET_IDS = new Set([
  'preset-neon-energy-cloud',
  'preset-lava-tunnel',
  'preset-synth-sun',
  'preset-dot-warp',
  'preset-festival-burst',
])

const RETIRED_REACT_PRESET_REPLACEMENTS = new Map<string, string>([
  // Retired Legacy Portal and audited Cinematic Worlds presets fall back to the
  // first live Cinematic World without keeping their removed definitions alive.
  ['preset-dream-gate', INITIAL_PRESET_ID],
  ['preset-crimson-rift', INITIAL_PRESET_ID],
  ['preset-emerald-fog', INITIAL_PRESET_ID],
  ['preset-portal-overload', INITIAL_PRESET_ID],
  ['preset-quiet-ruins', INITIAL_PRESET_ID],
  ['preset-titan-seal', INITIAL_PRESET_ID],
  ['preset-sunken-oracle', INITIAL_PRESET_ID],
  ['preset-ascension-array', INITIAL_PRESET_ID],
  ['preset-placid-veil', INITIAL_PRESET_ID],
  ['preset-bass-breach', INITIAL_PRESET_ID],
  ['preset-prismatic-amnion', INITIAL_PRESET_ID],
  ['preset-starlit-basilica', INITIAL_PRESET_ID],
  ['preset-solar-nave', INITIAL_PRESET_ID],
  ['preset-void-choir', INITIAL_PRESET_ID],
  ['preset-rgb-plane-shift', 'preset-red-club-crossfire'],
  ['preset-ceiling-lattice-overload', 'preset-red-club-crossfire'],
  ['preset-magenta-cyan-festival-fan', 'preset-red-club-crossfire'],
  ['preset-blinder-cryo-drop', 'preset-red-club-crossfire'],
  ['preset-white-fog-cathedral', 'preset-red-club-crossfire'],
])

const RETIRED_REACT_PRESET_IDS = new Set(RETIRED_REACT_PRESET_REPLACEMENTS.keys())

/** Historical persisted identifier only. It must never be used as a new catalog entry. */
export const RETIRED_NEON_LATTICE_ENGINE_ID = 'neonLattice'

/**
 * Frozen historical IDs are kept here rather than derived from the live preset
 * catalog so later removal patches can still recognize old project snapshots.
 */
export const RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS = new Set<string>([
  'preset-nl-acid-magenta',
  'preset-nl-drmvyz-lattice',
  'preset-nl-sparse-starlines',
  'preset-nl-overload-matrix',
  'preset-nl-reverie-keygrid',
])

const RETIRED_NEON_ACTION_PREFIX = `${RETIRED_NEON_LATTICE_ENGINE_ID}.`
const RETIRED_NEON_ACTION_PREFIX_NORMALIZED = normalizeRetiredNeonIdentifier(RETIRED_NEON_ACTION_PREFIX)
const RETIRED_NL_TRIGGER_PREFIX_NORMALIZED = 'nltrigger'
const RETIRED_TRIGGER_NEON_LATTICE_KEY_NORMALIZED = 'triggerneonlattice'
const RETIRED_NEON_ACTION_FIELDS = [
  'action',
  'actionId',
  'performanceAction',
  'performanceActionId',
  'visualAction',
  'visualActionId',
] as const

function normalizeRetiredNeonIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isRetiredNeonIdentifier(value: string): boolean {
  return normalizeRetiredNeonIdentifier(value) === normalizeRetiredNeonIdentifier(RETIRED_NEON_LATTICE_ENGINE_ID)
}

function isRetiredNeonFieldKey(key: string): boolean {
  const normalized = normalizeRetiredNeonIdentifier(key)
  return normalized.includes(normalizeRetiredNeonIdentifier(RETIRED_NEON_LATTICE_ENGINE_ID))
    || normalized === RETIRED_TRIGGER_NEON_LATTICE_KEY_NORMALIZED
    || normalized.startsWith(RETIRED_NL_TRIGGER_PREFIX_NORMALIZED)
}

function isRetiredNeonEngine(value: unknown): boolean {
  return typeof value === 'string' && isRetiredNeonIdentifier(value)
}

function isRetiredNeonActionString(value: string): boolean {
  const normalized = normalizeRetiredNeonIdentifier(value)
  return value.startsWith(RETIRED_NEON_ACTION_PREFIX)
    || normalized.startsWith(RETIRED_NEON_ACTION_PREFIX_NORMALIZED)
    || normalized === RETIRED_TRIGGER_NEON_LATTICE_KEY_NORMALIZED
    || normalized.startsWith(RETIRED_NL_TRIGGER_PREFIX_NORMALIZED)
}

function isRetiredNeonActionValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return isRetiredNeonActionString(value)
  }
  if (!isRecord(value)) return false
  if (isRetiredNeonEngine(value.engine) || isRetiredNeonEngine(value.engineId)) return true
  if (isRecord(value.target) && isRetiredNeonEngine(value.target.engineId)) return true
  return RETIRED_NEON_ACTION_FIELDS.some(field => isRetiredNeonActionValue(value[field]))
}

function referencesRetiredNeonAction(value: Record<string, unknown>): boolean {
  if (isRetiredNeonEngine(value.engine) || isRetiredNeonEngine(value.engineId)) return true
  if (isRecord(value.target) && isRetiredNeonEngine(value.target.engineId)) return true
  return RETIRED_NEON_ACTION_FIELDS.some(field => isRetiredNeonActionValue(value[field]))
}

function collectRetiredNeonPresetIds(value: unknown): Set<string> {
  const retired = new Set(RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS)
  if (!Array.isArray(value)) return retired
  for (const rawPreset of value) {
    if (!isRecord(rawPreset)) continue
    const presetId = typeof rawPreset.id === 'string' ? rawPreset.id : null
    if (presetId && (
      RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS.has(presetId)
      || isRetiredNeonEngine(rawPreset.engine)
      || isRetiredNeonEngine(rawPreset.engineId)
    )) {
      retired.add(presetId)
    }
  }
  return retired
}

function stripRetiredNeonFields<T extends Record<string, unknown>>(value: T): T {
  let next: Record<string, unknown> | null = null
  for (const key of Object.keys(value)) {
    if (!isRetiredNeonFieldKey(key)) continue
    next ??= { ...value }
    delete next[key]
  }
  return (next ?? value) as T
}

function sanitizeRetiredNeonPresetCollection(
  value: unknown,
  retiredPresetIds: ReadonlySet<string>,
): unknown {
  if (!Array.isArray(value)) return value
  return value.flatMap((rawPreset) => {
    if (!isRecord(rawPreset)) return [rawPreset]
    const presetId = typeof rawPreset.id === 'string' ? rawPreset.id : null
    if (
      (presetId != null && retiredPresetIds.has(presetId))
      || isRetiredNeonEngine(rawPreset.engine)
      || isRetiredNeonEngine(rawPreset.engineId)
    ) return []

    let preset = stripRetiredNeonFields(rawPreset)
    if (Array.isArray(preset.scenes)) {
      const removedSceneIds = new Set<string>()
      const scenes = preset.scenes.filter((scene) => {
        if (!isRecord(scene)) return true
        const remove = isRetiredNeonEngine(scene.engine) || isRetiredNeonEngine(scene.engineId)
        if (remove && typeof scene.id === 'string') removedSceneIds.add(scene.id)
        return !remove
      })
      if (scenes.length !== preset.scenes.length) {
        preset = { ...preset, scenes }
        if (Array.isArray(preset.sectionMappings) && removedSceneIds.size > 0) {
          preset.sectionMappings = preset.sectionMappings.filter(mapping => (
            !isRecord(mapping)
            || typeof mapping.sceneId !== 'string'
            || !removedSceneIds.has(mapping.sceneId)
          ))
        }
      }
    }
    return [preset]
  })
}

function sanitizeRetiredNeonPads(
  value: unknown,
  retiredPresetIds: ReadonlySet<string>,
): unknown {
  if (!Array.isArray(value)) return value
  return value.map((rawPad) => {
    if (!isRecord(rawPad)) return rawPad
    let next: Record<string, unknown> | null = null
    if (typeof rawPad.presetId === 'string' && retiredPresetIds.has(rawPad.presetId)) {
      next = { ...rawPad, presetId: null }
    }
    for (const field of RETIRED_NEON_ACTION_FIELDS) {
      if (!isRetiredNeonActionValue(rawPad[field])) continue
      next ??= { ...rawPad }
      next[field] = null
    }
    return next ?? rawPad
  })
}

function sanitizeRetiredNeonAutomation(
  value: unknown,
  retiredPresetIds: ReadonlySet<string>,
): unknown {
  if (!isRecord(value)) return value
  const next: Record<string, unknown> = {}
  for (const [trackId, rawCues] of Object.entries(value)) {
    if (!Array.isArray(rawCues)) {
      next[trackId] = rawCues
      continue
    }
    next[trackId] = rawCues.filter((cue) => {
      if (!isRecord(cue)) return true
      if (typeof cue.presetId === 'string' && retiredPresetIds.has(cue.presetId)) return false
      return !referencesRetiredNeonAction(cue)
    })
  }
  return next
}

function sanitizeRetiredNeonTrackSections(value: unknown): unknown {
  const sanitizeSection = (section: unknown): unknown => {
    if (!isRecord(section)) return section
    if (!isRetiredNeonEngine(section.engineId) && !isRetiredNeonEngine(section.engine)) return section
    const next = { ...section }
    if (isRetiredNeonEngine(next.engineId)) delete next.engineId
    if (isRetiredNeonEngine(next.engine)) delete next.engine
    return next
  }
  if (Array.isArray(value)) return value.map(sanitizeSection)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([trackId, sections]) => [
    trackId,
    Array.isArray(sections) ? sections.map(sanitizeSection) : sections,
  ]))
}

function removeRetiredPresetRecordEntries(
  value: unknown,
  retiredPresetIds: ReadonlySet<string>,
): unknown {
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([presetId]) => !retiredPresetIds.has(presetId)))
}

function sanitizeRetiredNeonPerformanceRuntime(state: Record<string, unknown>): Record<string, unknown> {
  let next = stripRetiredNeonFields(state)
  if (isRecord(next.performanceActionEvent) && referencesRetiredNeonAction(next.performanceActionEvent)) {
    next = { ...next, performanceActionEvent: null }
  }
  if (Array.isArray(next.performanceActionEvents)) {
    next = {
      ...next,
      performanceActionEvents: next.performanceActionEvents.filter(event => (
        !isRecord(event) || !referencesRetiredNeonAction(event)
      )),
    }
  }
  if (isRecord(next.performanceActionToggleStates)) {
    next = {
      ...next,
      performanceActionToggleStates: Object.fromEntries(
        Object.entries(next.performanceActionToggleStates)
          .filter(([actionId]) => !isRetiredNeonActionValue(actionId)),
      ),
    }
  }
  return next
}

/**
 * Removes historical Neon Lattice references from persisted or imported React
 * state. This intentionally does not mutate the live engine catalog or runtime
 * fields; the tombstone only prevents retired data from surviving persistence or imports.
 */
export function sanitizeRetiredNeonLatticeReactState(persistedState: unknown): Record<string, unknown> {
  const rawState = isRecord(persistedState) ? persistedState : {}
  const retiredPresetIds = collectRetiredNeonPresetIds(rawState.reactPresets)
  const sanitizedPresets = sanitizeRetiredNeonPresetCollection(rawState.reactPresets, retiredPresetIds)
  let state = sanitizeRetiredNeonPerformanceRuntime({
    ...rawState,
    ...(Array.isArray(rawState.reactPresets) ? { reactPresets: sanitizedPresets } : {}),
    ...(rawState.performancePads !== undefined
      ? { performancePads: sanitizeRetiredNeonPads(rawState.performancePads, retiredPresetIds) }
      : {}),
    ...(rawState.presetAutomationCuesByTrackId !== undefined
      ? { presetAutomationCuesByTrackId: sanitizeRetiredNeonAutomation(rawState.presetAutomationCuesByTrackId, retiredPresetIds) }
      : {}),
    ...(rawState.manualTrackSectionsByTrackId !== undefined
      ? { manualTrackSectionsByTrackId: sanitizeRetiredNeonTrackSections(rawState.manualTrackSectionsByTrackId) }
      : {}),
    ...(rawState.manualTrackSections !== undefined
      ? { manualTrackSections: sanitizeRetiredNeonTrackSections(rawState.manualTrackSections) }
      : {}),
    ...(rawState.cinematicConfigsByPresetId !== undefined
      ? { cinematicConfigsByPresetId: removeRetiredPresetRecordEntries(rawState.cinematicConfigsByPresetId, retiredPresetIds) }
      : {}),
    ...(rawState.cinematicSeedLocksByPresetId !== undefined
      ? { cinematicSeedLocksByPresetId: removeRetiredPresetRecordEntries(rawState.cinematicSeedLocksByPresetId, retiredPresetIds) }
      : {}),
  })

  const validPresets = [
    ...DEFAULT_REACT_PRESETS.filter(preset => !RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS.has(preset.id)),
    ...(Array.isArray(sanitizedPresets)
      ? sanitizedPresets.filter((preset): preset is ReactPreset => (
          isRecord(preset)
          && typeof preset.id === 'string'
          && isSelectableReactEngineId(preset.engine)
        ))
      : []),
  ]
  const validPresetById = new Map(validPresets.map(preset => [preset.id, preset]))
  const activePresetId = typeof state.activeReactPresetId === 'string' ? state.activeReactPresetId : null
  const activeEngineId = typeof state.activeReactEngineId === 'string' ? state.activeReactEngineId : null
  const activePreset = activePresetId ? validPresetById.get(activePresetId) ?? null : null
  const activePresetWasRetired = activePresetId != null && retiredPresetIds.has(activePresetId)
  const validStandaloneSelection = (activeEngineId === 'shaderPads' || activeEngineId === 'canvas') && activePresetId == null
  const validPresetSelection = activeEngineId != null
    && activeEngineId !== RETIRED_NEON_LATTICE_ENGINE_ID
    && activePreset != null
    && activePreset.engine === activeEngineId

  const hasPersistedSelection = 'activeReactPresetId' in state || 'activeReactEngineId' in state
  if (hasPersistedSelection && (activePresetWasRetired || (!validStandaloneSelection && !validPresetSelection))) {
    state = {
      ...state,
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
    }
  }
  return state
}

function replaceRetiredReactPresetId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return RETIRED_REACT_PRESET_REPLACEMENTS.get(value) ?? value
}

function removeRetiredReactPresets(presets: ReactPreset[]): ReactPreset[] {
  return presets.filter(preset => !RETIRED_REACT_PRESET_IDS.has(preset.id))
}

function clearRetiredReactPresetPadAssignments(pads: ReactPerformancePad[]): ReactPerformancePad[] {
  return pads.map(pad => pad.presetId && RETIRED_REACT_PRESET_IDS.has(pad.presetId)
    ? { ...pad, presetId: null, label: 'Empty', color: '#3a4650' }
    : pad)
}

function removeRetiredPresetAutomationCues(value: unknown): unknown {
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([trackId, rawCues]) => [
    trackId,
    Array.isArray(rawCues)
      ? rawCues.filter(cue => (
          !isRecord(cue)
          || typeof cue.presetId !== 'string'
          || !RETIRED_REACT_PRESET_IDS.has(cue.presetId)
        ))
      : rawCues,
  ]))
}

/**
 * Removes retired built-in preset definitions and every persisted reference
 * that could otherwise revive them after an upgrade or project import.
 */
export function sanitizeRetiredReactPresetState(persistedState: unknown): Record<string, unknown> {
  const rawState = isRecord(persistedState) ? persistedState : {}
  const activePresetId = typeof rawState.activeReactPresetId === 'string'
    ? rawState.activeReactPresetId
    : null
  const replacementPresetId = replaceRetiredReactPresetId(activePresetId)
  const replacementPreset = replacementPresetId && replacementPresetId !== activePresetId
    ? DEFAULT_REACT_PRESETS.find(preset => preset.id === replacementPresetId) ?? null
    : null

  return {
    ...rawState,
    ...(Array.isArray(rawState.reactPresets)
      ? { reactPresets: removeRetiredReactPresets(rawState.reactPresets as ReactPreset[]) }
      : {}),
    ...(Array.isArray(rawState.performancePads)
      ? { performancePads: clearRetiredReactPresetPadAssignments(rawState.performancePads as ReactPerformancePad[]) }
      : {}),
    ...(rawState.presetAutomationCuesByTrackId !== undefined
      ? { presetAutomationCuesByTrackId: removeRetiredPresetAutomationCues(rawState.presetAutomationCuesByTrackId) }
      : {}),
    ...(rawState.cinematicConfigsByPresetId !== undefined
      ? { cinematicConfigsByPresetId: removeRetiredPresetRecordEntries(rawState.cinematicConfigsByPresetId, RETIRED_REACT_PRESET_IDS) }
      : {}),
    ...(rawState.cinematicSeedLocksByPresetId !== undefined
      ? { cinematicSeedLocksByPresetId: removeRetiredPresetRecordEntries(rawState.cinematicSeedLocksByPresetId, RETIRED_REACT_PRESET_IDS) }
      : {}),
    ...(replacementPreset
      ? {
          activeReactPresetId: replacementPreset.id,
          activeReactEngineId: replacementPreset.engine,
        }
      : {}),
  }
}

function replaceLockedLaserDmxPresetId(value: unknown): string | null {
  const presetId = replaceRetiredReactPresetId(value)
  if (presetId == null) return null
  return RETIRED_LASER_DMX_PRESET_IDS.has(presetId)
    ? LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID
    : presetId
}

function normalizeLockedLaserDmxPadAssignments(pads: ReactPerformancePad[]): ReactPerformancePad[] {
  return pads.map(pad => pad.presetId && RETIRED_LASER_DMX_PRESET_IDS.has(pad.presetId)
    ? { ...pad, presetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID, label: 'Beam Matrix', color: '#00ffdc' }
    : pad)
}

const VALID_REACT_ENGINE_IDS = new Set<ReactEngineId>(REACT_ENGINE_IDS)

const STANDALONE_REACT_ENGINE_IDS = new Set<ReactEngineId>(['shaderPads', 'canvas'])

function isStandaloneReactEngineId(engineId: ReactEngineId): boolean {
  return STANDALONE_REACT_ENGINE_IDS.has(engineId)
}

function finiteCanvasNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampCanvasNumber(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteCanvasNumber(value, fallback)))
}

function normalizeCanvasFitMode(value: unknown): CanvasFitMode {
  return value === 'cover' || value === 'stretch' || value === 'contain'
    ? value
    : DEFAULT_CANVAS_ENGINE_SETTINGS.fitMode
}

const CANVAS_TRIGGER_ON_VALUES = new Set<CanvasTriggerOn>([
  'manualOnly',
  'trackStart',
  'sectionChange',
  'drop',
  'every8Bars',
  'every16Bars',
])

const CANVAS_SECTION_TRIGGER_VALUES = new Set<CanvasSectionTriggerType>([
  'intro',
  'build',
  'drop',
  'breakdown',
  'outro',
])

function normalizeCanvasTriggerOn(value: unknown): CanvasTriggerOn {
  return typeof value === 'string' && CANVAS_TRIGGER_ON_VALUES.has(value as CanvasTriggerOn)
    ? value as CanvasTriggerOn
    : DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.triggerOn
}

function normalizeCanvasSectionTriggerTypes(value: unknown): CanvasSectionTriggerType[] {
  const source = Array.isArray(value) ? value : DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.sectionTriggerTypes
  const normalized = source.filter((section): section is CanvasSectionTriggerType => (
    typeof section === 'string' && CANVAS_SECTION_TRIGGER_VALUES.has(section as CanvasSectionTriggerType)
  ))
  return normalized.length > 0
    ? [...new Set(normalized)]
    : [...DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.sectionTriggerTypes]
}

function normalizeCanvasVideoTimingSettings(value: unknown): CanvasVideoTimingSettings {
  if (!isRecord(value)) return { ...DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS }

  const clipStartSec = clampCanvasNumber(
    value.clipStartSec,
    DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.clipStartSec,
    0,
    60 * 60 * 6,
  )
  const rawClipEndSec = clampCanvasNumber(
    value.clipEndSec,
    DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS.clipEndSec,
    0,
    60 * 60 * 6,
  )
  const clipEndSec = rawClipEndSec > 0 && rawClipEndSec <= clipStartSec
    ? Math.min(60 * 60 * 6, clipStartSec + 0.1)
    : rawClipEndSec

  return {
    clipStartSec,
    clipEndSec,
    loopClipRange: value.loopClipRange === true,
    restartOnDrop: value.restartOnDrop === true,
    restartOnSectionChange: value.restartOnSectionChange === true,
    restartOnManualPresetChange: value.restartOnManualPresetChange === true,
    triggerOn: normalizeCanvasTriggerOn(value.triggerOn),
    sectionTriggerTypes: normalizeCanvasSectionTriggerTypes(value.sectionTriggerTypes),
  }
}

function normalizeCanvasMediaTimingById(value: unknown): Record<string, CanvasVideoTimingSettings> {
  if (!isRecord(value)) return {}
  const normalized: Record<string, CanvasVideoTimingSettings> = {}
  Object.entries(value).forEach(([id, timing]) => {
    if (typeof id === 'string' && id.trim().length > 0) {
      normalized[id] = normalizeCanvasVideoTimingSettings(timing)
    }
  })
  return normalized
}

function uniqueCanvasMediaIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  ids.forEach(id => {
    if (typeof id !== 'string') return
    const trimmed = id.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    normalized.push(trimmed)
  })
  return normalized
}

function revokeCanvasMediaObjectUrl(item: CanvasMediaItem): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return
  if (!item.objectUrl || !item.objectUrl.startsWith('blob:')) return
  URL.revokeObjectURL(item.objectUrl)
}

function revokeCanvasMediaObjectUrls(items: CanvasMediaItem[]): void {
  items.forEach(revokeCanvasMediaObjectUrl)
}

function isCanvasMediaItemRuntimeUsable(item: CanvasMediaItem): boolean {
  return (
    typeof item.id === 'string' && item.id.trim().length > 0 &&
    typeof item.name === 'string' && item.name.trim().length > 0 &&
    (item.type === 'video' || item.type === 'image' || item.type === 'svg') &&
    typeof item.objectUrl === 'string' && item.objectUrl.trim().length > 0
  )
}

function repairCanvasRuntimeState(state: ReactStoreState): Partial<ReactStoreState> {
  const unusableCanvasMediaItems = state.canvasMediaItems.filter(item => !isCanvasMediaItemRuntimeUsable(item))
  if (unusableCanvasMediaItems.length > 0) {
    revokeCanvasMediaObjectUrls(unusableCanvasMediaItems)
  }

  const canvasMediaItems = state.canvasMediaItems.filter(isCanvasMediaItemRuntimeUsable)
  const legacyIds = canvasMediaItems.map(item => item.id)
  const selectedCanvasMediaId = state.selectedCanvasMediaId
    ?? state.canvasEngineSettings.selectedMediaId
    ?? state.activeCanvasMediaId
    ?? canvasMediaItems[0]?.id
    ?? null
  const activeCanvasMediaId = state.activeCanvasMediaId ?? selectedCanvasMediaId
  const mediaIds = uniqueCanvasMediaIds([
    ...state.canvasEngineSettings.mediaIds,
    ...legacyIds,
    selectedCanvasMediaId,
    activeCanvasMediaId,
    state.canvasEngineSettings.manualMediaOverrideId,
  ])

  return {
    canvasMediaItems,
    canvasMediaTimingById: normalizeCanvasMediaTimingById(state.canvasMediaTimingById),
    selectedCanvasMediaId,
    activeCanvasMediaId,
    canvasEngineSettings: normalizeCanvasEngineSettings({
      ...state.canvasEngineSettings,
      selectedMediaId: activeCanvasMediaId,
      mediaIds,
    }),
  }
}

function normalizeCanvasEngineSettings(value: unknown): CanvasEngineSettings {
  if (!isRecord(value)) return { ...DEFAULT_CANVAS_ENGINE_SETTINGS }

  const rawMediaIds = Array.isArray(value.mediaIds)
    ? value.mediaIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  const selectedMediaId = typeof value.selectedMediaId === 'string' && value.selectedMediaId.trim().length > 0
    ? value.selectedMediaId
    : null
  const manualMediaOverrideId = typeof value.manualMediaOverrideId === 'string' && value.manualMediaOverrideId.trim().length > 0
    ? value.manualMediaOverrideId
    : null
  const mediaIds = uniqueCanvasMediaIds([...rawMediaIds, selectedMediaId, manualMediaOverrideId])
  const supportedMediaKinds = Array.isArray(value.supportedMediaKinds)
    ? value.supportedMediaKinds.filter((kind): kind is CanvasEngineSettings['supportedMediaKinds'][number] => (
        kind === 'video' || kind === 'image' || kind === 'svg' || kind === 'visualAsset'
      ))
    : DEFAULT_CANVAS_ENGINE_SETTINGS.supportedMediaKinds

  return {
    selectedMediaId,
    mediaIds,
    uploadEnabled: false,
    autoSelectEnabled: value.autoSelectEnabled === true,
    manualMediaOverrideId,
    supportedMediaKinds: supportedMediaKinds.length > 0
      ? [...new Set(supportedMediaKinds)]
      : [...DEFAULT_CANVAS_ENGINE_SETTINGS.supportedMediaKinds],
    fitMode: normalizeCanvasFitMode(value.fitMode),
    scale: clampCanvasNumber(value.scale, DEFAULT_CANVAS_ENGINE_SETTINGS.scale, 0.1, 4),
    positionX: clampCanvasNumber(value.positionX, DEFAULT_CANVAS_ENGINE_SETTINGS.positionX, -100, 100),
    positionY: clampCanvasNumber(value.positionY, DEFAULT_CANVAS_ENGINE_SETTINGS.positionY, -100, 100),
    rotation: clampCanvasNumber(value.rotation, DEFAULT_CANVAS_ENGINE_SETTINGS.rotation, -180, 180),
    opacity: clampCanvasNumber(value.opacity, DEFAULT_CANVAS_ENGINE_SETTINGS.opacity, 0, 1),
    loopVideo: value.loopVideo === false ? false : DEFAULT_CANVAS_ENGINE_SETTINGS.loopVideo,
  }
}

function createCanvasEngineSettingsForPersistence(settings: CanvasEngineSettings): CanvasEngineSettings {
  return normalizeCanvasEngineSettings(settings)
}

const CANVAS_LAYER_ROLE_VALUES = new Set<CanvasLayerRole>([
  'background', 'hero', 'texture', 'foregroundAccent', 'mask', 'transition', 'feedback',
])
const CANVAS_ORCHESTRATION_LOCK_VALUES = new Set<CanvasOrchestrationLockKey>([
  'media', 'composition', 'layerRecruitment', 'transition', 'effectChain', 'motion', 'playback',
])

function normalizeCanvasBooleanRecord<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
): Partial<Record<T, boolean>> {
  if (!isRecord(value)) return {}
  const normalized: Partial<Record<T, boolean>> = {}
  for (const [key, enabled] of Object.entries(value)) {
    if (allowed.has(key as T) && enabled === true) normalized[key as T] = true
  }
  return normalized
}

function normalizeCanvasMediaLocks(value: unknown): Partial<Record<CanvasLayerRole, string>> {
  if (!isRecord(value)) return {}
  const normalized: Partial<Record<CanvasLayerRole, string>> = {}
  for (const [role, mediaId] of Object.entries(value)) {
    if (CANVAS_LAYER_ROLE_VALUES.has(role as CanvasLayerRole) && typeof mediaId === 'string' && mediaId.trim()) {
      normalized[role as CanvasLayerRole] = mediaId.trim()
    }
  }
  return normalized
}

export function normalizeCanvasOrchestrationSettings(value: unknown): CanvasOrchestrationSettings {
  const source = isRecord(value) ? value : DEFAULT_CANVAS_ORCHESTRATION_SETTINGS
  const rawPoolIds = Array.isArray(source.mediaPoolIds)
    ? source.mediaPoolIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.mediaPoolIds
  const compositionPreference = source.compositionPreference === 'auto' || (
    typeof source.compositionPreference === 'string' && source.compositionPreference in CANVAS_COMPOSITION_TEMPLATES
  )
    ? source.compositionPreference as CanvasOrchestrationSettings['compositionPreference']
    : DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.compositionPreference
  return {
    enabled: source.enabled === true,
    autoRoleEnabled: source.autoRoleEnabled !== false,
    mediaPoolIds: [...new Set(rawPoolIds)].slice(0, 128),
    mediaRolesById: normalizeCanvasMediaRoleMap(source.mediaRolesById),
    mediaLocksByLayer: normalizeCanvasMediaLocks(source.mediaLocksByLayer),
    layerLocks: normalizeCanvasBooleanRecord(source.layerLocks, CANVAS_LAYER_ROLE_VALUES),
    globalLocks: normalizeCanvasBooleanRecord(source.globalLocks, CANVAS_ORCHESTRATION_LOCK_VALUES),
    complexity: clampCanvasNumber(source.complexity, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.complexity, 0, 1),
    transitionDensity: clampCanvasNumber(source.transitionDensity, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.transitionDensity, 0, 1),
    effectIntensity: clampCanvasNumber(source.effectIntensity, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.effectIntensity, 0, 1),
    motionIntensity: clampCanvasNumber(source.motionIntensity, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.motionIntensity, 0, 1),
    cutDensity: clampCanvasNumber(source.cutDensity, DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.cutDensity, 0, 1),
    compositionPreference,
    poolRevision: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(finiteCanvasNumber(source.poolRevision, 0)))),
    programId: typeof source.programId === 'string' && CANVAS_PERFORMANCE_SHOW_IDS.includes(source.programId as typeof CANVAS_PERFORMANCE_SHOW_IDS[number])
      ? source.programId as typeof CANVAS_PERFORMANCE_SHOW_IDS[number]
      : DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId,
  }
}


function normalizeCanvasPresetId(value: unknown): CanvasPresetId {
  return typeof value === 'string' && value in CANVAS_PRESET_BY_ID
    ? value as CanvasPresetId
    : DEFAULT_CANVAS_PRESET_ID
}


function normalizeCanvasPresetColorMode(value: unknown): CanvasPresetColorMode {
  return value === 'palette' || value === 'audioReactive' || value === 'original'
    ? value
    : DEFAULT_CANVAS_PRESET_SETTINGS.particleColorMode
}

function normalizeCanvasParticleQuality(value: unknown): CanvasParticleQuality {
  return value === 'low' || value === 'high' || value === 'balanced'
    ? value
    : DEFAULT_CANVAS_PRESET_SETTINGS.particleQuality
}

function normalizeCanvasPresetSettings(value: unknown): CanvasPresetSettings {
  const source = isRecord(value) ? value : DEFAULT_CANVAS_PRESET_SETTINGS
  const trailAmount = clampCanvasNumber(
    source.trailAmount ?? source.motionTrailAmount ?? source.trailLength,
    DEFAULT_CANVAS_PRESET_SETTINGS.trailAmount,
    0,
    1,
  )
  const motionAmount = clampCanvasNumber(
    source.motionAmount ?? source.motionTrailAmount,
    DEFAULT_CANVAS_PRESET_SETTINGS.motionAmount,
    0,
    1,
  )
  const particleDensity = clampCanvasNumber(
    source.particleDensity ?? source.particleAmount,
    DEFAULT_CANVAS_PRESET_SETTINGS.particleDensity,
    0,
    1,
  )
  const bassReactivity = clampCanvasNumber(
    source.bassReactivity ?? source.bassBurst,
    DEFAULT_CANVAS_PRESET_SETTINGS.bassReactivity,
    0,
    1,
  )
  const turbulence = clampCanvasNumber(
    source.turbulence ?? source.dissolveAmount,
    DEFAULT_CANVAS_PRESET_SETTINGS.turbulence,
    0,
    1,
  )

  return {
    sourceVisibility: clampCanvasNumber(source.sourceVisibility, DEFAULT_CANVAS_PRESET_SETTINGS.sourceVisibility, 0, 1),
    intensity: clampCanvasNumber(source.intensity, DEFAULT_CANVAS_PRESET_SETTINGS.intensity, 0, 1),
    bassReactivity,
    beatPulse: clampCanvasNumber(source.beatPulse, DEFAULT_CANVAS_PRESET_SETTINGS.beatPulse, 0, 1),
    glow: clampCanvasNumber(source.glow, DEFAULT_CANVAS_PRESET_SETTINGS.glow, 0, 1),
    trailAmount,
    rgbSplit: clampCanvasNumber(source.rgbSplit ?? source.glitchAmount, DEFAULT_CANVAS_PRESET_SETTINGS.rgbSplit, 0, 1),
    glitchAmount: clampCanvasNumber(source.glitchAmount, DEFAULT_CANVAS_PRESET_SETTINGS.glitchAmount, 0, 1),
    stutterRate: clampCanvasNumber(source.stutterRate, DEFAULT_CANVAS_PRESET_SETTINGS.stutterRate, 0, 12),
    lumaThreshold: clampCanvasNumber(source.lumaThreshold, DEFAULT_CANVAS_PRESET_SETTINGS.lumaThreshold, 0, 1),
    motionAmount,
    turbulence,
    particleDensity,
    particleSize: clampCanvasNumber(source.particleSize, DEFAULT_CANVAS_PRESET_SETTINGS.particleSize, 0.35, 8),
    particleColorMode: normalizeCanvasPresetColorMode(source.particleColorMode),
    particleQuality: normalizeCanvasParticleQuality(source.particleQuality),
    motionTrailAmount: trailAmount,
    particleAmount: particleDensity,
    dissolveAmount: turbulence,
    trailLength: trailAmount,
    bassBurst: bassReactivity,
  }
}

function normalizeCanvasPresetOverride(value: unknown, presetId: CanvasPresetId): CanvasPresetOverrideState | null {
  if (!isRecord(value)) return DEFAULT_CANVAS_PRESET_OVERRIDE_STATE
  const rawPresetId = typeof value.presetId === 'string' && value.presetId in CANVAS_PRESET_BY_ID
    ? value.presetId as CanvasPresetId
    : presetId
  const source = value.source === 'auto' ? 'auto' : 'manual'
  return {
    source,
    presetId: rawPresetId,
    label: typeof value.label === 'string' && value.label.trim().length > 0
      ? value.label
      : (source === 'auto' ? 'Auto-selected preset' : 'User-selected preset'),
  }
}

export interface RepairedReactSelection {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
}

/**
 * Repairs an engine/preset pair without mutating any unrelated state.
 *
 * The engine is authoritative when it is valid because the ENGINE tab is the
 * user's top-level selection. Preset-backed engines receive a preset from the
 * same family. The standalone Shader engine intentionally carries no React
 * preset. When the engine itself is invalid, a valid preset may recover it;
 * otherwise the explicit startup pair is used.
 */
export function repairReactEnginePresetSelection(
  activeReactPresetId: unknown,
  activeReactEngineId: unknown,
  presets: ReactPreset[] = DEFAULT_REACT_PRESETS,
): RepairedReactSelection {
  const presetId = replaceLockedLaserDmxPresetId(activeReactPresetId)
  const selectedPreset = presetId
    ? presets.find(p => p.id === presetId && isSelectableReactEngineId(p.engine)) ?? null
    : null
  const engineIsValid = typeof activeReactEngineId === 'string' &&
    VALID_REACT_ENGINE_IDS.has(activeReactEngineId as ReactEngineId)

  if (!engineIsValid) {
    if (selectedPreset && isSelectableReactEngineId(selectedPreset.engine)) {
      return {
        activeReactPresetId: selectedPreset.id,
        activeReactEngineId: selectedPreset.engine,
      }
    }
    return {
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
    }
  }

  const engineId = activeReactEngineId as ReactEngineId
  if (isStandaloneReactEngineId(engineId)) {
    return { activeReactPresetId: null, activeReactEngineId: engineId }
  }

  if (selectedPreset?.engine === engineId) {
    return { activeReactPresetId: selectedPreset.id, activeReactEngineId: engineId }
  }

  const compatiblePreset = presets.find(p => p.engine === engineId && isSelectableReactEngineId(p.engine))
  if (compatiblePreset) {
    return { activeReactPresetId: compatiblePreset.id, activeReactEngineId: engineId }
  }

  return {
    activeReactPresetId: INITIAL_PRESET_ID,
    activeReactEngineId: INITIAL_ENGINE_ID,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, canonicalize((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

function normalizeBeamMatrixForPresetComparison(settings: LaserDmxBeamMatrixSettings): unknown {
  return {
    beams: settings.beams,
    groups: settings.groups.map(({ muted: _muted, soloed: _soloed, ...group }) => group),
    globalModulationRoutes: settings.globalModulationRoutes,
    output: settings.output,
    fog: settings.fog,
    cues: settings.cues ?? [],
  }
}

/**
 * Recomputes Beam Matrix dirty state from authored content. Selection, editor
 * chrome, and temporary mute/solo performance state intentionally do not count.
 */
export function isLaserDmxBeamMatrixPresetDirty(
  settings: LaserDmxBeamMatrixSettings,
  activePresetId: string | null,
): boolean {
  if (!activePresetId) return false
  const preset = getLaserDmxBeamMatrixPreset(activePresetId)
  if (!preset) return true
  const current = canonicalize(normalizeBeamMatrixForPresetComparison(settings))
  const expected = canonicalize(normalizeBeamMatrixForPresetComparison(preset.createSettings()))
  return JSON.stringify(current) !== JSON.stringify(expected)
}

function mergeCollectionsById<T extends { id: string }>(
  current: T[],
  persisted: T[] | undefined,
): T[] {
  if (!Array.isArray(persisted)) return current
  const persistedById = new Map(persisted.map(item => [item.id, item]))
  const merged = current.map(item => persistedById.get(item.id) ?? item)
  const currentIds = new Set(current.map(item => item.id))
  for (const item of persisted) {
    if (!currentIds.has(item.id)) merged.push(item)
  }
  return merged
}


export function normalizeCinematicPresetConfiguration(preset: ReactPreset): ReactPreset {
  if (preset.engine !== 'cinematicPortal') return preset

  const legacyPreset = preset as ReactPreset & {
    portalSettings?: unknown
    cinematicSettings?: unknown
  }
  const legacyValues: Record<string, unknown> = {
    params: { ...preset.params },
    renderSettings: preset.renderSettings ? { ...preset.renderSettings } : {},
  }
  if (legacyPreset.portalSettings !== undefined) legacyValues.portalSettings = legacyPreset.portalSettings
  if (legacyPreset.cinematicSettings !== undefined) legacyValues.cinematicSettings = legacyPreset.cinematicSettings

  const rawConfig = preset.cinematicConfig ?? legacyPreset.cinematicSettings ?? legacyPreset.portalSettings
  const rawRecord = rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
    ? rawConfig as Record<string, unknown>
    : null
  const isWorldConfig = rawRecord != null && [
    'schemaVersion', 'worldMode', 'world', 'worldSettings', 'qualityTier', 'cameraRig', 'cameraMode',
  ].some(key => key in rawRecord)
  const legacyControls = rawRecord && !isWorldConfig
    ? { ...preset.params, ...preset.renderSettings, ...rawRecord }
    : { ...preset.params, ...preset.renderSettings }
  const migratedLegacyConfig = createLegacyPortalCinematicConfig(legacyControls, legacyValues)

  return {
    ...preset,
    cinematicConfig: rawConfig === undefined || !isWorldConfig
      ? migratedLegacyConfig
      : normalizeCinematicWorldConfig(rawConfig, legacyValues),
  }
}

export function normalizeReactPresetWorkspaceConfiguration(preset: ReactPreset): ReactPreset {
  const workspace = resolveReactPresetLaserDmxWorkspace(preset)
  const workspaceNormalized = workspace == null || preset.laserDmxWorkspace === workspace
    ? preset
    : { ...preset, laserDmxWorkspace: workspace }
  if (workspaceNormalized.engine !== 'pixGrid') return workspaceNormalized
  return {
    ...workspaceNormalized,
    pixGridSettings: normalizePixGridPresetSettings(workspaceNormalized.pixGridSettings) ?? { pattern: 'bassBeacon' },
  }
}

export function normalizeCinematicPresetCollection(presets: ReactPreset[]): ReactPreset[] {
  return presets.map(preset => normalizeReactPresetWorkspaceConfiguration(
    normalizeCinematicPresetConfiguration(preset),
  ))
}

// ── Exported migration function (for testing) ─────────────────────────────────
export function migrateReactStore(persistedState: unknown, version: number): Record<string, unknown> {
  let state = (persistedState ?? {}) as Record<string, unknown>
  if (version < 1) {
    state = {
      ...state,
      laserDmxWorkspaceMode: 'beamMatrix' as LaserDmxWorkspaceMode,
      laserDmxBeamMatrixAuthoringMode: DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
      laserDmxBeamMatrix:    createDefaultLaserDmxBeamMatrixSettings(),
    }
  }
  if (version < 2) {
    const osc = state.oscillatorSettings as Record<string, unknown> | undefined
    if (osc) {
      let migratedOsc = { ...osc }
      if (osc.sourceType === 'svgGlyph') {
        const glyphId = osc.selectedGlyphId as string | null
        const svgId = typeof glyphId === 'string'
          ? getMediaIdFromSvgGlyphId(glyphId)
          : null
        // Only media-backed legacy glyph selections belong to the unified SVG
        // lifecycle. Preserve standalone imported glyph-library entries as
        // legacy glyphs so old libraries remain usable after migration.
        if (svgId) {
          migratedOsc = { ...migratedOsc, sourceType: 'svg', selectedSvgId: svgId, svgRenderMode: 'reactivePath', svgUseReactPalette: true, autoRotate: true }
        } else {
          migratedOsc = { ...migratedOsc, autoRotate: true }
        }
      } else if (osc.sourceType === 'svgVisual') {
        migratedOsc = { ...migratedOsc, sourceType: 'svg', selectedSvgId: (osc.selectedSvgVisualId as string | null) ?? null, svgRenderMode: 'originalArtwork', svgUseReactPalette: true, autoRotate: true }
      } else if (osc.sourceType === 'text') {
        migratedOsc = { ...migratedOsc, autoRotate: false }
      } else {
        migratedOsc = { ...migratedOsc, autoRotate: true }
      }
      if (!('selectedSvgId' in migratedOsc))     migratedOsc.selectedSvgId     = null
      if (!('svgRenderMode' in migratedOsc))      migratedOsc.svgRenderMode      = 'auto'
      if (!('svgUseReactPalette' in migratedOsc)) migratedOsc.svgUseReactPalette = true
      if (!('autoRotate' in migratedOsc))         migratedOsc.autoRotate         = osc.sourceType !== 'text'
      state = { ...state, oscillatorSettings: migratedOsc }
    }
  }
  if (version < 3) {
    const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
    if (bm) {
      const beams  = (bm.beams  as unknown[] | undefined) ?? []
      const groups = (bm.groups as unknown[] | undefined) ?? []
      state = {
        ...state,
        laserDmxBeamMatrix: {
          ...bm,
          beams:  beams.map((b, i) => { const beam = b as Record<string, unknown>; return { ...beam, sequenceIndex: beam.sequenceIndex ?? i, motion: beam.motion ?? DEFAULT_BEAM_MOTION } }),
          groups: groups.map((g) => { const group = g as Record<string, unknown>; return { ...group, sequence: group.sequence ?? DEFAULT_BEAM_SEQUENCE } }),
        },
      }
    }
  }
  if (version < 4) {
    const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
    if (bm) {
      const groups = (bm.groups as unknown[] | undefined) ?? []
      const beams  = (bm.beams  as unknown[] | undefined) ?? []
      const coordTargets = new Set(['originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY'])
      const migrateRoutes = (routes: unknown[]): unknown[] =>
        routes.map((r) => {
          const route = r as Record<string, unknown>
          if (!coordTargets.has(route.target as string)) return route
          const oldMin = typeof route.min === 'number' ? route.min : 0
          const oldMax = typeof route.max === 'number' ? route.max : 0
          if (Math.abs(oldMin) <= 2 && Math.abs(oldMax) <= 2) return { ...route, min: oldMin * 200, max: oldMax * 200 }
          return route
        })
      state = {
        ...state,
        laserDmxBeamMatrix: {
          ...bm,
          groups: groups.map((g) => {
            const group = g as Record<string, unknown>
            const existingRoutes = (group.modulationRoutes as unknown[] | undefined) ?? []
            return { ...group, launch: group.launch ?? DEFAULT_LAUNCH_SETTINGS, maxActiveBeams: group.maxActiveBeams ?? 0, modulationRoutes: migrateRoutes(existingRoutes) }
          }),
          beams: beams.map((b) => {
            const beam = b as Record<string, unknown>
            const existingRoutes = (beam.modulationRoutes as unknown[] | undefined) ?? []
            return { ...beam, modulationRoutes: migrateRoutes(existingRoutes) }
          }),
        },
      }
    }
  }
  if (version < 5) {
    const legacy = (state as Record<string, unknown>).manualTrackSections as ReactTrackSection[] | undefined
    if (Array.isArray(legacy) && legacy.length > 0) {
      state = { ...state, manualTrackSectionsByTrackId: { _legacy: legacy } }
    } else {
      state = { ...state, manualTrackSectionsByTrackId: (state as Record<string, unknown>).manualTrackSectionsByTrackId ?? {} }
    }
    const { manualTrackSections: _mts, ...rest } = state as Record<string, unknown>
    void _mts
    state = rest
  }
  if (version < 6) {
    const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
    if (bm) {
      const editor = (bm.editor as Record<string, unknown> | undefined) ?? {}
      state = {
        ...state,
        laserDmxBeamMatrix: {
          ...bm,
          editor: {
            ...editor,
            beamEditorVisible: editor.beamEditorVisible ?? true,
            beamPathsVisible:  editor.beamPathsVisible  ?? true,
          },
        },
      }
    }
  }
  if (version < 7) {
    // The v4 migration converted normalized offset values (|val| ≤ 2) to pixels
    // by multiplying by 200 (e.g. -0.12 → -24). The compiler now uses normalized
    // values and multiplies by canvas size itself, so any stored pixel-range values
    // must be divided back by 200. Values already in normalized range (|val| ≤ 2)
    // are left unchanged.
    const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
    if (bm) {
      const coordTargets = new Set(['originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY'])
      const normalizeRoutes = (routes: unknown[]): unknown[] =>
        routes.map((r) => {
          const route = r as Record<string, unknown>
          if (!coordTargets.has(route.target as string)) return route
          const min = typeof route.min === 'number' ? route.min : 0
          const max = typeof route.max === 'number' ? route.max : 0
          if (Math.abs(min) > 2 || Math.abs(max) > 2) {
            return { ...route, min: min / 200, max: max / 200 }
          }
          return route
        })
      const groups = (bm.groups as unknown[] | undefined) ?? []
      const beams  = (bm.beams  as unknown[] | undefined) ?? []
      state = {
        ...state,
        laserDmxBeamMatrix: {
          ...bm,
          groups: groups.map((g) => {
            const group = g as Record<string, unknown>
            const existingRoutes = (group.modulationRoutes as unknown[] | undefined) ?? []
            return { ...group, modulationRoutes: normalizeRoutes(existingRoutes) }
          }),
          beams: beams.map((b) => {
            const beam = b as Record<string, unknown>
            const existingRoutes = (beam.modulationRoutes as unknown[] | undefined) ?? []
            return { ...beam, modulationRoutes: normalizeRoutes(existingRoutes) }
          }),
        },
      }
    }
  }
  if (version < 8) {
    const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
    if (bm && !('cues' in bm)) {
      state = { ...state, laserDmxBeamMatrix: { ...bm, cues: [] } }
    }
  }
  if (version < 9) {
    state = {
      ...state,
      selectedSectionByTrackId:     {},
      suppressedAutoSectionsByTrackId: {},
    }
  }
  if (version < 10) {
    const existing = state.presetAutomationCuesByTrackId
    // Initialize only when the field is absent or corrupted; never overwrite a valid map.
    if (existing === null || existing === undefined || typeof existing !== 'object' || Array.isArray(existing)) {
      state = { ...state, presetAutomationCuesByTrackId: {} }
    }
  }
  if (version < 11) {
    // Font assets are no longer stored in localStorage — binary data (rawFontDataBase64)
    // must not survive in persisted state. Discard any legacy entry that carries it.
    // Cloud metadata is fetched fresh via loadOscillatorFonts() on every session start.
    const fonts = state.oscillatorFontAssets
    if (Array.isArray(fonts)) {
      state = {
        ...state,
        oscillatorFontAssets: (fonts as unknown[]).filter(
          (f) => typeof f === 'object' && f !== null && !('rawFontDataBase64' in (f as object))
        ),
      }
    }
  }
  if (version < 12) {
    // Add textLetterReactionMode to persisted oscillatorSettings.
    // Defaults to 'uniform' so existing presets behave exactly as before.
    const osc = state.oscillatorSettings as Record<string, unknown> | undefined
    if (osc && !('textLetterReactionMode' in osc)) {
      state = {
        ...state,
        oscillatorSettings: { ...osc, textLetterReactionMode: 'uniform' },
      }
    }
  }
  if (version < 13) {
    // Add textLetterAssignments to persisted oscillatorSettings.
    // Empty array preserves existing behavior for all presets.
    const osc = state.oscillatorSettings as Record<string, unknown> | undefined
    if (osc && !('textLetterAssignments' in osc)) {
      state = {
        ...state,
        oscillatorSettings: { ...osc, textLetterAssignments: [] },
      }
    }
  }
  if (version < 14) {
    // Initialize Sound Drawing layer and clip collections.
    // Existing projects load with empty maps; no behavioral change.
    if (!('soundDrawingLayersByTrackId' in state)) {
      state = { ...state, soundDrawingLayersByTrackId: {} }
    }
    if (!('soundDrawingClipsByTrackId' in state)) {
      state = { ...state, soundDrawingClipsByTrackId: {} }
    }
  }
  if (version < 15) {
    // Add textLineHeight and textAlignment to persisted oscillatorSettings.
    // Defaults match DEFAULT_OSCILLATOR_SETTINGS.
    const osc = state.oscillatorSettings as Record<string, unknown> | undefined
    if (osc) {
      const newOsc = { ...osc }
      if (!('textLineHeight' in newOsc)) newOsc.textLineHeight = 1.2
      if (!('textAlignment' in newOsc))  newOsc.textAlignment  = 'center'
      state = { ...state, oscillatorSettings: newOsc }
    }
  }
  if (version < 19) {
    // Legacy Shader Pads active-selection migration.
    // The five Shader Pads presets have been removed from DEFAULT_REACT_PRESETS and
    // the shaderPads engine is no longer selectable in the UI.
    const persistedPresetId = state.activeReactPresetId as string | null | undefined
    const persistedEngineId = state.activeReactEngineId as string | undefined

    if (persistedPresetId != null && RETIRED_LASER_DMX_PRESET_IDS.has(persistedPresetId)) {
      // Retired LaserDMX selections predate the Shader Pads removal and must keep
      // their engine family instead of being mistaken for an unknown Shader preset.
      state = {
        ...state,
        activeReactPresetId: LASER_DMX_BEAM_MATRIX_REACT_PRESET_ID,
        activeReactEngineId: 'laserDmx',
      }
    } else if (persistedPresetId != null && LEGACY_SHADER_PRESET_IDS.has(persistedPresetId)) {
      // Case A: active preset ID is one of the five removed legacy presets.
      state = { ...state, activeReactPresetId: INITIAL_PRESET_ID, activeReactEngineId: INITIAL_ENGINE_ID }
    } else {
      const validPreset = persistedPresetId != null
        ? DEFAULT_REACT_PRESETS.find(p => p.id === persistedPresetId)
        : undefined

      if (!validPreset) {
        if (persistedEngineId === 'shaderPads') {
          // Case B: engine is shaderPads and there is no valid active preset.
          state = { ...state, activeReactPresetId: INITIAL_PRESET_ID, activeReactEngineId: INITIAL_ENGINE_ID }
        }
        // Case D (non-shader engine, no preset): leave untouched.
      } else if (validPreset.engine !== 'shaderPads' && persistedEngineId === 'shaderPads') {
        // Case C: valid non-Shader preset but stale shaderPads engine ID — repair engine only.
        state = { ...state, activeReactEngineId: validPreset.engine }
      }
      // Case D: valid state for a non-Shader engine — no changes.
    }
  }
  if (version < 20) {
    const repaired = repairReactEnginePresetSelection(
      state.activeReactPresetId,
      state.activeReactEngineId,
      DEFAULT_REACT_PRESETS,
    )
    state = { ...state, ...repaired }
  }
  if (version < 21) {
    const persistedPresets = Array.isArray(state.reactPresets)
      ? state.reactPresets as ReactPreset[]
      : DEFAULT_REACT_PRESETS
    const persistedPads = Array.isArray(state.performancePads)
      ? state.performancePads as ReactPerformancePad[]
      : DEFAULT_PERFORMANCE_PADS
    const beamMatrix = state.laserDmxBeamMatrix as LaserDmxBeamMatrixSettings | undefined
    const activeBeamPresetId = typeof state.activeLaserDmxBeamMatrixPresetId === 'string'
      ? state.activeLaserDmxBeamMatrixPresetId
      : null

    state = {
      ...state,
      reactPresets: persistedPresets,
      performancePads: persistedPads,
      laserDmxBeamMatrixPresetDirty: beamMatrix
        ? isLaserDmxBeamMatrixPresetDirty(beamMatrix, activeBeamPresetId)
        : Boolean(state.laserDmxBeamMatrixPresetDirty),
    }
  }
  if (version < 22) {
    // Remove legacy global palette state and decorative preset fields that no
    // renderer consumed. Old snapshots remain otherwise compatible.
    const { reactColorPalette: _legacyPalette, ...withoutLegacyPalette } = state
    void _legacyPalette
    const presets = Array.isArray(withoutLegacyPalette.reactPresets)
      ? (withoutLegacyPalette.reactPresets as ReactPreset[]).map((preset) => {
          const params = preset.params as ReactPresetParams & {
            colorShift?: number
            complexity?: number
          }
          const {
            colorShift: _colorShift,
            complexity: _complexity,
            ...functionalParams
          } = params
          void _colorShift
          void _complexity
          const scenes = Array.isArray(preset.scenes)
            ? preset.scenes.map((scene) => {
                const legacyScene = scene as typeof scene & { palette?: unknown }
                const { palette: _scenePalette, ...sceneWithoutPalette } = legacyScene
                void _scenePalette
                const sceneParams = scene.params as Partial<ReactPresetParams> & {
                  colorShift?: number
                  complexity?: number
                }
                const {
                  colorShift: _sceneColorShift,
                  complexity: _sceneComplexity,
                  ...functionalSceneParams
                } = sceneParams
                void _sceneColorShift
                void _sceneComplexity
                return { ...sceneWithoutPalette, params: functionalSceneParams }
              })
            : preset.scenes
          return { ...preset, params: functionalParams, scenes }
        })
      : withoutLegacyPalette.reactPresets
    state = { ...withoutLegacyPalette, reactPresets: presets }
  }
  if (version < 23) {
    state = {
      ...state,
      soundDrawingClipsByTrackId: normalizeSoundDrawingClipsByTrackId(
        state.soundDrawingClipsByTrackId,
      ),
    }
  }
  if (version < 24) {
    const presets = Array.isArray(state.reactPresets)
      ? state.reactPresets as ReactPreset[]
      : DEFAULT_REACT_PRESETS
    state = {
      ...state,
      reactPresets: normalizeCinematicPresetCollection(presets),
    }
  }
  if (version < 25) {
    const presets = Array.isArray(state.reactPresets)
      ? normalizeCinematicPresetCollection(state.reactPresets as ReactPreset[])
      : DEFAULT_REACT_PRESETS
    state = {
      ...state,
      cinematicConfigsByPresetId: normalizeCinematicConfigOverrides(state.cinematicConfigsByPresetId, presets),
      cinematicSeedLocksByPresetId: normalizeCinematicSeedLocks(state.cinematicSeedLocksByPresetId, presets),
      cinematicWorldsUiMode: state.cinematicWorldsUiMode === 'advanced' ? 'advanced' : 'simple',
    }
  }
  if (version < 26) {
    const presets = Array.isArray(state.reactPresets)
      ? normalizeCinematicPresetCollection(state.reactPresets as ReactPreset[])
      : DEFAULT_REACT_PRESETS
    state = {
      ...state,
      reactPresets: presets,
      cinematicConfigsByPresetId: normalizeCinematicConfigOverrides(state.cinematicConfigsByPresetId, presets),
      cinematicSeedLocksByPresetId: normalizeCinematicSeedLocks(state.cinematicSeedLocksByPresetId, presets),
    }
  }
  if (version < 27) {
    const oscillator = isRecord(state.oscillatorSettings)
      ? state.oscillatorSettings as unknown as OscillatorSettings
      : DEFAULT_OSCILLATOR_SETTINGS
    state = {
      ...state,
      oscillatorSettings: normalizeOscillatorSettings(oscillator),
      soundDrawingLayersByTrackId: normalizeSoundDrawingLayersByTrackId(
        state.soundDrawingLayersByTrackId,
      ),
    }
  }
  if (version < 29) {
    // Introduce explicit LaserDMX schema versions and normalize legacy rig
    // data without dropping unknown authored fields. Beam Matrix receives a
    // version marker only; its established document shape remains unchanged.
    state = {
      ...state,
      ...(isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)
        ? { laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
        : {}),
      ...(isPersistedLaserDmxBeamMatrixDocument(state.laserDmxBeamMatrix)
        ? { laserDmxBeamMatrix: normalizeLaserDmxBeamMatrixSettings(state.laserDmxBeamMatrix) }
        : {}),
    }
  }
  if (version < 30 && isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)) {
    // Backfill the shared metre-based stage and canonical fixture transforms.
    state = { ...state, laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
  }
  if (version < 31 && isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)) {
    // Backfill capability-gated moving-head state and normalized group movement
    // documents without touching Beam Matrix travel or reaction-group data.
    state = { ...state, laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
  }
  if (version < 32 && isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)) {
    // Backfill production-fixture profiles, typed flash patterns,
    // visual-comfort limits, wash/pixel state, and group chase documents.
    state = { ...state, laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
  }
  if (version < 33 && isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)) {
    // Preserve pre-Look LaserDMX rig data as one complete compatibility Look.
    state = {
      ...state,
      laserDmxSettings: ensureProductionLookCompatibility(
        normalizeLaserDmxSettings(state.laserDmxSettings),
        'Migrated LaserDMX Look',
        'migration',
      ),
    }
  }
  if (version < 34) {
    const legacyRig = isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)
      ? normalizeLaserDmxSettings(state.laserDmxSettings)
      : null
    const matrix = isPersistedLaserDmxBeamMatrixDocument(state.laserDmxBeamMatrix)
      ? normalizeLaserDmxBeamMatrixSettings(state.laserDmxBeamMatrix)
      : null
    if (legacyRig && matrix) {
      state = {
        ...state,
        laserDmxSettings: normalizeLaserDmxSettings({
          ...legacyRig,
          productionCues: migrateLegacyBeamMatrixCues(matrix.cues ?? [], legacyRig.productionCues ?? []),
        }),
      }
    }
  }
  if (version < 35) {
    const presets = Array.isArray(state.reactPresets)
      ? state.reactPresets as ReactPreset[]
      : DEFAULT_REACT_PRESETS
    state = {
      ...state,
      reactPresets: normalizeCinematicPresetCollection(presets),
      ...(isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)
        ? { laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
        : {}),
    }
  }
  if (version < 36) {
    const presets = removeRetiredReactPresets(
      Array.isArray(state.reactPresets)
        ? state.reactPresets as ReactPreset[]
        : DEFAULT_REACT_PRESETS,
    )
    const pads = clearRetiredReactPresetPadAssignments(
      Array.isArray(state.performancePads)
        ? state.performancePads as ReactPerformancePad[]
        : DEFAULT_PERFORMANCE_PADS,
    )
    state = {
      ...state,
      activeReactPresetId: replaceLockedLaserDmxPresetId(state.activeReactPresetId),
      reactPresets: normalizeCinematicPresetCollection(presets),
      performancePads: pads,
      cinematicConfigsByPresetId: normalizeCinematicConfigOverrides(state.cinematicConfigsByPresetId, presets),
      cinematicSeedLocksByPresetId: normalizeCinematicSeedLocks(state.cinematicSeedLocksByPresetId, presets),
    }
  }
  if (version < 37) {
    state = sanitizeRetiredNeonLatticeReactState(state)
  }
  if (version < 39) {
    state = {
      ...state,
      activeReactPresetId: replaceLockedLaserDmxPresetId(state.activeReactPresetId),
      laserDmxWorkspaceMode: 'beamMatrix' as const,
      ...(Array.isArray(state.performancePads)
        ? { performancePads: normalizeLockedLaserDmxPadAssignments(state.performancePads as ReactPerformancePad[]) }
        : {}),
    }
  }
  if (version < 40) {
    state = {
      ...state,
      laserDmxShowDirector: normalizeLaserDmxShowDirectorState(state.laserDmxShowDirector),
    }
  }
  if (version < 41) {
    state = {
      ...state,
      laserDmxBeamMatrixAuthoringMode: DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
    }
  }
  if (version < 43) {
    state = sanitizeRetiredReactPresetState(state)
  }
  if (version < 44) {
    state = {
      ...state,
      laserDmxShowDirector: normalizeLaserDmxShowDirectorState(state.laserDmxShowDirector),
      laserDmxShowDirectorPerformance: normalizeLaserDmxShowDirectorPerformanceState(state.laserDmxShowDirectorPerformance),
    }
  }
  if (version < 46) {
    const existing = isRecord(state.soundDrawingPerformanceSettings)
      ? state.soundDrawingPerformanceSettings
      : {}
    state = {
      ...state,
      soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings({
        ...existing,
        performanceSource: existing.performanceSource ?? 'activeUserSource',
        sourceTreatment: existing.sourceTreatment ?? 'preserveIdentity',
        useSourceAs: existing.useSourceAs ?? 'primaryMotif',
        preserveIdentity: existing.preserveIdentity ?? true,
      }),
    }
  }
  if (version < 47) {
    // Backfill deterministic Show Director depth layers while preserving legacy
    // X/Y composition and the existing Beam Matrix compatibility document.
    state = {
      ...state,
      laserDmxShowDirector: normalizeLaserDmxShowDirectorState(state.laserDmxShowDirector),
    }
  }
  if (version < 48) {
    state = {
      ...state,
      pixGridState: normalizePixGridState(state.pixGridState),
    }
  }
  if (version < 49) {
    // Patch 5 promotes presets into editable scenes and migrates legacy sparse
    // overrides into compact mode/color/opacity tuples.
    state = {
      ...state,
      pixGridState: normalizePixGridState(state.pixGridState),
    }
  }
  if (version < 50) {
    state = {
      ...state,
      pixGridActionCuesByTrackId: normalizePixGridActionCueMap(state.pixGridActionCuesByTrackId),
    }
  }
  if (version < 51) {
    state = {
      ...state,
      pixGridState: normalizePixGridState(state.pixGridState),
    }
  }
  if (Array.isArray(state.reactPresets)) {
    state = {
      ...state,
      reactPresets: normalizeCinematicPresetCollection(state.reactPresets as ReactPreset[]),
    }
  }
  const oscillatorSettings = state.oscillatorSettings as OscillatorSettings | undefined
  if (oscillatorSettings) {
    state = { ...state, oscillatorSettings: normalizeOscillatorSettings(oscillatorSettings) }
  }
  if (isPersistedLaserDmxSettingsDocument(state.laserDmxSettings)) {
    state = { ...state, laserDmxSettings: normalizeLaserDmxSettings(state.laserDmxSettings) }
  }
  if (isPersistedLaserDmxBeamMatrixDocument(state.laserDmxBeamMatrix)) {
    state = { ...state, laserDmxBeamMatrix: normalizeLaserDmxBeamMatrixSettings(state.laserDmxBeamMatrix) }
  }
  state = {
    ...state,
    canvasEngineSettings: normalizeCanvasEngineSettings(state.canvasEngineSettings),
    selectedCanvasPresetId: normalizeCanvasPresetId(state.selectedCanvasPresetId),
    canvasPresetSettings: normalizeCanvasPresetSettings(state.canvasPresetSettings),
    soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings(
      state.soundDrawingPerformanceSettings,
    ),
    canvasPresetOverride: normalizeCanvasPresetOverride(
      state.canvasPresetOverride,
      normalizeCanvasPresetId(state.selectedCanvasPresetId),
    ),
    laserDmxShowDirector: normalizeLaserDmxShowDirectorState(state.laserDmxShowDirector),
    laserDmxShowDirectorPerformance: normalizeLaserDmxShowDirectorPerformanceState(state.laserDmxShowDirectorPerformance),
    pixGridState: normalizePixGridState(state.pixGridState),
    pixGridActionCuesByTrackId: normalizePixGridActionCueMap(state.pixGridActionCuesByTrackId),
  }
  // Imported/current-version snapshots do not necessarily pass through a
  // numbered migration, so keep the retirement boundary defensive.
  return sanitizeRetiredReactPresetState(
    sanitizeRetiredNeonLatticeReactState(state),
  )
}

export const MIN_SOUND_DRAWING_CLIP_DURATION_SEC = 0.1

function finiteNumber(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  return Number.isFinite(candidate) ? candidate : fallback
}

/**
 * Enforces clip ownership and finite timeline geometry. When a finite positive
 * track duration is known, the entire range is kept inside that duration.
 */
export function normalizeSoundDrawingClip(
  clip: SoundDrawingClip,
  parentTrackId: string,
  trackDurationSec?: number | null,
): SoundDrawingClip {
  const boundedDuration = Number.isFinite(trackDurationSec) && (trackDurationSec ?? 0) > 0
    ? trackDurationSec as number
    : null
  const minimumDuration = boundedDuration === null
    ? MIN_SOUND_DRAWING_CLIP_DURATION_SEC
    : Math.min(MIN_SOUND_DRAWING_CLIP_DURATION_SEC, boundedDuration)

  let startSec = Math.max(0, finiteNumber(clip.startSec, 0))
  if (boundedDuration !== null) {
    startSec = Math.min(startSec, Math.max(0, boundedDuration - minimumDuration))
  }

  let endSec = Math.max(
    startSec + minimumDuration,
    finiteNumber(clip.endSec, startSec + minimumDuration),
  )
  if (boundedDuration !== null) endSec = Math.min(endSec, boundedDuration)

  return {
    ...clip,
    trackId:  parentTrackId,
    startSec,
    endSec,
    zIndex:   finiteNumber(clip.zIndex, 0),
    fadeInMs: Math.max(0, finiteNumber(clip.fadeInMs, 0)),
    fadeOutMs: Math.max(0, finiteNumber(clip.fadeOutMs, 0)),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeSoundDrawingLayer(layer: SoundDrawingLayer): SoundDrawingLayer {
  const textSource = normalizeSoundDrawingTextSource(layer.textSource)
  const lyricGapBehavior = normalizeSoundDrawingGapBehavior(layer.lyricGapBehavior)
  const lyricFallbackText = typeof layer.lyricFallbackText === 'string' ? layer.lyricFallbackText : ''
  if (
    layer.textSource === textSource &&
    layer.lyricGapBehavior === lyricGapBehavior &&
    layer.lyricFallbackText === lyricFallbackText
  ) return layer

  return { ...layer, textSource, lyricGapBehavior, lyricFallbackText }
}

export function normalizeSoundDrawingLayersByTrackId(
  value: unknown,
): Record<string, SoundDrawingLayer[]> {
  if (!isRecord(value)) return {}
  let changed = false
  const normalized: Record<string, SoundDrawingLayer[]> = {}

  for (const [trackId, bucket] of Object.entries(value)) {
    if (!Array.isArray(bucket)) {
      normalized[trackId] = []
      changed = true
      continue
    }

    const valid = bucket.filter(isRecord)
    const normalizedBucket = valid.map(raw => normalizeSoundDrawingLayer(raw as unknown as SoundDrawingLayer))
    const bucketChanged = valid.length !== bucket.length || normalizedBucket.some((layer, index) => layer !== bucket[index])
    normalized[trackId] = bucketChanged ? normalizedBucket : bucket as SoundDrawingLayer[]
    changed ||= bucketChanged
  }

  return changed ? normalized : value as Record<string, SoundDrawingLayer[]>
}

/** Repairs persisted/imported clip buckets without dropping recoverable objects. */
export function normalizeSoundDrawingClipsByTrackId(
  value: unknown,
  trackDurationsById: Record<string, number | undefined> = {},
): Record<string, SoundDrawingClip[]> {
  if (!isRecord(value)) return {}

  const normalized: Record<string, SoundDrawingClip[]> = {}
  for (const [parentTrackId, bucket] of Object.entries(value)) {
    if (!Array.isArray(bucket)) {
      normalized[parentTrackId] = []
      continue
    }

    normalized[parentTrackId] = bucket.flatMap((raw, index) => {
      if (!isRecord(raw)) return []
      const recovered: SoundDrawingClip = {
        ...raw,
        id: typeof raw.id === 'string' && raw.id
          ? raw.id
          : `${parentTrackId}:recovered-clip:${index}`,
        trackId: parentTrackId,
        layerId: typeof raw.layerId === 'string' ? raw.layerId : '',
        startSec: finiteNumber(raw.startSec, 0),
        endSec: finiteNumber(raw.endSec, MIN_SOUND_DRAWING_CLIP_DURATION_SEC),
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
        zIndex: finiteNumber(raw.zIndex, 0),
        fadeInMs: finiteNumber(raw.fadeInMs, 0),
        fadeOutMs: finiteNumber(raw.fadeOutMs, 0),
      }
      return [normalizeSoundDrawingClip(
        recovered,
        parentTrackId,
        trackDurationsById[parentTrackId],
      )]
    })
  }
  return normalized
}

export function reactStorePartialize(s: ReactStoreState) {
  const repairedSelection = repairReactEnginePresetSelection(
    s.activeReactPresetId,
    s.activeReactEngineId,
    s.reactPresets,
  )
  const persisted = {
    activeReactPresetId:                repairedSelection.activeReactPresetId,
    activeReactEngineId:                repairedSelection.activeReactEngineId,
    reactPresets:                       s.reactPresets,
    pixGridState:                       normalizePixGridState(s.pixGridState),
    cinematicConfigsByPresetId:         s.cinematicConfigsByPresetId,
    cinematicSeedLocksByPresetId:       s.cinematicSeedLocksByPresetId,
    cinematicWorldsUiMode:              s.cinematicWorldsUiMode,
    canvasEngineSettings:                createCanvasEngineSettingsForPersistence(s.canvasEngineSettings),
    selectedCanvasMediaId:              s.selectedCanvasMediaId,
    activeCanvasMediaId:                s.activeCanvasMediaId,
    canvasMediaTimingById:              normalizeCanvasMediaTimingById(s.canvasMediaTimingById),
    selectedCanvasPresetId:             s.selectedCanvasPresetId,
    canvasPresetSettings:               normalizeCanvasPresetSettings(s.canvasPresetSettings),
    canvasPresetOverride:               s.canvasPresetOverride,
    canvasOrchestrationSettings:         normalizeCanvasOrchestrationSettings(s.canvasOrchestrationSettings),
    performancePads:                    s.performancePads,
    manualTrackSectionsByTrackId:       s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId:    s.suppressedAutoSectionsByTrackId,
    presetAutomationCuesByTrackId:      s.presetAutomationCuesByTrackId,
    pixGridActionCuesByTrackId:          normalizePixGridActionCueMap(s.pixGridActionCuesByTrackId),
    oscillatorSettings:                 s.oscillatorSettings,
    soundDrawingPerformanceSettings:     normalizeSoundDrawingPerformanceSettings(s.soundDrawingPerformanceSettings),
    oscillatorGlyphAssets:              s.oscillatorGlyphAssets,
    laserDmxSettings:                   sanitizeLaserDmxSettingsForPersistence(s.laserDmxSettings),
    laserDmxWorkspaceMode:              coerceLaserDmxWorkspaceMode(s.laserDmxWorkspaceMode),
    laserDmxBeamMatrixAuthoringMode:    coerceLaserDmxBeamMatrixAuthoringMode(s.laserDmxBeamMatrixAuthoringMode),
    laserDmxBeamMatrix:                 sanitizeLaserDmxBeamMatrixForPersistence(s.laserDmxBeamMatrix),
    laserDmxShowDirector:               normalizeLaserDmxShowDirectorState(s.laserDmxShowDirector),
    laserDmxShowDirectorPerformance:    normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance),
    activeLaserDmxBeamMatrixPresetId:   s.activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixPresetDirty:      s.laserDmxBeamMatrixPresetDirty,
    soundDrawingLayersByTrackId:        normalizeSoundDrawingLayersByTrackId(s.soundDrawingLayersByTrackId),
    soundDrawingClipsByTrackId:         s.soundDrawingClipsByTrackId,
    reactIntensity:       s.reactIntensity,
    reactMotion:          s.reactMotion,
    reactGlow:            s.reactGlow,
    reactBassReactivity:  s.reactBassReactivity,
    reactTrailDecay:      s.reactTrailDecay,
    reactFogDensity:      s.reactFogDensity,
    reactParticleDensity: s.reactParticleDensity,
  }
  return sanitizeRetiredReactPresetState(
    sanitizeRetiredNeonLatticeReactState(persisted),
  ) as typeof persisted
}

export type ReactPersistedState = ReturnType<typeof reactStorePartialize>

/**
 * Authored/project data is intentionally kept out of synchronous localStorage.
 * These fields are structured-cloned into IndexedDB by reactPersistStorage.
 */
export const REACT_PROJECT_STATE_KEYS = [
  'reactPresets',
  'pixGridState',
  'cinematicConfigsByPresetId',
  'cinematicSeedLocksByPresetId',
  'cinematicWorldsUiMode',
  'canvasEngineSettings',
  'selectedCanvasMediaId',
  'activeCanvasMediaId',
  'canvasMediaTimingById',
  'selectedCanvasPresetId',
  'canvasPresetSettings',
  'canvasPresetOverride',
  'canvasOrchestrationSettings',
  'manualTrackSectionsByTrackId',
  'suppressedAutoSectionsByTrackId',
  'presetAutomationCuesByTrackId',
  'pixGridActionCuesByTrackId',
  'oscillatorGlyphAssets',
  'soundDrawingPerformanceSettings',
  'laserDmxSettings',
  'laserDmxBeamMatrix',
  'laserDmxShowDirector',
  'laserDmxShowDirectorPerformance',
  'soundDrawingLayersByTrackId',
  'soundDrawingClipsByTrackId',
] as const satisfies readonly (keyof ReactPersistedState)[]

export function mergeReactStoreState(
  persistedState: unknown,
  currentState: ReactStoreState,
): ReactStoreState {
  const persisted = sanitizeRetiredReactPresetState(
    sanitizeRetiredNeonLatticeReactState(persistedState),
  ) as Partial<ReactPersistedState>
  const persistedPresets = Array.isArray(persisted.reactPresets)
    ? removeRetiredReactPresets(persisted.reactPresets)
    : undefined
  const reactPresets = normalizeCinematicPresetCollection(
    removeRetiredReactPresets(mergeCollectionsById(currentState.reactPresets, persistedPresets)),
  )
  sanitizeReactPresetFavorites(
    reactPresets
      .filter(preset => !RETIRED_NEON_LATTICE_BUILT_IN_PRESET_IDS.has(preset.id))
      .map(preset => preset.id),
  )
  const performancePads = normalizeLockedLaserDmxPadAssignments(clearRetiredReactPresetPadAssignments(
    mergeCollectionsById(currentState.performancePads, persisted.performancePads),
  ))
  const cinematicConfigsByPresetId = normalizeCinematicConfigOverrides(
    persisted.cinematicConfigsByPresetId ?? currentState.cinematicConfigsByPresetId,
    reactPresets,
  )
  const cinematicSeedLocksByPresetId = normalizeCinematicSeedLocks(
    persisted.cinematicSeedLocksByPresetId ?? currentState.cinematicSeedLocksByPresetId,
    reactPresets,
  )
  const persistedUiMode = persisted.cinematicWorldsUiMode ?? currentState.cinematicWorldsUiMode
  const cinematicWorldsUiMode: CinematicWorldsUiMode = persistedUiMode === 'advanced' ? 'advanced' : 'simple'
  const merged = {
    ...currentState,
    ...persisted,
    reactPresets,
    performancePads,
    cinematicConfigsByPresetId,
    cinematicSeedLocksByPresetId,
    cinematicWorldsUiMode,
    pixGridState: normalizePixGridState(persisted.pixGridState ?? currentState.pixGridState),
    pixGridActionCuesByTrackId: normalizePixGridActionCueMap(
      persisted.pixGridActionCuesByTrackId ?? currentState.pixGridActionCuesByTrackId,
    ),
    canvasEngineSettings: normalizeCanvasEngineSettings(
      persisted.canvasEngineSettings ?? currentState.canvasEngineSettings,
    ),
    selectedCanvasPresetId: normalizeCanvasPresetId(
      persisted.selectedCanvasPresetId ?? currentState.selectedCanvasPresetId,
    ),
    canvasPresetSettings: normalizeCanvasPresetSettings(
      persisted.canvasPresetSettings ?? currentState.canvasPresetSettings,
    ),
    canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(
      persisted.canvasOrchestrationSettings ?? currentState.canvasOrchestrationSettings,
    ),
    soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings(
      persisted.soundDrawingPerformanceSettings ?? currentState.soundDrawingPerformanceSettings,
    ),
    canvasPresetOverride: normalizeCanvasPresetOverride(
      persisted.canvasPresetOverride ?? currentState.canvasPresetOverride,
      normalizeCanvasPresetId(persisted.selectedCanvasPresetId ?? currentState.selectedCanvasPresetId),
    ),
    soundDrawingLayersByTrackId: normalizeSoundDrawingLayersByTrackId(
      persisted.soundDrawingLayersByTrackId ?? currentState.soundDrawingLayersByTrackId,
    ),
    soundDrawingClipsByTrackId: normalizeSoundDrawingClipsByTrackId(
      persisted.soundDrawingClipsByTrackId ?? currentState.soundDrawingClipsByTrackId,
    ),
    laserDmxSettings: (() => {
      const legacyRig = normalizeLaserDmxSettings(persisted.laserDmxSettings ?? currentState.laserDmxSettings)
      const matrix = normalizeLaserDmxBeamMatrixSettings(persisted.laserDmxBeamMatrix ?? currentState.laserDmxBeamMatrix)
      return normalizeLaserDmxSettings({
        ...legacyRig,
        productionCues: migrateLegacyBeamMatrixCues(matrix.cues ?? [], legacyRig.productionCues ?? []),
      })
    })(),
    laserDmxWorkspaceMode: coerceLaserDmxWorkspaceMode(persisted.laserDmxWorkspaceMode ?? currentState.laserDmxWorkspaceMode),
    laserDmxBeamMatrixAuthoringMode: coerceLaserDmxBeamMatrixAuthoringMode(
      persisted.laserDmxBeamMatrixAuthoringMode ?? currentState.laserDmxBeamMatrixAuthoringMode,
    ),
    laserDmxBeamMatrix: normalizeLaserDmxBeamMatrixSettings(
      persisted.laserDmxBeamMatrix ?? currentState.laserDmxBeamMatrix,
    ),
    laserDmxShowDirector: normalizeLaserDmxShowDirectorState(
      persisted.laserDmxShowDirector ?? currentState.laserDmxShowDirector,
    ),
    laserDmxShowDirectorPerformance: normalizeLaserDmxShowDirectorPerformanceState(
      persisted.laserDmxShowDirectorPerformance ?? currentState.laserDmxShowDirectorPerformance,
    ),
  } as ReactStoreState
  const repairedSelection = repairReactEnginePresetSelection(
    merged.activeReactPresetId,
    merged.activeReactEngineId,
    reactPresets,
  )
  const dirty = merged.activeLaserDmxBeamMatrixPresetId
    ? isLaserDmxBeamMatrixPresetDirty(
        merged.laserDmxBeamMatrix,
        merged.activeLaserDmxBeamMatrixPresetId,
      )
    : merged.laserDmxBeamMatrixPresetDirty
  const activePixGridPreset = repairedSelection.activeReactEngineId === 'pixGrid'
    ? reactPresets.find(preset => preset.id === repairedSelection.activeReactPresetId && preset.engine === 'pixGrid') ?? null
    : null
  const needsPixGridArtworkMigration = merged.pixGridState.layers.length === 0
  const pixGridState = activePixGridPreset && (
    merged.pixGridState.selectedPresetId !== activePixGridPreset.id || needsPixGridArtworkMigration
  )
    ? applyPixGridPresetSettings(merged.pixGridState, activePixGridPreset.id, activePixGridPreset.pixGridSettings)
    : normalizePixGridState(merged.pixGridState)

  return {
    ...merged,
    ...repairedSelection,
    pixGridState,
    oscillatorSettings: normalizeOscillatorSettings({
      ...DEFAULT_OSCILLATOR_SETTINGS,
      ...merged.oscillatorSettings,
    }),
    laserDmxBeamMatrixPresetDirty: dirty,
    canvasEngineSettings: createCanvasEngineSettingsForPersistence(merged.canvasEngineSettings),
    canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(merged.canvasOrchestrationSettings),
    canvasPresetOverride: merged.canvasEngineSettings.autoSelectEnabled || merged.canvasPresetOverride?.source !== 'auto'
      ? merged.canvasPresetOverride
      : null,
    canvasMediaItems: [],
    canvasMediaTimingById: normalizeCanvasMediaTimingById(merged.canvasMediaTimingById),
    selectedCanvasMediaId: merged.selectedCanvasMediaId ?? merged.canvasEngineSettings.selectedMediaId ?? null,
    activeCanvasMediaId: merged.activeCanvasMediaId ?? merged.selectedCanvasMediaId ?? merged.canvasEngineSettings.selectedMediaId ?? null,
    canvasVideoRestartRevision: currentState.canvasVideoRestartRevision,
    laserDmxShowDirectorUndoStack: [],
    laserDmxShowDirectorRedoStack: [],
    laserDmxShowDirectorHistoryTransaction: null,
    pixGridUndoStack: [],
    pixGridRedoStack: [],
    pixGridHistoryTransaction: null,
    performanceActionEvent: null,
    performanceActionEvents: [],
    performanceActionSeq: currentState.performanceActionSeq,
    performanceActionToggleStates: {},
  }
}

export const reactPersistStorage = createSplitPersistStorage<Record<string, unknown>>({
  projectKeys: REACT_PROJECT_STATE_KEYS,
  onStatusChange: handleReactPersistenceStatus,
})

export const useReactStore = create<ReactStoreState>()(
  persist(
    (set, get) => ({
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
      reactPresets: DEFAULT_REACT_PRESETS,
      pixGridState: createDefaultPixGridState(),
      pixGridUndoStack: [],
      pixGridRedoStack: [],
      pixGridHistoryTransaction: null,
      cinematicConfigsByPresetId: {},
      cinematicSeedLocksByPresetId: {},
      cinematicWorldsUiMode: 'simple',
      canvasEngineSettings: { ...DEFAULT_CANVAS_ENGINE_SETTINGS },
      canvasMediaItems: [],
      canvasMediaTimingById: {},
      selectedCanvasMediaId: null,
      activeCanvasMediaId: null,
      selectedCanvasPresetId: DEFAULT_CANVAS_PRESET_ID,
      canvasPresetSettings: { ...DEFAULT_CANVAS_PRESET_SETTINGS },
      canvasPresetOverride: DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
      canvasVideoRestartRevision: 0,
      canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS),
      manualTrackSectionsByTrackId: {},
      selectedSectionId: null,
      selectedSectionByTrackId: {},
      suppressedAutoSectionsByTrackId: {},
      presetAutomationCuesByTrackId: {},
      pixGridActionCuesByTrackId: {},
      soundDrawingLayersByTrackId: {},
      soundDrawingClipsByTrackId:  {},
      performancePads: DEFAULT_PERFORMANCE_PADS,
      activePadId: null,
      oscillatorSettings: DEFAULT_OSCILLATOR_SETTINGS,
      soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS),
      soundDrawingTrailResetRevision: 0,
      oscillatorGlyphAssets: [],
      oscillatorGlyphPointCache: {},
      oscillatorFontAssets: [],
      oscillatorTextPointCache: {},
      fontSelectPending:  null,
      fontSelectError:    null,
      fontRemovePending:  null,
      fontRemoveError:    null,
      fontUploadPending: false,
      fontUploadError:   null,
      fontsLoadState:    'idle',
      fontLoadError:     null,
      glyphLostNotice: null,
      performanceActionEvent:         null,
      performanceActionEvents:        [],
      performanceActionSeq:           0,
      performanceActionToggleStates:  {},
      laserDmxSettings:               ensureProductionLookCompatibility(createDefaultLaserDmxSettings()),
      selectedLaserDmxProductionCueId: null,
      laserDmxWorkspaceMode:  'beamMatrix',
      laserDmxBeamMatrixAuthoringMode: DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
      laserDmxBeamMatrix:     createDefaultLaserDmxBeamMatrixSettings(),
      laserDmxShowDirector:   createDefaultLaserDmxShowDirectorState(),
      laserDmxShowDirectorPerformance: createDefaultLaserDmxShowDirectorPerformanceState(),
      laserDmxShowDirectorUndoStack: [],
      laserDmxShowDirectorRedoStack: [],
      laserDmxShowDirectorHistoryTransaction: null,
      activeLaserDmxBeamMatrixPresetId: null,
      laserDmxBeamMatrixPresetDirty:    false,
      reactIntensity:       0.7,
      reactMotion:          0.5,
      reactGlow:            0.65,
      reactBassReactivity:  0.8,
      reactTrailDecay:      0.08,
      reactFogDensity:      0.5,
      reactParticleDensity: 0.5,
      performancePadTransition: null,

      setPixGridState: (patch) => set((state) => {
        const merged: PixGridState = { ...state.pixGridState, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'pixelOverrides')) {
          merged.scenes = state.pixGridState.scenes.map(scene => scene.id === state.pixGridState.selectedSceneId
            ? { ...scene, pixelOverrides: patch.pixelOverrides ?? [] }
            : scene)
        }
        return { pixGridState: normalizePixGridState(merged) }
      }),

      resetPixGridState: () => set((state) => ({
        pixGridState: resetPixGridStatePreservingSelection(state.pixGridState),
      })),

      setPixGridAuthoringOverlayVisible: (visible) => set((state) => ({
        pixGridState: normalizePixGridState({
          ...state.pixGridState,
          authoringOverlayVisible: visible,
        }),
      })),

      applyPixGridAuthoringState: (nextState) => set(state => buildPixGridHistoryPatch(state, nextState)),

      beginPixGridHistoryTransaction: () => set(state => state.pixGridHistoryTransaction
        ? {}
        : { pixGridHistoryTransaction: normalizePixGridState(state.pixGridState) }),

      commitPixGridHistoryTransaction: () => set(state => {
        const base = state.pixGridHistoryTransaction
        if (!base) return {}
        const current = normalizePixGridState(state.pixGridState)
        if (pixGridSnapshotsEqual(base, current)) return { pixGridHistoryTransaction: null }
        return {
          pixGridUndoStack: trimPixGridHistory([...state.pixGridUndoStack, base]),
          pixGridRedoStack: [],
          pixGridHistoryTransaction: null,
        }
      }),

      cancelPixGridHistoryTransaction: () => set(state => state.pixGridHistoryTransaction
        ? { pixGridState: normalizePixGridState(state.pixGridHistoryTransaction), pixGridHistoryTransaction: null }
        : {}),

      undoPixGridEdit: () => set(state => {
        const previous = state.pixGridUndoStack[state.pixGridUndoStack.length - 1]
        if (!previous) return {}
        const current = normalizePixGridState(state.pixGridState)
        const restored = normalizePixGridState({
          ...previous,
          authoringOverlayVisible: current.authoringOverlayVisible,
          editorTool: current.editorTool,
          editor: { ...previous.editor, zoom: current.editor.zoom, panX: current.editor.panX, panY: current.editor.panY },
        })
        return {
          pixGridState: restored,
          pixGridUndoStack: state.pixGridUndoStack.slice(0, -1),
          pixGridRedoStack: trimPixGridHistory([...state.pixGridRedoStack, current]),
          pixGridHistoryTransaction: null,
        }
      }),

      redoPixGridEdit: () => set(state => {
        const next = state.pixGridRedoStack[state.pixGridRedoStack.length - 1]
        if (!next) return {}
        const current = normalizePixGridState(state.pixGridState)
        const restored = normalizePixGridState({
          ...next,
          authoringOverlayVisible: current.authoringOverlayVisible,
          editorTool: current.editorTool,
          editor: { ...next.editor, zoom: current.editor.zoom, panX: current.editor.panX, panY: current.editor.panY },
        })
        return {
          pixGridState: restored,
          pixGridUndoStack: trimPixGridHistory([...state.pixGridUndoStack, current]),
          pixGridRedoStack: state.pixGridRedoStack.slice(0, -1),
          pixGridHistoryTransaction: null,
        }
      }),

      setCinematicConfigForPreset: (presetId, config) =>
        set((state) => {
          const preset = state.reactPresets.find(candidate => candidate.id === presetId && candidate.engine === 'cinematicPortal')
          if (!preset) return {}
          const normalized = normalizeCinematicWorldConfig(config)
          const previous = resolveCinematicConfigForPreset(preset, state.cinematicConfigsByPresetId)
          const worldChanged = state.activeReactPresetId === presetId && previous?.worldMode !== normalized.worldMode
          return {
            cinematicConfigsByPresetId: {
              ...state.cinematicConfigsByPresetId,
              [presetId]: normalized,
            },
            ...(worldChanged ? clearPerformanceActionPatch() : {}),
          }
        }),

      clearCinematicConfigForPreset: (presetId) =>
        set((state) => {
          const preset = state.reactPresets.find(candidate => candidate.id === presetId && candidate.engine === 'cinematicPortal')
          const previous = resolveCinematicConfigForPreset(preset, state.cinematicConfigsByPresetId)
          const { [presetId]: _removed, ...rest } = state.cinematicConfigsByPresetId
          void _removed
          const next = resolveCinematicConfigForPreset(preset, rest)
          const worldChanged = state.activeReactPresetId === presetId && previous?.worldMode !== next?.worldMode
          return {
            cinematicConfigsByPresetId: rest,
            ...(worldChanged ? clearPerformanceActionPatch() : {}),
          }
        }),

      setCinematicSeedLocked: (presetId, locked) =>
        set((state) => state.reactPresets.some(preset => preset.id === presetId && preset.engine === 'cinematicPortal')
          ? {
              cinematicSeedLocksByPresetId: {
                ...state.cinematicSeedLocksByPresetId,
                [presetId]: locked,
              },
            }
          : {}),

      setCinematicWorldsUiMode: (mode) => set({ cinematicWorldsUiMode: mode }),

      setCanvasOrchestrationSettings: (patch) => set((state) => {
        const poolChanged = Object.prototype.hasOwnProperty.call(patch, 'mediaPoolIds')
          || Object.prototype.hasOwnProperty.call(patch, 'mediaRolesById')
          || Object.prototype.hasOwnProperty.call(patch, 'mediaLocksByLayer')
        return {
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            ...patch,
            poolRevision: poolChanged
              ? state.canvasOrchestrationSettings.poolRevision + 1
              : patch.poolRevision ?? state.canvasOrchestrationSettings.poolRevision,
          }),
        }
      }),

      toggleCanvasMediaPoolItem: (mediaId, selected) => set((state) => {
        if (typeof mediaId !== 'string' || !mediaId.trim()) return {}
        const id = mediaId.trim()
        const current = state.canvasOrchestrationSettings.mediaPoolIds
        const shouldInclude = selected ?? !current.includes(id)
        const mediaPoolIds = shouldInclude
          ? uniqueCanvasMediaIds([...current, id])
          : current.filter(candidate => candidate !== id)
        if (mediaPoolIds.length === current.length && mediaPoolIds.every((candidate, index) => candidate === current[index])) return {}
        const { [id]: removedRoles, ...mediaRolesById } = state.canvasOrchestrationSettings.mediaRolesById
        void removedRoles
        const mediaLocksByLayer = Object.fromEntries(
          Object.entries(state.canvasOrchestrationSettings.mediaLocksByLayer)
            .filter(([, lockedId]) => shouldInclude || lockedId !== id),
        )
        return {
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            mediaPoolIds,
            mediaRolesById: shouldInclude ? state.canvasOrchestrationSettings.mediaRolesById : mediaRolesById,
            mediaLocksByLayer,
            poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
          }),
        }
      }),

      setCanvasMediaRoles: (mediaId, roles) => set((state) => {
        if (typeof mediaId !== 'string' || !mediaId.trim()) return {}
        const id = mediaId.trim()
        const validRoles = [...new Set(roles.filter((role): role is CanvasMediaRole => CANVAS_MEDIA_ROLES.includes(role)))]
        return {
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            mediaPoolIds: uniqueCanvasMediaIds([...state.canvasOrchestrationSettings.mediaPoolIds, id]),
            mediaRolesById: {
              ...state.canvasOrchestrationSettings.mediaRolesById,
              [id]: validRoles,
            },
            poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
          }),
        }
      }),

      setCanvasLayerLock: (role, locked) => set((state) => ({
        canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
          ...state.canvasOrchestrationSettings,
          layerLocks: {
            ...state.canvasOrchestrationSettings.layerLocks,
            [role]: locked,
          },
        }),
      })),

      setCanvasMediaLock: (role, mediaId) => set((state) => {
        const nextLocks = { ...state.canvasOrchestrationSettings.mediaLocksByLayer }
        if (typeof mediaId === 'string' && mediaId.trim()) nextLocks[role] = mediaId.trim()
        else delete nextLocks[role]
        return {
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            mediaLocksByLayer: nextLocks,
            poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
          }),
        }
      }),

      setCanvasOrchestrationLock: (lock, locked) => set((state) => ({
        canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
          ...state.canvasOrchestrationSettings,
          globalLocks: {
            ...state.canvasOrchestrationSettings.globalLocks,
            [lock]: locked,
          },
        }),
      })),

      resetCanvasOrchestration: () => set((state) => ({
        canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
          ...DEFAULT_CANVAS_ORCHESTRATION_SETTINGS,
          mediaPoolIds: state.canvasOrchestrationSettings.mediaPoolIds,
          mediaRolesById: state.canvasOrchestrationSettings.mediaRolesById,
          poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
        }),
      })),

      setCanvasEngineSettings: (patch) => set((state) => ({
        ...repairCanvasRuntimeState({
          ...state,
          canvasEngineSettings: normalizeCanvasEngineSettings({
            ...state.canvasEngineSettings,
            ...patch,
          }),
        }),
        canvasPresetOverride: patch.autoSelectEnabled === false && state.canvasPresetOverride?.source === 'auto'
          ? null
          : state.canvasPresetOverride,
      })),

      resetCanvasEngineSettings: () => set((state) => {
        revokeCanvasMediaObjectUrls(state.canvasMediaItems)
        return {
          canvasEngineSettings: { ...DEFAULT_CANVAS_ENGINE_SETTINGS },
          canvasMediaItems: [],
          canvasMediaTimingById: {},
          selectedCanvasMediaId: null,
          activeCanvasMediaId: null,
          selectedCanvasPresetId: DEFAULT_CANVAS_PRESET_ID,
          canvasPresetSettings: { ...DEFAULT_CANVAS_PRESET_SETTINGS },
          canvasPresetOverride: DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS),
          canvasVideoRestartRevision: state.canvasVideoRestartRevision + 1,
        }
      }),

      setCanvasAutoSelectEnabled: (enabled) => set((state) => ({
        canvasEngineSettings: normalizeCanvasEngineSettings({
          ...state.canvasEngineSettings,
          autoSelectEnabled: enabled,
        }),
        canvasPresetOverride: !enabled && state.canvasPresetOverride?.source === 'auto'
          ? null
          : state.canvasPresetOverride,
      })),

      applyCanvasAutoSelection: ({ presetId, mediaId, label }) => set((state) => {
        if (!state.canvasEngineSettings.autoSelectEnabled) return {}

        const manualPresetOverrideActive = state.canvasPresetOverride?.source === 'manual'
        const preset = !manualPresetOverrideActive && presetId
          ? CANVAS_PRESET_BY_ID[presetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
          : null
        const manualMediaOverrideId = state.canvasEngineSettings.manualMediaOverrideId
        const manualMediaOverrideValid = typeof manualMediaOverrideId === 'string' && manualMediaOverrideId.trim().length > 0
        const nextMediaId = manualMediaOverrideValid
          ? state.activeCanvasMediaId
          : typeof mediaId === 'string' && mediaId.trim().length > 0
            ? mediaId
            : state.activeCanvasMediaId
        const mediaChanged = Boolean(!manualMediaOverrideValid && nextMediaId && nextMediaId !== state.activeCanvasMediaId)
        const mediaPatch = mediaChanged && nextMediaId
          ? {
              selectedCanvasMediaId: nextMediaId,
              activeCanvasMediaId: nextMediaId,
              canvasEngineSettings: normalizeCanvasEngineSettings({
                ...state.canvasEngineSettings,
                selectedMediaId: nextMediaId,
                mediaIds: uniqueCanvasMediaIds([...state.canvasEngineSettings.mediaIds, nextMediaId]),
                rotation: 0,
              }),
            }
          : {}

        const nextLabel = label ?? 'Auto-selected preset'
        const presetChanged = Boolean(
          preset && (
            state.selectedCanvasPresetId !== preset.id ||
            state.canvasPresetOverride?.source !== 'auto' ||
            state.canvasPresetOverride.label !== nextLabel
          ),
        )

        if (!presetChanged && !mediaChanged) return {}

        return {
          ...(preset
            ? {
                selectedCanvasPresetId: preset.id,
                canvasPresetSettings: normalizeCanvasPresetSettings(preset.settings),
                canvasPresetOverride: {
                  source: 'auto' as const,
                  presetId: preset.id,
                  label: nextLabel,
                },
              }
            : {}),
          ...mediaPatch,
        }
      }),

      clearCanvasPresetOverride: () => set((state) => ({
        canvasPresetOverride: state.canvasPresetOverride?.source === 'manual' ? null : state.canvasPresetOverride,
      })),

      clearCanvasMediaOverride: () => set((state) => ({
        canvasEngineSettings: normalizeCanvasEngineSettings({
          ...state.canvasEngineSettings,
          manualMediaOverrideId: null,
        }),
      })),

      selectCanvasPreset: (id) => set(() => {
        const preset = CANVAS_PRESET_BY_ID[id] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
        return {
          selectedCanvasPresetId: preset.id,
          canvasPresetSettings: normalizeCanvasPresetSettings(preset.settings),
          canvasPresetOverride: {
            source: 'manual' as const,
            presetId: preset.id,
            label: 'User-selected preset',
          },
        }
      }),

      setCanvasPresetSettings: (patch) => set((state) => ({
        canvasPresetSettings: normalizeCanvasPresetSettings({
          ...state.canvasPresetSettings,
          ...patch,
        }),
        canvasPresetOverride: {
          source: 'manual' as const,
          presetId: state.selectedCanvasPresetId,
          label: 'User-adjusted preset',
        },
      })),

      resetCanvasPresetSettings: () => set((state) => {
        const preset = CANVAS_PRESET_BY_ID[state.selectedCanvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
        return {
          canvasPresetSettings: normalizeCanvasPresetSettings(preset.settings),
          canvasPresetOverride: {
            source: 'manual' as const,
            presetId: preset.id,
            label: 'User-selected preset',
          },
        }
      }),

      addCanvasMediaItems: (items) => set((state) => {
        if (items.length === 0) return {}

        const existingIds = new Set(state.canvasMediaItems.map(item => item.id))
        const nextIds = new Set(existingIds)
        const freshItems: CanvasMediaItem[] = []
        const discardedItems: CanvasMediaItem[] = []
        items.forEach(item => {
          if (!isCanvasMediaItemRuntimeUsable(item) || nextIds.has(item.id)) {
            discardedItems.push(item)
            return
          }
          nextIds.add(item.id)
          freshItems.push(item)
        })
        revokeCanvasMediaObjectUrls(discardedItems)
        if (freshItems.length === 0) return repairCanvasRuntimeState(state)

        const nextItems = [...state.canvasMediaItems, ...freshItems]
        const nextActiveId = state.activeCanvasMediaId ?? freshItems[0].id
        const nextSelectedId = state.selectedCanvasMediaId ?? nextActiveId
        const activatedFreshItem = state.activeCanvasMediaId === null && nextActiveId !== null

        return repairCanvasRuntimeState({
          ...state,
          canvasMediaItems: nextItems,
          selectedCanvasMediaId: nextSelectedId,
          activeCanvasMediaId: nextActiveId,
          canvasEngineSettings: activatedFreshItem
            ? normalizeCanvasEngineSettings({ ...state.canvasEngineSettings, rotation: 0 })
            : state.canvasEngineSettings,
        })
      }),

      selectCanvasMediaItem: (id, options) => set((state) => {
        if (typeof id !== 'string' || id.trim().length === 0) return repairCanvasRuntimeState(state)
        const manualMediaOverrideId = state.canvasEngineSettings.manualMediaOverrideId
        const manualMediaOverrideValid = typeof manualMediaOverrideId === 'string' && manualMediaOverrideId.trim().length > 0
        if (options?.manual === false && manualMediaOverrideValid) return repairCanvasRuntimeState(state)
        const nextState = repairCanvasRuntimeState({
          ...state,
          selectedCanvasMediaId: id,
          activeCanvasMediaId: id,
          canvasEngineSettings: normalizeCanvasEngineSettings({
            ...state.canvasEngineSettings,
            selectedMediaId: id,
            mediaIds: uniqueCanvasMediaIds([...state.canvasEngineSettings.mediaIds, ...state.canvasMediaItems.map(item => item.id), id]),
            manualMediaOverrideId: options?.manual === false ? null : id,
            rotation: 0,
          }),
        })
        if (options?.manual === false || state.canvasOrchestrationSettings.mediaPoolIds.includes(id)) return nextState
        return {
          ...nextState,
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            mediaPoolIds: uniqueCanvasMediaIds([...state.canvasOrchestrationSettings.mediaPoolIds, id]),
            poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
          }),
        }
      }),

      restartCanvasVideo: () => set((state) => ({
        canvasVideoRestartRevision: state.canvasVideoRestartRevision + 1,
      })),

      setCanvasMediaTiming: (mediaId, patch) => set((state) => {
        if (typeof mediaId !== 'string' || mediaId.trim().length === 0) return {}
        const legacyItem = state.canvasMediaItems.find(item => item.id === mediaId) ?? null
        const timing = normalizeCanvasVideoTimingSettings({
          ...DEFAULT_CANVAS_VIDEO_TIMING_SETTINGS,
          ...(state.canvasMediaTimingById[mediaId] ?? legacyItem?.timing ?? {}),
          ...patch,
        })
        return {
          canvasMediaTimingById: {
            ...state.canvasMediaTimingById,
            [mediaId]: timing,
          },
          canvasMediaItems: state.canvasMediaItems.map(item => (
            item.id === mediaId ? { ...item, timing } : item
          )),
        }
      }),

      removeCanvasMediaItem: (id) => set((state) => {
        const removeIndex = state.canvasMediaItems.findIndex(item => item.id === id)
        if (removeIndex < 0) return repairCanvasRuntimeState(state)
        revokeCanvasMediaObjectUrl(state.canvasMediaItems[removeIndex])

        const nextItems = state.canvasMediaItems.filter(item => item.id !== id)
        const fallbackItem = nextItems[removeIndex] ?? nextItems[removeIndex - 1] ?? nextItems[0] ?? null
        const nextSelectedId = state.selectedCanvasMediaId === id ? fallbackItem?.id ?? null : state.selectedCanvasMediaId
        const nextActiveId = state.activeCanvasMediaId === id ? fallbackItem?.id ?? null : state.activeCanvasMediaId

        const { [id]: _removedTiming, ...nextTimingById } = state.canvasMediaTimingById
        void _removedTiming

        return repairCanvasRuntimeState({
          ...state,
          canvasMediaItems: nextItems,
          canvasMediaTimingById: nextTimingById,
          selectedCanvasMediaId: nextSelectedId,
          activeCanvasMediaId: nextActiveId,
          canvasEngineSettings: normalizeCanvasEngineSettings({
            ...state.canvasEngineSettings,
            selectedMediaId: nextActiveId,
            mediaIds: nextItems.map(item => item.id),
            manualMediaOverrideId: state.canvasEngineSettings.manualMediaOverrideId === id
              ? null
              : state.canvasEngineSettings.manualMediaOverrideId,
          }),
          canvasVideoRestartRevision: state.canvasVideoRestartRevision + 1,
          canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings({
            ...state.canvasOrchestrationSettings,
            mediaPoolIds: state.canvasOrchestrationSettings.mediaPoolIds.filter(mediaId => mediaId !== id),
            mediaRolesById: Object.fromEntries(
              Object.entries(state.canvasOrchestrationSettings.mediaRolesById).filter(([mediaId]) => mediaId !== id),
            ),
            mediaLocksByLayer: Object.fromEntries(
              Object.entries(state.canvasOrchestrationSettings.mediaLocksByLayer).filter(([, mediaId]) => mediaId !== id),
            ),
            poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
          }),
        })
      }),

      clearCanvasMediaItems: () => set((state) => {
        const removedIds = new Set(state.canvasMediaItems.map(item => item.id))
        revokeCanvasMediaObjectUrls(state.canvasMediaItems)
        const mediaPoolIds = state.canvasOrchestrationSettings.mediaPoolIds.filter(id => !removedIds.has(id))
        const mediaRolesById = Object.fromEntries(
          Object.entries(state.canvasOrchestrationSettings.mediaRolesById).filter(([id]) => !removedIds.has(id)),
        )
        const mediaLocksByLayer = Object.fromEntries(
          Object.entries(state.canvasOrchestrationSettings.mediaLocksByLayer).filter(([, id]) => !removedIds.has(id)),
        )
        const orchestrationChanged = mediaPoolIds.length !== state.canvasOrchestrationSettings.mediaPoolIds.length
          || Object.keys(mediaRolesById).length !== Object.keys(state.canvasOrchestrationSettings.mediaRolesById).length
          || Object.keys(mediaLocksByLayer).length !== Object.keys(state.canvasOrchestrationSettings.mediaLocksByLayer).length
        return {
          canvasMediaItems: [],
          canvasMediaTimingById: {},
          selectedCanvasMediaId: null,
          activeCanvasMediaId: null,
          canvasVideoRestartRevision: state.canvasVideoRestartRevision + 1,
          canvasEngineSettings: normalizeCanvasEngineSettings({
            ...state.canvasEngineSettings,
            selectedMediaId: null,
            mediaIds: [],
            manualMediaOverrideId: null,
          }),
          canvasOrchestrationSettings: orchestrationChanged
            ? normalizeCanvasOrchestrationSettings({
                ...state.canvasOrchestrationSettings,
                mediaPoolIds,
                mediaRolesById,
                mediaLocksByLayer,
                poolRevision: state.canvasOrchestrationSettings.poolRevision + 1,
              })
            : state.canvasOrchestrationSettings,
        }
      }),

      setActiveReactPresetId: (id) =>
        set((s) => {
          if (id != null) {
            const preset = s.reactPresets.find(p => p.id === id && isSelectableReactEngineId(p.engine))
            return preset
              ? { ...buildPresetPatchForState(preset, s), performancePadTransition: null }
              : {}
          }

          if (isStandaloneReactEngineId(s.activeReactEngineId)) {
            return { activeReactPresetId: null, performancePadTransition: null, ...clearPerformanceActionPatch() }
          }

          const fallback = s.reactPresets.find(p => p.engine === s.activeReactEngineId && isSelectableReactEngineId(p.engine))
          return fallback
            ? { ...buildPresetPatchForState(fallback, s), performancePadTransition: null }
            : {
                activeReactPresetId: INITIAL_PRESET_ID,
                activeReactEngineId: INITIAL_ENGINE_ID,
                performancePadTransition: null,
                ...clearPerformanceActionPatch(),
              }
        }),

      setActiveReactEngineId: (id) => get().selectReactEngine(id),

      selectReactEngine: (engineId) =>
        set((s) => {
          const pixGridCleanup = engineId === 'pixGrid'
            ? {}
            : {
                pixGridState: normalizePixGridState({
                  ...s.pixGridState,
                  authoringOverlayVisible: false,
                }),
                pixGridHistoryTransaction: null,
              }

          if (!isSelectableReactEngineId(engineId)) {
            const fallback = s.reactPresets.find(
              preset => preset.id === INITIAL_PRESET_ID && isSelectableReactEngineId(preset.engine),
            )
            return fallback
              ? { ...buildPresetPatchForState(fallback, s), performancePadTransition: null, ...pixGridCleanup }
              : {
                  activeReactEngineId: INITIAL_ENGINE_ID,
                  activeReactPresetId: INITIAL_PRESET_ID,
                  performancePadTransition: null,
                  ...clearPerformanceActionPatch(),
                  ...pixGridCleanup,
                }
          }

          // Shader Pads and CANVAS are standalone shells with no React presets.
          if (isStandaloneReactEngineId(engineId)) {
            return {
              activeReactEngineId: engineId,
              activeReactPresetId: null,
              performancePadTransition: null,
              ...clearPerformanceActionPatch(),
              ...pixGridCleanup,
            }
          }

          const current = s.activeReactPresetId
            ? s.reactPresets.find(
                preset => preset.id === s.activeReactPresetId && isSelectableReactEngineId(preset.engine),
              )
            : null
          if (current?.engine === engineId) {
            return { activeReactEngineId: engineId, performancePadTransition: null, ...pixGridCleanup }
          }

          const preset = s.reactPresets.find(
            candidate => candidate.engine === engineId && isSelectableReactEngineId(candidate.engine),
          )
          if (preset) return { ...buildPresetPatchForState(preset, s), performancePadTransition: null, ...pixGridCleanup }

          const fallback = s.reactPresets.find(
            candidate => candidate.id === INITIAL_PRESET_ID && isSelectableReactEngineId(candidate.engine),
          )
          return fallback
            ? { ...buildPresetPatchForState(fallback, s), performancePadTransition: null, ...pixGridCleanup }
            : {
                activeReactEngineId: INITIAL_ENGINE_ID,
                activeReactPresetId: INITIAL_PRESET_ID,
                performancePadTransition: null,
                ...clearPerformanceActionPatch(),
                ...pixGridCleanup,
              }
        }),

      selectReactPreset: (id) =>
        set((s) => {
          const safePresetId = replaceLockedLaserDmxPresetId(id) ?? id
          const preset = s.reactPresets.find((p) => p.id === safePresetId && isSelectableReactEngineId(p.engine))
          const selected = preset
            ?? s.reactPresets.find(candidate => candidate.id === INITIAL_PRESET_ID && isSelectableReactEngineId(candidate.engine))
          if (!selected) return {}
          const pixGridCleanup = selected.engine === 'pixGrid'
            ? {}
            : {
                pixGridState: normalizePixGridState({
                  ...s.pixGridState,
                  authoringOverlayVisible: false,
                }),
                pixGridHistoryTransaction: null,
              }
          return { ...buildPresetPatchForState(selected, s), performancePadTransition: null, ...pixGridCleanup }
        }),

      updateReactPresetParams: (id, patch) =>
        set((s) => ({
          reactPresets: s.reactPresets.map((p) =>
            p.id === id ? { ...p, params: { ...p.params, ...patch } } : p,
          ),
        })),

      setReactIntensity:       (v) => set({ reactIntensity: v, performancePadTransition: null }),
      setReactMotion:          (v) => set({ reactMotion: v, performancePadTransition: null }),
      setReactGlow:            (v) => set({ reactGlow: v, performancePadTransition: null }),
      setReactBassReactivity:  (v) => set({ reactBassReactivity: v, performancePadTransition: null }),
      setReactTrailDecay:      (v) => set({ reactTrailDecay: v, performancePadTransition: null }),
      setReactFogDensity:      (v) => set({ reactFogDensity: v, performancePadTransition: null }),
      setReactParticleDensity: (v) => set({ reactParticleDensity: v, performancePadTransition: null }),

      setSelectedSectionId: (id) => set({ selectedSectionId: id }),

      setSelectedSectionIdForTrack: (trackId, sectionId) =>
        set((s) => {
          if (trackId == null) return {}
          return { selectedSectionByTrackId: { ...s.selectedSectionByTrackId, [trackId]: sectionId } }
        }),

      suppressAutoSection: (trackId, sectionId) =>
        set((s) => {
          const existing = s.suppressedAutoSectionsByTrackId[trackId] ?? []
          if (existing.includes(sectionId)) return {}
          const isSelectedForTrack = s.selectedSectionByTrackId[trackId] === sectionId
          return {
            suppressedAutoSectionsByTrackId: {
              ...s.suppressedAutoSectionsByTrackId,
              [trackId]: [...existing, sectionId],
            },
            ...(isSelectedForTrack && {
              selectedSectionByTrackId: { ...s.selectedSectionByTrackId, [trackId]: null },
            }),
          }
        }),

      restoreAutoSection: (trackId, sectionId) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          const withoutOverride = existing.filter(
            sec => !(sec.id === sectionId && sec.source === 'user-edited-auto'),
          )
          const suppressed = s.suppressedAutoSectionsByTrackId[trackId] ?? []
          const withoutSuppressed = suppressed.filter(id => id !== sectionId)
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: withoutOverride,
            },
            suppressedAutoSectionsByTrackId: {
              ...s.suppressedAutoSectionsByTrackId,
              [trackId]: withoutSuppressed,
            },
          }
        }),

      getManualSectionsForTrack: (trackId) =>
        get().manualTrackSectionsByTrackId[trackId] ?? [],

      addManualSection: (trackId, section) =>
        set((s) => ({
          manualTrackSectionsByTrackId: {
            ...s.manualTrackSectionsByTrackId,
            [trackId]: [...(s.manualTrackSectionsByTrackId[trackId] ?? []), sanitizeLiveTrackSection(section)],
          },
        })),

      updateManualSection: (trackId, id, patch) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: existing.map((sec) => sec.id === id ? sanitizeLiveTrackSection({ ...sec, ...patch }) : sec),
            },
          }
        }),

      removeManualSection: (trackId, id) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          const isSelectedForTrack = s.selectedSectionByTrackId[trackId] === id
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: existing.filter((sec) => sec.id !== id),
            },
            selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
            ...(isSelectedForTrack && {
              selectedSectionByTrackId: { ...s.selectedSectionByTrackId, [trackId]: null },
            }),
          }
        }),

      clearManualSectionsForTrack: (trackId) =>
        set((s) => {
          const { [trackId]: _removed, ...rest } = s.manualTrackSectionsByTrackId
          return { manualTrackSectionsByTrackId: rest }
        }),

      commitAutomaticSectionOverride: (trackId, originalSection, patch) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          const originalId = originalSection.provenance?.originalId ?? originalSection.id
          const overrideIdx = existing.findIndex(section =>
            section.id === originalSection.id
            || section.provenance?.originalId === originalId,
          )
          const replacementProvenance = {
            ...originalSection.provenance,
            authority: 'manual_replacement' as const,
            originalId,
          }
          let newSections: ReactTrackSection[]
          if (overrideIdx >= 0) {
            // Update the existing user-edited-auto entry in place and repair
            // stale automatic provenance written by previous builds.
            newSections = existing.map((sec, i) =>
              i === overrideIdx
                ? sanitizeLiveTrackSection({
                    ...sec,
                    ...patch,
                    source: 'user-edited-auto' as const,
                    provenance: {
                      ...replacementProvenance,
                      ...sec.provenance,
                      authority: 'manual_replacement' as const,
                      originalId,
                    },
                  })
                : sec,
            )
          } else {
            // Create a fresh override that inherits all original metadata while
            // explicitly taking manual-replacement authority.
            const override = sanitizeLiveTrackSection({
              ...originalSection,
              ...patch,
              source: 'user-edited-auto',
              provenance: replacementProvenance,
            })
            newSections = [...existing, override]
          }
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: newSections,
            },
          }
        }),

      setActivePadId: (id) =>
        set((s) => {
          if (!id) return { activePadId: null, performancePadTransition: null }
          const pad = s.performancePads.find((p) => p.id === id)
          if (!pad?.presetId) return { activePadId: id }
          const safePresetId = replaceLockedLaserDmxPresetId(pad.presetId) ?? pad.presetId
          const preset = s.reactPresets.find((p) => p.id === safePresetId && isSelectableReactEngineId(p.engine))
          if (!preset) return { activePadId: id, performancePadTransition: null }
          const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
          const currentTarget = getReactPresetControlValues(s)
          const from = resolvePerformancePadTransition(
            currentTarget,
            s.performancePadTransition,
            nowMs,
          )
          const presetPatch = buildPresetPatchForState(preset, s)
          const to = getPresetPatchControlValues(presetPatch)
          const durationMs = Math.max(0, pad.transitionTimeMs)

          return {
            activePadId: id,
            ...presetPatch,
            performancePadTransition: durationMs > 0
              ? { startedAtMs: nowMs, durationMs, from, to }
              : null,
          }
        }),

      updatePerformancePad: (id, patch) =>
        set((s) => {
          const requestedPresetId = patch.presetId
            ? replaceLockedLaserDmxPresetId(patch.presetId) ?? patch.presetId
            : null
          const requestedPreset = requestedPresetId
            ? s.reactPresets.find(preset => preset.id === requestedPresetId && isSelectableReactEngineId(preset.engine))
            : null
          const safePatch = 'presetId' in patch && patch.presetId
            ? requestedPreset
              ? { ...patch, presetId: requestedPreset.id }
              : { ...patch, presetId: null, label: 'Empty', color: '#3a4650' }
            : patch
          return {
            performancePads: s.performancePads.map((pad) =>
              pad.id === id ? { ...pad, ...safePatch } : pad,
            ),
          }
        }),

      setSoundDrawingPerformanceSettings: (patch) =>
        set(s => ({
          soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings({
            ...s.soundDrawingPerformanceSettings,
            ...patch,
            locks: patch.locks
              ? { ...s.soundDrawingPerformanceSettings.locks, ...patch.locks }
              : s.soundDrawingPerformanceSettings.locks,
          }),
          soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
        })),

      setSoundDrawingPerformanceLock: (key, value) =>
        set(s => ({
          soundDrawingPerformanceSettings: {
            ...s.soundDrawingPerformanceSettings,
            locks: { ...s.soundDrawingPerformanceSettings.locks, [key]: value },
          },
        })),

      resetSoundDrawingPerformanceSettings: () =>
        set(s => ({
          soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings({
            ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
            selectedShowId: s.soundDrawingPerformanceSettings.selectedShowId,
            autoPerformance: s.soundDrawingPerformanceSettings.autoPerformance,
          }),
          soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
        })),

      requestSoundDrawingTrailReset: () =>
        set(s => ({ soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 })),

      setOscillatorSettings: (patch) =>
        set((s) => {
          const newSettings = normalizeOscillatorSettings({ ...s.oscillatorSettings, ...patch })
          let newGlyphCache = s.oscillatorGlyphPointCache
          let newTextCache  = s.oscillatorTextPointCache

          // When pathResolution changes while a glyph is active, debounce the recompile so
          // slider dragging does not synchronously stall the UI on every tick.
          // The renderer uses the previous compiled points until the debounce fires.
          const hasActiveGlyph =
            (newSettings.sourceType === 'svgGlyph' && !!newSettings.selectedGlyphId) ||
            (newSettings.sourceType === 'svg'       && !!newSettings.selectedSvgId)
          if ('pathResolution' in patch && hasActiveGlyph) {
            scheduleGlyphRecompile()
          }

          // Re-prepare global and saved-layer OpenType geometry when a setting
          // that contributes to text point generation changes. Layer-specific
          // transforms and styling remain untouched.
          if (patchChangesTextGeometry(patch)) {
            newTextCache = prepareAllSoundDrawingTextPoints(
              s.oscillatorFontAssets,
              newSettings,
              s.soundDrawingLayersByTrackId,
              newTextCache,
            )
          }

          return {
            oscillatorSettings:        newSettings,
            oscillatorGlyphPointCache: newGlyphCache,
            oscillatorTextPointCache:  newTextCache,
            ...(patchNeedsSoundDrawingTrailReset(patch)
              ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 }
              : {}),
            // Clear the notice whenever the user actively changes the source type
            ...('sourceType' in patch ? { glyphLostNotice: null } : {}),
          }
        }),

      resetOscillatorSettings: () =>
        set((s) => ({
          oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS },
          soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
          oscillatorTextPointCache: prepareAllSoundDrawingTextPoints(
            s.oscillatorFontAssets,
            DEFAULT_OSCILLATOR_SETTINGS,
            s.soundDrawingLayersByTrackId,
            s.oscillatorTextPointCache,
          ),
        })),

      clearGlyphLostNotice: () => set({ glyphLostNotice: null }),

      addOscillatorGlyphAsset: (asset) =>
        set((s) => {
          if (s.oscillatorGlyphAssets.some(a => a.id === asset.id)) return {}
          // Parse immediately at upload time so the renderer never needs to.
          const res = clampRes(s.oscillatorSettings.pathResolution)
          const newCache = prepareSvgPoints(asset, res, s.oscillatorGlyphPointCache)
          return {
            oscillatorGlyphAssets: [...s.oscillatorGlyphAssets, asset],
            oscillatorGlyphPointCache: newCache,
          }
        }),

      removeOscillatorGlyphAsset: (id) =>
        set((s) => {
          // Evict all cache entries for this asset
          const newCache = { ...s.oscillatorGlyphPointCache }
          for (const key of Object.keys(newCache)) {
            if (key.startsWith(`${id}:`)) delete newCache[key]
          }
          const mediaId = getMediaIdFromSvgGlyphId(id)
          const wasLegacyActive = s.oscillatorSettings.sourceType === 'svgGlyph' &&
            s.oscillatorSettings.selectedGlyphId === id
          const wasUnifiedActive = !!mediaId && s.oscillatorSettings.sourceType === 'svg' &&
            s.oscillatorSettings.selectedSvgId === mediaId
          const wasActive = wasLegacyActive || wasUnifiedActive
          const removedName = wasActive
            ? (s.oscillatorGlyphAssets.find(a => a.id === id)?.name ?? null)
            : null
          return {
            oscillatorGlyphAssets: s.oscillatorGlyphAssets.filter(a => a.id !== id),
            oscillatorGlyphPointCache: newCache,
            oscillatorSettings: wasActive
              ? {
                  ...s.oscillatorSettings,
                  selectedGlyphId: wasLegacyActive ? null : s.oscillatorSettings.selectedGlyphId,
                  selectedSvgId: wasUnifiedActive ? null : s.oscillatorSettings.selectedSvgId,
                  sourceType: 'builtinShape',
                }
              : s.oscillatorSettings,
            glyphLostNotice: removedName,
            ...(wasActive ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 } : {}),
          }
        }),

      clearOscillatorGlyphAssets: () =>
        set((s) => ({
          oscillatorGlyphAssets: [],
          oscillatorGlyphPointCache: {},
          oscillatorSettings:
            s.oscillatorSettings.sourceType === 'svgGlyph'
              ? { ...s.oscillatorSettings, selectedGlyphId: null, sourceType: 'builtinShape' }
              : s.oscillatorSettings,
          ...(s.oscillatorSettings.sourceType === 'svgGlyph'
            ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 }
            : {}),
        })),

      selectOscillatorGlyph: (id) =>
        set((s) => {
          const asset = s.oscillatorGlyphAssets.find(a => a.id === id)
          const res = clampRes(s.oscillatorSettings.pathResolution)
          // Ensure points are prepared; handles the page-reload case where the
          // persisted asset has rawSvg but the non-persisted cache is empty.
          const newCache = asset ? prepareSvgPoints(asset, res, s.oscillatorGlyphPointCache) : s.oscillatorGlyphPointCache
          const mediaId = getMediaIdFromSvgGlyphId(id)
          return {
            oscillatorSettings: mediaId
              ? {
                  ...s.oscillatorSettings,
                  sourceType: 'svg',
                  selectedSvgId: mediaId,
                  svgRenderMode: 'reactivePath',
                }
              : { ...s.oscillatorSettings, sourceType: 'svgGlyph', selectedGlyphId: id },
            oscillatorGlyphPointCache: newCache,
            glyphLostNotice: null,
            soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
          }
        }),

      selectSvgMediaGlyph: async (mediaId) => {
        const requestGeneration = ++_svgSelectionGeneration
        set(state => ({
          oscillatorSettings: {
            ...state.oscillatorSettings,
            sourceType: 'svg',
            selectedSvgId: mediaId,
            svgRenderMode: 'reactivePath',
          },
          glyphLostNotice: null,
          soundDrawingTrailResetRevision: state.soundDrawingTrailResetRevision + 1,
        }))
        await ensureUnifiedSvgCaches(mediaId)
        if (requestGeneration !== _svgSelectionGeneration) return
        const active = get().oscillatorSettings
        if (active.sourceType !== 'svg' || active.selectedSvgId !== mediaId) return
      },

      addAndCacheMediaSvgGlyph: (mediaId, rawSvg, displayName) =>
        set(state => {
          if (!isSvgContent(rawSvg)) return {}
          const stableId = getSvgGlyphAssetId(mediaId)
          const res = clampRes(state.oscillatorSettings.pathResolution)
          const asset = makeSvgGlyphAsset(displayName ?? 'SVG', rawSvg, res, stableId)
          const existingIndex = state.oscillatorGlyphAssets.findIndex(candidate => candidate.id === stableId)
          const assets = existingIndex < 0
            ? [...state.oscillatorGlyphAssets, asset]
            : state.oscillatorGlyphAssets.map(candidate => candidate.id === stableId ? asset : candidate)
          return {
            oscillatorGlyphAssets: assets,
            oscillatorGlyphPointCache: prepareSvgPoints(asset, res, state.oscillatorGlyphPointCache),
          }
        }),

      // ── SVG artwork compatibility and unified lifecycle ────────────────────

      selectSvgVisual: async (mediaId) => {
        const requestGeneration = ++_svgSelectionGeneration
        set(state => ({
          oscillatorSettings: {
            ...state.oscillatorSettings,
            sourceType: 'svg',
            selectedSvgId: mediaId,
            svgRenderMode: 'originalArtwork',
          },
          glyphLostNotice: null,
          soundDrawingTrailResetRevision: state.soundDrawingTrailResetRevision + 1,
        }))
        await ensureUnifiedSvgCaches(mediaId)
        if (requestGeneration !== _svgSelectionGeneration) return
        const active = get().oscillatorSettings
        if (active.sourceType !== 'svg' || active.selectedSvgId !== mediaId) return
      },

      clearSvgVisualForMedia: (mediaId) => {
        evictSvgVisual(mediaId)
        set(state => {
          const activeUnified = state.oscillatorSettings.sourceType === 'svg' &&
            state.oscillatorSettings.selectedSvgId === mediaId
          const activeLegacy = state.oscillatorSettings.sourceType === 'svgVisual' &&
            state.oscillatorSettings.selectedSvgVisualId === mediaId
          if (!activeUnified && !activeLegacy) return {}
          return {
            oscillatorSettings: {
              ...state.oscillatorSettings,
              sourceType: 'builtinShape',
              selectedSvgId: activeUnified ? null : state.oscillatorSettings.selectedSvgId,
              selectedSvgVisualId: activeLegacy ? null : state.oscillatorSettings.selectedSvgVisualId,
            },
            soundDrawingTrailResetRevision: state.soundDrawingTrailResetRevision + 1,
          }
        })
      },

      rehydrateSvgAsset: async (mediaId) => {
        await ensureUnifiedSvgCaches(mediaId)
      },

      selectSvgAsset: async (mediaId) => {
        const requestGeneration = ++_svgSelectionGeneration
        set(state => ({
          oscillatorSettings: {
            ...state.oscillatorSettings,
            sourceType: 'svg',
            selectedSvgId: mediaId,
          },
          glyphLostNotice: null,
          soundDrawingTrailResetRevision: state.soundDrawingTrailResetRevision + 1,
        }))

        await ensureUnifiedSvgCaches(mediaId)

        // Async cache completion is intentionally not allowed to select anything.
        // The token + selected-ID guard documents and enforces last-selection-wins.
        if (requestGeneration !== _svgSelectionGeneration) return
        const active = get().oscillatorSettings
        if (active.sourceType !== 'svg' || active.selectedSvgId !== mediaId) return
      },

      // ── Font asset actions ──────────────────────────────────────────────────

      addOscillatorFontAsset: (asset) =>
        set((s) => {
          if (s.oscillatorFontAssets.some(a => a.id === asset.id)) return {}
          return { oscillatorFontAssets: [...s.oscillatorFontAssets, asset] }
        }),

      removeOscillatorFontAsset: async (id) => {
        const asset = useReactStore.getState().oscillatorFontAssets.find(a => a.id === id)
        if (!asset) return

        if (useReactStore.getState().fontRemovePending === id) return

        set({ fontRemovePending: id, fontRemoveError: null })

        try {
          // Delete DB row first — keep everything intact if this fails
          const { error: dbErr } = await deleteFontAsset(id)
          if (dbErr) {
            set({ fontRemovePending: null, fontRemoveError: `Could not delete font record: ${dbErr}` })
            return
          }

          // Remove Storage object — best-effort, row is already gone
          const { error: storageErr } = await removeFontFile(asset.storagePath)

          // Evict parsed font, ArrayBuffer, and CSS preview (document.fonts is updated
          // reactively by the UI effect when oscillatorFontAssets changes below)
          evictFontFromCache(id)

          set((s) => {
            const newTextCache = { ...s.oscillatorTextPointCache }
            for (const key of Object.keys(newTextCache)) {
              if (key.startsWith(`${id}:`)) delete newTextCache[key]
            }
            return {
              fontRemovePending: null,
              fontRemoveError: storageErr
                ? `Font deleted; storage cleanup failed: ${storageErr}`
                : null,
              oscillatorFontAssets:     s.oscillatorFontAssets.filter(a => a.id !== id),
              oscillatorTextPointCache: newTextCache,
              oscillatorSettings:
                s.oscillatorSettings.textFontId === id
                  ? { ...s.oscillatorSettings, textFontId: null }
                  : s.oscillatorSettings,
              ...(s.oscillatorSettings.textFontId === id
                ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 }
                : {}),
              // Clear any in-flight select for this font — the download is now pointless
              fontSelectPending: s.fontSelectPending === id ? null : s.fontSelectPending,
              fontSelectError:   s.fontSelectPending === id ? null : s.fontSelectError,
            }
          })
        } catch (e) {
          set({ fontRemovePending: null, fontRemoveError: `Unexpected error: ${(e as Error).message}` })
        }
      },

      clearOscillatorFontAssets: () =>
        set((s) => ({
          oscillatorFontAssets: [],
          oscillatorTextPointCache: {},
          oscillatorSettings:
            s.oscillatorSettings.textFontId
              ? { ...s.oscillatorSettings, textFontId: null }
              : s.oscillatorSettings,
          ...(s.oscillatorSettings.textFontId
            ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 }
            : {}),
        })),

      selectOscillatorFont: async (id) => {
        // Null clears the selection synchronously — no I/O needed
        if (id === null) {
          set((s) => ({
            fontSelectPending: null,
            fontSelectError:   null,
            oscillatorSettings: { ...s.oscillatorSettings, textFontId: null },
            soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
          }))
          return
        }

        const asset = useReactStore.getState().oscillatorFontAssets.find(a => a.id === id)
        if (!asset) return

        // Deduplicate concurrent calls for the same id
        if (useReactStore.getState().fontSelectPending === id) return

        // Cache hit — commit selection and warm text cache immediately.
        // Also clears fontSelectPending to supersede any concurrent in-flight download.
        if (hasFontRuntime(id)) {
          set((s) => {
            const newSettings = { ...s.oscillatorSettings, textFontId: id }
            return {
              fontSelectPending:        null,
              fontSelectError:          null,
              oscillatorSettings:       newSettings,
              soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
              oscillatorTextPointCache: prepareActiveSoundDrawingTextPoints(
                s.oscillatorFontAssets,
                newSettings,
                s.oscillatorTextPointCache,
              ),
            }
          })
          return
        }

        set({ fontSelectPending: id, fontSelectError: null })

        try {
          // Reuse buffer if preview preload already downloaded it; otherwise fetch from cloud.
          let buffer = getBufferFromCache(id)
          if (!buffer) {
            const { data: blob, error: downloadErr } = await downloadFontFile(asset.storagePath)
            if (downloadErr || !blob) {
              set(s => {
                if (s.fontSelectPending !== id) return {}
                return { fontSelectPending: null, fontSelectError: `Could not download font: ${downloadErr ?? 'no data'}` }
              })
              return
            }
            buffer = await blob.arrayBuffer()
          }

          // Parse with opentype.js
          let font: opentype.Font
          try {
            font = opentype.parse(buffer)
          } catch (e) {
            set(s => {
              if (s.fontSelectPending !== id) return {}
              return { fontSelectPending: null, fontSelectError: `Could not parse font: ${(e as Error).message}` }
            })
            return
          }

          // Check freshness before committing to the runtime cache.
          // A cache-hit selection of another font clears fontSelectPending, so if it
          // no longer matches we discard the parsed data rather than polluting the cache.
          if (useReactStore.getState().fontSelectPending !== id) return

          storeFontRuntime(id, font, buffer)

          // Commit selection — discard if a newer selection raced in between getState and set
          set((s) => {
            if (s.fontSelectPending !== id) {
              evictFontFromCache(id)
              return {}
            }
            const newSettings = { ...s.oscillatorSettings, textFontId: id }
            return {
              fontSelectPending:        null,
              fontSelectError:          null,
              oscillatorSettings:       newSettings,
              soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
              oscillatorTextPointCache: prepareActiveSoundDrawingTextPoints(
                s.oscillatorFontAssets,
                newSettings,
                s.oscillatorTextPointCache,
              ),
            }
          })
        } catch (e) {
          set(s => {
            if (s.fontSelectPending !== id) return {}
            return { fontSelectPending: null, fontSelectError: `Unexpected error: ${(e as Error).message}` }
          })
        }
      },

      uploadOscillatorFont: async (file) => {
        if (!supabaseConfigured) {
          set({ fontUploadError: 'Supabase is not configured' })
          return
        }

        set({ fontUploadPending: true, fontUploadError: null })

        let inspectedId: string | undefined
        try {
          // 1. Require an authenticated user
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            set({ fontUploadPending: false, fontUploadError: 'Sign in to upload fonts' })
            return
          }
          const userId = user.id

          // 2. Validate, size-check, and parse with opentype.js; pre-populates runtime cache under FNV id
          let inspected: Awaited<ReturnType<typeof inspectFontFile>>
          try {
            inspected = await inspectFontFile(file)
          } catch (e) {
            set({ fontUploadPending: false, fontUploadError: (e as Error).message })
            return
          }
          inspectedId = inspected.id

          // 3. Build a safe storage path: userId/UUID/<normalized>.  file.name is
          //    preserved in the DB file_name column but never placed in the path.
          const storageFileName = SAFE_FONT_FILENAME[inspected.mimeType]
          if (!storageFileName) {
            evictFontFromCache(inspected.id)
            set({ fontUploadPending: false, fontUploadError: 'Unsupported font format' })
            return
          }
          const storagePath = `${userId}/${crypto.randomUUID()}/${storageFileName}`

          // 4. Upload binary to font-assets bucket
          const { error: uploadErr } = await uploadFontFile(storagePath, file, inspected.mimeType)
          if (uploadErr) {
            evictFontFromCache(inspected.id)
            set({ fontUploadPending: false, fontUploadError: `Upload failed: ${uploadErr}` })
            return
          }

          // 5. Insert metadata row into font_assets
          const { id: dbId, error: insertErr } = await createFontAsset({
            user_id:           userId,
            name:              inspected.name,
            file_name:         inspected.fileName,
            font_family_name:  inspected.fontFamilyName ?? null,
            storage_path:      storagePath,
            mime_type:         inspected.mimeType,
            file_size:         inspected.fileSize,
          })

          // 6. Roll back storage object on insert failure
          if (insertErr || !dbId) {
            await removeFontFile(storagePath)
            evictFontFromCache(inspected.id)
            set({
              fontUploadPending: false,
              fontUploadError:   `Database insert failed: ${insertErr ?? 'unknown error'}`,
            })
            return
          }

          // 7. Build the cloud metadata asset record using the database UUID as id
          const asset: OscillatorFontAsset = {
            id:             dbId,
            name:           inspected.name,
            fileName:       inspected.fileName,
            fontFamilyName: inspected.fontFamilyName,
            storagePath,
            mimeType:       inspected.mimeType,
            fileSize:       inspected.fileSize,
            createdAt:      new Date().toISOString(),
          }

          // 8. Move runtime cache from the temporary FNV id to the canonical DB UUID
          storeFontRuntime(dbId, inspected.font, inspected.buffer)
          evictFontFromCache(inspected.id)

          // 9 + 10. Add to store and select the new font
          set((s) => {
            if (s.oscillatorFontAssets.some(a => a.id === dbId)) {
              return { fontUploadPending: false }
            }
            const newAssets    = [...s.oscillatorFontAssets, asset]
            const newSettings  = { ...s.oscillatorSettings, textFontId: dbId }
            const newTextCache = prepareAllSoundDrawingTextPoints(
              newAssets,
              newSettings,
              s.soundDrawingLayersByTrackId,
              s.oscillatorTextPointCache,
            )
            return {
              fontUploadPending:    false,
              fontUploadError:      null,
              oscillatorFontAssets: newAssets,
              oscillatorSettings:   newSettings,
              soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
              oscillatorTextPointCache: newTextCache,
            }
          })
        } catch (e) {
          if (inspectedId) evictFontFromCache(inspectedId)
          set({ fontUploadPending: false, fontUploadError: `Unexpected error: ${(e as Error).message}` })
        }
      },

      loadOscillatorFonts: async () => {
        if (!supabaseConfigured) {
          set({ fontLoadError: 'Supabase is not configured' })
          return
        }

        // Skip if a load is already in-flight or has already completed this session
        const { fontsLoadState } = useReactStore.getState()
        if (fontsLoadState === 'loading' || fontsLoadState === 'loaded') return

        set({ fontsLoadState: 'loading', fontLoadError: null })

        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            set({ fontsLoadState: 'error', fontLoadError: 'Sign in to load fonts' })
            return
          }

          const { rows, error } = await listFontAssets(user.id)
          if (error) {
            set({ fontsLoadState: 'error', fontLoadError: error })
            return
          }

          const assets: OscillatorFontAsset[] = rows.map(row => ({
            id:             row.id,
            name:           row.name,
            fileName:       row.file_name,
            fontFamilyName: row.font_family_name ?? undefined,
            storagePath:    row.storage_path,
            mimeType:       row.mime_type,
            fileSize:       row.file_size,
            createdAt:      row.created_at,
          }))

          const loadedIds = new Set(assets.map(a => a.id))

          set((s) => {
            const currentFontId = s.oscillatorSettings.textFontId
            return {
              fontsLoadState:    'loaded',
              fontLoadError:     null,
              oscillatorFontAssets: assets,
              oscillatorSettings:
                currentFontId && !loadedIds.has(currentFontId)
                  ? { ...s.oscillatorSettings, textFontId: null }
                  : s.oscillatorSettings,
              ...(currentFontId && !loadedIds.has(currentFontId)
                ? { soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1 }
                : {}),
            }
          })

          // Lazily rehydrate the persisted font: download and cache it if not already warm.
          // selectOscillatorFont is a no-op when the runtime cache is already populated.
          const persistedId = useReactStore.getState().oscillatorSettings.textFontId
          if (persistedId && !hasFontRuntime(persistedId)) {
            await useReactStore.getState().selectOscillatorFont(persistedId)
          }
        } catch (e) {
          set({ fontsLoadState: 'error', fontLoadError: `Unexpected error: ${(e as Error).message}` })
        }
      },

      // ── Generic visual performance actions ─────────────────────────────────

      triggerPerformanceAction: (actionId, requestedToggleState) =>
        set(s => {
          const action = getReactPerformanceAction(actionId)
          const target = resolveActivePerformanceActionTarget(s)
          if (!action || !isReactPerformanceActionCompatible(action, target)) return {}

          const sequence = s.performanceActionSeq + 1
          const triggeredAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
          let toggleState: boolean | undefined
          let toggleStates = s.performanceActionToggleStates
          if (action.behavior === 'toggle') {
            toggleState = requestedToggleState ?? !Boolean(toggleStates[action.id])
            toggleStates = { ...toggleStates }
            if (toggleState && action.exclusiveGroup) {
              for (const candidate of REACT_VISUAL_PERFORMANCE_ACTIONS) {
                if (candidate.exclusiveGroup === action.exclusiveGroup) toggleStates[candidate.id] = false
              }
            }
            toggleStates[action.id] = toggleState
          }

          const event: ReactPerformanceActionEvent = {
            actionId: action.id,
            sequence,
            target,
            triggeredAtMs,
            ...(toggleState == null ? {} : { toggleState }),
          }
          const eventPatch = {
            performanceActionSeq: sequence,
            performanceActionEvent: event,
            performanceActionEvents: [...s.performanceActionEvents, event].slice(-MAX_PERFORMANCE_ACTION_EVENTS),
            performanceActionToggleStates: toggleStates,
          }

          if (action.canvasAction === 'selectPreset' && action.canvasPresetId) {
            const preset = CANVAS_PRESET_BY_ID[action.canvasPresetId] ?? CANVAS_PRESET_BY_ID[DEFAULT_CANVAS_PRESET_ID]
            return {
              ...eventPatch,
              activeReactEngineId: 'canvas' as const,
              activeReactPresetId: null,
              activePadId: null,
              selectedCanvasPresetId: preset.id,
              canvasPresetSettings: normalizeCanvasPresetSettings(preset.settings),
              canvasPresetOverride: {
                source: 'manual' as const,
                presetId: preset.id,
                label: 'Performance pad preset',
              },
              performancePadTransition: null,
            }
          }

          if (action.canvasAction === 'restartClip') {
            return {
              ...eventPatch,
              activeReactEngineId: 'canvas' as const,
              activeReactPresetId: null,
              activePadId: null,
              canvasVideoRestartRevision: s.canvasVideoRestartRevision + 1,
              performancePadTransition: null,
            }
          }

          return eventPatch
        }),

      clearPerformanceActions: () => set(clearPerformanceActionPatch()),

      // ── LaserDMX actions ────────────────────────────────────────────────────

      setLaserDmxSettings: (partial) =>
        set(s => ({ laserDmxSettings: normalizeLaserDmxSettings({ ...s.laserDmxSettings, ...partial }) })),

      resetLaserDmxSettings: () =>
        set({
          laserDmxSettings: ensureProductionLookCompatibility(createDefaultLaserDmxSettings()),
          selectedLaserDmxProductionCueId: null,
        }),

      selectLaserFixture: (fixtureId) =>
        set(s => ({ laserDmxSettings: { ...s.laserDmxSettings, selectedFixtureId: fixtureId } })),

      addLaserFixture: (profileId) =>
        set(s => {
          const fixture = makeNewLaserFixture(s.laserDmxSettings.fixtures, profileId)
          return {
            laserDmxSettings: {
              ...s.laserDmxSettings,
              fixtures:          [...s.laserDmxSettings.fixtures, fixture],
              selectedFixtureId: fixture.id,
            },
          }
        }),

      duplicateLaserFixture: (fixtureId) =>
        set(s => {
          const src = s.laserDmxSettings.fixtures.find(f => f.id === fixtureId)
          if (!src) return {}
          const maxAddr = s.laserDmxSettings.fixtures.reduce((m, f) => Math.max(m, f.dmx.startAddress), 0)
          const nextAddr = Math.min(497, maxAddr + 16)
          const copy: LaserDmxFixture = {
            ...src,
            id:   crypto.randomUUID(),
            name: `${src.name} Copy`,
            dmx:  { ...src.dmx, startAddress: nextAddr },
            ...(src.movingHead ? { movingHead: { ...src.movingHead } } : {}),
            ...(src.colorPolicy ? { colorPolicy: { ...src.colorPolicy } } : {}),
            ...(src.flashPattern ? {
              flashPattern: {
                ...src.flashPattern,
                envelope: { ...src.flashPattern.envelope },
                repeat: { ...src.flashPattern.repeat },
              },
            } : {}),
            ...(src.wash ? { wash: { ...src.wash } } : {}),
            ...(src.atmospheric ? { atmospheric: { ...src.atmospheric } } : {}),
            ...(src.ledBar ? {
              ledBar: {
                ...src.ledBar,
                secondaryColor: { ...src.ledBar.secondaryColor },
                chase: { ...src.ledBar.chase },
              },
            } : {}),
            ...(src.stageTransform ? {
              stageTransform: {
                position: { ...src.stageTransform.position },
                orientation: { ...src.stageTransform.orientation },
              },
            } : {}),
            modulationRoutes: src.modulationRoutes.map(r => ({ ...r, id: crypto.randomUUID() })),
          }
          return {
            laserDmxSettings: {
              ...s.laserDmxSettings,
              fixtures:          [...s.laserDmxSettings.fixtures, copy],
              selectedFixtureId: copy.id,
            },
          }
        }),

      removeLaserFixture: (fixtureId) =>
        set(s => {
          const remaining = s.laserDmxSettings.fixtures.filter(f => f.id !== fixtureId)
          const wasSelected = s.laserDmxSettings.selectedFixtureId === fixtureId
          const nextSelected = wasSelected
            ? (remaining[0]?.id ?? null)
            : s.laserDmxSettings.selectedFixtureId
          return {
            laserDmxSettings: {
              ...s.laserDmxSettings,
              fixtures:          remaining,
              selectedFixtureId: nextSelected,
              productionGroups: (s.laserDmxSettings.productionGroups ?? []).map(group => ({
                ...group,
                fixtureIds: group.fixtureIds.filter(id => id !== fixtureId),
              })),
            },
          }
        }),

      updateLaserFixture: (fixtureId, patch) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map((f, index) =>
              f.id === fixtureId ? normalizeLegacyLaserDmxFixture({ ...f, ...patch }, index) : f
            ),
          },
        })),

      triggerLaserAtmosphericFixture: (fixtureId) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map(fixture => fixture.id === fixtureId && fixture.atmospheric?.armed
              ? { ...fixture, atmospheric: { ...fixture.atmospheric, triggerRequestId: fixture.atmospheric.triggerRequestId + 1 } }
              : fixture),
          },
        })),

      triggerLaserAtmosphericGroup: (groupId) =>
        set(s => {
          const ids = new Set((s.laserDmxSettings.productionGroups ?? []).find(group => group.id === groupId)?.fixtureIds ?? [])
          return {
            laserDmxSettings: {
              ...s.laserDmxSettings,
              fixtures: s.laserDmxSettings.fixtures.map(fixture => ids.has(fixture.id) && fixture.fixtureKind !== 'hazer' && fixture.atmospheric?.armed
                ? { ...fixture, atmospheric: { ...fixture.atmospheric, triggerRequestId: fixture.atmospheric.triggerRequestId + 1 } }
                : fixture),
            },
          }
        }),

      clearLaserAtmosphericBursts: () =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            runtime: {
              ...s.laserDmxSettings.runtime,
              atmosphereClearRequestId: (s.laserDmxSettings.runtime?.atmosphereClearRequestId ?? 0) + 1,
            },
          },
        })),

      createLaserDmxProductionLook: (name) => {
        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `production-look:${Date.now()}`
        set(s => {
          const look = captureProductionLook(s.laserDmxSettings, {
            id,
            name: name?.trim() || `Look ${(s.laserDmxSettings.productionLooks?.length ?? 0) + 1}`,
          })
          return {
            laserDmxSettings: normalizeLaserDmxSettings({
              ...s.laserDmxSettings,
              productionLooks: [...(s.laserDmxSettings.productionLooks ?? []), look],
              activeProductionLookId: look.id,
            }),
          }
        })
        return id
      },

      duplicateLaserDmxProductionLook: (lookId) => {
        const source = get().laserDmxSettings.productionLooks?.find(look => look.id === lookId)
        if (!source) return null
        const now = new Date().toISOString()
        const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `production-look:${Date.now()}`
        const copy: ProductionLook = {
          ...JSON.parse(JSON.stringify(source)) as ProductionLook,
          id,
          name: `${source.name} Copy`,
          source: 'authored',
          createdAt: now,
          updatedAt: now,
        }
        set(s => ({
          laserDmxSettings: normalizeLaserDmxSettings({
            ...s.laserDmxSettings,
            productionLooks: [...(s.laserDmxSettings.productionLooks ?? []), copy],
            activeProductionLookId: id,
          }),
        }))
        return id
      },

      updateLaserDmxProductionLook: (lookId, patch) =>
        set(s => ({
          laserDmxSettings: normalizeLaserDmxSettings({
            ...s.laserDmxSettings,
            productionLooks: (s.laserDmxSettings.productionLooks ?? []).map(look => look.id === lookId ? {
              ...look,
              ...patch,
              id: look.id,
              updatedAt: new Date().toISOString(),
            } : look),
          }),
        })),

      updateLaserDmxProductionLookFromCurrent: (lookId) =>
        set(s => {
          const source = s.laserDmxSettings.productionLooks?.find(look => look.id === lookId)
          if (!source) return {}
          const replacement = captureProductionLook(s.laserDmxSettings, {
            id: source.id,
            name: source.name,
            description: source.description,
            scope: source.scope,
            transition: source.transition,
            omissionMode: source.omissionMode,
            source: source.source,
            createdAt: source.createdAt,
          })
          replacement.updatedAt = new Date().toISOString()
          return {
            laserDmxSettings: normalizeLaserDmxSettings({
              ...s.laserDmxSettings,
              productionLooks: (s.laserDmxSettings.productionLooks ?? []).map(look => look.id === lookId ? replacement : look),
              activeProductionLookId: lookId,
            }),
          }
        }),

      reorderLaserDmxProductionLook: (lookId, direction) =>
        set(s => {
          const looks = [...(s.laserDmxSettings.productionLooks ?? [])]
          const index = looks.findIndex(look => look.id === lookId)
          const target = index + direction
          if (index < 0 || target < 0 || target >= looks.length) return {}
          const [look] = looks.splice(index, 1)
          looks.splice(target, 0, look)
          return { laserDmxSettings: { ...s.laserDmxSettings, productionLooks: looks } }
        }),

      deleteLaserDmxProductionLook: (lookId) =>
        set(s => {
          const looks = (s.laserDmxSettings.productionLooks ?? []).filter(look => look.id !== lookId)
          return {
            laserDmxSettings: normalizeLaserDmxSettings({
              ...s.laserDmxSettings,
              productionLooks: looks,
              activeProductionLookId: s.laserDmxSettings.activeProductionLookId === lookId
                ? (looks[0]?.id ?? null)
                : s.laserDmxSettings.activeProductionLookId,
            }),
          }
        }),

      activateLaserDmxProductionLook: (lookId, transition) =>
        set(s => {
          const look = s.laserDmxSettings.productionLooks?.find(candidate => candidate.id === lookId)
          if (!look) return {}
          return { laserDmxSettings: beginProductionLookTransition(s.laserDmxSettings, look, transition).settings }
        }),

      setLaserDmxBlackout: (enabled) =>
        set(s => {
          const runtime = { ...s.laserDmxSettings.runtime }
          delete runtime.lookTransition
          return {
            laserDmxSettings: normalizeLaserDmxSettings({
              ...s.laserDmxSettings,
              blackout: enabled,
              runtime,
            }),
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              output: { ...s.laserDmxBeamMatrix.output, blackout: enabled },
            },
          }
        }),

      selectLaserDmxProductionCue: (cueId) => set({ selectedLaserDmxProductionCueId: cueId }),

      addLaserDmxProductionCue: () => {
        const id = crypto.randomUUID()
        set(s => {
          const groupId = s.laserDmxSettings.productionGroups?.[0]?.id ?? ''
          const action: ProductionCueAction = groupId
            ? { id: crypto.randomUUID(), type: 'gateFixtureGroup', execution: 'simultaneous', groupId, open: true }
            : { id: crypto.randomUUID(), type: 'reveal', execution: 'simultaneous' }
          const cue = normalizeProductionCompoundCue({
            id,
            label: 'New Show Cue',
            enabled: true,
            timing: { mode: 'musical', bar: 1, beat: 1, subdivision: 1, subdivisionIndex: 0 },
            quantize: 'beat',
            priority: 0,
            retriggerPolicy: 'oncePerPass',
            cancellationBehavior: 'restoreOnExit',
            fixtureGroupIds: groupId ? [groupId] : [],
            manualOnly: false,
            actions: [action],
            source: 'authored',
          }, s.laserDmxSettings.productionCues?.length ?? 0)
          return {
            selectedLaserDmxProductionCueId: id,
            laserDmxSettings: normalizeLaserDmxSettings({
              ...s.laserDmxSettings,
              productionCues: [...(s.laserDmxSettings.productionCues ?? []), cue],
            }),
          }
        })
        return id
      },

      duplicateLaserDmxProductionCue: (cueId) => {
        const source = get().laserDmxSettings.productionCues?.find(cue => cue.id === cueId)
        if (!source) return null
        const id = crypto.randomUUID()
        const copy = JSON.parse(JSON.stringify(source)) as ProductionCompoundCue
        copy.id = id
        copy.label = `${source.label} Copy`
        copy.source = 'authored'
        copy.actions = copy.actions.map(action => ({ ...action, id: crypto.randomUUID() }))
        set(s => ({
          selectedLaserDmxProductionCueId: id,
          laserDmxSettings: normalizeLaserDmxSettings({
            ...s.laserDmxSettings,
            productionCues: [...(s.laserDmxSettings.productionCues ?? []), copy],
          }),
        }))
        return id
      },

      updateLaserDmxProductionCue: (cueId, patch) => set(s => ({
        laserDmxSettings: normalizeLaserDmxSettings({
          ...s.laserDmxSettings,
          productionCues: (s.laserDmxSettings.productionCues ?? []).map((cue, index) => cue.id === cueId
            ? normalizeProductionCompoundCue({ ...cue, ...patch, id: cue.id }, index)
            : cue),
        }),
      })),

      reorderLaserDmxProductionCue: (cueId, direction) => set(s => {
        const cues = [...(s.laserDmxSettings.productionCues ?? [])]
        const index = cues.findIndex(cue => cue.id === cueId)
        const target = index + direction
        if (index < 0 || target < 0 || target >= cues.length) return {}
        ;[cues[index], cues[target]] = [cues[target], cues[index]]
        return { laserDmxSettings: { ...s.laserDmxSettings, productionCues: cues } }
      }),

      deleteLaserDmxProductionCue: (cueId) => set(s => ({
        selectedLaserDmxProductionCueId: s.selectedLaserDmxProductionCueId === cueId ? null : s.selectedLaserDmxProductionCueId,
        laserDmxSettings: {
          ...s.laserDmxSettings,
          productionCues: (s.laserDmxSettings.productionCues ?? []).filter(cue => cue.id !== cueId),
        },
      })),

      fireLaserDmxProductionCue: (cueId) => set(s => {
        const selected = cueId ?? s.selectedLaserDmxProductionCueId
        if (!selected || !(s.laserDmxSettings.productionCues ?? []).some(cue => cue.id === selected)) return {}
        const previous = s.laserDmxSettings.runtime?.showDirectorManualRequest as { sequence?: number } | undefined
        return {
          selectedLaserDmxProductionCueId: selected,
          laserDmxSettings: {
            ...s.laserDmxSettings,
            runtime: {
              ...s.laserDmxSettings.runtime,
              showDirectorManualRequest: { cueId: selected, sequence: (previous?.sequence ?? 0) + 1 },
            },
          },
        }
      }),

      addLaserModulationRoute: (fixtureId) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map(f =>
              f.id === fixtureId
                ? { ...f, modulationRoutes: [...f.modulationRoutes, makeNewModulationRoute()] }
                : f
            ),
          },
        })),

      updateLaserModulationRoute: (fixtureId, routeId, patch) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map(f =>
              f.id !== fixtureId ? f : {
                ...f,
                modulationRoutes: f.modulationRoutes.map(r =>
                  r.id === routeId ? { ...r, ...patch } : r
                ),
              }
            ),
          },
        })),

      removeLaserModulationRoute: (fixtureId, routeId) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map(f =>
              f.id !== fixtureId ? f : {
                ...f,
                modulationRoutes: f.modulationRoutes.filter(r => r.id !== routeId),
              }
            ),
          },
        })),

      applyLaserDmxVenueTemplate: (templateId) =>
        set(s => ({ laserDmxSettings: applyProductionVenueTemplate(s.laserDmxSettings, templateId) })),

      // ── LaserDMX workspace mode ─────────────────────────────────────────────

      setLaserDmxWorkspaceMode: (mode) => set({ laserDmxWorkspaceMode: coerceLaserDmxWorkspaceMode(mode) }),
      setLaserDmxBeamMatrixAuthoringMode: (mode) => set(s => {
        const nextMode = coerceLaserDmxBeamMatrixAuthoringMode(mode)
        if (nextMode === s.laserDmxBeamMatrixAuthoringMode) return {}
        const performance = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
        return {
          laserDmxBeamMatrixAuthoringMode: nextMode,
          laserDmxShowDirectorPerformance: {
            ...performance,
            runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
              performance.runtimeInvalidationId,
              performance.activeProgramId,
            ),
          },
        }
      }),

      // ── LaserDMX Beam Matrix ────────────────────────────────────────────────

      setLaserDmxBeamMatrixSettings: (partial) =>
        set(s => {
          const matrix = normalizeLaserDmxBeamMatrixSettings({ ...s.laserDmxBeamMatrix, ...partial })
          return {
            laserDmxBeamMatrix: matrix,
            ...(partial.cues ? {
              laserDmxSettings: normalizeLaserDmxSettings({
                ...s.laserDmxSettings,
                productionCues: migrateLegacyBeamMatrixCues(matrix.cues ?? [], s.laserDmxSettings.productionCues ?? []),
              }),
            } : {}),
          }
        }),

      resetLaserDmxBeamMatrix: () =>
        set({ laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings() }),

      addLaserDmxMatrixBeam: (initial) =>
        set(s => {
          if (s.laserDmxBeamMatrix.beams.length >= LASER_DMX_MATRIX_MAX_BEAMS) return {}
          const base = makeDefaultMatrixBeam(s.laserDmxBeamMatrix.beams)
          const beam = clampMatrixBeam(initial ? { ...base, ...initial, id: crypto.randomUUID() } : base)
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              beams: [...s.laserDmxBeamMatrix.beams, beam],
              selectedBeamIds: [beam.id],
            },
          }
        }),

      duplicateLaserDmxMatrixBeam: (beamId) =>
        set(s => {
          if (s.laserDmxBeamMatrix.beams.length >= LASER_DMX_MATRIX_MAX_BEAMS) return {}
          const src = s.laserDmxBeamMatrix.beams.find(b => b.id === beamId)
          if (!src) return {}
          const copy: LaserDmxMatrixBeam = {
            ...src,
            id:            crypto.randomUUID(),
            name:          `${src.name} Copy`,
            sequenceIndex: s.laserDmxBeamMatrix.beams.length,
            modulationRoutes: src.modulationRoutes.map(r => ({ ...r, id: crypto.randomUUID() })),
          }
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              beams: [...s.laserDmxBeamMatrix.beams, copy],
              selectedBeamIds: [copy.id],
            },
          }
        }),

      removeLaserDmxMatrixBeam: (beamId) =>
        set(s => {
          const remaining = s.laserDmxBeamMatrix.beams.filter(b => b.id !== beamId)
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              beams:           remaining,
              selectedBeamIds: s.laserDmxBeamMatrix.selectedBeamIds.filter(id => id !== beamId),
            },
          }
        }),

      removeSelectedLaserDmxMatrixBeams: () =>
        set(s => {
          const ids = new Set(s.laserDmxBeamMatrix.selectedBeamIds)
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              beams:           s.laserDmxBeamMatrix.beams.filter(b => !ids.has(b.id)),
              selectedBeamIds: [],
            },
          }
        }),

      updateLaserDmxMatrixBeam: (beamId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams: s.laserDmxBeamMatrix.beams.map(b =>
              b.id === beamId ? clampMatrixBeam({ ...b, ...patch }) : b
            ),
          },
        })),

      selectLaserDmxMatrixBeam: (beamId, additive = false) =>
        set(s => {
          const exists = s.laserDmxBeamMatrix.beams.some(b => b.id === beamId)
          if (!exists) return {}
          const next = additive
            ? (s.laserDmxBeamMatrix.selectedBeamIds.includes(beamId)
                ? s.laserDmxBeamMatrix.selectedBeamIds.filter(id => id !== beamId)
                : [...s.laserDmxBeamMatrix.selectedBeamIds, beamId])
            : [beamId]
          return { laserDmxBeamMatrix: { ...s.laserDmxBeamMatrix, selectedBeamIds: next } }
        }),

      setSelectedLaserDmxMatrixBeams: (ids) =>
        set(s => {
          const valid = new Set(s.laserDmxBeamMatrix.beams.map(b => b.id))
          return {
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              selectedBeamIds: ids.filter(id => valid.has(id)),
            },
          }
        }),

      clearLaserDmxMatrixSelection: () =>
        set(s => ({ laserDmxBeamMatrix: { ...s.laserDmxBeamMatrix, selectedBeamIds: [] } })),

      addLaserDmxReactionGroup: () =>
        set(s => {
          const grp: LaserDmxReactionGroup = {
            id:      crypto.randomUUID(),
            name:    `Group ${s.laserDmxBeamMatrix.groups.length + 1}`,
            enabled: true,
            muted:   false,
            soloed:  false,
            colorOverrideEnabled: false,
            color:    { red: 255, green: 255, blue: 255, white: 0, alpha: 1 },
            sequence:       DEFAULT_BEAM_SEQUENCE,
            launch:         DEFAULT_LAUNCH_SETTINGS,
            maxActiveBeams: 0,
            modulationRoutes: [],
          }
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              groups:          [...s.laserDmxBeamMatrix.groups, grp],
              selectedGroupId: grp.id,
            },
          }
        }),

      duplicateLaserDmxReactionGroup: (groupId) =>
        set(s => {
          const src = s.laserDmxBeamMatrix.groups.find(g => g.id === groupId)
          if (!src) return {}
          const copy: LaserDmxReactionGroup = {
            ...src,
            id:   crypto.randomUUID(),
            name: `${src.name} Copy`,
            modulationRoutes: src.modulationRoutes.map(r => ({ ...r, id: crypto.randomUUID() })),
          }
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              groups:          [...s.laserDmxBeamMatrix.groups, copy],
              selectedGroupId: copy.id,
            },
          }
        }),

      removeLaserDmxReactionGroup: (groupId) =>
        set(s => {
          const beams = s.laserDmxBeamMatrix.beams.map(b =>
            b.groupId === groupId ? { ...b, groupId: null } : b
          )
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              groups:          s.laserDmxBeamMatrix.groups.filter(g => g.id !== groupId),
              beams,
              selectedGroupId: s.laserDmxBeamMatrix.selectedGroupId === groupId
                ? null
                : s.laserDmxBeamMatrix.selectedGroupId,
            },
          }
        }),

      updateLaserDmxReactionGroup: (groupId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id === groupId ? { ...g, ...patch } : g
            ),
          },
        })),

      selectLaserDmxReactionGroup: (groupId) =>
        set(s => ({ laserDmxBeamMatrix: { ...s.laserDmxBeamMatrix, selectedGroupId: groupId } })),

      addLaserDmxMatrixGlobalRoute: () =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            globalModulationRoutes: [...s.laserDmxBeamMatrix.globalModulationRoutes, makeNewModulationRoute()],
          },
        })),

      updateLaserDmxMatrixGlobalRoute: (routeId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            globalModulationRoutes: s.laserDmxBeamMatrix.globalModulationRoutes.map(r =>
              r.id === routeId ? { ...r, ...patch } : r
            ),
          },
        })),

      removeLaserDmxMatrixGlobalRoute: (routeId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            globalModulationRoutes: s.laserDmxBeamMatrix.globalModulationRoutes.filter(r => r.id !== routeId),
          },
        })),

      addLaserDmxReactionGroupRoute: (groupId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id === groupId
                ? { ...g, modulationRoutes: [...g.modulationRoutes, makeNewGroupRoute()] }
                : g
            ),
          },
        })),

      updateLaserDmxReactionGroupRoute: (groupId, routeId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id !== groupId ? g : {
                ...g,
                modulationRoutes: g.modulationRoutes.map(r =>
                  r.id === routeId ? { ...r, ...patch } : r
                ),
              }
            ),
          },
        })),

      removeLaserDmxReactionGroupRoute: (groupId, routeId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id !== groupId ? g : {
                ...g,
                modulationRoutes: g.modulationRoutes.filter(r => r.id !== routeId),
              }
            ),
          },
        })),

      addLaserDmxMatrixBeamRoute: (beamId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams: s.laserDmxBeamMatrix.beams.map(b =>
              b.id === beamId
                ? { ...b, modulationRoutes: [...b.modulationRoutes, makeNewBeamRoute()] }
                : b
            ),
          },
        })),

      updateLaserDmxMatrixBeamRoute: (beamId, routeId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams: s.laserDmxBeamMatrix.beams.map(b =>
              b.id !== beamId ? b : {
                ...b,
                modulationRoutes: b.modulationRoutes.map(r =>
                  r.id === routeId ? { ...r, ...patch } : r
                ),
              }
            ),
          },
        })),

      removeLaserDmxMatrixBeamRoute: (beamId, routeId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams: s.laserDmxBeamMatrix.beams.map(b =>
              b.id !== beamId ? b : {
                ...b,
                modulationRoutes: b.modulationRoutes.filter(r => r.id !== routeId),
              }
            ),
          },
        })),

      setLaserDmxReactionGroupMuted: (groupId, muted) =>
        set(s => ({
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id === groupId ? { ...g, muted } : g
            ),
          },
        })),

      setLaserDmxReactionGroupSoloed: (groupId, soloed) =>
        set(s => ({
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            groups: s.laserDmxBeamMatrix.groups.map(g =>
              g.id === groupId ? { ...g, soloed } : g
            ),
          },
        })),

      duplicateLaserDmxMatrixBeamsWithOffset: (beamIds, colOffset, rowOffset, opts = {}) => {
        const { targetColOffset = 0, targetRowOffset = 0, preserveGroups = true } = opts
        let created = 0
        set(s => {
          const available = LASER_DMX_MATRIX_MAX_BEAMS - s.laserDmxBeamMatrix.beams.length
          const toCreate = beamIds.slice(0, available)
          const newBeams: LaserDmxMatrixBeam[] = []
          const baseSeqIndex = s.laserDmxBeamMatrix.beams.length
          for (const id of toCreate) {
            const src = s.laserDmxBeamMatrix.beams.find(b => b.id === id)
            if (!src) continue
            const newOrigin = {
              ...src.origin,
              column: clampCol(src.origin.column + colOffset),
              row:    clampRow(src.origin.row    + rowOffset),
            }
            let newTarget = src.target
            if (src.target.kind === 'grid') {
              newTarget = {
                ...src.target,
                column: clampCol(src.target.column + (targetColOffset || colOffset)),
                row:    clampRow(src.target.row    + (targetRowOffset || rowOffset)),
              }
            }
            newBeams.push(clampMatrixBeam({
              ...src,
              id:            crypto.randomUUID(),
              name:          `${src.name} Copy`,
              sequenceIndex: baseSeqIndex + newBeams.length,
              modulationRoutes: src.modulationRoutes.map(r => ({ ...r, id: crypto.randomUUID() })),
              groupId: preserveGroups ? src.groupId : null,
              origin: newOrigin,
              target: newTarget,
            }))
          }
          created = newBeams.length
          if (newBeams.length === 0) return {}
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              beams:           [...s.laserDmxBeamMatrix.beams, ...newBeams],
              selectedBeamIds: newBeams.map(b => b.id),
            },
          }
        })
        return created
      },

      restoreStarterReactionGroups: () =>
        set(s => {
          const STARTER_IDS = ['grp-bass', 'grp-snare', 'grp-beat', 'grp-custom']
          const defaults = createDefaultLaserDmxBeamMatrixSettings()
          const starterDefaults = defaults.groups // 4 default groups
          const existing = s.laserDmxBeamMatrix.groups
          const nonStarter = existing.filter(g => !STARTER_IDS.includes(g.id))
          // For each starter group: restore if missing, keep if present (preserve user edits)
          const restoredStarters = starterDefaults.map(def => {
            const found = existing.find(g => g.id === def.id)
            return found ?? def
          })
          return {
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              groups: [...restoredStarters, ...nonStarter],
            },
          }
        }),

      setLaserDmxBeamMatrixEditorSettings: (patch) =>
        set(s => ({
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            editor: { ...s.laserDmxBeamMatrix.editor, ...patch },
          },
        })),

      // ── Beam Matrix cue list ─────────────────────────────────────────────────

      addLaserDmxBeamMatrixCue: () =>
        set(s => {
          const firstBeam = s.laserDmxBeamMatrix.beams[0]
          const newCue: LaserDmxBeamMatrixCue = {
            id:         crypto.randomUUID(),
            name:       'New Cue',
            enabled:    true,
            targetType: firstBeam ? 'beam' : 'group',
            targetId:   firstBeam?.id ?? (s.laserDmxBeamMatrix.groups[0]?.id ?? ''),
            timingMode: 'musical',
            action:     'gate',
            startBar:   1,
            startBeat:  1,
          }
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              cues: [...(s.laserDmxBeamMatrix.cues ?? []), newCue],
            },
          }
        }),

      duplicateLaserDmxBeamMatrixCue: (cueId) =>
        set(s => {
          const src = (s.laserDmxBeamMatrix.cues ?? []).find(c => c.id === cueId)
          if (!src) return {}
          const copy: LaserDmxBeamMatrixCue = { ...src, id: crypto.randomUUID(), name: `${src.name} Copy` }
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              cues: [...(s.laserDmxBeamMatrix.cues ?? []), copy],
            },
          }
        }),

      removeLaserDmxBeamMatrixCue: (cueId) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            cues: (s.laserDmxBeamMatrix.cues ?? []).filter(c => c.id !== cueId),
          },
        })),

      updateLaserDmxBeamMatrixCue: (cueId, patch) =>
        set(s => ({
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            cues: (s.laserDmxBeamMatrix.cues ?? []).map(c => c.id === cueId ? { ...c, ...patch } : c),
          },
        })),

      // ── LaserDMX Show Director layout model ────────────────────────────────

      applyLaserDmxShowDirectorPerformanceProgram: (program) => {
        const normalized = applyLaserDmxShowDirectorPerformanceProgramState(
          get().laserDmxShowDirectorPerformance,
          program,
        )
        if (!normalized.activeProgramDefinition) return false
        set({ laserDmxShowDirectorPerformance: normalized })
        return true
      },

      applyLaserDmxShowDirectorPerformancePreset: (preset) => {
        const current = get()
        const loaded = createLaserDmxShowDirectorPerformancePresetLoadResult(
          current.laserDmxShowDirector,
          current.laserDmxShowDirectorPerformance,
          preset,
        )
        if (!loaded) return false
        set({
          activeReactEngineId: 'laserDmx',
          laserDmxWorkspaceMode: 'beamMatrix',
          laserDmxBeamMatrixAuthoringMode: 'showDirector',
          activeLaserDmxBeamMatrixPresetId: null,
          laserDmxBeamMatrixPresetDirty: false,
          laserDmxShowDirector: loaded.rig,
          laserDmxShowDirectorPerformance: loaded.performance,
          laserDmxShowDirectorUndoStack: [],
          laserDmxShowDirectorRedoStack: [],
          laserDmxShowDirectorHistoryTransaction: null,
        })
        resetBeamMatrixCompilerState()
        resetFogState()
        return true
      },

      clearLaserDmxShowDirectorPerformanceProgram: () =>
        set(s => ({
          laserDmxShowDirectorPerformance: clearLaserDmxShowDirectorPerformanceProgramState(
            s.laserDmxShowDirectorPerformance,
          ),
        })),

      setLaserDmxShowDirectorPerformanceEnabled: (enabled) =>
        set(s => {
          const current = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          const canEnable = current.activeProgramDefinition !== null
          const nextEnabled = enabled && canEnable
          if (nextEnabled === current.enabled) return {}
          return {
            laserDmxShowDirectorPerformance: {
              ...current,
              enabled: nextEnabled,
              presetDirty: current.activePresetId != null ? true : current.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                current.runtimeInvalidationId,
                current.activeProgramId,
              ),
            },
          }
        }),

      updateLaserDmxShowDirectorPerformanceTuning: (patch) =>
        set(s => {
          const current = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          return {
            laserDmxShowDirectorPerformance: {
              ...current,
              tuning: normalizeLaserDmxShowDirectorPerformanceTuning({ ...current.tuning, ...patch }),
              presetDirty: current.activePresetId != null ? true : current.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                current.runtimeInvalidationId,
                current.activeProgramId,
              ),
            },
          }
        }),

      setLaserDmxShowDirectorPerformanceAudioIntelligenceEnabled: (enabled) =>
        set(s => {
          const current = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          return {
            laserDmxShowDirectorPerformance: {
              ...current,
              audioIntelligenceEnabled: enabled,
              presetDirty: current.activePresetId != null ? true : current.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                current.runtimeInvalidationId,
                current.activeProgramId,
              ),
            },
          }
        }),

      setLaserDmxShowDirectorPerformanceFallbackBehavior: (fallbackBehavior) =>
        set(s => {
          const current = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          if (fallbackBehavior === current.fallbackBehavior) return {}
          return {
            laserDmxShowDirectorPerformance: {
              ...current,
              fallbackBehavior,
              presetDirty: current.activePresetId != null ? true : current.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                current.runtimeInvalidationId,
                current.activeProgramId,
              ),
            },
          }
        }),

      setLaserDmxShowDirectorPerformanceSeed: (seed) =>
        set(s => {
          const current = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          const deterministicSeed = Math.max(0, Math.min(0x7fffffff, Math.round(Number.isFinite(seed) ? seed : 0)))
          return {
            laserDmxShowDirectorPerformance: {
              ...current,
              deterministicSeed,
              presetDirty: current.activePresetId != null ? true : current.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                current.runtimeInvalidationId,
                current.activeProgramId,
              ),
            },
          }
        }),

      addLaserDmxShowDirectorFixture: (kind, initial) => {
        const id = createLaserDmxShowDirectorId()
        set(s => {
          const current = s.laserDmxShowDirector
          const base = createDefaultLaserDmxShowDirectorFixture(kind, id, current.fixtures.length)
          const openSlot = findLaserDmxShowDirectorOpenSlot(current)
          const x = initial?.x ?? openSlot.x
          const y = initial?.y ?? openSlot.y
          const beam = initial?.beam ? { ...base.beam, ...initial.beam } : base.beam
          const defaultEndpoint = createLaserDmxShowDirectorDefaultEndpoint({ ...base, ...initial, kind, x, y, beam }, current.settings)
          const fixture = normalizeLaserDmxShowDirectorFixture({
            ...base,
            ...initial,
            id,
            kind,
            x,
            y,
            linkedPairId: null,
            mirrorAxis: null,
            beam: {
              ...beam,
              targetX: initial?.beam?.targetX ?? defaultEndpoint.targetX,
              targetY: initial?.beam?.targetY ?? defaultEndpoint.targetY,
            },
            trigger: initial?.trigger ? { ...base.trigger, ...initial.trigger } : base.trigger,
            component: initial?.component ? { ...base.component, ...initial.component } : base.component,
            optics: initial?.optics ? { ...base.optics, ...initial.optics } : base.optics,
          }, current.fixtures.length)
          const next = normalizeLaserDmxShowDirectorState({
            ...current,
            fixtures: [...current.fixtures, fixture],
            selectedFixtureId: fixture.id,
            selectedFixtureIds: [fixture.id],
          })
          return {
            laserDmxBeamMatrixAuthoringMode: 'showDirector' as const,
            ...buildLaserDmxShowDirectorHistoryPatch(s, next),
          }
        })
        return id
      },

      updateLaserDmxShowDirectorFixture: (fixtureId, patch) =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (!current.fixtures.some(fixture => fixture.id === fixtureId)) return {}
          const patchedFixtures = current.fixtures.map((fixture, index) => fixture.id === fixtureId
            ? mergeLaserDmxShowDirectorFixturePatch(fixture, patch, index)
            : fixture)
          const syncedFixtures = syncLaserDmxShowDirectorLinkedMirrors(patchedFixtures, current, [fixtureId])
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: clampLaserDmxShowDirectorOrphanedMirrorLinks(syncedFixtures),
          })
        }),

      deleteLaserDmxShowDirectorFixture: (fixtureId) =>
        set(s => {
          const current = s.laserDmxShowDirector
          const remaining = clampLaserDmxShowDirectorOrphanedMirrorLinks(current.fixtures.filter(fixture => fixture.id !== fixtureId))
          if (remaining.length === current.fixtures.length) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: remaining,
            selectedFixtureId: current.selectedFixtureId === fixtureId ? null : current.selectedFixtureId,
            selectedFixtureIds: current.selectedFixtureIds.filter(id => id !== fixtureId),
          })
        }),

      duplicateLaserDmxShowDirectorFixture: (fixtureId) => {
        const state = get().laserDmxShowDirector
        const source = state.fixtures.find(fixture => fixture.id === fixtureId)
        if (!source) return null
        const id = createLaserDmxShowDirectorId()
        const copy = createOffsetLaserDmxShowDirectorFixtureCopy(
          source,
          state,
          id,
          state.fixtures.length,
          state.settings.snapEnabled ? 1 : 0.8,
        )
        set(s => buildLaserDmxShowDirectorHistoryPatch(s, {
          ...s.laserDmxShowDirector,
          fixtures: [...s.laserDmxShowDirector.fixtures, copy],
          selectedFixtureId: id,
          selectedFixtureIds: [id],
        }))
        return id
      },

      duplicateLaserDmxShowDirectorLayout: () =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (current.fixtures.length === 0) return {}
          const offset = current.settings.snapEnabled ? 1 : 0.8
          const copies = current.fixtures.map((source, index) => createOffsetLaserDmxShowDirectorFixtureCopy(
            source,
            current,
            createLaserDmxShowDirectorId(),
            current.fixtures.length + index,
            offset,
          ))
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: [...current.fixtures, ...copies],
            selectedFixtureId: copies[0]?.id ?? current.selectedFixtureId,
            selectedFixtureIds: copies.length > 0 ? copies.map(copy => copy.id) : current.selectedFixtureIds,
          })
        }),

      mirrorLaserDmxShowDirectorFixture: (fixtureId, axis) =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (!current.fixtures.some(fixture => fixture.id === fixtureId)) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: current.fixtures.map((fixture, index) => fixture.id === fixtureId
              ? mirrorLaserDmxShowDirectorFixtureAcrossGrid(fixture, current, axis, index)
              : fixture),
          })
        }),

      mirrorLaserDmxShowDirectorLayout: (axis) =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (current.fixtures.length === 0) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: current.fixtures.map((fixture, index) => mirrorLaserDmxShowDirectorFixtureAcrossGrid(fixture, current, axis, index)),
          })
        }),

      createLinkedLaserDmxShowDirectorMirrorPair: (fixtureId, axis = 'horizontal') => {
        const currentState = get().laserDmxShowDirector
        if (!currentState.fixtures.some(fixture => fixture.id === fixtureId)) return null
        const copyId = createLaserDmxShowDirectorId()
        const pairId = createLaserDmxShowDirectorId()
        set(s => {
          const current = s.laserDmxShowDirector
          const source = current.fixtures.find(fixture => fixture.id === fixtureId)
          if (!source) return {}
          const copy = createLaserDmxShowDirectorMirrorPairCopy(source, current, copyId, pairId, axis, current.fixtures.length)
          const nextFixtures = clampLaserDmxShowDirectorOrphanedMirrorLinks(current.fixtures.map((fixture, index) => fixture.id === fixtureId
            ? mergeLaserDmxShowDirectorFixturePatch(fixture, { linkedPairId: pairId, mirrorAxis: axis }, index)
            : fixture))
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: [...nextFixtures, copy],
            selectedFixtureId: fixtureId,
            selectedFixtureIds: [fixtureId, copyId],
          })
        })
        return copyId
      },

      unlinkLaserDmxShowDirectorMirrorPair: (fixtureId) =>
        set(s => {
          const current = s.laserDmxShowDirector
          const source = current.fixtures.find(fixture => fixture.id === fixtureId)
          if (!source?.linkedPairId) return {}
          const pairId = source.linkedPairId
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: current.fixtures.map((fixture, index) => fixture.linkedPairId === pairId
              ? mergeLaserDmxShowDirectorFixturePatch(fixture, { linkedPairId: null, mirrorAxis: null }, index)
              : fixture),
          })
        }),

      undoLaserDmxShowDirectorEdit: () =>
        set(s => {
          const previous = s.laserDmxShowDirectorUndoStack[s.laserDmxShowDirectorUndoStack.length - 1]
          if (!previous) return {}
          const current = normalizeShowDirectorSnapshot(s.laserDmxShowDirector)
          const previousWithGlobalSettings = preserveLaserDmxShowDirectorGlobalSettings(
            normalizeShowDirectorSnapshot(previous),
            current.settings,
          )
          const performance = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxShowDirector: previousWithGlobalSettings,
            laserDmxShowDirectorPerformance: {
              ...performance,
              presetDirty: performance.activePresetId != null ? true : performance.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                performance.runtimeInvalidationId,
                performance.activeProgramId,
              ),
            },
            laserDmxShowDirectorUndoStack: s.laserDmxShowDirectorUndoStack.slice(0, -1),
            laserDmxShowDirectorRedoStack: trimShowDirectorHistory([...s.laserDmxShowDirectorRedoStack, current]),
            laserDmxShowDirectorHistoryTransaction: null,
          }
        }),

      redoLaserDmxShowDirectorEdit: () =>
        set(s => {
          const next = s.laserDmxShowDirectorRedoStack[s.laserDmxShowDirectorRedoStack.length - 1]
          if (!next) return {}
          const current = normalizeShowDirectorSnapshot(s.laserDmxShowDirector)
          const nextWithGlobalSettings = preserveLaserDmxShowDirectorGlobalSettings(
            normalizeShowDirectorSnapshot(next),
            current.settings,
          )
          const performance = normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance)
          return {
            laserDmxBeamMatrixPresetDirty: true,
            laserDmxShowDirector: nextWithGlobalSettings,
            laserDmxShowDirectorPerformance: {
              ...performance,
              presetDirty: performance.activePresetId != null ? true : performance.presetDirty,
              runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
                performance.runtimeInvalidationId,
                performance.activeProgramId,
              ),
            },
            laserDmxShowDirectorUndoStack: trimShowDirectorHistory([...s.laserDmxShowDirectorUndoStack, current]),
            laserDmxShowDirectorRedoStack: s.laserDmxShowDirectorRedoStack.slice(0, -1),
            laserDmxShowDirectorHistoryTransaction: null,
          }
        }),

      beginLaserDmxShowDirectorHistoryTransaction: () =>
        set(s => s.laserDmxShowDirectorHistoryTransaction
          ? {}
          : {
              laserDmxShowDirectorHistoryTransaction: normalizeShowDirectorSnapshot(s.laserDmxShowDirector),
            }),

      commitLaserDmxShowDirectorHistoryTransaction: () =>
        set(s => {
          const base = s.laserDmxShowDirectorHistoryTransaction
          if (!base) return {}
          const current = normalizeShowDirectorSnapshot(s.laserDmxShowDirector)
          if (showDirectorSnapshotsEqual(base, current)) {
            return { laserDmxShowDirectorHistoryTransaction: null }
          }
          return {
            laserDmxShowDirectorUndoStack: trimShowDirectorHistory([...s.laserDmxShowDirectorUndoStack, base]),
            laserDmxShowDirectorRedoStack: [],
            laserDmxShowDirectorHistoryTransaction: null,
          }
        }),

      clearLaserDmxShowDirectorHistory: () =>
        set({
          laserDmxShowDirectorUndoStack: [],
          laserDmxShowDirectorRedoStack: [],
          laserDmxShowDirectorHistoryTransaction: null,
        }),

      selectLaserDmxShowDirectorFixture: (fixtureId) =>
        set(s => {
          const selectedFixtureId = fixtureId && s.laserDmxShowDirector.fixtures.some(fixture => fixture.id === fixtureId)
            ? fixtureId
            : null
          return {
            laserDmxShowDirector: normalizeLaserDmxShowDirectorSelectionState(
              s.laserDmxShowDirector,
              selectedFixtureId ? [selectedFixtureId] : [],
              selectedFixtureId,
            ),
          }
        }),

      toggleLaserDmxShowDirectorFixtureSelection: (fixtureId) =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (!current.fixtures.some(fixture => fixture.id === fixtureId)) return {}
          const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(current)
          const isSelected = selectedFixtureIds.includes(fixtureId)
          const nextSelectedFixtureIds = isSelected
            ? selectedFixtureIds.filter(id => id !== fixtureId)
            : [...selectedFixtureIds, fixtureId]
          const nextPrimaryId = isSelected && current.selectedFixtureId === fixtureId
            ? nextSelectedFixtureIds[0] ?? null
            : current.selectedFixtureId ?? fixtureId
          return {
            laserDmxShowDirector: normalizeLaserDmxShowDirectorSelectionState(current, nextSelectedFixtureIds, nextPrimaryId),
          }
        }),

      selectLaserDmxShowDirectorFixtures: (fixtureIds, primaryFixtureId) =>
        set(s => ({
          laserDmxShowDirector: normalizeLaserDmxShowDirectorSelectionState(
            s.laserDmxShowDirector,
            fixtureIds,
            primaryFixtureId,
          ),
        })),

      clearLaserDmxShowDirectorSelection: () =>
        set(s => ({
          laserDmxShowDirector: normalizeLaserDmxShowDirectorSelectionState(s.laserDmxShowDirector, [], null),
        })),

      deleteSelectedLaserDmxShowDirectorFixtures: () =>
        set(s => {
          const current = s.laserDmxShowDirector
          const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(current)
          if (selectedFixtureIds.length === 0) return {}
          const selectedSet = new Set(selectedFixtureIds)
          const fixtures = clampLaserDmxShowDirectorOrphanedMirrorLinks(current.fixtures.filter(fixture => !selectedSet.has(fixture.id)))
          if (fixtures.length === current.fixtures.length) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures,
            selectedFixtureId: null,
            selectedFixtureIds: [],
          })
        }),

      moveSelectedLaserDmxShowDirectorFixtures: (deltaX, deltaY) =>
        set(s => {
          const current = s.laserDmxShowDirector
          const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(current)
          if (selectedFixtureIds.length === 0) return {}
          const selectedSet = new Set(selectedFixtureIds)
          const drivenPairIds = new Set<string>()
          const drivenFixtureIds = selectedFixtureIds.filter(fixtureId => {
            const fixture = current.fixtures.find(candidate => candidate.id === fixtureId)
            if (!fixture?.linkedPairId) return true
            if (drivenPairIds.has(fixture.linkedPairId)) return false
            drivenPairIds.add(fixture.linkedPairId)
            return true
          })
          const drivenSet = new Set(drivenFixtureIds)
          const selectedFixtures = current.fixtures.filter(fixture => drivenSet.has(fixture.id))
          const clampedDelta = clampLaserDmxShowDirectorDelta(selectedFixtures, current.settings, deltaX, deltaY)
          if (clampedDelta.deltaX === 0 && clampedDelta.deltaY === 0) return {}
          const movedFixtures = current.fixtures.map((fixture, index) => drivenSet.has(fixture.id)
            ? clampLaserDmxShowDirectorFixtureToSettings({
                ...fixture,
                x: fixture.x + clampedDelta.deltaX,
                y: fixture.y + clampedDelta.deltaY,
              }, current.settings, index)
            : fixture)
          const syncedFixtures = syncLaserDmxShowDirectorLinkedMirrors(movedFixtures, current, drivenFixtureIds)
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: clampLaserDmxShowDirectorOrphanedMirrorLinks(syncedFixtures),
            selectedFixtureId: current.selectedFixtureId,
            selectedFixtureIds: current.selectedFixtureIds.filter(id => selectedSet.has(id)),
          })
        }),

      duplicateSelectedLaserDmxShowDirectorFixtures: () => {
        const state = get().laserDmxShowDirector
        const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(state)
        if (selectedFixtureIds.length === 0) return []
        const selectedSet = new Set(selectedFixtureIds)
        const offset = state.settings.snapEnabled ? 1 : 0.8
        const copies = state.fixtures
          .filter(fixture => selectedSet.has(fixture.id))
          .map((source, index) => createOffsetLaserDmxShowDirectorFixtureCopy(
            source,
            state,
            createLaserDmxShowDirectorId(),
            state.fixtures.length + index,
            offset,
          ))
        if (copies.length === 0) return []
        const copyIds = copies.map(copy => copy.id)
        set(s => buildLaserDmxShowDirectorHistoryPatch(s, {
          ...s.laserDmxShowDirector,
          fixtures: [...s.laserDmxShowDirector.fixtures, ...copies],
          selectedFixtureId: copyIds[0] ?? null,
          selectedFixtureIds: copyIds,
        }))
        return copyIds
      },

      groupSelectedLaserDmxShowDirectorFixtures: (label) => {
        const state = get().laserDmxShowDirector
        const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(state)
        if (selectedFixtureIds.length < 2) return null
        const groupId = createLaserDmxShowDirectorId()
        const groupLabel = sanitizeLaserDmxShowDirectorGroupLabel(label, createLaserDmxShowDirectorGroupLabel(state))
        const group: LaserDmxShowDirectorGroup = {
          schemaVersion: state.schemaVersion,
          id: groupId,
          label: groupLabel,
        }
        const selectedSet = new Set(selectedFixtureIds)
        set(s => {
          const current = s.laserDmxShowDirector
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            groups: [...current.groups, group],
            fixtures: current.fixtures.map((fixture, index) => selectedSet.has(fixture.id)
              ? mergeLaserDmxShowDirectorFixturePatch(fixture, { groupId }, index)
              : fixture),
            selectedFixtureIds,
            selectedFixtureId: selectedFixtureIds[0] ?? null,
          })
        })
        return groupId
      },

      ungroupSelectedLaserDmxShowDirectorFixtures: () =>
        set(s => {
          const current = s.laserDmxShowDirector
          const selectedFixtureIds = getLaserDmxShowDirectorSelectedFixtureIds(current)
          if (selectedFixtureIds.length === 0) return {}
          const selectedSet = new Set(selectedFixtureIds)
          const hasGroupedSelection = current.fixtures.some(fixture => selectedSet.has(fixture.id) && fixture.groupId)
          if (!hasGroupedSelection) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: current.fixtures.map((fixture, index) => selectedSet.has(fixture.id)
              ? mergeLaserDmxShowDirectorFixturePatch(fixture, { groupId: null }, index)
              : fixture),
          })
        }),

      selectLaserDmxShowDirectorGroup: (groupId) =>
        set(s => {
          const fixtureIds = s.laserDmxShowDirector.fixtures
            .filter(fixture => fixture.groupId === groupId)
            .map(fixture => fixture.id)
          if (fixtureIds.length === 0) return {}
          return {
            laserDmxShowDirector: normalizeLaserDmxShowDirectorSelectionState(
              s.laserDmxShowDirector,
              fixtureIds,
              fixtureIds[0] ?? null,
            ),
          }
        }),

      renameLaserDmxShowDirectorGroup: (groupId, label) =>
        set(s => {
          const current = s.laserDmxShowDirector
          const group = findLaserDmxShowDirectorGroup(current, groupId)
          if (!group) return {}
          const nextLabel = sanitizeLaserDmxShowDirectorGroupLabel(label, group.label)
          if (nextLabel === group.label) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            groups: current.groups.map(candidate => candidate.id === groupId ? { ...candidate, label: nextLabel } : candidate),
          })
        }),

      duplicateLaserDmxShowDirectorGroup: (groupId) => {
        const state = get().laserDmxShowDirector
        const group = findLaserDmxShowDirectorGroup(state, groupId)
        if (!group) return []
        const sourceFixtures = state.fixtures.filter(fixture => fixture.groupId === groupId)
        if (sourceFixtures.length === 0) return []
        const offset = state.settings.snapEnabled ? 1 : 0.8
        const newGroup: LaserDmxShowDirectorGroup = {
          schemaVersion: state.schemaVersion,
          id: createLaserDmxShowDirectorId(),
          semanticKey: undefined,
          label: sanitizeLaserDmxShowDirectorGroupLabel(`${group.label} Copy`, `${group.label} Copy`),
        }
        const copies = sourceFixtures.map((source, index) => ({
          ...createOffsetLaserDmxShowDirectorFixtureCopy(
            source,
            state,
            createLaserDmxShowDirectorId(),
            state.fixtures.length + index,
            offset,
          ),
          groupId: newGroup.id,
        }))
        const copyIds = copies.map(copy => copy.id)
        set(s => buildLaserDmxShowDirectorHistoryPatch(s, {
          ...s.laserDmxShowDirector,
          groups: [...s.laserDmxShowDirector.groups, newGroup],
          fixtures: [...s.laserDmxShowDirector.fixtures, ...copies],
          selectedFixtureId: copyIds[0] ?? null,
          selectedFixtureIds: copyIds,
        }))
        return copyIds
      },

      ungroupLaserDmxShowDirectorGroup: (groupId) =>
        set(s => {
          const current = s.laserDmxShowDirector
          if (!current.fixtures.some(fixture => fixture.groupId === groupId)) return {}
          return buildLaserDmxShowDirectorHistoryPatch(s, {
            ...current,
            fixtures: current.fixtures.map((fixture, index) => fixture.groupId === groupId
              ? mergeLaserDmxShowDirectorFixturePatch(fixture, { groupId: null }, index)
              : fixture),
          })
        }),

      clearLaserDmxShowDirectorFixtures: () =>
        set(s => buildLaserDmxShowDirectorHistoryPatch(s, {
          ...s.laserDmxShowDirector,
          fixtures: [],
          selectedFixtureId: null,
          selectedFixtureIds: [],
        })),

      resetLaserDmxShowDirectorLayout: () =>
        set(s => ({
          laserDmxBeamMatrixAuthoringMode: 'showDirector' as const,
          laserDmxBeamMatrixPresetDirty: true,
          laserDmxShowDirector: preserveLaserDmxShowDirectorGlobalSettings(
            createDefaultLaserDmxShowDirectorState(),
            s.laserDmxShowDirector.settings,
          ),
          laserDmxShowDirectorUndoStack: [],
          laserDmxShowDirectorRedoStack: [],
          laserDmxShowDirectorHistoryTransaction: null,
          laserDmxShowDirectorPerformance: {
            ...normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance),
            presetDirty: s.laserDmxShowDirectorPerformance.activePresetId != null ? true : s.laserDmxShowDirectorPerformance.presetDirty,
            runtimeInvalidationId: nextLaserDmxShowDirectorPerformanceInvalidationId(
              s.laserDmxShowDirectorPerformance.runtimeInvalidationId,
              s.laserDmxShowDirectorPerformance.activeProgramId,
            ),
          },
        })),

      applyLaserDmxShowDirectorTemplate: (templateId) => {
        const next = createLaserDmxShowDirectorTemplateState(templateId, createLaserDmxShowDirectorId)
        if (!next) return false
        set(s => {
          const nextWithGlobalSettings = preserveLaserDmxShowDirectorGlobalSettings(
            next,
            s.laserDmxShowDirector.settings,
          )
          return {
            laserDmxBeamMatrixAuthoringMode: 'showDirector' as const,
            ...buildLaserDmxShowDirectorHistoryPatch(s, nextWithGlobalSettings),
            laserDmxBeamMatrixPresetDirty: false,
            // A normal Rig Layout is an authored static rig. Do not silently keep an
            // incompatible full-song Performance Show active against different keys.
            laserDmxShowDirectorPerformance: clearLaserDmxShowDirectorPerformanceProgramState(
              normalizeLaserDmxShowDirectorPerformanceState(s.laserDmxShowDirectorPerformance),
            ),
          }
        })
        resetBeamMatrixCompilerState()
        resetFogState()
        return true
      },

      updateLaserDmxShowDirectorSettings: (patch) =>
        set(s => {
          const next = mergeLaserDmxShowDirectorSettingsPatch(s.laserDmxShowDirector, patch)
          if (isLaserDmxShowDirectorGlobalSettingsPatch(patch)) {
            return showDirectorSnapshotsEqual(
              normalizeShowDirectorSnapshot(s.laserDmxShowDirector),
              normalizeShowDirectorSnapshot(next),
            )
              ? {}
              : { laserDmxShowDirector: next }
          }
          return buildLaserDmxShowDirectorHistoryPatch(s, next)
        }),

      // ── React preset automation cues ────────────────────────────────────────

      getPresetAutomationCuesForTrack: (trackId) =>
        [...(get().presetAutomationCuesByTrackId[trackId] ?? [])].sort((a, b) => a.timeSec - b.timeSec),

      addPresetAutomationCue: (trackId, cue) =>
        set((s) => {
          const existing = s.presetAutomationCuesByTrackId[trackId] ?? []
          if (existing.some(c => c.id === cue.id) || !isLivePresetId(s.reactPresets, cue.presetId)) return {}
          const safe: ReactPresetAutomationCue = { ...cue, timeSec: Math.max(0, cue.timeSec) }
          return {
            presetAutomationCuesByTrackId: {
              ...s.presetAutomationCuesByTrackId,
              [trackId]: [...existing, safe],
            },
          }
        }),

      updatePresetAutomationCue: (trackId, id, patch) =>
        set((s) => {
          const existing = s.presetAutomationCuesByTrackId[trackId] ?? []
          return {
            presetAutomationCuesByTrackId: {
              ...s.presetAutomationCuesByTrackId,
              [trackId]: existing.map((c) => {
                if (c.id !== id) return c
                const merged = { ...c, ...patch }
                if (!isLivePresetId(s.reactPresets, merged.presetId)) return c
                return { ...merged, timeSec: Math.max(0, merged.timeSec) }
              }),
            },
          }
        }),

      removePresetAutomationCue: (trackId, id) =>
        set((s) => {
          const existing = s.presetAutomationCuesByTrackId[trackId] ?? []
          return {
            presetAutomationCuesByTrackId: {
              ...s.presetAutomationCuesByTrackId,
              [trackId]: existing.filter((c) => c.id !== id),
            },
          }
        }),

      clearPresetAutomationCuesForTrack: (trackId) =>
        set((s) => {
          const { [trackId]: _removed, ...rest } = s.presetAutomationCuesByTrackId
          return { presetAutomationCuesByTrackId: rest }
        }),

      // ── PixGrid action cues ───────────────────────────────────────────────────

      getPixGridActionCuesForTrack: (trackId) =>
        sortPixGridActionCues(get().pixGridActionCuesByTrackId[trackId] ?? []),

      addPixGridActionCue: (trackId, cue) =>
        set((s) => {
          const existing = s.pixGridActionCuesByTrackId[trackId] ?? []
          if (existing.length >= MAX_PIX_GRID_ACTION_CUES_PER_TRACK) return {}
          if (!(trackId in s.pixGridActionCuesByTrackId) && Object.keys(s.pixGridActionCuesByTrackId).length >= MAX_PIX_GRID_ACTION_CUE_TRACKS) return {}
          if (existing.some(candidate => candidate.id === cue.id)) return {}
          const normalized = normalizePixGridActionCue(cue, existing.length)
          if (!normalized) return {}
          return {
            pixGridActionCuesByTrackId: {
              ...s.pixGridActionCuesByTrackId,
              [trackId]: sortPixGridActionCues([...existing, normalized]),
            },
          }
        }),

      updatePixGridActionCue: (trackId, id, patch) =>
        set((s) => {
          const existing = s.pixGridActionCuesByTrackId[trackId] ?? []
          const index = existing.findIndex(cue => cue.id === id)
          if (index < 0) return {}
          const normalized = normalizePixGridActionCue({
            ...existing[index],
            ...patch,
            id,
            engineId: 'pixGrid',
          }, existing[index].order)
          if (!normalized) return {}
          const next = existing.slice()
          next[index] = normalized
          return {
            pixGridActionCuesByTrackId: {
              ...s.pixGridActionCuesByTrackId,
              [trackId]: sortPixGridActionCues(next),
            },
          }
        }),

      duplicatePixGridActionCue: (trackId, id) => {
        let duplicatedId: string | null = null
        set((s) => {
          const existing = s.pixGridActionCuesByTrackId[trackId] ?? []
          if (existing.length >= MAX_PIX_GRID_ACTION_CUES_PER_TRACK) return {}
          const source = existing.find(cue => cue.id === id)
          if (!source) return {}
          duplicatedId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `pixgrid-cue-${Date.now()}-${existing.length}`
          const duplicated = normalizePixGridActionCue({
            ...source,
            id: duplicatedId,
            label: `${source.label} Copy`,
            order: Math.max(...existing.map(cue => cue.order), -1) + 1,
          }, existing.length)
          if (!duplicated) {
            duplicatedId = null
            return {}
          }
          return {
            pixGridActionCuesByTrackId: {
              ...s.pixGridActionCuesByTrackId,
              [trackId]: sortPixGridActionCues([...existing, duplicated]),
            },
          }
        })
        return duplicatedId
      },

      removePixGridActionCue: (trackId, id) =>
        set((s) => {
          const existing = s.pixGridActionCuesByTrackId[trackId] ?? []
          const next = existing.filter(cue => cue.id !== id)
          if (next.length === existing.length) return {}
          const { [trackId]: _removed, ...rest } = s.pixGridActionCuesByTrackId
          return {
            pixGridActionCuesByTrackId: next.length > 0
              ? { ...s.pixGridActionCuesByTrackId, [trackId]: next }
              : rest,
          }
        }),

      clearPixGridActionCuesForTrack: (trackId) =>
        set((s) => {
          if (!(trackId in s.pixGridActionCuesByTrackId)) return {}
          const { [trackId]: _removed, ...rest } = s.pixGridActionCuesByTrackId
          return { pixGridActionCuesByTrackId: rest }
        }),

      // ── Sound Drawing layers ─────────────────────────────────────────────────

      getSoundDrawingLayersForTrack: (trackId) =>
        get().soundDrawingLayersByTrackId[trackId] ?? [],

      addSoundDrawingLayer: (trackId, layer) => {
        const id = crypto.randomUUID()
        set((s) => {
          const storedLayer = normalizeSoundDrawingLayer({ ...layer, id })
          const newTextCache = prepareSoundDrawingLayerTextPoints(
            s.oscillatorFontAssets,
            s.oscillatorSettings,
            storedLayer,
            s.oscillatorTextPointCache,
          )
          return {
            soundDrawingLayersByTrackId: {
              ...s.soundDrawingLayersByTrackId,
              [trackId]: [...(s.soundDrawingLayersByTrackId[trackId] ?? []), storedLayer],
            },
            oscillatorTextPointCache: newTextCache,
          }
        })
        return id
      },

      updateSoundDrawingLayer: (trackId, layerId, patch) =>
        set((s) => {
          const layers = s.soundDrawingLayersByTrackId[trackId] ?? []
          const merged = layers.map((l) => l.id === layerId
            ? normalizeSoundDrawingLayer({ ...l, ...patch })
            : l)
          const updated = merged.find(l => l.id === layerId)
          const newTextCache = updated
            ? prepareSoundDrawingLayerTextPoints(
                s.oscillatorFontAssets,
                s.oscillatorSettings,
                updated,
                s.oscillatorTextPointCache,
              )
            : s.oscillatorTextPointCache
          return {
            soundDrawingLayersByTrackId: {
              ...s.soundDrawingLayersByTrackId,
              [trackId]: merged,
            },
            oscillatorTextPointCache: newTextCache,
          }
        }),

      duplicateSoundDrawingLayer: (trackId, layerId) =>
        set((s) => {
          const layers = s.soundDrawingLayersByTrackId[trackId] ?? []
          const src = layers.find((l) => l.id === layerId)
          if (!src) return {}
          const copy = normalizeSoundDrawingLayer({
            ...src,
            id: crypto.randomUUID(),
            name: `${src.name} Copy`,
          })
          const newTextCache = prepareSoundDrawingLayerTextPoints(
            s.oscillatorFontAssets,
            s.oscillatorSettings,
            copy,
            s.oscillatorTextPointCache,
          )
          return {
            soundDrawingLayersByTrackId: {
              ...s.soundDrawingLayersByTrackId,
              [trackId]: [...layers, copy],
            },
            oscillatorTextPointCache: newTextCache,
          }
        }),

      removeSoundDrawingLayer: (trackId, layerId) =>
        set((s) => ({
          soundDrawingLayersByTrackId: {
            ...s.soundDrawingLayersByTrackId,
            [trackId]: (s.soundDrawingLayersByTrackId[trackId] ?? []).filter((l) => l.id !== layerId),
          },
          soundDrawingClipsByTrackId: {
            ...s.soundDrawingClipsByTrackId,
            [trackId]: (s.soundDrawingClipsByTrackId[trackId] ?? []).filter((c) => c.layerId !== layerId),
          },
        })),

      // ── Sound Drawing clips ──────────────────────────────────────────────────

      getSoundDrawingClipsForTrack: (trackId) =>
        [...(get().soundDrawingClipsByTrackId[trackId] ?? [])].sort(
          (a, b) => a.startSec !== b.startSec ? a.startSec - b.startSec : a.zIndex - b.zIndex,
        ),

      addSoundDrawingClip: (trackId, clip, trackDurationSec) => {
        const id   = crypto.randomUUID()
        const safe = normalizeSoundDrawingClip(
          { ...clip, id, trackId },
          trackId,
          trackDurationSec,
        )
        set((s) => ({
          soundDrawingClipsByTrackId: {
            ...s.soundDrawingClipsByTrackId,
            [trackId]: [...(s.soundDrawingClipsByTrackId[trackId] ?? []), safe],
          },
        }))
        return id
      },

      updateSoundDrawingClip: (trackId, clipId, patch, trackDurationSec) =>
        set((s) => {
          const clips = s.soundDrawingClipsByTrackId[trackId] ?? []
          return {
            soundDrawingClipsByTrackId: {
              ...s.soundDrawingClipsByTrackId,
              [trackId]: clips.map((c) =>
                c.id === clipId
                  ? normalizeSoundDrawingClip({ ...c, ...patch, trackId }, trackId, trackDurationSec)
                  : c,
              ),
            },
          }
        }),

      duplicateSoundDrawingClip: (trackId, clipId) =>
        set((s) => {
          const clips = s.soundDrawingClipsByTrackId[trackId] ?? []
          const src = clips.find((c) => c.id === clipId)
          if (!src) return {}
          const copy = normalizeSoundDrawingClip(
            { ...src, id: crypto.randomUUID(), trackId },
            trackId,
          )
          return {
            soundDrawingClipsByTrackId: {
              ...s.soundDrawingClipsByTrackId,
              [trackId]: [...clips, copy],
            },
          }
        }),

      removeSoundDrawingClip: (trackId, clipId) =>
        set((s) => ({
          soundDrawingClipsByTrackId: {
            ...s.soundDrawingClipsByTrackId,
            [trackId]: (s.soundDrawingClipsByTrackId[trackId] ?? []).filter((c) => c.id !== clipId),
          },
        })),

      // ── Beam Matrix preset actions ───────────────────────────────────────────

      applyLaserDmxBeamMatrixPreset: (presetId) => {
        const preset = getLaserDmxBeamMatrixPreset(presetId)
        if (!preset) return
        const fresh = preset.createSettings()
        const clampedBeams = fresh.beams
          .slice(0, LASER_DMX_MATRIX_MAX_BEAMS)
          .map(clampMatrixBeam)
        // Reset ephemeral renderer state so old trigger tails don't bleed in.
        resetBeamMatrixCompilerState()
        resetFogState()
        set(s => ({
          laserDmxWorkspaceMode:              'beamMatrix' as const,
          laserDmxBeamMatrixAuthoringMode:    'manual' as const,
          activeReactEngineId:                'laserDmx' as const,
          ...clearPerformanceActionPatch(),
          activeLaserDmxBeamMatrixPresetId:   presetId,
          laserDmxBeamMatrixPresetDirty:      false,
          laserDmxSettings: normalizeLaserDmxSettings({
            ...s.laserDmxSettings,
            productionCues: migrateLegacyBeamMatrixCues(fresh.cues ?? [], s.laserDmxSettings.productionCues ?? []),
          }),
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams:                  clampedBeams,
            groups:                 fresh.groups,
            globalModulationRoutes: fresh.globalModulationRoutes,
            output:                 fresh.output,
            fog:                    fresh.fog,
            cues:                   fresh.cues ?? [],
            selectedBeamIds:        [],
            selectedGroupId:        null,
            // editor settings survive preset changes
          },
        }))
      },

      clearActiveLaserDmxBeamMatrixPreset: () =>
        set({ activeLaserDmxBeamMatrixPresetId: null }),

      resetCurrentEngineSettings: () =>
        set((s) => {
          const sharedDefaults = {
            reactIntensity:       0.7,
            reactMotion:          0.5,
            reactGlow:            0.65,
            reactBassReactivity:  0.8,
            reactTrailDecay:      0.08,
            reactFogDensity:      0.5,
            reactParticleDensity: 0.5,
            performancePadTransition: null,
            ...clearPerformanceActionPatch(),
          }

          if (s.activeReactEngineId === 'cinematicPortal' && s.activeReactPresetId) {
            const { [s.activeReactPresetId]: _removed, ...rest } = s.cinematicConfigsByPresetId
            void _removed
            return { ...sharedDefaults, cinematicConfigsByPresetId: rest }
          }

          if (s.activeReactEngineId === 'oscilloscope') {
            return {
              ...sharedDefaults,
              oscillatorSettings: { ...DEFAULT_OSCILLATOR_SETTINGS },
              oscillatorTextPointCache: prepareAllSoundDrawingTextPoints(
                s.oscillatorFontAssets,
                DEFAULT_OSCILLATOR_SETTINGS,
                s.soundDrawingLayersByTrackId,
                s.oscillatorTextPointCache,
              ),
              glyphLostNotice: null,
              soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision + 1,
            }
          }

          if (s.activeReactEngineId === 'laserDmx') {
            const defaults = createDefaultLaserDmxBeamMatrixSettings()
            const laserDmxBeamMatrix = {
              ...s.laserDmxBeamMatrix,
              output: defaults.output,
              fog: defaults.fog,
            }
            return {
              ...sharedDefaults,
              laserDmxWorkspaceMode: 'beamMatrix' as const,
              laserDmxBeamMatrixAuthoringMode: 'manual' as const,
              laserDmxBeamMatrix,
              laserDmxBeamMatrixPresetDirty: isLaserDmxBeamMatrixPresetDirty(
                laserDmxBeamMatrix,
                s.activeLaserDmxBeamMatrixPresetId,
              ),
            }
          }

          if (s.activeReactEngineId === 'pixGrid') {
            return {
              ...sharedDefaults,
              pixGridState: resetPixGridStatePreservingSelection(s.pixGridState),
            }
          }

          if (s.activeReactEngineId === 'canvas') {
            revokeCanvasMediaObjectUrls(s.canvasMediaItems)
            return {
              ...sharedDefaults,
              canvasEngineSettings: { ...DEFAULT_CANVAS_ENGINE_SETTINGS },
              canvasMediaItems: [],
              canvasMediaTimingById: {},
              selectedCanvasMediaId: null,
              activeCanvasMediaId: null,
              selectedCanvasPresetId: DEFAULT_CANVAS_PRESET_ID,
              canvasPresetSettings: { ...DEFAULT_CANVAS_PRESET_SETTINGS },
              canvasPresetOverride: DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
              canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS),
              canvasVideoRestartRevision: s.canvasVideoRestartRevision + 1,
            }
          }

          return sharedDefaults
        }),

      resetReactViewPreferences: () =>
        set((s) => {
          const defaultMatrix = createDefaultLaserDmxBeamMatrixSettings()
          const selectedFixtureId = s.laserDmxSettings.fixtures.some(
            fixture => fixture.id === s.laserDmxSettings.selectedFixtureId,
          )
            ? s.laserDmxSettings.selectedFixtureId
            : (s.laserDmxSettings.fixtures[0]?.id ?? null)
          const startupPreset = DEFAULT_REACT_PRESETS.find(preset => preset.id === INITIAL_PRESET_ID)
          const startupPatch = startupPreset
            ? buildPresetPatchForState(startupPreset, s)
            : {
                activeReactPresetId: INITIAL_PRESET_ID,
                activeReactEngineId: INITIAL_ENGINE_ID,
                ...clearPerformanceActionPatch(),
              }

          return {
            ...startupPatch,
            laserDmxWorkspaceMode: 'beamMatrix' as const,
            laserDmxBeamMatrixAuthoringMode: 'manual' as const,
            selectedSectionId: null,
            selectedSectionByTrackId: {},
            activePadId: null,
            glyphLostNotice: null,
            performancePadTransition: null,
            activeLaserDmxBeamMatrixPresetId: null,
            laserDmxSettings: {
              ...s.laserDmxSettings,
              selectedFixtureId,
            },
            laserDmxBeamMatrix: {
              ...s.laserDmxBeamMatrix,
              selectedBeamIds: [],
              selectedGroupId: null,
              editor: defaultMatrix.editor,
            },
            laserDmxShowDirector: normalizeLaserDmxShowDirectorState({
              ...s.laserDmxShowDirector,
              selectedFixtureId: null,
            }),
          }
        }),

      clearReactProjectContent: () =>
        set((s) => {
          const repairedSelection = repairReactEnginePresetSelection(
            s.activeReactPresetId,
            s.activeReactEngineId,
            DEFAULT_REACT_PRESETS,
          )
          resetBeamMatrixCompilerState()
          resetFogState()
          revokeCanvasMediaObjectUrls(s.canvasMediaItems)
          return {
            ...repairedSelection,
            reactPresets: DEFAULT_REACT_PRESETS,
            pixGridState: createDefaultPixGridState(),
            pixGridUndoStack: [],
            pixGridRedoStack: [],
            pixGridHistoryTransaction: null,
            cinematicConfigsByPresetId: {},
            cinematicSeedLocksByPresetId: {},
            canvasEngineSettings: { ...DEFAULT_CANVAS_ENGINE_SETTINGS },
            canvasMediaItems: [],
            canvasMediaTimingById: {},
            selectedCanvasMediaId: null,
            activeCanvasMediaId: null,
            selectedCanvasPresetId: DEFAULT_CANVAS_PRESET_ID,
            canvasPresetSettings: { ...DEFAULT_CANVAS_PRESET_SETTINGS },
            canvasPresetOverride: DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
            canvasOrchestrationSettings: normalizeCanvasOrchestrationSettings(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS),
            canvasVideoRestartRevision: s.canvasVideoRestartRevision + 1,
            manualTrackSectionsByTrackId: {},
            selectedSectionId: null,
            selectedSectionByTrackId: {},
            suppressedAutoSectionsByTrackId: {},
            presetAutomationCuesByTrackId: {},
            pixGridActionCuesByTrackId: {},
            soundDrawingLayersByTrackId: {},
            soundDrawingClipsByTrackId: {},
            performancePads: DEFAULT_PERFORMANCE_PADS,
            activePadId: null,
            laserDmxSettings: createDefaultLaserDmxSettings(),
            selectedLaserDmxProductionCueId: null,
            laserDmxBeamMatrixAuthoringMode: DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
            laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
            laserDmxShowDirector: createDefaultLaserDmxShowDirectorState(),
            laserDmxShowDirectorPerformance: createDefaultLaserDmxShowDirectorPerformanceState(),
            activeLaserDmxBeamMatrixPresetId: null,
            laserDmxBeamMatrixPresetDirty: false,
            performancePadTransition: null,
            ...clearPerformanceActionPatch(),
          }
        }),

      // Legacy compatibility only. The React UI uses the three scoped actions above.
      resetReactView: () => {
        const previousCanvasItems = get().canvasMediaItems
        revokeCanvasMediaObjectUrls(previousCanvasItems)
        clearSvgVisualCache()
        set({
          activeReactPresetId:          INITIAL_PRESET_ID,
          activeReactEngineId:          INITIAL_ENGINE_ID,
          reactPresets:                 DEFAULT_REACT_PRESETS,
          pixGridState:                 createDefaultPixGridState(),
          pixGridUndoStack:             [],
          pixGridRedoStack:             [],
          pixGridHistoryTransaction:    null,
          cinematicConfigsByPresetId:   {},
          cinematicSeedLocksByPresetId: {},
          cinematicWorldsUiMode:        'simple',
          canvasEngineSettings:         { ...DEFAULT_CANVAS_ENGINE_SETTINGS },
          canvasMediaItems:             [],
          canvasMediaTimingById:        {},
          selectedCanvasMediaId:        null,
          activeCanvasMediaId:          null,
          selectedCanvasPresetId:       DEFAULT_CANVAS_PRESET_ID,
          canvasPresetSettings:         { ...DEFAULT_CANVAS_PRESET_SETTINGS },
          canvasPresetOverride:         DEFAULT_CANVAS_PRESET_OVERRIDE_STATE,
          canvasOrchestrationSettings:  normalizeCanvasOrchestrationSettings(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS),
          canvasVideoRestartRevision:   get().canvasVideoRestartRevision + 1,
          manualTrackSectionsByTrackId: {},
          selectedSectionId:            null,
          selectedSectionByTrackId:     {},
          suppressedAutoSectionsByTrackId: {},
          presetAutomationCuesByTrackId: {},
          pixGridActionCuesByTrackId: {},
          soundDrawingLayersByTrackId:  {},
          soundDrawingClipsByTrackId:   {},
          performancePads:           DEFAULT_PERFORMANCE_PADS,
          activePadId:               null,
          oscillatorSettings:        DEFAULT_OSCILLATOR_SETTINGS,
          oscillatorGlyphPointCache: {},
          oscillatorTextPointCache:  {},
          glyphLostNotice:           null,
          performanceActionEvent:           null,
          performanceActionEvents:          [],
          performanceActionToggleStates:    {},
          laserDmxSettings:                 ensureProductionLookCompatibility(createDefaultLaserDmxSettings()),
          selectedLaserDmxProductionCueId:   null,
          laserDmxWorkspaceMode:            'beamMatrix',
          laserDmxBeamMatrixAuthoringMode:  DEFAULT_LASER_DMX_BEAM_MATRIX_AUTHORING_MODE,
          laserDmxBeamMatrix:               createDefaultLaserDmxBeamMatrixSettings(),
          laserDmxShowDirector:             createDefaultLaserDmxShowDirectorState(),
          laserDmxShowDirectorPerformance:  createDefaultLaserDmxShowDirectorPerformanceState(),
          laserDmxShowDirectorUndoStack:    [],
          laserDmxShowDirectorRedoStack:    [],
          laserDmxShowDirectorHistoryTransaction: null,
          activeLaserDmxBeamMatrixPresetId: null,
          laserDmxBeamMatrixPresetDirty:    false,
          reactIntensity:       0.7,
          reactMotion:          0.5,
          reactGlow:            0.65,
          reactBassReactivity:  0.8,
          reactTrailDecay:      0.08,
          reactFogDensity:      0.5,
          reactParticleDensity: 0.5,
          performancePadTransition: null,
        })
      },
    }),
    {
      name: 'drmvyz:react-store',
      version: 51,
      storage: reactPersistStorage,
      migrate: migrateReactStore,
      partialize: reactStorePartialize,
      merge: mergeReactStoreState,
    },
  ),
)
