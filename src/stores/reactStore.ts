import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_REACT_PRESETS,
  DEFAULT_PERFORMANCE_PADS,
  DEFAULT_OSCILLATOR_SETTINGS,
  createDefaultLaserDmxSettings,
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
} from '../components/vyzualz/react/ReactTypes'
import {
  parseSvgToGlyphPoints,
  makeSvgGlyphAsset,
  isSvgContent,
  getSvgGlyphCacheKey,
} from '../components/vyzualz/react/renderers/svgGlyphUtils'
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
    if (osc.sourceType !== 'svgGlyph' || !osc.selectedGlyphId) return
    const asset = s.oscillatorGlyphAssets.find(a => a.id === osc.selectedGlyphId)
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
  return {
    activeReactPresetId: preset.id,
    activeReactEngineId: preset.engine,
    reactIntensity:      preset.params.intensity,
    reactMotion:         preset.params.motion,
    reactGlow:           preset.params.glow,
    reactBassReactivity: preset.params.bassReactivity,
    oscillatorSettings:  resolvePresetOscillatorSettings(preset, currentOscSettings),
    ...(preset.laserDmxSettings != null
      ? { laserDmxSettings: { ...laserBase, ...preset.laserDmxSettings } }
      : {}),
  }
}

interface ReactStoreState {
  activeReactPresetId: string | null
  activeReactEngineId: ReactEngineId
  reactPresets: ReactPreset[]

  // Manual track sections
  manualTrackSections: ReactTrackSection[]
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
  addManualSection: (section: ReactTrackSection) => void
  updateManualSection: (id: string, patch: Partial<ReactTrackSection>) => void
  removeManualSection: (id: string) => void

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

  // LaserDMX settings
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
}

const INITIAL_PRESET_ID = DEFAULT_REACT_PRESETS[0].id
const INITIAL_ENGINE_ID: ReactEngineId = DEFAULT_REACT_PRESETS[0].engine

export const useReactStore = create<ReactStoreState>()(
  persist(
    (set, get) => ({
      activeReactPresetId: INITIAL_PRESET_ID,
      activeReactEngineId: INITIAL_ENGINE_ID,
      reactPresets: DEFAULT_REACT_PRESETS,
      manualTrackSections: [],
      selectedSectionId: null,
      performancePads: DEFAULT_PERFORMANCE_PADS,
      activePadId: null,
      oscillatorSettings: DEFAULT_OSCILLATOR_SETTINGS,
      oscillatorGlyphAssets: [],
      oscillatorGlyphPointCache: {},
      oscillatorFontAssets: [],
      oscillatorTextPointCache: {},
      glyphLostNotice: null,
      laserDmxSettings: createDefaultLaserDmxSettings(),
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

      addManualSection: (section) =>
        set((s) => ({ manualTrackSections: [...s.manualTrackSections, section] })),

      updateManualSection: (id, patch) =>
        set((s) => ({
          manualTrackSections: s.manualTrackSections.map((sec) =>
            sec.id === id ? { ...sec, ...patch } : sec,
          ),
        })),

      removeManualSection: (id) =>
        set((s) => ({
          manualTrackSections: s.manualTrackSections.filter((sec) => sec.id !== id),
          selectedSectionId: s.selectedSectionId === id ? null : s.selectedSectionId,
        })),

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
          if ('pathResolution' in patch && newSettings.sourceType === 'svgGlyph' && newSettings.selectedGlyphId) {
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

      resetReactView: () => {
        clearSvgVisualCache()
        set({
          activeReactPresetId:       INITIAL_PRESET_ID,
          activeReactEngineId:       INITIAL_ENGINE_ID,
          manualTrackSections:       [],
          selectedSectionId:         null,
          performancePads:           DEFAULT_PERFORMANCE_PADS,
          activePadId:               null,
          oscillatorSettings:        DEFAULT_OSCILLATOR_SETTINGS,
          oscillatorGlyphPointCache: {},
          oscillatorTextPointCache:  {},
          glyphLostNotice:           null,
          laserDmxSettings:          createDefaultLaserDmxSettings(),
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
      partialize: (s) => ({
        activeReactPresetId:    s.activeReactPresetId,
        activeReactEngineId:    s.activeReactEngineId,
        manualTrackSections:    s.manualTrackSections,
        oscillatorSettings:     s.oscillatorSettings,
        oscillatorGlyphAssets:  s.oscillatorGlyphAssets,
        oscillatorFontAssets:   s.oscillatorFontAssets,
        laserDmxSettings:       s.laserDmxSettings,
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
