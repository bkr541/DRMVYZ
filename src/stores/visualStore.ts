import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabaseConfigured } from '../lib/supabase'
import {
  dbCreateSession,
  dbUpdateSession,
  dbDeleteSession,
  loadCloudSessions,
} from '../lib/sessionDb'
import {
  DEFAULT_MODULATION_ROUTES,
} from '../lib/audioModulation'
import type { ModulationRoute } from '../lib/audioModulation'
import {
  recalculateTimelineStarts,
  migrateClip,
  migrateLegacyClips,
  appendBgClip,
  DEFAULT_CLIP_DURATION_SEC,
} from '../lib/timeline'
import type {
  VzTimelineClip,
  VzTimelineMediaClip,
  VzTimelineMediaLaneId,
  VzTimelineEffectRegion,
} from '../types/timeline'
import type { VzEffectParams } from '../types/effectParams'
import { DEFAULT_EFFECT_PARAMS } from '../types/effectParams'
import type { VzCueMarker } from '../types/cue'
import { DEFAULT_LAYER_CONFIGS, createDefaultLayerItem } from '../types/vzLayers'
import type { VzLayerConfig, VzLayerConfigId, VzLayerItem } from '../types/vzLayers'

export type { VzTimelineClip, VzTimelineMediaClip, VzTimelineMediaLaneId, VzTimelineEffectRegion }
export type { VzLayerConfig, VzLayerConfigId, VzLayerItem }
export type { VzCueMarker }

export type SelectedTimelineEntity =
  | { kind: 'bg';      id: string }
  | { kind: 'overlay'; id: string }
  | { kind: 'effect';  id: string }
  | { kind: 'lyric';   id: string }

// Quality is owned here so sessions can snapshot it
export type Quality = 'High' | 'Medium' | 'Low'

export interface VzEffects {
  masterIntensity: number
  bassReactivity:  number
  glitchAmount:    number
  rgbSplit:        number
  tunnelSpeed:     number
  displacement:    number
  bloom:           number
  strobe:          number
  feedbackTrails:  number
  logoScale:       number
  colorShift:      number
  // ── New canvas effects ────────────────────────────────────────────
  spectrumBars:    number
  circularSpectrum: number
  oscilloscope:    number
  beatRing:        number
  particleBurst:   number
  reactiveGrid:    number
  cameraShake:     number
  kaleidoscope:    number
  mirrorSplit:     number
  radialBlur:      number
  vhsStatic:       number
  datamoshSmear:   number
  edgeGlow:        number
  colorCycle:      number
  beatFlash:       number
  edgeFlicker:     number
  noiseFog:        number
  scanlines:       number
}

export const DEFAULT_EFFECTS: VzEffects = {
  masterIntensity: 0.85,
  bassReactivity:  0.90,
  glitchAmount:    0.00,
  rgbSplit:        0.00,
  tunnelSpeed:     0.60,
  displacement:    0.00,
  bloom:           0.40,
  strobe:          0.00,
  feedbackTrails:  0.00,
  logoScale:       1.00,
  colorShift:      0.00,
  spectrumBars:    0.65,
  circularSpectrum: 0.55,
  oscilloscope:    0.60,
  beatRing:        0.70,
  particleBurst:   0.55,
  reactiveGrid:    0.45,
  cameraShake:     0.25,
  kaleidoscope:    0.50,
  mirrorSplit:     0.50,
  radialBlur:      0.40,
  vhsStatic:       0.35,
  datamoshSmear:   0.35,
  edgeGlow:        0.50,
  colorCycle:      0.45,
  beatFlash:       0.50,
  edgeFlicker:     0.50,
  noiseFog:        0.40,
  scanlines:       0.50,
}

// ── PresetScope: controls which fields are saved/restored by a preset ─────────
// If a field is absent or false, that field is neither saved nor applied on load.
export interface PresetScope {
  effects?:     boolean  // VzEffects values
  enabledFx?:   boolean  // FX chain toggle state
  modulation?:  boolean  // modulation routes (enabled + amounts)
  activeMedia?: boolean  // which media item is active
  mediaOrder?:  boolean  // order of media deck items
  audioSource?: boolean  // file | microphone | demo
  bpm?:         boolean
  bpmSync?:     boolean
  quality?:     boolean
  timeline?:    boolean  // timelineEnabled + timelineClips + timelineLoop
}

// Default scope for a lightweight "look" preset (effects only, backward-compat)
export const LOOK_SCOPE: PresetScope = { effects: true, enabledFx: true }

// Scope that captures the full performance scene
export const SCENE_SCOPE: PresetScope = {
  effects: true, enabledFx: true, modulation: true,
  activeMedia: true, mediaOrder: true, audioSource: true,
  bpm: true, bpmSync: true, quality: true, timeline: true,
}

// ── Preset: reusable visual look/effect template ──────────────────────────────
export interface VzPreset {
  id: string
  name: string
  color: string
  gradient: string
  isDefault?: boolean

  // scope describes what this preset saves/restores (absent = look-only)
  scope?: PresetScope

  // Visual look (always present)
  effects: VzEffects
  enabledFx: string[]
  effectParams?: VzEffectParams

  // Optional scene fields — only present when the matching scope flag is true
  modulationRoutes?: ModulationRoute[]
  activeMediaId?: string | null
  mediaOrder?: string[]
  audioSource?: 'file' | 'microphone' | 'demo'
  bpm?: number
  bpmSync?: boolean
  quality?: Quality
  timelineEnabled?: boolean
  // Legacy field — kept for backwards-compat with presets saved before Phase 1A.
  // On load these are migrated to VzTimelineMediaClip[] with lane='video-background'.
  timelineClips?: VzTimelineClip[]
  timelineLoop?: boolean
  // Phase 1A additions — only present when scope.timeline is true
  timelineOverlayClips?: VzTimelineMediaClip[]
  timelineEffectRegions?: VzTimelineEffectRegion[]
}

// ── Session: full VJ workspace snapshot ───────────────────────────────────────
export interface VzSession {
  id: string          // local ID (used in the sessions array)
  name: string
  createdAt: number   // ms timestamp
  updatedAt?: number  // ms timestamp; set when synced to cloud
  source: 'local' | 'cloud'
  dbId?: string       // Supabase visual_sessions.id — set after cloud save
  // Media
  activeMediaId: string | null
  mediaOrder: string[]   // ordered snapshot of media item IDs
  // Visual
  activePresetId: string
  effects: VzEffects
  enabledFx: string[]
  effectParams?: VzEffectParams
  // Timing
  bpm: number
  bpmSync: boolean
  // Output
  quality: Quality
  audioSource: 'file' | 'microphone' | 'demo'
  // Timeline — background lane
  timelineEnabled?: boolean
  // Legacy field — kept for backwards-compat with sessions saved before Phase 1A.
  // On load these are migrated to VzTimelineMediaClip[] with lane='video-background'.
  timelineClips?: VzTimelineClip[]
  timelineLoop?: boolean
  // Phase 1A additions
  timelineOverlayClips?: VzTimelineMediaClip[]
  timelineEffectRegions?: VzTimelineEffectRegion[]
  layerItems?: VzLayerItem[]
  // Transport extras
  beatGridEnabled?: boolean
  cueMarkers?: VzCueMarker[]
}

