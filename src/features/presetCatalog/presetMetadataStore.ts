import { useEffect } from 'react'
import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { indexPresetMetadata, type PresetMetadataRow } from './presetMetadata'

// The admin's preset metadata as every signed-in user reads it (migration 0056: readable by all, writable by admins). Signed out, unconfigured or failing
// to load, it stays empty and every preset shows what the app ships.

const db = supabase as unknown as SupabaseClient

interface PresetMetadataState {
  status: 'idle' | 'loading' | 'ready'
  rows: readonly PresetMetadataRow[]
  index: ReadonlyMap<string, PresetMetadataRow>
  load: () => Promise<void>
  /** The admin console writes through its own api, then hands the rows here so the app shows them at once. */
  setRows: (rows: readonly PresetMetadataRow[]) => void
}

const EMPTY: ReadonlyMap<string, PresetMetadataRow> = new Map()
let authSubscribed = false

export const usePresetMetadataStore = create<PresetMetadataState>((set, get) => ({
  status: 'idle',
  rows: [],
  index: EMPTY,
  setRows: rows => set({ rows, index: indexPresetMetadata(rows), status: 'ready' }),
  load: async () => {
    if (!supabaseConfigured) { set({ status: 'ready' }); return }
    if (get().status === 'loading') return
    set({ status: 'loading' })
    try {
      const { data, error } = await db.from('preset_catalog_metadata').select('*')
      if (error) throw error
      const rows = (data as PresetMetadataRow[] | null) ?? []
      set({ rows, index: indexPresetMetadata(rows), status: 'ready' })
    } catch {
      set({ rows: [], index: EMPTY, status: 'ready' })
    }
  },
}))

/** Loads the metadata once, and again when the signed-in user changes. Returns the index to apply with applyPresetMetadata. */
export function usePresetMetadata(): ReadonlyMap<string, PresetMetadataRow> {
  useEffect(() => {
    const store = usePresetMetadataStore.getState()
    if (store.status === 'idle') void store.load()
    if (authSubscribed || !supabaseConfigured) return
    authSubscribed = true
    supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void usePresetMetadataStore.getState().load()
    })
  }, [])
  return usePresetMetadataStore(state => state.index)
}
