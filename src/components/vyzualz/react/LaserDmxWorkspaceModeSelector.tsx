import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { LaserDmxWorkspaceMode } from './ReactTypes'

const MODE_OPTIONS: Array<{ value: LaserDmxWorkspaceMode; label: string }> = [
  { value: 'spatialFixtures', label: 'Spatial Fixtures' },
  { value: 'beamMatrix', label: 'Beam Matrix' },
]

export function LaserDmxWorkspaceModeSelector() {
  const { laserDmxWorkspaceMode, setLaserDmxWorkspaceMode } = useReactStore(
    useShallow(s => ({
      laserDmxWorkspaceMode:    s.laserDmxWorkspaceMode,
      setLaserDmxWorkspaceMode: s.setLaserDmxWorkspaceMode,
    }))
  )

  return (
    <div className="rv-ctrl-row">
      <span className="rv-ctrl-label" id="laser-dmx-workspace-label">Workspace</span>
      <div className="rv-segmented-control" role="radiogroup" aria-labelledby="laser-dmx-workspace-label">
        {MODE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={laserDmxWorkspaceMode === option.value}
            className={laserDmxWorkspaceMode === option.value ? 'is-active' : ''}
            onClick={() => setLaserDmxWorkspaceMode(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
