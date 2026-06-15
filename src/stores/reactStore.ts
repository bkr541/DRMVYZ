import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_REACT_PRESETS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  createDefaultLaserDmxSettings,
  createDefaultLaserDmxBeamMatrixSettings,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
  LASER_DMX_MATRIX_MAX_BEAMS,
} from '../components/vyzualz/react/ReactTypes'
import type {
  ReactEngineId,
  ReactPreset,
  ReactPresetParams,
  ReactTrackSection,
  ReactPerformancePad,
  OscillatorSettings,
  OscillatorGlyphAsset,
  OscillatorGlyphPoint,
  OscillatorFontAsset,
  LaserDmxSettings,
  LaserDmxFixture,
  LaserDmxModulationRoute,
  LaserDmxWorkspaceMode,
  LaserDmxBeamMatrixSettings,
  LaserDmxBeamMatrixEditorSettings,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
} from '../components/vyzualz/react/ReactTypes'
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
  getSvgVisualEntry,
  setSvgVisualEntry,
  evictSvgVisual,
  clearSvgVisualCache,
} from '../components/vyzualz/react/renderers/svgVisualCache'
import { useMediaStore } from './mediaStore'
import { createSignedMediaUrl } from '../lib/mediaDb'
import {
  parseOpenTypeFontFromAsset,
  textToOpenTypeGlyphPoints,
  evictFontFromCache,
} from '../components/vyzualz/react/renderers/fontGlyphUtils'

// ── Point cache helpers ───────────────────────────────────────────────────────
// SVG cache key:  getSvgGlyphCacheKey(assetId, res, hash) → "${assetId}:${res}:v${version}:${hash}"
// Text cache key: "${fontId}:${text}:${fontSize}:${letterSpacing}:${resolution}"
// Resolution is clamped to [64, 2048] matching the renderer's own clamp.

function clampRes(v: number): number {
  return Math.max(64, Math.min(2048, Math.round(v)))
}

function textCacheKey(fontId: string, text: string, fontSize: number, spacing: number, res: number): string {
  return `${fontId}:${text.trim()}:${fontSize}:${spacing}:${res}`
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
      activeGlyphId = `glyph-media:${osc.selectedSvgId}`
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
  const { textFontId, text, textFontSize, textLetterSpacing, pathResolution } = settings
  if (!textFontId || !text.trim()) return cache
  const asset = assets.find(a => a.id === textFontId)
  if (!asset) return cache
  const res = clampRes(pathResolution)
  const key = textCacheKey(textFontId, text, textFontSize, textLetterSpacing, res)
  if (cache[key]) return cache
  try {
    const font = parseOpenTypeFontFromAsset(asset)
    const pts = textToOpenTypeGlyphPoints(font, text, res, {
      fontSize: textFontSize,
      letterSpacing: textLetterSpacing,
    })
    return { ...cache, [key]: pts }
  } catch {
    return cache
  }
}

// ── LaserDMX local helpers ────────────────────────────────────────────────────

