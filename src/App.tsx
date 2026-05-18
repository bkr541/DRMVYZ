import { useState, useEffect } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage }            from './components/auth/AuthPage'
import { AnalyzerView }        from './components/analyzer/AnalyzerView'
import { ReferenceView }       from './components/reference/ReferenceView'
import { VyzualzView }         from './components/vyzualz/VyzualzView'

type AppView = 'analyzer' | 'reference' | 'vyzualz'

export default function App() {
  const [view, setView]     = useState<AppView>('analyzer')
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    // Skip auth check when Supabase is not configured (dev without .env)
    if (!supabaseConfigured) { setAuthed(false); return }

    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Still checking session — render blank to avoid flash
  if (authed === null) return <div className="auth-loading"/>

  // Not authenticated — show auth gate
  if (!authed) return <AuthPage onAuth={() => setAuthed(true)}/>

  // Authenticated — show app
  return (
    <AudioEngineProvider>
      {view === 'reference' ? <ReferenceView activeView={view} onNavigate={setView}/> :
       view === 'vyzualz'   ? <VyzualzView   activeView={view} onNavigate={setView}/> :
                              <AnalyzerView  activeView={view} onNavigate={setView}/>}
    </AudioEngineProvider>
  )
}
