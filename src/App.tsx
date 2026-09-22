import { lazy, Suspense, useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { peekCachedSessionUserId, isNetworkAuthError } from './lib/offlineSessionFallback'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage, ResetPasswordCompletionScreen } from './components/auth/AuthPage'
import { VyzualzErrorBoundary } from './components/vyzualz/VyzualzErrorBoundary'
import { ActiveTrackLyricsBridge } from './features/lyrics/ActiveTrackLyricsBridge'
import { useBrandKitStore } from './features/personalization/brandKitStore'
import { applyBrandAppAccent, restoreStandardAppAccent } from './features/personalization/appAccentPersonalization'
import { productionOutputController } from './components/vyzualz/react/output/ProductionOutput'
import { startPixGridDeckCompilerRuntime } from './components/vyzualz/react/pixGrid/PixGridDeckCompilerRuntime'
import { useMediaStore } from './stores/mediaStore'
import { useAppearanceStore } from './features/appearance/appearanceStore'
import { useContextualHelpStore } from './features/contextualHelp/contextualHelpStore'
import './stores/mediaDeletionGuardBootstrap'

const VyzualzView = lazy(() =>
  import('./components/vyzualz/VyzualzView').then(module => ({ default: module.VyzualzView })),
)

type AuthGateState = 'checking' | 'configuration-required' | 'signed-out' | 'authenticated' | 'password-recovery'

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

    function activateUser(userId: string) {
      activeUserId = userId
      setAuthGate('authenticated')
      void useBrandKitStore.getState().initializeForUser(userId)
      void useAppearanceStore.getState().initializeForUser(userId)
      void useContextualHelpStore.getState().initializeForUser(userId)
    }

    function deactivateUser() {
      activeUserId = null
      setAuthGate('signed-out')
      useBrandKitStore.getState().clearForSignedOut()
      useAppearanceStore.getState().clearForSignedOut()
      useContextualHelpStore.getState().clearForSignedOut()
    }

    // Unconfigured environments get an explicit configuration gate. Authentication
    // is never bypassed, including local and packaged production builds.
    if (!supabaseConfigured) {
      useBrandKitStore.getState().clearForSignedOut()
      useAppearanceStore.getState().clearForSignedOut()
      useContextualHelpStore.getState().clearForSignedOut()
      useMediaStore.getState().clear()
      setAuthGate('configuration-required')
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      const userId = data.session?.user.id ?? null
      useMediaStore.getState().clear()
      if (userId) { activateUser(userId); return }
      // A refresh that failed purely because the network is down still
      // leaves the cached refresh token in storage — fall back to it instead
      // of forcing a sign-out the user can't recover from while offline.
      if (isNetworkAuthError(error)) {
        const cachedUserId = peekCachedSessionUserId()
        if (cachedUserId) { activateUser(cachedUserId); return }
      }
      deactivateUser()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user.id ?? null

      // A password-reset code verification lands here first. Hold on this
      // state (rendering the "set new password" screen) instead of treating
      // the recovery session as a normal sign-in.
      if (event === 'PASSWORD_RECOVERY') {
        setAuthGate('password-recovery')
        return
      }

      if (activeUserId !== userId) {
        productionOutputController.handleAuthChange()
        useMediaStore.getState().clear()
      }
      if (userId) activateUser(userId)
      else deactivateUser()
    })

    return () => {
      subscription.unsubscribe()
      productionOutputController.shutdown('Authentication lifecycle disposed')
    }
  }, [])

  // Still checking session — render blank to avoid flash
  if (authGate === 'checking') return <div className="auth-loading" role="status" aria-label="Checking authentication" />

  // Mid password-reset — collect the new password before rejoining the app.
  // (The auth-state listener above moves this to 'authenticated' once the
  // new password is saved, so no local transition is wired here.)
  if (authGate === 'password-recovery') return <ResetPasswordCompletionScreen />

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
