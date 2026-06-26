import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ShaderDefinition, ShaderParamValues } from '../registry/shaderRegistryTypes'
import type { QualityTierWithAuto } from '../performance/shaderPerformanceTypes'
import { shaderRegistry } from '../registry'
import { ShaderDefinitionValidator } from '../registry/ShaderDefinitionValidator'

// ── User scene entry ──────────────────────────────────────────────────────────

export interface UserSceneEntry {
  definition:  ShaderDefinition
  createdAt:   string  // ISO 8601
  updatedAt:   string  // ISO 8601
}

// ── User preset (shader-engine only) ─────────────────────────────────────────

export interface ShaderPreset {
  id:         string
  name:       string
  sceneId:    string
  values:     ShaderParamValues
  createdAt:  string
}

// ── Editor preferences ────────────────────────────────────────────────────────

export interface ShaderEditorPreferences {
  autoCompile:        boolean
  autoCompileDelayMs: number
  showLineNumbers:    boolean
  fontSize:           number
}

const DEFAULT_EDITOR_PREFS: ShaderEditorPreferences = {
  autoCompile:        false,
  autoCompileDelayMs: 1000,
  showLineNumbers:    true,
  fontSize:           13,
}

// ── Persisted state ───────────────────────────────────────────────────────────

interface ShaderLibraryPersistedState {
  userScenes:        Record<string, UserSceneEntry>  // keyed by scene id
  favorites:         string[]                        // array of scene ids
  collections:       Record<string, string[]>        // name → scene id array
  recentlyUsed:      string[]                        // newest first, max 30
  shaderPresets:     Record<string, ShaderPreset>    // keyed by preset id
  qualityPreference: QualityTierWithAuto
  editorPreferences: ShaderEditorPreferences
  thumbnailCache:    string[]                        // scene ids with cached thumbnails
}

// ── Full store state ──────────────────────────────────────────────────────────

interface ShaderLibraryState extends ShaderLibraryPersistedState {
  // ── Computed helpers ──────────────────────────────────────────────────────
  getUserSceneMap():       ReadonlyMap<string, ShaderDefinition>
  getFavoritesSet():       ReadonlySet<string>
  getCollectionsMap():     ReadonlyMap<string, ReadonlySet<string>>
  getThumbnailsSet():      ReadonlySet<string>

  // ── User scene CRUD ───────────────────────────────────────────────────────
  addUserScene(def: ShaderDefinition): { ok: true } | { ok: false; error: string }
  updateUserScene(id: string, def: ShaderDefinition): { ok: true } | { ok: false; error: string }
  deleteUserScene(id: string): void
  renameUserScene(id: string, name: string): void
  duplicateScene(sourceId: string): { ok: true; newId: string } | { ok: false; error: string }

  // ── Favorites ─────────────────────────────────────────────────────────────
  setFavorite(id: string, fav: boolean): void
  toggleFavorite(id: string): void

  // ── Collections ───────────────────────────────────────────────────────────
  createCollection(name: string): void
  deleteCollection(name: string): void
  renameCollection(oldName: string, newName: string): void
  addToCollection(name: string, id: string): void
  removeFromCollection(name: string, id: string): void

  // ── Recently used ─────────────────────────────────────────────────────────
  markUsed(id: string): void

  // ── Presets ───────────────────────────────────────────────────────────────
  savePreset(name: string, sceneId: string, values: ShaderParamValues): ShaderPreset
  deletePreset(presetId: string): void
  getPresetsForScene(sceneId: string): ShaderPreset[]

  // ── Quality & editor ──────────────────────────────────────────────────────
  setQualityPreference(tier: QualityTierWithAuto): void
  setEditorPreferences(prefs: Partial<ShaderEditorPreferences>): void

  // ── Thumbnail cache ───────────────────────────────────────────────────────
  markThumbnailCached(id: string): void
  clearThumbnailCache(id?: string): void
}

// ── User scene ID namespace ───────────────────────────────────────────────────

