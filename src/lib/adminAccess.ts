import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'

/**
 * Admin access is granted only by server-managed `app_metadata` (the signed-in user cannot edit it), never by `user_metadata`, a profile column
 * or an email address. Unlike developer access there is no development-build bypass: the same check runs everywhere, so what you see in development
 * is what an admin sees in production. This only decides what the interface shows; every admin read and write must still be enforced on the server.
 */
export function hasAdminAccess(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.role === 'admin' || metadata?.is_admin === true
}

export type AdminAccessStatus = 'checking' | 'granted' | 'denied'

/**
 * Where the check stands. `granted` only once the signed-in user has been verified with the server as an admin; `denied` when they are not, when signed
 * out, offline or on any error; `checking` while the first answer is on its way. Supabase fires auth events often (token refreshes, the window regaining
 * focus), and each one re-verifies. A verified admin stays `granted` through that routine re-check instead of dropping to "no access" for a moment, which
 * used to pull the Admin page out from under them; only the answer, or a sign-out, can take access away.
 */
export function useAdminAccessStatus(): AdminAccessStatus {
  const [status, setStatus] = useState<AdminAccessStatus>(supabaseConfigured ? 'checking' : 'denied')
  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    let revision = 0
    const refresh = (event?: string) => {
      const request = ++revision
      setStatus(current => event === 'SIGNED_OUT' ? 'denied' : current === 'granted' ? 'granted' : 'checking')
      // Outside the auth callback: getUser may need to acquire the auth lock.
      void Promise.resolve().then(() => supabase.auth.getUser()).then(({ data, error }) => {
        if (alive && request === revision) setStatus(!error && hasAdminAccess(data.user?.app_metadata) ? 'granted' : 'denied')
      }).catch(() => { /* Offline or failed verification grants no access. */
        if (alive && request === revision) setStatus('denied')
      })
    }
    const { data } = supabase.auth.onAuthStateChange(event => refresh(event))
    refresh()
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return status
}

/** True only while the signed-in user is verified as an admin. */
export function useAdminAccess(): boolean {
  return useAdminAccessStatus() === 'granted'
}
