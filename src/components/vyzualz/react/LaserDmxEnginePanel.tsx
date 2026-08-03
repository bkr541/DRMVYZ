import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { LaserDmxShowDirector } from './LaserDmxShowDirector'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

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
        <div className="rv-segmented-control rv-laser-rig-surfaces" role="tablist" aria-label="LaserDMX Beam Matrix surfaces">
          {SURFACE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={surface === option.id}
              className={surface === option.id ? 'is-active' : ''}
              onClick={() => handleSurfaceChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
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
