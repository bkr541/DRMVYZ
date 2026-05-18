import { useState } from 'react'
import { AnalyzerView } from './components/analyzer/AnalyzerView'
import { ReferenceView } from './components/reference/ReferenceView'
import { VyzualzView } from './components/vyzualz/VyzualzView'

type AppView = 'analyzer' | 'reference' | 'vyzualz'

export default function App() {
  const [view, setView] = useState<AppView>('analyzer')

  if (view === 'reference') return <ReferenceView activeView={view} onNavigate={setView} />
  if (view === 'vyzualz')   return <VyzualzView   activeView={view} onNavigate={setView} />
  return <AnalyzerView activeView={view} onNavigate={setView} />
}
