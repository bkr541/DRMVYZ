import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage }            from './components/auth/AuthPage'
import { VyzualzView }         from './components/vyzualz/VyzualzView'
import { VyzualzErrorBoundary } from './components/vyzualz/VyzualzErrorBoundary'
import { ActiveTrackLyricsBridge } from './features/lyrics/ActiveTrackLyricsBridge'
import { useBrandKitStore } from './features/personalization/brandKitStore'
import { hexToRgb } from './features/personalization/paletteColorSpace'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const activeBrandKit = useBrandKitStore(state => state.activeKit)

  useEffect(() => {
    const root = document.documentElement
    if (!activeBrandKit?.useForAppAccent) {
      root.style.removeProperty('--az-cyan')
      root.style.removeProperty('--az-cyan-rgb')
      root.style.removeProperty('--az-cyan-dim')
      return
    }
    const accent = activeBrandKit.palette.primary
    const { r, g, b } = hexToRgb(accent)
    root.style.setProperty('--az-cyan', accent)
    root.style.setProperty('--az-cyan-rgb', `${r},${g},${b}`)
    root.style.setProperty('--az-cyan-dim', `rgba(${r},${g},${b},0.42)`)
    return () => {
      root.style.removeProperty('--az-cyan')
      root.style.removeProperty('--az-cyan-rgb')
      root.style.removeProperty('--az-cyan-dim')
    }
  }, [activeBrandKit?.id, activeBrandKit?.palette.primary, activeBrandKit?.useForAppAccent])

  useEffect(() => {
    // Skip auth check when Supabase is not configured (dev without .env)
    if (!supabaseConfigured) {
      useBrandKitStore.getState().clearForSignedOut()
      setAuthed(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id ?? null
      setAuthed(Boolean(userId))
      if (userId) void useBrandKitStore.getState().initializeForUser(userId)
      else useBrandKitStore.getState().clearForSignedOut()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null
      setAuthed(Boolean(userId))
      if (userId) void useBrandKitStore.getState().initializeForUser(userId)
      else useBrandKitStore.getState().clearForSignedOut()
    })

    return () => subscription.unsubscribe()
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
