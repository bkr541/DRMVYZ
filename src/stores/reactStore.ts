import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSplitPersistStorage } from '../lib/splitPersistStorage'
import {
  DEFAULT_REACT_PRESETS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_REACT_PRESET_RENDER_SETTINGS,
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
  ReactPerformancePadTransition,
  ReactPresetControlValues,
  ReactPresetAutomationCue,
  OscillatorSettings,
  OscillatorGlyphAsset,
  OscillatorGlyphPoint,
  OscillatorFontAsset,
  SoundDrawingLayer,
  SoundDrawingClip,
  LaserDmxSettings,
  LaserDmxFixture,
  LaserDmxModulationRoute,
  LaserDmxWorkspaceMode,
  LaserDmxBeamMatrixSettings,
  LaserDmxBeamMatrixEditorSettings,
  LaserDmxBeamMatrixCue,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  NeonLatticeSettings,
  NeonLatticeTriggerType,
  NeonLatticeTriggerEvent,
} from '../components/vyzualz/react/ReactTypes'
import { resolvePerformancePadTransition } from '../components/vyzualz/react/renderers/reactPresetTransition'
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
    return { ...cache, [key]: pts }
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
  _currentLaserSettings?: LaserDmxSettings,
  currentNeonLatticeSettings?: NeonLatticeSettings,
) {
  let laserPatch: LaserDmxSettings | undefined
  if (preset.laserDmxSettings != null) {
    // Presets are complete looks, not deltas against live authored state.
    const merged = { ...createDefaultLaserDmxSettings(), ...preset.laserDmxSettings }
    // Ensure selectedFixtureId always points to a fixture that exists after the merge.
    const fixtures = merged.fixtures ?? []
    const hasSelected = fixtures.some(f => f.id === merged.selectedFixtureId)
    if (!hasSelected) {
      merged.selectedFixtureId = fixtures[0]?.id ?? null
    }
    laserPatch = merged
  }

  let neonLatticePatch: NeonLatticeSettings | undefined
  if (preset.neonLatticeSettings != null) {
    neonLatticePatch = { ...DEFAULT_NEON_LATTICE_SETTINGS, ...preset.neonLatticeSettings }
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
    ...(laserPatch        != null ? { laserDmxSettings:   laserPatch        } : {}),
    ...(neonLatticePatch  != null ? { neonLatticeSettings: neonLatticePatch } : {}),
    ...(preset.engine !== 'neonLattice' ? { neonLatticeTrigger: null as NeonLatticeTriggerEvent | null } : {}),
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

interface ReactStoreState {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
  reactPresets: ReactPreset[]

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
  // keyed by "${fontId}:${text}:${fontSize}:${letterSpacing}:${resolution}"
  oscillatorTextPointCache: Record<string, OscillatorGlyphPoint[]>

  resetReactView: () => void

  // Neon Lattice settings
  neonLatticeSettings: NeonLatticeSettings
  setNeonLatticeSettings: (partial: Partial<NeonLatticeSettings>) => void
  resetNeonLatticeSettings: () => void

  // Neon Lattice one-shot performance triggers (non-persisted)
  neonLatticeTrigger:    NeonLatticeTriggerEvent | null
  neonLatticeTriggerSeq: number   // monotonic counter; never persisted, never reset
  triggerNeonLattice: (type: NeonLatticeTriggerType) => void

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

  // Beam Matrix cue list
  addLaserDmxBeamMatrixCue: () => void
  duplicateLaserDmxBeamMatrixCue: (cueId: string) => void
  removeLaserDmxBeamMatrixCue: (cueId: string) => void
  updateLaserDmxBeamMatrixCue: (cueId: string, patch: Partial<LaserDmxBeamMatrixCue>) => void

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
  // endSec is always normalized to be > startSec.
  soundDrawingClipsByTrackId: Record<string, SoundDrawingClip[]>
  /** Returns clips for one track sorted by startSec ascending, then zIndex ascending. */
  getSoundDrawingClipsForTrack: (trackId: string) => SoundDrawingClip[]
  /** Creates a clip and returns its generated ID. */
  addSoundDrawingClip: (trackId: string, clip: Omit<SoundDrawingClip, 'id'>) => string
  updateSoundDrawingClip: (trackId: string, clipId: string, patch: Partial<SoundDrawingClip>) => void
  /** Clones an existing clip with a new ID. */
  duplicateSoundDrawingClip: (trackId: string, clipId: string) => void
  removeSoundDrawingClip: (trackId: string, clipId: string) => void
}

const INITIAL_PRESET_ID = 'preset-dream-gate'
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

const VALID_REACT_ENGINE_IDS = new Set<ReactEngineId>([
  'shaderPads',
  'cinematicPortal',
  'oscilloscope',
  'laserDmx',
  'neonLattice',
])

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
  const presetId = typeof activeReactPresetId === 'string' ? activeReactPresetId : null
  const selectedPreset = presetId ? presets.find(p => p.id === presetId) ?? null : null
  const engineIsValid = typeof activeReactEngineId === 'string' &&
    VALID_REACT_ENGINE_IDS.has(activeReactEngineId as ReactEngineId)

  if (!engineIsValid) {
    if (selectedPreset) {
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
  if (engineId === 'shaderPads') {
    return { activeReactPresetId: null, activeReactEngineId: engineId }
  }

  if (selectedPreset?.engine === engineId) {
    return { activeReactPresetId: selectedPreset.id, activeReactEngineId: engineId }
  }

  const compatiblePreset = presets.find(p => p.engine === engineId)
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
  if (version < 16) {
    // Add neonLatticeSettings for users that do not yet have it persisted.
    if (!('neonLatticeSettings' in state)) {
      state = { ...state, neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS } }
    }
  }
  if (version < 17) {
    // Normalize persisted neonLatticeSettings: backfill any fields added since the
    // object was first written, while preserving all values the user had tuned.
    const existing = (state as Record<string, unknown>).neonLatticeSettings
    state = {
      ...state,
      neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS, ...(existing as object ?? {}) },
    }
  }
  if (version < 18) {
    // Migrate shockwaves: boolean → shockwaveAmount: number.
    // Persisted data written before this version may have a boolean `shockwaves` field.
    const s = (state as Record<string, unknown>).neonLatticeSettings as Record<string, unknown> | undefined
    if (s != null && 'shockwaves' in s) {
      const { shockwaves, ...rest } = s
      state = {
        ...state,
        neonLatticeSettings: {
          ...DEFAULT_NEON_LATTICE_SETTINGS,
          ...rest,
          shockwaveAmount: shockwaves === false ? 0 : DEFAULT_NEON_LATTICE_SETTINGS.shockwaveAmount,
        },
      }
    }
  }
  if (version < 19) {
    // Legacy Shader Pads active-selection migration.
    // The five Shader Pads presets have been removed from DEFAULT_REACT_PRESETS and
    // the shaderPads engine is no longer selectable in the UI.
    const persistedPresetId = state.activeReactPresetId as string | null | undefined
    const persistedEngineId = state.activeReactEngineId as string | undefined

    if (persistedPresetId != null && LEGACY_SHADER_PRESET_IDS.has(persistedPresetId)) {
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
  return state
}

// Exported for persistence regression tests only.
/** Ensures a clip's endSec is always > startSec by at least 0.1 s. */
function normalizeClipRange<T extends { startSec: number; endSec: number }>(clip: T): T {
  const endSec = Math.max(clip.startSec + 0.1, clip.endSec)
  return endSec === clip.endSec ? clip : { ...clip, endSec }
}

export function reactStorePartialize(s: ReactStoreState) {
  const repairedSelection = repairReactEnginePresetSelection(
    s.activeReactPresetId,
    s.activeReactEngineId,
    s.reactPresets,
  )
  return {
    activeReactPresetId:                repairedSelection.activeReactPresetId,
    activeReactEngineId:                repairedSelection.activeReactEngineId,
    reactPresets:                       s.reactPresets,
    performancePads:                    s.performancePads,
    manualTrackSectionsByTrackId:       s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId:    s.suppressedAutoSectionsByTrackId,
    presetAutomationCuesByTrackId:      s.presetAutomationCuesByTrackId,
    oscillatorSettings:                 s.oscillatorSettings,
    oscillatorGlyphAssets:              s.oscillatorGlyphAssets,
    neonLatticeSettings:                s.neonLatticeSettings,
    laserDmxSettings:                   s.laserDmxSettings,
    laserDmxWorkspaceMode:              s.laserDmxWorkspaceMode,
    laserDmxBeamMatrix:                 s.laserDmxBeamMatrix,
    activeLaserDmxBeamMatrixPresetId:   s.activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixPresetDirty:      s.laserDmxBeamMatrixPresetDirty,
    soundDrawingLayersByTrackId:        s.soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId:         s.soundDrawingClipsByTrackId,
    reactIntensity:       s.reactIntensity,
    reactMotion:          s.reactMotion,
    reactGlow:            s.reactGlow,
    reactBassReactivity:  s.reactBassReactivity,
    reactTrailDecay:      s.reactTrailDecay,
    reactFogDensity:      s.reactFogDensity,
    reactParticleDensity: s.reactParticleDensity,
  }
}

export type ReactPersistedState = ReturnType<typeof reactStorePartialize>

/**
 * Authored/project data is intentionally kept out of synchronous localStorage.
 * These fields are structured-cloned into IndexedDB by reactPersistStorage.
 */
export const REACT_PROJECT_STATE_KEYS = [
  'reactPresets',
  'manualTrackSectionsByTrackId',
  'suppressedAutoSectionsByTrackId',
  'presetAutomationCuesByTrackId',
  'oscillatorGlyphAssets',
  'laserDmxSettings',
  'laserDmxBeamMatrix',
  'soundDrawingLayersByTrackId',
  'soundDrawingClipsByTrackId',
] as const satisfies readonly (keyof ReactPersistedState)[]

export function mergeReactStoreState(
  persistedState: unknown,
  currentState: ReactStoreState,
): ReactStoreState {
  const persisted = (persistedState ?? {}) as Partial<ReactPersistedState>
  const reactPresets = mergeCollectionsById(currentState.reactPresets, persisted.reactPresets)
  const performancePads = mergeCollectionsById(currentState.performancePads, persisted.performancePads)
  const merged = {
    ...currentState,
    ...persisted,
    reactPresets,
    performancePads,
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

  return {
    ...merged,
    ...repairedSelection,
    laserDmxBeamMatrixPresetDirty: dirty,
  }
}

export const reactPersistStorage = createSplitPersistStorage<Record<string, unknown>>({
  projectKeys: REACT_PROJECT_STATE_KEYS,
})

export const useReactStore = create<ReactStoreState>()(
  persist(
    (set, get) => ({
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
      reactPresets: DEFAULT_REACT_PRESETS,
      manualTrackSectionsByTrackId: {},
      selectedSectionId: null,
      selectedSectionByTrackId: {},
      suppressedAutoSectionsByTrackId: {},
      presetAutomationCuesByTrackId: {},
      soundDrawingLayersByTrackId: {},
      soundDrawingClipsByTrackId:  {},
      performancePads: DEFAULT_PERFORMANCE_PADS,
      activePadId: null,
      oscillatorSettings: DEFAULT_OSCILLATOR_SETTINGS,
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
      neonLatticeSettings:    { ...DEFAULT_NEON_LATTICE_SETTINGS },
      neonLatticeTrigger:     null,
      neonLatticeTriggerSeq:  0,
      laserDmxSettings:       createDefaultLaserDmxSettings(),
      laserDmxWorkspaceMode:  'spatialFixtures',
      laserDmxBeamMatrix:     createDefaultLaserDmxBeamMatrixSettings(),
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

      setActiveReactPresetId: (id) =>
        set((s) => {
          if (id != null) {
            const preset = s.reactPresets.find(p => p.id === id)
            return preset
              ? { ...buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings, s.neonLatticeSettings), performancePadTransition: null }
              : {}
          }

          if (s.activeReactEngineId === 'shaderPads') {
            return { activeReactPresetId: null, performancePadTransition: null }
          }

          const fallback = s.reactPresets.find(p => p.engine === s.activeReactEngineId)
          return fallback
            ? { ...buildPresetPatch(fallback, s.oscillatorSettings, s.laserDmxSettings, s.neonLatticeSettings), performancePadTransition: null }
            : {
                activeReactPresetId: INITIAL_PRESET_ID,
                activeReactEngineId: INITIAL_ENGINE_ID,
                performancePadTransition: null,
              }
        }),

      setActiveReactEngineId: (id) => get().selectReactEngine(id),

      selectReactEngine: (engineId) =>
        set((s) => {
          // Shader Pads has no React presets — switch directly without a preset lookup.
          if (engineId === 'shaderPads') {
            return { activeReactEngineId: 'shaderPads', activeReactPresetId: null, neonLatticeTrigger: null as NeonLatticeTriggerEvent | null, performancePadTransition: null }
          }
          // If the current preset already belongs to the selected engine, only ensure
          // activeReactEngineId is correct (repairs any prior drift without a preset switch).
          const current = s.activeReactPresetId
            ? s.reactPresets.find(p => p.id === s.activeReactPresetId)
            : null
          if (current?.engine === engineId) {
            return { activeReactEngineId: engineId, performancePadTransition: null }
          }
          // Switch to the first preset available for this engine.
          const preset = s.reactPresets.find(p => p.engine === engineId)
          if (!preset) {
            // No presets registered for this engine — update ID only; panel shows empty state.
            return {
              activeReactEngineId: engineId,
              performancePadTransition: null,
              ...(engineId !== 'neonLattice' ? { neonLatticeTrigger: null as NeonLatticeTriggerEvent | null } : {}),
            }
          }
          return { ...buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings, s.neonLatticeSettings), performancePadTransition: null }
        }),

      selectReactPreset: (id) =>
        set((s) => {
          const preset = s.reactPresets.find((p) => p.id === id)
          if (!preset) return {}
          return { ...buildPresetPatch(preset, s.oscillatorSettings, s.laserDmxSettings, s.neonLatticeSettings), performancePadTransition: null }
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
          const overrideIdx = existing.findIndex(m => m.id === originalSection.id)
          let newSections: ReactTrackSection[]
          if (overrideIdx >= 0) {
            // Update the existing user-edited-auto entry in place.
            newSections = existing.map((sec, i) =>
              i === overrideIdx ? { ...sec, ...patch, source: 'user-edited-auto' as const } : sec,
            )
          } else {
            // Create a fresh override that inherits all original metadata.
            const override: ReactTrackSection = {
              ...originalSection,
              ...patch,
              source: 'user-edited-auto',
            }
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
          const preset = s.reactPresets.find((p) => p.id === pad.presetId)
          if (!preset) return { activePadId: id }
          const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
          const currentTarget = getReactPresetControlValues(s)
          const from = resolvePerformancePadTransition(
            currentTarget,
            s.performancePadTransition,
            nowMs,
          )
          const presetPatch = buildPresetPatch(
            preset,
            s.oscillatorSettings,
            s.laserDmxSettings,
            s.neonLatticeSettings,
          )
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
          const textFields: (keyof OscillatorSettings)[] = ['text', 'textFontId', 'textFontSize', 'textLetterSpacing', 'textLineHeight', 'textAlignment', 'pathResolution']
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
        })),

      selectOscillatorFont: async (id) => {
        // Null clears the selection synchronously — no I/O needed
        if (id === null) {
          set((s) => ({
            fontSelectPending: null,
            fontSelectError:   null,
            oscillatorSettings: { ...s.oscillatorSettings, textFontId: null },
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
              oscillatorTextPointCache: prepareTextPoints(s.oscillatorFontAssets, newSettings, s.oscillatorTextPointCache),
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
              oscillatorTextPointCache: prepareTextPoints(s.oscillatorFontAssets, newSettings, s.oscillatorTextPointCache),
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
            const newTextCache = prepareTextPoints(newAssets, newSettings, s.oscillatorTextPointCache)
            return {
              fontUploadPending:    false,
              fontUploadError:      null,
              oscillatorFontAssets: newAssets,
              oscillatorSettings:   newSettings,
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

      // ── Neon Lattice actions ────────────────────────────────────────────────

      setNeonLatticeSettings: (partial) =>
        set(s => ({ neonLatticeSettings: { ...s.neonLatticeSettings, ...partial } })),

      resetNeonLatticeSettings: () =>
        set({ neonLatticeSettings: { ...DEFAULT_NEON_LATTICE_SETTINGS } }),

      triggerNeonLattice: (type) =>
        set(s => {
          const seq = s.neonLatticeTriggerSeq + 1
          return { neonLatticeTriggerSeq: seq, neonLatticeTrigger: { type, seq } }
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

      // ── React preset automation cues ────────────────────────────────────────

      getPresetAutomationCuesForTrack: (trackId) =>
        [...(get().presetAutomationCuesByTrackId[trackId] ?? [])].sort((a, b) => a.timeSec - b.timeSec),

      addPresetAutomationCue: (trackId, cue) =>
        set((s) => {
          const existing = s.presetAutomationCuesByTrackId[trackId] ?? []
          if (existing.some(c => c.id === cue.id)) return {}
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

      // ── Sound Drawing layers ─────────────────────────────────────────────────

      getSoundDrawingLayersForTrack: (trackId) =>
        get().soundDrawingLayersByTrackId[trackId] ?? [],

      addSoundDrawingLayer: (trackId, layer) => {
        const id = crypto.randomUUID()
        set((s) => {
          let newTextCache = s.oscillatorTextPointCache
          if (layer.sourceType === 'text' && layer.fontId) {
            newTextCache = prepareLayerTextPoints(
              s.oscillatorFontAssets, layer.fontId, layer.text,
              layer.letterSpacing, layer.lineHeight, layer.alignment,
              clampRes(s.oscillatorSettings.pathResolution), newTextCache,
            )
          }
          return {
            soundDrawingLayersByTrackId: {
              ...s.soundDrawingLayersByTrackId,
              [trackId]: [...(s.soundDrawingLayersByTrackId[trackId] ?? []), { ...layer, id }],
            },
            oscillatorTextPointCache: newTextCache,
          }
        })
        return id
      },

      updateSoundDrawingLayer: (trackId, layerId, patch) =>
        set((s) => {
          const layers = s.soundDrawingLayersByTrackId[trackId] ?? []
          const merged = layers.map((l) => l.id === layerId ? { ...l, ...patch } : l)
          const updated = merged.find(l => l.id === layerId)
          let newTextCache = s.oscillatorTextPointCache
          if (updated?.sourceType === 'text' && updated.fontId && ('text' in patch || 'fontId' in patch || 'letterSpacing' in patch || 'lineHeight' in patch || 'alignment' in patch)) {
            newTextCache = prepareLayerTextPoints(
              s.oscillatorFontAssets, updated.fontId, updated.text,
              updated.letterSpacing, updated.lineHeight, updated.alignment,
              clampRes(s.oscillatorSettings.pathResolution), newTextCache,
            )
          }
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
          const copy: SoundDrawingLayer = { ...src, id: crypto.randomUUID(), name: `${src.name} Copy` }
          return {
            soundDrawingLayersByTrackId: {
              ...s.soundDrawingLayersByTrackId,
              [trackId]: [...layers, copy],
            },
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

      addSoundDrawingClip: (trackId, clip) => {
        const id   = crypto.randomUUID()
        const safe = normalizeClipRange({ ...clip, id })
        set((s) => ({
          soundDrawingClipsByTrackId: {
            ...s.soundDrawingClipsByTrackId,
            [trackId]: [...(s.soundDrawingClipsByTrackId[trackId] ?? []), safe],
          },
        }))
        return id
      },

      updateSoundDrawingClip: (trackId, clipId, patch) =>
        set((s) => {
          const clips = s.soundDrawingClipsByTrackId[trackId] ?? []
          return {
            soundDrawingClipsByTrackId: {
              ...s.soundDrawingClipsByTrackId,
              [trackId]: clips.map((c) =>
                c.id === clipId ? normalizeClipRange({ ...c, ...patch }) : c,
              ),
            },
          }
        }),

      duplicateSoundDrawingClip: (trackId, clipId) =>
        set((s) => {
          const clips = s.soundDrawingClipsByTrackId[trackId] ?? []
          const src = clips.find((c) => c.id === clipId)
          if (!src) return {}
          const copy: SoundDrawingClip = { ...src, id: crypto.randomUUID() }
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
            cues:                   fresh.cues ?? [],
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
          reactPresets:                 DEFAULT_REACT_PRESETS,
          manualTrackSectionsByTrackId: {},
          selectedSectionId:            null,
          selectedSectionByTrackId:     {},
          suppressedAutoSectionsByTrackId: {},
          presetAutomationCuesByTrackId: {},
          soundDrawingLayersByTrackId:  {},
          soundDrawingClipsByTrackId:   {},
          performancePads:           DEFAULT_PERFORMANCE_PADS,
          activePadId:               null,
          oscillatorSettings:        DEFAULT_OSCILLATOR_SETTINGS,
          oscillatorGlyphPointCache: {},
          oscillatorTextPointCache:  {},
          glyphLostNotice:           null,
          neonLatticeSettings:              { ...DEFAULT_NEON_LATTICE_SETTINGS },
          neonLatticeTrigger:               null,
          laserDmxSettings:                 createDefaultLaserDmxSettings(),
          laserDmxWorkspaceMode:            'spatialFixtures',
          laserDmxBeamMatrix:               createDefaultLaserDmxBeamMatrixSettings(),
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
      version: 22,
      storage: reactPersistStorage,
      migrate: migrateReactStore,
      partialize: reactStorePartialize,
      merge: mergeReactStoreState,
    },
  ),
)
