import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { normalizeSystemSettings, type SystemSettings } from './systemSettingsTypes'

const db = supabase as unknown as SupabaseClient

export interface SystemSettingsReadResult {
  /** The settings this account has saved; empty when none (or no row yet). */
  settings: Partial<SystemSettings>
  error: string | null
}

export async function readSystemSettings(userId: string): Promise<SystemSettingsReadResult> {
  if (!supabaseConfigured) return { settings: {}, error: 'Supabase not configured' }
  const { data, error } = await db
    .from('user_settings')
    .select('system_settings')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { settings: {}, error: error.message }
  return { settings: normalizeSystemSettings((data as { system_settings?: unknown } | null)?.system_settings), error: null }
}

export async function saveSystemSettings(userId: string, settings: SystemSettings): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, system_settings: settings }, { onConflict: 'user_id' })
  return { error: error?.message ?? null }
}
