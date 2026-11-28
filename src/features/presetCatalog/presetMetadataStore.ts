import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { indexPresetMetadata, type PresetMetadataRow } from './presetMetadata'
import { presetAvailabilityFor, type PresetAvailability } from './presetAvailability'

// The admin's preset metadata as every signed-in user reads it (migration 0056: readable by all, writable by admins). Signed out, unconfigured or failing
// to load, it stays empty and every preset shows what the app ships.

const db = supabase as unknown as SupabaseClient

interface PresetMetadataState {
  status: 'idle' | 'loading' | 'ready'
  rows: readonly PresetMetadataRow[]
  index: ReadonlyMap<string, PresetMetadataRow>
  /** Admins also see and use Designing and Draft presets. Set from the verified admin check; false until then. */
  viewerIsAdmin: boolean
  setViewerIsAdmin: (isAdmin: boolean) => void
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
  viewerIsAdmin: false,
  setViewerIsAdmin: viewerIsAdmin => { if (get().viewerIsAdmin !== viewerIsAdmin) set({ viewerIsAdmin }) },
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
      // Keep the last metadata that loaded: an offline refresh must not bring back presets an admin switched off or has not released.
      set({ status: 'ready' })
    }
  },
}))

/** Whether the signed-in user may see and use a preset right now (outside React). */
export function getPresetAvailability(appEngineId: string, presetKey: string): PresetAvailability {
  const { index, viewerIsAdmin } = usePresetMetadataStore.getState()
  return presetAvailabilityFor(index, appEngineId, presetKey, viewerIsAdmin)
}

/** A predicate for lists: is this preset of `appEngineId` shown to the signed-in user? */
export function usePresetListedFilter(appEngineId: string): (presetKey: string) => boolean {
  const index = usePresetMetadataStore(state => state.index)
  const viewerIsAdmin = usePresetMetadataStore(state => state.viewerIsAdmin)
  return useMemo(() => (presetKey: string) => presetAvailabilityFor(index, appEngineId, presetKey, viewerIsAdmin).listed, [index, viewerIsAdmin, appEngineId])
}

const REFRESH_INTERVAL_MS = 5 * 60_000
const REFRESH_MIN_GAP_MS = 30_000

/**
 * Keeps the metadata current while the app is open, so an admin's change (an off switch above all) reaches every app within minutes without a new
 * build: on focus, on reconnect and every five minutes while visible. Returns a stop function.
 */
export function startPresetMetadataRefresh(): () => void {
  let last = Date.now()
  const refresh = () => {
    if (Date.now() - last < REFRESH_MIN_GAP_MS) return
    last = Date.now()
    void usePresetMetadataStore.getState().load()
  }
  void usePresetMetadataStore.getState().load()
  const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
  window.addEventListener('focus', refresh)
  window.addEventListener('online', refresh)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(() => { if (document.visibilityState === 'visible') { last = 0; refresh() } }, REFRESH_INTERVAL_MS)
  return () => {
    window.removeEventListener('focus', refresh)
    window.removeEventListener('online', refresh)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}

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
