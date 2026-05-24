// Narrow typed helper for reading the shared effect_chain_options catalog.
// Same pattern as sessionDb.ts / mediaDb.ts — isolates the controlled cast,
// returns typed results. Catalog is read-only from the client; only
// service_role / migrations may write.

import { supabase, supabaseConfigured } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EffectChainOptionRow } from '../types/database'

const db = supabase as unknown as SupabaseClient

export async function dbListEffectChainOptions(): Promise<{
  options: EffectChainOptionRow[]
  error: string | null
}> {
  if (!supabaseConfigured) return { options: [], error: 'Supabase not configured' }

  const { data, error } = await db
    .from('effect_chain_options')
    .select('id, chain_name, effect_key, description, category, control_group, sort_order, is_available, created_at, updated_at')
    .eq('is_available', true)
    .order('sort_order', { ascending: true })

  if (error) return { options: [], error: (error as { message: string }).message }
  return { options: (data as EffectChainOptionRow[] | null) ?? [], error: null }
}
