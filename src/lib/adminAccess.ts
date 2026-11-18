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

/** True only once the signed-in user has been verified with the server as an admin; false while checking, offline, signed out or on any error. */
export function useAdminAccess(): boolean {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    let revision = 0
    const refresh = () => {
      const request = ++revision
      setAllowed(false)
      // Outside the auth callback: getUser may need to acquire the auth lock.
      void Promise.resolve().then(() => supabase.auth.getUser()).then(({ data, error }) => {
        if (alive && request === revision) setAllowed(!error && hasAdminAccess(data.user?.app_metadata))
      }).catch(() => { /* Offline or failed verification grants no access. */ })
    }
    const { data } = supabase.auth.onAuthStateChange(refresh)
    refresh()
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return allowed
}
