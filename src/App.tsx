import { lazy, Suspense, useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage }            from './components/auth/AuthPage'
import { VyzualzErrorBoundary } from './components/vyzualz/VyzualzErrorBoundary'
import { ActiveTrackLyricsBridge } from './features/lyrics/ActiveTrackLyricsBridge'
import { useBrandKitStore } from './features/personalization/brandKitStore'
import { applyBrandAppAccent, restoreStandardAppAccent } from './features/personalization/appAccentPersonalization'
import { productionOutputController } from './components/vyzualz/react/output/ProductionOutput'
import { startPixGridDeckCompilerRuntime } from './components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { useMediaStore } from './stores/mediaStore'
import { useAppearanceStore } from './features/appearance/appearanceStore'
import './stores/mediaDeletionGuardBootstrap'

const VyzualzView = lazy(() =>
  import('./components/vyzualz/VyzualzView').then(module => ({ default: module.VyzualzView })),
)

type AuthGateState = 'checking' | 'configuration-required' | 'signed-out' | 'authenticated'

export default function App() {
  const [authGate, setAuthGate] = useState<AuthGateState>(() =>
    supabaseConfigured ? 'checking' : 'configuration-required',
  )
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
    if (authGate !== 'authenticated') return
    return startPixGridDeckCompilerRuntime()
  }, [authGate])

  useEffect(() => {
    let activeUserId: string | null = null

    // Unconfigured environments get an explicit configuration gate. Authentication
    // is never bypassed, including local and packaged production builds.
    if (!supabaseConfigured) {
      useBrandKitStore.getState().clearForSignedOut()
      useAppearanceStore.getState().clearForSignedOut()
      useMediaStore.getState().clear()
      setAuthGate('configuration-required')
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id ?? null
      activeUserId = userId
      useMediaStore.getState().clear()
      setAuthGate(userId ? 'authenticated' : 'signed-out')
      if (userId) {
        void useBrandKitStore.getState().initializeForUser(userId)
        void useAppearanceStore.getState().initializeForUser(userId)
      } else {
        useBrandKitStore.getState().clearForSignedOut()
        useAppearanceStore.getState().clearForSignedOut()
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null
      if (activeUserId !== userId) {
        productionOutputController.handleAuthChange()
        useMediaStore.getState().clear()
      }
      activeUserId = userId
      setAuthGate(userId ? 'authenticated' : 'signed-out')
      if (userId) {
        void useBrandKitStore.getState().initializeForUser(userId)
        void useAppearanceStore.getState().initializeForUser(userId)
      } else {
        useBrandKitStore.getState().clearForSignedOut()
        useAppearanceStore.getState().clearForSignedOut()
      }
    })

    return () => {
      subscription.unsubscribe()
      productionOutputController.shutdown('Authentication lifecycle disposed')
    }
  }, [])

  // Still checking session — render blank to avoid flash
  if (authGate === 'checking') return <div className="auth-loading" role="status" aria-label="Checking authentication" />

  // Not authenticated — show auth gate
  if (authGate !== 'authenticated') {
    return <AuthPage onAuth={() => setAuthGate('authenticated')} />
  }

  // Authenticated — VYZUALZ is the sole view
  return (
    <AudioEngineProvider>
      <ActiveTrackLyricsBridge />
      <VyzualzErrorBoundary section="VyzualzView">
        <Suspense fallback={<div className="auth-loading" role="status" aria-label="Loading DRMVYZ" />}>
          <VyzualzView activeView="vyzualz" onNavigate={() => {}} />
        </Suspense>
      </VyzualzErrorBoundary>
    </AudioEngineProvider>
  )
}
