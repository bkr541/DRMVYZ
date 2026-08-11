import { useReactStore } from '../../../stores/reactStore'
import { MusicIntelligenceDiagnosticsPanel } from '../modulation/MusicIntelligenceDiagnosticsPanel'
import { LaserDmxRendererDiagnosticsPanel } from './LaserDmxRendererDiagnosticsPanel'

export function ReactAudioPanel() {
  const isLaserDmx = useReactStore(state => state.activeReactEngineId === 'laserDmx')
  return (
    <div className="rv-audio-analysis-panel">
      <MusicIntelligenceDiagnosticsPanel />
      {isLaserDmx && <LaserDmxRendererDiagnosticsPanel />}
    </div>
  )
}
