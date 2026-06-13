import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxWorkspaceModeSelector } from './LaserDmxWorkspaceModeSelector'
import { LaserDmxSpatialFixturesPanel } from './LaserDmxSpatialFixturesPanel'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'

export function LaserDmxEnginePanel() {
  const { laserDmxWorkspaceMode } = useReactStore(
    useShallow(s => ({ laserDmxWorkspaceMode: s.laserDmxWorkspaceMode }))
  )

  return (
    <>
      <LaserDmxWorkspaceModeSelector />
      {laserDmxWorkspaceMode === 'beamMatrix'
        ? <LaserDmxBeamMatrixPanel />
        : <LaserDmxSpatialFixturesPanel />
      }
    </>
  )
}
