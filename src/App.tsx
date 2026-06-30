import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage }            from './components/auth/AuthPage'
import { VyzualzView }         from './components/vyzualz/VyzualzView'
import { VyzualzErrorBoundary } from './components/vyzualz/VyzualzErrorBoundary'
import { ActiveTrackLyricsBridge } from './features/lyrics/ActiveTrackLyricsBridge'
import { useBrandKitStore } from './features/personalization/brandKitStore'
import { applyBrandAppAccent, restoreStandardAppAccent } from './features/personalization/appAccentPersonalization'
import { productionOutputController } from './components/vyzualz/react/output/ProductionOutput'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const activeBrandKit = useBrandKitStore(state => state.activeKit)

  useEffect(() => {
    applyBrandAppAccent(activeBrandKit)
    return () => restoreStandardAppAccent()
  }, [activeBrandKit])

  useEffect(() => {
    const handlePageExit = () => productionOutputController.shutdown('Application closing')
    const heartbeatTimer = window.setInterval(() => productionOutputController.heartbeat(), 500)
    window.addEventListener('beforeunload', handlePageExit)
    window.addEventListener('pagehide', handlePageExit)
    return () => {
      window.clearInterval(heartbeatTimer)
      window.removeEventListener('beforeunload', handlePageExit)
      window.removeEventListener('pagehide', handlePageExit)
      productionOutputController.shutdown('Application lifecycle disposed')
    }
  }, [])


  useEffect(() => {
    let activeUserId: string | null = null

    // Skip auth check when Supabase is not configured (dev without .env)
    if (!supabaseConfigured) {
      useBrandKitStore.getState().clearForSignedOut()
      setAuthed(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id ?? null
      activeUserId = userId
      setAuthed(Boolean(userId))
      if (userId) void useBrandKitStore.getState().initializeForUser(userId)
      else useBrandKitStore.getState().clearForSignedOut()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null
      if (activeUserId !== userId) productionOutputController.handleAuthChange()
      activeUserId = userId
      setAuthed(Boolean(userId))
      if (userId) void useBrandKitStore.getState().initializeForUser(userId)
      else useBrandKitStore.getState().clearForSignedOut()
    })

    return () => {
      subscription.unsubscribe()
      productionOutputController.shutdown('Authentication lifecycle disposed')
    }
  }, [])

  // Still checking session — render blank to avoid flash
  if (authed === null) return <div className="auth-loading"/>

  // Not authenticated — show auth gate
  if (!authed) return <AuthPage onAuth={() => setAuthed(true)}/>

  // Authenticated — VYZUALZ is the sole view
  return (
    <AudioEngineProvider>
      <ActiveTrackLyricsBridge />
      <VyzualzErrorBoundary section="VyzualzView">
        <VyzualzView activeView="vyzualz" onNavigate={() => {}} />
      </VyzualzErrorBoundary>
    </AudioEngineProvider>
  )
}
