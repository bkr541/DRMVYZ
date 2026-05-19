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
}

// Default scope for a lightweight "look" preset (effects only, backward-compat)
export const LOOK_SCOPE: PresetScope = { effects: true, enabledFx: true }

// Scope that captures the full performance scene
export const SCENE_SCOPE: PresetScope = {
  effects: true, enabledFx: true, modulation: true,
  activeMedia: true, mediaOrder: true, audioSource: true,
  bpm: true, bpmSync: true, quality: true,
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

  // Optional scene fields — only present when the matching scope flag is true
  modulationRoutes?: ModulationRoute[]
  activeMediaId?: string | null
  mediaOrder?: string[]
  audioSource?: 'file' | 'microphone' | 'demo'
  bpm?: number
  bpmSync?: boolean
  quality?: Quality
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
  // Timing
  bpm: number
  bpmSync: boolean
  // Output
  quality: Quality
  audioSource: 'file' | 'microphone' | 'demo'
}

export const DEFAULT_PRESETS: VzPreset[] = [
  {
    id: 'dream-theft',
    name: 'Dream Theft',
    color: '#19bff2',
    gradient: 'linear-gradient(135deg,#0a1830 0%,#0a3a55 60%,#19bff2 100%)',
    effects: { ...DEFAULT_EFFECTS, rgbSplit: 0.3, bloom: 0.6, feedbackTrails: 0.2 },
    enabledFx: ['RGB Split', 'Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'nightmare-signal',
    name: 'Nightmare Signal',
    color: '#e11d48',
    gradient: 'linear-gradient(135deg,#1a0010 0%,#550020 60%,#e11d48 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0.8, rgbSplit: 0.7, strobe: 0.4, feedbackTrails: 0.5 },
    enabledFx: ['Glitch Bars', 'RGB Split', 'Scanlines', 'Feedback'],
    isDefault: true,
  },
  {
    id: 'boss-intro',
    name: 'Boss Intro',
    color: '#f97316',
    gradient: 'linear-gradient(135deg,#1a0800 0%,#7a2000 60%,#f97316 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, bloom: 0.9, displacement: 0.6, tunnelSpeed: 0.8 },
    enabledFx: ['Tunnel', 'Bloom', 'Displacement'],
    isDefault: true,
  },
  {
    id: 'drmwld-portal',
    name: 'DRMWLD Portal',
    color: '#a855f7',
    gradient: 'linear-gradient(135deg,#150020 0%,#5a0090 60%,#a855f7 100%)',
    effects: { ...DEFAULT_EFFECTS, colorShift: 0.6, bloom: 0.7, feedbackTrails: 0.4, tunnelSpeed: 0.5 },
    enabledFx: ['Tunnel', 'Bloom', 'RGB Split'],
    isDefault: true,
  },
  {
    id: 'cyber-bloom',
    name: 'Cyber Bloom',
    color: '#2edcb3',
    gradient: 'linear-gradient(135deg,#001520 0%,#004a40 60%,#2edcb3 100%)',
    effects: { ...DEFAULT_EFFECTS, bloom: 1.0, rgbSplit: 0.2, masterIntensity: 1.0 },
    enabledFx: ['Bloom', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'bass-impact',
    name: 'Bass Impact',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg,#1a1200 0%,#604000 60%,#fbbf24 100%)',
    effects: { ...DEFAULT_EFFECTS, bassReactivity: 1.0, strobe: 0.6, glitchAmount: 0.3, displacement: 0.4 },
    enabledFx: ['Glitch Bars', 'Displacement', 'Scanlines'],
    isDefault: true,
  },
  {
    id: 'clean-reactive',
    name: 'Clean Audio Reactive',
    color: '#94a3b8',
    gradient: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#475569 100%)',
    effects: { ...DEFAULT_EFFECTS, glitchAmount: 0, rgbSplit: 0, strobe: 0, feedbackTrails: 0, bloom: 0.2 },
    enabledFx: ['Scanlines'],
    isDefault: true,
  },
]

// ── Store interface ───────────────────────────────────────────────────────────

interface VisualState {
  // Live performance state
  effects: VzEffects
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
  resetEffects(): void
  toggleFx(name: string): void
  setActiveMedia(id: string | null): void
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
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useVisualStore = create<VisualState>()(
  persist(
    (set, get) => ({
      effects:           DEFAULT_PRESETS[0].effects,
      enabledFxArr:      DEFAULT_PRESETS[0].enabledFx,
      activePresetId:    DEFAULT_PRESETS[0].id,
      activeMediaId:     null,
      bpm:               120,
      bpmSync:           false,
      isPlaying:         false,
      quality:           'High',
      presets:           DEFAULT_PRESETS,
      sessions:          [],
      sessionsLoading:   false,
      sessionSyncError:  null,
      modulationRoutes:  DEFAULT_MODULATION_ROUTES,

      // ── Live state ──────────────────────────────────────────────────────────

      setEffect(key, v) {
        set(s => ({ effects: { ...s.effects, [key]: v }, activePresetId: 'custom' }))
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
        if (scope.effects)   patch.effects       = { ...preset.effects }
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
          color:    '#19bff2',
          gradient: 'linear-gradient(135deg,#0a1830 0%,#0a3a55 60%,#19bff2 100%)',
          scope,
          // Visual look always saved
          effects:   { ...effects },
          enabledFx: [...enabledFxArr],
        }
        if (scope.modulation)  newPreset.modulationRoutes = modulationRoutes.map(r => ({ ...r }))
        if (scope.activeMedia) newPreset.activeMediaId    = activeMediaId
        if (scope.mediaOrder && opts?.mediaOrder) newPreset.mediaOrder = [...opts.mediaOrder]
        if (scope.audioSource && opts?.audioSource) newPreset.audioSource = opts.audioSource
        if (scope.bpm)     newPreset.bpm     = bpm
        if (scope.bpmSync) newPreset.bpmSync = bpmSync
        if (scope.quality) newPreset.quality = quality
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
          bpm:           s.bpm,
          bpmSync:       s.bpmSync,
          quality:       s.quality,
          audioSource,
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
          activeMediaId:  session.activeMediaId,
          activePresetId: session.activePresetId,
          effects:        { ...session.effects },
          enabledFxArr:   [...session.enabledFx],
          bpm:            session.bpm,
          bpmSync:        session.bpmSync,
          quality:        session.quality,
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
    }),
    {
      name: 'drmvyz-visual-store',
      partialize: (s) => ({
        effects:           s.effects,
        enabledFxArr:      s.enabledFxArr,
        activePresetId:    s.activePresetId,
        activeMediaId:     s.activeMediaId,
        presets:           s.presets.filter(p => !p.isDefault),
        sessions:          s.sessions,
        bpm:               s.bpm,
        bpmSync:           s.bpmSync,
        quality:           s.quality,
        modulationRoutes:  s.modulationRoutes,
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
          presets:          [...DEFAULT_PRESETS, ...(p.presets ?? [])],
          sessions,
          modulationRoutes: mergedRoutes,
        }
      },
    }
  )
)
