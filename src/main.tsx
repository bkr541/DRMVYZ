import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles/analyzer.css'
import './styles/reference.css'
import './styles/vyzualz.css'
import './styles/mediaUploadModal.css'
import './styles/mediaPreviewModal.css'
import './styles/lyricManager.css'
import './styles/mediaManager.css'
import './styles/workspaceShell.css'
import './styles/appearance.css'
import { bootstrapAppearanceTheme } from './features/appearance/appearanceStore'

bootstrapAppearanceTheme()

// Development builds only: exposes `__CINEMA2_RENDER_DIAGNOSTICS__` in the console (frame time, draw calls, GPU memory, shader compiles). Not in production.
if (import.meta.env.DEV) {
  void import('./components/vyzualz/cinema2/runtime/Cinema2RenderDiagnostics').then(module => module.installCinema2RenderDiagnosticsGlobal())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
