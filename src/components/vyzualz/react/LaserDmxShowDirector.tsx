import { useEffect } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import { LaserDmxShowDirectorPalette } from './LaserDmxShowDirectorPalette'

export function LaserDmxShowDirector() {
  const setAuthoringMode = useReactStore(s => s.setLaserDmxBeamMatrixAuthoringMode)

  useEffect(() => {
    setAuthoringMode('showDirector')
  }, [setAuthoringMode])

  return (
    <div className="rv-show-director-builder rv-show-director-builder--palette-only">
      <LaserDmxShowDirectorPalette />
    </div>
  )
}
