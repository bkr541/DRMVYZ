// Visual harness for the HEALTH chips and the red alert frame, with the app's own stylesheets (the same set main.tsx loads), the real notched rail and the real
// header status cluster. The page reads `window.__health` to set states from the test script.
import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../styles.css'
import '../../styles/analyzer.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'
import '../../styles/floatingWorkspace.css'
import '../../styles/typography.css'
import '../../styles/healthAlert.css'
import '../../styles/sidebar.css'
import '../../styles/reactView.css'
import { VyzualzSidebarLayout } from '../../components/vyzualz/VyzualzSidebarLayout'
import { ReactHeaderStatusCluster } from '../../components/vyzualz/react/ReactHeaderStatusCluster'
import { installHealthAlertFrame } from '../../lib/healthAlertFrame'
import { beginHealing, markFailed, markHealed, setHealthQuietly } from '../../lib/selfHealing'
import { useHealthStore } from '../../stores/healthStore'

installHealthAlertFrame()
document.documentElement.setAttribute('data-workspace-layout', 'floating')
document.body.setAttribute('data-app-workspace', 'react')
Object.assign(window, { __health: { beginHealing, markFailed, markHealed, setHealthQuietly, reset: () => useHealthStore.getState().reset() } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div className="az-root" style={{ display: 'flex', height: '100vh', gap: 8, padding: 8, boxSizing: 'border-box', background: '#0a0b0f' }}>
    <div className="fw-app-navigation">
      <VyzualzSidebarLayout isCollapsed floating notched appView="react" notifications={null} profile={null} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: 44 }}>
        <ReactHeaderStatusCluster fps={60} frameTimeMs={4.2} qualityTier="high" />
      </div>
      <div className="rv-shell rv-shell--floating" style={{ height: 380, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div className="rv-center-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="rv-canvas-wrap"><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, #1b3a46, #060d10)' }} /></div>
        </div>
      </div>
    </div>
  </div>,
)
