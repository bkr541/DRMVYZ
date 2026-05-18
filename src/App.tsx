import { useState, useEffect } from 'react'
import { supabase }            from './lib/supabase'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AuthPage }            from './components/auth/AuthPage'
import { AnalyzerView }        from './components/analyzer/AnalyzerView'
import { ReferenceView }       from './components/reference/ReferenceView'
import { VyzualzView }         from './components/vyzualz/VyzualzView'

type AppView = 'analyzer' | 'reference' | 'vyzualz'

export default function App() {
  const [view, setView]   = useState<AppView>('analyzer')
  const [authed, setAuthed] = useState<boolean | null>(null) // null = checking

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session)
    })

    // Keep in sync with Supabase auth state changes
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
