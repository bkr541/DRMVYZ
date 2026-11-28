// Must stay first: user-authored stores are created by the imports below and must be account-scoped from the start.
import './lib/accountScopedPersistenceBoot'
import { installPerformanceTelemetry } from './lib/performanceTelemetry'
import { installRendererRecovery } from './lib/rendererRecovery'
import { installHealthAlertFrame } from './lib/healthAlertFrame'
import { watchGraphicsPressure } from './lib/graphicsSelfHealing'
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
import './styles/presetManager.css'
import './styles/workspaceShell.css'
import './styles/appearance.css'
import './styles/floatingWorkspace.css'
import './styles/tabRows.css'
import './styles/groupSpacing.css'
import './styles/typography.css'
import './styles/healthAlert.css'
import { bootstrapAppearanceTheme } from './features/appearance/appearanceStore'

bootstrapAppearanceTheme()

const stopPerformanceTelemetry = installPerformanceTelemetry()
if (import.meta.hot) import.meta.hot.dispose(stopPerformanceTelemetry)

// After the main process reloaded a stuck window: start on a light preset at reduced quality, and listen for a graphics-process restart (see src/lib/rendererRecovery.ts).
const stopRendererRecovery = installRendererRecovery()
if (import.meta.hot) import.meta.hot.dispose(stopRendererRecovery)

// Self-healing status: the red alert frame follows the health store, and reduced quality from performance pressure shows as a quiet "degraded" state (src/lib/selfHealing.ts).
const stopHealthAlertFrame = installHealthAlertFrame()
const stopGraphicsPressureWatch = watchGraphicsPressure()
if (import.meta.hot) import.meta.hot.dispose(() => { stopHealthAlertFrame(); stopGraphicsPressureWatch() })

// Development builds only: exposes `__CINEMA2_RENDER_DIAGNOSTICS__` in the console (frame time, draw calls, GPU memory, shader compiles). Not in production.
if (import.meta.env.DEV) {
  void import('./components/vyzualz/cinema2/runtime/Cinema2RenderDiagnostics').then(module => module.installCinema2RenderDiagnosticsGlobal())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
