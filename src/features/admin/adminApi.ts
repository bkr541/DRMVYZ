import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'

/**
 * Every Admin Console read and write. The database is the gate (public.is_admin(), migration 0056); nothing here is trusted to decide who may do what.
 * An admin's role lives in their token, so right after being granted it the first call can be refused: that one failure refreshes the session and tries again.
 */
const db = supabase as unknown as SupabaseClient

export class AdminApiError extends Error {
  constructor(message: string, readonly forbidden = false) { super(message) }
}

interface PostgrestLikeError { message: string; code?: string }
const isForbidden = (error: PostgrestLikeError) => error.code === '42501' || /admin access required|row-level security/i.test(error.message)

export async function adminRequest<T>(run: () => PromiseLike<{ data: T | null; error: PostgrestLikeError | null }>): Promise<T> {
  if (!supabaseConfigured) throw new AdminApiError('Supabase is not configured.')
  let result = await run()
  if (result.error && isForbidden(result.error)) {
    await supabase.auth.refreshSession().catch(() => undefined)
    result = await run()
  }
  if (result.error) throw new AdminApiError(result.error.message, isForbidden(result.error))
  return result.data as T
}

export { db as adminDb }