const USER_SCENE_PREFIX = 'user-shader-'
const MAX_RECENTLY_USED = 30

function generateUserSceneId(): string {
  return `${USER_SCENE_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function generatePresetId(): string {
  return `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useShaderLibraryStore = create<ShaderLibraryState>()(
  persist(
    (set, get) => ({
      // ── Initial persisted state ──────────────────────────────────────────
      userScenes:        {},
      favorites:         [],
      collections:       {},
      recentlyUsed:      [],
      shaderPresets:     {},
      qualityPreference: 'auto',
      editorPreferences: { ...DEFAULT_EDITOR_PREFS },
      thumbnailCache:    [],

      // ── Computed helpers ─────────────────────────────────────────────────
      getUserSceneMap() {
        const map = new Map<string, ShaderDefinition>()
        for (const entry of Object.values(get().userScenes)) {
          map.set(entry.definition.id, entry.definition)
        }
        return map
      },

      getFavoritesSet() {
        return new Set(get().favorites)
      },

      getCollectionsMap() {
        const map = new Map<string, ReadonlySet<string>>()
        for (const [name, ids] of Object.entries(get().collections)) {
          map.set(name, new Set(ids))
        }
        return map
      },

      getThumbnailsSet() {
        return new Set(get().thumbnailCache)
      },

      // ── User scene CRUD ──────────────────────────────────────────────────
      addUserScene(def) {
        // Reject bundled ID collisions
        if (shaderRegistry.has(def.id)) {
          return { ok: false, error: `Scene ID "${def.id}" conflicts with a bundled scene` }
        }
        // Reject user ID collisions
        if (get().userScenes[def.id]) {
          return { ok: false, error: `Scene ID "${def.id}" already exists` }
        }
        // Validate the definition
        const validation = ShaderDefinitionValidator.validate(def)
        if (!validation.valid) {
          return { ok: false, error: validation.errors.map(e => e.message).join('; ') }
        }

        const now = new Date().toISOString()
        set(s => ({
          userScenes: {
            ...s.userScenes,
            [def.id]: { definition: def, createdAt: now, updatedAt: now },
          },
        }))
        return { ok: true }
      },

      updateUserScene(id, def) {
        if (!get().userScenes[id]) {
          return { ok: false, error: `User scene "${id}" not found` }
        }
        if (def.id !== id) {
          return { ok: false, error: 'Cannot change scene ID via updateUserScene' }
        }
        const validation = ShaderDefinitionValidator.validate(def)
        if (!validation.valid) {
          return { ok: false, error: validation.errors.map(e => e.message).join('; ') }
        }
        set(s => ({
          userScenes: {
            ...s.userScenes,
            [id]: { ...s.userScenes[id], definition: def, updatedAt: new Date().toISOString() },
          },
        }))
        return { ok: true }
      },

      deleteUserScene(id) {
        set(s => {
          const { [id]: _removed, ...rest } = s.userScenes
          return {
            userScenes: rest,
            favorites: s.favorites.filter(f => f !== id),
            recentlyUsed: s.recentlyUsed.filter(r => r !== id),
            collections: Object.fromEntries(
              Object.entries(s.collections).map(([n, ids]) => [n, ids.filter(i => i !== id)])
            ),
          }
        })
      },

      renameUserScene(id, name) {
        const entry = get().userScenes[id]
        if (!entry || !name.trim()) return
        const updated: ShaderDefinition = { ...entry.definition, name: name.trim() }
        set(s => ({
          userScenes: {
            ...s.userScenes,
            [id]: { ...s.userScenes[id], definition: updated, updatedAt: new Date().toISOString() },
          },
        }))
      },

      duplicateScene(sourceId) {
        // Find source in bundled or user scenes
        const source = shaderRegistry.get(sourceId) ?? get().userScenes[sourceId]?.definition
        if (!source) return { ok: false, error: `Scene "${sourceId}" not found` }

        const newId   = generateUserSceneId()
        const newName = `${source.name} (copy)`
        const newDef: ShaderDefinition = { ...source, id: newId, name: newName }

        const result = get().addUserScene(newDef)
        if (!result.ok) return result
        return { ok: true, newId }
      },

      // ── Favorites ────────────────────────────────────────────────────────
      setFavorite(id, fav) {
        set(s => ({
          favorites: fav
            ? s.favorites.includes(id) ? s.favorites : [...s.favorites, id]
            : s.favorites.filter(f => f !== id),
        }))
      },

      toggleFavorite(id) {
        get().setFavorite(id, !get().favorites.includes(id))
      },

      // ── Collections ──────────────────────────────────────────────────────
      createCollection(name) {
        const n = name.trim()
        if (!n || get().collections[n]) return
        set(s => ({ collections: { ...s.collections, [n]: [] } }))
      },

      deleteCollection(name) {
        set(s => {
          const { [name]: _removed, ...rest } = s.collections
          return { collections: rest }
        })
      },

      renameCollection(oldName, newName) {
        const n = newName.trim()
        if (!n || oldName === n) return
        set(s => {
          const ids = s.collections[oldName] ?? []
          const { [oldName]: _removed, ...rest } = s.collections
          return { collections: { ...rest, [n]: ids } }
        })
      },

      addToCollection(name, id) {
        set(s => {
          const ids = s.collections[name] ?? []
          if (ids.includes(id)) return s
          return { collections: { ...s.collections, [name]: [...ids, id] } }
        })
      },

      removeFromCollection(name, id) {
        set(s => ({
          collections: {
            ...s.collections,
            [name]: (s.collections[name] ?? []).filter(i => i !== id),
          },
        }))
      },

      // ── Recently used ─────────────────────────────────────────────────────
      markUsed(id) {
        set(s => {
          const filtered = s.recentlyUsed.filter(r => r !== id)
          return { recentlyUsed: [id, ...filtered].slice(0, MAX_RECENTLY_USED) }
        })
      },

      // ── Presets ───────────────────────────────────────────────────────────
      savePreset(name, sceneId, values) {
        const preset: ShaderPreset = {
          id:        generatePresetId(),
          name:      name.trim() || 'Unnamed Preset',
          sceneId,
          values,
          createdAt: new Date().toISOString(),
        }
        set(s => ({ shaderPresets: { ...s.shaderPresets, [preset.id]: preset } }))
        return preset
      },

      deletePreset(presetId) {
        set(s => {
          const { [presetId]: _removed, ...rest } = s.shaderPresets
          return { shaderPresets: rest }
        })
      },

      getPresetsForScene(sceneId) {
        return Object.values(get().shaderPresets).filter(p => p.sceneId === sceneId)
      },

      // ── Quality & editor ──────────────────────────────────────────────────
      setQualityPreference(tier) {
        set({ qualityPreference: tier })
      },

      setEditorPreferences(prefs) {
        set(s => ({ editorPreferences: { ...s.editorPreferences, ...prefs } }))
      },

      // ── Thumbnail cache ───────────────────────────────────────────────────
      markThumbnailCached(id) {
        set(s => ({
          thumbnailCache: s.thumbnailCache.includes(id)
            ? s.thumbnailCache
            : [...s.thumbnailCache, id],
        }))
      },

      clearThumbnailCache(id) {
        set(s => ({
          thumbnailCache: id
            ? s.thumbnailCache.filter(i => i !== id)
            : [],
        }))
      },
    }),
    {
      name:    'drmvyz:shader-library',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Never persist any WebGL objects or runtime state — only POJO data.
      partialize: (s): ShaderLibraryPersistedState => ({
        userScenes:        s.userScenes,
        favorites:         s.favorites,
        collections:       s.collections,
        recentlyUsed:      s.recentlyUsed,
        shaderPresets:     s.shaderPresets,
        qualityPreference: s.qualityPreference,
        editorPreferences: s.editorPreferences,
        thumbnailCache:    s.thumbnailCache,
      }),
    },
  ),
)

export { USER_SCENE_PREFIX }