function makeNewLaserFixture(existingFixtures: LaserDmxFixture[]): LaserDmxFixture {
  const maxAddr = existingFixtures.reduce((m, f) => Math.max(m, f.dmx.startAddress), 0)
  const nextAddr = Math.min(497, maxAddr + 16)  // keep within 512-channel universe
  return {
    id:      crypto.randomUUID(),
    name:    `Laser ${existingFixtures.length + 1}`,
    enabled: true,
    dmx: { universe: 1, startAddress: nextAddr, profileId: 'genericRgbLaser', channelMode: 'basic' },
    position: { originX: 0.5, originY: 0.85, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
    color: { mode: 'fixed', red: 0, green: 255, blue: 220, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.6, radius: 0.4, complexity: 0.4, smoothing: 0, pathProgress: 0 },
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
  return {
    ...DEFAULT_OSCILLATOR_SETTINGS,
    ...(preset.oscillatorSettings ?? {}),
  }
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
  const laserBase = currentLaserSettings ?? createDefaultLaserDmxSettings()

  let laserPatch: LaserDmxSettings | undefined
  if (preset.laserDmxSettings != null) {
    const merged = { ...laserBase, ...preset.laserDmxSettings }
    // Ensure selectedFixtureId always points to a fixture that exists after the merge.
    const fixtures = merged.fixtures ?? []
    const hasSelected = fixtures.some(f => f.id === merged.selectedFixtureId)
    if (!hasSelected) {
      merged.selectedFixtureId = fixtures[0]?.id ?? null
    }
    laserPatch = merged
  }

  return {
    activeReactPresetId: preset.id,
    activeReactEngineId: preset.engine,
    reactIntensity:      preset.params.intensity,
    reactMotion:         preset.params.motion,
    reactGlow:           preset.params.glow,
    reactBassReactivity: preset.params.bassReactivity,
    oscillatorSettings:  resolvePresetOscillatorSettings(preset, currentOscSettings),
    ...(laserPatch != null ? { laserDmxSettings: laserPatch } : {}),
  }
}

interface ReactStoreState {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
  reactPresets: ReactPreset[]

  // Manual track sections — stored per stable track ID so edits on Track A
  // never affect Track B.  Key '_legacy' holds sections migrated from the
  // old flat global array whose original track is unknown.
  manualTrackSectionsByTrackId: Record<string, ReactTrackSection[]>
  selectedSectionId: string | null

  // Global performance controls
  reactIntensity:       number
  reactMotion:          number
  reactGlow:            number
  reactBassReactivity:  number
  reactColorPalette:    string
  reactTrailDecay:      number
  reactFogDensity:      number
  reactParticleDensity: number

  // Actions
  setActiveReactPresetId: (id: string | null) => void
  /**
   * Low-level setter — only updates activeReactEngineId without touching the active preset.
   * UI code must call selectReactEngine instead, which also switches to a compatible preset
   * so that activeReactEngineId and activeReactPresetId.engine stay in sync.
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
  setReactColorPalette:    (palette: string) => void
  setReactTrailDecay:      (v: number) => void
  setReactFogDensity:      (v: number) => void
  setReactParticleDensity: (v: number) => void

  setSelectedSectionId: (id: string | null) => void
  /** Returns the manual sections for a specific track (empty array if none). */
  getManualSectionsForTrack: (trackId: string) => ReactTrackSection[]
  addManualSection: (trackId: string, section: ReactTrackSection) => void
  updateManualSection: (trackId: string, id: string, patch: Partial<ReactTrackSection>) => void
  removeManualSection: (trackId: string, id: string) => void
  clearManualSectionsForTrack: (trackId: string) => void

  // Performance pads
  performancePads: ReactPerformancePad[]
  activePadId: string | null
  setActivePadId: (id: string | null) => void
  updatePerformancePad: (id: string, patch: Partial<ReactPerformancePad>) => void

  // Oscillator settings
  oscillatorSettings: OscillatorSettings
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

  // SVG Visual mode — loads raw SVG from a media item, creates a Blob URL,
  // and stores the decoded HTMLImageElement in the module-level svgVisualCache.
  // Does not change sourceType if the asset is already selected and loaded.
  selectSvgVisual: (mediaId: string) => Promise<void>
  // Evicts the visual cache entry for mediaId and resets selectedSvgVisualId
  // if it matches. Called from mediaStore.removeItem to keep state consistent.
  clearSvgVisualForMedia: (mediaId: string) => void

  // Unified SVG asset selection (sourceType: 'svg').
  // Caches both glyph points (for reactivePath) and SVG image (for originalArtwork)
  // in parallel, then sets selectedSvgId + sourceType: 'svg'.
  selectSvgAsset: (mediaId: string) => Promise<void>

  // Uploaded font assets (persisted as base64)
  oscillatorFontAssets: OscillatorFontAsset[]
  addOscillatorFontAsset: (asset: OscillatorFontAsset) => void
  removeOscillatorFontAsset: (id: string) => void
  clearOscillatorFontAssets: () => void
  selectOscillatorFont: (id: string | null) => void

  // Pre-sampled OpenType text points — non-persisted
  // keyed by "${fontId}:${text}:${fontSize}:${letterSpacing}:${resolution}"
  oscillatorTextPointCache: Record<string, OscillatorGlyphPoint[]>

  resetReactView: () => void

  // LaserDMX Spatial Fixtures settings
  laserDmxSettings: LaserDmxSettings
  setLaserDmxSettings: (partial: Partial<LaserDmxSettings>) => void
  resetLaserDmxSettings: () => void
  selectLaserFixture: (fixtureId: string) => void
  addLaserFixture: () => void
  duplicateLaserFixture: (fixtureId: string) => void
  removeLaserFixture: (fixtureId: string) => void
  updateLaserFixture: (fixtureId: string, patch: Partial<LaserDmxFixture>) => void
  addLaserModulationRoute: (fixtureId: string) => void
  updateLaserModulationRoute: (fixtureId: string, routeId: string, patch: Partial<LaserDmxModulationRoute>) => void
  removeLaserModulationRoute: (fixtureId: string, routeId: string) => void

  // LaserDMX workspace mode (persisted, never changed by preset application)
  laserDmxWorkspaceMode: LaserDmxWorkspaceMode
  setLaserDmxWorkspaceMode: (mode: LaserDmxWorkspaceMode) => void

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
}

const INITIAL_PRESET_ID = DEFAULT_REACT_PRESETS[0].id
const INITIAL_ENGINE_ID: ReactEngineId = DEFAULT_REACT_PRESETS[0].engine

// ── Exported migration function (for testing) ─────────────────────────────────
export function migrateReactStore(persistedState: unknown, version: number): Record<string, unknown> {
  let state = (persistedState ?? {}) as Record<string, unknown>
  if (version < 1) {
    state = {
      ...state,
      laserDmxWorkspaceMode: 'spatialFixtures' as LaserDmxWorkspaceMode,
      laserDmxBeamMatrix:    createDefaultLaserDmxBeamMatrixSettings(),
    }
  }
  if (version < 2) {
    const osc = state.oscillatorSettings as Record<string, unknown> | undefined
    if (osc) {
      let migratedOsc = { ...osc }
      if (osc.sourceType === 'svgGlyph') {
        const glyphId = osc.selectedGlyphId as string | null
        const svgId = typeof glyphId === 'string' && glyphId.startsWith('glyph-media:')
          ? glyphId.slice('glyph-media:'.length)
          : glyphId
        migratedOsc = { ...migratedOsc, sourceType: 'svg', selectedSvgId: svgId ?? null, svgRenderMode: 'reactivePath', svgUseReactPalette: true, autoRotate: true }
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
  return state
}

export const useReactStore = create<ReactStoreState>()(
  persist(
    (set, get) => ({
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
      reactPresets: DEFAULT_REACT_PRESETS,
      manualTrackSectionsByTrackId: {},
      selectedSectionId: null,
      performancePads: DEFAULT_PERFORMANCE_PADS,
      activePadId: null,
      oscillatorSettings: DEFAULT_OSCILLATOR_SETTINGS,
      oscillatorGlyphAssets: [],
      oscillatorGlyphPointCache: {},
      oscillatorFontAssets: [],
      oscillatorTextPointCache: {},
      glyphLostNotice: null,
      laserDmxSettings:       createDefaultLaserDmxSettings(),
      laserDmxWorkspaceMode:  'spatialFixtures',
      laserDmxBeamMatrix:     createDefaultLaserDmxBeamMatrixSettings(),
      activeLaserDmxBeamMatrixPresetId: null,
      laserDmxBeamMatrixPresetDirty:    false,
      reactIntensity:       0.7,
      reactMotion:          0.5,
      reactGlow:            0.65,
      reactBassReactivity:  0.8,
      reactColorPalette:    'dvydrm',
      reactTrailDecay:      0.08,
      reactFogDensity:      0.5,
      reactParticleDensity: 0.5,

      setActiveReactPresetId: (id) => set({ activeReactPresetId: id }),

      setActiveReactEngineId: (id) => set({ activeReactEngineId: id }),

      selectReactEngine: (engineId) =>
        set((s) => {
          // If the current preset already belongs to the selected engine, only ensure
          // activeReactEngineId is correct (repairs any prior drift without a preset switch).
          const current = s.activeReactPresetId
            ? s.reactPresets.find(p => p.id === s.activeReactPresetId)
            : null
          if (current?.engine === engineId) {
            return { activeReactEngineId: engineId }
          }
          // Switch to the first preset available for this engine.
          const preset = s.reactPresets.find(p => p.engine === engineId)
          if (!preset) {
            // No presets registered for this engine — update ID only; panel shows empty state.
            return { activeReactEngineId: engineId }
          }
          return buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings)
        }),

      selectReactPreset: (id) =>
        set((s) => {
          const preset = s.reactPresets.find((p) => p.id === id)
          if (!preset) return {}
          return buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings)
        }),

      updateReactPresetParams: (id, patch) =>
        set((s) => ({
          reactPresets: s.reactPresets.map((p) =>
            p.id === id ? { ...p, params: { ...p.params, ...patch } } : p,
          ),
        })),

      setReactIntensity:       (v) => set({ reactIntensity: v }),
      setReactMotion:          (v) => set({ reactMotion: v }),
      setReactGlow:            (v) => set({ reactGlow: v }),
      setReactBassReactivity:  (v) => set({ reactBassReactivity: v }),
      setReactColorPalette:    (palette) => set({ reactColorPalette: palette }),
      setReactTrailDecay:      (v) => set({ reactTrailDecay: v }),
      setReactFogDensity:      (v) => set({ reactFogDensity: v }),
      setReactParticleDensity: (v) => set({ reactParticleDensity: v }),

      setSelectedSectionId: (id) => set({ selectedSectionId: id }),

      getManualSectionsForTrack: (trackId) =>
        get().manualTrackSectionsByTrackId[trackId] ?? [],

      addManualSection: (trackId, section) =>
        set((s) => ({
          manualTrackSectionsByTrackId: {
            ...s.manualTrackSectionsByTrackId,
            [trackId]: [...(s.manualTrackSectionsByTrackId[trackId] ?? []), section],
          },
        })),

      updateManualSection: (trackId, id, patch) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: existing.map((sec) => sec.id === id ? { ...sec, ...patch } : sec),
            },
          }
        }),

      removeManualSection: (trackId, id) =>
        set((s) => {
          const existing = s.manualTrackSectionsByTrackId[trackId] ?? []
          return {
            manualTrackSectionsByTrackId: {
              ...s.manualTrackSectionsByTrackId,
              [trackId]: existing.filter((sec) => sec.id !== id),
            },
            selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
          }
        }),

      clearManualSectionsForTrack: (trackId) =>
        set((s) => {
          const { [trackId]: _removed, ...rest } = s.manualTrackSectionsByTrackId
          return { manualTrackSectionsByTrackId: rest }
        }),

      setActivePadId: (id) =>
        set((s) => {
          if (!id) return { activePadId: null }
          const pad = s.performancePads.find((p) => p.id === id)
          if (!pad?.presetId) return { activePadId: id }
          const preset = s.reactPresets.find((p) => p.id === pad.presetId)
          if (!preset) return { activePadId: id }
          return { activePadId: id, ...buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings) }
        }),

      updatePerformancePad: (id, patch) =>
        set((s) => ({
          performancePads: s.performancePads.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      setOscillatorSettings: (patch) =>
        set((s) => {
          const newSettings = { ...s.oscillatorSettings, ...patch }
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

          // Re-prepare OpenType text points when any text-relevant field changes.
          const textFields: (keyof OscillatorSettings)[] = ['text', 'textFontId', 'textFontSize', 'textLetterSpacing', 'pathResolution']
          const needsText = textFields.some(f => f in patch) && newSettings.sourceType === 'text' && !!newSettings.textFontId
          if (needsText) {
            newTextCache = prepareTextPoints(s.oscillatorFontAssets, newSettings, newTextCache)
          }

          return {
            oscillatorSettings:        newSettings,
            oscillatorGlyphPointCache: newGlyphCache,
            oscillatorTextPointCache:  newTextCache,
            // Clear the notice whenever the user actively changes the source type
            ...('sourceType' in patch ? { glyphLostNotice: null } : {}),
          }
        }),

      resetOscillatorSettings: () =>
        set({ oscillatorSettings: DEFAULT_OSCILLATOR_SETTINGS }),

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
          const wasActive = s.oscillatorSettings.selectedGlyphId === id
          const removedName = wasActive
            ? (s.oscillatorGlyphAssets.find(a => a.id === id)?.name ?? null)
            : null
          return {
            oscillatorGlyphAssets: s.oscillatorGlyphAssets.filter(a => a.id !== id),
            oscillatorGlyphPointCache: newCache,
            oscillatorSettings: wasActive
              ? { ...s.oscillatorSettings, selectedGlyphId: null, sourceType: 'builtinShape' }
              : s.oscillatorSettings,
            glyphLostNotice: removedName,
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
        })),

      selectOscillatorGlyph: (id) =>
        set((s) => {
          const asset = s.oscillatorGlyphAssets.find(a => a.id === id)
          const res = clampRes(s.oscillatorSettings.pathResolution)
          // Ensure points are prepared; handles the page-reload case where the
          // persisted asset has rawSvg but the non-persisted cache is empty.
          const newCache = asset ? prepareSvgPoints(asset, res, s.oscillatorGlyphPointCache) : s.oscillatorGlyphPointCache
          return {
            oscillatorSettings: { ...s.oscillatorSettings, sourceType: 'svgGlyph', selectedGlyphId: id },
            oscillatorGlyphPointCache: newCache,
            glyphLostNotice: null,
          }
        }),

      selectSvgMediaGlyph: async (mediaId) => {
        const stableId = `glyph-media:${mediaId}`

        // 1. Already cached as a glyph asset — just select it
        const s0 = get()
        const existing = s0.oscillatorGlyphAssets.find(a => a.id === stableId)
        if (existing) {
          const res = clampRes(s0.oscillatorSettings.pathResolution)
          const newCache = prepareSvgPoints(existing, res, s0.oscillatorGlyphPointCache)
          set({
            oscillatorSettings:        { ...s0.oscillatorSettings, sourceType: 'svgGlyph', selectedGlyphId: stableId },
            oscillatorGlyphPointCache: newCache,
            glyphLostNotice:           null,
          })
          return
        }

        // 2. Find the media item in mediaStore
        const mediaItem = useMediaStore.getState().items.find(i => i.id === mediaId)
        if (!mediaItem) {
          console.warn(`[DRMVYZ] selectSvgMediaGlyph: media item "${mediaId}" not found in store`)
          return
        }

        // 3. Fetch SVG text — try cached URL, fall back to a fresh signed URL
        const tryFetch = async (url: string): Promise<string | null> => {
          try {
            const resp = await fetch(url, { cache: 'no-store' })
            if (!resp.ok) return null
            return await resp.text()
          } catch {
            return null
          }
        }

        let rawSvg = mediaItem.url ? await tryFetch(mediaItem.url) : null

        if (!rawSvg && mediaItem.storagePath) {
          console.warn(`[DRMVYZ] selectSvgMediaGlyph: primary URL failed for "${mediaItem.name}", refreshing signed URL…`)
          const { url: freshUrl } = await createSignedMediaUrl(mediaItem.storagePath)
          if (freshUrl) rawSvg = await tryFetch(freshUrl)
        }

        if (!rawSvg) {
          console.warn(`[DRMVYZ] selectSvgMediaGlyph: could not fetch SVG content for "${mediaItem.name}"`)
          return
        }

        // 4. Validate
        if (!isSvgContent(rawSvg)) {
          console.warn(`[DRMVYZ] selectSvgMediaGlyph: "${mediaItem.name}" does not appear to be a valid SVG`)
          return
        }

        // 5. Build asset with stable media-backed ID
        const displayName = (mediaItem.title ?? mediaItem.name).replace(/\.svg$/i, '').trim() || 'SVG Glyph'
        const res = clampRes(get().oscillatorSettings.pathResolution)
        const asset = makeSvgGlyphAsset(displayName, rawSvg, res, stableId)

        // 6. Atomically add + select (guard against races)
        set(s => {
          const assets = s.oscillatorGlyphAssets.some(a => a.id === stableId)
            ? s.oscillatorGlyphAssets
            : [...s.oscillatorGlyphAssets, asset]
          const newCache = prepareSvgPoints(asset, clampRes(s.oscillatorSettings.pathResolution), s.oscillatorGlyphPointCache)
          return {
            oscillatorGlyphAssets:     assets,
            oscillatorGlyphPointCache: newCache,
            oscillatorSettings: {
              ...s.oscillatorSettings,
              sourceType:      'svgGlyph',
              selectedGlyphId: stableId,
            },
            glyphLostNotice: null,
          }
        })
      },

      addAndCacheMediaSvgGlyph: (mediaId, rawSvg, displayName) =>
        set(s => {
          const stableId = `glyph-media:${mediaId}`
          if (s.oscillatorGlyphAssets.some(a => a.id === stableId)) return {}
          const res = clampRes(s.oscillatorSettings.pathResolution)
          const name = displayName ?? 'SVG Glyph'
          const asset = makeSvgGlyphAsset(name, rawSvg, res, stableId)
          const newCache = prepareSvgPoints(asset, res, s.oscillatorGlyphPointCache)
          return {
            oscillatorGlyphAssets:     [...s.oscillatorGlyphAssets, asset],
            oscillatorGlyphPointCache: newCache,
          }
        }),

      // ── SVG Visual actions ─────────────────────────────────────────────────

      selectSvgVisual: async (mediaId) => {
        // Update settings immediately so the UI reflects the selection
        set(s => ({
          oscillatorSettings: {
            ...s.oscillatorSettings,
            sourceType:          'svgVisual',
            selectedSvgVisualId: mediaId,
          },
        }))

        const existing  = getSvgVisualEntry(mediaId)
        const mediaItem = useMediaStore.getState().items.find(i => i.id === mediaId)

        // Already loading — don't start a duplicate fetch
        if (existing?.loading) return

        // Already loaded — check if media identity has changed (re-upload under same ID)
        if (existing?.loaded) {
          const urlChanged  = existing.mediaUrl   !== undefined && existing.mediaUrl   !== (mediaItem?.url          ?? undefined)
          const pathChanged = existing.storagePath !== undefined && existing.storagePath !== (mediaItem?.storagePath ?? undefined)
          if (!urlChanged && !pathChanged) return
          // Identity changed — evict and reload
          evictSvgVisual(mediaId)
        }

        // Clear a stale error entry so a fresh load can proceed
        if (existing?.error) evictSvgVisual(mediaId)

        // Mark as loading so duplicate calls are blocked and the status card shows "Loading…"
        setSvgVisualEntry({ id: mediaId, loading: true, image: null, objectUrl: null, loaded: false, error: null, width: 0, height: 0 })

        if (!mediaItem) {
          setSvgVisualEntry({ id: mediaId, loading: false, image: null, objectUrl: null, loaded: false, error: 'Media item not found', width: 0, height: 0 })
          return
        }

        const tryFetch = async (url: string): Promise<string | null> => {
          try {
            const resp = await fetch(url, { cache: 'no-store' })
            if (!resp.ok) return null
            return await resp.text()
          } catch { return null }
        }

        let rawSvg = mediaItem.url ? await tryFetch(mediaItem.url) : null

        if (!rawSvg && mediaItem.storagePath) {
          const { url: freshUrl } = await createSignedMediaUrl(mediaItem.storagePath)
          if (freshUrl) rawSvg = await tryFetch(freshUrl)
        }

        if (!rawSvg || !isSvgContent(rawSvg)) {
          setSvgVisualEntry({ id: mediaId, loading: false, image: null, objectUrl: null, loaded: false, error: 'Could not load SVG content', width: 0, height: 0 })
          return
        }

        const blob      = new Blob([rawSvg], { type: 'image/svg+xml' })
        const objectUrl = URL.createObjectURL(blob)
        const img       = new Image()

        img.onload = () => {
          setSvgVisualEntry({
            id:          mediaId,
            loading:     false,
            image:       img,
            objectUrl,
            loaded:      true,
            error:       null,
            width:       img.naturalWidth  || 512,
            height:      img.naturalHeight || 512,
            mediaUrl:    mediaItem.url          || undefined,
            storagePath: mediaItem.storagePath  || undefined,
          })
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          setSvgVisualEntry({ id: mediaId, loading: false, image: null, objectUrl: null, loaded: false, error: 'SVG image failed to render', width: 0, height: 0 })
        }
        img.src = objectUrl
      },

      clearSvgVisualForMedia: (mediaId) => {
        evictSvgVisual(mediaId)
        set(s => {
          if (s.oscillatorSettings.selectedSvgVisualId !== mediaId) return {}
          return {
            oscillatorSettings: {
              ...s.oscillatorSettings,
              selectedSvgVisualId: null,
              sourceType: s.oscillatorSettings.sourceType === 'svgVisual'
                ? 'builtinShape'
                : s.oscillatorSettings.sourceType,
            },
          }
        })
      },

      // ── Unified SVG asset selection ─────────────────────────────────────────

      selectSvgAsset: async (mediaId) => {
        // Set selectedSvgId immediately so the UI reflects the pending selection
        set(s => ({
          oscillatorSettings: {
            ...s.oscillatorSettings,
            sourceType:    'svg',
            selectedSvgId: mediaId,
          },
          glyphLostNotice: null,
        }))

        // Kick off both caching paths in parallel:
        // 1. Glyph points (for reactivePath mode)
        // 2. SVG image (for originalArtwork mode)
        await Promise.all([
          get().selectSvgMediaGlyph(mediaId),
          get().selectSvgVisual(mediaId),
        ])

        // After both complete, restore the sourceType to 'svg'
        // (selectSvgMediaGlyph/selectSvgVisual change it to their legacy types)
        set(s => ({
          oscillatorSettings: {
            ...s.oscillatorSettings,
            sourceType:    'svg',
            selectedSvgId: mediaId,
          },
        }))
      },

      // ── Font asset actions ──────────────────────────────────────────────────

      addOscillatorFontAsset: (asset) =>
        set((s) => {
          if (s.oscillatorFontAssets.some(a => a.id === asset.id)) return {}
          return { oscillatorFontAssets: [...s.oscillatorFontAssets, asset] }
        }),

      removeOscillatorFontAsset: (id) =>
        set((s) => {
          evictFontFromCache(id)
          // Evict all text cache entries for this font
          const newTextCache = { ...s.oscillatorTextPointCache }
          for (const key of Object.keys(newTextCache)) {
            if (key.startsWith(`${id}:`)) delete newTextCache[key]
          }
          return {
            oscillatorFontAssets: s.oscillatorFontAssets.filter(a => a.id !== id),
            oscillatorTextPointCache: newTextCache,
            oscillatorSettings:
              s.oscillatorSettings.textFontId === id
                ? { ...s.oscillatorSettings, textFontId: null }
                : s.oscillatorSettings,
          }
        }),

      clearOscillatorFontAssets: () =>
        set((s) => ({
          oscillatorFontAssets: [],
          oscillatorTextPointCache: {},
          oscillatorSettings:
            s.oscillatorSettings.textFontId
              ? { ...s.oscillatorSettings, textFontId: null }
              : s.oscillatorSettings,
        })),

      selectOscillatorFont: (id) =>
        set((s) => {
          const newSettings = { ...s.oscillatorSettings, textFontId: id }
          const newTextCache = id
            ? prepareTextPoints(s.oscillatorFontAssets, newSettings, s.oscillatorTextPointCache)
            : s.oscillatorTextPointCache
          return { oscillatorSettings: newSettings, oscillatorTextPointCache: newTextCache }
        }),

      // ── LaserDMX actions ────────────────────────────────────────────────────

      setLaserDmxSettings: (partial) =>
        set(s => ({ laserDmxSettings: { ...s.laserDmxSettings, ...partial } })),

      resetLaserDmxSettings: () =>
        set({ laserDmxSettings: createDefaultLaserDmxSettings() }),

      selectLaserFixture: (fixtureId) =>
        set(s => ({ laserDmxSettings: { ...s.laserDmxSettings, selectedFixtureId: fixtureId } })),

      addLaserFixture: () =>
        set(s => {
          const fixture = makeNewLaserFixture(s.laserDmxSettings.fixtures)
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
            },
          }
        }),

      updateLaserFixture: (fixtureId, patch) =>
        set(s => ({
          laserDmxSettings: {
            ...s.laserDmxSettings,
            fixtures: s.laserDmxSettings.fixtures.map(f =>
              f.id === fixtureId ? { ...f, ...patch } : f
            ),
          },
        })),

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

      // ── LaserDMX workspace mode ─────────────────────────────────────────────

      setLaserDmxWorkspaceMode: (mode) => set({ laserDmxWorkspaceMode: mode }),

      // ── LaserDMX Beam Matrix ────────────────────────────────────────────────

      setLaserDmxBeamMatrixSettings: (partial) =>
        set(s => ({ laserDmxBeamMatrix: { ...s.laserDmxBeamMatrix, ...partial } })),

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
          activeReactEngineId:                'laserDmx' as const,
          activeLaserDmxBeamMatrixPresetId:   presetId,
          laserDmxBeamMatrixPresetDirty:      false,
          laserDmxBeamMatrix: {
            ...s.laserDmxBeamMatrix,
            beams:                  clampedBeams,
            groups:                 fresh.groups,
            globalModulationRoutes: fresh.globalModulationRoutes,
            output:                 fresh.output,
            fog:                    fresh.fog,
            selectedBeamIds:        [],
            selectedGroupId:        null,
            // editor settings survive preset changes
          },
        }))
      },

      clearActiveLaserDmxBeamMatrixPreset: () =>
        set({ activeLaserDmxBeamMatrixPresetId: null }),

      resetReactView: () => {
        clearSvgVisualCache()
        set({
          activeReactPresetId:          INITIAL_PRESET_ID,
          activeReactEngineId:          INITIAL_ENGINE_ID,
          manualTrackSectionsByTrackId: {},
          selectedSectionId:            null,
          performancePads:           DEFAULT_PERFORMANCE_PADS,
          activePadId:               null,
          oscillatorSettings:        DEFAULT_OSCILLATOR_SETTINGS,
          oscillatorGlyphPointCache: {},
          oscillatorTextPointCache:  {},
          glyphLostNotice:           null,
          laserDmxSettings:                 createDefaultLaserDmxSettings(),
          laserDmxWorkspaceMode:            'spatialFixtures',
          laserDmxBeamMatrix:               createDefaultLaserDmxBeamMatrixSettings(),
          activeLaserDmxBeamMatrixPresetId: null,
          laserDmxBeamMatrixPresetDirty:    false,
          reactIntensity:       0.7,
          reactMotion:          0.5,
          reactGlow:            0.65,
          reactBassReactivity:  0.8,
          reactColorPalette:    'dvydrm',
          reactTrailDecay:      0.08,
          reactFogDensity:      0.5,
          reactParticleDensity: 0.5,
        })
      },
    }),
    {
      name: 'drmvyz:react-store',
      version: 5,
      migrate: (persistedState: unknown, version: number) => {
        let state = (persistedState ?? {}) as Record<string, unknown>
        if (version < 1) {
          // Users with no version (< 1): add Beam Matrix state while preserving
          // all existing Spatial Fixtures settings.
          state = {
            ...state,
            laserDmxWorkspaceMode: 'spatialFixtures' as LaserDmxWorkspaceMode,
            laserDmxBeamMatrix:    createDefaultLaserDmxBeamMatrixSettings(),
          }
        }
        if (version < 2) {
          // Unify svgGlyph + svgVisual → unified 'svg' sourceType.
          // svgGlyph → sourceType: 'svg', svgRenderMode: 'reactivePath', selectedSvgId from glyph-media: prefix
          // svgVisual → sourceType: 'svg', svgRenderMode: 'originalArtwork', selectedSvgId from selectedSvgVisualId
          // Text sources get autoRotate: false (stationary by default).
          // All other sources that were auto-rotating get autoRotate: true to preserve behavior.
          const osc = state.oscillatorSettings as Record<string, unknown> | undefined
          if (osc) {
            let migratedOsc = { ...osc }
            if (osc.sourceType === 'svgGlyph') {
              const glyphId = osc.selectedGlyphId as string | null
              const svgId = typeof glyphId === 'string' && glyphId.startsWith('glyph-media:')
                ? glyphId.slice('glyph-media:'.length)
                : glyphId
              migratedOsc = {
                ...migratedOsc,
                sourceType:         'svg',
                selectedSvgId:      svgId ?? null,
                svgRenderMode:      'reactivePath',
                svgUseReactPalette: true,
                autoRotate:         true,
              }
            } else if (osc.sourceType === 'svgVisual') {
              migratedOsc = {
                ...migratedOsc,
                sourceType:         'svg',
                selectedSvgId:      (osc.selectedSvgVisualId as string | null) ?? null,
                svgRenderMode:      'originalArtwork',
                svgUseReactPalette: true,
                autoRotate:         true,
              }
            } else if (osc.sourceType === 'text') {
              migratedOsc = { ...migratedOsc, autoRotate: false }
            } else {
              // classic, builtinShape — preserve rotation by defaulting to true
              migratedOsc = { ...migratedOsc, autoRotate: true }
            }
            // Add missing new fields if not already set
            if (!('selectedSvgId' in migratedOsc))       migratedOsc.selectedSvgId       = null
            if (!('svgRenderMode' in migratedOsc))        migratedOsc.svgRenderMode        = 'auto'
            if (!('svgUseReactPalette' in migratedOsc))   migratedOsc.svgUseReactPalette   = true
            if (!('autoRotate' in migratedOsc))           migratedOsc.autoRotate           = osc.sourceType !== 'text'
            state = { ...state, oscillatorSettings: migratedOsc }
          }
        }
        if (version < 3) {
          // Add sequenceIndex + motion to existing beams; add sequence to groups.
          const bm = state.laserDmxBeamMatrix as Record<string, unknown> | undefined
          if (bm) {
            const beams  = (bm.beams  as unknown[] | undefined) ?? []
            const groups = (bm.groups as unknown[] | undefined) ?? []
            state = {
              ...state,
              laserDmxBeamMatrix: {
                ...bm,
                beams: beams.map((b, i) => {
                  const beam = b as Record<string, unknown>
                  return {
                    ...beam,
                    sequenceIndex: beam.sequenceIndex ?? i,
                    motion:        beam.motion        ?? DEFAULT_BEAM_MOTION,
                  }
                }),
                groups: groups.map((g) => {
                  const group = g as Record<string, unknown>
                  return {
                    ...group,
                    sequence: group.sequence ?? DEFAULT_BEAM_SEQUENCE,
                  }
                }),
              },
            }
          }
        }
        if (version < 4) {
          // Add launch/maxActiveBeams to groups; scale old coord offset route min/max (pixels now).
          // Old routes had normalized min/max (e.g. -1..1), new coord routes are in pixels (e.g. -200..200).
          // Since coord offset routes pre-version-3 were scaled by *200 in the compiler, we
          // multiply existing min/max by 200 to preserve the same visual behavior.
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
                // Only scale if values look normalized (|value| <= 2); skip if already in pixel range
                if (Math.abs(oldMin) <= 2 && Math.abs(oldMax) <= 2) {
                  return { ...route, min: oldMin * 200, max: oldMax * 200 }
                }
                return route
              })
            state = {
              ...state,
              laserDmxBeamMatrix: {
                ...bm,
                groups: groups.map((g) => {
                  const group = g as Record<string, unknown>
                  const existingRoutes = (group.modulationRoutes as unknown[] | undefined) ?? []
                  return {
                    ...group,
                    launch:           group.launch         ?? DEFAULT_LAUNCH_SETTINGS,
                    maxActiveBeams:   group.maxActiveBeams ?? 0,
                    modulationRoutes: migrateRoutes(existingRoutes),
                  }
                }),
                beams: beams.map((b) => {
                  const beam = b as Record<string, unknown>
                  const existingRoutes = (beam.modulationRoutes as unknown[] | undefined) ?? []
                  return {
                    ...beam,
                    modulationRoutes: migrateRoutes(existingRoutes),
                  }
                }),
              },
            }
          }
        }
        if (version < 5) {
          // Migrate flat global manualTrackSections → per-track map.
          // The original track identity is unknown, so legacy sections go into
          // a special '_legacy' bucket where they remain visible but do not
          // bleed into any specific track.
          const legacy = (state as Record<string, unknown>).manualTrackSections as ReactTrackSection[] | undefined
          if (Array.isArray(legacy) && legacy.length > 0) {
            state = {
              ...state,
              manualTrackSectionsByTrackId: { _legacy: legacy },
            }
          } else {
            state = {
              ...state,
              manualTrackSectionsByTrackId: (state as Record<string, unknown>).manualTrackSectionsByTrackId ?? {},
            }
          }
          // Remove the old flat key so it doesn't pollute the hydrated state
          const { manualTrackSections: _mtsRemoved, ...rest } = state as Record<string, unknown>
          void _mtsRemoved
          state = rest
        }
        return state
      },
      partialize: (s) => ({
        activeReactPresetId:                s.activeReactPresetId,
        activeReactEngineId:                s.activeReactEngineId,
        manualTrackSectionsByTrackId:       s.manualTrackSectionsByTrackId,
        oscillatorSettings:                 s.oscillatorSettings,
        oscillatorGlyphAssets:              s.oscillatorGlyphAssets,
        oscillatorFontAssets:               s.oscillatorFontAssets,
        laserDmxSettings:                   s.laserDmxSettings,
        laserDmxWorkspaceMode:              s.laserDmxWorkspaceMode,
        laserDmxBeamMatrix:                 s.laserDmxBeamMatrix,
        activeLaserDmxBeamMatrixPresetId:   s.activeLaserDmxBeamMatrixPresetId,
        reactIntensity:       s.reactIntensity,
        reactMotion:          s.reactMotion,
        reactGlow:            s.reactGlow,
        reactBassReactivity:  s.reactBassReactivity,
        reactColorPalette:    s.reactColorPalette,
        reactTrailDecay:      s.reactTrailDecay,
        reactFogDensity:      s.reactFogDensity,
        reactParticleDensity: s.reactParticleDensity,
      }),
    },
  ),
)
