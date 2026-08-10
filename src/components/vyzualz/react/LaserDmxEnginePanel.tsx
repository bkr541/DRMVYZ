import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { LaserDmxShowDirector } from './LaserDmxShowDirector'
import { HelpInfoTrigger } from '../../shared/InfoPopover'
import { UnderlineTabs } from './controls/UnderlineTabs'

type LaserDmxRigSurface = 'workspace' | 'showDirector'

const SURFACE_OPTIONS: Array<{ id: LaserDmxRigSurface; label: string }> = [
  { id: 'workspace', label: 'MATRIX' },
  { id: 'showDirector', label: 'SHOW DIRECTOR' },
]

export function LaserDmxEnginePanel() {
  const authoringMode = useReactStore(s => s.laserDmxBeamMatrixAuthoringMode)
  const setAuthoringMode = useReactStore(s => s.setLaserDmxBeamMatrixAuthoringMode)
  const surface: LaserDmxRigSurface = authoringMode === 'showDirector' ? 'showDirector' : 'workspace'

  const handleSurfaceChange = (nextSurface: LaserDmxRigSurface) => {
    setAuthoringMode(nextSurface === 'showDirector' ? 'showDirector' : 'manual')
  }

  return (
    <div className="rv-laser-workspace">
      <div className="rv-laser-rig-toolbar rv-laser-workspace-mode-help drm-help-overlay-anchor">
        <UnderlineTabs
          tabs={SURFACE_OPTIONS}
          activeTab={surface}
          onChange={handleSurfaceChange}
          ariaLabel="LaserDMX Beam Matrix surfaces"
          className="rv-laser-rig-surfaces"
        />
        <HelpInfoTrigger
          helpId="react.laserDmx.workspace.overview"
          currentValue={surface === 'showDirector' ? 'Show Director' : 'Matrix'}
          currentValueTone="accent"
          placement="right"
        />
      </div>

      <div className="rv-laser-workspace-surface" role="tabpanel">
        {surface === 'showDirector' ? (
          <LaserDmxShowDirector />
        ) : (
          <LaserDmxBeamMatrixPanel />
        )}
      </div>
    </div>
  )
}
