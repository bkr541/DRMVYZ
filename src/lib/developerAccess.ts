import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from './supabase'

/** Only server-managed app_metadata can grant production developer access. */
export function hasDeveloperAccess(metadata: Record<string, unknown> | undefined, development = import.meta.env.DEV): boolean {
  return development || metadata?.role === 'developer' || metadata?.is_developer === true
}

export function useDeveloperAccess(): boolean {
  const [allowed, setAllowed] = useState(() => hasDeveloperAccess(undefined))
  useEffect(() => {
    if (import.meta.env.DEV || !supabaseConfigured) return
    let alive = true
    let revision = 0
    const refresh = () => {
      const request = ++revision
      setAllowed(false)
      // Outside the auth callback: getUser may need to acquire the auth lock.
      void Promise.resolve().then(() => supabase.auth.getUser()).then(({ data, error }) => {
        if (alive && request === revision) setAllowed(!error && hasDeveloperAccess(data.user?.app_metadata))
      }).catch(() => { /* Offline/failed verification grants no production access. */ })
    }
    const { data } = supabase.auth.onAuthStateChange(refresh)
    refresh()
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return allowed
}
