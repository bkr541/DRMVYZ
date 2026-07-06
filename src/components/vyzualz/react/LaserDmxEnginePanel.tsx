import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { LaserDmxShowDirector } from './LaserDmxShowDirector'
import type { LaserDmxBeamMatrixAuthoringMode } from './ReactTypes'

type LaserDmxRigSurface = 'workspace' | 'showDirector'

const SURFACE_OPTIONS: Array<{ id: LaserDmxRigSurface; label: string }> = [
  { id: 'workspace', label: 'MATRIX' },
  { id: 'showDirector', label: 'SHOW DIRECTOR' },
]

const AUTHORING_OPTIONS: Array<{ id: LaserDmxBeamMatrixAuthoringMode; label: string }> = [
  { id: 'manual', label: 'MANUAL MATRIX' },
  { id: 'showDirector', label: 'SHOW DIRECTOR' },
]

export function LaserDmxEnginePanel() {
  const [surface, setSurface] = useState<LaserDmxRigSurface>('workspace')
  const { authoringMode, setAuthoringMode } = useReactStore(useShallow(s => ({
    authoringMode:    s.laserDmxBeamMatrixAuthoringMode,
    setAuthoringMode: s.setLaserDmxBeamMatrixAuthoringMode,
  })))

  return (
    <div className="rv-laser-workspace">
      <div className="rv-laser-rig-toolbar">
        <div className="rv-segmented-control rv-laser-rig-surfaces" role="tablist" aria-label="LaserDMX Beam Matrix surfaces">
          {SURFACE_OPTIONS.map(option => (
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

        <div className="rv-laser-runtime-source" aria-label="LaserDMX render source">
          <span>Preview source</span>
          <div className="rv-segmented-control" role="radiogroup" aria-label="LaserDMX preview source">
            {AUTHORING_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={authoringMode === option.id}
                className={authoringMode === option.id ? 'is-active' : ''}
                onClick={() => setAuthoringMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
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
