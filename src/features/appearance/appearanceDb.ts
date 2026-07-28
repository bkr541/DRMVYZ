import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { isAppearanceTheme, normalizeAppearanceTheme, type AppearanceTheme } from './appearanceTypes'

const db = supabase as unknown as SupabaseClient

export interface AppearanceThemeRecord {
  theme: AppearanceTheme
  updatedAt: string | null
}

export interface AppearanceThemeReadResult {
  record: AppearanceThemeRecord | null
  error: string | null
}

export interface AppearanceThemeWriteResult {
  record: AppearanceThemeRecord | null
  error: string | null
}

export async function readAppearanceTheme(userId: string): Promise<AppearanceThemeReadResult> {
  if (!supabaseConfigured) return { record: null, error: 'Supabase not configured' }

  const { data, error } = await db
    .from('user_settings')
    .select('theme, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { record: null, error: error.message }
  if (!data) return { record: null, error: null }

  const raw = data as { theme?: unknown; updated_at?: unknown }
  return {
    record: {
      theme: isAppearanceTheme(raw.theme) ? raw.theme : normalizeAppearanceTheme(raw.theme),
      updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    },
    error: null,
  }
}

export async function saveAppearanceTheme(
  userId: string,
  theme: AppearanceTheme,
): Promise<AppearanceThemeWriteResult> {
  if (!supabaseConfigured) return { record: null, error: 'Supabase not configured' }

  const { data, error } = await db
    .from('user_settings')
    .upsert({ user_id: userId, theme }, { onConflict: 'user_id' })
    .select('theme, updated_at')
    .single()

  if (error) return { record: null, error: error.message }

  const raw = data as { theme?: unknown; updated_at?: unknown }
  return {
    record: {
      theme: normalizeAppearanceTheme(raw.theme),
      updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    },
    error: null,
  }
}
