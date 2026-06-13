import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { SelectRow } from './ReactControlRows'
import type { LaserDmxWorkspaceMode } from './ReactTypes'

const MODE_OPTIONS = [
  { value: 'spatialFixtures', label: 'Spatial Fixtures' },
  { value: 'beamMatrix',      label: 'Beam Matrix'      },
]

export function LaserDmxWorkspaceModeSelector() {
  const { laserDmxWorkspaceMode, setLaserDmxWorkspaceMode } = useReactStore(
    useShallow(s => ({
      laserDmxWorkspaceMode:    s.laserDmxWorkspaceMode,
      setLaserDmxWorkspaceMode: s.setLaserDmxWorkspaceMode,
    }))
  )

  return (
    <SelectRow
      label="Workspace"
      value={laserDmxWorkspaceMode}
      onChange={v => setLaserDmxWorkspaceMode(v as LaserDmxWorkspaceMode)}
      options={MODE_OPTIONS}
    />
  )
}
