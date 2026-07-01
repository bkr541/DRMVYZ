import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxWorkspaceModeSelector } from './LaserDmxWorkspaceModeSelector'
import { LaserDmxSpatialFixturesPanel } from './LaserDmxSpatialFixturesPanel'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { CtrlSection } from './ReactControlRows'
import { LaserDmxCueListPanel } from './LaserDmxCueListPanel'

export function LaserDmxEnginePanel() {
  const laserDmxWorkspaceMode = useReactStore(state => state.laserDmxWorkspaceMode)

  return (
    <>
      <LaserDmxWorkspaceModeSelector />
      {laserDmxWorkspaceMode === 'beamMatrix'
        ? <LaserDmxBeamMatrixPanel />
        : <LaserDmxSpatialFixturesPanel />
      }
      <CtrlSection label="Show Director" />
      <LaserDmxCueListPanel />
    </>
  )
}
