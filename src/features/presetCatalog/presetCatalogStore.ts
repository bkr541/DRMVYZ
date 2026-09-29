import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import {
  EMPTY_PRESET_CATALOG,
  createPresetScopeFilter,
  type PresetCatalogEntry,
  type PresetCatalogSnapshot,
  type PresetScopeTab,
} from './presetScope'

// The preset catalog as the signed-in user sees it: every catalog row (`presets`) and the ones they hold (`user_presets`). Both are read-only from
// the client; see migrations 0034 and 0035. Signed out, unconfigured or failing to load, the snapshot stays empty, so every preset is a system
// preset and the app behaves as it did before the catalog existed.

const db = supabase as unknown as SupabaseClient

interface PresetCatalogState extends PresetCatalogSnapshot {
  status: 'idle' | 'loading' | 'ready'
  load: () => Promise<void>
}

let authSubscribed = false

export const usePresetCatalogStore = create<PresetCatalogState>((set, get) => ({
  ...EMPTY_PRESET_CATALOG,
  status: 'idle',
  load: async () => {
    if (!supabaseConfigured) {
      set({ ...EMPTY_PRESET_CATALOG, status: 'ready' })
      return
    }
    if (get().status === 'loading') return
    set({ status: 'loading' })
    try {
      const [catalog, held] = await Promise.all([
        db.from('presets').select('id, engine_id, preset_key, scope'),
        db.from('user_presets').select('preset_id'),
      ])
      if (catalog.error || held.error) throw catalog.error ?? held.error
      set({
        entries: (catalog.data as PresetCatalogEntry[] | null) ?? [],
        heldPresetIds: ((held.data as { preset_id: string }[] | null) ?? []).map(row => row.preset_id),
        status: 'ready',
      })
    } catch {
      set({ ...EMPTY_PRESET_CATALOG, status: 'ready' })
    }
  },
}))

/** Loads the catalog once, and again whenever the signed-in user changes (holdings are per user). */
function ensureCatalogLoaded() {
  const store = usePresetCatalogStore.getState()
  if (store.status === 'idle') void store.load()
  if (authSubscribed || !supabaseConfigured) return
  authSubscribed = true
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void usePresetCatalogStore.getState().load()
  })
}

/** For a Presets tab: a filter that keeps the presets belonging under `tab` for `engineId`. Keys are each engine's own preset ids. */
export function usePresetScopeFilter(engineId: string, tab: PresetScopeTab): (presetKey: string) => boolean {
  useEffect(ensureCatalogLoaded, [])
  const entries = usePresetCatalogStore(state => state.entries)
  const heldPresetIds = usePresetCatalogStore(state => state.heldPresetIds)
  return useMemo(() => createPresetScopeFilter({ entries, heldPresetIds }, engineId, tab), [entries, heldPresetIds, engineId, tab])
}
