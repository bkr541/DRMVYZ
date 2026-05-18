import { useState } from 'react'
import { AudioEngineProvider } from './context/AudioEngineContext'
import { AnalyzerView }  from './components/analyzer/AnalyzerView'
import { ReferenceView } from './components/reference/ReferenceView'
import { VyzualzView }   from './components/vyzualz/VyzualzView'

type AppView = 'analyzer' | 'reference' | 'vyzualz'

export default function App() {
  const [view, setView] = useState<AppView>('analyzer')

  return (
    <AudioEngineProvider>
      {view === 'reference' ? <ReferenceView activeView={view} onNavigate={setView} /> :
       view === 'vyzualz'   ? <VyzualzView   activeView={view} onNavigate={setView} /> :
                              <AnalyzerView  activeView={view} onNavigate={setView} />}
    </AudioEngineProvider>
  )
}
