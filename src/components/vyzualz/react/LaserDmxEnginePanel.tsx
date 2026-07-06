import { useState } from 'react'
import { LaserDmxBeamMatrixPanel } from './LaserDmxBeamMatrixPanel'
import { LaserDmxCueListPanel } from './LaserDmxCueListPanel'

type LaserDmxRigSurface = 'workspace' | 'showDirector'

const SURFACE_OPTIONS: Array<{ id: LaserDmxRigSurface; label: string }> = [
  { id: 'workspace', label: 'MATRIX' },
  { id: 'showDirector', label: 'SHOW DIRECTOR' },
]

export function LaserDmxEnginePanel() {
  const [surface, setSurface] = useState<LaserDmxRigSurface>('workspace')

  return (
    <div className="rv-laser-workspace">
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

      <div className="rv-laser-workspace-surface" role="tabpanel">
        {surface === 'showDirector' ? (
          <LaserDmxCueListPanel />
        ) : (
          <LaserDmxBeamMatrixPanel />
        )}
      </div>
    </div>
  )
}
