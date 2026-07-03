import { useEffect, useState } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxWorkspaceModeSelector } from './LaserDmxWorkspaceModeSelector'
import { LaserDmxSpatialFixturesPanel } from './LaserDmxSpatialFixturesPanel'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { LaserDmxCueListPanel } from './LaserDmxCueListPanel'

type LaserDmxRigSurface = 'workspace' | 'fixtures' | 'showDirector'

export function LaserDmxEnginePanel() {
  const laserDmxWorkspaceMode = useReactStore(state => state.laserDmxWorkspaceMode)
  const [surface, setSurface] = useState<LaserDmxRigSurface>('workspace')

  useEffect(() => {
    if (laserDmxWorkspaceMode === 'beamMatrix' && surface === 'fixtures') {
      setSurface('workspace')
    }
  }, [laserDmxWorkspaceMode, surface])

  const surfaceOptions: Array<{ id: LaserDmxRigSurface; label: string }> = laserDmxWorkspaceMode === 'beamMatrix'
    ? [
        { id: 'workspace', label: 'MATRIX' },
        { id: 'showDirector', label: 'SHOW DIRECTOR' },
      ]
    : [
        { id: 'workspace', label: 'RIG SETUP' },
        { id: 'fixtures', label: 'FIXTURES' },
        { id: 'showDirector', label: 'SHOW DIRECTOR' },
      ]

  return (
    <div className="rv-laser-workspace">
      <LaserDmxWorkspaceModeSelector />
      <div className="rv-segmented-control rv-laser-rig-surfaces" role="tablist" aria-label="LaserDMX workspace surfaces">
        {surfaceOptions.map(option => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={surface === option.id}
            className={surface === option.id ? 'is-active' : ''}
            onClick={() => setSurface(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rv-laser-workspace-surface" role="tabpanel">
        {surface === 'showDirector' ? (
          <LaserDmxCueListPanel />
        ) : laserDmxWorkspaceMode === 'beamMatrix' ? (
          <LaserDmxBeamMatrixPanel />
        ) : (
          <LaserDmxSpatialFixturesPanel surface={surface === 'fixtures' ? 'fixtures' : 'setup'} />
        )}
      </div>
    </div>
  )
}
