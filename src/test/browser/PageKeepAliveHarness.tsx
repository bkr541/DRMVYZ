// The real application router (frame, sidebar, every page and the React view) without the login gate, to check that the React view keeps running behind other pages while a cast is
// live. There is no native output bridge in a browser, so the cast is represented by the health store's cast state (what keeps the view alive). Driven by scripts, not run in CI.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../styles.css'
import '../../styles/analyzer.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/mediaUploadModal.css'
import '../../styles/mediaPreviewModal.css'
import '../../styles/lyricManager.css'
import '../../styles/mediaManager.css'
import '../../styles/presetManager.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'
import '../../styles/floatingWorkspace.css'
import '../../styles/tabRows.css'
import '../../styles/groupSpacing.css'
import '../../styles/typography.css'
import '../../styles/healthAlert.css'
import { AudioEngineProvider } from '../../context/AudioEngineContext'
import { VyzualzView } from '../../components/vyzualz/VyzualzView'
import { useHealthStore } from '../../stores/healthStore'

Object.assign(window, { __cast: { set: (state: 'idle' | 'ok') => useHealthStore.getState().setHealth('cast', state, null) } })
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AudioEngineProvider>
    <React.Suspense fallback={null}><VyzualzView activeView="vyzualz" onNavigate={() => {}} /></React.Suspense>
  </AudioEngineProvider>,
)