export const DEFAULT_PRESETS: VzPreset[] = [
  {
    id: 'clean-playback',
    name: 'Clean Playback',
    color: '#9aafb8',
    gradient: 'linear-gradient(135deg,#0c1417 0%,#1a252a 60%,#2e4550 100%)',
    // No effects enabled — renders video exactly once per frame with zero extra passes.
    // This is the default startup state so users see smooth playback before enabling effects.
    effects: { ...DEFAULT_EFFECTS, rgbSplit: 0, bloom: 0, feedbackTrails: 0, glitchAmount: 0, strobe: 0, datamoshSmear: 0, displacement: 0 },
    enabledFx: [],
    isDefault: true,
  },
  {
    id: 'dream-theft',
    name: 'Dream Theft',
    color: '#4ac7db',
    gradient: 'linear-gradient(135deg,#0a1820 0%,#0e3040 60%,#4ac7db 100%)',
    effects: { ...DEFAULT_EFFECTS, rgbSplit: 0.3, bloom: 0.6, feedbackTrails: 0.2 },
    enabledFx: ['RGB Split', 'Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'nightmare-signal',
    name: 'Nightmare Signal',
    color: '#e05a5a',
    gradient: 'linear-gradient(135deg,#180a0a 0%,#4a1010 60%,#e05a5a 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0.8, rgbSplit: 0.7, strobe: 0.4, feedbackTrails: 0.5 },
    enabledFx: ['Glitch Bars', 'RGB Split', 'Scanlines', 'Feedback'],
    isDefault: true,
  },
  {
    id: 'boss-intro',
    name: 'Boss Intro',
    color: '#d8b95a',
    gradient: 'linear-gradient(135deg,#181008 0%,#4a3010 60%,#d8b95a 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, bloom: 0.9, displacement: 0.6, tunnelSpeed: 0.8 },
    enabledFx: ['Tunnel', 'Bloom', 'Displacement'],
    isDefault: true,
  },
  {
    id: 'drmwld-portal',
    name: 'DRMWLD Portal',
    color: '#b84fc9',
    gradient: 'linear-gradient(135deg,#120018 0%,#3a0050 60%,#b84fc9 100%)',
    effects: { ...DEFAULT_EFFECTS, colorShift: 0.6, bloom: 0.7, feedbackTrails: 0.4, tunnelSpeed: 0.5 },
    enabledFx: ['Tunnel', 'Bloom', 'RGB Split'],
    isDefault: true,
  },
  {
    id: 'cyber-bloom',
    name: 'Cyber Bloom',
    color: '#61d6aa',
    gradient: 'linear-gradient(135deg,#071812 0%,#0d3a28 60%,#61d6aa 100%)',
    effects: { ...DEFAULT_EFFECTS, bloom: 1.0, rgbSplit: 0.2, masterIntensity: 1.0 },
    enabledFx: ['Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'bass-impact',
    name: 'Bass Impact',
    color: '#d8b95a',
    gradient: 'linear-gradient(135deg,#151008 0%,#3a2800 60%,#d8b95a 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, strobe: 0.6, glitchAmount: 0.3, displacement: 0.4 },
    enabledFx: ['Glitch Bars', 'Displacement', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'clean-reactive',
    name: 'Clean Audio Reactive',
    color: '#7a9aaa',
    gradient: 'linear-gradient(135deg,#0b1216 0%,#16232a 60%,#3a5562 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0, rgbSplit: 0, strobe: 0, feedbackTrails: 0, bloom: 0.2 },
    enabledFx: ['Scanlines'],
    isDefault: true,
  },
]

// ── Store interface ───────────────────────────────────────────────────────────

interface VisualState {
  // Live performance state
  effects: VzEffects
  effectParams: VzEffectParams
  enabledFxArr: string[]
  activePresetId: string
  activeMediaId: string | null
  bpm: number
  bpmSync: boolean
  isPlaying: boolean
  quality: Quality

  // Presets (visual look templates only)
  presets: VzPreset[]

  // Sessions (full workspace snapshots)
  sessions: VzSession[]
  sessionsLoading: boolean
  sessionSyncError: string | null

  // ── Live state actions ─────────────────────────────────────────────────────
  setEffect(key: keyof VzEffects, v: number): void
  setEffectParam<K extends keyof VzEffectParams>(key: K, params: Partial<NonNullable<VzEffectParams[K]>>): void
  resetEffects(): void
  toggleFx(name: string): void
  setActiveMedia(id: string | null): void
  // Atomically replaces every reference to prevId with newId across all
  // visual state. Called by mediaStore when an upload completes and the
  // temporary local-* ID is superseded by a stable db-* ID.
  remapMediaId(prevId: string, newId: string): void
  setBpm(v: number): void
  toggleBpmSync(): void
  setPlaying(v: boolean): void
  setQuality(q: Quality): void

  // ── Preset actions ─────────────────────────────────────────────────────────
  // selectPreset applies whatever the preset's scope covers; returns scene
  // fields the caller must apply externally (mediaOrder, audioSource)
  selectPreset(id: string): { mediaOrder?: string[], audioSource?: VzSession['audioSource'] } | null
  savePreset(
    name: string,
    opts?: {
      scope?: PresetScope
      // extras not held in visualStore — provided by the caller
      mediaOrder?: string[]
      audioSource?: VzSession['audioSource']
    }
  ): void
  deletePreset(id: string): void

  // ── Session actions ────────────────────────────────────────────────────────
  saveSession(name: string, audioSource: VzSession['audioSource'], mediaOrder: string[]): void
  loadSession(id: string): VzSession | null
  renameSession(id: string, name: string): void
  deleteSession(id: string): void
  syncSessionsFromCloud(): Promise<void>
  clearSessionSyncError(): void

  // ── Modulation routing ────────────────────────────────────────────────────
  modulationRoutes: ModulationRoute[]
  toggleModulationRoute(id: string): void
  setModulationRouteAmount(id: string, amount: number): void
  resetModulationRoutes(): void

  // ── Timeline ──────────────────────────────────────────────────────────────
  //
  // Multi-lane timeline state (Phase 1A).
  //
  // External sources NOT stored here:
  //   - Audio: owned by useSharedAudio() via AudioEngineContext.
  //   - Lyrics: owned by useLyricsStore().cues.
  //
  // timelineClips is the video-background lane (primary visual source).
  // It replaces the old flat clips array; VzTimelineMediaClip extends
  // VzTimelineClip so all existing consumers continue to work unchanged.
  //
  timelineEnabled: boolean
  /** Background/video lane — primary sequential visual source. */
  timelineClips:         VzTimelineMediaClip[]
  timelineLoop:          boolean
  /** Overlay lane — absolute-positioned timed clips above the background. */
  timelineOverlayClips:  VzTimelineMediaClip[]
  /** Effects lane — timed automation regions for future runtime control. */
  timelineEffectRegions: VzTimelineEffectRegion[]

  // ── Shared timeline controls ───────────────────────────────────────────────
  setTimelineEnabled(enabled: boolean): void
  setTimelineLoop(loop: boolean): void
  // Ephemeral — not persisted. Updated by the RAF loop each frame.
  timelineClock:    number
  setTimelineClock: (t: number) => void
  scrubTimeline:    (t: number) => void

  // ── Compatibility wrappers (operate on the video-background lane) ──────────
  // These preserve the existing API surface so callers do not need to change
  // during Phase 1A. They all default to the video-background lane.
  addTimelineClip(mediaId: string, durationSec?: number): void
  removeTimelineClip(clipId: string): void
  duplicateTimelineClip(clipId: string): void
  reorderTimelineClips(clipIds: string[]): void
  updateTimelineClip(clipId: string, patch: Partial<VzTimelineClip>): void
  /** Clears all lanes (background, overlays, effect regions). */
  clearTimeline(): void

  // ── Lane-aware media clip actions ─────────────────────────────────────────
  // Use these for new features that need to specify a lane explicitly.
  addMediaClip(lane: VzTimelineMediaLaneId, mediaId: string, durationSec?: number): void
  updateMediaClip(clipId: string, patch: Partial<Omit<VzTimelineMediaClip, 'id' | 'lane'>>): void
  removeMediaClip(clipId: string): void
  duplicateMediaClip(clipId: string): void
  moveMediaClipToLane(clipId: string, targetLane: VzTimelineMediaLaneId): void
  /** Sets the absolute start time for a clip in any lane. Bg clips are re-sorted by startSec after update. */
  setMediaClipStart(clipId: string, startSec: number): void
  setMediaClipDuration(clipId: string, durationSec: number): void
  clearMediaLane(lane: VzTimelineMediaLaneId): void

  // ── Effect region actions ──────────────────────────────────────────────────
  addEffectRegion(region: Omit<VzTimelineEffectRegion, 'id'>): void
  updateEffectRegion(id: string, patch: Partial<Omit<VzTimelineEffectRegion, 'id'>>): void
  removeEffectRegion(id: string): void
  clearEffectRegions(): void

  // ── Layer compositor ──────────────────────────────────────────────────────
  layerConfigs: VzLayerConfig[]
  setLayerConfig(id: VzLayerConfigId, patch: Partial<Omit<VzLayerConfig, 'id'>>): void
  resetLayerConfigs(): void

  // ── Layer items ───────────────────────────────────────────────────────────
  layerItems: VzLayerItem[]
  addLayerItem(mediaId: string, layerId: VzLayerConfigId, overrides?: Partial<Omit<VzLayerItem, 'id' | 'mediaId' | 'layerId'>>): void
  removeLayerItem(id: string): void
  updateLayerItem(id: string, patch: Partial<Omit<VzLayerItem, 'id'>>): void
  reorderLayerItem(id: string, direction: 'up' | 'down'): void
  clearLayerItemsForLayer(layerId: VzLayerConfigId): void
  setLayerItemSolo(id: string): void

  // ── Layer selection (ephemeral — not persisted) ───────────────────────
  selectedLayerId: string | null
  selectedLayerItemId: string | null
  setSelectedLayerItem(layerId: string | null, itemId: string | null): void

  // ── Timeline entity selection (ephemeral — not persisted) ─────────────
  selectedTimelineEntity: SelectedTimelineEntity | null
  setSelectedTimelineEntity(entity: SelectedTimelineEntity | null): void

  // ── Transport extras ──────────────────────────────────────────────────────
  cuePoint:        number          // ephemeral — not persisted
  beatGridEnabled: boolean
  waveformZoom:    number          // ephemeral — not persisted
  cueMarkers:      VzCueMarker[]

  setCuePoint(t: number): void
  setBeatGridEnabled(v: boolean): void
  setWaveformZoom(v: number): void
  addCueMarker(marker: Omit<VzCueMarker, 'id'>): void
  removeCueMarker(id: string): void
  updateCueMarker(id: string, patch: Partial<Omit<VzCueMarker, 'id'>>): void
  clearCueMarkers(): void

  // ── Auto quality ──────────────────────────────────────────────────────────
  autoQualityEnabled: boolean
  autoQualityMin:     Quality
  autoQualityMax:     Quality
  autoQualityReason:  string        // ephemeral — not persisted

  setAutoQualityEnabled(v: boolean): void
  setAutoQualityMin(q: Quality): void
  setAutoQualityMax(q: Quality): void
  setAutoQualityReason(r: string): void

  // ── Audio reactivity master toggle ────────────────────────────────────────
  // Controls whether beat-driven modulation and scale pulsing affect rendering.
  // Defaults to false so a clean project starts with a visually static canvas.
  audioReactivityEnabled: boolean
  setAudioReactivityEnabled(v: boolean): void

  // ── Video Baseline Mode ───────────────────────────────────────────────────
  // When true, the renderer receives an empty enabledFx Set regardless of the
  // stored enabledFxArr. Renders exactly one video pass with no extra processing.
  // Ephemeral — never persisted, always starts false on every launch.
  videoBaselineMode: boolean
  setVideoBaselineMode(v: boolean): void

  // ── Renderer type ─────────────────────────────────────────────────────────
  // Ephemeral — not persisted; resolved from gpuPreference on every launch.
  // 'webgl2' enables GPU compositor (video + RGB Split + Bloom via shaders).
  // Canvas 2D remains the fallback and handles all other effects and overlays.
  rendererType: 'canvas2d' | 'webgl2'
  setRendererType(t: 'canvas2d' | 'webgl2'): void

  // ── GPU preference ────────────────────────────────────────────────────────
  // Persisted user preference used to auto-select rendererType on launch.
  // 'auto'     → try WebGL2, silently fall back to Canvas 2D if unavailable
  // 'webgl2'   → always try WebGL2; show reason if unavailable
  // 'canvas2d' → always Canvas 2D; never attempts GPU init
  gpuPreference: 'auto' | 'webgl2' | 'canvas2d'
  setGpuPreference(p: 'auto' | 'webgl2' | 'canvas2d'): void

  // Ephemeral diagnostic set when gpuPreference requested WebGL2 but init failed.
  rendererFallbackReason: string | null
  setRendererFallbackReason(reason: string | null): void

  // Ephemeral: true while the WebGL2 context is lost and Canvas 2D is active as fallback.
  contextLost: boolean
  setRendererContextLost(lost: boolean): void
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Generates a unique ID for clips and effect regions. */
function _genId(prefix: string): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Sorts bg clips by startSec ascending.
 * Used after any mutation that changes a clip's absolute start position.
 * Does NOT recalculate starts — preserves all existing startSec values.
 */
function sortBgClips<T extends VzTimelineClip>(clips: T[]): T[] {
  return [...clips].sort((a, b) => a.startSec - b.startSec)
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useVisualStore = create<VisualState>()(
  persist(
    (set, get) => ({
      effects:           DEFAULT_PRESETS[0].effects,   // clean-playback — no expensive effects
      effectParams:      DEFAULT_EFFECT_PARAMS,
      enabledFxArr:      DEFAULT_PRESETS[0].enabledFx, // [] — no effects enabled on cold start
      activePresetId:    DEFAULT_PRESETS[0].id,         // 'clean-playback'
      activeMediaId:     null,
      bpm:               120,
      bpmSync:           false,
      isPlaying:         false,
      quality:           'High',
      presets:           DEFAULT_PRESETS,
      sessions:          [],
      sessionsLoading:   false,
      sessionSyncError:  null,
      modulationRoutes:       DEFAULT_MODULATION_ROUTES,
      timelineEnabled:        false,
      timelineClips:          [] as VzTimelineMediaClip[],
      timelineLoop:           true,
      timelineOverlayClips:   [] as VzTimelineMediaClip[],
      timelineEffectRegions:  [] as VzTimelineEffectRegion[],
      timelineClock:          0,
      layerConfigs:      [...DEFAULT_LAYER_CONFIGS],
      layerItems:        [],
      selectedLayerId:          null,
      selectedLayerItemId:      null,
      selectedTimelineEntity:   null,
      cuePoint:          0,
      beatGridEnabled:   false,
      waveformZoom:      1,
      cueMarkers:        [],
      autoQualityEnabled: false,
      autoQualityMin:     'Low',
      autoQualityMax:     'High',
      autoQualityReason:  '',
      audioReactivityEnabled: false,
      videoBaselineMode:      false,   // ephemeral — never persisted
      rendererType:           'canvas2d' as const,  // ephemeral — resolved from gpuPreference
      gpuPreference:          'auto' as const,      // persisted
      rendererFallbackReason: null,                 // ephemeral — set on GPU init failure
      contextLost:            false,                // ephemeral — true while WebGL2 context is lost

      // ── Live state ──────────────────────────────────────────────────────────

      setEffect(key, v) {
        set(s => ({ effects: { ...s.effects, [key]: v }, activePresetId: 'custom' }))
      },
      setEffectParam(key, params) {
        set(s => ({
          effectParams: {
            ...s.effectParams,
            [key]: { ...(s.effectParams[key] ?? {}), ...params },
          },
        }))
      },
      resetEffects() {
        set({ effects: DEFAULT_EFFECTS, enabledFxArr: [], activePresetId: 'custom' })
      },
      toggleFx(name) {
        set(s => ({
          enabledFxArr: s.enabledFxArr.includes(name)
            ? s.enabledFxArr.filter(x => x !== name)
            : [...s.enabledFxArr, name],
        }))
      },
      setActiveMedia(id) { set({ activeMediaId: id }) },

      remapMediaId(prevId, newId) {
        if (prevId === newId) return
        set(s => ({
          activeMediaId: s.activeMediaId === prevId ? newId : s.activeMediaId,
          timelineClips: s.timelineClips.map(c =>
            c.mediaId === prevId ? { ...c, mediaId: newId } : c
          ),
          timelineOverlayClips: s.timelineOverlayClips.map(c =>
            c.mediaId === prevId ? { ...c, mediaId: newId } : c
          ),
          layerItems: s.layerItems.map(li =>
            li.mediaId === prevId ? { ...li, mediaId: newId } : li
          ),
          sessions: s.sessions.map(sess => ({
            ...sess,
            activeMediaId: sess.activeMediaId === prevId ? newId : sess.activeMediaId,
            mediaOrder: sess.mediaOrder?.map(id => (id === prevId ? newId : id)),
            timelineClips: sess.timelineClips?.map(c =>
              c.mediaId === prevId ? { ...c, mediaId: newId } : c
            ),
            timelineOverlayClips: sess.timelineOverlayClips?.map(c =>
              c.mediaId === prevId ? { ...c, mediaId: newId } : c
            ),
            layerItems: sess.layerItems?.map(li =>
              li.mediaId === prevId ? { ...li, mediaId: newId } : li
            ),
          })),
          presets: s.presets.map(p => ({
            ...p,
            activeMediaId: p.activeMediaId === prevId ? newId : p.activeMediaId,
            mediaOrder: p.mediaOrder?.map(id => (id === prevId ? newId : id)),
            timelineClips: p.timelineClips?.map(c =>
              c.mediaId === prevId ? { ...c, mediaId: newId } : c
            ),
            timelineOverlayClips: p.timelineOverlayClips?.map(c =>
              c.mediaId === prevId ? { ...c, mediaId: newId } : c
            ),
          })),
        }))
      },

      setBpm(v)          { set({ bpm: Math.max(40, Math.min(300, v)) }) },
      toggleBpmSync()    { set(s => ({ bpmSync: !s.bpmSync })) },
      setPlaying(v)      { set({ isPlaying: v }) },
      setQuality(q)      { set({ quality: q }) },

      // ── Presets ─────────────────────────────────────────────────────────────

      selectPreset(id) {
        const preset = get().presets.find(p => p.id === id)
        if (!preset) return null
        const scope = preset.scope ?? LOOK_SCOPE
        const patch: Partial<VisualState> = { activePresetId: id }
        if (scope.effects) {
          patch.effects = { ...preset.effects }
          // Only restore effectParams if the preset explicitly saved them
          if (preset.effectParams !== undefined) {
            patch.effectParams = { ...preset.effectParams }
          }
        }
        if (scope.enabledFx) patch.enabledFxArr  = [...preset.enabledFx]
        if (scope.modulation && preset.modulationRoutes) {
          const savedIds = new Set(preset.modulationRoutes.map(r => r.id))
          patch.modulationRoutes = [
            ...preset.modulationRoutes,
            ...DEFAULT_MODULATION_ROUTES.filter(r => !savedIds.has(r.id)),
          ]
        }
        if (scope.activeMedia !== undefined) patch.activeMediaId = preset.activeMediaId ?? null
        if (scope.bpm   && preset.bpm   !== undefined) patch.bpm   = preset.bpm
        if (scope.bpmSync !== undefined) patch.bpmSync = preset.bpmSync ?? false
        if (scope.quality && preset.quality) patch.quality = preset.quality
        if (scope.timeline && preset.timelineEnabled !== undefined) {
          patch.timelineEnabled = preset.timelineEnabled
          // Migrate legacy VzTimelineClip[] → VzTimelineMediaClip[] (video-background lane).
          // migrateLegacyClips is idempotent: clips already carrying `lane` pass through.
          // Only recalculate sequential starts for true legacy clips (missing `lane`). Modern
          // clips already store absolute startSec from the previous save and must not be repacked.
          const rawPresetBg  = preset.timelineClips ?? []
          const migratedPresetBg = migrateLegacyClips(rawPresetBg)
          patch.timelineClips = rawPresetBg.some(c => !('lane' in (c as object)))
            ? recalculateTimelineStarts(migratedPresetBg)
            : sortBgClips(migratedPresetBg)
          patch.timelineLoop           = preset.timelineLoop ?? true
          patch.timelineOverlayClips   = migrateLegacyClips(preset.timelineOverlayClips ?? [], 'overlays')
          patch.timelineEffectRegions  = preset.timelineEffectRegions ?? []
        }
        set(patch)
        // Return scene fields the caller handles externally
        const scene: { mediaOrder?: string[], audioSource?: VzSession['audioSource'] } = {}
        if (scope.mediaOrder  && preset.mediaOrder)  scene.mediaOrder  = preset.mediaOrder
        if (scope.audioSource && preset.audioSource) scene.audioSource = preset.audioSource
        return Object.keys(scene).length ? scene : null
      },
      savePreset(name, opts) {
        const { effects, enabledFxArr, modulationRoutes, activeMediaId, bpm, bpmSync, quality } = get()
        const scope = opts?.scope ?? LOOK_SCOPE
        const id = `custom-${Date.now().toString(36)}`
        const newPreset: VzPreset = {
          id, name,
          color:    '#4ac7db',
          gradient: 'linear-gradient(135deg,#0a1820 0%,#0e3040 60%,#4ac7db 100%)',
          scope,
          // Visual look always saved
          effects:   { ...effects },
          enabledFx: [...enabledFxArr],
        }
        if (scope.effects) {
          const { effectParams } = get()
          // Only store effectParams in preset if non-empty (keeps old presets clean)
          const hasParams = Object.keys(effectParams).length > 0
          if (hasParams) newPreset.effectParams = { ...effectParams }
        }
        if (scope.modulation)  newPreset.modulationRoutes = modulationRoutes.map(r => ({ ...r }))
        if (scope.activeMedia) newPreset.activeMediaId    = activeMediaId
        if (scope.mediaOrder && opts?.mediaOrder) newPreset.mediaOrder = [...opts.mediaOrder]
        if (scope.audioSource && opts?.audioSource) newPreset.audioSource = opts.audioSource
        if (scope.bpm)     newPreset.bpm     = bpm
        if (scope.bpmSync) newPreset.bpmSync = bpmSync
        if (scope.quality) newPreset.quality = quality
        if (scope.timeline) {
          const { timelineEnabled, timelineClips, timelineLoop, timelineOverlayClips, timelineEffectRegions } = get()
          newPreset.timelineEnabled       = timelineEnabled
          newPreset.timelineClips         = [...timelineClips]
          newPreset.timelineLoop          = timelineLoop
          newPreset.timelineOverlayClips  = [...timelineOverlayClips]
          newPreset.timelineEffectRegions = [...timelineEffectRegions]
        }
        set(s => ({ presets: [...s.presets, newPreset], activePresetId: id }))
      },
      deletePreset(id) {
        set(s => ({
          presets: s.presets.filter(p => p.id !== id || p.isDefault),
          activePresetId: s.activePresetId === id ? DEFAULT_PRESETS[0].id : s.activePresetId,
        }))
      },

      // ── Sessions ─────────────────────────────────────────────────────────────

      saveSession(name, audioSource, mediaOrder) {
        const s = get()
        const localId = `session-${Date.now().toString(36)}`
        const session: VzSession = {
          id:            localId,
          name,
          createdAt:     Date.now(),
          source:        'local',
          activeMediaId: s.activeMediaId,
          mediaOrder,
          activePresetId:s.activePresetId,
          effects:       { ...s.effects },
          enabledFx:     [...s.enabledFxArr],
          effectParams:  { ...s.effectParams },
          bpm:           s.bpm,
          bpmSync:       s.bpmSync,
          quality:       s.quality,
          audioSource,
          timelineEnabled:       s.timelineEnabled,
          timelineClips:         [...s.timelineClips],
          timelineLoop:          s.timelineLoop,
          timelineOverlayClips:  [...s.timelineOverlayClips],
          timelineEffectRegions: [...s.timelineEffectRegions],
          layerItems:            [...s.layerItems],
          beatGridEnabled: s.beatGridEnabled,
          cueMarkers:      [...s.cueMarkers],
        }
        // Optimistic local add — visible immediately
        set(st => ({ sessions: [...st.sessions, session] }))

        // Fire-and-forget cloud save; upgrades source to 'cloud' on success
        if (supabaseConfigured) {
          dbCreateSession(session).then(({ dbId, error }) => {
            if (error || !dbId) {
              console.error('[visualStore] cloud save session:', error)
              return
            }
            set(st => ({
              sessions: st.sessions.map(x =>
                x.id === localId ? { ...x, source: 'cloud', dbId, updatedAt: Date.now() } : x
              ),
            }))
          })
        }
      },

      loadSession(id) {
        const session = get().sessions.find(s => s.id === id)
        if (!session) return null
        // Apply visual state — deliberately does NOT change media deck order here;
        // the caller is responsible for reordering via mediaStore.reorderItems()
        set({
          activeMediaId:   session.activeMediaId,
          activePresetId:  session.activePresetId,
          effects:         { ...session.effects },
          enabledFxArr:    [...session.enabledFx],
          effectParams:    session.effectParams ?? DEFAULT_EFFECT_PARAMS,
          bpm:             session.bpm,
          bpmSync:         session.bpmSync,
          quality:         session.quality,
          timelineEnabled: session.timelineEnabled ?? false,
          // Migrate legacy VzTimelineClip[] → VzTimelineMediaClip[] (video-background lane).
          // migrateLegacyClips handles both the deprecated transition field and the
          // missing `lane` field in one idempotent pass.
          // Only recalculate sequential starts for true legacy clips (missing `lane`). Modern
          // clips already store absolute startSec from the previous save and must not be repacked.
          timelineClips: (() => {
            const raw      = session.timelineClips ?? []
            const migrated = migrateLegacyClips(raw)
            return raw.some(c => !('lane' in (c as object)))
              ? recalculateTimelineStarts(migrated)
              : sortBgClips(migrated)
          })(),
          timelineLoop:          session.timelineLoop ?? true,
          timelineOverlayClips:  migrateLegacyClips(session.timelineOverlayClips ?? [], 'overlays'),
          timelineEffectRegions: session.timelineEffectRegions ?? [],
          layerItems:            session.layerItems ?? [],
          beatGridEnabled: session.beatGridEnabled  ?? false,
          cueMarkers:      (session.cueMarkers ?? []) as VzCueMarker[],
          cuePoint:        0,
        })
        return session
      },

      renameSession(id, name) {
        set(s => ({
          sessions: s.sessions.map(x => x.id === id ? { ...x, name } : x),
        }))
        // Sync rename to cloud
        const session = get().sessions.find(s => s.id === id)
        if (session?.dbId && supabaseConfigured) {
          dbUpdateSession(session.dbId, { ...session, name }).then(({ error }) => {
            if (error) console.error('[visualStore] rename session:', error)
          })
        }
      },

      deleteSession(id) {
        const session = get().sessions.find(s => s.id === id)
        set(s => ({ sessions: s.sessions.filter(x => x.id !== id) }))
        if (session?.dbId && supabaseConfigured) {
          dbDeleteSession(session.dbId).then(({ error }) => {
            if (error) console.error('[visualStore] delete session:', error)
          })
        }
      },

      async syncSessionsFromCloud() {
        if (!supabaseConfigured) return
        set({ sessionsLoading: true, sessionSyncError: null })
        try {
          const { sessions: cloudSessions, error } = await loadCloudSessions()
          if (error) { set({ sessionSyncError: error }); return }

          set(st => {
            // Keep local-only sessions (no dbId)
            const localOnly = st.sessions.filter(s => s.source === 'local' && !s.dbId)
            // Build map of cloud sessions by dbId
            const cloudMap = new Map(cloudSessions.map(s => [s.dbId!, s]))
            // Update any existing sessions that now have cloud versions
            const updated = st.sessions.map(s =>
              s.dbId && cloudMap.has(s.dbId) ? { ...cloudMap.get(s.dbId)!, id: s.id } : s
            )
            // Add cloud sessions not already represented locally
            const existingDbIds = new Set(updated.map(s => s.dbId).filter(Boolean) as string[])
            const newCloud = cloudSessions.filter(s => s.dbId && !existingDbIds.has(s.dbId))
            // Sort: newest first
            const merged = [...updated.filter(s => !localOnly.find(l => l.id === s.id)), ...localOnly, ...newCloud]
              .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
            return { sessions: merged }
          })
        } catch (e) {
          set({ sessionSyncError: e instanceof Error ? e.message : 'Sync failed' })
        } finally {
          set({ sessionsLoading: false })
        }
      },

      clearSessionSyncError() { set({ sessionSyncError: null }) },

      // ── Modulation routing ───────────────────────────────────────────────────

      toggleModulationRoute(id) {
        set(s => ({
          modulationRoutes: s.modulationRoutes.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
          ),
        }))
      },
      setModulationRouteAmount(id, amount) {
        set(s => ({
          modulationRoutes: s.modulationRoutes.map(r =>
            r.id === id ? { ...r, amount } : r
          ),
        }))
      },
      resetModulationRoutes() {
        set({ modulationRoutes: DEFAULT_MODULATION_ROUTES })
      },

      // ── Timeline ────────────────────────────────────────────────────────────
      //
      // Internal helper: generate a unique clip/region ID.
      // Defined inline below via a module-level function (_genId).

      setTimelineEnabled(enabled) { set({ timelineEnabled: enabled }) },
      setTimelineLoop(loop)       { set({ timelineLoop: loop }) },

      setTimelineClock(t) { set({ timelineClock: t }) },
      scrubTimeline(t)    { set({ timelineClock: t }) },

      // ── Compatibility wrappers — operate on the video-background lane ────────
      // Existing callers (TimelinePanel, canvas, etc.) continue to use these
      // without modification during Phase 1A.

      addTimelineClip(mediaId, durationSec = DEFAULT_CLIP_DURATION_SEC) {
        const clipProps: Omit<VzTimelineMediaClip, 'startSec'> = {
          id:           _genId('clip'),
          mediaId,
          durationSec,
          mediaInSec:   0,
          fitMode:      'cover',
          playbackMode: 'trim',
          lane:         'video-background',
        }
        // appendBgClip places clip after the last existing clip (transition-aware).
        // Does NOT recalculate any prior clip starts.
        set(s => ({ timelineClips: appendBgClip(s.timelineClips, clipProps) }))
      },

      removeTimelineClip(clipId) {
        // Absolute positions — no recalculation needed after removal.
        set(s => ({
          timelineClips: s.timelineClips.filter(c => c.id !== clipId),
        }))
      },

      duplicateTimelineClip(clipId) {
        set(s => {
          const original = s.timelineClips.find(c => c.id === clipId)
          if (!original) return {}
          // Place copy immediately after original
          const copy: VzTimelineMediaClip = {
            ...original,
            id: _genId('clip'),
            startSec: original.startSec + original.durationSec,
          }
          return { timelineClips: sortBgClips([...s.timelineClips, copy]) }
        })
      },

      reorderTimelineClips(clipIds) {
        // Explicit reorder: honour the provided ID sequence, then sort by startSec.
        // Kept for backward compatibility with any callers; no longer triggers
        // recalculateTimelineStarts so existing absolute positions are preserved.
        set(s => {
          const map = new Map(s.timelineClips.map(c => [c.id, c]))
          const reordered = clipIds.map(id => map.get(id)).filter(Boolean) as VzTimelineMediaClip[]
          return { timelineClips: sortBgClips(reordered) }
        })
      },

      updateTimelineClip(clipId, patch) {
        // Absolute positioning — sort by startSec if start changed; no recalc.
        set(s => ({
          timelineClips: sortBgClips(
            s.timelineClips.map(c => c.id === clipId ? { ...c, ...patch } : c)
          ),
        }))
      },

      clearTimeline() {
        // Clears all lanes — background, overlays, and effect regions.
        set({ timelineClips: [], timelineOverlayClips: [], timelineEffectRegions: [] })
      },

      // ── Lane-aware media clip actions ────────────────────────────────────────

      addMediaClip(lane, mediaId, durationSec = DEFAULT_CLIP_DURATION_SEC) {
        const clipProps: Omit<VzTimelineMediaClip, 'startSec'> = {
          id:           _genId('clip'),
          mediaId,
          durationSec,
          mediaInSec:   0,
          fitMode:      lane === 'overlays' ? 'contain' : 'cover',
          playbackMode: 'trim',
          lane,
        }
        if (lane === 'video-background') {
          // appendBgClip places after the last bg clip (transition-aware). No recalc.
          set(s => ({ timelineClips: appendBgClip(s.timelineClips, clipProps) }))
        } else {
          // Overlay clips: default start = end of last bg clip; absolute position.
          set(s => {
            const lastBg = s.timelineClips.length > 0
              ? s.timelineClips.reduce((max, c) =>
                  c.startSec + c.durationSec > max.startSec + max.durationSec ? c : max,
                  s.timelineClips[0])
              : null
            const defaultStart = lastBg ? lastBg.startSec + lastBg.durationSec : 0
            return {
              timelineOverlayClips: [
                ...s.timelineOverlayClips,
                { ...clipProps, startSec: defaultStart },
              ],
            }
          })
        }
      },

      updateMediaClip(clipId, patch) {
        set(s => {
          // Background lane — sort by startSec after update; no recalc.
          if (s.timelineClips.some(c => c.id === clipId)) {
            return {
              timelineClips: sortBgClips(
                s.timelineClips.map(c => c.id === clipId ? { ...c, ...patch } : c)
              ),
            }
          }
          // Overlay lane — absolute; no sort needed (overlays are unordered).
          if (s.timelineOverlayClips.some(c => c.id === clipId)) {
            return {
              timelineOverlayClips: s.timelineOverlayClips.map(c =>
                c.id === clipId ? { ...c, ...patch } : c
              ),
            }
          }
          return {}
        })
      },

      removeMediaClip(clipId) {
        // Absolute positions — no recalculation on removal.
        set(s => {
          if (s.timelineClips.some(c => c.id === clipId)) {
            return { timelineClips: s.timelineClips.filter(c => c.id !== clipId) }
          }
          if (s.timelineOverlayClips.some(c => c.id === clipId)) {
            return { timelineOverlayClips: s.timelineOverlayClips.filter(c => c.id !== clipId) }
          }
          return {}
        })
      },

      duplicateMediaClip(clipId) {
        set(s => {
          const bgClip = s.timelineClips.find(c => c.id === clipId)
          if (bgClip) {
            const copy: VzTimelineMediaClip = {
              ...bgClip,
              id: _genId('clip'),
              startSec: bgClip.startSec + bgClip.durationSec,
            }
            return { timelineClips: sortBgClips([...s.timelineClips, copy]) }
          }
          const olClip = s.timelineOverlayClips.find(c => c.id === clipId)
          if (olClip) {
            const copy: VzTimelineMediaClip = {
              ...olClip,
              id: _genId('clip'),
              startSec: olClip.startSec + olClip.durationSec,
            }
            return { timelineOverlayClips: [...s.timelineOverlayClips, copy] }
          }
          return {}
        })
      },

      moveMediaClipToLane(clipId, targetLane) {
        set(s => {
          const bgClip      = s.timelineClips.find(c => c.id === clipId)
          const overlayClip = s.timelineOverlayClips.find(c => c.id === clipId)
          const clip        = bgClip ?? overlayClip
          if (!clip || clip.lane === targetLane) return {}

          const moved = { ...clip, lane: targetLane }

          if (targetLane === 'video-background') {
            // Moving overlay → bg: use appendBgClip for correct placement.
            return {
              timelineClips: appendBgClip(
                s.timelineClips,
                { ...moved, startSec: undefined } as unknown as Omit<VzTimelineMediaClip, 'startSec'>,
              ),
              timelineOverlayClips: s.timelineOverlayClips.filter(c => c.id !== clipId),
            }
          } else {
            // Moving bg → overlay: remove from bg (no recalc), place at bg end.
            const bgEnd = s.timelineClips.reduce(
              (max, c) => Math.max(max, c.startSec + c.durationSec), 0
            )
            return {
              timelineClips: s.timelineClips.filter(c => c.id !== clipId),
              timelineOverlayClips: [
                ...s.timelineOverlayClips,
                { ...moved, startSec: bgEnd },
              ],
            }
          }
        })
      },

      setMediaClipStart(clipId, startSec) {
        // Now works for BOTH bg and overlay clips.
        // For bg clips, array is re-sorted by startSec after update.
        const s_start = Math.max(0, startSec)
        set(s => {
          if (s.timelineClips.some(c => c.id === clipId)) {
            return {
              timelineClips: sortBgClips(
                s.timelineClips.map(c => c.id === clipId ? { ...c, startSec: s_start } : c)
              ),
            }
          }
          if (s.timelineOverlayClips.some(c => c.id === clipId)) {
            return {
              timelineOverlayClips: s.timelineOverlayClips.map(c =>
                c.id === clipId ? { ...c, startSec: s_start } : c
              ),
            }
          }
          return {}
        })
      },

      setMediaClipDuration(clipId, durationSec) {
        const dur = Math.max(0.25, durationSec)
        set(s => {
          // Background lane — update duration only; no recalculation.
          if (s.timelineClips.some(c => c.id === clipId)) {
            return {
              timelineClips: s.timelineClips.map(c =>
                c.id === clipId ? { ...c, durationSec: dur } : c
              ),
            }
          }
          if (s.timelineOverlayClips.some(c => c.id === clipId)) {
            return {
              timelineOverlayClips: s.timelineOverlayClips.map(c =>
                c.id === clipId ? { ...c, durationSec: dur } : c
              ),
            }
          }
          return {}
        })
      },

      clearMediaLane(lane) {
        if (lane === 'video-background') set({ timelineClips: [] })
        else set({ timelineOverlayClips: [] })
      },

      // ── Effect region actions ────────────────────────────────────────────────

      addEffectRegion(region) {
        const id = _genId('fx')
        set(s => ({
          timelineEffectRegions: [...s.timelineEffectRegions, { ...region, id }],
        }))
      },

      updateEffectRegion(id, patch) {
        set(s => ({
          timelineEffectRegions: s.timelineEffectRegions.map(r =>
            r.id === id ? { ...r, ...patch } : r
          ),
        }))
      },

      removeEffectRegion(id) {
        set(s => ({
          timelineEffectRegions: s.timelineEffectRegions.filter(r => r.id !== id),
        }))
      },

      clearEffectRegions() {
        set({ timelineEffectRegions: [] })
      },

      setLayerConfig(id, patch) {
        set(s => ({
          layerConfigs: s.layerConfigs.map(c => c.id === id ? { ...c, ...patch } : c),
        }))
      },
      resetLayerConfigs() {
        set({ layerConfigs: [...DEFAULT_LAYER_CONFIGS] })
      },

      addLayerItem(mediaId, layerId, overrides) {
        set(s => {
          // Assign zIndex = max existing in this layer + 1
          const maxZ = s.layerItems
            .filter(i => i.layerId === layerId)
            .reduce((m, i) => Math.max(m, i.zIndex), -1)
          const item = createDefaultLayerItem(mediaId, layerId, { ...overrides, zIndex: maxZ + 1 })
          return { layerItems: [...s.layerItems, item] }
        })
      },
      removeLayerItem(id) {
        set(s => ({ layerItems: s.layerItems.filter(i => i.id !== id) }))
      },
      updateLayerItem(id, patch) {
        set(s => ({
          layerItems: s.layerItems.map(i => i.id === id ? { ...i, ...patch } : i),
        }))
      },
      reorderLayerItem(id, direction) {
        set(s => {
          const item = s.layerItems.find(i => i.id === id)
          if (!item) return {}
          // Get siblings in same layer sorted by zIndex
          const siblings = s.layerItems
            .filter(i => i.layerId === item.layerId)
            .sort((a, b) => a.zIndex - b.zIndex)
          const idx = siblings.findIndex(i => i.id === id)
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          if (swapIdx < 0 || swapIdx >= siblings.length) return {}
          const other = siblings[swapIdx]
          // Swap their zIndexes
          return {
            layerItems: s.layerItems.map(i => {
              if (i.id === id)    return { ...i, zIndex: other.zIndex }
              if (i.id === other.id) return { ...i, zIndex: item.zIndex }
              return i
            }),
          }
        })
      },
      clearLayerItemsForLayer(layerId) {
        set(s => ({ layerItems: s.layerItems.filter(i => i.layerId !== layerId) }))
      },
      setLayerItemSolo(id) {
        set(s => ({
          layerItems: s.layerItems.map(i =>
            i.id === id ? { ...i, solo: !i.solo } : i
          ),
        }))
      },

      setSelectedLayerItem(layerId, itemId) {
        set({ selectedLayerId: layerId, selectedLayerItemId: itemId, selectedTimelineEntity: null })
      },

      setSelectedTimelineEntity(entity) {
        set({ selectedTimelineEntity: entity, selectedLayerId: null, selectedLayerItemId: null })
      },

      // ── Transport extras ──────────────────────────────────────────────────
      setCuePoint(t)        { set({ cuePoint: Math.max(0, t) }) },
      setBeatGridEnabled(v) { set({ beatGridEnabled: v }) },
      setWaveformZoom(v)    { set({ waveformZoom: Math.max(1, Math.min(16, v)) }) },
      addCueMarker(marker) {
        const id = (crypto.randomUUID?.() ?? `cue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`) as string
        set(s => ({
          cueMarkers: [...s.cueMarkers, { ...marker, id }]
            .sort((a, b) => a.time - b.time),
        }))
      },
      removeCueMarker(id) {
        set(s => ({ cueMarkers: s.cueMarkers.filter(m => m.id !== id) }))
      },
      updateCueMarker(id, patch) {
        set(s => ({
          cueMarkers: s.cueMarkers
            .map(m => m.id === id ? { ...m, ...patch } : m)
            .sort((a, b) => a.time - b.time),
        }))
      },
      clearCueMarkers() { set({ cueMarkers: [] }) },

      // ── Auto quality ──────────────────────────────────────────────────────
      setAutoQualityEnabled(v) { set({ autoQualityEnabled: v }) },
      setAutoQualityMin(q)     { set({ autoQualityMin: q }) },
      setAutoQualityMax(q)     { set({ autoQualityMax: q }) },
      setAutoQualityReason(r)  { set({ autoQualityReason: r }) },

      // ── Audio reactivity ──────────────────────────────────────────────────
      setAudioReactivityEnabled(v) { set({ audioReactivityEnabled: v }) },

      // ── Video Baseline Mode ───────────────────────────────────────────────
      setVideoBaselineMode(v) { set({ videoBaselineMode: v }) },

      // ── Renderer type ─────────────────────────────────────────────────────
      setRendererType(t)              { set({ rendererType: t }) },
      setGpuPreference(p)             { set({ gpuPreference: p }) },
      setRendererFallbackReason(r)    { set({ rendererFallbackReason: r }) },
      setRendererContextLost(lost)    { set({ contextLost: lost }) },
    }),
    {
      name: 'drmvyz-visual-store',
      partialize: (s) => ({
        effects:           s.effects,
        effectParams:      s.effectParams,
        enabledFxArr:      s.enabledFxArr,
        activePresetId:    s.activePresetId,
        // INTENTIONAL: activeMediaId and layerItems are NOT persisted.
        // The canvas must start blank on every launch so users begin each session
        // with a clean slate. This is by design — do not restore these fields.
        presets:           s.presets.filter(p => !p.isDefault),
        sessions:          s.sessions,
        bpm:               s.bpm,
        bpmSync:           s.bpmSync,
        quality:           s.quality,
        modulationRoutes:  s.modulationRoutes,
        layerConfigs:      s.layerConfigs,
        beatGridEnabled:    s.beatGridEnabled,
        cueMarkers:         s.cueMarkers,
        autoQualityEnabled: s.autoQualityEnabled,
        autoQualityMin:     s.autoQualityMin,
        autoQualityMax:     s.autoQualityMax,
        // autoQualityReason is ephemeral — not persisted
        audioReactivityEnabled: s.audioReactivityEnabled,
        gpuPreference:          s.gpuPreference,
      }),
      // Re-inject default presets after rehydration so they are never missing
      merge: (persisted, current) => {
        const p = persisted as Partial<VisualState>
        // Ensure all rehydrated sessions have a source field (backward compat with
        // sessions saved before the source field was added)
        const sessions = (p.sessions ?? []).map(s => ({
          ...s,
          source: (s as VzSession).source ?? 'local',
        })) as VzSession[]
        // Merge persisted routes with any new defaults added since last save
        const savedRoutes = (p.modulationRoutes ?? []) as ModulationRoute[]
        const savedIds    = new Set(savedRoutes.map(r => r.id))
        const mergedRoutes = [
          ...savedRoutes,
          ...DEFAULT_MODULATION_ROUTES.filter(r => !savedIds.has(r.id)),
        ]
        return {
          ...current,
          ...p,
          // Spread DEFAULT_EFFECTS first so any fields added after the last save
          // are never undefined when VzSlider reads them.
          effects:          { ...DEFAULT_EFFECTS, ...(p.effects ?? {}) },
          effectParams:     p.effectParams ?? DEFAULT_EFFECT_PARAMS,
          presets:          [...DEFAULT_PRESETS, ...(p.presets ?? [])],
          sessions,
          modulationRoutes: mergedRoutes,
          // Merge saved layer configs over defaults so new layers added in
          // future releases always appear, and user settings are preserved.
          layerConfigs: DEFAULT_LAYER_CONFIGS.map(d => {
            const saved = (p.layerConfigs ?? [] as VzLayerConfig[]).find(c => c.id === d.id)
            if (!saved) return d
            // Spread saved over default; ensure mediaId defaults to null for configs
            // saved before that field existed (old sessions).
            return { ...d, ...saved, mediaId: saved.mediaId ?? null }
          }),
          beatGridEnabled:    p.beatGridEnabled    ?? false,
          cueMarkers:         (p.cueMarkers ?? []) as VzCueMarker[],
          autoQualityEnabled: (p as Partial<VisualState>).autoQualityEnabled ?? false,
          autoQualityMin:     (p as Partial<VisualState>).autoQualityMin     ?? 'Low',
          autoQualityMax:     (p as Partial<VisualState>).autoQualityMax     ?? 'High',
          autoQualityReason:  '',
          // Older saves without this field default to false (static canvas until user opts in)
          audioReactivityEnabled: (p as Partial<VisualState>).audioReactivityEnabled ?? false,
          // INTENTIONAL: always reset to blank canvas on launch regardless of what
          // older localStorage snapshots may contain. Do not restore these fields.
          activeMediaId:       null,
          layerItems:          [],
          selectedLayerId:         null,
          selectedLayerItemId:     null,
          selectedTimelineEntity:  null,
          // Timeline state is always reset on launch — only restored when a session
          // is explicitly loaded. timelineEnabled/Clips/Loop are not in partialize.
          // The new Phase 1A fields default to empty to support cold starts.
          timelineClips:         [] as VzTimelineMediaClip[],
          timelineOverlayClips:  [] as VzTimelineMediaClip[],
          timelineEffectRegions: [] as VzTimelineEffectRegion[],
          // videoBaselineMode and rendererType are ephemeral — always start clean.
          // rendererType is resolved from gpuPreference by LiveVisualCanvas on mount.
          videoBaselineMode:      false,
          rendererType:           'canvas2d' as const,
          rendererFallbackReason: null,
          contextLost:            false,
          gpuPreference: (p as Partial<VisualState>).gpuPreference ?? 'auto',
        }
      },
    }
  )
)
