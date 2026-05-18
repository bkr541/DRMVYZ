import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl     = (import.meta.env.VITE_SUPABASE_URL      as string | undefined) ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

// True when both vars are present — check this before making auth calls in the UI
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// createClient validates the URL format, so fall back to safe placeholders when
// the env file is absent (CI, fresh clone before .env is created, etc.).
export const supabase = createClient<Database>(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)

export type { Database }
