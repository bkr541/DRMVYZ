import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const db = supabase as unknown as SupabaseClient

export interface ContextualHelpPreferenceRecord {
  infoEnabled: boolean
  updatedAt: string | null
}

export interface ContextualHelpPreferenceReadResult {
  record: ContextualHelpPreferenceRecord | null
  error: string | null
}

export interface ContextualHelpPreferenceWriteResult {
  record: ContextualHelpPreferenceRecord | null
  error: string | null
}

export async function readContextualHelpPreference(
  userId: string,
): Promise<ContextualHelpPreferenceReadResult> {
  if (!supabaseConfigured) return { record: null, error: 'Supabase not configured' }

  const { data, error } = await db
    .from('user_settings')
    .select('info_enabled, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { record: null, error: error.message }
  if (!data) return { record: null, error: null }

  const raw = data as { info_enabled?: unknown; updated_at?: unknown }
  return {
    record: {
      infoEnabled: typeof raw.info_enabled === 'boolean' ? raw.info_enabled : true,
      updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    },
    error: null,
  }
}

export async function saveContextualHelpPreference(
  userId: string,
  infoEnabled: boolean,
): Promise<ContextualHelpPreferenceWriteResult> {
  if (!supabaseConfigured) return { record: null, error: 'Supabase not configured' }

  const { data, error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, info_enabled: infoEnabled }, { onConflict: 'user_id' })
    .select('info_enabled, updated_at')
    .single()

  if (error) return { record: null, error: error.message }

  const raw = data as { info_enabled?: unknown; updated_at?: unknown }
  return {
    record: {
      infoEnabled: typeof raw.info_enabled === 'boolean' ? raw.info_enabled : infoEnabled,
      updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    },
    error: null,
  }
}
